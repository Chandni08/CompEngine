import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const deploymentApp = await readFile(new URL("../deploy-site/app.js", import.meta.url), "utf8");

test("dashboard mapped-source panels remain disabled", () => {
  const disabledPanelGuard = /const showMappedSourcePanels = false;[\s\S]*?journalForumSources"\)\.innerHTML = "";[\s\S]*?return;/;
  assert.match(app, disabledPanelGuard);
  assert.match(deploymentApp, disabledPanelGuard);
});
