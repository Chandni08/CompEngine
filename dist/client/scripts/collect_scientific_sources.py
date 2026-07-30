#!/usr/bin/env python3
"""Collect journal metadata and monitor scientific, conference, and regulatory sources."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

import certifi
import requests


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
JOURNAL_FILE = DATA_DIR / "journal_sources.json"
CONFERENCE_FILE = DATA_DIR / "conference_sources.json"
SOURCE_CATALOG_FILE = DATA_DIR / "source_catalog.json"
USER_AGENT = "Waters-CompetitionEngine/1.0 (scientific-source-monitor; public metadata only)"
HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "application/json,text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.7",
}
TIMEOUT = 35

REQUIRED_CONFERENCE_IDS = {
    "asms-2026",
    "hplc-2026",
    "imsc-2026",
    "msacl-2026",
    "ebf-open-symposium-2026",
}

REGULATORY_SOURCES = (
    {
        "id": "usp-621-chromatography",
        "source": "USP <621> Chromatography",
        "publisher": "United States Pharmacopeia",
        "url": "https://doi.usp.org/USPNF/USPNF_M99380_06_01.html",
        "marketSegments": ["Pharma", "Biopharma", "CDMO", "Clinical"],
        "signalCoverage": ["Chromatographic system suitability", "Permitted method adjustments", "Dwell volume", "Compendial methods"],
        "whatToMeasure": "Official and proposed changes to system suitability, chromatographic adjustments, dwell volume, injection volume, and compendial method execution.",
        "whyItMatters": "Changes can directly alter LC method-transfer requirements, instrument suitability, and the evidence needed for regulated workflows.",
    },
    {
        "id": "usp-1058-instrument-qualification",
        "source": "USP <1058> Analytical Instrument Qualification",
        "publisher": "United States Pharmacopeia",
        "url": "https://doi.usp.org/USPNF/USPNF_M1124_01_01.html",
        "marketSegments": ["Pharma", "Biopharma", "CDMO", "Clinical"],
        "signalCoverage": ["Instrument qualification", "Fitness for intended use", "Calibration", "Lifecycle control"],
        "whatToMeasure": "Qualification lifecycle, risk assessment, software-controlled instrumentation, calibration, maintenance, and fitness-for-purpose expectations.",
        "whyItMatters": "These expectations shape qualification packages, service evidence, software controls, and regulated instrument lifecycle requirements.",
    },
    {
        "id": "usp-232-233-elemental-impurities",
        "source": "USP <232>/<233> Elemental Impurities",
        "publisher": "United States Pharmacopeia",
        "url": "https://www.usp.org/impurities/elemental-impurities-updates",
        "marketSegments": ["Pharma", "Biopharma", "CDMO", "Clinical", "Food & Beverage"],
        "signalCoverage": ["Elemental impurity limits", "ICP-MS procedures", "Procedure validation", "Compendial updates"],
        "whatToMeasure": "Permitted exposure changes, procedure revisions, validation requirements, and effective dates for elemental impurity testing.",
        "whyItMatters": "The chapters create regulated ICP-MS and sample-preparation requirements adjacent to LC-MS laboratory workflows and informatics.",
    },
    {
        "id": "ich-q2-r2",
        "source": "ICH Q2(R2) Validation of Analytical Procedures",
        "publisher": "International Council for Harmonisation",
        "url": "https://database.ich.org/sites/default/files/ICH_Q2%28R2%29_Guideline_2023_1130.pdf",
        "marketSegments": ["Pharma", "Biopharma", "CDMO", "Clinical"],
        "signalCoverage": ["Analytical procedure validation", "Accuracy", "Precision", "Range", "Robustness"],
        "whatToMeasure": "Validation characteristics, performance criteria, multivariate methods, lifecycle links, and implementation expectations.",
        "whyItMatters": "Q2(R2) defines the evidence customers need to validate LC and LC-MS procedures for their intended use.",
    },
    {
        "id": "ich-q14",
        "source": "ICH Q14 Analytical Procedure Development",
        "publisher": "International Council for Harmonisation",
        "url": "https://database.ich.org/sites/default/files/ICH_Q14_Guideline_2023_1116.pdf",
        "marketSegments": ["Pharma", "Biopharma", "CDMO", "Clinical"],
        "signalCoverage": ["Analytical target profile", "Procedure development", "Risk management", "Lifecycle management"],
        "whatToMeasure": "Analytical target profiles, parameter-risk assessments, robustness studies, control strategies, and lifecycle changes.",
        "whyItMatters": "Q14 shifts customer expectations toward scientifically justified method development and lifecycle-ready transfer packages.",
    },
    {
        "id": "fda-warning-letters-analytical-findings",
        "source": "FDA Warning Letters",
        "publisher": "U.S. Food and Drug Administration",
        "url": "https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/compliance-actions-and-activities/warning-letters",
        "marketSegments": ["Pharma", "Biopharma", "CDMO", "Clinical", "Food & Beverage"],
        "signalCoverage": ["Data integrity", "Method validation", "Laboratory controls", "Investigation failures"],
        "whatToMeasure": "Warning letters citing chromatography, mass spectrometry, data integrity, method validation, audit trails, out-of-specification investigations, or laboratory controls.",
        "whyItMatters": "Recurring findings expose regulated-laboratory workflow and software-control gaps that should influence product requirements and evidence packages.",
    },
    {
        "id": "fda-form-483-observations",
        "source": "FDA Form 483 Inspection Observations",
        "publisher": "U.S. Food and Drug Administration",
        "url": "https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/inspection-references/inspection-observations",
        "marketSegments": ["Pharma", "Biopharma", "CDMO", "Clinical", "Food & Beverage"],
        "signalCoverage": ["Inspection observations", "Laboratory controls", "Data integrity", "Method and equipment findings"],
        "whatToMeasure": "Observation categories and available records involving laboratory controls, analytical methods, equipment qualification, electronic records, and data review.",
        "whyItMatters": "Form 483 patterns are an early regulatory signal of operational and data-integrity failures before they become generalized market requirements.",
    },
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict[str, Any]) -> None:
    temporary = path.with_suffix(f"{path.suffix}.tmp")
    temporary.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temporary.replace(path)


def fetch(url: str, *, accept_json: bool = False) -> tuple[int, str, str]:
    headers = dict(HEADERS)
    if accept_json:
        headers["Accept"] = "application/json"
    try:
        response = requests.get(url, headers=headers, timeout=TIMEOUT, verify=certifi.where(), allow_redirects=True)
        return response.status_code, response.url, response.text
    except requests.RequestException as error:
        return 0, url, str(error)


def publication_date(item: dict[str, Any]) -> str:
    for key in ("published-online", "published-print", "published", "issued", "created"):
        date_parts = item.get(key, {}).get("date-parts", [])
        if not date_parts or not date_parts[0]:
            continue
        parts = list(date_parts[0]) + [1, 1]
        try:
            return date(int(parts[0]), int(parts[1]), int(parts[2])).isoformat()
        except (TypeError, ValueError):
            continue
    return ""


def collect_crossref_records(issn: str) -> tuple[int, list[dict[str, str]], str]:
    start = (date.today() - timedelta(days=370)).isoformat()
    endpoint = (
        f"https://api.crossref.org/journals/{quote(issn)}/works"
        f"?filter=from-pub-date:{start}&sort=published&order=desc&rows=8"
        "&select=DOI,title,published,published-online,published-print,issued,created,URL,container-title,type"
    )
    status, final_url, body = fetch(endpoint, accept_json=True)
    if status != 200:
        return status, [], f"Crossref returned HTTP {status or 'request error'} at {final_url}."
    try:
        items = json.loads(body).get("message", {}).get("items", [])
    except json.JSONDecodeError:
        return status, [], "Crossref returned invalid JSON."
    records: list[dict[str, str]] = []
    for item in items:
        title_values = item.get("title") or []
        doi = str(item.get("DOI") or "").strip()
        title = re.sub(r"\s+", " ", str(title_values[0] if title_values else "")).strip()
        if not doi or not title:
            continue
        records.append({
            "title": title,
            "date": publication_date(item),
            "doi": doi,
            "sourceUrl": f"https://doi.org/{doi}",
        })
    return status, records, f"Collected {len(records)} recent DOI records from Crossref journal metadata."


def catalog_base(source_id: str, source_class: str, name: str, publisher: str, url: str, segments: list[str]) -> dict[str, Any]:
    return {
        "id": source_id,
        "group": source_class,
        "sourceClass": source_class,
        "source": name,
        "publisher": publisher,
        "competitor": "Market-wide",
        "url": url,
        "marketSegments": segments,
        "surfaces": ["Market intelligence", "Application trends"],
        "health": "good",
        "status": "monitored",
        "issue": "",
    }


def collect_journals(journal_data: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    catalog_entries: list[dict[str, Any]] = []
    monitored: list[dict[str, Any]] = []
    checked_at = utc_now()
    for source in journal_data.get("sources", []):
        if source.get("sourceClass") != "Peer-reviewed journal":
            continue
        status, records, detail = collect_crossref_records(str(source.get("issn") or ""))
        source["lastChecked"] = checked_at
        source["surfaces"] = ["Market intelligence", "Application trends"]
        source["collectionStatus"] = "extracted" if records else "blocked"
        source["collectionDetail"] = detail
        source["extractedRecords"] = len(records)
        source["recentRecords"] = records
        source["metadataEndpoint"] = f"https://api.crossref.org/journals/{source.get('issn')}/works"
        entry = catalog_base(
            f"journal-{source['id']}",
            "Peer-reviewed journal",
            source["name"],
            source.get("publisher", "Journal publisher"),
            source["homepage"],
            source.get("marketSegments", []),
        )
        entry.update({
            "signalCoverage": source.get("primarySignals", []),
            "refreshCadence": source.get("refreshCadence"),
            "accessType": source.get("accessType"),
            "whatToMeasure": source.get("monitoringMode"),
            "whyItMatters": source.get("pmDecisionUse"),
            "nextAction": "Review newly collected DOI records for LC, LC-MS, method-performance, transferability, and application signals.",
            "extractionStatus": source["collectionStatus"],
            "extractionReason": detail,
            "extractedRecords": len(records),
            "fetchMethod": "crossref_journal_metadata",
            "lastExtractionCheck": checked_at,
            "metadataEndpoint": source["metadataEndpoint"],
        })
        if not records:
            entry["health"] = "review"
            entry["issue"] = detail
        catalog_entries.append(entry)
        monitored.append(source)
    journal_data["generatedAt"] = checked_at
    return catalog_entries, monitored


def collect_conferences(conference_data: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    catalog_entries: list[dict[str, Any]] = []
    monitored: list[dict[str, Any]] = []
    checked_at = utc_now()
    for event in conference_data.get("events", []):
        if event.get("id") not in REQUIRED_CONFERENCE_IDS:
            continue
        results: list[dict[str, Any]] = []
        for url in event.get("monitoringUrls") or [event.get("website")]:
            status, final_url, body = fetch(str(url))
            results.append({
                "url": url,
                "finalUrl": final_url,
                "status": status,
                "pageFingerprint": hashlib.sha256(body.encode("utf-8", errors="ignore")).hexdigest()[:16] if status == 200 else "",
            })
        reachable = sum(1 for item in results if item["status"] == 200)
        event["lastChecked"] = checked_at
        event["surfaces"] = ["Market intelligence", "Application trends"]
        event["collectionStatus"] = "extracted" if reachable else "blocked"
        event["collectionDetail"] = f"{reachable} of {len(results)} official conference/program endpoints reachable; this is endpoint coverage, not a poster count."
        event["monitoredEndpoints"] = results
        entry = catalog_base(
            f"conference-{event['id']}",
            "Conference/poster",
            event["eventName"],
            event.get("publisher", "Conference organizer"),
            event["website"],
            event.get("marketSegments", []),
        )
        entry.update({
            "signalCoverage": event.get("signalCoverage", []),
            "refreshCadence": event.get("refreshCadence"),
            "accessType": event.get("accessType"),
            "whatToMeasure": event.get("whatToMeasure"),
            "whyItMatters": event.get("whyItMatters"),
            "nextAction": "Diff public program, abstract, poster, sponsor, and vendor-session pages; preserve exact record URLs when content is published.",
            "extractionStatus": event["collectionStatus"],
            "extractionReason": event["collectionDetail"],
            "extractedRecords": reachable,
            "fetchMethod": "official_conference_endpoint_monitor",
            "lastExtractionCheck": checked_at,
            "monitoringUrls": event.get("monitoringUrls") or [event.get("website")],
        })
        if not reachable:
            entry["health"] = "review"
            entry["issue"] = event["collectionDetail"]
        catalog_entries.append(entry)
        monitored.append(event)
    conference_data["generatedAt"] = checked_at
    return catalog_entries, monitored


def collect_regulatory_sources() -> list[dict[str, Any]]:
    checked_at = utc_now()
    entries: list[dict[str, Any]] = []
    for source in REGULATORY_SOURCES:
        status, final_url, _ = fetch(source["url"])
        reachable = 200 <= status < 400
        entry = catalog_base(
            source["id"],
            "Regulatory/pharmacopeial",
            source["source"],
            source["publisher"],
            source["url"],
            source["marketSegments"],
        )
        entry.update({
            "signalCoverage": source["signalCoverage"],
            "refreshCadence": "Weekly official-page check",
            "accessType": "Official public page or document; compendial access may vary",
            "whatToMeasure": source["whatToMeasure"],
            "whyItMatters": source["whyItMatters"],
            "nextAction": "Track official revisions, effective dates, notices, and records; extract only claims present in the linked primary source.",
            "status": str(status) if status else "request_error",
            "health": "good" if reachable else "review",
            "issue": "" if reachable else f"Official source returned HTTP {status or 'request error'}; retain for manual review.",
            "extractionStatus": "extracted" if reachable else "blocked",
            "extractionReason": f"Official source reachable at {final_url}." if reachable else f"Official source unavailable during check: HTTP {status or 'request error'}.",
            "extractedRecords": 1 if reachable else 0,
            "fetchMethod": "official_regulatory_page_check",
            "lastExtractionCheck": checked_at,
        })
        entries.append(entry)
    return entries


def upsert_catalog(catalog: dict[str, Any], entries: list[dict[str, Any]]) -> None:
    existing = {str(item.get("id")): item for item in catalog.get("sources", [])}
    for entry in entries:
        prior = existing.get(entry["id"], {})
        existing[entry["id"]] = {**prior, **entry}
    catalog["sources"] = list(existing.values())
    catalog["generatedAt"] = utc_now()


def main() -> int:
    journal_data = read_json(JOURNAL_FILE)
    conference_data = read_json(CONFERENCE_FILE)
    source_catalog = read_json(SOURCE_CATALOG_FILE)

    journal_entries, journals = collect_journals(journal_data)
    conference_entries, conferences = collect_conferences(conference_data)
    regulatory_entries = collect_regulatory_sources()
    upsert_catalog(source_catalog, journal_entries + conference_entries + regulatory_entries)

    write_json(JOURNAL_FILE, journal_data)
    write_json(CONFERENCE_FILE, conference_data)
    write_json(SOURCE_CATALOG_FILE, source_catalog)
    print(
        f"Scientific sources: {len(journals)} journals, {len(conferences)} conferences, "
        f"{len(regulatory_entries)} regulatory/pharmacopeial sources monitored."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
