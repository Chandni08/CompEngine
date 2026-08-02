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

test("publication markets match the main dashboard without extra source taxonomy", () => {
  const mainMarkets = ["Pharma", "Biopharma", "CDMO", "Clinical", "Academic", "Government", "Environmental", "Food & Beverage"];
  const marketBlock = app.slice(app.indexOf("const MAIN_DASHBOARD_MARKETS"), app.indexOf("const TOPIC_RULES"));
  for (const market of mainMarkets) assert.match(marketBlock, new RegExp(`"${market.replace("&", "&")}"`));
  assert.match(app, /function populateMarketSelect\(\)/);
  assert.match(app, /populateMarketSelect\(\)/);
  assert.doesNotMatch(app, /otherGroup/);
  assert.doesNotMatch(app, /otherMarkets/);
  assert.doesNotMatch(app, /document\.createElement\("optgroup"\)/);
  assert.doesNotMatch(app, /populateSelect\("publicationMarketFilter"/);
});

test("summary prioritizes a product-manager workflow instead of the catch-all topic", () => {
  const statsRenderer = app.slice(app.indexOf("function renderStats"), app.indexOf("function recordsFromLastDays"));
  assert.match(statsRenderer, /Top PM workflow/);
  assert.match(statsRenderer, /ANALYTICAL_WORKFLOW_RULES/);
  assert.match(statsRenderer, /leadingWorkflow\.pmPriority/);
  assert.doesNotMatch(statsRenderer, /Leading recent topic/);
  assert.doesNotMatch(statsRenderer, /Other analytical science/);
  assert.match(statsRenderer, /class="publication-pm-signal"/);
  assert.match(css, /\.publication-stat-grid \.publication-pm-signal strong/);
  assert.match(app, /dashboardLabel: "Validation-ready LC-MS\/MS workflows"/);
  assert.match(app, /Prioritize assay robustness, method transfer, and validation support\./);
});

test("publication page synthesizes overall topic trends across journals and trade sources", () => {
  assert.match(html, /id="publicationOverallAnalysis"/);
  assert.match(app, /function renderOverallTopicAnalysis\(sources\)/);
  assert.match(app, /Overall Topic Trends Across \$\{journalView \? "Publications" : "Source Records"\}/);
  assert.match(app, /Overall rank #\$\{index \+ 1\}/);
  assert.match(app, /Clinical bioanalysis, therapeutic monitoring, and biomarker assays/);
  assert.match(app, /Targeted LC-MS\/MS quantitation and regulated assay validation/);
  assert.match(app, /HRMS identification, non-target screening, and structural elucidation/);
  assert.match(app, /function rankedScienceStreams\(records, rules, kind\)/);
  const overallRenderer = app.slice(
    app.indexOf("function renderOverallTopicAnalysis"),
    app.indexOf("function renderSourceRail"),
  );
  assert.doesNotMatch(overallRenderer, /Leading application stream/);
  assert.doesNotMatch(overallRenderer, /Dominant analytical workflow/);
  assert.doesNotMatch(overallRenderer, /Second major science stream/);
  assert.doesNotMatch(overallRenderer, /Broadest journal coverage/);
  assert.doesNotMatch(overallRenderer, /Named competitor signal/);
  assert.doesNotMatch(overallRenderer, /No secondary stream identified/);
  assert.match(overallRenderer, /b\.count - a\.count \|\| b\.journals\.size - a\.journals\.size/);
  assert.match(overallRenderer, /const summaryStreams = rankedStreams\.slice\(0, 3\)/);
  assert.match(overallRenderer, /const detailedStreams = rankedStreams\.slice\(3, 9\)/);
  assert.match(overallRenderer, /Overall rank #\$\{summaryStreams\.length \+ index \+ 1\}/);
  assert.match(overallRenderer, /summaryStreams\.length \? `<div class="publication-overall-summary/);
  assert.match(overallRenderer, /detailedStreams\.length \? `<div class="publication-overall-topics">/);
  assert.match(css, /\.publication-overall-summary-2/);
  assert.match(css, /\.publication-overall-topics \{/);
});

test("publication page surfaces linked highlights from the last 15 days", () => {
  assert.match(html, /id="publicationFreshHighlights"/);
  assert.match(app, /function recordsFromLastDays\(sources, days\)/);
  assert.match(app, /function renderFreshHighlights\(sources\)/);
  assert.match(app, /New \$\{journalView \? "Publication" : "Source"\} Highlights/);
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

test("large exact-evidence topic sets are paginated", () => {
  assert.match(app, /recordPageSize: 12/);
  assert.match(app, /Math\.ceil\(matchingRecords\.length \/ publicationState\.recordPageSize\)/);
  assert.match(app, /data-publication-record-page="previous"/);
  assert.match(app, /data-publication-record-page="next"/);
  assert.match(app, /Showing \$\{recordStart \+ 1\}–/);
  assert.match(app, /publicationState\.recordPage = 1/);
  assert.match(css, /\.publication-record-pagination \{/);
});

test("the catch-all topic is always ranked after product-relevant topics", () => {
  const topicSummaryRenderer = app.slice(app.indexOf("function topicSummary"), app.indexOf("const COMPETITOR_TITLE_PATTERNS"));
  assert.match(topicSummaryRenderer, /aIsCatchAll/);
  assert.match(topicSummaryRenderer, /bIsCatchAll/);
  assert.match(topicSummaryRenderer, /return aIsCatchAll \? 1 : -1/);
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

test("trade, forum, and learning sources include dated publisher records without fabricated Crossref trends", () => {
  const tradeSources = data.sources.filter((source) => source.sourceClass !== "Peer-reviewed journal");
  assert.equal(tradeSources.length, 9);
  for (const source of tradeSources) {
    assert.ok(source.homepage, `${source.name} needs a homepage`);
    assert.ok(!source.publicationTrend, `${source.name} must not receive a Crossref trend`);
    assert.ok(source.contentTrend, `${source.name} needs a source content trend`);
    assert.ok(source.recentRecords.length > 0, `${source.name} needs exact dated source records`);
    assert.ok(source.recentRecords.every((record) => record.title && record.date && record.sourceUrl));
  }
  assert.match(app, /Dated public records across selected sources/);
  assert.match(app, /Latest Source Records/);
  assert.match(app, /Open \$\{journalSource \? "DOI" : "source"\}/);
  assert.match(collector, /publisher-owned public feed, sitemap, or listing page/i);
});

test("journal trends compare rolling Crossref result counts and show exact DOI evidence", () => {
  assert.match(collector, /rows=0/);
  assert.match(collector, /total-results/);
  assert.match(collector, /last90Days/);
  assert.match(app, /Latest Publications/);
  assert.match(app, /journalSource \? "DOI" : "source"/);
  assert.match(app, /topicForTitle/);
});

test("source and deploy publication assets remain identical", () => {
  assert.equal(deployHtml, html);
  assert.equal(deployApp, app);
  assert.equal(deployCss, css);
  assert.equal(deployData, dataText);
});
