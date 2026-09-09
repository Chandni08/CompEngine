# Post-fix data freshness audit

**Generated:** 2026-08-27 09:55 America/New_York  
**Dataset as of:** 2026-08-27  
**All required sources current:** Yes  
**Required blockers:** None  
**Production URL:** https://waters-nextgen-competitive-engine.vercel.app/

## Outcome

- The complete governed refresh finished successfully at `2026-08-27T13:51:04Z`.
- The source ledger reports 66 `CURRENT`, 14 `PARTIAL`, 1 `ERROR`, 1 `UNVERIFIED`, and no `STALE`, `MISSING`, or required-source blockers.
- The all-link gate checked 3,966 unique URLs: 1,300 reachable, 2,666 access-controlled/blocked, 0 dead, and 0 semantic mislinks.
- Source-title integrity passed for 448 title-linked sources across 448 records in 33 data files.
- The deployment package passed 495 Node regression tests and the targeted Python refresh/customer-voice suites.

## Agilent August 26 reconciliation

The official Agilent investor/newsroom feed and SEC EDGAR accession `0001090872-26-000062` were reconciled as one completed Q3 FY2026 earnings event. The transformed earnings record exposes:

- $1.88 billion Q3 revenue; 8.1% reported and 7.3% core growth.
- 28.3% non-GAAP operating margin, including an approximately 110-basis-point tariff-refund benefit.
- Life Sciences and Diagnostics: $746 million, 10% core growth.
- CrossLab: $786 million, 5% core growth, 34.3% operating margin.
- Applied Markets: $346 million, 7% core growth.
- FY2026 revenue guidance of $7.49–$7.51 billion and 5.8%–6.0% core growth.

Two verified filing insights were added from SEC Exhibit 99.1:

1. Raised guidance and broad growth increase Agilent's competitive investment capacity.
2. CrossLab's scale and margin reinforce lifecycle-service economics as a competitive dimension.

The UI preserves the evidence boundary: Agilent does not separately disclose LC or LC-MS revenue, units, pricing, or market share in the filed release. Segment growth is not presented as proof of LC share gain.

## Integrity remediation completed during this refresh

- Remapped the retired Thermo Vanquish Amplify sitemap URL to the live official `VQ-AMPLIFY` catalog page.
- Removed a retired CASS conference PDF and its malformed double-escaped cached form.
- Classified a source-wide ChromForum HTTP 403 as an explicit adapter error.
- Removed 30 ChromForum records whose full-source validation was expired or unavailable; no unsupported forum evidence remains in analytical panels.
- Preserved Reddit as `UNVERIFIED` because OAuth credentials are not configured; no Reddit evidence is promoted without a current permitted validation path.
- Corrected Vercel deployment execution so the project's configured `deploy-site` root is resolved exactly once.

## Remaining limitations

- ChromForum is optional and currently inaccessible behind HTTP 403. It is recorded as an error, and expired evidence was quarantined.
- Reddit is optional and unverified because OAuth credentials are not configured.
- Fourteen optional sources remain partial where publisher access or content extraction is incomplete.
- Access-controlled links are retained as blocked/unverified rather than mislabeled healthy; the link gate found no proven-dead or semantically incorrect URL.

## Deployment

Vercel production deployment `https://deploy-site-lkl0qpu6g-next-gen-lc.vercel.app` is aliased to `https://waters-nextgen-competitive-engine.vercel.app/`. The live `data/refresh_status.json` reports `status: success`, `datasetAsOfDate: 2026-08-27`, and `allRequiredSourcesCurrent: true`.
