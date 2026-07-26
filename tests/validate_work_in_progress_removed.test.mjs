import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("work-in-progress coverage panel and links are removed", () => {
  assert.doesNotMatch(html, /id="source-health"/);
  assert.doesNotMatch(html, /id="coverageGaps"/);
  assert.doesNotMatch(html, />Work in progress</);
  assert.doesNotMatch(app, /renderCoverageGaps/);
  assert.doesNotMatch(app, /href="#source-health"/);
});
