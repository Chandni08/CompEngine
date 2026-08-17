import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (file) => readFile(new URL(file, root), "utf8");

test("Revvity Q2 result is visible with exact official evidence and no PerkinElmer misattribution", async () => {
  const intelligence = JSON.parse(await read("data/intelligence.json"));
  const earnings = intelligence.signals.find(
    (signal) => signal.id === "sec-perkinelmer-0000031791-26-000022",
  );

  assert.ok(earnings, "the official Q2 result must be present");
  assert.equal(earnings.competitor, "Revvity, Inc.");
  assert.equal(earnings.registrant, "Revvity, Inc.");
  assert.equal(earnings.relatedOperatingBusiness, null);
  assert.equal(earnings.signalType, "Quarterly earnings result");
  assert.equal(earnings.title, "Revvity Announces Financial Results for the Second Quarter of 2026");
  assert.equal(earnings.date, "2026-08-04");
  assert.equal(
    earnings.sourceUrl,
    "https://www.sec.gov/Archives/edgar/data/31791/000003179126000022/q22026pressrelease.htm",
  );
  assert.equal(earnings.earningsMetrics.length, 5);
  assert.equal(earnings.pmInsights.length, 3);
  assert.match(earnings.summary, /Life Sciences revenue of \$359 million/);
  assert.match(earnings.evidenceBoundary, /operated separately since the March 2023 divestiture/);
  assert.match(earnings.attributionBoundary, /not financial results.*PerkinElmer/i);
});

test("the collector preserves Q2 enrichment and the PerkinElmer panel explains the boundary", async () => {
  const collector = await read("scripts/collect_real_data.py");
  const remediator = await read("scripts/remediate_provenance.py");
  const app = await read("app.js");

  assert.match(collector, /REVVITY_Q2_2026_ACCESSION/);
  assert.match(collector, /q22026pressrelease\.htm/);
  assert.match(remediator, /is_q2_2026_earnings/);
  assert.match(app, /Public-reporting boundary/);
  assert.match(app, /Current PerkinElmer is privately held and does not publish public quarterly earnings/);
  assert.match(app, /Revvity is the former public PerkinElmer Life Sciences and Diagnostics company/);
  assert.match(app, /profile\.reportingContext\.title/);
  assert.match(app, /\.map\(\(item\) => item\.date\)\s*\.filter\(Boolean\)/);
  assert.doesNotMatch(app, /\.map\(\(item\) => new Date\(item\.date\)\)\s*\.filter\(\(date\) => !Number\.isNaN\(date\.getTime\(\)\)\)/);
});

test("SEC Filing Insights merges Revvity and Revvity, Inc. into one company entry", async () => {
  const app = await read("app.js");
  const deployApp = await read("deploy-site/app.js");

  assert.match(app, /function filingDisplayCompany\(company\)/);
  assert.match(app, /\^revvity\(\?:,\\s\*inc\\\.\?\)\?\$\/i\.test\(normalizedCompany\) \? "Revvity"/);
  assert.match(app, /currentFilingInsights\(\)\.map\(\(insight\) => \(\{/);
  assert.match(app, /currentEarningsSignals\(competitorIntentSignals\(\[\]\)\)\.map\(\(signal\) => \(\{/);
  assert.match(app, /filingCorporateMovesForCompany\(competitor\)/);
  assert.equal(deployApp, app);
});
