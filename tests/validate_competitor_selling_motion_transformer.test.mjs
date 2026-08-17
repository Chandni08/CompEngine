import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

const require = createRequire(import.meta.url);
const transformer = require("../competitor-selling-motion-transformer.js");
const root = new URL("../", import.meta.url);

function profile(moves) {
  return {
    competitor: "Shimadzu",
    intent: "Repeated one-year direction: Defend and extend core LC footprint in regulated routine QC workflows",
    evidenceItems: moves,
  };
}

function move(overrides = {}) {
  return {
    id: "move-1",
    type: "Launch",
    title: "Nexera refresh for validated method transfer",
    observedDetail: "The official launch describes method transfer and routine QC workflows.",
    date: "2026-07-10",
    sourceName: "Shimadzu News",
    url: "https://example.com/shimadzu-launch",
    fieldCitable: true,
    approvalState: "draft",
    ...overrides,
  };
}

function supportedClaim(overrides = {}) {
  return {
    id: "claim-transfer",
    competitor: "Shimadzu",
    competitorProduct: "Nexera X4",
    watersProduct: "ACQUITY Premier",
    dimension: "Method transfer",
    claimText: "ACQUITY Premier provides faster method transfer under the cited study conditions.",
    status: "supported",
    approvalState: "in-review",
    fieldUsable: true,
    supportingEvidence: [{
      id: "proof-1",
      label: "Independent controlled comparison",
      url: "https://example.org/controlled-comparison",
      fieldCitable: true,
      approvalState: "approved",
    }],
    ...overrides,
  };
}

test("one PMM selling motion is emitted for every governed Competitor Intent record", () => {
  const result = transformer.transformCompetitorIntentProfiles({
    profiles: [profile([move(), move({ id: "move-2", title: "Routine QC software refresh" })])],
  });

  assert.equal(result.moves.length, 2);
  assert.equal(result.groups[0].moves.length, 2);
  assert.ok(result.moves.every((item) => item.observedMove.fieldCitable === true));
  assert.ok(result.moves.every((item) => item.observedMove.approvalState === "draft"));
  assert.ok(result.moves.every((item) => item.inferredIntent.includes("Defend and extend")));
});

test("a matching supported non-blocked claim produces a defensible response with only citable evidence", () => {
  const result = transformer.transformCompetitorIntentProfiles({
    profiles: [profile([move()])],
    supportedClaims: [supportedClaim({
      supportingEvidence: [
        supportedClaim().supportingEvidence[0],
        { id: "internal", url: "https://waters.com/internal", fieldCitable: false, approvalState: "draft" },
        { id: "blocked", url: "https://example.org/blocked", fieldCitable: true, approvalState: "blocked" },
      ],
    })],
  });

  const response = result.moves[0].watersResponse;
  assert.equal(response.status, "defensible");
  assert.equal(response.responseText, supportedClaim().claimText);
  assert.equal(response.fieldUsable, true);
  assert.deepEqual(response.supportingEvidence.map((record) => record.id), ["proof-1"]);
  assert.ok(response.supportingEvidence.every((record) => record.fieldCitable === true && record.approvalState !== "blocked"));
});

test("unrelated, blocked, or customer-inapplicable citable claims never become field responses", () => {
  const result = transformer.transformCompetitorIntentProfiles({
    profiles: [profile([move({ customerName: "Named Lab" })])],
    supportedClaims: [
      supportedClaim({ id: "unrelated", dimension: "Purchase price", claimText: "Lower acquisition price." }),
      supportedClaim({ id: "blocked-claim", approvalState: "blocked" }),
      supportedClaim({ id: "wrong-customer", applicableCustomers: ["Different Lab"] }),
    ],
  });

  const response = result.moves[0].watersResponse;
  assert.equal(response.status, "needs proof");
  assert.equal(response.fieldUsable, false);
  assert.deepEqual(response.supportingEvidence, []);
  assert.match(response.responseText, /no field-citable, non-blocked counter/i);
});

test("a proof gap cross-links to its exact Three Proof Priorities card", () => {
  const result = transformer.transformCompetitorIntentProfiles({
    profiles: [profile([move()])],
    proofPriorities: {
      top: [],
      backlog: [{
        id: "gap-method-transfer",
        competitor: "Shimadzu",
        dimension: "Method transfer",
        claimText: "Faster method transfer",
        missingStudyEvidence: "Run a controlled common-condition method-transfer study.",
      }],
    },
  });

  const priority = result.moves[0].watersResponse.proofPriority;
  assert.equal(priority.id, "gap-method-transfer");
  assert.equal(priority.queueLocation, "backlog");
  assert.equal(priority.href, "#pmm-proof-priority-gap-method-transfer");
});

test("buying-situation inference names a deal type and committee role while exposing its basis", () => {
  const buyingSituation = transformer.inferBuyingSituation(move());
  assert.equal(buyingSituation.dealType, "Validated-method migration");
  assert.equal(buyingSituation.committeeRole, "QC / QA or validation veto");
  assert.equal(buyingSituation.classification, "inference");
  assert.match(buyingSituation.basis, /validate with deal evidence/i);
});

test("PMM rendering exposes selling-motion fields and proof links without entering the PM renderer", async () => {
  const [app, index] = await Promise.all([
    readFile(new URL("app.js", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
  ]);
  const pmmRenderer = app.match(/function pmmSellingMotionObservedSourceMarkup[\s\S]*?\n}\n\nconst pmmActivationAssetTypes/)?.[0] || "";
  const pmRenderer = app.match(/function renderCompetitorIntentCards\(signals\)[\s\S]*?\n}\n\nfunction roadmapImpactEvidenceRecords/)?.[0] || "";

  assert.match(index, /competitor-selling-motion-transformer\.js/);
  for (const field of ["Observed move", "Inferred intent", "Buying situation targeted", "Deal type", "Committee role", "Waters response"]) {
    assert.match(pmmRenderer, new RegExp(field));
  }
  assert.match(pmmRenderer, /data-response-status="needs-proof" data-field-usable="false"/);
  assert.match(pmmRenderer, /data-proof-priority-link/);
  assert.match(pmmRenderer, /supportingEvidence\.filter\(\(record\) => record\.fieldCitable === true/);
  assert.doesNotMatch(pmRenderer, /competitorSellingMotionTransformer|pmmCompetitorIntentSellingMotions|proofPriorityLink|needs proof/i);
});
