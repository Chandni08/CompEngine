#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_FAMILIES = {
  "thermo-dionex-ion-chromatography": {
    technology: "Ion chromatography",
    marketSegments: ["Environmental", "Food & Beverage"],
    requiredProducts: ["integrion.html", "ics-6000.html"],
  },
  "thermo-vanquish-neo-nano-lc": {
    technology: "Nano-LC",
    marketSegments: ["Biopharma", "Academic"],
    requiredProducts: ["vanquish-neo-uhplc-system.html"],
  },
};

function officialThermoUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "thermofisher.com" || url.hostname.endsWith(".thermofisher.com"));
  } catch {
    return false;
  }
}

function sameMembers(actual = [], expected = []) {
  return actual.length === expected.length && expected.every((item) => actual.includes(item));
}

export function thermoMonitoringErrors(registry, monitorData, sourceCatalog, historicalCatalog) {
  const errors = [];
  if (registry?.competitor !== "Thermo Fisher") errors.push("registry competitor must be Thermo Fisher");
  if (!officialThermoUrl(registry?.sitemapUrl)) errors.push("registry sitemap must be an official Thermo HTTPS URL");

  const registeredFamilies = new Map((registry?.families || []).map((family) => [family.id, family]));
  const monitoredFamilies = new Map(
    (monitorData?.competitors?.["Thermo Fisher"]?.monitoredFamilies || []).map((family) => [family.id, family]),
  );
  const catalogSources = new Map((sourceCatalog?.sources || []).map((source) => [source.id, source]));
  const historicalProducts = historicalCatalog?.products || [];

  for (const [familyId, expected] of Object.entries(EXPECTED_FAMILIES)) {
    const family = registeredFamilies.get(familyId);
    if (!family) {
      errors.push(`${familyId}: missing registry family`);
      continue;
    }
    if (family.technology !== expected.technology) errors.push(`${familyId}: incorrect technology tag`);
    if (!sameMembers(family.marketSegments, expected.marketSegments)) errors.push(`${familyId}: incorrect market segment tags`);
    if (!(family.productPageUrls || []).every(officialThermoUrl)) errors.push(`${familyId}: product URLs must use official Thermo HTTPS pages`);
    for (const suffix of expected.requiredProducts) {
      if (!(family.productPageUrls || []).some((url) => url.endsWith(suffix))) errors.push(`${familyId}: missing ${suffix}`);
    }

    const monitored = monitoredFamilies.get(familyId);
    if (!monitored) errors.push(`${familyId}: not present in generated Thermo monitor`);
    if (monitored && !sameMembers(monitored.marketSegments, expected.marketSegments)) errors.push(`${familyId}: generated monitor lost market tags`);
    if (monitored && !(monitored.trackedProductUrls || []).length) errors.push(`${familyId}: generated monitor has no tracked product page`);

    const source = catalogSources.get(`${familyId}-products`);
    if (!source) errors.push(`${familyId}: missing source-catalog registration`);
    if (source && !officialThermoUrl(source.url)) errors.push(`${familyId}: source catalog does not use the official Thermo sitemap`);
  }

  for (const productName of ["Dionex Integrion HPIC System", "Dionex ICS-4000 Capillary HPIC System", "Dionex ICS-6000 HPIC System"]) {
    const product = historicalProducts.find((item) => item.competitor === "Thermo Fisher" && item.product === productName);
    if (!product) errors.push(`${productName}: missing from historical product coverage`);
    if (product && !sameMembers(product.marketSegments, ["Environmental", "Food & Beverage"])) errors.push(`${productName}: incorrect historical market tags`);
  }
  const vanquishNeo = historicalProducts.find((item) => item.id === "thermo-vanquish-neo-2021");
  if (!vanquishNeo || vanquishNeo.subtechnology !== "Nano-LC") errors.push("Vanquish Neo: missing nano-LC tag");
  if (vanquishNeo && !sameMembers(vanquishNeo.marketSegments, ["Biopharma", "Academic"])) errors.push("Vanquish Neo: incorrect historical market tags");
  return errors;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function main() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const dataDirectory = path.resolve(scriptDirectory, "../data");
  const errors = thermoMonitoringErrors(
    await readJson(path.join(dataDirectory, "thermo_monitoring_families.json")),
    await readJson(path.join(dataDirectory, "competitor_monitors.json")),
    await readJson(path.join(dataDirectory, "source_catalog.json")),
    await readJson(path.join(dataDirectory, "historical_product_catalog.json")),
  );
  if (errors.length) {
    console.error("Thermo monitoring validation failed. Deployment is blocked.");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }
  console.log("Validated Thermo Dionex IC and Vanquish Neo nano-LC monitoring coverage.");
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) await main();
