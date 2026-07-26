import assert from "node:assert/strict";
import test from "node:test";

import {
  cachedValidationErrors,
  categoryEvidenceCoverageErrors,
  keywordCoverageErrors,
  redditValidationUrl,
  vendorEvidenceCoverageErrors,
} from "../scripts/validate_customer_voice_sources.mjs";

test("accepts keywords that are present in the exact source", () => {
  const errors = keywordCoverageErrors(
    { sourceKeywords: ["UPLC", "high pressure"] },
    "Update: UPLC Waters high pressure problem - Troubleshooting",
    "pressure source",
  );
  assert.deepEqual(errors, []);
});

test("blocks a keyword that is absent from the exact source", () => {
  const errors = keywordCoverageErrors(
    { sourceKeywords: ["high pressure", "leak"] },
    "Update: UPLC Waters high pressure problem - Troubleshooting",
    "pressure source",
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /does not contain required keyword "leak"/);
});

test("validates Reddit discussion text through the full RSS representation", () => {
  assert.equal(
    redditValidationUrl("https://www.reddit.com/r/CHROMATOGRAPHY/comments/example/thread/"),
    "https://www.reddit.com/r/CHROMATOGRAPHY/comments/example/thread/.rss?limit=500",
  );
});

test("requires recent vendor evidence to include a verified vendor or product term", () => {
  const feedback = {
    id: "agilent-example",
    company: "Agilent",
    evidenceRecords: [{ sourceDate: "2026-01-02", sourceKeywords: ["new HPLC system", "routine work"] }],
  };
  assert.equal(vendorEvidenceCoverageErrors(feedback, "2026-07-13").length, 1);
  feedback.evidenceRecords[0].sourceKeywords = ["Agilent", "1260", "repairability"];
  assert.deepEqual(vendorEvidenceCoverageErrors(feedback, "2026-07-13"), []);
});

test("recognizes Waters LC-MS product and software names as vendor-specific evidence", () => {
  const feedback = {
    id: "waters-lcms-example",
    company: "Waters",
    evidenceRecords: [{ sourceDate: "2026-06-09", sourceKeywords: ["Synapt", "MassLynx", "fluidics stopped"] }],
  };
  assert.deepEqual(vendorEvidenceCoverageErrors(feedback, "2026-07-23"), []);
});

test("prevents pressure evidence from being assigned to carryover", () => {
  const feedback = {
    id: "waters-theme-example",
    category: "Carryover / autosampler",
    evidenceRecords: [{ label: "Pressure discussion", sourceKeywords: ["Waters UPLC", "high and unstable pressure"] }],
  };
  assert.equal(categoryEvidenceCoverageErrors(feedback).length, 1);
  feedback.evidenceRecords[0].sourceKeywords = ["ACQUITY UPLC", "sample carryover", "needle wash"];
  assert.deepEqual(categoryEvidenceCoverageErrors(feedback), []);
});

test("uses only fresh full-source cache entries covering every displayed keyword", () => {
  const record = { sourceKeywords: ["sample carryover", "needle wash"] };
  const cacheEntry = {
    validationMethod: "full_source_text",
    validatedAt: "2026-07-20",
    validatedKeywords: ["sample carryover", "needle wash"],
  };
  assert.deepEqual(cachedValidationErrors(record, cacheEntry, 30, new Date("2026-07-20T12:00:00Z")), []);
  cacheEntry.validatedKeywords = ["sample carryover"];
  assert.match(cachedValidationErrors(record, cacheEntry, 30, new Date("2026-07-20T12:00:00Z"))[0], /needle wash/);
  cacheEntry.validatedKeywords = ["sample carryover", "needle wash"];
  cacheEntry.validatedAt = "2026-05-01";
  assert.match(cachedValidationErrors(record, cacheEntry, 30, new Date("2026-07-20T12:00:00Z"))[0], /days old/);
});
