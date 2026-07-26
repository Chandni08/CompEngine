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

test("sidebar navigation scrolls directly and tracks the final page section", () => {
  assert.match(app, /target\.scrollIntoView\(\{ behavior, block: "start" \}\)/);
  assert.doesNotMatch(app, /navigationScrollFrame/);
  assert.match(app, /const atDocumentEnd = window\.scrollY \+ window\.innerHeight/);
  assert.match(app, /setActiveSectionNav\(rendered\[rendered\.length - 1\]\.target\.id\)/);
});

test("desktop rail stays stable while responsive navigation collapses", () => {
  assert.match(baseCss, /\.sidebar\s*\{[\s\S]*?overflow:\s*hidden;[\s\S]*?z-index:\s*50;/);
  assert.match(baseCss, /\.source-summary\s*\{[\s\S]*?overflow-y:\s*auto;[\s\S]*?overscroll-behavior:\s*contain;/);
  assert.match(css, /@media \(max-width: 1180px\)[\s\S]*?\.sidebar\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto;/);
  assert.match(css, /\.sidebar\.is-navigation-open \.sidebar-navigation-panel\s*\{[\s\S]*?max-height:\s*calc\(100dvh - 96px\);/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?\.section-nav-groups\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\);/);
});

test("sidebar fixes ship identically", () => {
  assert.equal(deployHtml, html);
  assert.equal(deployApp, app);
  assert.equal(deployCss, css);
  assert.equal(deployBaseCss, baseCss);
});
