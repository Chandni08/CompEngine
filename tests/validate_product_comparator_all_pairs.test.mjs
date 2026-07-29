import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

const require = createRequire(import.meta.url);
const comparisonLogic = require("../comparison-logic.js");
const launches = JSON.parse(await readFile(new URL("../data/product_launches.json", import.meta.url))).launches;
const historicalCompetitors = JSON.parse(await readFile(new URL("../data/historical_product_catalog.json", import.meta.url))).products;
const comparisonData = JSON.parse(await readFile(new URL("../data/product_comparisons.json", import.meta.url)));
const historicalWaters = JSON.parse(await readFile(new URL("../data/historical_waters_catalog.json", import.meta.url))).products;
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

function uniqueWatersSystems() {
  const seenIds = new Set();
  const seenNames = new Set();
  return [...comparisonData.watersSystems, ...historicalWaters].filter((item) => {
    const name = String(item.product || "").trim().toLowerCase();
    if (!item.id || seenIds.has(item.id) || seenNames.has(name)) return false;
    seenIds.add(item.id);
    seenNames.add(name);
    return true;
  });
}

test("every comparator selection returns a pair-specific impact and technical result", () => {
  const competitorProducts = [...launches, ...historicalCompetitors];
  const watersSystems = uniqueWatersSystems();
  let checkedPairs = 0;

  competitorProducts.forEach((launch) => {
    const curated = comparisonData.launchComparisons.find((item) => item.launchId === launch.id);
    watersSystems.forEach((waters) => {
      const result = comparisonLogic.resolvePairComparison(launch, waters, curated);
      const technical = comparisonLogic.buildGeneratedTechnicalProfile(launch, waters);
      assert.ok(result.impactValue && !/not yet assessed/i.test(result.impactValue), `${launch.id} × ${waters.id} has an impact result`);
      assert.ok(result.pmRead?.includes(launch.product) || curated?.closestWatersId === waters.id, `${launch.id} × ${waters.id} names the selected competitor product`);
      assert.ok(result.watersPositioning?.includes(waters.product) || curated?.closestWatersId === waters.id, `${launch.id} × ${waters.id} names the selected Waters product`);
      assert.deepEqual(technical.rows, [], `${launch.id} × ${waters.id} does not fabricate missing technical rows`);
      checkedPairs += 1;
    });
  });

  assert.ok(checkedPairs > 6000, `audited ${checkedPairs} selectable pairs`);
  assert.doesNotMatch(app, /Impact not yet assessed|No pair-specific impact assessment is loaded/i);
});

test("non-default Waters selections do not reuse another Waters assessment", () => {
  const launch = [...launches, ...historicalCompetitors].find((item) => item.id === "agilent-1290-infinity-iii-2024");
  const curated = comparisonData.launchComparisons.find((item) => item.launchId === launch.id);
  const differentWaters = uniqueWatersSystems().find((item) => item.id !== curated.closestWatersId);
  const result = comparisonLogic.resolvePairComparison(launch, differentWaters, curated);
  assert.equal(result.generatedForPair, true);
  assert.match(result.pmRead, new RegExp(differentWaters.product.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
