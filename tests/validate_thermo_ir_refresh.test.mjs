import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (file) => readFile(new URL(file, root), "utf8");

test("Thermo Fisher investor relations is a registered critical daily source", async () => {
  const collector = await read("scripts/collect_competitors.py");
  const refresh = await read("scripts/refresh_daily.py");
  const catalog = JSON.parse(await read("data/source_catalog.json"));
  const thermoNews = catalog.sources.find((source) => source.id === "thermo-news");

  assert.equal(
    thermoNews.url,
    "https://ir.thermofisher.com/investors/news-events/news/default.aspx",
  );
  assert.match(collector, /PressRelease\.svc\/GetPressReleaseList/);
  assert.match(collector, /parse_thermo_ir_releases/);
  assert.match(collector, /RECENT_RELEASE_REPLAY_DAYS = 45/);
  assert.match(refresh, /"Thermo Fisher": \{"thermo-products", "thermo-ms-products", "thermo-news"\}/);
  assert.match(refresh, /The dataset must not be published as current/);
});

test("Thermo Fisher IR parser preserves the July earnings announcement and results URLs", async () => {
  const monitor = JSON.parse(await read("data/competitor_monitors.json"));
  const releases = monitor.competitors["Thermo Fisher"].new_press_releases;
  const urls = releases.map((item) => item.url);

  assert.ok(urls.some((url) => /Earnings-Conference-Call-on-Thursday-July-23-2026/.test(url)));
  assert.ok(urls.some((url) => /Reports-Second-Quarter-2026-Results/.test(url)));
});
