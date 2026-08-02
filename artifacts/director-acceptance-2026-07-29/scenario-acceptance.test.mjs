import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("./", import.meta.url);
const scenarios = await Promise.all([
  "all-markets.json",
  "biopharma-oligo.json",
  "environmental-pfas.json",
  "pharma-qc-validated-migration.json",
  "agilent-competitive-replacement.json",
  "do-nothing-validated-method.json",
].map(async (name) => JSON.parse(await readFile(new URL(name, root), "utf8"))));

const requiredRoles = [
  "bench-user",
  "method-developer",
  "quality-veto",
  "it-veto",
  "lab-manager",
  "economic-buyer",
  "executive-sponsor",
];

test("1. KPI counts reconcile with destination panels in every scenario", () => {
  for (const scenario of scenarios) {
    assert.equal(scenario.metrics["positioning-decisions"], scenario.destinations.decisionCards, `${scenario.name}: positioning decisions`);
    assert.equal(scenario.metrics["claims-awaiting-approval"], scenario.destinations.claimRowsWithoutApproval, `${scenario.name}: claims without approval`);
    assert.equal(scenario.metrics["direct-evidence-sources"], scenario.destinations.appendixUnique, `${scenario.name}: appendix URLs`);
    assert.equal(scenario.metrics["exact-customer-sources"], scenario.destinations.customerUrlSummary, `${scenario.name}: customer URL destination`);
  }
});

test("2. Positioning decisions derive from the governing position", () => {
  for (const scenario of scenarios) {
    assert.ok(scenario.destinations.decisionCards > 0, `${scenario.name}: no positioning decision rendered`);
    assert.ok(!/unresolved/i.test(scenario.governing.swing), `${scenario.name}: governing swing is unresolved`);
    assert.ok(scenario.traces.length >= scenario.destinations.decisionCards, `${scenario.name}: missing governing traces`);
    for (const trace of scenario.traces) {
      assert.equal(trace.ref, scenario.governing.id, `${scenario.name}: trace target`);
      assert.equal(trace.status, "aligned", `${scenario.name}: trace alignment`);
    }
  }
});

test("3. Buying committee and calculated swing cascade are complete", () => {
  for (const scenario of scenarios) {
    assert.ok(scenario.committees.length > 0, `${scenario.name}: no buying committee rendered`);
    for (const committee of scenario.committees) {
      assert.deepEqual(committee.roleKeys, requiredRoles, `${scenario.name}: required committee roles`);
      assert.equal(committee.weightTotal, 100, `${scenario.name}: Fishbein weights`);
      assert.match(scenario.governing.swing, new RegExp(committee.swing, "i"), `${scenario.name}: governing swing trace`);
    }
  }
});

test("4. Claims, proof compatibility, and break-report controls remain safe", () => {
  for (const scenario of scenarios) {
    assert.equal(scenario.claims.readyRows, 0, `${scenario.name}: no unapproved claim may be Ready`);
    assert.equal(scenario.metrics["claims-awaiting-approval"], scenario.destinations.claimRowsWithoutApproval, `${scenario.name}: approval KPI`);
    if (scenario.claims.inapplicableEvidence > 0) {
      assert.match(scenario.breakReport.articles["Inapplicable proof"].heading, new RegExp(`\\b${scenario.claims.inapplicableEvidence}\\b`), `${scenario.name}: inapplicable-proof break count`);
    }
    const unsupported = scenario.claims.substantiation.Unsupported || 0;
    if (unsupported > 0) {
      assert.match(scenario.breakReport.articles["Unsupported claims"].heading, new RegExp(`\\b${unsupported}\\b`), `${scenario.name}: unsupported-claim break count`);
    }
  }
});

test("5. ACCORD tactics and governed EVC are present for every scenario", () => {
  for (const scenario of scenarios) {
    assert.ok(scenario.adoption.planCount > 0, `${scenario.name}: no adoption/value plan rendered`);
    for (const plan of scenario.adoption.plans) {
      assert.deepEqual(plan.dimensions, ["relative-advantage", "compatibility", "complexity", "observability", "risk", "trialability"], `${scenario.name}: ACCORD dimensions`);
      assert.equal(plan.evcMetrics, 10, `${scenario.name}: EVC assumptions`);
      assert.equal(plan.valueClaimEligible, "false", `${scenario.name}: unsourced value claim must remain blocked`);
    }
  }
});

test("6. Activation artifacts render with draft governance", () => {
  for (const scenario of scenarios) {
    assert.equal(scenario.artifacts.count, 7, `${scenario.name}: artifact count`);
    assert.equal(scenario.artifacts.exportCount, 7, `${scenario.name}: export controls`);
    assert.equal(scenario.artifacts.draftCount, 7, `${scenario.name}: draft artifacts`);
    assert.equal(scenario.artifacts.watermarkedCount, 7, `${scenario.name}: draft watermarks`);
    assert.equal(scenario.artifacts.copyApprovedDisabled, true, `${scenario.name}: approved-copy control`);
  }
});

test("7. Canonical evidence references resolve and provenance remains explicit", () => {
  for (const scenario of scenarios) {
    assert.equal(scenario.provenance.unresolvedEvidenceRefs, 0, `${scenario.name}: unresolved canonical evidence reference`);
    assert.equal(scenario.provenance.linkedSources, scenario.destinations.appendixUnique, `${scenario.name}: unique source URLs`);
    assert.equal(scenario.pageSections, 8, `${scenario.name}: PMM narrative spine`);
  }
});
