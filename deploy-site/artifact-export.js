(function exposePmmArtifactExports(root) {
  "use strict";

  const DRAFT_WATERMARK = "DRAFT — NOT APPROVED";
  const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  function clean(value, fallback = "Unresolved") {
    const text = String(value ?? "").trim();
    return text || fallback;
  }

  function compact(value, limit = 420) {
    const text = clean(value);
    return text.length > limit ? `${text.slice(0, limit - 1).trim()}…` : text;
  }

  function safeFilename(value) {
    return clean(value, "pmm-artifact").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 110) || "pmm-artifact";
  }

  function uniqueEvidence(evidence = []) {
    const seen = new Set();
    return evidence.filter((item) => {
      const url = String(item?.url || "").trim();
      if (!/^https?:\/\//i.test(url) || seen.has(url)) return false;
      seen.add(url);
      return true;
    });
  }

  function normalizedArtifact(model = {}) {
    const claims = Array.isArray(model.claims) ? model.claims : [];
    const evidence = uniqueEvidence(model.evidenceFootnotes);
    const allClaimsApproved = claims.length > 0 && claims.every((claim) => claim.approvalEstablished === true && claim.approvedWording);
    return {
      ...model,
      title: clean(model.title, "PMM artifact"),
      artifactType: clean(model.artifactType, "PMM artifact"),
      target: clean(model.target),
      buyingSituation: clean(model.buyingSituation),
      governingPosition: model.governingPosition || {},
      roleMessages: Array.isArray(model.roleMessages) ? model.roleMessages : [],
      claims,
      proof: Array.isArray(model.proof) ? model.proof : [],
      caveats: Array.isArray(model.caveats) ? model.caveats : [],
      objections: Array.isArray(model.objections) ? model.objections : [],
      warnings: Array.isArray(model.warnings) ? model.warnings : [],
      evidenceFootnotes: evidence,
      allClaimsApproved,
      draft: !allClaimsApproved,
      watermark: allClaimsApproved ? "APPROVAL ESTABLISHED FOR INCLUDED CLAIMS" : DRAFT_WATERMARK,
      workflow: {
        owner: clean(model.workflow?.owner, "Owner needed"),
        dueDate: clean(model.workflow?.dueDate, "Deadline needed"),
        status: clean(model.workflow?.status, "Draft"),
        successMeasure: clean(model.workflow?.successMeasure, "Measure needed"),
      },
    };
  }

  function artifactSections(input) {
    const model = normalizedArtifact(input);
    const governing = model.governingPosition;
    return [
      { title: "Target and buying situation", items: [model.target, model.buyingSituation] },
      { title: "Governing position", items: [governing.primaryValueProposition, `Point of parity: ${clean(governing.pointOfParity)}`, `Point of difference: ${clean(governing.pointOfDifference)}`] },
      { title: "Role-specific messages", items: model.roleMessages.map((role) => `${clean(role.role)}: ${clean(role.message)}`) },
      { title: "Competitor response", items: [model.competitorResponse] },
      { title: "Claims and approval state", items: model.claims.map((claim) => `${clean(claim.wording)} — ${clean(claim.approvalState, "Approval not established")}`) },
      { title: "Proof and caveats", items: [...model.proof.map((item) => clean(item.detail || item.label)), ...model.caveats] },
      { title: "Objection handling", items: model.objections.map((item) => `${clean(item.objection)} Response: ${clean(item.response)}`) },
      { title: "Unsupported-content warnings", items: model.warnings.length ? model.warnings : ["No unsupported-content warning is active for the included content."] },
      { title: "Production workflow", items: [`Owner: ${model.workflow.owner}`, `Due date: ${model.workflow.dueDate}`, `Status: ${model.workflow.status}`, `Success measure: ${model.workflow.successMeasure}`] },
    ].map((section) => ({ ...section, items: section.items.filter(Boolean).map((item) => clean(item)) }));
  }

  function addPptxWatermark(slide, model) {
    slide.addText(model.watermark, {
      x: 1.05, y: 2.85, w: 11.2, h: 0.65, rotate: 325,
      fontFace: "Aptos Display", fontSize: 30, bold: true,
      color: model.draft ? "B45B5B" : "5D776B", transparency: 72,
      align: "center", margin: 0,
    });
  }

  function addPptxChrome(slide, model, title, subtitle) {
    slide.background = { color: "F7F9FA" };
    slide.addShape("rect", { x: 0, y: 0, w: 13.333, h: 0.16, line: { color: "0B7285", transparency: 100 }, fill: { color: "0B7285" } });
    slide.addText(title, { x: 0.55, y: 0.34, w: 9.7, h: 0.72, fontFace: "Aptos Display", fontSize: 35, bold: true, color: "173F4B", margin: 0, breakLine: false, fit: "shrink" });
    slide.addText(subtitle, { x: 0.58, y: 1.08, w: 12.1, h: 0.38, fontFace: "Aptos", fontSize: 14, color: "526A72", margin: 0, breakLine: false, fit: "shrink" });
    slide.addText(model.watermark, { x: 10.6, y: 0.38, w: 2.15, h: 0.3, fontFace: "Aptos", fontSize: 11, bold: true, color: model.draft ? "9B3434" : "356451", align: "right", margin: 0, fit: "shrink" });
    addPptxWatermark(slide, model);
  }

  function addPptxSection(slide, title, items, x, y, w, h, accent = "0B7285", maxItems = 3, maxChars = 170) {
    slide.addText(title.toUpperCase(), { x, y, w, h: 0.25, fontFace: "Aptos", fontSize: 12, bold: true, color: accent, charSpacing: 1.1, margin: 0, fit: "shrink" });
    const text = (items.length ? items : ["Unresolved"]).slice(0, maxItems).map((item) => ({ text: compact(item, maxChars), options: { bullet: { indent: 14 }, breakLine: true } }));
    slide.addText(text, { x, y: y + 0.3, w, h: h - 0.3, fontFace: "Aptos", fontSize: 16, color: "29444D", margin: 0.05, breakLine: false, valign: "top", fit: "shrink", paraSpaceAfterPt: 4 });
  }

  function addPptxEvidenceFooter(slide, model, startY = 6.78) {
    const sources = model.evidenceFootnotes.slice(0, 3);
    const runs = sources.length ? sources.flatMap((source, index) => [
      { text: `${index + 1}. ${compact(source.label || source.sourceName || "Evidence", 64)} `, options: { bold: true } },
      { text: source.url, options: { hyperlink: { url: source.url }, color: "1769AA", underline: { color: "1769AA" } } },
      { text: index === sources.length - 1 ? "" : "   " },
    ]) : [{ text: "Evidence footnotes unresolved — no exact URL available." }];
    slide.addText(runs, { x: 0.58, y: startY, w: 12.1, h: 0.42, fontFace: "Aptos", fontSize: 8.5, color: "5F7178", margin: 0, fit: "shrink" });
    if (typeof slide.addNotes === "function") slide.addNotes(`[Sources]\n${model.evidenceFootnotes.map((source, index) => `${index + 1}. ${source.label || source.sourceName || "Evidence"}: ${source.url}`).join("\n")}`);
  }

  function buildBattlecardDeck(input) {
    const model = normalizedArtifact(input);
    if (!root.PptxGenJS) throw new Error("PowerPoint export library unavailable.");
    const pptx = new root.PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.author = "Competition Engine";
    pptx.company = "Waters";
    pptx.subject = `${model.target} competitive battlecard`;
    pptx.title = model.title;
    pptx.lang = "en-US";
    pptx.theme = { headFontFace: "Aptos Display", bodyFontFace: "Aptos", lang: "en-US" };
    const slide = pptx.addSlide();
    addPptxChrome(slide, model, model.title, `${model.target} · ${model.buyingSituation}`);
    const sections = artifactSections(model);
    addPptxSection(slide, "Governing position", [sections[1].items[0], sections[1].items[2]], 0.58, 1.48, 3.85, 1.65, "0B7285", 2, 135);
    addPptxSection(slide, "Competitor response", sections[3].items, 4.72, 1.48, 3.85, 1.65, "7B4F9D", 1, 180);
    addPptxSection(slide, "Claims / approval", sections[4].items, 8.87, 1.48, 3.85, 1.65, model.draft ? "A24444" : "356451", 2, 150);
    addPptxSection(slide, "Role messages", sections[2].items, 0.58, 3.42, 3.85, 1.45, "0B7285", 2, 145);
    addPptxSection(slide, "Objection handling", sections[6].items, 4.72, 3.42, 3.85, 1.45, "8A6415", 1, 190);
    addPptxSection(slide, "Proof / caveats", sections[5].items, 8.87, 3.42, 3.85, 1.45, "2C6B5B", 2, 145);
    addPptxSection(slide, "Unsupported warnings", sections[7].items, 0.58, 4.92, 7.99, 1.2, "A24444");
    addPptxSection(slide, "Production workflow", sections[8].items, 8.87, 4.92, 3.85, 1.2, "5E4774", 4, 105);
    addPptxEvidenceFooter(slide, model);
    return pptx;
  }

  function buildSalesDeck(input) {
    const model = normalizedArtifact(input);
    if (!root.PptxGenJS) throw new Error("PowerPoint export library unavailable.");
    const pptx = new root.PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.author = "Competition Engine";
    pptx.company = "Waters";
    pptx.subject = `${model.target} sales-deck outline`;
    pptx.title = model.title;
    pptx.lang = "en-US";
    pptx.theme = { headFontFace: "Aptos Display", bodyFontFace: "Aptos", lang: "en-US" };
    const sections = artifactSections(model);
    const sequence = [
      [model.title, [model.target, model.buyingSituation]],
      ["Lead with the governed position", sections[1].items],
      ["Adapt the message by buyer role", sections[2].items],
      ["Answer the competitor narrative", sections[3].items],
      ["Use governed claims and proof", [...sections[4].items, ...sections[5].items]],
      ["Handle objections; close the next step", [...sections[6].items, ...sections[8].items]],
    ];
    sequence.forEach(([title, items], index) => {
      const slide = pptx.addSlide();
      addPptxChrome(slide, model, title, index === 0 ? `${model.artifactType} · ${model.workflow.status}` : `${model.target} · slide ${index + 1}`);
      if (index === 0) {
        slide.addText(compact(model.governingPosition.primaryValueProposition, 380), { x: 0.7, y: 2.05, w: 11.9, h: 1.3, fontFace: "Aptos Display", fontSize: 30, bold: true, color: "214B56", align: "center", valign: "mid", margin: 0.08, fit: "shrink" });
        addPptxSection(slide, "Unsupported warnings", sections[7].items, 2.0, 4.25, 9.3, 1.35, "A24444");
      } else {
        addPptxSection(slide, title, items, 0.9, 1.65, 11.5, 4.8, index === 4 ? "A24444" : "0B7285");
      }
      addPptxEvidenceFooter(slide, model);
    });
    return pptx;
  }

  function docxParagraph(text, options = {}) {
    const { Paragraph, TextRun, HeadingLevel, AlignmentType } = root.docx;
    const heading = options.heading ? HeadingLevel[options.heading] : undefined;
    return new Paragraph({
      heading,
      alignment: options.center ? AlignmentType.CENTER : undefined,
      spacing: { before: options.before || 0, after: options.after ?? 120, line: 300 },
      children: [new TextRun({ text: clean(text), bold: options.bold, color: options.color, size: options.size, italics: options.italics })],
    });
  }

  function buildDocx(input) {
    const model = normalizedArtifact(input);
    if (!root.docx) throw new Error("Word export library unavailable.");
    const { Document, Header, Footer, Paragraph, TextRun, ExternalHyperlink, AlignmentType, PageNumber } = root.docx;
    const children = [
      docxParagraph(model.title, { bold: true, color: "173F4B", size: 44, after: 80 }),
      docxParagraph(`${model.artifactType} · ${model.target}`, { color: "526A72", size: 22, after: 240 }),
    ];
    artifactSections(model).forEach((section) => {
      children.push(docxParagraph(section.title, { heading: "HEADING_1", color: "2E74B5", size: 32, before: 180, after: 100 }));
      section.items.forEach((item) => children.push(new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 80, line: 300 },
        children: [new TextRun({ text: compact(item, 800), size: 22, color: "263E47" })],
      })));
    });
    children.push(docxParagraph("Evidence footnotes", { heading: "HEADING_1", color: "2E74B5", size: 32, before: 180, after: 100 }));
    if (!model.evidenceFootnotes.length) children.push(docxParagraph("Evidence links unavailable.", { italics: true, color: "775813" }));
    model.evidenceFootnotes.forEach((source, index) => children.push(new Paragraph({
      spacing: { after: 70 },
      children: [
        new TextRun({ text: `${index + 1}. ${clean(source.label || source.sourceName || "Evidence")}: `, bold: true, size: 19 }),
        new ExternalHyperlink({ link: source.url, children: [new TextRun({ text: source.url, color: "1769AA", underline: {}, size: 19 })] }),
      ],
    })));
    const header = new Header({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: model.watermark, bold: true, color: model.draft ? "B45B5B" : "5D776B", size: 18 })] })] });
    const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Competition Engine · ", color: "6A7A80", size: 17 }), new TextRun({ children: [PageNumber.CURRENT], color: "6A7A80", size: 17 })] })] });
    return new Document({
      creator: "Competition Engine",
      title: model.title,
      subject: `${model.target} governed PMM artifact`,
      description: model.watermark,
      styles: { default: { document: { run: { font: "Aptos", size: 22, color: "263E47" }, paragraph: { spacing: { after: 120, line: 300 } } } } },
      sections: [{
        properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 708, footer: 708 } } },
        headers: { default: header },
        footers: { default: footer },
        children,
      }],
    });
  }

  function csvCell(value) {
    let text = String(value ?? "");
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }

  function claimsCsv(claims = [], targeting = {}) {
    const headers = ["Target", "Competitor", "Proposed claim", "Claim type", "Segment/application", "Buyer role", "Channel", "Baseline", "Substantiation", "Approval state", "Approved wording", "Readiness", "Owner", "Expiration date", "Next action", "Evidence URLs", "Output status"];
    const target = [targeting.market, targeting.watersProduct, targeting.application, targeting.buyingSituation, targeting.geography, targeting.buyerRole].filter(Boolean).join(" > ");
    const rows = claims.map((claim) => [
      target,
      claim.competitor,
      claim.proposedClaimWording,
      claim.claimType,
      claim.segmentApplication,
      claim.buyerRole,
      claim.intendedChannel,
      claim.referenceBaseline,
      claim.substantiationStatus,
      claim.approvalState,
      claim.approvedWording,
      claim.readiness?.value || claim.readiness,
      claim.owner,
      claim.expirationDate,
      claim.nextRequiredAction,
      uniqueEvidence([...(claim.sources || []), ...(claim.evidenceRecords || [])]).map((source) => source.url).join(" | "),
      claim.approvalEstablished === true ? "APPROVAL ESTABLISHED" : DRAFT_WATERMARK,
    ]);
    return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function exportArtifact(input) {
    const model = normalizedArtifact(input);
    const base = safeFilename(`${model.target}-${model.artifactType}`);
    if (model.exportKind === "pptx-battlecard") {
      const pptx = buildBattlecardDeck(model);
      await pptx.writeFile({ fileName: `${base}.pptx` });
      return `${base}.pptx`;
    }
    if (model.exportKind === "pptx-sales-deck") {
      const pptx = buildSalesDeck(model);
      await pptx.writeFile({ fileName: `${base}.pptx` });
      return `${base}.pptx`;
    }
    const documentModel = buildDocx(model);
    const blob = await root.docx.Packer.toBlob(documentModel);
    downloadBlob(new Blob([blob], { type: DOCX_MIME }), `${base}.docx`);
    return `${base}.docx`;
  }

  function exportClaimsCsv(claims, targeting) {
    const content = claimsCsv(claims, targeting);
    const filename = `${safeFilename(`${targeting.market || "all-markets"}-${targeting.watersProduct || "all-waters-products"}-${targeting.application || "all-applications"}-claims-registry`)}.csv`;
    downloadBlob(new Blob([content], { type: "text/csv;charset=utf-8" }), filename);
    return filename;
  }

  function approvedClipboardText(claims = []) {
    return claims.filter((claim) => claim.approvalEstablished === true && claim.approvedWording)
      .map((claim) => claim.approvedWording.trim()).filter(Boolean).join("\n\n");
  }

  function substantiatedHeadToHeadClaims(claims = []) {
    return claims.filter((claim) => claim && claim.substantiation !== "Unsupported" && Array.isArray(claim.sources) && claim.sources.some((source) => /^https?:\/\//i.test(source?.url || "") && /^\d{4}-\d{2}-\d{2}$/.test(source?.date || "")));
  }

  function headToHeadTalkTrackText(input = {}) {
    const claims = substantiatedHeadToHeadClaims(input.talkTrack);
    if (!claims.length) return "";
    const lines = [
      `${clean(input.waters?.product)} vs ${clean(input.competitorProduct?.product)}`,
      "DRAFT — NOT APPROVED",
      [input.targeting?.marketLabel, input.targeting?.applicationLabel, input.targeting?.buyingSituationLabel, input.targeting?.buyerRoleLabel].filter(Boolean).join(" · "),
      "",
      "TAILORED PITCH",
      clean(input.tailoredPitch || input.positioning),
      "",
      "WHY WATERS",
    ];
    claims.forEach((claim, index) => {
      lines.push(`${index + 1}. ${clean(claim.statement)} [${clean(claim.substantiation)}]`);
      claim.sources.filter((source) => /^https?:\/\//i.test(source?.url || "")).forEach((source) => lines.push(`   ${clean(source.date, "Date unresolved")} · ${source.url}`));
    });
    if (input.nextStep) lines.push("", "RECOMMENDED NEXT STEP", clean(input.nextStep));
    lines.push("", "EVIDENCE GAPS — DO NOT USE AS CUSTOMER CLAIMS");
    (input.evidenceGaps || ["No additional gap recorded."]).forEach((gap) => lines.push(`- ${clean(gap)}`));
    return lines.join("\n");
  }

  function normalizedHeadToHead(input = {}) {
    const objectionClaims = (input.objections || []).flatMap((item) => [item.competitorClaim, item.response]).filter(Boolean);
    const concernClaims = (input.watersConcerns || []).map((item) => item.concern).filter(Boolean);
    const claimGroups = [input.talkTrack, input.wins, input.weaknesses, input.serviceClaims, objectionClaims, concernClaims].flat().filter(Boolean);
    const claims = substantiatedHeadToHeadClaims(claimGroups);
    const evidence = uniqueEvidence([
      ...claims.flatMap((claim) => claim.sources || []),
      ...(input.evcDimensions || []).flatMap((dimension) => dimension.sources || []),
    ]);
    return {
      ...input,
      watersName: clean(input.waters?.product, "Waters product unresolved"),
      competitorName: clean(input.competitorProduct?.product, "Competitor product unresolved"),
      positioning: clean(input.positioning),
      tailoredPitch: clean(input.tailoredPitch || input.positioning),
      claims,
      talkTrack: substantiatedHeadToHeadClaims(input.talkTrack),
      wins: substantiatedHeadToHeadClaims(input.wins),
      weaknesses: substantiatedHeadToHeadClaims(input.weaknesses),
      serviceClaims: substantiatedHeadToHeadClaims(input.serviceClaims),
      objections: (input.objections || []).map((item) => ({
        competitorClaim: substantiatedHeadToHeadClaims([item.competitorClaim])[0] || null,
        response: substantiatedHeadToHeadClaims([item.response])[0] || null,
      })).filter((item) => item.competitorClaim || item.response),
      watersConcerns: (input.watersConcerns || []).map((item) => ({ ...item, concern: substantiatedHeadToHeadClaims([item.concern])[0] || null })).filter((item) => item.concern),
      evidence,
      gaps: Array.isArray(input.evidenceGaps) ? input.evidenceGaps : [],
      watermark: DRAFT_WATERMARK,
    };
  }

  function addHeadToHeadChrome(slide, model, title, subtitle) {
    slide.background = { color: "F7F9FA" };
    slide.addShape("rect", { x: 0, y: 0, w: 13.333, h: 0.16, line: { color: "0B7285", transparency: 100 }, fill: { color: "0B7285" } });
    slide.addText(title, { x: 0.58, y: 0.34, w: 9.6, h: 0.68, fontFace: "Aptos Display", fontSize: 32, bold: true, color: "173F4B", margin: 0, fit: "shrink" });
    slide.addText(subtitle, { x: 0.6, y: 1.08, w: 11.9, h: 0.34, fontFace: "Aptos", fontSize: 13, color: "526A72", margin: 0, fit: "shrink" });
    slide.addText(DRAFT_WATERMARK, { x: 10.2, y: 0.38, w: 2.55, h: 0.3, fontFace: "Aptos", fontSize: 11, bold: true, color: "9B3434", align: "right", margin: 0 });
    slide.addText(DRAFT_WATERMARK, { x: 1.05, y: 3.0, w: 11.2, h: 0.6, rotate: 325, fontFace: "Aptos Display", fontSize: 29, bold: true, color: "B45B5B", transparency: 76, align: "center", margin: 0 });
  }

  function addHeadToHeadSources(slide, model) {
    const sources = model.evidence.slice(0, 3);
    const runs = sources.length ? sources.flatMap((source, index) => [
      { text: `${index + 1}. ${compact(source.label || source.sourceName || "Evidence", 54)} `, options: { bold: true } },
      { text: source.url, options: { hyperlink: { url: source.url }, color: "1769AA", underline: { color: "1769AA" } } },
      { text: index === sources.length - 1 ? "" : "   " },
    ]) : [{ text: "No exact source URL is available for the content on this slide." }];
    slide.addText(runs, { x: 0.58, y: 6.82, w: 12.15, h: 0.34, fontFace: "Aptos", fontSize: 8, color: "5F7178", margin: 0, fit: "shrink" });
    if (typeof slide.addNotes === "function") slide.addNotes(`[Sources]\n${model.evidence.map((source, index) => `${index + 1}. ${source.date || "Date unresolved"} · ${source.url}`).join("\n")}`);
  }

  function buildHeadToHeadDeck(input) {
    if (!root.PptxGenJS) throw new Error("PowerPoint export library unavailable.");
    const model = normalizedHeadToHead(input);
    const pptx = new root.PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.author = "Competition Engine";
    pptx.company = "Waters";
    pptx.subject = `${model.watersName} vs ${model.competitorName} governed battlecard`;
    pptx.title = `${model.watersName} vs ${model.competitorName}`;
    pptx.lang = "en-US";
    pptx.theme = { headFontFace: "Aptos Display", bodyFontFace: "Aptos", lang: "en-US" };

    const matchup = pptx.addSlide();
    addHeadToHeadChrome(matchup, model, `${model.watersName} vs ${model.competitorName}`, [model.targeting?.marketLabel, model.targeting?.applicationLabel, model.targeting?.buyingSituationLabel, model.targeting?.buyerRoleLabel].filter(Boolean).join(" · ") || "Governed product match · customer-facing draft");
    addPptxSection(matchup, "Tailored pitch", [model.tailoredPitch], 0.7, 1.62, 11.9, 1.5, "0B7285", 1, 360);
    addPptxSection(matchup, "Point of parity", [clean(model.pointOfParity)], 0.7, 3.35, 5.65, 1.45, "526A72", 1, 210);
    addPptxSection(matchup, "Point of difference", [clean(model.pointOfDifference)], 6.65, 3.35, 5.65, 1.45, "7B4F9D", 1, 210);
    addPptxSection(matchup, "Match basis", [`Similarity ${model.match?.score ?? "unresolved"}/100 · ${clean(model.match?.similarityBasis?.method)}`], 0.7, 5.1, 11.6, 1.05, "356451", 1, 260);
    addHeadToHeadSources(matchup, model);

    const talk = pptx.addSlide();
    addHeadToHeadChrome(talk, model, "Talk track and Waters advantages", `${model.watersName} vs ${model.competitorName} · substantiated statements only`);
    addPptxSection(talk, "Customer talk track", model.talkTrack.map((claim) => `${claim.statement} [${claim.substantiation}]`), 0.7, 1.58, 5.7, 4.75, "0B7285", 5, 190);
    addPptxSection(talk, "Where Waters wins", model.wins.map((claim) => `${claim.statement} [${claim.substantiation}]`), 6.75, 1.58, 5.7, 4.75, "356451", 5, 190);
    addHeadToHeadSources(talk, model);

    const response = pptx.addSlide();
    addHeadToHeadChrome(response, model, "Competitor response and decision criteria", "Public weakness evidence, service evidence, and evidence-coded scorecard");
    addPptxSection(response, "Competitor weaknesses", model.weaknesses.length ? model.weaknesses.map((claim) => `${claim.statement} [${claim.substantiation}]`) : ["No public evidence of a weakness on this dimension."], 0.7, 1.58, 5.7, 2.3, "A24444", 4, 180);
    addPptxSection(response, "Decision guardrail", ["Do not translate public customer-language frequency into market prevalence, win rate, or measured product performance."], 6.75, 1.58, 5.7, 2.3, "8A6415", 1, 230);
    const scoreItems = (model.scorecard?.rows || []).map((row) => `${row.label}: weight ${row.weight}% · Waters ${row.watersScore == null ? "not established" : row.watersScore.toFixed(1)} · competitor ${row.competitorScore == null ? "not established" : row.competitorScore.toFixed(1)}`);
    addPptxSection(response, "Evidence-coded attribute scorecard", scoreItems, 0.7, 4.15, 11.75, 2.0, "5E4774", 6, 145);
    addHeadToHeadSources(response, model);

    const value = pptx.addSlide();
    addHeadToHeadChrome(value, model, "Service, total value, and objection handling", `${model.watersName} vs ${model.competitorName} · assumptions remain explicit`);
    addPptxSection(value, "Service / support", model.serviceClaims.map((claim) => `${claim.statement} [${claim.substantiation}]`), 0.7, 1.58, 3.7, 2.2, "8A6415", 4, 160);
    addPptxSection(value, "Qualitative EVC", (model.evcDimensions || []).map((dimension) => `${dimension.label}: ${dimension.assumption}`), 4.78, 1.58, 3.7, 2.2, "356451", 6, 135);
    const objectionItems = model.objections.flatMap((item) => [item.competitorClaim ? `Competitor: ${item.competitorClaim.statement}` : "", item.response ? `Waters response: ${item.response.statement}` : ""]).filter(Boolean);
    addPptxSection(value, "Objection handling", objectionItems, 8.86, 1.58, 3.7, 2.2, "7B4F9D", 4, 145);
    addPptxSection(value, "Known Waters concerns", model.watersConcerns.map((item) => `${item.concern.statement} Address with: ${item.response}`), 0.7, 4.15, 11.85, 2.0, "A24444", 4, 210);
    addHeadToHeadSources(value, model);

    const close = pptx.addSlide();
    addHeadToHeadChrome(close, model, "Recommended next step and evidence gaps", "Unsupported statements are excluded from customer-facing content");
    const nudge = model.nextStep || (model.scorecard?.swingAttribute ? `Offer a controlled side-by-side evaluation centered on ${model.scorecard.swingAttribute.label.toLowerCase()}, with agreed acceptance criteria.` : "Agree the decision criteria, then run a controlled side-by-side evaluation before asserting advantage.");
    addPptxSection(close, "Customer nudge", [nudge], 0.7, 1.58, 11.7, 1.5, "0B7285", 1, 300);
    addPptxSection(close, "Evidence gaps — internal, not customer claims", model.gaps.length ? model.gaps : ["No additional feature-specific gap recorded."], 0.7, 3.35, 11.7, 2.75, "A24444", 6, 185);
    addHeadToHeadSources(close, model);
    return pptx;
  }

  async function exportHeadToHeadPptx(input) {
    const model = normalizedHeadToHead(input);
    const filename = `${safeFilename(`${model.watersName}-vs-${model.competitorName}-battlecard`)}.pptx`;
    const pptx = buildHeadToHeadDeck(model);
    await pptx.writeFile({ fileName: filename });
    return filename;
  }

  const api = {
    DRAFT_WATERMARK,
    DOCX_MIME,
    PPTX_MIME,
    approvedClipboardText,
    artifactSections,
    buildBattlecardDeck,
    buildDocx,
    buildSalesDeck,
    buildHeadToHeadDeck,
    claimsCsv,
    exportArtifact,
    exportClaimsCsv,
    exportHeadToHeadPptx,
    headToHeadTalkTrackText,
    normalizedArtifact,
    safeFilename,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.PmmArtifactExports = api;
})(typeof window !== "undefined" ? window : globalThis);
