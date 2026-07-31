#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OFFICIAL_PRESS_RELEASE_PATHS = {
  Agilent: { host: "agilent.com", path: /^\/about\/newsroom\/presrel\/\d{4}\/.+\.html$/i },
  SCIEX: { host: "sciex.com", path: /^\/about-us\/press-releases\/\d{4}\/.+/i },
  Shimadzu: { host: "shimadzu.com", path: /^\/news\/\d{4}\/.+\.html$/i },
};

const OFFICIAL_PRODUCT_PAGES = {
  Agilent: [{ host: "agilent.com", path: /^\/en\/product\//i }],
  SCIEX: [{ host: "sciex.com", path: /^\/products\//i }],
  Shimadzu: [
    { host: "shimadzu.com", path: /^\/an\/products\//i },
    { host: "shimadzu.co.jp", path: /^\/cl\/products\//i },
  ],
};

export function launchDiscoverySourceErrors(launch) {
  const context = launch?.id || launch?.product || "unnamed launch";
  if (!launch?.sourceUrl) return [`${context}: product launch page is missing sourceUrl`];

  let url;
  try {
    url = new URL(launch.sourceUrl);
  } catch {
    return [`${context}: product-page sourceUrl is not a valid URL`];
  }

  const errors = [];
  if (url.protocol !== "https:") errors.push(`${context}: product-page sourceUrl must use HTTPS`);
  const rules = OFFICIAL_PRODUCT_PAGES[launch.competitor] || [];
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  const matchingRule = rules.find((rule) => hostname === rule.host || hostname.endsWith(`.${rule.host}`));
  if (!matchingRule) {
    errors.push(`${context}: product-page sourceUrl must use an official ${launch.competitor || "competitor"} product domain`);
  } else if (!matchingRule.path.test(url.pathname)) {
    errors.push(`${context}: sourceUrl must point to an official product page, not a press-release page or index`);
  }

  if (launch?.launchEvidenceEligible !== false && launch?.pressReleaseUrl) {
    const normalize = (value) => String(value || "").replace(/\/$/, "");
    if (normalize(launch.sourceUrl) === normalize(launch.pressReleaseUrl)) {
      errors.push(`${context}: product-page sourceUrl and pressReleaseUrl must be distinct official pages`);
    }
  }
  return errors;
}

export function launchPressReleaseErrors(launch) {
  const context = launch?.id || launch?.product || "unnamed launch";
  if (launch?.launchEvidenceEligible === false) return [];

  const errors = [];
  if (!launch?.pressReleaseUrl) {
    return [`${context}: launch evidence is missing pressReleaseUrl`];
  }

  let url;
  try {
    url = new URL(launch.pressReleaseUrl);
  } catch {
    return [`${context}: pressReleaseUrl is not a valid URL`];
  }

  if (url.protocol !== "https:") errors.push(`${context}: pressReleaseUrl must use HTTPS`);
  const rule = OFFICIAL_PRESS_RELEASE_PATHS[launch.competitor];
  if (!rule) {
    errors.push(`${context}: no official press-release rule exists for ${launch.competitor || "unknown competitor"}`);
    return errors;
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (hostname !== rule.host) {
    errors.push(`${context}: pressReleaseUrl must use the official ${rule.host} domain`);
  }
  if (!rule.path.test(url.pathname)) {
    errors.push(`${context}: pressReleaseUrl must point to an individual official press release, not a product page or press index`);
  }
  if (!/press release/i.test(launch.sourceName || "")) {
    errors.push(`${context}: sourceName must identify the record as a press release`);
  }
  return errors;
}

function dataFileFromArgs() {
  const flagIndex = process.argv.indexOf("--data-file");
  if (flagIndex >= 0 && process.argv[flagIndex + 1]) return path.resolve(process.argv[flagIndex + 1]);
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(scriptDirectory, "../data/product_launches.json");
}

async function main() {
  const dataFile = dataFileFromArgs();
  const data = JSON.parse(await fs.readFile(dataFile, "utf8"));
  const launches = data.launches || [];
  const eligible = launches.filter((launch) => launch.launchEvidenceEligible !== false);
  const errors = launches.flatMap((launch) => [
    ...launchPressReleaseErrors(launch),
    ...launchDiscoverySourceErrors(launch),
  ]);

  if (errors.length) {
    console.error("Product-launch press-release validation failed. Deployment is blocked.");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Validated ${eligible.length} launches with separate official product pages and press releases.`,
  );
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) await main();
