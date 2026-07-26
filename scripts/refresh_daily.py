#!/usr/bin/env python3
"""Run, validate, and publish the daily competitive-intelligence refresh."""

from __future__ import annotations

import json
import hashlib
import shutil
import subprocess
import sys
from datetime import date, datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DEPLOY_DATA_DIR = ROOT / "deploy-site" / "data"
INTELLIGENCE_FILE = DATA_DIR / "intelligence.json"
STATUS_FILE = DATA_DIR / "refresh_status.json"
COLLECTOR = ROOT / "scripts" / "collect_real_data.py"
AGILENT_COLLECTOR = ROOT / "scripts" / "collect_agilent.py"
COMPETITOR_COLLECTOR = ROOT / "scripts" / "collect_competitors.py"
SCIENTIFIC_SOURCE_COLLECTOR = ROOT / "scripts" / "collect_scientific_sources.py"
LINK_CHECKER = ROOT / "scripts" / "check_links.py"
CUSTOMER_VOICE_VALIDATOR = ROOT / "scripts" / "validate_customer_voice_sources.mjs"
PRODUCT_LAUNCH_VALIDATOR = ROOT / "scripts" / "validate_product_launch_press_releases.mjs"
THERMO_MONITOR_VALIDATOR = ROOT / "scripts" / "validate_thermo_monitoring.mjs"
SCIENTIFIC_SOURCE_VALIDATOR = ROOT / "scripts" / "validate_scientific_source_classes.mjs"
SCORER = ROOT / "scripts" / "score.py"
RECOMMENDATION_CURATOR = ROOT / "scripts" / "curate_recommendations.py"
AGILENT_MONITOR_FILE = DATA_DIR / "agilent_monitor.json"
COMPETITOR_MONITOR_FILE = DATA_DIR / "competitor_monitors.json"

AUTOMATED_DOMAINS = [
    "PubMed publication trends and competitor-linked publications",
    "SEC filing discovery",
    "Registered competitor source availability checks",
    "Agilent LC/MS product sitemap and press-release change detection",
    "Thermo Fisher, Shimadzu, and SCIEX product sitemap and press-release extraction",
    "Thermo Fisher LC/MS technical insight RSS extraction",
    "Peer-reviewed journal metadata plus conference and regulatory source monitoring",
]

CURATED_DOMAINS = [
    "Product-launch interpretation and machine comparisons",
    "Partnership interpretation",
    "Conference preparation",
    "Customer voice",
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
        "new_press_releases", "source_status",
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
        "new_press_releases", "new_technical_insights", "source_status",
    }
    for competitor, monitor in competitors.items():
        missing_fields = sorted(required_fields.difference(monitor))
        if missing_fields:
            raise ValueError(f"{competitor} monitor is missing: {', '.join(missing_fields)}")


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

        for item in monitor.get("new_press_releases", []):
            url = item.get("url", "")
            classification = item.get("classification", "corporate")
            additions.append({
                "id": competitor_signal_id(competitor, "press-release", url),
                "date": item.get("date") or today,
                "competitor": competitor,
                "category": "Product intelligence" if classification == "product" else "Corporate intelligence",
                "signalType": "Press release",
                "title": item.get("title") or f"New {competitor} press release",
                "summary": f"Official dated release extracted from {competitor}'s press or news index.",
                "sourceName": f"{competitor} official press releases",
                "sourceUrl": url,
                "geography": "Global",
                "marketSegment": "Pharma",
                "technology": technology_for_url(f"{url} {item.get('title', '')}"),
                "theme": "Product release" if classification == "product" else "Corporate strategy",
                "evidenceCount": 1,
                "intent": "Product and portfolio expansion" if classification == "product" else "Corporate strategic activity",
                "recommendation": "Review the release for concrete product, workflow, partnership, and market-positioning implications for Waters.",
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

    for item in monitor.get("new_press_releases", []):
        url = item.get("url", "")
        classification = item.get("classification", "corporate")
        additions.append({
            "id": signal_id("press-release", url),
            "date": item.get("date") or today,
            "competitor": "Agilent",
            "category": "Product intelligence" if classification == "product" else "Corporate intelligence",
            "signalType": "Press release",
            "title": item.get("title") or "New Agilent press release",
            "summary": "New item detected on Agilent's authoritative dated press-release index.",
            "sourceName": "Agilent press releases",
            "sourceUrl": url,
            "geography": "Global",
            "marketSegment": "Pharma",
            "technology": "Portfolio",
            "theme": "Product release" if classification == "product" else "Corporate strategy",
            "evidenceCount": 1,
            "intent": "Product and portfolio expansion" if classification == "product" else "Corporate strategic activity",
            "recommendation": "Review the release for concrete product, partnership, portfolio, and market-positioning implications for Waters.",
        })

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
        item.get("status") == "available" and item.get("url") == "https://www.agilent.com/about/newsroom/presrel.html"
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


def sync_deploy_data() -> None:
    DEPLOY_DATA_DIR.mkdir(parents=True, exist_ok=True)
    for source in DATA_DIR.glob("*.json"):
        shutil.copy2(source, DEPLOY_DATA_DIR / source.name)


def write_status(status: str, started_at: str, message: str, last_success: str | None) -> None:
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
    }
    write_json(STATUS_FILE, value)


def main() -> int:
    started_at = utc_now()
    previous_status = read_json(STATUS_FILE)
    previous_success = previous_status.get("lastSuccessfulRefreshAt")
    backup = INTELLIGENCE_FILE.read_bytes() if INTELLIGENCE_FILE.exists() else None

    try:
        subprocess.run([sys.executable, str(SCIENTIFIC_SOURCE_COLLECTOR)], cwd=ROOT, check=True)
        subprocess.run([sys.executable, str(COLLECTOR)], cwd=ROOT, check=True)
        subprocess.run([sys.executable, str(AGILENT_COLLECTOR)], cwd=ROOT, check=False)
        subprocess.run([sys.executable, str(COMPETITOR_COLLECTOR)], cwd=ROOT, check=True)
        refreshed = read_json(INTELLIGENCE_FILE)
        agilent_monitor = read_json(AGILENT_MONITOR_FILE)
        competitor_monitor = read_json(COMPETITOR_MONITOR_FILE)
        validate_agilent_monitor(agilent_monitor)
        validate_competitor_monitor(competitor_monitor)
        subprocess.run(["node", str(THERMO_MONITOR_VALIDATOR)], cwd=ROOT, check=True)
        subprocess.run(["node", str(SCIENTIFIC_SOURCE_VALIDATOR)], cwd=ROOT, check=True)
        merge_agilent_changes(refreshed, agilent_monitor)
        merge_competitor_changes(refreshed, competitor_monitor)
        write_json(INTELLIGENCE_FILE, refreshed)
        subprocess.run([sys.executable, str(RECOMMENDATION_CURATOR)], cwd=ROOT, check=True)
        subprocess.run([sys.executable, str(SCORER)], cwd=ROOT, check=True)
        refreshed = read_json(INTELLIGENCE_FILE)
        validate_intelligence(refreshed)
        subprocess.run([sys.executable, str(LINK_CHECKER)], cwd=ROOT, check=True)
        subprocess.run(["node", str(CUSTOMER_VOICE_VALIDATOR)], cwd=ROOT, check=True)
        subprocess.run(["node", str(PRODUCT_LAUNCH_VALIDATOR)], cwd=ROOT, check=True)
        refresh_state = refreshed.get("refresh", {})
        domain_result = ", ".join(
            f"{label}: {refresh_state.get(key, 'unknown')}"
            for key, label in (("pubmed", "PubMed"), ("sec", "SEC"), ("sourceHealth", "source checks"))
        )
        write_status(
            "success",
            started_at,
            f"Automated refresh completed ({domain_result}, Agilent: {refresh_state.get('agilent', 'unknown')}); curated PM intelligence was preserved.",
            previous_success,
        )
        sync_deploy_data()
        print("Daily refresh completed and deploy-site data was synchronized.")
        return 0
    except Exception as error:  # Keep the last validated dataset available.
        if backup is not None:
            INTELLIGENCE_FILE.write_bytes(backup)
        write_status(
            "failed",
            started_at,
            f"Refresh failed validation; the last good dataset was retained. {error}",
            previous_success,
        )
        sync_deploy_data()
        print(f"Daily refresh failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
