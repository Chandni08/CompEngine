# Product Marketing Director Acceptance Review

Review date: 2026-07-29
Data shown by the application: public evidence as of 2026-07-28
Candidate tested: local `deploy-site` build at `http://127.0.0.1:4173/`
Release recommendation: **NO-GO — not Director-ready**

The release threshold requires every review criterion to score at least 4/5. Five of seven criteria miss that threshold. The most serious blockers are missing downstream content for validated-method-migration/inertia targets and unusable one-page battlecard exports caused by severe text overlap.

## Seven-criterion acceptance scorecard

| Criterion | Score | Result | Director-level finding |
| --- | ---: | --- | --- |
| 1. KPI and filter reconciliation | 3/5 | Blocked | Four scenarios reconcile. Pharma QC shows one exact customer source in the sidebar but zero in the destination panel; the do-nothing scenario shows seven versus zero. |
| 2. Governing-position derivation | 3/5 | Blocked | Visible decisions trace to the governing-position ID and report aligned adaptations. Pharma QC renders no decision; the do-nothing scenario renders decisions but leaves the governing swing unresolved. All Markets also presents Pharma as the “chosen segment” while the governing object says priority segment unresolved. |
| 3. Buying committee and swing cascade | 3/5 | Blocked | Rendered committees contain all seven required roles and weights total 100%. Pharma QC and do-nothing render no committee or scorecard. Oligo and PFAS committees are structurally complete but all seven roles are inferred. |
| 4. Claims, proof compatibility, and break controls | 5/5 | Pass | No unapproved claim is Ready. Inapplicable proof is blocked, unsupported claims appear in the break report, and zero canonical evidence references are unresolved. |
| 5. ACCORD and EVC coverage | 3/5 | Blocked | All rendered plans expose six ACCORD dimensions, ten EVC drivers, named baselines, unsourced assumptions, and a blocked value-claim gate. Pharma QC and do-nothing render no plan. |
| 6. Activation artifact usability and governance | 2/5 | Blocked | Seven draft artifacts and approved-copy blocking render in four scenarios; none render in Pharma QC or do-nothing. PPTX/DOCX/CSV files open and preserve links and watermarks, but every inspected one-page battlecard has severe overlapping text. The regulated-claims-sheet DOCX is also the same long-form structure as the positioning brief, not a concise claims sheet. |
| 7. Provenance and commercial safety | 4/5 | Pass with conditions | Every canonical reference resolves to an appendix object; unsupported, inferred, hypothetical, and unapproved states are explicit. However, many appendix entries have unresolved dates and the evidence base is public-only, with no win/loss, CRM, approval, or economic outcome data. |

Overall: **23/35 (3.3/5)**. This is below the threshold, and five individual criteria score below 4/5.

## Scenario results

Counts are shown as `positioning decisions / claims without approval / exact customer URLs / appendix URLs`.

| Scenario | Counts | Governing position and swing | Committee | Claims / break gate | ACCORD / EVC | Artifacts | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| All markets, one year | `3 / 14 / 22 / 415` | Traces aligned; Pharma reliable routine execution, 20% hypothesis weight | Three committees; seven roles each; 100% weights | 14 Unsupported; 14 Inapplicable; 40 break items | Three plans; all six dimensions; value claims blocked | Seven drafts; export works; battlecard overlaps | Fail |
| Biopharma → Oligo | `3 / 6 / 0 / 27` | Traces aligned; method transfer and continuity, 30% hypothesis weight | One seven-role committee; every role inferred | Six Directional; nine inapplicable records; 19 break items | One plan against a named SCIEX baseline; value claim blocked | Seven drafts; export works; battlecard overlaps | Fail |
| Environmental → PFAS | `3 / 7 / 0 / 29` | Traces aligned; reliable routine execution, 30% hypothesis weight | One seven-role committee; every role inferred | Six Unsupported, one Directional; 11 inapplicable records; 27 break items | One plan against Shimadzu LCMS-8065XE; value claim blocked | Seven drafts; export works; battlecard overlaps | Fail |
| Pharma QC → validated-method migration | `0 / 0 / 1 / 1` | Target adaptation renders, but no decision and no swing | None; seven roles reported missing | No claim rows; break report shows eight gaps | None | None | Fail |
| Agilent competitive replacement | `2 / 3 / 2 / 21` | Traces aligned; reliable routine execution, 23% hypothesis weight | Two committees; one is labeled “Unspecified public contributor” | Three Directional; 12 break items | Two plans; named Agilent baseline unresolved at exact product/workflow level | Seven drafts; export works; battlecard overlaps | Fail |
| Do nothing / keep validated method | `3 / 4 / 7 / 28`, but customer destination shows `0` | Decision traces align; governing swing unresolved | None; seven roles reported missing | Two Directional, two Unsupported; 11 break items | None | None | Fail |

The inertia alternative itself is present and classified as observed customer evidence with two canonical references. Outsourcing and CRO/CDMO alternatives are visible and correctly labeled as strategic hypotheses with no direct source references.

## Export verification

- UI export actions reported successful downloads for All Markets, Biopharma/Oligo, Environmental/PFAS, and Agilent replacement.
- All six inspected OOXML files pass ZIP integrity checks.
- External hyperlinks survive export: three per tested one-page battlecard, 18 in the sales deck, and 18 in each tested DOCX.
- `DRAFT — NOT APPROVED` is present in every tested exported file.
- Automated PPTX canvas-overflow checks passed, but visual inspection found severe collisions in every one-page battlecard. The automated check is insufficient because the objects remain on-canvas while overlapping one another.
- Both DOCX exports render across five pages without clipping or object overlap. The final evidence pages are link-dense, and the regulated claims sheet is not differentiated enough from the positioning brief.

## Source-link reachability

The six scenarios expose 420 unique HTTP(S) source URLs.

- 304 returned HTTP 200.
- 116 returned HTTP 403 and remain blocked/unverified by automated checking: 43 SEC, 37 Agilent, 18 PubMed, 17 Waters, and one Waters Help URL.
- Zero URLs were confirmed unreachable by HTTP 404/410 or DNS failure during this run.

This does not prove the 116 blocked links are dead; it means the release gate cannot automatically verify them. A browser/session-based spot check is still required for high-priority evidence used in active claims or artifacts.

## Remaining evidence gaps

- No legal/claims approval records, approver identities, approved wording, expiration dates, or claim owners are loaded.
- No approved governing-position record or review date is loaded.
- Oligo and PFAS have no exact customer-language URLs under the selected hierarchy; every buying-committee role is inferred.
- No direct win/loss evidence establishes competitor, outsourcing, CRO/CDMO, or inertia prevalence.
- No CRM, installed-base, opportunity, renewal, pipeline, price, discount, share, or revenue-at-risk data is connected.
- EVC has no sourced numeric time, cost, effort, downtime, service, rework, review, training, consumables, or outsourcing values. All ten inputs remain unsourced assumptions.
- No approved economic-model owner or monetary conversion logic is loaded.
- No comparable prior PMM snapshot exists, so change detection remains unavailable.
- Appendix records with unresolved dates remain material: 14 in All Markets, 14 in Oligo, 16 in PFAS, five in Agilent replacement, and 12 in the do-nothing scenario.

## Public-evidence-only blind spots

- Forum evidence is complaint-biased and not representative market research.
- Competitor application notes, launches, filings, conferences, and public pages show messaging activity, not adoption, preference, win rate, or commercial impact.
- Public evidence cannot establish Waters account exposure, installed-base migration propensity, service performance, comparative TCO, or buyer attribute weights.
- Fishbein weights and scores are explicit hypotheses, not survey, conjoint, or win/loss findings.
- A source URL count is evidence coverage, not independent corroboration or market attractiveness.

## Required legal and claims actions

1. Approve or reject the governing position, identify the approver, and record a review date.
2. For every proposed claim, record exact approved wording, legal/claims approval state, owner, expiration date, and next action.
3. Complete the exact studies named by the registry before changing substantiation from Directional/Unsupported or allowing Ready status.
4. Keep all value claims blocked until the EVC baseline, inputs, sensitivity ranges, economic owner, and claims approval are established.
5. Preserve the approved-copy restriction; no approved wording exists in the current dataset.

## Limitations that could mislead the commercial team

- “Chosen segment: Pharma” in All Markets can read as an approved segment choice even though the governing object says the priority segment is unresolved.
- “Unspecified public contributor” is rendered as a priority segment and adoption plan in the Agilent replacement scenario.
- Structurally complete committees may appear evidence-backed even when all seven roles are inferred, as in Oligo and PFAS.
- The Pharma QC and do-nothing cascades stop before committee, adoption, and activation; users could assume there is no required work rather than recognize a derivation failure.
- The sidebar can show customer-source counts that the destination panel does not expose.
- Battlecard downloads look successful in the UI but are not usable due to overlapping content.
- The regulated claims sheet title implies a governed registry artifact, but its exported structure largely repeats the positioning brief.

## Release recommendation

Do not release this candidate for Director or commercial-team use. The minimum next release gate is:

1. Fix the validated-method-migration and inertia cascade so a safe, explicitly unresolved committee, ACCORD/EVC plan, and artifact set can render without importing unrelated evidence.
2. Reconcile customer-source KPIs with the exact destination object under empty/partial hierarchies.
3. Redesign the one-page battlecard export and visually re-test every generated competitor/segment combination.
4. Create a distinct regulated-claims-sheet export that carries registry fields rather than the generic brief structure.
5. Remove or relabel pseudo-segments such as “Unspecified public contributor,” and stop presenting an inferred top decision as a chosen segment.
6. Add scenario tests for Pharma QC validated-method migration and do-nothing, plus visual export regression checks that detect object overlap.

## Validation artifacts

- `unit-tests.tap`: repository suite, 329/329 passing.
- `scenario-acceptance.tap`: Director gate, 2/7 passing and 5/7 failing.
- `source-link-results.json`: 420 unique scenario URLs with reachability classifications.
- Six scenario JSON captures and six desktop screenshots.
- One mobile screenshot at 390×844; no horizontal overflow, eight primary sections, and visible keyboard focus styling on appendix summaries were observed. Automated Enter/Space activation was not conclusive in the browser harness, so a manual assistive-technology keyboard check remains required.
- PPTX, DOCX, and CSV sample exports plus rendered slide/page images.

The public site was not changed or deployed during this review.
