import assert from "node:assert/strict";
import test from "node:test";

import { catalogProductErrors, historicalCatalogErrors } from "../scripts/validate_historical_product_catalog.mjs";

const validProduct = {
  id: "agilent-example-2006",
  introducedYear: 2006,
  competitor: "Agilent",
  product: "Example LC",
  technology: "LC",
  sourceName: "Agilent product history",
  sourceUrl: "https://www.agilent.com/about/example.html",
  confidence: 98,
};

test("accepts a sourced product from an official manufacturer domain", () => {
  assert.deepEqual(catalogProductErrors(validProduct), []);
});

test("blocks non-official evidence and unlabeled pre-window products", () => {
  const errors = catalogProductErrors({
    ...validProduct,
    introducedYear: 1995,
    sourceUrl: "https://example.com/product",
  });
  assert.ok(errors.some((error) => /legacyReference/.test(error)));
  assert.ok(errors.some((error) => /official Agilent domain/.test(error)));
});

test("blocks a historical record duplicated by a current launch", () => {
  const catalog = {
    coverage: {
      startYear: 1996,
      endYear: 2026,
      definition: "Named systems",
      datePolicy: "Manufacturer introduction year",
      limitations: "No module-level SKUs",
    },
    products: [
      validProduct,
      ...["Shimadzu", "Thermo Fisher", "SCIEX", "PerkinElmer"].flatMap((competitor, groupIndex) =>
        Array.from({ length: 5 }, (_, index) => ({
          ...validProduct,
          id: `${competitor.toLowerCase().replaceAll(" ", "-")}-${index}`,
          competitor,
          product: `${competitor} example ${index}`,
          sourceUrl: `https://www.${competitor === "Thermo Fisher" ? "thermofisher" : competitor.toLowerCase()}.com/example`,
        })),
      ),
      ...Array.from({ length: 4 }, (_, index) => ({ ...validProduct, id: `agilent-${index}`, product: `Agilent example ${index}` })),
    ],
  };
  const errors = historicalCatalogErrors(catalog, [{ id: "current-example", competitor: "Agilent", product: "Example LC" }]);
  assert.ok(errors.some((error) => /duplicates a historical catalog product/.test(error)));
});
