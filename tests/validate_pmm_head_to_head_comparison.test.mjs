import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

const require = createRequire(import.meta.url);
const matchApi = require("../product-match-model.js");
const exportApi = require("../artifact-export.js");
const root = new URL("../", import.meta.url);
const [app, index, styles, contract, comparisons, launches, history] = await Promise.all([
  readFile(new URL("app.js", root), "utf8"),
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("styles.css", root), "utf8"),
  readFile(new URL("HEAD_TO_HEAD_COMPARISON_DATA_MODEL.md", root), "utf8"),
  readFile(new URL("data/product_comparisons.json", root), "utf8").then(JSON.parse),
  readFile(new URL("data/product_launches.json", root), "utf8").then(JSON.parse),
  readFile(new URL("data/historical_product_catalog.json", root), "utf8").then(JSON.parse),
]);

const model = matchApi.build({
  watersSystems: comparisons.watersSystems,
  thirdComparators: comparisons.thirdComparators,
  launchComparisons: comparisons.launchComparisons,
  launches: launches.launches,
  historicalProducts: history.products,
});

test("the product-led selector uses the complete governed catalog and creates competitor battlecards", () => {
  for (const id of ["pmmWatersProductFilter", "competitorFilter", "pmmCompetitorProductFilter"])
    assert.match(index, new RegExp(`id="${id}"`));
  assert.deepEqual(model.watersProducts.map((product) => product.id), comparisons.watersSystems.map((product) => product.id));
  assert.ok(new Set(model.competitorProducts.map((product) => product.competitor)).size >= 5);
  assert.match(index, /pmm-product-first-filter/);
  assert.match(index, /Choose a Waters product/);
  assert.match(app, /function headToHeadBattlecardModels\(\)/);
  assert.match(app, /headToHeadAvailableCompetitors\(\)\.map/);
  assert.match(app, /data-h2h-product-override/);
  assert.match(app, /data-h2h-competitor/);
});

test("the closest-product suggestion is deterministic and exposes its basis", () => {
  const candidates = matchApi.candidates(model, "acquity-premier-system", "Agilent");
  assert.ok(candidates.length > 1);
  assert.equal(candidates[0].competitorProduct, "1290 Infinity III LC");
  assert.ok(candidates[0].score >= candidates[1].score);
  for (const field of ["techniqueClass", "pressureRange", "segment", "positioningTier", "method"])
    assert.ok(candidates[0].similarityBasis[field]);
  assert.match(contract, /Deterministic similarity score/);
  assert.equal(matchApi.closest(model, "acquity-premier-system", "Agilent")?.competitorProductId, candidates[0].competitorProductId);
  const portfolioPairs = matchApi.portfolioPairs(model, "Agilent");
  assert.equal(portfolioPairs.length, model.watersProducts.length);
  assert.ok(portfolioPairs.every(({ watersProduct, match }) => match.watersProductId === watersProduct.id && match.competitor === "Agilent"));
});

test("equally matched routine-HPLC products prefer the current catalog generation", () => {
  const candidates = matchApi.candidates(model, "alliance-is-hplc", "Agilent");
  assert.equal(candidates[0].competitorProduct, "1260 Infinity III LC");
  assert.ok(candidates[0].competitorIntroducedYear >= candidates[1].competitorIntroducedYear);
});

test("missing pressure remains unresolved rather than guessed", () => {
  const basis = matchApi.similarityBasis(
    { product: "Example UHPLC", technology: "UHPLC" },
    { product: "Other UHPLC", technology: "UHPLC" },
    false,
  );
  assert.equal(basis.pressureRange.status, "Unresolved — catalog lacks comparable pressure data");
  assert.equal(basis.pressureRange.waters, "Not established");
  assert.equal(basis.pressureRange.competitor, "Not established");
});

test("selection persists locally and is shareable by URL", () => {
  assert.match(app, /competition-engine:pmm-head-to-head:v1/);
  assert.match(app, /localStorage\.getItem\(headToHeadStorageKey\)/);
  assert.match(app, /localStorage\.setItem\(headToHeadStorageKey/);
  for (const parameter of ["h2hWaters", "h2hCompetitor", "h2hProduct"])
    assert.match(app, new RegExp(`searchParams\\.set\\("${parameter}"`));
  for (const targetingParameter of ["h2hMarket", "h2hApplication", "h2hSituation", "h2hBuyer", "h2hGeo"])
    assert.match(app, new RegExp(targetingParameter));
  assert.match(app, /initializeHeadToHeadSelection\(\)/);
  assert.match(app, /normalizeHeadToHeadSelection\(\)/);
});

test("the selected battlecard produces a concise tailored seller pitch", () => {
  for (const heading of [
    "Why Waters for this customer",
    "Lead with",
    "Your response",
    "Close with",
    "Where Waters Wins",
    "Competitor Weaknesses",
    "Buying-Attribute Scorecard",
    "Service & Support",
    "Value Assumptions",
    "Evidence Gaps",
  ]) assert.match(app, new RegExp(heading.replace(/[&/]/g, ".")));
  assert.match(app, /tailoredPitch/);
  assert.match(app, /Which Product Are You Selling\?/);
  assert.match(app, /Who Are You Competing Against\?/);
  assert.match(app, /Copy blocked pending approval/);
  assert.match(app, /Use Seller Assets to Ship after clearance/);
  assert.match(app, /No public evidence of a weakness on this dimension\./);
  assert.match(app, /No acquisition price or monetary conversion is inferred/);
  for (const valueDimension of ["Purchase price", "Implementation and training", "Workflow operating cost", "Reliability and downtime", "Serviceability and service burden", "Expected lifecycle"])
    assert.match(app, new RegExp(valueDimension));
  assert.match(app, /No defensible public superiority claim is loaded/);
  assert.match(app, /Catalog positioning hypotheses are excluded/);
  assert.match(app, /Do not assert that \$\{context\.waters\.product\} is superior/);
});

test("the PMM readiness strip reports governed counts without narrative filler", () => {
  for (const label of [
    "Current Field Status",
    "Field-ready claims",
    "Supported, not approved",
    "Proof gaps",
    "Traceability gaps",
  ]) assert.match(app, new RegExp(label));
  assert.match(app, /model\.sellerAssets\?\.approvedClaims\?\.length/);
  assert.match(app, /proof\.compatibility\.status === "Applicable"/);
  assert.doesNotMatch(app.match(/function renderMarketingStartHere[\s\S]*?\n}\n/)?.[0] || "", /Do not say|Owner needed|Deadline needed|Success measure needed/);
  assert.match(index, /Evidence-Backed Product Battlecards/);
  assert.match(index, /id="pmm-governing-position"[^>]*data-default-collapsed="true"/);
  assert.match(index, /id="pmm-segment-cascade"[^>]*data-default-collapsed="true"/);
  assert.match(index, /id="pmm-competitive-narratives"[^>]*data-default-collapsed="true"/);
  assert.match(index, /id="pmm-adoption-value"[^>]*data-default-collapsed="true"/);
});

test("substantiation and weakness guards enforce dated public provenance", () => {
  assert.match(app, /independentSourceCount >= 2 \? "Proven" : datedSources\.length \? "Directional" : "Unsupported"/);
  assert.match(app, /filter\(\(claim\) => claim\.datedSourceCount > 0\)/);
  assert.match(app, /filter\(\(record\) => \/negative\|mixed\|neutral\/i\.test\(record\.sentiment/);
  assert.match(app, /pmmDeduplicateSources\(sources\.filter\(\(source\) => isHttpUrl\(source\.url\)\)\)/);
  assert.match(contract, /Duplicate URLs are removed/);
});

test("Fishbein-style weights are evidence-derived, sum to 100, and the swing is calculated", () => {
  for (const attribute of ["Reliability", "Method transfer", "Ease of use", "Service", "Data integrity", "Throughput"])
    assert.match(app, new RegExp(`label: "${attribute}"`));
  assert.match(app, /100 - assigned/);
  assert.match(app, /weightTotal: rows\.reduce\(\(total, row\) => total \+ row\.weight, 0\)/);
  assert.match(app, /row\.weightedDifference > 0/);
  assert.match(app, /scores are sentiment-coded evidence, not measured performance ratings/i);
});

test("copy and PPTX export are blocked unless content clears the Seller Assets gate", async () => {
  const input = {
    waters: { product: "Waters A" },
    competitorProduct: { product: "Competitor B" },
    positioning: "Proposed positioning",
    tailoredPitch: "Tailored market-specific pitch",
    nextStep: "Controlled evaluation",
    talkTrack: [
      { statement: "Approved dated statement", substantiation: "Directional", approvalState: "approved", fieldCitable: true, sources: [
        { url: "https://example.com/a", date: "2026-01-02", fieldCitable: true, approvalState: "approved" },
        { url: "https://example.com/draft-source", date: "2026-01-02", fieldCitable: true, approvalState: "draft" },
      ] },
      { statement: "Unsupported statement", substantiation: "Unsupported", sources: [] },
    ],
    evidenceGaps: ["Controlled comparison needed."],
  };
  const copy = exportApi.headToHeadTalkTrackText(input);
  assert.match(copy, /Approved dated statement/);
  assert.doesNotMatch(copy, /Unsupported statement/);
  assert.doesNotMatch(copy, /draft-source/);
  assert.doesNotMatch(copy, /Tailored market-specific pitch|Controlled evaluation|Controlled comparison needed/);
  assert.match(copy, /APPROVED \+ FIELD-CITABLE CONTENT ONLY/);
  assert.equal(typeof exportApi.buildHeadToHeadDeck, "function");
  assert.equal(typeof exportApi.exportHeadToHeadPptx, "function");
  await assert.rejects(exportApi.exportHeadToHeadPptx(input), /Field export blocked/);
  assert.match(styles, /data-substantiation="Unsupported"/);
  assert.match(app, /Print blocked pending approval/);
});

test("the feature remains scoped outside the eight canonical PMM primary sections", () => {
  assert.match(index, /id="pmm-head-to-head" class="panel pmm-head-to-head-panel"/);
  assert.equal((index.match(/class="panel pmm-primary-section"/g) || []).length, 8);
  assert.match(app, /state\.view !== "Marketing"/);
});

test("market and buying-context changes re-derive every battlecard and pitch", () => {
  assert.match(app, /function headToHeadTargetContext\(\)/);
  assert.match(app, /marketLabel: pmmTargetingDisplayValue/);
  assert.match(app, /pmmTargetingMatches\(record, \{ includeBuyerRole: true \}\)/);
  assert.match(app, /test \$\{context\.waters\.product\} against the customer’s \$\{targeting\.applicationLabel\} criteria/);
  assert.match(app, /function headToHeadNextStep/);
  assert.match(app, /Validated-method migration/);
  assert.match(app, /Competitive replacement/);
});

test("invalid shared competitor filters cannot empty the PMM battlecard library", () => {
  const allianceCompetitors = matchApi.availableCompetitors(model, "alliance-is-hplc");
  assert.ok(allianceCompetitors.includes("Agilent"));
  assert.ok(allianceCompetitors.includes("Thermo Fisher"));
  assert.equal(matchApi.normalizeCompetitorFilter(model, "alliance-is-hplc", "Agilent"), "Agilent");
  assert.equal(matchApi.normalizeCompetitorFilter(model, "alliance-is-hplc", "Market-wide"), "All");
  assert.equal(matchApi.normalizeCompetitorFilter(model, "alliance-is-hplc", "Public-company parents"), "All");
  assert.match(app, /const normalizedCompetitorFilter = headToHeadProductMatchModel\.normalizeCompetitorFilter/);
  assert.match(app, /filters\.competitor\.value = normalizedCompetitorFilter/);
});

test("the redundant hierarchical-targeting summary card is removed", () => {
  assert.doesNotMatch(index, /id="pmmTargetingContext"/);
  assert.doesNotMatch(app, /Canonical Targeting Selector/);
  assert.doesNotMatch(app, /function renderMarketingTargetingContext/);
  assert.equal((index.match(/id="pmmTargetingHelp"/g) || []).length, 1);
});
