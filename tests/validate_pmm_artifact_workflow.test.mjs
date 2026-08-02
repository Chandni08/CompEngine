import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

const require = createRequire(import.meta.url);
const exportsApi = require("../artifact-export.js");
const root = new URL("../", import.meta.url);
const [app, index, styles, contract] = await Promise.all([
  readFile(new URL("app.js", root), "utf8"),
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("styles.css", root), "utf8"),
  readFile(new URL("PMM_DATA_CONTRACT.md", root), "utf8"),
]);

test("the Activation Backlog renders seven governed artifact-production records", () => {
  const definitions = app.match(/const pmmArtifactDefinitions = \[[\s\S]*?\n\];/)?.[0] || "";
  for (const artifact of [
    "One-Page Competitive Battlecard",
    "Positioning and Messaging Brief",
    "Regulated Claims Sheet",
    "Campaign and Message Plan",
    "Sales-Deck Outline",
    "Message-Test Brief",
    "Customer-Proof Request Brief",
  ]) assert.match(definitions, new RegExp(artifact));
  assert.equal((definitions.match(/exportKind:/g) || []).length, 7);
  assert.match(app, /pmmArtifactDefinitions\.map\(\(definition\) => pmmArtifactModel/);
  assert.match(app, /artifactProduction\.artifacts\.map\(\(artifact, index\) => pmmArtifactCardMarkup/);
});

test("every artifact carries the required governed content fields and exact evidence footnotes", () => {
  const renderer = app.match(/function pmmArtifactCardMarkup[\s\S]*?\n}\n\nfunction renderMarketingActivationBacklog/)?.[0] || "";
  for (const field of [
    "Target / buying situation",
    "Governing Position",
    "Role-Specific Messages",
    "Competitor Response",
    "Claims and Approval State",
    "Proof and Caveats",
    "Objection Handling",
    "Unsupported-Content Warnings",
    "Evidence Footnotes",
  ]) assert.match(renderer, new RegExp(field));
  assert.match(app, /pmmDeduplicateSources\(\[/);
  assert.match(exportsApi.artifactSections({}).map((section) => section.title).join(" | "), /Production workflow/);
});

test("workflow owner, due date, status, and measurement are editable and persisted by target", () => {
  for (const field of ["owner", "dueDate", "status", "successMeasure"])
    assert.match(app, new RegExp(`data-pmm-artifact-field="${field}"`));
  assert.match(app, /localStorage\.setItem\(pmmArtifactWorkflowStorageKey/);
  assert.match(app, /localStorage\.getItem\(pmmArtifactWorkflowStorageKey/);
  assert.match(app, /pmmTargetingKey\(\).*pmmArtifactSegmentId\(segment\).*artifactId/s);
  assert.match(app, /Production status <small>Not claims approval<\/small>/);
});

test("exports are filter-specific and preserve evidence links", () => {
  assert.match(index, /vendor\/pptxgen\.bundle\.js/);
  assert.match(index, /vendor\/docx\.iife\.js/);
  assert.match(index, /artifact-export\.js/);
  assert.match(app, /Export claims registry CSV/);
  assert.match(app, /exportArtifact\(artifact\)/);
  assert.match(app, /exportClaimsCsv\(state\.marketingWorkspaceModel\.claimRows, state\.marketingWorkspaceModel\.governingPosition\.targeting\)/);
  const csv = exportsApi.claimsCsv([{ proposedClaimWording: "Claim", approvalEstablished: false, sources: [{ url: "https://example.com/evidence" }] }], { market: "Biopharma", application: "Oligo" });
  assert.match(csv, /Biopharma > Oligo/);
  assert.match(csv, /https:\/\/example\.com\/evidence/);
  assert.match(csv, /DRAFT — NOT APPROVED/);
});

test("draft and approved content cannot be confused", () => {
  const draft = exportsApi.normalizedArtifact({ claims: [{ approvalEstablished: false, approvedWording: "" }] });
  const approved = exportsApi.normalizedArtifact({ claims: [{ approvalEstablished: true, approvedWording: "Approved exact wording" }] });
  assert.equal(draft.draft, true);
  assert.equal(draft.watermark, "DRAFT — NOT APPROVED");
  assert.equal(approved.draft, false);
  assert.deepEqual(exportsApi.approvedClipboardText([
    { approvalEstablished: false, proposedClaimWording: "Never copy", approvedWording: "" },
    { approvalEstablished: true, proposedClaimWording: "Proposed variant", approvedWording: "Approved exact wording" },
  ]), "Approved exact wording");
  assert.match(app, /No approved text to copy/);
  assert.match(styles, /\.pmm-artifact-draft/);
  assert.match(contract, /clipboard output includes approved wording only/i);
});

test("the artifact workflow remains inside the eight-section PMM narrative spine", () => {
  assert.equal((index.match(/class="panel pmm-primary-section"/g) || []).length, 8);
  assert.match(index, /id="pmm-activation-artifacts"/);
  assert.match(styles, /\.pmm-artifact-grid/);
  assert.match(styles, /@media \(max-width: 960px\)[\s\S]*?\.pmm-artifact-grid/);
  assert.match(styles, /\.pmm-artifact-workflow input:focus-visible/);
});
