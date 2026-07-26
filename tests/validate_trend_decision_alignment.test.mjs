import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("overall-trend implication and consideration boxes align label and body copy", async () => {
  const css = await readFile(new URL("../product-ui.css", import.meta.url), "utf8");
  const rule = css.match(/\.trend-decision,\s*\n\.trend-action\s*\{([\s\S]*?)\}/)?.[1] ?? "";

  assert.match(rule, /display:\s*grid/);
  assert.match(rule, /grid-template-rows:\s*auto 1fr/);
  assert.match(rule, /align-content:\s*start/);
});

test("trend-card alignment styles ship identically", async () => {
  const [sourceCss, deployCss] = await Promise.all([
    readFile(new URL("../product-ui.css", import.meta.url), "utf8"),
    readFile(new URL("../deploy-site/product-ui.css", import.meta.url), "utf8"),
  ]);

  assert.equal(deployCss, sourceCss);
});
