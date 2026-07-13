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


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def urls_in_value(value: Any) -> set[str]:
    urls: set[str] = set()
    if isinstance(value, dict):
        for child in value.values():
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
        response.close()
        return {
            "url": url,
            "httpStatus": http_status,
            "checkedAt": checked_at,
            "status": classify_http_status(http_status),
        }
    except (requests.Timeout, TimeoutError, socket.timeout):
        status = "dead"
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

    counts = {status: sum(result["status"] == status for result in results) for status in ("ok", "blocked", "dead")}
    print(f"\nLink check complete: {counts['ok']} ok, {counts['blocked']} blocked, {counts['dead']} dead.")
    if counts["dead"]:
        print("Link check failed: remove or replace every dead URL before publishing.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
