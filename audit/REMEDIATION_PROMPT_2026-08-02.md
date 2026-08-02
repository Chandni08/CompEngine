# Remediation prompt — Waters Next Gen LC Competitive Intelligence Engine

You are the senior engineer and provenance lead responsible for repairing the Waters Next Gen LC Competitive Intelligence Engine. Work directly in the repository. Implement and verify the fixes; do not merely describe them.

## Authoritative inputs

Read these files before editing:

- `audit/CURRENT_FACT_CHECK_REPORT_2026-08-02.md`
- `audit/current_per_claim_appendix_2026-08-02.csv`
- `audit/current_hallucination_ledger_2026-08-02.csv`
- `audit/current_broken_mislink_ledger_2026-08-02.csv`
- `audit/current_link_inventory_2026-08-02.csv`
- `audit/current_pubmed_count_check_2026-08-02.json`
- `audit/current_sec_signal_check_2026-08-02.json`
- `audit/current_catalog_claim_check_2026-08-02.json`
- `data/refresh_status.json`
- `data/source_health.json`

The audit baseline is 1,309 current claim records and 1,945 distinct presented URLs: 538 Verified, 215 Partially supported, 25 Contradicted, 8 Unsupported/Hallucinated, and 523 Unreachable; 1,105 links OK, 840 Broken under the strict rule, and 0 Mislinks.

## Non-negotiable evidence rules

1. A claim is Verified only when a cited primary source explicitly supports the exact entity, product/model, date, and number. Retain a verbatim supporting passage of at most 15 words and a precise source location.
2. Treat HTTP 4xx/5xx, login/paywall/verification walls, soft 404s, and unresolved generic redirect pages as Broken. Do not relabel them as a healthy or pass-like “Blocked” state.
3. Treat a resolving but semantically wrong destination as a Mislink.
4. Treat a claim with no source, or a source that does not contain it, as Unsupported/Hallucinated. Do not infer support from a company homepage or your own knowledge.
5. Never represent a product page as “added,” “updated,” or “launched” without two timestamped snapshots, distinct hashes, an exact diff, and a preserved diff artifact. A single page observation proves only page presence.
6. Keep analyst inference visually and structurally separate from observed facts. Inference must carry a caveat and must never be formatted as a quotation.
7. Never hard-code or smooth PubMed counts. Preserve query, inclusive dates, date field, retrieval timestamp, returned count, query hash, observation ID, results URL, and API URL.
8. Attribute SEC filings to the legal registrant. Danaher is not SCIEX; Revvity is not the current PerkinElmer instrument business. Operating-brand implications must be labeled as inference unless the filing names the business.

## P0 fixes

### 1. Make currentness truthful

- Replace the unconditional “Real public data as of …” label with a governed state derived from `refresh_status.json`.
- When `status != success`, `allRequiredSourcesCurrent == false`, or `sourcesVerifiedAt == null`, display a prominent “Partial refresh” warning beside every affected quantitative or decision claim.
- Show the last successful refresh, current attempt time, affected source families, and blocker count.
- Prevent leadership export generation from using the word “current” unless all required sources are current. Otherwise stamp the deck and CSV “PARTIAL SNAPSHOT — NOT FULLY VERIFIED.”

### 2. Make mutable publication counts honest and reproducible

- Refresh all 60 PubMed observations immediately before publishing the snapshot.
- Store and display “as retrieved at <timestamp>” beside every count.
- Recompute all decisions and the PowerPoint from the same newly written observation IDs.
- If an identical query changes later because PubMed back-indexed records, do not silently rewrite history. Append a new observation and expose the delta.
- Ensure the five one-year counts reproduce at build time. The August 2 audit rerun returned PFAS 335, automation 1,147, oligonucleotides 668, LNP/RNA 928, and proteomics/metabolomics 9,918; fetch again rather than copying these values.

### 3. Remove false health states

- Reconcile every contradicted row in `current_hallucination_ledger_2026-08-02.csv`.
- A URL that is currently strict-Broken cannot display `good`, `verified`, or `CURRENT` unless the label explicitly says “last known good” and gives that timestamp.
- Use one canonical link-classification enum everywhere: `OK`, `Broken`, `Mislink`. Keep collection completeness (`CURRENT`, `PARTIAL`, and similar) in a separate field.

### 4. Gate leadership claims on reachable proof

- Do not promote a claim to Leadership, Decisions Needed, or the PowerPoint when its primary evidence is Broken, Mislinked, Unsupported, or contradicted.
- For SEC evidence returning HTTP 429, use a compliant SEC retrieval strategy and cache the verified filing passage. Until then, show the signal as Unreachable and exclude it from verified totals.
- Preserve registrant, form, filing date, exact passage, and source location for every SEC signal.

## P1 fixes

### 5. Repair product-monitor semantics

- Rename all `product-page-added-*` IDs that now mean only “official product page observed,” or migrate them to a neutral observation ID.
- Align `evidenceStatus` with the displayed claim. A reachable official product-page presence claim may be Verified; a change claim remains Unsupported without a preserved diff.
- Regenerate the claims registry so text, ID, status, caveat, and evidence artifact describe the same assertion.

### 6. Repair unsupported launch dates and comparator records

- For the PL-40 Plate Loader and LabSolutions Insight Biologics Profiler, either cite an official dated launch/release passage or remove the launch date and label the item “current product page observed.”
- Add primary sources and <=15-word passages for the five third-party comparator-system records that currently have no cited source. Otherwise remove them from factual selector content.

### 7. Repair historical and technical evidence

- For each of 150 historical product-year records, retain the exact primary-source passage containing both the product identity and introduction year. Remove the year or mark it Unsupported when the source does not state it.
- For every technical row, retain a short exact passage and source location for both the competitor value and Waters value.
- Keep `conditions-differ` and `requires-controlled-testing` rows out of any superiority claim. A page title is not specification proof.

### 8. Repair link coverage

- Process every row in `current_broken_mislink_ledger_2026-08-02.csv`.
- Prefer specific official item URLs. Do not replace an item link with a homepage or search page.
- For publisher and Reddit verification walls, use a permitted API/feed or mark the evidence Unreachable; do not scrape around access controls.
- Follow DOI redirect mechanisms to the actual article and verify the final title. If content cannot be reached, keep the link Broken under the audit rule.
- Populate a corrected URL only after independently verifying that it points to the exact claimed content.

### 9. Fix the failing validation suite

Resolve all 16 current JavaScript test failures, including:

- publication source/deploy parity;
- customer-voice company grouping and compact evidence cards;
- responsive competitor/decision/dashboard layouts;
- recommendation owners, options, gates, effort, evidence, and magnitude;
- Agilent synthesis completeness;
- roadmap recurrence/source navigation;
- Thermo Fisher IR critical-source registration.

Do not weaken or delete tests to obtain a pass. Preserve the 44 passing Python tests.

### 10. Retire stale audit artifacts

- Move the July 29 baseline and July 30 post-remediation report into a clearly dated historical folder or add a prominent superseded banner.
- Ensure the product never presents their 738/890 or 864/1,332 denominators as current.
- Generate one current report directly from the same canonical snapshot used by the app and exports.

## Export and quote requirements

- Rebuild the customer-voice CSV and Leadership PowerPoint from the remediated snapshot.
- Keep snapshot ID, as-of timestamp, decision scores, publication observations, dates, and URLs identical across app, CSV, and PPTX.
- Keep all customer-language records typed as `verbatim_quote`, `analyst_paraphrase`, or `directional_synthesis`.
- A `verbatim_quote` requires an exact source match, source location, and <=15-word retained excerpt. Paraphrases must never receive quote styling.
- Preserve eight PPTX source-note blocks and working external hyperlinks. Replace long raw URLs on the source slide with concise linked labels.

## Required verification before handoff

1. Hydrate all four role views plus Conference Intelligence and Publication Intelligence in a browser.
2. Exercise every filter, selector, pagination control, evidence modal, CSV export, and PPTX export.
3. Re-run a complete current link crawl, including the visible publication records for every source selector.
4. Re-run all 60 stored PubMed queries and compare exact counts.
5. Verify every claim against its primary source and regenerate the per-claim appendix and both ledgers.
6. Run the entire Python and JavaScript test suites; require zero failures.
7. Render all eight PPTX slides, run overflow detection, and visually inspect every slide.
8. Assert there are no Verified claims with a blank supporting passage, no quote longer than 15 words, and no Verified claim whose link is Broken or Mislinked.

## Definition of done

- Zero Contradicted claims.
- Zero Unsupported/Hallucinated claims on leadership or decision surfaces.
- Zero Mislinks.
- Zero unqualified `good`, `verified`, `CURRENT`, or “real public data” labels when the current strict evidence check disagrees.
- Every remaining Broken or Unreachable source is visibly excluded from verified totals and decision promotion.
- All tests pass, all exports match the canonical snapshot, and a fresh fact-check report states the exact remaining non-verified counts without hiding access failures.

At completion, report: files changed; before/after verdict and link totals; unresolved sources; test results; export snapshot ID; and a one-line yes/no leadership-readiness verdict. Do not claim success until every acceptance condition is demonstrated with generated artifacts.
