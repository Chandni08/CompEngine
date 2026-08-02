#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TRACKED_COMPETITORS = ["Agilent", "Shimadzu", "Thermo Fisher", "SCIEX", "PerkinElmer"];
const OFFICIAL_HOSTS = {
  Agilent: ["agilent.com"],
  Shimadzu: ["shimadzu.com"],
  "Thermo Fisher": ["thermofisher.com"],
  SCIEX: ["sciex.com"],
  PerkinElmer: ["perkinelmer.com"],
};

function normalizedHost(hostname) {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function isOfficialHost(hostname, competitor) {
  const host = normalizedHost(hostname);
  return (OFFICIAL_HOSTS[competitor] || []).some((official) => host === official || host.endsWith(`.${official}`));
}

export function catalogProductErrors(product, coverage = { startYear: 1996, endYear: 2026 }) {
  const context = product?.id || product?.product || "unnamed product";
  const errors = [];
  if (!product?.id) errors.push(`${context}: missing id`);
  if (!TRACKED_COMPETITORS.includes(product?.competitor)) errors.push(`${context}: competitor is not tracked`);
  if (!product?.product) errors.push(`${context}: missing product name`);
  if (!product?.technology) errors.push(`${context}: missing technology`);
  if (!Number.isInteger(product?.introducedYear)) errors.push(`${context}: introducedYear must be an integer`);
  if (product?.introducedYear < coverage.startYear && !product?.legacyReference) {
    errors.push(`${context}: pre-${coverage.startYear} product must be marked legacyReference`);
  }
  if (product?.introducedYear > coverage.endYear) errors.push(`${context}: introduction year is outside the catalog end year`);
  if (!Number.isFinite(product?.confidence) || product.confidence < 0 || product.confidence > 100) {
    errors.push(`${context}: confidence must be between 0 and 100`);
  }
  if (!product?.sourceName) errors.push(`${context}: missing source name`);
  if (!["verified", "unsupported"].includes(product?.evidenceStatus)) {
    errors.push(`${context}: evidenceStatus must be verified or unsupported`);
  }
  if (product?.evidenceStatus === "verified" && (!product?.supportingExcerpt || !product?.sourceLocation)) {
    errors.push(`${context}: verified rows require an exact supportingExcerpt and sourceLocation`);
  }
  if (product?.evidenceStatus === "unsupported" && !product?.caveat) {
    errors.push(`${context}: unsupported rows require a caveat`);
  }
  try {
    const url = new URL(product?.sourceUrl);
    if (url.protocol !== "https:") errors.push(`${context}: source URL must use HTTPS`);
    if (!isOfficialHost(url.hostname, product?.competitor)) {
      errors.push(`${context}: source URL must use an official ${product?.competitor || "competitor"} domain`);
    }
  } catch {
    errors.push(`${context}: source URL is invalid`);
  }
  return errors;
}

export function historicalCatalogErrors(catalog, currentLaunches = []) {
  const products = catalog?.products || [];
  const coverage = catalog?.coverage || {};
  const errors = products.flatMap((product) => catalogProductErrors(product, coverage));
  const ids = new Set();
  const names = new Set();

  for (const product of products) {
    if (ids.has(product.id)) errors.push(`${product.id}: duplicate id`);
    ids.add(product.id);
    const nameKey = `${product.competitor}|${product.product}`.toLowerCase();
    if (names.has(nameKey)) errors.push(`${product.id}: duplicate competitor product name`);
    names.add(nameKey);
  }

  for (const launch of currentLaunches) {
    const nameKey = `${launch.competitor}|${launch.product}`.toLowerCase();
    if (names.has(nameKey)) errors.push(`${launch.id}: duplicates a historical catalog product`);
    if (ids.has(launch.id)) errors.push(`${launch.id}: id duplicates a historical catalog product`);
  }

  for (const competitor of TRACKED_COMPETITORS) {
    const count = products.filter((product) => product.competitor === competitor).length;
    if (count < 5) errors.push(`${competitor}: fewer than five sourced historical products`);
  }

  if (coverage.startYear !== 1996 || coverage.endYear !== 2026) {
    errors.push("coverage: catalog must explicitly cover 1996 through 2026");
  }
  if (!coverage.definition || !coverage.datePolicy || !coverage.limitations) {
    errors.push("coverage: definition, datePolicy, and limitations are required");
  }
  return errors;
}

function fileFromArgs(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? path.resolve(process.argv[index + 1]) : fallback;
}

async function main() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const catalogFile = fileFromArgs("--catalog-file", path.resolve(scriptDirectory, "../data/historical_product_catalog.json"));
  const launchesFile = fileFromArgs("--launches-file", path.resolve(scriptDirectory, "../data/product_launches.json"));
  const catalog = JSON.parse(await fs.readFile(catalogFile, "utf8"));
  const launchData = JSON.parse(await fs.readFile(launchesFile, "utf8"));
  const errors = historicalCatalogErrors(catalog, launchData.launches || []);

  if (errors.length) {
    console.error("Historical product catalog validation failed. Deployment is blocked.");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  const legacyCount = catalog.products.filter((product) => product.legacyReference).length;
  const coveredCount = catalog.products.length + (launchData.launches || []).length - legacyCount;
  console.log(`Validated ${coveredCount} sourced competitor products from 1996–2026 and ${legacyCount} older legacy references.`);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) await main();
