import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");
const app = readFileSync(new URL("app.js", root), "utf8");
const css = readFileSync(new URL("product-ui.css", root), "utf8");
const dataset = JSON.parse(readFileSync(new URL("data/hiring_patterns.json", root), "utf8"));

test("Engineering exposes source-bounded competitor hiring patterns", () => {
  assert.match(html, /id="competitor-hiring-patterns"/);
  assert.match(html, /Competitor Hiring Patterns/);
  assert.match(html, /id="hiringPatternsNav"/);
  assert.match(html, /not a complete headcount measure/i);
  assert.match(html, /Engineering · Workforce capability signal/);
  assert.match(app, /function renderHiringPatterns\(\)/);
  assert.match(app, /function setupHiringPatternNavigation\(\)/);
  assert.match(app, /data-hiring-competitor/);
  assert.match(app, /const engineeringEvidenceVisible = state\.view === "Engineering"/);
  assert.match(css, /\.hiring-selected-detail/);
  assert.match(css, /\.hiring-strength-meter/);
});

test("all five competitors have hiring, AI-skill, and LC-MS planning reads", () => {
  assert.deepEqual(
    new Set(dataset.profiles.map((profile) => profile.competitor)),
    new Set(["Agilent", "Thermo Fisher", "Shimadzu", "SCIEX", "PerkinElmer"]),
  );
  dataset.profiles.forEach((profile) => {
    assert.ok(profile.patternSummary.length > 180);
    assert.match(profile.aiTalentSignal, /Strong|Moderate|Limited/);
    assert.equal(profile.skillClusters.length, 3);
    assert.ok(profile.observations.length >= 3);
    assert.ok(profile.likelyCapabilityBuild.length > 90);
    assert.ok(profile.planningImplication.length > 100);
    assert.equal(profile.monitorNext.length, 3);
    assert.match(profile.evidenceBoundary, /not|does not|cannot/i);
    profile.skillClusters.forEach((cluster) => {
      assert.match(cluster.strength, /Strong|Moderate|Limited/);
      assert.ok(cluster.evidence.length > 80);
    });
    profile.observations.forEach((observation) => {
      assert.match(observation.checkedDate, /^\d{4}-\d{2}-\d{2}$/);
      assert.match(observation.sourceUrl, /^https:\/\//);
      assert.ok(observation.detail.length > 100);
      assert.ok(observation.relevance.length > 25);
    });
  });
});

test("AI hiring intensity stays qualified by scope and direct attribution", () => {
  const perkinElmer = dataset.profiles.find((profile) => profile.competitor === "PerkinElmer");
  const sciex = dataset.profiles.find((profile) => profile.competitor === "SCIEX");
  const thermo = dataset.profiles.find((profile) => profile.competitor === "Thermo Fisher");
  assert.equal(perkinElmer.aiTalentSignal, "Strong · LC-MS direct");
  assert.match(perkinElmer.patternSummary, /clearest directly observed LC-MS hiring pattern/i);
  assert.match(sciex.aiTalentSignal, /Limited/);
  assert.match(sciex.evidenceBoundary, /not equivalent to current SCIEX AI headcount growth/i);
  assert.match(thermo.evidenceBoundary, /does not prove.*LC-MS organization/i);
});

test("patent, leadership, and hiring surfaces are gated only to Engineering", () => {
  const visibilityStart = app.indexOf("function updateRolePanelVisibility()");
  const visibilityEnd = app.indexOf("function render()", visibilityStart);
  const visibilityBody = app.slice(visibilityStart, visibilityEnd);
  const sourceCountStart = app.indexOf("function renderSourceCounts(signals)");
  const sourceCountEnd = app.indexOf("function populateCompetitors()", sourceCountStart);
  const sourceCountBody = app.slice(sourceCountStart, sourceCountEnd);
  const engineeringGate = visibilityBody.slice(
    visibilityBody.indexOf("const engineeringEvidenceVisible"),
    visibilityBody.indexOf("const marketingView"),
  );
  assert.match(visibilityBody, /const engineeringEvidenceVisible = state\.view === "Engineering"/);
  assert.match(visibilityBody, /patentPanel\.hidden = !engineeringEvidenceVisible/);
  assert.match(visibilityBody, /leadershipProfilePanel\.hidden = !engineeringEvidenceVisible/);
  assert.match(visibilityBody, /hiringPatternsPanel\.hidden = !engineeringEvidenceVisible/);
  assert.doesNotMatch(engineeringGate, /state\.view === "Product"/);
  assert.equal((sourceCountBody.match(/state\.view === "Engineering"/g) || []).length, 3);
  assert.doesNotMatch(sourceCountBody, /state\.view === "Product"[^\n]*(?:patent|leadership|hiring)/i);
});

test("deployment mirror contains matching hiring code, UI, styles, and data", () => {
  const deployedHtml = readFileSync(new URL("deploy-site/index.html", root), "utf8");
  const deployedApp = readFileSync(new URL("deploy-site/app.js", root), "utf8");
  const deployedCss = readFileSync(new URL("deploy-site/product-ui.css", root), "utf8");
  const deployedData = JSON.parse(readFileSync(new URL("deploy-site/data/hiring_patterns.json", root), "utf8"));
  assert.equal(deployedHtml, html);
  assert.equal(deployedApp, app);
  assert.equal(deployedCss, css);
  assert.deepEqual(deployedData, dataset);
});
