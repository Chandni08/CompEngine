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

test("customer voice summary uses one source-count-driven strength badge", () => {
  assert.match(app, /function customerVoiceEvidenceStrengthBadge\(sourceCount\)/);
  assert.match(app, /count >= 3[\s\S]*?label: "Pattern"/);
  assert.match(app, /count === 2[\s\S]*?label: "Directional"/);
  assert.match(app, /count === 1[\s\S]*?label: "Anecdotal"/);
  assert.match(app, /\$\{count\} independent source/);
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

test("summary cards retain a demoted prevalence caveat", () => {
  assert.match(app, /class="summary-insight-caveat"/);
  assert.match(app, /Public-source recurrence does not establish prevalence or market-wide sentiment\./);
  assert.match(css, /\.summary-insight-caveat \{/);
  assert.match(css, /\.customer-voice-strength-badge\.pattern \{/);
});

test("customer voice summary badge changes ship identically", () => {
  assert.equal(deployApp, app);
  assert.equal(deployCss, css);
});
