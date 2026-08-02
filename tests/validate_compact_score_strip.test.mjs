import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const deployCss = readFileSync(new URL("../deploy-site/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const deployApp = readFileSync(new URL("../deploy-site/app.js", import.meta.url), "utf8");

test("score drivers use compact visual signal cards", () => {
  assert.match(css, /\.score-driver-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)[\s\S]*?gap:\s*8px/);
  assert.match(css, /\.score-driver-card\s*\{[\s\S]*?display:\s*grid[\s\S]*?min-height:\s*54px[\s\S]*?linear-gradient/);
  assert.match(css, /\.score-driver-marker\s*\{[\s\S]*?background:\s*var\(--score-signal\)/);
  assert.doesNotMatch(css, /score-driver-meter/);
  assert.doesNotMatch(app, /score-driver-meter/);
});

test("compact score strip becomes a vertical list on small screens", () => {
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*?\.score-driver-grid\s*\{\s*grid-template-columns:\s*1fr/);
});

test("compact score-strip styles ship identically", () => {
  assert.equal(deployCss, css);
});

test("score strip shows only the two activity signals", () => {
  assert.match(app, /function activityLevelFromTwenty\(score\)/);
  assert.match(app, /value >= 15\) return "High"/);
  assert.match(app, /value >= 8\) return "Medium"/);
  assert.match(app, /label: "Application trend", value: activityLevelFromTwenty/);
  assert.match(app, /label: "Competitor activity", value: activityLevelFromTwenty/);
  assert.doesNotMatch(app, /label: "Application trend", value: `\$\{breakdown\.trendAcceleration\}\/20`/);
  assert.doesNotMatch(app, /label: "Competitor activity", value: `\$\{breakdown\.competitorPressure\}\/20`/);
  assert.doesNotMatch(app, /key: "evidenceQualityFreshness", label: "Source quality"/);
  assert.equal(deployApp, app);
});
