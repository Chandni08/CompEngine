#!/usr/bin/env python3
"""Build a factual post-remediation audit from the source-health ledger."""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LEDGER = ROOT / "data" / "source_health.json"
OUTPUT = ROOT / f"POST_FIX_DATA_FRESHNESS_AUDIT_{date.today().isoformat()}.md"


def value(item: object) -> str:
    if item is None or item == "":
        return "—"
    return str(item).replace("|", "\\|").replace("\n", " ")


def main() -> int:
    data = json.loads(LEDGER.read_text(encoding="utf-8"))
    groups: dict[str, list[dict]] = defaultdict(list)
    for source in data.get("sources", []):
        groups[str(source.get("state") or "UNVERIFIED")].append(source)

    lines = [
        "# Post-fix data freshness audit",
        "",
        f"**Generated:** {value(data.get('generatedAt'))}",
        f"**All required sources current:** {'Yes' if data.get('allRequiredSourcesCurrent') else 'No'}",
        f"**Sources verified at:** {value(data.get('sourcesVerifiedAt'))}",
        f"**Required blockers:** {', '.join(data.get('requiredSourceBlockers', [])) or 'None'}",
        "",
        "The table below is generated from collection outcomes and item-level high-water metadata. A source is not marked current from an HTTP response, build timestamp, sitemap timestamp, or historical records alone.",
        "",
        "| Source | Required | State | Outcome | Engine newest | Source newest | Seen / ingested | Completeness | Coverage | Reason |",
        "|---|:---:|---|---|---:|---:|---:|---|---|---|",
    ]
    order = ["CURRENT", "STALE", "PARTIAL", "MISSING", "UNVERIFIED", "DISABLED", "BLOCKED", "ERROR"]
    by_state = {state: 0 for state in order}
    for state in order:
        for source in sorted(groups.get(state, []), key=lambda item: str(item.get("sourceId"))):
            by_state[state] += 1
            lines.append(
                "| {sourceId} | {required} | {state} | {outcome} | {engine} | {source} | {seen}/{ingested} | {completeness} | {coverage} | {reason} |".format(
                    sourceId=value(source.get("sourceId")), required="Y" if source.get("required") else "N",
                    state=value(source.get("state")), outcome=value(source.get("collectionOutcome")),
                    engine=value(source.get("engineNewestDate")), source=value(source.get("sourceNewestDate")),
                    seen=value(source.get("recordsSeen", 0)), ingested=value(source.get("recordsIngested", 0)),
                    completeness=value(source.get("completeness")), coverage=value(source.get("coverage")),
                    reason=value(source.get("reason")),
                )
            )
    lines.extend(["", "## State totals", ""])
    lines.extend(f"- **{state}:** {by_state[state]}" for state in order)
    lines.extend([
        "", "## Remaining known limitations", "",
        "- PubMed item records are a representative sample even when aggregate query counts and newest-PMID checks are current; its completeness remains PARTIAL.",
        "- Public previews, login-gated communities, and mapped sources without lawful record-level access remain UNVERIFIED or BLOCKED.",
        "- Conference and regulatory pages remain PARTIAL unless actual dated content records and document metadata are extracted.",
        "- Curated/manual evidence is preserved but does not prove automated source health.",
        "", "## Original-audit remediation summary", "",
        "- Source-aware global gating, exact outcome states, build/source-verification separation, and failure retention are implemented.",
        "- PerkinElmer collection, uncapped in-window SEC filings, newest-first community traversal, individual SelectScience reviews, full-window Crossref pagination, and source-identity reconciliation are implemented.",
        "- Conference reachability is separated from content records, every configured conference is attempted, and regulatory reachability alone cannot pass content freshness.",
        "- Sources without credentials or permitted record-level access remain explicit blockers or optional coverage gaps; they are not fabricated or silently treated as empty.",
    ])
    OUTPUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(OUTPUT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
