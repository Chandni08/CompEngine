import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../product-ui.css", import.meta.url), "utf8");
const deployCss = readFileSync(new URL("../deploy-site/product-ui.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const deployApp = readFileSync(new URL("../deploy-site/app.js", import.meta.url), "utf8");

test("competitor activity summary uses a compact four-column desktop grid", () => {
  assert.match(css, /\.intent-activity-theme-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.intent-activity-heading\s*\{[\s\S]*?display:\s*block/);
  assert.match(css, /\.intent-activity-theme\s*\{[\s\S]*?grid-template-rows:\s*auto 1fr/);
  assert.match(css, /\.intent-activity-theme-top\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto/);
  assert.match(css, /\.intent-theme-source-button\s*\{[\s\S]*?background:\s*transparent/);
  assert.match(app, /<span>Sources<\/span><b>\$\{theme\.items\.length\}<\/b>/);
});

test("competitor activity summary omits the redundant evidence-count line", () => {
  assert.doesNotMatch(app, /const observedCounts = profile\.evidenceGroups/);
  assert.doesNotMatch(app, /escapeHtml\(observedCounts/);
  assert.equal(deployApp, app);
});

test("competitor activity grid remains responsive", () => {
  assert.match(css, /@media \(max-width: 1400px\)[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*?\.intent-activity-theme-grid/);
});

test("compact competitor activity styles ship identically", () => {
  assert.equal(deployCss, css);
});
