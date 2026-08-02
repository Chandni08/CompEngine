import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [app, css, deployApp, deployCss] = await Promise.all([
  read("app.js"),
  read("product-ui.css"),
  read("deploy-site/app.js"),
  read("deploy-site/product-ui.css"),
]);

test("customer voice summary capsules show source counts without tier words", () => {
  assert.match(app, /function customerVoiceEvidenceStrengthBadge\(sourceCount\)/);
  assert.match(app, /count >= 3 \? "pattern" : count === 2 \? "directional" : count === 1 \? "anecdotal" : "none"/);
  assert.match(app, /\$\{count\} independent source/);
  const badgeRenderer = app.slice(app.indexOf("function customerVoiceEvidenceStrengthBadge"), app.indexOf("function customerVoiceCategorySourceCounts"));
  assert.doesNotMatch(badgeRenderer, />Pattern<|>Directional<|>Anecdotal<|>No evidence</);
  assert.match(app, /customerVoiceEvidenceStrengthBadge\(topBuying\.sourceCount\)/);
  assert.match(app, /customerVoiceEvidenceStrengthBadge\(sourceCount\)/);
});

test("summary headlines state the finding rather than the evidence tier", () => {
  const renderer = app.slice(
    app.indexOf("function renderCustomerVoiceSummary"),
    app.indexOf("function renderCustomerVoicePainPoints"),
  );
  assert.match(renderer, /is the leading observed strength/);
  assert.match(renderer, /is the leading concern in current sources/);
  assert.match(renderer, /is the leading buying consideration/);
  assert.doesNotMatch(renderer, /has anecdotal support/);
  assert.doesNotMatch(renderer, /is an emerging signal/);
});

test("summary promotes only findings corroborated by at least two independent sources", () => {
  const renderer = app.slice(
    app.indexOf("function renderCustomerVoiceSummary"),
    app.indexOf("function renderCustomerVoicePainPoints"),
  );
  assert.match(app, /const customerVoiceSummaryMinimumIndependentSources = 2;/);
  assert.match(app, /sourceCount >= customerVoiceSummaryMinimumIndependentSources/);
  assert.match(renderer, /customerVoiceSubstantiatedCategoryCounts\(positives, "category"\)/);
  assert.match(renderer, /customerVoiceSubstantiatedCategoryCounts\(concernItems, "category"\)/);
  assert.match(renderer, /customerVoiceSubstantiatedCategoryCounts\(items, "buyingPriority"\)/);
  assert.match(renderer, /topPositive \? \{/);
  assert.match(renderer, /topConcern \? \{/);
  assert.doesNotMatch(renderer, /No positive finding is established/);
});

test("summary cards omit the removed prevalence caveat", () => {
  assert.doesNotMatch(app, /class="summary-insight-caveat"/);
  assert.doesNotMatch(app, /Public-source recurrence does not establish prevalence or market-wide sentiment\./);
  assert.match(css, /\.customer-voice-strength-badge\.pattern \{/);
});

test("customer voice summary badge changes ship identically", () => {
  assert.equal(deployApp, app);
  assert.equal(deployCss, css);
});
