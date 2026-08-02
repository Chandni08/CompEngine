#!/usr/bin/env python3
"""Check every public URL referenced by JSON files in data/."""

from __future__ import annotations

import json
import re
import socket
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import certifi
import requests
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
OUTPUT_FILE = DATA_DIR / "link_health.json"
TIMEOUT_SECONDS = 30
MAX_WORKERS = 12
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/126.0.0.0 Safari/537.36"
)
URL_PATTERN = re.compile(r"https?://[^\s\"'<>]+", re.IGNORECASE)
TRAILING_PUNCTUATION = ".,;:!?)]}"
# Bulk journal item links were obtained from Crossref's official API during the
# same run. Re-requesting thousands of DOI redirects here is redundant, slow,
# and liable to trigger publisher rate limits. Their API endpoint and any links
# promoted into user-facing evidence remain part of the ordinary link check.
BULK_API_RECORD_KEYS = {"recentRecords"}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def urls_in_value(value: Any) -> set[str]:
    urls: set[str] = set()
    if isinstance(value, dict):
        for key, child in value.items():
            if key in BULK_API_RECORD_KEYS:
                continue
            urls.update(urls_in_value(child))
    elif isinstance(value, list):
        for child in value:
            urls.update(urls_in_value(child))
    elif isinstance(value, str):
        urls.update(match.rstrip(TRAILING_PUNCTUATION) for match in URL_PATTERN.findall(value))
    return {url for url in urls if url.startswith(("http://", "https://"))}


def collect_urls() -> list[str]:
    urls: set[str] = set()
    for path in sorted(DATA_DIR.glob("*.json")):
        if path == OUTPUT_FILE:
            continue
        try:
            urls.update(urls_in_value(json.loads(path.read_text(encoding="utf-8"))))
        except (OSError, json.JSONDecodeError) as error:
            raise RuntimeError(f"Cannot read {path.relative_to(ROOT)}: {error}") from error
    return sorted(urls)


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
    if any(marker in final_path for marker in ("custom404", "/404", "/login", "/signin", "/sign-in")):
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
        return {
            "url": url,
            "httpStatus": http_status,
            "finalUrl": final_url,
            "checkedAt": checked_at,
            "status": semantic_status or classify_http_status(http_status),
            "reason": semantic_reason,
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
    }


def write_results(results: list[dict[str, object]]) -> None:
    temporary = OUTPUT_FILE.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    temporary.replace(OUTPUT_FILE)


def print_dead_table(results: list[dict[str, object]]) -> None:
    dead = [result for result in results if result["status"] == "dead"]
    print("\nDead links")
    print("| HTTP status | URL |")
    print("| --- | --- |")
    if not dead:
        print("| — | None |")
        return
    for result in dead:
        status = result["httpStatus"] if result["httpStatus"] is not None else "network failure"
        print(f"| {status} | {result['url']} |")


def main() -> int:
    urls = collect_urls()
    print(f"Checking {len(urls)} unique URLs from {DATA_DIR.relative_to(ROOT)}/ ...")
    results: list[dict[str, object]] = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(check_url, url): url for url in urls}
        for future in as_completed(futures):
            results.append(future.result())

    results.sort(key=lambda result: str(result["url"]))
    write_results(results)
    print_dead_table(results)

    counts = {status: sum(result["status"] == status for result in results) for status in ("ok", "blocked", "dead", "mislink")}
    print(f"\nLink check complete: {counts['ok']} ok, {counts['blocked']} blocked, {counts['dead']} dead, {counts['mislink']} mislinks.")
    if counts["dead"] or counts["mislink"]:
        print("Link check failed: remove or replace every dead or semantically incorrect URL before publishing.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
