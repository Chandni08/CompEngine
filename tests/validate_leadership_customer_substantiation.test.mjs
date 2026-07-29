import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("Leadership Brief customer insights require corroboration across exact sources", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");

  assert.match(app, /const leadershipCustomerMinimumIndependentSources = 3;/);
  assert.match(app, /groupCustomerVoiceEvidenceMappings\([\s\S]*customerVoiceSourceLinks\(item\)/);
  assert.match(app, /entry\.independentSourceCount >= leadershipCustomerMinimumIndependentSources/);
  assert.match(app, /b\.independentSourceCount - a\.independentSourceCount/);
  assert.match(app, /badge: `\$\{insight\.independentSourceCount\} independent sources`/);
  assert.doesNotMatch(
    app.slice(app.indexOf("function leadershipCustomerHighlight"), app.indexOf("function leadershipBriefHighlights")),
    /Open exact source|Confidence Score/,
  );
});

test("deployed app mirrors the substantiation gate", async () => {
  const [app, deployedApp] = await Promise.all([
    readFile(new URL("app.js", root), "utf8"),
    readFile(new URL("deploy-site/app.js", root), "utf8"),
  ]);

  assert.equal(deployedApp, app);
});
