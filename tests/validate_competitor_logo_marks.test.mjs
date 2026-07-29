import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const deployApp = readFileSync(new URL("../deploy-site/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../product-ui.css", import.meta.url), "utf8");
const deployStyles = readFileSync(new URL("../deploy-site/product-ui.css", import.meta.url), "utf8");

test("competitor selector and selected-company header omit company logos", () => {
  assert.doesNotMatch(app, /competitorBrandLogos|competitorLogoMarkup|competitor-logo/);
  assert.doesNotMatch(styles, /\.competitor-logo/);
  assert.match(app, /<span class="intent-option-copy">/);
  assert.match(app, /<div class="intent-detail-title">/);
  assert.match(styles, /grid-template-columns: minmax\(0, 1fr\) auto;/);
});

test("logo-free competitor intent ships identically", () => {
  assert.equal(deployApp, app);
  assert.equal(deployStyles, styles);
});
