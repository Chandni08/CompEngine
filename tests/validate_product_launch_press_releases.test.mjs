import assert from "node:assert/strict";
import test from "node:test";

import { launchDiscoverySourceErrors, launchPressReleaseErrors } from "../scripts/validate_product_launch_press_releases.mjs";

test("accepts an individual official press release", () => {
  const errors = launchPressReleaseErrors({
    id: "sciex-example",
    competitor: "SCIEX",
    sourceName: "SCIEX press release",
    pressReleaseUrl: "https://sciex.com/about-us/press-releases/2026/example-launch",
  });
  assert.deepEqual(errors, []);
});

test("blocks a product page from product-launch evidence", () => {
  const errors = launchPressReleaseErrors({
    id: "shimadzu-product-page",
    competitor: "Shimadzu",
    sourceName: "Shimadzu product page",
    pressReleaseUrl: "https://www.shimadzu.com/an/products/example/index.html",
  });
  assert.ok(errors.some((error) => /individual official press release/.test(error)));
  assert.ok(errors.some((error) => /sourceName/.test(error)));
});

test("allows a catalog-only product to opt out of launch evidence", () => {
  const errors = launchPressReleaseErrors({
    id: "catalog-only",
    competitor: "Shimadzu",
    sourceName: "Shimadzu product page",
    sourceUrl: "https://www.shimadzu.com/an/products/example/index.html",
    launchEvidenceEligible: false,
  });
  assert.deepEqual(errors, []);
});

test("accepts an official product launch page", () => {
  const errors = launchDiscoverySourceErrors({
    id: "agilent-discovery-example",
    competitor: "Agilent",
    sourceUrl: "https://www.agilent.com/en/product/example",
  });
  assert.deepEqual(errors, []);
});

test("blocks missing, non-official, or non-product launch pages", () => {
  assert.ok(launchDiscoverySourceErrors({ id: "missing-source", competitor: "SCIEX" }).some((error) => /missing sourceUrl/.test(error)));
  assert.ok(launchDiscoverySourceErrors({
    id: "unofficial-source",
    competitor: "Shimadzu",
    sourceUrl: "https://example.com/launch",
  }).some((error) => /official Shimadzu product domain/.test(error)));
  assert.ok(launchDiscoverySourceErrors({
    id: "press-index",
    competitor: "SCIEX",
    sourceUrl: "https://sciex.com/about-us/press-releases",
  }).some((error) => /official product page/.test(error)));
});

test("requires distinct product and press-release pages for launch evidence", () => {
  const sharedUrl = "https://www.shimadzu.com/news/2026/example.html";
  const errors = launchDiscoverySourceErrors({
    id: "duplicate-launch-links",
    competitor: "Shimadzu",
    sourceUrl: sharedUrl,
    pressReleaseUrl: sharedUrl,
  });
  assert.ok(errors.some((error) => /official product page/.test(error)));
  assert.ok(errors.some((error) => /must be distinct/.test(error)));
});
