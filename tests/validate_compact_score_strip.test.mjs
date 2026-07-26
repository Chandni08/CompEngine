import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const deployCss = readFileSync(new URL("../deploy-site/styles.css", import.meta.url), "utf8");

test("score drivers use a compact single-strip treatment", () => {
  assert.match(css, /\.score-driver-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)[\s\S]*?border-radius:\s*10px/);
  assert.match(css, /\.score-driver-card\s*\{[\s\S]*?display:\s*flex[\s\S]*?min-height:\s*42px[\s\S]*?background:\s*transparent/);
  assert.match(css, /\.score-driver-card span\s*\{[\s\S]*?order:\s*-1/);
});

test("compact score strip becomes a vertical list on small screens", () => {
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*?\.score-driver-grid\s*\{\s*grid-template-columns:\s*1fr/);
});

test("compact score-strip styles ship identically", () => {
  assert.equal(deployCss, css);
});
