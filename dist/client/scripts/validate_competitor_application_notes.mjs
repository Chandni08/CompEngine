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

export function validateCompetitorApplicationNotes(catalog) {
  const errors = [];
  const notes = catalog?.notes || [];
  const ids = new Set();
  const urls = new Set();
  if (!notes.length) errors.push("catalog has no application notes");
  notes.forEach((note, index) => {
    const prefix = `notes[${index}]`;
    requiredFields.forEach((field) => {
      if (!String(note?.[field] ?? "").trim()) errors.push(`${prefix} is missing ${field}`);
    });
    if (ids.has(note.id)) errors.push(`${prefix} duplicates id ${note.id}`);
    ids.add(note.id);
    if (urls.has(note.sourceUrl)) errors.push(`${prefix} duplicates sourceUrl ${note.sourceUrl}`);
    urls.add(note.sourceUrl);
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
  console.log(`Validated ${catalog.notes.length} official application notes from ${competitors.size} competitors.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
