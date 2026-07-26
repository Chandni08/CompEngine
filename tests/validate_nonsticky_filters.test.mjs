import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../product-ui.css", import.meta.url), "utf8");
const deployCss = await readFile(new URL("../deploy-site/product-ui.css", import.meta.url), "utf8");

test("dashboard filters stay in normal document flow", () => {
  const override = /\.filters\s*\{\s*position:\s*static;\s*top:\s*auto;\s*z-index:\s*auto;\s*\}/s;
  assert.match(css, override);
  assert.match(deployCss, override);
});
