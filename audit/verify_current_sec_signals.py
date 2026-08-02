#!/usr/bin/env python3
"""Fresh, read-only SEC attribution check for every current filing signal."""

from __future__ import annotations

import html
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path

import requests


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "audit" / "current_sec_signal_check_2026-08-02.json"
HEADERS = {
    "User-Agent": "Waters CI QA auditor qa-audit@example.com",
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
}
CIK_REGISTRANTS = {
    "1090872": "AGILENT TECHNOLOGIES, INC.",
    "97745": "THERMO FISHER SCIENTIFIC INC.",
    "313616": "Danaher Corporation",
    "31791": "Revvity, Inc.",
}


def compact(value: str) -> str:
    value = html.unescape(value or "")
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def norm(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").lower())


def main() -> None:
    data = json.loads((ROOT / "data" / "intelligence.json").read_text())
    signals = [
        row for row in data["signals"]
        if row.get("signalType") in {"SEC filing", "Investor filing"}
    ]
    session = requests.Session()
    rows = []
    for index, signal in enumerate(signals, 1):
        url = signal.get("sourceUrl", "")
        match = re.search(r"/data/(\d+)/", url)
        cik = str(int(match.group(1))) if match else ""
        expected = CIK_REGISTRANTS.get(cik, "")
        status = 0
        final_url = url
        text = ""
        error = ""
        try:
            response = session.get(url, headers=HEADERS, timeout=20, allow_redirects=True)
            status = response.status_code
            final_url = response.url
            if status < 400:
                text = compact(response.text[:1_500_000])
        except Exception as exc:
            error = f"{type(exc).__name__}: {exc}"

        claimed = signal.get("registrant") or signal.get("competitor", "")
        title = signal.get("title", "")
        form_match = re.search(r"filed\s+([A-Za-z0-9\-/]+)", title, re.I)
        form = form_match.group(1) if form_match else ""
        registrant_match = bool(expected and norm(claimed) == norm(expected))
        form_found = bool(form and re.search(rf"\b{re.escape(form)}\b", text, re.I))
        identity_found = bool(expected and norm(expected) in norm(text))
        if status >= 400 or not text:
            verdict = "UNREACHABLE"
            discrepancy = "SEC filing could not be fetched for direct confirmation."
        elif registrant_match and form_found and identity_found:
            verdict = "Verified"
            discrepancy = ""
        elif not registrant_match:
            verdict = "Contradicted"
            discrepancy = f"Claimed registrant {claimed!r}; URL CIK maps to {expected!r}."
        else:
            verdict = "Partially supported"
            discrepancy = "URL/CIK attribution matches, but filing text did not expose both registrant and form in the fetched body."

        words = text.split()
        quote = ""
        for needle in (expected, form):
            if needle:
                position = norm(text).find(norm(needle))
                if position >= 0:
                    # Character-to-word precision is unnecessary for a bounded evidence snippet.
                    start = max(0, len(text[:position].split()) - 3)
                    quote = " ".join(words[start:start + 15])
                    break
        rows.append({
            "id": signal.get("id", ""),
            "signalType": signal.get("signalType", ""),
            "date": signal.get("date", ""),
            "claimedRegistrant": claimed,
            "expectedRegistrant": expected,
            "form": form,
            "sourceUrl": url,
            "httpStatus": status,
            "finalUrl": final_url,
            "registrantMatch": registrant_match,
            "identityFound": identity_found,
            "formFound": form_found,
            "verdict": verdict,
            "sourceQuote": quote,
            "discrepancy": discrepancy,
            "error": error,
            "checkedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        })
        if index % 25 == 0:
            print(f"checked {index}/{len(signals)}", flush=True)
        time.sleep(0.06)

    OUT.write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n")
    counts = {label: sum(r["verdict"] == label for r in rows) for label in sorted({r["verdict"] for r in rows})}
    print(json.dumps({"records": len(rows), "counts": counts, "output": str(OUT)}, indent=2))


if __name__ == "__main__":
    main()
