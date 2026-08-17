import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

const require = createRequire(import.meta.url);
const exportsApi = require("../artifact-export.js");
const root = new URL("../", import.meta.url);
const [app, index, styles, contract, sellerTransformerSource] = await Promise.all([
  readFile(new URL("app.js", root), "utf8"),
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("styles.css", root), "utf8"),
  readFile(new URL("PMM_DATA_CONTRACT.md", root), "utf8"),
  readFile(new URL("seller-assets-transformer.js", root), "utf8"),
]);

test("Seller Assets renders four governed package records", () => {
  for (const artifact of ["Battlecard", "Claims Sheet", "Lead-Vertical Pitch", "Proof-Request List"])
    assert.match(sellerTransformerSource, new RegExp(`title: "${artifact}"`));
  assert.equal((sellerTransformerSource.match(/title: "/g) || []).length, 4);
  assert.match(app, /sellerAssetsTransformer\.assembleSellerAssets/);
  assert.match(app, /sellerAssets\.assets\.map\(\(asset, index\) => pmmSellerAssetCardMarkup/);
});

test("every visible seller asset separates field content from internal uncleared inputs", () => {
  const renderer = app.match(/function pmmSellerAssetFieldContentMarkup[\s\S]*?\n}\n\nfunction renderMarketingActivationBacklog/)?.[0] || "";
  for (const field of [
    "Field-facing content",
    "Internal only",
    "not yet cleared",
    "Approved field-citable asset proof",
    "not exportable to the field",
  ]) assert.match(renderer, new RegExp(field));
  assert.match(app, /data-field-exportable="\$\{asset\.fieldExportable\}"/);
  assert.match(app, /fieldSafeSellerAsset\(asset\)/);
});

test("workflow owner, due date, status, and measurement are editable and persisted by target", () => {
  for (const field of ["owner", "dueDate", "status", "successMeasure"])
    assert.match(app, new RegExp(`data-pmm-artifact-field="${field}"`));
  assert.match(app, /localStorage\.setItem\(pmmArtifactWorkflowStorageKey/);
  assert.match(app, /localStorage\.getItem\(pmmArtifactWorkflowStorageKey/);
  assert.match(app, /pmmTargetingKey\(\).*pmmArtifactSegmentId\(segment\).*artifactId/s);
  assert.match(app, /Production status <small>Not claims approval<\/small>/);
});

test("exports are filter-specific and contain approved field-citable content only", () => {
  assert.match(index, /artifact-export\.js/);
  assert.match(app, /exportSellerAsset\(asset\)/);
  assert.match(app, /Export blocked: only approved \+ field-citable content may ship/);
  const approved = {
    approvedWording: "Approved claim",
    approvalEstablished: true,
    approvalState: "approved",
    fieldCitable: true,
    evidenceRecords: [{ url: "https://example.com/evidence", fieldCitable: true, approvalState: "approved" }],
  };
  const csv = exportsApi.claimsCsv([{ proposedClaimWording: "Draft claim", approvalEstablished: false }, approved], { market: "Biopharma", application: "Oligo" });
  assert.match(csv, /Biopharma > Oligo/);
  assert.match(csv, /https:\/\/example\.com\/evidence/);
  assert.match(csv, /APPROVED \+ FIELD-CITABLE/);
  assert.doesNotMatch(csv, /Draft claim/);
});

test("draft and approved content cannot be confused", () => {
  const draft = exportsApi.normalizedArtifact({ claims: [{ approvalEstablished: false, approvedWording: "" }] });
  const proof = { url: "https://example.com/approved", fieldCitable: true, approvalState: "approved" };
  const approvedClaim = { approvalEstablished: true, approvalState: "approved", approvedWording: "Approved exact wording", fieldCitable: true, evidenceRecords: [proof] };
  const approved = exportsApi.normalizedArtifact({ claims: [approvedClaim], fieldExportable: true });
  assert.equal(draft.draft, true);
  assert.equal(draft.watermark, "DRAFT — NOT APPROVED");
  assert.equal(approved.draft, false);
  assert.deepEqual(exportsApi.approvedClipboardText([
    { approvalEstablished: false, proposedClaimWording: "Never copy", approvedWording: "" },
    { ...approvedClaim, proposedClaimWording: "Proposed variant" },
  ]), "Approved exact wording");
  assert.match(app, /Not yet cleared — export blocked/);
  assert.match(styles, /\.pmm-artifact-draft/);
  assert.match(contract, /approved wording only/i);
});

test("the artifact workflow remains inside the eight-section PMM narrative spine", () => {
  assert.equal((index.match(/class="panel pmm-primary-section"/g) || []).length, 8);
  assert.match(index, /id="pmm-activation-artifacts"/);
  assert.match(styles, /\.pmm-artifact-grid/);
  assert.match(styles, /@media \(max-width: 960px\)[\s\S]*?\.pmm-artifact-grid/);
  assert.match(styles, /\.pmm-artifact-workflow input:focus-visible/);
});

