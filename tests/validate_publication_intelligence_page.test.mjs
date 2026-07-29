import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [html, app, css, dataText, collector, deployHtml, deployApp, deployCss, deployData] = await Promise.all([
  read("publications.html"),
  read("publication-page.js"),
  read("publication-page.css"),
  read("data/journal_sources.json"),
  read("scripts/collect_scientific_sources.py"),
  read("deploy-site/publications.html"),
  read("deploy-site/publication-page.js"),
  read("deploy-site/publication-page.css"),
  read("deploy-site/data/journal_sources.json"),
]);
const data = JSON.parse(dataText);

test("publication intelligence is a standalone, linked workspace", async () => {
  assert.match(html, /<h1>Publication Intelligence<\/h1>/);
  assert.doesNotMatch(html, /Publication Pace by Journal/);
  assert.doesNotMatch(html, /publicationPaceChart/);
  assert.doesNotMatch(app, /function renderPaceChart/);
  assert.match(html, /publicationSourceList/);
  assert.match(html, /publicationDetail/);
  assert.match(await read("index.html"), /href="publications\.html">Publication Intelligence/);
  assert.match(await read("conference.html"), /href="publications\.html">Publication Intelligence/);
});

test("sources-in-view summary links directly to the monitored source list", () => {
  assert.match(app, /class="publication-stat-link" href="#publicationSourceList"/);
  assert.match(app, /View \$\{sources\.length\} sources →/);
  assert.match(css, /\.publication-stat-link \{/);
});

test("publication page synthesizes overall topic trends across journals", () => {
  assert.match(html, /id="publicationOverallAnalysis"/);
  assert.match(app, /function renderOverallTopicAnalysis\(sources\)/);
  assert.match(app, /Overall Topic Trends Across Publications/);
  assert.match(app, /Leading application stream/);
  assert.match(app, /Dominant analytical workflow/);
  assert.match(app, /Second major science stream/);
  assert.match(app, /Clinical bioanalysis, therapeutic monitoring, and biomarker assays/);
  assert.match(app, /Targeted LC-MS\/MS quantitation and regulated assay validation/);
  assert.match(app, /HRMS identification, non-target screening, and structural elucidation/);
  assert.match(app, /function rankedScienceStreams\(records, rules, kind\)/);
  const overallRenderer = app.slice(
    app.indexOf("function renderOverallTopicAnalysis"),
    app.indexOf("function renderSourceRail"),
  );
  assert.doesNotMatch(overallRenderer, /Leading technical theme/);
  assert.doesNotMatch(overallRenderer, /Broadest journal coverage/);
  assert.doesNotMatch(overallRenderer, /Named competitor signal/);
  assert.match(css, /\.publication-overall-topics \{/);
});

test("publication page surfaces linked highlights from the last 15 days", () => {
  assert.match(html, /id="publicationFreshHighlights"/);
  assert.match(app, /function recordsFromLastDays\(sources, days\)/);
  assert.match(app, /function renderFreshHighlights\(sources\)/);
  assert.match(app, /New Publication Highlights/);
  assert.match(app, /recordsFromLastDays\(sources, 15\)/);
  assert.match(app, /href="\$\{escapeHtml\(record\.sourceUrl\)\}"/);
  assert.match(css, /\.publication-fresh-grid \{/);
});

test("journal detail prioritizes content themes and explicit competitor mentions over volume arithmetic", () => {
  assert.match(app, /aria-label="Publication content signals"/);
  assert.match(app, /Leading content topic/);
  assert.match(app, /Secondary content topic/);
  assert.match(app, /Topic breadth/);
  assert.match(app, /Competitor presence/);
  assert.match(app, /function competitorTitleMentions\(records\)/);
  assert.match(app, /No competitor named/);
  assert.doesNotMatch(app, /<span>Latest period<\/span>/);
  assert.doesNotMatch(app, /<span>Prior period<\/span>/);
  assert.doesNotMatch(app, /<span>Trailing 12 months<\/span>/);
  assert.match(css, /\.publication-content-strip strong \{/);
});

test("topic counts link to the exact publications behind each topic", () => {
  assert.match(app, /data-publication-topic=/);
  assert.match(app, /href="#publicationRecordPanel"/);
  assert.match(app, /publicationState\.selectedTopic/);
  assert.match(app, /topicForTitle\(record\.title\) === selectedTopic/);
  assert.match(css, /\.publication-topic-list a \{/);
});

test("dated journal streams include rolling current and prior period counts", () => {
  const journals = data.sources.filter((source) => source.sourceClass === "Peer-reviewed journal");
  assert.equal(journals.length, 7);
  for (const journal of journals) {
    assert.ok(journal.publicationTrend, `${journal.name} needs publicationTrend`);
    for (const key of ["last30Days", "prior30Days", "last90Days", "prior90Days", "trailing12Months"]) {
      assert.equal(typeof journal.publicationTrend[key], "number", `${journal.name} ${key}`);
    }
    assert.ok(journal.recentRecords.length > 0, `${journal.name} needs exact DOI records`);
  }
});

test("mapped trade and forum URLs do not receive fabricated publication trends", () => {
  const mapped = data.sources.filter((source) => source.sourceClass !== "Peer-reviewed journal");
  assert.ok(mapped.length >= 9);
  assert.ok(mapped.every((source) => source.homepage && !source.publicationTrend));
  assert.match(app, /Dated publication trend not yet available/);
});

test("journal trends compare rolling Crossref result counts and show exact DOI evidence", () => {
  assert.match(collector, /rows=0/);
  assert.match(collector, /total-results/);
  assert.match(collector, /last90Days/);
  assert.match(app, /Latest Publications/);
  assert.match(app, /Open DOI/);
  assert.match(app, /topicForTitle/);
});

test("source and deploy publication assets remain identical", () => {
  assert.equal(deployHtml, html);
  assert.equal(deployApp, app);
  assert.equal(deployCss, css);
  assert.equal(deployData, dataText);
});
