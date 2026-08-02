import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

const require = createRequire(import.meta.url);
const methodology = require("../competitive-methodology.js");
const intelligence = JSON.parse(await readFile(new URL("../data/intelligence.json", import.meta.url), "utf8"));
const filings = JSON.parse(await readFile(new URL("../data/filing_insights.json", import.meta.url), "utf8"));
const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");
const pptxSource = await readFile(new URL("../scripts/build_leadership_pptx.mjs", import.meta.url), "utf8");

const agilentPress = (title, date, url) => ({ competitor: "Agilent", title, date, url, sourceName: "Agilent press release" });

test("same-issuer press releases count as one source family", () => {
  const grouped = methodology.groupEvidenceByFamily([
    agilentPress("Launch A", "2026-01-01", "https://www.agilent.com/about/newsroom/a"),
    agilentPress("Launch B", "2026-02-01", "https://www.agilent.com/about/newsroom/b"),
    agilentPress("Launch C", "2026-03-01", "https://www.agilent.com/about/newsroom/c"),
    agilentPress("Launch D", "2026-04-01", "https://www.agilent.com/about/newsroom/d"),
  ], "Agilent");
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].records.length, 4);
});

test("multiple insights from one SEC filing count as one source family", () => {
  const url = "https://www.sec.gov/Archives/edgar/data/1090872/filing.htm";
  const grouped = methodology.groupEvidenceByFamily([
    { competitor: "Agilent", title: "LC growth", date: "2026-06-01", sourceUrl: url, filingType: "10-Q" },
    { competitor: "Agilent", title: "CrossLab growth", date: "2026-06-01", sourceUrl: url, filingType: "10-Q" },
  ], "Agilent");
  assert.equal(grouped.length, 1);
});

test("issuer press releases plus its own filing cannot earn High inference confidence", () => {
  const result = methodology.assessInference([
    agilentPress("Launch A", "2026-01-01", "https://www.agilent.com/about/newsroom/a"),
    { competitor: "Agilent", title: "LC growth", date: "2026-06-01", sourceUrl: "https://www.sec.gov/Archives/a.htm", filingType: "10-Q" },
  ], "Agilent");
  assert.notEqual(result.label, "High");
  assert.equal(result.externalFamilyCount, 0);
  assert.match(result.limitation, /insufficient independent corroboration/i);
});

test("duplicate URLs and syndicated copies are deduplicated", () => {
  const records = methodology.dedupeEvidence([
    { title: "Launch A", date: "2026-01-01", url: "https://example.com/a?utm_source=x" },
    { title: "Launch A", date: "2026-01-01", url: "https://example.com/a#details" },
    { title: "Partner restates Launch A", date: "2026-01-01", url: "https://partner.example/a", announcementId: "launch-a" },
    { title: "Launch A", date: "2026-01-01", url: "https://issuer.example/a", announcementId: "launch-a" },
  ]);
  assert.equal(records.length, 2);
});

test("business magnitude remains explicitly unquantified without internal Waters data", () => {
  const magnitude = methodology.unquantifiedMagnitude({ affectedSegment: "Biopharma" });
  assert.equal(magnitude.status, "UNQUANTIFIED — validation required");
  assert.equal(magnitude.exposureBand, "Unquantified");
  assert.ok(magnitude.requiredInternalData.includes("installed base"));
});

test("recommendations carry owners, options, final gates, effort, internal evidence, and magnitude without unsupported deadlines", () => {
  assert.equal(intelligence.recommendations.length, 3);
  intelligence.recommendations.forEach((decision) => {
    assert.ok(decision.decisionOwners);
    assert.equal(Object.hasOwn(decision, "decisionDue"), false);
    assert.ok(decision.decisionDeliverable);
    assert.ok(decision.decisionOptions.length >= 4);
    assert.match(decision.decisionGate, /go.no-go|only if/i);
    assert.ok(decision.engineeringValidationEffort);
    assert.ok(decision.outstandingInternalEvidence.length);
    assert.equal(decision.businessMagnitude.status, "UNQUANTIFIED — validation required");
  });
  const oligo = intelligence.recommendations.find((decision) => /oligonucleotide/.test(decision.title));
  assert.match(oligo.decisionDeliverable, /package.*build.*partner.*monitor.*stop/i);
  assert.doesNotMatch(oligo.decisionDeliverable, /dossier/i);
});

test("Revvity acquisition and filing records are not attributed to PerkinElmer", () => {
  const acd = filings.companyCorporateMoves.flatMap((group) => group.items.map((item) => ({ ...item, competitor: group.competitor })))
    .find((item) => /ACD\/Labs/.test(item.name));
  assert.equal(acd.competitor, "Revvity");
  const revvityInsight = filings.insights.find((item) => item.id === "revvity-software-ai-life-sciences-2026");
  assert.equal(revvityInsight.competitor, "Revvity");
});

test("web and exports use the same snapshot and inference vocabulary", () => {
  assert.match(appSource, /snapshotMetadata\(state\.data\)/);
  assert.match(pptxSource, /snapshotMetadata\(intelligence\)/);
  assert.doesNotMatch(appSource, /<span>Alternative reading<\/span>/);
  assert.doesNotMatch(appSource, /<span>Falsifier \/ signal to watch<\/span>/);
  assert.doesNotMatch(appSource, /Business impact.*Unquantified/i);
  assert.doesNotMatch(appSource, /Evidence limitation:/);
  assert.doesNotMatch(appSource, /Why the inference confidence is/);
  assert.doesNotMatch(appSource, /\$\{breakdown\.total\}\/100/);
  assert.doesNotMatch(pptxSource, /BUSINESS IMPACT · UNQUANTIFIED/i);
  assert.match(pptxSource, /package, build, partner, monitor, or stop/i);
});

test("SCIEX intent explicitly avoids unsupported HRMS depth", () => {
  assert.match(appSource, /(?:this does not verify|is not verified by the current evidence).*broader HRMS depth|broader HRMS depth.*(?:this does not verify|is not verified by the current evidence)/i);
  assert.match(appSource, /Any claim about HRMS depth remains unverified/i);
});

test("every named competitor hypothesis includes an alternative reading and falsifier", () => {
  const block = appSource.match(/const interpretationChecks = \{([\s\S]*?)\n  \}\[competitor\] \|\| \{\};/);
  assert.ok(block, "competitor interpretation-check block should be present");
  for (const competitor of ["Agilent", "Thermo Fisher", "Shimadzu", "SCIEX", "PerkinElmer"]) {
    assert.match(block[1], new RegExp(`[\"']?${competitor}[\"']?\\s*:`));
  }
  assert.equal((block[1].match(/\balternative:/g) || []).length, 5);
  assert.equal((block[1].match(/\bfalsifier:/g) || []).length, 5);
});
