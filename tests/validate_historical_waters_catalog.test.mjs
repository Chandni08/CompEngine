import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { historicalWatersCatalogErrors, watersProductErrors } from "../scripts/validate_historical_waters_catalog.mjs";

test("the shipped Waters catalog passes the deployment validation", async () => {
  const catalog = JSON.parse(await fs.readFile(new URL("../data/historical_waters_catalog.json", import.meta.url), "utf8"));
  const comparisons = JSON.parse(await fs.readFile(new URL("../data/product_comparisons.json", import.meta.url), "utf8"));
  assert.deepEqual(historicalWatersCatalogErrors(catalog, comparisons), []);
});

test("a non-official historical source is rejected", () => {
  const errors = watersProductErrors({
    id: "waters-test-system",
    introducedYear: 2000,
    dateBasis: "Introduction",
    company: "Waters",
    product: "Test System",
    technology: "LC",
    sourceName: "Unverified page",
    sourceUrl: "https://example.com/test",
    confidence: 90,
  });
  assert.ok(errors.some((error) => error.includes("official Waters or SEC domain")));
});
