import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [html, app, productStyles, deployHtml, deployApp, deployProductStyles] = await Promise.all([
  read("../index.html"),
  read("../app.js"),
  read("../product-ui.css"),
  read("../deploy-site/index.html"),
  read("../deploy-site/app.js"),
  read("../deploy-site/product-ui.css"),
]);

test("public evidence library includes local search and filter controls", () => {
  assert.match(html, /<form id="publicEvidenceFilters" class="public-evidence-filters" role="search">/);
  assert.match(html, /id="signalSearch" type="search"/);
  assert.match(html, /id="signalCompanyFilter"/);
  assert.match(html, /id="signalTechnologyFilter"/);
  assert.match(html, /id="signalSourceFilter"/);
  assert.match(html, /id="clearSignalFilters"/);
  assert.match(app, /function filterPublicEvidenceLibrary\(signals\)/);
  assert.match(app, /signal\.title,[\s\S]*signal\.theme,[\s\S]*signal\.competitor,[\s\S]*signal\.sourceName/s);
  assert.match(app, /publicEvidenceSearchTerm = event\.target\.value;[\s\S]*state\.signalPage = 1;/s);
});

test("public evidence table removes the score breakdown column", () => {
  const librarySection = html.slice(
    html.indexOf('id="evidence-signal-feed"'),
    html.indexOf('class="panel competitor-coverage-panel"'),
  );
  const renderSignals = app.slice(
    app.indexOf("function renderSignals(signals)"),
    app.indexOf("function setupPublicEvidenceFilters()"),
  );

  assert.doesNotMatch(librarySection, /Priority score/i);
  assert.doesNotMatch(renderSignals, /signalScoreBreakdownMarkup/);
  assert.match(renderSignals, /colspan="5"/);
});

test("public evidence filters are responsive and non-sticky", () => {
  const filterStyles = productStyles.slice(
    productStyles.indexOf(".public-evidence-filters"),
    productStyles.indexOf(".journal-source-top"),
  );
  assert.match(productStyles, /@media \(max-width: 1180px\)[\s\S]*?\.public-evidence-filters\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/s);
  assert.match(productStyles, /@media \(max-width: 720px\)[\s\S]*?\.public-evidence-filters\s*\{[\s\S]*?grid-template-columns:\s*1fr/s);
  assert.doesNotMatch(filterStyles, /position:\s*sticky/);
});

test("public evidence source and deploy assets stay synchronized", () => {
  assert.equal(deployHtml, html);
  assert.equal(deployApp, app);
  assert.equal(deployProductStyles, productStyles);
});
