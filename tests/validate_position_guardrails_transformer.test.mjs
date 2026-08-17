import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

const require = createRequire(import.meta.url);
const transformer = require("../position-guardrails-transformer.js");
const root = new URL("../", import.meta.url);

function source(id, overrides = {}) {
  return {
    id,
    title: `Evidence ${id}`,
    url: `https://example.com/${id}`,
    sourceName: "Named external source",
    family: "Competitor moves",
    fieldCitable: true,
    approvalState: "draft",
    ...overrides,
  };
}

function trend(id, overrides = {}) {
  return {
    id,
    title: `Trend ${id}`,
    narrative: {
      title: `Trend ${id}`,
      synthesis: `Why now ${id}.`,
      implication: `Why Waters ${id}.`,
    },
    evidence: {
      activeGroups: [{ label: "Competitor moves", items: [source(`${id}-citable`)] }],
    },
    ...overrides,
  };
}

test("narrative spine preserves exact Overall Trend why-now and why-Waters framing", () => {
  const result = transformer.transformOverallTrends({ trends: [trend("workflow")] });
  assert.equal(result.narrativeSpine.arc[0].whyNow, "Why now workflow.");
  assert.equal(result.narrativeSpine.arc[0].whyWaters, "Why Waters workflow.");
  assert.equal(result.narrativeSpine.source, "Overall Trend Analysis");
  assert.equal(result.approvalState, "draft");
});

test("pillars contain only field-citable non-blocked records", () => {
  const mixedTrend = trend("platform", {
    evidence: {
      activeGroups: [{ label: "Mixed evidence", items: [
        source("usable"),
        source("internal", { fieldCitable: false }),
        source("blocked", { approvalState: "blocked" }),
        source("unlinked", { url: "" }),
      ] }],
    },
  });
  const result = transformer.transformOverallTrends({ trends: [mixedTrend] });
  assert.equal(result.evidencePillars.length, 1);
  assert.deepEqual(result.evidencePillars[0].sources.map((item) => item.id), ["usable"]);
  assert.ok(result.evidencePillars[0].sources.every((item) => item.fieldCitable === true && item.approvalState !== "blocked"));
});

test("three to five citable trends become pillars and unsupported trends remain framing-only", () => {
  const unsupported = trend("uncited", {
    evidence: { activeGroups: [{ label: "Internal", items: [source("not-citable", { fieldCitable: false })] }] },
  });
  const result = transformer.transformOverallTrends({ trends: [trend("one"), trend("two"), trend("three"), unsupported] });
  assert.equal(result.evidencePillars.length, 3);
  assert.equal(result.pillarRequirement.met, true);
  assert.deepEqual(result.framingOnlyTrends.map((item) => item.id), ["uncited"]);
  assert.ok(result.exclusionRecords.some((item) => item.id === "uncitable-trend-uncited"));
});

test("a missing third citable trend is an explicit gap, never a fabricated pillar", () => {
  const result = transformer.transformOverallTrends({ trends: [trend("one"), trend("two")] });
  assert.equal(result.evidencePillars.length, 2);
  assert.equal(result.pillarRequirement.met, false);
  assert.match(result.pillarRequirement.gap, /only 2 trends have field-citable backing/i);
});

test("explicit exclusions detect broad, volume-proxy, and guaranteed downstream claims", () => {
  const guardrails = transformer.transformOverallTrends({ trends: [trend("one"), trend("two"), trend("three")] });
  const market = transformer.detectExclusionConflicts({ claimText: "All buyers now demand automated LC workflows.", exclusions: guardrails.exclusionRecords });
  const volume = transformer.detectExclusionConflicts({ claimText: "Publication counts prove market demand and adoption.", exclusions: guardrails.exclusionRecords });
  const guarantee = transformer.detectExclusionConflicts({ claimText: "Waters guarantees zero downtime and ensures compliance.", exclusions: guardrails.exclusionRecords });
  assert.ok(market.some((item) => item.exclusionId === "market-prevalence"));
  assert.ok(volume.some((item) => item.exclusionId === "volume-proxy"));
  assert.ok(guarantee.some((item) => item.exclusionId === "guaranteed-outcomes"));
});

test("an exclusion conflict overrides field usability but preserves supported status for auditability", () => {
  const guardrails = transformer.transformOverallTrends({ trends: [trend("one"), trend("two"), trend("three")] });
  const flagged = transformer.flagDownstreamClaim({
    claimText: "Waters guarantees zero downtime.",
    status: "supported",
    fieldUsable: true,
    supportingEvidence: [source("support")],
  }, { exclusions: guardrails.exclusionRecords });
  assert.equal(flagged.status, "supported");
  assert.equal(flagged.guardrailStatus, "conflict");
  assert.equal(flagged.fieldUsable, false);
});

test("PMM renders the trend-derived spine, citable pillars, exclusions, and downstream conflicts without changing the PM trend renderer", async () => {
  const [app, index] = await Promise.all([
    readFile(new URL("app.js", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
  ]);
  const governing = app.match(/function pmmGoverningPositionMarkup[\s\S]*?\n}\n\nfunction renderMarketingGoverningPosition/)?.[0] || "";
  const productRenderer = app.match(/function renderOverallTrendAnalysis[\s\S]*?\n}\n\nfunction renderDecisionQueue/)?.[0] || "";
  for (const label of ["Why Now / Why Waters", "Citable Evidence Pillar", "Explicit exclusions", "Overall approval state", "Downstream contradiction flag"])
    assert.match(governing, new RegExp(label, "i"));
  assert.match(index, /position-guardrails-transformer\.js/);
  assert.doesNotMatch(productRenderer, /PositionGuardrailsTransformer|positionGuardrailsTransformer|pmmGoverningPosition/);
});
