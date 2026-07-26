import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../index.html", import.meta.url), "utf8");
const deployment = await readFile(new URL("../deploy-site/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const deploymentApp = await readFile(new URL("../deploy-site/app.js", import.meta.url), "utf8");

test("display-depth and reset controls are removed", () => {
  for (const markup of [source, deployment]) {
    assert.doesNotMatch(markup, /id="viewDepthControls"/);
    assert.doesNotMatch(markup, /id="viewDepthDescription"/);
    assert.doesNotMatch(markup, /id="resetFilters"/);
    assert.doesNotMatch(markup, />Quick glance</);
    assert.doesNotMatch(markup, />In-depth</);
    assert.doesNotMatch(markup, />Decisions only</);
  }
});

test("removed controls leave no runtime handlers or hidden view-depth state", () => {
  for (const implementation of [app, deploymentApp]) {
    assert.doesNotMatch(implementation, /viewDepth/);
    assert.doesNotMatch(implementation, /setViewDepth/);
    assert.doesNotMatch(implementation, /resetFilters/);
    assert.doesNotMatch(implementation, /quick-reveal/);
  }
});

test("source and deployment copies remain identical", () => {
  assert.equal(deployment, source);
  assert.equal(deploymentApp, app);
});
