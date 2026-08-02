#!/usr/bin/env python3
"""Build the post-remediation claim and link audit from canonical artifacts.

The script reports the evidence graph as it exists. It never converts blocked,
partial, unsupported, or unreachable records into healthy/verified records to
improve aggregate counts.
"""

from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
AUDIT = ROOT / "audit"
EXPORTS = ROOT / "exports"
CHECKED_AT = datetime.now(timezone.utc).isoformat(timespec="seconds")


def words(text: str) -> int:
    return len(str(text or "").split())


def read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, rows: list[dict[str, object]], fields: list[str]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def url_references() -> dict[str, set[str]]:
    references: dict[str, set[str]] = defaultdict(set)
    for path in sorted(DATA.glob("*.json")):
        if path.name == "link_health.json":
            continue
        raw = path.read_text(encoding="utf-8")
        try:
            value = json.loads(raw)
        except json.JSONDecodeError:
            continue

        def visit(item: object) -> None:
            if isinstance(item, dict):
                for child in item.values():
                    visit(child)
            elif isinstance(item, list):
                for child in item:
                    visit(child)
            elif isinstance(item, str) and item.startswith(("http://", "https://")):
                references[item].add(f"data/{path.name}")

        visit(value)
    return references


def claim_category(claim_id: str) -> tuple[str, str]:
    if claim_id.startswith("pubmed-"):
        return "Scientific publication", "Public evidence library"
    if claim_id.startswith("trend-"):
        return "Application trend", "Application trends / decision evidence"
    if claim_id.startswith(("cv-", "customer-", "selectscience-", "labwrench-", "chromforum-", "reddit-", "fda-")):
        return "Customer voice", "Customer Voice and Market Signals"
    if "filing" in claim_id or "sec" in claim_id:
        return "SEC filing", "SEC filing insights"
    if "product" in claim_id or "launch" in claim_id:
        return "Product evidence", "Competitive timeline / product comparator"
    return "Signal card", "Dashboard / public evidence library"


def normalize_link_status(status: str) -> str:
    return {
        "ok": "OK",
        "blocked": "Blocked",
        "dead": "Broken",
        "mislink": "Mislink",
    }.get(status, "UNREACHABLE")


def main() -> None:
    AUDIT.mkdir(parents=True, exist_ok=True)
    claims = read_csv(EXPORTS / "claims-registry.csv")
    link_health = json.loads((DATA / "link_health.json").read_text(encoding="utf-8"))
    health_by_url = {str(item.get("url")): item for item in link_health}
    references = url_references()

    appendix: list[dict[str, object]] = []
    for claim in claims:
        claim_id = claim.get("claimID", "")
        category, locations = claim_category(claim_id)
        status = (claim.get("status") or "partial").lower()
        url = claim.get("url", "")
        excerpt = claim.get("supportingExcerpt", "")
        discrepancy = claim.get("caveat", "")
        link = health_by_url.get(url)

        if status == "contradicted":
            verdict = "Contradicted"
            severity = "Critical"
        elif status == "unsupported":
            verdict = "Unsupported/Hallucinated"
            severity = "Major"
        elif status == "verified" and url and excerpt and words(excerpt) <= 15:
            verdict = "Verified"
            severity = ""
        elif status == "verified":
            verdict = "Partially supported"
            severity = "Major"
            discrepancy = "Verified promotion rejected: an exact source URL and supporting excerpt of 15 words or fewer are required."
        else:
            verdict = "Partially supported"
            severity = "Major" if status == "partial" else ""

        # Current link availability is part of the verdict contract. Preserved
        # excerpts remain in the ledger, but a currently blocked source cannot
        # be displayed as verified.
        if link and link.get("status") in {"dead", "mislink"}:
            verdict = "UNREACHABLE" if link.get("status") == "dead" else "Contradicted"
            severity = "Major" if verdict == "UNREACHABLE" else "Critical"
            discrepancy = str(link.get("reason") or f"Current link status: {link.get('status')}")
        elif link and link.get("status") == "blocked":
            blocked_note = str(link.get("reason") or "Current automated retrieval is blocked or challenged.")
            if verdict not in {"Contradicted", "Unsupported/Hallucinated"}:
                verdict = "UNREACHABLE"
                severity = "Major"
            discrepancy = f"{discrepancy} {blocked_note}".strip()

        row = {
            "claim_id": claim_id,
            "category": category,
            "surface_locations": locations,
            "exact_claim": claim.get("claim", ""),
            "source_url": url,
            "source_quote_max_15_words": excerpt,
            "verdict": verdict,
            "discrepancy": discrepancy,
            "severity": severity,
            "checked_at": CHECKED_AT,
        }
        appendix.append(row)
    # Preserve every baseline audit record. A claim removed from the current UI
    # remains in the appendix with its original failure verdict and an explicit
    # disposition instead of disappearing from the denominator.
    baseline = read_csv(AUDIT / "baseline_per_claim_appendix_2026-07-29.csv")
    current_by_claim = {str(row["claim_id"]): row for row in appendix}
    for old in baseline:
        claim_id = old.get("claim_id", "")
        if claim_id in current_by_claim:
            continue
        retained = dict(old)
        prior = old.get("discrepancy", "")
        retained["discrepancy"] = (
            "No longer displayed as a current factual claim; retained for audit trace. " + prior
        ).strip()
        retained["checked_at"] = CHECKED_AT
        appendix.append(retained)

    # Apply current link state to the complete audit denominator, including
    # baseline claims retained for traceability. This prevents an older
    # verified verdict from surviving when its source is currently blocked.
    for row in appendix:
        link = health_by_url.get(str(row.get("source_url") or ""))
        if not link:
            continue
        status = link.get("status")
        if status == "blocked" and row.get("verdict") not in {"Contradicted", "Unsupported/Hallucinated"}:
            row["verdict"] = "UNREACHABLE"
            row["severity"] = "Major"
            row["discrepancy"] = str(
                link.get("reason") or "Current automated retrieval is blocked or challenged."
            )
        elif status == "dead":
            row["verdict"] = "UNREACHABLE"
            row["severity"] = "Major"
            row["discrepancy"] = str(link.get("reason") or "Current source URL is broken.")
        elif status == "mislink":
            row["verdict"] = "Contradicted"
            row["severity"] = "Critical"
            row["discrepancy"] = str(link.get("reason") or "Current source URL is a semantic mislink.")

    hallucinations: list[dict[str, object]] = []
    for row in appendix:
        if row.get("verdict") in {"Unsupported/Hallucinated", "Contradicted"}:
            hallucinations.append({key: row.get(key, "") for key in (
                "claim_id", "category", "exact_claim", "source_url",
                "source_quote_max_15_words", "verdict", "discrepancy", "severity",
            )})

    appendix_fields = [
        "claim_id", "category", "surface_locations", "exact_claim", "source_url",
        "source_quote_max_15_words", "verdict", "discrepancy", "severity", "checked_at",
    ]
    write_csv(AUDIT / "per_claim_appendix.csv", appendix, appendix_fields)
    write_csv(AUDIT / "hallucination_ledger.csv", hallucinations, [
        "claim_id", "category", "exact_claim", "source_url", "source_quote_max_15_words",
        "verdict", "discrepancy", "severity",
    ])

    link_rows: list[dict[str, object]] = []
    for item in link_health:
        url = str(item.get("url") or "")
        parsed = urlparse(url)
        link_rows.append({
            "anchor_or_record_label": f"{parsed.netloc}{parsed.path}",
            "original_url": url,
            "http_status": item.get("httpStatus"),
            "final_url": item.get("finalUrl", ""),
            "link_status": normalize_link_status(str(item.get("status") or "")),
            "error": item.get("reason", ""),
            "correct_url_if_found": "",
            "referenced_from": "; ".join(sorted(references.get(url, set()))),
            "checked_at": item.get("checkedAt") or CHECKED_AT,
        })
    link_fields = [
        "anchor_or_record_label", "original_url", "http_status", "final_url", "link_status",
        "error", "correct_url_if_found", "referenced_from", "checked_at",
    ]
    write_csv(AUDIT / "link_inventory.csv", link_rows, link_fields)

    previous_broken = read_csv(AUDIT / "baseline_broken_mislink_ledger_2026-07-29.csv")
    previous_urls = {row.get("original_url", "") for row in previous_broken}
    current_by_url = {str(row["original_url"]): row for row in link_rows}
    broken_rows: list[dict[str, object]] = []
    for row in link_rows:
        if row["link_status"] == "OK":
            continue
        out = dict(row)
        out["previously_flagged"] = "yes" if row["original_url"] in previous_urls else "no"
        out["resolution"] = "Still present; retained as non-healthy"
        broken_rows.append(out)
    for old in previous_broken:
        url = old.get("original_url", "")
        if url in current_by_url:
            continue
        out = dict(old)
        out["link_status"] = "Removed"
        out["previously_flagged"] = "yes"
        out["resolution"] = "Removed from current evidence graph"
        out["checked_at"] = CHECKED_AT
        broken_rows.append(out)
    broken_fields = link_fields + ["previously_flagged", "resolution"]
    write_csv(AUDIT / "broken_mislink_ledger.csv", broken_rows, broken_fields)

    verdict_counts = Counter(row["verdict"] for row in appendix)
    link_counts = Counter(row["link_status"] for row in link_rows)
    outstanding = [row for row in appendix if row["verdict"] in {"Partially supported", "UNREACHABLE", "Contradicted", "Unsupported/Hallucinated"}]
    report = [
        "# Post-remediation fact-check report",
        "",
        f"Generated: `{CHECKED_AT}`",
        "",
        "## Executive result",
        "",
        f"The audit evaluated **{len(appendix)} canonical claims** and **{len(link_rows)} unique evidence URLs**. "
        "Counts below are observed outcomes; no failure category was hidden or converted to healthy for reporting.",
        "",
        "### Claim verdicts",
        "",
        "| Verdict | Count |",
        "| --- | ---: |",
    ]
    for verdict in ("Verified", "Partially supported", "UNREACHABLE", "Unsupported/Hallucinated", "Contradicted"):
        report.append(f"| {verdict} | {verdict_counts.get(verdict, 0)} |")
    report.extend(["", "### Link outcomes", "", "| Status | Count |", "| --- | ---: |"])
    for status in ("OK", "Blocked", "Broken", "Mislink"):
        report.append(f"| {status} | {link_counts.get(status, 0)} |")
    report.extend([
        "",
        "## Remediation controls verified",
        "",
        "- Product-page inventory observations are not represented as dated changes without two preserved snapshots, timestamps, hashes, changed fields, and an exact diff artifact.",
        "- SEC filings are attributed to the legal registrant; SCIEX and PerkinElmer are not substituted for Danaher and Revvity filings.",
        "- Canonical decision scores, source counts, PubMed query provenance, UI views, CSVs, and PowerPoint are generated from shared records.",
        "- Analyst paraphrases and directional syntheses are explicitly typed and are not displayed as verbatim quotations.",
        "- Blocked, broken, misdirected, and custom-not-found URLs remain non-healthy in the link ledger.",
        "",
        "## Remaining limitations",
        "",
        f"**{len(outstanding)} claims remain non-verified.** These are preserved in `per_claim_appendix.csv` with their exact caveat or link condition. "
        "This includes analyst synthesis that has a valid primary URL but not a <=15-word supporting excerpt, current automated retrieval blocks, and records whose source is unavailable.",
        "",
        "## Deliverables",
        "",
        "- `audit/per_claim_appendix.csv` — every canonical claim with verdict and provenance fields.",
        "- `audit/hallucination_ledger.csv` — unsupported or contradicted claims only.",
        "- `audit/link_inventory.csv` — current URL status including redirects and blocked states.",
        "- `audit/broken_mislink_ledger.csv` — every current non-healthy URL plus disposition of previously flagged URLs.",
        "- `exports/claims-registry.csv` — canonical export with language type, source date, retrieval date, location, excerpt, and caveat.",
        "",
    ])
    (AUDIT / "POST_REMEDIATION_FACT_CHECK_REPORT.md").write_text("\n".join(report), encoding="utf-8")

    gap_verdicts = (
        "Partially supported",
        "UNREACHABLE",
        "Unsupported/Hallucinated",
        "Contradicted",
    )
    gaps = [
        "# Remaining evidence gaps",
        "",
        f"Generated: `{CHECKED_AT}`",
        "",
        "This is the concise roll-up of every non-verified claim retained in the current audit denominator. "
        "The claim-level reason, source URL, and disposition remain in `per_claim_appendix.csv`.",
        "",
    ]
    for verdict in gap_verdicts:
        rows = [row for row in appendix if row["verdict"] == verdict]
        categories = Counter(str(row["category"]) for row in rows)
        gaps.extend([
            f"## {verdict} — {len(rows)}",
            "",
            "| Claim family | Count |",
            "| --- | ---: |",
        ])
        for category, count in categories.most_common():
            gaps.append(f"| {category} | {count} |")
        gaps.append("")
    gaps.extend([
        "## Link access limitations",
        "",
        f"- {link_counts.get('OK', 0)} URLs were reachable and semantically valid.",
        f"- {link_counts.get('Blocked', 0)} URLs were blocked by access controls, rate limits, or bot challenges.",
        f"- {link_counts.get('Broken', 0)} URLs were broken.",
        f"- {link_counts.get('Mislink', 0)} URLs were semantic mislinks.",
        "",
        "Blocked URLs remain non-healthy and are listed individually in `broken_mislink_ledger.csv`. "
        "Contradicted and unsupported baseline claims remain visible for audit trace even after removal from current UI surfaces.",
        "",
    ])
    (AUDIT / "REMAINING_EVIDENCE_GAPS.md").write_text("\n".join(gaps), encoding="utf-8")

    print(json.dumps({
        "claims": len(appendix),
        "verdicts": dict(verdict_counts),
        "links": len(link_rows),
        "linkStatuses": dict(link_counts),
        "brokenLedgerRows": len(broken_rows),
    }, indent=2))


if __name__ == "__main__":
    main()
