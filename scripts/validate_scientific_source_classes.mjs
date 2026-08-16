import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VALID_MARKETS = new Set([
  "Pharma", "Biopharma", "CDMO", "Clinical", "Academic", "Government", "Environmental", "Food & Beverage",
]);

const REQUIRED_JOURNALS = new Map([
  ["analytical-chemistry-acs", "pubs.acs.org"],
  ["journal-of-chromatography-a", "www.sciencedirect.com"],
  ["journal-of-chromatography-b", "www.sciencedirect.com"],
  ["jasms", "pubs.acs.org"],
  ["analytical-bioanalytical-chemistry", "link.springer.com"],
  ["journal-pharmaceutical-biomedical-analysis", "www.sciencedirect.com"],
  ["talanta", "www.sciencedirect.com"],
]);

const REQUIRED_CONFERENCES = new Map([
  ["asms-2026", "www.asms.org"],
  ["hplc-2026", "hplc2026-symposium.org"],
  ["imsc-2026", "www.imss.nl"],
  ["msacl-2026", "www.msacl.org"],
  ["ebf-open-symposium-2026", "meetings.e-b-f.eu"],
]);

const REQUIRED_REGULATORY = new Map([
  ["usp-621-chromatography", ["doi.usp.org"]],
  ["usp-1058-instrument-qualification", ["doi.usp.org"]],
  ["ich-q2-r2", ["database.ich.org"]],
  ["ich-q14", ["database.ich.org"]],
  ["fda-warning-letters-analytical-findings", ["www.fda.gov"]],
  ["fda-form-483-observations", ["www.fda.gov"]],
]);

function validateSegments(item, prefix, errors) {
  if (!Array.isArray(item.marketSegments) || item.marketSegments.length === 0) {
    errors.push(`${prefix} has no marketSegments`);
    return;
  }
  for (const market of item.marketSegments) {
    if (!VALID_MARKETS.has(market)) errors.push(`${prefix} has unknown market segment ${market}`);
  }
}

function validateSurfaces(item, prefix, errors) {
  const surfaces = item.surfaces || [];
  if (!surfaces.includes("Market intelligence") || !surfaces.includes("Application trends")) {
    errors.push(`${prefix} is not routed to Market intelligence and Application trends`);
  }
}

function officialHost(urlValue, expectedHost, prefix, errors) {
  try {
    const url = new URL(urlValue);
    if (url.protocol !== "https:" || url.hostname !== expectedHost) {
      errors.push(`${prefix} must use the registered official HTTPS host ${expectedHost}`);
    }
  } catch {
    errors.push(`${prefix} has an invalid URL`);
  }
}

function validatePublicConferenceRecords(event, prefix, errors) {
  for (const record of event.contentRecords || []) {
    const url = String(record.canonicalUrl || "");
    if (!url) {
      errors.push(`${prefix} has a content record without a canonical URL`);
      continue;
    }
    if (/\b(?:login|signin|sign-in|oauth)\b/i.test(url) || /ssoexternallogin/i.test(url)) {
      errors.push(`${prefix} exposes an access-control URL as public conference content`);
    }
  }
}

export function scientificSourceClassErrors(journalData, conferenceData, sourceCatalog) {
  const errors = [];
  const journals = new Map((journalData.sources || []).map((source) => [source.id, source]));
  const conferences = new Map((conferenceData.events || []).map((event) => [event.id, event]));
  const catalog = new Map((sourceCatalog.sources || []).map((source) => [source.id, source]));

  for (const [id, host] of REQUIRED_JOURNALS) {
    const source = journals.get(id);
    if (!source) {
      errors.push(`Missing journal ${id}`);
      continue;
    }
    if (source.sourceClass !== "Peer-reviewed journal") errors.push(`${id} has incorrect sourceClass`);
    if (!source.issn || source.collectorType !== "crossref-journal") errors.push(`${id} is not configured for journal metadata collection`);
    validateSegments(source, id, errors);
    validateSurfaces(source, id, errors);
    officialHost(source.homepage, host, id, errors);
    const catalogEntry = catalog.get(`journal-${id}`);
    if (!catalogEntry || catalogEntry.sourceClass !== "Peer-reviewed journal") errors.push(`${id} is missing from source_catalog.json`);
  }

  for (const [id, host] of REQUIRED_CONFERENCES) {
    const event = conferences.get(id);
    if (!event) {
      errors.push(`Missing conference ${id}`);
      continue;
    }
    if (event.sourceClass !== "Conference/poster") errors.push(`${id} has incorrect sourceClass`);
    if (!Array.isArray(event.monitoringUrls) || event.monitoringUrls.length === 0) errors.push(`${id} has no monitoringUrls`);
    validateSegments(event, id, errors);
    validateSurfaces(event, id, errors);
    validatePublicConferenceRecords(event, id, errors);
    officialHost(event.website, host, id, errors);
    const catalogEntry = catalog.get(`conference-${id}`);
    if (!catalogEntry || catalogEntry.sourceClass !== "Conference/poster") errors.push(`${id} is missing from source_catalog.json`);
  }

  for (const [id, hosts] of REQUIRED_REGULATORY) {
    const source = catalog.get(id);
    if (!source) {
      errors.push(`Missing regulatory source ${id}`);
      continue;
    }
    if (source.sourceClass !== "Regulatory/pharmacopeial") errors.push(`${id} has incorrect sourceClass`);
    validateSegments(source, id, errors);
    validateSurfaces(source, id, errors);
    let host = "";
    try { host = new URL(source.url).hostname; } catch { /* handled below */ }
    if (!hosts.includes(host) || !String(source.url).startsWith("https://")) errors.push(`${id} must use an official HTTPS source`);
  }

  return errors;
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const readJson = async (filename) => JSON.parse(await readFile(path.join(root, "data", filename), "utf8"));
  const errors = scientificSourceClassErrors(
    await readJson("journal_sources.json"),
    await readJson("conference_sources.json"),
    await readJson("source_catalog.json"),
  );
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
    return;
  }
  console.log("Validated 7 peer-reviewed journals, 5 conferences, and 7 regulatory/pharmacopeial sources.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
