#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TIMEOUT_MS = 30_000;
const MAX_WORKERS = 6;
const USER_AGENT = "CompetitionEngineEvidenceValidator/1.0 (+source-keyword validation)";
const SOURCE_CREDIBILITY = {
  community_forum: 0.65,
  structured_review: 0.8,
  regulatory: 1,
  reddit: 0.55,
};
const VENDOR_IDENTITY_TERMS = {
  Waters: ["waters", "acquity", "empower", "breeze", "alliance", "arc", "synapt", "masslynx", "targetlynx", "unifi", "waters connect", "xevo"],
  Agilent: ["agilent", "infinitylab", "openlab", "1260", "1290"],
  "Thermo Fisher": ["thermo", "vanquish", "ultimate", "chromeleon"],
  Shimadzu: ["shimadzu", "nexera", "prominence", "lab solutions", "labsolutions"],
  SCIEX: ["sciex", "exionlc", "6500"],
};
const CATEGORY_EVIDENCE_TERMS = {
  "Carryover / autosampler": ["carryover", "autosampler", "needle", "injector", "wash"],
  "Reliability / leaks / pressure stability": ["pressure", "leak", "seal", "fitting", "column issue", "blockage"],
};

export function normalizeText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&(?:amp|quot|apos|#39|lt|gt);/gi, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function keywordCoverageErrors(record, sourceText, context = "customer-voice record") {
  const keywords = record?.sourceKeywords;
  if (!Array.isArray(keywords) || keywords.length < 2) {
    return [`${context}: sourceKeywords must contain at least two source-verifiable terms`];
  }

  const normalizedSource = normalizeText(sourceText);
  const errors = [];
  for (const keyword of keywords) {
    const normalizedKeyword = normalizeText(keyword);
    if (normalizedKeyword.length < 3) {
      errors.push(`${context}: invalid source keyword "${keyword}"`);
    } else if (!normalizedSource.includes(normalizedKeyword)) {
      errors.push(`${context}: source does not contain required keyword "${keyword}"`);
    }
  }
  return errors;
}

function isRedditUrl(url) {
  try {
    return new URL(url).hostname.toLowerCase().endsWith("reddit.com");
  } catch {
    return false;
  }
}

export function redditValidationUrl(value) {
  const url = new URL(value);
  if (isRedditUrl(url.toString())) {
    const postId = url.pathname.match(/\/comments\/([a-z0-9]+)/i)?.[1];
    if (!postId) throw new Error("Reddit source URL has no post ID");
    return `https://oauth.reddit.com/comments/${postId}?raw_json=1&limit=500`;
  }
  return url.toString();
}

let redditAccessToken;

async function getRedditAccessToken() {
  if (redditAccessToken) return redditAccessToken;
  const clientId = String(process.env.REDDIT_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.REDDIT_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) throw new Error("Reddit OAuth credentials are not configured");
  const authorization = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Reddit OAuth token request returned HTTP ${response.status}`);
  const payload = await response.json();
  redditAccessToken = String(payload.access_token || "").trim();
  if (!redditAccessToken) throw new Error("Reddit OAuth token response contained no token");
  return redditAccessToken;
}

export function vendorEvidenceCoverageErrors(feedback, asOfDate) {
  const identityTerms = VENDOR_IDENTITY_TERMS[feedback?.company];
  if (!identityTerms) return [];
  const end = new Date(`${asOfDate}T23:59:59Z`);
  if (Number.isNaN(end.getTime())) return [`${feedback.id}: invalid customer-voice asOfDate`];
  const start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - 1);
  const recentRecords = (feedback.evidenceRecords || []).filter((record) => {
    const date = new Date(`${record.sourceDate}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date >= start && date <= end;
  });
  if (!recentRecords.length) return [];
  const hasVendorSpecificRecord = recentRecords.some((record) => {
    const verifiedWording = normalizeText((record.sourceKeywords || []).join(" "));
    return identityTerms.some((term) => verifiedWording.includes(normalizeText(term)));
  });
  return hasVendorSpecificRecord
    ? []
    : [`${feedback.id}: recent evidence exists but none of its verified keywords names ${feedback.company} or one of its products`];
}

export function categoryEvidenceCoverageErrors(feedback) {
  const requiredTerms = CATEGORY_EVIDENCE_TERMS[feedback?.category];
  if (!requiredTerms) return [];
  return (feedback.evidenceRecords || []).flatMap((record) => {
    const verifiedWording = normalizeText((record.sourceKeywords || []).join(" "));
    const hasCategoryEvidence = requiredTerms.some((term) => verifiedWording.includes(normalizeText(term)));
    return hasCategoryEvidence
      ? []
      : [`${feedback.id} -> ${record.label || record.url || "unnamed source"}: verified keywords do not support the assigned ${feedback.category} theme`];
  });
}

export function cachedValidationErrors(record, cacheEntry, maxAgeDays = 30, now = new Date()) {
  if (!cacheEntry) return ["no cached full-source validation is available"];
  if (cacheEntry.validationMethod !== "full_source_text") return ["cached validation was not based on full source text"];
  const validatedAt = new Date(`${cacheEntry.validatedAt}T23:59:59Z`);
  if (Number.isNaN(validatedAt.getTime())) return ["cached validation date is invalid"];
  const ageDays = (now.getTime() - validatedAt.getTime()) / 86_400_000;
  if (ageDays > maxAgeDays) return [`cached validation is ${Math.floor(ageDays)} days old`];
  const cachedKeywords = new Set((cacheEntry.validatedKeywords || []).map(normalizeText));
  const missingKeywords = (record.sourceKeywords || []).filter((keyword) => !cachedKeywords.has(normalizeText(keyword)));
  return missingKeywords.map((keyword) => `cached validation does not cover keyword "${keyword}"`);
}

async function fetchWithTimeout(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response;
}

async function fetchSourceText(url) {
  if (isRedditUrl(url)) {
    const token = await getRedditAccessToken();
    const response = await fetch(redditValidationUrl(url), {
      redirect: "follow",
      headers: {
        Authorization: `bearer ${token}`,
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Reddit OAuth API returned HTTP ${response.status}`);
    const text = JSON.stringify(await response.json());
    if (normalizeText(text).length < 100) throw new Error("Reddit returned insufficient discussion text");
    return text;
  }

  const response = await fetchWithTimeout(url);
  const text = await response.text();
  const pageTitle = text.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  if (/please wait for verification|access denied|captcha/i.test(pageTitle)) {
    throw new Error("source returned an access challenge instead of evidence text");
  }
  if (normalizeText(text).length < 40) throw new Error("source returned insufficient evidence text");
  return text;
}

async function fetchAllSources(urls) {
  const results = new Map();
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(MAX_WORKERS, urls.length) }, async () => {
    while (nextIndex < urls.length) {
      const url = urls[nextIndex];
      nextIndex += 1;
      try {
        results.set(url, { text: await fetchSourceText(url) });
      } catch (error) {
        results.set(url, { error: error instanceof Error ? error.message : String(error) });
      }
    }
  });
  await Promise.all(workers);
  return results;
}

function dataFileFromArgs() {
  const flagIndex = process.argv.indexOf("--data-file");
  if (flagIndex >= 0 && process.argv[flagIndex + 1]) return path.resolve(process.argv[flagIndex + 1]);
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(scriptDirectory, "../data/customer_voice.json");
}

async function main() {
  const dataFile = dataFileFromArgs();
  const data = JSON.parse(await fs.readFile(dataFile, "utf8"));
  const cacheFile = path.join(path.dirname(dataFile), "customer_voice_validation_cache.json");
  const validationCache = JSON.parse(await fs.readFile(cacheFile, "utf8"));
  const cacheMap = new Map((validationCache.sources || []).map((source) => [source.url, source]));
  const records = (data.feedback || []).flatMap((feedback) =>
    (feedback.evidenceRecords || []).map((record) => ({ feedbackId: feedback.id, record })),
  );
  const urls = [...new Set(records.filter(({ record }) => record.sourceType !== "regulatory").map(({ record }) => record.url).filter(Boolean))];
  const sourceResults = await fetchAllSources(urls);
  const errors = [];
  const freshlyValidatedKeywords = new Map();

  for (const { feedbackId, record } of records) {
    const context = `${feedbackId} -> ${record.label || record.url || "unnamed source"}`;
    if (!(record.sourceType in SOURCE_CREDIBILITY)) {
      errors.push(`${context}: sourceType must be one of ${Object.keys(SOURCE_CREDIBILITY).join(", ")}`);
    } else if (record.sourceCredibility !== SOURCE_CREDIBILITY[record.sourceType]) {
      errors.push(`${context}: sourceCredibility must be ${SOURCE_CREDIBILITY[record.sourceType]} for ${record.sourceType}`);
    }
    if (!record.url) {
      errors.push(`${context}: missing source URL`);
      continue;
    }
    if (record.sourceType === "regulatory") {
      const extractedWorkbookText = JSON.stringify({
        excerpt: record.excerpt || "",
        entries: record.regulatoryEntries || [],
        findings: record.regulatoryFindings || [],
      });
      errors.push(...keywordCoverageErrors(record, extractedWorkbookText, context));
      continue;
    }
    const source = sourceResults.get(record.url);
    if (!source || source.error) {
      const cacheErrors = cachedValidationErrors(record, cacheMap.get(record.url), validationCache.maxAgeDays);
      if (!cacheErrors.length) continue;
      errors.push(`${context}: source could not be validated (${source?.error || "no response"}); ${cacheErrors.join("; ")}`);
      continue;
    }
    const coverageErrors = keywordCoverageErrors(record, source.text, context);
    errors.push(...coverageErrors);
    if (!coverageErrors.length) {
      const keywords = freshlyValidatedKeywords.get(record.url) || new Set();
      for (const keyword of record.sourceKeywords || []) keywords.add(keyword);
      freshlyValidatedKeywords.set(record.url, keywords);
    }
  }

  for (const feedback of data.feedback || []) {
    errors.push(...vendorEvidenceCoverageErrors(feedback, data.asOfDate));
    errors.push(...categoryEvidenceCoverageErrors(feedback));
  }

  if (errors.length) {
    console.error("Customer-voice source validation failed. Deployment is blocked.");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  // A public source can occasionally reject or time out a cloud-runner request.
  // Persist every successful full-page validation so a later transient failure
  // can use the same evidence for the bounded cache window instead of blocking
  // an otherwise healthy refresh. Failed or partial validations never enter it.
  const validatedAt = new Date().toISOString().slice(0, 10);
  for (const [url, keywords] of freshlyValidatedKeywords) {
    cacheMap.set(url, {
      url,
      validatedKeywords: [...keywords],
      validatedAt,
      validationMethod: "full_source_text",
    });
  }
  validationCache.generatedAt = new Date().toISOString();
  validationCache.sources = [...cacheMap.values()].sort((left, right) => left.url.localeCompare(right.url));
  await fs.writeFile(cacheFile, `${JSON.stringify(validationCache, null, 2)}\n`, "utf8");

  console.log(
    `Validated ${records.length} customer-voice source records across ${urls.length} unique URLs; every displayed keyword is present in its exact source.`,
  );
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) await main();
