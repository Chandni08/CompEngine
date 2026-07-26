import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const deployIndex = readFileSync(new URL("../deploy-site/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const deployApp = readFileSync(new URL("../deploy-site/app.js", import.meta.url), "utf8");

test("Overall Trend Analysis header omits the cross-source-theme capsule", () => {
  assert.doesNotMatch(index, /id="overallTrendCount"/);
  assert.doesNotMatch(app, /byId\("overallTrendCount"\)/);
  assert.doesNotMatch(app, /cross-source themes`/);
});

test("removed trend-count capsule ships identically", () => {
  assert.equal(deployIndex, index);
  assert.equal(deployApp, app);
});
