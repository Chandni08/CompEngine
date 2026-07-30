import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

const require = createRequire(import.meta.url);
const contract = require("../pmm-data-contract.js");
const root = new URL("../", import.meta.url);
const [app, index, styles, notesData, documentContract] = await Promise.all([
  readFile(new URL("app.js", root), "utf8"),
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("styles.css", root), "utf8"),
  readFile(new URL("data/competitor_application_notes.json", root), "utf8").then(JSON.parse),
  readFile(new URL("PMM_DATA_CONTRACT.md", root), "utf8"),
]);

test("hierarchical targeting exposes application, buying situation, geography, and buyer-role controls without adding a seventh PMM section", () => {
  for (const id of ["segmentFilter", "pmmApplicationFilter", "pmmBuyingSituationFilter", "geoFilter", "pmmBuyerRoleFilter"])
    assert.match(index, new RegExp(`id="${id}"`));
  assert.equal((index.match(/class="panel pmm-primary-section"/g) || []).length, 6);
  assert.match(app, /Market.*Application \/ workflow.*Buying situation.*Geography.*Buyer role/s);
  assert.match(styles, /\.pmm-targeting-path/);
});

test("All → Biopharma → Oligo has exact target-compatible application evidence and rebuild hooks", () => {
  const records = notesData.notes.filter((note) => note.marketSegment === "Biopharma" && /oligo(?:nucleotide)?/i.test(`${note.applicationArea} ${note.title}`));
  assert.ok(records.length >= 2);
  assert.ok(records.every((record) => /^https?:/.test(record.sourceUrl)));
  assert.match(app, /value: "Oligo"[\s\S]*?markets: \["Biopharma"\]/);
  assert.match(app, /pmmTargetingMatches\(note\)/);
  assert.match(app, /marketingPrioritizedCompetitorContexts/);
  assert.match(app, /state\.marketingWorkspaceModel = model/);
});

test("All → Environmental → PFAS has exact target-compatible application evidence and rebuild hooks", () => {
  const records = notesData.notes.filter((note) => note.marketSegment === "Environmental" && /pfas|tfa|ultrashort-chain/i.test(`${note.applicationArea} ${note.title}`));
  assert.ok(records.length >= 3);
  assert.ok(records.every((record) => /^https?:/.test(record.sourceUrl)));
  assert.match(app, /value: "PFAS"[\s\S]*?markets: \["Environmental", "Food & Beverage"\]/);
  assert.match(app, /pmmApplicationMatchesTarget/);
  assert.match(app, /currentCompetitorApplicationNotes[\s\S]*?pmmTargetingMatches\(note\)/);
});

test("application compatibility blocks broad-market proof from silently carrying to another workflow", () => {
  const result = contract.evaluateClaimEvidenceCompatibility({
    productWorkflow: ["LC_PLATFORM"],
    attributes: ["WORKFLOW_EXECUTION"],
    segment: ["Biopharma"],
    application: ["Oligo"],
    comparator: [],
    testConditions: [],
  }, {
    productWorkflow: ["LC_PLATFORM"],
    attributes: ["WORKFLOW_EXECUTION"],
    segment: ["Biopharma"],
    application: ["MAM"],
  });
  assert.equal(result.status, "Inapplicable");
  assert.equal(result.checks.find((check) => check.label === "Application / workflow").status, "Mismatch");
});

test("What breaks report is canonical, complete, and rendered before activation and export", () => {
  const report = contract.buildTargetingBreakReport({
    claimRows: [{ competitor: "A", proposedClaimWording: "Claim", substantiationStatus: "Unsupported", evidenceRecords: [{ label: "Wrong proof", compatibility: { status: "Inapplicable" } }] }],
    buyingCommittee: { segments: [{ roles: [{ key: "bench-user", classification: "observed" }], scorecard: { swingAttribute: { label: "Transfer" } }, baselineSwingAttribute: { label: "Reliability" } }] },
    requiredBuyerRoles: [{ key: "bench-user", label: "Bench" }, { key: "quality-veto", label: "QC/QA" }],
    economicAssumptions: ["TCO unavailable"],
    governingTraces: [{ status: "contradiction", label: "Message", message: "Conflict" }],
  });
  assert.equal(report.unsupportedClaims.length, 1);
  assert.equal(report.inapplicableProof.length, 1);
  assert.deepEqual(report.missingBuyerRoles.map((role) => role.key), ["quality-veto"]);
  assert.equal(report.missingEconomicAssumptions.length, 1);
  assert.equal(report.swingChange.changed, true);
  assert.equal(report.conflictingMessages.length, 1);
  const renderer = app.match(/function renderMarketingActivationBacklog[\s\S]*?\n}\n\nfunction pmmAppendixRecord/)?.[0] || "";
  assert.ok(renderer.indexOf("breakMarkup") < renderer.indexOf("pmm-backlog-intro"));
  assert.match(app, /data-pmm-export-targeting/);
  assert.match(app, /breakReport: model\.breakReport/);
});

test("every hierarchical change re-derives governed downstream artifacts from one model", () => {
  const builder = app.match(/function buildMarketingWorkspaceModel[\s\S]*?\n}\n\nfunction renderMarketingWorkspace/)?.[0] || "";
  for (const artifact of [
    "governingPosition",
    "buyingCommittee",
    "contexts",
    "claimRows",
    "positioningDecisions",
    "narratives",
    "activationActions",
    "breakReport",
    "appendix",
    "kpis",
  ]) assert.match(builder, new RegExp(artifact));
  assert.match(app, /state\.marketingTargeting\[key\] = targetingControl\.value[\s\S]*?render\(\)/);
  assert.match(documentContract, /Market → Application\/workflow → Buying situation → Geography → Buyer role/);
});

