import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceCssUrl = new URL("../conference-page.css", import.meta.url);
const deployCssUrl = new URL("../deploy-site/conference-page.css", import.meta.url);

test("conference page fills the viewport beside its fixed desktop sidebar", async () => {
  const css = await readFile(sourceCssUrl, "utf8");

  assert.doesNotMatch(css, /max-width:\s*1740px/);
  assert.match(css, /\.conference-page-shell\s*\{[^}]*width:\s*calc\(100% - 238px\)/s);
  assert.match(css, /\.conference-page-shell\s*\{[^}]*min-width:\s*0/s);
  assert.match(css, /\.conference-page-shell\s*\{[^}]*max-width:\s*none/s);
});

test("conference page returns to a full-width flow at the tablet breakpoint", async () => {
  const css = await readFile(sourceCssUrl, "utf8");
  const tabletRules = css.match(/@media \(max-width: 1120px\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";

  assert.match(tabletRules, /\.conference-sidebar\s*\{[^}]*position:\s*static/s);
  assert.match(tabletRules, /\.conference-page-shell\s*\{[^}]*width:\s*100%[^}]*margin-left:\s*0/s);
});

test("source and deploy conference styles stay synchronized", async () => {
  const [sourceCss, deployCss] = await Promise.all([
    readFile(sourceCssUrl, "utf8"),
    readFile(deployCssUrl, "utf8"),
  ]);

  assert.equal(deployCss, sourceCss);
});
