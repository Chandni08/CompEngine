"""Shared provenance and scoring helpers for the competitive-intelligence pipeline.

The helpers in this module intentionally contain no UI logic.  Collectors, the daily
refresh, CSV generation, and the PowerPoint export consume the same persisted objects.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
import hashlib
import json
from typing import Any, Iterable
from urllib.parse import urlencode


LANGUAGE_TYPES = {"verbatim_quote", "analyst_paraphrase", "directional_synthesis"}
DATE_TYPES = {"publication", "launch", "filing", "effective", "ingestion", "retrieval"}
EVIDENCE_STATUSES = {
    "verified",
    "partial",
    "contradicted",
    "unsupported",
    "unreachable",
}

SOURCE_AUTHORITY_POINTS = {
    "government_or_regulatory": 3,
    "peer_reviewed_article": 3,
    "official_press_release": 3,
    "official_product_page": 3,
    "independent_trade_press": 2,
    "analyst_report": 2,
    "community_or_aggregator": 1,
}
CLAIM_SUPPORT_POINTS = {
    "direct": 3,
    "supporting": 2,
    "contextual": 1,
}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def stable_hash(value: Any) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def pubmed_query_url(query: str, start: date, end: date) -> str:
    term = f'({query}) AND ("{start:%Y/%m/%d}"[Date - Publication] : "{end:%Y/%m/%d}"[Date - Publication])'
    return "https://pubmed.ncbi.nlm.nih.gov/?" + urlencode({"term": term})


def pubmed_esearch_url(query: str, start: date, end: date, *, retmax: int = 0) -> str:
    term = f'({query}) AND ("{start:%Y/%m/%d}"[Date - Publication] : "{end:%Y/%m/%d}"[Date - Publication])'
    return "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?" + urlencode(
        {"db": "pubmed", "term": term, "retmode": "json", "retmax": retmax}
    )


def pubmed_provenance(query: str, start: date, end: date, count: int, *, retrieved_at: str | None = None) -> dict[str, Any]:
    retrieved_at = retrieved_at or utc_now()
    query_payload = {
        "database": "pubmed",
        "query": query,
        "startDate": start.isoformat(),
        "endDate": end.isoformat(),
        "dateField": "Date - Publication",
        "rangeInclusive": True,
        "queryVersion": 1,
    }
    query_hash = stable_hash(query_payload)
    observation_payload = {
        "queryHash": query_hash,
        "retrievedAt": retrieved_at,
        "retrievedCount": int(count),
    }
    return {
        **query_payload,
        "queryHash": query_hash,
        "observationID": stable_hash(observation_payload),
        "retrievedAt": retrieved_at,
        "retrievedCount": int(count),
        "resultsUrl": pubmed_query_url(query, start, end),
        "apiUrl": pubmed_esearch_url(query, start, end),
    }


def valid_change_evidence(value: Any) -> bool:
    if not isinstance(value, dict):
        return False
    required = {
        "canonicalUrl",
        "previousObservedAt",
        "currentObservedAt",
        "previousContentHash",
        "currentContentHash",
        "changedFields",
        "exactDiff",
        "diffArtifact",
    }
    if not required.issubset(value):
        return False
    if value["previousContentHash"] == value["currentContentHash"]:
        return False
    return bool(value.get("changedFields") and value.get("exactDiff"))


def canonical_claim(
    *,
    claim_id: str,
    text: str,
    status: str,
    language_type: str,
    url: str,
    retrieval_date: str,
    source_date: str | None = None,
    source_date_type: str = "publication",
    caveat: str = "",
    source_location: str = "",
) -> dict[str, Any]:
    if status not in EVIDENCE_STATUSES:
        raise ValueError(f"Unsupported evidence status: {status}")
    if language_type not in LANGUAGE_TYPES:
        raise ValueError(f"Unsupported language type: {language_type}")
    if source_date_type not in DATE_TYPES:
        raise ValueError(f"Unsupported date type: {source_date_type}")
    return {
        "claimID": claim_id,
        "claim": text,
        "status": status,
        "languageType": language_type,
        "url": url,
        "retrievalDate": retrieval_date,
        "sourceDate": source_date,
        "sourceDateType": source_date_type,
        "sourceLocation": source_location,
        "caveat": caveat,
    }


def compute_decision_score(inputs: dict[str, int]) -> dict[str, Any]:
    """Return a documented, deterministic 100-point evidence-priority score.

    The score ranks where validation attention is warranted; it is not a market-size,
    superiority, or internal-roadmap score.
    """
    weights = {
        "applicationTrend": 20,
        "competitorActivity": 20,
        "customerEvidence": 20,
        "decisionRelevance": 20,
        "sourceQuality": 10,
        "recency": 10,
    }
    normalized = {
        key: max(0, min(weight, int(inputs.get(key, 0))))
        for key, weight in weights.items()
    }
    return {
        "scoreType": "evidence_priority",
        "formulaVersion": 2,
        "formula": "sum(applicationTrend, competitorActivity, customerEvidence, decisionRelevance, sourceQuality, recency)",
        "componentMaximums": weights,
        "inputs": normalized,
        "score": sum(normalized.values()),
        "calculatedAt": utc_now(),
        "caveat": "Ranks public-evidence attention; it does not measure market size, product superiority, or an internal Waters roadmap.",
    }


def assess_source_quality(sources: Iterable[dict[str, Any]]) -> dict[str, Any]:
    """Score the quality of a decision's evidence set on a transparent 10-point rubric.

    Source volume is deliberately not a dimension. Duplicate URLs are discarded, and
    corroboration is based on independent source families rather than record count.
    """
    unique_sources: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    for source in sources:
        url = str(source.get("url") or source.get("sourceUrl") or "").strip()
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        unique_sources.append(source)

    if not unique_sources:
        return {
            "rubricVersion": 1,
            "score": 0,
            "sourceCount": 0,
            "independentFamilies": 0,
            "dimensions": {
                "authority": {"score": 0, "max": 3},
                "directness": {"score": 0, "max": 3},
                "corroboration": {"score": 0, "max": 2},
                "evidenceStatus": {"score": 0, "max": 2},
            },
            "limitations": ["No quality-annotated decision sources are available."],
        }

    def rounded_average(values: list[int]) -> int:
        return int((sum(values) / len(values)) + 0.5) if values else 0

    authority = rounded_average([
        SOURCE_AUTHORITY_POINTS.get(str(source.get("sourceType") or ""), 0)
        for source in unique_sources
    ])
    directness = rounded_average([
        CLAIM_SUPPORT_POINTS.get(str(source.get("claimSupport") or ""), 0)
        for source in unique_sources
    ])

    families = {
        str(source.get("independenceGroup") or "").strip()
        for source in unique_sources
        if str(source.get("independenceGroup") or "").strip()
    }
    corroboration = 1 if len(families) >= 2 else 0
    if corroboration and any(source.get("sourceControl") == "independent" for source in unique_sources):
        corroboration = 2

    statuses = {str(source.get("evidenceStatus") or "") for source in unique_sources}
    if statuses == {"verified"}:
        evidence_status = 2
    elif statuses and statuses.issubset({"verified", "partial"}):
        evidence_status = 1
    else:
        evidence_status = 0

    dimensions = {
        "authority": {"score": authority, "max": 3},
        "directness": {"score": directness, "max": 3},
        "corroboration": {"score": corroboration, "max": 2},
        "evidenceStatus": {"score": evidence_status, "max": 2},
    }
    limitations = []
    if authority < 3:
        limitations.append("At least one source is not a top-tier primary or peer-reviewed source.")
    if directness < 3:
        limitations.append("At least one source supports the decision only indirectly.")
    if corroboration == 0:
        limitations.append("The evidence does not span two independent source families.")
    elif corroboration == 1:
        limitations.append("Multiple issuer-controlled sources are present, but neutral external corroboration is absent.")
    if evidence_status == 1:
        limitations.append("At least one mapped claim is only partially verified.")
    elif evidence_status == 0:
        limitations.append("At least one source is unverified, unsupported, contradicted, or missing status metadata.")

    return {
        "rubricVersion": 1,
        "score": sum(dimension["score"] for dimension in dimensions.values()),
        "sourceCount": len(unique_sources),
        "independentFamilies": len(families),
        "dimensions": dimensions,
        "limitations": limitations,
    }


def unique_urls(items: Iterable[dict[str, Any]]) -> list[str]:
    return sorted({str(item.get("url") or item.get("sourceUrl") or "") for item in items if item.get("url") or item.get("sourceUrl")})
