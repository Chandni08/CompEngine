import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../index.html", import.meta.url), "utf8");
const deployment = await readFile(new URL("../deploy-site/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const deploymentApp = await readFile(new URL("../deploy-site/app.js", import.meta.url), "utf8");
const filingInsights = await readFile(new URL("../data/filing_insights.json", import.meta.url), "utf8");
const deploymentFilingInsights = await readFile(new URL("../deploy-site/data/filing_insights.json", import.meta.url), "utf8");
const removedRoadmapSubtitle = "Where public evidence may justify roadmap attention. Open the sources before acting.";
const removedOneYearExplanation = "The one-year view shows whether this pattern recurs across launches, customer evidence, and scientific demand.";
const removedEvidenceSubtitle = "Linked public proof.";
const removedApplicationTrendsSubtitle = "Independent market signals and independent competitor application-note trends.";
const removedDoiMethodologyLine = "exact DOI records were reviewed under the active filters";
const removedCoverageTargetNote = "What is not yet counted: conference pages, regulatory standards, funding, trials, patents, and procurement sources";
const removedPubmedPaceExplanation = "This is the directional time-series view because it has comparable current and prior-period counts.";
const removedTrendRead = "Annual pace removes most short-term noise and supports a capability-coverage decision.";
const removedAgilentFilingExplanation = "Those phrases locate the passages where Agilent connects LC/LC-MS directly to pharma, APAC, and advanced-therapeutics growth instead of treating LC as a mature background portfolio.";
const removedSourceSeparationExplanation = "PubMed publication pace and dated non-PubMed records are shown separately so source coverage is never mistaken for observed activity.";
const removedLaunchSubtitle = "Open or compare dated launches.";
const removedDefenseSubtitle = "Old versus new, the immediate Waters action, and where the competitor is still weak.";
const removedTechnicalDecisionSubtitle = "How the technical evidence changes the product decision.";
const removedAgilentAcquisitionCoverageNote = "The displayed 10-Q names a pending acquisition; it does not identify a separate merger or operating partnership.";

test("removed Roadmap Impact Map subtitle stays removed", () => {
  assert.doesNotMatch(source, new RegExp(removedRoadmapSubtitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(deployment, new RegExp(removedRoadmapSubtitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("leadership confidence badge uses the requested label", () => {
  assert.doesNotMatch(app, /badge: `Evidence confidence /);
  assert.doesNotMatch(deploymentApp, /badge: `Evidence confidence /);
  assert.match(app, /badge: `Confidence Score \$\{insight\.confidence \|\| 0\}\/100`/);
  assert.match(deploymentApp, /badge: `Confidence Score \$\{insight\.confidence \|\| 0\}\/100`/);
});

test("removed one-year pattern explanation stays removed", () => {
  assert.doesNotMatch(app, new RegExp(removedOneYearExplanation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(deploymentApp, new RegExp(removedOneYearExplanation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("removed evidence modal subtitle stays removed", () => {
  assert.doesNotMatch(source, new RegExp(removedEvidenceSubtitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(deployment, new RegExp(removedEvidenceSubtitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("removed Application Trends subtitle stays removed", () => {
  assert.doesNotMatch(source, new RegExp(removedApplicationTrendsSubtitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(deployment, new RegExp(removedApplicationTrendsSubtitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("removed source-separation explanation stays removed", () => {
  assert.doesNotMatch(app, new RegExp(removedSourceSeparationExplanation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(deploymentApp, new RegExp(removedSourceSeparationExplanation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("removed launch-section subtitle stays removed", () => {
  assert.doesNotMatch(source, new RegExp(removedLaunchSubtitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(deployment, new RegExp(removedLaunchSubtitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("removed short-horizon defense subtitle stays removed", () => {
  assert.doesNotMatch(app, new RegExp(removedDefenseSubtitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(deploymentApp, new RegExp(removedDefenseSubtitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("short-horizon defense omits the old-baseline and new-signal comparison row", () => {
  assert.doesNotMatch(app, /class="defense-old-new"/);
  assert.doesNotMatch(deploymentApp, /class="defense-old-new"/);
  assert.doesNotMatch(app, />Old baseline<\/span>/);
  assert.doesNotMatch(app, />New signal<\/span>/);
});

test("removed technical decision subtitle stays removed", () => {
  assert.doesNotMatch(app, new RegExp(removedTechnicalDecisionSubtitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(deploymentApp, new RegExp(removedTechnicalDecisionSubtitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("Agilent filing insight omits the acquisition coverage disclaimer", () => {
  assert.doesNotMatch(filingInsights, new RegExp(removedAgilentAcquisitionCoverageNote.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(deploymentFilingInsights, new RegExp(removedAgilentAcquisitionCoverageNote.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("removed DOI methodology line stays removed", () => {
  assert.doesNotMatch(app, new RegExp(removedDoiMethodologyLine, "i"));
  assert.doesNotMatch(deploymentApp, new RegExp(removedDoiMethodologyLine, "i"));
});

test("removed non-PubMed coverage-target note stays removed", () => {
  assert.doesNotMatch(app, new RegExp(removedCoverageTargetNote, "i"));
  assert.doesNotMatch(deploymentApp, new RegExp(removedCoverageTargetNote, "i"));
});

test("removed PubMed publication-pace label stays removed", () => {
  assert.doesNotMatch(app, /class="application-trend-evidence-label"/);
  assert.doesNotMatch(deploymentApp, /class="application-trend-evidence-label"/);
  assert.doesNotMatch(app, new RegExp(removedPubmedPaceExplanation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(deploymentApp, new RegExp(removedPubmedPaceExplanation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("removed Application Trend comparison explanation stays removed", () => {
  assert.doesNotMatch(app, /function applicationTrendRead\(/);
  assert.doesNotMatch(deploymentApp, /function applicationTrendRead\(/);
  assert.doesNotMatch(app, new RegExp(removedTrendRead.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(deploymentApp, new RegExp(removedTrendRead.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("Application Trend cards omit momentum-status capsules", () => {
  assert.doesNotMatch(app, /class="trend-pace-chip/);
  assert.doesNotMatch(deploymentApp, /class="trend-pace-chip/);
});

test("competitor application-note analysis omits the independence callout", () => {
  assert.doesNotMatch(app, /class="competitor-note-independence"/);
  assert.doesNotMatch(deploymentApp, /class="competitor-note-independence"/);
  assert.doesNotMatch(app, /Independent competitor-note analysis/);
  assert.doesNotMatch(deploymentApp, /Independent competitor-note analysis/);
});

test("competitor application-note summary omits the cluster disclaimer", () => {
  assert.doesNotMatch(app, /notes form \$\{themes\.length\} independent competitor-theme clusters/);
  assert.doesNotMatch(deploymentApp, /notes form \$\{themes\.length\} independent competitor-theme clusters/);
  assert.doesNotMatch(app, /Frequency shows publishing emphasis/);
  assert.doesNotMatch(deploymentApp, /Frequency shows publishing emphasis/);
});

test("the removed Agilent filing-navigation explanation stays removed", () => {
  const expression = new RegExp(removedAgilentFilingExplanation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  assert.doesNotMatch(filingInsights, expression);
  assert.doesNotMatch(deploymentFilingInsights, expression);
  assert.equal(deploymentFilingInsights, filingInsights);
});

test("the filing corporate-moves panel omits the redundant separator label", () => {
  assert.doesNotMatch(app, /Separate from the product insight/);
  assert.doesNotMatch(deploymentApp, /Separate from the product insight/);
});

test("filing insights use Waters implication instead of Waters readout", () => {
  assert.doesNotMatch(app, /Waters readout/i);
  assert.doesNotMatch(deploymentApp, /Waters readout/i);
  assert.match(app, /Waters implication/);
  assert.match(deploymentApp, /Waters implication/);
});

test("strategic partnerships omit scoring and score breakdowns", () => {
  const strategicRenderer = app.match(/function renderStrategicSignals\(signals\)[\s\S]*?function setupStrategicPagination\(\)/)?.[0] || "";
  const deploymentStrategicRenderer = deploymentApp.match(/function renderStrategicSignals\(signals\)[\s\S]*?function setupStrategicPagination\(\)/)?.[0] || "";
  assert.ok(strategicRenderer);
  assert.ok(deploymentStrategicRenderer);
  assert.doesNotMatch(strategicRenderer, /signalScoreBreakdownMarkup|signal-score-detail|signal-priority|signal-tier|Score breakdown/);
  assert.doesNotMatch(deploymentStrategicRenderer, /signalScoreBreakdownMarkup|signal-score-detail|signal-priority|signal-tier|Score breakdown/);
});
