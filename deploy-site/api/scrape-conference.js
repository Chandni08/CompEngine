const dns = require("node:dns").promises;
const net = require("node:net");

const MAX_RESPONSE_BYTES = 2_000_000;
const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};
const MONTH_PATTERN = Object.keys(MONTHS).join("|");

function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  const normalized = address.toLowerCase();
  return normalized === "::1" || normalized === "::" || normalized.startsWith("fc")
    || normalized.startsWith("fd") || normalized.startsWith("fe8")
    || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb");
}

async function validatedUrl(value) {
  const url = new URL(String(value || ""));
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only HTTP and HTTPS event URLs are supported.");
  if (url.username || url.password) throw new Error("Event URLs cannot contain credentials.");
  if (url.port && !["80", "443"].includes(url.port)) throw new Error("Unsupported event URL port.");
  if (url.hostname === "localhost" || url.hostname.endsWith(".local")) throw new Error("Private event URLs are not supported.");
  if (net.isIP(url.hostname)) {
    if (isPrivateAddress(url.hostname)) throw new Error("Private event URLs are not supported.");
  } else {
    const addresses = await dns.lookup(url.hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
      throw new Error("The event URL did not resolve to a public host.");
    }
  }
  return url;
}

async function fetchOfficialPage(initialUrl) {
  let url = await validatedUrl(initialUrl);
  for (let redirectCount = 0; redirectCount < 5; redirectCount += 1) {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "User-Agent": "Waters-Conference-Intelligence/1.0 (+https://waters-nextgen-competitive-engine.vercel.app)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("The official event page returned an invalid redirect.");
      url = await validatedUrl(new URL(location, url).href);
      continue;
    }
    if (!response.ok) throw new Error(`The official event page returned HTTP ${response.status}.`);
    const contentType = response.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) throw new Error("The official event URL is not an HTML page.");
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_RESPONSE_BYTES) throw new Error("The official event page is too large to inspect safely.");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_RESPONSE_BYTES) throw new Error("The official event page is too large to inspect safely.");
    return { html: bytes.toString("utf8"), finalUrl: url.href };
  }
  throw new Error("The official event page redirected too many times.");
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
}

function textContent(html) {
  return decodeHtml(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function metaContent(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const direct = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i").exec(html);
  const reverse = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, "i").exec(html);
  return decodeHtml(direct?.[1] || reverse?.[1] || "");
}

function pageTitle(html) {
  return metaContent(html, "og:title") || decodeHtml(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || "").replace(/\s+/g, " ").trim();
}

function likelyDatePages(html, baseUrl) {
  const base = new URL(baseUrl);
  const scored = [];
  for (const match of html.matchAll(/<a\b[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const url = new URL(decodeHtml(match[1]), base);
      if (url.origin !== base.origin || !["http:", "https:"].includes(url.protocol)) continue;
      const label = textContent(match[2]).toLowerCase();
      const haystack = `${url.pathname} ${label}`;
      const score = /program|agenda|schedule/.test(haystack) ? 3 : /event|conference|about/.test(haystack) ? 2 : /register/.test(haystack) ? 1 : 0;
      if (score) scored.push({ url: url.href, score });
    } catch { /* ignore malformed publisher links */ }
  }
  return [...new Map(scored.sort((a, b) => b.score - a.score).map((item) => [item.url, item])).values()].slice(0, 4);
}

function eventJsonLd(html) {
  const objects = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { objects.push(JSON.parse(decodeHtml(match[1]))); } catch { /* malformed publisher JSON-LD */ }
  }
  const queue = [...objects];
  while (queue.length) {
    const value = queue.shift();
    if (Array.isArray(value)) { queue.push(...value); continue; }
    if (!value || typeof value !== "object") continue;
    const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
    if (types.some((type) => String(type).toLowerCase() === "event")) return value;
    if (value["@graph"]) queue.push(value["@graph"]);
  }
  return null;
}

function isoDate(value) {
  const raw = String(value || "").trim();
  const exact = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (exact) return `${exact[1]}-${exact[2]}-${exact[3]}`;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function makeIsoDate(year, month, day) {
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return "";
  return date.toISOString().slice(0, 10);
}

function textDateCandidates(text) {
  const candidates = [];
  const monthRange = new RegExp(`\\b(${MONTH_PATTERN})\\s+(\\d{1,2})(?:\\s*(?:-|–|—|to)\\s*(?:(${MONTH_PATTERN})\\s+)?(\\d{1,2}))?,?\\s+(20\\d{2})\\b`, "gi");
  for (const match of text.matchAll(monthRange)) {
    const start = makeIsoDate(match[5], MONTHS[match[1].toLowerCase()], match[2]);
    const end = makeIsoDate(match[5], MONTHS[(match[3] || match[1]).toLowerCase()], match[4] || match[2]);
    if (start && end) candidates.push({ startDate: start, endDate: end });
  }
  const numericRange = /\b(\d{1,2})\/(\d{1,2})\/(20\d{2})(?:\s*(?:-|–|—|to)\s*(?:(\d{1,2})\/(\d{1,2})\/(20\d{2})|([A-Za-z]+)\s+(\d{1,2}),?\s+(20\d{2})))?/g;
  for (const match of text.matchAll(numericRange)) {
    const start = makeIsoDate(match[3], match[1], match[2]);
    const end = match[4]
      ? makeIsoDate(match[6], match[4], match[5])
      : match[7] && MONTHS[match[7].toLowerCase()]
        ? makeIsoDate(match[9], MONTHS[match[7].toLowerCase()], match[8])
        : start;
    if (start && end) candidates.push({ startDate: start, endDate: end });
  }
  return candidates;
}

function bestTextDate(text) {
  const today = new Date().toISOString().slice(0, 10);
  const unique = [...new Map(textDateCandidates(text).map((item) => [`${item.startDate}:${item.endDate}`, item])).values()];
  return unique.filter((item) => item.endDate >= today).sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
    || unique.sort((a, b) => b.endDate.localeCompare(a.endDate))[0]
    || null;
}

function locationText(location) {
  if (!location) return "";
  if (typeof location === "string") return location;
  const address = location.address || location;
  return [location.name, address.addressLocality, address.addressRegion, address.addressCountry].filter(Boolean).join(", ");
}

function formattedDateRange(startDate, endDate) {
  const start = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate || startDate}T12:00:00Z`);
  const startLabel = start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const endLabel = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return startDate === endDate ? end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : `${startLabel}–${endLabel}`;
}

function inferredDimensions(text) {
  const lower = text.toLowerCase();
  const markets = [
    [/biopharma|biotech|biotechnology/, "Biopharma"], [/\bpharma|pharmaceutical/, "Pharma"],
    [/environment|pfas/, "Environmental"], [/clinical|diagnostic/, "Clinical"], [/academic|university/, "Academic"],
  ].filter(([pattern]) => pattern.test(lower)).map(([, label]) => label);
  const technologies = [
    [/\blc[- ]?ms\b|liquid chromatography.{0,12}mass spect/, "LC-MS"], [/mass spectrom/, "Mass spectrometry"],
    [/\bai\b|artificial intelligence/, "AI"], [/data|analytics/, "Data"], [/automation/, "Automation"],
    [/informatics|software/, "Informatics"], [/oligonucleotide/, "Oligonucleotides"], [/\blnp\b/, "LNP"], [/\bmrna\b/, "mRNA"],
  ].filter(([pattern]) => pattern.test(lower)).map(([, label]) => label);
  return { marketSegments: [...new Set(markets)], technologyFocus: [...new Set(technologies)] };
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") return response.status(405).json({ error: "Use POST with an official event URL." });
  try {
    const sourceUrl = request.body?.url;
    if (!sourceUrl || String(sourceUrl).length > 2048) throw new Error("Enter a valid official event URL.");
    const landingPage = await fetchOfficialPage(sourceUrl);
    let evidencePage = landingPage;
    let event = eventJsonLd(evidencePage.html);
    let visibleText = textContent(evidencePage.html).slice(0, 180_000);
    let fallbackDate = bestTextDate(`${pageTitle(evidencePage.html)} ${metaContent(evidencePage.html, "description")} ${visibleText}`);
    let startDate = isoDate(event?.startDate) || fallbackDate?.startDate || "";
    let endDate = isoDate(event?.endDate || event?.startDate) || fallbackDate?.endDate || startDate;
    if (!startDate) {
      for (const candidate of likelyDatePages(landingPage.html, landingPage.finalUrl)) {
        try {
          const page = await fetchOfficialPage(candidate.url);
          const pageEvent = eventJsonLd(page.html);
          const pageText = textContent(page.html).slice(0, 180_000);
          const pageFallback = bestTextDate(`${pageTitle(page.html)} ${metaContent(page.html, "description")} ${pageText}`);
          const pageStart = isoDate(pageEvent?.startDate) || pageFallback?.startDate || "";
          if (!pageStart) continue;
          evidencePage = page;
          event = pageEvent;
          visibleText = pageText;
          fallbackDate = pageFallback;
          startDate = pageStart;
          endDate = isoDate(pageEvent?.endDate || pageEvent?.startDate) || pageFallback?.endDate || pageStart;
          break;
        } catch { /* try the next same-site date page */ }
      }
    }
    if (!startDate) return response.status(422).json({ error: "No event date could be verified on the official page." });
    const dimensions = inferredDimensions(`${pageTitle(evidencePage.html)} ${metaContent(evidencePage.html, "description")} ${visibleText.slice(0, 40_000)}`);
    return response.status(200).json({
      title: String(event?.name || pageTitle(evidencePage.html) || "").replace(/\s+/g, " ").trim(),
      sourceUrl: landingPage.finalUrl,
      evidenceUrl: evidencePage.finalUrl,
      startDate,
      endDate,
      dateRange: formattedDateRange(startDate, endDate),
      location: locationText(event?.location),
      ...dimensions,
      scrapedAt: new Date().toISOString(),
    });
  } catch (error) {
    return response.status(400).json({ error: error.message || "The official event page could not be inspected." });
  }
};
