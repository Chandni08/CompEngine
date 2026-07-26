import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const intelligence = JSON.parse(
  await readFile(new URL("../data/intelligence.json", import.meta.url), "utf8"),
);

test("roadmap recommendation titles state the decision rather than the validation task", () => {
  const recommendations = intelligence.recommendations || [];

  assert.ok(recommendations.length >= 3);
  for (const recommendation of recommendations) {
    assert.match(recommendation.title, /^Decide whether\b/);
  }
  assert.ok(
    !recommendations.some((recommendation) => /^Approve a .*validation/i.test(recommendation.title)),
  );
});

test("the lead workflow recommendation keeps validation as the supporting action", () => {
  const workflowRecommendation = intelligence.recommendations.find((recommendation) =>
    /end-to-end workflow requirements/i.test(recommendation.title),
  );

  assert.ok(workflowRecommendation);
  assert.match(workflowRecommendation.leadershipDecision, /^Decide whether\b/);
  assert.match(workflowRecommendation.action, /Run a four-week validation/i);
});
