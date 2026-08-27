import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const deploymentApp = await readFile(new URL("../deploy-site/app.js", import.meta.url), "utf8");

test("competitor application notes avoid unsupported coverage and activity rankings", () => {
  for (const source of [app, deploymentApp]) {
    assert.match(source, /Competitor Application-Note Evidence/);
    assert.doesNotMatch(source, /The source set is curated and incomplete for vendor libraries/);
    assert.doesNotMatch(source, /note counts are not used to rank themes/);
    assert.doesNotMatch(source, /Most repeated competitor-note theme/);
    assert.doesNotMatch(source, /Most active note publisher/);
  }
});

test("theme taxonomy does not elevate PFAS into a bespoke top-level category", () => {
  for (const source of [app, deploymentApp]) {
    assert.match(source, /Environmental contaminants and regulated water/);
    assert.match(source, /Biopharma and advanced therapeutics/);
    assert.match(source, /Omics and discovery workflows/);
    assert.doesNotMatch(source, /return "PFAS and environmental testing"/);
  }
});

test("theme cards use vendor corroboration instead of note-count rankings", () => {
  for (const source of [app, deploymentApp]) {
    assert.match(source, /b\.competitors\.length - a\.competitors\.length/);
    assert.match(source, /Cross-vendor observation/);
    assert.doesNotMatch(source, /#\$\{index \+ 1\} · \$\{escapeHtml\(competitorNoteThemeStatus\(group\)\)\}/);
  }
});
