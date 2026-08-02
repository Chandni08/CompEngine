#!/usr/bin/env python3
"""Build the panel manifest, source registry, dependency matrix, and UTC windows."""

from __future__ import annotations

import json
import re
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
AUDIT = ROOT / "audit"
DEPLOY_DATA = ROOT / "deploy-site" / "data"
COMPETITORS = ["Waters", "Agilent", "Thermo Fisher", "Shimadzu", "SCIEX / Danaher", "PerkinElmer / Revvity"]
UI_HORIZONS = ["30d", "60d", "90d", "1y", "3y"]
GLOBAL_FILTERS = ["role", "geography", "market", "technology", "competitor", "timeFrame"]


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def panel(
    page: str,
    panel_id: str,
    title: str,
    selector: str,
    render: str,
    files: list[str],
    *,
    parent: str | None = None,
    route: str | None = None,
    filters: list[str] | None = None,
    horizons: list[str] | None = None,
    mode: str = "derived",
    refresh: str = "scripts/refresh_daily.py",
    validation: str = "tests/test_panel_manifest.py",
    hidden: list[str] | None = None,
    source_fields: list[str] | None = None,
    derived_fields: list[str] | None = None,
) -> dict:
    return {
        "pageId": page,
        "parentPanelId": parent,
        "panelId": panel_id,
        "subpanelId": panel_id if parent else None,
        "visibleTitle": title,
        "navigationRoute": route or f"{page}#{panel_id}",
        "htmlContainer": selector,
        "renderFunction": render,
        "sourceDataFiles": files,
        "sourceFields": source_fields or ["id", "date", "title", "sourceUrl"],
        "derivedFields": derived_fields or ["filteredCount", "asOfDate"],
        "competitorsRepresented": COMPETITORS,
        "sourceFamiliesRepresented": sorted({
            "customer_voice" if "customer_voice" in name else
            "conference" if "conference" in name else
            "publication" if "journal" in name else
            "filing" if "filing" in name else
            "product" if any(token in name for token in ("product", "historical", "technical")) else
            "competitive_intelligence"
            for name in files
        }),
        "availableFilters": filters if filters is not None else GLOBAL_FILTERS,
        "availableTimeFrames": horizons if horizons is not None else UI_HORIZONS,
        "defaultState": "visible" if not hidden else hidden[0],
        "hiddenExpandedStates": hidden or ["collapsible-expanded", "collapsible-collapsed"],
        "externalLinks": ["dynamic:sourceUrl", "dynamic:url"],
        "internalLinks": [f"#{panel_id}"] if page == "index.html" else [],
        "emptyStateBehavior": "Render an explicit no-matching-records or unavailable-evidence message.",
        "currentAsOfDate": None,
        "refreshCollector": refresh,
        "validationFunction": validation,
        "dataMode": mode,
    }


def panel_specs() -> list[dict]:
    i = "index.html"
    rows = [
        panel(i, "global-filters", "Global Filters", ".filters", "render", ["data/intelligence.json"], filters=GLOBAL_FILTERS + ["application", "buyingSituation", "buyerRole", "competitorProduct"], mode="interactive"),
        panel(i, "refresh-status", "Build and Source Verification Status", ".refresh-block", "renderRefreshStatus", ["data/refresh_status.json", "data/source_health.json"], filters=[], horizons=[], mode="derived"),
        panel(i, "pmm-start-here", "Product Marketing Start Here", "#pmmStartHere", "renderMarketingWorkspace", ["data/intelligence.json", "data/product_comparisons.json"], hidden=["marketing-role-only"], mode="derived"),
        panel(i, "pmm-head-to-head", "Head-to-Head Comparison", "#pmm-head-to-head", "renderPmmHeadToHeadComparison", ["data/product_comparisons.json", "data/technical_comparisons.json", "data/historical_waters_catalog.json", "data/historical_product_catalog.json"], hidden=["marketing-role-only"]),
        panel(i, "pmm-governing-position", "Governing Position", "#pmm-governing-position", "renderPmmGoverningPosition", ["data/intelligence.json"], hidden=["marketing-role-only"], mode="curated", refresh="manual-curation:PMM_DATA_CONTRACT.md"),
        panel(i, "pmm-positioning-decisions", "Positioning Decisions", "#pmm-positioning-decisions", "renderPmmPositioningDecisions", ["data/intelligence.json", "data/product_comparisons.json"], hidden=["marketing-role-only"]),
        panel(i, "pmm-claims-risk", "Claims and Risk", "#pmm-claims-risk", "renderPmmClaimsRisk", ["data/intelligence.json", "data/technical_comparisons.json"], hidden=["marketing-role-only"]),
        panel(i, "pmm-segment-cascade", "Segment Cascade", "#pmm-segment-cascade", "renderPmmSegmentCascade", ["data/intelligence.json", "data/market_application_sources.json"], hidden=["marketing-role-only"]),
        panel(i, "pmm-competitive-narratives", "Competitive Narratives", "#pmm-competitive-narratives", "renderMarketingBattlecards", ["data/intelligence.json", "data/product_comparisons.json", "data/customer_voice.json", "data/competitor_application_notes.json"], hidden=["marketing-role-only"]),
        panel(i, "pmm-adoption-value", "Adoption and Value", "#pmm-adoption-value", "renderPmmAdoptionValue", ["data/intelligence.json", "data/customer_voice.json"], hidden=["marketing-role-only"]),
        panel(i, "pmm-activation-artifacts", "Activation Artifacts", "#pmm-activation-artifacts", "renderPmmActivationArtifacts", ["data/intelligence.json"], hidden=["marketing-role-only"], mode="curated", refresh="manual-curation:PMM_DATA_CONTRACT.md"),
        panel(i, "pmm-evidence-appendix", "Evidence Appendix", "#pmm-evidence-appendix", "renderPmmEvidenceAppendix", ["data/intelligence.json", "data/customer_voice.json", "data/filing_insights.json"], hidden=["marketing-role-only"]),
        panel(i, "leadership-brief", "Leadership Brief", "#leadership-brief", "renderDecisionPacket", ["data/intelligence.json", "data/product_launches.json", "data/filing_insights.json", "data/customer_voice.json"]),
        panel(i, "overall-trend-analysis", "Overall Trend Analysis", "#overall-trend-analysis", "renderOverallTrendAnalysis", ["data/intelligence.json", "data/customer_voice.json", "data/filing_insights.json"]),
        panel(i, "competitor-intent-section", "Competitor Intent", "#competitor-intent-section", "renderCompetitorIntentCards", ["data/intelligence.json", "data/product_launches.json", "data/filing_insights.json"]),
        panel(i, "decisions-needed", "Decisions Needed", "#decisions-needed", "renderDecisionQueue", ["data/intelligence.json", "data/customer_voice.json", "data/filing_insights.json"]),
        panel(i, "customer-voice", "Customer Voice and Market Signals", "#customer-voice", "renderCustomerVoiceSignals", ["data/customer_voice.json", "data/intelligence.json"]),
        panel(i, "customer-summary", "Customer Voice Summary", '[data-customer-voice-panel="summary"]', "renderCustomerVoiceSummary", ["data/customer_voice.json"], parent="customer-voice", hidden=["tab-summary-default"]),
        panel(i, "customer-company", "Customer Voice by Company", "#customerCompetitorChart", "renderCustomerCompetitorChart", ["data/customer_voice.json"], parent="customer-voice"),
        panel(i, "customer-evidence-classification", "Evidence Classification", "#sentimentTrendChart", "renderSentimentTrendChart", ["data/customer_voice.json"], parent="customer-voice"),
        panel(i, "customer-roadmap-inputs", "Roadmap Decision Inputs", ".customer-roadmap-inputs", "customerRoadmapInputsMarkup", ["data/customer_voice.json", "data/intelligence.json"], parent="customer-voice"),
        panel(i, "customer-needs", "Pain and Needs", '[data-customer-voice-panel="needs"]', "renderPainPointTracker;renderUnmetNeeds", ["data/customer_voice.json"], parent="customer-voice", hidden=["tab-hidden-default"]),
        panel(i, "customer-positioning", "Positioning", '[data-customer-voice-panel="positioning"]', "renderMarketPositioning;renderCustomerSegments;renderCompetitiveCustomerSignals;renderCustomerPmInsights", ["data/customer_voice.json"], parent="customer-voice", hidden=["marketing-role-tab"]),
        panel(i, "customer-evidence", "Evidence and Source Links", '[data-customer-voice-panel="evidence"]', "renderCustomerEvidenceTable", ["data/customer_voice.json", "data/link_health.json"], parent="customer-voice", hidden=["tab-hidden-default"]),
        panel(i, "product-comparator", "Product Comparator", "#product-comparator", "renderProductComparator", ["data/product_comparisons.json", "data/technical_comparisons.json", "data/historical_waters_catalog.json", "data/historical_product_catalog.json"]),
        panel(i, "competitive-timeline-section", "Competitive Product Timeline", "#competitive-timeline-section", "renderCompetitiveTimeline", ["data/product_launches.json", "data/historical_product_catalog.json"]),
        panel(i, "competitive-capability-evidence", "Competitive Capability Evidence", "#competitive-capability-evidence", "renderFeatureGapMatrix", ["data/product_comparisons.json", "data/technical_comparisons.json", "data/customer_voice.json", "data/intelligence.json"]),
        panel(i, "metric-grid", "Executive Product Metrics", "#metricGrid", "renderMetrics", ["data/product_launches.json"], parent="competitive-timeline-section"),
        panel(i, "filing-evidence", "SEC Filing Evidence", "#filing-evidence", "renderFilingInsights", ["data/filing_insights.json", "data/intelligence.json"]),
        panel(i, "strategic-signals", "Strategic Signals", "#strategicSignals", "renderStrategicSignals", ["data/intelligence.json"], hidden=["paginated"]),
        panel(i, "conference-intelligence", "Conference Intelligence", "#conference-intelligence", "renderConferenceSources", ["data/conference_sources.json", "data/conference_preparation.json"]),
        panel(i, "journal-forum-sources", "Journal and Forum Sources", "#journal-forum-sources", "renderJournalForumSources", ["data/journal_sources.json"]),
        panel(i, "shortHorizonDefensePanel", "Short-Horizon Defense", "#shortHorizonDefensePanel", "renderShortHorizonDefense", ["data/product_comparisons.json", "data/technical_comparisons.json"], hidden=["conditionally-hidden"]),
        panel(i, "application-trends", "Application Trends", "#application-trends", "renderTrends", ["data/intelligence.json", "data/journal_sources.json", "data/market_application_sources.json"]),
        panel(i, "evidence-signal-feed", "Public Evidence", "#evidence-signal-feed", "renderSignals", ["data/intelligence.json", "data/link_health.json"], hidden=["paginated", "hidden-in-product-role"]),
        panel(i, "competitor-coverage", "Competitor Coverage", ".competitor-coverage-panel", "renderCompetitorCoverageHealth", ["data/source_catalog.json", "data/source_health.json"], hidden=["hidden-in-product-role"]),
        panel(i, "decision-evidence-modal", "Evidence Links", "#decisionEvidenceModal", "openDecisionEvidence", ["data/intelligence.json", "data/customer_voice.json", "data/filing_insights.json", "data/product_launches.json"], hidden=["modal-hidden-default"]),
    ]
    c = "conference.html"
    rows.extend([
        panel(c, "conference-filters", "Conference Filters", ".conference-filter-bar", "render", ["data/conference_preparation.json"], filters=["timeFrame", "conferenceType", "competitor"], horizons=["upcoming", "past"], mode="interactive"),
        panel(c, "conference-stats", "Conference Statistics", "#conferenceStats", "renderStats", ["data/conference_preparation.json"]),
        panel(c, "conference-timeline", "Conference Timeline", ".conference-timeline-panel", "renderTimeline", ["data/conference_preparation.json"]),
        panel(c, "conference-event-rail", "Conference Event List", ".conference-event-rail", "renderEventRail", ["data/conference_preparation.json"], hidden=["paginated"]),
        panel(c, "conference-event-detail", "Conference Event Detail", "#conferenceEventDetail", "renderEventDetail", ["data/conference_preparation.json"]),
        panel(c, "competitor-appearances-modal", "Competitor Appearances", "#competitorAppearancesModal", "openCompetitorAppearancesModal", ["data/conference_preparation.json"], hidden=["modal-hidden-default"]),
    ])
    p = "publications.html"
    rows.extend([
        panel(p, "publication-filters", "Publication Filters", ".publication-filter-bar", "render", ["data/journal_sources.json"], filters=["search", "source", "period"], horizons=["rollingCurrent", "priorPeriod"], mode="interactive"),
        panel(p, "publication-stats", "Publication Statistics", "#publicationStats", "renderStats", ["data/journal_sources.json"]),
        panel(p, "publication-fresh-highlights", "Fresh Publication Highlights", "#publicationFreshHighlights", "renderFreshHighlights", ["data/journal_sources.json"]),
        panel(p, "publication-overall-analysis", "Overall Publication Analysis", "#publicationOverallAnalysis", "renderOverallAnalysis", ["data/journal_sources.json"]),
        panel(p, "publication-source-rail", "Publication Source List", ".publication-source-rail", "renderSourceRail", ["data/journal_sources.json"], hidden=["paginated"]),
        panel(p, "publication-detail", "Publication Source Detail", "#publicationDetail", "renderPublicationDetail", ["data/journal_sources.json"]),
    ])
    return rows


def validate_selectors(rows: list[dict]) -> None:
    html = {name: (ROOT / name).read_text(encoding="utf-8") for name in {row["pageId"] for row in rows}}
    for row in rows:
        selector = row["htmlContainer"]
        body = html[row["pageId"]]
        if selector.startswith("#") and f'id="{selector[1:]}"' not in body:
            # Dynamic containers are allowed when the render function creates them.
            if selector not in {"#strategicSignals"}:
                raise ValueError(f"missing container {selector} for {row['panelId']}")
        elif selector.startswith(".") and selector[1:] not in body and selector not in {".customer-roadmap-inputs"}:
            raise ValueError(f"missing class container {selector} for {row['panelId']}")
        elif selector.startswith("["):
            attribute = selector.split("=", 1)[0][1:]
            if attribute not in body:
                raise ValueError(f"missing attribute container {selector} for {row['panelId']}")


def source_registry() -> dict:
    health = read_json(DATA / "source_health.json")
    catalog = read_json(DATA / "source_catalog.json")
    catalog_rows = catalog.get("sources", [])
    catalog_by_id = {row.get("id"): row for row in catalog_rows}
    alias_map: dict[str, list[dict]] = {}
    for row in catalog_rows:
        candidates = {str(row.get("id") or "")}
        source_id = str(row.get("id") or "")
        for prefix in ("journal-", "trade-"):
            if source_id.startswith(prefix):
                candidates.add(source_id[len(prefix):])
        if source_id == "pubmed": candidates.add("pubmed-eutils")
        if source_id == "sec-search": candidates.add("sec-edgar-submissions")
        for candidate in candidates:
            alias_map.setdefault(candidate, []).append(row)
    rows = []
    registered_hosts = set()
    for item in health.get("sources", []):
        aliases = alias_map.get(item["sourceId"], [])
        catalog_row = aliases[0] if aliases else catalog_by_id.get(item["sourceId"], {})
        row = dict(item)
        row["sourceName"] = catalog_row.get("source") or row.get("sourceName")
        row["sourceType"] = catalog_row.get("sourceClass") or catalog_row.get("group") or row.get("sourceType")
        row["aliases"] = sorted({alias.get("id") for alias in aliases if alias.get("id")})
        row["competitor"] = catalog_row.get("competitor")
        row["signalCoverage"] = catalog_row.get("signalCoverage", [])
        rows.append(row)
        host = urlparse(str(row.get("baseUrl") or "")).hostname
        if host: registered_hosts.add(host.removeprefix("www."))

    url_pattern = re.compile(r"https?://[^\s\"'<>]+")
    evidence_hosts: dict[str, int] = {}
    for path in DATA.rglob("*.json"):
        for raw in url_pattern.findall(path.read_text(encoding="utf-8", errors="ignore")):
            host = urlparse(raw.rstrip(".,);]")).hostname
            if host:
                normalized = host.removeprefix("www.")
                evidence_hosts[normalized] = evidence_hosts.get(normalized, 0) + 1
    evidence_only = [
        {"domain": host, "referenceCount": count, "registryStatus": "REGISTERED" if host in registered_hosts else "MANUAL_EVIDENCE_ONLY"}
        for host, count in sorted(evidence_hosts.items())
    ]
    return {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "definitions": {
            "freshness": "Newest qualifying source item is present.",
            "completeness": "All qualifying items in the configured window are present.",
            "coverage": "Record-level source content is actively ingested.",
            "reachability": "The endpoint responded independently of content extraction.",
            "validity": "Records have defensible source, date/title or explicit undated status, URL, and classification.",
        },
        "sources": rows,
        "evidenceDomains": evidence_only,
    }


def source_data_files(source: dict) -> list[str]:
    source_id = source["sourceId"].lower()
    source_type = str(source.get("sourceType") or "").lower()
    if "conference" in source_type or source_id.startswith("conference-"):
        return ["data/conference_sources.json", "data/conference_preparation.json", "data/source_catalog.json", "data/source_health.json"]
    if any(token in source_id for token in ("pubmed", "journal", "analytical", "jasms", "talanta")):
        return ["data/journal_sources.json", "data/intelligence.json", "data/source_catalog.json", "data/source_health.json"]
    if "sec" in source_id:
        return ["data/intelligence.json", "data/filing_insights.json", "data/source_catalog.json", "data/source_health.json"]
    if any(token in source_id for token in ("reddit", "chromforum", "labwrench", "selectscience", "fda-")):
        return ["data/customer_voice.json", "data/intelligence.json", "data/source_catalog.json", "data/source_health.json"]
    if any(token in source_id for token in ("usp-", "ich-")):
        return ["data/source_catalog.json", "data/source_health.json", "data/intelligence.json"]
    return ["data/intelligence.json", "data/source_catalog.json", "data/source_health.json", "data/product_launches.json", "data/competitor_monitors.json"]


def dependency_matrix(registry: dict, panels: list[dict]) -> dict:
    sources = []
    for source in registry["sources"]:
        files = source_data_files(source)
        affected = sorted({row["panelId"] for row in panels if set(files).intersection(row["sourceDataFiles"])})
        sources.append({
            "sourceId": source["sourceId"],
            "collector": source.get("method") or source.get("collectionMethod"),
            "dataFiles": files,
            "affectedPanels": affected,
            "dependencyChain": [
                source.get("baseUrl"),
                source.get("method") or source.get("collectionMethod"),
                "normalized source record",
                *files,
                *affected,
            ],
        })
    artifacts = []
    for file_name in sorted({file for row in panels for file in row["sourceDataFiles"]}):
        artifacts.append({
            "dataFile": file_name,
            "affectedPanels": sorted(row["panelId"] for row in panels if file_name in row["sourceDataFiles"]),
            "refreshOwners": sorted({row["refreshCollector"] for row in panels if file_name in row["sourceDataFiles"]}),
        })
    return {"schemaVersion": 1, "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"), "sources": sources, "artifacts": artifacts}


def utc_windows(as_of: date) -> dict:
    end = datetime.combine(as_of, time.min, tzinfo=timezone.utc)
    quarter_start_month = ((as_of.month - 1) // 3) * 3 + 1
    current_quarter_start = date(as_of.year, quarter_start_month, 1)
    prior_quarter_end = current_quarter_start - timedelta(days=1)
    prior_quarter_start_month = ((prior_quarter_end.month - 1) // 3) * 3 + 1
    prior_quarter_start = date(prior_quarter_end.year, prior_quarter_start_month, 1)
    earliest = date(1996, 1, 1)
    def row(key: str, label: str, start: date, stop: date = as_of, *, ui: bool = False, kind: str = "dateRange") -> dict:
        return {
            "id": key, "label": label, "startUtc": f"{start.isoformat()}T00:00:00Z", "endUtc": f"{stop.isoformat()}T00:00:00Z",
            "boundaryConvention": "closed interval over normalized record timestamps: start <= timestamp <= end", "availableInUi": ui, "kind": kind,
        }
    windows = [
        row("30d", "30 days", as_of - timedelta(days=30), ui=True),
        row("60d", "60 days", as_of - timedelta(days=60), ui=True),
        row("90d", "90 days", as_of - timedelta(days=90), ui=True),
        row("current_quarter", "Current quarter", current_quarter_start),
        row("prior_quarter", "Prior quarter", prior_quarter_start, prior_quarter_end),
        row("ytd", "Year to date", date(as_of.year, 1, 1)),
        row("1y", "1 year", as_of - timedelta(days=365), ui=True),
        row("trailing_12_months", "Trailing 12 months", as_of - timedelta(days=365)),
        row("3y", "3 years", as_of - timedelta(days=365 * 3), ui=True),
        row("5y", "5 years", as_of - timedelta(days=365 * 5)),
        row("since_2023_07", "Since July 2023", date(2023, 7, 1)),
        row("current_calendar_year", "Current calendar year", date(as_of.year, 1, 1)),
        row("prior_calendar_year", "Prior calendar year", date(as_of.year - 1, 1, 1), date(as_of.year - 1, 12, 31)),
        row("all_historical", "All historical periods", earliest),
        row("past_conferences", "Past conferences", earliest, as_of - timedelta(days=1), kind="conferenceDateRange"),
        row("upcoming_conferences", "Upcoming conferences", as_of, date(2100, 12, 31), kind="conferenceDateRange"),
    ]
    return {"schemaVersion": 1, "asOfDate": as_of.isoformat(), "normalization": "All date-only records normalize to 00:00:00Z; future records after the window end are excluded.", "windows": windows}


def main() -> None:
    panels = panel_specs()
    validate_selectors(panels)
    as_of = date.fromisoformat(read_json(DATA / "intelligence.json")["asOfDate"])
    for row in panels:
        row["currentAsOfDate"] = as_of.isoformat()
    registry = source_registry()
    manifest = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "panelCount": len({row["panelId"] for row in panels if not row["parentPanelId"]}),
        "subpanelCount": sum(bool(row["parentPanelId"]) for row in panels),
        "panels": panels,
    }
    write_json(AUDIT / "panel_manifest.json", manifest)
    write_json(DATA / "source_registry.json", registry)
    write_json(AUDIT / "panel_dependency_matrix.json", dependency_matrix(registry, panels))
    write_json(DATA / "time_frame_boundaries.json", utc_windows(as_of))
    DEPLOY_DATA.mkdir(parents=True, exist_ok=True)
    write_json(DEPLOY_DATA / "source_registry.json", registry)
    write_json(DEPLOY_DATA / "time_frame_boundaries.json", utc_windows(as_of))
    print(f"Built {manifest['panelCount']} panels, {manifest['subpanelCount']} subpanels, and {len(registry['sources'])} source records.")


if __name__ == "__main__":
    main()
