import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const customerVoice = JSON.parse(await readFile(new URL("../data/customer_voice.json", import.meta.url), "utf8"));
const deployCustomerVoice = JSON.parse(await readFile(new URL("../deploy-site/data/customer_voice.json", import.meta.url), "utf8"));
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const deployApp = await readFile(new URL("../deploy-site/app.js", import.meta.url), "utf8");
const index = await readFile(new URL("../index.html", import.meta.url), "utf8");

const allowedCustomerHosts = new Set(["chromforum.org", "fda.gov", "labwrench.com", "reddit.com", "selectscience.net"]);
const forbiddenAuthorship = /employee|vendor-authored|press release|support knowledge base/i;
const allowedSourceTypes = new Set(["community_forum", "structured_review", "regulatory", "reddit"]);

function normalizedHostname(urlValue) {
  return new URL(urlValue).hostname.toLowerCase().replace(/^www\./, "");
}

function isAllowedCustomerHost(urlValue) {
  const hostname = normalizedHostname(urlValue);
  return [...allowedCustomerHosts].some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

test("customer voice contains only approved public evidence source classes", () => {
  const records = customerVoice.feedback.flatMap((item) => item.evidenceRecords || []);
  assert.ok(records.length > 0, "expected customer-authored evidence records");
  records.forEach((record) => {
    assert.ok(isAllowedCustomerHost(record.url), `unexpected Customer Voice host: ${record.url}`);
    assert.ok(allowedSourceTypes.has(record.sourceType), `unexpected sourceType: ${record.sourceType}`);
    assert.equal(typeof record.sourceCredibility, "number", `missing numeric sourceCredibility for ${record.url}`);
    assert.doesNotMatch(`${record.recordType || ""} ${record.label || ""}`, forbiddenAuthorship);
  });
});

test("customer voice source catalog excludes vendor-owned and employee-authored material", () => {
  customerVoice.sources.forEach((source) => {
    assert.ok(isAllowedCustomerHost(source.url), `unexpected Customer Voice catalog host: ${source.url}`);
    assert.doesNotMatch(`${source.sourceType || ""} ${source.sourceName || ""}`, forbiddenAuthorship);
  });
  customerVoice.feedback.forEach((item) => {
    assert.ok(isAllowedCustomerHost(item.sourceUrl), `unexpected Customer Voice fallback host: ${item.sourceUrl}`);
  });
});

test("runtime guard and deployment copies preserve the customer-only boundary", () => {
  assert.match(app, /function isCustomerAuthoredVoiceSource\(source\)/);
  assert.match(app, /\.filter\(isCustomerAuthoredVoiceSource\)/);
  assert.equal(deployApp, app);
  assert.deepEqual(deployCustomerVoice, customerVoice);
});

test("customer voice visibly distinguishes every retained public source class", () => {
  assert.match(app, /sourceType: normalizedCustomerVoiceSourceType\(record\.sourceType, record\.url\)/);
  assert.match(app, /function renderCustomerVoiceSourceMix\(items\)/);
  assert.match(app, /data-customer-source-type/);
  assert.match(app, /customer-source-type-badge/);
  assert.match(index, /id="customerVoiceSourceMix"/);
  assert.match(index, /<th>Source type<\/th>/);
});
