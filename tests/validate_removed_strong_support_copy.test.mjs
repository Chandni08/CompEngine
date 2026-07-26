import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const deployApp = await readFile(new URL("../deploy-site/app.js", import.meta.url), "utf8");

test("roadmap evidence rows do not repeat a strong-support line", () => {
  assert.doesNotMatch(app, /Strong cross-source support/i);
  assert.match(app, /evidence \? `<small>\$\{escapeHtml\(evidence\)\}<\/small>` : ""/);
});

test("removed strong-support wording ships identically", () => {
  assert.equal(deployApp, app);
});
