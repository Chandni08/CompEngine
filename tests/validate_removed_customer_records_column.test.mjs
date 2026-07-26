import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const deployApp = await readFile(new URL("../deploy-site/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
const deployCss = await readFile(new URL("../deploy-site/styles.css", import.meta.url), "utf8");

test("roadmap impact map omits the customer-public records column", () => {
  assert.doesNotMatch(app, /Customer\/public records/);
  assert.doesNotMatch(app, /data-label="Customer\/public records"/);
  assert.match(app, /row: \[capability, trend, pressure, evidence\]/);
  assert.match(css, /grid-template-columns:\s*minmax\(180px, 1\.25fr\)[^;]+;/);
});

test("roadmap impact map omits the recommended-decision column", () => {
  assert.doesNotMatch(app, /data-label="Recommended decision"/);
  assert.doesNotMatch(app, /"Recommended decision",/);
});

test("four-column roadmap impact map ships identically", () => {
  assert.equal(deployApp, app);
  assert.equal(deployCss, css);
});
