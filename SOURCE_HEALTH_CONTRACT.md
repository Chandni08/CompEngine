# Source Health Data Contract

The engine reports source verification separately from build publication. A successful build or HTTP response is never evidence that source content is current.

## Per-source record

Every recurring source is represented in `data/source_health.json` with:

| Field | Meaning |
|---|---|
| `sourceId`, `url` | Stable source identity and canonical monitored endpoint. |
| `required` | Whether this source can block the global verified-current state. |
| `collectionMethod` | API, sitemap, RSS, public page, bulk file, or other approved method. |
| `collectionOutcome` | The factual result of the latest attempt. |
| `attemptedAt`, `succeededAt` | Attempt and successful-completion timestamps. |
| `engineNewestDate`, `sourceNewestDate` | Newest ingested item versus newest qualifying source item. |
| `lagDays`, `newestItemPresent` | Exact high-water comparison. |
| `recordsSeen`, `recordsIngested` | Source items observed and records retained. |
| `completeness` | Whether all qualifying items in the configured window were captured. |
| `coverage` | Whether record-level content is ingested, not merely configured/reachable. |
| `reason` | Credential, policy, access, parsing, or completeness explanation. |
| `state` | Canonical health state derived from the fields above. |

## States

`CURRENT`, `STALE`, `PARTIAL`, `MISSING`, `UNVERIFIED`, `DISABLED`, `BLOCKED`, and `ERROR` are the only valid states.

`CURRENT` requires complete coverage, complete configured-window ingestion, and explicit proof that the newest source item is present. An authoritatively checked empty source may be current only when both coverage and completeness are complete.

## Collection outcomes

`collected`, `checked_empty`, `disabled`, `skipped_missing_credentials`, `blocked_by_policy`, `unreachable`, `partial`, `stale`, and `error` are distinct. A missing credential cannot become `checked_empty`.

## Global gate

`allRequiredSourcesCurrent` is true only when every required source is `CURRENT`. Otherwise `sourcesVerifiedAt` is null and `requiredSourceBlockers` names each blocker. `buildPublishedAt` only states when the packaged dataset was built.

Curated/manual records may remain available to the product but never prove automated-source health.
