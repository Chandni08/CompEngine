import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

const require = createRequire(import.meta.url);
const transformer = require("../evidence-appendix-transformer.js");
const root = new URL("../", import.meta.url);

function evidence(id, overrides = {}) {
  return {
    id,
    label: `Evidence ${id}`,
    sourceName: "Named external source",
    url: `https://example.com/${id}`,
    fieldCitable: true,
    approvalState: "approved",
    ...overrides,
  };
}

function claimReference(id, source, overrides = {}) {
  return {
    referenceId: `claim:${id}`,
    kind: "claim",
    approvalState: "approved",
    label: `Claim Control · ${id}`,
    href: `#claim-${id}`,
    records: source ? [source] : [],
    backingRecords: source ? [source] : [],
    ...overrides,
  };
}

test("groups only evidence used by PMM sections and preserves support backlinks", () => {
  const shared = evidence("shared", { sourceType: "Scientific publication" });
  const unused = evidence("unused");
  const result = transformer.buildTraceableAppendix({
    baseAppendix: { groups: [{ title: "Raw", records: [shared, unused] }] },
    sections: [
      { id: "claims", title: "Claim Control", href: "#claims", references: [claimReference("one", shared)] },
      { id: "guardrails", title: "Position Guardrails", href: "#guardrails", references: [{
        referenceId: "pillar:one",
        kind: "pillar",
        label: "Position Guardrails · Pillar 1",
        href: "#pillar-one",
        records: [shared],
        backingRecords: [shared],
      }] },
    ],
  });

  assert.equal(result.displayedRecordCount, 1);
  assert.equal(result.groups[0].title, "Scientific publication");
  assert.deepEqual(result.groups[0].records[0].supports.map((support) => support.href), ["#claim-one", "#pillar-one"]);
  assert.ok(result.groups.every((group) => group.records.every((record) => !record.url.endsWith("/unused"))));
});

test("flags an approved Claim Control claim with zero appendix backing", () => {
  const draftMissing = claimReference("draft", null, { approvalState: "draft" });
  const approvedMissing = claimReference("approved", null);
  const result = transformer.buildTraceableAppendix({
    sections: [{ id: "claims", title: "Claim Control", href: "#claims", references: [draftMissing, approvedMissing] }],
  });

  assert.equal(result.validation.passed, false);
  assert.equal(result.validation.approvedClaimCount, 1);
  assert.deepEqual(result.validation.missingApprovedClaims.map((item) => item.referenceId), ["claim:approved"]);
  assert.match(result.validation.missingApprovedClaims[0].reason, /zero Evidence Appendix backing records/);
});

test("blocked evidence cannot satisfy approved-claim backing", () => {
  const blocked = evidence("blocked", { approvalState: "blocked" });
  const result = transformer.buildTraceableAppendix({
    sections: [{ id: "claims", title: "Claim Control", href: "#claims", references: [{
      ...claimReference("blocked-only", blocked),
      records: [blocked],
      backingRecords: [],
    }] }],
  });

  assert.equal(result.displayedRecordCount, 1);
  assert.equal(result.validation.missingApprovedClaims.length, 1);
});

test("every Position Guardrails pillar participates in traceability validation", () => {
  const source = evidence("pillar-proof", { sourceName: "Conference organizer", sourceType: "Conference event" });
  const result = transformer.buildTraceableAppendix({
    sections: [{ id: "guardrails", title: "Position Guardrails", href: "#guardrails", references: [{
      referenceId: "pillar:backed",
      kind: "pillar",
      label: "Pillar backed",
      href: "#pillar-backed",
      records: [source],
      backingRecords: [source],
    }, {
      referenceId: "pillar:missing",
      kind: "pillar",
      label: "Pillar missing",
      href: "#pillar-missing",
      records: [],
      backingRecords: [],
    }] }],
  });

  assert.equal(result.validation.pillarCount, 2);
  assert.equal(result.validation.backedPillarCount, 1);
  assert.deepEqual(result.validation.missingPillars.map((item) => item.referenceId), ["pillar:missing"]);
});

test("canonical URL consolidation retains every PMM use", () => {
  const first = evidence("same", { url: "https://www.example.com/proof/?utm_source=one" });
  const second = evidence("other-id", { url: "https://example.com/proof#details" });
  const result = transformer.buildTraceableAppendix({
    sections: [
      { id: "claims", title: "Claim Control", href: "#claims", references: [claimReference("one", first)] },
      { id: "seller", title: "Seller Assets", href: "#seller", references: [{ referenceId: "seller", kind: "section", label: "Seller Assets", records: [second] }] },
    ],
  });

  assert.equal(result.uniqueSourceCount, 1);
  assert.equal(result.displayedRecordCount, 1);
  assert.equal(result.groups[0].records[0].supports.length, 2);
});

test("the appendix renderer is source-type grouped, collapsed, and linked back without changing PM rendering", async () => {
  const [app, index] = await Promise.all([
    readFile(new URL("app.js", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
  ]);
  assert.match(index, /evidence-appendix-transformer\.js/);
  assert.match(index, /id="pmm-evidence-appendix"[^>]*data-default-collapsed="true"/);
  assert.match(app, /buildTraceableAppendix/);
  assert.match(app, /data-pmm-appendix-backlink/);
  assert.match(app, /data-appendix-validation-status/);
  assert.match(app, /missingApprovedClaims/);
  assert.match(app, /pmmPillarTraceAnchorId/);
  assert.match(app, /pmmComparatorClaimTraceAnchorId/);
  assert.doesNotMatch(app.match(/function renderProductComparator[\s\S]*?\n}\n\nfunction openComparisonPanel/)?.[0] || "", /EvidenceAppendixTransformer|evidenceAppendixTransformer|appendix trace/i);
});
