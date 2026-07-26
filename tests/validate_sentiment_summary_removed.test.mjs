import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("customer-voice sentiment view omits the removed summary line", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(html, /sentimentTrendSummary/);
  assert.doesNotMatch(app, /Counts are summaries/);
  assert.doesNotMatch(app, /estimated comments, survey percentages, or market share/);
});

test("removed sentiment summary ships identically", async () => {
  const [sourceHtml, deployHtml, sourceApp, deployApp] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../deploy-site/index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../deploy-site/app.js", import.meta.url), "utf8"),
  ]);

  assert.equal(deployHtml, sourceHtml);
  assert.equal(deployApp, sourceApp);
});
