import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

const require = createRequire(import.meta.url);
const transformer = require("../customer-voice-barrier-transformer.js");
const root = new URL("../", import.meta.url);

function record(overrides = {}) {
  return {
    id: "cv-training-friction",
    company: "Thermo Fisher",
    product: "Vanquish",
    labType: "Pharma",
    userRole: "Analyst",
    buyingPriority: "Ease of use",
    sentiment: "Mixed",
    category: "Workflow performance / user experience",
    theme: "Initial learning friction",
    customerLanguageSignal: "We received fast reliable results. It is a little hard to figure out at first. There is no display like the Ultimates.",
    languageType: "verbatim_quote",
    sourceName: "SelectScience",
    sourceUrl: "https://example.com/customer-review",
    evidenceRecords: [{ label: "Customer review", url: "https://example.com/customer-review" }],
    fieldCitable: true,
    approvalState: "draft",
    ...overrides,
  };
}

test("verbatim barriers preserve only the customer's barrier phrasing and exclude feature-request sentences", () => {
  const result = transformer.transformCustomerVoiceBarriers({ records: [record()] });
  assert.equal(result.barriers.length, 1);
  assert.equal(result.barriers[0].languageMode, "verbatim");
  assert.equal(result.barriers[0].barrierText, "It is a little hard to figure out at first.");
  assert.doesNotMatch(result.barriers[0].barrierText, /no display/i);
});

test("analyst paraphrases remain visibly non-verbatim and never use PM roadmap interpretation", () => {
  const result = transformer.transformCustomerVoiceBarriers({ records: [record({
    id: "cv-method-migration",
    sentiment: "Negative",
    category: "Method transfer / routine LC modernization",
    theme: "Validation burden slows migration",
    customerLanguageSignal: "Public source mapping suggests users care about method continuity and validation burden during migration.",
    languageType: "analyst_paraphrase",
    pmInterpretation: "Add a new migration feature to the roadmap.",
  })] });
  const barrier = result.barriers[0];
  assert.equal(barrier.languageMode, "paraphrase");
  assert.equal(barrier.languageLabel, "Analyst paraphrase — not a customer quote");
  assert.doesNotMatch(JSON.stringify(barrier), /new migration feature|roadmap/i);
});

test("explicit feature requests and positive value statements are not converted into adoption barriers", () => {
  const result = transformer.transformCustomerVoiceBarriers({ records: [
    record({ id: "feature", sentiment: "Negative", languageType: "analyst_paraphrase", customerLanguageSignal: "Users would like a new display feature." }),
    record({ id: "positive", sentiment: "Positive", customerLanguageSignal: "It is easy to learn and reliable." }),
  ] });
  assert.equal(result.barriers.length, 0);
  assert.equal(result.excludedFeatureRequestCount, 1);
});

test("regulatory records and metadata-only themes are not treated as customer adoption language", () => {
  const result = transformer.transformCustomerVoiceBarriers({ records: [
    record({
      id: "regulatory",
      sentiment: "Negative",
      userRole: "FDA inspection finding",
      evidenceRecords: [{ sourceType: "regulatory", url: "https://example.com/form-483" }],
      customerLanguageSignal: "Cleaning and maintenance findings were reported.",
      theme: "Service and maintenance barrier",
    }),
    record({
      id: "metadata-only",
      sentiment: "Negative",
      languageType: "analyst_paraphrase",
      customerLanguageSignal: "General market landscape observation.",
      theme: "Method migration and validation burden",
    }),
    record({
      id: "decision-criterion",
      sentiment: "Mixed",
      languageType: "analyst_paraphrase",
      customerLanguageSignal: "Users compared vendors by application, hardware, software, and local support.",
      theme: "Vendor selection criteria",
    }),
  ] });
  assert.equal(result.barriers.length, 0);
});

test("every unvalidated tactic value becomes a non-field-usable proof-priority gap", () => {
  const result = transformer.transformCustomerVoiceBarriers({ records: [record()] });
  const barrier = result.barriers[0];
  const gap = result.valueAssumptionGapQueue[0];
  assert.equal(barrier.provenValue.status, "not-established");
  assert.equal(barrier.assumedValue.status, "assumed");
  assert.equal(barrier.assumedValue.customerValidated, false);
  assert.equal(gap.id, barrier.assumedValue.validationGapId);
  assert.equal(gap.source, "Customer Voice barrier");
  assert.equal(gap.status, "gap");
  assert.equal(gap.fieldUsable, false);
  assert.equal(gap.dealImpact, null);
  assert.equal(gap.sellerAsset, "Customer-Proof Request Brief");
  assert.doesNotMatch(barrier.tactic, /roadmap|feature request|build a feature/i);
});

test("customer-validated value requires an explicit validation flag, statement, and citable source", () => {
  const proven = transformer.transformCustomerVoiceBarriers({ records: [record({
    customerValidatedValue: true,
    validatedValueStatement: "Observed onboarding study participants completed the governed task independently.",
  })] });
  assert.equal(proven.barriers[0].provenValue.status, "proven");
  assert.equal(proven.barriers[0].assumedValue.status, "none");
  assert.equal(proven.valueAssumptionGapQueue.length, 0);

  const unsafe = transformer.transformCustomerVoiceBarriers({ records: [record({
    customerValidatedValue: true,
    validatedValueStatement: "Unlinked internal result.",
    fieldCitable: false,
  })] });
  assert.equal(unsafe.barriers[0].provenValue.status, "not-established");
  assert.equal(unsafe.valueAssumptionGapQueue.length, 1);
});

test("unvalidated assumptions resolve to top-three or backlog proof-priority anchors", () => {
  const draft = transformer.transformCustomerVoiceBarriers({ records: [record()] });
  const gapId = draft.valueAssumptionGapQueue[0].id;
  const linked = transformer.linkBarriersToProofPriorities(draft, {
    top: [],
    backlog: [{
      id: "merged-training-gap",
      sourceIds: [gapId],
      claimText: draft.barriers[0].assumedValue.statement,
      missingStudyEvidence: draft.barriers[0].assumedValue.validationStudy,
    }],
  });
  const priority = linked.barriers[0].assumedValue.proofPriority;
  assert.equal(priority.queueLocation, "backlog");
  assert.equal(priority.href, "#pmm-proof-priority-merged-training-gap");
});

test("PMM rendering separates proven and assumed value and leaves the PM Customer Voice renderer unchanged", async () => {
  const [app, index] = await Promise.all([
    readFile(new URL("app.js", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
  ]);
  const adoptionRenderer = app.match(/function pmmCustomerBarrierSourceMarkup[\s\S]*?\n}\n\nfunction renderMarketingAdoptionValuePlans/)?.[0] || "";
  const pmRenderer = app.match(/function renderCustomerVoiceSignals[\s\S]*?\n}\n\nfunction renderMetrics/)?.[0] || "";

  assert.match(index, /customer-voice-barrier-transformer\.js/);
  for (const label of ["Customer barrier", "Tactic to remove it", "Proven value", "Assumed value", "Validation gap"])
    assert.match(adoptionRenderer, new RegExp(label));
  assert.match(adoptionRenderer, /data-proof-priority-link/);
  assert.match(adoptionRenderer, /PMM adoption tactic — not a roadmap item/);
  assert.doesNotMatch(pmRenderer, /CustomerVoiceBarrierTransformer|customerVoiceBarriers|Validation gap/);
});
