import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

function assertBalancedCssBlocks(source, label) {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  let quote = "";
  let escaped = false;
  let depth = 0;

  for (const character of withoutComments) {
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    assert.ok(depth >= 0, `${label} closes a CSS block that was never opened`);
  }

  assert.equal(quote, "", `${label} contains an unterminated string`);
  assert.equal(depth, 0, `${label} contains an unclosed CSS block`);
}

test("production stylesheets contain balanced CSS blocks", async () => {
  const paths = [
    "../styles.css",
    "../product-ui.css",
    "../conference-page.css",
    "../publication-page.css",
    "../deploy-site/styles.css",
    "../deploy-site/product-ui.css",
    "../deploy-site/conference-page.css",
    "../deploy-site/publication-page.css",
  ];

  for (const path of paths) {
    assertBalancedCssBlocks(await read(path), path);
  }
});

test("dashboard panels contain mobile-safe headers, actions, and wide data regions", async () => {
  const [html, app, styles, productStyles] = await Promise.all([
    read("../index.html"),
    read("../app.js"),
    read("../styles.css"),
    read("../product-ui.css"),
  ]);

  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1\.0"/);
  assert.match(productStyles, /@media \(max-width: 720px\)[\s\S]*?\.app-shell \.panel > \.panel-header\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s);
  assert.match(productStyles, /#leadershipDecisionCount::after\s*\{[^}]*content:\s*attr\(data-mobile-label\)/s);
  assert.match(productStyles, /#exportLeadershipPptx::after\s*\{[^}]*content:\s*"PowerPoint"/s);
  assert.match(app, /class="gap-grid-scroll"[^>]*aria-label="Scrollable competitor capability heatmap"/);
  assert.match(styles, /\.feature-gap-matrix\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)[^}]*overflow:\s*visible/s);
  assert.match(styles, /\.gap-grid-scroll\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(productStyles, /@media \(max-width: 720px\)[\s\S]*?\.capability-heatmap-row\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/s);
});

test("conference and publication subpages retain responsive breakpoints", async () => {
  const [conferenceHtml, conferenceStyles, publicationHtml, publicationStyles] = await Promise.all([
    read("../conference.html"),
    read("../conference-page.css"),
    read("../publications.html"),
    read("../publication-page.css"),
  ]);

  assert.match(conferenceHtml, /<meta name="viewport" content="width=device-width, initial-scale=1\.0"/);
  assert.match(publicationHtml, /<meta name="viewport" content="width=device-width, initial-scale=1\.0"/);
  assert.match(conferenceStyles, /@media \(max-width: 620px\)[\s\S]*?\.conference-filter-bar,[\s\S]*?\.conference-stat-grid\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/s);
  assert.match(publicationStyles, /@media \(max-width: 700px\)[\s\S]*?\.publication-pace-name strong\s*\{[^}]*white-space:\s*normal[^}]*overflow-wrap:\s*anywhere/s);
});

test("responsive source and deploy assets stay synchronized", async () => {
  const pairs = [
    ["../app.js", "../deploy-site/app.js"],
    ["../styles.css", "../deploy-site/styles.css"],
    ["../product-ui.css", "../deploy-site/product-ui.css"],
    ["../publication-page.css", "../deploy-site/publication-page.css"],
  ];

  for (const [sourcePath, deployPath] of pairs) {
    const [source, deploy] = await Promise.all([read(sourcePath), read(deployPath)]);
    assert.equal(deploy, source, `${deployPath} must match ${sourcePath}`);
  }
});
