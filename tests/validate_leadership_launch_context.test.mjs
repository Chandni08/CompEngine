import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const deployApp = readFileSync(new URL("../deploy-site/app.js", import.meta.url), "utf8");

test("leadership launch highlight uses factual context instead of PM recommendations", () => {
  assert.match(app, /function leadershipLaunchContext\(launch\)/);
  assert.match(app, /detail: leadershipLaunchContext\(launch\)/);
  assert.doesNotMatch(app, /label: "Latest competitive change",[\s\S]{0,400}detail: launch\.pmImplication/);
});

test("Agilent leadership context explains the MAM workflow action", () => {
  assert.match(app, /turned the 6230C from a standalone LC\/TOF into a named MAM biopharma workflow/);
  assert.match(app, /full-scan accurate-mass acquisition with software-led attribute monitoring and review/);
});

test("leadership launch context ships identically", () => {
  assert.equal(deployApp, app);
});
