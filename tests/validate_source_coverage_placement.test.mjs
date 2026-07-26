import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("market source coverage renders with competitor coverage health", () => {
  const competitorPanelStart = html.indexOf("competitor-coverage-panel");
  const competitorPanelEnd = html.indexOf("</section>", competitorPanelStart);
  const competitorPanel = html.slice(competitorPanelStart, competitorPanelEnd);

  assert.match(competitorPanel, /id="competitorCoverageHealth"/);
  assert.match(competitorPanel, /id="marketSourceCoverage"/);
  assert.match(app, /byId\("marketSourceCoverage"\)\.innerHTML = marketSourceCoverageMarkup\(marketSources\)/);
});

test("application trend markup no longer embeds source coverage", () => {
  const trendRenderStart = app.indexOf("function renderTrends()");
  const trendAssignmentEnd = app.indexOf("byId(\"marketSourceCoverage\")", trendRenderStart);
  const trendMarkup = app.slice(trendRenderStart, trendAssignmentEnd);

  assert.doesNotMatch(trendMarkup, /marketSourceCoverageMarkup\(marketSources\)/);
});
