import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const candidatesStart = app.indexOf("function overallTrendCandidates()")
const narrativeStart = app.indexOf("function horizonTrendNarrative(candidate)", candidatesStart);
const rendererStart = app.indexOf("function renderOverallTrendAnalysis(signals)", narrativeStart);

assert.ok(candidatesStart >= 0, "overall trend candidates function is present");
assert.ok(narrativeStart > candidatesStart, "horizon narrative function follows the candidates");
assert.ok(rendererStart > narrativeStart, "overall trend renderer follows the narrative function");

const runtime = vm.runInNewContext(`
  let filters = { horizon: { value: "30d" } };
  function horizonTrendTitle(title) {
    return String(title || "").replace(/^./, (character) => character.toUpperCase());
  }
  ${app.slice(candidatesStart, rendererStart)}
  ({
    candidates: overallTrendCandidates(),
    narrative: horizonTrendNarrative,
    selectHorizon(value) { filters.horizon.value = value; },
  });
`);

const horizons = ["30d", "60d", "90d", "1y", "3y"];
const fields = ["synthesis", "implication", "action"];

test("every overall trend defines a complete narrative for every horizon", () => {
  for (const candidate of runtime.candidates) {
    assert.equal(Object.keys(candidate.narratives).sort().join(","), horizons.slice().sort().join(","));
    for (const horizon of horizons) {
      for (const field of fields) {
        assert.ok(candidate.narratives[horizon][field].trim(), `${candidate.id} ${horizon} has ${field}`);
      }
    }
  }
});

test("cards never share synthesis, implication, or action copy within a horizon", () => {
  for (const horizon of horizons) {
    runtime.selectHorizon(horizon);
    const narratives = runtime.candidates.map((candidate) => runtime.narrative(candidate));
    for (const field of fields) {
      assert.equal(
        new Set(narratives.map((narrative) => narrative[field])).size,
        runtime.candidates.length,
        `${horizon} ${field} copy is unique for every trend`,
      );
    }
  }
});

test("each trend changes its narrative when the selected horizon changes", () => {
  for (const candidate of runtime.candidates) {
    const signatures = horizons.map((horizon) => {
      runtime.selectHorizon(horizon);
      const narrative = runtime.narrative(candidate);
      return fields.map((field) => narrative[field]).join("\n");
    });
    assert.equal(new Set(signatures).size, horizons.length, `${candidate.id} varies across every horizon`);
  }
});

test("shared fallback copy is removed from the overall trend narrative path", () => {
  assert.doesNotMatch(app, /Do not treat this as a roadmap conclusion yet/);
  assert.doesNotMatch(app, /Review the three newest linked records and classify the signal/);
  assert.doesNotMatch(app.slice(narrativeStart, rendererStart), /const variants =/);
});
