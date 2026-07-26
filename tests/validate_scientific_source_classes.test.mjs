import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { scientificSourceClassErrors } from "../scripts/validate_scientific_source_classes.mjs";

const root = new URL("../", import.meta.url);
const readJson = async (file) => JSON.parse(await readFile(new URL(file, root), "utf8"));

test("required LC-MS journals, conferences, and regulatory sources are registered", async () => {
  const errors = scientificSourceClassErrors(
    await readJson("data/journal_sources.json"),
    await readJson("data/conference_sources.json"),
    await readJson("data/source_catalog.json"),
  );
  assert.deepEqual(errors, []);
});

test("invalid publisher URLs and missing market tags are rejected", async () => {
  const journals = await readJson("data/journal_sources.json");
  const conferences = await readJson("data/conference_sources.json");
  const catalog = await readJson("data/source_catalog.json");
  const broken = structuredClone(journals);
  const source = broken.sources.find((item) => item.id === "analytical-chemistry-acs");
  source.homepage = "https://example.com/journal";
  source.marketSegments = [];
  const errors = scientificSourceClassErrors(broken, conferences, catalog);
  assert.ok(errors.some((error) => /official HTTPS host/.test(error)));
  assert.ok(errors.some((error) => /has no marketSegments/.test(error)));
});
