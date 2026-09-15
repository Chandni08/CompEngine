import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const refreshRunner = await readFile(new URL("scripts/run_daily_refresh.sh", root), "utf8");
const deployRunner = await readFile(new URL("scripts/deploy_refreshed_site.sh", root), "utf8");
const refreshWorkflow = await readFile(new URL(".github/workflows/daily-content-refresh.yml", root), "utf8");
const launchAgent = await readFile(new URL("config/com.waters.competition-engine.daily-refresh.plist", root), "utf8");
const refreshPipeline = await readFile(new URL("scripts/refresh_daily.py", root), "utf8");
const deployValidator = await readFile(new URL("deploy-site/scripts/validate_deploy.mjs", root), "utf8");

test("daily refresh runs the collector without invoking deployment", () => {
  assert.match(refreshRunner, /\.daily-refresh\.lock/);
  assert.match(refreshRunner, /COMPETITION_ENGINE_ROOT/);
  assert.match(refreshRunner, /COMPETITION_ENGINE_PYTHON/);
  assert.match(refreshRunner, /if \[\[ \$refresh_status -ne 0 \]\]/);
  assert.match(refreshRunner, /website deployment was not started/);
  assert.doesNotMatch(refreshRunner, /deploy_refreshed_site\.sh/);
  assert.doesNotMatch(refreshRunner, /PUBLISH=/);
  assert.doesNotMatch(refreshRunner, /--refresh-only/);
});

test("publishable exports and panel manifests are built only after the final source gate", () => {
  const sourceGate = refreshPipeline.indexOf('if not ledger["allRequiredSourcesCurrent"]');
  const pptxBuild = refreshPipeline.indexOf('str(PPTX_BUILDER)');
  const manifestBuild = refreshPipeline.indexOf('str(INTEGRITY_ARTIFACT_BUILDER)');
  assert.ok(sourceGate >= 0);
  assert.ok(pptxBuild > sourceGate);
  assert.ok(manifestBuild > sourceGate);
  assert.match(refreshPipeline, /SKIP_REFRESH_EXPORTS/);
  assert.match(refreshWorkflow, /SKIP_REFRESH_EXPORTS: "1"/);
});

test("deployment synchronization includes nested source snapshots", () => {
  assert.match(refreshPipeline, /DATA_DIR\.rglob\("\*\.json"\)/);
  assert.match(refreshPipeline, /source\.relative_to\(DATA_DIR\)/);
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

test("the separate manual deployment validates, deploys, aliases, and verifies the Waters site", () => {
  assert.match(deployRunner, /validate_deploy\.mjs/);
  assert.match(deployValidator, /validate_source_title_links\.mjs/);
  assert.match(refreshPipeline, /SOURCE_TITLE_LINK_VALIDATOR/);
  assert.match(deployRunner, /node --test/);
  assert.match(deployRunner, /vercel@\$VERCEL_VERSION" deploy --prod --yes/);
  assert.match(deployRunner, /alias set "\$deployment_url" "\$WATERS_HOST"/);
  assert.match(deployRunner, /data\/refresh_status\.json/);
  assert.match(deployRunner, /'"status": "success"'/);
  assert.doesNotMatch(deployRunner, /'"status": "partial"'/);
  assert.match(deployRunner, /live refresh status is not publishable/);
});

test("cloud data refresh collects, validates, and commits the refreshed data without deploying", () => {
  assert.match(refreshWorkflow, /name: Daily competitive-intelligence data refresh/);
  assert.match(refreshWorkflow, /cron: "17 11 \* \* \*"/);
  assert.match(refreshWorkflow, /cron: "17 12 \* \* \*"/);
  assert.match(refreshWorkflow, /TZ=America\/New_York date \+%F/);
  assert.match(refreshWorkflow, /elif \[ "\$dataset_date" != "\$local_date" \]; then/);
  assert.match(refreshWorkflow, /Running because no successful dataset is published/);
  assert.match(refreshWorkflow, /Check out refresh state[\s\S]*?ref: \$\{\{ github\.event\.repository\.default_branch \}\}/);
  assert.match(refreshWorkflow, /dataset_date=.*2>\/dev\/null \|\| true/);
  assert.doesNotMatch(refreshWorkflow, /local_hour=/);
  assert.doesNotMatch(refreshWorkflow, /date \+%H/);
  assert.match(refreshWorkflow, /refresh_data:/);
  assert.match(refreshWorkflow, /if: needs\.schedule_gate\.outputs\.should_run == 'true'/);
  assert.match(refreshWorkflow, /scripts\/run_daily_refresh\.sh/);
  assert.doesNotMatch(refreshWorkflow, /--refresh-only/);
  assert.doesNotMatch(refreshWorkflow, /deploy_refreshed_site\.sh/);
  assert.match(refreshWorkflow, /Save the validated daily data/);
  assert.match(refreshWorkflow, /git push origin "HEAD:\$DEFAULT_BRANCH"/);
  assert.doesNotMatch(refreshWorkflow, /validated-data-ref/);
  assert.doesNotMatch(refreshWorkflow, /data_commit\.txt/);
  assert.doesNotMatch(refreshWorkflow, /VERCEL_TOKEN/);
  assert.doesNotMatch(refreshWorkflow, /Deploy the validated build/);
  assert.ok(refreshWorkflow.indexOf("Validate the production package") < refreshWorkflow.indexOf("Save the validated daily data"));
  assert.ok(refreshWorkflow.indexOf("Run ingestion regression checks") < refreshWorkflow.indexOf("Save the validated daily data"));
});
