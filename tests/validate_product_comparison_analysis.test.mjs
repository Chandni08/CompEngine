import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

test("Agilent 1290 Infinity III has a complete Waters decision readout", async () => {
  const comparisons = await readJson("data/product_comparisons.json");
  const record = comparisons.launchComparisons.find(
    (item) => item.launchId === "agilent-1290-infinity-iii-2024",
  );

  assert.ok(record, "pair-specific comparison must exist");
  assert.equal(record.closestWatersId, "acquity-premier-system");
  assert.equal(record.threatLevel, "Medium");
  assert.match(record.impactRationale, /workflow and user-experience challenge/i);
  assert.match(record.pmRead, /InfinityLab Assist/);
  assert.match(record.watersPositioning, /MaxPeak HPS/);
  assert.match(record.evidenceBasis, /No common-condition head-to-head test/i);
  assert.ok(record.dimensions.length >= 4);
  assert.ok(record.positioningMoves.length >= 3);
  assert.ok(record.validationQuestions.length >= 3);
});

test("the exact product pair has sourced technical rows and explicit limits", async () => {
  const comparisons = await readJson("data/technical_comparisons.json");
  const profile = comparisons.profiles.find(
    (item) => item.launchId === "agilent-1290-infinity-iii-2024"
      && item.watersId === "acquity-premier-system",
  );

  assert.ok(profile, "technical profile must exist");
  assert.ok(profile.rows.length >= 7);
  assert.ok(profile.limitations.length >= 3);
  profile.rows.forEach((row) => {
    assert.ok(row.dimension);
    assert.ok(row.competitorSourceUrl.startsWith("https://"));
    assert.ok(row.watersSourceUrl.startsWith("https://"));
    assert.ok(row.interpretation);
  });
});

test("technical profiles prioritize method performance and identify controlled-test gaps", async () => {
  const comparisons = await readJson("data/technical_comparisons.json");
  const lcProfiles = comparisons.profiles.filter((profile) =>
    ["agilent-1290-infinity-iii-2024", "shimadzu-nexera-x4-2026"].includes(profile.launchId));
  const msProfiles = comparisons.profiles.filter((profile) =>
    ["agilent-6230c-lctof-2026", "sciex-novus-v55-2026"].includes(profile.launchId));
  const lcDimensions = [
    /dwell \(delay\) volume/i,
    /extra-column dispersion/i,
    /injection precision/i,
    /carryover/i,
    /plate efficiency/i,
    /particle and bonding/i,
    /batch-to-batch reproducibility/i,
    /USP L-column class/i,
  ];
  const msDimensions = [
    /sensitivity \/ LOQ/i,
    /polarity-switching speed/i,
    /dwell allocation \/ points across peak/i,
    /cross-talk/i,
    /linear dynamic range/i,
  ];
  const allowedEvidenceTypes = new Set([
    "verified",
    "vendor-claim",
    "conditions-differ",
    "mixed",
    "requires-controlled-testing",
  ]);

  assert.equal(lcProfiles.length, 2);
  assert.equal(msProfiles.length, 2);
  lcProfiles.forEach((profile) => {
    const dimensions = profile.rows.map((row) => row.dimension).join(" | ");
    lcDimensions.forEach((expected) => assert.match(dimensions, expected));
  });
  msProfiles.forEach((profile) => {
    const dimensions = profile.rows.map((row) => row.dimension).join(" | ");
    msDimensions.forEach((expected) => assert.match(dimensions, expected));
  });

  comparisons.profiles.flatMap((profile) => profile.rows).forEach((row) => {
    assert.ok(allowedEvidenceTypes.has(row.evidenceType), `unsupported evidenceType: ${row.evidenceType}`);
    const combinedText = `${row.competitorValue} ${row.watersValue} ${row.interpretation}`;
    if (/requires controlled testing/i.test(combinedText)) {
      assert.equal(row.evidenceType, "requires-controlled-testing", row.dimension);
    }
  });
});

test("technical comparison omits the long comparison-basis sentence", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  const deployedApp = await readFile(new URL("deploy-site/app.js", root), "utf8");

  assert.doesNotMatch(app, /resolvedProfile\.comparisonBasis/);
  assert.equal(deployedApp, app);
});

test("technical comparison omits the evidence-quality column", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");

  assert.doesNotMatch(app, /<th>Evidence quality<\/th>/);
  assert.doesNotMatch(app, /class="technical-legend"/);
});
