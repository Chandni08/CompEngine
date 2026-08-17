#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "by", "for", "from",
  "how", "in", "into", "is", "it", "its", "more", "new", "of", "on", "or",
  "our", "the", "their", "this", "to", "with", "official", "press", "release",
  "report", "publication", "article", "news", "newsroom", "page", "source",
  "html", "htm", "aspx", "php",
]);
const INCOMPLETE_ENDINGS = new Set([
  "a", "an", "and", "or", "the", "to", "for", "with", "of", "from", "in",
  "on", "at", "by", "its", "their", "our",
]);
const TITLE_BEARING_CONTEXT = /press|news|release|earnings|filing|article|publication|journal|corporate|regulatory|technical insight|application note/i;
const GENERIC_OBSERVATION = /official product page observed|monitoring coverage|page added|page updated/i;
const SKIPPED_FILES = new Set(["link_health.json"]);

function words(value) {
  return String(value || "").toLowerCase().match(/[a-z0-9]+/g) || [];
}

function significantWords(value) {
  return words(decodeURIComponent(String(value || ""))).filter(
    (word) => word.length >= 3 && !STOP_WORDS.has(word) && !/^\d+$/.test(word),
  );
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function recordContext(record) {
  return ["signalType", "classification", "category", "recordType", "sourceType", "sourceName"]
    .map((key) => record[key] || "")
    .join(" ");
}

function sourceUrls(record) {
  return ["sourceUrl", "url"]
    .filter((key) => isHttpUrl(record[key]))
    .map((key) => ({ key, url: record[key] }));
}

function semanticMismatch(title, url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return "invalid external URL";
  }
  const slug = parsed.pathname.replace(/\/$/, "").split("/").pop() || "";
  if (/\.(?:pdf|xml|json|csv|zip)$/i.test(slug)) return "";
  const slugWords = significantWords(slug);
  const titleWords = significantWords(title);
  if (slugWords.length < 4 || titleWords.length < 3) return "";
  const slugSet = new Set(slugWords);
  const titleSet = new Set(titleWords);
  const overlap = [...slugSet].filter((word) => titleSet.has(word)).length;
  const slugCoverage = overlap / slugSet.size;
  const titleCoverage = overlap / titleSet.size;
  if (overlap < 2 || (slugCoverage < 0.34 && titleCoverage < 0.34)) {
    return `title/permalink mismatch (${overlap} significant words overlap)`;
  }
  return "";
}

function inspectRecord(record, location, errors, counters) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return;
  const title = typeof record.title === "string" ? record.title.trim() : "";
  if (!title || GENERIC_OBSERVATION.test(title)) return;
  const urls = sourceUrls(record);
  if (!urls.length) return;
  const context = recordContext(record);
  const perkinNewsroom = urls.some(({ url }) => {
    try {
      const parsed = new URL(url);
      return /(^|\.)perkinelmer\.com$/i.test(parsed.hostname) && parsed.pathname.includes("/corporate-and-newsroom/");
    } catch {
      return false;
    }
  });
  if (!perkinNewsroom && !TITLE_BEARING_CONTEXT.test(context)) return;

  counters.records += 1;
  const finalWord = words(title).at(-1) || "";
  if (INCOMPLETE_ENDINGS.has(finalWord) || /[-,:;]$/.test(title)) {
    errors.push(`${location}.title is incomplete: ${JSON.stringify(title)}`);
  }
  for (const { key, url } of urls) {
    counters.links += 1;
    const mismatch = semanticMismatch(title, url);
    if (mismatch) errors.push(`${location}.${key}: ${mismatch}\n  title: ${title}\n  URL: ${url}`);
  }
  if (perkinNewsroom && (record.sourceTitleVerified !== true || record.titleSource !== "page_content_url_match")) {
    errors.push(`${location}: PerkinElmer newsroom title lacks page-content verification metadata`);
  }
}

function walk(value, location, errors, counters) {
  if (Array.isArray(value)) {
    value.forEach((child, index) => walk(child, `${location}[${index}]`, errors, counters));
    return;
  }
  if (!value || typeof value !== "object") return;
  inspectRecord(value, location, errors, counters);
  for (const [key, child] of Object.entries(value)) walk(child, `${location}.${key}`, errors, counters);
}

export function validateDataDirectory(dataDirectory) {
  const errors = [];
  const counters = { files: 0, records: 0, links: 0 };
  for (const name of fs.readdirSync(dataDirectory).filter((item) => item.endsWith(".json") && !SKIPPED_FILES.has(item)).sort()) {
    const filename = path.join(dataDirectory, name);
    const value = JSON.parse(fs.readFileSync(filename, "utf8"));
    counters.files += 1;
    walk(value, name, errors, counters);
  }
  return { errors, ...counters };
}

function run() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dataDirectory = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(here, "..", "data");
  const result = validateDataDirectory(dataDirectory);
  if (result.errors.length) {
    console.error(`Source-title integrity failed with ${result.errors.length} issue(s):`);
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Source-title integrity passed: ${result.links} title-linked sources across ${result.records} records in ${result.files} data files.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) run();
