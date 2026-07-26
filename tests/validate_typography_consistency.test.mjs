import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rootCss = await readFile(new URL("../product-ui.css", import.meta.url), "utf8");
const deployCss = await readFile(new URL("../deploy-site/product-ui.css", import.meta.url), "utf8");
const conferenceCss = await readFile(new URL("../conference-page.css", import.meta.url), "utf8");
const deployConferenceCss = await readFile(new URL("../deploy-site/conference-page.css", import.meta.url), "utf8");

test("source and deploy typography styles stay identical", () => {
  assert.equal(deployCss, rootCss);
  assert.equal(deployConferenceCss, conferenceCss);
});

test("section and subsection headings use the shared title hierarchy", () => {
  const sectionRule = rootCss.slice(rootCss.lastIndexOf(".app-shell .panel > .panel-header h3"));

  assert.match(sectionRule, /font-size:\s*var\(--type-section-title\)/);
  assert.match(sectionRule, /font-style:\s*normal/);
  assert.match(sectionRule, /font-weight:\s*700/);
  assert.match(sectionRule, /text-transform:\s*none/);
  assert.match(sectionRule, /\.app-shell \.mini-header h4[\s\S]*font-size:\s*var\(--type-subsection-title\)/);
  assert.match(sectionRule, /\.decision-evidence-header h3/);
});

test("conference page headings keep a logical normal-style hierarchy", () => {
  assert.match(conferenceCss, /\.conference-page-header h1[^}]*font-size:\s*clamp\(28px, 3vw, 42px\)/);
  assert.match(conferenceCss, /\.conference-section-header h2[^}]*font-size:\s*18px/);
  assert.match(conferenceCss, /\.event-detail-header h2[^}]*font-size:\s*clamp\(23px, 2\.3vw, 32px\)/);
  assert.match(conferenceCss, /\.event-theme-hero h3[^}]*font-size:\s*20px/);
  assert.match(conferenceCss, /\.content-card-heading h3[^}]*font-size:\s*15px/);
  assert.match(conferenceCss, /\.event-content-card h4[^}]*font-size:\s*12px/);
});

test("nested titles cannot grow larger than their parent section", () => {
  const tokens = rootCss.slice(rootCss.lastIndexOf("/* One predictable type scale"));

  assert.match(tokens, /--type-section-title:\s*22px/);
  assert.match(tokens, /--type-subsection-title:\s*19px/);
  assert.match(tokens, /--type-card-title:\s*17px/);
  assert.match(tokens, /\.app-shell section\.panel h4[\s\S]*font-size:\s*var\(--type-subsection-title\)/);
  assert.match(tokens, /\.app-shell section\.panel article h4,[\s\S]*font-size:\s*var\(--type-card-title\)/);
  assert.ok(tokens.indexOf(".app-shell section.panel article h4") > tokens.indexOf(".leadership-decision-card-header h4") || !tokens.includes(".leadership-decision-card-header h4"));
});

test("all panel subtitles override legacy italic section exceptions", () => {
  const legacyException = rootCss.lastIndexOf(".application-trends-panel .panel-subtitle");
  const sharedOverride = rootCss.lastIndexOf(".app-shell .panel .panel-header .panel-subtitle");
  const overrideRule = rootCss.slice(sharedOverride, rootCss.indexOf("}\n", sharedOverride) + 2);

  assert.ok(sharedOverride > legacyException, "shared subtitle style must follow legacy exceptions");
  assert.match(overrideRule, /margin:\s*0/);
  assert.match(overrideRule, /font-style:\s*normal/);
  assert.match(overrideRule, /font-weight:\s*400/);
  assert.match(overrideRule, /line-height:\s*1\.4/);
  assert.match(overrideRule, /text-transform:\s*none/);
});
