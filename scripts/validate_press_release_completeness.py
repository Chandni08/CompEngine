#!/usr/bin/env python3
"""Fail publication when recent official competitor releases are absent or duplicated."""

from __future__ import annotations

import json
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
REPORT = DATA / "press_release_completeness.json"
MAX_ARTIFACT_AGE_HOURS = 36
RECENT_DAYS = 120


def read(name: str) -> dict:
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def normalized(value: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9]+", " ", value.lower()).split())


def key(competitor: str, item: dict) -> tuple[str, str, str]:
    return competitor.lower(), str(item.get("date", ""))[:10], normalized(str(item.get("title", "")))


def monitored_release_records() -> tuple[list[tuple[str, dict]], dict[str, str]]:
    agilent = read("agilent_monitor.json")
    competitors = read("competitor_monitors.json")
    perkinelmer = read("perkinelmer_monitor.json")
    # Agilent exposes a bounded current-year archive, so validate the complete
    # official set. Other monitors can be much larger and retain the rolling
    # recent-window contract.
    records: list[tuple[str, dict]] = [("Agilent", item) for item in agilent.get("all_press_releases", [])]
    for competitor, monitor in competitors.get("competitors", {}).items():
        records.extend((competitor, item) for item in monitor.get("recent_press_releases", []))
    records.extend(("PerkinElmer", item) for item in perkinelmer.get("recent_press_releases", []))
    generated = {
        "Agilent": str(agilent.get("generatedAt", "")),
        "Thermo Fisher / Shimadzu / SCIEX": str(competitors.get("generatedAt", "")),
        "PerkinElmer": str(perkinelmer.get("generatedAt", "")),
    }
    return records, generated


def parse_time(value: str) -> datetime | None:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def main() -> int:
    intelligence = read("intelligence.json")
    official, generated = monitored_release_records()
    cutoff = (date.today() - timedelta(days=RECENT_DAYS)).isoformat()
    official = [
        (competitor, item) for competitor, item in official
        if competitor == "Agilent" or str(item.get("date", ""))[:10] >= cutoff
    ]
    official_keys = {key(competitor, item) for competitor, item in official}

    published = [
        item for item in intelligence.get("signals", [])
        if (str(item.get("competitor", "")) == "Agilent" or str(item.get("date", ""))[:10] >= cutoff)
        and str(item.get("competitor", "")) in {"Agilent", "Thermo Fisher", "Shimadzu", "SCIEX", "PerkinElmer"}
    ]
    published_keys = {key(str(item.get("competitor", "")), item) for item in published}
    missing = sorted(official_keys - published_keys)

    counts: dict[tuple[str, str, str], int] = {}
    for item in published:
        item_key = key(str(item.get("competitor", "")), item)
        if item_key in official_keys:
            counts[item_key] = counts.get(item_key, 0) + 1
    duplicates = sorted(item_key for item_key, count in counts.items() if count > 1)

    official_urls = {
        (competitor.lower(), str(item.get("url", "")).strip().lower())
        for competitor, item in official
        if str(item.get("url", "")).strip()
    }
    url_counts: dict[tuple[str, str], int] = {}
    for item in published:
        url_key = (
            str(item.get("competitor", "")).lower(),
            str(item.get("sourceUrl", "")).strip().lower(),
        )
        if url_key in official_urls:
            url_counts[url_key] = url_counts.get(url_key, 0) + 1
    duplicate_urls = sorted(url_key for url_key, count in url_counts.items() if count > 1)

    now = datetime.now(timezone.utc)
    stale = []
    for source, generated_at in generated.items():
        parsed = parse_time(generated_at)
        if parsed is None or (now - parsed.astimezone(timezone.utc)).total_seconds() > MAX_ARTIFACT_AGE_HOURS * 3600:
            stale.append({"source": source, "generatedAt": generated_at or None})

    report = {
        "generatedAt": now.isoformat(timespec="seconds"),
        "recentWindowDays": RECENT_DAYS,
        "agilentScope": "complete official archive",
        "officialRecords": len(official_keys),
        "publishedRecords": len(official_keys & published_keys),
        "missing": [{"competitor": value[0], "date": value[1], "normalizedTitle": value[2]} for value in missing],
        "duplicates": [{"competitor": value[0], "date": value[1], "normalizedTitle": value[2]} for value in duplicates],
        "duplicateUrls": [{"competitor": value[0], "url": value[1]} for value in duplicate_urls],
        "staleArtifacts": stale,
        "complete": not missing and not duplicates and not duplicate_urls and not stale,
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    if not report["complete"]:
        raise SystemExit(
            "Press-release completeness failed: "
            f"{len(missing)} missing, {len(duplicates)} duplicate titles, "
            f"{len(duplicate_urls)} duplicate URLs, {len(stale)} stale collector artifacts"
        )
    print(f"Press-release completeness verified: {len(official_keys)} recent official records are published once.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
