# Freshness Remediation Mapping

| Audit finding | Collector / remediation | Health contract / validator | UI or report behavior | Regression test |
|---|---|---|---|---|
| Global timestamp falsely implied freshness | `refresh_daily.py`, `source_health.py` | Required-source gate; atomic ledger | Build publication and source verification are separate | Required stale/skipped blocks current |
| Reddit not run reported empty | `collect_customer_voice.py`, official API adapter | `skipped_missing_credentials` → `UNVERIFIED` | Credential gap is explicit | Missing credentials outcome |
| ChromForum fixed/relevance-ranked seeds | `chromforum.py` | Newest-first pagination plus durable cursor | New records feed existing schema | Newest board item selected |
| LabWrench fixed historical threads | `labwrench.py` | Newest-first forum traversal plus durable cursor | New records feed existing schema | Board traversal selected |
| SelectScience reviews collapsed | `selectscience.py` | One canonical evidence record per public review | Existing cards count independent review URLs | Individual review records |
| Community provenance drift | `collect_customer_voice.py` | Domain, source ID, and type reconciliation | Counts cannot be attributed to the wrong source | Identity reconciliation |
| Crossref capped at 40 | `collect_scientific_sources.py` | Cursor pagination, complete 370-day scope, newest DOI evidence | Full dated records remain separate from trend aggregates | >40 records and newest DOI |
| PubMed samples looked complete | `collect_real_data.py`, `refresh_daily.py` | Query time/count/newest PMID; item scope is `representative_sample` and health is `PARTIAL` | No false complete claim | Source gate coverage |
| SEC 8-K cap omitted events | `collect_real_data.py` | All in-window filings, accession dedup | Presentation may rank without deleting source records | All 8-Ks retained/deduped |
| PerkinElmer mapped without live collection | `collect_perkinelmer.py` | Official robots-aware sitemap/newsroom/product status | Perkin records become item-level evidence when available | Contract and fresh-run audit |
| FDA warning letters stale | `fda_bulk.py` | Workbook vintage, Last-Modified, parsed/qualifying counts, newest dates | Bulk rows—not rendered-page reachability—prove status | Regulatory reachability test plus audit |
| Conference endpoint count called records | `collect_scientific_sources.py` | Endpoint metadata separated from stable content records | Reachability never appears as content count | Endpoint/content count separation |
| Only five conferences selected | `collect_scientific_sources.py` | Every configured event is attempted; inaccessible content remains partial/error | Claimed coverage matches ledger | Fresh-run audit |
| Regulatory HTTP 200 called fresh | `collect_scientific_sources.py` | Content identity and public scope required; revision/effective dates retained only when verified | Preview-only USP remains partial/unverified | HTTP 200 cannot pass |
| Trade/vendor communities mapped only | source catalog plus health migration | No permitted collector → optional `BLOCKED`/`UNVERIFIED`, never current | Coverage inventory remains honest | Ledger audit |
| Competitor feed histories are rolling/partial | official competitor collectors | Source-specific counts and partial/complete status | Current newest item does not imply historical completeness | Fresh-run audit |
| Refresh failure could replace validated output | `refresh_daily.py` | Restore prior validated `intelligence.json`; failed status persisted | Last validated dataset stays available | Failed refresh retention |

The mapping is intentionally source-specific: a validator cannot infer freshness from reachability, sitemap `lastmod`, a package build time, or the continued presence of historical records.
