# PMM Head-to-Head Comparison Data Model

## Purpose and scope

This feature is product-led. Selecting one cataloged Waters product creates a library of competitor battlecards automatically. Each competitor card uses the highest-ranked catalog match by default, permits a product override, and opens a seller-ready pitch tailored by market, workflow/application, buying situation, geography, and buyer role. It reuses the app's product catalogs, launch comparisons, technical comparison profiles, and customer-language evidence. It does not create performance, approval, legal, pricing, service-level, or market-prevalence facts.

Every output is `DRAFT — NOT APPROVED`. Approval is not inferred from the presence of public technical evidence.

## Product-match object

`product-match-model.js` derives a full Waters-product × competitor-product table at runtime.

| Field | Definition | Source / calculation |
| --- | --- | --- |
| `watersProductId` | Stable Waters catalog product ID | `data/product_comparisons.json` → `watersSystems` |
| `competitor` | Competitor organization | Launch, historical, or comparator catalog record |
| `competitorProductId` | Stable competitor catalog product ID | Existing catalog record; never synthesized from display text |
| `score` | Deterministic similarity score from 0–100 | Technique class (42 max) + coded segment overlap (21 max) + rule-based tier match (12 max) + comparable pressure when available (10 max) + existing closest-comparator mapping (15 max) |
| `similarityBasis.techniqueClass` | UHPLC, HPLC/LC, LC-MS, LC-MS/MS, MS, or Software/CDS | Rule-based classification of existing product/technology text |
| `similarityBasis.pressureRange` | Published catalog pressure for both products, when structured values exist | Missing values remain `Not established`; the model assigns no pressure score when either side is missing |
| `similarityBasis.segment` | Coded use-context overlap | Rule-based tokens from catalog market, decision-role, and best-fit fields |
| `similarityBasis.positioningTier` | Premium/advanced, routine/value, research/specialist, or unresolved | Explicitly labeled rule-based inference |
| `similarityBasis.explicitClosestMapping` | Whether an existing launch-comparison record already names this Waters system | `launchComparisons[].closestWatersId` |

For every available competitor, the highest-scoring candidate is suggested automatically. The user can select a competitor battlecard and override its matched product independently. A tie is broken by an existing explicit mapping and then product name, ensuring stable results. A competitor filter can narrow the library, but it is not required to generate battlecards.

## Evidence and claim objects

A comparison claim contains exact statement text, evidence classification, substantiation, dated sources, established independent-source count, and a caveat.

Evidence classifications remain distinct:

- `Observed customer language` or `Observed customer concern`: direct language in a dated customer-language record.
- `Observed competitor-published value` / `Observed Waters-published value`: a value transcribed from the linked organization source.
- `Analyst/rule-based comparison of published values`: an interpretation, never an approved Waters claim.

Substantiation is calculated as follows:

- **Proven:** two or more explicitly established independent source organizations.
- **Directional:** at least one unique dated public source, but fewer than two established independent source organizations.
- **Unsupported:** no unique dated public source.

Duplicate URLs are removed before claim counts are calculated. Multiple records or links on the same URL do not become independent corroboration. A source is independent only when the evidence record explicitly carries both `independent: true` and a stable `sourceOrganizationId`, or a governed upstream record supplies an `independentSourceCount`. Domain count is not treated as independent-source count.

## Section derivations

| Section | Canonical input | Guardrail |
| --- | --- | --- |
| Positioning | Product match, Waters catalog decision role, and existing launch-comparison positioning | Point of difference is labeled proposed and not approved |
| Talk track | Product-specific Waters/competitor customer language plus supported comparison statements | Maximum five; copied/exported text excludes Unsupported statements |
| Where Waters wins | Technical comparison rows whose existing interpretation explicitly identifies a Waters advantage | Requires linked values for both sides; caveat preserves condition/comparability limits |
| Competitor weakness | Product-specific negative, mixed, or neutral customer-language record | Requires at least one dated public source; otherwise shows the mandated no-public-evidence empty state |
| Attribute scorecard | Dated product-specific customer-language signals coded to six buying attributes | Weights derive from current evidence frequency and sum to 100%; scores are sentiment-coded evidence, not performance ratings |
| Service and support | Product-specific customer evidence concerning service, support, uptime, maintenance, training, software, migration, or data integrity | Empty when no matching dated evidence exists |
| Total cost / value | Product-specific records matching qualitative value dimensions | Monetary magnitude stays an assumption; no price, savings, or ROI is inferred |
| Objection handling | Paired values from an existing technical comparison profile | Each side retains its exact source and comparability caveat |
| Customer nudge | Calculated positive swing attribute, if available | Presented as analyst/rule-based inference; otherwise recommends agreeing criteria before evaluation |

## Product-led pitch and targeting contract

The product selection is the entry condition. With no product selected, the feature shows a three-step start state rather than requesting a competitor. After selection it renders:

1. A battlecard library covering every cataloged competitor with a valid product match.
2. A selected battlecard summarized as three sourced reasons to choose Waters.
3. A tailored pitch that inherits the chosen market, workflow/application, buying situation, geography, and buyer role.
4. A selling sequence: lead message, likely competitor claim, evidence-backed response, and recommended next step.
5. Collapsed proof details containing comparative advantages, public competitor concerns, service evidence, scorecard, value assumptions, and gaps.

The tailored pitch is proposed positioning. It never converts a catalog description or customer-language record into an approved comparative claim.

## Persistence and deep-link contract

The selected Waters product comes from the PMM product filter. Market and audience controls tailor all battlecards. The optional competitor filter narrows the battlecard library; selecting a card establishes the active competitor and product. Selection is persisted locally under `competition-engine:pmm-head-to-head:v1` and shared using:

- `h2hWaters`
- `h2hCompetitor`
- `h2hProduct`
- `h2hMarket`
- `h2hApplication`
- `h2hSituation`
- `h2hBuyer`
- `h2hGeo`

An invalid or stale competitor-product ID is replaced by the highest-ranked valid candidate. Selecting no Waters product produces an explicit start state and removes head-to-head URL parameters.

## Export boundary

- Copy includes only Directional or Proven talk-track claims with at least one exact dated URL.
- PowerPoint includes only Directional or Proven claims; unsupported material appears only as an internal evidence-gap warning.
- Print/PDF hides Unsupported claim cards.
- All PowerPoint and print/PDF outputs are watermarked `DRAFT — NOT APPROVED` because no approval record is available for this feature.

## Known evidence limitations

- Public evidence is often sparse at exact product level and cannot establish prevalence, win rate, or representative customer preference.
- Technical source values may use different configurations or test conditions. They are not treated as controlled comparative studies.
- Pressure is not present as a structured catalog field for many products and remains unresolved rather than inferred.
- No governed acquisition-price, service-level, downtime-cost, or comparable EVC dataset is loaded.
- No legal/claims approval record is connected to these generated drafts.
