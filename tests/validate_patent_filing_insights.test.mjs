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
  assert.ok(dataset.insights.length >= 18);
  assert.deepEqual(
    new Set(dataset.insights.map((item) => item.competitor)),
    new Set(["Agilent", "Thermo Fisher", "Shimadzu", "SCIEX", "PerkinElmer"]),
  );
  const ids = new Set();
  const publications = new Set();
  const counts = new Map();
  const allowedTechnologies = new Set(["LC-MS", "HPLC", "UPLC", "HRMS", "MS"]);
  dataset.insights.forEach((item) => {
    assert.ok(!ids.has(item.id), `duplicate patent id: ${item.id}`);
    assert.ok(!publications.has(item.publicationNumber), `duplicate publication: ${item.publicationNumber}`);
    ids.add(item.id);
    publications.add(item.publicationNumber);
    counts.set(item.competitor, (counts.get(item.competitor) || 0) + 1);
    assert.match(item.publicationNumber, /^[A-Z]{2}/);
    assert.match(item.filingDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(item.publicationDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(item.date, item.publicationDate);
    assert.match(item.legalStatus, /^(Pending|Granted in \d{4})$/);
    assert.ok(allowedTechnologies.has(item.technology), `${item.id} has unsupported technology`);
    assert.match(item.sourceUrl, /^https:\/\/patents\.google\.com\/patent\//);
    assert.ok(item.signal.length > 80);
    assert.ok(item.roadmapImplication.length > 80);
    assert.ok(item.evidenceBoundary.length > 80);
    assert.equal(item.evidenceStatus, "verified");
    assert.equal(item.languageType, "analyst_paraphrase");
    assert.equal(item.fieldCitable, false);
    assert.equal(item.approvalState, "draft");
  });
  for (const competitor of ["Agilent", "Thermo Fisher", "Shimadzu", "SCIEX"]) {
    assert.ok(counts.get(competitor) >= 4, `${competitor} needs at least four records`);
  }
  assert.ok(counts.get("PerkinElmer") >= 2, "PerkinElmer needs at least two verified records");
  assert.ok(dataset.insights.some((item) => item.legalStatus === "Pending"));
  assert.ok(dataset.insights.some((item) => item.legalStatus.startsWith("Granted")));
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

test("each record carries a registered office title, assignee, and priority date", () => {
  dataset.insights.forEach((item) => {
    assert.ok(item.officialTitle?.length > 5, `${item.id} is missing officialTitle`);
    assert.ok(item.assignee?.length > 2, `${item.id} is missing assignee`);
    assert.notEqual(item.officialTitle, item.title);
    assert.match(item.priorityDate, /^\d{4}-\d{2}-\d{2}$/);
  });
  assert.match(app, /Registered title/);
  assert.match(app, /Earliest priority/);
});

test("the company readout does not restate a single filing's headline and implication", () => {
  assert.doesNotMatch(app, /patent-portfolio-readout/);
  assert.doesNotMatch(css, /patent-portfolio-readout/);
});
