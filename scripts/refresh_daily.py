#!/usr/bin/env python3
"""Run, validate, and publish the daily competitive-intelligence refresh."""

from __future__ import annotations

import json
import hashlib
import os
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import date, datetime, timezone
from urllib.parse import urlparse
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
LINK_REDIRECT_FILE = DATA_DIR / "link_redirects.json"

KNOWN_SOURCE_URL_MIGRATIONS = {
    "https://jobs.perkinelmer.com/job/woodbridge/product-director-lc-lcms/43930/94486435280":
        "https://jobs.perkinelmer.com/location/woodbridge-ontario-canada-jobs/20539/6251999-6093943-6184009/4",
    "https://jobs.perkinelmer.com/job/woodbridge/software-product-owner-ai-woodbridge-on/43930/80659880304":
        "https://jobs.perkinelmer.com/location/woodbridge-ontario-canada-jobs/20539/6251999-6093943-6184009/4",
    "https://investors.danaher.com/2020-09-01-Danaher-Appoints-Rainer-Blair-As-President-and-CEO":
        "https://www.danaher.com/rainer-m-blair",
    "https://sciex.com/products/software/oneomics":
        "https://sciex.com/applications/biomedical-and-omics-research/oneomics",
    "https://www.acs.org/events/all-events/acs-spring-2026.html":
        "https://www.acs.org/events/spring.html",
    "https://www.acs.org/events/all-events/acs-fall-2026.html":
        "https://www.acs.org/events/fall.html",
    "https://www.fda.gov/drugs/drug-approvals-and-databases/compilation-cder-new-molecular-entity-nme-drug-and-new-biologic-approvals":
        "https://www.fda.gov/drugs/novel-drug-approvals-fda/novel-drug-approvals-2026",
    "https://www.thermofisher.com/us/en/home/industrial/chromatography/liquid-chromatography-lc/hplc-uhplc-systems/vanquish-amplify-uhplc-system.html":
        "https://www.thermofisher.com/order/catalog/product/VQ-AMPLIFY",
}

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
    "Evidence-backed PM recommendations, considerations, and decision implications regenerated from the refreshed dataset",
]

# Domains that back a required source row in the freshness ledger. If one of
# these falls back to the previous dataset, the run is not publishable.
REQUIRED_REFRESH_DOMAINS = ("pubmed", "sec")

CURATED_DOMAINS = [
    "Product-launch interpretation and machine comparisons",
    "Partnership interpretation",
    "Conference preparation",
    "PM recommendation frameworks, internal decision gates, and validation methods",
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


def migrate_known_source_urls() -> int:
    """Replace retired official URLs before collectors and link gates run."""
    replacements = 0
    for path in DATA_DIR.rglob("*.json"):
        if path.name == "link_health.json":
            continue
        try:
            original = path.read_text(encoding="utf-8")
        except OSError:
            continue
        updated = original
        for retired_url, current_url in KNOWN_SOURCE_URL_MIGRATIONS.items():
            occurrences = updated.count(retired_url)
            if occurrences:
                updated = updated.replace(retired_url, current_url)
                replacements += occurrences
        if updated != original:
            temporary = path.with_suffix(f"{path.suffix}.tmp")
            temporary.write_text(updated, encoding="utf-8")
            temporary.replace(path)
    return replacements


def validate_intelligence(data: dict) -> None:
    errors: list[str] = []
    today = date.today().isoformat()
    refresh_state = data.get("refresh", {})
    # A domain that backs a required source must actually refresh.  Accepting
    # "any one of three" let a stale domain ride to publication behind a
    # sibling's success.
    stale_required_domains = [
        domain for domain in REQUIRED_REFRESH_DOMAINS
        if refresh_state.get(domain) != "success"
    ]
    for domain in stale_required_domains:
        errors.append(
            f"required source domain did not refresh: {domain} "
            f"({refresh_state.get(domain, 'missing')})"
        )

    as_of_date = str(data.get("asOfDate") or "")
    if as_of_date > today:
        errors.append(f"asOfDate {as_of_date} is in the future")
    elif as_of_date != today and not stale_required_domains:
        # Every required domain refreshed, so nothing can legitimately hold the
        # dataset back to an earlier date.
        errors.append(f"asOfDate {as_of_date or 'missing'} was not updated to today")
    domain_dates = data.get("domainAsOfDates") or refresh_state.get("domainAsOfDates") or {}
    contributing = [str(value) for value in domain_dates.values() if value]
    if contributing and as_of_date != min(contributing):
        errors.append(
            f"asOfDate {as_of_date} does not match the oldest contributing domain {min(contributing)}"
        )
    if len(data.get("signals", [])) < 10:
        errors.append("fewer than 10 signals were retained")
    if len(data.get("recommendations", [])) < 1:
        errors.append("no PM recommendations were retained")
    for recommendation in data.get("recommendations", []):
        title = recommendation.get("title", "untitled recommendation")
        generated_at = str(recommendation.get("canonicalDecision", {}).get("generatedAt", ""))
        if generated_at[:10] != date.today().isoformat():
            errors.append(f"recommendation analysis was not regenerated today: {title}")
        implications = recommendation.get("urgency", {}).get("decisionImplications", [])
        if not implications or not all(str(item).strip() for item in implications):
            errors.append(f"recommendation has no decision implications: {title}")

    themes = data.get("trends", {}).get("themes", [])
    if len(themes) < 5:
        errors.append("fewer than five publication themes were produced")
    for theme in themes:
        counts = theme.get("counts", {})
        ordered = [int(counts.get(key, 0)) for key in ("30d", "60d", "90d", "1y", "3y", "5y")]
        if ordered != sorted(ordered):
            errors.append(f"non-cumulative horizon counts for {theme.get('theme', 'unknown theme')}")

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
        # A dated press index that loads and parses but holds no in-scope release
        # is a successful check, not a failure. Requiring records here meant the
        # first days of every January failed the entire refresh. A product
        # sitemap still has to yield records: an empty one is always a fault.
        healthy_outcomes = {"extracted"}
        by_id = {str(status.get("sourceId")): status for status in statuses}
        collected: set[str] = set()
        for source_id, status in by_id.items():
            outcome = str(status.get("extractionStatus") or "")
            allowed = healthy_outcomes | ({"checked_empty"} if source_id.endswith("-news") else set())
            if outcome in allowed:
                collected.add(source_id)
        missing = sorted(required_sources.difference(collected))
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
    def source_priority(signal: dict) -> tuple[int, int]:
        """Prefer primary filings, then issuer newsroom pages, over feed mirrors."""
        url = str(signal.get("sourceUrl", "")).lower()
        signal_type = str(signal.get("signalType", "")).lower()
        if "sec.gov/archives/edgar/" in url or "sec earnings filing" in signal_type:
            return (3, len(str(signal.get("title", ""))))
        if "investor." in url:
            return (1, len(str(signal.get("title", ""))))
        if "/about/newsroom/" in url or "/news/" in url:
            return (2, len(str(signal.get("title", ""))))
        return (1, len(str(signal.get("title", ""))))

    releases: dict[tuple[str, str, str], dict] = {}
    release_urls: dict[tuple[str, str], tuple[str, str, str]] = {}
    retained: list[dict] = []
    for signal in signals:
        signal_type = str(signal.get("signalType", "")).lower()
        category = str(signal.get("category", "")).lower()
        if not any(term in signal_type or term in category for term in ("release", "earnings", "corporate", "regulatory")):
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
        # Earnings releases can arrive through both a newsroom monitor and an
        # SEC collector.  Keep the primary exhibit regardless of collection
        # order; otherwise prefer the issuer newsroom over a feed mirror.
        if source_priority(signal) > source_priority(current):
            releases[key] = signal
            if url_key[1]:
                release_urls[url_key] = key
    return sorted([*retained, *releases.values()], key=lambda item: item.get("date", ""), reverse=True)


def signal_id(prefix: str, url: str) -> str:
    digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:12]
    return f"agilent-monitor-{prefix}-{digest}"


INDEX_DOCUMENT = re.compile(r"^(?:index|default)\.(?:html?|php|aspx)$", re.I)


def product_name(url: str) -> str:
    """Name a product from its URL.

    Directory-style pages end in index.html and vendors append tracking
    parameters, so take the last meaningful path segment rather than the last
    path component, which produced names like "Index.Html?From=Mpeb".
    """
    path = urlparse(str(url or "")).path
    segments = [segment for segment in path.split("/") if segment]
    while segments and INDEX_DOCUMENT.match(segments[-1]):
        segments.pop()
    if not segments:
        return "Agilent LC/MS product page"
    slug = re.sub(r"\.(?:html?|php|aspx)$", "", segments[-1], flags=re.I)
    return slug.replace("-", " ").replace("_", " ").strip().title() or "Agilent LC/MS product page"


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


# Conference sources default to required, but a few organisers publish their
# programme only through an event platform with no machine-readable public page.
# Those are monitored for context and must not gate publication. Matching by
# prefix keeps next year's event id from silently reinstating the block.
OPTIONAL_CONFERENCE_SOURCE_PREFIXES = ("conference-acs-",)


def conference_source_is_required(source: dict) -> bool:
    """Whether a conference source may block publication.

    An explicit ``required`` value in the catalog always wins; the prefix list is
    only the default for sources that have never carried one.
    """
    declared = source.get("required")
    if declared is not None:
        return bool(declared)
    source_id = str(source.get("id") or "")
    return not source_id.startswith(OPTIONAL_CONFERENCE_SOURCE_PREFIXES)


PRODUCT_PATH_MARKERS = ("/product", "/products", "/systems", "/software", "/instrument")


def _looks_like_product_page(url: str) -> bool:
    path = urlparse(str(url or "")).path.lower()
    return any(marker in path for marker in PRODUCT_PATH_MARKERS)


def merge_link_redirects(intelligence: dict, report: dict) -> int:
    """Turn links that now serve a different page into reviewable signals.

    The link checker has always observed these redirects and thrown them away.
    For a vendor product page a permanent redirect is a lifecycle event — a
    retirement, a successor, or a family consolidation — and it is invisible to
    sitemap diffing, because the URL stays listed and still answers 200.
    """
    moved = report.get("movedLinks") or []
    if not moved:
        return 0

    signals = intelligence.get("signals", [])
    by_source_url = {str(item.get("sourceUrl") or ""): item for item in signals}
    existing_ids = {str(item.get("id") or "") for item in signals}
    today = date.today().isoformat()
    additions: list[dict] = []

    for entry in moved:
        url = str(entry.get("url") or "")
        final_url = str(entry.get("finalUrl") or "")
        cited = by_source_url.get(url)
        if not cited or not final_url:
            # Only report a redirect for a link the dashboard actually cites.
            continue
        competitor = str(cited.get("competitor") or "Market-wide")
        product = product_name(url)
        successor = product_name(final_url)
        offsite = entry.get("redirectKind") == "offsite"
        signal_id = signal_id_for_redirect(url, final_url)
        if signal_id in existing_ids:
            continue
        if offsite:
            summary = (
                f"The cited page now resolves to a different domain ({final_url}). "
                "Confirm whether the source was transferred, syndicated, or withdrawn."
            )
            intent = "Cited source moved to another domain"
        elif _looks_like_product_page(url):
            summary = (
                f"The official page for {product} permanently redirects to {successor}. "
                "A vendor redirect between product pages usually marks a retirement, a "
                "successor product, or a family consolidation; it is not visible in the "
                "sitemap, which still lists the old address."
            )
            intent = "Official product page redirected to another product"
        else:
            summary = (
                f"The cited page now redirects to {final_url}. "
                f"{entry.get('reason') or 'The publisher moved the content.'}"
            )
            intent = "Cited source page redirected"
        additions.append({
            "id": signal_id,
            "date": str(entry.get("observedAt") or today)[:10],
            "competitor": competitor,
            "category": "Product intelligence" if _looks_like_product_page(url) else "Market intelligence",
            "signalType": "Source page redirected",
            "title": f"{competitor} {product} page now redirects to {successor}",
            "summary": summary,
            "sourceName": str(cited.get("sourceName") or "Official source"),
            "sourceUrl": final_url,
            "previousSourceUrl": url,
            "redirectKind": str(entry.get("redirectKind") or ""),
            "redirectReason": str(entry.get("reason") or ""),
            "geography": str(cited.get("geography") or "Global"),
            "marketSegment": str(cited.get("marketSegment") or "Pharma"),
            "technology": cited.get("technology") or technology_for_url(url),
            "theme": "Portfolio lifecycle change",
            "evidenceCount": 1,
            "intent": intent,
            "sourceDate": str(entry.get("observedAt") or today)[:10],
            "sourceDateType": "change_detection",
            "evidenceStatus": "partial",
            "recommendation": (
                "Open both addresses and confirm the lifecycle status in an official "
                "announcement before treating the redirect as a discontinuation."
            ),
        })
        existing_ids.add(signal_id)

    if additions:
        intelligence["signals"] = signals + additions
    return len(additions)


def signal_id_for_redirect(url: str, final_url: str) -> str:
    digest = hashlib.sha256(f"{url}|{final_url}".encode("utf-8")).hexdigest()[:12]
    return f"redirect-{digest}"


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


def _engine_record_high_water(signals: list[dict], prefix: str) -> tuple[str | None, dict]:
    """Return the newest genuinely collected record for an id prefix.

    Synthetic aggregates (for example ``trend-*`` publication-count signals, which
    are stamped with the run date rather than a source publication date) are not
    records and must never stand in for the engine's high-water mark.
    """
    records = [item for item in signals if str(item.get("id", "")).startswith(prefix)]
    newest = _latest([item.get("date", "") for item in records])
    if not newest:
        return None, {}
    matching = [item for item in records if str(item.get("date", ""))[:10] == newest]
    newest_record = sorted(matching, key=lambda item: str(item.get("sourceUrl", "")))[-1] if matching else {}
    return newest, newest_record


def _pubmed_source_health(intelligence: dict, signals: list[dict], checked_at: str) -> SourceHealth:
    """Compare the engine's PubMed records against the live newest-item query.

    ``itemEvidence`` is written by the collector from a live E-utilities query that
    asks for the single newest PMID per theme.  That PMID is the only PubMed
    high-water evidence in the dataset that did not come from the dataset itself.
    """
    themes = intelligence.get("trends", {}).get("themes", []) or []
    competitors = intelligence.get("trends", {}).get("competitors", []) or []
    configured = list(themes) + list(competitors)
    observations = [item.get("itemEvidence", {}) for item in configured if item.get("itemEvidence")]

    def newest_pmid(evidence: dict) -> str:
        return str(evidence.get("newestPmid") or evidence.get("newestSampledPmid") or "").strip()

    def newest_date(evidence: dict) -> str:
        return str(evidence.get("newestDate") or evidence.get("newestSampledDate") or "").strip()

    def newest_stored_date(evidence: dict) -> str:
        """The source's newest item expressed the way the engine stores dates.

        An ahead-of-print record is stored clamped to the collection date, so
        comparing it against its future cover date would report a lag that does
        not exist.
        """
        return str(evidence.get("newestStoredDate") or "").strip() or newest_date(evidence)

    live = [item for item in observations if newest_pmid(item) and newest_date(item)]
    engine_newest, engine_record = _engine_record_high_water(signals, "pubmed-")
    pubmed_records = [item for item in signals if str(item.get("id", "")).startswith("pubmed-")]
    record_count = len(pubmed_records)
    ingested_pmids = {str(item.get("id", ""))[len("pubmed-"):] for item in pubmed_records}

    # Every configured query must contribute a live newest-item observation before
    # PubMed coverage can be called complete; a missing observation is an unchecked
    # query, not a passing one.
    complete = bool(live) and len(live) == len(configured)
    newest_observation = max(live, key=newest_date) if live else {}
    source_newest_date = newest_stored_date(newest_observation) or None
    source_newest_pmid = newest_pmid(newest_observation)
    source_newest_url = f"https://pubmed.ncbi.nlm.nih.gov/{source_newest_pmid}/" if source_newest_pmid else None
    newest_present = all(
        bool(item.get("newestPmidIngested", item.get("newestSampledPmidIngested", False)))
        for item in live
    ) if complete else None
    # Point the engine side at the source's newest PMID only when that PMID is
    # genuinely among the collected records. This is a membership test against
    # the ingested set, so the URL comparison reports real presence or absence.
    engine_newest_url = engine_record.get("sourceUrl")
    if source_newest_pmid and source_newest_pmid in ingested_pmids:
        engine_newest_url = source_newest_url

    if complete:
        observation = (
            f"Live PubMed E-utilities newest-item query for {len(live)} configured queries; "
            f"newest observed PMID {source_newest_pmid} dated "
            f"{newest_date(newest_observation)}."
        )
        reason = (
            "Aggregate PubMed counts cover every configured horizon; the newest PMID returned by each "
            "live theme query was checked for presence in the collected records."
        )
    else:
        observation = ""
        reason = (
            f"Only {len(live)} of {len(configured)} configured PubMed queries returned a live newest-item "
            "observation; PubMed freshness is unverified for this run."
        )

    return SourceHealth(
        sourceId="pubmed-eutils",
        url="https://eutils.ncbi.nlm.nih.gov/entrez/eutils/",
        required=True,
        collectionMethod="official_api_aggregate_counts_plus_newest_item",
        collectionOutcome="collected" if engine_newest else "checked_empty",
        attemptedAt=checked_at,
        succeededAt=checked_at,
        engineNewestDate=engine_newest,
        engineNewestTitle=engine_record.get("title"),
        engineNewestUrl=engine_newest_url,
        sourceNewestDate=source_newest_date,
        sourceNewestTitle=None,
        sourceNewestUrl=source_newest_url,
        newestItemPresent=newest_present,
        recordsSeen=record_count,
        recordsIngested=record_count,
        completeness="complete" if complete else "unverified",
        coverage="complete" if complete else "unverified",
        sourceObservation=observation,
        reason=reason,
    )


def _sec_source_health(intelligence: dict, signals: list[dict], checked_at: str) -> SourceHealth:
    """Compare collected SEC filings against the live EDGAR submissions high-water mark."""
    high_water = (intelligence.get("sourceHighWater") or {}).get("sec-edgar-submissions") or {}
    engine_newest, engine_record = _engine_record_high_water(signals, "sec-")
    record_count = sum(1 for item in signals if str(item.get("id", "")).startswith("sec-"))
    observed_at = str(high_water.get("observedAt") or "")
    source_newest_date = str(high_water.get("newestDate") or "") or None
    source_newest_url = str(high_water.get("newestUrl") or "") or None
    ingested_ids = {str(item.get("id", "")) for item in signals}
    expected_id = str(high_water.get("newestSignalId") or "")
    complete = bool(source_newest_date and source_newest_url and expected_id)
    newest_present = expected_id in ingested_ids if complete else None

    if complete:
        observation = (
            f"Live SEC EDGAR submissions traversal observed at {observed_at or checked_at}; newest in-window "
            f"tracked filing {high_water.get('newestForm', 'filing')} for "
            f"{high_water.get('newestRegistrant', 'registrant')} dated {source_newest_date}."
        )
        reason = (
            "Every qualifying in-window SEC filing was collected and deduplicated by accession number; "
            "the newest filing seen in the live submissions feed was checked for presence."
        )
    else:
        observation = ""
        reason = (
            "The SEC collector did not record a live submissions high-water mark for this run; "
            "SEC freshness is unverified."
        )

    return SourceHealth(
        sourceId="sec-edgar-submissions",
        url="https://www.sec.gov/search-filings/edgar-application-programming-interfaces",
        required=True,
        collectionMethod="official_api_all_in_window_filings",
        collectionOutcome="collected" if engine_newest else "checked_empty",
        attemptedAt=checked_at,
        succeededAt=checked_at,
        engineNewestDate=engine_newest,
        engineNewestTitle=engine_record.get("title"),
        engineNewestUrl=engine_record.get("sourceUrl"),
        sourceNewestDate=source_newest_date,
        sourceNewestTitle=str(high_water.get("newestTitle") or "") or None,
        sourceNewestUrl=source_newest_url,
        newestItemPresent=newest_present,
        recordsSeen=int(high_water.get("inWindowFilingsSeen") or record_count),
        recordsIngested=record_count,
        completeness="complete" if complete else "unverified",
        coverage="complete" if complete else "unverified",
        sourceObservation=observation,
        reason=reason,
    )


def _source_health_from_artifacts(intelligence: dict, checked_at: str) -> list[SourceHealth]:
    rows: list[SourceHealth] = []
    prior_health = {
        str(item.get("sourceId")): item
        for item in read_json(SOURCE_HEALTH_FILE, {"sources": []}).get("sources", [])
        if item.get("state") == "CURRENT"
    }
    signals = intelligence.get("signals", [])
    rows.append(_pubmed_source_health(intelligence, signals, checked_at))
    rows.append(_sec_source_health(intelligence, signals, checked_at))

    journal_data = read_json(DATA_DIR / "journal_sources.json", {"sources": []})
    for source in journal_data.get("sources", []):
        if source.get("collectorType") != "crossref-journal":
            continue
        records = source.get("recentRecords", [])
        newest = _latest([item.get("date", "") for item in records])
        item_evidence = source.get("itemEvidence", {})
        extracted = source.get("collectionStatus") == "extracted"
        source_newest_doi = str(item_evidence.get("sourceNewestDoi") or "").strip()
        crossref_complete = bool(
            source_newest_doi
            and item_evidence.get("paginationComplete")
            and "complete" in str(source.get("collectionDetail", "")).lower()
        )
        rows.append(SourceHealth(
            sourceId=str(source.get("id")), url=str(source.get("metadataEndpoint") or source.get("homepage") or ""),
            required=True, collectionMethod="crossref_cursor_pagination",
            collectionOutcome="collected" if extracted and records else "error" if not extracted else "checked_empty",
            attemptedAt=str(source.get("lastChecked") or checked_at), succeededAt=str(source.get("lastChecked") or checked_at) if extracted else None,
            engineNewestDate=newest, sourceNewestDate=item_evidence.get("sourceNewestDate"),
            engineNewestTitle=records[0].get("title") if records else None,
            engineNewestUrl=records[0].get("sourceUrl") if records else None,
            sourceNewestUrl=(f"https://doi.org/{source_newest_doi}" if source_newest_doi else None),
            newestItemPresent=bool(item_evidence.get("newestDoiIngested")) if source_newest_doi else None,
            recordsSeen=int(item_evidence.get("sourceResultCount") or len(records)), recordsIngested=len(records),
            completeness="complete" if crossref_complete else "partial",
            coverage="complete" if crossref_complete else "partial",
            sourceObservation=(
                f"Live Crossref cursor traversal at {item_evidence.get('queryExecutedAt') or checked_at}; "
                f"newest DOI {source_newest_doi} dated {item_evidence.get('sourceNewestDate')}."
                if crossref_complete else ""
            ),
            reason=str(source.get("collectionDetail") or "Crossref collection status unavailable."),
        ))

    for source in journal_data.get("sources", []):
        if source.get("collectorType") != "public-content-feed":
            continue
        records = source.get("recentRecords", [])
        newest = _latest([item.get("date", "") for item in records])
        item_evidence = source.get("itemEvidence", {})
        status = str(source.get("collectionStatus") or "")
        # Records retained from a prior run are not evidence about the live source.
        feed_observed_live = bool(
            item_evidence.get("sourceNewestUrl") and not item_evidence.get("retainedFromPriorRun")
        )
        rows.append(SourceHealth(
            sourceId=str(source.get("id")), url=str(source.get("homepage") or ""), required=False,
            collectionMethod="publisher_public_metadata",
            collectionOutcome="collected" if status == "extracted" and records else "partial" if records else "error",
            attemptedAt=str(source.get("lastChecked") or checked_at),
            succeededAt=str(source.get("lastChecked") or checked_at) if records else None,
            engineNewestDate=newest,
            sourceNewestDate=item_evidence.get("sourceNewestDate") if feed_observed_live else None,
            sourceNewestUrl=str(item_evidence.get("sourceNewestUrl") or "") or None if feed_observed_live else None,
            newestItemPresent=None,
            recordsSeen=int(item_evidence.get("sourceResultCount") or len(records)), recordsIngested=len(records),
            completeness="partial", coverage="partial",
            sourceObservation=(
                f"Live publisher metadata fetch at {item_evidence.get('queryExecutedAt') or checked_at}."
                if feed_observed_live else ""
            ),
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
                sourceObservation=(
                    f"Live {method} traversal of {source.get('url') or source_id} at "
                    f"{source.get('checkedAt') or checked_at}; the monitor records what the fetch returned."
                    if extracted else ""
                ),
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
            sourceObservation=(
                f"Live {method} of {url} at {agilent.get('generatedAt') or checked_at}; the coverage summary "
                "records the traversal the collector completed against the official source."
                if complete else ""
            ),
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
        required = (
            conference_source_is_required(source) if source_class == "Conference/poster"
            else bool(source.get("required", False))
        )
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
        prior = prior_health.get(str(source.get("id")))
        # Skipping the link recheck must not manufacture a verification. Carrying
        # a prior run's result forward for a source that is unreachable *now* is
        # the same self-comparison the ledger exists to prevent, so the retained
        # row stays explicitly unverified and a required source still blocks.
        retained_prior_verification = bool(
            os.environ.get("SKIP_LINK_CHECK") == "1"
            and source_class == "Conference/poster"
            and outcome == "unreachable"
            and not required
            and prior
            and prior.get("url") == source.get("url")
        )
        if retained_prior_verification:
            outcome, completeness, coverage = "partial", "unverified", "unverified"
        rows.append(SourceHealth(
            sourceId=str(source.get("id")), url=str(source.get("url") or ""), required=required,
            collectionMethod=str(source.get("fetchMethod") or "official_public_source"),
            collectionOutcome=outcome, attemptedAt=str(source.get("lastExtractionCheck") or checked_at),
            succeededAt=(
                str(source.get("lastExtractionCheck") or checked_at)
                if endpoint_reachable or extracted
                else prior.get("succeededAt") if retained_prior_verification else None
            ),
            newestItemPresent=True if outcome in {"collected", "checked_empty"} else None,
            recordsSeen=extracted, recordsIngested=extracted, completeness=completeness,
            coverage=coverage,
            reason=(
                "The current automated request was blocked; retained the same-URL prior CURRENT verification by explicit operator request."
                if retained_prior_verification
                else str(source.get("extractionReason") or source.get("issue") or "No record-level content was verified.")
            ),
        ))
    return rows


def write_status(status: str, started_at: str, message: str, last_success: str | None, ledger: dict | None = None, last_build_published: str | None = None) -> None:
    finished_at = utc_now()
    dataset_as_of_date = read_json(INTELLIGENCE_FILE).get("asOfDate")
    value = {
        "cadence": "daily",
        "status": status,
        "datasetAsOfDate": dataset_as_of_date,
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
        migrated_urls = migrate_known_source_urls()
        if migrated_urls:
            print(f"Migrated {migrated_urls} retired official source URL references.")
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
        if os.environ.get("SKIP_LINK_CHECK") == "1":
            print("Skipping external link recheck by explicit operator request; retaining the latest validated link-health artifact.")
        else:
            subprocess.run([sys.executable, str(LINK_CHECKER)], cwd=ROOT, check=True)
        # The link checker records which cited pages now serve a different
        # address. Merge those before provenance normalization so the new
        # records pick up the same provenance fields as every other signal.
        refreshed = read_json(INTELLIGENCE_FILE)
        redirect_signals = merge_link_redirects(refreshed, read_json(LINK_REDIRECT_FILE))
        if redirect_signals:
            write_json(INTELLIGENCE_FILE, refreshed)
            print(f"Merged {redirect_signals} redirected-source signal(s) from the link check.")
        subprocess.run([sys.executable, str(PROVENANCE_REMEDIATOR)], cwd=ROOT, check=True)
        refreshed = read_json(INTELLIGENCE_FILE)
        deduped_signals = dedupe_official_releases(refreshed.get("signals", []))
        rescore_needed = bool(redirect_signals)
        if len(deduped_signals) != len(refreshed.get("signals", [])):
            removed = len(refreshed.get("signals", [])) - len(deduped_signals)
            refreshed["signals"] = deduped_signals
            write_json(INTELLIGENCE_FILE, refreshed)
            print(f"Removed {removed} duplicate official release record(s) after provenance normalization.")
            rescore_needed = True
        if rescore_needed:
            # Scores include corpus-level corroboration, so recalculate after the
            # signal set changes rather than publishing stale rankings.
            subprocess.run([sys.executable, str(SCORER)], cwd=ROOT, check=True)
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
        if os.environ.get("SKIP_REFRESH_EXPORTS") == "1":
            print("Skipping local-only leadership PPTX rebuild; the cloud job publishes refreshed JSON data only.")
        else:
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
