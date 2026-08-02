import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("customer voice groups findings and sources by company", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(app, /class="company-voice-list"/);
  assert.match(app, /class="company-voice-card/);
  assert.match(app, /What Customers Value/);
  assert.match(app, /Pain Points and Unmet Needs/);
  assert.match(app, /data-company-voice-sources/);
  assert.doesNotMatch(app, /class="vendor-source-record"/);
});

test("customer voice section uses the company-grouped title", async () => {
  const [sourceHtml, deployHtml] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../deploy-site/index.html", import.meta.url), "utf8"),
  ]);

  assert.match(sourceHtml, />Customer Voice by Company<\/h4>/);
  assert.doesNotMatch(sourceHtml, />Purchase-Driving Themes<\/h4>/);
  assert.doesNotMatch(sourceHtml, /Vendor Evidence by Source/);
  assert.equal(deployHtml, sourceHtml);
});

test("company voice synthesis ships identically", async () => {
  const [sourceApp, deployApp, sourceCss, deployCss] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../deploy-site/app.js", import.meta.url), "utf8"),
    readFile(new URL("../product-ui.css", import.meta.url), "utf8"),
    readFile(new URL("../deploy-site/product-ui.css", import.meta.url), "utf8"),
  ]);

  assert.equal(deployApp, sourceApp);
  assert.equal(deployCss, sourceCss);
});
