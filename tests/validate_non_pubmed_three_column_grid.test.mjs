import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../product-ui.css", import.meta.url), "utf8");
const deployCss = await readFile(new URL("../deploy-site/product-ui.css", import.meta.url), "utf8");

test("observed non-PubMed topics use three desktop columns", () => {
  assert.match(css, /\.non-pubmed-signal-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
});

test("observed non-PubMed topics remain responsive", () => {
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.non-pubmed-signal-grid\s*\{[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?\.non-pubmed-signal-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
});

test("non-PubMed topic layout ships identically", () => {
  assert.equal(deployCss, css);
});
