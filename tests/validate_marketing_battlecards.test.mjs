import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Product Marketing has exactly eight ordered primary sections", async () => {
  const index = await readFile(new URL("index.html", root), "utf8");
  const workspace = index.match(/<div id="marketingWorkspace"[\s\S]*?<section id="leadership-brief"/)?.[0] || "";
  const sectionIds = [...workspace.matchAll(/<section id="([^"]+)" class="panel pmm-primary-section"/g)].map((match) => match[1]);

  assert.deepEqual(sectionIds, [
    "pmm-governing-position",
    "pmm-positioning-decisions",
    "pmm-claims-risk",
    "pmm-segment-cascade",
    "pmm-competitive-narratives",
    "pmm-adoption-value",
    "pmm-activation-artifacts",
    "pmm-evidence-appendix",
  ]);
  assert.match(workspace, /id="pmm-evidence-appendix"[^>]*data-default-collapsed="true"/);
});

test("Product Marketing uses dedicated navigation and a dedicated render path", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  const index = await readFile(new URL("index.html", root), "utf8");

  assert.match(index, /id="marketingSectionNavigation"[^>]*hidden/);
  for (const id of [
    "pmm-governing-position",
    "pmm-positioning-decisions",
    "pmm-claims-risk",
    "pmm-segment-cascade",
    "pmm-competitive-narratives",
    "pmm-adoption-value",
    "pmm-activation-artifacts",
    "pmm-evidence-appendix",
  ]) assert.match(index, new RegExp(`data-section-nav="${id}"`));

  assert.match(app, /if \(state\.view === "Marketing"\) \{[\s\S]*?byId\("viewTitle"\)\.textContent = viewCopy\.Marketing\.title;\s*setCustomerVoiceTab\(state\.activeCustomerVoiceTab\);\s*renderMarketingWorkspace\(signals\);\s*scheduleSectionNavRefresh\(\);\s*return;/s);
  assert.match(app, /child\.matches\("\.topbar, \.filters, #marketingWorkspace, #customer-voice"\)/);
  assert.match(app, /marketingWorkspace\.hidden = !marketingView/);
  assert.match(app, /standardNavigation\.hidden = marketingView/);
  assert.match(app, /marketingNavigation\.hidden = !marketingView/);
  assert.match(app, /visualDashboard\.insertAdjacentElement\("afterbegin", comparatorPanel\)/);
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
  assert.match(intentInputs, /type: "Earnings result"[\s\S]*?observedDetail: signal\.summary \|\| signal\.signalType/);
  assert.match(intentInputs, /type: "Filing insight"[\s\S]*?observedDetail: insight\.evidence/);
  assert.match(intentInputs, /\.\.\.pmmGovernanceFields\((?:launch|signal|insight)\)/);
});

test("Marketing copy states the decision-and-activation purpose", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");

  assert.match(app, /PMM Market Leadership Workspace/);
  assert.match(app, /Win product selections with evidence-backed claims, competitive battlecards, and proof priorities\./);
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

test("Activation Backlog produces governed, filter-specific PMM artifacts", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  const index = await readFile(new URL("index.html", root), "utf8");
  const renderer = app.match(/const pmmArtifactDefinitions[\s\S]*?\n}\n\nfunction pmmAppendixRecord/)?.[0] || "";
  const renderedMarkup = app.match(/function renderMarketingActivationBacklog[\s\S]*?\n}\n\nfunction pmmAppendixRecord/)?.[0] || "";

  for (const artifact of [
    "One-Page Competitive Battlecard",
    "Positioning and Messaging Brief",
    "Regulated Claims Sheet",
    "Campaign and Message Plan",
    "Sales-Deck Outline",
    "Message-Test Brief",
    "Customer-Proof Request Brief",
  ]) assert.match(app, new RegExp(`"${artifact}"`));

  for (const field of [
    "Target / buying situation",
    "Governing Position",
    "Role-Specific Messages",
    "Competitor Response",
    "Claims and Approval State",
    "Proof and Caveats",
    "Objection Handling",
    "Unsupported-Content Warnings",
    "Owner",
    "Due date",
    "Production status",
    "Success measure",
    "Evidence Footnotes",
  ]) assert.match(renderer, new RegExp(field));

  assert.match(renderer, /Artifact Production Workflow/);
  assert.match(index, /Battlecards, claims sheets, decks, tests, and proof requests generated from the selected product and target/);
  assert.match(app, /const artifactProduction = pmmArtifactProductionModel\(buyingCommittee, governingPosition, claimRows, narratives\)/);
  assert.match(app, /renderMarketingActivationBacklog\(model\.positioningDecisions, model\.governingPosition, model\.breakReport, model\.activationActions, model\.artifactProduction\)/);
  assert.match(renderer, /DRAFT — NOT APPROVED/);
  assert.match(renderer, /Export claims registry CSV/);
  assert.match(renderer, /Copy approved text only/);
  assert.match(renderer, /not formal assignments or claims approval records/);
  assert.doesNotMatch(renderedMarkup, /defin(?:e|ing) product requirements?|roadmap prioritization|engineering validation plans?|product KPIs?/i);
});

test("Evidence Appendix consolidates secondary intelligence into closed, traceable groups", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  const index = await readFile(new URL("index.html", root), "utf8");
  const styles = await readFile(new URL("styles.css", root), "utf8");
  const appendix = app.match(/function pmmAppendixRecord[\s\S]*?\n}\n\nfunction renderMarketingSourceCounts/)?.[0] || "";

  assert.match(index, /id="pmm-evidence-appendix"[^>]*data-default-collapsed="true"/);
  assert.match(index, /Secondary, filtered evidence groups retained for traceability and collapsed by default/);
  for (const group of [
    "Launches and Conferences",
    "Application Notes and Publications",
    "Filings and Partnerships",
    "Customer-Language Records",
    "Source Coverage and Confidence",
    "Historical Product and Capability Records",
  ]) assert.match(appendix, new RegExp(group));

  assert.match(appendix, /Other Public Evidence Records/);
  assert.match(appendix, /<details class="pmm-appendix-group">/);
  assert.doesNotMatch(appendix, /<details class="pmm-appendix-group" open/);
  assert.match(appendix, /tabindex="0" aria-label=/);
  assert.match(appendix, /Leadership synthesis remains in the Leadership view/);
  assert.match(appendix, /do not create PMM recommendations by themselves/);
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

test("Audience and Buying Criteria uses governed buying committees and scorecards", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  const renderer = app.match(/function renderMarketingAudienceCriteria[\s\S]*?\n}\n\nfunction renderMarketingCompetitiveNarrative/)?.[0] || "";

  for (const field of [
    "Buying Committee",
    "Decision Unit",
    "priority-segment working set",
    "Objection",
  ]) assert.match(renderer, new RegExp(field.replace("/", "\\/"), "i"));
  for (const workflowField of ["Weight and Score Validation Workflow", "win/loss", "survey", "conjoint"])
    assert.match(app, new RegExp(workflowField.replace("/", "\\/"), "i"));
  assert.match(renderer, /Neither segment inclusion nor record frequency establishes commercial attractiveness/);
  assert.match(renderer, /complaint-biased and (?:is )?not representative market research/);
  assert.match(renderer, /Inferred role · validation required/);
  assert.match(renderer, /Weight or score hypothesis/);
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
