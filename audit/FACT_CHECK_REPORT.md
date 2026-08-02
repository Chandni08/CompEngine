# Waters Next Gen LC Competitive Intelligence Engine — Accuracy & Integrity Audit

Audit date: 2026-07-29 (America/New_York)
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
| Signal card | 294 | 63 | 0 | 32 | 162 | 37 |
| Competitor launch | 16 | 11 | 3 | 0 | 0 | 2 |
| Application note | 14 | 8 | 2 | 0 | 0 | 4 |
| Customer voice | 34 | 1 | 33 | 0 | 0 | 0 |
| Filing insight | 5 | 4 | 0 | 1 | 0 | 0 |
| Corporate move | 5 | 4 | 0 | 1 | 0 | 0 |
| Conference intelligence | 7 | 2 | 5 | 0 | 0 | 0 |
| Publication count | 60 | 28 | 32 | 0 | 0 | 0 |
| Historical product catalog | 150 | 51 | 7 | 0 | 0 | 92 |
| Technical comparison | 34 | 2 | 0 | 0 | 0 | 32 |
| Launch comparison | 17 | 7 | 0 | 0 | 0 | 10 |
| Journal source | 16 | 0 | 9 | 0 | 0 | 7 |
| Market/application source | 30 | 0 | 30 | 0 | 0 | 0 |
| Source health | 53 | 38 | 0 | 12 | 3 | 0 |
| Decision | 3 | 0 | 3 | 0 | 0 | 0 |

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
- **Mislink: 1.** `https://www.aaps.org/pharmsci/meeting` returns HTTP 200 but resolves to `https://www.aaps.org/custom404`; the current official meeting page is `https://www.aaps.org/pharmsci/annual-meeting`.

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
