# Daily Content Refresh

The website includes a fail-safe daily refresh pipeline.

## What Refreshes Automatically

- PubMed publication counts and competitor-linked publications
- SEC filing discovery
- Availability checks for registered competitor sources
- Agilent LC/MS product additions, removals, and page updates from authoritative sitemaps
- Agilent product and corporate announcements from its dated press-release index
- Thermo Fisher LC/LC-MS product pages from its official US sitemap
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

`.github/workflows/daily-content-refresh.yml` runs every day at 10:15 UTC and can also be started manually from GitHub Actions.

The workflow:

1. Runs `scripts/refresh_daily.py`.
2. Collects the automated public-source data.
3. Validates signal volume, recommendations, publication themes, dates, and cumulative horizon counts.
4. Checks every public URL in `data/`, follows redirects, and writes `data/link_health.json`.
5. Fails the refresh when any URL returns 404/410 or has a DNS failure or timeout; access controls and bot-protection responses remain blocked rather than dead.
6. Restores the last good dataset if collection or validation fails.
7. Synchronizes `data/` with `deploy-site/data/`.
8. Commits the validated data so a Git-connected Vercel project redeploys.

For a Vercel project that is not connected to Git, add a repository secret named `VERCEL_DEPLOY_HOOK` containing a Vercel Deploy Hook URL.

## Local Manual Run

```bash
python3 scripts/refresh_daily.py
```

To run only the URL check:

```bash
python3 scripts/check_links.py
```

## Signal Priority Scoring

`scripts/score.py` replaces the former confidence, impact, and urgency fields with one auditable `priorityScore` from 0 to 100:

- Source authority: 30 points. SEC filings and official press releases score highest, PubMed is medium authority, and public forums are low-but-real.
- Recency: 25 points. Evidence decays from the dataset's `asOfDate` with a 180-day half-life.
- LC relevance: 30 points. Explicit references to LC, HPLC, UHPLC/UPLC, LC-MS, columns, pumps, and chromatography software contribute weighted points.
- Corroboration: 15 points. More unique source records supporting the same theme increase the contribution logarithmically.

Scores of 75-100 are High, 50-74 are Medium, and 0-49 are Low. Each signal stores the four contributions in `scoreBreakdown`. The scorer refuses to write the dataset if more than 20% of signals share one integer score.

## Local Daily Schedule

On this Mac, `com.waters.competition-engine.daily-refresh` runs the refresh at 6:15 AM local time through `launchd`. The installed job runs `scripts/refresh_daily.py` through an inline shell command, keeps the Mac awake while collection is running, and writes logs to:

- `logs/daily-refresh.log`
- `logs/daily-refresh-error.log`

`scripts/run_daily_refresh.sh` provides the equivalent wrapper for a manual local run.

The local scheduler updates the local website data. It does not publish those changes to Vercel; publishing still requires a Git-connected deployment or a separate deployment trigger.

The dashboard reads `data/refresh_status.json` and shows whether the daily refresh is current, overdue, or failed. A page left open checks hourly for a newly published dataset and reloads when one is available.

## Agilent Monitoring

The Agilent connector uses `sitemap.xml`, the product sitemap files, the dated press-release index, and investor relations. It stores a baseline in `data/source_snapshots/agilent.json` and reports differences in `data/agilent_monitor.json`.

An HTTP 403 caused by Agilent's WAF is treated as a collection-method issue, not a reliability penalty. The collector identifies itself honestly, avoids disallowed paths, spaces requests, applies the investor site's 10-second crawl delay, and never impersonates a whitelisted crawler.

## Competitor Extraction

`scripts/collect_competitors.py` monitors Thermo Fisher, Shimadzu, and SCIEX using only official, robots-declared sitemaps and official dated press/news indexes. It stores per-competitor baselines in `data/source_snapshots/` and writes changes to `data/competitor_monitors.json` using the same change shape as the Agilent monitor.

Reachability and extraction are separate states. A page can return HTTP 200 while still presenting a bot-protection interstitial or no machine-usable release index. Such a source is recorded in `data/source_catalog.json` as `extractionStatus: "blocked"` with an explicit reason and contributes no fabricated signals.

## Important Boundary

The Agilent sitemap can prove that a page was added, removed, or updated; it cannot by itself prove commercial launch or discontinuation. The dashboard labels these as portfolio-change signals until an official release or manual review confirms the lifecycle event. Customer sentiment and PM recommendations remain curated.
