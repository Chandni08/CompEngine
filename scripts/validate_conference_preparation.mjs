import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const allowedStatuses = new Set(["Confirmed in 2026 program", "Expected — not confirmed"]);
const officialDomains = [
  "acs.org",
  "agilent.com",
  "bioprocessingsummit.com",
  "casss.org",
  "ep3msummit.com",
  "bruker.com",
  "imsc26.com",
  "imss.nl",
  "informaconnect.com",
  "lab-of-the-future.com",
  "sciex.com",
  "setac.org",
  "shimadzu.eu",
  "shimadzu.com",
  "thermofisher.com",
  "waters.com",
];
const eventDomains = [
  "acs.org",
  "bioprocessingsummit.com",
  "casss.org",
  "ep3msummit.com",
  "bruker.com",
  "imsc26.com",
  "imss.nl",
  "informaconnect.com",
  "lab-of-the-future.com",
  "oxfordabstracts.com",
  "setac.org",
  "shimadzu.eu",
];

function isOfficialHttps(value, domains = officialDomains) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && domains.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function requireText(errors, prefix, value, label) {
  if (!String(value ?? "").trim()) errors.push(`${prefix} is missing ${label}`);
}

export function validateConferencePreparation(catalog) {
  const errors = [];
  const events = catalog?.events || [];
  const ids = new Set();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(catalog?.asOfDate || "")) errors.push("catalog has an invalid asOfDate");
  requireText(errors, "catalog", catalog?.evidencePolicy, "evidencePolicy");
  if (!events.length) errors.push("catalog has no conference preparation events");

  events.forEach((event, eventIndex) => {
    const prefix = `events[${eventIndex}]`;
    ["id", "eventName", "dateRange", "startDate", "endDate", "tier", "website", "annualTheme"].forEach((field) => {
      requireText(errors, prefix, event?.[field], field);
    });
    if (ids.has(event.id)) errors.push(`${prefix} duplicates id ${event.id}`);
    ids.add(event.id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event.startDate || "") || !/^\d{4}-\d{2}-\d{2}$/.test(event.endDate || "")) {
      errors.push(`${prefix} has an invalid date`);
    } else if (event.endDate < event.startDate) {
      errors.push(`${prefix} endDate is before startDate`);
    }
    if (!isOfficialHttps(event.website, eventDomains)) errors.push(`${prefix} website is not an official event URL`);
    if (!Array.isArray(event.scientificFocus) || event.scientificFocus.length < 2) errors.push(`${prefix} needs at least 2 scientificFocus items`);
    if (!Array.isArray(event.competitorContent) || !event.competitorContent.length) errors.push(`${prefix} has no competitorContent`);
    if (!Array.isArray(event.watersScientificContent) || event.watersScientificContent.length < 2) errors.push(`${prefix} needs at least 2 Waters scientific recommendations`);
    if (!Array.isArray(event.boothRecommendations) || event.boothRecommendations.length < 2) errors.push(`${prefix} needs at least 2 booth recommendations`);

    (event.competitorContent || []).forEach((item, itemIndex) => {
      const itemPrefix = `${prefix}.competitorContent[${itemIndex}]`;
      ["competitor", "evidenceStatus", "content", "evidenceBasis", "sourceLabel", "sourceUrl"].forEach((field) => {
        requireText(errors, itemPrefix, item?.[field], field);
      });
      if (!allowedStatuses.has(item.evidenceStatus)) errors.push(`${itemPrefix} has an invalid evidenceStatus`);
      if (!isOfficialHttps(item.sourceUrl)) errors.push(`${itemPrefix} sourceUrl is not an official source`);
      if (item.evidenceStatus === "Confirmed in 2026 program" && !isOfficialHttps(item.sourceUrl, eventDomains)) {
        errors.push(`${itemPrefix} confirmed content must link to an official 2026 event source`);
      }
    });

    (event.watersScientificContent || []).forEach((item, itemIndex) => {
      const itemPrefix = `${prefix}.watersScientificContent[${itemIndex}]`;
      ["title", "deliverable", "proofNeeded"].forEach((field) => requireText(errors, itemPrefix, item?.[field], field));
    });

    (event.boothRecommendations || []).forEach((item, itemIndex) => {
      const itemPrefix = `${prefix}.boothRecommendations[${itemIndex}]`;
      ["product", "role", "message", "productUrl"].forEach((field) => requireText(errors, itemPrefix, item?.[field], field));
      if (!isOfficialHttps(item.productUrl, ["waters.com"])) errors.push(`${itemPrefix} productUrl is not on the official Waters domain`);
    });

    (event.monitoringLinks || []).forEach((link, linkIndex) => {
      if (!isOfficialHttps(link.url, eventDomains)) errors.push(`${prefix}.monitoringLinks[${linkIndex}] is not an official event source`);
    });
  });

  return errors;
}

async function main() {
  const currentFile = fileURLToPath(import.meta.url);
  const root = path.resolve(path.dirname(currentFile), "..");
  const catalog = JSON.parse(await readFile(path.join(root, "data", "conference_preparation.json"), "utf8"));
  const errors = validateConferencePreparation(catalog);
  if (errors.length) {
    errors.forEach((error) => console.error(error));
    process.exitCode = 1;
    return;
  }
  const confirmed = catalog.events.flatMap((event) => event.competitorContent).filter((item) => item.evidenceStatus === "Confirmed in 2026 program").length;
  console.log(`Validated ${catalog.events.length} conference briefs with ${confirmed} confirmed competitor program items.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
