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

test("Product Management and Product Marketing share the Product renderer", () => {
  assert.match(app, /const hiddenForProductManagement = state\.view === "Product" \|\| state\.view === "Marketing";/);
  assert.match(app, /refreshBlock\.hidden = hiddenForProductManagement;/);
  assert.match(app, /refreshBlock\.setAttribute\("aria-hidden", String\(hiddenForProductManagement\)\);/);
  assert.match(app, /competitorCoveragePanel\.hidden = hiddenForProductManagement;/);
  assert.match(app, /competitorCoveragePanel\.setAttribute\("aria-hidden", String\(hiddenForProductManagement\)\);/);
  assert.match(app, /publicEvidencePanel\.hidden = hiddenForProductManagement;/);
  assert.match(app, /publicEvidencePanel\.setAttribute\("aria-hidden", String\(hiddenForProductManagement\)\);/);
  assert.match(app, /publicEvidenceNav\.hidden = hiddenForProductManagement;/);
  assert.match(app, /const publicEvidenceSourcePill = state\.view === "Product"\s*\? ""/);
  assert.match(app, /const selectedView = filters\.role\.value;\s+state\.view = selectedView;\s+persistRoleView\(\);\s+updateRolePanelVisibility\(\);/);
  assert.match(app, /const technicalEvidenceVisible = \["Engineering", "Product"\]\.includes\(state\.view\);/);
  assert.match(app, /patentPanel\.hidden = !technicalEvidenceVisible/);
  assert.match(app, /leadershipProfilePanel\.hidden = !technicalEvidenceVisible/);
  assert.match(app, /hiringPatternsPanel\.hidden = !technicalEvidenceVisible/);
  assert.match(css, /\.competitor-coverage-panel\[hidden\]\s*\{\s*display: none;/);
});

test("Product Marketing keeps its role selector but has no custom workspace render path", () => {
  assert.match(app, /const validRoleViews = new Set\(Object\.keys\(viewCopy\)\);/);
  assert.match(deployedApp, /const validRoleViews = new Set\(Object\.keys\(viewCopy\)\);/);
  assert.match(app, /function updateRolePanelVisibility\(\) \{[\s\S]*?const marketingView = false;/);
  assert.match(deployedApp, /function updateRolePanelVisibility\(\) \{[\s\S]*?const marketingView = false;/);
  assert.doesNotMatch(app, /if \(state\.view === "Marketing"\) renderMarketingWorkspace/);
  assert.doesNotMatch(deployedApp, /if \(state\.view === "Marketing"\) renderMarketingWorkspace/);
  assert.match(app, /state\.view === "Marketing" \? "Waters PMM Considerations" : "Waters PM Considerations"/);
  assert.match(app, /const response = state\.view === "Marketing" \? marketingCompetitorResponse\(profile\) : profile\.response;/);
  assert.equal(deployedApp, app);
  assert.equal(deployedCss, css);
});
