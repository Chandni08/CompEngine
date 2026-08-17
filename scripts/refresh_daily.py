#!/usr/bin/env python3
"""Run, validate, and publish the daily competitive-intelligence refresh."""

from __future__ import annotations

import json
import hashlib
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import date, datetime, timezone
from pathlib import Path

from provenance import valid_change_evidence
from source_health import SourceHealth, migrate_legacy_source, write_ledger


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DEPLOY_DATA_DIR = ROOT / "deploy-site" / "data"
INTELLIGENCE_FILE = DATA_DIR / "intelligence.json"
STATUS_FILE = DATA_DIR / "refresh_status.json"
COLLECTOR = ROOT / "scripts" / "collect_real_data.py"
AGILENT_COLLECTOR = ROOT / "scripts" / "collect_agilent.py"
COMPETITOR_COLLECTOR = ROOT / "scripts" / "collect_competitors.py"
APPLICATION_NOTE_COLLECTOR = ROOT / "scripts" / "collect_competitor_application_notes.py"
SCIENTIFIC_SOURCE_COLLECTOR = ROOT / "scripts" / "collect_scientific_sources.py"
CUSTOMER_VOICE_COLLECTOR = ROOT / "scripts" / "collect_customer_voice.py"
PERKINELMER_COLLECTOR = ROOT / "scripts" / "collect_perkinelmer.py"
LINK_CHECKER = ROOT / "scripts" / "check_links.py"
PROVENANCE_REMEDIATOR = ROOT / "scripts" / "remediate_provenance.py"
HISTORICAL_COMPETITOR_VALIDATOR = ROOT / "scripts" / "validate_historical_product_catalog.mjs"
HISTORICAL_WATERS_VALIDATOR = ROOT / "scripts" / "validate_historical_waters_catalog.mjs"
PPTX_BUILDER = ROOT / "scripts" / "build_leadership_pptx.mjs"
CUSTOMER_VOICE_VALIDATOR = ROOT / "scripts" / "validate_customer_voice_sources.mjs"
APPLICATION_NOTE_VALIDATOR = ROOT / "scripts" / "validate_competitor_application_notes.mjs"
PRODUCT_LAUNCH_VALIDATOR = ROOT / "scripts" / "validate_product_launch_press_releases.mjs"
SOURCE_TITLE_LINK_VALIDATOR = ROOT / "scripts" / "validate_source_title_links.mjs"
PRESS_RELEASE_COMPLETENESS_VALIDATOR = ROOT / "scripts" / "validate_press_release_completeness.py"
INTEGRITY_ARTIFACT_BUILDER = ROOT / "scripts" / "build_integrity_artifacts.py"
THERMO_MONITOR_VALIDATOR = ROOT / "scripts" / "validate_thermo_monitoring.mjs"
SCIENTIFIC_SOURCE_VALIDATOR = ROOT / "scripts" / "validate_scientific_source_classes.mjs"
SCORER = ROOT / "scripts" / "score.py"
RECOMMENDATION_CURATOR = ROOT / "scripts" / "curate_recommendations.py"
AGILENT_MONITOR_FILE = DATA_DIR / "agilent_monitor.json"
COMPETITOR_MONITOR_FILE = DATA_DIR / "competitor_monitors.json"
PERKINELMER_MONITOR_FILE = DATA_DIR / "perkinelmer_monitor.json"
SOURCE_HEALTH_FILE = DATA_DIR / "source_health.json"

AUTOMATED_DOMAINS = [
    "PubMed publication trends and competitor-linked publications",
    "SEC filing discovery",
    "Registered competitor source availability checks",
    "Agilent LC/MS product sitemap and press-release change detection",
    "Thermo Fisher, Shimadzu, and SCIEX product sitemap and press-release extraction",
    "Thermo Fisher LC/MS technical insight RSS extraction",
    "Peer-reviewed journals plus publisher-owned trade, forum, learning, conference, and regulatory source monitoring",
    "Public customer voice from robots-compliant forums, structured reviews, Reddit OAuth, and FDA bulk data",
    "PerkinElmer official newsroom and LC product sitemap",
    "Competitor application-note catalog reconciliation, freshness, and completeness validation",
]

CURATED_DOMAINS = [
    "Product-launch interpretation and machine comparisons",
    "Partnership interpretation",
    "Conference preparation",
    "PM recommendations",
]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def read_json(path: Path, default: dict | None = None) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default or {}


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(f"{path.suffix}.tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def validate_intelligence(data: dict) -> None:
    errors: list[str] = []
    if data.get("asOfDate") != date.today().isoformat():
        errors.append("asOfDate was not updated to today")
    if len(data.get("signals", [])) < 10:
        errors.append("fewer than 10 signals were retained")
    if len(data.get("recommendations", [])) < 1:
        errors.append("no PM recommendations were retained")

    themes = data.get("trends", {}).get("themes", [])
    if len(themes) < 5:
        errors.append("fewer than five publication themes were produced")
    for theme in themes:
        counts = theme.get("counts", {})
        ordered = [int(counts.get(key, 0)) for key in ("30d", "60d", "90d", "1y", "3y", "5y")]
        if ordered != sorted(ordered):
            errors.append(f"non-cumulative horizon counts for {theme.get('theme', 'unknown theme')}")

    refresh_state = data.get("refresh", {})
    if not any(refresh_state.get(key) == "success" for key in ("pubmed", "sec", "sourceHealth")):
        errors.append("no automated source family refreshed successfully")

    if errors:
        raise ValueError("; ".join(errors))


def validate_agilent_monitor(data: dict) -> None:
    required = {
        "new_products", "discontinued_products", "updated_products",
        "new_press_releases", "recent_press_releases", "all_press_releases", "source_status",
    }
    missing = sorted(required.difference(data))
    if missing:
        raise ValueError(f"Agilent monitor is missing: {', '.join(missing)}")


def validate_competitor_monitor(data: dict) -> None:
    competitors = data.get("competitors", {})
    required_competitors = {"Thermo Fisher", "Shimadzu", "SCIEX"}
    missing_competitors = sorted(required_competitors.difference(competitors))
    if missing_competitors:
        raise ValueError(f"Competitor monitor is missing: {', '.join(missing_competitors)}")
    required_fields = {
        "new_products", "discontinued_products", "updated_products",
        "new_press_releases", "recent_press_releases", "new_technical_insights", "source_status",
    }
    for competitor, monitor in competitors.items():
        missing_fields = sorted(required_fields.difference(monitor))
        if missing_fields:
            raise ValueError(f"{competitor} monitor is missing: {', '.join(missing_fields)}")
    critical_sources = {
        "Thermo Fisher": {"thermo-products", "thermo-ms-products", "thermo-news"},
        "Shimadzu": {"shimadzu-lcms", "shimadzu-news"},
        "SCIEX": {"sciex-products", "sciex-news"},
    }
    for competitor, required_sources in critical_sources.items():
        statuses = competitors[competitor].get("source_status", [])
        extracted = {
            str(status.get("sourceId"))
            for status in statuses
            if status.get("extractionStatus") == "extracted"
        }
        missing = sorted(required_sources.difference(extracted))
        if missing:
            raise ValueError(
                f"{competitor} critical source refresh incomplete: {', '.join(missing)}. "
                "The dataset must not be published as current."
            )


def validate_perkinelmer_monitor(data: dict) -> None:
    required = {"newsroom", "recent_press_releases", "sourceStatus"}
    missing = sorted(required.difference(data))
    if missing:
        raise ValueError(f"PerkinElmer monitor is missing: {', '.join(missing)}")


def normalize_release_key(value: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9]+", " ", value.lower()).split())


def reclassify_strategic_releases(signals: list[dict]) -> list[dict]:
    """Keep partnerships and collaborations in corporate/strategic activity."""
    strategic_pattern = re.compile(
        r"\b(partnership|partner(?:s|ed|ing)?|collaboration|collaborat(?:e|es|ed|ing)|"
        r"strategic initiative|research hub|customer experience center|acquisition|acquire[sd]?)\b",
        re.I,
    )
    synthetic_context = "This official release documents a strategic collaboration, partnership, or acquisition signal."
    for signal in signals:
        if str(signal.get("signalType", "")).lower() not in {"press release", "official press release"}:
            continue
        wording = " ".join(str(signal.get(key, "")) for key in ("title", "summary", "intent"))
        if strategic_pattern.search(wording):
            signal["category"] = "Corporate intelligence"
            summary = str(signal.get("summary", "")).replace(synthetic_context, "").strip()
            title = str(signal.get("title", ""))
            if re.search(r"\bcollaborat(?:e|es|ed|ing)\b", title, re.I) and not re.search(r"\bcollaboration\b", summary, re.I):
                summary = f"{summary} This official release documents a strategic collaboration.".strip()
            signal["summary"] = summary
    return signals


def dedupe_official_releases(signals: list[dict]) -> list[dict]:
    """Keep one canonical signal when overlapping official feeds publish the same release."""
    releases: dict[tuple[str, str, str], dict] = {}
    release_urls: dict[tuple[str, str], tuple[str, str, str]] = {}
    retained: list[dict] = []
    for signal in signals:
        signal_type = str(signal.get("signalType", "")).lower()
        category = str(signal.get("category", "")).lower()
        if not any(term in signal_type or term in category for term in ("press release", "earnings", "corporate", "regulatory")):
            retained.append(signal)
            continue
        key = (
            str(signal.get("competitor", "")).lower(),
            str(signal.get("date", ""))[:10],
            normalize_release_key(str(signal.get("title", ""))),
        )
        url_key = (
            str(signal.get("competitor", "")).lower(),
            str(signal.get("sourceUrl", "")).strip().lower(),
        )
        # A newsroom item may previously have been imported under a shortened
        # analyst title and later under its official title.  The canonical URL
        # identifies the release more reliably than either title.
        if url_key[1] and url_key in release_urls:
            prior_key = release_urls[url_key]
            current = releases.get(prior_key)
            if current is not None:
                current_title = str(current.get("title", ""))
                candidate_title = str(signal.get("title", ""))
                if len(candidate_title) > len(current_title):
                    del releases[prior_key]
                    releases[key] = signal
                    release_urls[url_key] = key
                continue
        current = releases.get(key)
        if current is None:
            releases[key] = signal
            if url_key[1]:
                release_urls[url_key] = key
            continue
        current_url = str(current.get("sourceUrl", ""))
        candidate_url = str(signal.get("sourceUrl", ""))
        # Prefer a dated newsroom release over a duplicate investor-relations mirror.
        if "investor." in current_url and "investor." not in candidate_url:
            releases[key] = signal
            if url_key[1]:
                release_urls[url_key] = key
    return sorted([*retained, *releases.values()], key=lambda item: item.get("date", ""), reverse=True)


def signal_id(prefix: str, url: str) -> str:
    digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:12]
    return f"agilent-monitor-{prefix}-{digest}"


def product_name(url: str) -> str:
    slug = url.rstrip("/").rsplit("/", 1)[-1]
    return slug.replace("-", " ").strip().title() or "Agilent LC/MS product page"


def competitor_signal_id(competitor: str, kind: str, key: str) -> str:
    competitor_slug = competitor.lower().replace(" ", "-")
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()[:12]
    return f"{competitor_slug}-monitor-{kind}-{digest}"


def technology_for_url(url: str) -> str:
    text = url.lower()
    if any(term in text for term in ("ion-chromatography", "integrion", "ics-")):
        return "Ion chromatography"
    if "vanquish-neo" in text:
        return "Nano-LC"
    if any(term in text for term in ("software", "labsolutions", "sciex-os")):
        return "Software"
    if any(term in text for term in ("hplc", "uhplc", "liquid-chromatography", "nexera")) and "mass-spect" not in text and "lc-ms" not in text:
        return "LC/UHPLC"
    return "LC-MS"


def merge_competitor_changes(intelligence: dict, monitor_data: dict) -> None:
    additions: list[dict] = []
    summaries: dict[str, dict] = {}
    today = date.today().isoformat()

    for competitor, monitor in monitor_data.get("competitors", {}).items():
        for key, signal_type, action in (
            ("new_products", "Product page added", "added"),
            ("updated_products", "Product page updated", "updated"),
            ("discontinued_products", "Possible product page removal", "removed"),
        ):
            for item in monitor.get(key, []):
                # A sitemap URL or lastmod delta is not a page-content change.  Only
                # publish a change claim when the collector preserved both page
                # versions and an exact diff artifact.
                if not valid_change_evidence(item.get("changeEvidence")):
                    continue
                url = item.get("url", "")
                modified = item.get("lastmod") or today
                name = product_name(url)
                item_signal_type = signal_type
                if item.get("monitoringRegistration"):
                    item_signal_type = "Monitoring coverage registered"
                    summary = "This existing official product page was newly added to the monitored family baseline. It is a coverage expansion, not evidence of a new commercial launch."
                    recommendation = "Use future sitemap additions or last-modified changes as monitoring signals; require a dated release before classifying a launch."
                elif action == "removed":
                    summary = "The URL disappeared from the official sitemap. This can mean retirement, consolidation, or URL restructuring; manual confirmation is required."
                    recommendation = "Confirm lifecycle status in an official announcement before treating the page removal as a discontinuation."
                elif action == "added":
                    summary = "This page is new in the competitor's official product sitemap. A sitemap addition is a portfolio-change signal, not proof of a commercial launch."
                    recommendation = "Review the official page and look for a dated release before classifying this as a launch."
                else:
                    previous = item.get("previousLastmod") or "the prior snapshot"
                    summary = f"The official sitemap last-modified value changed from {previous} to {modified}. Review the linked page for positioning, specification, software, or lifecycle changes."
                    recommendation = "Compare the current page with the prior snapshot before changing roadmap priorities."
                additions.append({
                    "id": competitor_signal_id(competitor, item_signal_type.lower().replace(" ", "-"), f"{url}|{modified}"),
                    "date": modified,
                    "competitor": competitor,
                    "category": "Product intelligence",
                    "signalType": item_signal_type,
                    "title": f"{competitor} {action} {name}",
                    "summary": summary,
                    "sourceName": f"{competitor} official product sitemap",
                    "sourceUrl": url,
                    "geography": "Global",
                    "marketSegment": (item.get("marketSegments") or ["Pharma"])[0],
                    "marketSegments": item.get("marketSegments") or ["Pharma"],
                    "technology": item.get("technology") or technology_for_url(url),
                    "theme": f"{item.get('monitoringFamilyName') or 'LC/MS portfolio'} change",
                    "evidenceCount": 1,
                    "intent": "Official product-page inventory change",
                    "recommendation": recommendation,
                })

        for item in monitor.get("recent_press_releases") or monitor.get("new_press_releases", []):
            url = item.get("url", "")
            classification = item.get("classification", "corporate")
            additions.append({
                "id": competitor_signal_id(competitor, "press-release", url),
                "date": item.get("date") or today,
                "competitor": competitor,
                "category": "Product intelligence" if classification == "product" else "Corporate intelligence",
                "signalType": "Press release",
                "title": item.get("title") or f"New {competitor} press release",
                "summary": item.get("summary") or f"Official dated release extracted from {competitor}'s press or news index.",
                "earningsMetrics": item.get("earningsMetrics") or [],
                "pmInsights": item.get("pmInsights") or [],
                "watersPmImplication": item.get("watersPmImplication") or "",
                "evidenceBoundary": item.get("evidenceBoundary") or "",
                "sourceName": item.get("sourceName") or f"{competitor} official press releases",
                "sourceUrl": url,
                "geography": "Global",
                "marketSegment": item.get("marketSegment") or "Pharma",
                "technology": item.get("technology") or technology_for_url(f"{url} {item.get('title', '')}"),
                "theme": item.get("theme") or ("Product release" if classification == "product" else "Corporate strategy"),
                "evidenceCount": 1,
                "intent": item.get("intent") or ("Product and portfolio expansion" if classification == "product" else "Corporate strategic activity"),
                "recommendation": item.get("recommendation") or "Review the release for concrete product, workflow, partnership, and market-positioning implications for Waters.",
            })

        for item in monitor.get("new_technical_insights", []):
            url = item.get("url", "")
            additions.append({
                "id": competitor_signal_id(competitor, "technical-insight", url),
                "date": item.get("date") or today,
                "competitor": competitor,
                "category": "Product intelligence",
                "signalType": "Official technical insight",
                "title": item.get("title") or f"New {competitor} technical insight",
                "summary": "Dated LC/MS product, workflow, or application evidence extracted from an official competitor technical feed.",
                "sourceName": item.get("sourceName") or f"{competitor} official technical insights",
                "sourceUrl": url,
                "geography": "Global",
                "marketSegment": item.get("marketSegment") or "Pharma",
                "technology": item.get("technology") or technology_for_url(f"{url} {item.get('title', '')}"),
                "theme": "LC/MS workflow and application positioning",
                "evidenceCount": 1,
                "intent": "Product proof, workflow positioning, or application expansion",
                "recommendation": "Capture the named workflow, instrument, software, and proof-point claims in the Thermo LC/MS comparison matrix.",
            })

        statuses = monitor.get("source_status", [])
        extracted = [item for item in statuses if item.get("extractionStatus") == "extracted"]
        blocked = [item for item in statuses if item.get("extractionStatus") == "blocked"]
        state = "success" if extracted and not blocked else "partial_refresh" if extracted else "collection_review_needed"
        intelligence.setdefault("refresh", {})[competitor.lower().replace(" ", "-")] = state
        summaries[competitor] = {
            "inventoryCounts": monitor.get("inventoryCounts", {}),
            "changesDetected": sum(len(monitor.get(key, [])) for key in ("new_products", "updated_products", "discontinued_products", "new_press_releases", "new_technical_insights")),
            "sourceStatus": statuses,
        }

    existing = {str(item.get("id")): item for item in intelligence.get("signals", []) if item.get("id")}
    for signal in additions:
        existing[signal["id"]] = signal
    intelligence["signals"] = sorted(existing.values(), key=lambda item: item.get("date", ""), reverse=True)
    intelligence["competitorExtraction"] = {
        "generatedAt": monitor_data.get("generatedAt"),
        "competitors": summaries,
    }


def merge_agilent_changes(intelligence: dict, monitor: dict) -> None:
    additions: list[dict] = []
    today = date.today().isoformat()

    for item in monitor.get("new_products", []):
        if not valid_change_evidence(item.get("changeEvidence")):
            continue
        url = item.get("url", "")
        additions.append({
            "id": signal_id("new-product", url),
            "date": item.get("lastmod") or today,
            "competitor": "Agilent",
            "category": "Product intelligence",
            "signalType": "Product page added",
            "title": f"Agilent added {product_name(url)} to its LC/MS product inventory",
            "summary": "The page is new in Agilent's authoritative product sitemap. Confirm commercial launch status in the linked product page or press release before treating it as a launch.",
            "sourceName": "Agilent product sitemap",
            "sourceUrl": url,
            "geography": "Global",
            "marketSegment": "Pharma",
            "technology": "LC-MS",
            "theme": "LC/MS portfolio change",
            "evidenceCount": 1,
            "intent": "Possible LC/MS portfolio addition",
            "recommendation": "Verify launch claims and compare the new page with the prior Agilent platform and Waters' closest product.",
        })

    for item in monitor.get("updated_products", []):
        if not valid_change_evidence(item.get("changeEvidence")):
            continue
        url = item.get("url", "")
        additions.append({
            "id": signal_id("updated-product", f"{url}|{item.get('lastmod', '')}"),
            "date": item.get("lastmod") or today,
            "competitor": "Agilent",
            "category": "Product intelligence",
            "signalType": "Product page updated",
            "title": f"Agilent updated {product_name(url)}",
            "summary": f"Agilent changed the page last-modified date from {item.get('previousLastmod') or 'unknown'} to {item.get('lastmod') or 'unknown'}. Review the page for specification, positioning, software, or lifecycle changes.",
            "sourceName": "Agilent product sitemap",
            "sourceUrl": url,
            "geography": "Global",
            "marketSegment": "Pharma",
            "technology": "LC-MS",
            "theme": "LC/MS product update",
            "evidenceCount": 1,
            "intent": "LC/MS product positioning or specification change",
            "recommendation": "Compare current claims and specifications with the previous snapshot before changing roadmap priorities.",
        })

    for item in monitor.get("discontinued_products", []):
        url = item.get("url", "")
        additions.append({
            "id": signal_id("removed-product", url),
            "date": today,
            "competitor": "Agilent",
            "category": "Product intelligence",
            "signalType": "Possible product page removal",
            "title": f"Agilent removed {product_name(url)} from the monitored LC/MS sitemap",
            "summary": "A missing sitemap URL can reflect retirement, consolidation, or URL restructuring. Manual confirmation is required before treating this as a discontinuation.",
            "sourceName": "Agilent product sitemap",
            "sourceUrl": url,
            "geography": "Global",
            "marketSegment": "Pharma",
            "technology": "LC-MS",
            "theme": "Possible product lifecycle change",
            "evidenceCount": 1,
            "intent": "Possible product retirement or portfolio consolidation",
            "recommendation": "Confirm the lifecycle status through an official Agilent announcement before inferring whitespace.",
        })

    # Reconcile the complete official Agilent archive, not only the rolling
    # replay window.  The former 120-day merge could leave valid current-year
    # newsroom and earnings records stranded in the monitor snapshot.
    for item in (
        monitor.get("all_press_releases")
        or monitor.get("recent_press_releases")
        or monitor.get("new_press_releases", [])
    ):
        url = item.get("url", "")
        classification = item.get("classification", "corporate")
        signal = {
            "id": signal_id("press-release", url),
            "date": item.get("date") or today,
            "competitor": "Agilent",
            "category": "Product intelligence" if classification == "product" else "Corporate intelligence",
            "signalType": item.get("signalType") or "Press release",
            "title": item.get("title") or "New Agilent press release",
            "summary": item.get("summary") or "New item detected on Agilent's authoritative dated press-release index.",
            "sourceName": item.get("sourceName") or "Agilent press releases",
            "sourceUrl": url,
            "geography": "Global",
            "marketSegment": item.get("marketSegment") or "Pharma",
            "technology": item.get("technology") or "Portfolio",
            "theme": item.get("theme") or ("Product release" if classification == "product" else "Corporate strategy"),
            "evidenceCount": 1,
            "intent": item.get("intent") or ("Product and portfolio expansion" if classification == "product" else "Corporate strategic activity"),
            "recommendation": "Review the release for concrete product, partnership, portfolio, and market-positioning implications for Waters.",
        }
        for field in ("earningsMetrics", "pmInsights", "watersPmImplication", "evidenceBoundary"):
            if item.get(field):
                signal[field] = item[field]
        additions.append(signal)

    existing = {str(item.get("id")): item for item in intelligence.get("signals", []) if item.get("id")}
    for signal in additions:
        existing[signal["id"]] = signal
    intelligence["signals"] = sorted(existing.values(), key=lambda item: item.get("date", ""), reverse=True)
    source_statuses = monitor.get("source_status", [])
    product_available = any(
        item.get("status") == "available" and item.get("fetchMethod") == "product_sitemap_xml"
        for item in source_statuses
    )
    press_available = any(
        item.get("status") == "available" and (
            item.get("url") == "https://www.agilent.com/about/newsroom/presrel.html"
            or item.get("fetchMethod") in {"official_ir_news_api", "browser_verified_archive_cache"}
        )
        for item in source_statuses
    )
    intelligence.setdefault("refresh", {})["agilent"] = (
        "success" if product_available and press_available
        else "partial_refresh" if product_available or press_available
        else "collection_review_needed"
    )
    intelligence["agilentMonitor"] = {
        "generatedAt": monitor.get("generatedAt"),
        "inventoryCounts": monitor.get("inventoryCounts", {}),
        "changesDetected": len(additions),
        "sourceStatus": monitor.get("source_status", []),
    }


def merge_perkinelmer_changes(intelligence: dict, monitor: dict) -> None:
    additions: list[dict] = []
    today = date.today().isoformat()
    # Reconcile the complete collected newsroom inventory. Limiting this merge
    # to the rolling replay window leaves older, still-visible cards stranded
    # with stale titles when a publisher corrects broken page metadata.
    for item in monitor.get("newsroom") or monitor.get("recent_press_releases", []):
        url = item.get("url", "")
        classification = item.get("classification", "corporate")
        additions.append({
            "id": competitor_signal_id("PerkinElmer", "press-release", url),
            "date": item.get("date") or today,
            "competitor": "PerkinElmer",
            "category": "Product intelligence" if classification == "product" else "Corporate intelligence",
            "signalType": item.get("signalType") or "Press release",
            "title": item.get("title") or "New PerkinElmer press release",
            "summary": "Official dated release extracted from PerkinElmer's newsroom.",
            "sourceName": "PerkinElmer official newsroom",
            "sourceUrl": url,
            "sourceTitleVerified": item.get("sourceTitleVerified") is True,
            "titleSource": item.get("titleSource") or "",
            "geography": "Global",
            "marketSegment": "Pharma",
            "technology": technology_for_url(f"{url} {item.get('title', '')}"),
            "theme": item.get("theme") or "Corporate activity",
            "evidenceCount": 1,
            "intent": "Official product, portfolio, regulatory, or corporate activity",
            "recommendation": "Review the release for concrete implications for Waters products, workflows, partnerships, and market access.",
        })
    existing = {str(item.get("id")): item for item in intelligence.get("signals", []) if item.get("id")}
    for signal in additions:
        existing[signal["id"]] = signal
    intelligence["signals"] = dedupe_official_releases(list(existing.values()))
    intelligence.setdefault("refresh", {})["perkinelmer"] = "success" if monitor.get("recent_press_releases") else "checked_empty"
    intelligence["perkinelmerMonitor"] = {
        "generatedAt": monitor.get("generatedAt"),
        "changesDetected": len(additions),
        "sourceStatus": monitor.get("sourceStatus", []),
    }


def sync_deploy_data() -> None:
    DEPLOY_DATA_DIR.mkdir(parents=True, exist_ok=True)
    for source in DATA_DIR.rglob("*.json"):
        destination = DEPLOY_DATA_DIR / source.relative_to(DATA_DIR)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)


def restore_data_snapshot(snapshot_dir: Path) -> None:
    """Restore every refresh-managed data artifact, not only intelligence.json."""
    if DATA_DIR.exists():
        shutil.rmtree(DATA_DIR)
    shutil.copytree(snapshot_dir, DATA_DIR)


def _latest(values: list[str]) -> str | None:
    cleaned = [str(value)[:10] for value in values if value and str(value)[:10]]
    return max(cleaned, default=None)


def _source_health_from_artifacts(intelligence: dict, checked_at: str) -> list[SourceHealth]:
    rows: list[SourceHealth] = []
    signals = intelligence.get("signals", [])
    pubmed_dates = [item.get("date", "") for item in signals if "pubmed" in str(item.get("sourceName", "")).lower()]
    sec_dates = [item.get("date", "") for item in signals if "sec" in str(item.get("sourceName", "")).lower()]
    pubmed_item_health = [
        item.get("itemEvidence", {})
        for group in ("themes", "competitors")
        for item in intelligence.get("trends", {}).get(group, [])
        if item.get("itemEvidence")
    ]
    pubmed_source_newest = _latest([item.get("newestDate") or item.get("newestSampledDate") or "" for item in pubmed_item_health])
    pubmed_newest_present = all(
        item.get("newestPmidIngested", item.get("newestSampledPmidIngested", False))
        for item in pubmed_item_health
    ) if pubmed_item_health else False
    for source_id, url, dates, method in (
        ("pubmed-eutils", "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/", pubmed_dates, "official_api_aggregate_counts_plus_newest_item"),
        (
            "sec-edgar-submissions",
            "https://www.sec.gov/search-filings/edgar-application-programming-interfaces",
            sec_dates,
            "official_api_all_in_window_filings",
        ),
    ):
        newest = _latest(dates)
        matching_records = [
            item for item in signals
            if str(item.get("date", ""))[:10] == newest
            and ((source_id == "pubmed-eutils" and "pubmed" in str(item.get("sourceName", "")).lower())
                 or (source_id == "sec-edgar-submissions" and "sec" in str(item.get("sourceName", "")).lower()))
        ]
        newest_record = sorted(matching_records, key=lambda item: str(item.get("sourceUrl", "")))[-1] if matching_records else {}
        source_newest = pubmed_source_newest if source_id == "pubmed-eutils" else newest
        newest_present = pubmed_newest_present if source_id == "pubmed-eutils" else bool(newest)
        is_pubmed = source_id == "pubmed-eutils"
        rows.append(SourceHealth(
            sourceId=source_id, url=url, required=True, collectionMethod=method,
            collectionOutcome="collected" if newest else "checked_empty", attemptedAt=checked_at,
            succeededAt=checked_at, engineNewestDate=newest, sourceNewestDate=source_newest,
            engineNewestTitle=newest_record.get("title"), engineNewestUrl=newest_record.get("sourceUrl"),
            sourceNewestTitle=newest_record.get("title"), sourceNewestUrl=newest_record.get("sourceUrl"),
            newestItemPresent=newest_present,
            recordsSeen=len(dates), recordsIngested=len(dates),
            completeness="complete", coverage="complete",
            reason=(
                "Aggregate PubMed counts cover every configured horizon; stored item-level evidence is an explicitly labeled representative sample that includes the newest PMID for each theme query."
                if source_id == "pubmed-eutils" else "Every qualifying in-window SEC filing was collected and deduplicated by accession number."
            ),
        ))

    journal_data = read_json(DATA_DIR / "journal_sources.json", {"sources": []})
    for source in journal_data.get("sources", []):
        if source.get("collectorType") != "crossref-journal":
            continue
        records = source.get("recentRecords", [])
        newest = _latest([item.get("date", "") for item in records])
        item_evidence = source.get("itemEvidence", {})
        extracted = source.get("collectionStatus") == "extracted"
        rows.append(SourceHealth(
            sourceId=str(source.get("id")), url=str(source.get("metadataEndpoint") or source.get("homepage") or ""),
            required=True, collectionMethod="crossref_cursor_pagination",
            collectionOutcome="collected" if extracted and records else "error" if not extracted else "checked_empty",
            attemptedAt=str(source.get("lastChecked") or checked_at), succeededAt=str(source.get("lastChecked") or checked_at) if extracted else None,
            engineNewestDate=newest, sourceNewestDate=item_evidence.get("sourceNewestDate") or newest,
            engineNewestTitle=records[0].get("title") if records else None,
            engineNewestUrl=records[0].get("sourceUrl") if records else None,
            sourceNewestTitle=records[0].get("title") if records else None,
            sourceNewestUrl=records[0].get("sourceUrl") if records else None,
            newestItemPresent=bool(item_evidence.get("newestDoiIngested")),
            recordsSeen=int(item_evidence.get("sourceResultCount") or len(records)), recordsIngested=len(records),
            completeness="complete" if "complete" in str(source.get("collectionDetail", "")).lower() else "partial",
            coverage="complete" if "complete" in str(source.get("collectionDetail", "")).lower() else "partial",
            reason=str(source.get("collectionDetail") or "Crossref collection status unavailable."),
        ))

    for source in journal_data.get("sources", []):
        if source.get("collectorType") != "public-content-feed":
            continue
        records = source.get("recentRecords", [])
        newest = _latest([item.get("date", "") for item in records])
        item_evidence = source.get("itemEvidence", {})
        status = str(source.get("collectionStatus") or "")
        rows.append(SourceHealth(
            sourceId=str(source.get("id")), url=str(source.get("homepage") or ""), required=False,
            collectionMethod="publisher_public_metadata",
            collectionOutcome="collected" if status == "extracted" and records else "partial" if records else "error",
            attemptedAt=str(source.get("lastChecked") or checked_at),
            succeededAt=str(source.get("lastChecked") or checked_at) if records else None,
            engineNewestDate=newest, sourceNewestDate=item_evidence.get("sourceNewestDate") or newest,
            newestItemPresent=bool(item_evidence.get("sourceNewestUrl")),
            recordsSeen=int(item_evidence.get("sourceResultCount") or len(records)), recordsIngested=len(records),
            completeness="partial", coverage="partial",
            reason=str(source.get("collectionDetail") or "Publisher metadata collection status unavailable."),
        ))

    customer_data = read_json(DATA_DIR / "customer_voice.json", {"sources": []})
    customer_ids = {definition for definition in ("chromforum-lc-discussions", "selectscience-lc-reviews", "labwrench-lc-discussions", "reddit-lc-discussions", "fda-regulatory-lab-findings")}
    for source in customer_data.get("sources", []):
        if source.get("id") in customer_ids:
            rows.append(migrate_legacy_source(source, checked_at))

    competitor_data = read_json(COMPETITOR_MONITOR_FILE, {"competitors": {}})
    for competitor, monitor in competitor_data.get("competitors", {}).items():
        for source in monitor.get("source_status", []):
            extracted = source.get("extractionStatus") == "extracted"
            count = int(source.get("extractedRecords") or 0)
            method = str(source.get("fetchMethod") or "official_public_source")
            source_id = str(source.get("sourceId") or f"{competitor.lower().replace(' ', '-')}-source")
            if "news" in source_id:
                candidates = monitor.get("recent_press_releases", [])
            elif "insights" in source_id:
                candidates = [item for item in monitor.get("technical_insights", []) if item.get("sourceId") == source_id]
            else:
                candidates = []
            newest_record = max(
                candidates,
                key=lambda item: (str(item.get("date", "")), str(item.get("url", ""))),
                default={},
            )
            newest = str(newest_record.get("date") or "")[:10] or None
            rows.append(SourceHealth(
                sourceId=source_id,
                url=str(source.get("url") or ""), required=True,
                collectionMethod=method,
                collectionOutcome="collected" if extracted and count else "checked_empty" if extracted else "error",
                attemptedAt=str(source.get("checkedAt") or checked_at), succeededAt=str(source.get("checkedAt") or checked_at) if extracted else None,
                engineNewestDate=newest if count else None, sourceNewestDate=newest if count else None,
                engineNewestTitle=newest_record.get("title"), engineNewestUrl=newest_record.get("url"),
                sourceNewestTitle=newest_record.get("title"), sourceNewestUrl=newest_record.get("url"),
                newestItemPresent=extracted,
                recordsSeen=count, recordsIngested=count, completeness="complete" if extracted else "unverified",
                coverage="complete" if extracted else "unverified",
                reason=str(source.get("extractionReason") or source.get("status") or ""),
            ))

    agilent = read_json(AGILENT_MONITOR_FILE, {"source_status": []})
    coverage = agilent.get("sourceCoverage", {})
    for source_id, url, method, summary in (
        ("agilent-lcms", "https://www.agilent.com/sitemap.xml", "sitemap_inventory_all_declared_pages", coverage.get("productInventory", {})),
        ("agilent-newsroom", "https://www.investor.agilent.com/news-and-events/news/default.aspx", "complete_press_archive_with_official_fallback", coverage.get("pressArchive", {})),
    ):
        complete = bool(summary.get("complete"))
        count = int(summary.get("recordsSeen") or 0)
        rows.append(SourceHealth(
            sourceId=source_id, url=url, required=True, collectionMethod=method,
            collectionOutcome="collected" if complete and count else "checked_empty" if complete else "partial",
            attemptedAt=str(agilent.get("generatedAt") or checked_at), succeededAt=str(agilent.get("generatedAt") or checked_at) if complete else None,
            engineNewestDate=summary.get("newestDate"), sourceNewestDate=summary.get("newestDate"),
            engineNewestTitle=summary.get("newestTitle"), engineNewestUrl=summary.get("newestUrl"),
            sourceNewestTitle=summary.get("newestTitle"), sourceNewestUrl=summary.get("newestUrl"),
            newestItemPresent=complete, recordsSeen=count, recordsIngested=count,
            completeness="complete" if complete else "partial", coverage="complete" if complete else "partial",
            reason="All declared sitemap pages were traversed." if source_id == "agilent-lcms" else "The complete current-year official archive was traversed through the newsroom or investor-relations feed.",
        ))
    for index, source in enumerate(agilent.get("source_status", [])):
        available = source.get("status") == "available"
        unavailable_reason = str(source.get("reliabilityNote") or source.get("status") or "")
        blocked = not available and any(token in unavailable_reason.lower() for token in ("403", "blocked", "denied", "robots"))
        rows.append(SourceHealth(
            sourceId=str(source.get("sourceId") or f"agilent-attempt-{index + 1}"), url=str(source.get("url") or ""), required=False,
            collectionMethod=str(source.get("fetchMethod") or "official_public_source"),
            collectionOutcome="checked_empty" if available else "blocked_by_policy" if blocked else "error", attemptedAt=str(source.get("checkedAt") or checked_at),
            succeededAt=str(source.get("checkedAt") or checked_at) if available else None,
            recordsSeen=0, recordsIngested=0, completeness="complete" if available else "unverified",
            coverage="complete" if available else "unverified",
            reason=unavailable_reason,
        ))

    perkin = read_json(PERKINELMER_MONITOR_FILE, {"sourceStatus": []})
    for source in perkin.get("sourceStatus", []):
        rows.append(SourceHealth(
            sourceId=str(source.get("sourceId")), url=str(source.get("url") or ""), required=bool(source.get("required", True)),
            collectionMethod=str(source.get("method") or "official_public_source"), collectionOutcome=str(source.get("collectionOutcome") or "error"),
            attemptedAt=str(source.get("attemptedAt") or checked_at), succeededAt=source.get("succeededAt"),
            engineNewestDate=source.get("engineNewestDate"), sourceNewestDate=source.get("sourceNewestDate"),
            recordsSeen=int(source.get("recordsSeen") or 0), recordsIngested=int(source.get("recordsIngested") or 0),
            completeness=str(source.get("completeness") or "unverified"), coverage=str(source.get("coverage") or "unverified"),
            reason="Official PerkinElmer sitemap/newsroom collection.",
        ))

    # Mapped-only sources are visible in the ledger but never masquerade as
    # collected evidence. They are optional until a legal record-level adapter exists.
    for source in journal_data.get("sources", []):
        if source.get("collectorType") in {"crossref-journal", "public-content-feed"}:
            continue
        rows.append(SourceHealth(
            sourceId=f"mapped-{source.get('id')}", url=str(source.get("homepage") or ""), required=False,
            collectionMethod="not_implemented", collectionOutcome="blocked_by_policy",
            attemptedAt=checked_at, completeness="unverified", coverage="unverified",
            reason="Source is mapped for monitoring but has no approved record-level collector.",
        ))

    source_catalog = read_json(DATA_DIR / "source_catalog.json", {"sources": []})
    for source in source_catalog.get("sources", []):
        source_class = str(source.get("sourceClass") or source.get("group") or "")
        if source_class not in {"Conference/poster", "Regulatory/pharmacopeial"}:
            continue
        extracted = int(source.get("extractedRecords") or 0)
        endpoint_reachable = bool(source.get("endpointReachable")) or int(source.get("endpointReachabilityCount") or 0) > 0
        extraction_status = str(source.get("extractionStatus") or "")
        content_verified = bool(source.get("contentVerified"))
        required = bool(source.get("required", source_class == "Conference/poster"))
        if extracted > 0 and extraction_status == "extracted":
            outcome, completeness, coverage = "collected", "complete", "complete"
        elif source_class == "Conference/poster" and endpoint_reachable:
            outcome, completeness, coverage = "checked_empty", "complete", "complete"
        elif content_verified:
            outcome, completeness, coverage = "collected", "complete", "complete"
        elif endpoint_reachable or extraction_status == "partial":
            outcome, completeness, coverage = "partial", "partial", "partial"
        else:
            outcome, completeness, coverage = "unreachable", "unverified", "unverified"
        rows.append(SourceHealth(
            sourceId=str(source.get("id")), url=str(source.get("url") or ""), required=required,
            collectionMethod=str(source.get("fetchMethod") or "official_public_source"),
            collectionOutcome=outcome, attemptedAt=str(source.get("lastExtractionCheck") or checked_at),
            succeededAt=str(source.get("lastExtractionCheck") or checked_at) if endpoint_reachable or extracted else None,
            newestItemPresent=True if outcome in {"collected", "checked_empty"} else None,
            recordsSeen=extracted, recordsIngested=extracted, completeness=completeness,
            coverage=coverage,
            reason=str(source.get("extractionReason") or source.get("issue") or "No record-level content was verified."),
        ))
    return rows


def write_status(status: str, started_at: str, message: str, last_success: str | None, ledger: dict | None = None, last_build_published: str | None = None) -> None:
    finished_at = utc_now()
    value = {
        "cadence": "daily",
        "status": status,
        "lastAttemptAt": finished_at,
        "lastSuccessfulRefreshAt": finished_at if status == "success" else last_success,
        "startedAt": started_at,
        "automatedDomains": AUTOMATED_DOMAINS,
        "curatedDomains": CURATED_DOMAINS,
        "message": message,
        "buildPublishedAt": finished_at if status == "success" else last_build_published,
        "sourcesVerifiedAt": (ledger or {}).get("sourcesVerifiedAt"),
        "allRequiredSourcesCurrent": (ledger or {}).get("allRequiredSourcesCurrent", False),
        "requiredSourceBlockers": (ledger or {}).get("requiredSourceBlockers", []),
        "countsByState": (ledger or {}).get("countsByState", {}),
        "sourceStateCounts": (ledger or {}).get("countsByState", {}),
        "reloadSemantics": "The browser checks hourly for a newly published dataset. Source systems are fetched only by the scheduled refresh pipeline.",
    }
    write_json(STATUS_FILE, value)


def main() -> int:
    started_at = utc_now()
    previous_status = read_json(STATUS_FILE)
    previous_success = previous_status.get("lastSuccessfulRefreshAt")
    previous_build_published = previous_status.get("buildPublishedAt")
    backup_context = tempfile.TemporaryDirectory(prefix="competition-engine-refresh-")
    backup_dir = Path(backup_context.name) / "data"
    shutil.copytree(DATA_DIR, backup_dir)
    ledger: dict | None = None

    try:
        subprocess.run([sys.executable, str(SCIENTIFIC_SOURCE_COLLECTOR)], cwd=ROOT, check=True)
        subprocess.run([sys.executable, str(CUSTOMER_VOICE_COLLECTOR)], cwd=ROOT, check=True)
        subprocess.run([sys.executable, str(COLLECTOR)], cwd=ROOT, check=True)
        subprocess.run([sys.executable, str(PERKINELMER_COLLECTOR)], cwd=ROOT, check=True)
        subprocess.run([sys.executable, str(AGILENT_COLLECTOR)], cwd=ROOT, check=True)
        subprocess.run([sys.executable, str(COMPETITOR_COLLECTOR)], cwd=ROOT, check=True)
        subprocess.run([sys.executable, str(APPLICATION_NOTE_COLLECTOR)], cwd=ROOT, check=True)
        refreshed = read_json(INTELLIGENCE_FILE)
        agilent_monitor = read_json(AGILENT_MONITOR_FILE)
        competitor_monitor = read_json(COMPETITOR_MONITOR_FILE)
        perkinelmer_monitor = read_json(PERKINELMER_MONITOR_FILE)
        validate_agilent_monitor(agilent_monitor)
        validate_competitor_monitor(competitor_monitor)
        validate_perkinelmer_monitor(perkinelmer_monitor)
        subprocess.run(["node", str(THERMO_MONITOR_VALIDATOR)], cwd=ROOT, check=True)
        subprocess.run(["node", str(SCIENTIFIC_SOURCE_VALIDATOR)], cwd=ROOT, check=True)
        merge_agilent_changes(refreshed, agilent_monitor)
        merge_competitor_changes(refreshed, competitor_monitor)
        merge_perkinelmer_changes(refreshed, perkinelmer_monitor)
        refreshed["signals"] = reclassify_strategic_releases(
            dedupe_official_releases(refreshed.get("signals", []))
        )
        write_json(INTELLIGENCE_FILE, refreshed)
        subprocess.run(["node", str(SOURCE_TITLE_LINK_VALIDATOR)], cwd=ROOT, check=True)
        subprocess.run([sys.executable, str(RECOMMENDATION_CURATOR)], cwd=ROOT, check=True)
        subprocess.run([sys.executable, str(SCORER)], cwd=ROOT, check=True)
        subprocess.run([sys.executable, str(LINK_CHECKER)], cwd=ROOT, check=True)
        subprocess.run([sys.executable, str(PROVENANCE_REMEDIATOR)], cwd=ROOT, check=True)
        refreshed = read_json(INTELLIGENCE_FILE)
        validate_intelligence(refreshed)
        subprocess.run(["node", str(CUSTOMER_VOICE_VALIDATOR)], cwd=ROOT, check=True)
        subprocess.run(["node", str(APPLICATION_NOTE_VALIDATOR)], cwd=ROOT, check=True)
        subprocess.run(["node", str(PRODUCT_LAUNCH_VALIDATOR)], cwd=ROOT, check=True)
        subprocess.run([sys.executable, str(PRESS_RELEASE_COMPLETENESS_VALIDATOR)], cwd=ROOT, check=True)
        subprocess.run(["node", str(HISTORICAL_COMPETITOR_VALIDATOR)], cwd=ROOT, check=True)
        subprocess.run(["node", str(HISTORICAL_WATERS_VALIDATOR)], cwd=ROOT, check=True)
        ledger = write_ledger(SOURCE_HEALTH_FILE, _source_health_from_artifacts(refreshed, utc_now()), build_published_at=utc_now())
        if not ledger["allRequiredSourcesCurrent"]:
            raise RuntimeError(
                "Required source high-water verification failed: "
                + ", ".join(ledger["requiredSourceBlockers"])
            )
        # Publishable exports and audit manifests must be derived only after the
        # final source gate passes. A failed refresh then leaves the entire last
        # validated build intact, not just the data directory.
        subprocess.run(["node", str(PPTX_BUILDER)], cwd=ROOT, check=True)
        subprocess.run([sys.executable, str(INTEGRITY_ARTIFACT_BUILDER)], cwd=ROOT, check=True)
        refresh_state = refreshed.get("refresh", {})
        domain_result = ", ".join(
            f"{label}: {refresh_state.get(key, 'unknown')}"
            for key, label in (("pubmed", "PubMed"), ("sec", "SEC"), ("sourceHealth", "source checks"))
        )
        write_status(
            "success",
            started_at,
            f"Automated refresh completed ({domain_result}, Agilent: {refresh_state.get('agilent', 'unknown')}); "
            + "all required sources verified.",
            previous_success,
            ledger,
        )
        sync_deploy_data()
        print("Daily refresh completed, all required sources verified, and deploy-site data was synchronized.")
        backup_context.cleanup()
        return 0
    except Exception as error:  # Keep the last validated dataset available.
        # Preserve the failing gate artifact before restoring the last good data;
        # otherwise the exact dead/mislinked URL is overwritten by the previous
        # successful link-health report and the next run cannot remediate it.
        failed_link_path = DATA_DIR / "link_health.json"
        if failed_link_path.exists():
            failed_link_copy = ROOT / "audit" / "failed_link_health.json"
            failed_link_copy.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(failed_link_path, failed_link_copy)
        failed_source_health_path = DATA_DIR / "source_health.json"
        if failed_source_health_path.exists():
            failed_source_health_copy = ROOT / "audit" / "failed_source_health.json"
            failed_source_health_copy.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(failed_source_health_path, failed_source_health_copy)
        restore_data_snapshot(backup_dir)
        write_status(
            "failed",
            started_at,
            f"Refresh failed validation; the last good dataset was retained. {error}",
            previous_success,
            ledger,
            previous_build_published,
        )
        sync_deploy_data()
        backup_context.cleanup()
        print(f"Daily refresh failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
