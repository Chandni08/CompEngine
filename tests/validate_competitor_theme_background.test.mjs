import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const deployApp = await readFile(new URL("../deploy-site/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../product-ui.css", import.meta.url), "utf8");
const deployCss = await readFile(new URL("../deploy-site/product-ui.css", import.meta.url), "utf8");

test("selected competitor panel uses the established competitor accent as a light theme", () => {
  assert.match(app, /const competitorAccent = competitorColors\[profile\.competitor\]/);
  assert.match(app, /--intent-competitor-accent: \$\{escapeHtml\(competitorAccent\)\}/);
  assert.match(css, /border-left:\s*5px solid var\(--intent-competitor-accent\)/);
  assert.match(css, /color-mix\(in srgb, var\(--intent-competitor-accent\) 5%, #ffffff\)/);
  assert.doesNotMatch(css, /\.intent-detail-panel\.risk-(?:high|medium)\s*\{[^}]*border-left-color/);
});

test("competitor theme rendering ships identically", () => {
  assert.equal(deployApp, app);
  assert.equal(deployCss, css);
});
