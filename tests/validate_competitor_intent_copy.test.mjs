import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const deployApp = await readFile(new URL("../deploy-site/app.js", import.meta.url), "utf8");

test("competitor intent cards do not render the removed focus line", () => {
  assert.equal(deployApp, app);
  assert.doesNotMatch(app, /<p><b>Focus:<\/b>/);
});

test("competitor activity summary omits the redundant eyebrow", () => {
  assert.doesNotMatch(app, /Cross-Source Activity Summary/i);
  assert.doesNotMatch(deployApp, /Cross-Source Activity Summary/i);
});

test("competitor activity summary omits the redundant lead sentence", () => {
  assert.doesNotMatch(app, /Agilent used the period to connect LC and LC-MS hardware/i);
  assert.doesNotMatch(deployApp, /Agilent used the period to connect LC and LC-MS hardware/i);
  assert.doesNotMatch(app, /profile\.activityLead/);
});
