import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const rendererStart = app.indexOf("function renderOverallTrendAnalysis(signals)");
const rendererEnd = app.indexOf("\nfunction ", rendererStart + 1);
const renderer = app.slice(rendererStart, rendererEnd);

test("overall trend cards omit pace and evidence-volume eyebrow labels", () => {
  assert.doesNotMatch(app, /Growing faster/);
  assert.doesNotMatch(app, /Supported by several evidence types/);
  assert.doesNotMatch(app, /Appearing in limited evidence types/);
  assert.doesNotMatch(renderer, /evidence\.direction/);
});

test("overall trend cards use the PM consideration label", () => {
  assert.doesNotMatch(app, /Next PM action/i);
  assert.match(renderer, /Next PM consideration/);
});
