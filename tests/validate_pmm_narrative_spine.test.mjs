import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const [app, index, styles, contract] = await Promise.all([
  readFile(new URL("app.js", root), "utf8"),
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("styles.css", root), "utf8"),
  readFile(new URL("PMM_DATA_CONTRACT.md", root), "utf8"),
]);

test("the PMM workspace follows one eight-section narrative spine", () => {
  const workspace = index.match(/<div id="marketingWorkspace"[\s\S]*?<section id="leadership-brief"/)?.[0] || "";
  const ids = [...workspace.matchAll(/<section id="([^"]+)" class="panel pmm-primary-section"/g)].map((match) => match[1]);
  assert.deepEqual(ids, [
    "pmm-governing-position",
    "pmm-positioning-decisions",
    "pmm-claims-risk",
    "pmm-segment-cascade",
    "pmm-competitive-narratives",
    "pmm-adoption-value",
    "pmm-activation-artifacts",
    "pmm-evidence-appendix",
  ]);
  assert.match(index, /<span>Win<\/span>[\s\S]*<span>Strategy<\/span>[\s\S]*<span>Ship<\/span>/);
  assert.match(index, /id="pmm-evidence-appendix"[^>]*data-default-collapsed="true"/);
});

test("Start Here is a compact readiness strip without generated command-brief prose", () => {
  const renderer = app.match(/function renderMarketingStartHere[\s\S]*?\n}\n/)?.[0] || "";
  for (const label of [
    "Current Field Status",
    "Field-ready claims",
    "Supported, not approved",
    "Proof gaps",
    "Traceability gaps",
    "Next proof decision",
  ]) assert.match(renderer, new RegExp(label));
  assert.match(renderer, /href="#pmm-claims-risk"/);
  assert.match(renderer, /href="#pmm-positioning-decisions"/);
  assert.match(renderer, /href="#pmm-evidence-appendix"/);
  assert.doesNotMatch(renderer, /Do not say|Owner needed|Deadline needed|Success measure needed|Swing attribute|Competitor \/ inertia threat/);
  assert.doesNotMatch(app, /function pmmHighestRiskClaim|function pmmNearestActivationDeadline/);
});

test("repeated proof is represented by canonical evidence objects with expandable caveats", () => {
  assert.match(app, /function pmmEvidenceObjectId/);
  assert.match(app, /EV-\$\{/);
  assert.match(app, /data-pmm-evidence-ref/);
  assert.match(app, /data-canonical-evidence-id/);
  assert.match(app, /pmmCanonicalEvidenceReferenceMarkup\(proof, "Claim substantiation"\)/);
  assert.match(app, /Compatibility and caveat details/);
  assert.match(app, /Evidence summary and caveats/);
  assert.match(contract, /Repeated proof summaries and caveats are owned by one canonical appendix object/);
});

test("the narrative spine remains responsive and keyboard accessible", () => {
  assert.match(styles, /\.pmm-readiness-strip a:focus-visible/);
  assert.match(styles, /\.pmm-evidence-reference:focus-visible/);
  assert.match(styles, /\.pmm-caveat-details > summary:focus-visible/);
  assert.match(styles, /@media \(max-width: 960px\)[\s\S]*?\.pmm-start-here > header/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.pmm-readiness-strip/);
  assert.match(app, /record\.focus\(\{ preventScroll: true \}\)/);
});

