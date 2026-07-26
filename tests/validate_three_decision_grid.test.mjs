import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../product-ui.css", import.meta.url), "utf8");

test("Decisions needed uses three columns on wide screens", () => {
  assert.match(css, /\.decision-queue\s*\{\s*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/s);
});

test("decision columns step down responsively", () => {
  assert.match(css, /@media \(max-width: 1100px\)[\s\S]*?\.decision-queue\s*\{\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*?\.decision-queue\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
});
