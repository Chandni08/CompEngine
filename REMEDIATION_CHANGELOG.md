# Accuracy and provenance remediation changelog

Generated: 2026-07-29

This remediation preserves audit failures as failures. It changes the collection,
provenance, scoring, rendering, and export paths that produced them; it does not
silence the audit or relabel unreachable evidence as healthy.

## 1. Unsupported product-page changes

- Initial sitemap observations now enter `unverified_inventory_changes`; they do not
  become dated launch, add, or update claims.
- A change claim requires prior and current snapshots, observation timestamps,
  content hashes, a canonical URL, changed-field names, and an exact diff artifact.
- Daily refresh skips records that fail this change-evidence contract.
- The 157 historical unsupported claims remain visible in the post-remediation audit
  as unsupported instead of disappearing from the denominator.

Files: `scripts/provenance.py`, `scripts/collect_competitors.py`,
`scripts/collect_agilent.py`, `scripts/refresh_daily.py`,
`tests/test_provenance.py`.

## 2. SEC registrant and operating-business attribution

- SEC records now retain the legal registrant from the filing.
- Danaher evidence is not attributed to SCIEX without an explicit operating-business
  statement; Revvity evidence is not attributed to PerkinElmer.
- The ACD/Labs record now states the documented software acquisition and Life
  Sciences Software revenue context without inventing an AI or chromatography claim.

Files: `scripts/collect_real_data.py`, `scripts/remediate_provenance.py`,
`data/filing_insights.json`, `tests/test_provenance.py`,
`tests/validate_competitive_methodology.test.mjs`.

## 3. Canonical decision evidence and scoring

- Each decision now carries one canonical evidence object reused by UI and PowerPoint.
- Score type, formula version, component inputs, maxima, calculation timestamp,
  source URLs, PubMed query provenance, and caveat are stored with the decision.
- Decision owners, options, gate, deliverable, outstanding internal evidence,
  engineering-validation status, and explicitly unquantified business magnitude are
  regenerated on every curation run.
- Workflow, PFAS, and oligonucleotide urgency counts are populated from the same
  refreshed trend records used by the decision cards and export.

Files: `scripts/provenance.py`, `scripts/curate_recommendations.py`,
`data/intelligence.json`, `competitive-methodology.js`, `app.js`,
`scripts/build_leadership_pptx.mjs`,
`tests/validate_canonical_decision_surfaces.test.mjs`,
`tests/validate_competitive_methodology.test.mjs`,
`tests/validate_decision_urgency.test.mjs`.

## 4. PubMed reproducibility

- Every rolling PubMed count now records the exact query, endpoint, publication-date
  bounds, inclusive-range flag, query version and hash, retrieval timestamp, count,
  results URL, and API URL.
- A later retrieval produces a new timestamp/hash-bound observation instead of
  silently rewriting the earlier claim.

Files: `scripts/provenance.py`, `scripts/collect_real_data.py`,
`data/intelligence.json`, `tests/test_provenance.py`.

## 5. Claim-language discipline

- Claim records are typed as `verbatim_quote`, `analyst_paraphrase`, or
  `directional_synthesis`.
- Quotation treatment is restricted to verbatim source text; paraphrases and
  syntheses retain an exact source location and short supporting excerpt where
  available.

Files: `scripts/provenance.py`, `scripts/remediate_provenance.py`,
`exports/claims-registry.csv`, `tests/test_provenance.py`,
`tests/test_export_integrity.py`.

## 6. Date semantics

- Product launch, publication, page observation, update, and retrieval dates are
  separate typed fields.
- Corrected source dates include the 2023 Thermo oligonucleotide note, 2024 Shimadzu
  seafood PFAS note, and Nexera CL publication (2025-11-12) versus launch
  (2025-10-03).
- Current product pages are labeled current, not represented as dated updates.

Files: `scripts/remediate_provenance.py`, `app.js`,
`data/competitor_application_notes.json`, `data/product_launches.json`,
`tests/test_provenance.py`.

## 7. Link health and semantic redirects

- Link checks retain the final URL and detect custom-not-found pages, login/access
  challenges, and deep links redirected to generic home pages.
- Blocked is a non-healthy state; a successful refresh never means every URL is live.
- The refreshed ledger contains 603 OK and 405 blocked URLs, with zero observed
  broken or semantic-mislink outcomes in this run.

Files: `scripts/check_links.py`, `data/link_health.json`,
`audit/link_inventory.csv`, `audit/broken_mislink_ledger.csv`,
`tests/test_provenance.py`.

## 8. Technical-comparison evidence gating

- Technical comparison rows require field-level evidence from both selected products.
- Missing comparable data is separated into controlled-testing requirements instead
  of being guessed or converted into an alignment claim.

Files: `app.js`, `data/intelligence.json`,
`tests/test_export_integrity.py`, existing product-comparison validation tests.

## 9. PowerPoint and CSV exports

- The PowerPoint is regenerated from canonical decisions and current trend counts,
  includes clickable primary-source links and source notes, and separates observed
  facts from inference and unquantified business impact.
- The claims CSV includes claim ID, claim text, language type, status/verdict, source
  URL, source/retrieval dates, exact source location, short supporting excerpt, and
  caveat.
- All eight slides were rendered and visually inspected; automated overflow testing
  passed.

Files: `scripts/build_leadership_pptx.mjs`,
`output/waters-nextgen-leadership-brief.pptx`,
`exports/waters-nextgen-leadership-brief.pptx`,
`exports/claims-registry.csv`, `tests/test_export_integrity.py`.

## 10. Full post-remediation audit

- The audit merges current canonical claims with the preserved pre-remediation
  baseline so removed bad claims remain traceable.
- Result: 749 claims and 1008 URLs. Claim verdicts are 122 verified, 126 partially
  supported, 328 unreachable, 160 unsupported/hallucinated, and 13 contradicted.
  Currently blocked evidence is classified as unreachable even when a prior excerpt
  remains preserved in the ledger.
- The complete row-level evidence and remaining caveats are in the audit CSVs; the
  concise residual summary is in `audit/REMAINING_EVIDENCE_GAPS.md`.

Files: `scripts/build_post_remediation_audit.py`,
`audit/POST_REMEDIATION_FACT_CHECK_REPORT.md`,
`audit/per_claim_appendix.csv`, `audit/hallucination_ledger.csv`,
`audit/link_inventory.csv`, `audit/broken_mislink_ledger.csv`.

## Validation

- Python: 23 tests passed.
- JavaScript: 331 tests passed.
- PowerPoint: 8 slides rendered; overflow test passed; all slides visually inspected.
- Python source compilation passed.
