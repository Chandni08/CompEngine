import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { validateDataDirectory } from "../scripts/validate_source_title_links.mjs";

test("all production title-linked source records pass the integrity gate", () => {
  const dataDirectory = path.resolve(new URL("../data", import.meta.url).pathname);
  const result = validateDataDirectory(dataDirectory);
  assert.deepEqual(result.errors, []);
  assert.ok(result.links >= 400, "the page-wide gate must inspect every title-bearing source family");
});

test("the gate blocks truncated and unrelated panel titles", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "source-title-integrity-"));
  try {
    fs.writeFileSync(path.join(directory, "intelligence.json"), JSON.stringify({ signals: [
      {
        title: "PerkinElmer Publishes 2025 Sustainability Report, Advancing its Commitment to Cleaner Science and a",
        sourceUrl: "https://www.perkinelmer.com/corporate-and-newsroom/project-farma-acquires-simotech",
        sourceName: "PerkinElmer official newsroom",
        signalType: "Press release",
      },
    ] }));
    const result = validateDataDirectory(directory);
    assert.ok(result.errors.some((error) => error.includes("is incomplete")));
    assert.ok(result.errors.some((error) => error.includes("title/permalink mismatch")));
    assert.ok(result.errors.some((error) => error.includes("verification metadata")));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
