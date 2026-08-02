#!/usr/bin/env python3
"""Assemble the 2026-08-02 adversarial current-state fact-check deliverables."""

from __future__ import annotations

import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / "audit"
DATE = "2026-08-02"
APPENDIX = AUDIT / f"current_per_claim_appendix_{DATE}.csv"
HALLUCINATIONS = AUDIT / f"current_hallucination_ledger_{DATE}.csv"
BAD_LINKS = AUDIT / f"current_broken_mislink_ledger_{DATE}.csv"
REPORT = AUDIT / f"CURRENT_FACT_CHECK_REPORT_{DATE}.md"


def load(path: str):
    return json.loads((ROOT / path).read_text())


def words15(value: str) -> str:
    return " ".join((value or "").split()[:15])


def tokens(value: str) -> set[str]:
    stop = {"the", "and", "for", "with", "from", "into", "that", "this", "using", "official", "page", "observed"}
    return {x for x in re.findall(r"[a-z0-9]+", (value or "").lower()) if len(x) > 2 and x not in stop}


def overlap(a: str, b: str) -> float:
    left = tokens(a)
    return len(left & tokens(b)) / max(1, len(left))


link_rows = load(f"audit/current_presented_link_check_{DATE}.json")
links = {row["url"]: row for row in link_rows}
pubmed_checks = load(f"audit/current_pubmed_count_check_{DATE}.json")
catalog_checks = load(f"audit/current_catalog_claim_check_{DATE}.json")
sec_checks = load(f"audit/current_sec_signal_check_{DATE}.json")

claims: list[dict] = []


def link(url: str) -> dict:
    return links.get(url, {"classification": "Broken", "httpStatus": None, "title": "", "h1": "", "reason": "URL absent from current link inventory"})


def link_quote(url: str) -> str:
    row = link(url)
    return words15(row.get("h1") or row.get("title") or "")


def add(*, family: str, claim_id: str, claim: str, source_url: str, quote: str,
        verdict: str, discrepancy: str = "", severity: str = "", surface: str = "") -> None:
    quote = words15(quote)
    if verdict == "Verified" and not quote:
        verdict = "Partially supported"
        discrepancy = discrepancy or "The source resolved, but no exact supporting passage was retained."
    claims.append({
        "claim_family": family,
        "claim_id": claim_id,
        "on_screen_text": claim,
        "source_url": source_url or "none",
        "verbatim_supporting_quote_max_15_words": quote,
        "verdict": verdict,
        "discrepancy": discrepancy,
        "severity": severity,
        "surface": surface,
    })


# 1. Canonical claim registry: all signal cards, customer voice, five trend cards, and five filing insights.
registry = list(csv.DictReader((ROOT / "exports" / "claims-registry.csv").open()))
trend_checks_1y = {row["name"]: row for row in pubmed_checks if row["family"] == "theme" and row["horizon"] == "1y"}
trend_by_id = {
    "trend-lnp-rna": "LNP and RNA therapeutics workflows",
    "trend-oligos": "Oligonucleotide and nucleic-acid analytics",
    "trend-pfas": "PFAS and environmental contaminant testing",
    "trend-proteomics": "High-resolution proteomics and metabolomics",
    "trend-automation": "Lab automation and software-enabled workflows",
}
for row in registry:
    cid, text, url = row["claimID"], row["claim"], row["url"]
    current_link = link(url)
    if cid in trend_by_id:
        check = trend_checks_1y[trend_by_id[cid]]
        add(family="Signal / filing / customer-voice registry", claim_id=cid, claim=text,
            source_url=check["apiUrl"], quote=f"<Count>{check['rerunCount']}</Count>",
            verdict="Verified" if check["matches"] else "Partially supported",
            discrepancy="" if check["matches"] else f"Stored {check['storedCount']}; fresh exact-query result {check['rerunCount']}.",
            severity="Major" if not check["matches"] else "", surface="All role views; Leadership brief")
        continue
    if cid.startswith("sec-"):
        sec = next((x for x in sec_checks if x["id"] == cid), None)
        add(family="Signal / filing / customer-voice registry", claim_id=cid, claim=text, source_url=url,
            quote=(sec or {}).get("sourceQuote", ""), verdict=(sec or {}).get("verdict", "UNREACHABLE"),
            discrepancy=(sec or {}).get("discrepancy", "SEC source could not be fetched."),
            surface="Competitor Intent / SEC signals")
        continue
    if current_link["classification"] != "OK":
        add(family="Signal / filing / customer-voice registry", claim_id=cid, claim=text, source_url=url,
            quote="", verdict="UNREACHABLE",
            discrepancy=f"Strict link result: {current_link.get('reason') or current_link.get('httpStatus')}.",
            surface="All role views")
        continue
    if row["languageType"] == "verbatim_quote" and row["supportingExcerpt"]:
        verdict, quote, discrepancy = "Verified", row["supportingExcerpt"], ""
    elif row["status"] == "verified" and row["supportingExcerpt"]:
        verdict, quote, discrepancy = "Verified", row["supportingExcerpt"], ""
    elif row["status"] == "unsupported" and text.endswith("official product page observed"):
        verdict, quote, discrepancy = "Verified", link_quote(url), "Page presence is supported; the legacy claim ID still misleadingly says 'added'."
    else:
        destination = f"{current_link.get('title', '')} {current_link.get('h1', '')}"
        if destination and overlap(text, destination) >= 0.60:
            verdict, quote, discrepancy = "Verified", destination, ""
        else:
            verdict, quote, discrepancy = "Partially supported", destination, row["caveat"] or "The page resolves, but the exact claim was not located in retained evidence."
    add(family="Signal / filing / customer-voice registry", claim_id=cid, claim=text, source_url=url,
        quote=quote, verdict=verdict, discrepancy=discrepancy, surface="All role views / evidence export")


# 2. Remaining exact PubMed count observations (the five 1y theme claims are above).
for row in pubmed_checks:
    if row["family"] == "theme" and row["horizon"] == "1y":
        continue
    text = f"{row['name']} has {row['storedCount']} PubMed records in the {row['horizon']} window"
    add(family="Publication count", claim_id=f"pubmed-{row['family']}-{row['name']}-{row['horizon']}", claim=text,
        source_url=row["apiUrl"], quote=f"<Count>{row['rerunCount']}</Count>",
        verdict="Verified" if row["matches"] else "Partially supported",
        discrepancy="" if row["matches"] else f"Stored {row['storedCount']}; fresh exact-query result {row['rerunCount']}.",
        severity="Major" if not row["matches"] else "", surface="Application and publication trends")


# 3. Product launches.
launch_data = load("data/product_launches.json")["launches"]
launch_by_id = {row["id"]: row for row in launch_data}
for row in launch_data:
    url = row.get("pressReleaseUrl") or row.get("sourceUrl", "")
    claim_text = f"{row['competitor']} launched {row['product']} on {row['date']}"
    state = link(url)
    if state["classification"] != "OK":
        verdict, quote, discrepancy = "UNREACHABLE", "", f"Strict link result: {state.get('reason') or state.get('httpStatus')}."
    elif row.get("launchEvidenceEligible") is False:
        verdict, quote, discrepancy = "Unsupported / Hallucinated", link_quote(url), "The cited product page proves product presence, not the claimed launch date."
    else:
        verdict, quote, discrepancy = "Verified", link_quote(url), ""
    add(family="Competitor launch", claim_id=row["id"], claim=claim_text, source_url=url, quote=quote,
        verdict=verdict, discrepancy=discrepancy, severity="Major" if "Unsupported" in verdict else "", surface="Competitive Timeline / comparator")


# 4. Application notes.
for row in load("data/competitor_application_notes.json")["notes"]:
    url = row["sourceUrl"]
    claim_text = f"{row['competitor']} published {row['title']} ({row['dateLabel']})"
    state = link(url)
    if state["classification"] != "OK":
        verdict, quote, discrepancy = "UNREACHABLE", "", f"Strict link result: {state.get('reason') or state.get('httpStatus')}."
    else:
        destination = f"{state.get('title', '')} {state.get('h1', '')}"
        title_match = overlap(row["title"], destination) >= 0.55
        verdict = "Verified" if title_match else "Partially supported"
        quote = destination
        discrepancy = "" if title_match else "The source resolves, but the exact title/date was not exposed in retained page metadata."
    add(family="Application note", claim_id=row["id"], claim=claim_text, source_url=url, quote=quote,
        verdict=verdict, discrepancy=discrepancy, surface="Application Trends")


# 5. Conference briefs, one structured claim per event.
for row in load("data/conference_preparation.json")["events"]:
    url = row["website"]
    claim_text = f"{row['eventName']} runs {row['dateRange']} in {row['location']}"
    state = link(url)
    if state["classification"] != "OK":
        verdict, quote, discrepancy = "UNREACHABLE", "", f"Strict link result: {state.get('reason') or state.get('httpStatus')}."
    else:
        verdict, quote = "Partially supported", link_quote(url)
        discrepancy = "Event identity resolves; the exact date/location combination was not retained as a source passage."
    add(family="Conference intelligence", claim_id=row["id"], claim=claim_text, source_url=url, quote=quote,
        verdict=verdict, discrepancy=discrepancy, surface="Conference Intelligence")


# 6. Corporate-move items (distinct from the five filing-insight summary cards).
filing_data = load("data/filing_insights.json")
for company in filing_data["companyCorporateMoves"]:
    for index, row in enumerate(company["items"]):
        url = row.get("sourceUrl", "")
        claim_text = f"{company['competitor']}: {row['type']} — {row['name']} — {row['date']} — {row.get('value', '')}"
        state = link(url)
        if state["classification"] != "OK":
            verdict, quote, discrepancy = "UNREACHABLE", "", f"Strict link result: {state.get('reason') or state.get('httpStatus')}."
        else:
            verdict, quote, discrepancy = "Partially supported", link_quote(url), "The filing resolves, but no exact filing excerpt is retained for this composite claim."
        add(family="Corporate move", claim_id=f"corporate-{company['competitor']}-{index}", claim=claim_text,
            source_url=url, quote=quote, verdict=verdict, discrepancy=discrepancy, surface="SEC Filing Insights")


# 7. Historical product catalogs, using the fresh source-text verifier.
for row in catalog_checks:
    add(family="Historical product catalog", claim_id=row["id"],
        claim=f"{row['competitor']} {row['product']} introduced in {row['introducedYear']}",
        source_url=row["sourceUrl"], quote=row.get("sourceQuote", ""), verdict=row["verdict"],
        discrepancy=row.get("discrepancy", ""), surface="Historical competitor/product selectors")


# 8. Technical comparison rows.
for profile in load("data/technical_comparisons.json")["profiles"]:
    for index, row in enumerate(profile["rows"]):
        urls = [row.get("competitorSourceUrl", ""), row.get("watersSourceUrl", "")]
        url = " | ".join(x for x in urls if x)
        bad = [x for x in urls if x and link(x)["classification"] != "OK"]
        claim_text = f"{row['dimension']}: {row['competitorValue']} | Waters: {row['watersValue']}"
        if bad:
            verdict, quote, discrepancy = "UNREACHABLE", "", f"At least one required source is strictly broken: {bad[0]}."
        else:
            quote = link_quote(urls[0]) or link_quote(urls[1])
            verdict = "Partially supported"
            discrepancy = "Source identities resolve, but the exact paired values were not retained as <=15-word passages; controlled testing remains separate."
        add(family="Technical comparison", claim_id=f"{profile['launchId']}::{profile['watersId']}::{index}",
            claim=claim_text, source_url=url, quote=quote, verdict=verdict, discrepancy=discrepancy,
            surface="Product Comparator / Engineering")


# 9. Launch-comparison decision narratives.
for row in load("data/product_comparisons.json")["launchComparisons"]:
    launch = launch_by_id.get(row["launchId"], {})
    url = launch.get("pressReleaseUrl") or launch.get("sourceUrl", "")
    rationale = row.get("impactRationale") or row.get("pmRead") or row.get("watersPositioning") or "No explicit impact rationale"
    claim_text = f"{row['launchId']} threat level {row['threatLevel']}: {rationale}"
    state = link(url)
    if state["classification"] != "OK":
        verdict, quote, discrepancy = "UNREACHABLE", "", f"Strict link result: {state.get('reason') or state.get('httpStatus')}."
    else:
        verdict, quote, discrepancy = "Partially supported", link_quote(url), "The product/launch source resolves; threat level and impact are analyst judgments, not source statements."
    add(family="Launch comparison", claim_id=f"launch-comparison-{row['launchId']}", claim=claim_text,
        source_url=url, quote=quote, verdict=verdict, discrepancy=discrepancy, surface="Product Comparator")


# 10-11. Publication source cards and the exact recent rows visible after each source selection.
for source in load("data/journal_sources.json")["sources"]:
    url = source["homepage"]
    state = link(url)
    claim_text = f"{source['name']} is mapped with {source.get('extractedRecords', 0)} dated records; collection {source.get('collectionStatus', '')}"
    if state["classification"] != "OK":
        verdict, quote, discrepancy = "UNREACHABLE", "", f"Strict homepage result: {state.get('reason') or state.get('httpStatus')}."
    else:
        verdict, quote, discrepancy = "Partially supported", link_quote(url), "Homepage identity resolves; extraction count and collection state are pipeline-derived."
    add(family="Journal source", claim_id=f"journal-{source['id']}", claim=claim_text, source_url=url,
        quote=quote, verdict=verdict, discrepancy=discrepancy, surface="Publication Intelligence")
    for index, record in enumerate(source.get("recentRecords", [])[:12]):
        rurl = record["sourceUrl"]
        rstate = link(rurl)
        rtext = f"{record['title']} — {record['date']}"
        if rstate["classification"] != "OK":
            rverdict, rquote, rdisc = "UNREACHABLE", "", f"Strict link result: {rstate.get('reason') or rstate.get('httpStatus')}."
        else:
            destination = f"{rstate.get('title', '')} {rstate.get('h1', '')}"
            if overlap(record["title"], destination) >= 0.50:
                rverdict, rquote, rdisc = "Verified", destination, ""
            else:
                rverdict, rquote, rdisc = "Partially supported", destination, "URL resolves, but retained page metadata did not reproduce the exact title/date."
        add(family="Displayed publication record", claim_id=f"journal-record-{source['id']}-{index}", claim=rtext,
            source_url=rurl, quote=rquote, verdict=rverdict, discrepancy=rdisc, surface="Publication Intelligence")


# 12. Market/application source cards.
for row in load("data/market_application_sources.json")["sources"]:
    url = row["url"]
    state = link(url)
    claim_text = f"{row['name']} provides {row['signalCategory']} via {row['accessType']}"
    if state["classification"] != "OK":
        verdict, quote, discrepancy = "UNREACHABLE", "", f"Strict link result: {state.get('reason') or state.get('httpStatus')}."
    else:
        verdict, quote, discrepancy = "Partially supported", link_quote(url), "Source identity resolves; the described monitoring use is analyst-authored."
    add(family="Market/application source", claim_id=f"market-source-{row['id']}", claim=claim_text,
        source_url=url, quote=quote, verdict=verdict, discrepancy=discrepancy, surface="Application Trends / source coverage")


# 13. Source-catalog health cards, verified against the fresh strict link result.
for row in load("data/source_catalog.json")["sources"]:
    url = row["url"]
    state = link(url)
    claim_text = f"{row['source']} health={row['health']}; status={row['status']}"
    claims_good = row["health"] == "good" or row["status"] in {"verified", "current", "live"}
    link_good = state["classification"] == "OK"
    if claims_good != link_good:
        verdict = "Contradicted"
        discrepancy = f"Catalog says {row['health']}/{row['status']}; fresh strict link result is {state['classification']} ({state.get('httpStatus')})."
        severity = "Major"
    elif row["status"] in {"review", "unverified"}:
        verdict, discrepancy, severity = "Unsupported / Hallucinated", "No primary-source passage establishes the catalog's asserted health state.", "Minor"
    else:
        verdict, discrepancy, severity = "Verified", "", ""
    quote = f"HTTP {state.get('httpStatus')} — {state['classification']}"
    add(family="Source catalog health", claim_id=f"source-catalog-{row['id']}", claim=claim_text, source_url=url,
        quote=quote, verdict=verdict, discrepancy=discrepancy, severity=severity, surface="Public Evidence Library / source coverage")


# 14. Pipeline source-health records.
for row in load("data/source_health.json")["sources"]:
    url = row["url"]
    state = link(url)
    claim_text = f"{row['sourceId']} collection state is {row['state']}"
    if row["state"] == "UNVERIFIED":
        verdict, discrepancy, severity = "Unsupported / Hallucinated", row.get("reason") or "No verification was completed.", "Minor"
    elif row["state"] == "CURRENT" and state["classification"] != "OK":
        verdict, discrepancy, severity = "Contradicted", f"Pipeline says CURRENT; strict link result is {state['classification']} ({state.get('httpStatus')}).", "Major"
    elif row["state"] in {"BLOCKED", "ERROR"} and state["classification"] == "OK":
        verdict, discrepancy, severity = "Contradicted", f"Pipeline says {row['state']}; fresh strict link result is OK.", "Minor"
    elif row["state"] == "PARTIAL":
        verdict, discrepancy, severity = "Partially supported", row.get("reason", "Pipeline reports incomplete collection."), ""
    else:
        verdict, discrepancy, severity = "Verified", "", ""
    add(family="Pipeline source health", claim_id=f"source-health-{row['sourceId']}", claim=claim_text,
        source_url=url, quote=f"HTTP {state.get('httpStatus')} — {state['classification']}", verdict=verdict,
        discrepancy=discrepancy, severity=severity, surface="Refresh/source status")


# 15. Decision cards and PPTX scores. Recompute score, then apply fresh PubMed count drift.
decision_theme = {
    "decision-pfas-workflow": "PFAS and environmental contaminant testing",
    "decision-workflow-requirements": "Lab automation and software-enabled workflows",
    "decision-oligo-readiness": "Oligonucleotide and nucleic-acid analytics",
}
for row in load("data/intelligence.json")["recommendations"]:
    canonical = row["canonicalDecision"]
    score = canonical["score"]
    computed = sum(score["inputs"].values())
    check = trend_checks_1y[decision_theme[row["id"]]]
    claim_text = f"{row['title']} has evidence-priority score {row['priorityScore']}/100 and trend count {canonical['trend']['count']}"
    issues = []
    if computed != row["priorityScore"]:
        issues.append(f"Score inputs sum to {computed}, not {row['priorityScore']}.")
    if not check["matches"]:
        issues.append(f"Fresh exact-query count is {check['rerunCount']}, not {check['storedCount']}.")
    verdict = "Verified" if not issues else ("Contradicted" if computed != row["priorityScore"] else "Partially supported")
    add(family="Decision / PPTX", claim_id=row["id"], claim=claim_text, source_url=check["apiUrl"],
        quote=f"<Count>{check['rerunCount']}</Count>", verdict=verdict, discrepancy=" ".join(issues),
        severity="Critical" if verdict == "Contradicted" else "Major", surface="Decisions Needed / Leadership PPTX")


# 16. Product-system selector records.
comparators = load("data/product_comparisons.json")
for row in comparators["watersSystems"] + comparators["thirdComparators"]:
    url = row.get("sourceUrl", "")
    claim_text = f"{row['company']} {row['product']} is a {row['technology']} comparator"
    if not url:
        verdict, quote, discrepancy = "Unsupported / Hallucinated", "", "No cited source is attached to this comparator record."
    elif link(url)["classification"] != "OK":
        verdict, quote, discrepancy = "UNREACHABLE", "", f"Strict link result: {link(url).get('reason') or link(url).get('httpStatus')}."
    else:
        verdict, quote, discrepancy = "Partially supported", link_quote(url), "Source identity resolves; the full decision-role description is analyst-authored."
    add(family="Product comparator system", claim_id=f"product-system-{row['id']}", claim=claim_text,
        source_url=url, quote=quote, verdict=verdict, discrepancy=discrepancy,
        severity="Major" if "Unsupported" in verdict else "", surface="Product Comparator")


# Normalize legacy capitalization and assert the complete current inventory denominator.
for row in claims:
    if row["verdict"] == "UNREACHABLE":
        row["verdict"] = "Unreachable"
assert len(claims) == 1309, len(claims)

fields = ["claim_family", "claim_id", "on_screen_text", "source_url", "verbatim_supporting_quote_max_15_words", "verdict", "discrepancy", "severity", "surface"]
with APPENDIX.open("w", newline="", encoding="utf-8") as handle:
    writer = csv.DictWriter(handle, fieldnames=fields)
    writer.writeheader()
    writer.writerows(claims)

bad_claims = [row for row in claims if row["verdict"] in {"Contradicted", "Unsupported / Hallucinated"}]
hall_fields = ["severity", "claim_family", "claim_id", "on_screen_text", "cited_source", "what_source_actually_says", "verdict", "surface"]
with HALLUCINATIONS.open("w", newline="", encoding="utf-8") as handle:
    writer = csv.DictWriter(handle, fieldnames=hall_fields)
    writer.writeheader()
    for row in bad_claims:
        writer.writerow({
            "severity": row["severity"] or "Minor",
            "claim_family": row["claim_family"],
            "claim_id": row["claim_id"],
            "on_screen_text": row["on_screen_text"],
            "cited_source": row["source_url"],
            "what_source_actually_says": row["verbatim_supporting_quote_max_15_words"] or row["discrepancy"] or "No supporting passage located.",
            "verdict": row["verdict"],
            "surface": row["surface"],
        })

# Flatten the required broken/mislink ledger; never invent replacement URLs.
bad_link_rows = [row for row in link_rows if row["classification"] != "OK"]
bad_link_fields = ["anchor_text", "url", "http_result", "final_resolved_url", "link_status", "issue", "correct_url", "surfaces"]
with BAD_LINKS.open("w", newline="", encoding="utf-8") as handle:
    writer = csv.DictWriter(handle, fieldnames=bad_link_fields)
    writer.writeheader()
    for row in bad_link_rows:
        refs = row.get("references", [])
        anchors = sorted({ref.get("label", "") for ref in refs if ref.get("label")})
        surfaces = sorted({f"{ref.get('file', '')}:{ref.get('path', '')}" for ref in refs})
        writer.writerow({
            "anchor_text": " | ".join(anchors) or "[no retained anchor label]",
            "url": row["url"],
            "http_result": row.get("httpStatus"),
            "final_resolved_url": row.get("finalUrl", ""),
            "link_status": row["classification"],
            "issue": row.get("reason") or row.get("error") or "Strict fetch failed",
            "correct_url": "",
            "surfaces": " | ".join(surfaces),
        })

verdict_order = ["Verified", "Partially supported", "Contradicted", "Unsupported / Hallucinated", "Unreachable"]
counts = Counter(row["verdict"] for row in claims)
families = defaultdict(Counter)
for row in claims:
    families[row["claim_family"]][row["verdict"]] += 1
link_counts = Counter(row["classification"] for row in link_rows)

family_lines = []
for family in sorted(families):
    c = families[family]
    family_lines.append(f"| {family} | {sum(c.values())} | " + " | ".join(str(c[x]) for x in verdict_order) + " |")

source_catalog_contradictions = sum(1 for row in claims if row["claim_family"] == "Source catalog health" and row["verdict"] == "Contradicted")
source_health_contradictions = sum(1 for row in claims if row["claim_family"] == "Pipeline source health" and row["verdict"] == "Contradicted")
publication_record_unreachable = sum(1 for row in claims if row["claim_family"] == "Displayed publication record" and row["verdict"] == "Unreachable")
technical_unreachable = sum(1 for row in claims if row["claim_family"] == "Technical comparison" and row["verdict"] == "Unreachable")

report = f"""# Waters Next Gen LC Competitive Intelligence Engine — current accuracy & integrity audit

Audit date: `{DATE}` (America/New_York)
Application snapshot: `waters-ci-20260801170625` / public-data label `2026-08-01`
Verdict: **NO — not trustworthy enough for leadership use. The single biggest risk is that quantitative claims labeled current already disagree with fresh, identical PubMed queries while the UI suppresses the partial-refresh warning.**

## Scope and inventory method

All four role views hydrated: Leadership, Product Management, Product Marketing, and Engineering. Conference Intelligence and Publication Intelligence also hydrated. The customer-voice CSV and eight-slide PowerPoint were inspected; no required surface was skipped.

The audit unit is one structured, independently checkable claim-source record. Exact duplicates rendered across roles or exports are counted once and separately checked for consistency. Interactive alternatives (all journal selectors, product comparators, and catalog records) are included. This gives **{len(claims):,} claims**. The outbound-link inventory contains **{len(link_rows):,} distinct currently presented URLs**, including the first 12 exact publication records visible for each of 16 sources.

## Summary

| Measure | Total | Verified / OK | Partially supported | Contradicted | Unsupported / hallucinated | Unreachable / Broken | Mislink |
|---|---:|---:|---:|---:|---:|---:|---:|
| Claims | {len(claims):,} | {counts['Verified']:,} | {counts['Partially supported']:,} | {counts['Contradicted']:,} | {counts['Unsupported / Hallucinated']:,} | {counts['Unreachable']:,} | — |
| Unique presented URLs | {len(link_rows):,} | {link_counts['OK']:,} | — | — | — | {link_counts['Broken']:,} | {link_counts['Mislink']:,} |

`Broken` follows the supplied strict definition: HTTP 4xx/5xx, access/login/verification walls, soft 404s, or unresolved redirect walls. It is not softened into a separate “blocked” pass-like category.

## Verdicts by claim family

| Claim family | Total | Verified | Partial | Contradicted | Unsupported | Unreachable |
|---|---:|---:|---:|---:|---:|---:|
{chr(10).join(family_lines)}

## Adversarial findings

1. **Critical — all five leadership one-year PubMed counts drifted.** Fresh runs of the stored query, inclusive dates, and database returned: PFAS **335 vs 334**, automation **1,147 vs 1,145**, oligonucleotides **668 vs 665**, LNP/RNA **928 vs 927**, and proteomics/metabolomics **9,918 vs 9,895**. The app and deck are internally aligned to the stored snapshot, but they are no longer exact as of this audit.
2. **Critical — the currentness label overstates the refresh state.** The UI says “Real public data as of 2026-08-01.” `refresh_status.json` says `status=partial`, `allRequiredSourcesCurrent=false`, `sourcesVerifiedAt=null`, and lists **61 required-source blockers**. Source-health states are 17 CURRENT, 68 PARTIAL, 4 BLOCKED, and 1 UNVERIFIED.
3. **Critical — {link_counts['Broken']:,} of {len(link_rows):,} presented URLs fail the supplied strict link rule.** This includes HTTP 403/429 results, Reddit verification walls, 48 unresolved DOI redirect walls, soft-404 pages, and all 172 SEC filing URLs returning HTTP 429 in the focused attribution pass. These claims are Unreachable, not verified.
4. **Major — stored source-health claims do not always match a fresh strict fetch.** The source catalog has **{source_catalog_contradictions} contradicted status cards** and the pipeline source-health table has **{source_health_contradictions} contradicted records**. A “good/current” badge cannot coexist with a current strict-broken result without an explicit last-known-good label.
5. **Major — product-monitor semantics remain internally inconsistent.** The 157 current claims now say only “official product page observed,” which is supportable where the official page resolves. However, every corresponding claim ID still says `product-page-added`, and every exported status remains `unsupported`. The wording was fixed; the evidence-state schema was not.
6. **Major — publication counts are not snapshot-stable.** Across all 60 exact PubMed count checks, only 18 reproduced; 42 changed between the stored August 1 retrieval and the August 2 rerun. This is database back-index drift, but leadership slides present the numbers without an “as retrieved” qualifier.
7. **Major — historical product-year coverage remains weak.** Fresh source-text checks returned 30 Verified, 7 Partially supported, and 113 Unreachable out of 150 catalog records.
8. **Major — exact comparison proof remains incomplete.** {technical_unreachable} of 34 technical rows are Unreachable because at least one required vendor source fails strict fetch. Resolving links are still Partial unless both exact values are retained as short source passages; a page title alone does not prove a specification.
9. **Major — the current JavaScript validation suite is red.** 359 of 375 tests pass; 16 fail, including source/deploy publication parity, customer-voice grouping, responsive layout, decision fields, and Thermo IR registration. Python unit tests pass 44/44.
10. **Major — prior audit artifacts are stale and contradictory.** `POST_REMEDIATION_FACT_CHECK_REPORT.md` still reports 864 claims and 1,332 URLs and labels 473 failures “Blocked,” while the current complete inventory is {len(claims):,} claims and {len(link_rows):,} URLs under the required Broken definition. The July 29 baseline separately reports 738 claims and 890 URLs. Retire or date-gate these files.

## Quote fidelity

- No `<blockquote>` or quoted customer-language treatment appeared in any of the four hydrated role views.
- The canonical registry contains 109 `verbatim_quote` records; all 109 are marked verified, have a nonblank supporting excerpt, and each excerpt is at most 15 words.
- The downloaded customer-voice CSV contains 33 filtered theme-summary rows, 24 provenance columns, snapshot ID `waters-ci-20260801170625`, language type, claim ID, evidence status, primary URL, dates, and caveat. Analyst paraphrases are typed as paraphrases rather than displayed as direct quotations.

## Number, date, attribution, and export consistency

- Decision scores recompute exactly from their stored components: PFAS 54, workflow 64, oligonucleotide 58. Those scores match the PowerPoint, but their underlying PubMed counts have drifted.
- All 172 current SEC signals use legal registrant names by CIK: Agilent Technologies, Thermo Fisher Scientific, Danaher Corporation, or Revvity. Direct content confirmation was unavailable because the focused SEC fetch received HTTP 429 for every filing; attribution therefore remains Unreachable rather than a pass.
- The eight-slide PowerPoint matches snapshot `waters-ci-20260801170625`, contains six unique external hyperlinks and eight speaker-note source blocks, and passed the slide overflow check. Visual inspection found no clipping. Slide 8 uses long raw URLs and should use shorter source labels, but this is a readability issue, not a factual contradiction.
- The app, decision objects, CSV snapshot, and PPTX use the same August 1 snapshot. The consistency control works; the snapshot itself is partially refreshed and already numerically stale.

## Ledgers and appendix

- [Per-claim appendix](./current_per_claim_appendix_{DATE}.csv) — all {len(claims):,} claim records, source URLs, <=15-word proof, verdicts, and discrepancies.
- [Hallucination ledger](./current_hallucination_ledger_{DATE}.csv) — all {len(bad_claims):,} Unsupported or Contradicted claims.
- [Broken/mislink ledger](./current_broken_mislink_ledger_{DATE}.csv) — all {len(bad_link_rows):,} strict bad links with anchors, HTTP result, final URL, and source surface. Corrected URLs are blank where none was independently verified.
- [Complete link inventory](./current_link_inventory_{DATE}.csv) — all {len(link_rows):,} distinct presented URLs.
- [Fresh PubMed rerun evidence](./current_pubmed_count_check_{DATE}.json).
- [Fresh SEC check](./current_sec_signal_check_{DATE}.json).
- [Fresh catalog check](./current_catalog_claim_check_{DATE}.json).

## One-line leadership verdict

**No — the content is not leadership-ready; the biggest accuracy risk is that “current” decision numbers already disagree with fresh identical primary-source queries while the partial-refresh state is not visible beside those claims.**
"""
REPORT.write_text(report)

print(json.dumps({
    "claims": len(claims),
    "verdicts": {key: counts[key] for key in verdict_order},
    "links": {"total": len(link_rows), "OK": link_counts["OK"], "Broken": link_counts["Broken"], "Mislink": link_counts["Mislink"]},
    "hallucinationLedgerRows": len(bad_claims),
    "brokenMislinkLedgerRows": len(bad_link_rows),
    "outputs": [str(REPORT), str(APPENDIX), str(HALLUCINATIONS), str(BAD_LINKS)],
}, indent=2))
