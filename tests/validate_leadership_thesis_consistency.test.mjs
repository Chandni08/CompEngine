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

test("removed workflow-competition thesis stays absent from the live panel and export", () => {
  assert.match(thesisModule, /function leadershipBriefThesis\(\)/);
  assert.doesNotMatch(thesisModule, /Workflow execution is becoming part of product competition/);
  assert.doesNotMatch(app, /leadership-snapshot-thesis/);
  assert.match(pptxBuilder, /import leadershipBriefApi from "\.\.\/leadership-brief-thesis\.js"/);
  assert.match(pptxBuilder, /addHeader\(s, leadershipBriefThesis\(\)/);
  assert.doesNotMatch(pptxBuilder, /addHeader\(s, "Workflow execution is becoming part of product competition"/);
});

test("shared thesis module and page loading order ship identically", () => {
  assert.equal(deployThesisModule, thesisModule);
  assert.equal(deployIndex, index);
  assert.doesNotMatch(deployApp, /leadership-snapshot-thesis/);
});

test("shared thesis generator loads before the dashboard application", () => {
  assert.ok(index.indexOf("leadership-brief-thesis.js") < index.indexOf("app.js"));
});
