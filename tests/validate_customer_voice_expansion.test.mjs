import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const customerVoice = JSON.parse(await readFile(new URL("../data/customer_voice.json", import.meta.url), "utf8"));
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

function inOneYear(dateValue) {
  const end = new Date(`${customerVoice.asOfDate}T23:59:59Z`);
  const start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - 1);
  const date = new Date(`${dateValue}T00:00:00Z`);
  return date >= start && date <= end;
}

test("customer voice includes at least nineteen independent customer sources in the one-year view", () => {
  const urls = new Set(
    customerVoice.feedback.flatMap((item) =>
      (item.evidenceRecords || []).filter((record) => inOneYear(record.sourceDate)).map((record) => record.url),
    ),
  );
  assert.ok(urls.size >= 19, `expected at least 19 unique independent customer sources, found ${urls.size}`);
});

test("customer voice evidence cards use the compact signal-first format", () => {
  assert.match(app, /customer-source-card-topline/);
  assert.match(app, /data-company-voice-sources/);
  assert.match(app, /companyVoiceEvidenceGroups/);
  assert.doesNotMatch(app, /<strong>Mapped summaries:<\/strong>/);
  assert.doesNotMatch(app, /<b>Mapped themes:<\/b>/);
  assert.match(app, /unique exact source/);
});
