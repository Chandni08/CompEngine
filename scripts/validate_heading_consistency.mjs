import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MINOR_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "from",
  "in",
  "into",
  "nor",
  "of",
  "on",
  "or",
  "per",
  "the",
  "to",
  "via",
  "with",
]);

function plainText(value) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&[^;]+;/g, " ")
    .replace(/[↗→←]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstLetter(value) {
  return value.match(/[A-Za-z]/)?.[0] || "";
}

export function titleCaseErrors(label, value) {
  const title = plainText(value);
  const words = title.split(/\s+/).filter(Boolean);
  const errors = [];

  words.forEach((word, index) => {
    const normalized = word.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
    if (!normalized) return;

    const lower = normalized.toLowerCase();
    const isEdge = index === 0 || index === words.length - 1;
    if (MINOR_WORDS.has(lower) && !isEdge) {
      if (normalized !== lower) errors.push(`${label}: minor word “${word}” should be lowercase in “${title}”`);
      return;
    }

    const letter = firstLetter(normalized);
    const protectedMixedCase = /^[a-z][A-Z]/.test(normalized);
    if (letter && letter !== letter.toUpperCase() && !protectedMixedCase) {
      errors.push(`${label}: “${word}” should be capitalized in “${title}”`);
    }
  });

  return errors;
}

function literalHeadings(source) {
  return [...source.matchAll(/<h([1-6])\b[^>]*>([^<${}]+)<\/h\1>/g)].map((match) => ({
    level: match[1],
    text: match[2].trim(),
  }));
}

function structuralNavigationLabels(source) {
  const sectionLabels = [...source.matchAll(/<p\s+class="section-label">([^<]+)<\/p>/g)].map((match) => match[1]);
  const sectionLinks = [...source.matchAll(/<a\b[^>]*data-section-nav="[^"]+"[^>]*>([^<]+)<\/a>/g)].map((match) => match[1]);
  return [...sectionLabels, ...sectionLinks];
}

export function headingConsistencyErrors(files) {
  const errors = [];
  for (const [fileName, source] of Object.entries(files)) {
    for (const heading of literalHeadings(source)) {
      errors.push(...titleCaseErrors(`${fileName} h${heading.level}`, heading.text));
    }
  }

  for (const label of structuralNavigationLabels(files["index.html"] || "")) {
    errors.push(...titleCaseErrors("index.html navigation", label));
  }
  return errors;
}

async function validateCurrentSite() {
  const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const names = ["index.html", "app.js", "conference.html", "conference-page.js", "publications.html", "publication-page.js"];
  const files = Object.fromEntries(
    await Promise.all(names.map(async (name) => [name, await readFile(resolve(siteRoot, name), "utf8")])),
  );
  const errors = headingConsistencyErrors(files);
  if (errors.length) {
    throw new Error(`Heading consistency validation failed:\n- ${errors.join("\n- ")}`);
  }
  console.log(`Validated ${names.length} UI files: structural headings use consistent title case.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  validateCurrentSite().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
