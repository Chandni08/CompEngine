import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const deployApp = fs.readFileSync(new URL("../deploy-site/app.js", import.meta.url), "utf8");
const index = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("pain priorities use the requested transparent formula", () => {
  assert.match(app, /score:\s*recurrence \* severity\.score \* strategicFit\.score/);
  assert.match(app, /Priority = recurrence × severity × Next Gen LC fit/);
  assert.match(app, /canonicalEvidenceUrl\(link\.url\)/);
  assert.match(app, /customerPainSeverity/);
  assert.match(app, /customerPainStrategicFit/);
});

test("pain tracker elevates one quarterly action and ranks descending", () => {
  assert.match(app, /b\.priority\.score - a\.priority\.score/);
  assert.match(app, /Act this quarter/);
  assert.match(app, /const visibleRows = rows\.slice\(0, 5\)/);
  assert.match(app, /View \$\{backlogRows\.length\} lower-priority concern/);
  assert.match(index, /One quarterly action, ranked by recurrence, severity, and Next Gen LC fit\./);
});

test("ranked tracker has distinct top-priority and compact backlog treatments", () => {
  assert.match(styles, /\.pain-priority-row-top/);
  assert.match(styles, /\.pain-quarter-label/);
  assert.match(styles, /\.pain-priority-backlog/);
});

test("deploy mirror contains the same pain-priority implementation", () => {
  assert.equal(deployApp, app);
});
