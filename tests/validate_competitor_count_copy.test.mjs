import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const deployApp = await readFile(new URL("../deploy-site/app.js", import.meta.url), "utf8");

test("competitor intent count contains only the number of competitors", () => {
  assert.match(app, /profiles\.length === 1 \? "1 competitor" : `\$\{profiles\.length\} competitors`/);
  assert.doesNotMatch(app, /select one to review/i);
});

test("competitor count wording ships identically", () => {
  assert.equal(deployApp, app);
});
