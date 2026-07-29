import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const deployApp = readFileSync(new URL("../deploy-site/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../product-ui.css", import.meta.url), "utf8");
const deployCss = readFileSync(new URL("../deploy-site/product-ui.css", import.meta.url), "utf8");

test("customer voice is organized around four purchase-driving themes", () => {
  assert.match(app, /label: "Method Transfer"/);
  assert.match(app, /label: "Troubleshooting & Recovery Time"/);
  assert.match(app, /label: "Data Export & Portability"/);
  assert.match(app, /label: "Workflow Setup"/);
  assert.match(app, /customerVoiceComparisonCompanies = \["Waters", "Agilent", "Thermo Fisher", "SCIEX"\]/);
  assert.match(app, /class="customer-theme-matrix"/);
  assert.doesNotMatch(app, /vendor-source-records/);
  assert.doesNotMatch(app, /vendor-source-record-footer/);
});

test("theme and company source records open on demand in the shared evidence modal", () => {
  assert.match(app, /function openCustomerThemeEvidence\(themeKey, company\)/);
  assert.match(app, /evidenceGroups\.map\(\(group\) => customerVoiceEvidenceCardMarkup\(group\)\)/);
  assert.match(app, /data-customer-theme-sources/);
  assert.match(app, /data-customer-theme-company/);
  assert.match(app, /setupCompanyVoiceDrilldowns\(\);/);
});

test("theme matrix stays side-by-side and scrolls on narrow screens", () => {
  assert.match(css, /\.customer-theme-matrix-wrap\s*\{[\s\S]*?overflow-x:\s*auto/);
  assert.match(css, /\.customer-theme-matrix\s*\{[\s\S]*?min-width:\s*1080px[\s\S]*?table-layout:\s*fixed/);
  assert.match(css, /\.customer-theme-question-column\s*\{[\s\S]*?width:\s*22%/);
});

test("customer voice PM synthesis ships identically", () => {
  assert.equal(deployApp, app);
  assert.equal(deployCss, css);
});
