import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const deployApp = readFileSync(new URL("../deploy-site/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../product-ui.css", import.meta.url), "utf8");
const deployCss = readFileSync(new URL("../deploy-site/product-ui.css", import.meta.url), "utf8");

test("customer voice by company is synthesis-first rather than a source-link grid", () => {
  assert.match(app, /class="company-voice-insight strength"/);
  assert.match(app, /class="company-voice-insight concern"/);
  assert.match(app, /class="company-voice-insight opportunity"/);
  assert.doesNotMatch(app, /vendor-source-records/);
  assert.doesNotMatch(app, /vendor-source-record-footer/);
});

test("company voice source records open on demand in the shared evidence modal", () => {
  assert.match(app, /function openCompanyVoiceEvidence\(company\)/);
  assert.match(app, /evidenceGroups\.map\(\(group\) => customerVoiceEvidenceCardMarkup\(group\)\)/);
  assert.match(app, /setupCompanyVoiceDrilldowns\(\);/);
});

test("company voice cards use a responsive three-part PM readout", () => {
  assert.match(css, /\.company-voice-insight-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*?\.company-voice-insight-grid\s*\{\s*grid-template-columns:\s*1fr/);
});

test("customer voice PM synthesis ships identically", () => {
  assert.equal(deployApp, app);
  assert.equal(deployCss, css);
});
