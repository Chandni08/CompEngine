#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OFFICIAL_PRESS_RELEASE_PATHS = {
  Agilent: { host: "agilent.com", path: /^\/about\/newsroom\/presrel\/\d{4}\/.+\.html$/i },
  SCIEX: { host: "sciex.com", path: /^\/about-us\/press-releases\/\d{4}\/.+/i },
  Shimadzu: { host: "shimadzu.com", path: /^\/news\/\d{4}\/.+\.html$/i },
};

const OFFICIAL_DISCOVERY_HOSTS = {
  Agilent: "agilent.com",
  SCIEX: "sciex.com",
  Shimadzu: "shimadzu.com",
};

export function launchDiscoverySourceErrors(launch) {
  const context = launch?.id || launch?.product || "unnamed launch";
  if (!launch?.sourceUrl) return [`${context}: launch discovery source is missing sourceUrl`];

  let url;
  try {
    url = new URL(launch.sourceUrl);
  } catch {
    return [`${context}: discovery sourceUrl is not a valid URL`];
  }

  const errors = [];
  if (url.protocol !== "https:") errors.push(`${context}: discovery sourceUrl must use HTTPS`);
  const officialHost = OFFICIAL_DISCOVERY_HOSTS[launch.competitor];
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!officialHost || (hostname !== officialHost && !hostname.endsWith(`.${officialHost}`))) {
    errors.push(`${context}: discovery sourceUrl must use the official ${officialHost || launch.competitor || "competitor"} domain`);
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
    `Validated ${eligible.length} product-launch evidence records and ${launches.length} official discovery sources.`,
  );
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) await main();
