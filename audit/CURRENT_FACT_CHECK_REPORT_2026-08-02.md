# Waters Next Gen LC Competitive Intelligence Engine — current accuracy & integrity audit

Audit date: `2026-08-02` (America/New_York)
Application snapshot: `waters-ci-20260801170625` / public-data label `2026-08-01`
Verdict: **NO — not trustworthy enough for leadership use. The single biggest risk is that quantitative claims labeled current already disagree with fresh, identical PubMed queries while the UI suppresses the partial-refresh warning.**

## Scope and inventory method

All four role views hydrated: Leadership, Product Management, Product Marketing, and Engineering. Conference Intelligence and Publication Intelligence also hydrated. The customer-voice CSV and eight-slide PowerPoint were inspected; no required surface was skipped.

The audit unit is one structured, independently checkable claim-source record. Exact duplicates rendered across roles or exports are counted once and separately checked for consistency. Interactive alternatives (all journal selectors, product comparators, and catalog records) are included. This gives **1,309 claims**. The outbound-link inventory contains **1,945 distinct currently presented URLs**, including the first 12 exact publication records visible for each of 16 sources.

## Summary

| Measure | Total | Verified / OK | Partially supported | Contradicted | Unsupported / hallucinated | Unreachable / Broken | Mislink |
|---|---:|---:|---:|---:|---:|---:|---:|
| Claims | 1,309 | 538 | 215 | 25 | 8 | 523 | — |
| Unique presented URLs | 1,945 | 1,105 | — | — | — | 840 | 0 |

`Broken` follows the supplied strict definition: HTTP 4xx/5xx, access/login/verification walls, soft 404s, or unresolved redirect walls. It is not softened into a separate “blocked” pass-like category.

## Verdicts by claim family

| Claim family | Total | Verified | Partial | Contradicted | Unsupported | Unreachable |
|---|---:|---:|---:|---:|---:|---:|
| Application note | 14 | 5 | 5 | 0 | 0 | 4 |
| Competitor launch | 16 | 12 | 0 | 0 | 2 | 2 |
| Conference intelligence | 7 | 0 | 6 | 0 | 0 | 1 |
| Corporate move | 5 | 0 | 0 | 0 | 0 | 5 |
| Decision / PPTX | 3 | 0 | 3 | 0 | 0 | 0 |
| Displayed publication record | 161 | 75 | 0 | 0 | 0 | 86 |
| Historical product catalog | 150 | 30 | 7 | 0 | 0 | 113 |
| Journal source | 16 | 0 | 7 | 0 | 0 | 9 |
| Launch comparison | 17 | 0 | 14 | 0 | 0 | 3 |
| Market/application source | 30 | 0 | 30 | 0 | 0 | 0 |
| Pipeline source health | 90 | 17 | 68 | 4 | 1 | 0 |
| Product comparator system | 14 | 0 | 0 | 0 | 5 | 9 |
| Publication count | 55 | 18 | 37 | 0 | 0 | 0 |
| Signal / filing / customer-voice registry | 624 | 329 | 36 | 0 | 0 | 259 |
| Source catalog health | 73 | 52 | 0 | 21 | 0 | 0 |
| Technical comparison | 34 | 0 | 2 | 0 | 0 | 32 |

## Adversarial findings

1. **Critical — all five leadership one-year PubMed counts drifted.** Fresh runs of the stored query, inclusive dates, and database returned: PFAS **335 vs 334**, automation **1,147 vs 1,145**, oligonucleotides **668 vs 665**, LNP/RNA **928 vs 927**, and proteomics/metabolomics **9,918 vs 9,895**. The app and deck are internally aligned to the stored snapshot, but they are no longer exact as of this audit.
2. **Critical — the currentness label overstates the refresh state.** The UI says “Real public data as of 2026-08-01.” `refresh_status.json` says `status=partial`, `allRequiredSourcesCurrent=false`, `sourcesVerifiedAt=null`, and lists **61 required-source blockers**. Source-health states are 17 CURRENT, 68 PARTIAL, 4 BLOCKED, and 1 UNVERIFIED.
3. **Critical — 840 of 1,945 presented URLs fail the supplied strict link rule.** This includes HTTP 403/429 results, Reddit verification walls, 48 unresolved DOI redirect walls, soft-404 pages, and all 172 SEC filing URLs returning HTTP 429 in the focused attribution pass. These claims are Unreachable, not verified.
4. **Major — stored source-health claims do not always match a fresh strict fetch.** The source catalog has **21 contradicted status cards** and the pipeline source-health table has **4 contradicted records**. A “good/current” badge cannot coexist with a current strict-broken result without an explicit last-known-good label.
5. **Major — product-monitor semantics remain internally inconsistent.** The 157 current claims now say only “official product page observed,” which is supportable where the official page resolves. However, every corresponding claim ID still says `product-page-added`, and every exported status remains `unsupported`. The wording was fixed; the evidence-state schema was not.
6. **Major — publication counts are not snapshot-stable.** Across all 60 exact PubMed count checks, only 18 reproduced; 42 changed between the stored August 1 retrieval and the August 2 rerun. This is database back-index drift, but leadership slides present the numbers without an “as retrieved” qualifier.
7. **Major — historical product-year coverage remains weak.** Fresh source-text checks returned 30 Verified, 7 Partially supported, and 113 Unreachable out of 150 catalog records.
8. **Major — exact comparison proof remains incomplete.** 32 of 34 technical rows are Unreachable because at least one required vendor source fails strict fetch. Resolving links are still Partial unless both exact values are retained as short source passages; a page title alone does not prove a specification.
9. **Major — the current JavaScript validation suite is red.** 359 of 375 tests pass; 16 fail, including source/deploy publication parity, customer-voice grouping, responsive layout, decision fields, and Thermo IR registration. Python unit tests pass 44/44.
10. **Major — prior audit artifacts are stale and contradictory.** `POST_REMEDIATION_FACT_CHECK_REPORT.md` still reports 864 claims and 1,332 URLs and labels 473 failures “Blocked,” while the current complete inventory is 1,309 claims and 1,945 URLs under the required Broken definition. The July 29 baseline separately reports 738 claims and 890 URLs. Retire or date-gate these files.

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

- [Per-claim appendix](./current_per_claim_appendix_2026-08-02.csv) — all 1,309 claim records, source URLs, <=15-word proof, verdicts, and discrepancies.
- [Hallucination ledger](./current_hallucination_ledger_2026-08-02.csv) — all 33 Unsupported or Contradicted claims.
- [Broken/mislink ledger](./current_broken_mislink_ledger_2026-08-02.csv) — all 840 strict bad links with anchors, HTTP result, final URL, and source surface. Corrected URLs are blank where none was independently verified.
- [Complete link inventory](./current_link_inventory_2026-08-02.csv) — all 1,945 distinct presented URLs.
- [Fresh PubMed rerun evidence](./current_pubmed_count_check_2026-08-02.json).
- [Fresh SEC check](./current_sec_signal_check_2026-08-02.json).
- [Fresh catalog check](./current_catalog_claim_check_2026-08-02.json).

## One-line leadership verdict

**No — the content is not leadership-ready; the biggest accuracy risk is that “current” decision numbers already disagree with fresh identical primary-source queries while the partial-refresh state is not visible beside those claims.**
