import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

const require = createRequire(import.meta.url);
const contract = require("../pmm-data-contract.js");
const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");

function decision(id, { supported = true, score = 50 } = {}) {
  return {
    id,
    competitor: id,
    customerCriteriaSources: supported ? 1 : 0,
    exactSources: supported ? [{ url: `https://evidence.example/${id}` }] : [],
    priorityScore: score,
    confidence: 70,
  };
}

function claim(id, readiness, classificationLabel = "Analyst/rule-based inference") {
  return {
    id,
    audience: "Filtered audience",
    buyingCriterion: "Filtered criterion",
    readiness: { value: readiness },
    classificationLabel,
  };
}

test("All Markets PMM KPI collections reconcile with their displayed destinations", () => {
  const positioningDecisions = contract.selectPositioningDecisions([
    decision("a", { score: 90 }),
    decision("b", { score: 80 }),
    decision("c", { score: 70 }),
    decision("unsupported", { supported: false, score: 100 }),
  ]);
  const claimRows = [
    claim("1", "Legally unapproved"),
    claim("2", "Legally unapproved"),
    claim("3", "Missing"),
  ];
  const visibleClaimRows = contract.filterClaimRows(claimRows, {
    readiness: "All",
    audience: "All",
    classification: "All",
  });
  const customerLanguageRecords = contract.uniqueUrlRecords([
    { url: "https://customer.example/post?utm_source=a" },
    { url: "https://customer.example/post#reply" },
    { url: "https://customer.example/other" },
  ]);
  const appendix = contract.consolidateAppendixGroups([
    { title: "One", records: [{ url: "https://source.example/a?utm_campaign=x" }, { url: "https://source.example/b" }] },
    { title: "Two", records: [{ url: "https://source.example/a#detail" }] },
  ]);
  const kpis = contract.buildKpis({ positioningDecisions, visibleClaimRows, customerLanguageRecords, appendix });

  assert.equal(kpis.positioningDecisions, positioningDecisions.length);
  assert.equal(kpis.claimsAwaitingApproval, visibleClaimRows.filter((row) => row.readiness.value === "Legally unapproved").length);
  assert.equal(kpis.customerLanguageSources, customerLanguageRecords.length);
  assert.equal(kpis.directEvidenceSources, appendix.groups.flatMap((group) => group.records).filter((row) => row.canonicalUrl).length);
  assert.deepEqual(kpis, { positioningDecisions: 3, claimsAwaitingApproval: 2, customerLanguageSources: 2, directEvidenceSources: 2 });
});

test("Biopharma PMM KPI collections reconcile after segment filtering", () => {
  const positioningDecisions = contract.selectPositioningDecisions([
    decision("biopharma-supported", { score: 60 }),
    decision("narrative-only", { supported: false, score: 95 }),
  ]);
  const claimRows = [
    claim("bio-observed", "Legally unapproved", "Observed customer or competitor language"),
    claim("bio-missing", "Missing"),
  ];
  const visibleClaimRows = contract.filterClaimRows(claimRows, {
    readiness: "Legally unapproved",
    audience: "All",
    classification: "All",
  });
  const customerLanguageRecords = contract.uniqueUrlRecords([
    { url: "https://customer.example/biopharma" },
    { url: "https://customer.example/biopharma?utm_medium=email" },
  ]);
  const appendix = contract.consolidateAppendixGroups([
    { title: "Biopharma", records: [{ url: "https://source.example/biopharma" }, { url: "https://source.example/biopharma#section" }] },
  ]);
  const kpis = contract.buildKpis({ positioningDecisions, visibleClaimRows, customerLanguageRecords, appendix });

  assert.deepEqual(kpis, { positioningDecisions: 1, claimsAwaitingApproval: 1, customerLanguageSources: 1, directEvidenceSources: 1 });
  assert.equal(visibleClaimRows.length, 1);
  assert.equal(appendix.duplicateRecordCount, 1);
});

test("duplicate URLs are never counted as independent sources", () => {
  const records = contract.uniqueUrlRecords([
    { url: "https://www.example.com/path/?utm_source=newsletter#top" },
    { url: "https://example.com/path" },
  ]);
  assert.equal(records.length, 1);
  assert.equal(records[0].sourceDomain, "example.com");
  assert.equal("independentOrganization" in records[0], false);
});

test("governing-position alignment blocks contradictions and identifies unsupported deviations", () => {
  const governing = "reliable transferable compliant analytical workflows and method transfer";
  assert.equal(contract.evaluateGoverningAlignment("guaranteed fastest hardware", governing).status, "contradiction");
  assert.equal(contract.evaluateGoverningAlignment("brand awareness campaign", governing).status, "unsupported");
  assert.equal(contract.evaluateGoverningAlignment("reliable method-transfer workflow", governing).status, "aligned");
});

test("PMM rendering consumes one canonical workspace model", () => {
  assert.match(appSource, /function buildMarketingWorkspaceModel\(signals\)/);
  assert.match(appSource, /renderMarketingClaimsProof\([\s\S]*?model\.claimRows,[\s\S]*?model\.visibleClaimRows,[\s\S]*?model\.governingPosition,[\s\S]*?model\.productComparatorSupportedClaims,[\s\S]*?model\.comparatorGapQueue,[\s\S]*?\);/);
  assert.match(appSource, /renderMarketingEvidenceAppendix\(model\.appendix\)/);
  assert.match(appSource, /renderMarketingSourceCounts\(model\)/);
  assert.doesNotMatch(appSource, /Claims awaiting approval<\/span><strong>\$\{contexts\.length\}/);
  assert.doesNotMatch(appSource, /Direct evidence sources<\/span><strong>\$\{directEvidenceCount\}/);
});

test("every PMM KPI exposes an accessible calculation tooltip", () => {
  for (const id of [
    "proof-priorities",
    "claims-awaiting-approval",
    "exact-customer-sources",
    "direct-evidence-sources",
  ]) assert.match(appSource, new RegExp(`id: "${id}"`));
  assert.match(appSource, /aria-describedby="\$\{tooltipId\}"/);
  assert.match(appSource, /class="pmm-metric-tooltip" role="tooltip"/);
  assert.match(appSource, /Unit: displayed gap cards/);
  assert.match(appSource, /Unit: displayed rows/);
  assert.match(appSource, /Unit: unique URLs/);
  assert.match(appSource, /Global and claims-registry filters apply/);
});

test("the PMM contract runtime is loaded and mirrored for deployment", async () => {
  const [sourceContract, deployContract, sourceIndex, deployIndex] = await Promise.all([
    readFile(new URL("../pmm-data-contract.js", import.meta.url), "utf8"),
    readFile(new URL("../deploy-site/pmm-data-contract.js", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../deploy-site/index.html", import.meta.url), "utf8"),
  ]);
  assert.equal(deployContract, sourceContract);
  assert.equal(deployIndex, sourceIndex);
  assert.match(sourceIndex, /pmm-data-contract\.js/);
});
