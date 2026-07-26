import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateCompetitorApplicationNotes } from "../scripts/validate_competitor_application_notes.mjs";

test("the shipped competitor application-note catalog uses official sources", async () => {
  const catalog = JSON.parse(await readFile(new URL("../data/competitor_application_notes.json", import.meta.url), "utf8"));
  assert.deepEqual(validateCompetitorApplicationNotes(catalog), []);
});

test("a non-official application-note source is rejected", () => {
  const catalog = {
    notes: [{
      id: "bad-source",
      date: "2026-01-01",
      dateLabel: "2026",
      datePrecision: "year",
      competitor: "SCIEX",
      title: "Example",
      applicationArea: "Example",
      marketSegment: "Pharma",
      technology: "LC-MS",
      products: "Example",
      evidenceStatement: "Example",
      sourceType: "Official technical note",
      sourceUrl: "https://example.com/note",
    }],
  };
  assert.match(validateCompetitorApplicationNotes(catalog).join("\n"), /official SCIEX domain/);
});
