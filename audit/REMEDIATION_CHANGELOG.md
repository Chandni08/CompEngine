# Accuracy and provenance remediation changelog

Generated from the July 30, 2026 remediation run. Current verdict and link totals are maintained in
`POST_REMEDIATION_FACT_CHECK_REPORT.md`; claim-level dispositions remain in the ledgers.

| Audit failure family | Implemented correction | Verification |
| --- | --- | --- |
| Unsupported product-page change claims | A product change now requires two preserved observations, timestamps, distinct hashes, changed fields, an exact diff, and a diff artifact. Initial observations cannot emit a change. The 157 historical add/update assertions remain explicitly unsupported for audit trace. | Python provenance tests; canonical claims export; post-remediation ledger. |
| SCIEX/Danaher and PerkinElmer/Revvity attribution | Filing registrants are derived from the SEC filing identity. Danaher remains the registrant for SCIEX-parent filings; Revvity remains separate from the current PerkinElmer instrument business. The ACD/Labs acquisition and software insight are attributed to Revvity. | Registrant tests for intelligence and filing insights; competitive-methodology tests. |
| Conflicting decision counts and scores | Each decision contains one canonical evidence object with its exact trend count, query provenance, formula inputs, computed score, and calculation timestamp. All app roles and the deck consume that object. | Cross-surface decision tests and PPTX export-integrity tests. |
| Non-reproducible PubMed counts | Every horizon stores the exact query, database/API endpoint, inclusive dates, retrieval timestamp, exact returned count, query hash, observation ID, and query-specific results URL. Retrievals append to an immutable observation history. Count smoothing was removed. | PubMed provenance, append-only history, and no-normalization tests. |
| Paraphrases displayed as customer quotations | Customer language is typed as `verbatim_quote`, `analyst_paraphrase`, or `directional_synthesis`. Only exact quotes can use quotation treatment; exact text and location are required. | Customer-language and exact-export-evidence tests. |
| Incorrect dates | Source metadata distinguishes publication, launch, effective, filing, retrieval, and ingestion dates. Thermo oligonucleotide, Shimadzu seafood PFAS, and Nexera CL publication/launch dates were corrected. | Date-type and Nexera split-date tests. |
| Broken, blocked, and misdirected links | Every current URL is rechecked for HTTP and semantic destination. AAPS now uses the exact annual-meeting page. The invalid SEC directory URL was replaced with the official API documentation page. Blocked/WAF URLs remain blocked. | Current link audit: zero broken and zero mislinks; semantic-link tests. |
| Unsupported historical and technical comparisons | Historical fields require exact primary-source excerpts and locations to be verified; otherwise they are explicitly unsupported with caveats. Comparative technical conclusions require published values for both products; controlled testing remains a separate status. | Historical catalog validators and technical-comparison test suite. |
| Stale or manually copied PowerPoint values | The eight-slide leadership deck is rebuilt from the same canonical snapshot and copied byte-for-byte to the export location. It includes external hyperlinks and source notes. | Export-integrity tests, eight rendered slides, layout inspection, and visual review of slides 4, 6, and 8. |
| Ambiguous CSV exports | The claims registry is regenerated from canonical records and includes status, language type, exact URL, retrieval/source dates, claim ID, source location, supporting excerpt, and caveat. | CSV schema and blocked-source integrity tests. |
| Pipeline drift | The daily refresh now runs link checking, provenance remediation, historical validators, and leadership-deck regeneration before publishing. A failed stage retains the prior validated dataset. | Daily refresh and last-known-good source-freshness tests. |

## Current validation result

- 38 Python tests passed.
- 342 JavaScript tests passed.
- 119 competitor products plus two legacy references validated.
- 54 Waters systems validated.
- Eight PPTX slides rendered; slides 4, 6, and 8 contain no detected overflow or clipping.
- The output and exported PPTX files are byte-identical and contain external hyperlinks plus eight source-note slides.
