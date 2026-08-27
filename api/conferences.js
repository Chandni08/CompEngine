const { createHash, createHmac, timingSafeEqual } = require("node:crypto");
const { mkdir, readFile, rename, unlink, writeFile } = require("node:fs/promises");
const path = require("node:path");
const publishedCatalog = require("../data/conference_sources.json");

const DEFAULT_CATALOG_PATH = path.join(process.cwd(), "data", "conference_catalog.runtime.json");
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const MAX_RECORDS = 500;

function json(response, status, payload) {
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  return response.status(status).json(payload);
}

function publishedRecords() {
  return (publishedCatalog.events || []).map((event) => ({
    id: event.id,
    title: event.eventName,
    link: event.website,
    tier: event.tier || "Tier 3",
    startDate: event.startDate || "",
    endDate: event.endDate || "",
    dateRange: event.dateRange || "",
    location: event.location || "",
    marketSegments: event.marketSegments || [],
    technologyFocus: event.technologyFocus || [],
    source: "Published catalog",
    updatedAt: publishedCatalog.generatedAt || "",
  }));
}

function text(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function stringList(value) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => text(item, 100)).filter(Boolean))].slice(0, 30)
    : [];
}

function validUrl(value) {
  const url = new URL(text(value, 2048));
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Conference links must use HTTP or HTTPS.");
  return url.href;
}

function sanitizeRecord(record) {
  const id = text(record?.id, 100);
  const title = text(record?.title, 240);
  const tier = text(record?.tier, 20);
  if (!id || !title) throw new Error("Every conference requires an id and title.");
  if (!["Tier 1", "Tier 2", "Tier 3"].includes(tier)) throw new Error("Every conference requires a valid monitoring tier.");
  const clean = {
    id,
    title,
    link: validUrl(record?.link),
    tier,
    startDate: text(record?.startDate, 10),
    endDate: text(record?.endDate, 10),
    dateRange: text(record?.dateRange, 100),
    location: text(record?.location, 240),
    marketSegments: stringList(record?.marketSegments),
    technologyFocus: stringList(record?.technologyFocus),
    source: text(record?.source, 40) || "Admin entry",
    updatedAt: text(record?.updatedAt, 40) || new Date().toISOString(),
  };
  const evidenceUrl = text(record?.evidenceUrl, 2048);
  const scrapedAt = text(record?.scrapedAt, 40);
  const officialTitle = text(record?.officialTitle, 240);
  if (evidenceUrl) clean.evidenceUrl = validUrl(evidenceUrl);
  if (scrapedAt) clean.scrapedAt = scrapedAt;
  if (officialTitle) clean.officialTitle = officialTitle;
  return clean;
}

function sanitizeCatalog(records) {
  if (!Array.isArray(records) || records.length > MAX_RECORDS) throw new Error("The conference catalog is invalid or too large.");
  const clean = records.map(sanitizeRecord);
  if (new Set(clean.map((record) => record.id)).size !== clean.length) throw new Error("Conference ids must be unique.");
  return clean;
}

function configuredUserId() {
  return String(process.env.CONFERENCE_ADMIN_USER_ID || "").trim();
}

function configuredPasswordHash() {
  return String(process.env.CONFERENCE_ADMIN_PASSWORD_HASH || "").trim();
}

function sessionSecret() {
  return String(process.env.CONFERENCE_ADMIN_SESSION_SECRET || "").trim();
}

function authenticationConfigured() {
  return Boolean(configuredUserId() && /^[a-f0-9]{64}$/i.test(configuredPasswordHash()) && sessionSecret());
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function sign(value) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function issueSessionToken(userId) {
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function authenticated(request) {
  if (!authenticationConfigured()) return false;
  const header = String(request.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(sign(payload), signature)) return false;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return claims.sub === configuredUserId() && Number(claims.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function catalogPath() {
  return path.resolve(process.env.CONFERENCE_CATALOG_PATH || DEFAULT_CATALOG_PATH);
}

async function readPersistedCatalog() {
  try {
    const payload = JSON.parse(await readFile(catalogPath(), "utf8"));
    return {
      records: sanitizeCatalog(payload.records),
      updatedAt: text(payload.updatedAt, 40),
    };
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

let catalogWriteQueue = Promise.resolve();

async function writePersistedCatalog(records) {
  const payload = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    records: sanitizeCatalog(records),
  };
  const write = catalogWriteQueue.then(async () => {
    const target = catalogPath();
    const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
    await mkdir(path.dirname(target), { recursive: true });
    try {
      await writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
      await rename(temporary, target);
    } finally {
      await unlink(temporary).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
  });
  catalogWriteQueue = write.catch(() => {});
  await write;
  return payload;
}

async function authenticate(request, response) {
  if (!authenticationConfigured()) {
    return json(response, 503, { error: "Conference admin authentication is not configured." });
  }
  const userId = text(request.body?.userId, 100);
  const password = String(request.body?.password || "");
  const passwordHash = createHash("sha256").update(password).digest("hex");
  if (!safeEqual(userId, configuredUserId()) || !safeEqual(passwordHash, configuredPasswordHash())) {
    return json(response, 401, { error: "Incorrect user ID or password." });
  }
  return json(response, 200, {
    token: issueSessionToken(userId),
    expiresIn: SESSION_MAX_AGE_SECONDS,
  });
}

module.exports = async function handler(request, response) {
  try {
    if (request.method === "POST") return authenticate(request, response);

    if (request.method === "GET") {
      try {
        const stored = await readPersistedCatalog();
        return json(response, 200, stored
          ? { ...stored, persisted: true }
          : { records: publishedRecords(), updatedAt: publishedCatalog.generatedAt || "", persisted: false });
      } catch (error) {
        console.error("Conference server catalog read failed.", error);
        return json(response, 503, { error: "The conference server catalog is unavailable." });
      }
    }

    if (request.method === "PUT") {
      if (!authenticated(request)) return json(response, 401, { error: "Your admin session has expired. Sign in again." });
      const payload = await writePersistedCatalog(request.body?.records);
      return json(response, 200, { ...payload, persisted: true });
    }

    response.setHeader("Allow", "GET, POST, PUT");
    return json(response, 405, { error: "Method not allowed." });
  } catch (error) {
    const status = /invalid|requires|must|unique|HTTP|HTTPS|too large/i.test(error.message) ? 400 : 500;
    return json(response, status, { error: status === 400 ? error.message : "The conference catalog could not be saved." });
  }
};
