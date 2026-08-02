#!/usr/bin/env python3
"""Re-run every currently displayed PubMed horizon query using stored provenance."""

from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path

import certifi
import requests


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "audit" / "current_pubmed_count_check_2026-08-02.json"


def main() -> None:
    intelligence = json.loads((ROOT / "data" / "intelligence.json").read_text())
    rows = []
    for family, records, label_key in (
        ("theme", intelligence["trends"]["themes"], "theme"),
        ("competitor", intelligence["trends"]["competitors"], "competitor"),
    ):
        for record in records:
            for horizon, stored_count in record["counts"].items():
                provenance = record["queryProvenance"][horizon]
                response = requests.get(
                    provenance["apiUrl"],
                    headers={"User-Agent": "Waters-CI-fact-audit/1.0 contact=qa-audit@example.com"},
                    timeout=30,
                    verify=certifi.where(),
                )
                response.raise_for_status()
                actual = int(response.json()["esearchresult"]["count"])
                rows.append({
                    "family": family,
                    "name": record[label_key],
                    "horizon": horizon,
                    "storedCount": stored_count,
                    "rerunCount": actual,
                    "matches": actual == stored_count,
                    "query": provenance["query"],
                    "startDate": provenance["startDate"],
                    "endDate": provenance["endDate"],
                    "resultsUrl": provenance["resultsUrl"],
                    "apiUrl": provenance["apiUrl"],
                    "storedRetrievedAt": provenance["retrievedAt"],
                    "rerunAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                })
                time.sleep(0.35)
    OUT.write_text(json.dumps(rows, indent=2) + "\n")
    matches = sum(row["matches"] for row in rows)
    print(json.dumps({"queries": len(rows), "matches": matches, "mismatches": len(rows) - matches, "output": str(OUT)}, indent=2))


if __name__ == "__main__":
    main()
