import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const [app, deployedApp, css, deployedCss] = await Promise.all([
  readFile(new URL("app.js", root), "utf8"),
  readFile(new URL("deploy-site/app.js", root), "utf8"),
  readFile(new URL("styles.css", root), "utf8"),
  readFile(new URL("deploy-site/styles.css", root), "utf8"),
]);

test("Product Management view hides coverage and the Public Evidence Library", () => {
  assert.match(app, /const hiddenForProductManagement = state\.view === "Product";/);
  assert.match(app, /refreshBlock\.hidden = hiddenForProductManagement;/);
  assert.match(app, /refreshBlock\.setAttribute\("aria-hidden", String\(hiddenForProductManagement\)\);/);
  assert.match(app, /competitorCoveragePanel\.hidden = hiddenForProductManagement;/);
  assert.match(app, /competitorCoveragePanel\.setAttribute\("aria-hidden", String\(hiddenForProductManagement\)\);/);
  assert.match(app, /publicEvidencePanel\.hidden = hiddenForProductManagement;/);
  assert.match(app, /publicEvidencePanel\.setAttribute\("aria-hidden", String\(hiddenForProductManagement\)\);/);
  assert.match(app, /publicEvidenceNav\.hidden = hiddenForProductManagement;/);
  assert.match(app, /const publicEvidenceSourcePill = state\.view === "Product"\s*\? ""/);
  assert.match(app, /state\.view = filters\.role\.value;\s+updateRolePanelVisibility\(\);/);
  assert.match(css, /\.competitor-coverage-panel\[hidden\]\s*\{\s*display: none;/);
});

test("role-specific coverage visibility ships identically", () => {
  assert.equal(deployedApp, app);
  assert.equal(deployedCss, css);
});
