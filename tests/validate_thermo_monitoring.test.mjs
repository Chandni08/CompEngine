import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { thermoMonitoringErrors } from "../scripts/validate_thermo_monitoring.mjs";

const root = new URL("../", import.meta.url);
const readJson = async (file) => JSON.parse(await readFile(new URL(file, root), "utf8"));

test("the shipped Thermo monitor covers Dionex IC and Vanquish Neo nano-LC", async () => {
  const errors = thermoMonitoringErrors(
    await readJson("data/thermo_monitoring_families.json"),
    await readJson("data/competitor_monitors.json"),
    await readJson("data/source_catalog.json"),
    await readJson("data/historical_product_catalog.json"),
  );
  assert.deepEqual(errors, []);
});

test("missing segments and non-official product URLs are rejected", async () => {
  const registry = await readJson("data/thermo_monitoring_families.json");
  const broken = structuredClone(registry);
  broken.families[0].marketSegments = ["Pharma"];
  broken.families[0].productPageUrls = ["https://example.com/integrion.html"];
  const errors = thermoMonitoringErrors(
    broken,
    await readJson("data/competitor_monitors.json"),
    await readJson("data/source_catalog.json"),
    await readJson("data/historical_product_catalog.json"),
  );
  assert.ok(errors.some((error) => /market segment tags/.test(error)));
  assert.ok(errors.some((error) => /official Thermo HTTPS pages/.test(error)));
});
