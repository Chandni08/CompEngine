import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

const require = createRequire(import.meta.url);
const transformer = require("../product-comparator-claim-transformer.js");
const governance = require("../evidence-governance.js");
const root = new URL("../", import.meta.url);

function fixtureOptions() {
  return {
    productComparisons: {
      watersSystems: [{ id: "waters-system", product: "Waters System" }],
      launchComparisons: [{
        launchId: "competitor-system",
        closestWatersId: "waters-system",
        advantages: [
          {
            claimText: "Waters System reduces operator steps versus Competitor System.",
            dimension: "Operator steps",
            approvalState: "in-review",
            supportingEvidence: [{
              id: "external-proof",
              label: "Independent workflow comparison",
              sourceName: "External Laboratory",
              sourceUrl: "https://external.example/comparison",
              fieldCitable: true,
              approvalState: "approved",
            }],
          },
          {
            claimText: "Waters System has a smaller nominal flow-cell volume.",
            dimension: "Flow-cell volume",
            advantageType: "spec",
          },
          {
            claimText: "Waters System has higher sample throughput.",
            dimension: "Sample throughput",
            approvalState: "blocked",
            supportingEvidence: [{
              id: "blocked-claim-proof",
              label: "External throughput comparison",
              sourceName: "External Laboratory",
              sourceUrl: "https://external.example/throughput",
              fieldCitable: true,
              approvalState: "approved",
            }],
          },
        ],
        dimensions: [],
      }],
    },
    technicalComparisons: { profiles: [] },
    productLaunches: [{ id: "competitor-system", competitor: "Competitor", product: "Competitor System" }],
    eligibleLaunchIds: new Set(["competitor-system"]),
  };
}

test("claim candidates preserve exact comparator wording and use only field-citable supporting records", () => {
  const result = transformer.transformProductComparatorClaims(fixtureOptions());
  const supported = result.candidates.find((candidate) => candidate.dimension === "Operator steps");
  assert.equal(supported.claimText, "Waters System reduces operator steps versus Competitor System.");
  assert.equal(supported.status, "supported");
  assert.equal(supported.approvalState, "in-review");
  assert.equal(supported.fieldUsable, true);
  assert.ok(supported.supportingEvidence.length >= 1);
  assert.ok(supported.supportingEvidence.every((record) => record.fieldCitable === true));
});

test("a spec advantage without citable proof remains a non-field-usable gap", () => {
  const result = transformer.transformProductComparatorClaims(fixtureOptions());
  const gap = result.candidates.find((candidate) => candidate.dimension === "Flow-cell volume");
  assert.equal(gap.status, "gap");
  assert.equal(gap.fieldUsable, false);
  assert.equal(gap.claimEligible, false);
  assert.match(gap.studyRequiredBeforeFieldUse, /controlled common-condition study/i);
  assert.ok(result.gapQueue.some((record) => record.id === gap.id && record.consumer === "Prompt 3"));
  assert.ok(result.claimControlClaims.every((record) => record.id !== gap.id));
});

test("blocked approval prevents a citable spec candidate from becoming a Claim Control claim", () => {
  const result = transformer.transformProductComparatorClaims(fixtureOptions());
  const blocked = result.candidates.find((candidate) => candidate.dimension === "Sample throughput");
  assert.equal(blocked.status, "supported", "support status is based only on whether citable proof backs the wording");
  assert.equal(blocked.approvalState, "blocked");
  assert.equal(blocked.fieldUsable, false);
  assert.ok(result.claimControlClaims.every((record) => record.id !== blocked.id));
  assert.ok(result.gapQueue.some((record) => record.id === blocked.id && record.queueReason === "approval-blocked"));
});

test("the current Product Comparator advantages become gaps when their records are not field-citable", async () => {
  const [productComparisonsRaw, technicalComparisonsRaw, productLaunches, historicalProducts, linkHealth] = await Promise.all([
    readFile(new URL("data/product_comparisons.json", root), "utf8").then(JSON.parse),
    readFile(new URL("data/technical_comparisons.json", root), "utf8").then(JSON.parse),
    readFile(new URL("data/product_launches.json", root), "utf8").then(JSON.parse),
    readFile(new URL("data/historical_product_catalog.json", root), "utf8").then(JSON.parse),
    readFile(new URL("data/link_health.json", root), "utf8").then(JSON.parse),
  ]);
  const linkHealthIndex = governance.buildLinkHealthIndex(linkHealth);
  const productComparisons = governance.normalizeDataset(productComparisonsRaw, { datasetName: "product_comparisons", linkHealthIndex });
  const technicalComparisons = governance.normalizeDataset(technicalComparisonsRaw, { datasetName: "technical_comparisons", linkHealthIndex });
  const launches = [...productLaunches.launches, ...historicalProducts.products];
  const result = transformer.transformProductComparatorClaims({
    productComparisons,
    technicalComparisons,
    productLaunches: launches,
    eligibleLaunchIds: new Set(launches.map((launch) => launch.id)),
    deriveFieldCitable: (record) => governance.deriveFieldCitable(record, { datasetName: "product_comparator_claim_evidence", linkHealthIndex }),
  });

  const watersById = new Map(productComparisons.watersSystems.map((product) => [product.id, product]));
  const expectedStrengthCount = productComparisons.launchComparisons.reduce((total, comparison) => total + (watersById.get(comparison.closestWatersId)?.strengths?.length || 0), 0);
  assert.equal(result.candidates.filter((candidate) => candidate.advantageType === "product-strength").length, expectedStrengthCount, "every Waters comparator strength becomes a candidate for its curated pair");
  assert.ok(result.candidates.some((candidate) => candidate.claimText === "Both vendors publish UHPLC-scale low-volume cells; Waters lists the smaller nominal standard-cell volume."));
  assert.ok(result.candidates.some((candidate) => /ACQUITY Premier's sourced differentiation is scientific/.test(candidate.claimText)));
  assert.ok(result.candidates.every((candidate) => candidate.status === "gap"));
  assert.equal(result.gapQueue.length, result.candidates.length);
  assert.equal(result.claimControlClaims.length, 0);
});

test("Claim Control renders only governed supported candidates in the requested five-column table", async () => {
  const [app, index] = await Promise.all([
    readFile(new URL("app.js", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
  ]);
  assert.match(index, /product-comparator-claim-transformer\.js/);
  for (const heading of ["Exact wording", "Applicable proof", "Blocked evidence", "Approval state", "Study required before field use"]) {
    assert.match(app, new RegExp(`<th>${heading}<\\/th>`));
  }
  assert.match(app, /supportedClaims\.map\(\(claim\)/);
  assert.match(app, /data-claim-status="supported" data-field-usable="true"/);
  assert.match(app, /Gap wording is withheld from this table and remains only in the shared gapQueue/);
  assert.match(app, /gapQueue\.splice\(0, gapQueue\.length, \.\.\.transformation\.gapQueue\)/);
  assert.match(app, /gapQueue: model\.gapQueue/);
  const winsTransformer = app.match(/function headToHeadWins[\s\S]*?\n}/)?.[0] || "";
  assert.match(winsTransformer, /productComparatorSupportedClaims/);
  assert.match(winsTransformer, /candidate\.fieldUsable === true/);
  assert.doesNotMatch(winsTransformer, /advantagePattern|Analyst\/rule-based comparison of published values/);
  const productComparatorRenderer = app.match(/function renderProductComparator\(\)[\s\S]*?\n}/)?.[0] || "";
  assert.doesNotMatch(productComparatorRenderer, /ProductComparatorClaimTransformer|pmmProductComparatorClaimTransformation|gapQueue/, "Product Management comparator rendering remains unchanged");
});

test("the Product Comparator transformer and PMM rendering entry points are mirrored for deployment", async () => {
  const [sourceTransformer, deployTransformer, sourceApp, deployApp, sourceIndex, deployIndex] = await Promise.all([
    readFile(new URL("product-comparator-claim-transformer.js", root), "utf8"),
    readFile(new URL("deploy-site/product-comparator-claim-transformer.js", root), "utf8"),
    readFile(new URL("app.js", root), "utf8"),
    readFile(new URL("deploy-site/app.js", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("deploy-site/index.html", root), "utf8"),
  ]);
  assert.equal(deployTransformer, sourceTransformer);
  assert.equal(deployApp, sourceApp);
  assert.equal(deployIndex, sourceIndex);
});
