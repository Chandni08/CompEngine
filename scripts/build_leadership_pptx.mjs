import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";
import leadershipBriefApi from "../leadership-brief-thesis.js";

const OUT_DIR = process.env.LEADERSHIP_PPTX_OUT_DIR || "output";
const PPTX_PATH = process.env.LEADERSHIP_PPTX_PATH || path.join(OUT_DIR, "waters-nextgen-leadership-brief.pptx");
const INTELLIGENCE_PATH = process.env.LEADERSHIP_INTELLIGENCE_PATH
  || new URL("../data/intelligence.json", import.meta.url);
const intelligence = JSON.parse(await fs.readFile(INTELLIGENCE_PATH, "utf8"));
const { leadershipBriefThesis } = leadershipBriefApi;

const asOf = new Date(`${intelligence.asOfDate}T12:00:00Z`);
const asOfDay = String(asOf.getUTCDate()).padStart(2, "0");
const asOfMonthYear = asOf
  .toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
  .toUpperCase();
const asOfLabel = `${asOfDay} ${asOfMonthYear}`;

function trendCount(theme) {
  const trend = intelligence.trends?.themes?.find((item) => item.theme === theme);
  if (!trend?.counts?.["1y"]) {
    throw new Error(`Missing current one-year count for ${theme}`);
  }
  return trend.counts["1y"];
}

const workflowCount = trendCount("Lab automation and software-enabled workflows");
const pfasCount = trendCount("PFAS and environmental contaminant testing");
const oligoCount = trendCount("Oligonucleotide and nucleic-acid analytics");
const formatCount = (value) => value.toLocaleString("en-US");

const C = {
  ink: "#153640",
  teal: "#087F8C",
  aqua: "#45D5C6",
  mint: "#E7F7F3",
  pale: "#F3F8F8",
  line: "#CEDDDF",
  slate: "#60767D",
  amber: "#D58C00",
  amberPale: "#FFF3D4",
  red: "#BA3A42",
  white: "#FFFFFF",
};

function addBox(slide, x, y, w, h, fill = C.white, line = C.line, radius = "rounded-xl") {
  return slide.shapes.add({
    geometry: "roundRect",
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill: line, width: 1 },
    borderRadius: radius,
  });
}

function addRule(slide, x, y, w, h = 4, fill = C.aqua) {
  return slide.shapes.add({
    geometry: "rect",
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill, width: 0 },
  });
}

function addText(slide, value, x, y, w, h, opts = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = String(value);
  shape.text.style = {
    fontSize: opts.fontSize ?? 18,
    typeface: opts.typeface ?? "Aptos",
    bold: opts.bold ?? false,
    color: opts.color ?? C.ink,
    alignment: opts.align ?? "left",
    verticalAlignment: opts.valign ?? "top",
    autoFit: opts.autoFit ?? "shrinkText",
    wrap: "square",
    insets: opts.insets ?? { top: 0, right: 0, bottom: 0, left: 0 },
  };
  return shape;
}

function addEyebrow(slide, value, x = 54, y = 34, w = 520) {
  addText(slide, value.toUpperCase(), x, y, w, 26, {
    fontSize: 14,
    bold: true,
    color: C.teal,
  });
}

function addHeader(slide, title, subtitle, number) {
  addEyebrow(slide, `Leadership brief · ${number}`);
  addText(slide, title, 54, 68, 1165, 62, { fontSize: 38, bold: true });
  if (subtitle) addText(slide, subtitle, 54, 134, 1115, 38, { fontSize: 18, color: C.slate });
  addRule(slide, 54, 186, 1172, 3, C.aqua);
}

function addFooter(slide, number) {
  addText(slide, `WATERS NEXT GEN COMPETITIVE INTELLIGENCE · ${asOfLabel}`, 54, 680, 860, 20, {
    fontSize: 11,
    bold: true,
    color: C.slate,
  });
  addText(slide, String(number).padStart(2, "0"), 1174, 676, 52, 24, {
    fontSize: 13,
    bold: true,
    color: C.teal,
    align: "right",
  });
}

function addStat(slide, x, value, label, note) {
  addBox(slide, x, 330, 354, 218, C.white, C.line);
  addRule(slide, x, 330, 354, 8, C.teal);
  addText(slide, value, x + 24, 360, 306, 70, { fontSize: 46, bold: true, color: C.teal });
  addText(slide, label, x + 24, 430, 306, 44, { fontSize: 20, bold: true });
  addText(slide, note, x + 24, 486, 306, 42, { fontSize: 15, color: C.slate });
}

function addSignalCard(slide, x, y, w, number, category, headline, detail, accent = C.teal) {
  addBox(slide, x, y, w, 146, C.white, C.line);
  addBox(slide, x + 18, y + 18, 42, 42, accent, accent, "rounded-full");
  addText(slide, number, x + 18, y + 26, 42, 24, { fontSize: 16, bold: true, color: C.white, align: "center" });
  addText(slide, category.toUpperCase(), x + 76, y + 17, w - 96, 21, { fontSize: 12, bold: true, color: accent });
  addText(slide, headline, x + 76, y + 43, w - 96, 44, { fontSize: 20, bold: true });
  addText(slide, detail, x + 76, y + 92, w - 96, 38, { fontSize: 14, color: C.slate });
}

function addMoveCard(slide, x, y, company, date, move, implication, accent) {
  addBox(slide, x, y, 554, 178, C.white, C.line);
  addRule(slide, x, y, 8, 178, accent);
  addText(slide, company.toUpperCase(), x + 26, y + 19, 310, 22, { fontSize: 13, bold: true, color: accent });
  addText(slide, date, x + 392, y + 19, 132, 22, { fontSize: 13, bold: true, color: C.slate, align: "right" });
  addText(slide, move, x + 26, y + 49, 500, 48, { fontSize: 21, bold: true });
  addText(slide, implication, x + 26, y + 107, 500, 50, { fontSize: 15, color: C.slate });
}

function addDecisionCard(slide, x, width, due, score, title, output, urgent = false) {
  const top = 226;
  addBox(slide, x, top, width, 376, C.white, urgent ? C.amber : C.line);
  addRule(slide, x, top, width, 8, urgent ? C.amber : C.teal);
  addText(slide, due.toUpperCase(), x + 22, top + 26, width - 44, 24, { fontSize: 13, bold: true, color: urgent ? C.amber : C.teal });
  addText(slide, `${score}/100`, x + 22, top + 60, width - 44, 50, { fontSize: 34, bold: true });
  addText(slide, "PRIORITY SCORE", x + 22, top + 104, width - 44, 22, { fontSize: 12, bold: true, color: C.slate });
  addText(slide, title, x + 22, top + 144, width - 44, 78, { fontSize: 21, bold: true });
  addRule(slide, x + 22, top + 236, width - 44, 1, C.line);
  addText(slide, "REQUIRED OUTPUT", x + 22, top + 252, width - 44, 20, { fontSize: 12, bold: true, color: C.slate });
  addText(slide, output, x + 22, top + 280, width - 44, 72, { fontSize: 15, color: C.ink });
}

function addMilestone(slide, x, date, label, body, accent = C.teal) {
  addBox(slide, x - 25, 300, 50, 50, accent, accent, "rounded-full");
  addText(slide, date, x - 48, 365, 96, 30, { fontSize: 16, bold: true, color: accent, align: "center" });
  addText(slide, label, x - 116, 410, 232, 52, { fontSize: 19, bold: true, align: "center" });
  addText(slide, body, x - 116, 474, 232, 70, { fontSize: 14, color: C.slate, align: "center" });
}

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(path.dirname(PPTX_PATH), { recursive: true });

  const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });

  // 1 — Cover
  {
    const s = deck.slides.add();
    s.background.fill = C.ink;
    addRule(s, 0, 0, 18, 720, C.aqua);
    addText(s, "WATERS · NEXT GEN LC", 74, 70, 520, 34, { fontSize: 15, bold: true, color: C.aqua });
    addText(s, "Leadership brief", 74, 160, 940, 78, { fontSize: 58, bold: true, color: C.white });
    addText(s, "Five external signals. Three roadmap decisions.", 74, 254, 890, 54, { fontSize: 28, color: "#C9D9DB" });
    addText(s, "A concise executive readout of scientific momentum, competitor moves, customer friction, corporate intent, and the next conference moment.", 74, 344, 790, 120, { fontSize: 21, color: "#C9D9DB" });
    addBox(s, 922, 156, 252, 278, "#0D4A54", "#2B626A");
    addText(s, "DATA CURRENT", 956, 198, 190, 24, { fontSize: 13, bold: true, color: C.aqua });
    addText(s, asOfDay, 956, 236, 150, 82, { fontSize: 64, bold: true, color: C.white });
    addText(s, asOfMonthYear, 958, 320, 160, 34, { fontSize: 22, bold: true, color: C.white });
    addRule(s, 956, 380, 156, 3, C.aqua);
    addText(s, "PUBLIC EVIDENCE", 956, 394, 180, 24, { fontSize: 12, bold: true, color: "#C9D9DB" });
    addText(s, "Prepared for roadmap review", 74, 646, 560, 28, { fontSize: 15, color: "#C9D9DB" });
    addText(s, "01", 1174, 646, 52, 28, { fontSize: 13, bold: true, color: C.aqua, align: "right" });
  }

  // 2 — Executive conclusion and evidence base
  {
    const s = deck.slides.add();
    s.background.fill = C.pale;
    addHeader(s, leadershipBriefThesis(), "The strongest cross-page pattern is not a single specification—it is proof that the full workflow is easier to execute, transfer, and troubleshoot.", 2);
    addBox(s, 54, 214, 1172, 86, C.ink, C.ink);
    addText(s, "LEADERSHIP IMPLICATION", 78, 233, 230, 22, { fontSize: 13, bold: true, color: C.aqua });
    addText(s, "Test new requirements against workflow proof, not feature parity alone.", 326, 227, 850, 42, { fontSize: 25, bold: true, color: C.white });
    addStat(s, 54, formatCount(workflowCount), "Automation and software workflow publications", "Scientific activity in the last year");
    addStat(s, 463, formatCount(pfasCount), "PFAS and contaminant-testing publications", "Current regulated-testing activity");
    addStat(s, 872, formatCount(oligoCount), "Oligonucleotide and nucleic-acid publications", "Substantial application evidence base");
    addText(s, "Publication volume measures scientific activity—not market share, revenue, or customer adoption.", 54, 576, 1172, 38, { fontSize: 15, color: C.slate, align: "center" });
    addFooter(s, 2);
  }

  // 3 — Five signals
  {
    const s = deck.slides.add();
    s.background.fill = C.pale;
    addHeader(s, "Five signals now shape the roadmap conversation", "Each signal comes from a different evidence class; together they show why leadership attention is warranted.", 3);
    addSignalCard(s, 54, 216, 558, "1", "Scientific market", "PFAS activity remains substantial", `${formatCount(pfasCount)} records in the current one-year evidence window.`);
    addSignalCard(s, 668, 216, 558, "2", "Competitor launch", "Agilent is packaging LC/TOF into MAM", "6230C positioning competes on workflow value, not only hardware.", C.amber);
    addSignalCard(s, 54, 380, 558, "3", "Customer evidence", "Troubleshooting time is a product opportunity", "The exact public source supports Waters UPLC high-pressure troubleshooting.");
    addSignalCard(s, 668, 380, 558, "4", "Corporate intent", "Agilent calls LC and LC-MS growth engines", "Direct SEC evidence links the portfolio to growth markets.", C.amber);
    addSignalCard(s, 361, 544, 558, "5", "Conference moment", "Bioprocessing Summit begins Aug 10", "A near-term stage for MAM, complex modalities and transfer proof.");
    addFooter(s, 3);
  }

  // 4 — Competitive pattern
  {
    const s = deck.slides.add();
    s.background.fill = C.pale;
    addHeader(s, "Competitors are packaging execution—not only instruments", "Four current moves make workflow speed, automation, software and method execution more visible to customers.", 4);
    addMoveCard(s, 54, 220, "Shimadzu", "03 Mar", "Nexera X4", "A new LC platform framed around workflow execution and usability.", C.teal);
    addMoveCard(s, 672, 220, "Agilent", "03 Jun", "6230C LC/TOF in MAM", "Positions instrument value inside a defined biopharma workflow.", C.amber);
    addMoveCard(s, 54, 424, "SCIEX", "01 Jun", "novus V55 + SCIEX OS 5.0", "A software-led launch makes the operating experience part of the system promise.", C.teal);
    addMoveCard(s, 672, 424, "Thermo Fisher", "29 Jun", "Vanquish Amplify", "Keeps UHPLC differentiation tied to operator and workflow performance.", C.amber);
    addFooter(s, 4);
  }

  // 5 — Customer signal
  {
    const s = deck.slides.add();
    s.background.fill = C.pale;
    addHeader(s, "Guided diagnosis is a measurable product opportunity", "The source supports a troubleshooting pattern; it does not, by itself, prove a carryover or autosampler defect.", 5);
    addBox(s, 54, 222, 454, 388, C.ink, C.ink);
    addText(s, "68/100", 84, 260, 350, 70, { fontSize: 50, bold: true, color: C.aqua });
    addText(s, "EVIDENCE CONFIDENCE", 84, 332, 350, 24, { fontSize: 13, bold: true, color: "#C9D9DB" });
    addText(s, "What is directly supported", 84, 390, 350, 30, { fontSize: 20, bold: true, color: C.white });
    addText(s, "Waters UPLC\nhigh pressure\ntroubleshooting", 84, 438, 350, 114, { fontSize: 22, bold: true, color: C.white });
    addBox(s, 540, 222, 686, 388, C.white, C.line);
    addText(s, "WHAT LEADERS SHOULD TAKE FROM IT", 570, 254, 610, 24, { fontSize: 13, bold: true, color: C.teal });
    addText(s, "Treat diagnosis time as a measurable workflow outcome.", 570, 292, 600, 60, { fontSize: 29, bold: true });
    addText(s, "Validate three things before adding requirements:", 570, 378, 590, 28, { fontSize: 17, bold: true, color: C.slate });
    addText(s, "1. Which failure modes repeat across customer and field records\n2. How long users take to isolate and recover from them\n3. Whether guided diagnostics materially shorten that path", 586, 422, 580, 116, { fontSize: 18 });
    addText(s, "Current evidence is directional—not a prevalence estimate.", 570, 558, 590, 28, { fontSize: 15, color: C.slate });
    addFooter(s, 5);
  }

  // 6 — Decisions
  {
    const s = deck.slides.add();
    s.background.fill = C.pale;
    addHeader(s, "Three decisions have different urgency and evidence profiles", "Priority scores rank roadmap attention. They are not confidence scores and do not replace customer validation.", 6);
    addDecisionCard(s, 54, 358, "Due 07 Aug", 55, "Package a PFAS-ready regulated quantitation workflow?", "A claims matrix versus Thermo, SCIEX and Shimadzu, ending in a go/no-go.", true);
    addDecisionCard(s, 461, 358, "Due 14 Aug", 72, "Do Next Gen LC and Alliance iS need new end-to-end workflow requirements?", "One recommendation: build, package existing capability, reposition, or stop.");
    addDecisionCard(s, 868, 358, "Due 21 Aug", 61, "Does Next Gen LC need an oligonucleotide method-readiness package?", "A readiness dossier covering compatibility, carryover, throughput, transfer and software.");
    addFooter(s, 6);
  }

  // 7 — Timeline
  {
    const s = deck.slides.add();
    s.background.fill = C.pale;
    addHeader(s, "Close the evidence gaps before adding roadmap scope", "Use the next 30 days to sequence dated deliverables around the conference moment.", 7);
    addRule(s, 160, 322, 960, 4, C.line);
    addMilestone(s, 190, "07 AUG", "PFAS decision", "Complete claims matrix and make the package go/no-go.", C.amber);
    addMilestone(s, 490, "10 AUG", "Conference moment", "Lead with MAM, complex modalities and transfer proof.", C.teal);
    addMilestone(s, 790, "14 AUG", "Workflow decision", "Choose build, package, reposition, or stop.", C.teal);
    addMilestone(s, 1090, "21 AUG", "Oligo decision", "Complete method-readiness dossier and decide scope.", C.teal);
    addBox(s, 176, 574, 928, 58, C.ink, C.ink);
    addText(s, "Gate roadmap capacity on repeated customer-visible evidence plus quantified benefit and engineering effort.", 206, 588, 870, 28, { fontSize: 18, bold: true, color: C.white, align: "center" });
    addFooter(s, 7);
  }

  // 8 — Sources
  {
    const s = deck.slides.add();
    s.background.fill = C.pale;
    addHeader(s, "Primary sources behind the leadership readout", "Direct public evidence is kept separate from inference; publication counts are contextual signals, not market-size claims.", 8);
    const sources = [
      ["Scientific market", "PubMed · PFAS / LC-MS query", "pubmed.ncbi.nlm.nih.gov"],
      ["Agilent launch", "6230C LC/TOF in MAM workflow", "agilent.com/about/newsroom/presrel/2026/29may-ca26021.html"],
      ["Customer evidence", "Waters UPLC high-pressure troubleshooting", "reddit.com/r/CHROMATOGRAPHY"],
      ["Corporate intent", "Agilent quarterly filing", "sec.gov · Agilent quarterly filing"],
      ["Competitor launches", "Nexera X4 · novus V55 / OS 5.0 · Vanquish Amplify", "shimadzu.com · sciex.com · thermofisher.com"],
      ["Conference", "Bioprocessing Summit US 2026", "bioprocessingsummit.com"],
    ];
    sources.forEach((row, idx) => {
      const y = 216 + idx * 68;
      addText(s, String(idx + 1).padStart(2, "0"), 62, y + 8, 42, 28, { fontSize: 15, bold: true, color: C.teal });
      addText(s, row[0].toUpperCase(), 120, y + 4, 180, 20, { fontSize: 12, bold: true, color: C.slate });
      addText(s, row[1], 314, y + 2, 430, 30, { fontSize: 17, bold: true });
      addText(s, row[2], 760, y + 4, 452, 26, { fontSize: 14, color: C.teal, align: "right" });
      if (idx < sources.length - 1) addRule(s, 120, y + 52, 1092, 1, C.line);
    });
    addBox(s, 54, 632, 1172, 34, C.amberPale, C.amberPale);
    addText(s, "Method note: priority scores combine market, competitor, customer, roadmap, source-quality and time-sensitivity factors.", 74, 640, 1132, 20, { fontSize: 13, bold: true, color: "#7C5600", align: "center" });
    addFooter(s, 8);
  }

  for (const [index, slide] of deck.slides.items.entries()) {
    const stem = `slide-${String(index + 1).padStart(2, "0")}`;
    const png = await deck.export({ slide, format: "png", scale: 1 });
    await writeBlob(path.join(OUT_DIR, `${stem}.png`), png);
    const layout = await slide.export({ format: "layout" });
    await fs.writeFile(path.join(OUT_DIR, `${stem}.layout.json`), await layout.text());
  }

  const montage = await deck.export({ format: "webp", montage: true, scale: 0.4 });
  await writeBlob(path.join(OUT_DIR, "deck-montage.webp"), montage);
  const pptx = await PresentationFile.exportPptx(deck);
  await pptx.save(PPTX_PATH);
  console.log(PPTX_PATH);
}

await main();
