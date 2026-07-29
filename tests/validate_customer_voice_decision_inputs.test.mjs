import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../product-ui.css", import.meta.url), "utf8");
const deployApp = fs.readFileSync(new URL("../deploy-site/app.js", import.meta.url), "utf8");
const deployCss = fs.readFileSync(new URL("../deploy-site/product-ui.css", import.meta.url), "utf8");

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

test("diagnostics and export feed the August 14 workflow-requirements decision", () => {
  for (const theme of ["troubleshooting-recovery", "data-export-portability"]) {
    const themeStart = app.indexOf(`key: "${theme}"`);
    const nextTheme = app.indexOf("\n  {", themeStart + 10);
    const themeBlock = app.slice(themeStart, nextTheme === -1 ? themeStart + 2200 : nextTheme);
    assert.match(themeBlock, /number:\s*1/);
    assert.match(themeBlock, /title:\s*"End-to-End Workflow Requirements"/);
    assert.match(themeBlock, /due:\s*"August 14, 2026"/);
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

test("deployment mirror matches the decision-input implementation", () => {
  assert.equal(deployApp, app);
  assert.equal(deployCss, css);
});
