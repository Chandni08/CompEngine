import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (file) => readFile(new URL(file, root), "utf8");

test("Thermo July earnings are included in the visible competitor-intent profile", async () => {
  const app = await read("app.js");
  const intelligence = JSON.parse(await read("data/intelligence.json"));
  const earnings = intelligence.signals.find(
    (signal) => signal.competitor === "Thermo Fisher"
      && signal.title === "Thermo Fisher Scientific Reports Second Quarter 2026 Results",
  );

  assert.ok(earnings, "the dated official earnings result must be present in intelligence.json");
  assert.equal(earnings.date, "2026-07-23");
  assert.match(earnings.sourceUrl, /^https:\/\/ir\.thermofisher\.com\//);

  assert.match(app, /function currentEarningsSignals\(signals\)/);
  assert.match(app, /function competitorIntentSignals\(signals\)/);
  assert.match(app, /renderCompetitorIntentCards\(competitorIntentSignals\(signals\)\)/);
  assert.match(
    app,
    /state\.activeIntentCompetitor = competitorTrigger\.dataset\.intentSelect;\s*renderCompetitorIntentCards\(competitorIntentSignals\(currentSignals\(\)\)\)/,
    "switching competitors must preserve corporate results that product filters exclude",
  );
  assert.match(app, /const earnings = currentEarningsSignals\(signals\)\.filter\(\(signal\) => signal\.competitor === competitor\)/);
  assert.match(app, /Q2 2026 Earnings Showed Double-Digit Revenue and EPS Growth/);
  assert.match(app, /earnings\.length \? `\$\{earnings\.length\} earnings result/);
  assert.match(app, /type: "Earnings result"/);
});

test("Leadership Brief prefers the latest official earnings result for its corporate signal", async () => {
  const app = await read("app.js");

  assert.match(app, /const earnings = currentEarningsSignals\(competitorIntentSignals\(signals\)\)\[0\]/);
  assert.match(app, /const corporateSignal = earnings \|\| filing/);
  assert.match(app, /sectionId: earnings \? "competitor-intent-section" : "filing-evidence"/);
});
