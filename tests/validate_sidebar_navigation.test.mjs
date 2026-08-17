import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [html, deployHtml, app, deployApp, css, deployCss, baseCss, deployBaseCss] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../deploy-site/index.html", import.meta.url), "utf8"),
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../deploy-site/app.js", import.meta.url), "utf8"),
  readFile(new URL("../product-ui.css", import.meta.url), "utf8"),
  readFile(new URL("../deploy-site/product-ui.css", import.meta.url), "utf8"),
  readFile(new URL("../styles.css", import.meta.url), "utf8"),
  readFile(new URL("../deploy-site/styles.css", import.meta.url), "utf8"),
]);

test("sidebar navigation has an accessible responsive toggle", () => {
  assert.match(html, /id="sidebarNavigationToggle"[^>]*aria-expanded="false"[^>]*aria-controls="sidebarNavigationPanel"/);
  assert.match(html, /id="sidebarNavigationPanel" class="sidebar-navigation-panel"/);
  assert.match(app, /function setupSidebarNavigation\(\)/);
  assert.match(app, /event\.key !== "Escape"/);
  assert.match(app, /setSidebarNavigationOpen\(false\);\s*\n\s*navigateToDashboardSection\(targetId\)/);
});

test("sidebar navigation uses transition-safe scrolling and tracks the final page section", () => {
  assert.match(app, /const MINIMUM_SECTION_ANCHOR_OFFSET = 96;/);
  assert.match(app, /return Math\.max\(MINIMUM_SECTION_ANCHOR_OFFSET, configuredOffset\);/);
  assert.match(app, /const anchorOffset = Math\.max\(\s*MINIMUM_SECTION_ANCHOR_OFFSET,\s*stickyHeight \+ stickySidebarHeight \+ 24,/);
  assert.match(app, /let navigationTransitionToken = 0;/);
  assert.match(app, /const transitionToken = \+\+navigationTransitionToken;/);
  assert.match(app, /target\.scrollIntoView\(\{ behavior, block: "start" \}\)/);
  assert.match(app, /lockActiveSectionNav\(targetId, transitionToken, 0\)/);
  assert.match(app, /scrollToDashboardSection\(target, behavior\);\s*\n\s*lockActiveSectionNav/);
  assert.match(app, /releaseActiveSectionNavLock\(navigationTransitionToken, \{ onlyIfSettled: true \}\)/);
  assert.match(app, /Math\.abs\(target\.getBoundingClientRect\(\)\.top - sectionAnchorOffset\(\)\) <= 8/);
  assert.match(app, /const atDocumentEnd = window\.scrollY \+ window\.innerHeight/);
  assert.match(app, /setActiveSectionNav\(rendered\[rendered\.length - 1\]\.target\.id\)/);
});

test("Analysis sidebar tabs follow their top-to-bottom page order", () => {
  const analysisGroup = html.match(/<div class="section-nav-group">\s*<span>Analysis<\/span>([\s\S]*?)<\/div>/)?.[1] || "";
  const navOrder = [...analysisGroup.matchAll(/data-section-nav="([^"]+)"/g)].map((match) => match[1]);
  const pageOrder = [...navOrder].sort(
    (left, right) => html.indexOf(`<section id="${left}"`) - html.indexOf(`<section id="${right}"`),
  );

  assert.deepEqual(navOrder, [
    "customer-voice",
    "product-comparator",
    "competitive-timeline-section",
    "application-trends",
  ]);
  assert.deepEqual(navOrder, pageOrder);
});

test("every standard sidebar panel follows the same top-to-bottom page order", () => {
  const standardNavigation = html.match(/id="standardSectionNavigation"[\s\S]*?<div id="marketingSectionNavigation"/)?.[0] || "";
  const main = html.slice(html.indexOf("<main"));
  const navOrder = [...standardNavigation.matchAll(/data-section-nav="([^"]+)"/g)].map((match) => match[1]);
  const pageOrder = [...navOrder].sort(
    (left, right) => main.indexOf(`id="${left}"`) - main.indexOf(`id="${right}"`),
  );

  assert.deepEqual(navOrder, [
    "leadership-brief",
    "overall-trend-analysis",
    "competitor-intent-section",
    "decisions-needed",
    "customer-voice",
    "product-comparator",
    "competitive-timeline-section",
    "application-trends",
    "patent-filing-insights",
    "leadership-behavior-profiles",
    "competitor-hiring-patterns",
    "filing-evidence",
    "official-newsroom-corporate-moves",
    "evidence-signal-feed",
  ]);
  assert.deepEqual(navOrder, pageOrder);
});

test("desktop rail stays stable while responsive navigation collapses", () => {
  assert.match(baseCss, /\.sidebar\s*\{[\s\S]*?overflow:\s*hidden;[\s\S]*?z-index:\s*50;/);
  assert.match(baseCss, /\.source-summary\s*\{[\s\S]*?overflow-y:\s*auto;[\s\S]*?overscroll-behavior:\s*contain;/);
  assert.match(css, /@media \(max-width: 1180px\)[\s\S]*?\.sidebar\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto;/);
  assert.match(css, /@media \(max-width: 1180px\)[\s\S]*?\.sidebar-navigation-panel\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?top:\s*100%;/);
  assert.match(css, /\.sidebar\.is-navigation-open \.sidebar-navigation-panel\s*\{[\s\S]*?max-height:\s*calc\(100dvh - 96px\);/);
  assert.match(css, /\.filters\s*\{\s*position:\s*static;\s*top:\s*auto;/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?\.section-nav-groups\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\);/);
});

test("sidebar fixes ship identically", () => {
  assert.equal(deployHtml, html);
  assert.equal(deployApp, app);
  assert.equal(deployCss, css);
  assert.equal(deployBaseCss, baseCss);
});
