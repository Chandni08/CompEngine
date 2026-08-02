#!/usr/bin/env python3
"""Build the claim appendix, hallucination ledger, link ledgers, and audit report."""

from __future__ import annotations

import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / "audit"
CHECKED_AT = "2026-07-29 (America/New_York)"
AAPS_BAD = "https://www.aaps.org/pharmsci/meeting"
AAPS_GOOD = "https://www.aaps.org/pharmsci/annual-meeting"


def load(path: str):
    return json.loads((ROOT / path).read_text())


def quote15(value: str) -> str:
    words = re.sub(r"\s+", " ", value or "").strip().split()
    return " ".join(words[:15])


raw_links = load("audit/link_check.json")
sec_checks = load("audit/sec_signal_check.json")
sec_by_id = {row["id"]: row for row in sec_checks}
sec_by_url = {row["sourceUrl"]: row for row in sec_checks}

links = {}
for raw in raw_links:
    row = dict(raw)
    if row["url"] in sec_by_url and sec_by_url[row["url"]].get("httpStatus") == 200:
        row["httpStatus"] = 200
        row["finalUrl"] = row["url"]
        row["classification"] = "OK"
        row["error"] = ""
        row["checkedAt"] = CHECKED_AT + "; focused sequential SEC recheck"
    if row["url"] == AAPS_BAD:
        row["classification"] = "Mislink"
    links[row["url"]] = row


def link_status(url: str) -> str:
    return links.get(url, {}).get("classification", "Missing")


def link_title(url: str) -> str:
    return quote15(links.get(url, {}).get("title", ""))


claims = []


def add(category: str, claim_id: str, surfaces: str, claim: str, source: str,
        source_quote: str, verdict: str, discrepancy: str = "", severity: str = "") -> None:
    claims.append({
        "claim_id": claim_id,
        "category": category,
        "surface_locations": surfaces,
        "exact_claim": re.sub(r"\s+", " ", claim or "").strip(),
        "source_url": source or "none",
        "source_quote_max_15_words": quote15(source_quote),
        "verdict": verdict,
        "discrepancy": re.sub(r"\s+", " ", discrepancy or "").strip(),
        "severity": severity,
        "checked_at": CHECKED_AT,
    })


# 294 atomic signal-card records.
intel = load("data/intelligence.json")
for signal in intel["signals"]:
    stype = signal.get("signalType", "")
    sid = signal["id"]
    url = signal.get("sourceUrl", "")
    claim_text = signal.get("title", "")
    if stype in {"Product page added", "Product page updated"}:
        add(
            "Signal card", sid,
            "Leadership / Product Management / Engineering / Product Marketing evidence appendix",
            claim_text, url, link_title(url), "Unsupported/Hallucinated",
            "The current product page supports product existence/content, not a dated sitemap addition or update. No prior snapshot/diff is cited.",
            "Critical",
        )
    elif stype == "Publication trend":
        add(
            "Signal card", sid, "All role views / application trends", claim_text, url,
            link_title(url), "Unsupported/Hallucinated",
            "Citation is the generic PubMed root, not the saved query/result supporting this exact trend claim.",
            "Major",
        )
    elif stype == "Investor filing":
        sec = sec_by_id[sid]
        form = claim_text.rsplit(" ", 1)[-1]
        if signal.get("competitor") in {"SCIEX", "PerkinElmer"}:
            actual_registrant = sec.get("sourceCompany") or ("DANAHER CORPORATION" if signal.get("competitor") == "SCIEX" else "Revvity, Inc.")
            add(
                "Signal card", sid, "All role views / SEC evidence", claim_text, url,
                actual_registrant, "Contradicted",
                f"The SEC filing identifies {actual_registrant}, not {signal.get('competitor')}.",
                "Critical",
            )
        else:
            add(
                "Signal card", sid, "All role views / SEC evidence", claim_text, url,
                sec.get("sourceCompany", "") or f"FORM {form}", "Verified",
            )
    elif stype == "Scientific publication":
        add(
            "Signal card", sid, "All role views / publication evidence", claim_text, url,
            "", "UNREACHABLE", "The cited PubMed record returned a blocking/4xx response in the URL audit.",
        )
    else:
        if link_status(url) == "OK":
            add("Signal card", sid, "All role views / evidence feed", claim_text, url, link_title(url), "Verified")
        else:
            add(
                "Signal card", sid, "All role views / evidence feed", claim_text, url, "",
                "UNREACHABLE", "The cited primary source could not be fetched in the audit.",
            )


# 16 launch records.
launch_partial = {
    "shimadzu-pl-40-plate-loader-2026": "Product page confirms the model, but the claimed launch date is not stated.",
    "shimadzu-labsolutions-insight-profiler-2026": "Product page confirms the software, but the claimed launch date is not stated.",
    "shimadzu-nexera-cl-lcms-2025": "The news item is dated November 12, but says the product launched in Japan on October 3.",
}
launch_unreachable = {"agilent-6230c-lctof-2026", "agilent-1290-infinity-iii-fld-2026"}
launches = load("data/product_launches.json")["launches"]
launch_by_id = {row["id"]: row for row in launches}
for row in launches:
    claim_text = f"{row['competitor']} launched {row['product']} on {row['date']}."
    source = row.get("pressReleaseUrl") or row.get("sourceUrl", "")
    if row["id"] in launch_partial:
        add("Competitor launch", row["id"], "Leadership / Product / Engineering / launch timeline",
            claim_text, source, link_title(source), "Partially supported", launch_partial[row["id"]], "Major")
    elif row["id"] in launch_unreachable:
        add("Competitor launch", row["id"], "Leadership / Product / Engineering / launch timeline",
            claim_text, source, "", "UNREACHABLE", "Agilent source returned a 403/access-denied response.")
    else:
        add("Competitor launch", row["id"], "Leadership / Product / Engineering / launch timeline",
            claim_text, source, link_title(source), "Verified")


# 14 application-note records.
note_partial = {
    "thermo-oligo-system-test-2026": "PDF metadata dates the document to July 2023, not April 2026.",
    "shimadzu-pfas-seafood-2026": "PDF metadata dates the document to July 2024, not March 2026.",
}
notes = load("data/competitor_application_notes.json")["notes"]
note_quotes = {
    "thermo-ultrashort-pfas-2026": "Robust quantification of ultrashort-chain PFAS at low ng/L levels",
    "shimadzu-qacs-milk-2026": "Sensitive and selective detection of BAC C8-C18 and DDAC C8-C12.",
    "shimadzu-intact-protein-2026": "The molecular weight of intact proteins can be confirmed",
}
for row in notes:
    claim_text = f"{row['date']}: {row['competitor']} — {row['title']}. {row['evidenceStatement']}"
    if row["id"] in note_partial:
        add("Application note", row["id"], "Product / Engineering / application evidence", claim_text,
            row["sourceUrl"], link_title(row["sourceUrl"]), "Partially supported", note_partial[row["id"]], "Major")
    elif row["competitor"] == "Agilent":
        add("Application note", row["id"], "Product / Engineering / application evidence", claim_text,
            row["sourceUrl"], "", "UNREACHABLE", "Cited Agilent URL returned 403/access denied.")
    else:
        add("Application note", row["id"], "Product / Engineering / application evidence", claim_text,
            row["sourceUrl"], link_title(row["sourceUrl"]) or note_quotes.get(row["id"], ""), "Verified")


# 34 customer-voice records, including the CSV export rows.
voice = load("data/customer_voice.json")["feedback"]
for row in voice:
    claim_text = row.get("customerLanguageSignal") or row.get("theme", "")
    if row["id"] == "cv-public-0fccea23bf6448":
        verdict, discrepancy = "Verified", ""
    else:
        verdict = "Partially supported"
        if str(row.get("evidenceStatus", "")).startswith("Exact") and re.match(
            r"^(A user|The user|The discussion|Users|A user documented)", claim_text
        ):
            discrepancy = "The linked anecdote supports the gist, but this is analyst-written summary language despite an 'Exact' evidence-status label."
        else:
            discrepancy = "Source supports an anecdotal/directional signal; it does not establish prevalence or a representative market conclusion."
    add("Customer voice", row["id"], "Product / Product Marketing / CSV export", claim_text,
        row.get("sourceUrl", ""), link_title(row.get("sourceUrl", "")), verdict, discrepancy)


# Five filing insights.
filing_quotes = {
    "agilent-lc-lcms-pharma-apac-growth-2026-q2": "very strong revenue growth in our liquid chromatography",
    "agilent-crosslab-service-growth-2026-q2": "Services and other revenue increased 10 percent in both periods",
    "thermo-bioproduction-chrom-ms-2026-q1": "Chromatography and mass spectrometry 798 773",
    "thermo-analytical-instruments-margin-pressure-2026-q1": "lower volume, partially offset by favorable business mix",
    "revvity-software-ai-life-sciences-2026": "Revvity, Inc.",
}
filings = load("data/filing_insights.json")
for row in filings["insights"]:
    if row["id"] == "revvity-software-ai-life-sciences-2026":
        add("Filing insight", row["id"], "Leadership / Product / SEC filing insights", row["headline"],
            row["sourceUrl"], filing_quotes[row["id"]], "Contradicted",
            "The filing is Revvity's; the cited filing does not support the PerkinElmer attribution or the asserted AI/platform/analytics trend.", "Critical")
    else:
        add("Filing insight", row["id"], "Leadership / Product / SEC filing insights", row["headline"],
            row["sourceUrl"], filing_quotes[row["id"]], "Verified")


# Five acquisition/divestiture claims nested in the filing evidence.
corp_quotes = {
    "Biocare (BC Midco I, Inc.)": "aggregate purchase price of approximately $ 950 million in cash",
    "Clario Holdings, Inc.": "$ 9,099",
    "Solventum Purification and Filtration business": "$ 3,865",
    "Microbiology business sale to Astorg": "sell its microbiology business to Astorg for approximately $ 1.075 billion",
    "Advanced Chemistry Development Inc. (ACD/Labs)": "Revvity, Inc.",
}
corp_index = 0
for group in filings["companyCorporateMoves"]:
    for item in group["items"]:
        corp_index += 1
        claim_text = f"{group['competitor']} {item['type']}: {item['name']} on {item['date']}; {item['value']}; {item['status']}."
        if group["competitor"] == "PerkinElmer":
            add("Corporate move", f"corporate-move-{corp_index}", "Leadership / competitor intent / filing evidence",
                claim_text, item["sourceUrl"], corp_quotes[item["name"]], "Contradicted",
                "Revvity—not the current PerkinElmer instruments company—made the acquisition.", "Critical")
        else:
            add("Corporate move", f"corporate-move-{corp_index}", "Leadership / competitor intent / filing evidence",
                claim_text, item["sourceUrl"], corp_quotes[item["name"]], "Verified")


# Seven conference-intelligence records.
conference_verified = {"bioprocessing-summit-us-2026-prep", "imsc-2026-prep"}
events = load("data/conference_preparation.json")["events"]
for row in events:
    competitor_text = "; ".join(
        f"{x.get('competitor')}: {x.get('evidenceStatus')} — {x.get('content')}" for x in row.get("competitorContent", [])
    )
    claim_text = f"{row['eventName']}; {row['dateRange']}; {row['location']}. {competitor_text}"
    if row["id"] in conference_verified:
        add("Conference intelligence", row["id"], "Conference page / all role links", claim_text,
            row["website"], link_title(row["website"]), "Verified")
    else:
        add("Conference intelligence", row["id"], "Conference page / all role links", claim_text,
            row["website"], link_title(row["website"]), "Partially supported",
            "Official event details are confirmed; competitor content remains explicitly expected/unconfirmed or has mixed reachable evidence.")


# Sixty PubMed count claims (five application themes and five competitors, six horizons each).
theme_actual = {
    "LNP and RNA therapeutics workflows": {"30d": 109, "60d": 196, "90d": 275, "1y": 920, "3y": 2472, "5y": 3905},
    "Oligonucleotide and nucleic-acid analytics": {"30d": 69, "60d": 128, "90d": 200, "1y": 666, "3y": 1521, "5y": 2235},
    "PFAS and environmental contaminant testing": {"30d": 36, "60d": 77, "90d": 109, "1y": 335, "3y": 703, "5y": 951},
    "High-resolution proteomics and metabolomics": {"30d": 922, "60d": 1862, "90d": 2781, "1y": 9894, "3y": 24775, "5y": 38925},
    "Lab automation and software-enabled workflows": {"30d": 112, "60d": 224, "90d": 324, "1y": 1140, "3y": 2702, "5y": 3886},
}
theme_count_checks = []
for item in intel["trends"]["themes"]:
    for period, stored in item["counts"].items():
        actual = theme_actual[item["theme"]][period]
        theme_count_checks.append({
            "name": item["theme"], "period": period, "stored": stored,
            "actual": actual, "query": item["query"], "endDate": "2026-07-28",
        })
        verdict = "Verified" if stored == actual else "Partially supported"
        discrepancy = "" if stored == actual else f"NCBI E-utilities returned {actual}, not {stored}, for the same query/end date."
        add("Publication count", f"theme-{item['theme']}-{period}", "Leadership / Product / Engineering / application trends / PowerPoint",
            f"{item['theme']}: {stored} PubMed records ({period}).", "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi",
            str(actual), verdict, discrepancy)

(AUDIT / "pubmed_theme_count_check.json").write_text(json.dumps(theme_count_checks, indent=2) + "\n")

for row in load("audit/pubmed_competitor_count_check.json"):
    verdict = "Verified" if row["stored"] == row["actual"] else "Partially supported"
    discrepancy = "" if verdict == "Verified" else f"NCBI E-utilities returned {row['actual']}, not {row['stored']}, for the same query/end date."
    add("Publication count", f"competitor-{row['name']}-{row['period']}", "Product / Engineering / publication intelligence",
        f"{row['name']}: {row['stored']} PubMed records ({row['period']}).",
        "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi", str(row["actual"]), verdict, discrepancy)


# 150 historical product records, fetched and parsed conservatively.
for row in load("audit/catalog_claim_check.json"):
    claim_text = f"{row['competitor']} {row['product']} introduced in {row['introducedYear']}."
    add("Historical product catalog", row["id"], "Product comparator / historical catalog", claim_text,
        row["sourceUrl"], row.get("sourceQuote", ""), row["verdict"], row.get("discrepancy", ""))


# 34 technical comparison rows.
technical = load("data/technical_comparisons.json")
for profile in technical["profiles"]:
    for idx, row in enumerate(profile["rows"], start=1):
        urls = [row.get("competitorSourceUrl", ""), row.get("watersSourceUrl", "")]
        verdict = "Verified" if all(link_status(url) == "OK" for url in urls) else "UNREACHABLE"
        discrepancy = "" if verdict == "Verified" else "At least one of the two primary comparison sources returned a blocking/4xx response."
        quote = link_title(urls[0]) if verdict == "Verified" else ""
        add("Technical comparison", f"{profile['launchId']}-row-{idx}", "Engineering / technical comparator",
            f"{row['dimension']}: {row['competitorValue']} Waters: {row['watersValue']}", "; ".join(urls), quote, verdict, discrepancy)


# 17 launch comparison narratives.
comparisons = load("data/product_comparisons.json")
waters_by_id = {row["id"]: row for row in comparisons["watersSystems"]}
technical_by_launch = {row["launchId"]: row for row in technical["profiles"]}
for row in comparisons["launchComparisons"]:
    waters = waters_by_id[row["closestWatersId"]]
    launch = launch_by_id.get(row["launchId"], {})
    urls = [url for url in [launch.get("sourceUrl"), launch.get("pressReleaseUrl")] if url]
    if not urls:
        profile = technical_by_launch.get(row["launchId"], {})
        urls.extend(sorted({item.get("competitorSourceUrl", "") for item in profile.get("rows", []) if item.get("competitorSourceUrl")}))
    if waters.get("sourceUrl"):
        urls.append(waters["sourceUrl"])
    verdict = "Verified" if all(link_status(url) == "OK" for url in urls) else "UNREACHABLE"
    discrepancy = "" if verdict == "Verified" else "At least one cited launch/Waters primary source could not be fetched."
    add("Launch comparison", f"comparison-{row['launchId']}", "Product comparator / Engineering",
        row.get("evidenceBasis") or row.get("pmRead", ""), "; ".join(urls),
        link_title(urls[0]) if verdict == "Verified" else "", verdict, discrepancy)


# 16 journal-source cards.
for row in load("data/journal_sources.json")["sources"]:
    claim_text = f"{row['name']}: {row['coverage']} Monitoring: {row['monitoringMode']}"
    if link_status(row["homepage"]) == "OK":
        add("Journal source", row["id"], "Publication intelligence / source coverage", claim_text,
            row["homepage"], link_title(row["homepage"]), "Partially supported",
            "Homepage confirms source identity; detailed coverage and monitoring assertions are app-authored metadata.")
    else:
        add("Journal source", row["id"], "Publication intelligence / source coverage", claim_text,
            row["homepage"], "", "UNREACHABLE", "Homepage returned a blocking/4xx response.")


# 30 market/application source cards.
for row in load("data/market_application_sources.json")["sources"]:
    claim_text = f"{row['name']}: {row['description']} Why it matters: {row['whyItMatters']}"
    add("Market/application source", row["id"], "Publication intelligence / source coverage", claim_text,
        row["url"], link_title(row["url"]), "Partially supported",
        "Page confirms source identity; the decision-use description is an analyst interpretation, not a source statement.")


# 39 source-catalog health cards.
source_catalog = load("data/source_catalog.json")["sources"]
for row in source_catalog:
    status = link_status(row["url"])
    claim_text = f"{row['source']}: health {row['health']}; status {row['status']}. {row.get('issue', '')}"
    if status == "Missing":
        add("Source health", f"catalog-{row['id']}", "All Public Evidence / source catalog", claim_text,
            "none", "", "Unsupported/Hallucinated", "The card cites a local app data file, not a primary source.", "Major")
    elif status == "OK" and row["health"] == "good":
        add("Source health", f"catalog-{row['id']}", "All Public Evidence / source catalog", claim_text,
            row["url"], link_title(row["url"]) or f"HTTP {links[row['url']].get('httpStatus', 200)}", "Verified")
    elif status == "Broken" and row["health"] in {"blocked", "review"}:
        add("Source health", f"catalog-{row['id']}", "All Public Evidence / source catalog", claim_text,
            row["url"], link_title(row["url"]) or f"HTTP {links[row['url']].get('httpStatus', 0)}", "Verified")
    else:
        add("Source health", f"catalog-{row['id']}", "All Public Evidence / source catalog", claim_text,
            row["url"], link_title(row["url"]), "Contradicted",
            f"The card says health={row['health']}/status={row['status']}, but the audit fetch classified the URL {status}.", "Major")


# Three decision/recommendation records, audited as their factual evidence basis.
for idx, row in enumerate(intel["recommendations"], start=1):
    first = (row.get("evidenceBasis", {}).get("links") or [{}])[0]
    discrepancy = "Forward-looking recommendation is not externally verifiable; its factual basis is mixed."
    summary = row.get("evidenceBasis", {}).get("summary", "")
    if idx == 1:
        discrepancy += " This record also says 335 and 325 PFAS records in the same decision."
    elif idx == 2:
        discrepancy += " This record also says 1,137 and 1,099 automation records in the same decision."
    elif idx == 3:
        discrepancy += " This record also says 659 and 639 oligonucleotide records in the same decision."
    add("Decision", f"decision-{idx}", "Leadership / Product / Product Marketing / PowerPoint",
        f"{row['title']}. {row['why']} {summary}", first.get("url", ""), link_title(first.get("url", "")),
        "Partially supported", discrepancy, "Major")


# Fourteen top-level source-health status claims.
for row in intel["sourceHealth"]:
    current = link_status(row["url"])
    claim_text = f"{row['competitor']} {row['type']}: HTTP {row['httpStatus']}; status {row['status']}; title {row['title']}."
    internally_live = row["status"] == "live" and row["httpStatus"] == 200
    current_ok = current == "OK"
    if internally_live == current_ok and not (row["status"] == "live" and row["httpStatus"] != 200):
        verdict, discrepancy, severity = "Verified", "", ""
    else:
        verdict, severity = "Contradicted", "Major"
        discrepancy = f"Stored HTTP/status fields disagree with each other or with the audit fetch ({current})."
    add("Source health", f"runtime-{row['id']}", "All role views / refresh and source-health evidence",
        claim_text, row["url"], link_title(row["url"]) or f"HTTP {links[row['url']].get('httpStatus', 0)}",
        verdict, discrepancy, severity)


# Write claim appendix and hallucination ledger.
claim_fields = [
    "claim_id", "category", "surface_locations", "exact_claim", "source_url",
    "source_quote_max_15_words", "verdict", "discrepancy", "severity", "checked_at",
]
with (AUDIT / "per_claim_appendix.csv").open("w", newline="", encoding="utf-8-sig") as handle:
    writer = csv.DictWriter(handle, fieldnames=claim_fields)
    writer.writeheader()
    writer.writerows(claims)

hallucinations = [row for row in claims if row["verdict"] in {"Unsupported/Hallucinated", "Contradicted"}]
with (AUDIT / "hallucination_ledger.csv").open("w", newline="", encoding="utf-8-sig") as handle:
    fields = ["claim_id", "category", "exact_claim", "source_url", "source_quote_max_15_words", "verdict", "discrepancy", "severity"]
    writer = csv.DictWriter(handle, fieldnames=fields)
    writer.writeheader()
    writer.writerows({key: row[key] for key in fields} for row in hallucinations)


# Write full link inventory and bad-link ledger.
link_rows = []
for url, row in sorted(links.items()):
    refs = row.get("references") or []
    labels = [ref.get("label", "") for ref in refs if ref.get("label")]
    files = sorted({ref.get("file", "") for ref in refs if ref.get("file")})
    link_rows.append({
        "anchor_or_record_label": labels[0] if labels else (row.get("title") or "Source link"),
        "original_url": url,
        "http_status": row.get("httpStatus", 0),
        "final_url": row.get("finalUrl", ""),
        "link_status": row.get("classification", ""),
        "error": row.get("error", ""),
        "correct_url_if_found": AAPS_GOOD if url == AAPS_BAD else (
            "https://www.agilent.com/cs/library/applications/an-revident-drug-metabolite-analysis-5994-8867en-agilent.pdf"
            if url.endswith("/revident-lc-q-tof") else
            "https://www.agilent.com/cs/library/applications/an-openlab-antisense-oligonucleotides-5994-8730en-agilent.pdf"
            if url.endswith("/oligo-analysis-accelerator-for-openlab-cds") else ""
        ),
        "referenced_from": "; ".join(files),
        "checked_at": row.get("checkedAt", CHECKED_AT),
    })

link_fields = list(link_rows[0])
with (AUDIT / "link_inventory.csv").open("w", newline="", encoding="utf-8-sig") as handle:
    writer = csv.DictWriter(handle, fieldnames=link_fields)
    writer.writeheader()
    writer.writerows(link_rows)

bad_links = [row for row in link_rows if row["link_status"] in {"Broken", "Mislink"}]
with (AUDIT / "broken_mislink_ledger.csv").open("w", newline="", encoding="utf-8-sig") as handle:
    writer = csv.DictWriter(handle, fieldnames=link_fields)
    writer.writeheader()
    writer.writerows(bad_links)


verdict_counts = Counter(row["verdict"] for row in claims)
link_counts = Counter(row["link_status"] for row in link_rows)
category_counts = defaultdict(Counter)
for row in claims:
    category_counts[row["category"]][row["verdict"]] += 1

expected_verdicts = {
    "Verified": 219,
    "Partially supported": 124,
    "Contradicted": 46,
    "Unsupported/Hallucinated": 165,
    "UNREACHABLE": 184,
}
expected_links = {"OK": 697, "Broken": 192, "Mislink": 1}
assert len(claims) == 738, (len(claims), verdict_counts)
assert dict(verdict_counts) == expected_verdicts, verdict_counts
assert dict(link_counts) == expected_links, link_counts
assert len(hallucinations) == 211
assert len(link_rows) == 890 and len(bad_links) == 193


category_order = [
    "Signal card", "Competitor launch", "Application note", "Customer voice", "Filing insight",
    "Corporate move", "Conference intelligence", "Publication count", "Historical product catalog",
    "Technical comparison", "Launch comparison", "Journal source", "Market/application source",
    "Source health", "Decision",
]
category_table = []
for category in category_order:
    c = category_counts[category]
    total = sum(c.values())
    category_table.append(
        f"| {category} | {total} | {c['Verified']} | {c['Partially supported']} | {c['Contradicted']} | "
        f"{c['Unsupported/Hallucinated']} | {c['UNREACHABLE']} |"
    )


report = f"""# Waters Next Gen LC Competitive Intelligence Engine — Accuracy & Integrity Audit

Audit date: {CHECKED_AT}
App data as-of date: 2026-07-28
Verdict: **NO — not trustworthy enough for leadership use. The single biggest risk is 157 unsupported 'product page added/updated' claims being treated as dated competitor moves without preserved diff evidence.**

## Executive summary

The application hydrated in every required role (Leadership, Product Management, Engineering, Product Marketing), plus Conference Intelligence, Publication Intelligence, the PowerPoint export, and the customer-voice CSV. No view was skipped as unreachable.

The audit unit is one independently checkable claim-source record. Exact duplicates rendered in several roles or exports are counted once, then audited separately for cross-view/export consistency. This produced **738 claims**. The crawl observed **800 rendered outbound-link occurrences** across role/page snapshots and **165 rendered unique destinations**; the complete evidence inventory contains **890 unique outbound URLs**, all of which were fetched.

| Measure | Total | Verified / OK | Partially supported | Contradicted | Unsupported / hallucinated | Unreachable / Broken | Mislink |
|---|---:|---:|---:|---:|---:|---:|---:|
| Claims | 738 | 219 | 124 | 46 | 165 | 184 | — |
| Unique outbound URLs | 890 | 697 | — | — | — | 192 | 1 |

Only **29.7%** of claim records are Verified. **211 claims are Contradicted or Unsupported/Hallucinated**, and **184 more cannot be verified because their cited source was unreachable**. A strict leadership-ready bar is not met.

## Verdicts by claim family

| Claim family | Total | Verified | Partial | Contradicted | Unsupported | Unreachable |
|---|---:|---:|---:|---:|---:|---:|
{chr(10).join(category_table)}

## Top 10 must-fix items

1. **Critical — Remove or re-source 157 sitemap-change claims.** A current product page cannot prove when a URL was added or updated. Preserve signed prior snapshots/diffs and cite the exact changed element.
2. **Critical — Correct 34 Revvity/Danaher attribution failures.** Sixteen SCIEX filing cards cite Danaher; sixteen PerkinElmer cards cite Revvity; one filing insight and one acquisition record also conflate Revvity with the current PerkinElmer instruments company.
3. **Critical — Regenerate the leadership PowerPoint.** It is dated July 23 while the app is dated July 28, contains stale publication counts and two stale priority scores, and has zero external hyperlinks or source-bearing speaker notes.
4. **Major — Fix decision-basis contradictions.** The same records say 335 vs 325 PFAS, 1,137 vs 1,099 automation, and 659 vs 639 oligonucleotide records.
5. **Major — Make PubMed counts reproducible.** Only 28 of 60 stored counts matched a fresh E-utilities run. Store the exact query, retrieval timestamp, database field, end-date rule, and returned count.
6. **Major — Repair source-health truthfulness.** Twelve health claims across the runtime table/source catalog conflict with their stored HTTP field or the audit fetch; “refresh success” should not imply the underlying links are healthy.
7. **Major — Correct document dates and deep links.** The Thermo oligonucleotide note is a 2023 document shown as 2026; the Shimadzu seafood PFAS note is a 2024 document shown as 2026; four Agilent note URLs returned 403.
8. **Major — Gate historical catalogs on primary-source verification.** Of 150 catalog records, 92 were unreachable and seven only partially supported during claim verification.
9. **Major — Block technical comparisons when proof is unreachable.** Thirty-two of 34 comparison rows had at least one primary source return 4xx/blocking.
10. **Major — Clear the bad-link queue before leadership review.** The strict fetch found 192 broken URLs and one semantic mislink (the AAPS URL resolves to its custom 404 page).

## Hallucination and contradiction findings

The exhaustive 211-row ledger is in `hallucination_ledger.csv`. The principal failure families are:

- **157 unsupported competitor-change claims:** exact card titles say a page was “added” or “updated,” but cite only the current product page.
- **32 contradicted SEC signal cards:** the source registrant is Danaher or Revvity, not SCIEX or PerkinElmer.
- **Two additional Revvity/PerkinElmer contradictions:** an AI/software insight and an ACD/Labs acquisition are assigned to PerkinElmer.
- **Twelve source-health contradictions plus three unsupported local-source cards:** health statements do not match the stored/current HTTP evidence, or cite local JSON as if it were a primary source.
- **Five unsupported publication-trend signal cards:** the citation is the generic PubMed root rather than the exact saved query/result.

## Link integrity

The full fetch inventory is in `link_inventory.csv`; the 193-row exception ledger is in `broken_mislink_ledger.csv`.

- **OK: 697.** This includes 64 SEC filing URLs that passed a focused sequential recheck after the broad concurrent crawl was rate-limited.
- **Broken: 192.** Under the requested strict rule, 4xx/5xx, TLS/network failures, timeouts, and access-denied responses are failures. Some are vendor WAF/anti-bot responses, but they are still not usable as unattended leadership evidence.
- **Mislink: 1.** `https://www.aaps.org/pharmsci/meeting` returns HTTP 200 but resolves to `https://www.aaps.org/custom404`; the current official meeting page is `{AAPS_GOOD}`.

## Quote fidelity and customer voice

The all-geography/all-competitor/three-year Product Marketing view rendered **zero blockquotes**, so there were no visible direct-quotation strings to pass as exact quotes. The CSV exported 25 rows labeled “Customer language signal,” not “verbatim quote.” However, 13 feedback records carry an `Exact...` evidence-status label while their language begins with analyst-summary constructions such as “The discussion...” or “Users...”. Those records are therefore only Partially supported and must not be promoted into the code path that renders observed language as a quotation without storing the verbatim source text.

The only short customer wording located verbatim and treated as Verified was: “Perfect column for metabolomic purpose!” All other customer-voice records remain anecdotal/directional rather than representative market evidence.

## Number, date, score, and attribution audit

- **PubMed:** fresh official E-utilities runs used the app's exact queries and the same 2026-07-28 end date. Theme counts matched 6/30; competitor counts matched 22/30; total exact match was 28/60.
- **Recommendation contradictions:** PFAS 335/325, automation 1,137/1,099, oligonucleotide 659/639.
- **PowerPoint scores:** current app scores are workflow 76, oligonucleotide 74, PFAS 55. The PPTX shows 72, 61, and 55 respectively.
- **Launch dates:** Nexera CL's news page is dated November 12, 2025, but its body states the Japan launch occurred October 3. PL-40 and Insight Profiler pages confirm the products but not the asserted dates.
- **Application-note dates:** Thermo oligonucleotide PDF metadata is July 2023; Shimadzu seafood PFAS PDF metadata is July 2024.
- **Corporate attribution:** Danaher is the SEC registrant for the SCIEX cards; Revvity is the registrant for the PerkinElmer cards and ACD/Labs acquisition.

## Export integrity

### PowerPoint

The eight-slide `waters-nextgen-leadership-brief.pptx` is not internally consistent with the live app:

- deck/footer date July 23, 2026 vs app/data July 28, 2026;
- slide counts 1,098 automation / 328 PFAS / 651 oligonucleotide vs app 1,137 / 335 / 659;
- current E-utilities results are 1,140 / 335 / 666;
- workflow and oligonucleotide scores are stale (72 vs 76; 61 vs 74);
- the PPTX contains **zero external hyperlinks** and empty speaker notes, so most slide claims are not traceable from the exported artifact;
- slides 4, 6, and 8 show left-edge/header clipping in the rendered QA images.

### Customer-voice CSV

The downloaded CSV contains 25 data rows and 20 unique primary source URLs. All URLs map to the customer-voice evidence graph (one through a nested evidence record). The export is structurally faithful to the filtered app data, but it inherits the evidence-label problem: analyst summaries appear in the “Customer language signal” column without a separate `verbatim/paraphrase` field.

## Method and limitations

1. Crawled the hydrated UI in all four roles and both standalone subpages, using the three-year horizon for full-view inspection.
2. Parsed the data/export inventories to include non-default and paginated evidence, then deduplicated exact claim/source records across repeated surfaces.
3. Fetched all 890 unique outbound URLs, recording HTTP status, final URL, title, and references; manually rechecked SEC URLs sequentially and reviewed suspicious 200/404 destinations.
4. Re-ran 60 PubMed queries against NCBI E-utilities; inspected SEC filings, official launch/event pages, and application-note PDFs; rendered all eight PPTX slides.
5. A 4xx or fetch failure is **UNREACHABLE/Broken**, never a pass. Source-page identity alone does not verify app-authored coverage or strategic interpretation.

The claim appendix is intentionally conservative: when the cited source could not be fetched, the quote field is blank and the verdict is UNREACHABLE. Source excerpts are capped at 15 words. Titles are used as the supporting source passage only where the exact item identity is itself the claim.

## Deliverables

- `per_claim_appendix.csv` — all 738 audited claim-source records.
- `hallucination_ledger.csv` — all 211 Unsupported/Hallucinated or Contradicted claims.
- `link_inventory.csv` — all 890 fetched URLs.
- `broken_mislink_ledger.csv` — all 192 Broken URLs plus the one Mislink.
"""

(AUDIT / "FACT_CHECK_REPORT.md").write_text(report)
print(json.dumps({
    "claims": len(claims),
    "verdicts": verdict_counts,
    "links": len(link_rows),
    "link_status": link_counts,
    "hallucination_ledger": len(hallucinations),
    "bad_links": len(bad_links),
}, indent=2))
