import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const thesisModule = readFileSync(new URL("../leadership-brief-thesis.js", import.meta.url), "utf8");
const deployThesisModule = readFileSync(new URL("../deploy-site/leadership-brief-thesis.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const deployApp = readFileSync(new URL("../deploy-site/app.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const deployIndex = readFileSync(new URL("../deploy-site/index.html", import.meta.url), "utf8");
const pptxBuilder = readFileSync(new URL("../scripts/build_leadership_pptx.mjs", import.meta.url), "utf8");
const styles = readFileSync(new URL("../product-ui.css", import.meta.url), "utf8");

test("Leadership Brief panel and PowerPoint reuse the same thesis generator", () => {
  assert.match(thesisModule, /function leadershipBriefThesis\(\)/);
  assert.match(thesisModule, /Workflow execution is becoming part of product competition/);
  assert.match(app, /class="leadership-snapshot-thesis"[^>]*>\$\{escapeHtml\(leadershipBriefThesis\(\)\)\}/);
  assert.match(pptxBuilder, /import leadershipBriefApi from "\.\.\/leadership-brief-thesis\.js"/);
  assert.match(pptxBuilder, /addHeader\(s, leadershipBriefThesis\(\)/);
  assert.doesNotMatch(pptxBuilder, /addHeader\(s, "Workflow execution is becoming part of product competition"/);
  assert.match(styles, /\.leadership-snapshot-thesis\s*\{[^}]*font-size:\s*clamp\(1\.2rem, 1\.8vw, 1\.7rem\)[^}]*font-weight:\s*750/s);
});

test("shared thesis assets ship identically", () => {
  assert.equal(deployThesisModule, thesisModule);
  assert.equal(deployApp, app);
  assert.equal(deployIndex, index);
});

test("shared thesis generator loads before the dashboard application", () => {
  assert.ok(index.indexOf("leadership-brief-thesis.js") < index.indexOf("app.js"));
});
