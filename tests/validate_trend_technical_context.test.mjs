import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appPath = new URL("../app.js", import.meta.url);
const deployAppPath = new URL("../deploy-site/app.js", import.meta.url);
const app = readFileSync(appPath, "utf8");
const deployApp = readFileSync(deployAppPath, "utf8");

test("leadership market highlight explains technical scope instead of repeating the growth metric", () => {
  assert.match(app, /function trendTechnicalContext\(trend\)/);
  assert.match(app, /detail: trendTechnicalContext\(leadTrend\.trend\)/);
  assert.doesNotMatch(app, /This measures scientific activity, not market share or revenue/);
});

test("technical context covers every configured application-trend family", () => {
  for (const phrase of [
    "lipid composition, RNA payload and impurities",
    "oligonucleotide identity, purity and impurity profiling",
    "LC-MS\/MS PFAS detection and quantitation",
    "high-resolution LC-MS acquisition, ion mobility",
    "automated sample handling, instrument orchestration",
  ]) {
    assert.match(app, new RegExp(phrase));
  }
});

test("deployment copy stays aligned with the application source", () => {
  assert.equal(deployApp, app);
});
