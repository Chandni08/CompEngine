import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../product-ui.css", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("leadership brief actions remain in one row", () => {
  const ruleStart = css.lastIndexOf("/* Leadership brief controls stay in one predictable action row. */");
  const rules = css.slice(ruleStart);

  assert.match(rules, /\.decision-packet \.panel-header-actions\s*\{[\s\S]*display:\s*flex/);
  assert.match(rules, /flex-wrap:\s*nowrap/);
  assert.match(rules, /grid-template-columns:\s*none/);
  assert.match(rules, /\.panel-header-actions > span,[\s\S]*\.panel-header-actions > button[\s\S]*white-space:\s*nowrap/);
});

test("leadership brief header has no subtitle", () => {
  assert.doesNotMatch(html, /Highest-confidence decision, supporting signal, competitor direction, and evidence gate\./);
});
