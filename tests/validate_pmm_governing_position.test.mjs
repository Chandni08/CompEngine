import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const [app, index, styles, contract, runtime] = await Promise.all([
  readFile(new URL("app.js", root), "utf8"),
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("styles.css", root), "utf8"),
  readFile(new URL("PMM_DATA_CONTRACT.md", root), "utf8"),
  readFile(new URL("pmm-data-contract.js", root), "utf8"),
]);

test("exactly one governing-position module is rendered above PMM decisions", () => {
  assert.equal((app.match(/class="pmm-governing-position"/g) || []).length, 1);
  assert.match(app, /renderMarketingGoverningPosition\(model\.governingPosition\).*renderMarketingPositioningDecisions/s);
  assert.match(index, /<section id="pmm-positioning-decisions"/);
  assert.match(index, /id="pmm-governing-position"/);
  assert.equal((index.match(/class="panel pmm-primary-section"/g) || []).length, 8);
});

test("the governing model contains every required positioning field", () => {
  for (const field of [
    "targetCustomer",
    "prioritySegment",
    "customerJob",
    "buyingSituation",
    "referenceClass",
    "primaryValueProposition",
    "pointOfParity",
    "pointOfDifference",
    "narrativeSpine",
    "evidencePillars",
    "framingOnlyTrends",
    "pillarRequirement",
    "exclusions",
    "exclusionRecords",
    "approvalState",
    "approver",
    "lastReviewedDate",
  ]) assert.match(app, new RegExp(`${field}:`));
  assert.match(app, /positionGuardrailsTransformer\.transformOverallTrends/);
  assert.match(app, /pmmOverallTrendGuardrailInputs/);
  assert.match(app, /field-citable Overall Trend Analysis pillar/i);
});

test("unapproved governing language propagates to all downstream PMM objects", () => {
  assert.match(app, /approvalState: "draft"/);
  assert.match(app, /draft: "Draft — not approved"/);
  assert.match(app, /state\.marketingGoverningPosition = governingPosition/);
  assert.match(app, /marketingPositioningDecisionCandidates\(contexts, governingPosition\)/);
  assert.match(app, /marketingClaimsProofRows\(contexts, governingPosition\)/);
  assert.match(app, /renderMarketingCompetitiveNarrative\(signals, model\.governingPosition, model\.marketChoice, model\.contexts\)/);
  assert.match(app, /renderMarketingActivationBacklog\(model\.positioningDecisions, model\.governingPosition, model\.breakReport, model\.activationActions, model\.artifactProduction, model\.sellerAssets\)/);
  assert.doesNotMatch(app, /pmmEvidenceTypeMarkup\("approval", "Proposed/);
});

test("downstream positioning objects and competitor narratives retain governing-position inheritance", () => {
  assert.match(app, /Inherited customer \/ segment/);
  assert.match(app, /Inherited job \/ category/);
  assert.match(app, /Inherited value proposition/);
  assert.match(app, /Inherited point of parity/);
  assert.match(app, /Inherited point of difference/);
  assert.match(app, /Local adaptation/);
  assert.match(app, /positioningDecisions\.map\(\(decision\) => \(\{ \.\.\.decision\.governingTrace/);
  assert.match(app, /pmmApplyClaimsRegistryToDecisions\(positioningDecisionCandidates, claimRows\)/);
  assert.match(app, /governingTrace: counterPosition\.trace/);
});

test("contradictions and unsupported deviations are visibly flagged", () => {
  assert.match(runtime, /Contradictory downstream claim detected/);
  assert.match(runtime, /Unsupported deviation/);
  assert.match(app, /data-alignment-status=/);
  assert.match(app, /PmmDataContract\.evaluateGoverningAlignment/);
  assert.match(styles, /pmm-governing-trace\[data-alignment-status="contradiction"\]/);
  assert.match(styles, /pmm-governing-trace\[data-alignment-status="unsupported"\]/);
});

test("the PMM data contract documents governing-position inheritance", () => {
  assert.match(contract, /\| Governing position \|/);
  assert.match(contract, /exactly one canonical Position Guardrails object/i);
  assert.match(contract, /three to five evidence pillars/i);
  assert.match(contract, /Every downstream Waters counter-position, claim response, and activation asset carries the governing-position identifier/);
});
