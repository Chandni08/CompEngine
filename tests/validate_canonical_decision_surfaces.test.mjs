import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const json = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));

test("every decision score and count is derived from its canonical evidence object", async () => {
  const data = await json("data/intelligence.json");
  const themes = new Map(data.trends.themes.map((theme) => [theme.theme, theme]));
  for (const recommendation of data.recommendations) {
    const canonical = recommendation.canonicalDecision;
    const theme = themes.get(canonical.trend.theme);
    assert.ok(theme, canonical.id);
    assert.equal(recommendation.priorityScore, canonical.score.score, canonical.id);
    assert.equal(canonical.trend.count, theme.counts["1y"], canonical.id);
    assert.equal(canonical.trend.queryProvenance.retrievedCount, canonical.trend.count, canonical.id);
    assert.ok(canonical.score.calculatedAt, canonical.id);
    assert.equal(canonical.score.formulaVersion, 2, canonical.id);
    const quality = canonical.score.sourceQualityAssessment;
    assert.ok(quality, canonical.id);
    assert.equal(canonical.score.inputs.sourceQuality, quality.score, canonical.id);
    assert.equal(
      quality.score,
      Object.values(quality.dimensions).reduce((total, dimension) => total + dimension.score, 0),
      canonical.id,
    );
    assert.match(canonical.trend.queryProvenance.resultsUrl, /pubmed\.ncbi\.nlm\.nih\.gov\/\?term=/);
  }
});

test("oligonucleotide source quality reflects the evidence discussed on the card", async () => {
  const data = await json("data/intelligence.json");
  const decision = data.recommendations.find((item) => item.id === "decision-oligo-readiness");
  const urls = decision.evidenceBasis.links.map((link) => link.url);
  const quality = decision.canonicalDecision.score.sourceQualityAssessment;

  assert.equal(quality.score, 8);
  assert.equal(quality.dimensions.authority.score, 3);
  assert.equal(quality.dimensions.directness.score, 3);
  assert.equal(quality.dimensions.corroboration.score, 1);
  assert.equal(quality.dimensions.evidenceStatus.score, 1);
  assert.ok(urls.some((url) => url.includes("thermofisher.com/order/catalog/product/VQ-AMPLIFY")));
  assert.ok(urls.every((url) => !url.includes("perkinelmer.com")));
});

test("app and leadership export read canonical decision records instead of duplicated scores", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  const deck = await readFile(new URL("scripts/build_leadership_pptx.mjs", root), "utf8");
  assert.match(app, /rec\?\.canonicalDecision\?\.score/);
  assert.match(deck, /decision\.canonicalDecision\?\.score\?\.score \?\? decision\.priorityScore/);
  assert.match(deck, /\.\.\.\(decision\.canonicalDecision \|\| \{\}\)/);
});
