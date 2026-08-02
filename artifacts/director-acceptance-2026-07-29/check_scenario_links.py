#!/usr/bin/env python3
"""Read-only reachability audit for URLs rendered in the six PMM scenarios."""

from __future__ import annotations

import json
import socket
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import certifi
import requests


ROOT = Path(__file__).resolve().parent
SCENARIOS = [
    "all-markets.json",
    "biopharma-oligo.json",
    "environmental-pfas.json",
    "pharma-qc-validated-migration.json",
    "agilent-competitive-replacement.json",
    "do-nothing-validated-method.json",
]
OUTPUT = ROOT / "source-link-results.json"
TIMEOUT = 12
WORKERS = 20
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)


def scenario_urls() -> list[str]:
    urls: set[str] = set()
    for name in SCENARIOS:
        payload = json.loads((ROOT / name).read_text(encoding="utf-8"))
        urls.update(payload.get("provenance", {}).get("sourceUrls", []))
    return sorted(url for url in urls if url.startswith(("http://", "https://")))


def dns_failure(error: BaseException) -> bool:
    message = str(error).lower()
    return isinstance(error, socket.gaierror) or any(
        marker in message
        for marker in (
            "name or service not known",
            "nodename nor servname provided",
            "no address associated with hostname",
        )
    )


def check(url: str) -> dict[str, object]:
    checked_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    try:
        response = requests.get(
            url,
            headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/pdf,*/*;q=0.8"},
            allow_redirects=True,
            timeout=TIMEOUT,
            stream=True,
            verify=certifi.where(),
        )
        status = int(response.status_code)
        final_url = response.url
        response.close()
        if 200 <= status < 400:
            classification = "reachable"
        elif status in (404, 410):
            classification = "unreachable"
        else:
            classification = "blocked-or-unverified"
        return {
            "url": url,
            "httpStatus": status,
            "finalUrl": final_url,
            "classification": classification,
            "checkedAt": checked_at,
            "error": "",
        }
    except (requests.Timeout, TimeoutError, socket.timeout) as error:
        classification = "blocked-or-unverified"
    except (requests.ConnectionError, requests.RequestException, OSError) as error:
        classification = "unreachable" if dns_failure(error) else "blocked-or-unverified"
    return {
        "url": url,
        "httpStatus": None,
        "finalUrl": "",
        "classification": classification,
        "checkedAt": checked_at,
        "error": f"{type(error).__name__}: {str(error)[:300]}",
    }


def main() -> int:
    urls = scenario_urls()
    rows: list[dict[str, object]] = []
    with ThreadPoolExecutor(max_workers=WORKERS) as executor:
        futures = {executor.submit(check, url): url for url in urls}
        for future in as_completed(futures):
            rows.append(future.result())
    rows.sort(key=lambda row: str(row["url"]))
    OUTPUT.write_text(json.dumps(rows, indent=2) + "\n", encoding="utf-8")
    summary = {
        "total": len(rows),
        "reachable": sum(row["classification"] == "reachable" for row in rows),
        "blockedOrUnverified": sum(row["classification"] == "blocked-or-unverified" for row in rows),
        "unreachable": sum(row["classification"] == "unreachable" for row in rows),
        "output": str(OUTPUT),
    }
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
