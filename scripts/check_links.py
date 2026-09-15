#!/usr/bin/env python3
"""Check every public URL referenced by JSON files in data/."""

from __future__ import annotations

import hashlib
import json
import re
import socket
import sys
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import certifi
import requests
from urllib.parse import urlparse

from link_changes import (
    REDIRECT_MOVED,
    REDIRECT_NORMALIZED,
    REDIRECT_OFFSITE,
    REDIRECT_RESOLVED,
    REDIRECT_SAME,
    canonical_link,
    classify_redirect,
)


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
OUTPUT_FILE = DATA_DIR / "link_health.json"
REDIRECT_FILE = DATA_DIR / "link_redirects.json"
# Sitemap snapshots must mirror exactly what the source listed, because the
# collectors diff them by URL string. Canonicalising a key here would make the
# next run report the original URL as newly added and the rewritten one as
# missing, inventing a change that never happened.
NO_REWRITE_DIRS = {"source_snapshots"}
TIMEOUT_SECONDS = 30
MAX_WORKERS = 12
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/126.0.0.0 Safari/537.36"
)
URL_PATTERN = re.compile(r"https?://[^\s\"'<>]+", re.IGNORECASE)
TRAILING_PUNCTUATION = ".,;:!?)]}"
# Bulk journal item links come from Crossref's official API during the same run.
# Re-requesting every DOI daily is slow and trips publisher rate limits, but the
# dashboard renders these records, so skipping them entirely left thousands of
# displayed links unverified. Check a deterministic rotating slice instead: every
# link is covered over BULK_ROTATION_DAYS, and the daily request budget is bounded.
BULK_API_RECORD_KEYS = {"recentRecords"}
BULK_ROTATION_DAYS = 14
DOMAIN_WIDE_404_HOSTS = {"fda.gov"}
MIN_DOMAIN_WIDE_404S = 5
DOMAIN_WIDE_404_REASON_PREFIX = "Domain-wide 404 anomaly:"
# Some publisher WAFs return a bot challenge on one GitHub-hosted runner and a
# synthetic 404 on another. A URL that was already blocked by that WAF has not
# become proven-dead merely because the presentation of the block changed.
WAF_404_CONTINUITY_HOSTS = {"pharmaceuticalonline.com"}
WAF_404_REASON_PREFIX = "Runner/WAF 404 anomaly:"
KNOWN_ACCESS_CONTROL_DESTINATIONS = {
    ("fda.gov", "/apology_objects/abuse-detection-apology.html"),
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def urls_in_value(value: Any) -> set[str]:
    urls: set[str] = set()
    if isinstance(value, dict):
        for key, child in value.items():
            if key in BULK_API_RECORD_KEYS:
                continue
            # Sitemap snapshots and content-hash maps are keyed *by* the tracked
            # URL, so a values-only walk missed every page under monitoring.
            if isinstance(key, str) and key.startswith(("http://", "https://")):
                urls.update(match.rstrip(TRAILING_PUNCTUATION) for match in URL_PATTERN.findall(key))
            urls.update(urls_in_value(child))
    elif isinstance(value, list):
        for child in value:
            urls.update(urls_in_value(child))
    elif isinstance(value, str):
        urls.update(match.rstrip(TRAILING_PUNCTUATION) for match in URL_PATTERN.findall(value))
    return {url for url in urls if url.startswith(("http://", "https://"))}


def bulk_urls_in_value(value: Any) -> set[str]:
    """URLs that live only under a bulk-record key, which the main walk skips."""
    urls: set[str] = set()
    if isinstance(value, dict):
        for key, child in value.items():
            urls.update(urls_in_value(child) if key in BULK_API_RECORD_KEYS else bulk_urls_in_value(child))
            if key in BULK_API_RECORD_KEYS and isinstance(child, dict):
                urls.update(k for k in child if isinstance(k, str) and k.startswith(("http://", "https://")))
    elif isinstance(value, list):
        for child in value:
            urls.update(bulk_urls_in_value(child))
    return urls


def rotating_slice(urls: set[str], day_index: int, buckets: int = BULK_ROTATION_DAYS) -> set[str]:
    """Deterministically select today's share of a large URL set.

    Bucketing by a stable hash of the URL — not by list position — keeps a URL in
    the same bucket as the collection grows, so coverage stays even instead of
    reshuffling every time a record is added or removed.
    """
    if buckets < 1:
        return set(urls)
    today_bucket = day_index % buckets
    return {
        url for url in urls
        if int(hashlib.sha256(url.encode("utf-8")).hexdigest(), 16) % buckets == today_bucket
    }


def collect_urls(day_index: int | None = None) -> list[str]:
    """Every URL the dashboard can surface, minus today's unsampled bulk records.

    The walk is recursive: nested directories such as data/source_snapshots/ hold
    tracked competitor URLs and were previously never checked.
    """
    urls: set[str] = set()
    bulk: set[str] = set()
    for path in sorted(DATA_DIR.rglob("*.json")):
        if path in {OUTPUT_FILE, REDIRECT_FILE}:
            continue
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise RuntimeError(f"Cannot read {path.relative_to(ROOT)}: {error}") from error
        urls.update(urls_in_value(value))
        bulk.update(bulk_urls_in_value(value))
    if day_index is None:
        day_index = datetime.now(timezone.utc).toordinal()
    sampled = rotating_slice(bulk - urls, day_index)
    return sorted(urls | sampled)


def read_previous_results() -> list[dict[str, object]]:
    try:
        value = json.loads(OUTPUT_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    return value if isinstance(value, list) else []


def is_dns_failure(reason: object) -> bool:
    if isinstance(reason, socket.gaierror):
        return True
    message = str(reason).lower()
    return any(
        marker in message
        for marker in (
            "name or service not known",
            "nodename nor servname provided",
            "temporary failure in name resolution",
            "no address associated with hostname",
        )
    )


def classify_http_status(http_status: int) -> str:
    if http_status in (404, 410):
        return "dead"
    if 200 <= http_status < 400:
        return "ok"
    # Authentication, rate limits, bot protection, and transient server errors
    # do not prove that a source has disappeared. This includes the expected
    # Reddit and Agilent 403 responses.
    return "blocked"


def semantic_redirect_status(requested_url: str, final_url: str) -> tuple[str | None, str]:
    """Detect successful HTTP responses that do not land on the cited evidence."""
    requested = urlparse(requested_url)
    final = urlparse(final_url)
    final_path = (final.path or "/").lower()
    final_host = (final.hostname or "").lower().removeprefix("www.")
    if (final_host, final_path) in KNOWN_ACCESS_CONTROL_DESTINATIONS:
        return "blocked", f"Redirected to the publisher's access-control destination: {final_url}"
    # "/error404" and "/page-not-found" are error destinations too; matching only
    # "/404" let a redirect into an error page read as an ordinary page move.
    error_markers = (
        "custom404", "/404", "error404", "/error/", "page-not-found", "pagenotfound",
        "not-found", "/login", "/signin", "/sign-in",
    )
    if any(marker in final_path for marker in error_markers):
        return "mislink", f"Redirected to non-evidence destination: {final_url}"
    requested_path = (requested.path or "/").rstrip("/")
    if requested_path and requested_path != "/" and final_path.rstrip("/") in {"", "/"}:
        return "mislink", f"Deep link redirected to homepage: {final_url}"
    return None, ""


def semantic_body_status(content_type: str, body: str) -> tuple[str | None, str]:
    """Detect custom error and access-control pages returned with HTTP 200."""
    if not any(kind in content_type.lower() for kind in ("text", "html", "json", "xml")):
        return None, ""
    normalized = " ".join(body.lower().split())
    custom_error_markers = (
        "<title>404", "page not found", "the requested page could not be found",
        "we couldn't find the page", "we could not find the page",
    )
    if any(marker in normalized for marker in custom_error_markers):
        return "mislink", "HTTP success response contains a custom not-found page"
    access_markers = (
        "access denied", "verify you are human", "enable javascript and cookies to continue",
        "unusual traffic", "captcha",
    )
    if any(marker in normalized for marker in access_markers):
        return "blocked", "HTTP response contains an access-control or bot-challenge page"
    return None, ""


def check_url(url: str) -> dict[str, object]:
    checked_at = utc_now()
    try:
        response = requests.get(
            url,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            },
            allow_redirects=True,
            stream=True,
            timeout=TIMEOUT_SECONDS,
            verify=certifi.where(),
        )
        http_status = int(response.status_code)
        final_url = response.url
        chunks: list[bytes] = []
        size = 0
        for chunk in response.iter_content(chunk_size=8192):
            if not chunk:
                continue
            chunks.append(chunk)
            size += len(chunk)
            if size >= 65536:
                break
        body = b"".join(chunks).decode(response.encoding or "utf-8", errors="replace")
        redirect_status, redirect_reason = semantic_redirect_status(url, final_url)
        body_status, body_reason = semantic_body_status(response.headers.get("Content-Type", ""), body)
        response.close()
        semantic_status = redirect_status or body_status
        semantic_reason = redirect_reason or body_reason
        status = semantic_status or classify_http_status(http_status)
        # A redirect is only a link update if the request actually succeeded;
        # a bot challenge served from a login page says nothing about the target.
        redirect_kind, redirect_reason_text = (
            classify_redirect(url, final_url) if status == "ok" else (REDIRECT_SAME, "")
        )
        return {
            "url": url,
            "httpStatus": http_status,
            "finalUrl": final_url,
            "checkedAt": checked_at,
            "status": status,
            "reason": semantic_reason,
            "redirectKind": redirect_kind,
            "redirectReason": redirect_reason_text,
        }
    except (requests.Timeout, TimeoutError, socket.timeout):
        # A timeout does not prove that the cited page disappeared. Treat it
        # like rate limiting or bot protection; only an explicit 404/410 or a
        # DNS failure is strong enough to classify a URL as dead.
        status = "blocked"
    except requests.ConnectionError as error:
        status = "dead" if is_dns_failure(error) else "blocked"
    except (requests.RequestException, OSError) as error:
        status = "dead" if is_dns_failure(error) else "blocked"

    return {
        "url": url,
        "httpStatus": None,
        "checkedAt": checked_at,
        "status": status,
        "redirectKind": REDIRECT_SAME,
        "redirectReason": "",
    }


def normalized_host(url: object) -> str:
    host = (urlparse(str(url)).hostname or "").lower()
    return host.removeprefix("www.")


def reclassify_known_access_control_destinations(results: list[dict[str, object]]) -> int:
    """Reclassify explicit publisher WAF destinations even when HTTP is 404."""
    reclassified = 0
    for result in results:
        if result.get("status") == "blocked":
            continue
        status, reason = semantic_redirect_status(
            str(result.get("url") or ""),
            str(result.get("finalUrl") or result.get("url") or ""),
        )
        if status != "blocked":
            continue
        result["status"] = "blocked"
        result["reason"] = reason
        reclassified += 1
    return reclassified


def reclassify_domain_wide_404_anomalies(
    results: list[dict[str, object]],
    previous_results: list[dict[str, object]],
) -> int:
    """Keep a known domain-wide runner anomaly from becoming false link death.

    This exception is deliberately narrow: every currently tracked URL on an
    allowlisted host must return 404, at least five URLs must be affected, and
    every affected URL must have been healthy before the runner anomaly began.
    A prior anomaly classification is accepted so the same GitHub-runner block
    cannot pass once and then fail every later daily run. The links remain
    blocked/unverified rather than being promoted to healthy.
    """
    previous_by_url = {
        str(item.get("url")): item
        for item in previous_results
        if isinstance(item, dict) and item.get("url")
    }
    by_host: dict[str, list[dict[str, object]]] = defaultdict(list)
    for result in results:
        by_host[normalized_host(result.get("url"))].append(result)

    reclassified = 0
    for host in DOMAIN_WIDE_404_HOSTS:
        host_results = by_host.get(host, [])
        anomalous = [
            item
            for item in host_results
            if item.get("status") == "dead" and item.get("httpStatus") == 404
        ]
        if len(anomalous) < MIN_DOMAIN_WIDE_404S or len(anomalous) != len(host_results):
            continue
        if not all(
            previous_by_url.get(str(item.get("url")), {}).get("status") == "ok"
            or (
                previous_by_url.get(str(item.get("url")), {}).get("status") == "blocked"
                and str(previous_by_url.get(str(item.get("url")), {}).get("reason", "")).startswith(
                    DOMAIN_WIDE_404_REASON_PREFIX
                )
            )
            for item in anomalous
        ):
            continue
        reason = (
            f"{DOMAIN_WIDE_404_REASON_PREFIX} all {len(anomalous)} tracked {host} URLs returned 404 "
            "after being healthy in the previous validated run; manual confirmation required."
        )
        for item in anomalous:
            item["status"] = "blocked"
            item["reason"] = reason
            reclassified += 1
    return reclassified


def reclassify_waf_404_transitions(
    results: list[dict[str, object]],
    previous_results: list[dict[str, object]],
) -> int:
    """Keep a known WAF response change from masquerading as proven link death.

    This does not excuse a newly discovered 404. It applies only to an exact URL
    on an allowlisted host whose last validated result was an access-control
    block (or this same anomaly). A 410 remains dead because it is an explicit
    retirement signal.
    """
    previous_by_url = {
        str(item.get("url")): item
        for item in previous_results
        if isinstance(item, dict) and item.get("url")
    }
    reclassified = 0
    for result in results:
        if result.get("status") not in {"dead", "mislink"} or result.get("httpStatus") != 404:
            continue
        if normalized_host(result.get("url")) not in WAF_404_CONTINUITY_HOSTS:
            continue
        previous = previous_by_url.get(str(result.get("url")), {})
        previous_reason = str(previous.get("reason", ""))
        prior_waf_block = previous.get("status") == "blocked" and (
            previous_reason.startswith(WAF_404_REASON_PREFIX)
            or any(
                marker in previous_reason.lower()
                for marker in ("access-control", "bot-challenge", "captcha", "verify you are human")
            )
        )
        if not prior_waf_block:
            continue
        result["status"] = "blocked"
        result["reason"] = (
            f"{WAF_404_REASON_PREFIX} the GitHub runner returned 404 for a URL previously blocked "
            "by access control; the URL remains unverified and requires independent confirmation."
        )
        reclassified += 1
    return reclassified


def rewrite_urls_in_value(value: Any, replacements: dict[str, str]) -> tuple[Any, int]:
    """Replace superseded URLs throughout a JSON document."""
    if isinstance(value, dict):
        changed = 0
        result = {}
        for key, child in value.items():
            result[key], child_changed = rewrite_urls_in_value(child, replacements)
            changed += child_changed
        return result, changed
    if isinstance(value, list):
        changed = 0
        items = []
        for child in value:
            item, child_changed = rewrite_urls_in_value(child, replacements)
            items.append(item)
            changed += child_changed
        return items, changed
    if isinstance(value, str) and value in replacements:
        return replacements[value], 1
    return value, 0


def apply_url_replacements(replacements: dict[str, str]) -> int:
    """Update stored URLs that differ from the served address only in presentation.

    Only ``normalized`` redirects are rewritten. A ``moved`` redirect changes which
    page is being cited, so it is reported for review rather than silently
    following the vendor to a different product.
    """
    if not replacements:
        return 0
    total = 0
    for path in sorted(DATA_DIR.rglob("*.json")):
        if path in {OUTPUT_FILE, REDIRECT_FILE}:
            continue
        if any(part in NO_REWRITE_DIRS for part in path.relative_to(DATA_DIR).parts[:-1]):
            continue
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        updated, changed = rewrite_urls_in_value(value, replacements)
        if not changed:
            continue
        temporary = path.with_suffix(".json.tmp")
        temporary.write_text(json.dumps(updated, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        temporary.replace(path)
        total += changed
    return total


def write_redirect_report(results: list[dict[str, object]]) -> dict[str, object]:
    """Persist the redirects that change which page a citation points at.

    A vendor product page that redirects to a different product is a lifecycle
    event — a retirement, a successor, or a family consolidation. The pipeline
    already observed it on every run and discarded it; this artifact is what the
    refresh merges into the dataset as reviewable signals.
    """
    moved = [
        {
            "url": str(result["url"]),
            "finalUrl": str(result.get("finalUrl") or ""),
            "redirectKind": str(result.get("redirectKind") or ""),
            "reason": str(result.get("redirectReason") or ""),
            "httpStatus": result.get("httpStatus"),
            "observedAt": str(result.get("checkedAt") or ""),
        }
        for result in results
        if result.get("redirectKind") in {REDIRECT_MOVED, REDIRECT_OFFSITE}
    ]
    moved.sort(key=lambda item: item["url"])
    report = {
        "generatedAt": utc_now(),
        "schemaVersion": 1,
        "rewrittenLinks": [
            {
                "url": str(result["url"]),
                "reason": str(result.get("redirectReason") or ""),
            }
            for result in results
            if result.get("redirectResolved")
        ],
        "counts": {
            kind: sum(1 for result in results if result.get("redirectKind") == kind)
            for kind in (REDIRECT_SAME, REDIRECT_RESOLVED, REDIRECT_NORMALIZED, REDIRECT_MOVED, REDIRECT_OFFSITE)
        },
        "movedLinks": moved,
    }
    temporary = REDIRECT_FILE.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temporary.replace(REDIRECT_FILE)
    return report


def write_results(results: list[dict[str, object]]) -> None:
    temporary = OUTPUT_FILE.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    temporary.replace(OUTPUT_FILE)


def print_failure_table(results: list[dict[str, object]], status_name: str, heading: str) -> None:
    failures = [result for result in results if result["status"] == status_name]
    print(f"\n{heading}")
    print("| HTTP status | URL |")
    print("| --- | --- |")
    if not failures:
        print("| — | None |")
        return
    for result in failures:
        status = result["httpStatus"] if result["httpStatus"] is not None else "network failure"
        print(f"| {status} | {result['url']} |")


def print_redirect_table(report: dict[str, object]) -> None:
    moved = report.get("movedLinks") or []
    print("\nLinks that now serve a different page")
    print("| Stored URL | Now serves |")
    print("| --- | --- |")
    if not moved:
        print("| — | None |")
        return
    for item in moved:
        print(f"| {item['url']} | {item['finalUrl']} |")


def main() -> int:
    urls = collect_urls()
    previous_results = read_previous_results()
    print(f"Checking {len(urls)} unique URLs from {DATA_DIR.relative_to(ROOT)}/ ...")
    results: list[dict[str, object]] = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(check_url, url): url for url in urls}
        for future in as_completed(futures):
            results.append(future.result())

    results.sort(key=lambda result: str(result["url"]))
    access_control_count = reclassify_known_access_control_destinations(results)
    if access_control_count:
        print(
            f"Reclassified {access_control_count} explicit publisher access-control destinations as blocked; "
            "the affected links remain unverified."
        )
    anomaly_count = reclassify_domain_wide_404_anomalies(results, previous_results)
    if anomaly_count:
        print(
            f"Reclassified {anomaly_count} domain-wide anomalous 404 responses as blocked; "
            "the affected links remain unverified."
        )
    waf_anomaly_count = reclassify_waf_404_transitions(results, previous_results)
    if waf_anomaly_count:
        print(
            f"Reclassified {waf_anomaly_count} WAF response-transition 404s as blocked; "
            "the affected links remain unverified."
        )
    normalized = {
        str(result["url"]): canonical_link(str(result.get("finalUrl") or ""))
        for result in results
        if result.get("redirectKind") == REDIRECT_NORMALIZED and result.get("finalUrl")
    }
    normalized = {before: after for before, after in normalized.items() if before != after}
    rewritten = apply_url_replacements(normalized)
    if rewritten:
        print(
            f"Updated {rewritten} stored reference(s) across {len(normalized)} URL(s) that "
            "differ from the served address only in presentation."
        )
        for result in results:
            if str(result["url"]) in normalized:
                result["url"] = normalized[str(result["url"])]
                # The stored URL now matches what the server serves. Keep the
                # classification so the report still records what was rewritten
                # rather than reporting zero normalizations every run.
                result["redirectKind"] = REDIRECT_NORMALIZED
                result["redirectResolved"] = True

    write_results(results)
    report = write_redirect_report(results)
    print_failure_table(results, "dead", "Dead links")
    print_failure_table(results, "mislink", "Semantic mislinks")
    print_redirect_table(report)

    counts = {status: sum(result["status"] == status for result in results) for status in ("ok", "blocked", "dead", "mislink")}
    print(f"\nLink check complete: {counts['ok']} ok, {counts['blocked']} blocked, {counts['dead']} dead, {counts['mislink']} mislinks.")
    print(
        "Redirects: "
        + ", ".join(f"{count} {kind}" for kind, count in report["counts"].items() if count)
        + "."
    )
    if counts["dead"] or counts["mislink"]:
        print("Link check failed: remove or replace every dead or semantically incorrect URL before publishing.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
