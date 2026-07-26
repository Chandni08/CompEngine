import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("non-PubMed journal signals use dated exact records available by the dashboard as-of date", async () => {
  const [journalData, intelligence] = await Promise.all([
    readFile(new URL("data/journal_sources.json", root), "utf8").then(JSON.parse),
    readFile(new URL("data/intelligence.json", root), "utf8").then(JSON.parse),
  ]);
  const journals = journalData.sources.filter((source) => source.sourceClass === "Peer-reviewed journal");
  assert.ok(journals.length >= 7);
  journals.forEach((journal) => {
    assert.ok(journal.recentRecords.length >= 20, `${journal.name} needs enough exact records for a current topic sample`);
    journal.recentRecords.forEach((record) => {
      assert.match(record.sourceUrl, /^https:\/\/doi\.org\//);
      assert.ok(record.date <= intelligence.asOfDate, `${record.title} must not be future-dated`);
    });
  });
});

test("the application-trends UI separates observed non-PubMed records from source coverage", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  assert.match(app, /Observed beyond PubMed/);
  assert.match(app, /Source coverage — not trend data/);
  assert.match(app, /data-non-pubmed-theme/);
  assert.match(app, /These records show current topic concentration, not market size or growth/);
});
