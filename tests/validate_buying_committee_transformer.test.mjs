import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

const require = createRequire(import.meta.url);
const transformer = require("../buying-committee-transformer.js");
const root = new URL("../", import.meta.url);

function record(overrides = {}) {
  return {
    id: "cv-analyst-reliability",
    company: "Waters",
    product: "ACQUITY UPLC",
    userRole: "Analyst",
    buyingPriority: "Reliability",
    sentiment: "Negative",
    customerLanguageSignal: "Public troubleshooting patterns cluster around leaks, pressure behavior, fittings, seals, and repeat diagnostic steps.",
    languageType: "analyst_paraphrase",
    sourceName: "Reddit official OAuth API",
    sourceUrl: "https://example.com/analyst-reliability",
    evidenceRecords: [{ label: "Analyst reliability discussion", url: "https://example.com/analyst-reliability" }],
    fieldCitable: false,
    approvalState: "draft",
    labType: "Pharma",
    platform: "LC/UHPLC",
    ...overrides,
  };
}

test("existing exact role tags map only to the five buying-committee functions", () => {
  const fixtures = [
    ["Analyst", "uses"],
    ["Instrument specialist", "uses"],
    ["Data scientist", "uses"],
    ["Method developer", "influences"],
    ["QA/compliance", "vetoes"],
    ["Lab manager", "decides"],
    ["Procurement", "buys"],
  ];
  for (const [tag, expected] of fixtures) assert.equal(transformer.roleForTag(tag)?.key, expected);
  assert.equal(transformer.roleForTag("Public reviewer/contributor"), null);
  assert.equal(transformer.roleForTag("FDA inspection finding"), null);
  assert.equal(transformer.roleForTag("Director"), null);
  assert.equal(transformer.roleForTag("Purchasing"), null);
});

test("committee output is segmented by role and exact decision criterion, not market or technology", () => {
  const result = transformer.transformBuyingCommittee({ records: [
    record(),
    record({ id: "cv-procurement", userRole: "Procurement", buyingPriority: "Cost", labType: "Academic", platform: "LC-MS", sourceUrl: "https://example.com/procurement", evidenceRecords: [{ url: "https://example.com/procurement" }] }),
  ] });
  assert.equal(result.segmentation, "buying-committee-role");
  assert.deepEqual(result.roles.map((role) => role.key), ["uses", "influences", "vetoes", "decides", "buys"]);
  assert.deepEqual(result.roles.find((role) => role.key === "uses").criteria.map((item) => item.criterion), ["Reliability"]);
  assert.deepEqual(result.roles.find((role) => role.key === "buys").criteria.map((item) => item.criterion), ["Cost"]);
  assert.equal("labType" in result.roles[0], false);
  assert.equal("technology" in result.roles[0], false);
});

test("role-specific proof demands retain actual evidence language and never invent a generic study", () => {
  const result = transformer.transformBuyingCommittee({ records: [record()] });
  const demand = result.roles.find((role) => role.key === "uses").criteria[0].proofDemands[0];
  assert.equal(demand.proofState, "evidence-backed-demand");
  assert.equal(demand.proofDemandText, record().customerLanguageSignal);
  assert.equal(demand.languageLabel, "Analyst synthesis — not a customer quote");
  assert.equal(demand.fieldUsable, false);
  assert.equal(demand.sources[0].url, "https://example.com/analyst-reliability");
  assert.doesNotMatch(JSON.stringify(demand), /TCO model|task-based workflow study|validation dossier|executive business case/i);
});

test("positive evidence can establish a criterion but leaves its proof demand unresolved", () => {
  const result = transformer.transformBuyingCommittee({ records: [record({ sentiment: "Positive" })] });
  const demand = result.roles.find((role) => role.key === "uses").criteria[0].proofDemands[0];
  assert.equal(demand.proofState, "unresolved");
  assert.match(demand.proofDemandText, /^Unresolved/);
});

test("ambiguous role tags remain in an unresolved queue and never enter a committee seat", () => {
  const result = transformer.transformBuyingCommittee({ records: [record({ userRole: "Public reviewer/contributor" })] });
  assert.equal(result.mappedRecordCount, 0);
  assert.equal(result.unresolvedRecordCount, 1);
  assert.equal(result.unresolvedRoleGroups[0].roleTag, "Public reviewer/contributor");
  assert.ok(result.roles.every((role) => role.classification === "unresolved" && role.recordCount === 0));
});

test("PMM rendering exposes the five role functions and leaves Product Management Customer Voice untouched", async () => {
  const [app, index] = await Promise.all([
    readFile(new URL("app.js", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
  ]);
  const roleRenderer = app.match(/function pmmRoleProofDemandMarkup[\s\S]*?\n}\n\nfunction pmmFishbeinSourcesMarkup/)?.[0] || "";
  const sectionRenderer = app.match(/function renderMarketingAudienceCriteria[\s\S]*?\n}\n\nfunction pmmCustomerBarrierSourceMarkup/)?.[0] || "";
  const renderer = `${roleRenderer}\n${sectionRenderer}`;
  const pmRenderer = app.match(/function renderCustomerVoiceSignals[\s\S]*?\n}\n\nfunction renderMetrics/)?.[0] || "";
  assert.match(index, /buying-committee-transformer\.js/);
  for (const label of ["Who uses", "Who influences", "Who vetoes", "Who decides", "Who buys", "Decision criterion", "Specific proof this role demands"])
    assert.match(renderer, new RegExp(label, "i"));
  assert.match(renderer, /not by market or technology|not by market or technology/i);
  assert.match(renderer, /no committee assignment inferred/i);
  assert.doesNotMatch(sectionRenderer, /Segment Buying Committees|pmmFishbeinScorecardMarkup/);
  assert.doesNotMatch(pmRenderer, /BuyingCommitteeTransformer|buyingCommitteeTransformer|committee-role/);
});

test("the buying-committee transformer is mirrored for deployment", async () => {
  const [source, deployed] = await Promise.all([
    readFile(new URL("buying-committee-transformer.js", root), "utf8"),
    readFile(new URL("deploy-site/buying-committee-transformer.js", root), "utf8"),
  ]);
  assert.equal(deployed, source);
});
