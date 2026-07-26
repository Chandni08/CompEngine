import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const deployment = readFileSync(new URL("../deploy-site/app.js", import.meta.url), "utf8");

test("decision score cards omit removed factors", () => {
  assert.doesNotMatch(source, /label:\s*"Time sensitivity"/);
  assert.doesNotMatch(source, /time sensitivity \$\{breakdown\.strategicUrgency\}/i);
  assert.doesNotMatch(source, /scoreDerivation:\s*\{[\s\S]*?strategicUrgency:\s*\{/);
  assert.doesNotMatch(source, /label:\s*"Public customer feedback"/);
  assert.doesNotMatch(source, /public customer feedback \$\{breakdown\.customerPull\}/i);
  assert.doesNotMatch(source, /scoreDerivation:\s*\{[\s\S]*?customerPull:\s*\{/);
  assert.doesNotMatch(source, /label:\s*"Roadmap relevance"/);
  assert.doesNotMatch(source, /roadmap fit \$\{breakdown\./i);
  assert.doesNotMatch(source, /label:\s*"Decision relevance"/);
  assert.doesNotMatch(source, /decision relevance \$\{breakdown\.decisionRelevance\}/i);
  assert.doesNotMatch(source, /scoreDerivation:\s*\{[\s\S]*?decisionRelevance:\s*\{/);
});

test("deployment copy matches the source implementation", () => {
  assert.equal(deployment, source);
});
