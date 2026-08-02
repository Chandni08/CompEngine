# Data Refresh Operations

## Schedule and truth model

Run `python3 scripts/refresh_daily.py` daily for APIs, official feeds, public newsrooms, community sources, and FDA bulk files. Conference and regulatory pages may be checked weekly operationally, but the health ledger still requires an exact newest-item comparison before marking them current.

The browser's hourly poll only reloads a newly published dataset. It does not fetch upstream sources.

## Credentials and toggles

- Reddit requires `CUSTOMER_VOICE_REDDIT_ENABLED=true`, `REDDIT_CLIENT_ID`, and `REDDIT_CLIENT_SECRET`; otherwise it records `skipped_missing_credentials`.
- ChromForum, SelectScience, and LabWrench are independently controlled by their `CUSTOMER_VOICE_*_ENABLED` flags and their documented per-run page/record bounds.
- Community crawlers fetch `robots.txt`, reject disallowed paths, use a descriptive User-Agent, persist cursors, and honor the greater of the declared crawl delay and ten seconds.
- Sources requiring login, gated content, prohibited paths, or unapproved scraping are skipped and labeled `BLOCKED` or `UNVERIFIED`.

## Failure and retry behavior

Collectors use bounded requests and timeouts. A source failure is recorded in `data/source_health.json`; it is not converted into an empty successful check. If orchestration fails, the prior validated `data/intelligence.json` is restored and `data/refresh_status.json` reports failure.

Retries should be scheduled by the orchestrator after the site's rate-limit or crawl-delay window. Do not bypass credentials, authentication boundaries, robots exclusions, or official API terms.

## Publication

Publish only after validators pass. The UI may display the build publication time, but it may show sources verified current only when `allRequiredSourcesCurrent` is true. A partial run may still package the last validated data and updated source-health ledger, but must never be labeled globally current.
