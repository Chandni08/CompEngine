import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const rootApp = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const deployedApp = fs.readFileSync(new URL("../deploy-site/app.js", import.meta.url), "utf8");

for (const [label, source] of [["source", rootApp], ["deploy copy", deployedApp]]) {
  test(`${label} renders two explicit launch-source links`, () => {
    assert.match(source, />Product launch page ↗<\/a>/);
    assert.match(source, />Press release ↗<\/a>/);
    assert.doesNotMatch(source, />Discovery source ↗<\/a>/);
  });
}
