import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

for (const file of ["product-ui.css", "deploy-site/product-ui.css"]) {
  test(`${file} keeps decision-card content top-aligned`, () => {
    const css = fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

    assert.match(
      css,
      /\.decision-card\s*\{[\s\S]*?align-content:\s*start;[\s\S]*?grid-auto-rows:\s*max-content;/,
    );
  });
}
