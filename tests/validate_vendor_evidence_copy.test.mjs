import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const deployApp = await readFile(new URL("../deploy-site/app.js", import.meta.url), "utf8");
const page = await readFile(new URL("../index.html", import.meta.url), "utf8");
const deployPage = await readFile(new URL("../deploy-site/index.html", import.meta.url), "utf8");

test("vendor evidence panel omits the removed methodology note", () => {
  assert.doesNotMatch(app, /No percentages are calculated here/);
  assert.doesNotMatch(app, /Each source URL appears once/);
  assert.doesNotMatch(app, /competitor-comparison-purpose/);
  assert.doesNotMatch(app, /How this differs from the overall view/);
  assert.doesNotMatch(app, /The cards above count all theme summaries/);
  assert.doesNotMatch(page, /The exact source wording behind each vendor/);
  assert.equal(deployApp, app);
  assert.equal(deployPage, page);
});

test("customer voice cards omit classification clutter", () => {
  assert.doesNotMatch(app, /analyst classification/i);
  assert.doesNotMatch(app, /<strong>Sentiment:<\/strong>/);
  assert.doesNotMatch(app, /row\.products\.slice/);
  assert.match(app, /customer-source-card-footer/);
  assert.match(app, /View source →/);
});
