import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const deployApp = readFileSync(new URL("../deploy-site/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../product-ui.css", import.meta.url), "utf8");
const deployCss = readFileSync(new URL("../deploy-site/product-ui.css", import.meta.url), "utf8");

test("customer voice is organized into company-level findings", () => {
  assert.match(app, /Object\.keys\(customerVoiceIdentityTerms\)/);
  assert.match(app, /class="company-voice-list"/);
  assert.match(app, /class="company-voice-card/);
  assert.match(app, /What Customers Value/);
  assert.match(app, /Pain Points and Unmet Needs/);
  assert.match(app, /Waters PM Opportunity/);
  assert.match(app, /Whitespace for Waters/);
  assert.doesNotMatch(app, /vendor-source-records/);
  assert.doesNotMatch(app, /vendor-source-record-footer/);
});

test("company source records open on demand in the shared evidence modal", () => {
  assert.match(app, /function openCompanyVoiceEvidence\(company\)/);
  assert.match(app, /evidenceGroups\.map\(\(group\) => customerVoiceEvidenceCardMarkup\(group\)\)/);
  assert.match(app, /data-company-voice-sources/);
  assert.match(app, /openCompanyVoiceEvidence\(companyTrigger\.dataset\.companyVoiceSources\)/);
  assert.match(app, /setupCompanyVoiceDrilldowns\(\);/);
});

test("company insight cards use three columns and stack on narrow screens", () => {
  assert.match(css, /\.company-voice-insight-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*?\.company-voice-insight-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
});

test("customer voice PM synthesis ships identically", () => {
  assert.equal(deployApp, app);
  assert.equal(deployCss, css);
});
