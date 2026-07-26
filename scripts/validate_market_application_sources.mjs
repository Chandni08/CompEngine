import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const allowedDomains = [
  "clinicaltrials.gov",
  "cdc.gov",
  "comptox.epa.gov",
  "cordis.europa.eu",
  "crossref.org",
  "developers.openalex.org",
  "ema.europa.eu",
  "epa.gov",
  "fda.gov",
  "food.ec.europa.eu",
  "grants.gov",
  "nih.gov",
  "nsf.gov",
  "sam.gov",
  "ted.europa.eu",
  "usaspending.gov",
  "usda.gov",
  "wipo.int",
];

const requiredFields = [
  "id",
  "name",
  "publisher",
  "sourceType",
  "signalCategory",
  "description",
  "whatToMeasure",
  "refreshCadence",
  "accessType",
  "url",
  "whyItMatters",
];

export function validateMarketApplicationSources(catalog) {
  const errors = [];
  const filters = catalog?.marketFilters || [];
  const sources = catalog?.sources || [];
  const ids = new Set();
  if (!filters.length) errors.push("catalog has no market filters");
  if (!sources.length) errors.push("catalog has no sources");

  sources.forEach((source, index) => {
    const prefix = `sources[${index}]`;
    requiredFields.forEach((field) => {
      if (!String(source?.[field] ?? "").trim()) errors.push(`${prefix} is missing ${field}`);
    });
    if (ids.has(source.id)) errors.push(`${prefix} duplicates id ${source.id}`);
    ids.add(source.id);
    if (!Array.isArray(source.marketSegments) || !source.marketSegments.length) {
      errors.push(`${prefix} has no marketSegments`);
    } else {
      source.marketSegments.forEach((market) => {
        if (!filters.includes(market)) errors.push(`${prefix} uses unknown market ${market}`);
      });
    }
    try {
      const url = new URL(source.url);
      if (url.protocol !== "https:") errors.push(`${prefix} url is not HTTPS`);
      if (/pubmed|ncbi\.nlm\.nih\.gov/i.test(url.hostname)) errors.push(`${prefix} duplicates PubMed coverage`);
      if (!allowedDomains.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) {
        errors.push(`${prefix} url is not on an approved first-party domain`);
      }
    } catch {
      errors.push(`${prefix} has an invalid url`);
    }
  });

  filters.forEach((market) => {
    const count = sources.filter((source) => source.marketSegments?.includes(market)).length;
    if (count < 3) errors.push(`${market} has only ${count} mapped sources; at least 3 are required`);
  });
  return errors;
}

async function main() {
  const currentFile = fileURLToPath(import.meta.url);
  const root = path.resolve(path.dirname(currentFile), "..");
  const catalog = JSON.parse(await readFile(path.join(root, "data", "market_application_sources.json"), "utf8"));
  const errors = validateMarketApplicationSources(catalog);
  if (errors.length) {
    errors.forEach((error) => console.error(error));
    process.exitCode = 1;
    return;
  }
  console.log(`Validated ${catalog.sources.length} non-PubMed sources across ${catalog.marketFilters.length} market filters.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
