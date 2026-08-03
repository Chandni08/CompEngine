import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

const require = createRequire(import.meta.url);
const contract = require("../pmm-data-contract.js");
const root = new URL("../", import.meta.url);
const [app, index, styles, documentContract] = await Promise.all([
  readFile(new URL("app.js", root), "utf8"),
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("styles.css", root), "utf8"),
  readFile(new URL("PMM_DATA_CONTRACT.md", root), "utf8"),
]);

test("every priority segment derives one complete ACCORD adoption plan", () => {
  const dimensions = app.match(/const pmmAccordDimensions = \[[\s\S]*?\n\];/)?.[0] || "";
  for (const dimension of ["Relative advantage", "Compatibility", "Complexity", "Observability", "Risk", "Trialability"])
    assert.match(dimensions, new RegExp(`label: "${dimension}"`));
  for (const tactic of [
    "Controlled evaluation program",
    "Method-migration service",
    "risk-reversal offer",
    "Reference-site program",
    "Validation package",
    "Published comparative proof",
    "Training/onboarding",
    "proof-of-value milestone",
  ]) assert.match(dimensions, new RegExp(tactic, "i"));
  assert.match(app, /buyingCommittee\.segments\.map\(\(segment\) => pmmAdoptionValuePlan/);
  assert.match(app, /plan\.accord\.map/);
});

test("EVC exposes all three named baseline classes and keeps unresolved identity explicit", () => {
  for (const baseline of ["Incumbent Waters system", "Named competitor", "Keep-current-method / do-nothing"])
    assert.match(app, new RegExp(`type: "${baseline.replace(/[/-]/g, (value) => `\\${value}`)}"`));
  assert.match(app, /exact model unresolved/);
  assert.match(app, /exact product\/workflow unresolved/);
  assert.match(app, /Keep current validated method \/ do nothing/);
  assert.match(app, /data-pmm-evc-baseline/);
});

test("all requested EVC drivers are editable low-base-high unsourced assumptions", () => {
  const metrics = app.match(/const pmmEvcMetrics = \[[\s\S]*?\n\];/)?.[0] || "";
  for (const metric of [
    "Analyst time",
    "Method-transfer effort",
    "Validation effort",
    "Downtime",
    "Service burden",
    "Consumables",
    "Failed runs / rework",
    "Review time",
    "Training",
    "Outsourcing",
  ]) assert.match(metrics, new RegExp(metric.replace("/", "\\/")));
  for (const range of ["low", "base", "high"])
    assert.match(app, new RegExp(`pmmEvcAssumptionInput\\(plan, metric, "${range}"\\)`));
  assert.match(app, /Assumption — unsourced/);
  assert.match(app, /data-pmm-evc-assumption/);
});

test("sensitivity ranges validate ordering and never combine unlike units", () => {
  const sensitivity = contract.buildEvcSensitivity([
    { key: "time", unit: "hours/year" },
    { key: "cost", unit: "currency/year" },
    { key: "bad", unit: "hours/year" },
  ], {
    time: { low: 10, base: 20, high: 30 },
    cost: { low: 100, base: 200, high: 300 },
    bad: { low: 9, base: 4, high: 8 },
  });
  assert.equal(sensitivity.unitRanges.length, 2);
  assert.deepEqual(sensitivity.unitRanges.find((range) => range.unit === "hours/year"), { unit: "hours/year", low: 10, base: 20, high: 30, count: 1 });
  assert.deepEqual(sensitivity.invalid, ["bad"]);
  assert.match(app, /unlike units will not be combined/);
});

test("modeled value cannot enter the claims registry without Proven substantiation", () => {
  const blocked = contract.valueClaimEligibility({ substantiationStatus: "Directional", approvalEstablished: true });
  const substantiated = contract.valueClaimEligibility({ substantiationStatus: "Proven", approvalEstablished: false });
  assert.equal(blocked.registryEligible, false);
  assert.equal(blocked.commercialEligible, false);
  assert.equal(blocked.status, "Blocked — substantiation required");
  assert.equal(substantiated.registryEligible, true);
  assert.equal(substantiated.commercialEligible, false);
  assert.match(app, /data-value-claim-eligible/);
  assert.match(app, /Total monetary EVC and value claim blocked/);
  assert.doesNotMatch(app.match(/function marketingClaimsProofRows[\s\S]*?\n}/)?.[0] || "", /adoptionValuePlans|marketingEvcAssumptions/);
  assert.match(documentContract, /cannot enter the claims registry unless its substantiation status is `Proven`/);
});

test("the plan has a dedicated position in the eight-section spine and remains accessible and responsive", () => {
  assert.equal((index.match(/class="panel pmm-primary-section"/g) || []).length, 8);
  assert.match(index, /id="pmm-adoption-value"/);
  assert.match(app, /renderMarketingAdoptionValuePlans\(model\.adoptionValuePlans, model\.customerVoiceBarriers\)/);
  assert.match(app, /aria-label="\$\{escapeHtml\(`\$\{plan\.segment}/);
  assert.match(styles, /\.pmm-evc-table input:focus-visible/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.pmm-accord-grid/);
});
