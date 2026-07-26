import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateMarketApplicationSources } from "../scripts/validate_market_application_sources.mjs";

test("every market filter has multiple first-party non-PubMed sources", async () => {
  const catalog = JSON.parse(await readFile(new URL("../data/market_application_sources.json", import.meta.url), "utf8"));
  assert.deepEqual(validateMarketApplicationSources(catalog), []);
});

test("a market with inadequate or PubMed-only coverage is rejected", () => {
  const catalog = {
    marketFilters: ["Clinical"],
    sources: [{
      id: "bad-source",
      name: "PubMed",
      publisher: "Example",
      marketSegments: ["Clinical"],
      sourceType: "Research metadata",
      signalCategory: "Publications",
      description: "Example",
      whatToMeasure: "Example",
      refreshCadence: "Weekly",
      accessType: "API",
      url: "https://pubmed.ncbi.nlm.nih.gov/",
      whyItMatters: "Example",
    }],
  };
  const errors = validateMarketApplicationSources(catalog).join("\n");
  assert.match(errors, /duplicates PubMed coverage/);
  assert.match(errors, /at least 3 are required/);
});
