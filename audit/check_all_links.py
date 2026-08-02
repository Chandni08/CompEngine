#!/usr/bin/env python3
"""Read-only outbound-link audit for the Competition Engine data files."""

from __future__ import annotations

import json
import re
import ssl
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
OUTPUT = ROOT / "audit" / "link_check.json"
URL_RE = re.compile(r"https?://[^\s\"'<>]+", re.I)
TRAILING = ".,;:!?)]}"
TIMEOUT = 12
WORKERS = 32
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)


def urls_in(value: Any) -> set[str]:
    found: set[str] = set()
    if isinstance(value, dict):
        for child in value.values():
            found.update(urls_in(child))
    elif isinstance(value, list):
        for child in value:
            found.update(urls_in(child))
    elif isinstance(value, str):
        found.update(match.rstrip(TRAILING) for match in URL_RE.findall(value))
    return found


def collect_urls() -> list[str]:
    result: set[str] = set()
    for path in sorted(DATA_DIR.glob("*.json")):
        if path.name == "link_health.json":
            continue
        result.update(urls_in(json.loads(path.read_text(encoding="utf-8"))))
    return sorted(result)


def collect_references() -> dict[str, list[dict[str, str]]]:
    refs_by_url: dict[str, list[dict[str, str]]] = {}
    for path in sorted(DATA_DIR.glob("*.json")):
        if path.name == "link_health.json":
            continue
        data = json.loads(path.read_text(encoding="utf-8"))

        def visit(value: Any, trail: list[str]) -> None:
            if isinstance(value, dict):
                value_urls = urls_in(value)
                if value_urls:
                    label = ""
                    for key in ("title", "headline", "product", "eventName", "name", "label", "sourceName"):
                        candidate = value.get(key)
                        if isinstance(candidate, str) and candidate.strip():
                            label = candidate.strip()
                            break
                    for value_url in value_urls:
                        refs_by_url.setdefault(value_url, []).append(
                            {"file": str(path.relative_to(ROOT)), "path": ".".join(trail), "label": label}
                        )
                for key, child in value.items():
                    visit(child, trail + [str(key)])
            elif isinstance(value, list):
                for index, child in enumerate(value):
                    visit(child, trail + [str(index)])

        visit(data, [])
    for url, refs in refs_by_url.items():
        unique: list[dict[str, str]] = []
        seen: set[tuple[str, str, str]] = set()
        for ref in refs:
            key = (ref["file"], ref["path"], ref["label"])
            if key not in seen:
                seen.add(key)
                unique.append(ref)
        refs_by_url[url] = unique[:20]
    return refs_by_url


def page_title(text: str) -> str:
    match = re.search(r"<title[^>]*>(.*?)</title>", text, re.I | re.S)
    if not match:
        return ""
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", match.group(1))).strip()[:300]


def check(url: str) -> dict[str, Any]:
    checked_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    try:
        response = requests.get(
            url,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/pdf,application/json;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            },
            allow_redirects=True,
            timeout=TIMEOUT,
            stream=True,
        )
        status = int(response.status_code)
        final_url = response.url
        content_type = response.headers.get("content-type", "")
        chunks: list[bytes] = []
        total = 0
        if "html" in content_type or "json" in content_type or "text" in content_type:
            for chunk in response.iter_content(32768):
                chunks.append(chunk)
                total += len(chunk)
                if total >= 524288:
                    break
        response.close()
        text = b"".join(chunks).decode("utf-8", errors="replace")
        classification = "OK" if 200 <= status < 400 else "Broken"
        return {
            "url": url,
            "httpStatus": status,
            "finalUrl": final_url,
            "contentType": content_type,
            "title": page_title(text),
            "classification": classification,
            "checkedAt": checked_at,
            "error": "",
        }
    except Exception as exc:  # noqa: BLE001 - audit records all network failures
        return {
            "url": url,
            "httpStatus": None,
            "finalUrl": "",
            "contentType": "",
            "title": "",
            "classification": "Broken",
            "checkedAt": checked_at,
            "error": f"{type(exc).__name__}: {str(exc)[:300]}",
        }


def main() -> int:
    urls = collect_urls()
    refs_by_url = collect_references()
    print(f"Fetching {len(urls)} unique outbound URLs...", flush=True)
    rows: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=WORKERS) as executor:
        futures = {executor.submit(check, url): url for url in urls}
        for index, future in enumerate(as_completed(futures), start=1):
            rows.append(future.result())
            if index % 100 == 0:
                print(f"  completed {index}/{len(urls)}", flush=True)
    rows.sort(key=lambda row: row["url"])
    for row in rows:
        row["references"] = refs_by_url.get(row["url"], [])
    OUTPUT.write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    counts = {label: sum(row["classification"] == label for row in rows) for label in ("OK", "Broken")}
    redirected = sum(row["finalUrl"] and row["finalUrl"] != row["url"] for row in rows)
    print(json.dumps({"total": len(rows), **counts, "redirected": redirected, "output": str(OUTPUT)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
