import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");
const app = readFileSync(new URL("app.js", root), "utf8");
const css = readFileSync(new URL("product-ui.css", root), "utf8");
const dataset = JSON.parse(readFileSync(new URL("data/patent_insights.json", root), "utf8"));

test("Engineering exposes a dedicated patent filing insights section", () => {
  assert.match(html, /id="patent-filing-insights"/);
  assert.match(html, /Competitor Patent Filing Insights/);
  assert.match(html, /id="patentFilingNav"/);
  assert.match(html, /Engineering · Early architecture signal/);
  assert.match(app, /const engineeringEvidenceVisible = state\.view === "Engineering"/);
  assert.match(app, /renderPatentInsights\(\)/);
  assert.match(css, /\.patent-selected-detail/);
});

test("patent insights are source-linked, dated, and carry an evidence boundary", () => {
  assert.ok(dataset.insights.length >= 4);
  assert.deepEqual(
    new Set(dataset.insights.map((item) => item.competitor)),
    new Set(["Agilent", "Thermo Fisher", "Shimadzu", "SCIEX"]),
  );
  dataset.insights.forEach((item) => {
    assert.match(item.publicationNumber, /^[A-Z]{2}/);
    assert.match(item.filingDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(item.publicationDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(item.sourceUrl, /^https:\/\/patents\.google\.com\/patent\//);
    assert.ok(item.signal.length > 80);
    assert.ok(item.roadmapImplication.length > 80);
    assert.ok(item.evidenceBoundary.length > 80);
    assert.equal(item.fieldCitable, false);
  });
});

test("deployment mirror contains the patent section and matching data", () => {
  const deployedHtml = readFileSync(new URL("deploy-site/index.html", root), "utf8");
  const deployedApp = readFileSync(new URL("deploy-site/app.js", root), "utf8");
  const deployedData = JSON.parse(readFileSync(new URL("deploy-site/data/patent_insights.json", root), "utf8"));
  assert.match(deployedHtml, /id="patent-filing-insights"/);
  assert.match(deployedApp, /fetch\("data\/patent_insights\.json"/);
  assert.match(deployedApp, /const engineeringEvidenceVisible = state\.view === "Engineering"/);
  assert.deepEqual(deployedData, dataset);
});
