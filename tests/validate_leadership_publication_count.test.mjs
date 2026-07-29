import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const deployApp = readFileSync(new URL("../deploy-site/app.js", import.meta.url), "utf8");

test("scientific leadership highlight shows its publication count in the top-right capsule", () => {
  assert.match(
    app,
    /label: "Scientific market signal",\s+badge: `\$\{leadTrend\.comparison\.count\.toLocaleString\(\)\} publication/,
  );
  assert.match(app, /leadership-highlight-top[\s\S]*highlight\.badge/);
});

test("leadership publication capsule ships identically", () => {
  assert.equal(deployApp, app);
});
