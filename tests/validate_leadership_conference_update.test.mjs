import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const deployApp = readFileSync(new URL("../deploy-site/app.js", import.meta.url), "utf8");

test("leadership conference highlight uses an event update instead of a Waters recommendation", () => {
  assert.match(app, /function leadershipConferenceUpdate\(conference\)/);
  assert.match(app, /detail: leadershipConferenceUpdate\(conference\)/);
  assert.match(app, /label: "Coming Next"/);
  assert.doesNotMatch(app, /label: "Next external moment"/);
  assert.doesNotMatch(app, /detail: `\$\{conference\.annualTheme\}\. \$\{conference\.watersPrep/);
});

test("Bioprocessing Summit update gives leadership a competitive implication", () => {
  assert.match(app, /Thermo Fisher has secured premier-sponsor visibility/);
  assert.match(app, /Analytical Intelligence, AI-enabled bioprocessing, next-generation analytical methods/);
  assert.match(app, /competitive narrative is shifting toward digital analytical workflows and complex-modality scale-up/);
  assert.doesNotMatch(app, /no Thermo Fisher talk title is public yet/);
});

test("leadership conference update ships identically", () => {
  assert.equal(deployApp, app);
});
