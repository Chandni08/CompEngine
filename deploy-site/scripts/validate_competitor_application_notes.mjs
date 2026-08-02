import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const officialDomains = {
  Agilent: ["agilent.com"],
  "Thermo Fisher": ["thermofisher.com"],
  Shimadzu: ["shimadzu.com"],
  SCIEX: ["sciex.com"],
};

const requiredFields = [
  "id",
  "date",
  "dateLabel",
  "datePrecision",
  "competitor",
  "title",
  "applicationArea",
  "marketSegment",
  "technology",
  "products",
  "evidenceStatement",
  "sourceType",
  "sourceUrl",
];

function hoursOld(value, now) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? (now.getTime() - parsed) / 3_600_000 : Number.POSITIVE_INFINITY;
}

function newestDate(notes) {
  return notes.map((note) => String(note.date || "").slice(0, 10)).filter(Boolean).sort().at(-1) || null;
}

export function validateCompetitorApplicationNotes(
  catalog,
  { now = new Date(), maxCatalogAgeHours = 36, maxCompetitorRecordAgeDays = 400 } = {},
) {
  const errors = [];
  const notes = catalog?.notes || [];
  const ids = new Set();
  const urls = new Set();
  if (!notes.length) errors.push("catalog has no application notes");
  if (Number(catalog?.schemaVersion || 0) < 3) errors.push("catalog schemaVersion must be at least 3");
  if (hoursOld(catalog?.generatedAt, now) > maxCatalogAgeHours) {
    errors.push(`catalog generatedAt is missing or older than ${maxCatalogAgeHours} hours`);
  }
  const currentUtcDate = now.toISOString().slice(0, 10);
  if (catalog?.asOfDate !== currentUtcDate) errors.push(`catalog asOfDate must be ${currentUtcDate}`);

  notes.forEach((note, index) => {
    const prefix = `notes[${index}]`;
    requiredFields.forEach((field) => {
      if (!String(note?.[field] ?? "").trim()) errors.push(`${prefix} is missing ${field}`);
    });
    if (ids.has(note.id)) errors.push(`${prefix} duplicates id ${note.id}`);
    ids.add(note.id);
    const canonicalUrl = String(note.sourceUrl || "").replace(/\/$/, "");
    if (urls.has(canonicalUrl)) errors.push(`${prefix} duplicates sourceUrl ${note.sourceUrl}`);
    urls.add(canonicalUrl);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(note.date || "")) errors.push(`${prefix} has an invalid date`);
    if (!["day", "month", "year"].includes(note.datePrecision)) errors.push(`${prefix} has an invalid datePrecision`);
    if (!/application|technical note/i.test(note.sourceType || "")) errors.push(`${prefix} is not identified as application-note evidence`);
    try {
      const url = new URL(note.sourceUrl);
      if (url.protocol !== "https:") errors.push(`${prefix} sourceUrl is not HTTPS`);
      const allowed = officialDomains[note.competitor] || [];
      if (!allowed.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) {
        errors.push(`${prefix} sourceUrl is not on an official ${note.competitor} domain`);
      }
    } catch {
      errors.push(`${prefix} has an invalid sourceUrl`);
    }
  });

  const statuses = Array.isArray(catalog?.sourceStatus) ? catalog.sourceStatus : [];
  for (const competitor of Object.keys(officialDomains)) {
    const status = statuses.find((row) => row?.competitor === competitor);
    const competitorNotes = notes.filter((note) => note.competitor === competitor);
    if (!status) {
      errors.push(`sourceStatus is missing ${competitor}`);
      continue;
    }
    if (hoursOld(status.attemptedAt, now) > maxCatalogAgeHours) {
      errors.push(`${competitor} application-note collection is older than ${maxCatalogAgeHours} hours`);
    }
    if (status.inventoryMode === "official_full_feed") {
      if (status.coverageStatus !== "complete_inventory") {
        errors.push(`${competitor} full-feed coverage is not marked complete_inventory`);
      }
      if (Number(status.inventoryRecordsSeen || 0) < 1) {
        errors.push(`${competitor} full-feed collector returned zero application-note records`);
      }
      if (status.completenessStatus !== "complete") {
        errors.push(`${competitor} application-note collection is incomplete`);
      }
    } else if (status.inventoryMode === "registered_official_records") {
      if (status.coverageStatus !== "limited_inventory") {
        errors.push(`${competitor} registered-record coverage must be marked limited_inventory`);
      }
      if (status.completenessStatus !== "registered_only") {
        errors.push(`${competitor} registered application-note collection is incomplete`);
      }
    } else {
      errors.push(`${competitor} has an unknown application-note inventoryMode`);
    }
    if (status.freshnessStatus !== "current") errors.push(`${competitor} application-note catalog is stale`);
    if (Number(status.catalogRecords) !== competitorNotes.length) {
      errors.push(`${competitor} catalogRecords does not match the catalog`);
    }
    if (Number(status.inventoryRecordsIngested || 0) > Number(status.inventoryRecordsSeen || 0)) {
      errors.push(`${competitor} ingested more application notes than the source inventory reported`);
    }
    if ((status.missingDiscoveredUrls || []).length) {
      errors.push(`${competitor} is missing ${status.missingDiscoveredUrls.length} discovered application-note URL(s)`);
    }
    if (status.newestDiscoveredPresent !== true) errors.push(`${competitor} newest discovered application note is not present`);
    const actualNewest = newestDate(competitorNotes);
    if (status.catalogNewestDate !== actualNewest) errors.push(`${competitor} catalogNewestDate does not match the catalog`);
    if (status.sourceNewestDate && actualNewest && status.sourceNewestDate > actualNewest) {
      errors.push(`${competitor} source inventory is newer than the application-note catalog`);
    }
    const ageDays = actualNewest ? (now.getTime() - Date.parse(`${actualNewest}T00:00:00Z`)) / 86_400_000 : Infinity;
    if (ageDays > maxCompetitorRecordAgeDays) {
      errors.push(`${competitor} newest application note is older than ${maxCompetitorRecordAgeDays} days`);
    }
  }
  return errors;
}

async function main() {
  const currentFile = fileURLToPath(import.meta.url);
  const root = path.resolve(path.dirname(currentFile), "..");
  const catalog = JSON.parse(await readFile(path.join(root, "data", "competitor_application_notes.json"), "utf8"));
  const errors = validateCompetitorApplicationNotes(catalog);
  if (errors.length) {
    errors.forEach((error) => console.error(error));
    process.exitCode = 1;
    return;
  }
  const competitors = new Set(catalog.notes.map((note) => note.competitor));
  console.log(`Validated freshness and completeness for ${catalog.notes.length} official application notes from ${competitors.size} competitors.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
