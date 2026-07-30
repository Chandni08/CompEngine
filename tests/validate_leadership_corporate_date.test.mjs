import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const deployApp = readFileSync(new URL("../deploy-site/app.js", import.meta.url), "utf8");

test("corporate leadership signal shows the latest earnings or filing date in the top-right capsule", () => {
  assert.match(
    app,
    /const corporateSignal = earnings \|\| filing;/,
  );
  assert.match(
    app,
    /kind: "corporate",\s+label: "Corporate signal",\s+badge: formatDate\(corporateSignal\.date\)/,
  );
});

test("corporate leadership date ships identically", () => {
  assert.equal(deployApp, app);
});
