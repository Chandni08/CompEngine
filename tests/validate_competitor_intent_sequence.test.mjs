import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const deployApp = await readFile(new URL("../deploy-site/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../product-ui.css", import.meta.url), "utf8");
const deployCss = await readFile(new URL("../deploy-site/product-ui.css", import.meta.url), "utf8");
const intelligence = JSON.parse(await readFile(new URL("../data/intelligence.json", import.meta.url), "utf8"));
const launches = JSON.parse(await readFile(new URL("../data/product_launches.json", import.meta.url), "utf8"));
const filings = JSON.parse(await readFile(new URL("../data/filing_insights.json", import.meta.url), "utf8"));

test("competitor intent presents observed actions before forecast and response options", () => {
  const detailStart = app.indexOf("function competitorIntentDetailMarkup");
  const detailEnd = app.indexOf("function renderCompetitorIntentCards", detailStart);
  const detailMarkup = app.slice(detailStart, detailEnd);

  const observedIndex = detailMarkup.indexOf("competitorActivityMarkup(profile)");
  const directionIndex = detailMarkup.indexOf("intent-likely-direction");
  const responseIndex = detailMarkup.indexOf("Waters PM Considerations");
  assert.ok(observedIndex >= 0 && observedIndex < directionIndex && directionIndex < responseIndex);
  assert.doesNotMatch(detailMarkup, /Evidence-based inference from the actions above/);
  assert.doesNotMatch(detailMarkup, /Waters response options/);
  assert.doesNotMatch(detailMarkup, /Implications for Waters/i);
  assert.doesNotMatch(detailMarkup, /intent-waters-impact/);
  assert.doesNotMatch(detailMarkup, /Annual pattern implication for Waters/i);
  assert.doesNotMatch(detailMarkup, /profile\.intentLabel/);
  assert.doesNotMatch(css, /\.intent-detail-title p/);
});

test("Agilent synthesis covers every current launch, strategic move, and filing insight", () => {
  const asOf = new Date(`${intelligence.asOfDate}T00:00:00Z`);
  const strategicMovePattern = /partnership|partner|collaboration|strategic initiative|strategic market investment|ai ecosystem|ecosystem|integration|research hub|customer experience center/i;
  const inLastYear = (item) => {
    const date = new Date(`${item.date}T00:00:00Z`);
    const ageDays = (asOf - date) / 86_400_000;
    return ageDays >= 0 && ageDays <= 365;
  };
  const agilentLaunches = launches.launches.filter((item) => item.competitor === "Agilent");
  const agilentMoves = intelligence.signals.filter((item) =>
    item.competitor === "Agilent"
    && item.category === "Corporate intelligence"
    && inLastYear(item)
    && strategicMovePattern.test(`${item.signalType} ${item.title} ${item.summary}`)
  );
  const agilentFilings = filings.insights.filter((item) => item.competitor === "Agilent");
  assert.deepEqual([agilentLaunches.length, agilentMoves.length, agilentFilings.length], [2, 7, 2]);

  [
    "6230C",
    "Fluorescence Detector",
    "Sound Analytics",
    "OpenLab Sync",
    "NATi",
    "ORCA",
    "OmixAI",
    "Mumbai",
    "OpenAI",
    "LC and LC-MS are helping drive",
    "CrossLab and services growth",
  ].forEach((marker) => assert.match(app, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), marker));

  assert.match(app, /Agilent is likely to package more regulated, application-specific LC\/LC-MS workflows/);
});

test("activity evidence links and the yellow likely-direction panel ship identically", () => {
  assert.equal(deployApp, app);
  assert.equal(deployCss, css);
  assert.match(app, /class="intent-activity-bullets"/);
  assert.match(app, /data-intent-theme-sources/);
  assert.match(app, /exact public source/);
  assert.doesNotMatch(app, /class="intent-activity-sources"/);
  assert.doesNotMatch(css, /\.intent-activity-sources/);
  assert.match(css, /\.intent-likely-direction > strong/);
  assert.match(css, /\.intent-now\s*\{[\s\S]*background:\s*#fff9eb/);
});
