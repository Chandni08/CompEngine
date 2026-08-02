#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OFFICIAL_HOSTS = ["waters.com", "sec.gov"];
const DATE_BASES = ["Introduction", "Earliest official record"];

function normalizedHost(hostname) {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function isOfficialHost(hostname) {
  const host = normalizedHost(hostname);
  return OFFICIAL_HOSTS.some((official) => host === official || host.endsWith(`.${official}`));
}

export function watersProductErrors(product, coverage = { startYear: 1996, endYear: 2026 }) {
  const context = product?.id || product?.product || "unnamed Waters product";
  const errors = [];
  if (!product?.id) errors.push(`${context}: missing id`);
  if (product?.company !== "Waters") errors.push(`${context}: company must be Waters`);
  if (!product?.product) errors.push(`${context}: missing product name`);
  if (!product?.technology) errors.push(`${context}: missing technology`);
  if (!Number.isInteger(product?.introducedYear)) errors.push(`${context}: introducedYear must be an integer`);
  if (product?.introducedYear < coverage.startYear || product?.introducedYear > coverage.endYear) {
    errors.push(`${context}: year must fall within the 1996–2026 catalog window`);
  }
  if (!DATE_BASES.includes(product?.dateBasis)) errors.push(`${context}: dateBasis must identify an introduction or earliest official record`);
  if (!Number.isFinite(product?.confidence) || product.confidence < 0 || product.confidence > 100) {
    errors.push(`${context}: confidence must be between 0 and 100`);
  }
  if (!product?.sourceName) errors.push(`${context}: missing source name`);
  try {
    const url = new URL(product?.sourceUrl);
    if (url.protocol !== "https:") errors.push(`${context}: source URL must use HTTPS`);
    if (!isOfficialHost(url.hostname)) errors.push(`${context}: source must use an official Waters or SEC domain`);
  } catch {
    errors.push(`${context}: source URL is invalid`);
  }
  return errors;
}

export function historicalWatersCatalogErrors(catalog, comparisonData) {
  const historicalProducts = catalog?.products || [];
  const currentSystems = comparisonData?.watersSystems || [];
  const allSystems = [...currentSystems, ...historicalProducts];
  const coverage = catalog?.coverage || {};
  const errors = allSystems.flatMap((product) => watersProductErrors(product, coverage));
  for (const product of historicalProducts) {
    if (!["verified", "unsupported"].includes(product?.evidenceStatus)) {
      errors.push(`${product?.id}: evidenceStatus must be verified or unsupported`);
    }
    if (product?.evidenceStatus === "verified" && (!product?.supportingExcerpt || !product?.sourceLocation)) {
      errors.push(`${product?.id}: verified rows require an exact supportingExcerpt and sourceLocation`);
    }
    if (product?.evidenceStatus === "unsupported" && !product?.caveat) {
      errors.push(`${product?.id}: unsupported rows require a caveat`);
    }
  }
  const ids = new Set();
  const names = new Set();

  for (const product of allSystems) {
    if (ids.has(product.id)) errors.push(`${product.id}: duplicate id`);
    ids.add(product.id);
    const nameKey = String(product.product || "").trim().toLowerCase();
    if (names.has(nameKey)) errors.push(`${product.id}: duplicate Waters product name`);
    names.add(nameKey);
  }

  if (coverage.startYear !== 1996 || coverage.endYear !== 2026) {
    errors.push("coverage: catalog must explicitly cover 1996 through 2026");
  }
  if (!coverage.definition || !coverage.datePolicy || !coverage.limitations) {
    errors.push("coverage: definition, datePolicy, and limitations are required");
  }
  if (allSystems.length < 50) errors.push("coverage: fewer than 50 sourced Waters systems");
  if (!allSystems.some((product) => product.introducedYear === 1996)) errors.push("coverage: missing the 1996 Waters portfolio boundary");
  if (!allSystems.some((product) => product.introducedYear >= 2025)) errors.push("coverage: missing a current 2025–2026 Waters system");
  return errors;
}

function fileFromArgs(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? path.resolve(process.argv[index + 1]) : fallback;
}

async function main() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const catalogFile = fileFromArgs("--catalog-file", path.resolve(scriptDirectory, "../data/historical_waters_catalog.json"));
  const comparisonsFile = fileFromArgs("--comparisons-file", path.resolve(scriptDirectory, "../data/product_comparisons.json"));
  const catalog = JSON.parse(await fs.readFile(catalogFile, "utf8"));
  const comparisonData = JSON.parse(await fs.readFile(comparisonsFile, "utf8"));
  const errors = historicalWatersCatalogErrors(catalog, comparisonData);

  if (errors.length) {
    console.error("Historical Waters catalog validation failed. Deployment is blocked.");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  const total = (catalog.products || []).length + (comparisonData.watersSystems || []).length;
  console.log(`Validated ${total} sourced Waters systems from 1996–2026; comparator history is ready for deployment.`);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) await main();
