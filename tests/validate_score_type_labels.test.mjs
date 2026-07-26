import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

test("recommendation score pills identify priority scores without narrative labels", () => {
  assert.match(app, /Priority score · \$\{breakdown\.total\}\/100/g);
  assert.doesNotMatch(app, /\$\{escapeHtml\(tone\.label\)\} · \$\{breakdown\.total\}\/100/);
  assert.doesNotMatch(app, /\$\{tone\.label\} · \$\{breakdown\.total\}\/100/);
});

test("competitor profile score pills identify confidence scores", () => {
  assert.match(app, /Confidence score · \$\{profile\.confidenceScore\}\/100/);
});
