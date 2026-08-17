import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

const require = createRequire(import.meta.url);
const transformer = require("../seller-assets-transformer.js");
const exportsApi = require("../artifact-export.js");
const root = new URL("../", import.meta.url);

const approvedEvidence = (suffix = "proof") => ({
  id: suffix,
  label: `Approved ${suffix}`,
  sourceName: "Named external source",
  url: `https://example.com/${suffix}`,
  fieldCitable: true,
  approvalState: "approved",
});

const approvedClaim = {
  id: "claim-approved",
  competitor: "Agilent",
  targetSegments: ["Biopharma"],
  claimText: "Approved exact comparative wording.",
  status: "supported",
  approvalState: "approved",
  fieldCitable: true,
  fieldUsable: true,
  supportingEvidence: [approvedEvidence()],
};

const approvedMove = {
  id: "move-approved",
  competitor: "Agilent",
  observedMove: {
    text: "Agilent launched an approved public workflow move.",
    url: "https://example.com/move",
    fieldCitable: true,
    approvalState: "approved",
  },
  watersResponse: {
    status: "defensible",
    responseText: approvedClaim.claimText,
    claimId: approvedClaim.id,
    approvalState: "approved",
    supportingEvidence: [approvedEvidence("counter")],
  },
};

function assembled(overrides = {}) {
  return transformer.assembleSellerAssets({
    competitor: "Agilent",
    targetSegment: "Biopharma",
    comparatorClaims: [approvedClaim],
    competitorPlays: [approvedMove],
    applicationTrends: [
      { marketSegment: "Biopharma", theme: "Oligonucleotide analytics", selectedPeriodCount: 80, signal: { ratio: 1.4, comparison: "+40%" } },
      { marketSegment: "Biopharma", theme: "LNP workflows", selectedPeriodCount: 120, signal: { ratio: 1.2, comparison: "+20%" } },
      { marketSegment: "Environmental", theme: "PFAS", selectedPeriodCount: 500, signal: { ratio: 3.8, comparison: "+280%" } },
    ],
    proofPriorities: { top: [], backlog: [] },
    horizon: "1 year",
    ...overrides,
  });
}

test("assembles exactly four assets for the selected competitor and target segment", () => {
  const result = assembled();
  assert.deepEqual(result.assets.map((asset) => asset.id), ["battlecard", "claims-sheet", "lead-vertical-pitch", "proof-request-list"]);
  assert.equal(result.competitor, "Agilent");
  assert.equal(result.targetSegment, "Biopharma");
  assert.equal(result.shippableCount, 3);
  assert.equal(result.internalOnlyCount, 1);
});

test("the pitch chooses the highest-growth applicable Application Trends vertical", () => {
  const result = assembled();
  const pitch = result.assets.find((asset) => asset.id === "lead-vertical-pitch");
  assert.equal(pitch.context.leadVertical, "Biopharma");
  assert.equal(pitch.context.leadApplication, "Oligonucleotide analytics");
  assert.equal(result.leadVertical.signal.ratio, 1.4);
  assert.notEqual(result.leadVertical.theme, "PFAS");
});

test("draft and gap claims stay only in the internal not-yet-cleared note", () => {
  const draftText = "Draft claim that must never ship.";
  const gapText = "Gap claim that must never ship.";
  const result = assembled({
    comparatorClaims: [
      approvedClaim,
      { ...approvedClaim, id: "draft", claimText: draftText, approvalState: "draft" },
      { ...approvedClaim, id: "gap", claimText: gapText, status: "gap", fieldCitable: false, supportingEvidence: [] },
    ],
  });
  const claimsSheet = result.assets.find((asset) => asset.id === "claims-sheet");
  assert.deepEqual(claimsSheet.fieldContent.map((item) => item.text), [approvedClaim.claimText]);
  assert.ok(claimsSheet.internalNotes.some((note) => note.text === draftText));
  assert.ok(claimsSheet.internalNotes.some((note) => note.text === gapText));
  const exported = exportsApi.sellerAssetText(claimsSheet);
  assert.match(exported, /Approved exact comparative wording/);
  assert.doesNotMatch(exported, /Draft claim|Gap claim/);
  assert.doesNotMatch(exported, /not yet cleared/i);
});

test("the claims sheet uses explicit approved registry wording, never the proposed variant", () => {
  const proposed = "Proposed registry variant.";
  const approved = "Approved registry wording only.";
  const result = assembled({
    comparatorClaims: [],
    competitorPlays: [],
    registryClaims: [{
      id: "registry-approved",
      competitor: "Agilent",
      audience: "Biopharma",
      proposedClaimWording: proposed,
      approvedWording: approved,
      approvalEstablished: true,
      approvalState: "approved",
      evidenceRecords: [{ ...approvedEvidence("registry"), compatibility: { status: "Applicable" } }],
    }],
  });
  const sheet = result.assets.find((asset) => asset.id === "claims-sheet");
  assert.equal(sheet.fieldContent[0].text, approved);
  assert.doesNotMatch(exportsApi.sellerAssetText(sheet), new RegExp(proposed));
});

test("Three Proof Priorities populate an internal-only proof request list", () => {
  const result = assembled({
    proofPriorities: {
      top: [{ id: "p1", claimText: "Claim we cannot make.", missingStudyEvidence: "Controlled comparison", sellerAsset: "Battlecard", approvalState: "draft" }],
      backlog: [{ id: "p2", claimText: "Backlog claim.", missingStudyEvidence: "Customer validation", sellerAsset: "Pitch", approvalState: "draft" }],
    },
  });
  const proofList = result.assets.find((asset) => asset.id === "proof-request-list");
  assert.equal(proofList.shipStatus, "internal-only");
  assert.equal(proofList.fieldExportable, false);
  assert.equal(proofList.fieldContent.length, 0);
  assert.deepEqual(proofList.internalNotes.map((note) => note.queueLocation), ["top-three", "backlog"]);
  assert.throws(() => exportsApi.sellerAssetText(proofList), /Field export blocked/);
});

test("no current-style draft claim can produce a field-exportable asset", () => {
  const draftClaim = { ...approvedClaim, approvalState: "draft" };
  const draftMove = {
    ...approvedMove,
    observedMove: { ...approvedMove.observedMove, approvalState: "draft" },
    watersResponse: { ...approvedMove.watersResponse, approvalState: "draft" },
  };
  const result = assembled({ comparatorClaims: [draftClaim], competitorPlays: [draftMove] });
  assert.equal(result.shippableCount, 0);
  assert.ok(result.assets.filter((asset) => asset.audience === "field").every((asset) => asset.fieldExportable === false));
  assert.ok(result.assets.filter((asset) => asset.audience === "field").every((asset) => !transformer.assertFieldSafeAsset(asset)));
});

test("CSV, clipboard, legacy artifact, and head-to-head exports enforce the same shipment gate", async () => {
  const draft = { proposedClaimWording: "Never export", approvalState: "draft", approvalEstablished: false, sources: [] };
  const approved = {
    proposedClaimWording: "Proposed variant",
    approvedWording: "Approved exact wording",
    approvalState: "approved",
    approvalEstablished: true,
    fieldCitable: true,
    evidenceRecords: [approvedEvidence("csv")],
  };
  const csv = exportsApi.claimsCsv([draft, approved], { market: "Biopharma" });
  assert.match(csv, /Approved exact wording/);
  assert.doesNotMatch(csv, /Never export|Proposed variant/);
  assert.equal(exportsApi.approvedClipboardText([draft, approved]), "Approved exact wording");
  await assert.rejects(exportsApi.exportArtifact({ claims: [draft] }), /Field export blocked/);
  await assert.rejects(exportsApi.exportHeadToHeadPptx({}), /Field export blocked/);
});

test("the Seller Assets renderer exposes four gated assets without changing Product Management rendering", async () => {
  const [app, index] = await Promise.all([
    readFile(new URL("app.js", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
  ]);
  assert.match(index, /seller-assets-transformer\.js/);
  assert.match(index, /battlecard, approved claims sheet, lead-vertical pitch, and internal proof-request list/i);
  assert.match(app, /sellerAssets\.assets\.map\(\(asset, index\) => pmmSellerAssetCardMarkup/);
  assert.match(app, /Only approvalState:approved \+ fieldCitable:true records enter this zone/);
  assert.match(app, /data-pmm-seller-asset-export/);
  assert.match(app, /assertFieldSafeAsset\(asset\)/);
  assert.match(app, /function renderProductComparator\(\)/);
  assert.doesNotMatch(app.match(/function renderProductComparator[\s\S]*?\n}\n\nfunction openComparisonPanel/)?.[0] || "", /sellerAssets|Seller Assets/);
});
