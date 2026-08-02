import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../product-ui.css", import.meta.url), "utf8");
const deployApp = fs.readFileSync(new URL("../deploy-site/app.js", import.meta.url), "utf8");
const deployCss = fs.readFileSync(new URL("../deploy-site/product-ui.css", import.meta.url), "utf8");
const intelligence = fs.readFileSync(new URL("../data/intelligence.json", import.meta.url), "utf8");
const deployIntelligence = fs.readFileSync(new URL("../deploy-site/data/intelligence.json", import.meta.url), "utf8");

test("each purchase-driving theme links pain to validation and a named roadmap decision", () => {
  for (const theme of ["method-transfer", "troubleshooting-recovery", "data-export-portability", "workflow-setup"]) {
    const themeStart = app.indexOf(`key: "${theme}"`);
    assert.notEqual(themeStart, -1, `${theme} must remain configured`);
    const themeBlock = app.slice(themeStart, app.indexOf("},\n  },", themeStart) + 6);
    assert.match(themeBlock, /pain:/, `${theme} needs a pain statement`);
    assert.match(themeBlock, /validationStep:/, `${theme} needs a validation step`);
    assert.match(themeBlock, /roadmapDecision:/, `${theme} needs a roadmap decision`);
  }
});

test("purchase-driving themes feed named decisions without deadline labels", () => {
  for (const theme of ["method-transfer", "troubleshooting-recovery", "data-export-portability", "workflow-setup"]) {
    const themeStart = app.indexOf(`key: "${theme}"`);
    const nextTheme = app.indexOf("\n  {", themeStart + 10);
    const themeBlock = app.slice(themeStart, nextTheme === -1 ? themeStart + 2200 : nextTheme);
    assert.doesNotMatch(themeBlock, /\bdue\s*:/i);
  }
  assert.match(app, /<span>Open decision →<\/span>/);
  assert.doesNotMatch(app, /<span>Due \$\{/);
});

test("decision data and renderers contain no decision deadlines", () => {
  for (const source of [app, deployApp]) {
    assert.doesNotMatch(source, /<dt>Decision due<\/dt>/);
    assert.doesNotMatch(source, /recommendation\.decisionDue/);
  }
  for (const source of [intelligence, deployIntelligence]) {
    assert.doesNotMatch(source, /"decisionDue"/);
    assert.doesNotMatch(source, /\b(?:due|before) August (?:7|14|21)(?:, 2026)?\b/i);
    assert.doesNotMatch(source, /\bBy August (?:7|14|21), 2026\b/);
  }
});

test("roadmap inputs expose recurrence, validation, and decision navigation", () => {
  assert.match(app, /Roadmap Decision Inputs/);
  assert.match(app, /Pain → validation step → decision/);
  assert.match(app, /class="customer-roadmap-decision-link" href="#decisions-needed"/);
  assert.match(app, /independent source/);
  assert.match(css, /\.customer-roadmap-input\s*\{[\s\S]*?grid-template-columns:/);
});

test("roadmap recurrence counts link to all exact sources for their theme", () => {
  assert.match(app, /class="customer-theme-recurrence customer-theme-source-link/);
  assert.match(app, /href="#customer-voice"[\s\S]*data-customer-theme-sources="\$\{escapeHtml\(row\.theme\.key\)\}"/);
  assert.match(app, /companySelected[\s\S]*groupCustomerVoiceEvidenceMappings/);
  assert.match(css, /\.customer-theme-source-link\s*\{/);
});

test("zero-source recurrence counts are text, not empty source links", () => {
  assert.match(app, /row\.sourceCount > 0 \? `/);
  assert.match(app, /<span class="customer-theme-recurrence \$\{escapeHtml\(recurrence\.className\)\}">[\s\S]*?<strong>0 independent sources<\/strong>/);
});

test("deployment mirror matches the decision-input implementation", () => {
  assert.equal(deployApp, app);
  assert.equal(deployCss, css);
});
