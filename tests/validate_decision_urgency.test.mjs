import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const app = await readFile(new URL("app.js", root), "utf8");
const intelligence = JSON.parse(await readFile(new URL("data/intelligence.json", root), "utf8"));

test("every roadmap decision has a structured evidence-backed urgency argument", () => {
  assert.equal(intelligence.recommendations.length, 3);
  intelligence.recommendations.forEach((recommendation) => {
    assert.ok(recommendation.urgency?.evidence);
    assert.ok(recommendation.urgency?.decisionWindow);
    assert.ok(recommendation.urgency?.delayRisk);
    assert.match(recommendation.whyNow, /What changed:/);
    assert.match(recommendation.whyNow, /Decision window:/);
    assert.match(recommendation.whyNow, /Cost of waiting:/);
  });
});

test("urgency publication counts match the refreshed trend data", () => {
  const themes = intelligence.trends.themes;
  const expectations = [
    ["workflow requirements", "Lab automation and software-enabled workflows"],
    ["oligonucleotide method-readiness", "Oligonucleotide and nucleic-acid analytics"],
    ["PFAS-ready", "PFAS and environmental contaminant testing"],
  ];
  expectations.forEach(([titleFragment, themeName]) => {
    const recommendation = intelligence.recommendations.find((item) => item.title.includes(titleFragment));
    const trend = themes.find((item) => item.theme === themeName);
    assert.ok(recommendation && trend);
    assert.match(recommendation.urgency.evidence, new RegExp(`${Number(trend.counts["1y"]).toLocaleString("en-US")}.*last year`));
    assert.match(recommendation.urgency.evidence, new RegExp(`${Number(trend.counts["30d"]).toLocaleString("en-US")}.*last 30 days`));
  });
});

test("decision cards synthesize implications and why-now logic instead of listing launches", () => {
  assert.match(app, /function decisionUrgencyMarkup\(recommendation, decisionIndex\)/);
  assert.match(app, /decision-implication-list/);
  assert.match(app, /<b>Why now<\/b>/);
  assert.match(app, /data-decision-urgency-sources/);
  assert.match(app, /function openDecisionUrgencySources\(decisionIndex\)/);
  assert.match(app, /How this decision insight was derived/);
  assert.doesNotMatch(app, /<article class="decision-competitor-action">/);
  assert.doesNotMatch(app, /<b>Decision window<\/b>/);
  assert.match(app, /\$\{decisionUrgencyMarkup\(rec, index\)\}/);
});

test("competitor actions explicitly connect official evidence to each Waters decision", () => {
  intelligence.recommendations.forEach((recommendation) => {
    assert.ok(recommendation.urgency.decisionImplications?.length >= 2, recommendation.title);
    assert.ok(recommendation.urgency.decisionImplications.length <= 3, recommendation.title);
    assert.ok(recommendation.urgency.whyNowInsight?.length >= 100, recommendation.title);
    assert.ok(recommendation.urgency.competitorActions?.length >= 1, recommendation.title);
    recommendation.urgency.competitorActions.forEach((action) => {
      assert.ok(action.competitor);
      assert.ok(action.action.length >= 80);
      assert.ok(action.pmKeyPoint.length >= 80 && action.pmKeyPoint.length <= 220);
      assert.match(action.decisionLink, /Waters must/);
      assert.match(action.sourceUrl, /^https:\/\//);
    });
  });
  assert.match(app, /\$\{competitorActions\.length\} linked source/);
  assert.doesNotMatch(app, /View how this was derived/);
  assert.match(app, /Open official source/);
  assert.doesNotMatch(app, /Key Points for Waters PM/);
  assert.doesNotMatch(app, /How competitor actions create this decision/);
  assert.doesNotMatch(app, /Why this changes the Waters decision/);
  assert.doesNotMatch(app, /Evidence context/);
});
