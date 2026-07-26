import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../product-ui.css", import.meta.url), "utf8");
const deployCss = await readFile(new URL("../deploy-site/product-ui.css", import.meta.url), "utf8");

test("all panel header actions remain in one horizontal row", () => {
  assert.match(css, /\.app-shell \.panel \.panel-header > \.panel-header-actions\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*nowrap;/s);
  assert.match(css, /\.app-shell \.panel \.panel-header > \.panel-header-actions > \*\s*\{[^}]*flex:\s*0 0 auto;[^}]*white-space:\s*nowrap;/s);
  assert.match(css, /overflow-x:\s*auto/);
});

test("one-line panel header controls ship identically", () => {
  assert.equal(deployCss, css);
});
