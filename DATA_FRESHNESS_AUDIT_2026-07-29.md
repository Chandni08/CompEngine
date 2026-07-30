# Waters Next Gen LC Competitive Intelligence Engine
## Data-freshness and ingestion-completeness audit

**Audit date:** 2026-07-29 (America/New_York)  
**Engine build inspected:** `data/source_catalog.json` generated 2026-07-29 00:26:49Z; `data/refresh_status.json` last successful refresh 2026-07-29 00:28:42Z  
**Stated data window:** approximately three years, beginning July 2023  
**Verdict:** **No. The engine is not current across all intended sources.** The largest measured freshness lag is **2,703 days for LabWrench**; the most consequential current competitive gap is **PerkinElmer newsroom coverage**, which is 39 days behind and misses a July 9 LC-MS/MS-relevant collaboration.

### Audit rules

- **Freshness pass** means the single newest qualifying source item found in this audit is present in the engine. A recent pipeline run is not a pass by itself.
- **Completeness** means all qualifying items in the claimed window are present. `Complete`, `Partial`, `Missing`, and `Unverified` below refer only to this dimension.
- **Coverage Y** means content, not merely a URL or HTTP status, is ingested. `N` means mapped-only, disabled, manual-only, or absent. Five conference rows marked `Y*` are endpoint-monitored but do not ingest agenda/poster records.
- The acceptable operational cadence is **daily** for APIs, RSS, newsrooms, forums, and FDA bulk data; **weekly** for regulatory pages and conference programs. Freshness remains an exact-newest-item test even when lag is within one cadence.
- `Source latest` is a content date, not the audit retrieval time. `—` means no dated engine item. `U` means the source did not expose a reliable item date or could not be independently checked; no freshness inference was made.
- Counts in the `Engine latest (count)` column are normalized source counts. For sitemaps they are page inventories; for conference rows they are endpoint counts, not content records.

## Source registry and freshness table

The engine catalog contains 39 top-level rows, including three roll-up manifests (`customer-voice`, `trade-publications`, and `conferences`). Normalizing those manifests produces the source rows below. Ingestion methods were read from collector code and catalog metadata, not inferred from UI labels.

### Community, reviews, Reddit, and vendor communities

| Source (base URL) | Type | Method | Engine latest (count) | Source latest | Lag | Freshness | Completeness | Coverage | Status |
|---|---|---|---:|---:|---:|---|---|:---:|---|
| [ChromForum LC](https://www.chromforum.org/viewforum.php?f=1) | community_forum | auto-crawl, fixed seeds, max 4 | 2025-08-08 (4) | 2026-06-17 | 313d | **Fail** | Partial | Y | **STALE** |
| [SelectScience ACQUITY BEH page](https://www.selectscience.net/product/acquity-uplc-r-beh-c18-and-c8-columns) | structured_review | auto-crawl, one fixed product seed, aggregated | 2017-03-21 (1) | 2022-04-14 | 1,850d | **Fail** | 1 engine record vs 15 reviews | Y | **STALE** |
| [LabWrench HPLC board](https://www.labwrench.com/forums/642/hplc-high-performance-liquid-chromatography) | community_forum | auto-crawl, two fixed thread seeds | 2018-12-28 (2) | 2026-05-23 | 2,703d | **Fail** | 2 vs 758 board results | Y | **STALE** |
| [Reddit laboratory communities](https://www.reddit.com/dev/api/) | reddit | intended official OAuth API; currently disabled/no credentials; retained manual evidence | 2026-07-16 (38 evidence records; 30 URLs) | U | U | **Unverified** | Unverified | N | **UNVERIFIED** |
| [Agilent LC/MS Community](https://community.agilent.com/technical/lcms/b/announcements) | vendor_community | none | — (0) | 2026-07-13 | N/A | **Fail** | Missing | N | **MISSING** |
| [SCIEX Community](https://community.sciex.com/results/) | vendor_community | none | — (0) | 2026-07-28 | N/A | **Fail** | Missing | N | **MISSING** |
| [Waters public support/knowledge base](https://help.waters.com/) | vendor_community | manual evidence links only; no adapter | — (0 monitored items) | 2026-06-08 | N/A | **Fail** | Missing | N | **MISSING** |
| [Thermo Fisher support resource/community](https://resource.digital.thermofisher.com/default.aspx) | vendor_community | none; public index, forum requires account | — (0) | 2026-06-29 | N/A | **Fail** | Missing | N | **MISSING** |

### Competitor newsrooms, technical feeds, and product indexes

| Source (base URL) | Type | Method | Engine latest (count) | Source latest | Lag | Freshness | Completeness | Coverage | Status |
|---|---|---|---:|---:|---:|---|---|:---:|---|
| [Thermo Fisher investor news](https://ir.thermofisher.com/investors/news-events/news/default.aspx) | competitor_newsroom | official IR API | 2026-07-23 (18) | 2026-07-23 | 0d | Pass | Partial: 2026 only, not Jul-2023 window | Y | **PARTIAL** |
| [Thermo LC/MS product sitemap](https://www.thermofisher.com/sitemap-us-en.xml) | publication_index | sitemap auto-crawl | 2026-07-16 (43) | 2026-07-16 | 0d | Pass | Complete as current URL inventory; `lastmod` is not a launch date | Y | CURRENT |
| [Thermo Dionex IC subset](https://www.thermofisher.com/sitemap-us-en.xml) | publication_index | filtered sitemap auto-crawl | 2026-03-23 (2) | 2026-03-23 | 0d | Pass | Complete as configured two-page subset | Y | CURRENT |
| [Thermo Vanquish Neo subset](https://www.thermofisher.com/sitemap-us-en.xml) | publication_index | filtered sitemap auto-crawl | 2026-07-15 (1) | 2026-07-15 | 0d | Pass | Complete as configured one-page subset | Y | CURRENT |
| [Thermo LC insights RSS](https://www.thermofisher.com/blog/analyteguru/liquid-chromatography/feed/) | publication_index | RSS auto-crawl | 2026-07-11 (7) | 2026-07-11 | 0d | Pass | Partial: rolling feed | Y | **PARTIAL** |
| [Thermo MS insights RSS](https://www.thermofisher.com/blog/analyteguru/mass-spectrometry/feed/) | publication_index | RSS auto-crawl | 2026-05-27 (5) | 2026-05-27 | 0d | Pass | Partial: rolling feed; cross-feed dedup changes source attribution | Y | **PARTIAL** |
| [Thermo proteomics RSS](https://www.thermofisher.com/blog/analyteguru/proteomics/feed/) | publication_index | RSS auto-crawl | 2026-05-27 (7) | 2026-05-27 | 0d | Pass | Partial: rolling feed | Y | **PARTIAL** |
| [Agilent newsroom](https://www.agilent.com/about/newsroom/presrel.html) | competitor_newsroom | official dated index auto-crawl | 2026-07-28 (10 snapshot; 9 signals) | 2026-07-28 | 0d | Pass | Partial: only rolling 10 of 775 indexed releases | Y | **PARTIAL** |
| [Agilent LC/MS sitemap](https://www.agilent.com/products0.xml) | publication_index | sitemap auto-crawl | 2026-07-05 (49) | 2026-07-05 | 0d | Pass | Complete as current URL inventory; not semantic launch history | Y | CURRENT |
| [Shimadzu newsroom](https://www.shimadzu.com/news/2026/index.html) | competitor_newsroom | official year page + keyword filter | 2026-07-14 (5) | 2026-07-14 | 0d | Pass | Partial: qualifying corporate/workflow items omitted | Y | **PARTIAL** |
| [Shimadzu LC/MS sitemap](https://www.shimadzu.com/an/sitemap.xml) | publication_index | sitemap auto-crawl | 2026-07-09 (78) | 2026-07-09 | 0d | Pass | Complete as current URL inventory | Y | CURRENT |
| [SCIEX press releases](https://sciex.com/about-us/press-releases) | competitor_newsroom | official year index auto-crawl | 2026-06-01 (3) | 2026-06-01 | 0d | Pass | Partial: 2026 relevant slice only | Y | **PARTIAL** |
| [SCIEX product sitemap](https://sciex.com/sitemap.xml) | publication_index | sitemap auto-crawl | U (66 URLs) | U | U | **Unverified** | Current inventory count matches, but source supplies no `lastmod` | Y | **UNVERIFIED** |
| [PerkinElmer newsroom](https://www.perkinelmer.com/corporate-and-newsroom) | competitor_newsroom | catalog mapping; no automated extractor | 2026-06-04 (4 curated) | 2026-07-13 | 39d | **Fail** | Missing current releases | N | **STALE** |
| [PerkinElmer liquid chromatography](https://www.perkinelmer.com/category/liquid-chromatography) | publication_index | catalog mapping; no extractor | — (0) | U | U | **Unverified** | Missing | N | **UNVERIFIED** |

### PubMed and SEC EDGAR

| Source (base URL) | Type | Method | Engine latest (count) | Source latest | Lag | Freshness | Completeness | Coverage | Status |
|---|---|---|---:|---:|---:|---|---|:---:|---|
| [PubMed](https://pubmed.ncbi.nlm.nih.gov/) | publication_index | NCBI E-utilities API, saved aggregate counts + small samples | 2026-07-28 (33 evidence signals) | 2026-07-29 | 1d | **Fail** | Partial: aggregates are current-ish, article records are heavily sampled | Y | **PARTIAL** |
| [Agilent EDGAR](https://data.sec.gov/submissions/CIK0001090872.json) | SEC | official submissions API | 2026-06-25 (16: 3 10-K, 9 10-Q, 4 8-K) | 2026-06-25 8-K | 0d | Pass | Partial: 4 of 37 in-window 8-Ks | Y | **PARTIAL** |
| [Thermo Fisher EDGAR](https://data.sec.gov/submissions/CIK0000097745.json) | SEC | official submissions API | 2026-07-23 (16) | 2026-07-23 8-K | 0d | Pass | Partial: 4 of 32 in-window 8-Ks | Y | **PARTIAL** |
| [Danaher / SCIEX EDGAR](https://data.sec.gov/submissions/CIK0000313616.json) | SEC | official submissions API | 2026-07-21 (16) | 2026-07-21 8-K/10-Q | 0d | Pass | Partial: 4 of 37 in-window 8-Ks | Y | **PARTIAL** |
| [Revvity / PerkinElmer EDGAR](https://data.sec.gov/submissions/CIK0000031791.json) | SEC | official submissions API | 2026-05-12 (16) | 2026-05-12 10-Q | 0d | Pass | Partial: 4 of 21 in-window 8-Ks | Y | **PARTIAL** |

### Peer-reviewed journals (Crossref)

The source totals below are direct Crossref counts for the collector's own 370-day query, not the full July-2023 window. The engine hard-caps every journal at 40 records.

| Source (base URL) | Type | Method | Engine latest (count) | Source latest | Lag | Freshness | Completeness | Coverage | Status |
|---|---|---|---:|---:|---:|---|---|:---:|---|
| [Analytical Chemistry](https://api.crossref.org/journals/1520-6882/works) | publication_index | Crossref API | 2026-07-27 (40) | 2026-07-27 | 0d | Pass | Partial: 40 of 3,443; ≥3,403 omitted | Y | **PARTIAL** |
| [Journal of Chromatography A](https://api.crossref.org/journals/1873-3778/works) | publication_index | Crossref API | 2026-07-01 (40) | 2026-07-01 | 0d | Pass | Partial: 40 of 874; ≥834 omitted | Y | **PARTIAL** |
| [Journal of Chromatography B](https://api.crossref.org/journals/1873-376X/works) | publication_index | Crossref API | 2026-07-01 (40) | 2026-07-01 | 0d | **Fail**: same-date newest DOI absent | Partial: 40 of 348; ≥308 omitted | Y | **PARTIAL** |
| [JASMS](https://api.crossref.org/journals/1044-0305/works) | publication_index | Crossref API | 2026-07-27 (40) | 2026-07-27 | 0d | Pass | Partial: 40 of 365; ≥325 omitted | Y | **PARTIAL** |
| [Analytical and Bioanalytical Chemistry](https://api.crossref.org/journals/1618-2650/works) | publication_index | Crossref API | 2026-07-28 (40) | 2026-07-29 | 1d | **Fail** | Partial: 40 of 676; ≥636 omitted | Y | **PARTIAL** |
| [Journal of Pharmaceutical and Biomedical Analysis](https://api.crossref.org/journals/1873-264X/works) | publication_index | Crossref API | 2026-07-01 (40) | 2026-07-01 | 0d | Pass | Partial: 40 of 575; ≥535 omitted | Y | **PARTIAL** |
| [Talanta](https://api.crossref.org/journals/1873-3573/works) | publication_index | Crossref API | 2026-07-01 (40) | 2026-07-01 | 0d | Pass | Partial: 40 of 1,701; ≥1,661 omitted | Y | **PARTIAL** |

### Trade publications

All nine appear in `data/journal_sources.json` as `Source mapped`; none has an extraction status, a record count, or evidence rows generated by the scientific-source collector.

| Source (base URL) | Type | Method | Engine latest (count) | Source latest | Lag | Freshness | Completeness | Coverage | Status |
|---|---|---|---:|---:|---:|---|---|:---:|---|
| [LCGC](https://www.chromatographyonline.com/) | publication_index | mapped only | — (0) | at least 2026-07-23 | N/A | **Fail** | Missing | N | **MISSING** |
| [BioPharma International](https://www.biopharminternational.com/) | publication_index | mapped only | — (0) | at least 2026-06-26 | N/A | **Fail** | Missing | N | **MISSING** |
| [Separation Science](https://www.sepscience.com/) | publication_index | mapped only | — (0) | at least 2026-07-08 | N/A | **Fail** | Missing | N | **MISSING** |
| [LabRoots](https://www.labroots.com/) | publication_index | mapped only | — (0) | at least 2025-11-04 | N/A | **Fail** | Missing | N | **MISSING** |
| [Lab Manager](https://www.labmanager.com/) | publication_index | mapped only | — (0) | at least 2026-06-08 | N/A | **Fail** | Missing | N | **MISSING** |
| [Pharmaceutical Online](https://www.pharmaceuticalonline.com/) | publication_index | mapped only | — (0) | U | U | **Unverified** | Missing | N | **UNVERIFIED** |
| [The Analytical Scientist](https://theanalyticalscientist.com/) | publication_index | mapped only | — (0) | at least 2026-07-23 | N/A | **Fail** | Missing | N | **MISSING** |
| [European Pharmaceutical Review](https://www.europeanpharmaceuticalreview.com/) | publication_index | mapped only | — (0) | at least 2025-09-24 | N/A | **Fail** | Missing | N | **MISSING** |
| [American Pharmaceutical Review](https://www.americanpharmaceuticalreview.com/specialty/chromatography/) | publication_index | mapped only | — (0) | 2026-07-21 | N/A | **Fail** | Missing | N | **MISSING** |

### Regulatory sources

| Source (base URL) | Type | Method | Engine latest (count) | Source latest | Lag | Freshness | Completeness | Coverage | Status |
|---|---|---|---:|---:|---:|---|---|:---:|---|
| [FDA warning-letter bulk data](https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/compliance-actions-and-activities/warning-letters/datatables-data?_format=xlsx&page=0) | regulatory | official XLSX auto-ingest + term filter | 2025-09-17 (1) | 2026-03-09 | 173d | **Fail** | Partial | Y | **STALE** |
| [FDA Form 483 FY2025 observations](https://www.fda.gov/media/190190/download?attachment) | regulatory | official XLSX auto-ingest + term filter | 2025-09-30 (1) | 2025-09-30 | 0d | Pass | Complete for the currently linked FY2025 workbook and filter | Y | CURRENT |
| [USP <621> Chromatography](https://doi.usp.org/USPNF/USPNF_M99380_06_01.html) | regulatory | HTTP reachability check only | U (1 endpoint) | U; public preview cites 2023 | U | **Unverified** | Full revision/effective-date history not extracted | Y | **UNVERIFIED** |
| [USP <1058> Analytical Instrument Qualification](https://doi.usp.org/USPNF/USPNF_M1124_01_01.html) | regulatory | HTTP reachability check only | U (1 endpoint) | U; public preview cites 2017 | U | **Unverified** | Full revision/effective-date history not extracted | Y | **UNVERIFIED** |
| [USP <232>/<233> elemental impurities](https://www.usp.org/impurities/elemental-impurities-updates) | regulatory | HTTP reachability check only | — (0 endpoint at engine run) | U; reachable during audit but browser access inconsistent | U | **Unverified** | No content extracted | N | **UNVERIFIED** |
| [ICH Q2(R2)](https://database.ich.org/sites/default/files/ICH_Q2%28R2%29_Guideline_2023_1130.pdf) | regulatory | exact official PDF reachability monitor | 2023-11-30 (1) | 2023-11-30 | 0d | Pass | Complete for exact tracked PDF | Y | CURRENT |
| [ICH Q14](https://database.ich.org/sites/default/files/ICH_Q14_Guideline_2023_1116.pdf) | regulatory | exact official PDF reachability monitor | 2023-11-16 (1) | 2023-11-16 | 0d | Pass | Complete for exact tracked PDF | Y | CURRENT |

### Conferences

Only five conference IDs are selected by the collector. For those five, `extractedRecords` is the number of HTTP-200 endpoints, not agenda, speaker, sponsor, poster, abstract, or launch records. The other 25 are registry entries only.

| Source (base URL) | Type | Method | Engine latest (count) | Source latest | Lag | Freshness | Completeness | Coverage | Status |
|---|---|---|---:|---:|---:|---|---|:---:|---|
| [WCBP 2026](https://www.casss.org/meetings-and-events/event/2026/01/27/default-calendar/wcbp-2026) | conference | mapped only | — (0) | U | U | **Unverified** | Missing | N | **UNVERIFIED** |
| [SLAS 2026](https://www.slas.org/events-calendar/slas2026-international-conference-exhibition/) | conference | mapped only | — (0) | U | U | **Unverified** | Missing | N | **UNVERIFIED** |
| [mRNA Analytical Development & QC Summit](https://mrna-analytical-development.com/) | conference | mapped only | — (0) | U | U | **Unverified** | Missing | N | **UNVERIFIED** |
| [Bioprocessing Summit EU](https://www.bioprocessingeurope.com/) | conference | mapped only | — (0) | U | U | **Unverified** | Missing | N | **UNVERIFIED** |
| [ACS Spring 2026](https://www.acs.org/events/all-events/acs-spring-2026.html) | conference | mapped only | — (0) | U | U | **Unverified** | Missing | N | **UNVERIFIED** |
| [Analytica 2026](https://analytica.de/en/munich/) | conference | mapped only | — (0) | U | U | **Unverified** | Missing | N | **UNVERIFIED** |
| [ADC Analytical Development Summit](https://adc-analytical.com/) | conference | mapped only | — (0) | U | U | **Unverified** | Missing | N | **UNVERIFIED** |
| [PEGS US](https://www.pegsummit.com/) | conference | mapped only | — (0) | U | U | **Unverified** | Missing | N | **UNVERIFIED** |
| [TIDES US](https://informaconnect.com/tides/) | conference | mapped only | — (0) | U | U | **Unverified** | Missing | N | **UNVERIFIED** |
| [ASGCT 2026](https://annualmeeting.asgct.org/) | conference | mapped only | — (0) | U | U | **Unverified** | Missing | N | **UNVERIFIED** |
| [SLAS Europe 2026](https://www.slas.org/events-calendar/slas-europe-2026-conference-and-exhibition/) | conference | mapped only | — (0) | U | U | **Unverified** | Missing | N | **UNVERIFIED** |
| [Waters ASMS Users Meeting 2026](https://cvent.me/lKEada) | conference | mapped only | — (0) | U | U | **Unverified** | Missing | N | **UNVERIFIED** |
| [ASMS 2026](https://www.asms.org/conferences/annual-conference) | conference | endpoint monitor | U (2 endpoints) | U | U | **Unverified** | Endpoint-only; no item extraction | Y* | **PARTIAL** |
| [HPLC 2026](https://hplc2026-symposium.org/) | conference | endpoint monitor | U (2 endpoints) | U | U | **Unverified** | Endpoint-only; no item extraction | Y* | **PARTIAL** |
| [Metabolomics Society Conference](https://metabolomicssociety.org/) | conference | mapped only | — (0) | U | U | **Unverified** | Missing | N | **UNVERIFIED** |
| [ISSX Europe 2026](https://issxmeetings.org/2026-euro/home) | conference | mapped only | — (0) | U | U | **Unverified** | Missing | N | **UNVERIFIED** |
| [Bioprocessing Summit US](https://www.bioprocessingsummit.com/) | conference | mapped only | — (0 agenda items) | 2026-08-13 program item | N/A | **Fail** | Missing current agenda/speakers/sponsors | N | **MISSING** |
| [IMSC 2026](https://www.imss.nl/) | conference | endpoint monitor | U (1 endpoint) | U | U | **Unverified** | Endpoint-only; no item extraction | Y* | **PARTIAL** |
| [ACS Fall 2026](https://www.acs.org/events/all-events/acs-fall-2026.html) | conference | mapped only | — (0) | U | U | **Unverified** | Missing | N | **UNVERIFIED** |
| [CASSS Practical Applications of MS](https://www.casss.org/meetings-and-events/multi-day-symposia/mass-spectrometry) | conference | mapped only | — (0) | U | U | **Unverified** | Missing | N | **UNVERIFIED** |
| [Lab of the Future Europe](https://www.lab-of-the-future.com/europe/) | conference | mapped only | — (0) | U | U | **Unverified** | Missing | N | **UNVERIFIED** |
| [MSACL 2026](https://www.msacl.org/) | conference | endpoint monitor | U (2 endpoints) | U | U | **Unverified** | Endpoint-only; no item extraction | Y* | **PARTIAL** |
| [ISSX North America 2026](https://issxmeetings.org/2026-na/home) | conference | mapped only | — (0) | U | U | **Unverified** | Missing | N | **UNVERIFIED** |
| [AAPS PharmSci 360](https://www.aaps.org/pharmsci/meeting) | conference | mapped only | — (0) | U | U | **Unverified** | Missing | N | **UNVERIFIED** |
| [TIDES Europe](https://informaconnect.com/tides-europe/) | conference | mapped only | — (0) | U | U | **Unverified** | Missing | N | **UNVERIFIED** |
| [RAFA 2026](https://www.rafa2026.eu/) | conference | mapped only | — (0) | U | U | **Unverified** | Missing | N | **UNVERIFIED** |
| [PEGS Europe](https://www.pegsummiteurope.com/) | conference | mapped only | — (0) | U | U | **Unverified** | Missing | N | **UNVERIFIED** |
| [EBF Open Symposium 2026](https://meetings.e-b-f.eu/open/) | conference | endpoint monitor | U (2 endpoints) | U | U | **Unverified** | Endpoint-only; no item extraction | Y* | **PARTIAL** |
| [SETAC North America 2026](https://www.setac.org/discover-events/global-meetings/setac-north-america-47th-annual-meeting/program/daily-schedule.html) | conference | mapped only | — (0) | U | U | **Unverified** | Missing | N | **UNVERIFIED** |
| [IMSIS 2026](https://www.msimaging.science/) | conference | mapped only | — (0) | U | U | **Unverified** | Missing | N | **UNVERIFIED** |

## Stale, missing, partial, and unverified ledger

### Critical

1. **PerkinElmer newsroom — STALE, 39-day lag; coverage absent.** The engine's newest curated newsroom item is 2026-06-04. The official source published [PerkinElmer and Covalent Announce Strategic Collaboration to Advance Failure Analysis and Materials](https://www.perkinelmer.com/au/corporate-and-newsroom/perkinelmer-and-covalent-announce-strategic-collaboration) on **2026-07-09**; it explicitly concerns ICP-MS/MS and **LC-MS/MS**. The official newsroom also published a 2025 Sustainability Report release on **2026-07-13**. Neither is in engine evidence. This is the highest-severity competitive freshness failure because the catalog claims PerkinElmer coverage but has no extractor.

2. **SEC EDGAR — PARTIAL for all four tracked issuers.** Newest filings are present, so freshness passes, but the collector intentionally caps 8-Ks at four per issuer. Within the July-2023 window, the official submissions API exposes 37 Agilent, 32 Thermo Fisher, 37 Danaher, and 21 Revvity 8-Ks; the engine keeps 4 each. Concrete missing recent filings include:
   - Agilent, **8-K, 2026-03-20**: [official filing](https://www.sec.gov/Archives/edgar/data/1090872/000119312526117614/a-20260318.htm).
   - Thermo Fisher, **8-K, 2026-02-12**: [official filing](https://www.sec.gov/Archives/edgar/data/97745/000114036126005014/ef20065513_8k.htm).
   - Danaher, **8-K, 2026-04-21**: [official filing](https://www.sec.gov/Archives/edgar/data/313616/000031361626000109/dhr-20260421.htm).
   - Revvity, **8-K, 2025-10-27**: [official filing](https://www.sec.gov/Archives/edgar/data/31791/000003179125000032/pki-20251027.htm).
   - Minimum in-window 8-K omission: **111 filings** across the four issuers.

### Major

3. **LabWrench — STALE, 2,703-day lag.** Engine: two fixed threads, newest 2018-12-28. Source: 758 HPLC results; newest listed item is [Communication problem of the Beckman 406 A/I module with KARAT 8.0](https://www.labwrench.com/thread/369315/title-communication-problem-of-the-beckman-406-a-i-module-with-karat-8-0-does-not-appear-in-auto-configuration), **2026-05-23**. Other omitted first-page records include “Key board for LC-6AD…” (**2026-03-19**) and “dotlink version” (**2026-02-10**).

4. **SelectScience — STALE, 1,850-day lag.** Engine: one aggregated record dated 2017-03-21. The tracked product page has **15 reviews**; newest is [“Perfect column for metabolomic purpose!”](https://www.selectscience.net/product/acquity-uplc-r-beh-c18-and-c8-columns), **2022-04-14**. At least **14 review records** are not represented as individual evidence.

5. **ChromForum — STALE, 313-day lag.** Engine: four comparison-prioritized topics, newest 2025-08-08. The LC board lists [“Current cost of a PM for Agilent 1100 system w one detector”](https://www.chromforum.org/viewtopic.php?t=129357), **2026-06-17**, and [“Contamination Problems With Waters Equipment”](https://www.chromforum.org/viewtopic.php?t=129353), **2026-06-12**. Neither is ingested. The board exposes 11,923 topics, while the adapter caps output at four.

6. **FDA warning letters — STALE, 173-day lag.** Engine newest: [BRS Analytical Services](https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/warning-letters/brs-analytical-services-llc-711133-09172025), **2025-09-17**. Current official bulk data includes [Vedic Lifesciences Pvt. Ltd.](https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/warning-letters/vedic-lifesciences-pvt-ltd-722446-03092026), **2026-03-09**, a GLP/nonclinical laboratory-study finding that matches the adapter's tracked scope. It is absent.

7. **PubMed — PARTIAL; newest result missing.** The engine's newest evidence date is 2026-07-28. Re-running all five official E-utilities queries on 2026-07-29 produced changed counts and a same-day result, [“ClusterApp: A Novel Clustering-Based Application for Analyzing Mass Spectrometry Imaging Data”](https://pubmed.ncbi.nlm.nih.gov/42525709/), **2026-07-29**, not in the engine. Current direct counts versus engine counts were: LNP 30d **106 vs 107**, oligonucleotide **69 vs 64**, PFAS **36 vs 36**, proteomics **918 vs 900**, automation **111 vs 111**. Count drift proves the index moved after the engine snapshot; the collector stores aggregate counts and only small article samples, so record-level completeness is not achieved.

8. **Journal Crossref feeds — PARTIAL for all seven; two freshness failures.** The 40-row hard cap creates a minimum **5,702 omitted records** in only the collector's 370-day query. Concrete newest-item gaps:
   - Journal of Chromatography B: [“Validated UPLC-MS/MS quantification and intracellular PK-PD Modeling of periplocin-related cardiac glycosides in H/R-injured H9c2 cells”](https://doi.org/10.1016/j.jchromb.2026.125227), **2026-07-01**, is absent even though it shares the engine's high-water date.
   - Analytical and Bioanalytical Chemistry: [“The development and use of isotope dilution mass spectrometry methods for the quantification of target proteins in certified reference materials”](https://doi.org/10.1007/s00216-026-06689-7), **2026-07-29**, and [“Spatially and angularly resolved spectroscopy…”](https://doi.org/10.1007/s00216-026-06696-8), **2026-07-29**, are absent.
   - The other five journals pass strict newest-item freshness, but fail completeness because their direct 370-day totals range from 365 to 3,443 while only 40 records are stored.

9. **Vendor communities — MISSING.** Concrete source items prove active, relevant content exists but no adapter covers it:
   - Agilent: [“July Consumables Announcements”](https://community.agilent.com/technical/lcms/b/announcements), **2026-07-13**, announcing Altura Ultra Inert SEC and PLRP-S HPLC columns.
   - SCIEX: [“How SCIEX Now empowers mass spec users to work with more control, clarity and confidence”](https://community.sciex.com/results/), **2026-07-28**, and “Bioanalysis across modalities…” (**2026-07-22**).
   - Waters: [“Additional resources”](https://help.waters.com/help/en/product-support/alliance-is-system-support/715008415/A6DA511.html), updated **2026-06-08**, links current Alliance iS support and knowledge-base resources; these are present only as scattered manual evidence, not a monitored source.
   - Thermo Fisher: [Digital Science Support Resource Center](https://resource.digital.thermofisher.com/default.aspx) lists a customer forum and a **2026-06-29** SampleManager release; no community/support adapter exists.

10. **Trade publications — MISSING, except Pharmaceutical Online remains UNVERIFIED.** Each is mapped but has zero extracted records. Concrete qualifying examples include:
    - LCGC, “LC-MS Reveals Food-Linked Stress Proteins,” **2026-07-23**, on the [LCGC site](https://www.chromatographyonline.com/).
    - BioPharma International, “Executive Summary: Road Ahead: What’s Next for Host Cell Protein Analytics?”, **2026-06-26**, on [BioPharma International](https://www.biopharminternational.com/).
    - Separation Science, [“Downstream Data Bottlenecks Are Slowing LC-MS Workflows”](https://www.sepscience.com/), **2026-07-08**.
    - LabRoots, [“Safeguard dataset quality in LC-MS analysis with system suitability…”](https://www.labroots.com/webinars/chemistry-and-physics), **2025-11-04**.
    - Lab Manager, Waters reversed-phase column coverage on [Lab Manager](https://www.labmanager.com/), **2026-06-08**.
    - The Analytical Scientist, “Skin Deep Survival,” **2026-07-23**, on [The Analytical Scientist](https://theanalyticalscientist.com/).
    - European Pharmaceutical Review, [“Novel analytical approach could aid quality control during nitrosamine analysis”](https://www.europeanpharmaceuticalreview.com/news/265860/novel-analytical-approach-could-aid-quality-control-during-nitrosamine-analysis/), **2025-09-24**.
    - American Pharmaceutical Review, [“Beyond Titer: Accelerating Biologics Process Development with Integrated Product Quality Analysis”](https://www.americanpharmaceuticalreview.com/specialty/chromatography/), **2026-07-21**, describing an integrated 2D-LC workflow.
    - Pharmaceutical Online exposed no reliably dated LC item to this audit, so its external freshness is **UNVERIFIED**, not assumed stale; engine coverage is still absent.

11. **Bioprocessing Summit US — MISSING conference content.** The engine stores the event metadata but no agenda, speaker, sponsor, poster, or session records. The official [2026 program](https://www.bioprocessingsummit.com/) now lists 12 tracks, 300 presentations, 100 posters, and 70 exhibitors. A concrete missing agenda item is [“Advances in Purification & Recovery”](https://www.bioprocessingsummit.com/purification-and-recovery), **2026-08-12 to 2026-08-13**, including chromatography platform development. The other 24 mapped-only conference sites are **UNVERIFIED** at item level and have no content ingestion; the five selected conference sources are **PARTIAL** because only endpoint fingerprints are recorded.

12. **Competitor newsroom histories — PARTIAL even where newest-item freshness passes.** Concrete omissions prove the claimed July-2023 window is not complete:
    - Thermo Fisher: [Orbitrap Astral Zoom and Orbitrap Excedion Pro launch](https://ir.thermofisher.com/investors/news-events/news/news-details/2025/Thermo-Fisher-Scientific-Unveils-Next-generation-Mass-Spectrometers-at-ASMS-2025-to-Revolutionize-Biopharma-Applications-and-Omics-Research/default.aspx), **2025-06-02**, is outside the current-year 18-row newsroom snapshot.
    - Agilent: [ASMS 2025 LC/MS and GC/MS innovations](https://www.agilent.com/about/newsroom/presrel/2025/30may-ca25018.html), **2025-05-30**, is outside the rolling 10-row newsroom snapshot; the official index reports **775** releases.
    - SCIEX: [2025 press-release index](https://sciex.com/about-us/press-releases/2025) includes “Software launches for SCIEX OS ecosystem…”, **2025-06-02**, absent from the current 3-row newsroom snapshot.
    - Shimadzu: the 2026 index includes [TESCAN acquisition](https://www.shimadzu.com/news/2026/j97cvpy4m18o8cm3.html), **2026-07-10**; [HPLC refurbishment pilot](https://www.shimadzu.com/news/2026/ao0x3yts-fwk-ev6.html), **2026-07-03**; and [NIIMBL membership](https://www.shimadzu.com/news/2026/gcz8mxw0lcb05i76.html), **2026-05-28**. The newest July 14 item is present, but those qualifying workflow/corporate signals are filtered out.

13. **Thermo Fisher AnalyteGuru RSS feeds — PARTIAL.** All three feeds pass newest-item freshness, but their rolling 5–7 item snapshots do not cover the stated July-2023 window. Concrete official archive items absent from engine data include [“Maximize Performance with Specialized LC-MS Workflows — and Save Up to 40%!”](https://www.thermofisher.com/blog/analyteguru/maximize-performance-with-specialized-lc-ms-workflows-and-save-up-to-40/), **2025-10-27**, and “Accelerate Proteomics Research with Smart Automation,” **2025-09-04**, on the [official proteomics archive](https://www.thermofisher.com/blog/analyteguru/proteomics/).

14. **Reddit — UNVERIFIED.** The official API is the correct access route, but `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, and the enable flag are not configured in this environment. The source registry nevertheless says `checked_no_new_records` and records no error. The 38 retained Reddit evidence records are manual/historical and cannot prove current subreddit freshness.

15. **SCIEX product sitemap, PerkinElmer products, USP pages, and mapped-only conference sites — UNVERIFIED.** SCIEX supplies no item-level `lastmod`; PerkinElmer has no product collector; USP public previews do not expose current full revision history; and 25 conference pages are never queried by the collector. This audit does not convert reachability into a freshness pass.

## Coverage gaps

Expected or explicitly mapped sources with no live content ingestion:

- **All four expected vendor-community families:** Agilent Community, SCIEX Community, Waters support/community, and Thermo Fisher support/community.
- **PerkinElmer newsroom and product catalog:** curated records exist, but no auto-ingest adapter exists.
- **Live Reddit:** official API adapter is inactive because credentials/enablement are absent.
- **All nine trade publications:** mapped, zero extracted records.
- **25 of 30 conference sites:** present in the registry but not selected by the collector. The five selected sites only receive endpoint fingerprint checks.
- **USP <232>/<233>:** mapped, zero at the engine run; the page was reachable during this audit but content/revision extraction is absent.

### Evidence-domain reconciliation

A recursive URL inventory across the data files found the expected primary domains (Thermo Fisher, Agilent, Shimadzu, SCIEX, PerkinElmer, PubMed, SEC, FDA, Reddit, ChromForum, LabWrench, SelectScience, conference organizers, journal publishers, and Crossref). It also found evidence-only citation domains such as `waters.com`, `support.waters.com`, `help.waters.com`, `ir.waters.com`, `ssi.shimadzu.com`, `epa.gov`, `ema.europa.eu`, `clinicaltrials.gov`, `api.reporter.nih.gov`, `developers.openalex.org`, `nsf.gov`, `grants.gov`, `usaspending.gov`, `wipo.int`, and `cordis.europa.eu`. These are manually curated evidence links, not registered recurring adapters. Their presence in a record must not be represented as source coverage.

## Pipeline findings

1. **The global “Daily refresh current” badge is not a source-freshness assertion.** `app.js` lines 145-163 label the build current solely when the global success timestamp is under 36 hours old. It never compares per-source high-water marks.

2. **The refresh can succeed with incomplete sources.** `scripts/refresh_daily.py` lines 427-460 runs collectors and then writes one global `success`. The Agilent collector is explicitly `check=False`; customer adapters may return zero without throwing. No validator requires every intended source to yield a newest record.

3. **The UI has no user-triggered refetch.** `app.js` lines 166-175 polls `refresh_status.json` hourly and reloads only if a newer published timestamp exists. It does not invoke collectors. The label “Real public data as of …” and the refresh badge therefore describe the packaged snapshot, not a live check.

4. **Reddit skip is reported as “checked_no_new_records.”** `scripts/customer_voice_ingestion/reddit_api.py` skips when credentials are absent; `scripts/collect_customer_voice.py` lines 279-292 converts every empty, non-error result into `checked_no_new_records`. This is an honesty bug: “not run” is not “checked.”

5. **Community counts are frozen by design.** ChromForum uses two fixed seeds, ranks candidates by vendor/comparison score rather than recency, and caps output at four (`chromforum.py` lines 24-26 and 64-86). LabWrench uses only two hard-coded 2016/2018 threads (`labwrench.py` lines 16-18). SelectScience uses one product seed and aggregates reviews into one record (`selectscience.py` lines 18-20 and 64-94).

6. **Round journal counts are truncation, not completeness.** `collect_scientific_sources.py` requests `rows=40`; all seven journals consequently report exactly 40 despite direct 370-day totals of 348 to 3,443.

7. **Conference “extracted” means reachable.** `collect_scientific_sources.py` lines 308-358 hashes endpoint bodies and sets `extractedRecords = reachable`; it explicitly says this is not a poster count. The UI nevertheless surfaces the number as extracted records.

8. **Regulatory “extracted” also means reachable.** Lines 361-391 set one extracted record when an official page returns 2xx/3xx, without extracting revision date, effective date, or notice content. Only the separate FDA bulk adapter performs row-level ingestion.

9. **SEC completeness is deliberately capped.** `scripts/collect_real_data.py` limits each issuer to 3 10-Ks, 9 10-Qs, and 4 8-Ks. That preserves newest-filing freshness but cannot satisfy the engine's three-year completeness claim for 8-K events.

10. **Source health conflates configuration with ingestion.** Catalog rollups and mapped sources can remain `health: good` with no extraction metadata at all (notably PerkinElmer, trade publications, and most conferences).

11. **Evidence provenance has classification drift.** Some retained Reddit URLs have `sourceIds: ["chromforum-lc-discussions"]`. The engine can therefore inflate a source's evidence count or high-water mark unless source ID, domain, and `sourceType` are reconciled at write time.

12. **The data is a mixed live/static snapshot.** PubMed/SEC and several official competitor feeds refreshed on 2026-07-29, but community, trade, conference, PerkinElmer, and regulatory page-monitoring layers are curated, capped, or endpoint-only. “Data current” is accurate only for the package timestamp, not for all sources.

## Ranked fixes

1. **Critical — make refresh success source-aware.** Persist per-source `attempted`, `succeeded`, `recordsSeen`, `sourceNewest`, `engineNewest`, `freshnessPass`, and `error`; block the global “current” claim when a required source is stale, skipped, or unverified.
2. **Critical — implement PerkinElmer newsroom/product adapters and vendor-community adapters.** Start with official RSS/sitemaps/index pages; store dated item-level records and alert on LC/LC-MS launches, collaborations, software, columns, and workflow changes.
3. **Critical — remove the four-item SEC 8-K cap for the stated window.** Paginate all filings since the cutoff, deduplicate by accession number, and test newest plus total count per issuer.
4. **Major — replace fixed community seeds with newest-first board/listing traversal.** Use robots-aware pagination, a durable high-water cursor, canonical URLs, and per-run bounds. Preserve `source item date`, `first seen`, and `last seen` separately.
5. **Major — distinguish `skipped`, `disabled`, `blocked`, `checked_empty`, and `collected`.** Never translate disabled Reddit into “checked no new records.” Add an official-API credential health check to the source panel.
6. **Major — paginate Crossref and store the whole claimed window.** Keep aggregate trend counts separately from record-level evidence; add an exact-newest DOI assertion for each journal.
7. **Major — ingest conference content, not endpoints.** Extract agenda/session/speaker/sponsor/poster records with stable IDs and dates; report endpoint health as a separate metric. Add the 25 currently mapped-only events or remove them from claimed coverage.
8. **Major — activate the nine trade-publication sources with RSS/sitemap/API adapters.** Separate editorial from sponsored content and retain direct article dates/URLs.
9. **Major — parse regulatory revision/effective dates.** Treat a 200 response as reachability only; add revision diffs for USP/ICH and row-level validation for FDA workbooks.
10. **Minor — repair provenance and UI wording.** Enforce domain/source-ID consistency and replace “Daily refresh current” with “Build published …”; show a per-source stale/partial/unverified counter next to it.

**One-line verdict:** **No — the engine is not current across all sources; LabWrench is the largest measured lag (2,703 days), while the missing PerkinElmer live adapter is the most consequential competitive freshness gap.**
