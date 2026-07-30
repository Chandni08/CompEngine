import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

const require = createRequire(import.meta.url);
const contract = require("../pmm-data-contract.js");
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

const baseClaim = {
  productWorkflow: ["LC_PLATFORM"],
  testConditions: ["CONTROLLED_COMPARISON"],
  asOfDate: "2026-07-28",
  maxAgeDays: 1095,
};

function compatibility(claim, evidence) {
  return contract.evaluateClaimEvidenceCompatibility({ ...baseClaim, ...claim }, evidence);
}

test("Reliability for Pharma rejects BioAccord MAM launch proof", () => {
  const result = compatibility({
    attributes: ["LC_RELIABILITY"],
    segmentApplication: ["Pharma"],
    comparator: ["Agilent"],
  }, {
    productWorkflow: ["BIOACCORD_MAM", "LCMS_WORKFLOW"],
    attributes: ["ANALYTICAL_PERFORMANCE"],
    segmentApplication: ["Biopharma"],
    comparator: [],
    testConditions: ["LAUNCH_ANNOUNCEMENT"],
    date: "2021-06-08",
  });
  assert.equal(result.status, "Inapplicable");
  assert.ok(result.mismatchedDimensions.includes("Product / workflow"));
  assert.ok(result.mismatchedDimensions.includes("Attribute"));
  assert.ok(result.mismatchedDimensions.includes("Segment / application"));
});

test("Cost for Food safety rejects the generic About Waters page", () => {
  const result = compatibility({
    attributes: ["COST_TCO"],
    segmentApplication: ["Food safety"],
    comparator: ["Shimadzu"],
  }, {
    productWorkflow: ["CORPORATE_PROFILE"],
    attributes: [],
    segmentApplication: [],
    comparator: [],
    testConditions: ["CORPORATE_DESCRIPTION"],
    date: "",
  });
  assert.equal(result.status, "Inapplicable");
  assert.ok(result.mismatchedDimensions.includes("Product / workflow"));
  assert.ok(result.mismatchedDimensions.includes("Test conditions"));
});

test("Ease of use for Clinical rejects biopharma MAM proof", () => {
  const result = compatibility({
    attributes: ["USABILITY_SETUP"],
    segmentApplication: ["Clinical"],
    comparator: ["Thermo Fisher"],
  }, {
    productWorkflow: ["BIOACCORD_MAM", "LCMS_WORKFLOW"],
    attributes: ["ANALYTICAL_PERFORMANCE"],
    segmentApplication: ["Biopharma"],
    comparator: [],
    testConditions: ["LAUNCH_ANNOUNCEMENT"],
    date: "2021-06-08",
  });
  assert.equal(result.status, "Inapplicable");
  assert.ok(result.mismatchedDimensions.includes("Attribute"));
  assert.ok(result.mismatchedDimensions.includes("Segment / application"));
});

test("Xevo TQ Absolute launch evidence cannot substantiate setup, compliance protection, or ease of use", () => {
  const result = compatibility({
    attributes: ["USABILITY_SETUP", "COMPLIANCE_CONTROL"],
    segmentApplication: ["Clinical"],
    comparator: ["SCIEX"],
  }, {
    productWorkflow: ["XEVO_TQ_ABSOLUTE", "LCMSMS_WORKFLOW"],
    attributes: ["ANALYTICAL_PERFORMANCE"],
    segmentApplication: ["Clinical"],
    comparator: [],
    testConditions: ["LAUNCH_ANNOUNCEMENT"],
    date: "2022-05-17",
  });
  assert.equal(result.status, "Inapplicable");
  assert.ok(result.mismatchedDimensions.includes("Product / workflow"));
  assert.ok(result.mismatchedDimensions.includes("Attribute"));
  assert.ok(result.mismatchedDimensions.includes("Test conditions"));
});

test("mismatched evidence cannot become Proven and Ready requires both proof and approval", () => {
  const rejectedEvidence = [{ compatibility: { status: "Inapplicable" }, independent: true, sourceOrganizationId: "one" }];
  assert.equal(contract.claimSubstantiation(rejectedEvidence).status, "Unsupported");
  assert.equal(contract.claimCommercialReadiness("Proven", false).value, "Blocked");
  assert.equal(contract.claimCommercialReadiness("Directional", true).value, "Blocked");
  assert.equal(contract.claimCommercialReadiness("Proven", true).value, "Ready");
});

test("unique records and independent corroboration are separate claim metrics", () => {
  const records = [
    { url: "https://source.example/a", compatibility: { status: "Applicable" }, independent: true, sourceOrganizationId: "org-a" },
    { url: "https://source.example/b", compatibility: { status: "Applicable" }, independent: true, sourceOrganizationId: "org-a" },
    { url: "https://source.example/c", compatibility: { status: "Applicable" }, independent: true, sourceOrganizationId: "org-b" },
  ];
  assert.equal(records.length, 3);
  assert.equal(contract.establishedIndependentSourceCount(records), 2);
  assert.equal(contract.claimSubstantiation(records).status, "Proven");
});

test("registry exposes every required governed claim field", () => {
  for (const label of [
    "Exact proposed claim wording",
    "Segment / application",
    "Buyer / channel",
    "Reference competitor or baseline",
    "Exact supporting evidence and compatibility",
    "Source counts",
    "Evidence comparability",
    "Substantiation",
    "Legal / claims approval",
    "Approved wording",
    "Owner",
    "Expiration",
    "Next required action",
  ]) assert.match(app, new RegExp(label.replace("/", "\\/"), "i"));
  for (const type of ["performance", "workflow", "economic", "usability", "compliance", "comparative"]) {
    assert.match(app, new RegExp(`return "${type}"`));
  }
});

test("registry compatibility governs positioning proof and activation inputs", () => {
  assert.match(app, /function pmmApplyClaimsRegistryToDecisions/);
  assert.match(app, /proof\.compatibility\.status === "Applicable"/);
  assert.match(app, /proof\.compatibility\.status === "Inapplicable"/);
  assert.match(app, /blocked as Inapplicable/);
  assert.match(app, /Applicable proof/);
  assert.match(app, /const positioningDecisions = pmmApplyClaimsRegistryToDecisions\(positioningDecisionCandidates, claimRows\)/);
});
