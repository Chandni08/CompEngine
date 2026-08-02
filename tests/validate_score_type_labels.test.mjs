import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

test("recommendation cards use evidence priority without unsupported numeric precision", () => {
  assert.match(app, /Evidence priority: \$\{escapeHtml\(breakdown\.evidencePriority\)\}/);
  assert.doesNotMatch(app, /Priority score · \$\{breakdown\.total\}\/100/);
  assert.doesNotMatch(app, /breakdown\.total\}\/100/);
});

test("competitor profiles use methodological inference-confidence tiers", () => {
  assert.match(app, /Inference confidence · \$\{escapeHtml\(profile\.confidence\)\}/);
  assert.doesNotMatch(app, /profile\.confidenceScore\}\/100/);
});
