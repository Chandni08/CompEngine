#!/usr/bin/env python3
"""Collect, normalize, deduplicate, and persist public customer-voice evidence."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.customer_voice_ingestion import SOURCE_CREDIBILITY, EvidenceRecord  # noqa: E402
from scripts.customer_voice_ingestion import chromforum, fda_bulk, labwrench, reddit_api, selectscience  # noqa: E402
from scripts.customer_voice_ingestion.common import canonical_url, deduplicate_records  # noqa: E402


DATA_FILE = ROOT / "data" / "customer_voice.json"
VALIDATION_CACHE_FILE = ROOT / "data" / "customer_voice_validation_cache.json"
LOGGER = logging.getLogger("collect_customer_voice")
ADAPTERS: tuple[tuple[str, Callable[[], list[EvidenceRecord]]], ...] = (
    ("chromforum", chromforum.collect),
    ("selectscience", selectscience.collect),
    ("labwrench", labwrench.collect),
    ("reddit", reddit_api.collect),
    ("fda", fda_bulk.collect),
)
SOURCE_DEFINITIONS = {
    "chromforum": {
        "id": "chromforum-lc-discussions",
        "sourceName": "Chromatography Forum",
        "sourceType": "community_forum",
        "url": "https://www.chromforum.org/viewforum.php?f=1",
        "coverage": "Public viewtopic.php and viewforum.php LC discussions; competitor comparisons are prioritized.",
    },
    "selectscience": {
        "id": "selectscience-lc-reviews",
        "sourceName": "SelectScience product reviews and articles",
        "sourceType": "structured_review",
        "url": "https://www.selectscience.net/product/acquity-uplc-r-beh-c18-and-c8-columns",
        "coverage": "Public product pages with numeric ratings and review text, plus public article pages.",
    },
    "labwrench": {
        "id": "labwrench-lc-discussions",
        "sourceName": "LabWrench",
        "sourceType": "community_forum",
        "url": "https://www.labwrench.com/forums/",
        "coverage": "Public LC/HPLC forum, thread, and article pages.",
    },
    "reddit": {
        "id": "reddit-lc-discussions",
        "sourceName": "Reddit official OAuth API",
        "sourceType": "reddit",
        "url": "https://www.reddit.com/dev/api/",
        "coverage": "Public posts from r/Chromatography, r/analyticalchemistry, and r/labrats via the official OAuth Data API only.",
    },
    "fda": {
        "id": "fda-regulatory-lab-findings",
        "sourceName": "FDA official bulk regulatory data",
        "sourceType": "regulatory",
        "url": fda_bulk.FORM_483_XLSX,
        "coverage": "Official FDA Warning Letter index and Form 483 bulk workbooks filtered to regulated laboratory and data-control findings.",
    },
}
DOMAIN_SOURCE_MAP = {
    "chromforum.org": ("chromforum-lc-discussions", "Chromatography Forum", "community_forum"),
    "selectscience.net": ("selectscience-lc-reviews", "SelectScience product reviews and articles", "structured_review"),
    "labwrench.com": ("labwrench-lc-discussions", "LabWrench", "community_forum"),
    "reddit.com": ("reddit-lc-discussions", "Reddit official OAuth API", "reddit"),
    "redd.it": ("reddit-lc-discussions", "Reddit official OAuth API", "reddit"),
    "fda.gov": ("fda-regulatory-lab-findings", "FDA official bulk regulatory data", "regulatory"),
}
VENDOR_TERMS = {
    "Waters": ("waters", "acquity", "alliance", "empower", "masslynx", "targetlynx", "unifi", "xevo", "synapt"),
    "Agilent": ("agilent", "infinitylab", "openlab", "1260", "1290"),
    "Thermo Fisher": ("thermo", "vanquish", "chromeleon", "ultimate 3000"),
    "Shimadzu": ("shimadzu", "nexera", "prominence", "labsolutions"),
    "SCIEX": ("sciex", "exionlc", "sciex os"),
}
PRODUCT_TERMS = (
    "ACQUITY UPLC", "Alliance", "Empower", "MassLynx", "TargetLynx", "UNIFI", "Xevo", "Synapt",
    "InfinityLab", "OpenLab", "1260", "1290", "Vanquish", "Chromeleon", "Ultimate 3000",
    "Nexera", "Prominence", "LabSolutions", "ExionLC", "SCIEX OS",
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict[str, Any]) -> None:
    temporary = path.with_suffix(f"{path.suffix}.tmp")
    temporary.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temporary.replace(path)


def infer_source_type(url: str, record_type: str = "") -> str:
    lowered = f"{url} {record_type}".lower()
    if "reddit.com" in lowered:
        return "reddit"
    if "fda.gov" in lowered or "form 483" in lowered or "warning letter" in lowered:
        return "regulatory"
    if "selectscience.net" in lowered or "product review" in lowered or "support" in lowered:
        return "structured_review"
    return "community_forum"


def canonical_source_identity(url: str) -> tuple[str, str, str] | None:
    """Return the only permitted source identity for a canonical URL domain."""
    host = re.sub(r"^www\.", "", urlparse(url).hostname or "")
    for domain, identity in DOMAIN_SOURCE_MAP.items():
        if host == domain or host.endswith(f".{domain}"):
            return identity
    return None


def reconcile_source_identity(data: dict[str, Any]) -> int:
    """Repair legacy source labels that conflict with the exact record URL."""
    repaired = 0
    for feedback in data.get("feedback", []):
        records = feedback.get("evidenceRecords") or []
        identities = {
            canonical_source_identity(str(record.get("url") or feedback.get("sourceUrl") or ""))
            for record in records
        }
        identities.discard(None)
        if len(identities) != 1:
            continue
        source_id, source_name, source_type = identities.pop()
        if feedback.get("sourceIds") != [source_id]:
            feedback["sourceIds"] = [source_id]
            repaired += 1
        if feedback.get("sourceName") != source_name:
            feedback["sourceName"] = source_name
            repaired += 1
        for record in records:
            if record.get("sourceName") != source_name:
                record["sourceName"] = source_name
                repaired += 1
            if record.get("sourceType") != source_type:
                record["sourceType"] = source_type
                record["sourceCredibility"] = SOURCE_CREDIBILITY[source_type]
                repaired += 1
    return repaired


def migrate_evidence_schema(data: dict[str, Any]) -> int:
    migrated = 0
    for feedback in data.get("feedback", []):
        for record in feedback.get("evidenceRecords", []):
            source_type = record.get("sourceType") or infer_source_type(record.get("url", ""), record.get("recordType", ""))
            if source_type not in SOURCE_CREDIBILITY:
                source_type = infer_source_type(record.get("url", ""), record.get("recordType", ""))
            if record.get("sourceType") != source_type:
                record["sourceType"] = source_type
                migrated += 1
            credibility = SOURCE_CREDIBILITY[source_type]
            if record.get("sourceCredibility") != credibility:
                record["sourceCredibility"] = credibility
                migrated += 1
            if not record.get("firstSeenAt"):
                record["firstSeenAt"] = feedback.get("dateCaptured") or data.get("generatedAt") or utc_now()
                migrated += 1
            if not record.get("lastSeenAt"):
                record["lastSeenAt"] = data.get("generatedAt") or utc_now()
                migrated += 1
            if not record.get("contentHash"):
                basis = "\n".join((str(record.get("label", "")), str(record.get("excerpt", "")), str(record.get("reviewText", ""))))
                record["contentHash"] = hashlib.sha256(basis.encode("utf-8")).hexdigest()
                migrated += 1
    return migrated


def _record_text(record: EvidenceRecord) -> str:
    return " ".join((record.label, record.excerpt, record.review_text, " ".join(record.source_keywords))).strip()


def _company(text: str) -> str:
    lowered = text.lower()
    matches = [(company, sum(term in lowered for term in terms)) for company, terms in VENDOR_TERMS.items()]
    company, score = max(matches, key=lambda item: item[1])
    return company if score else "Market-wide"


def _product(text: str, company: str) -> str:
    lowered = text.lower()
    for product in PRODUCT_TERMS:
        if product.lower() in lowered:
            return product
    return f"{company} LC/LC-MS portfolio" if company != "Market-wide" else "Regulated LC/QC laboratories"


def _category(text: str) -> tuple[str, str, str]:
    lowered = text.lower()
    definitions = (
        (("method transfer", "migration", "compatibility"), "Method transfer / routine LC modernization", "Method transfer", "Protect method performance and validation evidence across instruments and software."),
        (("data export", "portability", "lock-in", "audit trail", "electronic record"), "Data portability / software lock-in", "Software", "Validate export, audit-trail, and data-review friction in a representative regulated workflow."),
        (("laboratory control", "data integrity", "form 483", "warning letter", "specification", "investigation"), "Regulated laboratory controls / data integrity", "Compliance", "Map recurring FDA laboratory-control findings to instrument, software, and review controls."),
        (("troubleshoot", "pressure", "leak", "seal", "carryover", "autosampler", "repair", "maintenance"), "Reliability / troubleshooting and recovery", "Reliability", "Measure time-to-diagnosis, recovery steps, and service escalation across representative failures."),
        (("setup", "onboarding", "template", "ease of use", "training"), "Workflow setup / ease of use", "Ease of use", "Validate setup time, template reuse, and operator learning burden."),
        (("cost", "price", "consumable", "operating"), "Software / cost of ownership", "Cost", "Quantify recurring software, consumables, and service burden per workflow."),
    )
    for terms, category, priority, interpretation in definitions:
        if any(term in lowered for term in terms):
            return category, priority, interpretation
    return "Workflow performance / user experience", "Ease of use", "Validate the observed workflow issue with additional independent sources before prioritizing it."


def _sentiment(record: EvidenceRecord, text: str) -> str:
    if record.source_type == "regulatory":
        return "Negative"
    if record.rating is not None:
        if record.rating >= 4:
            return "Positive"
        if record.rating <= 2.5:
            return "Negative"
        return "Mixed"
    lowered = text.lower()
    negative = sum(term in lowered for term in ("problem", "issue", "failure", "leak", "broken", "difficult", "frustrat", "expensive", "error", "downtime"))
    positive = sum(term in lowered for term in ("reliable", "easy", "robust", "fast", "excellent", "recommend", "precise"))
    if negative > positive:
        return "Negative"
    if positive > negative:
        return "Positive"
    return "Mixed"


def feedback_from_record(record: EvidenceRecord, source_id: str) -> dict[str, Any]:
    text = _record_text(record)
    # Prefer the page title when it names one vendor; comparison-thread body
    # text often mentions several vendors and would otherwise misattribute the
    # record to whichever name happens to occur most often.
    company = _company(record.label)
    if company == "Market-wide":
        company = _company(text)
    product = _product(text, company)
    category, buying_priority, pm_interpretation = _category(text)
    digest = hashlib.sha256(record.url.encode("utf-8")).hexdigest()[:14]
    return {
        "id": f"cv-public-{digest}",
        "dateCaptured": date.today().isoformat(),
        "company": company,
        "product": product,
        "platform": "LC-MS" if re.search(r"lc[-/]?ms|mass spect", text, re.I) else "LC/UHPLC",
        "sourceIds": [source_id],
        "sourceName": record.source_name,
        "sourceUrl": record.url,
        "evidenceRecords": [record.to_schema()],
        "sentiment": _sentiment(record, text),
        "category": category,
        "estimatedMentions5y": 1,
        "theme": category,
        "languageType": "analyst_paraphrase",
        "customerLanguageSignal": (record.review_text or record.excerpt or record.label)[:500],
        "pmInterpretation": pm_interpretation,
        "labType": "Pharma" if record.source_type == "regulatory" else "Unspecified public contributor",
        "userRole": "Public reviewer/contributor" if record.source_type != "regulatory" else "FDA inspection finding",
        "buyingPriority": buying_priority,
        "productMaturity": "Public evidence",
        "geography": "Global",
        "confidence": round(record.to_schema()["sourceCredibility"] * 100),
        "evidenceStatus": "Exact dated public source",
    }


def merge_records(data: dict[str, Any], records_by_adapter: dict[str, list[EvidenceRecord]]) -> tuple[int, int]:
    existing_urls: dict[str, dict[str, Any]] = {}
    for feedback in data.get("feedback", []):
        for record in feedback.get("evidenceRecords", []):
            if record.get("url"):
                existing_urls.setdefault(canonical_url(record["url"]), record)
    enriched = 0
    added = 0
    for adapter_name, records in records_by_adapter.items():
        source_id = SOURCE_DEFINITIONS[adapter_name]["id"]
        for record in deduplicate_records(records):
            key = canonical_url(record.url)
            if key in existing_urls:
                target = existing_urls[key]
                schema = record.to_schema()
                first_seen = target.get("firstSeenAt") or schema["firstSeenAt"]
                for field in ("label", "sourceKeywords", "recordType", "sourceDate", "sourceType", "sourceCredibility", "sourceName", "rating", "reviewText", "excerpt", "redditId", "subreddit", "regulatoryFindings", "regulatoryEntries", "regulatoryDataset", "fiscalYear", "contentHash"):
                    if field in schema and target.get(field) != schema[field]:
                        target[field] = schema[field]
                        enriched += 1
                target["firstSeenAt"] = first_seen
                target["lastSeenAt"] = schema["lastSeenAt"]
                continue
            data.setdefault("feedback", []).append(feedback_from_record(record, source_id))
            existing_urls[key] = data["feedback"][-1]["evidenceRecords"][0]
            added += 1
    return added, enriched


def refresh_generated_feedback_fields(data: dict[str, Any]) -> int:
    """Recompute only collector-owned summaries when richer evidence is re-ingested."""
    refreshed = 0
    for feedback in data.get("feedback", []):
        if not str(feedback.get("id", "")).startswith("cv-public-"):
            continue
        record_data = (feedback.get("evidenceRecords") or [None])[0]
        if not record_data:
            continue
        source_type = record_data.get("sourceType")
        try:
            record = EvidenceRecord(
                label=record_data.get("label", "Public evidence"),
                url=record_data.get("url", ""),
                source_keywords=record_data.get("sourceKeywords", []),
                record_type=record_data.get("recordType", "Public evidence record"),
                source_date=record_data.get("sourceDate", ""),
                source_type=source_type,
                source_name=record_data.get("sourceName", feedback.get("sourceName", "Public source")),
                excerpt=record_data.get("excerpt", ""),
                rating=record_data.get("rating"),
                review_text=record_data.get("reviewText", ""),
            )
        except (TypeError, ValueError):
            continue
        source_id = (feedback.get("sourceIds") or [""])[0]
        replacement = feedback_from_record(record, source_id)
        replacement["id"] = feedback["id"]
        replacement["dateCaptured"] = feedback.get("dateCaptured", replacement["dateCaptured"])
        replacement["evidenceRecords"] = feedback["evidenceRecords"]
        feedback.update(replacement)
        refreshed += 1
    return refreshed


def prune_out_of_scope_labwrench_feedback(data: dict[str, Any]) -> int:
    """Remove collector-owned forum-index noise admitted by legacy page-chrome matching."""
    trusted_urls = {
        canonical_url(url)
        for url in labwrench.DEFAULT_SEEDS
        if urlparse(url).path.lower().startswith(("/thread/", "/articles/"))
    }
    kept: list[dict[str, Any]] = []
    removed = 0
    for feedback in data.get("feedback", []):
        records = feedback.get("evidenceRecords") or []
        record = records[0] if records else {}
        record_url = canonical_url(str(record.get("url") or feedback.get("sourceUrl") or ""))
        is_collector_owned = str(feedback.get("id", "")).startswith("cv-public-")
        is_labwrench = "labwrench.com" in record_url
        title = re.sub(r"^LabWrench:\s*", "", str(record.get("label") or ""), flags=re.I)
        if is_collector_owned and is_labwrench and record_url not in trusted_urls and not labwrench.discovered_title_relevant(title):
            removed += 1
            continue
        kept.append(feedback)
    data["feedback"] = kept
    return removed


def prune_expired_unverifiable_reddit_feedback(
    data: dict[str, Any],
    validation_cache: dict[str, Any],
    now: datetime | None = None,
) -> tuple[int, int]:
    """Drop Reddit evidence once its full-source validation cache expires.

    Reddit may only be accessed through its official OAuth API. When those
    credentials are unavailable, recently validated records can remain visible
    for the cache TTL, but expired or never-validated records must fail closed
    instead of surviving indefinitely in a newly refreshed dataset.
    """
    now = now or datetime.now(timezone.utc)
    max_age_days = float(validation_cache.get("maxAgeDays", 30))
    cache_by_url = {
        canonical_url(str(item.get("url") or "")): item
        for item in validation_cache.get("sources", [])
        if item.get("url")
    }

    def cache_is_current(record: dict[str, Any]) -> bool:
        entry = cache_by_url.get(canonical_url(str(record.get("url") or "")))
        if not entry or entry.get("validationMethod") != "full_source_text":
            return False
        validated_date = str(entry.get("validatedAt") or "")[:10]
        try:
            validated_at = datetime.fromisoformat(f"{validated_date}T23:59:59+00:00")
        except ValueError:
            return False
        age_days = (now - validated_at).total_seconds() / 86_400
        return age_days <= max_age_days

    kept_feedback: list[dict[str, Any]] = []
    records_removed = 0
    feedback_removed = 0
    for feedback in data.get("feedback", []):
        records = feedback.get("evidenceRecords") or []
        retained_records = [
            record
            for record in records
            if record.get("sourceType") != "reddit" or cache_is_current(record)
        ]
        records_removed += len(records) - len(retained_records)
        if records and not retained_records:
            feedback_removed += 1
            continue
        feedback["evidenceRecords"] = retained_records
        kept_feedback.append(feedback)
    data["feedback"] = kept_feedback
    return records_removed, feedback_removed


def _adapter_outcome(adapter_name: str, records: list[EvidenceRecord], errors: dict[str, str]) -> tuple[str, str, str]:
    env_names = {
        "chromforum": "CUSTOMER_VOICE_CHROMFORUM_ENABLED",
        "selectscience": "CUSTOMER_VOICE_SELECTSCIENCE_ENABLED",
        "labwrench": "CUSTOMER_VOICE_LABWRENCH_ENABLED",
        "reddit": "CUSTOMER_VOICE_REDDIT_ENABLED",
        "fda": "CUSTOMER_VOICE_FDA_ENABLED",
    }
    raw = os.getenv(env_names[adapter_name], "true").strip().lower()
    if raw in {"0", "false", "no", "off", "disabled"}:
        return "disabled", "none", "Adapter disabled by environment configuration."
    if adapter_name == "reddit" and not (os.getenv("REDDIT_CLIENT_ID") and os.getenv("REDDIT_CLIENT_SECRET")):
        return "skipped_missing_credentials", "unverified", "Reddit OAuth credentials are not configured; no API request was made."
    if adapter_name in errors:
        return "error", "unverified", errors[adapter_name]
    if records:
        completeness = "complete" if adapter_name in {"fda"} else "partial" if adapter_name in {"chromforum", "labwrench"} else "complete"
        return "collected" if completeness == "complete" else "partial", completeness, "Public records were collected through the approved adapter."
    coverage = "complete" if adapter_name in {"fda"} else "partial"
    return "checked_empty", coverage, "The approved endpoint was checked and returned no qualifying records."


def update_source_registry(
    data: dict[str, Any],
    results: dict[str, list[EvidenceRecord]],
    errors: dict[str, str],
    selected_adapters: set[str] | None = None,
) -> None:
    existing = {item.get("id"): item for item in data.get("sources", []) if item.get("id")}
    for adapter_name, definition in SOURCE_DEFINITIONS.items():
        if selected_adapters is not None and adapter_name not in selected_adapters:
            continue
        current = dict(existing.get(definition["id"], {}))
        current.update(definition)
        current["sourceCredibility"] = SOURCE_CREDIBILITY[definition["sourceType"]]
        outcome, completeness, reason = _adapter_outcome(adapter_name, results.get(adapter_name, []), errors)
        current["status"] = outcome
        current["collectionOutcome"] = outcome
        current["collectionMethod"] = "official_api" if adapter_name == "reddit" else "official_bulk_download" if adapter_name == "fda" else "robots_aware_public_pages"
        current["required"] = adapter_name == "fda"
        current["recordsCollected"] = len(results.get(adapter_name, []))
        current["recordsSeen"] = len(results.get(adapter_name, []))
        current["recordsIngested"] = len(results.get(adapter_name, []))
        current["completeness"] = completeness
        current["coverageState"] = completeness
        current["reason"] = reason
        current["lastCheckedAt"] = utc_now()
        current["attemptedAt"] = current["lastCheckedAt"]
        current["succeededAt"] = current["lastCheckedAt"] if outcome in {"collected", "checked_empty", "partial"} else None
        dates = [record.source_date for record in results.get(adapter_name, [])]
        current["engineNewestDate"] = max(dates, default=None)
        current["sourceNewestDate"] = max(dates, default=None) if completeness == "complete" else None
        current["newestItemPresent"] = True if dates and completeness == "complete" else None
        if adapter_name in errors:
            current["lastError"] = errors[adapter_name]
        else:
            current.pop("lastError", None)
        existing[definition["id"]] = current
    data["sources"] = list(existing.values())


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="customer-voice: %(levelname)s %(message)s")
    data = read_json(DATA_FILE)
    migrated = migrate_evidence_schema(data)
    identity_repairs = reconcile_source_identity(data)
    results: dict[str, list[EvidenceRecord]] = {}
    errors: dict[str, str] = {}
    selected_raw = os.getenv("CUSTOMER_VOICE_ADAPTERS", "").strip()
    selected_adapters = {
        item.strip().lower() for item in selected_raw.split(",") if item.strip()
    } or {name for name, _ in ADAPTERS}
    unknown_adapters = selected_adapters - {name for name, _ in ADAPTERS}
    if unknown_adapters:
        raise ValueError(f"Unknown CUSTOMER_VOICE_ADAPTERS: {', '.join(sorted(unknown_adapters))}")
    # Adapter order is a compliance boundary. Do not reorder without approval.
    for adapter_name, collector in ADAPTERS:
        if adapter_name not in selected_adapters:
            continue
        try:
            records = collector()
            results[adapter_name] = records
            LOGGER.info("%s adapter returned %d normalized records", adapter_name, len(records))
        except Exception as error:  # Every adapter must fail safe and leave the pipeline usable.
            errors[adapter_name] = f"{type(error).__name__}: {error}"
            results[adapter_name] = []
            LOGGER.exception("%s adapter failed and was skipped", adapter_name)
    added, enriched = merge_records(data, results)
    summaries_refreshed = refresh_generated_feedback_fields(data)
    out_of_scope_removed = prune_out_of_scope_labwrench_feedback(data)
    expired_reddit_records_removed = 0
    expired_reddit_feedback_removed = 0
    reddit_credentials_available = bool(
        os.getenv("REDDIT_CLIENT_ID", "").strip()
        and os.getenv("REDDIT_CLIENT_SECRET", "").strip()
    )
    if "reddit" in selected_adapters and not reddit_credentials_available:
        validation_cache = read_json(VALIDATION_CACHE_FILE) if VALIDATION_CACHE_FILE.exists() else {}
        expired_reddit_records_removed, expired_reddit_feedback_removed = (
            prune_expired_unverifiable_reddit_feedback(data, validation_cache)
        )
    update_source_registry(data, results, errors, selected_adapters)
    data["generatedAt"] = utc_now()
    data["asOfDate"] = date.today().isoformat()
    data["ingestion"] = {
        "adapterOrder": [name for name, _ in ADAPTERS],
        "selectedAdapters": [name for name, _ in ADAPTERS if name in selected_adapters],
        "sourceCredibilityWeights": SOURCE_CREDIBILITY,
        "recordsAdded": added,
        "recordsEnriched": enriched,
        "schemaFieldsMigrated": migrated,
        "sourceIdentityRepairs": identity_repairs,
        "generatedSummariesRefreshed": summaries_refreshed,
        "outOfScopeRecordsRemoved": out_of_scope_removed,
        "expiredUnverifiableRedditRecordsRemoved": expired_reddit_records_removed,
        "expiredUnverifiableRedditFeedbackRemoved": expired_reddit_feedback_removed,
        "adapterRecordCounts": {name: len(records) for name, records in results.items()},
        "skippedAdapterErrors": errors,
        "completedAt": utc_now(),
    }
    write_json(DATA_FILE, data)
    print(f"Customer-voice ingestion completed: {added} new URLs, {enriched} enriched fields, {len(errors)} skipped adapter errors.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
