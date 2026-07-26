import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const customerVoice = JSON.parse(await readFile(new URL("../data/customer_voice.json", import.meta.url), "utf8"));
const deployCustomerVoice = JSON.parse(await readFile(new URL("../deploy-site/data/customer_voice.json", import.meta.url), "utf8"));
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const deployApp = await readFile(new URL("../deploy-site/app.js", import.meta.url), "utf8");

const allowedCustomerHosts = new Set(["chromforum.org", "labwrench.com", "reddit.com", "selectscience.net"]);
const forbiddenAuthorship = /official|employee|vendor-authored|press release|product page|support knowledge base/i;

function normalizedHostname(urlValue) {
  return new URL(urlValue).hostname.toLowerCase().replace(/^www\./, "");
}

function isAllowedCustomerHost(urlValue) {
  const hostname = normalizedHostname(urlValue);
  return [...allowedCustomerHosts].some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

test("customer voice contains only independent customer-authored source records", () => {
  const records = customerVoice.feedback.flatMap((item) => item.evidenceRecords || []);
  assert.ok(records.length > 0, "expected customer-authored evidence records");
  records.forEach((record) => {
    assert.ok(isAllowedCustomerHost(record.url), `unexpected Customer Voice host: ${record.url}`);
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
    assert.equal(item.sourceName, "Independent customer-authored discussions");
  });
});

test("runtime guard and deployment copies preserve the customer-only boundary", () => {
  assert.match(app, /function isCustomerAuthoredVoiceSource\(source\)/);
  assert.match(app, /\.filter\(isCustomerAuthoredVoiceSource\)/);
  assert.equal(deployApp, app);
  assert.deepEqual(deployCustomerVoice, customerVoice);
});
