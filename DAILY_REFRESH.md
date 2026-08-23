# Daily Content Refresh

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

## Three-Year Historical Coverage

The supported historical horizon begins in July 2023. Each daily refresh keeps:

- cumulative PubMed counts for 30 days, 60 days, 90 days, one year, and three years;
- representative PubMed records from each one-year slice of the three-year window;
- up to three annual filings, nine quarterly filings, and four recent 8-K filings per public competitor parent within the window;
- dated curated product launches and customer-voice evidence that fall within the same window.

The dashboard must not expose a longer horizon unless the refresh pipeline contains traceable records and counts for that period.

## Schedule

`.github/workflows/daily-content-refresh.yml` runs in GitHub Actions and can also be started manually from GitHub Actions.

The scheduled job is pinned to `7:00 AM America/New_York` year-round by running twice in UTC and skipping the non-matching run.

The scheduler runs entirely on GitHub-hosted infrastructure. It does not require Codex, a ChatGPT session, or a powered-on laptop. Configure these GitHub repository secrets:

- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

The workflow and the local scheduler use the same portable batch entry point, `scripts/run_daily_refresh.sh`. GitHub passes `--refresh-only` because commit and deployment are handled by later workflow steps. The batch job:

1. Runs `scripts/refresh_daily.py` through the available Python 3 executable.
2. Collects the automated public-source data.
3. Validates signal volume, recommendations, publication themes, dates, and cumulative horizon counts.
4. Checks every public URL in `data/`, follows redirects, and writes `data/link_health.json`.
5. Validates every customer-voice source keyword against the exact linked page; Reddit records use Reddit's canonical oEmbed title so bot challenges cannot create a false pass.
6. Fails the refresh and deployment when a displayed customer-voice keyword is absent, a source cannot be read, or any URL returns 404/410 or has a DNS failure or timeout.
7. Reconciles every Agilent current-year newsroom/IR archive record—not only the recent replay window—against the published intelligence dataset, and fails on missing or duplicate releases.
8. Restores every data artifact from the last good dataset if collection, high-water verification, or validation fails.
9. Synchronizes `data/` with `deploy-site/data/`.
10. Commits the validated data to the repository.
11. Deploys `deploy-site/` directly to Vercel with the repository secrets, assigns `waters-nextgen-competitive-engine.vercel.app`, and verifies that the live `refresh_status.json` reports success, complete required-source coverage, and today's New York dataset date.

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

- Source authority: 30 points. SEC filings and official press releases score highest, PubMed is medium authority, and public forums are low-but-real.
- Recency: 25 points. Evidence decays from the dataset's `asOfDate` with a 180-day half-life.
- LC relevance: 30 points. Explicit references to LC, HPLC, UHPLC/UPLC, LC-MS, columns, pumps, and chromatography software contribute weighted points.
- Corroboration: 15 points. More unique source records supporting the same theme increase the contribution logarithmically.

Scores of 75-100 are High, 50-74 are Medium, and 0-49 are Low. Each signal stores the four contributions in `scoreBreakdown`. The scorer refuses to write the dataset if more than 20% of signals share one integer score.

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

GitHub Actions publishes only after the refresh and every deployment gate succeeds. A partial refresh never deploys: every required source must prove complete traversal and exact newest-item presence. Failed collection, blocked pagination, stale high-water marks, or validation failures leave the last verified production build unchanged.

The dashboard reads `data/refresh_status.json` and shows whether the daily refresh is current, overdue, or failed. A page left open checks hourly for a newly published dataset and reloads when one is available.

## Agilent Monitoring

The Agilent connector uses `sitemap.xml`, the product sitemap files, the dated press-release index, and investor relations. It stores a baseline in `data/source_snapshots/agilent.json` and reports differences in `data/agilent_monitor.json`. Every refresh emits `all_press_releases` for the complete official current-year archive and merges that set into `data/intelligence.json`; `recent_press_releases` remains available for rolling-window analysis but is never used as the completeness boundary. When newsroom and IR pages syndicate the same release, the canonical record preserves the richer IR classification and earnings metadata.

An HTTP 403 caused by Agilent's WAF is treated as a collection-method issue, not a reliability penalty. The collector identifies itself honestly, avoids disallowed paths, spaces requests, applies the investor site's 10-second crawl delay, and never impersonates a whitelisted crawler.

## Competitor Extraction

`scripts/collect_competitors.py` monitors Thermo Fisher, Shimadzu, and SCIEX using only official, robots-declared sitemaps and official dated press/news indexes. It stores per-competitor baselines in `data/source_snapshots/` and writes changes to `data/competitor_monitors.json` using the same change shape as the Agilent monitor.

Reachability and extraction are separate states. A page can return HTTP 200 while still presenting a bot-protection interstitial or no machine-usable release index. Such a source is recorded in `data/source_catalog.json` as `extractionStatus: "blocked"` with an explicit reason and contributes no fabricated signals.

## Important Boundary

The Agilent sitemap can prove that a page was added, removed, or updated; it cannot by itself prove commercial launch or discontinuation. The dashboard labels these as portfolio-change signals until an official release or manual review confirms the lifecycle event. Customer sentiment and PM recommendations remain curated.
