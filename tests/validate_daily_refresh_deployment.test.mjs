import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const refreshRunner = await readFile(new URL("scripts/run_daily_refresh.sh", root), "utf8");
const deployRunner = await readFile(new URL("scripts/deploy_refreshed_site.sh", root), "utf8");
const workflow = await readFile(new URL(".github/workflows/daily-content-refresh.yml", root), "utf8");
const launchAgent = await readFile(new URL("config/com.waters.competition-engine.daily-refresh.plist", root), "utf8");

test("daily refresh publishes only after the collector succeeds", () => {
  assert.match(refreshRunner, /\.daily-refresh\.lock/);
  assert.match(refreshRunner, /if \[\[ \$refresh_status -ne 0 \]\]/);
  assert.match(refreshRunner, /deploy_refreshed_site\.sh/);
  assert.ok(refreshRunner.indexOf("deploy_refreshed_site.sh") > refreshRunner.indexOf("refresh_daily.py"));
});

test("the OS schedule wakes Codex before its end-to-end automation runs", () => {
  assert.match(launchAgent, /\/usr\/bin\/open/);
  assert.match(launchAgent, /com\.openai\.codex/);
  assert.doesNotMatch(launchAgent, /scripts\/run_daily_refresh\.sh/);
  assert.doesNotMatch(launchAgent, /scripts\/refresh_daily\.py/);
  assert.match(launchAgent, /<key>RunAtLoad<\/key>\s*<true\/>/);
  assert.match(launchAgent, /<key>Hour<\/key>\s*<integer>6<\/integer>/);
  assert.match(launchAgent, /<key>Minute<\/key>\s*<integer>10<\/integer>/);
});

test("daily publication validates, deploys, aliases, and verifies the Waters site", () => {
  assert.match(deployRunner, /validate_deploy\.mjs/);
  assert.match(deployRunner, /node --test/);
  assert.match(deployRunner, /vercel@\$VERCEL_VERSION" deploy --prod --yes/);
  assert.match(deployRunner, /alias set "\$deployment_url" "\$WATERS_HOST"/);
  assert.match(deployRunner, /data\/refresh_status\.json/);
  assert.match(deployRunner, /'"status": "success"'/);
  assert.match(deployRunner, /'"status": "partial"'/);
  assert.match(deployRunner, /live refresh status is not publishable/);
});

test("cloud refresh schedule validates before saving or deploying data", () => {
  assert.match(workflow, /cron: "15 10 \* \* \*"/);
  assert.ok(workflow.indexOf("Validate the production package") < workflow.indexOf("Save the validated daily data"));
  assert.ok(workflow.indexOf("Run regression checks") < workflow.indexOf("Save the validated daily data"));
});
