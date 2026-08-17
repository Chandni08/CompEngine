import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

const require = createRequire(import.meta.url);
const governance = require("../evidence-governance.js");
const root = new URL("../", import.meta.url);

function healthIndex(url, status = "ok") {
  return governance.buildLinkHealthIndex([{ url, status }]);
}

test("fieldCitable requires a public named external source, a healthy link, and customer-safe evidence", () => {
  const url = "https://example.com/public-proof";
  const record = {
    id: "external-proof",
    sourceName: "Example Scientific Journal",
    sourceType: "Peer-reviewed journal",
    sourceUrl: url,
    evidenceStatus: "verified",
  };
  assert.equal(governance.deriveFieldCitable(record, { linkHealthIndex: healthIndex(url) }), true);
  assert.equal(governance.deriveFieldCitable({ ...record, sourceName: "Waters official", sourceUrl: "https://www.waters.com/proof" }, { linkHealthIndex: healthIndex("https://www.waters.com/proof") }), false);
  assert.equal(governance.deriveFieldCitable({ ...record, sourceUrl: "" }, { linkHealthIndex: healthIndex(url) }), false);
  assert.equal(governance.deriveFieldCitable({ ...record, languageType: "analyst_paraphrase" }, { linkHealthIndex: healthIndex(url) }), false);
  assert.equal(governance.deriveFieldCitable({ ...record, evidenceStatus: "partial" }, { linkHealthIndex: healthIndex(url) }), false);
  assert.equal(governance.deriveFieldCitable(record, { linkHealthIndex: healthIndex(url, "blocked") }), false);
});

test("approvalState preserves only the governed enum and otherwise defaults to draft", () => {
  for (const value of governance.approvalStates) assert.equal(governance.normalizeApprovalState(value), value);
  for (const value of [undefined, null, "", "pending", "Approved", "Approval not established"]) {
    assert.equal(governance.normalizeApprovalState(value), "draft");
  }
});

test("ingestion normalization exposes both governance fields on nested evidence and signal records", () => {
  const publicUrl = "https://external.example/evidence";
  const dataset = governance.normalizeDataset({
    generatedAt: "2026-08-02T00:00:00Z",
    signals: [
      { id: "public", sourceName: "External Publisher", sourceUrl: publicUrl, evidenceStatus: "verified", approvalState: "in-review" },
      { id: "unlinked", sourceName: "External Publisher" },
    ],
    groups: [{ id: "group", records: [{ label: "Inference without a source" }] }],
    sources: [{
      name: "Inherited External Publisher",
      sourceType: "public_source",
      homepage: publicUrl,
      recentRecords: [{ title: "Nested public record", sourceUrl: publicUrl }],
    }],
  }, { datasetName: "fixture", linkHealthIndex: healthIndex(publicUrl) });

  assert.deepEqual(
    dataset.signals.map(({ fieldCitable, approvalState }) => ({ fieldCitable, approvalState })),
    [
      { fieldCitable: true, approvalState: "in-review" },
      { fieldCitable: false, approvalState: "draft" },
    ],
  );
  assert.equal(dataset.groups[0].fieldCitable, false);
  assert.equal(dataset.groups[0].approvalState, "draft");
  assert.equal(dataset.groups[0].records[0].fieldCitable, false);
  assert.equal(dataset.groups[0].records[0].approvalState, "draft");
  assert.equal(dataset.sources[0].recentRecords[0].fieldCitable, true, "nested records inherit named-source attribution from their source container");
  assert.equal("fieldCitable" in dataset, false, "dataset metadata is not mislabeled as an evidence record");
});

test("field-citation and approval filters compose without promoting unsafe records", () => {
  const rows = [
    { id: "a", fieldCitable: true, approvalState: "draft" },
    { id: "b", fieldCitable: true, approvalState: "approved" },
    { id: "c", fieldCitable: false, approvalState: "approved" },
  ];
  assert.deepEqual(governance.filterRecords(rows, { fieldCitable: "true", approvalState: "approved" }).map((row) => row.id), ["b"]);
  assert.deepEqual(governance.filterRecords(rows, { fieldCitable: "false", approvalState: "All" }).map((row) => row.id), ["c"]);
});

test("the engine normalizes every loaded dataset and PMM reads through the governance gate", async () => {
  const [app, index] = await Promise.all([
    readFile(new URL("app.js", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
  ]);

  assert.match(index, /evidence-governance\.js/);
  assert.match(index, /id="pmmFieldCitableFilter"[^>]*data-pmm-governance-filter="fieldCitable"/);
  assert.match(index, /id="pmmApprovalStateFilter"[^>]*data-pmm-governance-filter="approvalState"/);
  assert.match(index, /<option value="draft">Draft<\/option>[\s\S]*<option value="in-review">In review<\/option>[\s\S]*<option value="approved">Approved<\/option>[\s\S]*<option value="blocked">Blocked<\/option>/);
  assert.match(app, /fetch\("data\/link_health\.json"/);
  assert.match(app, /pmmEvidenceGovernance\.normalizeDataset/);
  assert.match(app, /const governedSignals = pmmGovernedRecords\(signals\)/);
  assert.match(app, /marketingPrioritizedCompetitorContexts\(governedSignals\)/);
  assert.match(app, /marketingEvidenceAppendixModel\(governedSignals\)/);
  assert.match(app, /governanceFilters: \{ \.\.\.state\.marketingGovernanceFilters \}/);
  assert.match(app, /document\.querySelectorAll\("\.pmm-hierarchy-filter"\)/, "governance filters remain hidden outside Product Marketing");
});
