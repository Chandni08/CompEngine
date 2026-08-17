import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Market Choice renders exactly once before competitor-specific narratives inside the eight-section spine", async () => {
  const [app, index] = await Promise.all([
    readFile(new URL("app.js", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
  ]);
  const renderer = app.match(/function renderMarketingCompetitiveNarrative[\s\S]*?\n}\n\nconst pmmActivationAssetTypes/)?.[0] || "";
  const workspace = index.match(/<div id="marketingWorkspace"[\s\S]*?<section id="leadership-brief"/)?.[0] || "";
  const sectionCount = (workspace.match(/class="panel pmm-primary-section"/g) || []).length;

  assert.equal(sectionCount, 8);
  assert.equal((renderer.match(/pmmMarketChoiceMarkup\(choice\)/g) || []).length, 2, "one normal render and one competitor-empty render path are expected");
  assert.ok(renderer.indexOf("pmmMarketChoiceMarkup(choice)") < renderer.indexOf("One selling motion per Competitor Intent record"));
  assert.match(app, /const governedSignals = pmmGovernedRecords\(signals\)/);
  assert.match(app, /const marketChoice = pmmMarketChoice\(contexts, governingPosition, governedSignals\)/);
  assert.match(app, /state\.marketingMarketChoice = marketChoice/);
});

test("the Market Choice model implements all three Cs", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  const markup = app.match(/function pmmMarketChoiceMarkup[\s\S]*?\n}\n\nfunction renderMarketingCompetitiveNarrative/)?.[0] || "";

  for (const field of [
    "Customer",
    "Job",
    "Unmet need",
    "Current workaround",
    "Switching trigger",
    "Company",
    "Waters capabilities",
    "Proof",
    "Installed-base advantage",
    "Limitations",
    "Competition",
  ]) assert.match(markup, new RegExp(field));

  assert.match(app, /Commercial installed-base advantage is not established/);
  assert.match(markup, /Governing-position inference/);
  assert.match(markup, /Proposed — not approved/);
});

test("the competitor onion includes form rivals, resource alternatives, and inertia", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  const model = app.match(/function pmmMarketChoice\([\s\S]*?\n}\n\nfunction pmmMarketChoiceLinksMarkup/)?.[0] || "";

  assert.match(app, /marketingBattlecardCompetitors = \["Agilent", "Thermo Fisher", "Shimadzu", "SCIEX"\]/);
  assert.match(model, /pmmMarketChoiceRelevantFormAlternatives/);
  for (const alternative of [
    "Outsource testing",
    "Use a CRO/CDMO",
    "Alternative analytical workflow",
    "Do nothing / keep the validated method",
    "Extend the existing system",
    "Defer replacement",
  ]) assert.match(model, new RegExp(alternative.replace(/[\/]/g, "\\$&")));

  assert.match(model, /name: "Form rivals"/);
  assert.match(model, /name: "Category \/ resource alternatives"/);
  assert.match(model, /name: "Inertia"/);
});

test("every alternative exposes decision fields and governed evidence states", async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL("app.js", root), "utf8"),
    readFile(new URL("styles.css", root), "utf8"),
  ]);
  const markup = app.match(/function pmmMarketChoiceAlternativeMarkup[\s\S]*?\n}\n\nfunction pmmMarketChoiceMarkup/)?.[0] || "";

  for (const field of [
    "Why customers choose it",
    "Segment and buying situation",
    "Primary objection to switching",
    "Waters response",
    "Required proof",
    "Evidence confidence",
  ]) assert.match(markup, new RegExp(field));

  assert.match(app, /Strategic hypothesis requiring validation/);
  assert.match(markup, /pmm-market-alternative-\$\{escapeHtml\(alternative\.classification\)\}/);
  assert.match(markup, /alternative\.classification === "hypothesis"/);
  assert.match(styles, /\.pmm-evidence-type-hypothesis[\s\S]*?border-style: dashed/);
  assert.match(styles, /\.pmm-market-alternative-hypothesis[\s\S]*?border-style: dashed/);
  assert.match(markup, /Approval not established/);
});

test("form rivals remain source-linked and negative customer records cannot become choice strengths", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  const formLogic = app.match(/function pmmMarketChoiceFormAlternative[\s\S]*?\n}\n\nfunction pmmMarketChoiceRelevantFormAlternatives/)?.[0] || "";

  assert.match(formLogic, /context\.evidenceLinks/);
  assert.match(formLogic, /item\.sentiment === "Positive"/);
  assert.match(formLogic, /negative or neutral records are treated as objections, not strengths/);
  assert.match(app, /pmmMarketChoiceLinksMarkup\(alternative\.sources\)/);
  assert.match(app, /target="_blank" rel="noreferrer"/);
  assert.match(app, /function pmmIsDirectCustomerChoiceLink/);
  assert.match(app, /link\.sourceType === "regulatory"/);
  assert.match(app, /pmmSourceHostname\(link\)\.includes\("fda\.gov"\)/);
});

test("unsupported alternatives cannot imply prevalence or observed demand", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  const hypothesis = app.match(/function pmmMarketChoiceHypothesisAlternative[\s\S]*?\n}\n\nfunction pmmMarketChoiceFormAlternative/)?.[0] || "";

  assert.match(hypothesis, /classification: "hypothesis"/);
  assert.match(hypothesis, /No direct customer-choice or win\/loss evidence was located/);
  assert.match(app, /Market prevalence unavailable/);
  assert.match(app, /do not establish market share, alternative frequency, or commercial attractiveness/);
  assert.match(app, /Outsource testing[\s\S]*?Strategic hypothesis/);
  assert.match(app, /Use a CRO\/CDMO[\s\S]*?Strategic hypothesis/);
});

