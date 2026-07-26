import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../index.html", import.meta.url), "utf8");
const deployment = await readFile(new URL("../deploy-site/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const deploymentApp = await readFile(new URL("../deploy-site/app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
const deploymentStyles = await readFile(new URL("../deploy-site/styles.css", import.meta.url), "utf8");
const css = await readFile(new URL("../product-ui.css", import.meta.url), "utf8");
const deploymentCss = await readFile(new URL("../deploy-site/product-ui.css", import.meta.url), "utf8");

test("the standalone roadmap impact section is removed", () => {
  for (const markup of [source, deployment]) {
    assert.doesNotMatch(markup, /id="roadmapImpactMap"/);
    assert.doesNotMatch(markup, />Roadmap Impact Map</);
    assert.doesNotMatch(markup, /class="panel roadmap-impact-panel"/);
  }
});

test("capability priorities are integrated into competitive capability evidence", () => {
  for (const implementation of [app, deploymentApp]) {
    assert.match(implementation, /function roadmapImpactHeatmapMarkup\(signals\)/);
    assert.match(implementation, /Waters Capability Priorities/);
    assert.match(implementation, /Public trend strength/);
    assert.match(implementation, /Competitor pressure/);
    assert.match(implementation, /Linked evidence/);
    assert.match(implementation, /\$\{roadmapImpactHeatmapMarkup\(signals\)\}/);
    for (const capability of [
      "Automation",
      "Informatics",
      "LC platform",
      "LC-MS sensitivity",
      "Regulated methods",
      "Software usability",
      "UHPLC modules",
      "2D LC",
      "LC-MS/MS quantitation",
      "Sample prep",
      "Application kits",
    ]) {
      assert.match(implementation, new RegExp(`"${capability.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
    }
  }
});

test("the integrated capability heatmap remains sortable and evidence-linked", () => {
  for (const implementation of [app, deploymentApp]) {
    assert.match(implementation, /data-impact-sort="\$\{index\}"/);
    assert.match(implementation, /data-roadmap-evidence="\$\{escapeHtml\(capability\)\}"/);
    assert.match(implementation, /byId\("featureGapMatrix"\)\.addEventListener\("click"/);
    assert.match(implementation, /renderFeatureGapMatrix\(currentSignals\(\)\)/);
  }
});

test("the redundant Waters takeaway callout is removed", () => {
  for (const implementation of [app, deploymentApp]) {
    assert.doesNotMatch(implementation, /gap-takeaway-main/);
    assert.doesNotMatch(implementation, /Waters appears defensible on LC performance/);
    assert.doesNotMatch(implementation, /Use this as a triage view/);
  }
  for (const stylesheet of [styles, deploymentStyles]) {
    assert.doesNotMatch(stylesheet, /\.gap-takeaway-main/);
  }
});

test("the integrated heatmap uses four aligned columns and signal colors", () => {
  for (const stylesheet of [css, deploymentCss]) {
    assert.match(stylesheet, /\.capability-heatmap-grid/);
    assert.match(stylesheet, /grid-template-columns:\s*minmax\(180px, 1\.2fr\)\s+minmax\(140px, 0\.85fr\)\s+minmax\(140px, 0\.85fr\)\s+minmax\(210px, 1\.2fr\)/);
    assert.match(stylesheet, /\.capability-trend-high/);
    assert.match(stylesheet, /\.capability-pressure-high/);
  }
});

test("source and deployment copies match", () => {
  assert.equal(deployment, source);
  assert.equal(deploymentApp, app);
  assert.equal(deploymentStyles, styles);
  assert.equal(deploymentCss, css);
});
