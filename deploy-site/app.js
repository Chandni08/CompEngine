const state = {
  data: null,
  productData: null,
  sourceCatalog: null,
  conferenceData: null,
  conferencePrep: null,
  journalSources: null,
  productComparisons: null,
  technicalComparisons: null,
  filingInsights: null,
  customerVoice: null,
  refreshStatus: null,
  view: "Product",
  viewDepth: "quick",
  activeComparisonLaunchId: null,
  activeWatersComparatorId: null,
  activeThirdComparatorId: "",
  launchDrilldown: "all",
  activeDecisionBreakdown: null,
  overallTrendCandidates: [],
  competitorIntentProfiles: [],
  activeCustomerVoiceTab: "summary",
};

let customerVoiceSearchTerm = "";
let lastDecisionPacketText = "";
let publishedDataCheckTimer = null;

const filters = {
  role: document.querySelector("#roleFilter"),
  geo: document.querySelector("#geoFilter"),
  segment: document.querySelector("#segmentFilter"),
  technology: document.querySelector("#technologyFilter"),
  competitor: document.querySelector("#competitorFilter"),
  horizon: document.querySelector("#horizonFilter"),
};

const viewCopy = {
  Leadership: {
    title: "Leadership View: Strategic Market Decisions",
    viewLabel: "Leadership view",
    subtitle: "Strategic market shifts, competitor threats, and decisions requiring leadership attention for Waters Next Gen LC.",
    decisionQuestion: "Where should Waters allocate attention, resources, or validation capacity next?",
    categories: ["Scientific application intelligence", "Market intelligence", "Corporate intelligence", "Product intelligence"],
  },
  Product: {
    title: "Product Management View: Roadmap & Whitespace",
    viewLabel: "Product Management view",
    subtitle: "Roadmap priorities, competitor product moves, and whitespace opportunities for Waters Next Gen LC.",
    decisionQuestion: "Which roadmap capability, workflow, or whitespace area needs a PM decision?",
    categories: ["Scientific application intelligence", "Market intelligence", "Corporate intelligence", "Product intelligence"],
  },
  Engineering: {
    title: "Engineering View: Capability & Technology Priorities",
    viewLabel: "Engineering view",
    subtitle: "Competitor capabilities, technical gaps, and engineering questions requiring validation for Waters Next Gen LC.",
    decisionQuestion: "Which hardware, software, automation, or informatics capability needs technical validation?",
    categories: ["Scientific application intelligence", "Market intelligence", "Corporate intelligence", "Product intelligence"],
  },
  Marketing: {
    title: "Product Marketing View: Positioning & Campaign Readiness",
    viewLabel: "Product Marketing view",
    subtitle: "Competitor positioning, customer language, and market narratives requiring a Waters response.",
    decisionQuestion: "Which competitor narrative or customer buying criterion should PMM respond to?",
    categories: ["Scientific application intelligence", "Market intelligence", "Corporate intelligence", "Product intelligence"],
  },
};

const competitorColors = {
  "Thermo Fisher": "#1d67a8",
  Agilent: "#0d9cc4",
  Shimadzu: "#e78a20",
  SCIEX: "#7b4c9e",
  PerkinElmer: "#76a83b",
  "Market-wide": "#6b7280",
};

const primaryCompetitors = ["Thermo Fisher", "Agilent", "Shimadzu", "SCIEX", "PerkinElmer"];

const featureGapRows = [
  {
    competitor: "Waters",
    scores: { Sensitivity: "lead", "Analysis Time": "lead", "Software Usability": "lag", "Regulatory Compliance": "parity" },
  },
  {
    competitor: "Agilent",
    scores: { Sensitivity: "lead", "Analysis Time": "parity", "Software Usability": "lead", "Regulatory Compliance": "parity" },
  },
  {
    competitor: "Shimadzu",
    scores: { Sensitivity: "parity", "Analysis Time": "lead", "Software Usability": "parity", "Regulatory Compliance": "parity" },
  },
  {
    competitor: "SCIEX",
    scores: { Sensitivity: "lead", "Analysis Time": "lead", "Software Usability": "lead", "Regulatory Compliance": "parity" },
  },
  {
    competitor: "Thermo Fisher",
    scores: { Sensitivity: "lead", "Analysis Time": "lead", "Software Usability": "lag", "Regulatory Compliance": "parity" },
  },
  {
    competitor: "PerkinElmer",
    scores: { Sensitivity: "parity", "Analysis Time": "parity", "Software Usability": "parity", "Regulatory Compliance": "parity" },
  },
];

const featureLabels = ["Sensitivity", "Analysis Time", "Software Usability", "Regulatory Compliance"];

function formatDate(value) {
  if (!value) return "Unknown";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function renderRefreshStatus() {
  const node = byId("generatedAt");
  const status = state.refreshStatus || {};
  const lastSuccessful = status.lastSuccessfulRefreshAt || state.data?.generatedAt;
  const parsed = lastSuccessful ? new Date(lastSuccessful) : null;
  const ageHours = parsed && !Number.isNaN(parsed.getTime()) ? (Date.now() - parsed.getTime()) / (1000 * 60 * 60) : Infinity;
  const failed = status.status === "failed";
  const setupRequired = status.status === "setup_required";
  const overdue = ageHours > 36;

  node.className = `refresh-status ${failed ? "failed" : setupRequired ? "setup-required" : overdue ? "overdue" : "current"}`;
  node.textContent = failed
    ? `Daily refresh failed · Last good data ${formatDate(lastSuccessful)}`
    : setupRequired
      ? `Daily refresh setup required · Data from ${formatDate(lastSuccessful)}`
    : overdue
      ? `Daily refresh overdue · Last updated ${formatDate(lastSuccessful)}`
      : `Daily refresh current · Updated ${formatDate(lastSuccessful)}`;
  node.title = status.message || "Automated public-source refresh runs daily.";
}

function schedulePublishedDataCheck() {
  if (publishedDataCheckTimer) return;
  const loadedRefreshTime = state.refreshStatus?.lastSuccessfulRefreshAt || state.data?.generatedAt;
  publishedDataCheckTimer = window.setInterval(async () => {
    try {
      const response = await fetch(`data/refresh_status.json?check=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) return;
      const latest = await response.json();
      const latestTime = new Date(latest.lastSuccessfulRefreshAt || 0).getTime();
      const loadedTime = new Date(loadedRefreshTime || 0).getTime();
      if (latestTime > loadedTime) window.location.reload();
    } catch {
      // Keep the current validated dataset if the freshness check is temporarily unavailable.
    }
  }, 60 * 60 * 1000);
}

function byId(id) {
  return document.getElementById(id);
}

function getPanelTitle(panel) {
  return panel.querySelector("h3")?.textContent?.trim()
    || panel.querySelector(".section-label")?.textContent?.trim()
    || "Panel";
}

function getPanelToggleLabel(panel) {
  return panel.dataset.toggleLabel || "details";
}

function setPanelCollapsed(panel, collapsed) {
  panel.classList.toggle("is-collapsed", collapsed);
  const button = panel.querySelector(":scope > .panel-header .collapse-toggle");
  if (!button) return;
  const toggleLabel = getPanelToggleLabel(panel);
  button.setAttribute("aria-expanded", String(!collapsed));
  button.textContent = collapsed ? `Open ${toggleLabel}` : `Hide ${toggleLabel}`;
  button.title = collapsed ? `Expand ${getPanelTitle(panel)}` : `Collapse ${getPanelTitle(panel)}`;
}

function setViewDepth(depth) {
  state.viewDepth = depth;
  document.querySelectorAll(".quick-reveal").forEach((panel) => panel.classList.remove("quick-reveal"));
  document.body.classList.toggle("view-depth-quick", depth === "quick");
  document.body.classList.toggle("view-depth-deep", depth === "deep");
  const description = byId("viewDepthDescription");
  if (description) description.textContent = depth === "quick" ? "Decisions only" : "All analysis and evidence";
  document.querySelectorAll("#viewDepthControls button").forEach((button) => {
    const active = button.dataset.viewDepth === depth;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  document.querySelectorAll("[data-collapsible='true']").forEach((panel) => {
    const shouldOpen = depth === "deep" || panel.dataset.quickOpen === "true";
    setPanelCollapsed(panel, !shouldOpen);
  });
}

function setupCollapsiblePanels() {
  document.querySelectorAll("[data-collapsible='true']").forEach((panel) => {
    if (panel.dataset.collapseReady === "true") return;
    const header = Array.from(panel.children).find((child) => child.classList?.contains("panel-header"));
    if (!header) return;

    let body = Array.from(panel.children).find((child) => child.classList?.contains("collapsible-body"));
    if (!body) {
      body = document.createElement("div");
      body.className = "collapsible-body";
      const detailNodes = Array.from(panel.children).filter((child) => child !== header);
      detailNodes.forEach((node) => body.appendChild(node));
      panel.appendChild(body);
    }

    let actions = Array.from(header.children).find((child) => child.classList?.contains("panel-header-actions"));
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "panel-header-actions";
      const titleBlock = header.firstElementChild;
      Array.from(header.children)
        .filter((child) => child !== titleBlock)
        .forEach((child) => actions.appendChild(child));
      header.appendChild(actions);
    }

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "collapse-toggle";
    toggle.setAttribute("aria-expanded", "true");
    toggle.textContent = "Hide details";
    toggle.addEventListener("click", () => {
      setPanelCollapsed(panel, !panel.classList.contains("is-collapsed"));
    });
    header.addEventListener("click", (event) => {
      if (event.target.closest("button, a, select, input, summary")) return;
      setPanelCollapsed(panel, !panel.classList.contains("is-collapsed"));
    });
    actions.appendChild(toggle);
    panel.classList.add("collapsible-panel");
    panel.dataset.collapseReady = "true";
  });

  document.querySelectorAll("#viewDepthControls button").forEach((button) => {
    button.addEventListener("click", () => setViewDepth(button.dataset.viewDepth));
  });

  setViewDepth(state.viewDepth);
}

function setActiveSectionNav(targetId) {
  document.querySelectorAll("[data-section-nav]").forEach((link) => {
    const active = link.dataset.sectionNav === targetId;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}

function setupSectionNavigator() {
  const navigator = document.querySelector(".section-navigator");
  if (!navigator) return;

  navigator.addEventListener("click", (event) => {
    const link = event.target.closest("[data-section-nav]");
    if (!link) return;
    const target = byId(link.dataset.sectionNav);
    if (!target) return;
    event.preventDefault();

    if (state.viewDepth === "quick" && target.dataset.quickOpen === "false") {
      document.querySelectorAll(".quick-reveal").forEach((panel) => panel.classList.remove("quick-reveal"));
      target.classList.add("quick-reveal");
      byId("viewDepthDescription").textContent = `Decisions plus ${getPanelTitle(target)}`;
    }
    if (target.classList.contains("is-collapsed")) setPanelCollapsed(target, false);
    setActiveSectionNav(target.id);
    window.history.replaceState(null, "", `#${target.id}`);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  const targets = [...navigator.querySelectorAll("[data-section-nav]")]
    .map((link) => byId(link.dataset.sectionNav))
    .filter(Boolean);
  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
    if (visible[0]) setActiveSectionNav(visible[0].target.id);
  }, { rootMargin: "-12% 0px -72% 0px", threshold: [0, 0.1, 0.25] });
  targets.forEach((target) => observer.observe(target));

  const initialId = window.location.hash.slice(1);
  const initialTarget = targets.find((target) => target.id === initialId);
  if (initialTarget) {
    if (state.viewDepth === "quick" && initialTarget.dataset.quickOpen === "false") {
      initialTarget.classList.add("quick-reveal");
      byId("viewDepthDescription").textContent = `Decisions plus ${getPanelTitle(initialTarget)}`;
    }
    if (initialTarget.classList.contains("is-collapsed")) setPanelCollapsed(initialTarget, false);
    setActiveSectionNav(initialId);
  }
}

function setupSourceCountLinks() {
  byId("sourceCounts").addEventListener("click", (event) => {
    const link = event.target.closest("a[data-evidence-target]");
    if (!link) return;
    const target = byId(link.dataset.evidenceTarget);
    if (target?.dataset.quickOpen === "false" && state.viewDepth === "quick") setViewDepth("deep");
    if (target?.classList.contains("is-collapsed")) setPanelCollapsed(target, false);
  });
}

function setupMetricDrilldowns() {
  byId("metricGrid").addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-launch-view]");
    if (!trigger) return;
    event.preventDefault();
    state.launchDrilldown = trigger.dataset.launchView || "all";
    const target = byId("launch-evidence");
    if (state.viewDepth === "quick") {
      target?.classList.add("quick-reveal");
      const description = byId("viewDepthDescription");
      if (description) description.textContent = "Decisions plus selected launch evidence";
    }
    renderLaunchTimeline();
    if (target?.classList.contains("is-collapsed")) setPanelCollapsed(target, false);
    target?.scrollIntoView({ behavior: "auto", block: "start" });
  });

  byId("launchTimeline").addEventListener("click", (event) => {
    const clear = event.target.closest("[data-clear-launch-view]");
    if (!clear) return;
    state.launchDrilldown = "all";
    renderLaunchTimeline();
  });
}

function setupDecisionEvidenceDrilldowns() {
  byId("decisionPacket").addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-decision-evidence]");
    if (!trigger) return;
    event.preventDefault();
    openDecisionEvidenceModal(trigger.dataset.decisionEvidence);
  });
  byId("hideDecisionEvidence").addEventListener("click", hideDecisionEvidenceModal);
  byId("decisionEvidenceModal").addEventListener("click", (event) => {
    if (event.target === byId("decisionEvidenceModal")) hideDecisionEvidenceModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !byId("decisionEvidenceModal").hidden) hideDecisionEvidenceModal();
  });
}

function setupOverallTrendEvidenceLinks() {
  byId("overallTrendAnalysis").addEventListener("click", (event) => {
    const trigger = event.target.closest("a[data-trend-evidence-family]");
    if (!trigger) return;
    event.preventDefault();
    const candidate = state.overallTrendCandidates.find((item) => item.id === trigger.dataset.trendId);
    const group = candidate?.evidence.groups.find((item) => item.label === trigger.dataset.trendEvidenceFamily);
    if (!candidate || !group) return;
    byId("decisionEvidenceTitle").textContent = `${group.label} proofs`;
    byId("decisionEvidenceSummary").textContent = `${group.items.length} linked public record${group.items.length === 1 ? "" : "s"} support “${candidate.title}.”`;
    byId("decisionEvidenceList").innerHTML = group.items.length
      ? group.items.map((item) => `
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.detail)}</span>
            <small>Open exact record ↗</small>
          </a>
        `).join("")
      : `<div class="empty">No linked public records are available for this evidence type.</div>`;
    byId("decisionEvidenceModal").hidden = false;
    document.body.classList.add("modal-open");
    byId("hideDecisionEvidence").focus();
  });
}

function setupCompetitorIntentEvidenceLinks() {
  byId("competitorIntent").addEventListener("click", (event) => {
    const trigger = event.target.closest("a[data-intent-evidence-type]");
    if (!trigger) return;
    event.preventDefault();
    const profile = state.competitorIntentProfiles.find((item) => item.competitor === trigger.dataset.competitor);
    const group = profile?.evidenceGroups.find((item) => item.key === trigger.dataset.intentEvidenceType);
    if (!profile || !group) return;
    byId("decisionEvidenceTitle").textContent = `${profile.competitor} ${group.label}`;
    byId("decisionEvidenceSummary").textContent = `${group.items.length} linked public record${group.items.length === 1 ? "" : "s"} support this competitor-intent assessment.`;
    byId("decisionEvidenceList").innerHTML = group.items.length
      ? group.items.map((item) => `
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(formatDate(item.date))} · ${escapeHtml(item.sourceName || "Public source")}</span>
            <small>Open exact record ↗</small>
          </a>
        `).join("")
      : `<div class="empty">No linked public records match this evidence category.</div>`;
    byId("decisionEvidenceModal").hidden = false;
    document.body.classList.add("modal-open");
    byId("hideDecisionEvidence").focus();
  });
}

function setupSentimentMentionDrilldowns() {
  byId("sentimentTrendChart").addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-sentiment-view]");
    if (!trigger) return;
    openSentimentMentionEvidence(trigger.dataset.sentimentView);
  });
}

function setupCustomerVoiceSummaryDrilldowns() {
  byId("customerVoiceSummary").addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-customer-voice-records]");
    if (!trigger) return;
    openCustomerVoiceSummaryEvidence(
      trigger.dataset.customerVoiceRecords,
      trigger.dataset.buyingPriority || "",
    );
  });
}

function setCustomerVoiceTab(tabName) {
  state.activeCustomerVoiceTab = tabName;
  document.querySelectorAll("[data-customer-voice-tab]").forEach((button) => {
    const active = button.dataset.customerVoiceTab === tabName;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll("[data-customer-voice-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.customerVoicePanel !== tabName;
  });
}

function setupCustomerVoiceTabs() {
  byId("customerVoiceTabs").addEventListener("click", (event) => {
    const button = event.target.closest("[data-customer-voice-tab]");
    if (!button) return;
    setCustomerVoiceTab(button.dataset.customerVoiceTab);
  });
  setCustomerVoiceTab(state.activeCustomerVoiceTab);
}

function comparisonLaunches() {
  return currentLaunches();
}

function comparisonByLaunchId(launchId) {
  return (state.productComparisons?.launchComparisons || []).find((item) => item.launchId === launchId);
}

function watersComparatorById(id) {
  return (state.productComparisons?.watersSystems || []).find((item) => item.id === id);
}

function thirdComparatorById(id) {
  const waters = state.productComparisons?.watersSystems || [];
  const competitors = state.productComparisons?.thirdComparators || [];
  return [...competitors, ...waters].find((item) => item.id === id);
}

function defaultWatersComparatorForLaunch(launch) {
  const comparison = comparisonByLaunchId(launch?.id);
  if (comparison?.closestWatersId) return comparison.closestWatersId;
  const watersSystems = state.productComparisons?.watersSystems || [];
  const technologyMatch = watersSystems.find((item) => item.technology === launch?.technology);
  if (technologyMatch) return technologyMatch.id;
  if (launch?.technology === "Software") return "empower-lc-workflow";
  if (launch?.technology === "LC-MS/MS") return "xevo-tq-absolute";
  if (launch?.technology === "LC-MS") return "bioaccord-lcms-system";
  if (launch?.technology === "UHPLC") return "acquity-uplc-i-class-plus";
  return watersSystems[0]?.id || "";
}

function launchComparisonTitle(launch) {
  if (!launch) return "Competitor launch";
  return `${launch.competitor}: ${launch.product}`;
}

function optionLabelForComparator(item) {
  return `${item.company}: ${item.product}`;
}

function populateComparisonControls() {
  const launches = comparisonLaunches();
  const watersSystems = state.productComparisons?.watersSystems || [];
  const thirdOptions = [
    ...(state.productComparisons?.thirdComparators || []),
    ...watersSystems,
  ];

  byId("comparisonLaunchSelect").innerHTML = launches
    .map((launch) => `<option value="${escapeHtml(launch.id)}">${escapeHtml(formatDate(launch.date))} · ${escapeHtml(launchComparisonTitle(launch))}</option>`)
    .join("");
  byId("comparisonWatersSelect").innerHTML = watersSystems
    .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.product)}</option>`)
    .join("");
  byId("comparisonThirdSelect").innerHTML = `
    <option value="">No third comparator</option>
    ${thirdOptions.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(optionLabelForComparator(item))}</option>`).join("")}
  `;

  byId("comparisonLaunchSelect").value = state.activeComparisonLaunchId || launches[0]?.id || "";
  byId("comparisonWatersSelect").value = state.activeWatersComparatorId || "";
  byId("comparisonThirdSelect").value = state.activeThirdComparatorId || "";
}

function comparisonMetricCard(label, value, note) {
  return `
    <article class="comparison-metric-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <p>${escapeHtml(note)}</p>
    </article>
  `;
}

function comparatorSnapshotCard(title, item, sourceUrl) {
  if (!item) return "";
  const context = [item.company, item.technology || item.bestFor?.[0]].filter(Boolean).join(" · ");
  return `
    <article class="comparator-snapshot">
      <div class="comparator-snapshot-copy">
        <span>${escapeHtml(title)}</span>
        <strong>${escapeHtml(item.product)}</strong>
        ${context ? `<small>${escapeHtml(context)}</small>` : ""}
      </div>
      ${sourceUrl ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">Source ↗</a>` : ""}
    </article>
  `;
}

function shortHorizonDefenseItems() {
  if (!["30d", "60d"].includes(filters.horizon.value)) return [];
  return currentLaunches()
    .map((launch) => ({
      launch,
      comparison: comparisonByLaunchId(launch.id),
    }))
    .filter((item) => item.comparison?.shortHorizonDefense)
    .sort((a, b) => new Date(b.launch.date) - new Date(a.launch.date));
}

function listMarkup(items) {
  return (items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function shortHorizonDefenseMarkup(launch, comparison, compact = false) {
  const defense = comparison.shortHorizonDefense;
  if (!defense) return "";
  const changeItems = compact ? defense.whatChanged.slice(0, 2) : defense.whatChanged;
  const actionItems = compact ? defense.immediateDefenseActions.slice(0, 2) : defense.immediateDefenseActions;
  const weakItems = compact ? defense.stillWeak.slice(0, 2) : defense.stillWeak;
  return `
    <div class="defense-old-new">
      <article>
        <span>Old baseline</span>
        <strong>${escapeHtml(defense.priorMachine)}</strong>
      </article>
      <article>
        <span>New signal</span>
        <strong>${escapeHtml(defense.newMachine)}</strong>
      </article>
    </div>
    <div class="defense-grid">
      <article>
        <span>What changed</span>
        <ul>${listMarkup(changeItems)}</ul>
      </article>
      <article>
        <span>Why it matters to Waters</span>
        <p>${escapeHtml(defense.whyItMattersToWaters)}</p>
      </article>
      <article class="defense-now">
        <span>Defend now</span>
        <ul>${listMarkup(actionItems)}</ul>
      </article>
      <article>
        <span>Where they are still weak</span>
        <ul>${listMarkup(weakItems)}</ul>
      </article>
    </div>
    ${
      compact
        ? `<button type="button" data-compare-launch="${escapeHtml(launch.id)}">Open full comparison</button>`
        : ""
    }
  `;
}

function renderShortHorizonDefense() {
  const panel = byId("shortHorizonDefensePanel");
  const isShortHorizon = ["30d", "60d"].includes(filters.horizon.value);
  const items = shortHorizonDefenseItems();
  panel.hidden = !isShortHorizon || !items.length;
  if (panel.hidden) return;

  byId("shortHorizonDefenseCount").textContent = `${items.length} ${items.length === 1 ? "brief" : "briefs"}`;
  byId("shortHorizonDefense").innerHTML = `
    <div class="defense-summary">
      <strong>${horizonLabel()} defense mode</strong>
      <span>Recent launches get old-vs-new analysis, Waters impact, immediate defense actions, and competitor weaknesses.</span>
    </div>
    ${items
      .map(({ launch, comparison }) => `
        <article class="defense-brief-card">
          <div class="defense-brief-top">
            <div>
              <h4>${escapeHtml(launch.product)}</h4>
              <p class="panel-helper">${escapeHtml(launch.competitor)} · ${escapeHtml(launch.technology)}</p>
              <p>${escapeHtml(formatDate(launch.date))} · ${escapeHtml(launch.signalType)} · confidence ${escapeHtml(launch.confidence)}</p>
            </div>
            <span class="tag ${comparison.threatLevel === "High" ? "high" : "medium"}">${escapeHtml(comparison.threatLevel)} threat</span>
          </div>
          ${shortHorizonDefenseMarkup(launch, comparison, true)}
        </article>
      `)
      .join("")}
  `;
}

function technicalEvidenceLabel(type) {
  return {
    verified: "Verified public specifications",
    "vendor-claim": "Vendor claims; validate in testing",
    "conditions-differ": "Published values; test conditions differ",
    mixed: "Partial public specification",
  }[type] || "Source review required";
}

function technicalEvidenceClass(type) {
  return ["verified", "vendor-claim", "conditions-differ", "mixed"].includes(type) ? type : "mixed";
}

function technicalComparisonFallback(launch, waters) {
  const isMassSpec = /MS/i.test(launch.technology || "") || /mass spectrometer/i.test(launch.product || "");
  const dimensions = isMassSpec
    ? "mass range, analyzer type, resolving power, acquisition or MRM rate, sensitivity test conditions, source options, robustness, footprint, utilities, software, and compliance"
    : "pressure, flow range and precision, gradient delay volume, injection range and cycle time, carryover under a common protocol, sample capacity, temperature control, detectors, software, and service diagnostics";
  return `
    <section class="technical-comparison technical-comparison-pending">
      <div class="technical-comparison-heading">
        <div>
          <h4>Technical comparison</h4>
          <p class="panel-helper">Specification record still being completed.</p>
          <p>A verified row-by-row comparison is not yet loaded for ${escapeHtml(launch.product)} versus ${escapeHtml(waters?.product || "the selected Waters system")}.</p>
        </div>
        <span class="technical-status mixed">Source review required</span>
      </div>
      <p><strong>Required technical review:</strong> ${escapeHtml(dimensions)}. Until these values are sourced under comparable conditions, use the workflow interpretation below only as a discussion guide.</p>
    </section>
  `;
}

function technicalComparisonMarkup(profile, launch, waters) {
  if (!profile) return technicalComparisonFallback(launch, waters);

  return `
    <section class="technical-comparison">
      <div class="technical-comparison-heading">
        <div>
          <h4>Technical comparison</h4>
          <p class="panel-helper">Published specifications, test limits, and product implications.</p>
          <p>${escapeHtml(profile.comparisonBasis)} Reviewed ${escapeHtml(formatDate(profile.asOfDate))}.</p>
        </div>
        <div class="technical-legend" aria-label="Evidence labels">
          <span class="technical-status verified">Verified specification</span>
          <span class="technical-status vendor-claim">Vendor claim</span>
          <span class="technical-status conditions-differ">Conditions differ</span>
          <span class="technical-status mixed">Partial specification</span>
        </div>
      </div>
      <div class="comparison-table-wrap technical-table-wrap">
        <table class="comparison-table technical-table">
          <thead>
            <tr>
              <th>Technical dimension</th>
              <th>${escapeHtml(launch.competitor)}: ${escapeHtml(launch.product)}</th>
              <th>Waters: ${escapeHtml(profile.watersProduct || waters?.product || "selected system")}</th>
              <th>What the PM should conclude</th>
              <th>Evidence quality</th>
            </tr>
          </thead>
          <tbody>
            ${(profile.rows || []).map((row) => `
              <tr>
                <td><strong>${escapeHtml(row.dimension)}</strong></td>
                <td>
                  <p>${escapeHtml(row.competitorValue)}</p>
                  <a href="${escapeHtml(row.competitorSourceUrl)}" target="_blank" rel="noreferrer">Competitor source</a>
                </td>
                <td>
                  <p>${escapeHtml(row.watersValue)}</p>
                  <a href="${escapeHtml(row.watersSourceUrl)}" target="_blank" rel="noreferrer">Waters source</a>
                </td>
                <td>${escapeHtml(row.interpretation)}</td>
                <td><span class="technical-status ${technicalEvidenceClass(row.evidenceType)}">${escapeHtml(technicalEvidenceLabel(row.evidenceType))}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      <details class="comparison-limits">
        <summary>Comparison limits</summary>
        <ul>${(profile.limitations || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </details>
    </section>
  `;
}

function renderComparisonBody() {
  const launch = comparisonLaunches().find((item) => item.id === state.activeComparisonLaunchId);
  if (!launch) {
    byId("comparisonSnapshots").innerHTML = "";
    byId("comparisonBody").innerHTML = `<div class="empty">No launch selected for comparison.</div>`;
    return;
  }

  const comparison = comparisonByLaunchId(launch.id) || {};
  const waters = watersComparatorById(state.activeWatersComparatorId) || watersComparatorById(defaultWatersComparatorForLaunch(launch));
  const third = state.activeThirdComparatorId ? thirdComparatorById(state.activeThirdComparatorId) : null;
  const thirdColumn = third
    ? `<th>${escapeHtml(third.company || "Third")}</th>`
    : "";
  const thirdCells = third
    ? (comparison.dimensions || []).map((row) => `<td>${escapeHtml(row.third || third.decisionRole || third.strengths?.[0] || "Use as manual benchmark.")}</td>`)
    : [];
  const sourceUrl = timelineUrlForLaunch(launch);
  const technicalProfile = (state.technicalComparisons?.profiles || []).find(
    (item) => item.launchId === launch.id && (!item.watersId || item.watersId === waters?.id),
  );

  byId("comparisonSubtitle").textContent = `${launch.competitor} launch · ${formatDate(launch.date)} · ${launch.technology} · ${launch.marketSegment}`;
  byId("comparisonSnapshots").innerHTML = `
    ${comparatorSnapshotCard("Competitor", {
      company: launch.competitor,
      product: launch.product,
      technology: launch.technology,
    }, sourceUrl)}
    ${comparatorSnapshotCard("Waters", waters, waters?.sourceUrl)}
    ${third ? comparatorSnapshotCard("Third comparator", third, third.sourceUrl) : ""}
  `;

  byId("comparisonBody").innerHTML = `
    <div class="comparison-readout">
      ${comparisonMetricCard("Potential impact on Waters", comparison.threatLevel || "Needs review", "How strongly this launch may affect Waters product priorities or positioning.")}
      ${comparisonMetricCard("Public-source confidence", launch.confidence ? `${launch.confidence}/100` : "Not scored", "How strongly the linked public source supports the launch record; detailed feature differences still require specification review.")}
    </div>
    <section class="comparison-positioning">
      <div>
        <h4>What this means for Waters</h4>
        <p>${escapeHtml(comparison.pmRead || launch.pmImplication)}</p>
      </div>
      <div>
        <h4>How to position Waters</h4>
        <p>${escapeHtml(comparison.watersPositioning || "Position Waters around complete workflow value, not only instrument specifications.")}</p>
      </div>
    </section>
    ${
      comparison.shortHorizonDefense
        ? `<section class="comparison-defense-section">
            <div class="mini-header">
              <h4>Short-horizon defense</h4>
              <p class="panel-helper">Old versus new, the immediate Waters action, and where the competitor is still weak.</p>
            </div>
            ${shortHorizonDefenseMarkup(launch, comparison)}
          </section>`
        : ""
    }
    ${technicalComparisonMarkup(technicalProfile, launch, waters)}
    <section>
      <div class="mini-header">
        <h4>Commercial and workflow interpretation</h4>
        <p class="panel-helper">How the technical evidence changes the product decision.</p>
      </div>
      <div class="comparison-table-wrap">
        <table class="comparison-table">
          <thead>
            <tr>
              <th>Decision dimension</th>
              <th>${escapeHtml(launch.competitor)}</th>
              <th>Waters</th>
              ${thirdColumn}
              <th>Why this matters for Waters</th>
            </tr>
          </thead>
          <tbody>
            ${(comparison.dimensions || [])
              .map((row, index) => `
                <tr>
                  <td><strong>${escapeHtml(row.dimension)}</strong></td>
                  <td>${escapeHtml(row.competitor)}</td>
                  <td>${escapeHtml(row.waters)}</td>
                  ${third ? thirdCells[index] : ""}
                  <td>${escapeHtml(row.pmRead)}</td>
                </tr>
              `)
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
    <section class="comparison-action-grid">
      <article>
        <span>Positioning moves</span>
        <ul>${(comparison.positioningMoves || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </article>
      <article>
        <span>Questions to answer before a roadmap decision</span>
        <ul>${(comparison.validationQuestions || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </article>
      <article>
        <span>Waters comparator strengths</span>
        <ul>${(waters?.strengths || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </article>
    </section>
    <p class="comparison-caution">Working comparison based on public information. Verify exact specifications, performance claims, and customer evidence before using it outside an internal product discussion.</p>
  `;
}

function renderProductComparator() {
  const launches = comparisonLaunches();
  if (!launches.length) {
    byId("comparisonLaunchSelect").innerHTML = "";
    byId("comparisonWatersSelect").innerHTML = "";
    byId("comparisonThirdSelect").innerHTML = `<option value="">No third comparator</option>`;
    byId("comparisonTitle").textContent = "Product comparator";
    byId("comparisonSubtitle").textContent = "Change the horizon, technology, market, or competitor filter to see available comparisons.";
    byId("comparisonSnapshots").innerHTML = "";
    byId("comparisonBody").innerHTML = `<div class="empty">No competitor launches with comparison data match the active filters.</div>`;
    return;
  }

  const selectedLaunch = launches.find((item) => item.id === state.activeComparisonLaunchId) || launches[0];
  const comparison = comparisonByLaunchId(selectedLaunch.id);
  state.activeComparisonLaunchId = selectedLaunch.id;
  state.activeWatersComparatorId = watersComparatorById(state.activeWatersComparatorId)
    ? state.activeWatersComparatorId
    : comparison?.closestWatersId || defaultWatersComparatorForLaunch(selectedLaunch);
  populateComparisonControls();
  renderComparisonBody();
}

function openComparisonPanel(launchId) {
  const launch = comparisonLaunches().find((item) => item.id === launchId) || comparisonLaunches()[0];
  if (!launch) return;
  const comparison = comparisonByLaunchId(launch.id);
  state.activeComparisonLaunchId = launch.id;
  state.activeWatersComparatorId = comparison?.closestWatersId || defaultWatersComparatorForLaunch(launch);
  state.activeThirdComparatorId = comparison?.defaultThirdComparatorId || "";
  populateComparisonControls();
  renderComparisonBody();
  const panel = byId("product-comparator");
  if (state.viewDepth === "quick") {
    panel.classList.add("quick-reveal");
    byId("viewDepthDescription").textContent = "Decisions plus selected product comparison";
  }
  if (panel.classList.contains("is-collapsed")) setPanelCollapsed(panel, false);
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
  byId("comparisonWatersSelect").focus();
}

function setupComparisonPanel() {
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-compare-launch]");
    if (trigger) {
      event.preventDefault();
      openComparisonPanel(trigger.dataset.compareLaunch);
    }
  });

  byId("comparisonLaunchSelect").addEventListener("change", (event) => {
    const launch = comparisonLaunches().find((item) => item.id === event.target.value);
    const comparison = comparisonByLaunchId(event.target.value);
    state.activeComparisonLaunchId = event.target.value;
    state.activeWatersComparatorId = comparison?.closestWatersId || defaultWatersComparatorForLaunch(launch);
    state.activeThirdComparatorId = comparison?.defaultThirdComparatorId || "";
    populateComparisonControls();
    renderComparisonBody();
  });
  byId("comparisonWatersSelect").addEventListener("change", (event) => {
    state.activeWatersComparatorId = event.target.value;
    renderComparisonBody();
  });
  byId("comparisonThirdSelect").addEventListener("change", (event) => {
    state.activeThirdComparatorId = event.target.value;
    renderComparisonBody();
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function evidenceLinksForCompetitor(competitor) {
  if (competitor === "Waters") return [];

  const sources = state.sourceCatalog?.sources || [];
  const launches = state.productData?.launches || [];
  const badUrls = new Set(sources.filter((source) => source.health === "bad").map((source) => source.url));
  const healthRank = { good: 0, blocked: 1, manual: 2, bad: 3 };
  const seen = new Set();

  const launchLinks = launches
    .filter((launch) => launch.competitor === competitor)
    .filter((launch) => isHttpUrl(launch.sourceUrl) && !badUrls.has(launch.sourceUrl))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map((launch) => ({
      label: launch.product,
      url: launch.sourceUrl,
      title: `${launch.signalType}: ${launch.product}`,
    }));

  const sourceLinks = sources
    .filter((source) => source.competitor === competitor)
    .filter((source) => isHttpUrl(source.url) && source.health !== "bad")
    .sort((a, b) => (healthRank[a.health] ?? 9) - (healthRank[b.health] ?? 9))
    .map((source) => ({
      label: source.source.replace(`${competitor} `, ""),
      url: source.url,
      title: source.health === "blocked" ? `${source.source} requires manual review` : source.source,
    }));

  return [...launchLinks, ...sourceLinks]
    .filter((link) => {
      if (seen.has(link.url)) return false;
      seen.add(link.url);
      return true;
    })
    .slice(0, 3);
}

function timelineUrlForLaunch(launch) {
  const sources = state.sourceCatalog?.sources || [];
  const badUrls = new Set(sources.filter((source) => source.health === "bad").map((source) => source.url));
  if (isHttpUrl(launch.sourceUrl) && !badUrls.has(launch.sourceUrl)) return launch.sourceUrl;
  const fallback = sources.find((source) => source.competitor === launch.competitor && source.health === "good" && isHttpUrl(source.url));
  return fallback?.url || launch.sourceUrl;
}

function pubMedSearchUrl(query) {
  return `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(query)}`;
}

function pubMedTrendSearchUrl(query, horizon) {
  const days = { "30d": 30, "60d": 60, "90d": 90, "1y": 365, "3y": 365 * 3 }[horizon] || 365;
  const asOf = state.data?.asOfDate || new Date().toISOString().slice(0, 10);
  const end = new Date(`${asOf}T00:00:00Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  const pubMedDate = (date) => date.toISOString().slice(0, 10).replaceAll("-", "/");
  const datedQuery = `(${query}) AND ("${pubMedDate(start)}"[Date - Publication] : "${pubMedDate(end)}"[Date - Publication])`;
  return pubMedSearchUrl(datedQuery);
}

function horizonLabel() {
  return filters.horizon.options[filters.horizon.selectedIndex].text;
}

function trendMomentum(trend, horizon) {
  const count = trend.counts[horizon] || 0;
  const oneYear = trend.counts["1y"] || 0;
  const expectedForHorizon = {
    "30d": oneYear / 12,
    "60d": oneYear / 6,
    "90d": oneYear / 4,
    "1y": (trend.counts["3y"] || oneYear * 3) / 3,
    "3y": ((trend.counts["5y"] || count) / 5) * 3,
    "5y": count,
  }[horizon] || count;
  const ratio = expectedForHorizon ? count / expectedForHorizon : 1;
  if (ratio >= 1.18) return { label: "Accelerating", tone: "high", note: "publishing faster than its recent baseline" };
  if (ratio <= 0.82) return { label: "Cooling", tone: "medium", note: "publishing slower than its recent baseline" };
  return { label: "Steady", tone: "steady", note: "publishing near its recent baseline" };
}

function pullStrengthLabel(score) {
  if (score >= 70) return "High roadmap relevance";
  if (score >= 55) return "Medium roadmap relevance";
  return "Low roadmap relevance based on current public evidence";
}

function trendPmQuestion(trend) {
  const theme = trend.theme.toLowerCase();
  if (theme.includes("lnp") || theme.includes("rna")) {
    return "Do we need clearer LC-MS workflow coverage for RNA therapeutics and LNP characterization?";
  }
  if (theme.includes("oligonucleotide") || theme.includes("nucleic")) {
    return "Should oligo analytics move higher in application kits, methods, and software workflow planning?";
  }
  if (theme.includes("pfas") || theme.includes("environmental")) {
    return "Is the roadmap strong enough for regulated PFAS sensitivity, throughput, and compliance needs?";
  }
  if (theme.includes("proteomics") || theme.includes("metabolomics")) {
    return "Where should Waters defend high-resolution LC-MS discovery workflows versus competitor platforms?";
  }
  if (theme.includes("automation") || theme.includes("software")) {
    return "Which software and automation capabilities should become product-level differentiators?";
  }
  return "What product capability, workflow proof, or application note should this trend change?";
}

function recommendationPriorityRank(priority) {
  return { High: 0, Medium: 1, Low: 2 }[priority] ?? 3;
}

function recommendationTrend(rec) {
  return currentTrends().find((trend) => {
    const technologyMatch = rec.technology === "All" || trend.technology === rec.technology;
    const segmentMatch = rec.marketSegment === "All" || trend.marketSegment === rec.marketSegment;
    return technologyMatch && segmentMatch;
  });
}

function sourceHealthForUrl(url) {
  if (!isHttpUrl(url)) return "manual";
  const source = (state.sourceCatalog?.sources || []).find((item) => item.url === url);
  return source?.health || "good";
}

function sourceHealthLabel(health) {
  if (health === "good") return "Verified source";
  if (health === "blocked") return "Manual source";
  if (health === "bad") return "Needs replacement";
  return "Manual evidence";
}

function sourceStatusCopy(status) {
  return {
    access_policy_needed: "Access policy needed",
    needs_source_map: "Needs source map",
    needs_source_discovery: "Needs source discovery",
    source_map_created: "Source map ready",
  }[status] || status || "Pending";
}

function recommendationEvidenceLinks(rec) {
  const links = Array.isArray(rec.evidenceBasis?.links)
    ? rec.evidenceBasis.links
        .filter((link) => isHttpUrl(link?.url))
        .map((link) => ({
          label: link.label || "Supporting evidence",
          url: link.url,
          health: sourceHealthForUrl(link.url),
        }))
    : [];
  const trend = recommendationTrend(rec);
  if (trend) {
    links.push({
      label: "PubMed trend",
      url: pubMedSearchUrl(trend.query),
      health: "good",
    });
  }

  const matchingLaunches = currentLaunches()
    .filter((launch) => {
      const technologyMatch = rec.technology === "All" || launch.technology === rec.technology || launch.technology.includes(rec.technology);
      const segmentMatch = rec.marketSegment === "All" || launch.marketSegment === rec.marketSegment;
      return technologyMatch || segmentMatch;
    })
    .slice(0, 2);

  matchingLaunches.forEach((launch) => {
    const url = timelineUrlForLaunch(launch);
    links.push({
      label: `${launch.competitor} launch`,
      url,
      health: sourceHealthForUrl(url),
    });
  });

  const seen = new Set();
  return links.filter((link) => {
    if (!isHttpUrl(link.url) || seen.has(link.url)) return false;
    seen.add(link.url);
    return true;
  });
}

function recommendationEvidenceSummary(rec) {
  if (rec.evidenceBasis && typeof rec.evidenceBasis === "object") {
    return rec.evidenceBasis.summary || rec.why || "Linked public evidence supports this recommendation.";
  }
  return rec.evidenceBasis || rec.why || "Linked public evidence supports this recommendation.";
}

function renderCoverageGaps() {
  const sources = state.sourceCatalog?.sources || [];
  const sourceIssues = sources.filter((source) => ["bad", "blocked"].includes(source.health)).length;
  const activeExtractors = sources.filter((source) => source.extractionStatus === "extracted").length;
  const blockedExtractors = sources.filter((source) => source.extractionStatus === "blocked").length;
  const hasRetirements = state.productData.launches.some((launch) => /retirement/i.test(launch.signalType));
  const customerVoice = sources.find((source) => source.id === "customer-voice");
  const tradePublications = sources.find((source) => source.id === "trade-publications");
  const perkinelmerNews = sources.find((source) => source.id === "perkinelmer-news");
  const items = [
    {
      status: "Ready",
      title: "Product launches, updates, and workflow launches",
      detail: `${state.productData.launches.length} tracked competitor launches and product changes are visible and linked to public source pages where available.`,
      tone: "ready",
    },
    {
      status: hasRetirements ? "Ready" : "Gap",
      title: "Product retirement announcements",
      detail: hasRetirements
        ? "Retirement signals are present in the product intelligence data."
        : "No verified retirement announcements are in the current data set; do not infer whitespace from retirements yet.",
      tone: hasRetirements ? "ready" : "gap",
    },
    {
      status: sourceStatusCopy(customerVoice?.status),
      title: "Customer voice and adoption patterns",
      detail: customerVoice?.issue || "Customer forums, ResearchGate, LinkedIn, and adoption signals need approved collection before PM scoring.",
      tone: "watch",
    },
    {
      status: sourceStatusCopy(tradePublications?.status),
      title: "Trade-publication and analyst-like coverage",
      detail: tradePublications?.nextAction || "Prioritize the most useful feeds before treating market narratives as a measured trend.",
      tone: "watch",
    },
    {
      status: sourceStatusCopy(perkinelmerNews?.status),
      title: "Competitor news extraction balance",
      detail: `${activeExtractors} official sources are actively extracted; ${blockedExtractors} are reachable or registered but cannot currently be extracted. A health check alone is never counted as monitoring.`,
      tone: blockedExtractors ? "watch" : "ready",
    },
    {
      status: `${sourceIssues} issues`,
      title: "Source reliability impact",
      detail: "Blocked or bad sources are flagged for review without subtracting points from recommendation scores.",
      tone: sourceIssues ? "watch" : "ready",
    },
  ];

  byId("coverageGaps").innerHTML = items
    .map(
      (item) => `
        <article class="coverage-item ${item.tone}">
          <span>${escapeHtml(item.status)}</span>
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <p>${escapeHtml(item.detail)}</p>
          </div>
        </article>
      `,
    )
    .join("");
}

function currentSignals() {
  return filteredSignalsForHorizon(filters.horizon.value);
}

function geographyMatches(itemGeography) {
  const selectedGeography = filters.geo.value;
  const geography = itemGeography || "Global";
  if (selectedGeography === "All") return true;
  if (selectedGeography === "Global") return geography === "Global";
  return geography === selectedGeography || geography === "Global";
}

function filteredSignalsForHorizon(horizonValue) {
  if (!state.data) return [];
  const allowedCategories = viewCopy[state.view].categories;
  return state.data.signals.filter((signal) => {
    const categoryMatch = allowedCategories.includes(signal.category);
    const horizonMatch = inHorizon(signal.date, horizonValue);
    const geoMatch = geographyMatches(signal.geography);
    const segmentMatch = filters.segment.value === "All" || signal.marketSegment === filters.segment.value;
    const technologyMatch = filters.technology.value === "All" || signal.technology === filters.technology.value;
    const competitorMatch = filters.competitor.value === "All" || signal.competitor === filters.competitor.value;
    return categoryMatch && horizonMatch && geoMatch && segmentMatch && technologyMatch && competitorMatch;
  });
}

function currentStrategicSignals(signals) {
  return signals
    .filter((signal) => signal.category === "Corporate intelligence")
    .filter((signal) => /partnership|partner|collaboration|strategic initiative|strategic market investment|ai ecosystem|ecosystem|integration|research hub|customer experience center/i.test(`${signal.signalType} ${signal.title} ${signal.summary}`))
    .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
}

const horizonDays = {
  "30d": 30,
  "60d": 60,
  "90d": 90,
  "1y": 365,
  "3y": 365 * 3,
  "5y": 365 * 5,
};

function inHorizon(dateValue, horizonValue = filters.horizon.value) {
  const launchDate = /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
    ? new Date(`${dateValue}T00:00:00`)
    : new Date(dateValue);
  const asOfValue = state.data?.asOfDate || new Date().toISOString().slice(0, 10);
  const asOf = /^\d{4}-\d{2}-\d{2}$/.test(asOfValue)
    ? new Date(`${asOfValue}T00:00:00`)
    : new Date(asOfValue);
  if (Number.isNaN(launchDate.getTime())) return true;
  const ageDays = (asOf - launchDate) / (1000 * 60 * 60 * 24);
  return ageDays >= 0 && ageDays <= (horizonDays[horizonValue] || horizonDays["5y"]);
}

function inSelectedHorizon(dateValue) {
  return inHorizon(dateValue, filters.horizon.value);
}

function currentLaunches() {
  return filteredLaunchesForHorizon(filters.horizon.value);
}

function filteredLaunchesForHorizon(horizonValue) {
  if (!state.productData) return [];
  return state.productData.launches
    .filter((launch) => inHorizon(launch.date, horizonValue))
    .filter((launch) => geographyMatches(launch.geography))
    .filter((launch) => filters.segment.value === "All" || launch.marketSegment === filters.segment.value)
    .filter((launch) => filters.technology.value === "All" || launch.technology === filters.technology.value)
    .filter((launch) => filters.competitor.value === "All" || launch.competitor === filters.competitor.value)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function currentConferenceSources() {
  const events = state.conferencePrep?.events || [];
  return events
    .filter((event) => filters.segment.value === "All" || event.marketSegments.includes(filters.segment.value))
    .filter((event) => filters.technology.value === "All" || event.technologyFocus.some((technology) => technology.includes(filters.technology.value)))
    .filter((event) => filters.competitor.value === "All" || event.competitorWatch.some((competitor) => competitor.name === filters.competitor.value))
    .sort((a, b) => {
      const tierRank = a.tier === b.tier ? 0 : a.tier === "Tier 1" ? -1 : 1;
      return tierRank || new Date(a.startDate) - new Date(b.startDate);
    });
}

function currentFilingInsights() {
  return filteredFilingInsightsForHorizon(filters.horizon.value);
}

function filteredFilingInsightsForHorizon(horizonValue) {
  const insights = state.filingInsights?.insights || [];
  return insights
    .filter((insight) => inHorizon(insight.date, horizonValue))
    .filter((insight) => filters.segment.value === "All" || insight.marketSegment === filters.segment.value)
    .filter((insight) => {
      if (filters.technology.value === "All") return true;
      if (insight.technology === filters.technology.value) return true;
      if (insight.technology !== "Portfolio") return false;
      return textMatchesTechnology(`${insight.headline} ${insight.evidence} ${insight.whyItMatters} ${insight.pmImplication}`, filters.technology.value);
    })
    .filter((insight) => filters.competitor.value === "All" || insight.competitor === filters.competitor.value)
    .sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0));
}

function currentTrends() {
  const horizon = filters.horizon.value;
  return state.data.trends.themes
    .filter((trend) => filters.segment.value === "All" || trend.marketSegment === filters.segment.value)
    .filter((trend) => filters.technology.value === "All" || trend.technology === filters.technology.value)
    .sort((a, b) => (b.counts[horizon] || 0) - (a.counts[horizon] || 0));
}

function textMatchesTechnology(text, technology) {
  if (technology === "All") return true;
  const haystack = String(text || "").toLowerCase();
  const needle = technology.toLowerCase();
  if (needle === "lc") return /(^|[^a-z0-9])(?:lc|hplc)(?!\s*-?\s*ms)(?=$|[^a-z0-9])/.test(haystack);
  if (needle === "uhplc") return /uhplc|uplc|nexera|infinity|module|detector/.test(haystack);
  if (needle === "lc-ms/ms") return /lc-ms\/ms|lc-ms ms|quantitation|quantitative|triple quadrupole|pfas/.test(haystack);
  if (needle === "lc-ms") return /lc-ms|mass spectrom|ms workflow|hrms|tof|zenotof|proteomics|metabolomics|oligo|rna|lnp/.test(haystack);
  if (needle === "2d lc") return /2d\s*-?\s*lc|two-dimensional liquid chromatography/.test(haystack);
  if (needle === "software") return /software|informatics|ai|openlab|os|workflow|automation|data/.test(haystack);
  if (needle === "portfolio") return /portfolio|corporate|filing|segment/.test(haystack);
  if (haystack.includes(needle)) return true;
  return false;
}

function itemMatchesRecommendation(item, rec) {
  const combined = `${item.technology || ""} ${item.marketSegment || ""} ${item.title || ""} ${item.product || ""} ${item.summary || ""} ${item.pmImplication || ""} ${item.intent || ""}`;
  const technologyMatch = rec.technology === "All" || item.technology === rec.technology || textMatchesTechnology(combined, rec.technology);
  const segmentMatch = rec.marketSegment === "All" || item.marketSegment === rec.marketSegment || String(combined).toLowerCase().includes(String(rec.marketSegment).toLowerCase());
  return technologyMatch && segmentMatch;
}

function recommendationMatchesFilters(rec) {
  const filterText = `${rec.title} ${rec.why} ${rec.whyNow} ${rec.action} ${rec.nextAction} ${rec.affectedCapability} ${recommendationEvidenceSummary(rec)}`;
  const technologyMatch = filters.technology.value === "All" || rec.technology === filters.technology.value || textMatchesTechnology(filterText, filters.technology.value);
  const segmentMatch = filters.segment.value === "All" || rec.marketSegment === filters.segment.value || filterText.toLowerCase().includes(filters.segment.value.toLowerCase());
  return technologyMatch && segmentMatch;
}

function evidenceForRecommendation(rec, signals) {
  const trend = currentTrends().find((item) => itemMatchesRecommendation(item, rec));
  const launches = currentLaunches().filter((launch) => itemMatchesRecommendation(launch, rec));
  const strategic = currentStrategicSignals(signals).filter((signal) => itemMatchesRecommendation(signal, rec));
  const filings = currentFilingInsights().filter((insight) => itemMatchesRecommendation(insight, rec));
  return { trend, launches, strategic, filings };
}

function actionForRecommendation(rec, breakdown) {
  const text = `${rec.title} ${rec.affectedCapability}`.toLowerCase();
  if (rec.regionalEvidenceMissing) return "Monitor";
  const momentum = breakdown.evidence?.trend ? trendMomentum(breakdown.evidence.trend, filters.horizon.value) : null;
  const directEvidence = breakdown.evidence.launches.length + breakdown.evidence.strategic.length + breakdown.evidence.filings.length;
  if ((breakdown.total < 35 || breakdown.confidenceState?.state === "Weak signal") && (momentum?.label === "Accelerating" || directEvidence > 0)) return "Monitor";
  if (breakdown.total < 35 || breakdown.confidenceState?.state === "Weak signal") return "Deprioritize";
  if (breakdown.total < 50) return "Monitor";
  if ((breakdown.customerPull ?? breakdown.customerEvidence) < 10 && /software|automation|informatics|oligo|rna|lnp|pfas|regulated|workflow/.test(text)) return "Validate";
  return breakdown.total >= 78 ? "Prepare roadmap decision" : "Validate";
}

function actionClass(action) {
  return String(action || "Monitor").toLowerCase().replace(/\s+/g, "-");
}

function actionDisplayLabel(action) {
  return {
    Deprioritize: "Do not prioritize",
    Monitor: "Continue monitoring",
    Validate: "Validate with additional public evidence",
    "Validate before escalation": "Validate with additional public evidence before leadership review",
    "Prepare roadmap decision": "Choose a roadmap response",
  }[action] || action || "Continue monitoring";
}

function recommendationThemeKey(rec) {
  const title = String(rec?.title || "").toLowerCase();
  const fullText = `${title} ${rec?.affectedCapability || ""}`.toLowerCase();
  if (/pfas|environmental|regulated/.test(title)) return "regulated";
  if (/oligo|rna|lnp|nucleic|advanced therapeutics/.test(title)) return "advanced-therapeutics";
  if (/proteomics|metabolomics|high-resolution|omics/.test(title)) return "omics";
  if (/software|automation|informatics/.test(title)) return "software";
  if (/pfas|environmental|regulated/.test(fullText)) return "regulated";
  if (/oligo|rna|lnp|nucleic|advanced therapeutics/.test(fullText)) return "advanced-therapeutics";
  if (/proteomics|metabolomics|high-resolution|omics/.test(fullText)) return "omics";
  if (/software|automation|informatics/.test(fullText)) return "software";
  return "general";
}

function confidenceDisplayLabel(confidenceState) {
  return {
    "Strategic threat": "High-priority competitor threat",
    "Ready for PM decision": "Evidence supports choosing a roadmap response",
    "Emerging trend": "Multiple sources indicate an emerging trend",
    "Directional signal": "Early public evidence; verify before changing the roadmap",
    "Weak signal": "Too little public evidence for a conclusion",
    "Needs validation": "More evidence required",
  }[confidenceState] || confidenceState || "More evidence required";
}

function customerPullEvidenceForRecommendation(rec) {
  const themeKey = recommendationThemeKey(rec);
  const items = currentCustomerVoiceItems().filter((item) => {
    const combined = `${item.platform} ${item.product} ${item.theme} ${item.category} ${item.pmInterpretation} ${item.buyingPriority} ${item.labType}`;
    const technologyMatch = rec.technology === "All" || textMatchesTechnology(combined, rec.technology);
    const segmentMatch = rec.marketSegment === "All" || item.labType === rec.marketSegment || (rec.marketSegment === "CDMO" && item.labType === "CRO/CDMO") || combined.toLowerCase().includes(rec.marketSegment.toLowerCase());
    return technologyMatch && segmentMatch;
  });
  const estimatedMentions = items.reduce((total, item) => total + customerVoiceDepth(item), 0);
  const sourceFamilies = sourceFamilyCount(items);
  const avgConfidence = averageConfidence(items);
  return { items, estimatedMentions, sourceFamilies, avgConfidence };
}

function confidenceStateForBreakdown(breakdown) {
  const independentSignals = breakdown.evidence.launches.length + breakdown.evidence.strategic.length + breakdown.evidence.filings.length + (breakdown.evidence.trend ? 1 : 0);
  if (breakdown.total >= 78 && breakdown.competitorPressure >= 15 && breakdown.customerPull >= 12 && breakdown.roadmapRelevance >= 16) {
    return {
      state: "Strategic threat",
      className: "strategic-threat",
      guidance: "Independent public evidence supports choosing and resourcing a roadmap response now.",
    };
  }
  if (breakdown.total >= 72 && breakdown.customerPull >= 14 && breakdown.evidenceQualityFreshness >= 8) {
    return {
      state: "Ready for PM decision",
      className: "decision-ready",
      guidance: "Public evidence is strong enough to choose among the documented roadmap options.",
    };
  }
  if (breakdown.total >= 62 && independentSignals >= 3) {
    return {
      state: "Emerging trend",
      className: "emerging",
      guidance: "The evidence supports a targeted validation artifact, but not a roadmap commitment yet.",
    };
  }
  if (breakdown.total >= 45 && independentSignals >= 1) {
    return {
      state: "Directional signal",
      className: "directional",
      guidance: "Verify the conclusion with more public evidence before changing the roadmap.",
    };
  }
  return {
    state: "Weak signal",
    className: "weak",
    guidance: "There is not enough public evidence to recommend a product change.",
  };
}

function strategicPriorityBreakdown(rec, signals) {
  const evidence = evidenceForRecommendation(rec, signals);
  const momentum = evidence.trend ? trendMomentum(evidence.trend, filters.horizon.value) : null;
  const accelerationBase = evidence.trend ? (momentum?.label === "Accelerating" ? 12 : momentum?.label === "Cooling" ? 5 : 8) : 0;
  const trendStrengthContribution = Math.round((evidence.trend?.strengthScore || 0) / 100 * 8);
  const trendAcceleration = Math.min(20, accelerationBase + trendStrengthContribution);
  const launchContribution = evidence.launches.length * 4;
  const strategicContribution = evidence.strategic.length * 5;
  const filingContribution = evidence.filings.length * 2;
  const competitorFilterBonus = filters.competitor.value !== "All" && (evidence.launches.length || evidence.strategic.length || evidence.filings.length) ? 2 : 0;
  const competitorPressure = Math.min(20, launchContribution + strategicContribution + filingContribution + competitorFilterBonus);
  const customerPullEvidence = customerPullEvidenceForRecommendation(rec);
  const customerMentionContribution = Math.round(customerPullEvidence.estimatedMentions / 18);
  const customerSourceContribution = Math.min(customerPullEvidence.sourceFamilies, 4) * 2;
  const customerConfidenceContribution = Math.round(customerPullEvidence.avgConfidence / 30);
  const customerPull = Math.min(20, customerMentionContribution + customerSourceContribution + customerConfidenceContribution);
  const roadmapBase = { High: 15, Medium: 11, Low: 7 }[rec.priority] || 9;
  const technologyRelevanceBonus = filters.technology.value !== "All" && recommendationMatchesFilters(rec) ? 3 : 0;
  const segmentRelevanceBonus = filters.segment.value !== "All" && recommendationMatchesFilters(rec) ? 2 : 0;
  const roadmapRelevance = Math.min(20, roadmapBase + technologyRelevanceBonus + segmentRelevanceBonus);
  const sourceQuality = sourceQualitySummary();
  const verifiedEvidenceLinks = recommendationEvidenceLinks(rec).filter((link) => link.health === "good").length;
  const latestEvidenceDate = [
    ...evidence.launches.map((item) => item.date),
    ...evidence.strategic.map((item) => item.date),
    ...evidence.filings.map((item) => item.date),
  ].filter(Boolean).sort((a, b) => new Date(b) - new Date(a))[0];
  const asOfValue = state.data?.asOfDate || new Date().toISOString().slice(0, 10);
  const asOfDate = /^\d{4}-\d{2}-\d{2}$/.test(asOfValue) ? new Date(`${asOfValue}T00:00:00`) : new Date(asOfValue);
  const latestDate = latestEvidenceDate ? new Date(`${latestEvidenceDate}T00:00:00`) : null;
  const recencyDays = latestDate && !Number.isNaN(latestDate.getTime()) && !Number.isNaN(asOfDate.getTime())
    ? Math.max(0, Math.round((asOfDate - latestDate) / (1000 * 60 * 60 * 24)))
    : null;
  const freshness = latestEvidenceDate && inSelectedHorizon(latestEvidenceDate) ? 2 : 0;
  const catalogQualityContribution = Math.min(sourceQuality.verified, 3);
  const evidenceQualityFreshness = Math.min(10, 3 + verifiedEvidenceLinks + catalogQualityContribution + freshness);
  const urgencyPriorityBase = { High: 5, Medium: 3, Low: 1 }[rec.priority] || 2;
  const urgencyPressureContribution = Math.round(competitorPressure / 5);
  const urgencyMomentumContribution = momentum?.label === "Accelerating" ? 2 : 0;
  const strategicUrgency = Math.min(10, urgencyPriorityBase + urgencyPressureContribution + urgencyMomentumContribution);
  const independentSignals = evidence.launches.length + evidence.strategic.length + evidence.filings.length + (evidence.trend ? 1 : 0);
  const publicSourceCount = evidence.launches.length + evidence.strategic.length + evidence.filings.length + customerPullEvidence.items.length + (evidence.trend ? 1 : 0);
  const sourceFamilies = [
    evidence.launches.length ? "launches" : "",
    evidence.strategic.length ? "strategic moves" : "",
    evidence.filings.length ? "filings" : "",
    evidence.trend ? "scientific publications" : "",
    customerPullEvidence.items.length ? "public customer voice" : "",
  ].filter(Boolean);
  const evidenceLimitations = [];
  if (independentSignals <= 1) evidenceLimitations.push("sparse public evidence");
  if (!evidence.strategic.length && competitorPressure < 10) evidenceLimitations.push("no strategic-move signal");
  if (customerPull < 8) evidenceLimitations.push("weak public customer voice");
  if (sourceQuality.issues > 0) evidenceLimitations.push("one or more sources need review");
  const rawScore = trendAcceleration + competitorPressure + customerPull + roadmapRelevance + evidenceQualityFreshness + strategicUrgency;
  const total = Math.max(0, Math.min(100, rawScore));
  const breakdown = {
    trendAcceleration,
    competitorPressure,
    customerPull,
    roadmapRelevance,
    evidenceQualityFreshness,
    strategicUrgency,
    sourceConfidence: evidenceQualityFreshness,
    customerEvidence: customerPull,
    publicSourceCount,
    sourceFamilies,
    independentSignals,
    latestEvidenceDate,
    recencyDays,
    total,
    rawScore,
    evidenceLimitations,
    evidence,
    customerPullEvidence,
    scoreDerivation: {
      trendAcceleration: {
        equation: `min(20, ${accelerationBase} + ${trendStrengthContribution}) = ${trendAcceleration}`,
        inputs: [
          `${momentum?.label || "No trend"} publication momentum contributes ${accelerationBase} points.`,
          `Trend strength ${evidence.trend?.strengthScore || 0}/100 contributes ${trendStrengthContribution} points (strength × 8, rounded).`,
        ],
      },
      competitorPressure: {
        equation: `min(20, ${launchContribution} + ${strategicContribution} + ${filingContribution} + ${competitorFilterBonus}) = ${competitorPressure}`,
        inputs: [
          `${evidence.launches.length} launches × 4 = ${launchContribution}.`,
          `${evidence.strategic.length} strategic moves × 5 = ${strategicContribution}.`,
          `${evidence.filings.length} filing insights × 2 = ${filingContribution}.`,
          `Selected-competitor bonus = ${competitorFilterBonus}.`,
        ],
      },
      customerPull: {
        equation: `min(20, ${customerMentionContribution} + ${customerSourceContribution} + ${customerConfidenceContribution}) = ${customerPull}`,
        inputs: [
          `${customerPullEvidence.estimatedMentions} estimated mentions ÷ 18, rounded = ${customerMentionContribution}.`,
          `${customerPullEvidence.sourceFamilies} customer source families contribute ${customerSourceContribution} points (maximum 8).`,
          `Average confidence ${Math.round(customerPullEvidence.avgConfidence || 0)}/100 ÷ 30, rounded = ${customerConfidenceContribution}.`,
        ],
      },
      roadmapRelevance: {
        equation: `min(20, ${roadmapBase} + ${technologyRelevanceBonus} + ${segmentRelevanceBonus}) = ${roadmapRelevance}`,
        inputs: [
          `${rec.priority || "Unrated"} recommendation priority contributes ${roadmapBase} base points.`,
          `Matching a selected technology contributes ${technologyRelevanceBonus} points.`,
          `Matching a selected market contributes ${segmentRelevanceBonus} points.`,
        ],
      },
      evidenceQualityFreshness: {
        equation: `min(10, 3 + ${verifiedEvidenceLinks} + ${catalogQualityContribution} + ${freshness}) = ${evidenceQualityFreshness}`,
        inputs: [
          `Public-evidence baseline = 3 points.`,
          `${verifiedEvidenceLinks} verified recommendation links contribute ${verifiedEvidenceLinks} points.`,
          `${sourceQuality.verified} verified catalog sources contribute ${catalogQualityContribution} points (maximum 3).`,
          `Newest evidence inside the selected horizon contributes ${freshness} points.`,
        ],
      },
      strategicUrgency: {
        equation: `min(10, ${urgencyPriorityBase} + ${urgencyPressureContribution} + ${urgencyMomentumContribution}) = ${strategicUrgency}`,
        inputs: [
          `${rec.priority || "Unrated"} priority contributes ${urgencyPriorityBase} points.`,
          `Competitor activity ${competitorPressure}/20 ÷ 5, rounded = ${urgencyPressureContribution}.`,
          `${momentum?.label || "No trend"} momentum contributes ${urgencyMomentumContribution} points.`,
        ],
      },
    },
  };
  const confidenceState = confidenceStateForBreakdown(breakdown);
  return {
    ...breakdown,
    confidenceState,
    action: actionForRecommendation(rec, { ...breakdown, confidenceState }),
  };
}

function roleRelevanceScore(rec) {
  const text = `${rec.title} ${rec.why} ${rec.whyNow} ${rec.action} ${rec.nextAction} ${rec.affectedCapability} ${rec.technology}`.toLowerCase();
  if (state.view === "Engineering") {
    return (/software|automation|informatics|hardware|sensitivity|throughput|lc-ms|method-transfer|diagnostic|module/.test(text) ? 10 : 0)
      + (/pmm|campaign|positioning/.test(text) ? -3 : 0);
  }
  if (state.view === "Marketing") {
    return (/positioning|messaging|pmm|campaign|proof point|narrative|workflow packaging|customer/.test(text) ? 10 : 0)
      + (/hardware|module|engineering lift/.test(text) ? -2 : 0);
  }
  if (state.view === "Leadership") {
    return (/strategic|investment|threat|resource|roadmap|fund|priority/.test(text) ? 8 : 0);
  }
  return (/roadmap|whitespace|workflow|application|capability/.test(text) ? 8 : 0);
}

function currentRecommendationSet(signals) {
  const ranked = state.data.recommendations
    .filter(recommendationMatchesFilters)
    .map((rec) => {
      const priorityBreakdown = strategicPriorityBreakdown(rec, signals);
      return { ...rec, priorityBreakdown, roleFit: roleRelevanceScore(rec) };
    })
    .filter((rec) => {
      if (filters.competitor.value === "All") return true;
      const evidence = rec.priorityBreakdown.evidence;
      return evidence.launches.length || evidence.strategic.length || evidence.filings.length;
    })
    .filter((rec) => recommendationHasHorizonEvidence(rec))
    .filter((rec) => recommendationHasGeographicEvidence(rec))
    .sort((a, b) => (b.priorityBreakdown.total + b.roleFit) - (a.priorityBreakdown.total + a.roleFit) || recommendationPriorityRank(a.priority) - recommendationPriorityRank(b.priority));
  if (ranked.length) return ranked;

  const generated = scopeRecommendationFromEvidence(signals);
  if (!generated) return [];
  const priorityBreakdown = strategicPriorityBreakdown(generated, signals);
  return [{ ...generated, priorityBreakdown, roleFit: roleRelevanceScore(generated) }];
}

function scopeRecommendationFromEvidence(signals) {
  const selectedGeography = filters.geo.value;
  const regionalScope = !["All", "Global"].includes(selectedGeography);
  const scopedLaunches = currentLaunches();
  const scopedStrategic = currentStrategicSignals(signals);
  const scopedFilings = currentFilingInsights();
  const scopedCustomerVoice = currentCustomerVoiceItems();
  const hasRegionalEvidence = !regionalScope || [
    ...scopedLaunches,
    ...scopedStrategic,
    ...scopedFilings,
    ...scopedCustomerVoice,
  ].some((item) => item.geography === selectedGeography);
  const latestLaunch = scopedLaunches[0];
  const latestStrategic = scopedStrategic[0];
  const latestFiling = scopedFilings[0];
  const topTrend = currentTrends()[0];
  const anchor = latestLaunch || latestStrategic || latestFiling;
  if (!anchor && !topTrend) return null;

  const competitor = filters.competitor.value !== "All" && filters.competitor.value !== "Market-wide"
    ? filters.competitor.value
    : anchor?.competitor || "Market-wide";
  const technology = filters.technology.value !== "All"
    ? filters.technology.value
    : anchor?.technology || topTrend?.technology || "Portfolio";
  const marketSegment = filters.segment.value !== "All"
    ? filters.segment.value
    : anchor?.marketSegment || topTrend?.marketSegment || "All";
  const product = latestLaunch?.product || latestLaunch?.title;
  const title = latestLaunch
    ? `Assess ${competitor}'s ${product || "latest product change"} against Waters' closest ${technology} offer`
    : latestStrategic
      ? `Review ${competitor}'s latest strategic move for Waters' ${marketSegment} plans`
      : latestFiling
        ? `Review ${competitor}'s latest filing signal for Waters' ${technology} priorities`
        : `Review ${topTrend.theme} evidence before changing roadmap priority`;
  const evidenceSummary = `${scopedLaunches.length} launches, ${scopedStrategic.length} strategic moves, ${scopedFilings.length} filing insights`;

  return {
    id: `generated-${filters.geo.value}-${marketSegment}-${technology}-${competitor}-${filters.horizon.value}`,
    title,
    ownerView: "Product",
    why: `${evidenceSummary} match ${filterScopeLabel()}.`,
    whyNow: regionalScope && !hasRegionalEvidence
      ? `Global evidence matches this scope, but ${selectedGeography}-specific customer or market proof is not loaded.`
      : latestLaunch
      ? `${competitor}'s ${product || "latest product change"} is the newest product evidence in this scope and needs a direct Waters comparison.`
      : topTrend
        ? `${topTrend.theme} is the strongest scientific trend matching this scope.`
        : `${competitor} has the strongest current public evidence in this scope.`,
    action: "Compare the newest evidence with Waters' current product, workflow, and positioning proof.",
    nextAction: "Assign a PM owner to produce a one-page comparison and a monitor, validate, or prioritize recommendation for the next roadmap review.",
    affectedCapability: `${technology} product and workflow positioning for ${marketSegment}`,
    decisionStatus: "Needs scoped PM review",
    confidence: latestLaunch ? Number(latestLaunch.confidence || 70) : 64,
    evidenceBasis: evidenceSummary,
    tradeoff: "Do not generalize beyond the selected filters; confirm the signal with product-page and customer evidence.",
    priority: latestLaunch || latestStrategic ? "Medium" : "Low",
    technology,
    marketSegment,
    generatedFromScope: true,
    regionalEvidenceMissing: regionalScope && !hasRegionalEvidence,
  };
}

function recommendationHasHorizonEvidence(rec) {
  const breakdown = rec.priorityBreakdown;
  const evidence = breakdown.evidence;
  const directEvidence = evidence.launches.length + evidence.strategic.length + evidence.filings.length;
  const momentum = evidence.trend ? trendMomentum(evidence.trend, filters.horizon.value) : null;
  if (filters.horizon.value === "30d") return directEvidence > 0 || momentum?.label === "Accelerating";
  if (["60d", "90d"].includes(filters.horizon.value)) {
    return directEvidence > 0 || momentum?.label === "Accelerating" || breakdown.customerPullEvidence.estimatedMentions >= 8;
  }
  return directEvidence > 0 || Number(evidence.trend?.counts?.[filters.horizon.value] || 0) > 0 || breakdown.customerPullEvidence.items.length > 0;
}

function recommendationHasGeographicEvidence(rec) {
  const selected = filters.geo.value;
  if (["All", "Global"].includes(selected)) return true;
  const breakdown = rec.priorityBreakdown;
  const directItems = [
    ...breakdown.evidence.launches,
    ...breakdown.evidence.strategic,
    ...breakdown.evidence.filings,
    ...breakdown.customerPullEvidence.items,
  ];
  return directItems.some((item) => item.geography === selected);
}

function confidenceTone(breakdownOrScore) {
  if (typeof breakdownOrScore === "object" && breakdownOrScore?.confidenceState) {
    return {
      label: confidenceDisplayLabel(breakdownOrScore.confidenceState.state),
      className: breakdownOrScore.confidenceState.className,
    };
  }
  const score = Number(breakdownOrScore || 0);
  if (score >= 82) return { label: "Multiple sources indicate an emerging trend", className: "emerging" };
  if (score >= 70) return { label: "Early public evidence; verify before changing the roadmap", className: "directional" };
  return { label: "Too little public evidence for a conclusion", className: "weak" };
}

function customerPullForRecommendation(rec) {
  const themeKey = recommendationThemeKey(rec);
  if (themeKey === "software") {
    return "Needs more public customer evidence on setup burden, data review time, and workflow usability.";
  }
  if (themeKey === "advanced-therapeutics") {
    return "Needs biopharma public customer voice on method transfer, QC readiness, and application coverage.";
  }
  if (themeKey === "regulated") {
    return "Needs environmental lab pull on detection limits, throughput, and compliance documentation.";
  }
  return "Needs customer evidence on workflow pain, budget priority, and adoption risk.";
}

function validationNeedsForRecommendation(rec) {
  const themeKey = recommendationThemeKey(rec);
  if (themeKey === "software") {
    return {
      customer: "public reviews and forum discussions about setup time, method transfer, and data-review friction",
      competitor: "official competitor workflow, usability, and automation claims",
      technical: "public support articles, application notes, and training content",
      adoption: "public reference customers and conference discussions about workflow adoption",
    };
  }
  if (themeKey === "advanced-therapeutics") {
    return {
      customer: "public discussions of LNP, oligo, and RNA method-development pain",
      competitor: "competitor application notes, partnerships, and workflow claims",
      technical: "public method-transfer, column, module, and data-review evidence",
      adoption: "public biopharma references using competitor application workflows",
    };
  }
  if (themeKey === "regulated") {
    return {
      customer: "public lab discussions of sensitivity, throughput, and compliance documentation needs",
      competitor: "competitor PFAS method claims and regulated-workflow positioning",
      technical: "public robustness, reporting, and validation documentation",
      adoption: "public reference labs standardizing regulated contaminant workflows",
    };
  }
  return {
    customer: "public customer language about workflow pain and buying criteria",
    competitor: "official competitor claims and product evidence",
    technical: "public application, support, and performance documentation",
    adoption: "public reference customers and conference adoption signals",
  };
}

function scoreDriverMarkup(breakdown, linkAudit = false) {
  const drivers = [
    { key: "trendAcceleration", label: "Market trend", value: `${breakdown.trendAcceleration}/20` },
    { key: "competitorPressure", label: "Competitor activity", value: `${breakdown.competitorPressure}/20` },
    { key: "customerPull", label: "Public customer feedback", value: `${breakdown.customerPull}/20` },
    { key: "roadmapRelevance", label: "Roadmap relevance", value: `${breakdown.roadmapRelevance}/20` },
    { key: "evidenceQualityFreshness", label: "Source quality", value: `${breakdown.evidenceQualityFreshness}/10` },
    { key: "strategicUrgency", label: "Time sensitivity", value: `${breakdown.strategicUrgency}/10` },
  ];
  const recency = breakdown.recencyDays === null ? "No dated evidence" : `${breakdown.recencyDays} days`;
  const sourceFamilies = breakdown.sourceFamilies || [];
  const seenProofUrls = new Set();
  const proofLinks = decisionEvidenceItems("all", breakdown).filter((item) => {
    if (!isHttpUrl(item.url) || seenProofUrls.has(item.url)) return false;
    seenProofUrls.add(item.url);
    return true;
  });
  return `
    <div class="score-driver-grid">
      ${drivers
        .map((driver) => `
          <div class="score-driver-card">
            <b>${escapeHtml(driver.value)}</b>
            <span>${escapeHtml(driver.label)}</span>
          </div>
        `)
        .join("")}
    </div>
    <div class="score-evidence-strip">
      <div class="score-evidence-meta" title="Evidence types: ${escapeHtml(sourceFamilies.join(", ") || "none available")}">
        <strong>Evidence behind score</strong>
        <span><b>${proofLinks.length}</b> linked sources</span>
        <span><b>${sourceFamilies.length}</b> evidence types</span>
        <span>Newest <b>${escapeHtml(recency)}</b></span>
      </div>
      <div class="score-evidence-links" aria-label="Open public evidence behind this score">
        ${proofLinks.length
          ? proofLinks.map((item) => `
              <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer" title="${escapeHtml(item.title)}" aria-label="Open ${escapeHtml(item.evidenceType || "public evidence")}: ${escapeHtml(item.title)}">
                <small>${escapeHtml(item.evidenceType || "Public source")}</small>
                <span>${escapeHtml(compactText(item.title, 64))}</span>
                <b aria-hidden="true">↗</b>
              </a>
            `).join("")
          : `<span class="score-evidence-empty">No linked public sources match the active filters.</span>`}
      </div>
    </div>
  `;
}

function priorityBreakdownText(breakdown) {
  return `Priority ${breakdown.total}/100: market trend ${breakdown.trendAcceleration}/20, competitor activity ${breakdown.competitorPressure}/20, public customer feedback ${breakdown.customerPull}/20, roadmap relevance ${breakdown.roadmapRelevance}/20, source quality and recency ${breakdown.evidenceQualityFreshness}/10, time sensitivity ${breakdown.strategicUrgency}/10. Linked public sources: ${breakdown.publicSourceCount}; different evidence types: ${breakdown.sourceFamilies?.length || 0}; newest evidence: ${breakdown.latestEvidenceDate || "not dated"}.`;
}

function competitorIntentForRecommendation(rec, signals) {
  const evidence = evidenceForRecommendation(rec, signals);
  const competitors = [
    ...evidence.launches.map((item) => item.competitor),
    ...evidence.strategic.map((item) => item.competitor),
    ...evidence.filings.map((item) => item.competitor),
  ].filter(Boolean);
  const uniqueCompetitors = [...new Set(competitors)];
  const actor = filters.competitor.value !== "All"
    ? filters.competitor.value
    : uniqueCompetitors.length
      ? uniqueCompetitors.slice(0, 3).join(", ")
      : "Competitor";
  const themeKey = recommendationThemeKey(rec);
  if (themeKey === "software") {
    return `${actor} evidence points to instrument value being packaged through software, automation, and workflow execution.`;
  }
  if (themeKey === "advanced-therapeutics") {
    return `${actor} evidence appears to pressure advanced-therapeutics workflow coverage and LC-MS application depth.`;
  }
  if (themeKey === "regulated") {
    return `${actor} evidence suggests regulated environmental workflows should be watched for sensitivity, throughput, and compliance claims.`;
  }
  if (themeKey === "omics") {
    return `${actor}'s public activity suggests a possible focus on high-resolution MS applications, but more workflow evidence is needed before Waters responds.`;
  }
  return `Public evidence suggests this may be ${actor}'s direction, but more launch, conference, and customer evidence is needed to confirm it.`;
}

function sourceQualitySummary() {
  const sources = state.sourceCatalog?.sources || [];
  const verified = sources.filter((source) => source.health === "good").length;
  const manual = sources.filter((source) => source.health === "manual").length;
  const issues = sources.filter((source) => ["bad", "blocked"].includes(source.health)).length;
  return { verified, manual, issues };
}

function sourceQualityLabel() {
  const quality = sourceQualitySummary();
  if (quality.issues === 0 && quality.verified >= 8) return "Strong public-source coverage";
  if (quality.verified >= 5) return "Enough working public sources for a preliminary comparison";
  return "Source coverage needs validation";
}

function sourceQualityDetail() {
  const quality = sourceQualitySummary();
  return `${quality.verified} verified public sources, ${quality.manual} manual/needs-policy sources, and ${quality.issues} broken or blocked public sources.`;
}

function average(items, key) {
  if (!items.length) return 0;
  return Math.round(items.reduce((total, item) => total + Number(item[key] || 0), 0) / items.length);
}

function filterScopeLabel() {
  const parts = [];
  if (filters.competitor.value !== "All") parts.push(filters.competitor.value);
  if (filters.technology.value !== "All") parts.push(filters.technology.value);
  if (filters.segment.value !== "All") parts.push(filters.segment.value);
  if (filters.geo.value !== "All") parts.push(filters.geo.value);
  parts.push(horizonLabel());
  return parts.join(" · ");
}

function topEvidenceCompetitor(signals) {
  const counts = new Map();
  for (const launch of currentLaunches()) counts.set(launch.competitor, (counts.get(launch.competitor) || 0) + 2);
  for (const signal of currentStrategicSignals(signals)) counts.set(signal.competitor, (counts.get(signal.competitor) || 0) + 2);
  for (const insight of currentFilingInsights()) counts.set(insight.competitor, (counts.get(insight.competitor) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

function evidenceCountSummary(breakdown) {
  const evidence = breakdown.evidence;
  return `${evidence.launches.length} launch${evidence.launches.length === 1 ? "" : "es"}, ${evidence.strategic.length} strategic move${evidence.strategic.length === 1 ? "" : "s"}, ${evidence.filings.length} filing insight${evidence.filings.length === 1 ? "" : "s"}, ${breakdown.customerPullEvidence.estimatedMentions} customer/public mention${breakdown.customerPullEvidence.estimatedMentions === 1 ? "" : "s"}`;
}

function evidenceCountLinkMarkup(breakdown) {
  const evidence = breakdown.evidence;
  const counts = [
    ["launches", evidence.launches.length, `launch${evidence.launches.length === 1 ? "" : "es"}`],
    ["strategic", evidence.strategic.length, `strategic move${evidence.strategic.length === 1 ? "" : "s"}`],
    ["filings", evidence.filings.length, `filing insight${evidence.filings.length === 1 ? "" : "s"}`],
    ["customer", breakdown.customerPullEvidence.estimatedMentions, `customer/public mention${breakdown.customerPullEvidence.estimatedMentions === 1 ? "" : "s"}`],
  ];
  return counts.map(([kind, count, label]) => `
    <button type="button" class="evidence-count-link" data-decision-evidence="${kind}" aria-label="View source links for ${count} ${label}">
      <strong>${count}</strong> ${label}
    </button>
  `).join("");
}

function decisionEvidenceItems(kind, breakdown) {
  if (["all", "latest", "types"].includes(kind)) {
    const auditItems = [
      ...breakdown.evidence.launches.map((item) => ({
        title: `${item.competitor}: ${item.product}`,
        detail: `Launches · ${item.signalType} · ${formatDate(item.date)} · ${item.sourceName}`,
        url: timelineUrlForLaunch(item),
        date: item.date,
        evidenceType: "Launches",
      })),
      ...breakdown.evidence.strategic.map((item) => ({
        title: `${item.competitor}: ${item.title}`,
        detail: `Strategic moves · ${item.signalType} · ${formatDate(item.date)} · ${item.sourceName}`,
        url: item.sourceUrl,
        date: item.date,
        evidenceType: "Strategic moves",
      })),
      ...breakdown.evidence.filings.map((item) => ({
        title: `${item.competitor}: ${item.headline}`,
        detail: `Filings · ${formatDate(item.date)} · ${item.sourceName}`,
        url: item.sourceUrl,
        date: item.date,
        evidenceType: "Filings",
      })),
      ...(breakdown.evidence.trend ? [{
        title: breakdown.evidence.trend.theme,
        detail: `Scientific publications · ${Number(breakdown.evidence.trend.counts?.[filters.horizon.value] || 0).toLocaleString()} records in ${horizonLabel().toLowerCase()}`,
        url: pubMedTrendSearchUrl(breakdown.evidence.trend.query, filters.horizon.value),
        date: state.data?.asOfDate,
        evidenceType: "Scientific publications",
      }] : []),
      ...breakdown.customerPullEvidence.items.map((item) => {
        const link = customerVoiceSourceLinks(item)[0];
        return {
          title: `${item.company}: ${item.theme}`,
          detail: `Public customer voice · ${item.product} · ${item.sentiment}`,
          url: link?.url,
          date: link?.sourceDate,
          evidenceType: "Public customer voice",
        };
      }),
    ].filter((item) => isHttpUrl(item.url));
    if (kind === "latest") {
      return auditItems.filter((item) => item.date === breakdown.latestEvidenceDate);
    }
    return auditItems.sort((a, b) => a.evidenceType.localeCompare(b.evidenceType) || new Date(b.date || 0) - new Date(a.date || 0));
  }
  if (kind === "launches") {
    return breakdown.evidence.launches.map((item) => ({
      title: `${item.competitor}: ${item.product}`,
      detail: `${item.signalType} · ${formatDate(item.date)} · ${item.sourceName}`,
      url: timelineUrlForLaunch(item),
    }));
  }
  if (kind === "strategic") {
    return breakdown.evidence.strategic.map((item) => ({
      title: `${item.competitor}: ${item.title}`,
      detail: `${item.signalType} · ${formatDate(item.date)} · ${item.sourceName}`,
      url: item.sourceUrl,
    }));
  }
  if (kind === "filings") {
    return breakdown.evidence.filings.map((item) => ({
      title: `${item.competitor}: ${item.headline}`,
      detail: `${formatDate(item.date)} · ${item.sourceName}`,
      url: item.sourceUrl,
    }));
  }
  return breakdown.customerPullEvidence.items.flatMap((item) => {
    const links = customerVoiceSourceLinks(item);
    return links.map((link) => ({
      title: `${item.company}: ${item.theme}`,
      detail: `${item.product} · ${item.sentiment} · ${link.label}`,
      url: link.url,
    }));
  });
}

function openDecisionEvidenceModal(kind) {
  const breakdown = state.activeDecisionBreakdown;
  if (!breakdown) return;
  const items = decisionEvidenceItems(kind, breakdown);
  const labels = {
    launches: `${breakdown.evidence.launches.length} launches supporting this signal`,
    strategic: `${breakdown.evidence.strategic.length} strategic moves supporting this signal`,
    filings: `${breakdown.evidence.filings.length} filing insights supporting this signal`,
    customer: `${breakdown.customerPullEvidence.estimatedMentions} estimated customer/public mentions`,
    all: `${breakdown.publicSourceCount} linked public sources`,
    latest: `Newest evidence from ${formatDate(breakdown.latestEvidenceDate)}`,
    types: `${breakdown.sourceFamilies?.length || 0} evidence types`,
  };
  byId("decisionEvidenceTitle").textContent = labels[kind] || "Supporting evidence";
  byId("decisionEvidenceSummary").textContent = kind === "customer"
    ? `${items.length} exact discussion threads or support articles underpin the theme estimate. The estimated volume summarizes recurring themes; it is not a count of individually captured comments.`
    : kind === "types"
      ? `${items.length} linked records across: ${(breakdown.sourceFamilies || []).join(", ")}.`
      : kind === "latest"
        ? `${items.length} linked record${items.length === 1 ? " is" : "s are"} dated ${formatDate(breakdown.latestEvidenceDate)}.`
    : `${items.length} linked public records match the active filters and lead decision.`;
  byId("decisionEvidenceList").innerHTML = items.length
    ? items.map((item) => `
        <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.detail)}</span>
          <small>Open exact record ↗</small>
        </a>
      `).join("")
    : `<div class="empty">No linked public records match this evidence category.</div>`;
  byId("decisionEvidenceModal").hidden = false;
  document.body.classList.add("modal-open");
  byId("hideDecisionEvidence").focus();
}

function hideDecisionEvidenceModal() {
  byId("decisionEvidenceModal").hidden = true;
  document.body.classList.remove("modal-open");
}

function leadCompetitorRead(signals, recommendation) {
  const competitor = filters.competitor.value !== "All" ? filters.competitor.value : topEvidenceCompetitor(signals);
  if (!competitor) {
    return {
      competitor: "No clear competitor",
      headline: "No competitor has enough matching public evidence to identify a clear lead threat",
      detail: "Use launch monitoring, conference capture, and customer-source review before changing roadmap priority.",
      counts: { launches: 0, strategic: 0, filings: 0, total: 0 },
    };
  }
  const counts = competitorEvidenceCounts(competitor, signals);
  const technology = recommendation?.technology || filters.technology.value;
  const segment = recommendation?.marketSegment || filters.segment.value;
  return {
    competitor,
    headline: `${competitor} has the most matching public evidence in this view`,
    detail: `${counts.launches} launch${counts.launches === 1 ? "" : "es"}, ${counts.strategic} strategic move${counts.strategic === 1 ? "" : "s"}, and ${counts.filings} filing insight${counts.filings === 1 ? "" : "s"} overlap with ${technology} / ${segment}.`,
    counts,
  };
}

function validationGateForRecommendation(recommendation, breakdown) {
  if (!recommendation) return "Do not allocate roadmap capacity until a PM owner can bring evidence and a decision option.";
  const action = directorActionForRecommendation(recommendation).replace(/^Action:\s*/i, "");
  return action;
}

function conciseMarketShift(recommendation) {
  if (!recommendation) return `${filterScopeLabel()} has too little public evidence to justify a roadmap change.`;
  const themeKey = recommendationThemeKey(recommendation);
  if (themeKey === "software") {
    return "Competitors are shifting LC value stories toward software-enabled workflows; validate the customer problem before changing roadmap priority.";
  }
  if (themeKey === "advanced-therapeutics") {
    return "Advanced-therapeutics workflows are gaining enough public pull to review roadmap priority; customer demand still needs validation.";
  }
  if (themeKey === "regulated") {
    return "Regulated environmental methods are becoming a stronger buying-criteria signal; validate customer urgency before prioritizing a workflow response.";
  }
  if (themeKey === "omics") {
    return "High-resolution omics remains the strongest application pull signal; treat it as a positioning and proof-point priority.";
  }
  return "A product-decision signal is emerging in the current filters; customer evidence is still needed before committing roadmap capacity.";
}

function conciseThreat(signals, recommendation) {
  const competitor = filters.competitor.value !== "All" ? filters.competitor.value : topEvidenceCompetitor(signals);
  if (!competitor) return "No competitor has enough matching public evidence to identify a clear threat; use upcoming conferences to gather more evidence.";
  if (!recommendation) return `${competitor} has too little matching public evidence in this view to justify a roadmap change.`;
  return `${competitor} has the strongest overlap with the current ${recommendation.technology} and ${recommendation.marketSegment} filters.`;
}

function conciseDecision(recommendation) {
  if (!recommendation) return "Do not commit roadmap capacity yet; capture source evidence and public customer voice first.";
  const text = `${recommendation.title} ${recommendation.affectedCapability}`.toLowerCase();
  if (/software|automation|informatics/.test(text)) {
    return "Validate whether the gap is software usability, workflow automation, or instrument-plus-informatics packaging.";
  }
  if (/oligo|rna|lnp|nucleic/.test(text)) {
    return "Validate public customer voice before choosing application kits, workflow methods, software templates, or PMM positioning.";
  }
  if (/pfas|regulated|environmental/.test(text)) {
    return "Decide whether regulated-method proof and LC-MS/MS workflow claims need a roadmap response.";
  }
  return recommendation.nextAction || recommendation.action;
}

function strategicThemeForRecommendation(recommendation) {
  if (!recommendation) return "No single signal cluster is strong enough for a roadmap read.";
  const themeKey = recommendationThemeKey(recommendation);
  const capability = compactCapabilityLabel(recommendation);
  if (recommendation.regionalEvidenceMissing) return `Global evidence supports a ${capability} watch, but ${filters.geo.value}-specific relevance is not yet confirmed.`;
  if (filters.horizon.value === "90d") return `Recent evidence makes ${capability} an immediate PM review priority.`;
  if (filters.horizon.value === "1y") return `One-year evidence shows ${capability} becoming a repeated competitive theme.`;
  if (filters.horizon.value === "3y") return `Three-year evidence suggests ${capability} is sustained rather than a one-off signal.`;
  if (filters.horizon.value === "5y") return `Five-year evidence shows ${capability} persisting across product cycles.`;
  if (themeKey === "software") {
    return "Software-enabled workflow packaging is becoming a competitive differentiator.";
  }
  if (themeKey === "advanced-therapeutics") {
    return "Advanced-therapeutics workflows may need a higher roadmap priority.";
  }
  if (themeKey === "regulated") {
    return "Regulated environmental methods are becoming a stronger roadmap signal.";
  }
  if (themeKey === "omics") {
    return "High-resolution omics remains the strongest application pull signal.";
  }
  return "A product decision is emerging from the current signal mix.";
}

function compactCapabilityLabel(recommendation) {
  if (!recommendation) return "No active roadmap decision";
  const themeKey = recommendationThemeKey(recommendation);
  if (themeKey === "software") return "software-enabled workflow differentiation";
  if (themeKey === "advanced-therapeutics") return "oligo and nucleic-acid workflow coverage";
  if (themeKey === "regulated") return "regulated-method workflow proof";
  if (themeKey === "omics") return "high-resolution omics positioning";
  return recommendation.affectedCapability || recommendation.technology || "roadmap capability";
}

function directorActionForRecommendation(recommendation) {
  if (!recommendation) return "Action: keep monitoring until there is enough source evidence to assign an owner.";
  const role = state.view;
  const text = `${recommendation.title} ${recommendation.affectedCapability}`.toLowerCase();
  const themeKey = recommendationThemeKey(recommendation);
  if (role === "Product" && recommendation.regionalEvidenceMissing) {
    return `Action: collect three ${filters.geo.value}-specific public sources from customer discussions, conference programmes, product references, or regional announcements. Decide whether the global signal applies locally before changing roadmap priority.`;
  }
  if (role === "Product" && ["30d", "60d"].includes(filters.horizon.value)) {
    const evidence = evidenceForRecommendation(recommendation, currentSignals());
    const latestLaunch = [...evidence.launches].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    if (latestLaunch) {
      const product = latestLaunch.product || latestLaunch.title || "latest product change";
      return `Action: within 10 business days, compare ${latestLaunch.competitor}'s ${product} with its prior platform and Waters' closest match. Document what changed, where the competitor remains weak, the customer impact, and one defend-or-differentiate response for the next PM review.`;
    }
    const momentum = evidence.trend ? trendMomentum(evidence.trend, filters.horizon.value) : null;
    if (momentum?.label === "Accelerating") {
      return `Action: review five recent public sources behind the accelerating ${evidence.trend.theme} signal. Compare them with Waters' current application proof and return one of three calls within 10 business days: continue monitoring, update positioning, or define a roadmap requirement.`;
    }
  }
  if (role === "Product" && ["90d", "1y", "3y", "5y"].includes(filters.horizon.value)) {
    const evidence = evidenceForRecommendation(recommendation, currentSignals());
    const latestLaunch = [...evidence.launches].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    const launchLabel = latestLaunch ? `${latestLaunch.competitor} ${latestLaunch.product || latestLaunch.title || "product change"}` : "the leading competitor signal";
    if (filters.horizon.value === "90d") {
      return `Action: compare ${launchLabel} with Waters' closest match and the prior competitor generation. Bring changed claims, remaining competitor weaknesses, customer impact, and one immediate response to the next PM review.`;
    }
    if (filters.horizon.value === "1y") {
      return `Action: review the recurring claims across ${evidence.launches.length} launch${evidence.launches.length === 1 ? "" : "es"} and ${evidence.strategic.length} strategic move${evidence.strategic.length === 1 ? "" : "s"} from the past year. Identify one repeated customer problem and decide whether Waters should update the product, workflow package, or positioning.`;
    }
    if (filters.horizon.value === "3y") {
      return `Action: map three years of product generations and workflow claims. Separate sustained capability shifts from one-off announcements, then define the single Waters capability or proof gap that deserves deeper validation.`;
    }
    return `Action: create a five-year platform-evolution view covering launches, software changes, workflow claims, and lifecycle moves. Use it to choose one response: protect an existing strength, close a repeated gap, or continue monitoring.`;
  }
  if (role === "Engineering") {
    if (themeKey === "software") return "Action: size a technical spike for workflow setup, data-review automation, and instrument-plus-informatics handoff; return effort, dependency, and risk by next architecture review.";
    if (themeKey === "advanced-therapeutics") return "Action: assess method-transfer, carryover, detector/module, and software-template requirements for oligo workflows; identify the hardest engineering gap.";
    return "Action: produce a capability-gap readout with feasibility, dependency, and estimated engineering lift.";
  }
  if (role === "Marketing") {
    if (themeKey === "software") return "Action: create a messaging test: Waters workflow-speed proof, software usability claims, competitor counterclaims, and 3 customer proof points PMM still needs.";
    if (themeKey === "advanced-therapeutics") return "Action: draft a biopharma workflow narrative and validate whether customers understand the application, software, and method-transfer value.";
    return "Action: turn the signal into a positioning brief with proof points, competitor claims, and campaign risk.";
  }
  if (role === "Leadership") {
    return "Action: choose whether to prioritize a two-week validation now, assign a named owner, and require a go/no-go recommendation at the next roadmap review.";
  }
  if (themeKey === "software") {
    return "Action: run a 2-week workflow-gap validation. Assign one PM and one software owner; review five public customer-review or forum records; compare the top three competitor workflow claims; and rank the three most important gaps by customer impact and engineering effort. At the next roadmap review, choose one outcome: fix the product, package the existing workflow, change positioning, or stop.";
  }
  if (themeKey === "advanced-therapeutics") {
    return "Action: run a 2-week validation sprint with five public customer, conference, or application-evidence inputs; recommend which application kit, method, or software-template need should move into roadmap review first.";
  }
  if (themeKey === "regulated") {
    return "Action: build a PFAS claims matrix against Thermo, SCIEX, and Shimadzu; bring a go/no-go recommendation for a regulated-method workflow package.";
  }
  if (themeKey === "omics") {
    return "Action: create a one-page omics defense card with Waters proof points, competitor claims to rebut, and missing application-note gaps.";
  }
  return `Action: ${recommendation.nextAction || recommendation.action}`;
}

function competitorEvidenceCounts(competitor, signals) {
  const launches = currentLaunches().filter((launch) => launch.competitor === competitor).length;
  const strategic = currentStrategicSignals(signals).filter((signal) => signal.competitor === competitor).length;
  const filings = currentFilingInsights().filter((insight) => insight.competitor === competitor).length;
  const technical = signals.filter((signal) =>
    signal.competitor === competitor && signal.signalType === "Official technical insight"
  ).length;
  return { launches, strategic, filings, technical, total: launches + strategic + filings + technical };
}

function competitorSourceHealth(competitor) {
  const sources = (state.sourceCatalog?.sources || []).filter((source) => source.competitor === competitor);
  const good = sources.filter((source) => source.health === "good").length;
  const manual = sources.filter((source) => source.health === "manual").length;
  const issues = sources.filter((source) => ["bad", "blocked"].includes(source.health)).length;
  const extracted = sources.filter((source) => source.extractionStatus === "extracted").length;
  const extractionBlocked = sources.filter((source) => source.extractionStatus === "blocked");
  const status = extracted && !extractionBlocked.length
    ? "Actively extracted"
    : extracted
      ? "Partially extracted"
      : extractionBlocked.length
        ? "Extraction blocked"
        : issues > 0
          ? "Needs attention"
          : "Health checked only";
  return { sources, good, manual, issues, extracted, extractionBlocked, status };
}

function renderCompetitorCoverageHealth(signals) {
  const rows = primaryCompetitors.map((competitor) => {
    const evidence = competitorEvidenceCounts(competitor, signals);
    const sourceHealth = competitorSourceHealth(competitor);
    const healthClass = sourceHealth.status === "Actively extracted" && evidence.total > 0
      ? "covered"
      : sourceHealth.status === "Extraction blocked" || sourceHealth.status === "Needs attention" || evidence.total === 0
        ? "needs-attention"
        : "partial";
    const interpretation = evidence.total === 0
      ? "No public records match the selected filters. This does not prove the competitor is inactive."
      : sourceHealth.extractionBlocked.length
        ? "Some official records are extracted, but the source limitation below leaves a known monitoring gap."
        : sourceHealth.extracted
          ? "Official sources are actively extracted into the feed."
          : "The links work, but no automated extractor is producing competitor signals from them.";
    return { competitor, evidence, sourceHealth, healthClass, interpretation };
  });
  byId("coverageHealthCount").textContent = `${rows.length} competitors`;
  byId("competitorCoverageHealth").innerHTML = rows
    .map((row) => `
      <article class="coverage-health-card ${row.healthClass}">
        <div class="coverage-health-top">
          <strong>${escapeHtml(row.competitor)}</strong>
          <span>${escapeHtml(row.sourceHealth.status)}</span>
        </div>
        <div class="coverage-health-metrics">
          <span><b>${row.evidence.launches}</b> launches</span>
          <span><b>${row.evidence.strategic}</b> strategic moves</span>
          <span><b>${row.evidence.filings}</b> filing insights</span>
          <span><b>${row.evidence.technical}</b> technical insights</span>
          <span><b>${row.sourceHealth.extracted}</b> active extractor${row.sourceHealth.extracted === 1 ? "" : "s"}</span>
          <span><b>${row.sourceHealth.extractionBlocked.length}</b> blocked extractor${row.sourceHealth.extractionBlocked.length === 1 ? "" : "s"}</span>
        </div>
        <p>${escapeHtml(row.interpretation)}</p>
        ${row.sourceHealth.extracted ? `
          <details class="extracted-source-details">
            <summary>View ${row.sourceHealth.extracted} extracted source${row.sourceHealth.extracted === 1 ? "" : "s"}</summary>
            <ul class="extraction-status-list">
              ${row.sourceHealth.sources.filter((source) => source.extractionStatus === "extracted").map((source) => `
                <li>
                  <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.source || "Official source")} ↗</a>
                  ${source.extractionReason ? `<span>${escapeHtml(source.extractionReason)}</span>` : ""}
                </li>
              `).join("")}
            </ul>
          </details>
        ` : ""}
        ${row.sourceHealth.extractionBlocked.length ? `
          <ul class="extraction-status-list">
            ${row.sourceHealth.extractionBlocked.map((source) => `
              <li><strong><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.source || "Official source")} ↗</a>:</strong> ${escapeHtml(source.extractionReason || "Extraction is blocked.")}</li>
            `).join("")}
          </ul>
        ` : ""}
      </article>
    `)
    .join("");
}

function renderDirectorSummary(signals) {
  const summaryNode = byId("directorSummary");
  if (!summaryNode) return;
  const recommendations = currentRecommendationSet(signals);
  const topRecommendation = recommendations[0];
  if (!topRecommendation) {
    summaryNode.innerHTML = `
      <article class="director-summary-item">
        <span>No recommendation has enough public support</span>
        <strong>Current filters do not justify roadmap action.</strong>
        <p>Action: keep monitoring launches, conference agendas, and customer feedback before assigning roadmap capacity.</p>
      </article>
    `;
    return;
  }
  const breakdown = topRecommendation.priorityBreakdown;
  const competitorRead = leadCompetitorRead(signals, topRecommendation);
  const validation = validationNeedsForRecommendation(topRecommendation);
  const evidenceLinks = recommendationEvidenceLinks(topRecommendation);
  const items = [
    {
      label: "Highest-priority signal",
      headline: `${strategicThemeForRecommendation(topRecommendation)} ${confidenceDisplayLabel(breakdown.confidenceState.state)}: ${breakdown.total}/100.`,
      detail: `${evidenceCountSummary(breakdown)} in ${horizonLabel()}. Score drivers: competitor pressure ${breakdown.competitorPressure}/20, public customer voice ${breakdown.customerPull}/20, and roadmap fit ${breakdown.roadmapRelevance}/20.`,
      action: `Decision rule: ${breakdown.confidenceState.guidance}`,
    },
    {
      label: "Competitor intent hypothesis",
      headline: competitorRead.headline,
      detail: `${competitorRead.detail} ${competitorIntentForRecommendation(topRecommendation, signals)}`,
      action: `Action: compare ${competitorRead.competitor === "No clear competitor" ? "competitor" : competitorRead.competitor} claims against Waters proof points before the next roadmap review.`,
    },
    {
      label: "Waters decision gate",
      headline: `${decisionOptionsForRecommendation(topRecommendation)}.`,
      detail: `Public evidence links available now: ${evidenceLinks.length}. Additional checks: ${validation.customer}; ${validation.competitor}.`,
      action: validationGateForRecommendation(topRecommendation, breakdown),
    },
  ];
  summaryNode.innerHTML = items
    .map(
      (item) => `
        <article class="director-summary-item">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.headline)}</strong>
          <p>${escapeHtml(item.detail)}</p>
          <p class="summary-action">${escapeHtml(item.action)}</p>
        </article>
      `,
    )
    .join("");
}

function decisionOptionsForRecommendation(recommendation) {
  const breakdown = recommendation?.priorityBreakdown;
  if (!breakdown) return actionDisplayLabel("Monitor");
  return actionDisplayLabel(breakdown.action);
}

function roadmapReviewProofLinks(recommendation, breakdown) {
  let customerProof = null;
  for (const item of breakdown.customerPullEvidence?.items || []) {
    const source = customerVoiceSourceLinks(item)[0];
    if (!source) continue;
    customerProof = {
      type: "Customer problem",
      label: `${item.company}: ${item.theme}`,
      detail: source.label,
      url: source.url,
    };
    break;
  }

  const trend = breakdown.evidence?.trend;
  const scientificProof = trend
    ? {
        type: "Independent scientific context",
        label: trend.theme,
        detail: `${Number(trend.counts?.[filters.horizon.value] || 0).toLocaleString()} PubMed records in ${horizonLabel().toLowerCase()}`,
        url: pubMedTrendSearchUrl(trend.query, filters.horizon.value),
      }
    : null;

  const competitorSource = recommendationEvidenceLinks(recommendation)
    .find((link) => isHttpUrl(link.url) && !link.url.includes("pubmed.ncbi.nlm.nih.gov"));
  const competitorProof = competitorSource
    ? {
        type: "Official competitor evidence",
        label: competitorSource.label,
        detail: "Official product, launch, or strategic source",
        url: competitorSource.url,
      }
    : null;

  return [customerProof, scientificProof, competitorProof].filter(Boolean);
}

function validationWorkflowForRecommendation(recommendation, breakdown) {
  const validation = validationNeedsForRecommendation(recommendation);
  const proofLinks = roadmapReviewProofLinks(recommendation, breakdown);
  return {
    readyWhen: "Proceed when customer, scientific, and official competitor evidence confirm the same problem—and the response, benefit, effort, and tradeoff are clear.",
    proofLinks,
    validationFocus: `Customer evidence: ${validation.customer}. Competitor evidence: ${validation.competitor}. Technical evidence: ${validation.technical}. Adoption evidence: ${validation.adoption}.`,
  };
}

function decisionPacketText(recommendation, signals) {
  if (!recommendation) {
    return `Leadership Decision Packet\nScope: ${filterScopeLabel()}\nDecision: No roadmap action yet.\nReason: evidence is too sparse under the active filters.`;
  }
  const breakdown = recommendation.priorityBreakdown;
  const validation = validationNeedsForRecommendation(recommendation);
  const workflow = validationWorkflowForRecommendation(recommendation, breakdown);
  const evidence = breakdown.evidence;
  const competitorRead = leadCompetitorRead(signals, recommendation);
  return [
    "Leadership Decision Packet",
    `Role view: ${viewCopy[state.view].title}`,
    `Scope: ${filterScopeLabel()}`,
    `Signal: ${strategicThemeForRecommendation(recommendation)} ${evidenceCountSummary(breakdown)}.`,
    `Interpretation: ${competitorIntentForRecommendation(recommendation, signals)}`,
    `Waters impact: ${recommendation.affectedCapability || recommendation.technology}. ${recommendation.whyNow || recommendation.why}`,
    `Evidence status: ${confidenceDisplayLabel(breakdown.confidenceState.state)} (${breakdown.total}/100). ${breakdown.confidenceState.guidance}`,
    `Score drivers: ${priorityBreakdownText(breakdown)}`,
    `Recommended decision: ${decisionOptionsForRecommendation(recommendation)}.`,
    `Competitor intent hypothesis: ${competitorRead.headline}. ${competitorRead.detail}`,
    `Evidence supporting: ${evidence.launches.length} launches, ${evidence.strategic.length} strategic moves, ${evidence.filings.length} filing insights, ${evidence.trend ? "1 application trend" : "0 application trends"}, ${breakdown.customerPullEvidence.estimatedMentions} estimated customer/public mentions.`,
    `Evidence limitations to review: ${breakdown.evidenceLimitations.join("; ") || "none"}.`,
    `Additional public validation: ${validation.customer}; ${validation.competitor}; ${validation.technical}.`,
    `Validation action: ${validationGateForRecommendation(recommendation, breakdown)}`,
    `Ready for roadmap review when: ${workflow.readyWhen}`,
    ...workflow.proofLinks.map((link, index) => `Source ${index + 1} — ${link.type}: ${link.label} (${link.url})`),
  ].join("\n");
}

function renderDecisionPacket(signals) {
  const recommendation = currentRecommendationSet(signals)[0];
  if (!recommendation) {
    state.activeDecisionBreakdown = null;
    lastDecisionPacketText = decisionPacketText(null, signals);
    byId("decisionPacket").innerHTML = `
      <article class="packet-primary">
        <span>No recommended product action</span>
        <strong>No recommendation is strong enough under ${escapeHtml(filterScopeLabel())}.</strong>
        <p>Continue monitoring launches, conferences, customer feedback, and public sources before changing the roadmap.</p>
      </article>
    `;
    return;
  }
  const breakdown = recommendation.priorityBreakdown;
  const validation = validationNeedsForRecommendation(recommendation);
  const workflow = validationWorkflowForRecommendation(recommendation, breakdown);
  const competitorRead = leadCompetitorRead(signals, recommendation);
  const tone = confidenceTone(breakdown);
  state.activeDecisionBreakdown = breakdown;
  lastDecisionPacketText = decisionPacketText(recommendation, signals);
  byId("decisionPacket").innerHTML = `
    <article class="packet-primary">
      <div class="decision-card-top">
        <span class="confidence-pill ${tone.className}">${escapeHtml(tone.label)}</span>
        <span class="action-chip ${actionClass(breakdown.action)}">${escapeHtml(actionDisplayLabel(breakdown.action))}</span>
      </div>
      <span>What changed</span>
      <strong>${escapeHtml(strategicThemeForRecommendation(recommendation))}</strong>
      <div class="evidence-count-links" aria-label="Open supporting evidence by category">${evidenceCountLinkMarkup(breakdown)}</div>
      <p class="packet-decision-question">${escapeHtml(viewCopy[state.view].decisionQuestion)}</p>
      ${scoreDriverMarkup(breakdown, true)}
    </article>
    <article>
      <span>Recommended decision</span>
      <strong>${escapeHtml(decisionOptionsForRecommendation(recommendation))}</strong>
      <p>${escapeHtml(validationGateForRecommendation(recommendation, breakdown))}</p>
    </article>
    <article>
      <span>What competitors appear to be doing</span>
      <strong>${escapeHtml(competitorRead.headline)}</strong>
      <p>${escapeHtml(competitorIntentForRecommendation(recommendation, signals))}</p>
    </article>
    <article class="roadmap-readiness-card">
      <span>Roadmap review evidence gate</span>
      <strong>${escapeHtml(workflow.readyWhen)}</strong>
      <div class="roadmap-proof-grid">
        ${workflow.proofLinks.length
          ? workflow.proofLinks.map((link, index) => `
              <a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">
                <b>${index + 1}. ${escapeHtml(link.type)}</b>
                <span>${escapeHtml(link.label)}</span>
                <small>${escapeHtml(link.detail)} · Open source ↗</small>
              </a>
            `).join("")
          : `<p>No complete three-source proof set is available under the active filters.</p>`}
      </div>
    </article>
  `;
}

function renderStrategicRead(signals) {
  if (!byId("strategicRead") || !byId("strategicConfidence")) return;
  const launches = currentLaunches();
  const strategicSignals = currentStrategicSignals(signals);
  const recommendations = currentRecommendationSet(signals);
  const topRecommendation = recommendations[0];
  if (!topRecommendation) {
    byId("strategicConfidence").textContent = "Needs validation · Sparse evidence";
    byId("strategicRead").innerHTML = `
      <div class="readout-empty">
        <h3>No recommendation has enough public support under ${escapeHtml(filterScopeLabel())}</h3>
        <p>Public records exist, but they do not yet support a confident recommendation. Gather more conference, product-page, and customer evidence before changing the roadmap.</p>
      </div>
    `;
    return;
  }
  const breakdown = topRecommendation.priorityBreakdown;
  const confidence = breakdown.total;
  const sourceQuality = sourceQualityLabel();
  const scope = filterScopeLabel();
  const validation = validationNeedsForRecommendation(topRecommendation);
  const roadmapPressure = [topRecommendation.technology, topRecommendation.marketSegment].filter(Boolean).join(" · ");

  byId("strategicConfidence").textContent = `${confidenceDisplayLabel(breakdown.confidenceState.state)} · ${confidence}/100`;
  byId("strategicRead").innerHTML = `
    <div class="readout-hero">
      <div>
        <h3>${escapeHtml(strategicThemeForRecommendation(topRecommendation))}</h3>
        <p><strong>Public evidence:</strong> ${escapeHtml(scope)} includes ${launches.length} matching launches, ${strategicSignals.length} strategic moves, and ${breakdown.customerPullEvidence.estimatedMentions} estimated customer/public mentions related to this decision.</p>
        <p><strong>Interpretation:</strong> ${escapeHtml(competitorIntentForRecommendation(topRecommendation, signals))}</p>
      </div>
    </div>
    ${scoreDriverMarkup(breakdown)}
    <div class="readout-grid">
      <article>
        <span>Waters impact</span>
        <strong>${escapeHtml(roadmapPressure || topRecommendation.affectedCapability || "Product capability")}</strong>
        <p>${escapeHtml(topRecommendation.affectedCapability || topRecommendation.whyNow || topRecommendation.why)}</p>
      </article>
      <article>
        <span>Confidence</span>
        <strong>${escapeHtml(confidenceDisplayLabel(breakdown.confidenceState.state))}</strong>
        <p>${escapeHtml(breakdown.confidenceState.guidance)} ${escapeHtml(sourceQuality)}.</p>
      </article>
      <article>
        <span>Missing evidence</span>
        <strong>${escapeHtml(breakdown.evidenceLimitations.slice(0, 2).join("; ") || "No major public-evidence limitations")}</strong>
        <p>Check ${escapeHtml(validation.customer)} and ${escapeHtml(validation.competitor)}.</p>
      </article>
    </div>
    <details class="priority-breakdown">
      <summary>Why this is priority ${confidence}/100</summary>
      <p>${escapeHtml(priorityBreakdownText(breakdown))}</p>
      <p>Public-evidence limitations: ${escapeHtml(breakdown.evidenceLimitations.join("; ") || "none")}. These notes do not subtract points; the score is based only on traceable public sources.</p>
    </details>
  `;
}

function overallTrendText(item) {
  return [
    item.title,
    item.product,
    item.headline,
    item.summary,
    item.pmImplication,
    item.recommendation,
    item.signalType,
    item.technology,
    item.marketSegment,
    item.theme,
    item.category,
    item.platform,
    item.customerLanguageSignal,
    item.eventName,
    ...(item.technologyFocus || []),
    ...(item.industryTrendsToWatch || []),
    ...(item.watersPrep || []),
  ].filter(Boolean).join(" ").toLowerCase();
}

function overallTrendEvidence(signals, candidate) {
  const matches = (item) => candidate.pattern.test(overallTrendText(item));
  const matchedLaunches = currentLaunches().filter(matches);
  const matchedStrategic = currentStrategicSignals(signals).filter(matches);
  const matchedFilings = currentFilingInsights().filter(matches);
  const matchedConferences = currentConferenceSources().filter(matches);
  const matchedCustomers = currentCustomerVoiceItems().filter(matches);
  const matchedTrends = currentTrends().filter(matches);
  const launchItems = matchedLaunches.map((item) => ({
    family: "Competitor moves",
    title: `${item.competitor}: ${item.product}`,
    detail: `${item.signalType} · ${formatDate(item.date)}`,
    url: timelineUrlForLaunch(item),
  }));
  const strategicItems = matchedStrategic.map((item) => ({
    family: "Competitor moves",
    title: `${item.competitor}: ${item.title}`,
    detail: `${item.signalType} · ${formatDate(item.date)}`,
    url: item.sourceUrl,
  }));
  const filingItems = matchedFilings.map((item) => ({
    family: "SEC filings",
    title: `${item.competitor}: ${item.headline}`,
    detail: `${item.sourceName} · ${formatDate(item.date)}`,
    url: item.sourceUrl,
  }));
  const conferenceItems = matchedConferences.map((item) => ({
    family: "Conferences",
    title: item.eventName,
    detail: `${item.dateRange} · ${item.tier}`,
    url: item.website,
  }));
  const customerItems = matchedCustomers.flatMap((item) => {
    const links = customerVoiceSourceLinks(item);
    return (links.length ? links : [{ label: item.sourceName, url: item.sourceUrl }]).map((link) => ({
      family: "Public customer voice",
      title: `${item.company}: ${item.theme}`,
      detail: `${item.product} · ${item.sentiment} · ${item.category}`,
      url: link.url,
    }));
  });
  const publicationSignals = currentSignals()
    .filter((item) => ["Scientific application intelligence", "Market intelligence"].includes(item.category))
    .filter(matches)
    .map((item) => ({
      family: "Scientific demand",
      title: item.title,
      detail: `${item.sourceName} · ${formatDate(item.date)}`,
      url: item.sourceUrl,
    }));
  const trendItems = matchedTrends.map((item) => ({
    family: "Scientific demand",
    title: item.theme,
    detail: `${Number(item.counts[filters.horizon.value] || 0).toLocaleString()} publication records · ${horizonLabel()}`,
    url: pubMedSearchUrl(item.query),
    momentum: trendMomentum(item, filters.horizon.value).label,
  }));

  const groups = [
    { label: "Competitor moves", items: [...launchItems, ...strategicItems] },
    { label: "SEC filings", items: filingItems },
    { label: "Conferences", items: conferenceItems },
    { label: "Public customer voice", items: customerItems },
    { label: "Scientific demand", items: [...trendItems, ...publicationSignals] },
  ].map((group) => {
    const seen = new Set();
    return {
      ...group,
      items: group.items.filter((item) => {
        const key = `${item.url}|${item.title}`;
        if (!isHttpUrl(item.url) || seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    };
  });
  const activeGroups = groups.filter((group) => group.items.length);
  const linkedItems = activeGroups.flatMap((group) => group.items.slice(0, 3));
  const accelerating = groups.some((group) => group.items.some((item) => item.momentum === "Accelerating"));
  return {
    groups,
    activeGroups,
    linkedItems,
    familyCount: activeGroups.length,
    recordCount: groups.reduce((total, group) => total + group.items.length, 0),
    moveCount: matchedLaunches.length + matchedStrategic.length,
    filingCount: matchedFilings.length,
    conferenceCount: matchedConferences.length,
    customerMentions: matchedCustomers.reduce((total, item) => total + customerVoiceDepth(item), 0),
    publicationRecords: matchedTrends.reduce((total, item) => total + Number(item.counts[filters.horizon.value] || 0), 0),
    direction: accelerating ? "Growing faster" : activeGroups.length >= 4 ? "Supported by several evidence types" : "Appearing in limited evidence types",
  };
}

function overallTrendCandidates() {
  return [
    {
      id: "workflow-experience",
      title: "Workflow experience is becoming part of the instrument value proposition",
      pattern: /software|informatics|automation|artificial intelligence|\bai\b|workflow|data integrity|usability|empower|labsolutions|crosslab|operating system/,
      synthesis: "Competitors are connecting instruments to software, automation, services, and application workflows. Public customer feedback also places setup, troubleshooting, training, and data review inside the product experience.",
      implication: "Waters should evaluate next-gen LC as an end-to-end workflow, not as a hardware specification exercise.",
      action: "Within two weeks, compare method setup, daily operation, troubleshooting, and data review across the latest competitor workflow and the closest Waters configuration. Select one friction point for a defined roadmap requirement.",
    },
    {
      id: "platform-modernization",
      title: "Routine LC modernization is becoming a serviceability and method-continuity contest",
      pattern: /nexera|infinitylab|vanquish|ultimate|exion|acquity|alliance|arc hplc|\bhplc\b|\buhplc\b|liquid chromatograph|uptime|reliability|maintenance|service|method transfer|pressure|leak|autosampler|carryover|lifecycle/,
      synthesis: "New LC platforms are arriving alongside public concerns about uptime, maintenance, method transfer, and service burden. The replacement decision is therefore broader than speed or pressure specifications.",
      implication: "Waters can defend its installed base only if the upgrade path protects validated methods while making diagnostics and maintenance visibly easier.",
      action: "Create one replacement-path scorecard for the newest competitor LC platform versus Arc, Alliance, and the planned next-gen LC: method-transfer time, diagnostics, planned maintenance, service steps, and expected downtime.",
    },
    {
      id: "biopharma-applications",
      title: "Biopharma competition is concentrating around complete LC-MS application workflows",
      pattern: /biopharma|bioproduction|oligonucleotide|nucleic acid|\brna\b|\blnp\b|lipid nanoparticle|protein|peptide|mam workflow|multi-attribute|proteomics|metabolomics|bioanalysis|biologics/,
      synthesis: "Scientific demand, conference agendas, competitor activity, and corporate disclosures are converging on biopharma workflows rather than stand-alone instruments.",
      implication: "Application kits, methods, informatics, and proof of workflow performance may influence buying decisions as much as the LC or MS platform itself.",
      action: "Choose one priority workflow from oligo, LNP, MAM, or protein characterization. Map the Waters workflow against the two strongest competitor claims and identify one missing proof point or capability for the next roadmap review.",
    },
    {
      id: "regulated-testing",
      title: "Regulated testing demand is shifting toward complete, defensible methods",
      pattern: /pfas|environmental|contaminant|regulated|compliance|audit|quality control|\bqc\b|food safety|clinical|quantitation|triple quadrupole/,
      synthesis: "Publication growth and competitor application activity point to demand for validated methods, traceable data, and repeatable quantitation rather than sensitivity claims alone.",
      implication: "Waters' differentiation should connect LC-MS/MS performance to method readiness, compliance, and reproducible laboratory execution.",
      action: "Review the five strongest public method claims in the selected market. Identify the one Waters method package, compliance proof point, or application note that would close the clearest evidence gap.",
    },
    {
      id: "high-resolution-omics",
      title: "High-resolution omics remains a large and visible source of LC-MS demand",
      pattern: /high-resolution|hrms|qtof|tof|orbitrap|proteomics|metabolomics|single-cell|omics|mass spectrom/,
      synthesis: "Publication volume, conference themes, and competitor product narratives continue to reinforce high-resolution LC-MS workflows across discovery and translational research.",
      implication: "Waters needs a clear choice of where to defend broad discovery workflows and where to differentiate through application depth or informatics.",
      action: "Select the two highest-value omics workflows for Waters. Compare competitor claims, public application proof, and customer workflow friction, then define the proof package needed for each.",
    },
  ];
}

function renderOverallTrendAnalysis(signals) {
  const candidates = overallTrendCandidates()
    .map((candidate) => ({ ...candidate, evidence: overallTrendEvidence(signals, candidate) }))
    .filter((candidate) => candidate.evidence.familyCount >= 2)
    .sort((a, b) => b.evidence.familyCount - a.evidence.familyCount || b.evidence.recordCount - a.evidence.recordCount)
    .slice(0, 3);
  const countNode = byId("overallTrendCount");
  const container = byId("overallTrendAnalysis");
  if (!countNode || !container) return;
  state.overallTrendCandidates = candidates;
  countNode.textContent = candidates.length ? `${candidates.length} trends supported by multiple evidence types` : "No trend supported by multiple evidence types";
  if (!candidates.length) {
    container.innerHTML = `<div class="empty">No trend appears in at least two different types of public evidence under ${escapeHtml(filterScopeLabel())}. Broaden a filter to inspect the wider market.</div>`;
    return;
  }
  const top = candidates[0];
  container.innerHTML = `
    <div class="overall-trend-summary">
      <div>
        <span>Conclusion supported by the widest range of evidence</span>
        <strong>${escapeHtml(top.title)}</strong>
      </div>
      <p>${top.evidence.familyCount} of 5 public evidence types support this conclusion under ${escapeHtml(filterScopeLabel())}.</p>
    </div>
    <div class="overall-trend-list">
      ${candidates.map((candidate, index) => {
        const evidence = candidate.evidence;
        return `
          <article class="overall-trend-card">
            <div class="overall-trend-card-top">
              <span class="trend-rank">${index + 1}</span>
              <div>
                <span>${escapeHtml(evidence.direction)}</span>
                <h4>${escapeHtml(candidate.title)}</h4>
              </div>
            </div>
            <p>${escapeHtml(candidate.synthesis)}</p>
            <p class="trend-window-evidence"><strong>${escapeHtml(horizonLabel())}:</strong> ${evidence.moveCount} competitor move${evidence.moveCount === 1 ? "" : "s"}, ${evidence.filingCount} filing insight${evidence.filingCount === 1 ? "" : "s"}, ${evidence.customerMentions.toLocaleString()} estimated public customer mention${evidence.customerMentions === 1 ? "" : "s"}, and ${evidence.publicationRecords.toLocaleString()} publication records. ${evidence.conferenceCount} upcoming conference${evidence.conferenceCount === 1 ? "" : "s"} provide${evidence.conferenceCount === 1 ? "s" : ""} the next capture opportunity.</p>
            <div class="trend-source-family" aria-label="Types of public evidence supporting this trend">
              ${evidence.groups.map((group) => group.items.length ? `
                <a class="active" href="#decisionEvidenceModal" data-trend-id="${escapeHtml(candidate.id)}" data-trend-evidence-family="${escapeHtml(group.label)}" aria-label="View ${group.items.length} ${escapeHtml(group.label)} proofs">
                  ${escapeHtml(group.label)} <b>${group.items.length}</b>
                </a>
              ` : `<span>${escapeHtml(group.label)} <b>0</b></span>`).join("")}
            </div>
            <details class="trend-evidence-detail" open>
              <summary>Evidence links (${evidence.linkedItems.length})</summary>
              <div class="trend-evidence-links">
                ${evidence.linkedItems.map((item) => `
                  <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">
                    <span>${escapeHtml(item.family)}</span>
                    <strong>${escapeHtml(item.title)}</strong>
                    <small>${escapeHtml(item.detail)}</small>
                  </a>
                `).join("")}
              </div>
            </details>
            <div class="trend-decision">
              <span>What it means for Waters</span>
              <strong>${escapeHtml(candidate.implication)}</strong>
            </div>
            <div class="trend-action">
              <span>Next PM action</span>
              <p>${escapeHtml(candidate.action)}</p>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderDecisionQueue(signals) {
  const allDecisions = currentRecommendationSet(signals);
  const decisions = allDecisions.slice(1, 5);
  byId("decisionQueueCount").textContent = decisions.length ? `${decisions.length} follow-up decisions` : "Lead decision shown above";
  byId("decisionQueue").innerHTML = decisions.length
    ? decisions
        .map((rec) => {
          const breakdown = rec.priorityBreakdown;
          const tone = confidenceTone(breakdown);
          const evidenceLinks = recommendationEvidenceLinks(rec).slice(0, 3);
          const validation = validationNeedsForRecommendation(rec);
          const workflow = validationWorkflowForRecommendation(rec, breakdown);
          return `
            <article class="decision-card">
              <div class="decision-card-top">
                <span class="action-chip ${actionClass(breakdown.action)}">${escapeHtml(actionDisplayLabel(breakdown.action))}</span>
                <span class="confidence-pill ${tone.className}">${tone.label} · ${breakdown.total}/100</span>
              </div>
              <h4>${escapeHtml(rec.title)}</h4>
              <p class="decision-why">${escapeHtml(rec.whyNow || rec.why)}</p>
              ${scoreDriverMarkup(breakdown)}
              <p class="decision-next"><strong>Concrete next step:</strong> ${escapeHtml(directorActionForRecommendation(rec).replace(/^Action:\s*/i, ""))}</p>
              <details class="decision-detail">
                <summary>Evidence and validation</summary>
                <dl>
                  <div><dt>Competitor intent</dt><dd>${escapeHtml(competitorIntentForRecommendation(rec, signals))}</dd></div>
                  <div><dt>Waters implication</dt><dd>${escapeHtml(rec.affectedCapability || rec.technology)}</dd></div>
                  <div><dt>Additional public checks</dt><dd>Customer: ${escapeHtml(validation.customer)}. Competitor: ${escapeHtml(validation.competitor)}. Technical: ${escapeHtml(validation.technical)}. Adoption: ${escapeHtml(validation.adoption)}.</dd></div>
                  <div><dt>Ready for roadmap review when</dt><dd>${escapeHtml(workflow.readyWhen)}</dd></div>
                </dl>
                <div class="mini-evidence">
                  ${
                    evidenceLinks.length
                      ? evidenceLinks.map((link) => `<a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)}</a>`).join("")
                      : `<span>Evidence link needed</span>`
                  }
                </div>
              </details>
            </article>
          `;
        })
        .join("")
    : allDecisions.length
      ? `<div class="empty">No additional recommendations have enough public support under ${escapeHtml(filterScopeLabel())}. Use the leadership brief above as the current priority.</div>`
      : `<div class="empty">No recommendation has enough public support under ${escapeHtml(filterScopeLabel())}. Gather more conference, product-page, and customer evidence before changing the roadmap.</div>`;
}

function competitorIntentProfile(competitor, signals) {
  const launches = currentLaunches().filter((launch) => launch.competitor === competitor);
  const strategic = currentStrategicSignals(signals).filter((signal) => signal.competitor === competitor);
  const filings = currentFilingInsights().filter((insight) => insight.competitor === competitor);
  const profileCopy = {
    "Thermo Fisher": {
      focus: "Bioproduction adjacency, chromatography/MS resilience, and LC-MS platform visibility",
      intent: "Strengthen end-to-end biopharma workflow position, not only individual instruments",
      shortTermImpact: "Waters may face stronger account-level comparison in biopharma and LNP discussions where Thermo can bundle chromatography, MS, sample prep, and bioproduction context.",
      midLongTermImpact: "If Thermo keeps linking bioproduction, chromatography, MS, and informatics, Waters risks being positioned as a narrower instrument vendor in strategic biopharma workflow decisions.",
      response: {
        defend: "Protect biopharma accounts with proof for LC-MS robustness, sensitivity, uptime, and existing LNP/bioprocess workflow coverage.",
        differentiate: "Frame Waters as the analytical workflow specialist: separations, MS, informatics, columns, methods, and application support working together.",
        accelerate: "If customer evidence confirms pull, fast-track LNP and bioprocess workflow packages with application notes, field battlecards, and PMM-ready claims.",
      },
    },
    Agilent: {
      focus: "AI-enabled lab workflows, LC/MS software packaging, APAC biopharma access, and service lifecycle value",
      intent: "Own workflow execution and customer productivity through instruments, informatics, partnerships, and regional hubs",
      shortTermImpact: "Waters PMs may need stronger counter-positioning for software usability, method setup, service lifecycle, and packaged LC/MS workflows in active pharma deals.",
      midLongTermImpact: "Agilent could reset buying criteria toward lab productivity, AI-assisted workflows, and regional application access, forcing Waters to compete on workflow outcomes rather than LC specifications alone.",
      response: {
        defend: "Close near-term software and workflow objections with evidence on Empower-connected operation, method setup, service lifecycle, and data integrity.",
        differentiate: "Position Waters around complete regulated LC/LC-MS workflows, not isolated modules: instrument, informatics, methods, compliance, and support.",
        accelerate: "Pull forward software usability, automation readiness, and AI-assisted workflow exploration where public customer reviews or forum discussions confirm buying impact.",
      },
    },
    Shimadzu: {
      focus: "Nexera LC/UHPLC refreshes and routine lab workflow expansion",
      intent: "Defend and extend core LC footprint in pharma, environmental, and routine QC workflows",
      shortTermImpact: "Waters should expect more head-to-head pressure in routine UHPLC replacements, especially where customers value robustness, throughput, price/value, and method continuity.",
      midLongTermImpact: "A refreshed Nexera family could erode Waters differentiation in core LC if Waters does not make ACQUITY upgrade, sustainability, and method-transfer advantages easier to prove.",
      response: {
        defend: "Prepare Nexera X4 versus ACQUITY proof for pharma QC, method transfer, reliability, uptime, and installed-base upgrade conversations.",
        differentiate: "Emphasize premium separations, LC-MS readiness, columns/application ecosystem, and method continuity rather than a pure value-platform comparison.",
        accelerate: "Move routine-QC modernization, sustainability, and simplified maintenance proof higher if field teams see active Nexera replacement pressure.",
      },
    },
    SCIEX: {
      focus: "ZenoTOF, high-throughput MS, quantitative sensitivity, and software-versioned instrument stories",
      intent: "Keep pressure on LC-MS/MS quantitation, HRMS depth, and workflow speed",
      shortTermImpact: "Waters may need sharper proof in LC-MS/MS quantitation, HRMS sensitivity, high-throughput screening, and software-assisted data review for competitive evaluations.",
      midLongTermImpact: "SCIEX could shape customer expectations around instrument-plus-software performance cycles, making Waters' LC-MS roadmap look slower if workflow speed and informatics are not prominent.",
      response: {
        defend: "Arm LC-MS/MS and HRMS deals with use-case-specific proof for sensitivity, robustness, data confidence, and service support.",
        differentiate: "Make the Waters LC plus MS plus informatics handoff explicit, especially where SCIEX positions instrument and software as one workflow.",
        accelerate: "Prioritize high-throughput screening, HRMS workflow speed, and software-assisted data review only where conference capture and public customer evidence show real demand.",
      },
    },
    PerkinElmer: {
      focus: "LC portfolio coverage with adjacent life-science software and workflow signals",
      intent: "Compete more through workflow software and application ecosystems than visible LC hardware refreshes",
      shortTermImpact: "Direct LC hardware threat appears lower, but Waters should watch software, service, and application-workflow claims that influence procurement shortlists.",
      midLongTermImpact: "If PerkinElmer builds a stronger workflow ecosystem around LC-adjacent software and services, Waters could face more pressure in value-oriented labs and integrated analytics workflows.",
      response: {
        defend: "Protect value-sensitive accounts with clear total-cost, service, and uptime evidence for routine LC workflows.",
        differentiate: "Position Waters as deeper in regulated chromatography workflows where PerkinElmer appears broader but less LC-launch intensive.",
        accelerate: "Do not accelerate roadmap based on this signal alone; first validate PerkinElmer news, product-page changes, and public customer voice.",
      },
    },
  }[competitor];
  const evidenceBits = [
    launches.length ? `${launches.length} launch signal${launches.length === 1 ? "" : "s"}` : "",
    strategic.length ? `${strategic.length} strategic move${strategic.length === 1 ? "" : "s"}` : "",
    filings.length ? `${filings.length} filing insight${filings.length === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  const evidenceCount = launches.length + strategic.length + filings.length;
  const evidenceItems = [
    ...launches.map((launch) => ({
      type: "Launch",
      title: launch.product,
      date: launch.date,
      sourceName: launch.sourceName,
      url: timelineUrlForLaunch(launch),
    })),
    ...strategic.map((signal) => ({
      type: "Strategic move",
      title: signal.title,
      date: signal.date,
      sourceName: signal.sourceName,
      url: signal.sourceUrl,
    })),
    ...filings.map((insight) => ({
      type: "Filing insight",
      title: insight.headline,
      date: insight.date,
      sourceName: insight.sourceName,
      url: insight.sourceUrl,
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));
  const evidenceGroups = [
    {
      key: "launches",
      label: `launch signal${launches.length === 1 ? "" : "s"}`,
      items: evidenceItems.filter((item) => item.type === "Launch"),
    },
    {
      key: "strategic",
      label: `strategic move${strategic.length === 1 ? "" : "s"}`,
      items: evidenceItems.filter((item) => item.type === "Strategic move"),
    },
    {
      key: "filings",
      label: `filing insight${filings.length === 1 ? "" : "s"}`,
      items: evidenceItems.filter((item) => item.type === "Filing insight"),
    },
  ].filter((group) => group.items.length);
  const sourceHealth = competitorSourceHealth(competitor);
  const confidenceScore = Math.max(10, Math.min(95,
    Math.min(40, evidenceCount * 10)
    + evidenceBits.length * 15
    + Math.min(15, sourceHealth.good * 5)
    - sourceHealth.issues * 10
    - sourceHealth.manual * 3
  ));
  const confidence = confidenceScore >= 75 ? "Strong public evidence" : confidenceScore >= 50 ? "Moderate public evidence" : confidenceScore >= 30 ? "Limited public evidence" : "Very little matching evidence";
  const risk = evidenceCount >= 4 ? "High" : evidenceCount >= 1 ? "Medium" : "Watch";
  const intentLabel = evidenceCount ? "Competitor activity requires review" : "No recent matching activity";
  return {
    competitor,
    ...profileCopy,
    evidence: evidenceBits.length ? evidenceBits.join(" · ") : "No matching public evidence in the selected filters; continue checking the linked sources",
    confidence,
    confidenceScore,
    sourceHealth,
    risk,
    evidenceCount,
    evidenceItems,
    evidenceGroups,
    evidenceTypeCount: evidenceBits.length,
    intentLabel,
    className: confidenceScore >= 75 ? "strong" : confidenceScore >= 40 ? "directional" : "needs-validation",
  };
}

function renderCompetitorIntentCards(signals) {
  const competitorOrder = ["Thermo Fisher", "Agilent", "Shimadzu", "SCIEX", "PerkinElmer"];
  const competitors = filters.competitor.value === "All" ? competitorOrder : competitorOrder.filter((name) => name === filters.competitor.value);
  const threatRank = { High: 3, Medium: 2, Watch: 1 };
  const profiles = competitors
    .map((competitor) => competitorIntentProfile(competitor, signals))
    .sort((a, b) => (threatRank[b.risk] || 0) - (threatRank[a.risk] || 0) || b.confidenceScore - a.confidenceScore || competitorOrder.indexOf(a.competitor) - competitorOrder.indexOf(b.competitor));
  state.competitorIntentProfiles = profiles;
  byId("intentCount").textContent = profiles.length === 1 ? "1 competitor" : `${profiles.length} competitors · highest potential impact first`;
  byId("competitorIntent").innerHTML = profiles
    .map(
      (profile) => `
        <article class="intent-card">
          <div class="intent-top">
            <div>
              <strong>${escapeHtml(profile.competitor)}</strong>
              <span>${escapeHtml(profile.intentLabel)}</span>
            </div>
            <div class="intent-badges">
              <span class="confidence-pill ${profile.className}" title="This score reflects the number of matching public records, the variety of evidence types, and whether source links are working.">${profile.confidenceScore}/100 · ${escapeHtml(profile.confidence)}</span>
              <span class="tag ${profile.risk === "High" ? "high" : profile.risk === "Medium" ? "medium" : "low"}">${profile.risk === "Watch" ? "No immediate response" : `${escapeHtml(profile.risk)} potential impact`}</span>
            </div>
          </div>
          <div class="intent-body">
            <p><span>Focus</span>${escapeHtml(profile.focus)}</p>
            <p>
              <span>Public evidence used</span>
              ${profile.evidenceGroups.length ? `
                <span class="intent-evidence-count-links">
                  ${profile.evidenceGroups.map((group) => `
                    <a href="#decisionEvidenceModal" data-competitor="${escapeHtml(profile.competitor)}" data-intent-evidence-type="${escapeHtml(group.key)}" aria-label="View ${group.items.length} ${escapeHtml(group.label)} for ${escapeHtml(profile.competitor)}">
                      ${group.items.length} ${escapeHtml(group.label)}
                    </a>
                  `).join('<i aria-hidden="true">·</i>')}
                </span>
              ` : escapeHtml(profile.evidence)}
            </p>
            <p><span>Why this confidence score</span>${profile.evidenceCount} matching public records · ${profile.evidenceTypeCount} different evidence types · ${profile.sourceHealth.good} working source links · ${profile.sourceHealth.issues} links needing review</p>
            <p><span>What the competitor appears to be doing</span>${escapeHtml(profile.intent)}</p>
          </div>
          <div class="intent-impact-grid">
            <p><span>0-6 month impact to Waters</span>${escapeHtml(profile.shortTermImpact)}</p>
            <p><span>12-36 month impact to Waters</span>${escapeHtml(profile.midLongTermImpact)}</p>
          </div>
          <div class="intent-response-grid">
            <p><span>Defend</span>${escapeHtml(profile.response.defend)}</p>
            <p><span>Differentiate</span>${escapeHtml(profile.response.differentiate)}</p>
            <p><span>Accelerate</span>${escapeHtml(profile.response.accelerate)}</p>
          </div>
          <details class="intent-evidence">
            <summary>View all supporting evidence (${profile.evidenceItems.length})</summary>
            <div class="intent-evidence-list">
              ${profile.evidenceItems.length
                ? profile.evidenceItems.map((item) => {
                    const content = `
                      <strong>${escapeHtml(item.type)}: ${escapeHtml(item.title)}</strong>
                      <span>${escapeHtml(formatDate(item.date))} · ${escapeHtml(item.sourceName || "Public source")}</span>
                    `;
                    return isHttpUrl(item.url)
                      ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${content}</a>`
                      : `<span class="intent-evidence-missing">${content}<small>Source link unavailable</small></span>`;
                  }).join("")
                : `<p>No supporting evidence matches the active filters.</p>`}
            </div>
          </details>
        </article>
      `,
    )
    .join("");
}

function renderRoadmapImpactMap(signals) {
  const horizon = filters.horizon.value;
  const trendByName = new Map(state.data.trends.themes.map((trend) => [trend.theme, trend]));
  const launchCount = currentLaunches().length;
  const strategicCount = currentStrategicSignals(signals).length;
  const rows = [
    ["LC platform", "Medium", launchCount >= 3 ? "High" : "Medium", "More public customer evidence needed", "Limited public support", "Validate"],
    ["UHPLC modules", "Medium", currentLaunches().some((launch) => launch.technology === "UHPLC") ? "High" : "Medium", "Direct customer comparison needed", "Limited public support", "Validate"],
    ["LC-MS sensitivity", "High", "High", "Repeated in public customer sources", "Strong public support", "Prepare roadmap decision"],
    ["LC-MS/MS quantitation", "Medium", "High", "Regulated-lab evidence needed", "Limited public support", "Validate"],
    ["2D LC", "Early", "Medium", "No matching public customer evidence", "More evidence needed", "Monitor"],
    ["Software usability", "High", strategicCount >= 3 ? "High" : "Medium", "Limited public customer evidence", "Limited public support", "Validate"],
    ["Informatics", "High", strategicCount >= 3 ? "High" : "Medium", "Public workflow evidence needed", "Limited public support", "Prepare roadmap decision"],
    ["Automation", "Medium", "Medium", "Public workflow evidence needed", "Limited public support", "Validate"],
    ["Application kits", "High", "Medium", "Public adoption examples needed", "Limited public support", "Prepare roadmap decision"],
    ["Sample prep", "Medium", "Medium", "Needs public support and customer evidence", "Needs validation", "Validate"],
    ["Regulated methods", trendByName.get("PFAS and environmental contaminant testing")?.counts[horizon] >= 40 ? "High" : "Medium", "Medium", "Public compliance evidence needed", "Limited public support", "Validate"],
  ];
  const visibleRows = filters.technology.value === "All"
    ? rows
    : rows.filter(([capability]) => capability.toLowerCase().includes(filters.technology.value.toLowerCase().replace("/ms", "")) || /Software|Informatics|Automation|Application kits|Regulated methods/.test(capability));
  byId("roadmapImpactCount").textContent = `${visibleRows.length} capability areas`;
  byId("roadmapImpactMap").innerHTML = `
    <div class="impact-grid" role="table" aria-label="Roadmap impact map">
      <div class="impact-header" role="row">
        <strong>Waters capability</strong>
        <strong>Public trend strength</strong>
        <strong>Competitor pressure</strong>
        <strong>Customer evidence</strong>
        <strong>Confidence</strong>
        <strong>Recommended decision</strong>
      </div>
      ${visibleRows
        .map(
          ([capability, trend, pressure, pull, evidence, action]) => `
            <div class="impact-row" role="row">
              <span class="impact-capability" data-label="Waters capability">${escapeHtml(capability)}</span>
              <span data-label="Public trend strength">${escapeHtml(trend)}</span>
              <span data-label="Competitor pressure">${escapeHtml(pressure)}</span>
              <span data-label="Customer evidence">${escapeHtml(pull)}</span>
              <span data-label="Confidence">${escapeHtml(evidence)}</span>
              <span data-label="Recommended decision"><b class="action-chip ${actionClass(action)}">${escapeHtml(actionDisplayLabel(action))}</b></span>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function customerVoiceSourceMap() {
  return new Map((state.customerVoice?.sources || []).map((source) => [source.id, source]));
}

function customerVoiceSourceLinks(item, horizonValue = filters.horizon.value) {
  const availableExactRecords = (item.evidenceRecords || [])
    .filter((record) => isHttpUrl(record.url))
    .map((record) => ({
      label: record.label || "Exact public record",
      url: record.url,
      status: "exact_record",
      recordType: record.recordType || "Public evidence record",
      sourceDate: record.sourceDate,
      dateType: record.dateType || "Published",
    }));
  if (availableExactRecords.length) {
    return availableExactRecords
      .filter((record) => /^\d{4}-\d{2}-\d{2}$/.test(record.sourceDate || "") && inHorizon(record.sourceDate, horizonValue))
      .sort((a, b) => new Date(b.sourceDate) - new Date(a.sourceDate));
  }

  const sourceMap = customerVoiceSourceMap();
  const links = (item.sourceIds || [])
    .map((id) => sourceMap.get(id))
    .filter(Boolean)
    .filter((source) => isHttpUrl(source.url))
    .map((source) => ({
      label: source.sourceName,
      url: source.url,
      status: source.status,
      recordType: "Source-discovery page",
    }));
  if (!links.length && isHttpUrl(item.sourceUrl)) {
    links.push({ label: item.sourceName || "Source", url: item.sourceUrl, status: "source_mapped", recordType: "Source-discovery page" });
  }
  const seen = new Set();
  return links.filter((link) => {
    if (seen.has(link.url)) return false;
    seen.add(link.url);
    return true;
  });
}

function customerVoiceEvidenceDate(item, horizonValue = filters.horizon.value) {
  return customerVoiceSourceLinks(item, horizonValue)[0]?.sourceDate || null;
}

function customerVoiceItemsForHorizon(horizonValue) {
  const term = customerVoiceSearchTerm.trim().toLowerCase();
  return (state.customerVoice?.feedback || [])
    .filter((item) => customerVoiceSourceLinks(item, horizonValue).length > 0)
    .filter((item) => geographyMatches(item.geography))
    .filter((item) => {
      if (filters.segment.value === "All") return true;
      if (item.labType === filters.segment.value) return true;
      if (filters.segment.value === "CDMO" && item.labType === "CRO/CDMO") return true;
      return false;
    })
    .filter((item) => {
      if (filters.technology.value === "All" || filters.technology.value === "Portfolio") return true;
      const text = `${item.platform} ${item.product} ${item.category} ${item.theme}`;
      return textMatchesTechnology(text, filters.technology.value);
    })
    .filter((item) => filters.competitor.value === "All" || item.company === filters.competitor.value)
    .filter((item) => {
      if (!term) return true;
      const haystack = [
        item.company,
        item.product,
        item.platform,
        item.sourceName,
        item.sentiment,
        item.category,
        item.theme,
        item.customerLanguageSignal,
        item.pmInterpretation,
        item.labType,
        item.userRole,
        item.buyingPriority,
        item.productMaturity,
        item.geography,
      ].join(" ").toLowerCase();
      return haystack.includes(term);
    })
    .sort((a, b) => b.confidence - a.confidence || a.company.localeCompare(b.company));
}

function currentCustomerVoiceItems() {
  return customerVoiceItemsForHorizon(filters.horizon.value);
}

function countBy(items, key) {
  const counts = new Map();
  for (const item of items) counts.set(item[key], (counts.get(item[key]) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

function averageConfidence(items) {
  if (!items.length) return 0;
  return Math.round(items.reduce((total, item) => total + Number(item.confidence || 0), 0) / items.length);
}

function customerVoiceDepth(item, horizonValue = filters.horizon.value) {
  const fiveYear = Number(item.estimatedMentions5y || 1);
  const ratios = {
    "30d": 0.05,
    "60d": 0.08,
    "90d": 0.12,
    "1y": 0.32,
    "3y": 0.72,
    "5y": 1,
  };
  return Math.max(1, Math.round(fiveYear * (ratios[horizonValue] || 1)));
}

function evidenceDepthLabel(depth) {
  if (depth >= 35) return "Frequently repeated in public discussion";
  if (depth >= 18) return "Repeated in several public sources";
  return "Appears in a small number of public sources";
}

function watchIntensityLabel(items) {
  const watched = items.filter((item) => item.sentiment !== "Positive").length;
  if (!watched) return "No negative feedback in the matching records";
  if (watched === items.length) return "Repeated customer concern";
  return "Positive and negative feedback are both present";
}

function sourceFamilyCount(items) {
  return new Set(items.flatMap((item) => item.sourceIds || [])).size;
}

function confidenceLabel(score) {
  if (score >= 70) return "High";
  if (score >= 60) return "Medium";
  return "Limited";
}

function customerVoiceInsightLinks(insight, items) {
  const ids = new Set(insight.evidenceIds || []);
  const matched = items.filter((item) => ids.has(item.id));
  const links = matched.flatMap(customerVoiceSourceLinks);
  const seen = new Set();
  return links.filter((link) => {
    if (seen.has(link.url)) return false;
    seen.add(link.url);
    return true;
  }).slice(0, 3);
}

function uniqueCustomerVoiceLinks(items, limit = 4) {
  const seen = new Set();
  return items
    .flatMap(customerVoiceSourceLinks)
    .filter((link) => {
      if (seen.has(link.url)) return false;
      seen.add(link.url);
      return true;
    })
    .slice(0, limit);
}

function voiceLinksMarkup(items, summary = "View evidence links") {
  const links = uniqueCustomerVoiceLinks(items, 5);
  if (!links.length) return "";
  return `
    <details class="voice-links-detail">
      <summary>${escapeHtml(summary)}</summary>
      <div class="voice-link-list">
        ${links
          .map((link) => `<a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)}</a>`)
          .join("")}
      </div>
    </details>
  `;
}

function sentimentDepth(items, sentiment) {
  return items
    .filter((item) => item.sentiment === sentiment)
    .reduce((total, item) => total + customerVoiceDepth(item), 0);
}

function sentimentClass(sentiment) {
  return {
    Positive: "positive",
    Mixed: "mixed",
    Negative: "negative",
  }[sentiment] || "mixed";
}

function renderSentimentTrendChart(items) {
  const sentiments = ["Positive", "Mixed", "Negative"];
  const totals = sentiments.map((sentiment) => [sentiment, sentimentDepth(items, sentiment)]);
  const totalMentions = totals.reduce((sum, [, total]) => sum + total, 0);
  const sentimentContext = {
    Positive: { symbol: "+", label: "Strengths to protect" },
    Mixed: { symbol: "±", label: "Signals to validate" },
    Negative: { symbol: "!", label: "Pain points to address" },
  };
  const topPain = countBy(items.filter((item) => item.sentiment !== "Positive"), "category")[0]?.[0];
  const topPositive = items.find((item) => item.sentiment === "Positive")?.theme;
  byId("sentimentTrendChart").innerHTML = items.length
    ? `
      <div class="sentiment-card-grid">
        ${totals
          .map(([sentiment, total]) => {
            const share = totalMentions ? Math.round((total / totalMentions) * 100) : 0;
            const context = sentimentContext[sentiment];
            return `
            <button type="button" class="sentiment-card sentiment-drilldown ${sentimentClass(sentiment)}" data-sentiment-view="${escapeHtml(sentiment)}" aria-label="View public evidence supporting ${total} estimated ${sentiment.toLowerCase()} mentions">
              <div class="sentiment-card-heading">
                <span class="sentiment-symbol" aria-hidden="true">${escapeHtml(context.symbol)}</span>
                <span>
                  <strong>${escapeHtml(sentiment)}</strong>
                  <small>${escapeHtml(context.label)}</small>
                </span>
              </div>
              <div class="sentiment-card-value">
                <strong>${total}</strong>
                <span>estimated mentions</span>
              </div>
              <div class="sentiment-card-footer">
                <span>${share}% of ${totalMentions}</span>
                <b>View evidence →</b>
              </div>
            </button>
          `;
          })
          .join("")}
      </div>
      <div class="trend-readout">
        <strong>What this means for Waters</strong>
        <p>${escapeHtml(topPain ? `${topPain} is the main pain/mixed theme to validate.` : "No clear pain theme in this filter.")}</p>
        <p>${escapeHtml(topPositive ? `Customer-visible strength to protect: ${topPositive}` : "No positive feedback is visible in this filter.")}</p>
      </div>
    `
    : `<div class="empty">No public customer feedback matches the selected filters.</div>`;
}

function openSentimentMentionEvidence(sentiment) {
  const matchedRows = currentCustomerVoiceItems().filter((item) => item.sentiment === sentiment);
  const estimatedMentions = matchedRows.reduce((total, item) => total + customerVoiceDepth(item), 0);
  const evidenceItems = matchedRows.flatMap((item) => {
    const links = customerVoiceSourceLinks(item);
    if (!links.length) return [];
    return links.map((link) => ({ item, link }));
  });

  byId("decisionEvidenceTitle").textContent = `${estimatedMentions} estimated ${sentiment.toLowerCase()} mentions`;
  byId("decisionEvidenceSummary").textContent = `${matchedRows.length} synthesized themes link to ${evidenceItems.length} exact discussion threads or support articles. The estimated volume represents recurring themes in the selected horizon; it is not a list of ${estimatedMentions} individually captured comments.`;
  byId("decisionEvidenceList").innerHTML = evidenceItems.length
    ? evidenceItems.map(({ item, link }) => `
        <a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">
          <strong>${escapeHtml(item.company)}: ${escapeHtml(item.product)}</strong>
          <span>“${escapeHtml(item.customerLanguageSignal)}”</span>
          <span>${escapeHtml(link.dateType || "Published")} ${escapeHtml(formatDate(link.sourceDate))} · ${escapeHtml(item.category)} · confidence ${escapeHtml(item.confidence)} · ${escapeHtml(link.recordType || "Public evidence record")}</span>
          <small>${escapeHtml(link.label)} ↗</small>
        </a>
      `).join("")
    : `<div class="empty">No linked public records support this sentiment under the active filters.</div>`;
  byId("decisionEvidenceModal").hidden = false;
  document.body.classList.add("modal-open");
  byId("hideDecisionEvidence").focus();
}

function openCustomerVoiceSummaryEvidence(kind, buyingPriority = "") {
  const items = currentCustomerVoiceItems();
  const matchedRows = items.filter((item) => {
    if (kind === "positive") return item.sentiment === "Positive";
    if (kind === "concerns") return item.sentiment !== "Positive";
    if (kind === "buying") return item.buyingPriority === buyingPriority;
    return true;
  });
  const evidenceItems = matchedRows.flatMap((item) =>
    customerVoiceSourceLinks(item).map((link) => ({ item, link })),
  );
  const titles = {
    all: "All traceable customer-voice records",
    positive: "Positive-feedback records",
    concerns: "Concern records",
    buying: `${buyingPriority} buying-consideration records`,
  };

  byId("decisionEvidenceTitle").textContent = titles[kind] || "Customer-voice records";
  byId("decisionEvidenceSummary").textContent = `${matchedRows.length} traceable record${matchedRows.length === 1 ? "" : "s"} link to ${evidenceItems.length} exact public source${evidenceItems.length === 1 ? "" : "s"} in the selected time window.`;
  byId("decisionEvidenceList").innerHTML = evidenceItems.length
    ? evidenceItems.map(({ item, link }) => `
        <a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">
          <strong>${escapeHtml(item.company)}: ${escapeHtml(item.product)}</strong>
          <span>${escapeHtml(item.buyingPriority)} · ${escapeHtml(item.sentiment)} · ${escapeHtml(item.category)}</span>
          <span>${escapeHtml(link.dateType || "Published")} ${escapeHtml(formatDate(link.sourceDate))}</span>
          <small>${escapeHtml(link.label)} ↗</small>
        </a>
      `).join("")
    : `<div class="empty">No exact public records match this summary under the active filters.</div>`;
  byId("decisionEvidenceModal").hidden = false;
  document.body.classList.add("modal-open");
  byId("hideDecisionEvidence").focus();
}

function renderCustomerCompetitorChart(items) {
  const companies = ["Waters", "Agilent", "Thermo Fisher", "Shimadzu", "SCIEX", "Market-wide"];
  const rows = companies
    .map((company) => {
      const companyItems = items.filter((item) => item.company === company);
      if (!companyItems.length) return null;
      const positive = sentimentDepth(companyItems, "Positive");
      const mixed = sentimentDepth(companyItems, "Mixed");
      const negative = sentimentDepth(companyItems, "Negative");
      const total = Math.max(1, positive + mixed + negative);
      const topCategory = countBy(companyItems, "category")[0]?.[0] || "No category";
      const topPriority = countBy(companyItems, "buyingPriority")[0]?.[0] || "No priority";
      return { company, companyItems, positive, mixed, negative, total, topCategory, topPriority };
    })
    .filter(Boolean)
    .sort((a, b) => b.total - a.total || a.company.localeCompare(b.company));

  byId("customerCompetitorChart").innerHTML = rows.length
    ? `
      <div class="sentiment-legend" aria-label="Sentiment color legend">
        <span><i class="positive"></i><b>Positive</b> customer-visible strength</span>
        <span><i class="mixed"></i><b>Mixed</b> qualified or inconsistent feedback</span>
        <span><i class="negative"></i><b>Negative</b> pain point or complaint</span>
      </div>
      <p class="sentiment-legend-note">Each bar shows the share of that company’s estimated mentions by sentiment.</p>
      ${rows
        .map((row) => `
          <article class="competitor-sentiment-row">
            <div class="competitor-sentiment-top">
              <strong>${escapeHtml(row.company)}</strong>
              <span>${row.total} estimated mentions</span>
            </div>
            <div class="stacked-bar" aria-label="${escapeHtml(row.company)} sentiment mix">
              <span class="positive" style="width:${Math.round((row.positive / row.total) * 100)}%"></span>
              <span class="mixed" style="width:${Math.round((row.mixed / row.total) * 100)}%"></span>
              <span class="negative" style="width:${Math.round((row.negative / row.total) * 100)}%"></span>
            </div>
            <div class="sentiment-breakdown" aria-label="${escapeHtml(row.company)} sentiment percentages">
              <span>Positive ${Math.round((row.positive / row.total) * 100)}%</span>
              <span>Mixed ${Math.round((row.mixed / row.total) * 100)}%</span>
              <span>Negative ${Math.round((row.negative / row.total) * 100)}%</span>
            </div>
            <p><b>Top theme:</b> ${escapeHtml(row.topCategory)} · <b>Buying priority:</b> ${escapeHtml(row.topPriority)}</p>
            ${voiceLinksMarkup(row.companyItems, "View source links")}
          </article>
        `)
        .join("")}
      `
    : `<div class="empty">No competitor comparison signals match the current filters.</div>`;
}

function renderCustomerVoiceSummary(items) {
  const positives = items.filter((item) => item.sentiment === "Positive");
  const negatives = items.filter((item) => item.sentiment === "Negative");
  const mixed = items.filter((item) => item.sentiment === "Mixed");
  const topPain = countBy(items.filter((item) => item.sentiment !== "Positive"), "category")[0];
  const buyingCounts = countBy(items, "buyingPriority").filter(([priority]) => priority);
  const thirdPlaceCount = buyingCounts[Math.min(2, buyingCounts.length - 1)]?.[1] || 0;
  const leadingBuying = buyingCounts.filter(([, count]) => count >= thirdPlaceCount);
  const sourceCount = new Set(items.flatMap((item) => item.sourceIds || [])).size;
  const estimatedMentions = items.reduce((total, item) => total + customerVoiceDepth(item), 0);
  const positiveStrengths = [...new Set(positives.map((item) => item.category).filter(Boolean))].slice(0, 3);
  const cards = [
    {
      label: "Public evidence coverage",
      value: `${items.length} traceable records`,
      detail: `${sourceCount} mapped public sources support an estimated ${estimatedMentions} recurring mentions. This is a weighted trend estimate, not ${estimatedMentions} separate comments.`,
      link: `<button type="button" class="customer-voice-evidence-link" data-customer-voice-records="all">View all ${items.length} records <span aria-hidden="true">→</span></button>`,
    },
    {
      label: "Positive feedback",
      value: `${positives.length} supporting records`,
      detail: positiveStrengths.length ? `Strengths represented: ${positiveStrengths.join("; ")}.` : "No positive feedback matches the active filters.",
      link: positives.length ? `<button type="button" class="customer-voice-evidence-link" data-customer-voice-records="positive">View ${positives.length} records <span aria-hidden="true">→</span></button>` : "",
    },
    {
      label: "Concerns to review",
      value: `${negatives.length + mixed.length} supporting records`,
      detail: topPain ? `${topPain[0]} appears most often among mixed and negative records.` : "No mixed or negative feedback matches the active filters.",
      link: negatives.length + mixed.length ? `<button type="button" class="customer-voice-evidence-link" data-customer-voice-records="concerns">View ${negatives.length + mixed.length} records <span aria-hidden="true">→</span></button>` : "",
    },
  ];
  const topCount = buyingCounts[0]?.[1] || 0;
  const hasMajority = topCount > items.length / 2;
  const buyingCard = buyingCounts.length
    ? `
      <article class="customer-voice-card buying-considerations-card">
        <span>Leading buying considerations</span>
        <strong>${hasMajority ? escapeHtml(buyingCounts[0][0]) : "No majority"}</strong>
        <p>${escapeHtml(`${buyingCounts[0][0]} appears most often, but only in ${topCount} of ${items.length} records.`)}</p>
        <div class="buying-consideration-list" aria-label="Leading buying considerations">
          ${leadingBuying.map(([priority, count]) => `
            <button type="button" data-customer-voice-records="buying" data-buying-priority="${escapeHtml(priority)}">
              <span>${escapeHtml(priority)}</span>
              <strong>${count}/${items.length}</strong>
            </button>
          `).join("")}
        </div>
        ${leadingBuying.length > 3 ? `<small>${leadingBuying.length - 1} considerations tie for second, so all ties are shown.</small>` : ""}
      </article>
    `
    : `
      <article class="customer-voice-card buying-considerations-card">
        <span>Leading buying considerations</span>
        <strong>No clear priority</strong>
        <p>Broaden the filters to identify repeated buying considerations.</p>
      </article>
    `;
  byId("customerVoiceSummary").innerHTML = cards
    .map(
      ({ label, value, detail, link }) => `
        <article class="customer-voice-card">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
          <p>${escapeHtml(detail)}</p>
          ${link}
        </article>
      `,
    )
    .join("") + buyingCard;
}

function renderCustomerVoiceSourceLinks(items) {
  const recordsByUrl = new Map();
  for (const item of items) {
    for (const link of customerVoiceSourceLinks(item).filter((candidate) => candidate.status === "exact_record")) {
      const existing = recordsByUrl.get(link.url) || { link, items: [] };
      existing.items.push(item);
      recordsByUrl.set(link.url, existing);
    }
  }
  const records = [...recordsByUrl.values()].sort((a, b) =>
    new Date(b.link.sourceDate || 0) - new Date(a.link.sourceDate || 0)
      || a.link.label.localeCompare(b.link.label),
  );
  byId("customerVoiceSourceLinks").innerHTML = records.length
    ? records
        .map(({ link, items: supportingItems }) => {
          const products = [...new Set(supportingItems.map((item) => `${item.company}: ${item.product}`))];
          return `
            <a class="voice-source-card evidence-record-card" href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">
              <div>
                <strong>${escapeHtml(link.label)}</strong>
                <p>${escapeHtml(products.join(" · "))}</p>
                <small>${escapeHtml(link.recordType)} · ${escapeHtml(link.dateType || "Published")} ${escapeHtml(formatDate(link.sourceDate))}</small>
              </div>
              <span>Open exact record ↗</span>
            </a>
          `;
        })
        .join("")
    : `<div class="empty">No dated, record-level links match the current customer voice filters.</div>`;
}

function renderPainPointTracker(items) {
  const categoryMap = new Map();
  for (const item of items) {
    const group = categoryMap.get(item.category) || [];
    group.push(item);
    categoryMap.set(item.category, group);
  }
  const rows = [...categoryMap.entries()]
    .map(([category, categoryItems]) => ({
      category,
      categoryItems,
      depth: categoryItems.reduce((total, item) => total + customerVoiceDepth(item), 0),
      watch: watchIntensityLabel(categoryItems),
      linkedRecords: new Set(
        categoryItems
          .flatMap((item) => customerVoiceSourceLinks(item))
          .filter((link) => link.status === "exact_record")
          .map((link) => link.url),
      ).size,
      sentimentStatus: categoryItems.some((item) => item.sentiment === "Negative")
        ? { label: "Concern", className: "negative" }
        : categoryItems.some((item) => item.sentiment === "Mixed")
          ? { label: "Needs validation", className: "mixed" }
          : { label: "Strength signal", className: "positive" },
    }))
    .sort((a, b) => b.depth - a.depth || b.linkedRecords - a.linkedRecords || a.category.localeCompare(b.category))
    .slice(0, 10);
  byId("painPointTracker").innerHTML = rows.length
    ? rows
        .map((row, index) => `
            <article class="pain-row pain-row-${escapeHtml(row.sentimentStatus.className)}">
              <div class="pain-row-head">
                <span class="pain-rank" aria-label="Rank ${index + 1}">${index + 1}</span>
                <div class="pain-row-title">
                  <strong>${escapeHtml(row.category)}</strong>
                  <span class="pain-status ${escapeHtml(row.sentimentStatus.className)}">${escapeHtml(row.sentimentStatus.label)}</span>
                </div>
                <div class="pain-row-metrics" aria-label="Evidence summary">
                  <span><b>${row.depth}</b> estimated mentions</span>
                  <span><b>${row.linkedRecords}</b> linked record${row.linkedRecords === 1 ? "" : "s"}</span>
                </div>
              </div>
              <p><b>Product implication:</b> ${escapeHtml(row.categoryItems[0]?.pmInterpretation || "Review source evidence before changing roadmap priority.")}</p>
              <p class="muted"><b>${escapeHtml(row.watch)}.</b> ${escapeHtml(evidenceDepthLabel(row.depth))}; verify the linked records before changing roadmap priority.</p>
              ${voiceLinksMarkup(row.categoryItems)}
            </article>
          `)
        .join("")
    : `<div class="empty">No pain-point signals match the current filters.</div>`;
}

function renderUnmetNeeds(items) {
  const needs = [
    ["Faster setup", "Reduce method setup and onboarding steps", ["Ease of use", "Training"]],
    ["Easier troubleshooting", "Expose likely root cause for leaks, pressure, carryover, and autosampler issues", ["Reliability", "Uptime"]],
    ["Lower downtime", "Make preventive maintenance, consumables state, and service logs clearer", ["Uptime", "Service"]],
    ["Better software experience", "Simplify templates, data review, audit readiness, and user-role workflows", ["Software", "Compliance"]],
    ["Better method transfer", "Protect legacy methods while reducing migration and validation risk", ["Method transfer"]],
    ["Lower operating cost", "Quantify cost-per-sample, maintenance intervals, and consumables burden", ["Cost"]],
  ];
  byId("unmetNeedsList").innerHTML = needs
    .map(([need, action, triggers]) => {
      const evidence = items.filter((item) => triggers.some((trigger) => `${item.category} ${item.buyingPriority} ${item.theme}`.toLowerCase().includes(trigger.toLowerCase())));
      return `
        <article class="need-row">
          <div>
            <strong>${escapeHtml(need)}</strong>
            <p>${escapeHtml(action)}</p>
            ${voiceLinksMarkup(evidence)}
          </div>
          <span>${evidence.length} supporting records</span>
        </article>
      `;
    })
    .join("");
}

function renderMarketPositioning(items) {
  const companies = ["Waters", "Agilent", "Thermo Fisher", "Shimadzu", "SCIEX", "Market-wide"];
  const rows = companies
    .map((company) => {
      const companyItems = items.filter((item) => item.company === company);
      if (!companyItems.length) return "";
      const positive = companyItems.find((item) => item.sentiment === "Positive") || companyItems[0];
      const watch = companyItems.find((item) => item.sentiment !== "Positive") || companyItems[0];
      return `
        <article class="positioning-row">
          <strong>${escapeHtml(company)}</strong>
          <p><b>Perceived strength:</b> ${escapeHtml(positive.theme)}</p>
          <p><b>Watch item:</b> ${escapeHtml(watch.category)}</p>
          <span>${companyItems.length} supporting records · ${confidenceLabel(averageConfidence(companyItems))} source confidence</span>
          ${voiceLinksMarkup(companyItems)}
        </article>
      `;
    })
    .filter(Boolean);
  byId("marketPositioning").innerHTML = rows.length ? rows.join("") : `<div class="empty">No positioning signals match these filters.</div>`;
}

function renderCustomerSegments(items) {
  const labTypes = countBy(items, "labType").slice(0, 3);
  byId("customerSegments").innerHTML = labTypes.length
    ? labTypes
        .map(([labType, count], index) => {
          const segmentItems = items.filter((item) => item.labType === labType);
          const topRole = countBy(segmentItems, "userRole")[0]?.[0] || "Mixed roles";
          const topPriority = countBy(segmentItems, "buyingPriority")[0]?.[0] || "Mixed priorities";
          const maturity = countBy(segmentItems, "productMaturity")[0]?.[0] || "Mixed maturity";
          const topPain = countBy(segmentItems.filter((item) => item.sentiment !== "Positive"), "category")[0]?.[0] || segmentItems[0]?.category || "No clear pain cluster";
          const depth = segmentItems.reduce((total, item) => total + customerVoiceDepth(item), 0);
          const action = segmentActionCopy(labType, topRole, topPriority, maturity, topPain);
          return `
            <article class="segment-decision-card">
              <div class="segment-rank">${index + 1}</div>
              <div>
                <div class="segment-card-top">
                  <strong>${escapeHtml(labType)}</strong>
                  <span>${depth} estimated mentions · ${count} supporting records</span>
                </div>
                <p><b>Primary audience:</b> ${escapeHtml(topRole)} · ${escapeHtml(maturity)}</p>
                <p><b>Buying criterion:</b> ${escapeHtml(topPriority)}</p>
                <p><b>Signal to inspect:</b> ${escapeHtml(topPain)}</p>
                <p class="question">${escapeHtml(action)}</p>
                ${voiceLinksMarkup(segmentItems)}
              </div>
            </article>
          `;
        })
        .join("")
    : `<div class="empty">No customer segments match the current filters.</div>`;
}

function segmentActionCopy(labType, role, priority, maturity, pain) {
  const text = `${labType} ${role} ${priority} ${maturity} ${pain}`.toLowerCase();
  if (/pharma|qa|compliance|software|data integrity|compliance/.test(text)) {
    return "Role inference: prioritize approved workflow templates, audit-ready data review, and clearer compliance proof for regulated LC users.";
  }
  if (/biopharma|method developer|lc-ms|carryover|autosampler|method transfer/.test(text)) {
    return "Role inference: pressure-test sample-path robustness, carryover controls, and LC-MS method-transfer support with biopharma method developers.";
  }
  if (/academic|training|ease of use|cost/.test(text)) {
    return "Role inference: simplify onboarding, troubleshooting, and cost-of-operation messaging for resource-constrained labs.";
  }
  if (/clinical|uptime|ease of use|training/.test(text)) {
    return "Role inference: emphasize uptime, guided setup, and low-training operation for routine clinical workflows.";
  }
  if (/chemical|materials|method transfer/.test(text)) {
    return "Role inference: make method portability and detector/module flexibility easier to evaluate before purchase.";
  }
  if (/food|environmental|cost|throughput/.test(text)) {
    return "Role inference: quantify throughput, cost-per-sample, and routine maintenance burden against value-positioned competitors.";
  }
  return "PM use: treat this segment as a public customer-evidence research target before committing roadmap capacity.";
}

function renderCompetitiveCustomerSignals(items) {
  const competitorItems = items.filter((item) => !["Waters", "Market-wide"].includes(item.company));
  const rows = ["Agilent", "Thermo Fisher", "Shimadzu", "SCIEX", "PerkinElmer"]
    .map((company) => {
      const companyItems = competitorItems.filter((item) => item.company === company);
      if (!companyItems.length) return "";
      const strength = companyItems.find((item) => item.sentiment === "Positive") || companyItems[0];
      const concern = companyItems.find((item) => item.sentiment !== "Positive");
      return `
        <article class="competitive-signal-row">
          <div>
            <strong>${escapeHtml(company)}</strong>
            <p>${escapeHtml(strength.theme)}</p>
            ${concern ? `<p class="muted">Counter-signal: ${escapeHtml(concern.category)}</p>` : ""}
            ${voiceLinksMarkup(companyItems)}
          </div>
          <span>${companyItems.length}</span>
        </article>
      `;
    })
    .filter(Boolean);
  byId("competitiveCustomerSignals").innerHTML = rows.length ? rows.join("") : `<div class="empty">No competitor customer signals match these filters.</div>`;
}

function renderCustomerPmInsights(items) {
  const visibleIds = new Set(items.map((item) => item.id));
  const insights = (state.customerVoice?.insights || [])
    .filter((insight) => (insight.evidenceIds || []).some((id) => visibleIds.has(id)))
    .sort((a, b) => b.confidence - a.confidence || a.priority.localeCompare(b.priority));
  byId("customerPmInsights").innerHTML = insights.length
    ? insights
        .slice(0, 5)
        .map((insight) => {
          const links = customerVoiceInsightLinks(insight, items);
          return `
            <article class="voice-insight">
              <div class="recommendation-top">
                <strong>${escapeHtml(insight.title)}</strong>
                <span class="tag ${insight.priority.toLowerCase()}">${escapeHtml(insight.priority)}</span>
              </div>
              <p>${escapeHtml(insight.whatItMeans)}</p>
              <p class="question">${escapeHtml(insight.pmAction)}</p>
              <div class="mini-evidence">
                ${links.map((link) => `<a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">View ${escapeHtml(link.label)}</a>`).join("")}
              </div>
            </article>
          `;
        })
        .join("")
    : `<div class="empty">No PM insight matches the current customer-voice filters.</div>`;
}

function renderCustomerEvidenceTable(items) {
  byId("customerEvidenceTable").innerHTML = items.length
    ? items
        .slice(0, 30)
        .map((item) => {
          const links = customerVoiceSourceLinks(item);
          const primary = links[0];
          return `
            <tr>
              <td>${formatDate(customerVoiceEvidenceDate(item))}</td>
              <td><strong>${escapeHtml(item.company)}:</strong> ${escapeHtml(item.product)}</td>
              <td>${escapeHtml(item.sentiment)}</td>
              <td>${escapeHtml(item.category)}</td>
              <td>${escapeHtml(item.labType)}</td>
              <td>${escapeHtml(item.userRole)}</td>
              <td><span class="score">${item.confidence}</span></td>
              <td>${escapeHtml(item.customerLanguageSignal)}</td>
              <td>${primary ? `<a href="${escapeHtml(primary.url)}" target="_blank" rel="noreferrer">View source</a><span class="source-name">${escapeHtml(primary.label)}</span>` : escapeHtml(item.sourceName)}</td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="9"><div class="empty">No customer voice evidence matches the current filters.</div></td></tr>`;
}

function renderCustomerVoiceSignals() {
  const items = currentCustomerVoiceItems();
  byId("customerVoiceCount").textContent = `${items.length} public evidence records`;
  renderCustomerVoiceSummary(items);
  renderSentimentTrendChart(items);
  renderCustomerCompetitorChart(items);
  renderCustomerVoiceSourceLinks(items);
  renderPainPointTracker(items);
  renderUnmetNeeds(items);
  renderMarketPositioning(items);
  renderCustomerSegments(items);
  renderCompetitiveCustomerSignals(items);
  renderCustomerPmInsights(items);
  renderCustomerEvidenceTable(items);
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function exportCustomerVoiceSummary() {
  const rows = currentCustomerVoiceItems();
  const headers = ["Newest evidence date", "Company", "Product", "Sentiment", "Category", "Lab type", "User role", "Buying priority", "Product maturity", "Geography", "Confidence", "Customer language signal", "Source", "PM interpretation"];
  const body = rows.map((item) => [
    customerVoiceEvidenceDate(item),
    item.company,
    item.product,
    item.sentiment,
    item.category,
    item.labType,
    item.userRole,
    item.buyingPriority,
    item.productMaturity,
    item.geography,
    item.confidence,
    item.customerLanguageSignal,
    customerVoiceSourceLinks(item)[0]?.url || "",
    item.pmInterpretation,
  ]);
  const csv = [headers, ...body].map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `waters-customer-voice-${state.customerVoice?.asOfDate || "export"}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderMetrics(signals) {
  const launches = currentLaunches();
  const newLaunches = launches.filter((launch) => /new product|workflow launch|product launch/i.test(launch.signalType)).length;
  const lcMsLaunches = launches.filter((launch) => launch.technology.includes("LC-MS")).length;
  const updates = Math.max(0, launches.length - newLaunches);
  const competitorNames = [...new Set(launches.map((launch) => launch.competitor))].sort();
  const lcMsShare = launches.length ? Math.round((lcMsLaunches / launches.length) * 100) : 0;
  byId("metricGrid").innerHTML = `
    <article class="metric metric-explained">
      <span class="metric-question">What changed?</span>
      <strong>${launches.length} total product changes</strong>
      <p><b>${newLaunches}</b> new product or workflow launches <span aria-hidden="true">+</span> <b>${updates}</b> product updates, modules, or automation releases.</p>
      <div class="metric-links">
        <a href="#launch-evidence" data-launch-view="all">View all ${launches.length}</a>
        <a href="#launch-evidence" data-launch-view="new">View ${newLaunches} launches only</a>
      </div>
    </article>
    <article class="metric metric-explained">
      <span class="metric-question">Where is activity concentrated?</span>
      <strong>${lcMsLaunches} of ${launches.length} affect LC-MS</strong>
      <p><b>${lcMsShare}%</b> of tracked product changes relate to LC-MS or LC-MS/MS. This overlaps with the launch and update counts in the first card.</p>
      <div class="metric-links">
        <a href="#launch-evidence" data-launch-view="lcms">View ${lcMsLaunches} LC-MS records</a>
      </div>
    </article>
    <article class="metric metric-explained">
      <span class="metric-question">Who is active?</span>
      <strong>${competitorNames.length} competitors</strong>
      <p>${competitorNames.length ? `${escapeHtml(competitorNames.join(", "))} have at least one matching product change.` : "No competitor product changes match the active filters."}</p>
      <div class="metric-links">
        <a href="#launch-evidence" data-launch-view="competitors">View activity by competitor</a>
      </div>
    </article>
  `;
}

function timelinePosition(dateValue) {
  const start = new Date("2021-01-01T00:00:00").getTime();
  const end = new Date("2026-12-31T00:00:00").getTime();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
    ? new Date(`${dateValue}T00:00:00`).getTime()
    : new Date(dateValue).getTime();
  if (Number.isNaN(date)) return 0;
  return Math.max(0, Math.min(100, ((date - start) / (end - start)) * 100));
}

function renderCompetitiveTimeline() {
  const launches = currentLaunches();
  byId("timelineHorizonLabel").textContent = horizonLabel();
  const competitorOrder = ["Thermo Fisher", "Agilent", "Shimadzu", "SCIEX", "PerkinElmer"];
  const competitors = competitorOrder.filter((competitor) => launches.some((launch) => launch.competitor === competitor));
  const latestLaunch = launches[0];
  byId("competitiveTimeline").innerHTML = `
    <div class="launch-board-summary">
      <strong>${launches.length} matching launches</strong>
      <span>Open a launch for the official product page, or compare it with Waters.</span>
      ${latestLaunch ? `<button type="button" data-compare-launch="${escapeHtml(latestLaunch.id)}">Compare latest</button>` : ""}
    </div>
    ${
      competitors.length
        ? competitors
            .map((competitor) => {
              const competitorLaunches = launches.filter((launch) => launch.competitor === competitor);
              return `
                <article class="launch-board-row">
                  <div class="launch-board-label">
                    <strong>${competitor}</strong>
                    <span>${competitorLaunches.length} ${competitorLaunches.length === 1 ? "launch" : "launches"}</span>
                  </div>
                  <div class="launch-board-cards">
                    ${competitorLaunches
                      .map((launch) => {
                        const color = competitorColors[competitor] || "#176b87";
                        const label = escapeHtml(launch.product);
                        const dateLabel = escapeHtml(formatDate(launch.date));
                        const productUrl = escapeHtml(timelineUrlForLaunch(launch));
                        return `
                          <article class="launch-board-card" style="--accent:${color}">
                            <a class="launch-board-card-link" href="${productUrl}" target="_blank" rel="noreferrer" aria-label="Open ${label} product source in a new tab">
                              <span>${dateLabel}</span>
                              <strong>${label}</strong>
                              <em>${escapeHtml(launch.signalType)} · ${escapeHtml(launch.technology)}</em>
                              <span class="launch-board-card-link-cue">View product ↗</span>
                            </a>
                            <button class="launch-board-compare" type="button" data-compare-launch="${escapeHtml(launch.id)}" aria-label="Compare ${label} with Waters">Compare with Waters</button>
                          </article>
                        `;
                      })
                      .join("")}
                  </div>
                </article>
              `;
            })
            .join("")
        : `<div class="empty">No competitor launches match the current filters.</div>`
    }
    <div class="timeline-callout">
      <strong>High priority:</strong> open the latest launch comparison and decide if Waters should respond with product features, workflow packaging, or positioning.
    </div>
  `;
}

function renderFeatureGapMatrix() {
  byId("featureGapMatrix").innerHTML = `
    <div class="gap-takeaway">
      <div class="gap-takeaway-main">
        <span>What this means for Waters</span>
        <strong>Waters appears defensible on LC performance; software usability is the capability to validate.</strong>
        <p>Use this as a triage view: defend sensitivity and analysis time, then test whether the software gap is a product UX issue, workflow-packaging gap, or messaging gap.</p>
      </div>
      <div class="gap-takeaway-actions">
        <article>
          <span>Defend</span>
          <strong>Sensitivity + analysis time</strong>
          <p>Waters is marked likely strong on the core LC performance dimensions.</p>
        </article>
        <article>
          <span>Validate</span>
          <strong>Software usability</strong>
          <p>Review public customer feedback on setup, method transfer, troubleshooting, and data review.</p>
        </article>
        <article>
          <span>Compare</span>
          <strong>Agilent + SCIEX software story</strong>
          <p>Public evidence suggests these competitors present their software and instruments as a more integrated workflow.</p>
        </article>
      </div>
    </div>
    <div class="gap-grid">
      <div class="gap-corner"></div>
      ${featureLabels.map((feature) => `<strong>${feature}</strong>`).join("")}
      <strong>Evidence</strong>
      ${featureGapRows
        .map((row) => {
          const evidenceLinks = evidenceLinksForCompetitor(row.competitor);
          return `
            <strong>${escapeHtml(row.competitor)}</strong>
            ${featureLabels
              .map((feature) => {
                const status = row.scores[feature];
                const label = status === "lead" ? "Evidence suggests strength" : status === "parity" ? "No clear difference" : "Potential gap to verify";
                return `<span class="gap-cell ${status}" title="${escapeHtml(row.competitor)} · ${escapeHtml(feature)}: ${label}">${label}</span>`;
              })
              .join("")}
            <div class="gap-evidence">
              ${
                evidenceLinks.length
                  ? evidenceLinks
                      .map(
                        (link) => `
                          <a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer" title="${escapeHtml(link.title)}">
                            ${escapeHtml(link.label)}
                          </a>
                        `,
                      )
                      .join("")
                  : `<span>Waters baseline uses publicly available product information.</span>`
              }
            </div>
          `;
        })
        .join("")}
    </div>
    <div class="gap-legend">
      <span><i class="legend-box lead"></i>Green: public evidence suggests a strength</span>
      <span><i class="legend-box parity"></i>Yellow: no clear public difference</span>
      <span><i class="legend-box lag"></i>Red: a potential Waters gap needs verification</span>
    </div>
    <p class="muted">This is a working comparison based on public information. Open the evidence links and verify exact product specifications before using it for a roadmap decision.</p>
  `;
}

function renderSignalBubbles() {
  const horizon = filters.horizon.value;
  const trends = [...state.data.trends.themes]
    .filter((trend) => filters.segment.value === "All" || trend.marketSegment === filters.segment.value)
    .filter((trend) => filters.technology.value === "All" || trend.technology === filters.technology.value)
    .sort((a, b) => (b.counts[horizon] || 0) - (a.counts[horizon] || 0))
    .slice(0, 4);
  const max = Math.max(...trends.map((trend) => trend.counts[horizon] || 0), 1);
  byId("signalBubbles").innerHTML = trends.length
    ? `
      <div class="pull-summary">
        <strong>${trends.length} application areas ranked</strong>
        <span>${horizonLabel()} evidence. Bar = relative publication volume; Momentum = pace vs baseline.</span>
      </div>
      ${trends
        .map((trend, index) => {
      const count = trend.counts[horizon] || 0;
      const width = Math.max(6, Math.round((count / max) * 100));
      const momentum = trendMomentum(trend, horizon);
      const strengthLabel = pullStrengthLabel(trend.strengthScore);
      return `
        <article class="pull-card">
          <div class="pull-rank">${index + 1}</div>
          <div class="pull-body">
            <div class="pull-top">
              <strong>${escapeHtml(trend.theme)}</strong>
              <span class="tag ${momentum.tone}" title="${escapeHtml(momentum.note)}">${momentum.label}</span>
            </div>
            <div class="pull-meta">
              <span>${escapeHtml(trend.technology)}</span>
              <span>${escapeHtml(trend.marketSegment)}</span>
              <span>Evidence volume: ${count.toLocaleString()} PubMed records</span>
              <span>${strengthLabel}: ${trend.strengthScore}/100</span>
            </div>
            <div class="pull-bar" aria-label="${escapeHtml(trend.theme)} relative evidence volume ${width}%">
              <div style="width:${width}%"></div>
            </div>
            <p class="pull-explain">This bar compares the topic's publication volume with the largest topic in the current filter. ${escapeHtml(momentum.label)} means it is ${escapeHtml(momentum.note)}.</p>
            <p>${trendPmQuestion(trend)}</p>
            <a href="${pubMedSearchUrl(trend.query)}" target="_blank" rel="noreferrer">Open evidence search</a>
          </div>
        </article>
      `;
    })
    .join("")}
    `
    : `<div class="empty">No application pull signals match these filters.</div>`;
}

function renderDecisionMetrics() {
  if (!byId("decisionMetrics")) return;
  const launches = currentLaunches();
  const highConfidence = launches.filter((launch) => launch.confidence >= 85).length;
  const recommendations = currentRecommendationSet(currentSignals());
  const topDecision = recommendations[0];
  if (!topDecision) {
    byId("decisionMetrics").innerHTML = `
      <article class="decision-row warning">
        <span></span>
        <div>
          <strong>No recommendation has enough public support under ${escapeHtml(filterScopeLabel())}</strong>
          <p>Review what public evidence is missing, then continue monitoring launches, conference agendas, and customer feedback before changing roadmap priority.</p>
        </div>
      </article>
    `;
    return;
  }
  const breakdown = topDecision.priorityBreakdown;
  const validation = validationNeedsForRecommendation(topDecision);
  byId("decisionMetrics").innerHTML = `
    <article class="decision-row success">
      <span></span>
      <div>
        <strong>${breakdown.total}/100 highest priority score for the selected filters</strong>
        <p>${escapeHtml(priorityBreakdownText(breakdown))}</p>
      </div>
    </article>
    <article class="decision-row success">
      <span></span>
      <div>
        <strong>${highConfidence} high-confidence competitor launches need PM review</strong>
        <p>These are launches with confidence scores of 85+ inside ${escapeHtml(filterScopeLabel())}.</p>
      </div>
    </article>
    <article class="decision-row warning">
      <span></span>
      <div>
        <strong>${escapeHtml(confidenceDisplayLabel(breakdown.confidenceState.state))}: add the next public proof point</strong>
        <p>Monitor ${escapeHtml(validation.customer)} and ${escapeHtml(validation.competitor)}. Current public-evidence notes: ${escapeHtml(breakdown.evidenceLimitations.join("; ") || "none")}.</p>
      </div>
    </article>
  `;
}

function renderLaunchTimeline() {
  const allLaunches = currentLaunches();
  const view = state.launchDrilldown || "all";
  const viewLabels = {
    all: "All product intelligence events",
    new: "New products and launches",
    lcms: "LC-MS and LC-MS/MS events",
    competitors: "Events across active competitors",
  };
  let launches = view === "new"
    ? allLaunches.filter((launch) => /new product|workflow launch|product launch/i.test(launch.signalType))
    : view === "lcms"
      ? allLaunches.filter((launch) => launch.technology.includes("LC-MS"))
      : [...allLaunches];
  if (view === "competitors") {
    launches = launches.sort((a, b) => a.competitor.localeCompare(b.competitor) || new Date(b.date) - new Date(a.date));
  }
  byId("launchHorizonLabel").textContent = `${horizonLabel()} · ${viewLabels[view]}`;
  byId("launchCount").textContent = `${launches.length} linked ${launches.length === 1 ? "record" : "records"}`;
  byId("launchTimeline").innerHTML = launches.length
    ? `${view !== "all" ? `<div class="launch-filter-banner"><strong>${escapeHtml(viewLabels[view])}</strong><button type="button" data-clear-launch-view>Show all product events</button></div>` : ""}${launches
        .map(
          (launch) => `
            <article class="launch-row">
              <div class="launch-date">
                <strong>${formatDate(launch.date)}</strong>
                <span>${launch.signalType}</span>
              </div>
              <div class="launch-body">
                <div class="recommendation-top">
                  <strong>${launch.competitor}: ${launch.product}</strong>
                  <span class="tag">${launch.technology}</span>
                </div>
                <p class="muted">${launch.marketSegment} · Confidence ${launch.confidence}</p>
                <p>${launch.pmImplication}</p>
                <p class="question">${launch.roadmapQuestion}</p>
                <div class="launch-actions">
                  <button type="button" data-compare-launch="${escapeHtml(launch.id)}">Compare vs Waters</button>
                  <a href="${launch.sourceUrl}" target="_blank" rel="noreferrer">${launch.sourceName}</a>
                </div>
              </div>
            </article>
          `,
        )
        .join("")}`
    : `<div class="empty">No product launches match the current filters and horizon.</div>`;
}

function compactText(value, maxLength = 150) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  const clipped = text.slice(0, maxLength - 1);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, lastSpace > 80 ? lastSpace : clipped.length)}...`;
}

function renderConferenceSources() {
  const events = currentConferenceSources();
  const tierOneCount = events.filter((event) => event.tier === "Tier 1").length;
  byId("conferenceCount").textContent = `${events.length} upcoming`;
  byId("conferenceSources").innerHTML = events.length
    ? `
      <div class="conference-summary">
        <strong>${tierOneCount} Tier 1 upcoming events</strong>
        <span>Scan view: why it matters, competitor watch, one Waters move.</span>
      </div>
      ${events
        .slice(0, 8)
        .map((event) => {
          const monitoringLinks = event.monitoringLinks
            .map((link) => `<a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)}</a>`)
            .join("");
          const topCompetitors = event.competitorWatch.slice(0, 4);
          const captureCue = event.watersPrep[1] || event.industryTrendsToWatch[1] || event.watersPrep[0];
          return `
            <article class="conference-card compact">
              <div class="conference-top">
                <strong>${escapeHtml(event.eventName)}</strong>
                <span class="tag ${event.tier === "Tier 1" ? "high" : "medium"}">${event.tier}</span>
              </div>
              <p class="muted">${escapeHtml(event.dateRange)} · ${event.marketSegments.map(escapeHtml).join(", ")}</p>
              <p class="conference-why"><strong>Why it matters:</strong> ${escapeHtml(compactText(event.industryTrendsToWatch[0], 145))}</p>
              <div class="conference-action">
                <span>Waters move</span>
                <strong>${escapeHtml(compactText(event.watersPrep[0], 150))}</strong>
              </div>
              <div class="conference-brief-row">
                <div>
                  <span>Watch</span>
                  <div class="competitor-watch">
                    ${topCompetitors.map((competitor) => `<span title="${escapeHtml(competitor.status)}">${escapeHtml(competitor.name)}</span>`).join("")}
                  </div>
                </div>
                <div>
                  <span>Capture</span>
                  <p>${escapeHtml(compactText(captureCue, 130))}</p>
                </div>
              </div>
              <div class="conference-tags">
                ${event.technologyFocus.slice(0, 3).map((technology) => `<span>${escapeHtml(technology)}</span>`).join("")}
              </div>
              <div class="conference-links">${monitoringLinks}</div>
            </article>
          `;
        })
        .join("")}
    `
    : `<div class="empty">No upcoming conference prep items match the current filters.</div>`;
}

function renderJournalForumSources() {
  const sources = state.journalSources?.sources || [];
  byId("journalForumCount").textContent = `${sources.length} sources`;
  byId("journalForumSources").innerHTML = sources.length
    ? `
      <div class="journal-summary">
        <strong>${sources.length} mapped sources</strong>
        <span>Use these for LC application trends, competitor narratives, customer language, and buying-criteria signals.</span>
      </div>
      ${sources
        .map((source) => {
          const primarySignals = source.primarySignals
            .slice(0, 4)
            .map((signal) => `<span>${escapeHtml(signal)}</span>`)
            .join("");
          const coverage = source.coverage
            .slice(0, 4)
            .map((item) => `<span>${escapeHtml(item)}</span>`)
            .join("");
          return `
            <article class="journal-source-card">
              <div class="journal-source-top">
                <div>
                  <strong>${escapeHtml(source.name)}</strong>
                  <p>${escapeHtml(source.sourceType)}</p>
                </div>
                <span class="tag steady">${escapeHtml(source.ingestionStatus)}</span>
              </div>
              <p class="journal-source-use">${escapeHtml(source.pmDecisionUse)}</p>
              <div class="journal-source-block">
                <span>Signals to watch</span>
                <div class="journal-tags">${primarySignals}</div>
              </div>
              <div class="journal-source-block">
                <span>Best fit</span>
                <div class="journal-tags muted-tags">${coverage}</div>
              </div>
              <p class="muted">${escapeHtml(source.confidenceUse)}</p>
              <a href="${escapeHtml(source.homepage)}" target="_blank" rel="noreferrer">Open source</a>
            </article>
          `;
        })
        .join("")}
    `
    : `<div class="empty">No journal or forum source map is loaded.</div>`;
}

function renderFilingInsights() {
  const insights = currentFilingInsights();
  byId("filingInsightCount").textContent = `${insights.length} insights`;
  const competitorOrder = ["Agilent", "Thermo Fisher", "Shimadzu", "SCIEX", "PerkinElmer"];
  const groupedInsights = new Map();
  insights.forEach((insight) => {
    if (!groupedInsights.has(insight.competitor)) groupedInsights.set(insight.competitor, []);
    groupedInsights.get(insight.competitor).push(insight);
  });
  const sortedGroups = [...groupedInsights.entries()].sort((a, b) => {
    const aIndex = competitorOrder.indexOf(a[0]);
    const bIndex = competitorOrder.indexOf(b[0]);
    const aRank = aIndex === -1 ? competitorOrder.length : aIndex;
    const bRank = bIndex === -1 ? competitorOrder.length : bIndex;
    return aRank - bRank || a[0].localeCompare(b[0]);
  });
  byId("filingInsights").innerHTML = insights.length
    ? sortedGroups
        .map(([competitor, companyInsights]) => {
          const latestDate = companyInsights
            .map((insight) => new Date(insight.date))
            .filter((date) => !Number.isNaN(date.getTime()))
            .sort((a, b) => b - a)[0];
          const topImpact = Math.max(...companyInsights.map((insight) => Number(insight.impactScore || 0)));
          const topPriority = topImpact >= 85 ? "high" : topImpact >= 75 ? "medium" : "low";
          const insightLabel = companyInsights.length === 1 ? "insight" : "insights";
          return `
            <section class="filing-company-group">
              <div class="filing-company-header">
                <div>
                  <strong>${escapeHtml(competitor)}</strong>
                  <p>${companyInsights.length} filing ${insightLabel} · Avg impact ${average(companyInsights, "impactScore")} · Latest ${latestDate ? formatDate(latestDate) : "No date"}</p>
                </div>
                <span class="tag ${topPriority}">Top impact ${topImpact}</span>
              </div>
              <div class="filing-company-body">
                ${companyInsights
                  .map((insight) => {
                    const navigation = insight.filingNavigation;
                    const searchTerms = navigation?.searchTerms || [];
                    return `
                      <article class="filing-card">
                        <div class="filing-card-top">
                          <strong>${escapeHtml(insight.headline)}</strong>
                          <span class="tag ${insight.priority.toLowerCase()}">${escapeHtml(insight.priority)}</span>
                        </div>
                        <p class="muted">${escapeHtml(insight.filingType)} · ${formatDate(insight.date)} · Impact ${insight.impactScore}</p>
                        <p><strong>Evidence:</strong> ${escapeHtml(insight.evidence)}</p>
                        <p><strong>Why it matters:</strong> ${escapeHtml(insight.whyItMatters)}</p>
                        <p class="question">${escapeHtml(insight.pmImplication)}</p>
                        ${
                          navigation
                            ? `
                              <details class="filing-navigation" open>
                                <summary>How to find this insight inside the filing</summary>
                                <div class="filing-navigation-grid">
                                  <article>
                                    <span>Search these terms</span>
                                    <div class="filing-search-tags">
                                      ${searchTerms.map((term) => `<code>${escapeHtml(term)}</code>`).join("")}
                                    </div>
                                  </article>
                                  <article>
                                    <span>Where to look</span>
                                    <p>${escapeHtml(navigation.whereToLook)}</p>
                                  </article>
                                  <article>
                                    <span>Waters readout</span>
                                    <p>${escapeHtml(navigation.watersReadout)}</p>
                                  </article>
                                </div>
                                <p class="muted">${escapeHtml(navigation.whyThisSurfacesTheInsight)}</p>
                              </details>
                            `
                            : ""
                        }
                        <a href="${escapeHtml(insight.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(insight.sourceName)}</a>
                      </article>
                    `;
                  })
                  .join("")}
              </div>
            </section>
          `;
        })
        .join("")
    : `<div class="empty">No investor filing insights match the current filters.</div>`;
}

function signalScoreBreakdownMarkup(signal) {
  const breakdown = signal.scoreBreakdown || {};
  const authority = breakdown.sourceAuthority || {};
  const recency = breakdown.recency || {};
  const relevance = breakdown.lcRelevance || {};
  const corroboration = breakdown.corroboration || {};
  const tier = signal.tier || "Low";
  const tierClass = tier.toLowerCase();
  const matchedTerms = Array.isArray(relevance.matchedTerms) && relevance.matchedTerms.length
    ? relevance.matchedTerms.join(", ")
    : "No direct LC terms";
  return `
    <div class="signal-priority">
      <span class="signal-tier ${escapeHtml(tierClass)}">${escapeHtml(tier)}</span>
      <strong>${Number(signal.priorityScore || 0)}/100</strong>
    </div>
    <details class="signal-score-detail">
      <summary>Score breakdown</summary>
      <dl>
        <div><dt>Source authority</dt><dd>${Number(authority.contribution || 0)}/${Number(authority.max || 30)} · ${escapeHtml(authority.rating || "Unrated")} · ${escapeHtml(authority.basis || "No basis recorded")}</dd></div>
        <div><dt>Recency</dt><dd>${Number(recency.contribution || 0)}/${Number(recency.max || 25)} · ${Number(recency.ageDays || 0)} days old · ${Number(recency.halfLifeDays || 180)}-day half-life</dd></div>
        <div><dt>LC relevance</dt><dd>${Number(relevance.contribution || 0)}/${Number(relevance.max || 30)} · ${escapeHtml(matchedTerms)}</dd></div>
        <div><dt>Corroboration</dt><dd>${Number(corroboration.contribution || 0)}/${Number(corroboration.max || 15)} · ${Number(corroboration.independentSources || 0)} independent source records for ${escapeHtml(corroboration.theme || signal.theme || "this theme")}</dd></div>
      </dl>
    </details>
  `;
}

function renderStrategicSignals(signals) {
  const strategicSignals = currentStrategicSignals(signals);
  const visibleSignals = strategicSignals.slice(0, 6);
  byId("strategicSignalCount").textContent = visibleSignals.length === strategicSignals.length
    ? `${strategicSignals.length} strategic moves`
    : `Showing ${visibleSignals.length} of ${strategicSignals.length}`;
  byId("strategicSignals").innerHTML = strategicSignals.length
    ? visibleSignals
        .map(
          (signal) => `
            <article class="strategic-card">
              <div class="strategic-top">
                <strong>${escapeHtml(signal.title)}</strong>
                <span class="signal-tier ${escapeHtml((signal.tier || "Low").toLowerCase())}">${escapeHtml(signal.tier || "Low")}</span>
              </div>
              <p class="muted">${escapeHtml(signal.competitor)} · ${escapeHtml(signal.signalType)} · ${formatDate(signal.date)}</p>
              ${signalScoreBreakdownMarkup(signal)}
              <p>${escapeHtml(signal.summary)}</p>
              ${signal.recommendation ? `<p class="question">${escapeHtml(signal.recommendation)}</p>` : ""}
              <a href="${escapeHtml(signal.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(signal.sourceName)}</a>
            </article>
          `,
        )
        .join("")
    : `<div class="empty">No public partnership or corporate-strategy records match the selected filters.</div>`;
}

function renderRecommendations(signals) {
  const filtered = currentRecommendationSet(signals);
  byId("recommendations").innerHTML = filtered.length
    ? filtered
        .slice(0, 3)
        .map(
          (rec) => {
            const evidenceLinks = recommendationEvidenceLinks(rec);
            const breakdown = rec.priorityBreakdown;
            const validation = validationNeedsForRecommendation(rec);
            const workflow = validationWorkflowForRecommendation(rec, breakdown);
            return `
              <article class="recommendation evidence-packet">
                <div class="recommendation-top">
                  <strong>${escapeHtml(rec.affectedCapability || rec.technology)}</strong>
                  <span class="action-chip ${actionClass(breakdown.action)}">${escapeHtml(actionDisplayLabel(breakdown.action))}</span>
                </div>
                <div class="recommendation-meta">
                  <span>Status: ${escapeHtml(rec.decisionStatus || "Needs review")}</span>
                  <span>Priority ${breakdown.total}/100</span>
                  <span>${evidenceLinks.length} source link${evidenceLinks.length === 1 ? "" : "s"}</span>
                </div>
                <details class="recommendation-detail">
                  <summary>Evidence packet for linked queue decision</summary>
                  <p><strong>Queue decision:</strong> ${escapeHtml(rec.title)}</p>
                  <p><strong>Why:</strong> ${escapeHtml(rec.why)}</p>
                  <p><strong>Why now:</strong> ${escapeHtml(rec.whyNow)}</p>
                  <p><strong>Artifact to build:</strong> ${escapeHtml(rec.action)}</p>
                  <p><strong>Deadline and next action:</strong> ${escapeHtml(rec.nextAction)}</p>
                  <p><strong>Affected capability:</strong> ${escapeHtml(rec.affectedCapability)}</p>
                  <p><strong>Competitor intent:</strong> ${escapeHtml(competitorIntentForRecommendation(rec, signals))}</p>
                  <p><strong>Additional public checks:</strong> Customer: ${escapeHtml(validation.customer)}. Competitor: ${escapeHtml(validation.competitor)}. Technical: ${escapeHtml(validation.technical)}. Adoption: ${escapeHtml(validation.adoption)}.</p>
                  <p><strong>Ready for roadmap review when:</strong> ${escapeHtml(workflow.readyWhen)}</p>
                  <p class="muted"><strong>Evidence basis:</strong> ${escapeHtml(recommendationEvidenceSummary(rec))}</p>
                  <p class="muted"><strong>Tradeoff to test:</strong> ${escapeHtml(rec.tradeoff || "Validate public customer voice before committing roadmap capacity.")}</p>
                  <p class="muted"><strong>Falsifier:</strong> ${escapeHtml(rec.falsifier || "No falsifier recorded.")}</p>
                  <div class="recommendation-evidence">
                    ${
                      evidenceLinks.length
                        ? evidenceLinks
                            .map(
                              (link) => `
                                <a class="evidence-chip ${escapeHtml(link.health)}" href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">
                                  ${escapeHtml(link.label)}
                                  <span>${escapeHtml(sourceHealthLabel(link.health))}</span>
                                </a>
                              `,
                            )
                            .join("")
                        : `<span class="missing-source">No source link available for this recommendation.</span>`
                    }
                  </div>
                </details>
              </article>
            `;
          },
        )
        .join("")
    : `<div class="empty">No recommendation detail matches ${escapeHtml(filterScopeLabel())}.</div>`;
}

function renderTrends() {
  const horizon = filters.horizon.value;
  const label = filters.horizon.options[filters.horizon.selectedIndex].text;
  byId("horizonLabel").textContent = label;
  const trends = state.data.trends.themes
    .filter((trend) => filters.segment.value === "All" || trend.marketSegment === filters.segment.value)
    .filter((trend) => filters.technology.value === "All" || trend.technology === filters.technology.value)
    .sort((a, b) => (b.counts[horizon] || 0) - (a.counts[horizon] || 0));
  byId("trendList").innerHTML = trends.length
    ? trends
    .map((trend, index) => {
      const count = trend.counts[horizon] || 0;
      return `
        <article class="trend-evidence-card">
          <div class="trend-card-header">
            <span class="trend-rank" aria-label="Rank ${index + 1}">#${index + 1}</span>
            <div class="trend-card-tags">
              <span>${escapeHtml(trend.technology)}</span>
              <span>${escapeHtml(trend.marketSegment)}</span>
            </div>
          </div>
          <h4>${escapeHtml(trend.theme)}</h4>
          <div class="trend-record-count">
            <strong>${count.toLocaleString()}</strong>
            <span>PubMed records in ${escapeHtml(label.toLowerCase())}</span>
          </div>
          <div class="trend-card-footer">
            <span>Search is limited to the selected time window</span>
            <a class="trend-source-link" href="${escapeHtml(pubMedTrendSearchUrl(trend.query, horizon))}" target="_blank" rel="noreferrer" aria-label="View PubMed sources for ${escapeHtml(trend.theme)} in ${escapeHtml(label.toLowerCase())}">View sources ↗</a>
          </div>
        </article>
      `;
    })
    .join("")
    : `<div class="empty">No trends match the current filters.</div>`;
}

function renderRoadmapSignals(signals) {
  const launches = currentLaunches();
  if (launches.length) {
    byId("roadmapSignals").innerHTML = launches
      .slice(0, 5)
      .map(
        (launch) => `
          <article class="connector">
            <div class="recommendation-top">
              <strong>${launch.product}</strong>
              <span class="tag ${launch.confidence >= 85 ? "high" : "medium"}">${launch.competitor}</span>
            </div>
            <p class="muted">${launch.technology} · ${launch.marketSegment} · ${formatDate(launch.date)}</p>
            <p>${launch.roadmapQuestion}</p>
          </article>
        `,
      )
      .join("");
    return;
  }
  const horizon = filters.horizon.value;
  const trends = state.data.trends.themes
    .filter((trend) => filters.segment.value === "All" || trend.marketSegment === filters.segment.value)
    .filter((trend) => filters.technology.value === "All" || trend.technology === filters.technology.value)
    .sort((a, b) => (b.counts[horizon] || 0) - (a.counts[horizon] || 0))
    .slice(0, 4);
  const competitorCount = new Set(signals.map((signal) => signal.competitor).filter((name) => name !== "Market-wide")).size;
  byId("roadmapSignals").innerHTML = trends.length
    ? trends
        .map((trend) => {
          const count = trend.counts[horizon] || 0;
          const priority = count >= 1000 || trend.strengthScore >= 75 ? "High" : "Medium";
          return `
            <article class="connector">
              <div class="recommendation-top">
                <strong>${trend.theme}</strong>
                <span class="tag ${priority.toLowerCase()}">${priority}</span>
              </div>
              <p class="muted">${count.toLocaleString()} PubMed records in the selected horizon.</p>
              <p>Role question: does Waters need stronger workflow coverage, proof points, or capability prioritization here?</p>
            </article>
          `;
        })
        .join("") +
      `
        <article class="connector">
          <div class="recommendation-top">
            <strong>Competitor comparison review</strong>
            <span class="tag medium">${competitorCount} competitors</span>
          </div>
          <p>Compare evidence density by competitor before changing roadmap priority.</p>
        </article>
      `
    : `<div class="empty">No roadmap questions match the current filters.</div>`;
}

function displaySignals(signals) {
  return signals.filter((signal) => {
    const genericInvestorFiling = signal.signalType === "Investor filing" && /\bfiled\b/i.test(signal.title);
    return !genericInvestorFiling;
  });
}

function renderSignals(signals) {
  const visibleSignals = displaySignals(signals);
  const rowLimit = filters.horizon.value === "3y" ? 120 : 60;
  byId("signalCount").textContent = `${visibleSignals.length} public records`;
  byId("signalTable").innerHTML = visibleSignals.length
    ? visibleSignals
        .slice(0, rowLimit)
        .map(
          (signal) => `
            <tr>
              <td>${formatDate(signal.date)}</td>
              <td>${signal.competitor}</td>
              <td>
                <div class="signal-title">
                  <strong>${signal.title}</strong>
                  <span class="muted">${signal.intent}</span>
                </div>
              </td>
              <td>${signal.technology}</td>
              <td>${signalScoreBreakdownMarkup(signal)}</td>
              <td><a href="${signal.sourceUrl}" target="_blank" rel="noreferrer">${signal.sourceName}</a></td>
            </tr>
          `,
        )
        .join("")
    : `<tr><td colspan="6"><div class="empty">No signals match the current filters.</div></td></tr>`;
}

function trendRecordTotalForHorizon(horizonValue) {
  if (!state.data) return 0;
  return state.data.trends.themes
    .filter((trend) => filters.segment.value === "All" || trend.marketSegment === filters.segment.value)
    .filter((trend) => filters.technology.value === "All" || trend.technology === filters.technology.value)
    .reduce((total, trend) => total + Number(trend.counts[horizonValue] || 0), 0);
}

function domainCountsForHorizon(horizonValue) {
  const customerVoiceItems = customerVoiceItemsForHorizon(horizonValue);
  return {
    signals: displaySignals(filteredSignalsForHorizon(horizonValue)).length,
    launches: filteredLaunchesForHorizon(horizonValue).length,
    filings: filteredFilingInsightsForHorizon(horizonValue).length,
    customerRows: customerVoiceItems.length,
    customerMentions: customerVoiceItems.reduce((total, item) => total + customerVoiceDepth(item, horizonValue), 0),
    publicationRecords: trendRecordTotalForHorizon(horizonValue),
  };
}

function plainDelta(delta, singular, plural) {
  if (delta === 0) return `Same number of ${plural}`;
  const count = Math.abs(delta);
  return `${count} ${delta > 0 ? "more" : "fewer"} ${count === 1 ? singular : plural}`;
}

function horizonDeltaSummary() {
  const selected = filters.horizon.value;
  const selectedCounts = domainCountsForHorizon(selected);
  if (selected === "90d") {
    const threeYearCounts = domainCountsForHorizon("3y");
    return {
      label: "Three-year view adds",
      launches: plainDelta(threeYearCounts.launches - selectedCounts.launches, "launch", "launches"),
      signals: plainDelta(threeYearCounts.signals - selectedCounts.signals, "signal", "signals"),
    };
  }
  const baseline = domainCountsForHorizon("90d");
  return {
    label: "Compared with 90 days",
    launches: plainDelta(selectedCounts.launches - baseline.launches, "launch", "launches"),
    signals: plainDelta(selectedCounts.signals - baseline.signals, "signal", "signals"),
  };
}

function renderSourceCounts(signals) {
  const sources = state.sourceCatalog?.sources || [];
  const launches = currentLaunches();
  const customerVoiceSignals = currentCustomerVoiceItems();
  const customerMentions = customerVoiceSignals.reduce((total, item) => total + customerVoiceDepth(item), 0);
  const filingInsights = currentFilingInsights();
  const publicationRecords = trendRecordTotalForHorizon(filters.horizon.value);
  const upcomingConferenceSources = currentConferenceSources();
  const activeCompetitors = new Set(launches.map((launch) => launch.competitor)).size;
  const issues = sources.filter((source) => ["bad", "blocked"].includes(source.health)).length;
  const horizonDelta = horizonDeltaSummary();
  byId("sourceCounts").innerHTML = `
    <div class="source-pill"><span>Role view</span><strong>${escapeHtml(state.view)}</strong></div>
    <div class="source-pill"><span>Time window</span><strong>${horizonLabel()}</strong></div>
    <div class="source-pill source-pill-comparison">
      <span>${escapeHtml(horizonDelta.label)}</span>
      <strong><small>${escapeHtml(horizonDelta.launches)}</small><small>${escapeHtml(horizonDelta.signals)}</small></strong>
    </div>
    <a class="source-pill source-pill-link" href="#launch-evidence" data-evidence-target="launch-evidence" aria-label="View ${launches.length} matching launches"><span>Matching launches</span><strong>${launches.length}<small>View →</small></strong></a>
    <a class="source-pill source-pill-link" href="#evidence-signal-feed" data-evidence-target="evidence-signal-feed" aria-label="View ${displaySignals(signals).length} public evidence records"><span>Public evidence records</span><strong>${displaySignals(signals).length}<small>View →</small></strong></a>
    <a class="source-pill source-pill-link" href="#filing-evidence" data-evidence-target="filing-evidence" aria-label="View ${filingInsights.length} filing insights"><span>Filing insights</span><strong>${filingInsights.length}<small>View →</small></strong></a>
    <div class="source-pill"><span>Publication records</span><strong>${publicationRecords.toLocaleString()}</strong></div>
    <a class="source-pill source-pill-link" href="#customer-voice" data-evidence-target="customer-voice" aria-label="View ${customerVoiceSignals.length} public customer voice records and ${customerMentions} estimated mentions"><span>Public customer voice</span><strong>${customerVoiceSignals.length} records / ${customerMentions} estimated mentions<small>View →</small></strong></a>
    <a class="source-pill source-pill-link" href="#competitor-intent-section" data-evidence-target="competitor-intent-section" aria-label="View ${activeCompetitors} competitors with matching launches"><span>Competitors with launches</span><strong>${activeCompetitors}<small>View →</small></strong></a>
    <a class="source-pill source-pill-link" href="#conference-intelligence" data-evidence-target="conference-intelligence" aria-label="View ${upcomingConferenceSources.length} upcoming conferences"><span>Upcoming conferences</span><strong>${upcomingConferenceSources.length}<small>View →</small></strong></a>
    <a class="source-pill source-pill-link subtle" href="#source-health" data-evidence-target="source-health" aria-label="Review ${issues} source link issues"><span>Links needing review</span><strong>${issues}<small>Review →</small></strong></a>
  `;
}

function populateCompetitors() {
  const names = [
    ...state.data.signals.map((signal) => signal.competitor),
    ...state.productData.launches.map((launch) => launch.competitor),
  ];
  const competitors = [...new Set(names)].sort();
  filters.competitor.innerHTML = `<option>All</option>${competitors.map((name) => `<option>${name}</option>`).join("")}`;
}

function render() {
  state.view = filters.role.value;
  const signals = currentSignals();
  byId("viewTitle").textContent = "Competitive Intelligence Engine";
  byId("currentViewBadge").textContent = viewCopy[state.view].viewLabel;
  byId("viewSubtitle").textContent = viewCopy[state.view].subtitle;
  byId("focusTitle").textContent = viewCopy[state.view].title.replace(/:.*/, "");
  byId("focusSubtitle").textContent = viewCopy[state.view].decisionQuestion;
  renderSourceCounts(signals);
  renderDirectorSummary(signals);
  renderDecisionPacket(signals);
  renderDecisionQueue(signals);
  renderOverallTrendAnalysis(signals);
  renderCompetitorIntentCards(signals);
  renderCompetitorCoverageHealth(signals);
  renderRoadmapImpactMap(signals);
  renderCustomerVoiceSignals();
  renderMetrics(signals);
  renderCoverageGaps();
  renderProductComparator();
  renderCompetitiveTimeline();
  renderFeatureGapMatrix();
  renderSignalBubbles();
  renderFilingInsights();
  renderStrategicSignals(signals);
  renderConferenceSources();
  renderJournalForumSources();
  renderShortHorizonDefense();
  renderLaunchTimeline();
  renderRecommendations(signals);
  renderTrends();
  renderRoadmapSignals(signals);
  renderSignals(signals);
}

async function loadData() {
  const [
    response,
    productResponse,
    sourceResponse,
    conferenceResponse,
    conferencePrepResponse,
    journalSourceResponse,
    productComparisonResponse,
    technicalComparisonResponse,
    filingInsightResponse,
    customerVoiceResponse,
    refreshStatusResponse,
  ] = await Promise.all([
    fetch("data/intelligence.json", { cache: "no-store" }),
    fetch("data/product_launches.json", { cache: "no-store" }),
    fetch("data/source_catalog.json", { cache: "no-store" }),
    fetch("data/conference_sources.json", { cache: "no-store" }),
    fetch("data/conference_preparation.json", { cache: "no-store" }),
    fetch("data/journal_sources.json", { cache: "no-store" }),
    fetch("data/product_comparisons.json", { cache: "no-store" }),
    fetch("data/technical_comparisons.json", { cache: "no-store" }),
    fetch("data/filing_insights.json", { cache: "no-store" }),
    fetch("data/customer_voice.json", { cache: "no-store" }),
    fetch("data/refresh_status.json", { cache: "no-store" }),
  ]);
  if (!response.ok) throw new Error(`Data load failed: ${response.status}`);
  if (!productResponse.ok) throw new Error(`Product launch data load failed: ${productResponse.status}`);
  if (!sourceResponse.ok) throw new Error(`Source catalog load failed: ${sourceResponse.status}`);
  if (!conferenceResponse.ok) throw new Error(`Conference source data load failed: ${conferenceResponse.status}`);
  if (!conferencePrepResponse.ok) throw new Error(`Conference prep data load failed: ${conferencePrepResponse.status}`);
  if (!journalSourceResponse.ok) throw new Error(`Journal and forum source data load failed: ${journalSourceResponse.status}`);
  if (!productComparisonResponse.ok) throw new Error(`Product comparison data load failed: ${productComparisonResponse.status}`);
  if (!technicalComparisonResponse.ok) throw new Error(`Technical comparison data load failed: ${technicalComparisonResponse.status}`);
  if (!filingInsightResponse.ok) throw new Error(`Filing insight data load failed: ${filingInsightResponse.status}`);
  if (!customerVoiceResponse.ok) throw new Error(`Customer voice data load failed: ${customerVoiceResponse.status}`);
  if (!refreshStatusResponse.ok) throw new Error(`Refresh status data failed: ${refreshStatusResponse.status}`);
  state.data = await response.json();
  state.productData = await productResponse.json();
  state.sourceCatalog = await sourceResponse.json();
  state.conferenceData = await conferenceResponse.json();
  state.conferencePrep = await conferencePrepResponse.json();
  state.journalSources = await journalSourceResponse.json();
  state.productComparisons = await productComparisonResponse.json();
  state.technicalComparisons = await technicalComparisonResponse.json();
  state.filingInsights = await filingInsightResponse.json();
  state.customerVoice = await customerVoiceResponse.json();
  state.refreshStatus = await refreshStatusResponse.json();
  byId("asOf").textContent = `Real public data as of ${state.data.asOfDate}`;
  renderRefreshStatus();
  populateCompetitors();
  setupCollapsiblePanels();
  setupSectionNavigator();
  setupSourceCountLinks();
  setupMetricDrilldowns();
  setupDecisionEvidenceDrilldowns();
  setupOverallTrendEvidenceLinks();
  setupCompetitorIntentEvidenceLinks();
  setupSentimentMentionDrilldowns();
  setupCustomerVoiceSummaryDrilldowns();
  setupCustomerVoiceTabs();
  setupComparisonPanel();
  render();
  schedulePublishedDataCheck();
}

Object.values(filters).forEach((filter) => filter.addEventListener("change", render));

byId("customerVoiceSearch").addEventListener("input", (event) => {
  customerVoiceSearchTerm = event.target.value;
  render();
});

byId("exportCustomerVoice").addEventListener("click", exportCustomerVoiceSummary);

byId("resetFilters").addEventListener("click", () => {
  filters.role.value = "Product";
  filters.geo.value = "All";
  filters.segment.value = "All";
  filters.technology.value = "All";
  filters.competitor.value = "All";
  filters.horizon.value = "1y";
  customerVoiceSearchTerm = "";
  state.launchDrilldown = "all";
  byId("customerVoiceSearch").value = "";
  render();
});

byId("copyDecisionPacket").addEventListener("click", async () => {
  const button = byId("copyDecisionPacket");
  try {
    await navigator.clipboard.writeText(lastDecisionPacketText);
    button.textContent = "Copied";
    setTimeout(() => {
      button.textContent = "Copy brief";
    }, 1400);
  } catch {
    button.textContent = "Copy unavailable";
    setTimeout(() => {
      button.textContent = "Copy brief";
    }, 1600);
  }
});

loadData().catch((error) => {
  document.body.innerHTML = `
    <main class="app-shell" style="margin-left:0">
      <section class="panel">
        <h2>Data file not loaded</h2>
        <p class="muted">Run the real-data collector, then open this dashboard through a local web server.</p>
        <p class="muted">${error.message}</p>
      </section>
    </main>
  `;
});
