# Post-refresh integrity audit — 2026-08-02

## Executive verdict

The application and deployment mirror were rebuilt from the 2026-08-02 refresh, inventoried, validated, and exercised in the browser. **The engine cannot truthfully claim that all data is current.** The correct published state is `PARTIAL`: 17 sources are CURRENT, 60 are PARTIAL, 12 are BLOCKED, and one is UNVERIFIED. Sixty-one required sources prevent a global current verdict.

This is an honesty-preserving result. No source was converted to healthy merely because an endpoint responded, a build completed, or historical records existed. The 12 policy/WAF-blocked sources remain BLOCKED; Reddit remains UNVERIFIED because official OAuth credentials are absent and no API request was made.

## Final inventory

| Measure | Final value |
| --- | ---: |
| Top-level panels | 41 |
| Reachable subpanels | 8 |
| Registered sources | 90 |
| Source workflows with a successful permitted response | 77 |
| Required-source blockers | 61 |
| CURRENT sources | 17 |
| PARTIAL sources | 60 |
| BLOCKED sources | 12 |
| UNVERIFIED sources | 1 |
| STALE / MISSING / ERROR / DISABLED sources | 0 / 0 / 0 / 0 |
| Canonical intelligence signals | 443 |
| Recommendations | 3 |
| Product launches | 16 |
| Customer-voice theme records | 171 |
| Individual customer evidence records | 184 |
| Conference registry events | 30 |
| Conference content records | 439 across 26 events |
| SEC filings retained | 172 |
| Unique evidence URLs checked | 1,921 |
| Reachable semantic matches | 1,071 |
| Access/policy blocked URLs | 850 |
| Broken URLs | 0 |
| Semantic mislinks | 0 |

The complete per-source counts, newest dates, outcomes, and reasons are in `POST_FIX_DATA_FRESHNESS_AUDIT_2026-08-02.md` and `data/source_health.json`.

## Before/after reconciliation

| Area | 2026-07-29 audit | 2026-08-02 result |
| --- | --- | --- |
| Panel ownership | No exhaustive manifest | 41 panels and 8 subpanels, each with owner, refresh path, data mode, and validator |
| Dependency lineage | Not centralized | Source-to-panel and artifact-to-panel matrices generated |
| Source truth contract | Inconsistent and not globally gated | 90 records with separate freshness, completeness, coverage, reachability, and policy states |
| Crossref journals | 280 stored records; every journal capped at 40 | 6,866 records across all seven configured 370-day windows; newest DOI verified |
| SEC EDGAR | 64 filings; 8-Ks capped at four per issuer | 172 in-window filings, accession-deduplicated |
| SelectScience | One aggregated record | 115 individual public review records |
| ChromForum | Four fixed-seed records; newest 2025-08-08 | 20 normalized newest-first records; engine high-water 2026-06-16 |
| LabWrench | Two fixed historical seeds | Six qualifying LC/vendor-workflow records; irrelevant board items rejected |
| PerkinElmer | Four curated news items; no automated coverage | 10 official newsroom records plus 83 LC/product records; newsroom high-water 2026-07-15 |
| Trade publications | Nine mapped sources with zero extracted records | 754 dated records across the nine configured publishers |
| Conferences | Five endpoint monitors and 25 mapped-only events | All 30 attempted; 439 public program-content links across 26; four zero-content events remain PARTIAL |
| FDA laboratory findings | Newest retained item 2025-09-17 | Two qualifying official records, including the 2026-03-09 high-water item |
| Link integrity | 890 URLs: 192 called broken and one mislink | 1,921 URLs: 1,071 OK, 850 explicitly BLOCKED, zero broken, zero mislinks |
| Unsupported dated product-change claims | 157 current-product pages treated as change evidence | Removed from current UI change claims and quarantined in the audit ledger; no change is asserted without two snapshots, hashes, fields, and an exact diff |
| Deployment parity | Multiple divergence risks | Source and deployment data are byte-synchronized and tested |

## Current records by competitor

The 443 canonical signal records are distributed as follows. Legal registrants remain distinct from operating brands.

| Competitor / registrant | Signals |
| --- | ---: |
| Shimadzu | 103 |
| SCIEX | 74 |
| Danaher Corporation | 48 |
| AGILENT TECHNOLOGIES, INC. | 48 |
| THERMO FISHER SCIENTIFIC INC. | 44 |
| Thermo Fisher | 42 |
| Agilent | 32 |
| Revvity, Inc. | 32 |
| PerkinElmer | 15 |
| Market-wide | 5 |

## Current signal records by UI horizon

All boundaries use closed UTC calendar-date intervals ending 2026-08-02. The exact definitions for every requested period—including quarters, YTD, TTM, five years, calendar years, historical, and conference windows—are persisted in `data/time_frame_boundaries.json`.

| UI horizon | Signals |
| --- | ---: |
| 30 days | 175 |
| 60 days | 195 |
| 90 days | 235 |
| 1 year | 318 |
| 3 years / since July 2023 corpus | 443 |

## High-water and completeness changes

- The seven Crossref windows now retain 2,000 Analytical Chemistry, 990 Journal of Chromatography A, 356 Journal of Chromatography B, 361 JASMS, 672 Analytical and Bioanalytical Chemistry, 602 Journal of Pharmaceutical and Biomedical Analysis, and 1,885 Talanta records.
- The PerkinElmer newsroom high-water advanced from the stale 2026-06-04 curated item to 2026-07-15, and official product coverage now contains 83 records.
- The SEC high-water is 2026-07-31 and all 172 qualifying filings are retained without the prior four-item 8-K cap.
- SelectScience is no longer aggregated; 115 individual reviews are stored. ChromForum uses newest-first board traversal. LabWrench applies newest-first traversal but retains only records that satisfy the LC/vendor-workflow scope.
- PubMed queries were rerun for every configured horizon. Counts and newest-PMID checks are current, but stored article evidence remains an explicitly labeled representative sample; PubMed completeness therefore remains PARTIAL.

## Claim and link reconciliation

The post-remediation audit evaluates 1,048 canonical claims: 233 Verified, 192 Partially supported, 450 UNREACHABLE, 160 Unsupported/Hallucinated, and 13 Contradicted. The larger non-verified denominator is not hidden: it includes the prior unsupported sitemap-change baseline retained for audit trace and access-blocked evidence. Current UI code does not promote those rows into verified claims.

Compared with the prior fact check, contradicted claims fell from 46 to 13, the dated sitemap-change assertions were quarantined, registrant/brand attribution controls were added, PubMed provenance was made reproducible, and PowerPoint/CSV exports were regenerated from canonical records. The link checker now distinguishes policy blocking from actual breakage: all 1,921 URLs have an explicit outcome, with zero broken or semantic-mislink results.

## Panel and browser result

The browser audit passed 20 of 20 canonical checks. It covered all application pages, four role views, five horizon options, global and PMM targeting filters, customer tabs, the Marketing-only Positioning tab, collapsible content, an evidence modal, dashboard/conference/publication pagination, event detail, browser back/forward history, representative external evidence-link classes, and layouts at 390, 768, 1024, and 1440 pixels. No browser console warnings or errors occurred and no tested viewport had horizontal overflow.

Browser verification found and corrected a real hidden-state defect: Marketing hid the customer-positioning section, and the Marketing render path failed to recalculate the Positioning tab. The script cache key was advanced so deployed clients receive the fix.

## Remaining manual or curated surfaces

No manifest entry is unlabeled static data. Forty-four entries are derived, three are interactive containers, and two PMM panels are explicitly curated: Governing Position and Activation Artifacts. Curated content does not establish automated source freshness.

## Remaining limitations

- Sixty-one required sources remain non-current. Many conference and regulatory sources are complete for extracted public records but remain PARTIAL because endpoint availability or a rolling page cannot prove full historical completeness.
- Twelve Agilent endpoints are BLOCKED by HTTP 403/policy controls. They are not called broken or healthy.
- Reddit is UNVERIFIED because official OAuth credentials are not configured. The adapter was skipped, not described as checked-empty.
- Rolling vendor news and technical feeds remain PARTIAL where complete July-2023 history cannot be proven.
- Four conference sources yielded no public program-content records and remain PARTIAL.
- Access-blocked links and unsupported baseline claims remain in the audit appendices rather than being erased.

## Validation evidence

- 50 Python unit tests passed.
- 94 Node test files passed.
- 10 JavaScript validators and the Python press-release completeness validator passed.
- 20 browser checks passed.
- Deployment copies match validated source artifacts.
- `git diff --check` is clean.

## Deliverables

- `audit/panel_manifest.json`
- `audit/panel_dependency_matrix.json`
- `data/source_registry.json`
- `data/source_health.json`
- `data/time_frame_boundaries.json`
- `data/link_health.json`
- `audit/browser_verification_2026-08-02.json`
- `audit/browser_verification_2026-08-02.md`
- `POST_FIX_DATA_FRESHNESS_AUDIT_2026-08-02.md`
- `audit/POST_REMEDIATION_FACT_CHECK_REPORT.md`
- `audit/REMAINING_EVIDENCE_GAPS.md`

## Final answer to the currency question

**No.** The engine can truthfully claim that the 2026-08-02 build contains newly refreshed and validated data for the sources marked CURRENT, with explicit PARTIAL/BLOCKED/UNVERIFIED limitations. It cannot claim that every required source—or the application as a whole—is current.
