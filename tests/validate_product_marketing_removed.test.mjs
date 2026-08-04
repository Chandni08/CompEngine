import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const app = read("app.js");
const html = read("index.html");
const css = read("styles.css");
const integrityBuilder = read("scripts/build_integrity_artifacts.py");

test("Product Marketing role and workspace are completely removed", () => {
  assert.doesNotMatch(html, /Product Marketing|marketingWorkspace|pmm-|data-pmm/i);
  assert.doesNotMatch(app, /viewCopy\.Marketing|state\.marketing|renderMarketing|buildMarketing|setupMarketing|pmmTargetingMatches|pmmGovernanceFields/);
  assert.doesNotMatch(css, /\.pmm-|#pmm|marketing-view|\.marketing-|\.battlecard-/i);
  assert.doesNotMatch(integrityBuilder, /pmm-|Product Marketing|renderMarketing|PMM_DATA_CONTRACT/);
});

test("other role views and Product Management shared matching remain", () => {
  for (const role of ["Leadership", "Product", "Engineering"]) {
    assert.match(html, new RegExp(`<option value="${role}"`));
    assert.match(app, new RegExp(`^  ${role}: \\{`, "m"));
  }
  assert.match(html, /product-match-model\.js/);
  assert.match(app, /function headToHeadBuildMatchModel\(\)/);
  assert.match(app, /function headToHeadProductMatchesRecord\(record, product\)/);
  assert.match(app, /renderProductComparator\(\);/);
  assert.match(app, /renderFeatureGapMatrix\(signals\);/);
});

test("PMM-only runtime and transformer files are deleted", () => {
  const removed = [
    "PMM_DATA_CONTRACT.md",
    "HEAD_TO_HEAD_COMPARISON_DATA_MODEL.md",
    "artifact-export.js",
    "evidence-governance.js",
    "pmm-data-contract.js",
    "product-comparator-claim-transformer.js",
    "proof-priority-transformer.js",
    "competitor-selling-motion-transformer.js",
    "customer-voice-barrier-transformer.js",
    "buying-committee-transformer.js",
    "position-guardrails-transformer.js",
    "seller-assets-transformer.js",
    "evidence-appendix-transformer.js",
  ];
  for (const path of removed) {
    assert.equal(existsSync(fileURLToPath(new URL(path, root))), false, `${path} should be deleted`);
    assert.equal(existsSync(fileURLToPath(new URL(`deploy-site/${path}`, root))), false, `deploy-site/${path} should be deleted`);
  }
});

test("deployment mirrors match the validated source", () => {
  assert.equal(read("deploy-site/app.js"), app);
  assert.equal(read("deploy-site/index.html"), html);
  assert.equal(read("deploy-site/styles.css"), css);
});
