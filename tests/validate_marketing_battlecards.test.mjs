import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Product Marketing has exactly six ordered primary sections", async () => {
  const index = await readFile(new URL("index.html", root), "utf8");
  const workspace = index.match(/<div id="marketingWorkspace"[\s\S]*?<section id="leadership-brief"/)?.[0] || "";
  const sectionIds = [...workspace.matchAll(/<section id="([^"]+)" class="panel pmm-primary-section"/g)].map((match) => match[1]);

  assert.deepEqual(sectionIds, [
    "pmm-positioning-decisions",
    "pmm-claims-proof",
    "pmm-audience-criteria",
    "pmm-competitive-narrative",
    "pmm-activation-backlog",
    "pmm-evidence-appendix",
  ]);
  assert.match(workspace, /id="pmm-evidence-appendix"[^>]*data-default-collapsed="true"/);
});

test("Product Marketing uses dedicated navigation and a dedicated render path", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  const index = await readFile(new URL("index.html", root), "utf8");

  assert.match(index, /id="marketingSectionNavigation"[^>]*hidden/);
  for (const id of [
    "pmm-positioning-decisions",
    "pmm-claims-proof",
    "pmm-audience-criteria",
    "pmm-competitive-narrative",
    "pmm-activation-backlog",
    "pmm-evidence-appendix",
  ]) assert.match(index, new RegExp(`data-section-nav="${id}"`));

  assert.match(app, /if \(state\.view === "Marketing"\) \{[\s\S]*?byId\("viewTitle"\)\.textContent = viewCopy\.Marketing\.title;\s*renderMarketingWorkspace\(signals\);\s*scheduleSectionNavRefresh\(\);\s*return;/s);
  assert.match(app, /marketingWorkspace\.hidden = !marketingView/);
  assert.match(app, /standardNavigation\.hidden = marketingView/);
  assert.match(app, /marketingNavigation\.hidden = !marketingView/);
  assert.match(app, /visualDashboard\.insertAdjacentElement\("afterbegin", comparatorPanel\)/);
});

test("competitive narratives synthesize evidence into one canonical PMM decision card", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  const renderer = app.match(/function renderMarketingCompetitiveNarrative[\s\S]*?\n}\n\nfunction renderMarketingActivationBacklog/)?.[0] || "";

  assert.match(app, /marketingBattlecardCompetitors = \["Agilent", "Thermo Fisher", "Shimadzu", "SCIEX"\]/);
  assert.match(app, /function pmmCompetitiveNarrative/);
  assert.match(app, /function pmmNarrativeApplicationRead/);
  assert.match(app, /function pmmNarrativeConferenceEvidence/);
  assert.match(app, /function pmmNarrativeActivation/);
  for (const field of [
    "What Changed",
    "Observed Competitor Claim or Workflow Emphasis",
    "Likely Positioning",
    "Workflow Ownership Signal",
    "Target Audience or Buying Situation",
    "Waters Counter-Position",
    "PMM Decision",
    "Evidence Caveats",
    "Underlying Evidence Links",
  ]) assert.match(renderer, new RegExp(field));
  assert.match(renderer, /One canonical narrative per competitor/);
  assert.match(renderer, /Observed competitor evidence/);
  assert.match(renderer, /Analyst\/rule-based inference/);
  assert.match(renderer, /Proposed Waters position — not approved/);
  assert.match(renderer, /Approval not established/);
  assert.match(renderer, /this is not a raw event or launch feed/);
  assert.equal((renderer.match(/Observed Competitor Claim or Workflow Emphasis/g) || []).length, 1);
});

test("competitive narrative logic treats application notes, launches, and conferences as synthesis inputs", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  const logic = app.match(/function pmmNarrativeApplicationNotes[\s\S]*?\n}\n\nfunction pmmNarrativeSourceMarkup/)?.[0] || "";

  assert.match(logic, /official notes repeatedly emphasize/);
  assert.match(logic, /early workflow-ownership signal, not a sustained competitor narrative/);
  assert.match(app, /Publication volume is not used/);
  assert.match(logic, /comparable prior PMM narrative snapshot is not loaded/);
  assert.match(logic, /notes\.slice\(0, 1\)/);
  assert.match(logic, /do not treat unconfirmed session content as an observed competitor claim/);
  assert.match(logic, /do not reproduce the raw launch feed in primary PMM content/);
  assert.match(logic, /most represented matching audience[\s\S]*not a measure of commercial attractiveness/);
  assert.match(logic, /Low source diversity — fewer than 3 distinct source domains/);
});

test("Marketing copy states the decision-and-activation purpose", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");

  assert.match(app, /Product Marketing Decision & Activation Workspace/);
  assert.match(app, /A decision-and-activation workspace for positioning, proof, and enablement\./);
});

test("Positioning Decisions renders exactly three evidence-linked PMM decisions", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  const decisionRenderer = app.match(/function renderMarketingPositioningDecisions[\s\S]*?\n}\n\nfunction renderMarketingClaimsProof/)?.[0] || "";

  assert.match(app, /function marketingPositioningDecisionCandidates/);
  assert.match(app, /\.slice\(0, 3\)/);
  assert.match(decisionRenderer, /class="pmm-decision-card pmm-positioning-decision"/);
  assert.match(decisionRenderer, /Audience and Buying Situation/);
  assert.match(decisionRenderer, /Competitor Claim or Narrative/);
  assert.match(decisionRenderer, /Suggested Waters Counter-position/);
  assert.match(decisionRenderer, /Proof and Substantiation/);
  assert.match(decisionRenderer, /Activation Required/);
  assert.match(decisionRenderer, /Owner needed/);
  assert.match(decisionRenderer, /Deadline needed/);
  assert.match(decisionRenderer, /Measure needed/);
  assert.match(decisionRenderer, /Exact Evidence Links/);
  assert.match(decisionRenderer, /Approved Waters claim/);
  assert.doesNotMatch(decisionRenderer, /product requirements?|roadmap (?:gate|change|decision)|product KPIs?|investment gate/i);
});

test("Positioning prioritization is explainable and refresh deltas are not invented", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");

  assert.match(app, /Priority combines recency, source diversity, repeated narrative evidence, customer buying-criterion evidence, confidence, and proof gaps/);
  assert.match(app, /Raw record volume is not used as a standalone measure of commercial importance/);
  assert.match(app, /What Changed Since the Last Refresh/);
  assert.match(app, /Change detection unavailable/);
  assert.match(app, /no comparable prior PMM positioning-decision snapshot is loaded/);
  assert.match(app, /No delta is inferred/);
});

test("Activation Backlog converts every positioning decision into a governed PMM deliverable", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  const index = await readFile(new URL("index.html", root), "utf8");
  const renderer = app.match(/const pmmActivationAssetTypes[\s\S]*?\n}\n\nfunction pmmAppendixRecord/)?.[0] || "";
  const renderedMarkup = app.match(/function renderMarketingActivationBacklog[\s\S]*?\n}\n\nfunction pmmAppendixRecord/)?.[0] || "";

  for (const assetType of [
    "Battlecard",
    "Webpage",
    "Campaign",
    "Launch kit",
    "Sales deck",
    "Application note",
    "Customer proof",
    "Message test",
  ]) assert.match(app, new RegExp(`"${assetType}"`));

  for (const field of [
    "Related Positioning Decision",
    "Asset / Action",
    "Reason It Is Needed",
    "Intended Audience",
    "Intended Channel",
    "Owner",
    "Deadline",
    "Status",
    "Required Proof or Approval",
    "Success measure",
    "Evidence Links",
  ]) assert.match(renderer, new RegExp(field));

  assert.match(renderer, /Recommended PMM Actions/);
  assert.match(index, /Recommended PMM actions that convert positioning and proof gaps into traceable deliverables/);
  assert.match(app, /const deliverables = decisions\.map\(\(decision, index\) => pmmActivationDeliverable\(decision, index \+ 1\)\)/);
  assert.match(app, /renderMarketingActivationBacklog\(positioningDecisions\)/);
  assert.match(renderer, /Owner needed — no workflow assignment is available/);
  assert.match(renderer, /Deadline needed — no workflow date is available/);
  assert.match(renderer, /Measure needed — no success measure is assigned/);
  assert.match(renderer, /Approval not established/);
  assert.match(renderer, /Asset unresolved/);
  assert.match(renderer, /Unresolved — no recommendation/);
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
  const renderer = app.match(/function renderMarketingClaimsProof[\s\S]*?\n}\n\nfunction pmmAudienceTrigger/)?.[0] || "";
  const columns = [
    "Competitor",
    "Competitor claim",
    "Evidence classification",
    "Audience / buying criterion",
    "Waters counter-position",
    "Available proof",
    "Missing substantiation",
    "Approval state",
    "Readiness",
    "Confidence / recency",
    "Sources",
  ];

  for (const column of columns) assert.match(renderer, new RegExp(column.replace("/", "\\/"), "i"));
  assert.match(app, /const pmmClaimReadinessValues = \["Ready", "Weak", "Missing", "Legally unapproved"\]/);
  assert.match(app, /Observed customer or competitor language/);
  assert.match(app, /Analyst\/rule-based inference/);
  assert.match(app, /Approved Waters claim/);
  assert.match(app, /Approval not established/);
  assert.match(renderer, /Technical evidence does not establish legal approval/);
  assert.match(renderer, /Proposed inference — not approved/);
});

test("Claims readiness rules cannot infer approval or promote concern records as strengths", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  const readinessRule = app.match(/function pmmClaimReadiness[\s\S]*?\n}/)?.[0] || "";

  assert.match(readinessRule, /if \(!availableProof\.length \|\| !claimSources\.length\)[\s\S]*?"Missing"/);
  assert.match(readinessRule, /if \(!approvalEstablished\)[\s\S]*?"Legally unapproved"/);
  assert.match(readinessRule, /return \{ value: "Ready"/);
  assert.match(app, /const approvalEstablished = false/);
  assert.match(app, /Negative customer record|\$\{sentiment\} customer record/);
  assert.match(app, /never as a competitor strength/);
});

test("Claims matrix filters do not duplicate the global competitor filter", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  const renderer = app.match(/function renderMarketingClaimsProof[\s\S]*?\n}\n\nfunction pmmAudienceTrigger/)?.[0] || "";

  assert.match(app, /data-pmm-claims-filter="\$\{escapeHtml\(key\)\}"/);
  assert.match(renderer, /Readiness/);
  assert.match(renderer, /Audience \/ buying criterion/);
  assert.match(renderer, /Evidence classification/);
  assert.match(renderer, /Competitor filtering uses the global Competitor filter above/);
  assert.doesNotMatch(renderer, /data-pmm-claims-filter="competitor"/);
  assert.match(app, /function setupMarketingWorkspaceControls/);
});

test("Audience and Buying Criteria uses evidence-backed buying-situation cards", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  const renderer = app.match(/function renderMarketingAudienceCriteria[\s\S]*?\n}\n\nfunction renderMarketingCompetitiveNarrative/)?.[0] || "";

  for (const field of [
    "Buyer role",
    "Lab / account context",
    "Current platform",
    "Trigger event",
    "Objection",
    "Purchase-driving criterion",
    "Observed customer language",
    "Exact evidence links",
    "Caveats",
  ]) assert.match(renderer, new RegExp(field.replace("/", "\\/"), "i"));
  assert.match(renderer, /Most represented audiences in the current evidence/);
  assert.match(renderer, /not a measure of commercial attractiveness/);
  assert.match(renderer, /Low sample — fewer than 3 independent sources/);
  assert.match(renderer, /complaint-biased and (?:is )?not representative market research/);
  assert.match(renderer, /Observed customer language unavailable/);
  assert.match(renderer, /Analyst\/rule-based inference/);
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
