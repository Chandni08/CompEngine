#!/usr/bin/env python3
"""Build the strict current-link inventory, including publication rows visible in the UI."""

from __future__ import annotations

import csv
import html
import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import requests
import sys


ROOT = Path(__file__).resolve().parents[1]
OUT_JSON = ROOT / "audit" / "current_presented_link_check_2026-08-02.json"
OUT_CSV = ROOT / "audit" / "current_link_inventory_2026-08-02.csv"
BROKEN_CSV = ROOT / "audit" / "current_broken_mislink_ledger_2026-08-02.csv"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/pdf,application/json;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def apply_strict_title_rules(row: dict) -> dict:
    visible = f"{row.get('title', '')} {row.get('h1', '')}".lower().strip()
    access_tokens = (
        "access denied", "prove your humanity", "please wait for verification",
        "verify you are human", "sign in to continue", "login required",
    )
    soft_404_tokens = ("page not found", "404 not found", "error404", "the page you requested could not be found")
    redirect_wall = row.get("title", "").strip().lower() == "redirecting"
    if any(token in visible for token in access_tokens) or redirect_wall:
        row["classification"] = "Broken"
        row["reason"] = "login/access or redirect wall"
    elif any(token in visible for token in soft_404_tokens):
        row["classification"] = "Broken"
        row["reason"] = "soft 404"
    return row


def plain(value: str) -> str:
    value = html.unescape(value or "")
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def extract_title(text: str) -> tuple[str, str]:
    title_match = re.search(r"<title[^>]*>(.*?)</title>", text, re.I | re.S)
    h1_match = re.search(r"<h1[^>]*>(.*?)</h1>", text, re.I | re.S)
    return (
        plain(title_match.group(1))[:300] if title_match else "",
        plain(h1_match.group(1))[:300] if h1_match else "",
    )


def fetch(url: str) -> dict:
    checked = datetime.now(timezone.utc).isoformat(timespec="seconds")
    try:
        response = requests.get(url, headers=HEADERS, timeout=12, allow_redirects=True, stream=True)
        status = response.status_code
        final = response.url
        ctype = response.headers.get("content-type", "")
        chunks = []
        size = 0
        if any(kind in ctype.lower() for kind in ("html", "text", "json")):
            for chunk in response.iter_content(32768):
                chunks.append(chunk)
                size += len(chunk)
                if size >= 524288:
                    break
        response.close()
        text = b"".join(chunks).decode("utf-8", errors="replace")
        title, h1 = extract_title(text)
        lower = f"{title} {h1} {plain(text[:20000])}".lower()
        source_path = urlparse(url).path.rstrip("/")
        final_path = urlparse(final).path.rstrip("/")
        generic_redirect = bool(source_path and source_path != final_path and final_path in {"", "/", "/en", "/en-us", "/us/en"})
        login = any(token in lower[:5000] for token in ("access denied", "sign in to continue", "login required", "verify you are human", "prove your humanity"))
        soft_404 = any(token in lower[:3000] for token in ("page not found", "404 not found", "error404", "the page you requested could not be found"))
        if status >= 400 or login or soft_404:
            classification = "Broken"
            reason = f"HTTP {status}" if status >= 400 else ("login/access wall" if login else "soft 404")
        elif generic_redirect:
            classification = "Mislink"
            reason = "specific source redirected to a generic homepage"
        else:
            classification = "OK"
            reason = ""
        return {"url": url, "httpStatus": status, "finalUrl": final, "contentType": ctype,
                "title": title, "h1": h1, "classification": classification,
                "reason": reason, "checkedAt": checked, "error": ""}
    except Exception as exc:
        return {"url": url, "httpStatus": None, "finalUrl": "", "contentType": "",
                "title": "", "h1": "", "classification": "Broken", "reason": "fetch error",
                "checkedAt": checked, "error": f"{type(exc).__name__}: {exc}"}


def recent_record_refs() -> dict[str, list[dict]]:
    data = json.loads((ROOT / "data" / "journal_sources.json").read_text())
    refs: dict[str, list[dict]] = {}
    def walk(value):
        if isinstance(value, dict):
            records = value.get("recentRecords")
            if isinstance(records, list):
                source = value.get("sourceName") or value.get("name") or value.get("journal") or "Publication source"
                for index, record in enumerate(records[:12]):
                    url = record.get("sourceUrl")
                    if url:
                        refs.setdefault(url, []).append({
                            "file": "data/journal_sources.json",
                            "path": f"{source}.recentRecords.{index}",
                            "label": record.get("title", ""),
                        })
            for child in value.values():
                walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)
    walk(data)
    return refs


def main() -> None:
    if "--reuse" in sys.argv:
        rows = [apply_strict_title_rules(row) for row in json.loads(OUT_JSON.read_text())]
        write_outputs(rows, 0)
        return
    baseline = json.loads((ROOT / "data" / "link_health.json").read_text())
    old_rows = json.loads((ROOT / "audit" / "link_check.json").read_text())
    old = {row["url"]: row for row in old_rows}
    recent_refs = recent_record_refs()
    base = {row["url"]: row for row in baseline}
    urls = sorted(set(base) | set(recent_refs))

    fetch_urls = []
    rows_by_url = {}
    for url in urls:
        fresh = base.get(url)
        cached = old.get(url, {})
        if fresh and fresh.get("status") != "ok":
            rows_by_url[url] = {
                "url": url, "httpStatus": fresh.get("httpStatus"), "finalUrl": fresh.get("finalUrl", ""),
                "contentType": "", "title": cached.get("title", ""), "h1": "", "classification": "Broken",
                "reason": fresh.get("reason") or "strict access failure", "checkedAt": fresh.get("checkedAt", ""),
                "error": "", "checkBasis": "fresh data/link_health.json",
            }
        elif cached.get("title") and fresh:
            cached_title = cached.get("title", "")
            cached_lower = cached_title.lower()
            cached_broken = any(token in cached_lower for token in ("access denied", "prove your humanity", "error404", "page not found"))
            rows_by_url[url] = {
                "url": url, "httpStatus": fresh.get("httpStatus"), "finalUrl": fresh.get("finalUrl", url),
                "contentType": cached.get("contentType", ""), "title": cached_title, "h1": "",
                "classification": "Broken" if cached_broken else "OK",
                "reason": "login/access wall or soft 404" if cached_broken else "",
                "checkedAt": fresh.get("checkedAt", ""), "error": "",
                "checkBasis": "fresh status plus retained title",
            }
        else:
            fetch_urls.append(url)

    print(f"Fetching titles/status for {len(fetch_urls)} of {len(urls)} presented URLs...", flush=True)
    with ThreadPoolExecutor(max_workers=32) as pool:
        futures = {pool.submit(fetch, url): url for url in fetch_urls}
        for index, future in enumerate(as_completed(futures), 1):
            row = future.result()
            row["checkBasis"] = "fresh direct fetch"
            rows_by_url[row["url"]] = row
            if index % 100 == 0:
                print(f"  completed {index}/{len(fetch_urls)}", flush=True)

    # Preserve provenance labels from the broad link check and add visible publication rows.
    for url, row in rows_by_url.items():
        refs = list(old.get(url, {}).get("references", []))
        refs.extend(recent_refs.get(url, []))
        dedup = []
        seen = set()
        for ref in refs:
            key = (ref.get("file", ""), ref.get("path", ""), ref.get("label", ""))
            if key not in seen:
                seen.add(key)
                dedup.append(ref)
        row["references"] = dedup[:30]

    rows = [apply_strict_title_rules(rows_by_url[url]) for url in urls]
    write_outputs(rows, len(fetch_urls))


def write_outputs(rows: list[dict], fresh_fetches: int) -> None:
    OUT_JSON.write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n")
    fields = ["url", "classification", "httpStatus", "finalUrl", "title", "h1", "reason", "checkedAt", "checkBasis", "references"]
    for path, selected in ((OUT_CSV, rows), (BROKEN_CSV, [r for r in rows if r["classification"] != "OK"])):
        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=fields)
            writer.writeheader()
            for row in selected:
                out = {key: row.get(key, "") for key in fields}
                out["references"] = json.dumps(row.get("references", []), ensure_ascii=False)
                writer.writerow(out)

    counts = {label: sum(r["classification"] == label for r in rows) for label in ("OK", "Broken", "Mislink")}
    print(json.dumps({"total": len(rows), **counts, "freshFetches": fresh_fetches, "output": str(OUT_JSON)}, indent=2))


if __name__ == "__main__":
    main()
