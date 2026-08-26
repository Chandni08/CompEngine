import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [app, html, css] = await Promise.all([
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../product-ui.css", import.meta.url), "utf8"),
]);

test("the customer voice summary leads with the company-grouped view", () => {
  const matrixTitle = html.indexOf("Customer Voice by Company");
  const sentimentTitle = html.indexOf("Evidence Classification");
  assert.ok(matrixTitle > -1 && sentimentTitle > -1);
  assert.ok(matrixTitle < sentimentTitle, "company view should appear before sentiment totals");
  assert.match(app, /class="intent-master-detail company-voice-master-detail"/);
  assert.doesNotMatch(html, />Purchase-Driving Themes<\/h4>/);
});

test("company cards separate strengths, concerns, and PM implications", () => {
  assert.match(app, /const positiveItems = companyItems\.filter\(\(item\) => item\.sentiment === "Positive"\)/);
  assert.match(app, /const concernItems = companyItems/);
  assert.match(app, /What Customers Value/);
  assert.match(app, /Pain Points and Unmet Needs/);
  assert.match(app, /Waters PM Opportunity/);
});

test("company source drill-down admits only exact sources with verified company wording", () => {
  assert.match(app, /function companyVoiceEvidenceGroups\(company, companyItems\)/);
  assert.match(app, /link\?\.status !== "exact_record"/);
  assert.match(app, /const verifiedWording = \(link\.sourceKeywords \|\| \[\]\)\.join\(" "\)\.toLowerCase\(\)/);
  assert.match(app, /identityTerms\.some\(\(term\) => verifiedWording\.includes\(term\)\)/);
});

test("the company view ignores only the competitor filter", () => {
  assert.match(app, /customerVoiceItemsForHorizon\(filters\.horizon\.value, \{ ignoreCompetitor: true \}\)/);
  assert.match(app, /ignoreCompetitor \|\| competitorMatchesFilter\(item\.company\)/);
});

test("company cards are compact and responsive", () => {
  assert.match(css, /\.company-voice-card\s*\{[\s\S]*?padding:\s*12px/);
  assert.match(css, /\.company-voice-selected-detail\s*\{[\s\S]*?align-self:\s*start;[\s\S]*?align-content:\s*start;/);
  assert.match(css, /\.company-voice-insight-grid\s*\{[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*?\.company-voice-insight-grid/);
});

test("recurrence uses unique source pages and honest evidence thresholds", () => {
  assert.match(app, /function customerVoiceRecurrence\(sourceCount\)/);
  assert.match(app, /sourceCount >= 3[\s\S]*?className: "pattern"/);
  assert.match(app, /sourceCount === 2[\s\S]*?className: "emerging"/);
  assert.match(app, /sourceCount === 1[\s\S]*?className: "anecdote"/);
  assert.match(app, /independent source/);
  const chartRenderer = app.slice(app.indexOf("function renderCustomerCompetitorChart"), app.indexOf("function renderCustomerVoiceSummary"));
  assert.doesNotMatch(chartRenderer, /recurrence\.label/);
});

test("customer voice omits the removed forum normalization caveat", () => {
  assert.doesNotMatch(html, /Public forums over-represent complaints; source volume shows recurrence, not comparative sentiment or product quality\./);
});

test("sentiment totals use independent sources instead of summary ratios", () => {
  assert.match(app, /<strong>\$\{sourceCount\}<\/strong>[\s\S]*?independent source/);
  assert.doesNotMatch(app, /\$\{positives\.length\}\/\$\{items\.length\} summaries positive/);
  assert.doesNotMatch(app, /\$\{negatives\.length \+ mixed\.length\}\/\$\{items\.length\} concern summaries/);
});

test("evidence classification is explained without presenting it as market sentiment", () => {
  assert.match(html, /Shows how reviewed sources were coded as favorable, mixed, or concern\. It does not measure market sentiment\./);
  assert.doesNotMatch(html, /Overall Evidence by Sentiment/);
  assert.match(app, /Favorable-coded evidence/);
  assert.doesNotMatch(app, /Strengths to protect/);
});
