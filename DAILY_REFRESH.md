# Daily Data Refresh and Deployment

The website includes a fail-safe daily refresh pipeline.

## What Refreshes Automatically

- PubMed publication counts and competitor-linked publications
- Recent DOI metadata from Analytical Chemistry, Journal of Chromatography A and B, JASMS, Analytical and Bioanalytical Chemistry, Journal of Pharmaceutical and Biomedical Analysis, and Talanta
- Official ASMS, HPLC Symposium, IMSC, MSACL, and European Bioanalysis Forum program and poster endpoints
- Official USP <621>, <1058>, and <232>/<233>; ICH Q2(R2) and Q14; and FDA Warning Letter and Form 483 sources
- SEC filing discovery
- Availability checks for registered competitor sources
- Agilent LC/MS product additions, removals, and page updates from authoritative sitemaps
- Agilent product, corporate, regulatory, and earnings updates from the complete current-year newsroom and investor-relations archive
- Thermo Fisher LC/LC-MS product pages from its official US sitemap
- Thermo Dionex Integrion and ICS-series ion chromatography pages, tagged to Environmental and Food & Beverage
- Thermo Vanquish Neo nano-LC pages, tagged to Biopharma and Academic
- Shimadzu LC/LC-MS product pages and dated releases from its official analytical sitemap and news index
- SCIEX LC/MS/software product pages and dated releases from its official sitemap and press index

The collector preserves the human-reviewed product launches, product comparisons, partnerships, conference preparation, customer voice, and PM recommendations already in the data files.

## Dataset Date and Source Verification

`asOfDate` describes the data, not the run. When a domain cannot be collected it falls back to the previous dataset and contributes that dataset's date, and the published `asOfDate` is the oldest contributing domain: the dataset as a whole is only current as of its least current part. Per-domain dates are recorded in `domainAsOfDates`. The publish gate rejects a future `asOfDate`, an `asOfDate` that disagrees with the contributing domains, and any run in which a domain backing a required source fell back to retained data.

Every source row in `data/source_health.json` must compare the collected records against an observation of the *live* source, recorded in `sourceObservation`. A row whose source-side high-water fields were copied from the stored dataset is reported as unverified rather than current: comparing the dataset with itself can never fail, so it proves nothing. For PubMed the independent evidence is the live newest-PMID query per configured theme; for SEC EDGAR it is the newest in-window filing observed in the live submissions feed, stored in `sourceHighWater`.

Records carry both `contentAsOf`, when the content was last actually read from the source, and `stampedAt`, when the provenance pass last ran. A provenance pass never advances `contentAsOf` or `retrievalDate` for a record no collector reached.

## Link Updates

A tracked link can change in three ways, and the refresh has to notice all three.

**A link dies.** `scripts/check_links.py` fails publication on any 404/410, DNS failure, or redirect into an error or sign-in destination.

**A link moves.** Sitemap diffing cannot see this: the URL stays listed and still answers 200 once the redirect is followed. The checker therefore compares the requested URL with the served URL on every successful request and classifies the difference:

- `normalized` — a locale prefix, scheme, trailing slash, index document, or tracking parameter. The stored URL is rewritten in place across `data/`, and the rewrite is listed under `rewrittenLinks` in `data/link_redirects.json`. Sitemap snapshots under `data/source_snapshots/` are never rewritten: the collectors diff them by exact URL string, so canonicalising a key there would invent a change on the next run.
- `moved` — the same site now serves that address from a different path. For a vendor product page this is a lifecycle event: a retirement, a successor, or a family consolidation. It is reported, never silently followed.
- `offsite` — the address now resolves to a different domain.
- `resolved` — a DOI or other persistent-identifier resolver reaching its publisher, which is the mechanism working rather than a link update.

`merge_link_redirects` turns each `moved` or `offsite` link that the dataset actually cites into a `Source page redirected` signal carrying both addresses, so a product retirement surfaces for review instead of leaving the dashboard showing a superseded product as current.

**A page changes at a stable address.** The competitor and Agilent monitors detect sitemap additions, removals, and `lastmod` changes, but the publish gate requires a real before/after artifact (`provenance.valid_change_evidence`). The collectors fetch the affected pages, hash their visible text, and attach that evidence:

- an addition needs HTTP 200 and readable content;
- a removal needs a 404/410, or a content change on a page that left the sitemap but still answers;
- a `lastmod` bump is only a change if the content hash actually differs.

Volatile markup — CSRF tokens, session identifiers, timestamps — is stripped before hashing so a page does not appear to change on every request. Hashes are stored in each snapshot's `productContentHashes`; each run also seeds baselines for a rotating slice of pages that have never been hashed, so a first-ever `lastmod` change has something to compare against. Both collectors work within a per-run request budget, and observations that could not be substantiated stay visible under `unverified_inventory_changes.withheldForMissingEvidence` rather than disappearing.

### Link-check coverage

The walk is recursive and reads URLs in both key and value position, so tracked pages inside `data/source_snapshots/` are covered. Bulk journal records are rendered by the dashboard, so they are no longer skipped outright: a deterministic rotating slice is checked each day and the whole set is covered every `BULK_ROTATION_DAYS`. Bucketing is by a stable hash of the URL rather than list position, so coverage stays even as records are added and removed.

### Required sources

A source marked `required` blocks publication when it is not current. Conference sources are required by default, with one exception: an organiser that publishes its programme only through an event platform, with no machine-readable public page, is monitored for context and cannot gate the refresh. `conference-acs-*` is currently the only such case — the ACS Spring and Fall sources carry `required: false` in `data/source_catalog.json` with the reason in `requiredRationale`, and `conference_source_is_required` applies that default by id prefix so a future year's event id cannot silently reinstate the block. An explicit value in the catalog always wins.

Non-required means "does not block", never "reported as healthy": an unreachable optional source still appears in `data/source_health.json` with its real state and reason.

### Press index coverage

Shimadzu and SCIEX publish dated releases on a year-scoped index. The collectors read every year the rolling replay window still reaches into — so from January the previous year stays in scope — and follow the index's own pagination, bounded by `PRESS_INDEX_MAX_PAGES`. An index that loads and parses but holds no in-scope release reports `checked_empty`, which is a successful check; only an unreachable index, or one that yields no parseable entries at all, reports `blocked`. Requiring records here used to fail the entire refresh for the first days of every January.

## Three-Year Historical Coverage

The supported historical horizon begins in July 2023. Each daily refresh keeps:

- cumulative PubMed counts for 30 days, 60 days, 90 days, one year, and three years;
- representative PubMed records from each one-year slice of the three-year window;
- up to three annual filings, nine quarterly filings, and four recent 8-K filings per public competitor parent within the window;
- dated curated product launches and customer-voice evidence that fall within the same window.

The dashboard must not expose a longer horizon unless the refresh pipeline contains traceable records and counts for that period.

## Schedule

`.github/workflows/daily-content-refresh.yml` owns data refresh and can also be started manually from GitHub Actions. It never deploys a website.

The scheduled job targets `7:17 AM America/New_York` year-round. Three offset-aware UTC triggers cover daylight and standard time plus a same-day fallback. The gate uses the cron expression and the published dataset date instead of the runner's start hour, so a GitHub scheduling delay cannot cause a needed refresh to be skipped.

The scheduler runs entirely on GitHub-hosted infrastructure. It does not require Codex, a ChatGPT session, or a powered-on laptop.

The data-refresh workflow uses these source credentials when enabled:

- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`

The data workflow and the local scheduler use the same portable batch entry point, `scripts/run_daily_refresh.sh`. GitHub passes `--refresh-only`; the data-refresh job:

1. Runs `scripts/refresh_daily.py` through the available Python 3 executable.
2. Collects the automated public-source data.
3. Validates signal volume, recommendations, publication themes, dates, and cumulative horizon counts.
4. Checks every public URL in `data/`, follows redirects, and writes `data/link_health.json`.
5. Validates every customer-voice source keyword against the exact linked page; Reddit records use Reddit's canonical oEmbed title so bot challenges cannot create a false pass.
6. Fails the refresh when a displayed customer-voice keyword is absent, a source cannot be read, or any URL returns 404/410 or has a DNS failure or timeout.
7. Reconciles every Agilent current-year newsroom/IR archive record—not only the recent replay window—against the published intelligence dataset, and fails on missing or duplicate releases.
8. Rebuilds the PM recommendation queue, current evidence counts, considerations, and decision implications from the fully refreshed dataset; the gate rejects stale recommendation-generation dates or missing implications.
9. Restores every data artifact from the last good dataset if collection, high-water verification, or validation fails.
10. Synchronizes `data/` with `deploy-site/data/`.
11. Commits the validated data to the repository.

Website deployment is intentionally not scheduled by this workflow. Use the manual deployment process when a validated data or interface update should be published.

`SKIP_LINK_CHECK=1` skips the external recheck and retains the last validated link-health artifact. It never promotes a source: a required source that is unreachable now stays unverified and still blocks publication, because carrying a previous run's result forward for a source that cannot be reached today is a verification the run did not perform.

The link gate distinguishes a proven dead link from access-control behavior. HTTP 404/410 responses normally fail publication. The only exceptions remain blocked and visibly unverified: a domain-wide FDA 404 pattern that was healthy before the GitHub-runner anomaly began, and an allowlisted publisher URL that changes from a recorded bot challenge to a runner-only 404. These exceptions never promote a URL to healthy and do not weaken required-source high-water checks.

The cloud job sets `SKIP_REFRESH_EXPORTS=1` because the leadership PowerPoint builder uses a local Codex artifact runtime and the scheduled workflow commits only refreshed JSON. This does not skip a data source, source-health check, or dashboard artifact; local runs continue to rebuild the PowerPoint.

## Local Manual Run

```bash
python3 scripts/refresh_daily.py
```

To run only the URL check:

```bash
python3 scripts/check_links.py
```

To run the customer-voice source-keyword deployment gate:

```bash
node scripts/validate_customer_voice_sources.mjs
node scripts/validate_product_launch_press_releases.mjs
node scripts/validate_thermo_monitoring.mjs
```

## Signal Priority Scoring

`scripts/score.py` replaces the former confidence, impact, and urgency fields with one auditable `priorityScore` from 0 to 100:

- Source authority: 25 points. Resolved from the publisher host and the record kind, not from substring matches on concatenated text. Government and regulatory filings score highest, then peer-reviewed records, then dated official announcements. A monitored catalogue page scores low: it proves a URL exists, not that anything was announced.
- Evidence status: 15 points. `verified` scores full, `partial` scores 8, and `unsupported`, `contradicted`, or `unreachable` score zero.
- Recency: 20 points. Evidence decays from the dataset's `asOfDate` with a 180-day half-life, but only from an *event* date. A record whose date is an ingestion or retrieval timestamp scores zero recency, because that date records when the crawler looked rather than when anything happened. A date that cannot be parsed also scores zero rather than being treated as today's.
- LC relevance: 25 points. The strongest matched term sets the base and each further distinct term adds two points, so records do not all saturate at the cap.
- Corroboration: 15 points. Counted from distinct *organizations* represented in a theme, never from the number of records. A theme carrying two hundred pages from one vendor is not corroborated. Where every organization is describing itself — vendor pages, or a registrant's own filings — the contribution is capped at 7 because issuer self-description is not independent confirmation. PubMed and SEC are treated as registries rather than publishers, so each paper counts as its own author group and each filing as its own registrant.

Scores of 75-100 are High, 50-74 are Medium, and 0-49 are Low. Each signal stores the five contributions in `scoreBreakdown`, each with the basis on which it was awarded.

The scorer refuses to write the dataset in two cases:

- Records classified `unsupported` rank at or above records classified `verified`. A ranking that points the reader at the weakest evidence is not publishable.
- More than 25% of *distinct input combinations* collapse onto one integer score. This measures distinct inputs rather than raw signals: records with identical inputs are expected to tie, so a large set of genuinely indistinguishable sitemap pages cannot halt the refresh for agreeing with each other.

## Local Daily Schedule

On this Mac, `com.waters.competition-engine.daily-refresh` may wake the Codex desktop app for manual local operation, but it is not part of production scheduling or deployment. GitHub Actions is the independent production scheduler. The local wrapper has a process lock so a duplicate trigger exits safely. Logs are written to:

- `logs/daily-refresh.log`
- `logs/daily-refresh-error.log`

`scripts/run_daily_refresh.sh` provides the equivalent wrapper for a manual local run.

To run the complete refresh and validation batch without deploying, use:

```bash
scripts/run_daily_refresh.sh --refresh-only
```

The script derives the repository root from its own location. `COMPETITION_ENGINE_ROOT` and `COMPETITION_ENGINE_PYTHON` are optional overrides for non-standard installations.

GitHub Actions emits a deployment reference only after the complete data refresh and every data-quality gate succeed. A partial refresh never triggers deployment: every required source must prove complete traversal and exact newest-item presence. Failed collection, blocked pagination, stale high-water marks, or validation failures leave the canonical validated commit and production builds unchanged. Deployment failures are reported per platform and do not change data-refresh success.

The dashboard reads `data/refresh_status.json` and shows whether the daily refresh is current, overdue, or failed. A page left open checks hourly for a newly published dataset and reloads when one is available.

## Agilent Monitoring

The Agilent connector uses `sitemap.xml`, the product sitemap files, the dated press-release index, and investor relations. It stores a baseline in `data/source_snapshots/agilent.json` and reports differences in `data/agilent_monitor.json`. Every refresh emits `all_press_releases` for the complete official current-year archive and merges that set into `data/intelligence.json`; `recent_press_releases` remains available for rolling-window analysis but is never used as the completeness boundary. When newsroom and IR pages syndicate the same release, the canonical record preserves the richer IR classification and earnings metadata.

An HTTP 403 caused by Agilent's WAF is treated as a collection-method issue, not a reliability penalty. The collector identifies itself honestly, avoids disallowed paths, spaces requests, applies the investor site's 10-second crawl delay, and never impersonates a whitelisted crawler.

## Competitor Extraction

`scripts/collect_competitors.py` monitors Thermo Fisher, Shimadzu, and SCIEX using only official, robots-declared sitemaps and official dated press/news indexes. It stores per-competitor baselines in `data/source_snapshots/` and writes changes to `data/competitor_monitors.json` using the same change shape as the Agilent monitor.

Reachability and extraction are separate states. A page can return HTTP 200 while still presenting a bot-protection interstitial or no machine-usable release index. Such a source is recorded in `data/source_catalog.json` as `extractionStatus: "blocked"` with an explicit reason and contributes no fabricated signals.

## Important Boundary

The Agilent sitemap can prove that a page was added, removed, or updated; it cannot by itself prove commercial launch or discontinuation. The dashboard labels these as portfolio-change signals until an official release or manual review confirms the lifecycle event. Customer sentiment and PM recommendations remain curated.
