import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../product-ui.css", import.meta.url), "utf8");

test("catalog summary is compact and remains on one desktop line", () => {
  assert.match(app, /competitor products · .* Waters systems/);
  assert.doesNotMatch(app, /independent of the dashboard time filter/);
  assert.match(css, /#comparisonCatalogNote\s*\{[\s\S]*?max-width:\s*none;[\s\S]*?white-space:\s*nowrap;/);
});
