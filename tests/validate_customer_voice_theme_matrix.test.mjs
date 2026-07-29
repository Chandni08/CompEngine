import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [app, html, css] = await Promise.all([
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../product-ui.css", import.meta.url), "utf8"),
]);

test("the customer voice summary leads with the four-theme comparison", () => {
  const matrixTitle = html.indexOf("Purchase-Driving Themes");
  const sentimentTitle = html.indexOf("Evidence Coding Diagnostic");
  assert.ok(matrixTitle > -1 && sentimentTitle > -1);
  assert.ok(matrixTitle < sentimentTitle, "theme matrix should appear before sentiment totals");
  assert.match(app, /customerVoicePurchaseThemes = \[/);
  assert.equal((app.match(/label: "(?:Method Transfer|Troubleshooting & Recovery Time|Data Export & Portability|Workflow Setup)"/g) || []).length, 4);
});

test("comparison cells distinguish evidence from absence of evidence", () => {
  assert.match(app, /No vendor-specific customer wording is validated in the current sources\./);
  assert.match(app, /const supportedItems = evidenceGroups\.length \? matchedItems : \[\]/);
  assert.match(app, /label: "No direct signal"/);
  assert.match(app, /companyVoiceEvidenceGroups\(company, matchedItems\)/);
});

test("the theme matrix ignores only the competitor filter", () => {
  assert.match(app, /customerVoiceItemsForHorizon\(filters\.horizon\.value, \{ ignoreCompetitor: true \}\)/);
  assert.match(app, /ignoreCompetitor \|\| filters\.competitor\.value === "All"/);
});

test("matrix is compact and screenshot-ready", () => {
  assert.match(css, /\.customer-theme-matrix\s*\{[\s\S]*?table-layout:\s*fixed/);
  assert.match(css, /\.customer-theme-cell p\s*\{[\s\S]*?font-size:\s*11px/);
  assert.match(css, /\.customer-theme-status\s*\{[\s\S]*?border-radius:\s*999px/);
});

test("recurrence uses unique source pages and honest evidence thresholds", () => {
  assert.match(app, /function customerVoiceRecurrence\(sourceCount\)/);
  assert.match(app, /sourceCount >= 3[\s\S]*?label: "Pattern"/);
  assert.match(app, /sourceCount === 2[\s\S]*?label: "Emerging signal"/);
  assert.match(app, /sourceCount === 1[\s\S]*?label: "Anecdote"/);
  assert.match(app, /customerVoiceRecurrence\(evidenceGroups\.length\)/);
  assert.match(app, /independent source/);
  assert.match(css, /\.customer-theme-recurrence\.pattern small/);
});

test("customer voice states the forum normalization caveat", () => {
  assert.match(html, /Public forums over-represent complaints; source volume shows recurrence, not comparative sentiment or product quality\./);
  assert.match(css, /\.customer-voice-normalization-note/);
});

test("sentiment totals use independent sources instead of summary ratios", () => {
  assert.match(app, /<strong>\$\{sourceCount\}<\/strong>[\s\S]*?independent source/);
  assert.doesNotMatch(app, /\$\{positives\.length\}\/\$\{items\.length\} summaries positive/);
  assert.doesNotMatch(app, /\$\{negatives\.length \+ mixed\.length\}\/\$\{items\.length\} concern summaries/);
});

test("sentiment coding is not presented as a headline market metric", () => {
  assert.match(html, /Source-coding quality check; not a market sentiment metric\./);
  assert.doesNotMatch(html, /Overall Evidence by Sentiment/);
  assert.match(app, /Favorable-coded evidence/);
  assert.doesNotMatch(app, /Strengths to protect/);
});
