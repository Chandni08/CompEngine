import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Product Marketing inherits the Product Management panel hierarchy", async () => {
  const index = await readFile(new URL("index.html", root), "utf8");
  const standardNavigation = index.match(/<div id="standardSectionNavigation"[\s\S]*?<\/div>\s*<div id="marketingSectionNavigation"/)?.[0] || "";
  for (const id of [
    "leadership-brief",
    "overall-trend-analysis",
    "competitor-intent-section",
    "decisions-needed",
    "customer-voice",
    "competitive-timeline-section",
    "application-trends",
    "product-comparator",
    "filing-evidence",
  ]) assert.match(standardNavigation, new RegExp(`data-section-nav="${id}"`));
});

test("Product Marketing uses the Product Management layout without extra filters", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");

  assert.match(app, /const hiddenForProductManagement = state\.view === "Product" \|\| state\.view === "Marketing"/);
  assert.match(app, /appShell\?\.classList\.remove\("marketing-view"\)/);
  assert.match(app, /marketingWorkspace\.hidden = true/);
  assert.match(app, /standardNavigation\.hidden = false/);
  assert.match(app, /marketingNavigation\.hidden = true/);
  assert.doesNotMatch(app, /if \(state\.view === "Marketing"\) \{\s*renderMarketingWorkspace\(signals\);/s);
  assert.match(app, /navigationLabel\.textContent = "Roadmap Intelligence"/);
  assert.match(app, /control\.hidden = true[\s\S]*?label\.hidden = true/);
  assert.match(app, /if \(filters\.role\.value === "Marketing"\) \{\s*clearHeadToHeadUrlParameters\(\);\s*state\.headToHead\.initialized = true;\s*return;/s);
});

test("competitor plays render one governed selling motion per Competitor Intent record", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  const renderer = app.match(/function pmmSellingMotionObservedSourceMarkup[\s\S]*?\n}\n\nconst pmmActivationAssetTypes/)?.[0] || "";

  assert.match(app, /marketingBattlecardCompetitors = \["Agilent", "Thermo Fisher", "Shimadzu", "SCIEX"\]/);
  assert.match(app, /function pmmCompetitorIntentSellingMotions/);
  assert.match(app, /competitorSellingMotionTransformer\.transformCompetitorIntentProfiles/);
  for (const field of [
    "Observed move",
    "Inferred intent",
    "Buying situation targeted",
    "Deal type",
    "Committee role",
    "Waters response",
    "Three Proof Priorities",
  ]) assert.match(renderer, new RegExp(field));
  assert.match(renderer, /One selling motion per Competitor Intent record/);
  assert.match(renderer, /Only field-citable, non-blocked evidence can support a Waters response/);
  assert.match(renderer, /No customer-facing counter is emitted/);
  assert.match(renderer, /data-response-status="needs-proof" data-field-usable="false"/);
  assert.doesNotMatch(renderer, /Waters Counter-Position|Proposed Waters position — not approved/);
});

test("selling-motion inputs keep observed move text separate from PM interpretation", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  const intentInputs = app.match(/function competitorIntentProfile[\s\S]*?\n}\n\nfunction competitorDirectionStatement/)?.[0] || "";

  assert.match(intentInputs, /type: "Launch"[\s\S]*?observedDetail: launch\.summary \|\| launch\.signalType/);
  assert.match(intentInputs, /type: "Strategic move"[\s\S]*?observedDetail: signal\.summary \|\| signal\.signalType/);
  assert.match(intentInputs, /type: \/quarterly earnings result\/i\.test\(signal\.signalType \|\| ""\) \? "Earnings result" : "Earnings announcement"[\s\S]*?observedDetail: signal\.summary \|\| signal\.signalType/);
  assert.match(intentInputs, /type: "Newsroom update"[\s\S]*?observedDetail: signal\.summary \|\| signal\.signalType/);
  assert.match(intentInputs, /type: "Filing insight"[\s\S]*?observedDetail: insight\.evidence/);
  assert.match(intentInputs, /\.\.\.pmmGovernanceFields\((?:launch|signal|insight)\)/);
});

test("Marketing copy states the decision-and-activation purpose", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");

  assert.match(app, /Product Marketing Decision & Activation Center/);
  assert.match(app, /Decide what to say, to whom, against whom, and with which approved proof\./);
  for (const step of ["Target", "Decide", "Prove", "Approve", "Ship"]) assert.match(app, new RegExp(`<strong>${step}<\\/strong>`));
  assert.match(app, /Market activity <small>directional—not demand<\/small>/);
});

test("Product Marketing role and targeting are persistent and URL-addressable", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");

  assert.match(app, /competition-engine:role-view:v1/);
  assert.match(app, /params\.get\("view"\)/);
  assert.match(app, /url\.searchParams\.set\("view", state\.view\)/);
  assert.match(app, /localStorage\.setItem\(roleViewStorageKey, state\.view\)/);
  assert.match(app, /initializeRoleView\(\);\s*initializeHeadToHeadSelection\(\);/);
});

test("competitor aliases collapse into canonical filter identities", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");

  assert.match(app, /\["AGILENT TECHNOLOGIES, INC\.", "Agilent"\]/);
  assert.match(app, /\["THERMO FISHER SCIENTIFIC INC\.", "Thermo Fisher"\]/);
  assert.match(app, /names\.map\(canonicalCompetitorName\)/);
  assert.match(app, /function competitorMatchesFilter/);
});

test("shared Product Management panels generate PMM decisions rather than renamed roadmap copy", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");

  assert.match(app, /function marketingRecommendationFor/);
  assert.match(app, /Choose the workflow-execution promise PMM can substantiate/);
  assert.match(app, /Choose the lead \$\{segment\} workflow position and proof package/);
  assert.match(app, /Approve the regulated-workflow message and substantiation plan/);
  assert.match(app, /Product Marketing \+ Sales Enablement \+ Claims\/Legal/);
  assert.match(app, /PMM should frame Next Gen LC around the customer job/);
  assert.match(app, /The primary competitor is often inertia/);
  assert.match(app, /function marketingCompetitorResponse/);
  assert.match(app, /function marketingCustomerDecision/);
  assert.match(app, /Buyer tension → proof required → PMM decision/);
  assert.match(app, /function marketingApplicationTrendQuestion/);
  assert.match(app, /function marketingComparatorRead/);
});

test("Three Proof Priorities renders only unsupported claim gaps and keeps the remainder collapsed", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  const decisionRenderer = app.match(/function pmmProofPriorityRankMarkup[\s\S]*?\n}\n\nconst pmmClaimEvidenceClassifications/)?.[0] || "";

  assert.match(app, /function pmmProofPriorities/);
  assert.match(app, /limit: 3/);
  assert.match(decisionRenderer, /proofPriorities\.top/);
  assert.match(decisionRenderer, /Commercial claim we want to make/);
  assert.match(decisionRenderer, /Specific missing study \/ evidence/);
  assert.match(decisionRenderer, /One seller asset it unblocks/);
  assert.match(decisionRenderer, /GAP · NOT FIELD-USABLE/);
  assert.match(decisionRenderer, /pmm-proof-priority-backlog/);
  assert.doesNotMatch(decisionRenderer, /pmm-proof-priority-backlog" open/);
  assert.doesNotMatch(decisionRenderer, /product requirements?|roadmap (?:gate|change|decision)|product KPIs?|investment gate/i);
});

test("Proof prioritization exposes its formula and never invents missing deal impact", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");

  assert.match(app, /deal impact × exact claim frequency in field-citable Customer Voice records/);
  assert.match(app, /Deal impact unquantified/);
  assert.match(app, /internal deal data required/);
  assert.match(app, /Supported, non-blocked claims are excluded before ranking/);
});

test("Seller Assets assembles four governed, filter-specific shipment records", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  const index = await readFile(new URL("index.html", root), "utf8");
  const transformer = await readFile(new URL("seller-assets-transformer.js", root), "utf8");
  const renderer = app.match(/function pmmSellerAssetFieldContentMarkup[\s\S]*?\n}\n\nfunction pmmAppendixRecord/)?.[0] || "";
  const renderedMarkup = app.match(/function renderMarketingActivationBacklog[\s\S]*?\n}\n\nfunction pmmAppendixRecord/)?.[0] || "";

  for (const artifact of [
    "Battlecard",
    "Claims Sheet",
    "Lead-Vertical Pitch",
    "Proof-Request List",
  ]) assert.match(transformer, new RegExp(`title: "${artifact}"`));

  for (const field of [
    "Competitor \\+ target segment",
    "Field-facing content",
    "Internal only",
    "not yet cleared",
    "Export governance",
  ]) assert.match(renderer, new RegExp(field));

  assert.match(renderer, /Shipment Gate/);
  assert.match(index, /battlecard, approved claims sheet, lead-vertical pitch, and internal proof-request list/i);
  assert.match(app, /const artifactProduction = pmmArtifactProductionModel\(buyingCommittee, governingPosition, claimRows, narratives\)/);
  assert.match(app, /const sellerAssets = pmmSellerAssetsModel\(artifactProduction, comparatorClaimTransformation, claimRows, competitorPlays, proofPriorities\)/);
  assert.match(app, /renderMarketingActivationBacklog\(model\.positioningDecisions, model\.governingPosition, model\.breakReport, model\.activationActions, model\.artifactProduction, model\.sellerAssets\)/);
  assert.match(renderer, /NOT YET CLEARED/);
  assert.match(renderer, /approvalState:approved \+ fieldCitable:true/);
  assert.match(renderer, /Proof requests are always internal/);
  assert.doesNotMatch(renderedMarkup, /defin(?:e|ing) product requirements?|roadmap prioritization|engineering validation plans?|product KPIs?/i);
});

test("Evidence Appendix consolidates used evidence into closed source-type groups with backlinks", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  const index = await readFile(new URL("index.html", root), "utf8");
  const styles = await readFile(new URL("styles.css", root), "utf8");
  const transformer = await readFile(new URL("evidence-appendix-transformer.js", root), "utf8");
  const appendix = app.match(/function pmmAppendixRecord[\s\S]*?\n}\n\nfunction renderMarketingSourceCounts/)?.[0] || "";

  assert.match(index, /id="pmm-evidence-appendix"[^>]*data-default-collapsed="true"/);
  assert.match(index, /grouped by source type with claim and section backlinks; groups are collapsed by default/);
  for (const group of [
    "Customer language",
    "Scientific publication",
    "Corporate filing",
    "Conference or event",
    "Competitor official",
    "Waters official",
    "Other public source",
    "Unresolved evidence",
  ]) assert.match(transformer, new RegExp(group));

  assert.match(appendix, /<details class="pmm-appendix-group">/);
  assert.doesNotMatch(appendix, /<details class="pmm-appendix-group" open/);
  assert.match(appendix, /tabindex="0" aria-label=/);
  assert.match(appendix, /Evidence Used by the Current PMM Transformation/);
  assert.match(appendix, /data-pmm-appendix-backlink/);
  assert.match(appendix, /data-appendix-validation-status/);
  for (const source of [
    "currentLaunches()",
    "currentConferenceSources()",
    "currentCompetitorApplicationNotes()",
    "currentFilingInsights()",
    "currentStrategicSignals(signals)",
    "currentCustomerVoiceItems()",
    "state.sourceCatalog?.sources",
    "state.historicalProductCatalog?.products",
    "state.technicalComparisons?.profiles",
  ]) assert.match(appendix, new RegExp(source.replace(/[().?]/g, "\\$&")));
  assert.match(appendix, /Generic sentiment summaries are intentionally omitted/);
  assert.match(appendix, /Historical records apply competitor and technology filters but intentionally ignore the selected horizon/);
  assert.match(styles, /\.pmm-appendix-group > summary:focus-visible/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.pmm-appendix-record[\s\S]*?grid-template-columns:\s*1fr/s);
  assert.doesNotMatch(appendix, /Next PM Considerations|Product KPI|product requirements?|roadmap prioritization/i);
});

test("Claims and Proof Readiness renders the required evidence-governed matrix", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  const renderer = app.match(/function renderMarketingClaimsProof[\s\S]*?\n}\n\nconst pmmBuyingCommitteeRoleDefinitions/)?.[0] || "";
  const columns = [
    "Exact proposed claim wording",
    "Segment / application",
    "Buyer / channel",
    "Reference competitor or baseline",
    "Exact supporting evidence and compatibility",
    "Source counts",
    "Evidence comparability",
    "Substantiation",
    "Legal / claims approval",
    "Governance and next action",
  ];

  for (const column of columns) assert.match(renderer, new RegExp(column.replace("/", "\\/"), "i"));
  assert.match(app, /const pmmClaimReadinessValues = \["Proven", "Directional", "Unsupported"\]/);
  assert.match(app, /Observed customer or competitor language/);
  assert.match(app, /Analyst\/rule-based inference/);
  assert.match(app, /Approved Waters claim/);
  assert.match(app, /Approval not established/);
  assert.match(renderer, /Inapplicable evidence is blocked from substantiation/);
  assert.match(renderer, /Proposed — not approved/);
});

test("Claims readiness rules cannot infer approval or promote concern records as strengths", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  const contract = await readFile(new URL("pmm-data-contract.js", root), "utf8");

  assert.match(contract, /substantiationStatus === "Proven" && approvalEstablished === true/);
  assert.match(contract, /value: "Ready"/);
  assert.match(contract, /value: "Blocked"/);
  assert.match(contract, /"Inapplicable"/);
  assert.match(app, /const approvalEstablished = false/);
  assert.match(app, /Negative customer record|\$\{sentiment\} customer record/);
  assert.match(app, /never as a competitor strength/);
});

test("Claims matrix filters do not duplicate the global competitor filter", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  const renderer = app.match(/function renderMarketingClaimsProof[\s\S]*?\n}\n\nconst pmmBuyingCommitteeRoleDefinitions/)?.[0] || "";

  assert.match(app, /data-pmm-claims-filter="\$\{escapeHtml\(key\)\}"/);
  assert.match(renderer, /Substantiation/);
  assert.match(renderer, /Audience \/ buying criterion/);
  assert.match(renderer, /Evidence classification/);
  assert.match(renderer, /Competitor filtering uses the global Competitor filter above/);
  assert.doesNotMatch(renderer, /data-pmm-claims-filter="competitor"/);
  assert.match(app, /function setupMarketingWorkspaceControls/);
});

test("Audience and Buying Criteria uses role-segmented evidence and exact proof demands", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  const renderer = app.match(/function renderMarketingAudienceCriteria[\s\S]*?\n}\n\nfunction renderMarketingCompetitiveNarrative/)?.[0] || "";

  for (const field of [
    "Buying Committee",
    "who uses",
    "who influences",
    "who vetoes",
    "who decides",
    "who buys",
  ]) assert.match(renderer, new RegExp(field.replace("/", "\\/"), "i"));
  assert.match(app, /Specific proof this role demands/);
  for (const workflowField of ["Weight and Score Validation Workflow", "win/loss", "survey", "conjoint"])
    assert.match(app, new RegExp(workflowField.replace("/", "\\/"), "i"));
  assert.match(renderer, /not by market or technology/i);
  assert.match(renderer, /complaint-biased and (?:is )?not representative market research/);
  assert.match(renderer, /no committee assignment inferred/i);
  assert.match(renderer, /does not satisfy the requirement or provide field-usable proof/);
  assert.doesNotMatch(renderer, /pmmFishbeinScorecardMarkup|priority-segment working set/);
});

test("vendor perception is separated from market-wide themes and has no negative fallback", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  const renderer = app.match(/function renderMarketPositioning[\s\S]*?\n}\n\nfunction renderCustomerSegments/)?.[0] || "";

  assert.match(renderer, /const companies = \["Waters", "Agilent", "Thermo Fisher", "Shimadzu", "SCIEX"\]/);
  assert.doesNotMatch(renderer, /sentiment === "Positive"\) \|\| companyItems\[0\]/);
  assert.match(renderer, /No supported perceived strength found/);
  assert.match(renderer, /Market-Wide Themes/);
  assert.match(renderer, /Separate analytical level/);
  assert.match(renderer, /fewer than 3 independent sources/);
  assert.match(renderer, /complaint-biased and is not representative market research/);
  assert.doesNotMatch(app, /estimated mentions/);
});
