# Post-remediation fact-check report

Generated: `2026-08-02T20:38:41+00:00`

## Executive result

The audit evaluated **1048 canonical claims** and **1921 unique evidence URLs**. Counts below are observed outcomes; no failure category was hidden or converted to healthy for reporting.

### Claim verdicts

| Verdict | Count |
| --- | ---: |
| Verified | 233 |
| Partially supported | 192 |
| UNREACHABLE | 450 |
| Unsupported/Hallucinated | 160 |
| Contradicted | 13 |

### Link outcomes

| Status | Count |
| --- | ---: |
| OK | 1071 |
| Blocked | 850 |
| Broken | 0 |
| Mislink | 0 |

## Remediation controls verified

- Product-page inventory observations are not represented as dated changes without two preserved snapshots, timestamps, hashes, changed fields, and an exact diff artifact.
- SEC filings are attributed to the legal registrant; SCIEX and PerkinElmer are not substituted for Danaher and Revvity filings.
- Canonical decision scores, source counts, PubMed query provenance, UI views, CSVs, and PowerPoint are generated from shared records.
- Analyst paraphrases and directional syntheses are explicitly typed and are not displayed as verbatim quotations.
- Blocked, broken, misdirected, and custom-not-found URLs remain non-healthy in the link ledger.

## Remaining limitations

**815 claims remain non-verified.** These are preserved in `per_claim_appendix.csv` with their exact caveat or link condition. This includes analyst synthesis that has a valid primary URL but not a <=15-word supporting excerpt, current automated retrieval blocks, and records whose source is unavailable.

## Deliverables

- `audit/per_claim_appendix.csv` — every canonical claim with verdict and provenance fields.
- `audit/hallucination_ledger.csv` — unsupported or contradicted claims only.
- `audit/link_inventory.csv` — current URL status including redirects and blocked states.
- `audit/broken_mislink_ledger.csv` — every current non-healthy URL plus disposition of previously flagged URLs.
- `exports/claims-registry.csv` — canonical export with language type, source date, retrieval date, location, excerpt, and caveat.
