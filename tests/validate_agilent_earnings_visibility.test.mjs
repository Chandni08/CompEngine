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
  assert.match(collector, /"all_press_releases"/);
  assert.doesNotMatch(collector, /completed_earnings_title\([^)]*\).*to Announce/s);
});

test("Agilent refresh reconciles every official archive record and exposes newsroom updates", async () => {
  const app = await read("app.js");
  const refresh = await read("scripts/refresh_daily.py");

  assert.match(refresh, /monitor\.get\("all_press_releases"\)/);
  assert.match(refresh, /browser_verified_archive_cache/);
  assert.match(app, /function currentNewsroomSignals\(signals\)/);
  assert.match(app, /type: "Newsroom update"/);
  assert.match(app, /earnings event announcement/);
  assert.match(app, /\[- \]quarter/);
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

test("every Agilent archive row is published and the latest earnings announcement is classified", async () => {
  const intelligence = JSON.parse(await read("data/intelligence.json"));
  const monitor = JSON.parse(await read("data/agilent_monitor.json"));
  const key = (item) => `${item.date}|${item.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;
  const published = new Set(
    intelligence.signals.filter((item) => item.competitor === "Agilent").map(key),
  );

  assert.ok(monitor.all_press_releases.length >= 33, "the complete official 2026 archive must be retained");
  for (const release of monitor.all_press_releases) {
    assert.ok(published.has(key(release)), `missing Agilent release: ${release.date} ${release.title}`);
  }

  const announcement = intelligence.signals.find(
    (signal) => signal.competitor === "Agilent"
      && signal.title === "Agilent to Announce Third-Quarter Fiscal Year 2026 Financial Results on Aug. 26",
  );
  assert.ok(announcement, "the latest official earnings announcement must be published");
  assert.equal(announcement.signalType, "Earnings event announcement");
  assert.equal(announcement.marketSegment, "Corporate");
});
