import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const customerVoice = JSON.parse(await readFile(new URL("../data/customer_voice.json", import.meta.url), "utf8"));
const deployCustomerVoice = JSON.parse(await readFile(new URL("../deploy-site/data/customer_voice.json", import.meta.url), "utf8"));
const collector = await readFile(new URL("../scripts/collect_customer_voice.py", import.meta.url), "utf8");
const redditAdapter = await readFile(new URL("../scripts/customer_voice_ingestion/reddit_api.py", import.meta.url), "utf8");
const validator = await readFile(new URL("../scripts/validate_customer_voice_sources.mjs", import.meta.url), "utf8");

const weights = {
  community_forum: 0.65,
  structured_review: 0.8,
  regulatory: 1,
  reddit: 0.55,
};

test("every evidence record carries the approved source type and credibility weight", () => {
  const records = customerVoice.feedback.flatMap((item) => item.evidenceRecords || []);
  assert.ok(records.length > 0);
  records.forEach((record) => {
    assert.ok(record.sourceType in weights, `invalid sourceType for ${record.url}`);
    assert.equal(record.sourceCredibility, weights[record.sourceType], `invalid credibility for ${record.url}`);
  });
  assert.deepEqual(new Set(records.map((record) => record.sourceType)), new Set(Object.keys(weights)));
});

test("collector preserves the approved adapter order and canonical URL dedup", () => {
  assert.deepEqual(customerVoice.ingestion.adapterOrder, ["chromforum", "selectscience", "labwrench", "reddit", "fda"]);
  const generatedRecords = customerVoice.feedback
    .filter((item) => item.id.startsWith("cv-public-"))
    .flatMap((item) => item.evidenceRecords || []);
  const canonicalUrls = generatedRecords.map((record) => new URL(record.url).toString().replace(/#.*$/, ""));
  assert.equal(new Set(canonicalUrls).size, canonicalUrls.length);
  assert.match(collector, /for adapter_name, collector in ADAPTERS/);
  assert.match(collector, /canonical_url\(record\.url\)/);
});

test("Reddit collection and validation use only official OAuth endpoints", () => {
  assert.match(redditAdapter, /https:\/\/oauth\.reddit\.com/);
  assert.match(redditAdapter, /REDDIT_CLIENT_ID/);
  assert.match(redditAdapter, /Chromatography[\s\S]*analyticalchemistry[\s\S]*labrats/);
  assert.doesNotMatch(redditAdapter, /\.rss/);
  assert.doesNotMatch(validator, /\.rss/);
});

test("new public source records are mirrored into the deployment data", () => {
  assert.deepEqual(deployCustomerVoice, customerVoice);
  const types = new Set(customerVoice.feedback.flatMap((item) => item.evidenceRecords || []).map((record) => record.sourceType));
  assert.ok(types.has("community_forum"));
  assert.ok(types.has("structured_review"));
  assert.ok(types.has("regulatory"));
});
