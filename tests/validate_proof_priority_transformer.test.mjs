import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

const require = createRequire(import.meta.url);
const transformer = require("../proof-priority-transformer.js");
const root = new URL("../", import.meta.url);

function gap(id, claimText, dealImpact = null) {
  return {
    id,
    claimText,
    dimension: claimText,
    studyRequiredBeforeFieldUse: `Run the missing ${claimText} study.`,
    sellerAsset: "One-Page Competitive Battlecard",
    dealImpact,
    approvalState: "draft",
    status: "gap",
    fieldUsable: false,
  };
}

const customerVoiceRecords = [
  { id: "cv-1", theme: "Faster method transfer for routine validated methods" },
  { id: "cv-2", theme: "Faster method transfer and stronger method continuity" },
  { id: "cv-3", theme: "Simpler data review and easier software workflow" },
  { id: "cv-4", theme: "Lower carryover in routine sample analysis" },
];

test("proof priorities aggregate gapQueue and only commercial/proof-tagged Decisions Needed items", () => {
  const result = transformer.aggregateProofPriorities({
    gapQueue: [gap("gap-transfer", "Faster method transfer", 4)],
    decisionItems: [
      {
        id: "decision-review",
        title: "Decide the data-review proof package",
        decisionTags: ["commercial", "proof"],
        commercialClaim: "Simpler data review",
        missingStudyEvidence: "Run a role-based data-review usability study.",
        sellerAsset: "Sales-Deck Outline",
        dealImpact: 5,
      },
      {
        id: "decision-roadmap",
        title: "Internal roadmap decision",
        decisionTags: ["roadmap"],
        commercialClaim: "Internal-only statement",
      },
    ],
    customerVoiceRecords,
  });

  assert.deepEqual(new Set(result.all.map((item) => item.source)), new Set(["gapQueue", "Decisions Needed"]));
  assert.ok(result.all.every((item) => item.status === "gap" && item.fieldUsable === false));
  assert.ok(result.all.every((item) => typeof item.sellerAsset === "string" && item.sellerAsset.length > 0));
  assert.ok(result.all.every((item) => item.claimText !== "Internal-only statement"));
});

test("ranking uses deal impact multiplied by exact Customer Voice record frequency", () => {
  const result = transformer.aggregateProofPriorities({
    gapQueue: [
      gap("gap-transfer", "Faster method transfer", 4),
      gap("gap-review", "Simpler data review", 5),
      gap("gap-carryover", "Lower carryover", 2),
      gap("gap-unmeasured", "Routine sample analysis"),
    ],
    customerVoiceRecords,
  });

  assert.deepEqual(result.all.slice(0, 3).map((item) => item.id), ["gap-transfer", "gap-review", "gap-carryover"]);
  assert.deepEqual(result.all.slice(0, 3).map((item) => item.priorityScore), [8, 5, 2]);
  assert.equal(result.top.length, 3);
  assert.equal(result.backlog.length, 1);
  assert.equal(result.backlog[0].priorityScore, null, "unrecorded deal impact remains unresolved instead of being invented");
});

test("a supported non-blocked Claim Control claim drops from both the top three and backlog", () => {
  const result = transformer.aggregateProofPriorities({
    gapQueue: [gap("gap-transfer", "Faster method transfer", 4), gap("gap-review", "Simpler data review", 5)],
    customerVoiceRecords,
    supportedClaims: [{
      id: "supported-transfer",
      claimText: "Faster method transfer",
      status: "supported",
      approvalState: "approved",
      fieldUsable: true,
    }],
  });

  assert.equal(result.supportedClaimsExcluded, 1);
  assert.ok(result.all.every((item) => item.claimText !== "Faster method transfer"));
  assert.ok([...result.top, ...result.backlog].every((item) => item.status === "gap" && item.fieldUsable === false));
});

test("duplicate gap claims consolidate without losing their source records", () => {
  const result = transformer.aggregateProofPriorities({
    gapQueue: [gap("gap-transfer-a", "Faster method transfer"), gap("gap-transfer-b", "Faster method transfer")],
    customerVoiceRecords,
  });

  assert.equal(result.all.length, 1);
  assert.equal(result.duplicateClaimsMerged, 1);
  assert.deepEqual(result.all[0].sourceIds, ["gap-transfer-a", "gap-transfer-b"]);
});

test("the PMM proof-priority renderer exposes exactly the requested fields and a collapsed backlog", async () => {
  const [app, index] = await Promise.all([
    readFile(new URL("app.js", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
  ]);
  const renderer = app.match(/function pmmProofPriorityRankMarkup[\s\S]*?\n}\n\nconst pmmClaimEvidenceClassifications/)?.[0] || "";

  assert.match(index, /proof-priority-transformer\.js/);
  assert.match(app, /\.\.\.comparatorClaimTransformation\.gapQueue/);
  assert.match(app, /\.\.\.\(customerVoiceBarrierTransformation\?\.valueAssumptionGapQueue \|\| \[\]\)/);
  assert.match(app, /const decisionCandidates = pmmProofDecisionInputs\(signals\)/);
  assert.match(app, /supportedClaims: comparatorClaimTransformation\.allClaimControlClaims/);
  assert.match(app, /const allClaimControlClaims = candidates\.filter/);
  assert.match(app, /filter\(\(item\) => !\(item\.guardrailConflicts \|\| \[\]\)\.length\)/);
  assert.match(app, /guardrailBlocked: \[\.\.\.gapCandidates, \.\.\.decisionCandidates\]/);
  assert.match(renderer, /Commercial claim we want to make/);
  assert.match(renderer, /Specific missing study \/ evidence/);
  assert.match(renderer, /One seller asset it unblocks/);
  assert.match(renderer, /data-claim-status="gap" data-field-usable="false"/);
  assert.match(renderer, /proofPriorities\.top\.map/);
  assert.match(renderer, /<details class="pmm-proof-priority-backlog">/);
  assert.doesNotMatch(renderer, /<details class="pmm-proof-priority-backlog" open/);
});

test("proof-priority wiring does not enter the Product Management Product Comparator renderer", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  const productComparatorRenderer = app.match(/function renderProductComparator\(\)[\s\S]*?\n}/)?.[0] || "";
  assert.doesNotMatch(productComparatorRenderer, /ProofPriorityTransformer|pmmProofPriorities|proofPriorities|gapQueue/);
});

test("the proof-priority module and PMM entry points are mirrored for deployment", async () => {
  const [sourceTransformer, deployTransformer, sourceApp, deployApp, sourceIndex, deployIndex] = await Promise.all([
    readFile(new URL("proof-priority-transformer.js", root), "utf8"),
    readFile(new URL("deploy-site/proof-priority-transformer.js", root), "utf8"),
    readFile(new URL("app.js", root), "utf8"),
    readFile(new URL("deploy-site/app.js", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("deploy-site/index.html", root), "utf8"),
  ]);
  assert.equal(deployTransformer, sourceTransformer);
  assert.equal(deployApp, sourceApp);
  assert.equal(deployIndex, sourceIndex);
});
