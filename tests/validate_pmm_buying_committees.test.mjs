import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

const require = createRequire(import.meta.url);
const contract = require("../pmm-data-contract.js");
const root = new URL("../", import.meta.url);
const [app, styles, documentContract] = await Promise.all([
  readFile(new URL("app.js", root), "utf8"),
  readFile(new URL("styles.css", root), "utf8"),
  readFile(new URL("PMM_DATA_CONTRACT.md", root), "utf8"),
]);

test("every priority segment receives the complete governed buying committee", () => {
  const model = app.match(/const pmmBuyingCommitteeRoleDefinitions[\s\S]*?\n];/)?.[0] || "";
  for (const role of [
    "Bench user / analyst",
    "Method developer",
    "QC/QA or validation veto",
    "IT / data-integrity veto",
    "Lab-manager decision maker",
    "Procurement / economic buyer",
    "Executive sponsor — where relevant",
  ]) assert.match(model, new RegExp(role.replace(/[\/]/g, "\\$&")));
  for (const power of ["user", "influencer", "veto", "decider", "buyer"]) assert.match(model, new RegExp(`decisionPower: "${power}"`));
  assert.match(app, /pmmBuyingCommitteeRoleDefinitions\.map/);
});

test("committee roles expose every required decision field and explicit evidence state", () => {
  const markup = app.match(/function pmmCommitteeRoleMarkup[\s\S]*?\n}\n\nfunction pmmFishbeinSourcesMarkup/)?.[0] || "";
  for (const field of [
    "Job",
    "Concern",
    "Decision power",
    "Message",
    "Required proof",
    "Objection",
    "Preferred asset / channel",
  ]) assert.match(markup, new RegExp(field));
  assert.match(markup, /data-role-classification/);
  assert.match(app, /Role observed · decision model inferred/);
  assert.match(app, /Inferred role · validation required/);
  assert.match(app, /Hypothesis — validation required\. No exact role-specific evidence link is available/);
  assert.match(styles, /\.pmm-committee-role-inference[\s\S]*?border-style: dashed/);
});

test("Fishbein weights always normalize to exactly 100 percent", () => {
  const allMarkets = contract.fishbeinScorecard([
    { key: "a", weight: 17, watersScore: 3, competitorScore: 4 },
    { key: "b", weight: 17, watersScore: 4, competitorScore: 3 },
    { key: "c", weight: 17, watersScore: 3, competitorScore: 3 },
    { key: "d", weight: 17, watersScore: 4, competitorScore: 3 },
    { key: "e", weight: 16, watersScore: 3, competitorScore: 4 },
    { key: "f", weight: 16, watersScore: 3, competitorScore: 3 },
  ]);
  const biopharma = contract.fishbeinScorecard([
    { key: "reliability", weight: 20, watersScore: 3, competitorScore: 4 },
    { key: "ease", weight: 15, watersScore: 3, competitorScore: 3 },
    { key: "transfer", weight: 20, watersScore: 4, competitorScore: 3 },
    { key: "compliance", weight: 15, watersScore: 4, competitorScore: 4 },
    { key: "throughput", weight: 20, watersScore: 3, competitorScore: 4 },
    { key: "economics", weight: 10, watersScore: 3, competitorScore: 2 },
  ]);
  assert.equal(allMarkets.weightTotal, 100);
  assert.equal(biopharma.weightTotal, 100);
  assert.equal(allMarkets.rows.reduce((sum, row) => sum + row.weight, 0), 100);
  assert.equal(biopharma.rows.reduce((sum, row) => sum + row.weight, 0), 100);
});

test("the swing attribute is calculated from the largest absolute weighted difference", () => {
  const scorecard = contract.fishbeinScorecard([
    { key: "reliability", label: "Reliability", weight: 20, watersScore: 3, competitorScore: 4 },
    { key: "transfer", label: "Method transfer", weight: 30, watersScore: 5, competitorScore: 2 },
    { key: "cost", label: "Cost", weight: 50, watersScore: 3, competitorScore: 3 },
  ]);
  assert.equal(scorecard.swingAttribute.key, "transfer");
  assert.equal(scorecard.swingAttribute.weightedDifference, 0.9);
  assert.match(app, /Largest absolute weighted difference/);
  assert.doesNotMatch(app, /swingAttribute:\s*"(?:Reliability|Method transfer|Cost)/);
});

test("weights and scores cannot be presented as measured evidence", () => {
  const markup = app.match(/function pmmFishbeinScorecardMarkup[\s\S]*?\n}\n\nfunction pmmWeightReplacementWorkflowMarkup/)?.[0] || "";
  assert.match(markup, /Weights and 1–5 scores are analyst hypotheses/);
  assert.equal((markup.match(/Hypothesis — validation required/g) || []).length >= 3, true);
  assert.match(app, /Sources provide context only; they do not validate the numeric hypothesis score/);
  assert.match(app, /replace a hypothesis only with a dated study, methodology, sample, owner, and review\/expiration state/);
  assert.match(documentContract, /Fishbein/i);
});

test("the governing position references the calculated selected-segment swing attribute", () => {
  assert.match(app, /selectedSwingAttribute/);
  assert.match(app, /const buyingCommittee = pmmBuyingCommitteeModel/);
  assert.match(app, /pmmGoverningPosition\(contexts, buyingCommittee\.selectedSwingAttribute\)/);
  assert.match(app, /<dt>Selected swing attribute<\/dt>/);
  assert.match(app, /weighted difference \$\{selectedSegment\.scorecard\.swingAttribute\.weightedDifference\.toFixed\(2\)\}/);
});

test("buying-committee layouts retain keyboard focus and responsive behavior", () => {
  assert.match(styles, /\.pmm-committee-segment > summary:focus-visible/);
  assert.match(styles, /@media \(max-width: 960px\)[\s\S]*?\.pmm-committee-grid/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.pmm-committee-role dl/);
  assert.match(app, /<details class="pmm-committee-segment"/);
});
