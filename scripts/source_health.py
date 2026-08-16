#!/usr/bin/env python3
"""Canonical per-source refresh health contract and aggregate freshness gate."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any


STATES = {"CURRENT", "STALE", "PARTIAL", "MISSING", "UNVERIFIED", "DISABLED", "BLOCKED", "ERROR"}
OUTCOMES = {
    "collected", "checked_empty", "disabled", "skipped_missing_credentials",
    "blocked_by_policy", "unreachable", "partial", "stale", "error",
}
NON_CURRENT_OUTCOMES = OUTCOMES - {"collected", "checked_empty"}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


@dataclass(slots=True)
class SourceHealth:
    sourceId: str
    url: str
    required: bool
    collectionMethod: str
    collectionOutcome: str
    attemptedAt: str
    succeededAt: str | None = None
    engineNewestDate: str | None = None
    sourceNewestDate: str | None = None
    engineNewestTitle: str | None = None
    engineNewestUrl: str | None = None
    sourceNewestTitle: str | None = None
    sourceNewestUrl: str | None = None
    lagDays: int | None = None
    newestItemPresent: bool | None = None
    recordsSeen: int = 0
    recordsIngested: int = 0
    completeness: str = "unverified"
    coverage: str = "unverified"
    reason: str = ""
    state: str = "UNVERIFIED"

    def __post_init__(self) -> None:
        if self.collectionOutcome not in OUTCOMES:
            raise ValueError(f"unsupported collection outcome: {self.collectionOutcome}")
        source_newest = _date(self.sourceNewestDate)
        engine_newest = _date(self.engineNewestDate)
        if source_newest and engine_newest:
            self.lagDays = max(0, (source_newest - engine_newest).days)
            self.newestItemPresent = engine_newest >= source_newest
        if self.sourceNewestUrl and self.engineNewestUrl:
            self.newestItemPresent = self.sourceNewestUrl.rstrip("/") == self.engineNewestUrl.rstrip("/")
        if self.collectionOutcome == "disabled":
            self.state = "DISABLED"
        elif self.collectionOutcome == "skipped_missing_credentials":
            self.state = "UNVERIFIED"
        elif self.collectionOutcome == "blocked_by_policy":
            self.state = "BLOCKED"
        elif self.collectionOutcome in {"unreachable", "error"}:
            self.state = "ERROR"
        elif self.recordsSeen > 0 and self.recordsIngested == 0:
            self.state = "MISSING"
        elif self.collectionOutcome == "stale" or (self.lagDays or 0) > 0:
            self.state = "STALE"
        elif self.collectionOutcome == "partial" or self.completeness == "partial" or self.newestItemPresent is False:
            self.state = "PARTIAL"
        elif self.collectionOutcome == "checked_empty":
            self.state = "CURRENT" if self.coverage == "complete" and self.completeness == "complete" else "UNVERIFIED"
        elif self.collectionOutcome == "collected":
            self.state = "CURRENT" if self.completeness == "complete" and self.coverage == "complete" and self.newestItemPresent is True else "PARTIAL"
        if self.state not in STATES:
            raise ValueError(f"unsupported source state: {self.state}")

    def to_dict(self) -> dict[str, Any]:
        row = asdict(self)
        source_id = self.sourceId.lower()
        method = self.collectionMethod.lower()
        if source_id.startswith("conference-"):
            source_type = "conference"
        elif any(token in source_id for token in ("usp-", "ich-", "fda-")):
            source_type = "regulatory"
        elif "sec" in source_id:
            source_type = "sec_filing"
        elif "pubmed" in source_id or "journal" in source_id or "analytical" in source_id or source_id in {"jasms", "talanta"}:
            source_type = "publication_index"
        elif any(token in source_id for token in ("reddit", "chromforum", "labwrench", "selectscience")):
            source_type = "customer_voice"
        elif any(token in method for token in ("sitemap", "news", "feed", "press")):
            source_type = "competitor_official"
        else:
            source_type = "public_source"
        cadence = "weekly" if source_type in {"conference", "regulatory"} else "daily"
        noncurrent = self.state if self.state in {"BLOCKED", "UNREACHABLE", "ERROR", "DISABLED", "UNVERIFIED"} else "PARTIAL"
        completeness_status = "CURRENT" if self.completeness == "complete" else noncurrent
        coverage_status = "CURRENT" if self.coverage == "complete" else noncurrent
        if self.state == "BLOCKED":
            reachability_status, policy_status = "BLOCKED", "BLOCKED"
        elif self.state == "ERROR":
            reachability_status, policy_status = "UNREACHABLE", "CURRENT"
        elif self.state == "DISABLED":
            reachability_status, policy_status = "DISABLED", "DISABLED"
        elif self.succeededAt:
            reachability_status, policy_status = "CURRENT", "CURRENT"
        else:
            reachability_status, policy_status = "UNVERIFIED", "UNVERIFIED"
        row.update({
            "sourceName": self.sourceId.replace("-", " ").title(),
            "sourceType": source_type,
            "baseUrl": self.url,
            "method": self.collectionMethod,
            "cadence": cadence,
            "sourceCount": self.recordsSeen,
            "engineCount": self.recordsIngested,
            "estimatedMissingCount": max(0, self.recordsSeen - self.recordsIngested),
            "freshnessStatus": self.state,
            "completenessStatus": completeness_status,
            "coverageStatus": coverage_status,
            "reachabilityStatus": reachability_status,
            "policyStatus": policy_status,
            "errorCode": self.collectionOutcome if self.state in {"BLOCKED", "ERROR", "UNVERIFIED", "DISABLED"} else None,
            "errorMessage": self.reason if self.state in {"BLOCKED", "ERROR", "UNVERIFIED", "DISABLED"} else None,
            "nextRetryAt": None,
        })
        return row


def write_ledger(path: Path, sources: list[SourceHealth], *, build_published_at: str | None = None) -> dict[str, Any]:
    rows = [source.to_dict() for source in sources]
    blockers = [row for row in rows if row["required"] and row["state"] != "CURRENT"]
    value = {
        "schemaVersion": 2,
        "generatedAt": utc_now(),
        "buildPublishedAt": build_published_at,
        "sourcesVerifiedAt": utc_now() if not blockers else None,
        "allRequiredSourcesCurrent": not blockers,
        "requiredSourceBlockers": [row["sourceId"] for row in blockers],
        "countsByState": {state: sum(row["state"] == state for row in rows) for state in sorted(STATES)},
        "sources": rows,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)
    return value


def migrate_legacy_source(source: dict[str, Any], attempted_at: str | None = None) -> SourceHealth:
    """Backfill old source-registry rows without pretending they were verified."""
    old = str(source.get("status") or source.get("collectionStatus") or "").lower()
    declared_outcome = str(source.get("collectionOutcome") or "").lower()
    if declared_outcome in OUTCOMES:
        outcome = declared_outcome
    else:
        outcome = {
        "collected": "collected",
        "checked_empty": "checked_empty",
        "checked_no_new_records": "checked_empty",
        "disabled": "disabled",
        "skipped_missing_credentials": "skipped_missing_credentials",
        "blocked_by_policy": "blocked_by_policy",
        "blocked": "blocked_by_policy",
        "partial": "partial",
        "error_skipped": "error",
        }.get(old, "partial")
    succeeded_at = str(source.get("lastCheckedAt") or source.get("lastChecked") or "") or None
    if outcome in {"skipped_missing_credentials", "disabled", "blocked_by_policy", "unreachable", "error"}:
        succeeded_at = None
    return SourceHealth(
        sourceId=str(source.get("id") or source.get("sourceId") or "unknown-source"),
        url=str(source.get("url") or source.get("homepage") or ""),
        required=bool(source.get("required", False)),
        collectionMethod=str(source.get("fetchMethod") or "legacy_registry_migration"),
        collectionOutcome=outcome,
        attemptedAt=str(source.get("lastCheckedAt") or source.get("lastChecked") or attempted_at or utc_now()),
        succeededAt=succeeded_at,
        engineNewestDate=source.get("engineNewestDate"),
        sourceNewestDate=source.get("sourceNewestDate"),
        engineNewestTitle=source.get("engineNewestTitle"),
        engineNewestUrl=source.get("engineNewestUrl"),
        sourceNewestTitle=source.get("sourceNewestTitle"),
        sourceNewestUrl=source.get("sourceNewestUrl"),
        recordsSeen=int(source.get("recordsSeen") or source.get("extractedRecords") or source.get("recordsCollected") or 0),
        recordsIngested=int(source.get("recordsIngested") or source.get("extractedRecords") or source.get("recordsCollected") or 0),
        completeness=str(source.get("completeness") or "unverified"),
        coverage=str(source.get("coverageState") or "unverified"),
        reason=str(source.get("reason") or source.get("issue") or source.get("lastError") or "Migrated from legacy source status; item-level freshness not yet verified."),
    )
