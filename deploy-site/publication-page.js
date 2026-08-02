const publicationState = {
  data: null,
  selectedSourceId: "",
  selectedTopic: "",
  sourcePage: 1,
  sourcePageSize: 6,
  recordPage: 1,
  recordPageSize: 12,
  filters: { sourceClass: "All", market: "All", topic: "All", period: "90" },
};

const MAIN_DASHBOARD_MARKETS = [
  "Pharma",
  "Biopharma",
  "CDMO",
  "Clinical",
  "Academic",
  "Government",
  "Environmental",
  "Food & Beverage",
];

const TOPIC_RULES = [
  ["LC, columns, and separation", /\b(?:liquid chromatography|hplc|uplc|uhplc|chromatograph|separation|column|stationary phase|retention)\b/i],
  ["Mass spectrometry and omics", /\b(?:mass spectrom|lc[-– ]?ms|ms\/ms|proteom|metabolom|lipidom|peptide|orbitrap|q[-– ]?tof)\b/i],
  ["Bioanalysis and regulated methods", /\b(?:bioanal|pharma|drug|therapeutic|validation|quantitation|assay|quality control|impurit)\b/i],
  ["Environmental and food analysis", /\b(?:environment|water|food|pesticide|pfas|contaminant|pollut|residue)\b/i],
  ["Data, AI, and chemometrics", /\b(?:artificial intelligence|machine learning|chemometric|informatics|algorithm|software|data analysis|deep learning|llm)\b/i],
  ["Molecular assays and measurement platforms", /\b(?:fluorescen|luminescen|raman|sers|spectroscop|nmr|mri|pet tracer|colorimetric|nanopore|nanozyme|aptamer|crispr|molecularly imprinted|probe)\b/i],
  ["Sensors and diagnostics", /\b(?:sensor|diagnostic|detection|imaging|microfluidic|biosensor|immunoassay)\b/i],
];

const TOPIC_PM_CONTEXT = {
  "LC, columns, and separation": "Stationary phases, retention, selectivity, extraction, and method-transfer work keep LC performance and method portability at the center of current separation science.",
  "Mass spectrometry and omics": "HRMS, Q-TOF and Orbitrap acquisition, ion mobility, lipidomics, proteomics, and metabolomics keep acquisition depth and data interpretation prominent.",
  "Bioanalysis and regulated methods": "Validation, quantitation, therapeutic monitoring, impurity analysis, and regulated assays point to continued demand for reproducible, compliance-ready workflows.",
  "Environmental and food analysis": "PFAS, contaminants, residues, water, and food matrices emphasize sample preparation, matrix robustness, trace sensitivity, and defensible identification.",
  "Data, AI, and chemometrics": "AI, chemometrics, and data interpretation are appearing as enabling layers across analytical methods rather than as isolated instrument specifications.",
  "Molecular assays and measurement platforms": "Fluorescence, spectroscopy, Raman, NMR, probes, and molecular assays broaden the measurement workflow beyond conventional LC and MS configurations.",
  "Sensors and diagnostics": "Imaging, sensing, microfluidics, and diagnostic assays show continued movement toward faster, smaller, and more application-specific analytical platforms.",
};

const APPLICATION_STREAM_RULES = [
  {
    name: "Clinical bioanalysis, therapeutic monitoring, and biomarker assays",
    pattern: /\b(?:plasma|serum|urine|blood|hair|faeces|feces|clinical|patient|biomarker|therapeutic monitoring|pharmacokinetic|hormone|steroid|renin|angiotensin|aldosterone)\b/i,
    context: "Plasma, serum, urine, and microsample studies concentrate on steroid and hormone panels, therapeutic monitoring, pharmacokinetics, and biomarker measurement.",
  },
  {
    name: "Biopharma characterization and complex modalities",
    pattern: /\b(?:antibod|protein|peptide|glycan|glyco|adc|antibody.drug|oligonucleotide|rna|lipid|liposome|vaccine|biologic|mab|igg|cell therapy)\b/i,
    context: "Protein, peptide, glycan, ADC, lipid, and RNA work emphasizes structural characterization, impurity control, stability, and comparability of complex modalities.",
  },
  {
    name: "Environmental and food contaminant surveillance",
    pattern: /\b(?:pfas|water|wastewater|environment|pesticide|food|milk|contaminant|pollut|residue|microplastic|antibiotic)\b/i,
    context: "PFAS, pesticides, residues, wastewater, and food matrices put trace sensitivity, matrix removal, reference materials, and defensible identification in focus.",
  },
  {
    name: "Diagnostics, biosensing, and point-of-care assays",
    pattern: /\b(?:diagnostic|biosensor|sensor|immunoassay|microfluidic|test strip|point.of.care|wearable|smartphone)\b/i,
    context: "Portable sensors, immunoassays, microfluidics, and smartphone readouts are targeting rapid, low-preparation measurements outside centralized analytical labs.",
  },
  {
    name: "Natural products and traditional-medicine profiling",
    pattern: /\b(?:decoction|herbal|traditional|plant|flavonoid|polyphenol|radix|extracts?|phytochemical|natural product)\b/i,
    context: "Multicomponent natural-product studies combine chemical fingerprints, metabolite identification, extraction optimization, and pharmacodynamic correlation.",
  },
  {
    name: "Forensic and toxicology screening",
    pattern: /\b(?:forensic|toxic|cannabinoid|drug screening|synthetic cannabinoid|explosive|postblast|poison|abuse)\b/i,
    context: "Drug, toxicant, and forensic residue screening favors broad detection, metabolite coverage, library-free identification, and difficult-matrix robustness.",
  },
];

const ANALYTICAL_WORKFLOW_RULES = [
  {
    name: "Targeted LC-MS/MS quantitation and regulated assay validation",
    dashboardLabel: "Validation-ready LC-MS/MS workflows",
    pmPriority: "Prioritize assay robustness, method transfer, and validation support.",
    pattern: /\b(?:lc[-– ]?ms\/ms|tandem mass|quantif|quantitation|validated?|validation|assay|therapeutic monitoring|quality control|impurit)\b/i,
    context: "Multi-analyte panels, low-volume biological matrices, impurity assays, and formal validation are keeping precision, carryover, calibration range, and transferability central.",
  },
  {
    name: "HRMS identification, non-target screening, and structural elucidation",
    dashboardLabel: "HRMS identification and unknown screening",
    pmPriority: "Simplify confident unknown identification and expert review.",
    pattern: /\b(?:hrms|high.resolution|q[-– ]?tof|orbitrap|non.?target|nontarget|structur|identification|unknown|accurate mass)\b/i,
    context: "Non-target contaminant discovery, metabolite and impurity identification, accurate-mass confirmation, and lipid structural assignment are recurring HRMS use cases.",
  },
  {
    name: "Spatial, single-cell, and ambient MS imaging",
    dashboardLabel: "Spatial and single-cell MS",
    pmPriority: "Track specialized acquisition and analysis needs for spatial workflows.",
    pattern: /\b(?:imaging|single.cell|maldi msi|maldesi|ambient mass|desorption electrospray|spatial)\b/i,
    context: "MALDI/MSI, ambient ionization, and single-cell measurements are extending molecular coverage into spatial phenotyping and tissue-level discovery.",
  },
  {
    name: "Sample preparation, extraction, and matrix control",
    dashboardLabel: "Sample preparation and matrix control",
    pmPriority: "Address recovery, cleanup, and matrix-effect pain points.",
    pattern: /\b(?:sample preparation|extraction|spe\b|microextraction|derivati|matrix|cleanup|clean-up|hydrolysis|pre.?analytical)\b/i,
    context: "SPE, microextraction, derivatization, hydrolysis, and matrix-reference work show that upstream sample handling remains a major determinant of method sensitivity and robustness.",
  },
  {
    name: "Isomer, chiral, and stationary-phase selectivity",
    dashboardLabel: "Difficult-separation selectivity",
    pmPriority: "Differentiate through selectivity, columns, and application methods.",
    pattern: /\b(?:isomer|chiral|enantio|stationary phase|selectivity|retention|mixed.mode|hilic|reversed.phase|sfc|supercritical fluid)\b/i,
    context: "Chiral and isomer-resolved assays, mixed-mode and HILIC selectivity, and new bonded phases are targeting separations that generic pressure and flow specifications cannot explain.",
  },
  {
    name: "Omics profiling and biomarker discovery",
    dashboardLabel: "Omics and biomarker discovery",
    pmPriority: "Improve reproducible discovery-to-validation handoffs.",
    pattern: /\b(?:proteom|metabolom|lipidom|glycom|multi.omics|omics\b|biomarker)\b/i,
    context: "Proteomic, metabolomic, lipidomic, and glycomic studies emphasize coverage depth, normalization, data integration, and reproducible discovery-to-validation handoffs.",
  },
];

const byId = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanTitle(value) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function sourceClass(source) {
  return source.sourceClass === "Peer-reviewed journal"
    ? "Peer-reviewed journals"
    : "Trade, forum, and learning sources";
}

function sourceMarkets(source) {
  return uniqueSorted([...(source.marketSegments || []), ...(source.coverage || [])]);
}

function topicForTitle(title) {
  const clean = cleanTitle(title);
  return TOPIC_RULES.find(([, pattern]) => pattern.test(clean))?.[0] || "Other analytical science";
}

function sourceTopics(source) {
  if (source.recentRecords?.length) return uniqueSorted(source.recentRecords.map((record) => topicForTitle(record.title)));
  return uniqueSorted(source.primarySignals || []);
}

function rankedScienceStreams(records, rules, kind) {
  return rules.map((rule) => {
    const matches = records.filter((record) => rule.pattern.test(cleanTitle(record.title)));
    return {
      ...rule,
      kind,
      count: matches.length,
      journals: new Set(matches.map((record) => record.journal)),
    };
  }).filter((stream) => stream.count > 0)
    .sort((a, b) => b.count - a.count || b.journals.size - a.journals.size);
}

function sourceTrend(source) {
  return source.publicationTrend || source.contentTrend || {};
}

function journalsOnly(sources) {
  return sources.length > 0 && sources.every((source) => source.sourceClass === "Peer-reviewed journal");
}

function currentCount(source) {
  const trend = sourceTrend(source);
  return publicationState.filters.period === "30" ? trend.last30Days : trend.last90Days;
}

function priorCount(source) {
  const trend = sourceTrend(source);
  return publicationState.filters.period === "30" ? trend.prior30Days : trend.prior90Days;
}

function filteredSources() {
  return [...(publicationState.data?.sources || [])]
    .filter((source) => publicationState.filters.sourceClass === "All" || sourceClass(source) === publicationState.filters.sourceClass)
    .filter((source) => publicationState.filters.market === "All" || sourceMarkets(source).includes(publicationState.filters.market))
    .filter((source) => publicationState.filters.topic === "All" || sourceTopics(source).includes(publicationState.filters.topic))
    .sort((a, b) => {
      const aHasTrend = Number.isFinite(currentCount(a));
      const bHasTrend = Number.isFinite(currentCount(b));
      if (aHasTrend !== bHasTrend) return aHasTrend ? -1 : 1;
      if (aHasTrend && currentCount(a) !== currentCount(b)) return currentCount(b) - currentCount(a);
      return a.name.localeCompare(b.name);
    });
}

function populateSelect(id, values) {
  const select = byId(id);
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
}

function populateMarketSelect() {
  const select = byId("publicationMarketFilter");
  MAIN_DASHBOARD_MARKETS.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
}

function formatDate(value) {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" })
    .format(new Date(`${value}T12:00:00`));
}

function renderStats(sources) {
  const recordBacked = sources.filter((source) => Number.isFinite(currentCount(source)));
  const journalView = journalsOnly(sources);
  const periodTotal = recordBacked.reduce((sum, source) => sum + currentCount(source), 0);
  const topSource = recordBacked[0];
  const exactRecords = recordBacked
    .flatMap((source) => (source.recentRecords || []).map((record) => ({ ...record, journal: source.name })))
    .filter((record) => publicationState.filters.topic === "All" || topicForTitle(record.title) === publicationState.filters.topic);
  const leadingWorkflow = rankedScienceStreams(exactRecords, ANALYTICAL_WORKFLOW_RULES, "Product workflow")[0];
  const leadingWorkflowDetail = leadingWorkflow
    ? `${leadingWorkflow.count} exact titles across ${leadingWorkflow.journals.size} ${journalView ? `journal${leadingWorkflow.journals.size === 1 ? "" : "s"}` : `source${leadingWorkflow.journals.size === 1 ? "" : "s"}`} · ${leadingWorkflow.pmPriority}`
    : "Broaden the filters to surface a recurring product workflow.";
  byId("publicationStats").innerHTML = `
    <article><span>Sources in view</span><strong>${sources.length}</strong><p>${recordBacked.length} with dated article streams</p><a class="publication-stat-link" href="#publicationSourceList" aria-label="View ${sources.length} publication sources">View ${sources.length} sources →</a></article>
    <article><span>${journalView ? "Publications in period" : "Records in period"}</span><strong>${periodTotal.toLocaleString()}</strong><p>${journalView ? "Crossref records across selected journals" : "Dated public records across selected sources"}</p></article>
    <article><span>${journalView ? "Highest output" : "Most active source"}</span><strong>${escapeHtml(topSource?.name || "—")}</strong><p>${topSource ? `${currentCount(topSource).toLocaleString()} ${journalView ? "publications" : "records"}` : "No dated stream"}</p></article>
    <article class="publication-pm-signal"><span>Top PM workflow</span><strong>${escapeHtml(leadingWorkflow?.dashboardLabel || "No workflow signal")}</strong><p>${escapeHtml(leadingWorkflowDetail)}</p></article>
  `;
}

function recordsFromLastDays(sources, days) {
  const records = sources.flatMap((source) => (source.recentRecords || []).map((record) => ({
    ...record,
    journal: source.name,
    sourceId: source.id,
    topic: topicForTitle(record.title),
  })));
  const newestRecordDate = records.map((record) => record.date).filter(Boolean).sort().at(-1);
  const collectionDate = publicationState.data?.generatedAt?.slice(0, 10) || newestRecordDate;
  if (!collectionDate) return { records: [], fromDate: "", throughDate: "" };
  const cutoff = new Date(`${collectionDate}T12:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - (days - 1));
  const fromDate = cutoff.toISOString().slice(0, 10);
  const filtered = records
    .filter((record) => record.date >= fromDate && record.date <= collectionDate)
    .filter((record) => publicationState.filters.topic === "All" || record.topic === publicationState.filters.topic)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.title.localeCompare(b.title));
  return { records: filtered, fromDate, throughDate: collectionDate };
}

function renderFreshHighlights(sources) {
  const panel = byId("publicationFreshHighlights");
  const { records, fromDate, throughDate } = recordsFromLastDays(sources, 15);
  const sourceCount = new Set(records.map((record) => record.journal)).size;
  const journalView = journalsOnly(sources);
  const streams = [
    ...rankedScienceStreams(records, APPLICATION_STREAM_RULES, "Application stream"),
    ...rankedScienceStreams(records, ANALYTICAL_WORKFLOW_RULES, "Analytical workflow"),
  ].sort((a, b) => b.count - a.count || b.journals.size - a.journals.size).slice(0, 3);

  if (!records.length || !streams.length) {
    panel.innerHTML = `<div class="conference-no-results"><strong>No dated ${journalView ? "publication" : "source"} highlights surfaced in the last 15 days.</strong><p>Broaden the active filters to review the complete recent record set.</p></div>`;
    return;
  }

  panel.innerHTML = `
    <div class="conference-section-header publication-fresh-heading">
      <div><span>Last 15 days</span><h2 id="publicationFreshHighlightsHeading">New ${journalView ? "Publication" : "Source"} Highlights</h2></div>
      <p>${records.length} exact titles · ${sourceCount} ${journalView ? `journal${sourceCount === 1 ? "" : "s"}` : `source${sourceCount === 1 ? "" : "s"}`} · ${formatDate(fromDate)}–${formatDate(throughDate)}</p>
    </div>
    <div class="publication-fresh-grid">
      ${streams.map((stream) => {
        const matches = records.filter((record) => stream.pattern.test(cleanTitle(record.title)));
        return `
          <article>
            <div><span>${escapeHtml(stream.kind)}</span><strong>${stream.count} new title${stream.count === 1 ? "" : "s"}</strong></div>
            <h3>${escapeHtml(stream.name)}</h3>
            <p>${escapeHtml(stream.context)}</p>
            <small>Surfaced across ${stream.journals.size} ${journalView ? `journal${stream.journals.size === 1 ? "" : "s"}` : `source${stream.journals.size === 1 ? "" : "s"}`}</small>
            <ul>
              ${matches.slice(0, 2).map((record) => `<li><a href="${escapeHtml(record.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(cleanTitle(record.title))} ↗</a><small>${escapeHtml(record.journal)} · ${formatDate(record.date)}</small></li>`).join("")}
            </ul>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderOverallTopicAnalysis(sources) {
  const recordSources = sources.filter((source) => source.recentRecords?.length);
  const journalView = journalsOnly(sources);
  const exactRecords = recordSources.flatMap((source) => (source.recentRecords || []).map((record) => ({
    ...record,
    journal: source.name,
    topic: topicForTitle(record.title),
  })));
  const filteredRecords = publicationState.filters.topic === "All"
    ? exactRecords
    : exactRecords.filter((record) => record.topic === publicationState.filters.topic);
  const classifiedRecords = filteredRecords.filter((record) => record.topic !== "Other analytical science");
  const topicMap = classifiedRecords.reduce((result, record) => {
    if (!result.has(record.topic)) result.set(record.topic, { topic: record.topic, count: 0, journals: new Map() });
    const entry = result.get(record.topic);
    entry.count += 1;
    entry.journals.set(record.journal, (entry.journals.get(record.journal) || 0) + 1);
    return result;
  }, new Map());
  const rankedTopics = [...topicMap.values()].sort((a, b) => b.count - a.count || b.journals.size - a.journals.size);
  const applicationStreams = rankedScienceStreams(filteredRecords, APPLICATION_STREAM_RULES, "Application stream");
  const workflowStreams = rankedScienceStreams(filteredRecords, ANALYTICAL_WORKFLOW_RULES, "Analytical workflow");
  const rankedStreams = [...applicationStreams, ...workflowStreams]
    .sort((a, b) => b.count - a.count || b.journals.size - a.journals.size || a.name.localeCompare(b.name));
  if (!rankedStreams.length) {
    rankedStreams.push(...rankedTopics.map((entry) => ({
      kind: "Technical theme",
      name: entry.topic,
      context: TOPIC_PM_CONTEXT[entry.topic] || "No detailed application stream was identified for this filtered title set.",
      count: entry.count,
      journals: new Set(entry.journals.keys()),
    })));
  }
  const summaryStreams = rankedStreams.slice(0, 3);
  const detailedStreams = rankedStreams.slice(3, 9);
  const panel = byId("publicationOverallAnalysis");

  if (!recordSources.length || !classifiedRecords.length) {
    panel.innerHTML = `<div class="conference-no-results"><strong>No classified publication topics match these filters.</strong><p>Reset or broaden the filters to restore the cross-${journalView ? "journal" : "source"} analysis.</p></div>`;
    return;
  }

  panel.innerHTML = `
    <div class="conference-section-header publication-overall-heading">
      <div><span>Cross-${journalView ? "journal" : "source"} analysis</span><h2 id="publicationOverallHeading">Overall Topic Trends Across ${journalView ? "Publications" : "Source Records"}</h2></div>
      <p>${classifiedRecords.length} classified exact titles · ${recordSources.length} ${journalView ? `journal${recordSources.length === 1 ? "" : "s"}` : `source${recordSources.length === 1 ? "" : "s"}`}</p>
    </div>
    ${summaryStreams.length ? `<div class="publication-overall-summary publication-overall-summary-${Math.min(summaryStreams.length, 3)}">
      ${summaryStreams.map((stream, index) => `<article><span>Overall rank #${index + 1} · ${escapeHtml(stream.kind)}</span><strong>${escapeHtml(stream.name)}</strong><p>${escapeHtml(stream.context)} ${stream.count} exact titles across ${stream.journals.size} ${journalView ? "journals" : "sources"}.</p></article>`).join("")}
    </div>` : ""}
    ${detailedStreams.length ? `<div class="publication-overall-topics">
      ${detailedStreams.map((entry, index) => {
        return `
          <article>
            <div><span>Overall rank #${summaryStreams.length + index + 1} · ${escapeHtml(entry.kind)}</span><strong>${entry.count} exact titles</strong></div>
            <h3>${escapeHtml(entry.name)}</h3>
            <p>${escapeHtml(entry.context)}</p>
            <small>Present across ${entry.journals.size} of ${recordSources.length} ${journalView ? "journals" : "sources"}</small>
          </article>
        `;
      }).join("")}
    </div>` : ""}
  `;
}

function renderSourceRail(sources) {
  const totalPages = Math.max(1, Math.ceil(sources.length / publicationState.sourcePageSize));
  publicationState.sourcePage = Math.min(publicationState.sourcePage, totalPages);
  const start = (publicationState.sourcePage - 1) * publicationState.sourcePageSize;
  const pageSources = sources.slice(start, start + publicationState.sourcePageSize);
  byId("publicationSourceList").innerHTML = pageSources.map((source) => {
    const selected = source.id === publicationState.selectedSourceId;
    const count = currentCount(source);
    return `
      <button type="button" class="publication-source-option${selected ? " selected" : ""}" data-publication-source="${escapeHtml(source.id)}" role="tab" aria-selected="${selected}" aria-controls="publicationDetail">
        <span><strong>${escapeHtml(source.name)}</strong><small>${escapeHtml(source.sourceType || source.sourceClass || "Publication")}</small></span>
        <span class="publication-source-status ${Number.isFinite(count) ? "active" : "mapped"}">${Number.isFinite(count) ? `${count.toLocaleString()} in period` : "Monitoring source"}</span>
      </button>
    `;
  }).join("") || `<p class="publication-empty">No sources match these filters.</p>`;

  const pagination = byId("publicationPagination");
  pagination.hidden = totalPages <= 1;
  pagination.innerHTML = `
    <span>Page ${publicationState.sourcePage} of ${totalPages}</span>
    <div>
      <button type="button" data-publication-page="previous" ${publicationState.sourcePage === 1 ? "disabled" : ""}>Previous</button>
      <button type="button" data-publication-page="next" ${publicationState.sourcePage === totalPages ? "disabled" : ""}>Next</button>
    </div>
  `;
}

function topicSummary(records) {
  const counts = records.reduce((result, record) => {
    const topic = topicForTitle(record.title);
    result[topic] = (result[topic] || 0) + 1;
    return result;
  }, {});
  return Object.entries(counts).sort((a, b) => {
    const aIsCatchAll = a[0] === "Other analytical science";
    const bIsCatchAll = b[0] === "Other analytical science";
    if (aIsCatchAll !== bIsCatchAll) return aIsCatchAll ? 1 : -1;
    return b[1] - a[1] || a[0].localeCompare(b[0]);
  });
}

const COMPETITOR_TITLE_PATTERNS = [
  ["Agilent", /\bAgilent\b/i],
  ["Shimadzu", /\bShimadzu\b/i],
  ["Thermo Fisher", /\bThermo Fisher(?: Scientific)?\b/i],
  ["SCIEX", /\bSCIEX\b/i],
  ["PerkinElmer", /\bPerkinElmer\b/i],
  ["Bruker", /\bBruker\b/i],
  ["JEOL", /\bJEOL\b/i],
];

function competitorTitleMentions(records) {
  return COMPETITOR_TITLE_PATTERNS.map(([competitor, pattern]) => ({
    competitor,
    count: records.filter((record) => pattern.test(cleanTitle(record.title))).length,
  })).filter((item) => item.count > 0);
}

function renderJournalDetail(source) {
  const journalSource = source.sourceClass === "Peer-reviewed journal";
  const topics = topicSummary(source.recentRecords || []);
  const topicMax = Math.max(1, ...topics.map(([, count]) => count));
  const exactRecords = source.recentRecords || [];
  const selectedTopic = topics.some(([topic]) => topic === publicationState.selectedTopic)
    ? publicationState.selectedTopic
    : "";
  const matchingRecords = (selectedTopic
    ? exactRecords.filter((record) => topicForTitle(record.title) === selectedTopic)
    : exactRecords.slice(0, 8));
  const recordPageCount = selectedTopic
    ? Math.max(1, Math.ceil(matchingRecords.length / publicationState.recordPageSize))
    : 1;
  publicationState.recordPage = Math.min(Math.max(1, publicationState.recordPage), recordPageCount);
  const recordStart = (publicationState.recordPage - 1) * publicationState.recordPageSize;
  const records = selectedTopic
    ? matchingRecords.slice(recordStart, recordStart + publicationState.recordPageSize)
    : matchingRecords;
  const classifiedTopics = topics.filter(([topic]) => topic !== "Other analytical science");
  const leadingTopic = classifiedTopics[0] || ["No classified topic", 0];
  const secondaryTopic = classifiedTopics[1] || ["No secondary topic", 0];
  const competitorMentions = competitorTitleMentions(exactRecords);
  const competitorMentionCount = competitorMentions.reduce((sum, item) => sum + item.count, 0);
  return `
    <header class="publication-detail-header">
      <div><span>${journalSource ? "Selected journal" : "Selected source"}</span><h2>${escapeHtml(source.name)}</h2><p>${journalSource ? `${escapeHtml(source.publisher || "Journal publisher")} · ISSN ${escapeHtml(source.issn || "not listed")}` : escapeHtml(source.sourceType || "Trade, forum, or learning source")}</p></div>
      <a href="${escapeHtml(source.homepage)}" target="_blank" rel="noreferrer">Open ${journalSource ? "journal" : "source"} website ↗</a>
    </header>
    <section class="publication-metric-strip publication-content-strip" aria-label="Publication content signals">
      <article><span>Leading content topic</span><strong>${escapeHtml(leadingTopic[0])}</strong><p>${leadingTopic[1]} of ${exactRecords.length} latest exact titles</p></article>
      <article><span>Secondary content topic</span><strong>${escapeHtml(secondaryTopic[0])}</strong><p>${secondaryTopic[1]} of ${exactRecords.length} latest exact titles</p></article>
      <article><span>Topic breadth</span><strong>${classifiedTopics.length} classified technical themes</strong><p>${escapeHtml(classifiedTopics.slice(0, 3).map(([topic]) => topic).join(" · "))}</p></article>
      <article><span>Competitor presence</span><strong>${competitorMentions.length ? escapeHtml(competitorMentions.map((item) => item.competitor).join(", ")) : "No competitor named"}</strong><p>${competitorMentionCount ? `${competitorMentionCount} latest exact title${competitorMentionCount === 1 ? "" : "s"} explicitly name a competitor` : "Latest exact titles describe scientific activity, not named-vendor activity"}</p></article>
    </section>
    <section class="publication-detail-grid">
      <article class="publication-topic-panel">
        <div class="publication-panel-heading"><span>Recent technical emphasis</span><h3>Topics in the Latest Exact Records</h3><p>Each title is assigned once to the first matching technical-topic rule.</p></div>
        <div class="publication-topic-list">
          ${topics.map(([topic, count]) => `<div><span><strong>${escapeHtml(topic)}</strong><a href="#publicationRecordPanel" data-publication-topic="${escapeHtml(topic)}">View ${count} record${count === 1 ? "" : "s"} →</a></span><i><b style="width:${(count / topicMax) * 100}%"></b></i></div>`).join("")}
        </div>
      </article>
      <article class="publication-source-focus">
        <div class="publication-panel-heading"><span>Why monitor it</span><h3>Decision Context for Waters PMs</h3></div>
        <p>${escapeHtml(source.pmDecisionUse || "Use the dated article stream to identify recurring technical and workflow themes.")}</p>
        <div>${(source.primarySignals || []).map((signal) => `<span>${escapeHtml(signal)}</span>`).join("")}</div>
      </article>
    </section>
    <section id="publicationRecordPanel" class="publication-record-panel">
      <div class="conference-section-header"><div><span>Exact evidence</span><h3>${selectedTopic ? escapeHtml(selectedTopic) : (journalSource ? "Latest Publications" : "Latest Source Records")}</h3></div><p>${selectedTopic ? `${matchingRecords.length} matching exact record${matchingRecords.length === 1 ? "" : "s"} · <a href="#publicationRecordPanel" data-publication-topic="">Show all</a>` : `${source.extractedRecords || records.length} ${journalSource ? "recent DOI records" : "dated public records"} collected`}</p></div>
      <div class="publication-record-list">
        ${records.map((record) => `<article><span><small>${formatDate(record.date)}</small><strong>${escapeHtml(cleanTitle(record.title))}</strong><em>${escapeHtml(topicForTitle(record.title))}</em></span><a href="${escapeHtml(record.sourceUrl)}" target="_blank" rel="noreferrer">Open ${journalSource ? "DOI" : "source"} ↗</a></article>`).join("")}
      </div>
      ${selectedTopic && recordPageCount > 1 ? `
        <nav class="conference-event-pagination publication-record-pagination" aria-label="Exact evidence pages">
          <span>Showing ${recordStart + 1}–${Math.min(recordStart + records.length, matchingRecords.length)} of ${matchingRecords.length} · Page ${publicationState.recordPage} of ${recordPageCount}</span>
          <div>
            <button type="button" data-publication-record-page="previous" ${publicationState.recordPage === 1 ? "disabled" : ""}>Previous</button>
            <button type="button" data-publication-record-page="next" ${publicationState.recordPage === recordPageCount ? "disabled" : ""}>Next</button>
          </div>
        </nav>
      ` : ""}
    </section>
  `;
}

function renderMappedSourceDetail(source) {
  return `
    <header class="publication-detail-header">
      <div><span>Selected monitoring source</span><h2>${escapeHtml(source.name)}</h2><p>${escapeHtml(source.sourceType || "Publication, forum, or learning source")}</p></div>
      <a href="${escapeHtml(source.homepage)}" target="_blank" rel="noreferrer">Open source website ↗</a>
    </header>
    <section class="publication-monitoring-callout">
      <strong>Dated publication trend not yet available</strong>
      <p>This URL is mapped for monitoring, but the daily collector does not yet preserve dated article-level records from it. The page therefore does not calculate a publication count or pace.</p>
    </section>
    <section class="publication-detail-grid">
      <article class="publication-source-focus">
        <div class="publication-panel-heading"><span>Monitoring focus</span><h3>What to Track at This Source</h3></div>
        <p>${escapeHtml(source.monitoringMode || "Monitor newly published source records.")}</p>
        <div>${(source.primarySignals || []).map((signal) => `<span>${escapeHtml(signal)}</span>`).join("")}</div>
      </article>
      <article class="publication-source-focus">
        <div class="publication-panel-heading"><span>PM use</span><h3>Why the Source Matters</h3></div>
        <p>${escapeHtml(source.pmDecisionUse || "Use this source for context and validate material claims with exact dated records.")}</p>
        <ul>${(source.watchQuestions || []).map((question) => `<li>${escapeHtml(question)}</li>`).join("")}</ul>
      </article>
    </section>
  `;
}

function renderDetail(source) {
  byId("publicationDetail").innerHTML = source
    ? (source.recentRecords?.length || Object.keys(sourceTrend(source)).length ? renderJournalDetail(source) : renderMappedSourceDetail(source))
    : `<div class="conference-no-results"><strong>No publication matches these filters.</strong><p>Reset or broaden the filters to restore the source list.</p></div>`;
}

function render() {
  const sources = filteredSources();
  if (!sources.some((source) => source.id === publicationState.selectedSourceId)) {
    publicationState.selectedSourceId = sources[0]?.id || "";
    publicationState.sourcePage = 1;
    publicationState.selectedTopic = "";
    publicationState.recordPage = 1;
  }
  renderStats(sources);
  renderFreshHighlights(sources);
  renderOverallTopicAnalysis(sources);
  renderSourceRail(sources);
  renderDetail(sources.find((source) => source.id === publicationState.selectedSourceId));
}

function selectSource(id) {
  publicationState.selectedSourceId = id;
  publicationState.selectedTopic = "";
  publicationState.recordPage = 1;
  const sources = filteredSources();
  const index = sources.findIndex((source) => source.id === id);
  if (index >= 0) publicationState.sourcePage = Math.floor(index / publicationState.sourcePageSize) + 1;
  render();
  byId("publicationDetail")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function bindEvents() {
  [
    ["publicationClassFilter", "sourceClass"],
    ["publicationMarketFilter", "market"],
    ["publicationTopicFilter", "topic"],
    ["publicationPeriodFilter", "period"],
  ].forEach(([id, key]) => byId(id).addEventListener("change", (event) => {
    publicationState.filters[key] = event.target.value;
    publicationState.sourcePage = 1;
    publicationState.selectedTopic = "";
    publicationState.recordPage = 1;
    render();
  }));
  byId("resetPublicationFilters").addEventListener("click", () => {
    publicationState.filters = { sourceClass: "All", market: "All", topic: "All", period: "90" };
    byId("publicationClassFilter").value = "All";
    byId("publicationMarketFilter").value = "All";
    byId("publicationTopicFilter").value = "All";
    byId("publicationPeriodFilter").value = "90";
    publicationState.sourcePage = 1;
    publicationState.selectedTopic = "";
    publicationState.recordPage = 1;
    render();
  });
  document.addEventListener("click", (event) => {
    const topicLink = event.target.closest("[data-publication-topic]");
    if (topicLink) {
      event.preventDefault();
      publicationState.selectedTopic = topicLink.dataset.publicationTopic || "";
      publicationState.recordPage = 1;
      const source = filteredSources().find((item) => item.id === publicationState.selectedSourceId);
      renderDetail(source);
      byId("publicationRecordPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const recordPageButton = event.target.closest("[data-publication-record-page]");
    if (recordPageButton && !recordPageButton.disabled) {
      publicationState.recordPage += recordPageButton.dataset.publicationRecordPage === "next" ? 1 : -1;
      const source = filteredSources().find((item) => item.id === publicationState.selectedSourceId);
      renderDetail(source);
      byId("publicationRecordPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const sourceButton = event.target.closest("[data-publication-source]");
    if (sourceButton) selectSource(sourceButton.dataset.publicationSource);
    const pageButton = event.target.closest("[data-publication-page]");
    if (pageButton && !pageButton.disabled) {
      publicationState.sourcePage += pageButton.dataset.publicationPage === "next" ? 1 : -1;
      renderSourceRail(filteredSources());
    }
  });
}

async function init() {
  const response = await fetch("data/journal_sources.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to load publication sources (${response.status}).`);
  publicationState.data = await response.json();
  const sources = publicationState.data.sources || [];
  populateSelect("publicationClassFilter", uniqueSorted(sources.map(sourceClass)));
  populateMarketSelect();
  populateSelect("publicationTopicFilter", uniqueSorted(sources.flatMap(sourceTopics)));
  publicationState.selectedSourceId = sources.find((source) => source.recentRecords?.length)?.id || sources[0]?.id || "";
  bindEvents();
  render();
}

init().catch((error) => {
  byId("publicationDetail").innerHTML = `<div class="conference-no-results"><strong>Publication intelligence could not load.</strong><p>${escapeHtml(error.message)}</p></div>`;
});
