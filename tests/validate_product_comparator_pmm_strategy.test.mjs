import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [app, deployApp, css, deployCss] = await Promise.all([
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../deploy-site/app.js", import.meta.url), "utf8"),
  readFile(new URL("../styles.css", import.meta.url), "utf8"),
  readFile(new URL("../deploy-site/styles.css", import.meta.url), "utf8"),
]);

test("Product Marketing comparator adds product-level strategy, content, and take-share guidance", () => {
  assert.match(app, /function marketingProductStrategyLens\(launch, waters, comparison\)/);
  assert.match(app, /function marketingProductContentModel\(launch, waters, comparison, featureProfile\)/);
  assert.match(app, /function marketingProductShareStrategyMarkup\(launch, waters, comparison, featureProfile\)/);
  assert.match(app, /Competitor product marketing strategy/);
  assert.match(app, /Compared with Waters product content/);
  assert.match(app, /Product content to create/);
  assert.match(app, /Product-level PMM take-share play/);
  assert.match(app, /External product content indicates positioning activity—not preference, adoption, or share movement/);
  assert.match(app, /Exact product source:/);
  assert.match(app, /Related \$\{competitorApplicationTheme\(note\)\.toLowerCase\(\)\} evidence:/);
  assert.match(app, /exact or related product\/workflow asset/);
  assert.match(app, /state\.view === "Marketing" \? marketingProductShareStrategyMarkup\(launch, waters, comparison, featureProfile\) : ""/);
});

test("product-level PMM strategy is evidence-linked and source/deployment mirrors remain aligned", () => {
  assert.match(app, /pmmWordOverlap/);
  assert.match(app, /currentCompetitorApplicationNotes\(\)/);
  assert.match(app, /featureProfile\?\.rows/);
  assert.match(app, /waters\.artifacts/);
  assert.match(css, /\.pmm-share-strategy/);
  assert.equal(deployApp, app);
  assert.equal(deployCss, css);
});

test("PMM Read translates Product Management source language into a marketing decision lens", () => {
  assert.match(app, /function marketingComparatorSourceRead\(readout\)/);
  assert.match(app, /The PMM question is whether the competitor changes the buying criterion, category narrative, proof expectation, or seller objection/);
  assert.match(app, /route validated capability gaps to Product Management/);
  assert.match(app, /\.replace\(\/\\bPM\\b\/gi, "PMM"\)/);
  assert.doesNotMatch(app.match(/function marketingComparatorRead[\s\S]*?\n\}/)?.[0] || "", /\$\{comparison\.pmRead/);
});

test("Product Marketing comparator assigns repeated ideas to one section", () => {
  assert.match(app, /Test whether the offer changes the buyer's decision criteria, required proof, or seller objections/);
  assert.match(app, /function comparatorDecisionRead\(rowRead, impactNote\)/);
  assert.match(app, /Covered in the impact summary above/);
  assert.match(app, /state\.view !== "Marketing"[\s\S]*introduced in/);
  assert.match(app, /comparison\.shortHorizonDefense && state\.view !== "Marketing"/);
  assert.match(app, /state\.view === "Marketing" \? "" : `<section class="comparison-action-grid">/);
});
