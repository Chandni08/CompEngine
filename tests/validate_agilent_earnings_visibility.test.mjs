import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (file) => readFile(new URL(file, root), "utf8");

test("Agilent completed earnings results are collected from the official IR feed", async () => {
  const collector = await read("scripts/collect_agilent.py");
  const catalog = JSON.parse(await read("data/source_catalog.json"));
  const source = catalog.sources.find((item) => item.id === "agilent-investor-news");

  assert.ok(source, "Agilent investor news must be registered as an official source");
  assert.match(source.url, /^https:\/\/www\.investor\.agilent\.com\/news-and-events\/news\//);
  assert.match(collector, /INVESTOR_IR_FEED/);
  assert.match(collector, /official_ir_news_api/);
  assert.match(collector, /completed_earnings_title/);
  assert.match(collector, /timedelta\(days=120\)/);
  assert.doesNotMatch(collector, /completed_earnings_title\([^)]*\).*to Announce/s);
});

test("Agilent Q2 result is visible and carries PM-relevant official metrics", async () => {
  const intelligence = JSON.parse(await read("data/intelligence.json"));
  const earnings = intelligence.signals.find(
    (signal) => signal.competitor === "Agilent"
      && signal.title === "Agilent Reports Second-Quarter Fiscal Year 2026 Financial Results",
  );

  assert.ok(earnings, "the official Agilent Q2 result must be present in intelligence.json");
  assert.equal(earnings.date, "2026-05-27");
  assert.match(earnings.sourceUrl, /^https:\/\/www\.investor\.agilent\.com\//);
  assert.equal(earnings.earningsMetrics.length, 3);
  assert.equal(earnings.pmInsights.length, 3);
  assert.match(earnings.evidenceBoundary, /does not separately report LC or LC-MS revenue/);
});
