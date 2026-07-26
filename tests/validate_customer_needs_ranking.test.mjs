import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const deployApp = await readFile(new URL("../deploy-site/app.js", import.meta.url), "utf8");
const start = app.indexOf("function renderUnmetNeeds(items)");
const end = app.indexOf("function renderMarketPositioning(items)", start);
const renderer = app.slice(start, end);

test("customer needs rank by supporting-record count", () => {
  assert.match(renderer, /\.sort\(\(a, b\) => b\.evidence\.length - a\.evidence\.length/);
  assert.match(renderer, /a\.originalIndex - b\.originalIndex/);
});

test("customer-needs ranking ships identically", () => {
  assert.equal(deployApp, app);
});
