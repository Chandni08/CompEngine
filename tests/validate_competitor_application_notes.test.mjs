import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { dateInTimeZone, validateCompetitorApplicationNotes } from "../scripts/validate_competitor_application_notes.mjs";

test("catalog freshness uses the Eastern business date across the UTC midnight boundary", () => {
  assert.equal(dateInTimeZone(new Date("2026-08-17T00:30:00Z")), "2026-08-16");
  assert.equal(dateInTimeZone(new Date("2026-08-17T04:30:00Z")), "2026-08-17");
});

test("the shipped competitor application-note catalog uses official sources", async () => {
  const catalog = JSON.parse(await readFile(new URL("../data/competitor_application_notes.json", import.meta.url), "utf8"));
  assert.deepEqual(validateCompetitorApplicationNotes(catalog, { now: new Date(catalog.generatedAt) }), []);
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

test("a stale catalog is rejected even when its record schema and URLs are valid", async () => {
  const catalog = JSON.parse(await readFile(new URL("../data/competitor_application_notes.json", import.meta.url), "utf8"));
  const now = new Date(Date.parse(catalog.generatedAt) + 48 * 60 * 60 * 1000);
  assert.match(
    validateCompetitorApplicationNotes(catalog, { now }).join("\n"),
    /generatedAt is missing or older than 36 hours/,
  );
});

test("a discovered source record missing from the catalog is rejected", async () => {
  const catalog = JSON.parse(await readFile(new URL("../data/competitor_application_notes.json", import.meta.url), "utf8"));
  const broken = structuredClone(catalog);
  const thermo = broken.sourceStatus.find((row) => row.competitor === "Thermo Fisher");
  thermo.completenessStatus = "incomplete";
  thermo.missingDiscoveredUrls = ["https://www.thermofisher.com/example-new-note"];
  assert.match(
    validateCompetitorApplicationNotes(broken, { now: new Date(broken.generatedAt) }).join("\n"),
    /Thermo Fisher application-note collection is incomplete/,
  );
});

test("a full-feed collector cannot report completeness with zero inventory records", async () => {
  const catalog = JSON.parse(await readFile(new URL("../data/competitor_application_notes.json", import.meta.url), "utf8"));
  const broken = structuredClone(catalog);
  const thermo = broken.sourceStatus.find((row) => row.competitor === "Thermo Fisher");
  thermo.inventoryRecordsSeen = 0;
  assert.match(
    validateCompetitorApplicationNotes(broken, { now: new Date(broken.generatedAt) }).join("\n"),
    /full-feed collector returned zero application-note records/,
  );
});
