import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("public evidence library paginates ten records at a time", () => {
  assert.match(app, /signalPageSize:\s*10/);
  assert.match(app, /pageSignals\s*=\s*visibleSignals\.slice\(pageStart, pageStart \+ pageSize\)/);
  assert.match(html, /id="signalPagination"[^>]+aria-label="Public evidence pages"/);
});

test("public evidence pagination resets when filters change", () => {
  const resets = app.match(/state\.signalPage = 1;/g) || [];
  assert.ok(resets.length >= 1);
  assert.match(app, /Object\.values\(filters\)\.forEach\(\(filter\) => filter\.addEventListener\("change"/);
  assert.match(app, /function setupSignalPagination\(\)/);
  assert.match(app, /data-signal-page/);
  assert.match(app, /renderSignals\(filteredSignalsForHorizon\(filters\.horizon\.value\)\)/);
});
