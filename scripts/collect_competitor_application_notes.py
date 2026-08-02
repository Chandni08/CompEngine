#!/usr/bin/env python3
"""Reconcile the competitor application-note catalog during every daily refresh.

The catalog is additive: curated records are retained, while records discovered by a
configured full-feed collector are merged by canonical primary-source URL.  The output
also records enough run metadata for the validator to reject stale or incomplete runs.
"""

from __future__ import annotations

import hashlib
import json
import re
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
CATALOG_FILE = DATA_DIR / "competitor_application_notes.json"
MONITOR_FILE = DATA_DIR / "competitor_monitors.json"
SNAPSHOT_DIR = DATA_DIR / "source_snapshots"
COMPETITORS = ("Agilent", "Thermo Fisher", "Shimadzu", "SCIEX")


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def utc_today() -> date:
    return datetime.now(timezone.utc).date()


def read_json(path: Path, default: object) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def canonical_url(value: str) -> str:
    parts = urlsplit(str(value or "").strip())
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path.rstrip("/"), parts.query, ""))


def is_application_note_record(item: dict[str, object]) -> bool:
    title = str(item.get("title") or "")
    url = str(item.get("url") or item.get("sourceUrl") or "")
    return bool(re.search(r"\b(application|technical)\s+note\b", title, re.I)) or bool(
        re.search(r"/(?:application|technical)[-_]notes?/|/(?:an|tn)-\d", url, re.I)
    )


def slug(value: str) -> str:
    compact = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return compact[:72] or hashlib.sha1(value.encode("utf-8")).hexdigest()[:12]


def products_from_title(title: str) -> str:
    matches = re.findall(
        r"(?:TSQ\s+[A-Za-z0-9+ -]+|Orbitrap\s+[A-Za-z0-9+ -]+|Vanquish\s+[A-Za-z0-9+ -]+|OptiSpray(?:\s+Technology)?)",
        title,
        re.I,
    )
    cleaned = [re.sub(r"\s+", " ", value).strip(" -") for value in matches]
    return ", ".join(dict.fromkeys(cleaned)) or "Product identified on the official note page"


def note_from_discovery(competitor: str, item: dict[str, object]) -> dict[str, object]:
    title = str(item.get("title") or "Untitled application note").strip()
    published = str(item.get("date") or utc_today().isoformat())[:10]
    source_url = str(item.get("url") or item.get("sourceUrl") or "")
    market = str(item.get("marketSegment") or "Cross-market")
    technology = str(item.get("technology") or "LC/LC-MS")
    note_type = "Official technical note" if re.search(r"technical\s+note", title, re.I) else "Official application note"
    return {
        "id": f"{slug(competitor)}-{slug(title)}-{published[:4]}",
        "date": published,
        "dateLabel": datetime.fromisoformat(published).strftime("%b %-d, %Y"),
        "datePrecision": "day",
        "competitor": competitor,
        "title": re.sub(r"^(?:new\s+)?(?:application|technical)\s+note:\s*", "", title, flags=re.I),
        "applicationArea": re.sub(r"^(?:new\s+)?(?:application|technical)\s+note:\s*", "", title, flags=re.I),
        "marketSegment": market,
        "technology": technology,
        "products": products_from_title(title),
        "evidenceStatement": f"The official {competitor} note documents {title.rstrip('.') }.",
        "sourceType": note_type,
        "sourceUrl": source_url,
        "sourceId": item.get("sourceId"),
        "sourceName": item.get("sourceName"),
        "ingestionDate": utc_today().isoformat(),
    }


def monitor_inventory() -> tuple[dict[str, list[dict[str, object]]], dict[str, str]]:
    payload = read_json(MONITOR_FILE, {"competitors": {}})
    monitors = payload.get("competitors", {}) if isinstance(payload, dict) else {}
    discovered: dict[str, list[dict[str, object]]] = {name: [] for name in COMPETITORS}
    attempted: dict[str, str] = {}
    for competitor in COMPETITORS:
        monitor = monitors.get(competitor, {}) if isinstance(monitors, dict) else {}
        attempted[competitor] = str(monitor.get("generatedAt") or payload.get("generatedAt") or utc_now())
        records = list(monitor.get("application_notes") or []) + list(monitor.get("technical_insights") or [])
        discovered[competitor].extend(item for item in records if isinstance(item, dict) and is_application_note_record(item))

    # Backward-compatible bridge for the first run after deployment: older monitor
    # files contain only deltas, while the snapshot already retains the full feed.
    thermo_snapshot = read_json(SNAPSHOT_DIR / "thermo.json", {})
    attempted["Thermo Fisher"] = str(thermo_snapshot.get("capturedAt") or attempted["Thermo Fisher"])
    snapshot_records = thermo_snapshot.get("technicalInsights", {}) if isinstance(thermo_snapshot, dict) else {}
    if isinstance(snapshot_records, dict):
        discovered["Thermo Fisher"].extend(
            item for item in snapshot_records.values() if isinstance(item, dict) and is_application_note_record(item)
        )
    return discovered, attempted


def dedupe_items(items: list[dict[str, object]]) -> list[dict[str, object]]:
    by_url: dict[str, dict[str, object]] = {}
    for item in items:
        url = canonical_url(str(item.get("url") or item.get("sourceUrl") or ""))
        if url:
            by_url[url] = item
    return list(by_url.values())


def newest_date(notes: list[dict[str, object]]) -> str | None:
    values = sorted(str(note.get("date") or "")[:10] for note in notes if note.get("date"))
    return values[-1] if values else None


def collect() -> dict[str, object]:
    catalog = read_json(CATALOG_FILE, {"notes": []})
    notes = list(catalog.get("notes") or []) if isinstance(catalog, dict) else []
    discovered, attempted = monitor_inventory()
    existing_by_url = {canonical_url(str(note.get("sourceUrl") or "")): note for note in notes}
    added = 0
    refreshed = 0

    for competitor, items in discovered.items():
        for item in dedupe_items(items):
            url = canonical_url(str(item.get("url") or item.get("sourceUrl") or ""))
            if url in existing_by_url:
                existing_by_url[url]["lastObservedAt"] = attempted[competitor]
                refreshed += 1
                continue
            note = note_from_discovery(competitor, item)
            notes.append(note)
            existing_by_url[url] = note
            added += 1

    notes.sort(key=lambda item: (str(item.get("date") or ""), str(item.get("competitor") or "")), reverse=True)
    statuses: list[dict[str, object]] = []
    for competitor in COMPETITORS:
        competitor_notes = [note for note in notes if note.get("competitor") == competitor]
        inventory = dedupe_items(discovered[competitor])
        inventory_mode = "official_full_feed" if competitor == "Thermo Fisher" else "registered_official_records"
        discovered_urls = {canonical_url(str(item.get("url") or item.get("sourceUrl") or "")) for item in inventory}
        catalog_urls = {canonical_url(str(note.get("sourceUrl") or "")) for note in competitor_notes}
        missing = sorted(url for url in discovered_urls if url and url not in catalog_urls)
        discovered_dates = [str(item.get("date") or "")[:10] for item in inventory if item.get("date")]
        source_newest = max(discovered_dates) if discovered_dates else None
        catalog_newest = newest_date(competitor_notes)
        if not competitor_notes or missing or (inventory_mode == "official_full_feed" and not inventory):
            completeness_status = "incomplete"
        elif inventory_mode == "official_full_feed":
            completeness_status = "complete"
        else:
            # Do not imply that a curated set is a complete inventory of a vendor's
            # website.  The validator still checks that every registered/discovered
            # record is present, while preserving this coverage limitation explicitly.
            completeness_status = "registered_only"
        statuses.append({
            "competitor": competitor,
            "attemptedAt": attempted[competitor],
            "inventoryMode": inventory_mode,
            "coverageStatus": "complete_inventory" if inventory_mode == "official_full_feed" else "limited_inventory",
            "catalogRecords": len(competitor_notes),
            "inventoryRecordsSeen": len(inventory),
            "inventoryRecordsIngested": len(discovered_urls - set(missing)),
            "missingDiscoveredUrls": missing,
            "sourceNewestDate": source_newest,
            "catalogNewestDate": catalog_newest,
            "newestDiscoveredPresent": not source_newest or (catalog_newest is not None and catalog_newest >= source_newest),
            "freshnessStatus": "current" if catalog_newest and (utc_today() - date.fromisoformat(catalog_newest)).days <= 400 else "stale",
            "completenessStatus": completeness_status,
        })

    counts = Counter(str(note.get("competitor") or "") for note in notes)
    now = utc_now()
    catalog.update({
        "schemaVersion": 3,
        "generatedAt": now,
        "asOfDate": utc_today().isoformat(),
        "refreshContract": {
            "catalogMaxAgeHours": 36,
            "competitorNewestRecordMaxAgeDays": 400,
            "completenessDefinition": "All records discovered by configured full-feed adapters are present; registered official records are retained for sources without a complete public inventory endpoint.",
        },
        "collectionSummary": {
            "addedRecords": added,
            "refreshedRecords": refreshed,
            "totalRecords": len(notes),
            "recordsByCompetitor": dict(counts),
            "fullFeedCompetitors": [
                row["competitor"] for row in statuses if row["inventoryMode"] == "official_full_feed"
            ],
            "registeredOnlyCompetitors": [
                row["competitor"] for row in statuses if row["inventoryMode"] == "registered_official_records"
            ],
        },
        "sourceStatus": statuses,
        "notes": notes,
    })
    write_json(CATALOG_FILE, catalog)
    return catalog


if __name__ == "__main__":
    result = collect()
    summary = result["collectionSummary"]
    print(
        f"Reconciled {summary['totalRecords']} competitor application notes "
        f"({summary['addedRecords']} added; {summary['refreshedRecords']} feed records observed)."
    )
