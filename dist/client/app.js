const competitiveMethodology = globalThis.CompetitiveMethodology || {
  assessInference: (records) => ({ label: records?.length ? "Directional" : "Low", limitation: "Directional—insufficient independent corroboration.", rubric: {}, families: [], dedupedRecords: records || [] }),
  unquantifiedMagnitude: (overrides = {}) => ({ status: "UNQUANTIFIED — validation required", affectedSegment: overrides.affectedSegment || "Not established", geography: overrides.geography || "Not established", cohort: "Installed-base / replacement cohort not linked", exposureBand: "Unquantified", timeHorizon: "0–24 months", basis: "Public evidence establishes relevance, not Waters revenue or share exposure.", confidence: "Unquantified", validationOwner: overrides.validationOwner || "Product Management + Commercial Analytics", nextStep: "Join CRM installed base, opportunity, win/loss, renewal, and segment-revenue data to the public signal." }),
  evidencePriority: () => "Medium",
  snapshotMetadata: (data) => ({ asOfTimestamp: data?.generatedAt || data?.asOfDate || "unknown", snapshotId: data?.snapshotId || `waters-ci-${data?.asOfDate || "unknown"}` }),
};
const leadershipBriefThesis = globalThis.CompetitionEngineLeadership?.leadershipBriefThesis || (() => "Workflow execution is becoming part of product competition");

const state = {
  data: null,
  productData: null,
  sourceCatalog: null,
  conferenceData: null,
  conferencePrep: null,
  journalSources: null,
  competitorApplicationNotes: null,
  marketApplicationSources: null,
  productComparisons: null,
  historicalProductCatalog: null,
  historicalWatersCatalog: null,
  technicalComparisons: null,
  filingInsights: null,
  customerVoice: null,
  refreshStatus: null,
  view: "Product",
  activeComparisonLaunchId: null,
  activeWatersComparatorId: null,
  activeBattlecardCompetitor: "",
  marketingMarketChoice: null,
  activeDecisionBreakdown: null,
  overallTrendCandidates: [],
  competitorIntentProfiles: [],
  activeIntentCompetitor: "",
  roadmapImpactEvidence: [],
  roadmapImpactSort: { column: 2, direction: "desc" },
  activeCustomerVoiceTab: "summary",
  marketingClaimsFilters: { readiness: "All", audience: "All", classification: "All" },
  marketingTargeting: { application: "All", buyingSituation: "All", buyerRole: "All" },
  marketingEvcBaselines: {},
  marketingEvcAssumptions: {},
  marketingArtifactSegmentId: "",
  marketingArtifactWorkflow: {},
  marketingWorkspaceModel: null,
  conferencePage: 1,
  conferencePageSize: 4,
  strategicEvidencePage: 1,
  strategicEvidencePageSize: 6,
  signalPage: 1,
  signalPageSize: 10,
};

let customerVoiceSearchTerm = "";
let publicEvidenceSearchTerm = "";
let lastDecisionPacketText = "";
let publishedDataCheckTimer = null;
let journalSourceResizeObserver = null;

const filters = {
  role: document.querySelector("#roleFilter"),
  geo: document.querySelector("#geoFilter"),
  segment: document.querySelector("#segmentFilter"),
  technology: document.querySelector("#technologyFilter"),
  competitor: document.querySelector("#competitorFilter"),
  horizon: document.querySelector("#horizonFilter"),
};

const marketingTargetFilters = {
  application: document.querySelector("#pmmApplicationFilter"),
  buyingSituation: document.querySelector("#pmmBuyingSituationFilter"),
  buyerRole: document.querySelector("#pmmBuyerRoleFilter"),
};

const pmmApplicationDefinitions = [
  { value: "MAM", label: "MAM", markets: ["Biopharma"], pattern: /\bmam\b|multi[- ]attribute monitoring/i },
  { value: "Oligo", label: "Oligo", markets: ["Biopharma"], pattern: /oligo(?:nucleotide)?|anti[- ]sense|\baso\b/i },
  { value: "LNP/RNA", label: "LNP / RNA", markets: ["Biopharma"], pattern: /\blnp\b|lipid nanoparticle|\brna\b|mrna/i },
  { value: "Protein characterization", label: "Protein characterization", markets: ["Biopharma", "Academic"], pattern: /protein characterization|intact protein|peptide mapping|proteomics|glycan|biotherapeutic/i },
  { value: "PFAS", label: "PFAS", markets: ["Environmental", "Food & Beverage"], pattern: /\bpfas\b|per- and polyfluoroalkyl|tfa|ultrashort-chain/i },
  { value: "Nitrosamines", label: "Nitrosamines", markets: ["Pharma"], pattern: /nitrosamine|ndma|n-nitroso/i },
  { value: "Routine QC", label: "Routine QC", markets: ["Pharma", "Biopharma", "Environmental", "Food & Beverage", "Clinical", "CDMO"], pattern: /routine qc|quality control|system suitability|batch review|regulated method|routine analysis/i },
  { value: "Other supported applications", label: "Other supported applications", markets: ["All"], pattern: null },
];

const pmmBuyingSituationDefinitions = [
  { value: "Greenfield", label: "Greenfield", pattern: /greenfield|new lab|new laboratory|first system|new capacity|new platform/i },
  { value: "Competitive replacement", label: "Competitive replacement", pattern: /competitive replacement|replace|replacement|versus|vs\.?\b|switch(?:ing)? vendor/i },
  { value: "Waters installed-base upgrade", label: "Waters installed-base upgrade", pattern: /waters|acquity|alliance|arc|installed base|upgrade|legacy/i },
  { value: "Validated-method migration", label: "Validated-method migration", pattern: /validated method|method transfer|migration|equivalency|compatib|revalidation/i },
];

const pmmBuyerRoleTargetDefinitions = [
  { value: "Bench user / analyst", label: "Bench user / analyst", pattern: /\banalyst\b|bench user|instrument specialist/i },
  { value: "Method developer", label: "Method developer", pattern: /method developer|method development/i },
  { value: "QC/QA or validation veto", label: "QC/QA or validation veto", pattern: /\bqc\b|\bqa\b|quality|validation|compliance/i },
  { value: "IT / data-integrity veto", label: "IT / data-integrity veto", pattern: /\bit\b|informatics|data integrity|cds administrator|system administrator/i },
  { value: "Lab-manager decision maker", label: "Lab-manager decision maker", pattern: /lab manager|laboratory manager|manager/i },
  { value: "Procurement / economic buyer", label: "Procurement / economic buyer", pattern: /procurement|purchasing|economic buyer/i },
  { value: "Executive sponsor", label: "Executive sponsor", pattern: /executive|director|vice president|\bvp\b|sponsor/i },
];

const publicEvidenceFilters = {
  company: document.querySelector("#signalCompanyFilter"),
  technology: document.querySelector("#signalTechnologyFilter"),
  source: document.querySelector("#signalSourceFilter"),
};

const viewCopy = {
  Leadership: {
    title: "Leadership: Market decisions",
    viewLabel: "Leadership view",
    subtitle: "Market shifts, threats, and decisions for Next Gen LC.",
    decisionQuestion: "Where should Waters focus next?",
    categories: ["Scientific application intelligence", "Market intelligence", "Corporate intelligence", "Product intelligence"],
  },
  Product: {
    title: "Product: Roadmap and whitespace",
    viewLabel: "Product Management view",
    subtitle: "Informing Roadmap priorities, competitor moves, and whitespace for Next Gen LC.",
    decisionQuestion: "Which roadmap choice needs a decision?",
    categories: ["Scientific application intelligence", "Market intelligence", "Corporate intelligence", "Product intelligence"],
  },
  Engineering: {
    title: "Engineering: Capability priorities",
    viewLabel: "Engineering view",
    subtitle: "Competitor capabilities, technical gaps, and validation needs.",
    decisionQuestion: "Which capability needs validation?",
    categories: ["Scientific application intelligence", "Market intelligence", "Corporate intelligence", "Product intelligence"],
  },
  Marketing: {
    title: "Product Marketing Decision & Activation Workspace",
    viewLabel: "Product Marketing view",
    subtitle: "A decision-and-activation workspace for positioning, proof, and enablement.",
    decisionQuestion: "Which claim or buying criterion needs a response?",
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
    if (panel.dataset.defaultCollapsed === "true") setPanelCollapsed(panel, true);
  });

}

function setActiveSectionNav(targetId) {
  document.querySelectorAll("[data-section-nav]").forEach((link) => {
    const active = link.dataset.sectionNav === targetId;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}

let navigationSelectionLockId = "";
let navigationSelectionLockTimer;
let sectionNavRefreshFrame;
let navigationFocusTarget;
let sectionNavigatorTargets = [];
let sidebarViewportQuery;

function sectionAnchorOffset() {
  return Number.parseFloat(window.getComputedStyle(document.documentElement)
    .getPropertyValue("--section-anchor-offset")) || 24;
}

function isRenderedSection(target) {
  return Boolean(target && target.getClientRects().length && window.getComputedStyle(target).display !== "none");
}

function refreshActiveSectionNav() {
  if (navigationSelectionLockId) {
    setActiveSectionNav(navigationSelectionLockId);
    return;
  }

  const rendered = sectionNavigatorTargets
    .filter(isRenderedSection)
    .map((target) => ({
      target,
      top: window.scrollY + target.getBoundingClientRect().top,
    }))
    .sort((a, b) => a.top - b.top);
  if (!rendered.length) {
    setActiveSectionNav("");
    return;
  }

  const atDocumentEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
  if (atDocumentEnd) {
    setActiveSectionNav(rendered[rendered.length - 1].target.id);
    return;
  }

  const activationLine = window.scrollY + sectionAnchorOffset() + 8;
  const current = rendered.reduce((match, item) => (
    item.top <= activationLine ? item : match
  ), rendered[0]);
  setActiveSectionNav(current.target.id);
}

function scheduleSectionNavRefresh() {
  if (!sectionNavigatorTargets.length || sectionNavRefreshFrame) return;
  sectionNavRefreshFrame = window.requestAnimationFrame(() => {
    sectionNavRefreshFrame = 0;
    refreshActiveSectionNav();
  });
}

function lockActiveSectionNav(targetId, duration = 1400) {
  window.clearTimeout(navigationSelectionLockTimer);
  navigationSelectionLockId = targetId;
  setActiveSectionNav(targetId);
  navigationSelectionLockTimer = window.setTimeout(() => {
    if (navigationSelectionLockId !== targetId) return;
    navigationSelectionLockId = "";
    scheduleSectionNavRefresh();
  }, duration);
}

function updateSectionAnchorOffset() {
  const stickyFilters = document.querySelector(".filters");
  const sidebar = document.querySelector(".sidebar");
  const filterPosition = stickyFilters ? window.getComputedStyle(stickyFilters).position : "static";
  const sidebarPosition = sidebar ? window.getComputedStyle(sidebar).position : "static";
  const stickyHeight = stickyFilters && ["sticky", "fixed"].includes(filterPosition)
    ? Math.ceil(stickyFilters.getBoundingClientRect().height)
    : 0;
  const stickySidebarHeight = sidebar && sidebarPosition === "sticky"
    ? Math.ceil(sidebar.getBoundingClientRect().height)
    : 0;
  document.documentElement.style.setProperty("--section-anchor-offset", `${stickyHeight + stickySidebarHeight + 24}px`);
}

function showSectionArrival(target) {
  if (navigationFocusTarget && navigationFocusTarget !== target) {
    navigationFocusTarget.removeAttribute("tabindex");
  }
  target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
  navigationFocusTarget = target;
}

function scrollToDashboardSection(target, behavior = "smooth") {
  updateSectionAnchorOffset();
  showSectionArrival(target);
  target.scrollIntoView({ behavior, block: "start" });
}

function revealDashboardSection(target) {
  if (target.classList.contains("is-collapsed")) setPanelCollapsed(target, false);
}

function navigateToDashboardSection(targetId, { behavior = "smooth", updateHistory = true } = {}) {
  const target = byId(targetId);
  if (!target) return false;
  revealDashboardSection(target);
  lockActiveSectionNav(targetId, behavior === "auto" ? 100 : 1400);
  if (updateHistory) window.history.replaceState(null, "", `#${targetId}`);
  scrollToDashboardSection(target, behavior);
  return true;
}

function setSidebarNavigationOpen(open, { restoreFocus = false } = {}) {
  const sidebar = document.querySelector(".sidebar");
  const toggle = byId("sidebarNavigationToggle");
  if (!sidebar || !toggle) return;
  const shouldOpen = Boolean(open && sidebarViewportQuery?.matches);
  sidebar.classList.toggle("is-navigation-open", shouldOpen);
  toggle.setAttribute("aria-expanded", String(shouldOpen));
  toggle.querySelector("[aria-hidden]").textContent = shouldOpen ? "⌃" : "⌄";
  updateSectionAnchorOffset();
  if (restoreFocus) toggle.focus({ preventScroll: true });
}

function setupSidebarNavigation() {
  const sidebar = document.querySelector(".sidebar");
  const toggle = byId("sidebarNavigationToggle");
  if (!sidebar || !toggle) return;
  sidebarViewportQuery = window.matchMedia("(max-width: 1180px)");
  toggle.addEventListener("click", () => {
    setSidebarNavigationOpen(!sidebar.classList.contains("is-navigation-open"));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !sidebar.classList.contains("is-navigation-open")) return;
    setSidebarNavigationOpen(false, { restoreFocus: true });
  });
  sidebarViewportQuery.addEventListener("change", () => setSidebarNavigationOpen(false));
  setSidebarNavigationOpen(false);
}

function setupSectionNavigator() {
  const navigator = document.querySelector(".section-navigator");
  if (!navigator) return;

  updateSectionAnchorOffset();
  window.addEventListener("resize", updateSectionAnchorOffset);
  if (window.ResizeObserver) {
    const filterObserver = new ResizeObserver(updateSectionAnchorOffset);
    const filtersElement = document.querySelector(".filters");
    const sidebarElement = document.querySelector(".sidebar");
    if (filtersElement) filterObserver.observe(filtersElement);
    if (sidebarElement) filterObserver.observe(sidebarElement);
  }

  navigator.addEventListener("click", (event) => {
    const link = event.target.closest("[data-section-nav]");
    if (!link) return;
    const targetId = link.dataset.sectionNav;
    if (!byId(targetId)) return;
    event.preventDefault();
    setSidebarNavigationOpen(false);
    navigateToDashboardSection(targetId);
  });

  sectionNavigatorTargets = [...navigator.querySelectorAll("[data-section-nav]")]
    .map((link) => byId(link.dataset.sectionNav))
    .filter(Boolean);
  window.addEventListener("scroll", scheduleSectionNavRefresh, { passive: true });
  window.addEventListener("resize", scheduleSectionNavRefresh);
  window.addEventListener("scrollend", () => {
    if (!navigationSelectionLockId) return;
    window.clearTimeout(navigationSelectionLockTimer);
    navigationSelectionLockId = "";
    scheduleSectionNavRefresh();
  });

  const initialId = window.location.hash.slice(1);
  const initialTarget = sectionNavigatorTargets.find((target) => target.id === initialId);
  if (initialTarget) {
    navigateToDashboardSection(initialId, { behavior: "auto", updateHistory: false });
  } else refreshActiveSectionNav();

  window.addEventListener("hashchange", () => {
    const targetId = window.location.hash.slice(1);
    if (sectionNavigatorTargets.some((target) => target.id === targetId)) {
      navigateToDashboardSection(targetId, { behavior: "auto", updateHistory: false });
    } else scheduleSectionNavRefresh();
  });
}

function setupSourceCountLinks() {
  byId("sourceCounts").addEventListener("click", (event) => {
    const link = event.target.closest("a[data-evidence-target]");
    if (!link) return;
    event.preventDefault();
    navigateToDashboardSection(link.dataset.evidenceTarget);
  });
}

function setupMetricDrilldowns() {
  byId("metricGrid").addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-launch-evidence]");
    if (!trigger) return;
    event.preventDefault();
    openLaunchMetricEvidenceModal(trigger.dataset.launchEvidence || "all");
  });
}

function setupDecisionEvidenceDrilldowns() {
  byId("decisionPacket").addEventListener("click", (event) => {
    const sectionLink = event.target.closest("a[data-leadership-target]");
    if (sectionLink) {
      event.preventDefault();
      const targetId = sectionLink.dataset.leadershipTarget;
      navigateToDashboardSection(targetId);
      return;
    }
    const trigger = event.target.closest("[data-decision-evidence]");
    if (!trigger) return;
    event.preventDefault();
    openDecisionEvidenceModal(trigger.dataset.decisionEvidence);
  });
  byId("decisionQueue").addEventListener("click", (event) => {
    const trigger = event.target.closest("button[data-decision-urgency-sources]");
    if (!trigger) return;
    openDecisionUrgencySources(Number(trigger.dataset.decisionUrgencySources));
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
            <small>${item.sourceLinkLabel || "Open exact record ↗"}</small>
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
    const competitorTrigger = event.target.closest("button[data-intent-select]");
    if (competitorTrigger) {
      state.activeIntentCompetitor = competitorTrigger.dataset.intentSelect;
      renderCompetitorIntentCards(competitorIntentSignals(currentSignals()));
      return;
    }
    const themeTrigger = event.target.closest("button[data-intent-theme-sources]");
    if (themeTrigger) {
      const profile = state.competitorIntentProfiles.find((item) => item.competitor === themeTrigger.dataset.competitor);
      const themeIndex = Number(themeTrigger.dataset.intentThemeSources);
      const theme = profile ? competitorActivityThemes(profile)[themeIndex] : null;
      if (!profile || !theme) return;
      byId("decisionEvidenceTitle").textContent = `${profile.competitor}: ${theme.title}`;
      byId("decisionEvidenceSummary").textContent = `${theme.items.length} exact public source${theme.items.length === 1 ? "" : "s"} support this activity summary.`;
      byId("decisionEvidenceList").innerHTML = theme.items.length
        ? theme.items.map((item) => `
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">
              <strong>${escapeHtml(item.title)}</strong>
              <span>${escapeHtml(formatDate(item.date))} · ${escapeHtml(item.sourceName || "Public source")}</span>
              <small>${item.sourceLinkLabel || "Open exact source ↗"}</small>
            </a>
          `).join("")
        : `<div class="empty">No linked public sources are available for this activity.</div>`;
      byId("decisionEvidenceModal").hidden = false;
      document.body.classList.add("modal-open");
      byId("hideDecisionEvidence").focus();
      return;
    }
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
            <small>${item.sourceLinkLabel || "Open exact record ↗"}</small>
          </a>
        `).join("")
      : `<div class="empty">No linked public records match this evidence category.</div>`;
    byId("decisionEvidenceModal").hidden = false;
    document.body.classList.add("modal-open");
    byId("hideDecisionEvidence").focus();
  });
}

function setupRoadmapImpactEvidenceLinks() {
  byId("featureGapMatrix").addEventListener("click", (event) => {
    const sortTrigger = event.target.closest("button[data-impact-sort]");
    if (sortTrigger) {
      const column = Number(sortTrigger.dataset.impactSort);
      const sameColumn = state.roadmapImpactSort.column === column;
      const defaultDirection = [1, 2, 3].includes(column) ? "desc" : "asc";
      state.roadmapImpactSort = {
        column,
        direction: sameColumn
          ? (state.roadmapImpactSort.direction === "asc" ? "desc" : "asc")
          : defaultDirection,
      };
      renderFeatureGapMatrix(currentSignals());
      return;
    }
    const trigger = event.target.closest("button[data-roadmap-evidence]");
    if (!trigger) return;
    const capability = trigger.dataset.roadmapEvidence;
    const entry = state.roadmapImpactEvidence.find((item) => item.capability === capability);
    if (!entry) return;
    byId("decisionEvidenceTitle").textContent = `${capability} evidence`;
    byId("decisionEvidenceSummary").textContent = `${entry.records.length} linked public record${entry.records.length === 1 ? "" : "s"} match this capability under the active filters. Open the records before using the roadmap recommendation.`;
    byId("decisionEvidenceList").innerHTML = entry.records.length
      ? entry.records.map((record) => `
          <a href="${escapeHtml(record.url)}" target="_blank" rel="noreferrer">
            <strong>${escapeHtml(record.title)}</strong>
            <span>${escapeHtml(record.type)}${record.date ? ` · ${escapeHtml(formatDate(record.date))}` : ""}</span>
            <small>${record.sourceLinkLabel || "Open exact record ↗"}</small>
          </a>
        `).join("")
      : `<div class="empty">No linked public records match this capability. Treat the row as a monitoring hypothesis, not a roadmap conclusion.</div>`;
    byId("decisionEvidenceModal").hidden = false;
    document.body.classList.add("modal-open");
    byId("hideDecisionEvidence").focus();
  });
}

function setupMarketSourceLinks() {
  byId("trendList").addEventListener("click", (event) => {
    const signalTrigger = event.target.closest("a[data-non-pubmed-theme]");
    if (signalTrigger) {
      event.preventDefault();
      const signalData = currentNonPubmedSignalData();
      const signal = signalData.signals.find((item) => item.id === signalTrigger.dataset.nonPubmedTheme);
      if (!signal) return;
      byId("decisionEvidenceTitle").textContent = `${signal.label} — exact non-PubMed records`;
      byId("decisionEvidenceSummary").textContent = `${signal.records.length} dated records from ${signal.journalCount} peer-reviewed journal${signal.journalCount === 1 ? "" : "s"} match the transparent title-keyword rule shown on the card. These records show current topic concentration, not market size or growth.`;
      byId("decisionEvidenceList").innerHTML = signal.records.map((record) => `
        <a href="${escapeHtml(record.sourceUrl)}" target="_blank" rel="noreferrer">
          <strong>${escapeHtml(record.title)}</strong>
          <span>${escapeHtml(record.journal)} · ${escapeHtml(formatDate(record.date))}</span>
          <small>Open exact DOI record ↗</small>
        </a>
      `).join("");
      byId("decisionEvidenceModal").hidden = false;
      document.body.classList.add("modal-open");
      byId("hideDecisionEvidence").focus();
      return;
    }
    const trigger = event.target.closest("a[data-market-source-list]");
    if (!trigger) return;
    event.preventDefault();
    const market = trigger.dataset.marketSourceList;
    const sources = currentMarketApplicationSources()
      .filter((source) => (source.marketSegments || []).includes(market));
    byId("decisionEvidenceTitle").textContent = `${market} market sources`;
    byId("decisionEvidenceSummary").textContent = `${sources.length} mapped non-PubMed sources contribute evidence for ${market}. Open any source below to review the exact publisher page.`;
    byId("decisionEvidenceList").innerHTML = sources.length
      ? sources.map((source) => `
          <a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">
            <strong>${escapeHtml(source.name)}</strong>
            <span>${escapeHtml(source.publisher)} · ${escapeHtml(source.sourceType)}</span>
            <small>Open exact source ↗</small>
          </a>
        `).join("")
      : `<div class="empty">No mapped sources are available for ${escapeHtml(market)}.</div>`;
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

function setupCompanyVoiceDrilldowns() {
  byId("customerCompetitorChart").addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-customer-theme-sources]");
    if (!trigger) return;
    event.preventDefault();
    openCustomerThemeEvidence(
      trigger.dataset.customerThemeSources,
      trigger.dataset.customerThemeCompany,
    );
  });
}

function setCustomerVoiceTab(tabName) {
  const marketingView = state.view === "Marketing";
  const activeTab = !marketingView && tabName === "positioning" ? "summary" : tabName;
  const tabList = byId("customerVoiceTabs");
  tabList.classList.toggle("has-positioning-tab", marketingView);

  state.activeCustomerVoiceTab = activeTab;
  document.querySelectorAll("[data-customer-voice-tab]").forEach((button) => {
    const marketingOnly = button.dataset.customerVoiceTab === "positioning";
    const visible = !marketingOnly || marketingView;
    const active = button.dataset.customerVoiceTab === activeTab;
    button.hidden = !visible;
    button.setAttribute("aria-hidden", String(!visible));
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = visible && active ? 0 : -1;
  });
  document.querySelectorAll("[data-customer-voice-panel]").forEach((panel) => {
    const marketingOnly = panel.dataset.customerVoicePanel === "positioning";
    panel.hidden = (marketingOnly && !marketingView) || panel.dataset.customerVoicePanel !== activeTab;
  });
}

function setupCustomerVoiceTabs() {
  byId("customerVoiceTabs").addEventListener("click", (event) => {
    const button = event.target.closest("[data-customer-voice-tab]");
    if (!button) return;
    setCustomerVoiceTab(button.dataset.customerVoiceTab);
  });
  byId("customerVoiceSourceMix").addEventListener("click", (event) => {
    const button = event.target.closest("[data-customer-source-type]");
    if (!button) return;
    openCustomerVoiceSourceTypeEvidence(button.dataset.customerSourceType);
  });
  setCustomerVoiceTab(state.activeCustomerVoiceTab);
}

function comparisonLaunches() {
  const currentProducts = state.productData?.launches || [];
  const historicalProducts = (state.historicalProductCatalog?.products || []).map((product) => ({
    geography: "Global",
    marketSegment: "All",
    signalType: "Historical product introduction",
    date: `${product.introducedYear}-01-01`,
    ...product,
  }));
  return [...currentProducts, ...historicalProducts]
    .filter((product) => geographyMatches(product.geography))
    .filter((product) => filters.segment.value === "All" || itemMarketSegments(product).includes(filters.segment.value))
    .filter((product) => technologyMatchesFilter(
      product.technology,
      filters.technology.value,
      `${product.product} ${product.signalType || ""} ${itemMarketSegments(product).join(" ")} ${product.subtechnology || ""}`,
    ))
    .filter((product) => filters.competitor.value === "All" || product.competitor === filters.competitor.value)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function comparisonByLaunchId(launchId) {
  return (state.productComparisons?.launchComparisons || []).find((item) => item.launchId === launchId);
}

function watersComparisonSystems() {
  const currentSystems = state.productComparisons?.watersSystems || [];
  const historicalSystems = (state.historicalWatersCatalog?.products || []).map((product) => ({
    decisionRole: "Historical Waters product reference",
    bestFor: [product.technology, "Portfolio history"],
    strengths: ["Officially sourced Waters portfolio record for like-for-like historical comparison."],
    watchouts: ["Confirm current availability, configuration, support status, and specifications before using this system in a purchasing recommendation."],
    ...product,
  }));
  const seenIds = new Set();
  const seenNames = new Set();
  return [...currentSystems, ...historicalSystems]
    .filter((item) => {
      const name = String(item.product || "").trim().toLowerCase();
      if (!item.id || seenIds.has(item.id) || seenNames.has(name)) return false;
      seenIds.add(item.id);
      seenNames.add(name);
      return true;
    })
    .sort((a, b) => (b.introducedYear || 0) - (a.introducedYear || 0) || a.product.localeCompare(b.product));
}

function watersComparatorById(id) {
  return watersComparisonSystems().find((item) => item.id === id);
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
  if (launch?.technology === "MS") return "select-series-mrt";
  if (launch?.technology === "UHPLC") return "acquity-uplc-i-class-plus";
  return watersSystems[0]?.id || "";
}

function launchComparisonTitle(launch) {
  if (!launch) return "Competitor launch";
  return `${launch.competitor}: ${launch.product}`;
}

function comparisonDateLabel(product) {
  if (!product?.introducedYear) return formatDate(product?.date);
  const dateBasis = product.dateBasis || (product.earliestOfficialRecord ? "Earliest official record" : "Introduction");
  return `${product.introducedYear} ${dateBasis.toLowerCase()}`;
}

function populateComparisonControls() {
  const launches = comparisonLaunches();
  const watersSystems = watersComparisonSystems();
  const catalogProducts = state.historicalProductCatalog?.products || [];
  const legacyCount = catalogProducts.filter((product) => product.legacyReference).length;
  const trackedCount = (state.productData?.launches || []).length + catalogProducts.length - legacyCount;

  const catalogNote = byId("comparisonCatalogNote");
  if (catalogNote) {
    catalogNote.innerHTML = `<strong>30-year catalog:</strong> ${trackedCount} competitor products · ${watersSystems.length} Waters systems${legacyCount ? ` · ${legacyCount} older legacy references` : ""} · 1996–2026`;
  }

  byId("comparisonLaunchSelect").innerHTML = launches
    .map((launch) => `<option value="${escapeHtml(launch.id)}">${escapeHtml(comparisonDateLabel(launch))} · ${escapeHtml(launchComparisonTitle(launch))}</option>`)
    .join("");
  byId("comparisonWatersSelect").innerHTML = watersSystems
    .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(comparisonDateLabel(item))} · ${escapeHtml(item.product)}</option>`)
    .join("");

  byId("comparisonLaunchSelect").value = state.activeComparisonLaunchId || launches[0]?.id || "";
  byId("comparisonWatersSelect").value = state.activeWatersComparatorId || "";
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

function competitorFeatureTitle(text) {
  const value = String(text || "").toLowerCase();
  if (/software|data|informatics|report|ai\b/.test(value)) return "Software and Data Workflow";
  if (/automat|throughput|plate|walkaway|sample handling/.test(value)) return "Automation and Throughput";
  if (/sensitiv|signal|acquisition|detection|wavelength/.test(value)) return "Detection Performance";
  if (/carryover|dispersion|precision|flow cell|pressure|particle|column|ph\b/.test(value)) return "LC Method Performance";
  if (/maintenance|diagnostic|reliab|sustainab|uptime|operating/.test(value)) return "Operational Efficiency";
  return "Product and Workflow Positioning";
}

function competitorHighlightedFeatures(profile, launch, comparison) {
  const officialSourceUrl = launch.pressReleaseUrl || launch.sourceUrl || "";
  const publishedFeatures = (profile?.rows || [])
    .filter((row) => row.evidenceType !== "requires-controlled-testing" && row.competitorValue)
    .map((row) => ({
      title: row.dimension,
      detail: row.competitorValue,
      sourceUrl: row.competitorSourceUrl || officialSourceUrl,
    }));

  if (publishedFeatures.length) return publishedFeatures.slice(0, 4);

  const workflowFeatures = (comparison?.shortHorizonDefense?.whatChanged || [])
    .filter(Boolean)
    .map((detail) => ({
      title: competitorFeatureTitle(detail),
      detail,
      sourceUrl: officialSourceUrl,
    }));
  if (workflowFeatures.length) return workflowFeatures.slice(0, 4);

  const positioningText = [comparison?.pmRead, launch.pmImplication]
    .filter(Boolean)
    .flatMap((text) => String(text).split(/(?<=[.!?])\s+/))
    .find((sentence) => sentence && !/\bWaters\b|\bPM should\b|\bPM team\b/i.test(sentence));
  if (positioningText) {
    return [{
      title: competitorFeatureTitle(positioningText),
      detail: positioningText,
      sourceUrl: officialSourceUrl,
    }];
  }

  return [{
    title: "Official Product Record",
    detail: `${launch.competitor} identifies ${launch.product} as a ${launch.technology || "laboratory"} product${launch.introducedYear ? ` introduced in ${launch.introducedYear}` : ""}. Detailed feature claims are not retained in the historical catalog.`,
    sourceUrl: officialSourceUrl,
  }];
}

function competitorFeatureHighlightsMarkup(profile, launch, comparison) {
  const features = competitorHighlightedFeatures(profile, launch, comparison);
  return `
    <section class="competitor-feature-panel">
      <div class="mini-header">
        <h4>Key Features Highlighted by ${escapeHtml(launch.competitor)}</h4>
      </div>
      <div class="competitor-feature-grid">
        ${features.map((feature) => `
          <article class="competitor-feature-card">
            <strong>${escapeHtml(feature.title)}</strong>
            <p>${escapeHtml(feature.detail)}</p>
            ${isHttpUrl(feature.sourceUrl) ? `<a href="${escapeHtml(feature.sourceUrl)}" target="_blank" rel="noreferrer">Official source ↗</a>` : ""}
          </article>
        `).join("")}
      </div>
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

  const curatedComparison = comparisonByLaunchId(launch.id);
  const waters = watersComparatorById(state.activeWatersComparatorId) || watersComparatorById(defaultWatersComparatorForLaunch(launch));
  const comparison = ComparisonLogic.resolvePairComparison(launch, waters, curatedComparison);
  const sourceUrl = timelineUrlForLaunch(launch);
  const impactValue = comparison.impactValue || `${comparison.threatLevel || "Directional"} impact`;
  const impactNote = comparison.impactRationale;
  const watersMeaning = comparison.pmRead;
  const watersPositioning = comparison.watersPositioning;
  const featureProfile = (state.technicalComparisons?.profiles || []).find(
    (item) => item.launchId === launch.id,
  );

  byId("comparisonSnapshots").innerHTML = `
    ${comparatorSnapshotCard("Competitor product", {
      company: launch.competitor,
      product: launch.product,
      technology: launch.technology,
    }, sourceUrl)}
    ${comparatorSnapshotCard("Waters", waters, waters?.sourceUrl)}
  `;

  byId("comparisonBody").innerHTML = `
    <div class="comparison-readout">
      ${comparisonMetricCard("Potential impact on Waters", impactValue, impactNote)}
    </div>
    <section class="comparison-positioning">
      <div>
        <h4>What This Means for Waters</h4>
        <p>${escapeHtml(watersMeaning)}</p>
        ${comparison.evidenceBasis ? `<small class="comparison-evidence-note"><strong>Evidence basis:</strong> ${escapeHtml(comparison.evidenceBasis)}</small>` : ""}
      </div>
      <div>
        <h4>How to Position Waters</h4>
        <p>${escapeHtml(watersPositioning)}</p>
      </div>
    </section>
    ${
      comparison.shortHorizonDefense
        ? `<section class="comparison-defense-section">
            <div class="mini-header">
              <h4>Short-Horizon Defense</h4>
            </div>
            ${shortHorizonDefenseMarkup(launch, comparison)}
          </section>`
        : ""
    }
    ${competitorFeatureHighlightsMarkup(featureProfile, launch, comparison)}
    <section>
      <div class="mini-header">
        <h4>Commercial and Workflow Interpretation</h4>
      </div>
      <div class="comparison-table-wrap">
        <table class="comparison-table">
          <thead>
            <tr>
              <th>Decision dimension</th>
              <th>${escapeHtml(launch.competitor)}</th>
              <th>Waters</th>
              <th>Why this matters for Waters</th>
            </tr>
          </thead>
          <tbody>
            ${(comparison.dimensions || [])
              .map((row) => `
                <tr>
                  <td><strong>${escapeHtml(row.dimension)}</strong></td>
                  <td>${escapeHtml(row.competitor)}</td>
                  <td>${escapeHtml(row.waters)}</td>
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

const marketingBattlecardCompetitors = ["Agilent", "Thermo Fisher", "Shimadzu", "SCIEX"];

function battlecardLaunchesForCompetitor(competitor) {
  const currentProducts = state.productData?.launches || [];
  const historicalProducts = (state.historicalProductCatalog?.products || []).map((product) => ({
    geography: "Global",
    marketSegment: "All",
    signalType: "Historical product introduction",
    date: `${product.introducedYear}-01-01`,
    ...product,
  }));
  return [...currentProducts, ...historicalProducts]
    .filter((product) => product.competitor === competitor)
    .filter((product) => inSelectedHorizon(product.date))
    .filter((product) => geographyMatches(product.geography))
    .filter((product) => filters.segment.value === "All" || itemMarketSegments(product).includes(filters.segment.value))
    .filter((product) => technologyMatchesFilter(
      product.technology,
      filters.technology.value,
      `${product.product} ${product.signalType || ""} ${itemMarketSegments(product).join(" ")} ${product.subtechnology || ""}`,
    ))
    .filter((product) => pmmTargetingMatches(product))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function battlecardComparisonForCompetitor(competitor) {
  const launches = battlecardLaunchesForCompetitor(competitor);
  const selectedLaunch = launches.find((launch) => comparisonByLaunchId(launch.id)) || launches[0];
  const comparison = selectedLaunch ? comparisonByLaunchId(selectedLaunch.id) : null;
  const waters = selectedLaunch
    ? watersComparatorById(comparison?.closestWatersId || defaultWatersComparatorForLaunch(selectedLaunch))
    : null;
  const technicalProfile = selectedLaunch
    ? (state.technicalComparisons?.profiles || []).find((profile) => profile.launchId === selectedLaunch.id)
    : null;
  return { launches, selectedLaunch, comparison, waters, technicalProfile };
}

function battlecardEvidenceLinks(competitor) {
  const records = [
    ...currentLaunches()
      .filter((item) => item.competitor === competitor)
      .map((item) => ({
        url: timelineUrlForLaunch(item),
        label: item.product,
        sourceName: item.sourceName || "Official product source",
        date: item.date,
        confidence: item.confidence,
        evidenceType: "Official launch",
      })),
    ...currentSignals()
      .filter((item) => item.competitor === competitor)
      .map((item) => ({
        url: item.sourceUrl || item.url,
        label: item.title || item.headline,
        sourceName: item.sourceName || "Public evidence source",
        date: item.date,
        confidence: item.confidence,
        evidenceType: item.category || "Public evidence",
      })),
    ...currentFilingInsights()
      .filter((item) => item.competitor === competitor)
      .map((item) => ({
        url: item.sourceUrl || item.url,
        label: item.headline || item.title,
        sourceName: item.sourceName || "Company filing",
        date: item.date,
        confidence: item.confidence,
        evidenceType: "Company filing",
      })),
  ];
  const customerLinks = customerVoiceItemsForHorizon(filters.horizon.value, { ignoreCompetitor: true })
    .filter((item) => item.company === competitor)
    .flatMap((item) => customerVoiceSourceLinks(item).map((link) => ({
      url: link.url,
      label: link.label,
      sourceName: "Public customer voice",
      date: link.sourceDate,
      confidence: item.confidence,
      evidenceType: "Exact public customer record",
    })));
  const seen = new Set();
  return [...records, ...customerLinks]
    .filter((item) => {
      const key = canonicalEvidenceUrl(item.url);
      return isHttpUrl(item.url) && !seen.has(key) && seen.add(key);
    })
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}

function battlecardProofPoints({ waters, technicalProfile }) {
  const sourcedTechnicalProof = (technicalProfile?.rows || [])
    .filter((row) => row.evidenceType !== "requires-controlled-testing" && row.watersValue && isHttpUrl(row.watersSourceUrl))
    .slice(0, 3)
    .map((row) => ({
      label: row.dimension,
      detail: row.watersValue,
      url: row.watersSourceUrl,
      date: technicalProfile?.asOfDate || "",
    }));
  const productProof = (waters?.strengths || []).map((strength, index) => ({
    label: index === 0 ? waters.product : `Waters proof point ${index + 1}`,
    detail: strength,
    url: waters.sourceUrl,
    date: waters.launchDate || waters.date || "",
  }));
  const seen = new Set();
  return [...sourcedTechnicalProof, ...productProof]
    .filter((proof) => proof.detail && !seen.has(proof.detail) && seen.add(proof.detail))
    .slice(0, 3);
}

function battlecardClaims(profile, selectedLaunch) {
  const activityClaims = (profile?.activityThemes || []).map((theme) => theme.insight).filter(Boolean);
  const launchClaim = selectedLaunch?.pmImplication || selectedLaunch?.summary || "";
  const fallbackClaims = [profile?.focus, profile?.intent].filter(Boolean);
  return [...new Set([...activityClaims, launchClaim, ...fallbackClaims])].filter(Boolean).slice(0, 3);
}

function battlecardObjections(competitor, profile, selectedLaunch) {
  const customerThemes = customerVoiceItemsForHorizon(filters.horizon.value, { ignoreCompetitor: true })
    .filter((item) => item.company === competitor && item.sentiment === "Positive")
    .map((item) => item.theme)
    .filter(Boolean);
  return [...new Set([
    ...customerThemes,
    selectedLaunch?.product ? `${selectedLaunch.product} gives ${competitor} a fresh-platform or workflow story.` : "",
    profile?.shortTermImpact,
  ])].filter(Boolean).slice(0, 3);
}

function battlecardTraps(competitor, comparison, technicalProfile) {
  const weakness = comparison?.shortHorizonDefense?.stillWeak?.[0];
  const evidenceLimit = comparison?.evidenceBasis || technicalProfile?.limitations?.[0];
  return [
    weakness || `Ask ${competitor} to show common-condition customer proof that its headline claim improves time-to-value, uptime, or method outcomes.`,
    evidenceLimit || "Ask which published claims survive a like-for-like workflow comparison, including software, service, training, and method transfer.",
    "Ask the customer which buying criterion actually decides the evaluation; do not let the competitor choose the scorecard by default.",
  ].filter(Boolean).slice(0, 3);
}

function battlecardLandmines(waters, comparison, technicalProfile) {
  return [...new Set([
    ...(waters?.watchouts || []),
    comparison?.evidenceBasis,
    ...(technicalProfile?.limitations || []).slice(0, 1),
    "Do not claim a performance lead when the public evidence uses different test conditions or only establishes vendor positioning.",
  ])].filter(Boolean).slice(0, 3);
}

function battlecardListMarkup(items) {
  return items.length
    ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : `<p class="muted">No supported item matches the active filters.</p>`;
}

function marketingActiveCompetitors() {
  const selected = filters.competitor.value;
  if (selected === "All") return marketingBattlecardCompetitors;
  return marketingBattlecardCompetitors.includes(selected) ? [selected] : [];
}

function pmmTargetCompetitorEvidenceSources(competitor, signals = currentSignals()) {
  const applicationNotes = currentCompetitorApplicationNotes()
    .filter((note) => note.competitor === competitor)
    .map((note) => ({
      url: note.sourceUrl,
      label: note.title,
      sourceName: note.sourceType || "Official application note",
      date: note.date,
      evidenceType: "Observed application evidence",
      detail: note.evidenceStatement,
    }));
  const signalSources = signals
    .filter((signal) => signal.competitor === competitor)
    .map((signal) => ({
      url: signal.sourceUrl,
      label: signal.title,
      sourceName: signal.sourceName || "Public evidence source",
      date: signal.date,
      confidence: signal.confidence,
      evidenceType: signal.category || signal.signalType,
      detail: signal.summary,
    }));
  const launchSources = currentLaunches()
    .filter((launch) => launch.competitor === competitor)
    .map((launch) => ({
      url: timelineUrlForLaunch(launch),
      label: launch.product,
      sourceName: launch.sourceName || "Official launch source",
      date: launch.date,
      confidence: launch.confidence,
      evidenceType: "Observed launch evidence",
      detail: launch.summary || launch.pmImplication,
    }));
  const conferenceSources = currentConferenceSources().flatMap((event) => {
    const content = (event.competitorContent || []).find((item) => String(item.competitor || "").includes(competitor));
    const watch = (event.competitorWatch || []).find((item) => item.name === competitor);
    if (!content && !watch) return [];
    return [{
      url: content?.sourceUrl || event.website || event.monitoringLinks?.[0]?.url,
      label: `${event.eventName} competitor evidence`,
      sourceName: event.eventName,
      date: event.startDate,
      evidenceType: content?.evidenceStatus || "Conference participation evidence",
      detail: content?.content || watch?.status,
    }];
  });
  return pmmDeduplicateSources([...applicationNotes, ...signalSources, ...launchSources, ...conferenceSources]);
}

function pmmCompetitorTargetPriority(sources) {
  const domains = new Set(sources.map(pmmSourceHostname)).size;
  const sourceFamilies = new Set(sources.map((source) => source.evidenceType || source.sourceName)).size;
  const recency = pmmDecisionRecency(sources).points;
  const confidence = pmmEvidenceConfidence(sources);
  const score = recency + Math.min(3, domains) * 8 + Math.min(3, sourceFamilies) * 5 + Math.min(15, Math.round(confidence / 7));
  return {
    score,
    domains,
    sourceFamilies,
    sourceCount: sources.length,
    label: sources.length
      ? `Evidence-fit priority · ${domains} domain${domains === 1 ? "" : "s"} · ${sourceFamilies} source famil${sourceFamilies === 1 ? "y" : "ies"}`
      : "No target-compatible competitor evidence",
  };
}

function pmmTargetWatersProofPoints() {
  if (state.marketingTargeting.application === "All" && state.marketingTargeting.buyingSituation === "All") return [];
  return currentConferenceSources().flatMap((event) => (event.boothRecommendations || [])
    .filter((item) => pmmTargetingMatches({ ...item, event }))
    .filter((item) => isHttpUrl(item.productUrl))
    .map((item) => ({
      label: item.product,
      detail: item.message || item.role,
      url: item.productUrl,
      date: event.startDate,
      sourceName: "Waters public product source",
      evidenceType: "Observed Waters application context",
    })));
}

function pmmUsableText(value, fallback = "") {
  const text = String(value || "").trim();
  return text && !/\broadmap\b|product requirements?/i.test(text) ? text : fallback;
}

function pmmTargetingSelection() {
  return {
    market: filters.segment.value,
    application: state.marketingTargeting.application,
    buyingSituation: state.marketingTargeting.buyingSituation,
    geography: filters.geo.value,
    buyerRole: state.marketingTargeting.buyerRole,
  };
}

function pmmTargetingKey(targeting = pmmTargetingSelection()) {
  return [targeting.market, targeting.application, targeting.buyingSituation, targeting.geography, targeting.buyerRole].join(" > ");
}

function pmmTargetingDisplayValue(value, allLabel) {
  return value === "All" ? allLabel : value;
}

function pmmRecordTargetingText(item) {
  if (!item) return "";
  if (typeof item === "string") return item;
  try {
    return JSON.stringify(item);
  } catch {
    return String(item);
  }
}

function pmmApplicationDefinition(value = state.marketingTargeting.application) {
  return pmmApplicationDefinitions.find((definition) => definition.value === value);
}

function pmmApplicationMatchesTarget(item, application = state.marketingTargeting.application) {
  if (application === "All") return true;
  const text = pmmRecordTargetingText(item);
  if (application === "Other supported applications") {
    return !pmmApplicationDefinitions.some((definition) => definition.pattern?.test(text));
  }
  return Boolean(pmmApplicationDefinition(application)?.pattern?.test(text));
}

function pmmBuyingSituationMatchesTarget(item, buyingSituation = state.marketingTargeting.buyingSituation) {
  if (buyingSituation === "All") return true;
  const definition = pmmBuyingSituationDefinitions.find((entry) => entry.value === buyingSituation);
  return Boolean(definition?.pattern?.test(pmmRecordTargetingText(item)));
}

function pmmBuyerRoleMatchesTarget(item, buyerRole = state.marketingTargeting.buyerRole) {
  if (buyerRole === "All") return true;
  const definition = pmmBuyerRoleTargetDefinitions.find((entry) => entry.value === buyerRole);
  return Boolean(definition?.pattern?.test(pmmRecordTargetingText(item)));
}

function pmmTargetingMatches(item, { includeBuyerRole = false } = {}) {
  if (state.view !== "Marketing") return true;
  return pmmApplicationMatchesTarget(item)
    && pmmBuyingSituationMatchesTarget(item)
    && (!includeBuyerRole || pmmBuyerRoleMatchesTarget(item));
}

function pmmApplicationsForSelectedMarket() {
  const market = filters.segment.value;
  return pmmApplicationDefinitions.filter((definition) => market === "All"
    || definition.markets.includes("All")
    || definition.markets.includes(market));
}

function normalizeMarketingTargeting() {
  const applications = pmmApplicationsForSelectedMarket();
  if (state.marketingTargeting.application !== "All"
    && !applications.some((definition) => definition.value === state.marketingTargeting.application)) {
    state.marketingTargeting.application = "All";
  }
  const optionMarkup = (value, label, selected) => `<option value="${escapeHtml(value)}" ${selected === value ? "selected" : ""}>${escapeHtml(label)}</option>`;
  marketingTargetFilters.application.innerHTML = [
    optionMarkup("All", "All supported applications", state.marketingTargeting.application),
    ...applications.map((definition) => optionMarkup(definition.value, definition.label, state.marketingTargeting.application)),
  ].join("");
  marketingTargetFilters.buyingSituation.innerHTML = [
    optionMarkup("All", "All buying situations", state.marketingTargeting.buyingSituation),
    ...pmmBuyingSituationDefinitions.map((definition) => optionMarkup(definition.value, definition.label, state.marketingTargeting.buyingSituation)),
  ].join("");
  marketingTargetFilters.buyerRole.innerHTML = [
    optionMarkup("All", "All buyer roles", state.marketingTargeting.buyerRole),
    ...pmmBuyerRoleTargetDefinitions.map((definition) => optionMarkup(definition.value, definition.label, state.marketingTargeting.buyerRole)),
  ].join("");
}

function pmmTargetedBuyerRole(fallback = "Buyer role unresolved") {
  return state.marketingTargeting.buyerRole === "All" ? fallback : state.marketingTargeting.buyerRole;
}

function pmmTargetedBuyingSituation(fallback = "Buying situation unresolved") {
  return state.marketingTargeting.buyingSituation === "All" ? fallback : state.marketingTargeting.buyingSituation;
}

function pmmListItems(items, fallback = []) {
  const safe = (items || []).map((item) => pmmUsableText(item)).filter(Boolean);
  return safe.length ? safe : fallback;
}

function pmmStatusMarkup(kind, label, detail) {
  return `<div class="pmm-status pmm-status-${escapeHtml(kind)}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(detail)}</strong></div>`;
}

function pmmEvidenceLinkMarkup(source, label = "Open source ↗") {
  if (!source || !isHttpUrl(source.url)) return "";
  return `<a class="pmm-source-link" href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
}

function pmmEvidenceConfidence(evidenceLinks) {
  const scored = evidenceLinks.filter((item) => Number.isFinite(Number(item.confidence)));
  return averageConfidence(scored);
}

function marketingCompetitorContext(competitor, signals = currentSignals()) {
  const profile = competitorIntentProfile(competitor, signals);
  const comparisonContext = battlecardComparisonForCompetitor(competitor);
  const broadEvidenceLinks = battlecardEvidenceLinks(competitor);
  const targetEvidenceLinks = pmmTargetCompetitorEvidenceSources(competitor, signals);
  const targeted = state.marketingTargeting.application !== "All" || state.marketingTargeting.buyingSituation !== "All";
  const evidenceLinks = targeted ? targetEvidenceLinks : broadEvidenceLinks;
  const targeting = pmmTargetingSelection();
  const baseCounterMessage = pmmUsableText(
    comparisonContext.comparison?.watersPositioning || profile?.response?.differentiate,
    "A counter-message is unresolved because the filtered evidence does not support one.",
  );
  const counterMessage = targeted
    ? `For ${pmmTargetingDisplayValue(targeting.application, "the selected workflow")}, adapt the governing workflow position to the observed ${competitor} emphasis; do not assert advantage until target-compatible proof and approval are established.`
    : baseCounterMessage;
  const basePositioning = pmmUsableText(
    profile?.likelyNext || profile?.intent || profile?.focus,
    "A positioning inference is unresolved for the active filters.",
  );
  const positioning = targeted
    ? targetEvidenceLinks.length
      ? `${competitor} appears to be emphasizing ${pmmTargetingDisplayValue(targeting.application, targeting.buyingSituation).toLowerCase()} in the matched public evidence. This is an analyst inference, not market-prevalence evidence.`
      : "A positioning inference is unresolved because no target-compatible competitor evidence is loaded."
    : basePositioning;
  const baseProofPoints = battlecardProofPoints(comparisonContext);
  const targetedWatersProof = pmmTargetWatersProofPoints();
  const proofPoints = targeted
    ? pmmDeduplicateSources([...baseProofPoints.filter((proof) => pmmTargetingMatches(proof)), ...targetedWatersProof])
    : baseProofPoints;
  return {
    competitor,
    profile,
    ...comparisonContext,
    evidenceLinks,
    targetEvidenceLinks,
    targetPriority: pmmCompetitorTargetPriority(targetEvidenceLinks),
    counterMessage,
    positioning,
    proofPoints,
  };
}

function marketingPrioritizedCompetitorContexts(signals = currentSignals()) {
  const targeted = state.marketingTargeting.application !== "All" || state.marketingTargeting.buyingSituation !== "All";
  return marketingActiveCompetitors()
    .map((competitor) => marketingCompetitorContext(competitor, signals))
    .filter((context) => !targeted || context.targetPriority.sourceCount > 0)
    .sort((left, right) => right.targetPriority.score - left.targetPriority.score
      || right.targetPriority.domains - left.targetPriority.domains
      || left.competitor.localeCompare(right.competitor));
}

function pmmEmptyState(message) {
  return `<div class="empty pmm-empty"><strong>Unresolved</strong><span>${escapeHtml(message)}</span></div>`;
}

function pmmEvidenceTypeMarkup(kind, label) {
  return `<span class="pmm-evidence-type pmm-evidence-type-${escapeHtml(kind)}">${escapeHtml(label)}</span>`;
}

function marketingAudienceOptionsForCompetitor(competitor) {
  const groups = new Map();
  currentCustomerVoiceItems()
    .filter((item) => item.company === competitor)
    .forEach((item) => {
      const audience = item.labType || "Audience unresolved";
      const buyerRole = item.userRole || "Buyer role unresolved";
      const criterion = item.buyingPriority || "Buying criterion unresolved";
      const key = `${audience}::${buyerRole}::${criterion}`;
      if (!groups.has(key)) groups.set(key, { audience, buyerRole, criterion, items: [] });
      groups.get(key).items.push(item);
    });
  return [...groups.values()]
    .map((group) => ({
      ...group,
      links: uniqueCustomerVoiceLinks(group.items, 4),
      confidence: averageConfidence(group.items),
      trigger: pmmUsableText(group.items[0]?.theme, "Buying trigger unresolved"),
    }))
    .sort((a, b) => b.links.length - a.links.length || b.confidence - a.confidence);
}

function pmmSourceHostname(source) {
  try {
    return new URL(source.url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return source.sourceName || "unresolved-source";
  }
}

function pmmDeduplicateSources(sources) {
  const seen = new Set();
  return sources.filter((source) => {
    if (!source || !isHttpUrl(source.url)) return false;
    const key = canonicalEvidenceUrl(source.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function marketingDecisionThemes(context) {
  const targeted = state.marketingTargeting.application !== "All" || state.marketingTargeting.buyingSituation !== "All";
  if (targeted) {
    return context.targetEvidenceLinks.slice(0, 4).map((source) => ({
      claim: pmmUsableText(source.detail, `${context.competitor} has published target-compatible ${source.evidenceType || "workflow"} evidence.`),
      label: pmmUsableText(source.label, "Target-compatible competitor evidence"),
      items: [{ ...source, title: source.label, url: source.url }],
    }));
  }
  const themes = competitorActivityThemes(context.profile)
    .map((theme) => ({
      claim: pmmUsableText(theme.insight || theme.title),
      label: pmmUsableText(theme.title, "Competitor narrative"),
      items: (theme.items || []).filter((item) => isHttpUrl(item.url)),
    }))
    .filter((theme) => theme.claim);
  if (themes.length) return themes;
  return context.evidenceLinks.slice(0, 4).map((source) => ({
    claim: pmmUsableText(context.positioning, "Competitor narrative unresolved for the active filters."),
    label: source.label || "Competitor narrative",
    items: [source],
  }));
}

function pmmMissingProof(context) {
  const evidenceSentences = String(context.comparison?.evidenceBasis || "")
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => /\bno\b|not loaded|not demonstrated|different test conditions|without/i.test(sentence));
  const limitation = (context.technicalProfile?.limitations || []).map((item) => pmmUsableText(item)).find(Boolean);
  return pmmUsableText(
    evidenceSentences[0] || limitation,
    "Proof gap unresolved — no controlled comparison or approval record is identified in the current data.",
  );
}

function pmmRecommendedActivation(context, index, hasEvidence) {
  if (!hasEvidence) return "Activation unresolved — exact supporting evidence is required before an action is proposed.";
  const configured = pmmListItems(context.comparison?.positioningMoves || [])
    .filter((item) => /battlecard|position|message|claim|proof|application note|enablement|quantif|package|test/i.test(item));
  return configured[index % Math.max(1, configured.length)]
    || "Create an internal sales-enablement brief that packages the proposed position, proof, proof gaps, and message-testing questions.";
}

function pmmIntendedChannel(activation, hasEvidence) {
  if (!hasEvidence) return "Channel unresolved";
  if (/application note|technical content/i.test(activation)) return "Technical content / application proof";
  if (/test|message|position/i.test(activation)) return "Internal message testing and sales enablement";
  return "Sales enablement";
}

function pmmMeaningfulWords(value) {
  const ignored = new Set(["about", "across", "against", "around", "from", "into", "only", "that", "their", "these", "this", "through", "under", "where", "which", "with", "workflow", "workflows", "waters"]);
  return new Set(String(value || "").toLowerCase().match(/[a-z0-9-]{4,}/g)?.filter((word) => !ignored.has(word)) || []);
}

function pmmWordOverlap(left, right) {
  const leftWords = pmmMeaningfulWords(left);
  const rightWords = pmmMeaningfulWords(right);
  return [...leftWords].filter((word) => rightWords.has(word)).length;
}

function pmmGoverningPosition(contexts, selectedSwingAttribute = "Swing attribute unresolved — no priority-segment scorecard is available") {
  const targeting = pmmTargetingSelection();
  const filteredCustomerRecords = pmmAppendixCustomerLanguageRecords();
  const proofRecords = contexts.flatMap((context) => context.proofPoints.map((proof) => ({
    url: proof.url,
    label: proof.label,
    sourceName: "Waters public source",
    detail: proof.detail,
    evidenceRole: "Observed Waters proof",
  })));
  const sourcePool = pmmDeduplicateSources([
    ...filteredCustomerRecords.map((record) => ({
      url: record.url,
      label: record.title,
      sourceName: record.sourceName,
      detail: record.description,
      date: record.date,
      confidence: record.confidence,
      evidenceRole: "Observed customer language",
    })),
    ...proofRecords,
  ]);
  const pillar = (name, statement, relevancePattern) => {
    const sources = sourcePool.filter((source) => relevancePattern.test(`${source.label} ${source.detail}`)).slice(0, 4);
    return {
      name,
      statement,
      sources,
      supportState: sources.length ? "Evidence located — substantiation and approval still required" : "Supporting proof not located",
    };
  };
  const selectedSegment = targeting.market === "All"
    ? "Priority segment unresolved — no approved segment selection"
    : `${targeting.market}${targeting.application !== "All" ? ` · ${targeting.application}` : ""} — active evidence filter, not an approved strategic priority`;
  const targetCustomer = targeting.buyerRole === "All"
    ? "Analytical laboratory buying committees responsible for regulated LC method execution and transfer"
    : `${targeting.buyerRole} within analytical laboratory buying committees responsible for regulated LC workflows`;
  const targetBuyingSituation = targeting.buyingSituation === "All"
    ? "Platform replacement, workflow modernization, or method-transfer evaluation where operational continuity and compliance risk shape the decision."
    : `${targeting.buyingSituation} — selected targeting hypothesis; direct prevalence and win/loss evidence are unavailable.`;
  const targetingAdaptation = `Proposed — not approved: adapt the governing workflow position for ${pmmTargetingDisplayValue(targeting.market, "all supported markets")} · ${pmmTargetingDisplayValue(targeting.application, "all supported applications")} · ${pmmTargetingDisplayValue(targeting.buyingSituation, "all buying situations")} · ${pmmTargetingDisplayValue(targeting.geography, "all geographies")} · ${pmmTargetingDisplayValue(targeting.buyerRole, "the full buying committee")}.`;
  return {
    id: "next-gen-lc-governing-position",
    targeting,
    targetingKey: pmmTargetingKey(targeting),
    targetingAdaptation,
    targetCustomer: targetCustomer,
    prioritySegment: selectedSegment,
    customerJob: "Execute reliable, transferable, compliant analytical workflows from method setup and transfer through routine operation and data review.",
    buyingSituation: targetBuyingSituation,
    referenceClass: "Liquid chromatography workflow platform for regulated analytical laboratories",
    primaryValueProposition: "Next Gen LC should help laboratories execute reliable, transferable, compliant analytical workflows—not merely compete on UHPLC hardware specifications.",
    pointOfParity: "Expected modern LC separation performance, pressure range, usability, connectivity, and serviceability required to enter a contemporary HPLC/UHPLC evaluation.",
    pointOfDifference: "Differentiate on reducing workflow risk across method transfer, reliable routine execution, compliant operation, and data review rather than asserting specification leadership alone.",
    selectedSwingAttribute,
    evidencePillars: [
      pillar("Reliable routine execution", "Evidence must connect uptime, diagnostics, serviceability, and reproducible operation to the customer workflow.", /reliab|uptime|diagnostic|service(?:ability)?|maintenance|reproducib/i),
      pillar("Transferable methods", "Evidence must show how methods and data move across systems without unsupported time, equivalency, or performance claims.", /method[- ]transfer|migration|compatib|method continuity|cross-platform/i),
      pillar("Compliant analytical workflows", "Evidence must support data integrity, traceability, validation, and regulated-workflow use without implying legal approval.", /compliance|compliant|regulated|validation|data integrity|traceab/i),
    ],
    exclusions: [
      "We are not claiming that this proposed position is approved Waters messaging.",
      "We are not claiming comparative hardware superiority without controlled, comparable substantiation.",
      "We are not claiming guaranteed uptime, faster method transfer, regulatory compliance outcomes, or customer performance without specific approved proof.",
    ],
    approvalState: "Proposed — not approved",
    approver: "Approver needed",
    lastReviewedDate: "Review date unavailable",
    evidenceClassification: "Analyst/rule-based inference grounded in filtered public evidence",
  };
}

function pmmGoverningTrace(governingPosition, localAdaptation) {
  const local = pmmUsableText(localAdaptation, "Local adaptation unresolved");
  const evaluation = PmmDataContract.evaluateGoverningAlignment(
    local,
    `${governingPosition.customerJob} ${governingPosition.primaryValueProposition} ${governingPosition.pointOfDifference} ${governingPosition.targetingAdaptation}`,
  );
  return { governingPositionId: governingPosition.id, localAdaptation: local, ...evaluation };
}

function pmmSuggestedCounterPosition(context, audience, governingPosition) {
  const criterion = String(audience?.criterion || "").toLowerCase();
  const targeted = state.marketingTargeting.application !== "All" || state.marketingTargeting.buyingSituation !== "All" || state.marketingTargeting.buyerRole !== "All";
  const response = targeted
    ? context.counterMessage
    : /cost|method transfer/.test(criterion)
      ? context.profile?.response?.differentiate
      : context.profile?.response?.defend;
  const localAdaptation = pmmUsableText(response, context.counterMessage);
  return {
    text: `${governingPosition.primaryValueProposition} ${governingPosition.targetingAdaptation} ${context.competitor} adaptation: ${localAdaptation}`,
    trace: pmmGoverningTrace(governingPosition, localAdaptation),
  };
}

function pmmRelevantProofPoints(context, audience, theme, counterPosition) {
  const relevanceText = `${audience?.criterion || ""} ${audience?.trigger || ""} ${theme?.claim || ""} ${counterPosition}`;
  return context.proofPoints.filter((proof) => pmmWordOverlap(`${proof.label} ${proof.detail}`, relevanceText) > 0);
}

function pmmDecisionRecency(sources) {
  const dated = sources
    .map((source) => source.date || source.sourceDate)
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date || ""))
    .sort((a, b) => new Date(b) - new Date(a));
  if (!dated.length) return { date: "", days: null, points: 0, label: "Recency unresolved" };
  const asOf = new Date(`${state.data?.asOfDate || dated[0]}T00:00:00`);
  const latest = new Date(`${dated[0]}T00:00:00`);
  const days = Math.max(0, Math.round((asOf - latest) / (1000 * 60 * 60 * 24)));
  const points = days <= 30 ? 20 : days <= 90 ? 15 : days <= 365 ? 10 : 4;
  return { date: dated[0], days, points, label: `${formatDate(dated[0])} · ${days} day${days === 1 ? "" : "s"} before data as-of` };
}

function pmmDecisionCandidate(context, audience, theme, index, governingPosition) {
  if (!audience && !theme) {
    return {
      competitor: context.competitor,
      audience: "Audience unresolved",
      buyerRole: "Buyer role unresolved",
      buyingCriterion: "Buying criterion unresolved",
      buyingTrigger: "Buying situation unresolved — no matching customer record",
      competitorClaim: "Competitor narrative unresolved for the active filters.",
      counterPosition: "Counter-position unresolved — matched audience and narrative evidence are required.",
      availableProof: [],
      missingProof: "Proof unresolved — no matched positioning decision is available.",
      activation: "Activation unresolved — exact supporting evidence is required before an action is proposed.",
      intendedChannel: "Channel unresolved",
      exactSources: [],
      confidence: 0,
      recency: { label: "Recency unresolved" },
      claimRepetition: 0,
      sourceDiversity: 0,
      customerCriteriaSources: 0,
      scoreFactors: { recency: 0, sourceDiversity: 0, repetition: 0, customerCriterion: 0, confidence: 0, proofGap: 0 },
      priorityScore: 0,
    };
  }
  const themeSources = (theme?.items || []).map((item) => ({
    url: item.url,
    label: item.title || theme.label,
    sourceName: item.sourceName || "Competitor public source",
    date: item.date || item.sourceDate,
    confidence: item.confidence,
    evidenceRole: "Competitor evidence",
  }));
  const customerSources = (audience?.links || []).map((link) => ({
    ...link,
    label: link.label || `${audience.audience} public customer record`,
    sourceName: "Exact public customer record",
    date: link.sourceDate,
    confidence: audience.confidence,
    evidenceRole: "Customer evidence",
  }));
  const counterPosition = pmmSuggestedCounterPosition(context, audience, governingPosition);
  const availableProof = pmmRelevantProofPoints(context, audience, theme, counterPosition.text);
  const proofSources = availableProof.map((proof) => ({
    url: proof.url,
    label: proof.label,
    sourceName: "Waters public source",
    detail: proof.detail,
    evidenceRole: "Waters proof",
  }));
  const fallbackCompetitorSources = themeSources.length || customerSources.length ? [] : context.evidenceLinks.slice(0, 3);
  const exactSources = pmmDeduplicateSources([
    ...themeSources,
    ...customerSources,
    ...fallbackCompetitorSources,
    ...proofSources,
  ]);
  const relevantConfidenceInputs = [
    ...(theme?.items || []),
    ...(audience?.items || []),
  ];
  const confidenceInputs = (relevantConfidenceInputs.length ? relevantConfidenceInputs : context.evidenceLinks)
    .filter((item) => Number.isFinite(Number(item.confidence)));
  const confidence = averageConfidence(confidenceInputs);
  const sourceDiversity = new Set(exactSources.map(pmmSourceHostname)).size;
  const claimRepetition = Math.max(0, theme?.items?.length || 0);
  const customerCriteriaSources = audience?.links?.length || 0;
  const recency = pmmDecisionRecency(exactSources);
  const missingProof = availableProof.length
    ? pmmMissingProof(context)
    : `No sourced Waters proof directly matches ${String(audience?.criterion || "the active buying criterion").toLowerCase()} in this filtered buying situation.`;
  const scoreFactors = {
    recency: recency.points,
    sourceDiversity: Math.min(3, sourceDiversity) * 6,
    repetition: Math.min(3, claimRepetition) * 5,
    customerCriterion: Math.min(3, customerCriteriaSources) * 5,
    confidence: Math.min(20, Math.round(confidence / 5)),
    proofGap: missingProof ? 8 : 0,
  };
  const priorityScore = Object.values(scoreFactors).reduce((total, value) => total + value, 0);
  const activation = pmmRecommendedActivation(context, index, exactSources.length > 0);
  return {
    competitor: context.competitor,
    audience: audience?.audience || "Audience unresolved",
    buyerRole: audience?.buyerRole || "Buyer role unresolved",
    audienceClassification: audience?.classification || (customerCriteriaSources ? "observed" : "inference"),
    buyingCriterion: audience?.criterion || "Buying criterion unresolved",
    buyingTrigger: audience?.trigger || "Buying situation unresolved — no matching customer record",
    competitorClaim: theme?.claim || "Competitor narrative unresolved for the active filters.",
    counterPosition: counterPosition.text,
    governingTrace: counterPosition.trace,
    availableProof,
    missingProof,
    activation,
    intendedChannel: pmmIntendedChannel(activation, exactSources.length > 0),
    exactSources,
    confidence,
    recency,
    claimRepetition,
    sourceDiversity,
    customerCriteriaSources,
    targetEvidenceEligible: audience?.classification === "inference" && themeSources.length > 0,
    scoreFactors,
    priorityScore,
  };
}

function marketingPositioningDecisionCandidates(contexts, governingPosition) {
  if (!contexts.length) return [];
  const targeting = pmmTargetingSelection();
  const candidates = contexts.flatMap((context) => {
    const audiences = marketingAudienceOptionsForCompetitor(context.competitor);
    const observedCandidates = audiences.map((audience, index) => pmmDecisionCandidate(context, { ...audience, classification: "observed" }, {
      claim: audience.trigger,
      label: `${audience.criterion} customer narrative`,
      items: audience.links.map((link) => ({
        ...link,
        title: link.label,
        sourceName: "Exact public customer record",
      })),
    }, index, governingPosition));
    if (observedCandidates.length || (targeting.application === "All" && targeting.buyingSituation === "All")) return observedCandidates;
    const inferredAudience = {
      audience: targeting.market === "All" ? "Audience unresolved" : targeting.market,
      buyerRole: pmmTargetedBuyerRole(),
      criterion: targeting.application === "All" ? "Buying criterion unresolved" : targeting.application,
      trigger: pmmTargetedBuyingSituation(`${targeting.application} workflow evaluation — buying situation requires validation`),
      links: [],
      items: [],
      confidence: 0,
      classification: "inference",
    };
    return marketingDecisionThemes(context).slice(0, 1).map((theme, index) => pmmDecisionCandidate(
      context,
      inferredAudience,
      theme,
      index,
      governingPosition,
    ));
  });
  const pool = contexts.length > 1
    ? contexts.map((context) => PmmDataContract.selectPositioningDecisions(
      candidates.filter((candidate) => candidate.competitor === context.competitor),
      1,
    )[0])
    : candidates;
  return PmmDataContract.selectPositioningDecisions(pool.filter(Boolean), 3);
}

function pmmDecisionSourceMarkup(source) {
  return `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer"><span>${escapeHtml(source.evidenceRole || source.evidenceType || "Observed evidence")}</span><strong>${escapeHtml(source.label || source.sourceName)}</strong><small>${escapeHtml(source.sourceName || "Public source")}${source.date ? ` · ${escapeHtml(formatDate(source.date))}` : " · Date unresolved"}</small></a>`;
}

function pmmChangeSummaryMarkup() {
  return `<aside class="pmm-change-summary" aria-label="What changed since the last refresh"><div><span>What Changed Since the Last Refresh</span><strong>Change detection unavailable</strong></div><p>The current refresh records completion time, but no comparable prior PMM positioning-decision snapshot is loaded. No delta is inferred.</p></aside>`;
}

function pmmGoverningPositionMarkup(position) {
  return `<article class="pmm-governing-position" data-governing-position-id="${escapeHtml(position.id)}" aria-labelledby="pmmGoverningPositionTitle">
    <header class="pmm-governing-header">
      <div><div class="pmm-eyebrow">Canonical PMM Object</div><h3 id="pmmGoverningPositionTitle">Governing Position</h3><p>Competitor narratives, counter-positions, claims, and activation assets inherit from this proposed position.</p></div>
      ${pmmEvidenceTypeMarkup("inference", position.approvalState)}
    </header>
    <dl class="pmm-governing-fields">
      <div><dt>Target customer</dt><dd>${escapeHtml(position.targetCustomer)}</dd></div>
      <div><dt>Priority segment</dt><dd>${escapeHtml(position.prioritySegment)}</dd></div>
      <div><dt>Customer job to be done</dt><dd>${escapeHtml(position.customerJob)}</dd></div>
      <div><dt>Buying situation or trigger</dt><dd>${escapeHtml(position.buyingSituation)}</dd></div>
      <div><dt>Reference class / category</dt><dd>${escapeHtml(position.referenceClass)}</dd></div>
      <div class="pmm-governing-target-adaptation"><dt>Hierarchical targeting adaptation</dt><dd>${escapeHtml(position.targetingAdaptation)}</dd></div>
      <div class="pmm-governing-value"><dt>Primary value proposition</dt><dd>${escapeHtml(position.primaryValueProposition)}</dd></div>
      <div class="pmm-governing-parity"><dt>Point of parity</dt><dd>${escapeHtml(position.pointOfParity)}</dd></div>
      <div class="pmm-governing-difference"><dt>Point of difference</dt><dd>${escapeHtml(position.pointOfDifference)}</dd></div>
      <div class="pmm-governing-swing"><dt>Selected swing attribute</dt><dd>${escapeHtml(position.selectedSwingAttribute)}</dd></div>
    </dl>
    <section class="pmm-governing-pillars" aria-labelledby="pmmEvidencePillarsTitle"><div><span>Evidence architecture</span><h4 id="pmmEvidencePillarsTitle">Three Evidence Pillars</h4></div><div>${position.evidencePillars.map((pillar, index) => `<article><span>Pillar ${index + 1}</span><strong>${escapeHtml(pillar.name)}</strong><p>${escapeHtml(pillar.statement)}</p><small>${escapeHtml(pillar.supportState)}</small>${pillar.sources.length ? `<div class="pmm-inline-links">${pillar.sources.map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.label)} ↗</a>`).join("")}</div>` : `<p class="pmm-unresolved">Supporting evidence link unavailable.</p>`}</article>`).join("")}</div></section>
    <section class="pmm-governing-exclusions"><span>Explicit exclusions — what we are not claiming</span><ul>${position.exclusions.map((exclusion) => `<li>${escapeHtml(exclusion)}</li>`).join("")}</ul></section>
    <div class="pmm-governing-governance" aria-label="Governing position approval and review state">
      ${pmmStatusMarkup("unresolved", "Approval state", position.approvalState)}
      ${pmmStatusMarkup("unresolved", "Approver", position.approver)}
      ${pmmStatusMarkup("unresolved", "Last reviewed", position.lastReviewedDate)}
      ${pmmStatusMarkup("inference", "Classification", position.evidenceClassification)}
    </div>
  </article>`;
}

function pmmGoverningTraceMarkup(position, trace) {
  const statusKind = trace.status === "aligned" ? "observed" : "unresolved";
  const statusLabel = trace.status === "contradiction" ? "Contradiction flagged" : trace.status === "unsupported" ? "Unsupported deviation" : "Aligned adaptation";
  return `<section class="pmm-governing-trace" data-governing-position-ref="${escapeHtml(trace.governingPositionId)}" data-alignment-status="${escapeHtml(trace.status)}">
    <div class="pmm-governing-trace-heading"><span>Governing Position Trace</span>${pmmEvidenceTypeMarkup("inference", position.approvalState)}</div>
    <dl><div><dt>Inherited customer / segment</dt><dd>${escapeHtml(position.targetCustomer)} · ${escapeHtml(position.prioritySegment)}</dd></div><div><dt>Inherited targeting adaptation</dt><dd>${escapeHtml(position.targetingAdaptation)}</dd></div><div><dt>Inherited job / category</dt><dd>${escapeHtml(position.customerJob)} · ${escapeHtml(position.referenceClass)}</dd></div><div><dt>Inherited value proposition</dt><dd>${escapeHtml(position.primaryValueProposition)}</dd></div><div><dt>Inherited point of parity</dt><dd>${escapeHtml(position.pointOfParity)}</dd></div><div><dt>Inherited point of difference</dt><dd>${escapeHtml(position.pointOfDifference)}</dd></div><div><dt>Local adaptation</dt><dd>${escapeHtml(trace.localAdaptation)}</dd></div></dl>
    <div class="pmm-governing-alignment pmm-governing-alignment-${escapeHtml(trace.status)}">${pmmStatusMarkup(statusKind, statusLabel, trace.message)}</div>
  </section>`;
}

function renderMarketingPositioningDecisions(decisions, governingPosition) {
  const target = byId("pmmPositioningDecisions");
  if (!decisions.length) {
    target.innerHTML = `${pmmGoverningPositionMarkup(governingPosition)}${pmmChangeSummaryMarkup()}${pmmEmptyState("No positioning decision can be supported by the active filters.")}`;
    return;
  }
  target.innerHTML = `
    ${pmmGoverningPositionMarkup(governingPosition)}
    ${pmmChangeSummaryMarkup()}
    <div class="pmm-decision-legend" aria-label="Evidence labels">${pmmEvidenceTypeMarkup("observed", "Observed evidence")}${pmmEvidenceTypeMarkup("inference", "Analyst/rule-based inference")}${pmmEvidenceTypeMarkup("unresolved", "Approved Waters claim — unresolved")}</div>
    <p class="pmm-priority-method" role="note">Priority combines recency, source diversity, repeated narrative evidence, customer buying-criterion evidence, confidence, and proof gaps. Raw record volume is not used as a standalone measure of commercial importance.</p>
    <div class="pmm-decision-grid">${decisions.map((decision, index) => `<article class="pmm-decision-card pmm-positioning-decision" data-positioning-rank="${index + 1}">
      <header class="pmm-decision-header">
        <div class="pmm-decision-rank" aria-label="Priority ${index + 1}">${index + 1}</div>
        <div><span>Positioning Decision · ${escapeHtml(decision.competitor)}</span><h4>${escapeHtml(decision.buyingCriterion)} for ${escapeHtml(decision.audience)}</h4></div>
        <div class="pmm-decision-score"><strong>${decision.priorityScore}</strong><span>priority score</span></div>
      </header>
      <div class="pmm-decision-question-grid">
        <section>
          <div class="pmm-question-heading"><b>1</b><span>Audience and Buying Situation</span>${pmmEvidenceTypeMarkup(decision.audienceClassification === "observed" ? "observed" : "inference", decision.audienceClassification === "observed" ? "Observed evidence" : "Analyst hypothesis · validation required")}</div>
          <dl><div><dt>Audience</dt><dd>${escapeHtml(decision.audience)}</dd></div><div><dt>Buyer role</dt><dd>${escapeHtml(decision.buyerRole)}</dd></div><div><dt>Situation / trigger</dt><dd>${escapeHtml(decision.buyingTrigger)}</dd></div></dl>
        </section>
        <section>
          <div class="pmm-question-heading"><b>2</b><span>Competitor Claim or Narrative</span>${pmmEvidenceTypeMarkup("inference", "Analyst/rule-based inference")}</div>
          <p>${escapeHtml(decision.competitorClaim)}</p>
          <small>${decision.claimRepetition ? `${decision.claimRepetition} matching public record${decision.claimRepetition === 1 ? "" : "s"} support this narrative grouping.` : "Claim repetition unresolved for the active filters."}</small>
        </section>
        <section>
          <div class="pmm-question-heading"><b>3</b><span>Suggested Waters Counter-position</span>${pmmEvidenceTypeMarkup("inference", "Proposed — not approved")}</div>
          <p>${escapeHtml(decision.counterPosition)}</p>
          ${pmmStatusMarkup("unresolved", "Approved Waters claim", "Unresolved — no approval record")}
        </section>
        <section>
          <div class="pmm-question-heading"><b>4</b><span>Proof and Substantiation</span>${pmmEvidenceTypeMarkup("observed", "Observed Waters sources")}</div>
          <div class="pmm-decision-proof"><div><strong>Applicable proof</strong>${decision.availableProof.length ? `<ul>${decision.availableProof.map((proof) => `<li><span>${escapeHtml(proof.detail)}</span>${isHttpUrl(proof.url) ? `<a href="${escapeHtml(proof.url)}" target="_blank" rel="noreferrer">${escapeHtml(proof.label)} ↗</a>` : ""}</li>`).join("")}</ul>` : `<p>Proof unresolved — no evidence passed the governed compatibility checks.</p>`}${decision.rejectedProof?.length ? `<p class="pmm-inapplicable-proof-note"><strong>${decision.rejectedProof.length} evidence record${decision.rejectedProof.length === 1 ? " was" : "s were"} blocked as Inapplicable.</strong> Review the Claims and Proof Readiness registry for dimension-level mismatches.</p>` : ""}</div><div class="pmm-missing-proof"><strong>Missing study or approval</strong><p>${escapeHtml(decision.missingProof)}</p></div></div>
        </section>
        <section>
          <div class="pmm-question-heading"><b>5</b><span>Activation Required</span>${pmmEvidenceTypeMarkup("inference", "Analyst recommendation")}</div>
          <p><strong>${escapeHtml(decision.activation)}</strong></p>
          <div class="pmm-activation-fields">
            ${pmmStatusMarkup("unresolved", "Owner", "Owner needed")}
            ${pmmStatusMarkup("unresolved", "Due date", "Deadline needed")}
            ${pmmStatusMarkup(decision.intendedChannel === "Channel unresolved" ? "unresolved" : "inference", "Intended channel", decision.intendedChannel)}
            ${pmmStatusMarkup("unresolved", "Success measure", "Measure needed")}
          </div>
        </section>
      </div>
      <div class="pmm-decision-evidence-footer">
        <div><span>Confidence and Recency</span><strong>${decision.confidence ? `${escapeHtml(confidenceLabel(decision.confidence))} · ${decision.confidence}/100` : "Confidence unresolved"}</strong><small>${escapeHtml(decision.recency.label)}</small></div>
        <div><span>Why This Ranked Here</span><p>Recency ${decision.scoreFactors.recency} · source-domain diversity ${decision.scoreFactors.sourceDiversity} · repetition ${decision.scoreFactors.repetition} · customer criterion ${decision.scoreFactors.customerCriterion} · confidence ${decision.scoreFactors.confidence} · proof gap ${decision.scoreFactors.proofGap}</p><small>${decision.sourceDiversity} source domain${decision.sourceDiversity === 1 ? "" : "s"}; ${decision.customerCriteriaSources} exact customer source URL${decision.customerCriteriaSources === 1 ? "" : "s"}.</small></div>
        <div class="pmm-decision-sources"><span>Exact Evidence Links</span>${decision.exactSources.length ? decision.exactSources.slice(0, 6).map(pmmDecisionSourceMarkup).join("") : `<p>Exact evidence links unavailable. Activation remains unresolved.</p>`}</div>
      </div>
      ${pmmGoverningTraceMarkup(governingPosition, decision.governingTrace)}
    </article>`).join("")}</div>`;
}

const pmmClaimEvidenceClassifications = {
  observed: "Observed customer or competitor language",
  inference: "Analyst/rule-based inference",
  approved: "Approved Waters claim",
};

const pmmClaimReadinessValues = ["Proven", "Directional", "Unsupported"];

function pmmObservedCustomerLanguage(item) {
  const language = String(item?.customerLanguageSignal || "").trim();
  const exactEvidence = /^Exact\b/i.test(item?.evidenceStatus || "");
  const usableLanguage = language && language.length <= 320 && !/^\ufeff|advertisement register log in/i.test(language);
  return exactEvidence && usableLanguage ? language : "";
}

function pmmClaimType(proposedWording, buyingCriterion) {
  const criterion = String(buyingCriterion || "").toLowerCase();
  if (/cost|tco|economic|price/.test(criterion)) return "economic";
  if (/ease|usability|setup|training/.test(criterion)) return "usability";
  if (/reliab|uptime|sensitivity|accuracy|precision|reproduc/.test(criterion)) return "performance";
  if (/compliance|compliant|data integrity|regulated|validation/.test(criterion)) return "compliance";
  if (/workflow|method transfer|migration|compatib/.test(criterion)) return "workflow";
  const text = String(proposedWording || "").toLowerCase();
  if (/cost|tco|economic|price|labor|downtime/.test(text)) return "economic";
  if (/compliance|compliant|data integrity|regulated|validation/.test(text)) return "compliance";
  if (/ease|easy|usability|setup|training|user/.test(text)) return "usability";
  if (/versus|comparative|superior|differentiat/.test(text)) return "comparative";
  if (/reliab|uptime|sensitivity|accuracy|precision|reproduc/.test(text)) return "performance";
  return "workflow";
}

function pmmClaimAttributeCodes(claimType, proposedWording, buyingCriterion) {
  const criterion = String(buyingCriterion || "").toLowerCase();
  if (/cost|tco|economic|price/.test(criterion)) return ["COST_TCO"];
  if (/ease|usability|setup|training/.test(criterion)) return ["USABILITY_SETUP"];
  if (/reliab|uptime/.test(criterion)) return ["LC_RELIABILITY"];
  if (/method transfer|migration|compatib/.test(criterion)) return ["METHOD_TRANSFER"];
  if (/compliance|compliant|data integrity|regulated|validation/.test(criterion)) return ["COMPLIANCE_CONTROL"];
  const text = String(proposedWording || "").toLowerCase();
  if (/cost|tco|economic|price/.test(text)) return ["COST_TCO"];
  if (/ease|usability|setup|training/.test(text)) return ["USABILITY_SETUP"];
  if (/method transfer|transferable|migration|compatib/.test(text)) return ["METHOD_TRANSFER"];
  if (/compliance|compliant|data integrity|regulated|validation/.test(text)) return ["COMPLIANCE_CONTROL"];
  if (/reliab|uptime|service lifecycle|serviceability/.test(text)) return ["LC_RELIABILITY"];
  if (/sensitivity|accuracy|precision|reproduc/.test(text)) return ["ANALYTICAL_PERFORMANCE"];
  return claimType === "workflow" ? ["WORKFLOW_EXECUTION"] : [claimType.toUpperCase()];
}

function pmmClaimCompatibilityProfile(row, governingPosition) {
  const segmentApplication = [row.audience, row.application]
    .filter((value) => value && !/unresolved|^All$/i.test(value));
  return {
    productWorkflow: ["LC_PLATFORM"],
    attributes: pmmClaimAttributeCodes(row.claimType, row.claimBasisWording || row.proposedClaimWording, row.buyingCriterion),
    segmentApplication,
    segment: row.audience && !/unresolved/i.test(row.audience) ? [row.audience] : [],
    application: row.application && row.application !== "All" ? [row.application] : [],
    comparator: row.referenceBaseline !== "Baseline unresolved" ? [row.referenceBaseline] : [],
    testConditions: ["CONTROLLED_COMPARISON"],
    asOfDate: state.data?.asOfDate,
    maxAgeDays: 1095,
    governingPositionId: governingPosition.id,
  };
}

function pmmEvidenceCompatibilityProfile(proof) {
  const text = `${proof.label || ""} ${proof.detail || ""} ${proof.url || ""}`.toLowerCase();
  const productWorkflow = /bioaccord|multi-attribute monitoring|\bmam\b/.test(text)
    ? ["BIOACCORD_MAM", "LCMS_WORKFLOW"]
    : /xevo tq absolute/.test(text)
      ? ["XEVO_TQ_ABSOLUTE", "LCMSMS_WORKFLOW"]
      : /about[\/-]waters|about waters|company profile|corporate/.test(text)
        ? ["CORPORATE_PROFILE"]
        : /acquity|alliance|arc premier|hplc|uhplc|liquid chromatography/.test(text)
          ? ["LC_PLATFORM"]
          : [];
  const attributes = [
    /cost|tco|price|economic/.test(text) ? "COST_TCO" : "",
    /ease|usability|setup|training/.test(text) ? "USABILITY_SETUP" : "",
    /method transfer|migration|compatib/.test(text) ? "METHOD_TRANSFER" : "",
    /compliance|compliant|data integrity|regulated|validation/.test(text) ? "COMPLIANCE_CONTROL" : "",
    /reliab|uptime|service lifecycle|serviceability/.test(text) ? "LC_RELIABILITY" : "",
    /sensitivity|accuracy|precision|reproduc/.test(text) ? "ANALYTICAL_PERFORMANCE" : "",
  ].filter(Boolean);
  const segment = [
    /biopharma|biopharmaceutical|multi-attribute|\bmam\b/.test(text) ? "Biopharma" : "",
    /environmental|\bpfas\b/.test(text) ? "Environmental" : "",
    /clinical|therapeutic monitoring/.test(text) ? "Clinical" : "",
    /food safety|food testing|food matrices/.test(text) ? "Food & Beverage" : "",
    /\bpharma\b|pharmaceutical/.test(text) && !/biopharma|biopharmaceutical/.test(text) ? "Pharma" : "",
  ].filter(Boolean);
  const application = [
    /multi-attribute|\bmam\b/.test(text) ? "MAM" : "",
    /oligo(?:nucleotide)?|anti-sense|\baso\b/.test(text) ? "Oligo" : "",
    /\blnp\b|lipid nanoparticle|\brna\b|mrna/.test(text) ? "LNP/RNA" : "",
    /protein characterization|intact protein|peptide mapping|proteomics|glycan/.test(text) ? "Protein characterization" : "",
    /\bpfas\b|per- and polyfluoroalkyl|tfa|ultrashort-chain/.test(text) ? "PFAS" : "",
    /nitrosamine|ndma|n-nitroso/.test(text) ? "Nitrosamines" : "",
    /routine qc|quality control|system suitability|batch review/.test(text) ? "Routine QC" : "",
  ].filter(Boolean);
  const segmentApplication = [...segment, ...application];
  const comparator = marketingBattlecardCompetitors.filter((competitor) => text.includes(competitor.toLowerCase()));
  const testConditions = /same sample|same method|controlled|head-to-head|identical conditions|matched conditions/.test(text)
    ? ["CONTROLLED_COMPARISON"]
    : /launch|press release|newsroom/.test(text)
      ? ["LAUNCH_ANNOUNCEMENT"]
      : /about[\/-]waters|about waters|company profile|corporate/.test(text)
        ? ["CORPORATE_DESCRIPTION"]
        : [];
  return { productWorkflow, attributes, segmentApplication, segment, application, comparator, testConditions, date: proof.date || "" };
}

function pmmClaimNextRequiredAction(row) {
  const segment = row.audience === "Audience unresolved" ? "the intended segment" : row.audience;
  const comparator = row.referenceBaseline === "Baseline unresolved" ? "the stated baseline" : row.referenceBaseline;
  const approval = "Then obtain documented claims/legal approval, approved wording, an owner, and an expiration date.";
  if (row.claimType === "economic") return `Commission a comparative TCO study for ${segment} LC against ${comparator}, with acquisition, service, consumables, labor, downtime, utilization, geography, currency, and analysis horizon held explicit. ${approval}`;
  if (row.claimType === "usability") return `Run a controlled ${segment} LC usability study against ${comparator}, measuring setup steps, training time, task completion, error recovery, and regulated-workflow controls under the same protocol. ${approval}`;
  if (row.claimType === "compliance") return `Run a validated ${segment} LC workflow study against ${comparator}, documenting data-integrity controls, audit trail behavior, traceability, deviations, and validation conditions. ${approval}`;
  if (row.claimType === "performance") return `Run a controlled ${segment} LC reliability study against ${comparator} under matched method, workload, environment, maintenance, and observation periods; capture uptime, failures, recovery, transfer results, and data-integrity controls. ${approval}`;
  return `Run a controlled ${segment} LC workflow study against ${comparator} using matched products, methods, attributes, test conditions, and decision criteria. ${approval}`;
}

function pmmClaimRow(context, audience, theme, governingPosition, item = null, index = 0) {
  const targeting = pmmTargetingSelection();
  const audienceName = audience?.audience || (targeting.market === "All" ? "Audience unresolved" : targeting.market);
  const buyerRole = audience?.buyerRole || pmmTargetedBuyerRole();
  const buyingCriterion = audience?.criterion || (targeting.application === "All" ? "Buying criterion unresolved" : targeting.application);
  const observedLanguage = pmmObservedCustomerLanguage(item);
  const evidenceClassification = observedLanguage ? "observed" : "inference";
  const claim = observedLanguage || pmmUsableText(
    item?.theme || theme?.claim,
    "Claim unresolved — no supported language matches the active filters.",
  );
  const claimItems = audience?.links?.length
    ? audience.links.map((link) => ({ ...link, title: link.label, sourceName: "Exact public customer record" }))
    : (theme?.items || []);
  const candidate = pmmDecisionCandidate(context, audience, { claim, label: theme?.label || `${audience?.criterion || "Claim"} evidence`, items: claimItems }, index, governingPosition);
  const claimSources = pmmDeduplicateSources(claimItems.map((source) => ({
    url: source.url,
    label: source.title || source.label || "Claim source",
    sourceName: source.sourceName || "Public source",
    date: source.date || source.sourceDate,
    confidence: source.confidence || audience?.confidence,
    evidenceRole: evidenceClassification === "observed" ? "Observed language" : "Inference basis",
  })));
  const approvalEstablished = false;
  const proposedClaimWording = candidate.counterPosition;
  const claimBasisWording = candidate.governingTrace.localAdaptation;
  const claimType = pmmClaimType(claimBasisWording, buyingCriterion);
  const referenceBaseline = context.competitor || "Baseline unresolved";
  const rowForCompatibility = {
    claimType,
    proposedClaimWording,
    claimBasisWording,
    buyingCriterion,
    audience: audienceName,
    application: targeting.application,
    referenceBaseline,
  };
  const claimProfile = pmmClaimCompatibilityProfile(rowForCompatibility, governingPosition);
  const evidenceRecords = pmmDeduplicateSources(candidate.availableProof).map((proof) => ({
    ...proof,
    compatibility: PmmDataContract.evaluateClaimEvidenceCompatibility(claimProfile, pmmEvidenceCompatibilityProfile(proof)),
    independent: false,
    sourceOrganizationId: "",
  }));
  const substantiation = PmmDataContract.claimSubstantiation(evidenceRecords);
  const comparabilityStatus = evidenceRecords.some((proof) => proof.compatibility.status === "Applicable")
    ? "Applicable"
    : evidenceRecords.some((proof) => proof.compatibility.status === "Partially applicable")
      ? "Partially applicable"
      : "Inapplicable";
  const readiness = PmmDataContract.claimCommercialReadiness(substantiation.status, approvalEstablished);
  const sentiment = item?.sentiment || "Not classified";
  const concernRecord = /negative|neutral|mixed/i.test(sentiment);
  const caveat = concernRecord
    ? `${sentiment} customer record — treat as a customer concern or comparison criterion, never as a competitor strength.`
    : evidenceClassification === "observed"
      ? "Exact public customer language; one record does not establish market prevalence or comparative performance."
      : "Narrative synthesized from public records; not a verbatim customer statement or approved Waters claim.";
  return {
    competitor: context.competitor,
    claim,
    evidenceClassification,
    classificationLabel: pmmClaimEvidenceClassifications[evidenceClassification],
    audience: audienceName,
    buyerRole,
    buyingCriterion,
    counterPosition: proposedClaimWording,
    proposedClaimWording,
    claimType,
    application: targeting.application,
    buyingSituation: targeting.buyingSituation,
    geography: targeting.geography,
    segmentApplication: `${audienceName} · ${pmmTargetingDisplayValue(targeting.application, buyingCriterion)}`,
    intendedChannel: candidate.intendedChannel,
    referenceBaseline,
    governingTrace: candidate.governingTrace,
    availableProof: evidenceRecords,
    evidenceRecords,
    uniqueRecordCount: evidenceRecords.length,
    independentSourceCount: substantiation.independentSourceCount,
    independentSourceState: substantiation.independentSourceCount ? `${substantiation.independentSourceCount} established independent source organization${substantiation.independentSourceCount === 1 ? "" : "s"}` : "0 established independent source organizations — independence metadata unavailable",
    comparabilityStatus,
    substantiationStatus: substantiation.status,
    substantiationReason: substantiation.reason,
    missingProof: candidate.missingProof,
    approvalState: "Approval not established",
    approvalEstablished,
    approvedWording: "Approved wording unavailable — no approval record",
    owner: "Owner needed",
    expirationDate: "Expiration date needed",
    readiness,
    confidence: candidate.confidence,
    recency: candidate.recency,
    sourceDiversity: candidate.sourceDiversity,
    claimSources,
    sources: pmmDeduplicateSources([...claimSources, ...candidate.exactSources]),
    caveat,
    sentiment,
    concernRecord,
    nextRequiredAction: pmmClaimNextRequiredAction(rowForCompatibility),
  };
}

function marketingClaimsProofRows(contexts, governingPosition) {
  const targeting = pmmTargetingSelection();
  return contexts.flatMap((context) => {
    const audiences = marketingAudienceOptionsForCompetitor(context.competitor);
    const themes = marketingDecisionThemes(context);
    const customerRows = audiences.map((audience, index) => {
      const item = audience.items.find((entry) => pmmObservedCustomerLanguage(entry)) || audience.items[0];
      return pmmClaimRow(context, audience, {
        claim: audience.trigger,
        label: `${audience.criterion} customer evidence`,
        items: audience.links,
      }, governingPosition, item, index);
    });
    const inferredAudience = targeting.application !== "All" || targeting.buyingSituation !== "All" || targeting.buyerRole !== "All"
      ? {
        audience: targeting.market === "All" ? "Audience unresolved" : targeting.market,
        buyerRole: pmmTargetedBuyerRole(),
        criterion: targeting.application === "All" ? "Buying criterion unresolved" : targeting.application,
        trigger: pmmTargetedBuyingSituation(`${targeting.application} workflow evaluation — validation required`),
        links: [],
        items: [],
        confidence: 0,
        classification: "inference",
      }
      : null;
    const inferenceRows = themes.slice(0, 2).map((theme, index) => pmmClaimRow(context, inferredAudience, theme, governingPosition, null, customerRows.length + index));
    return [...customerRows, ...inferenceRows];
  });
}

function pmmApplyClaimsRegistryToDecisions(decisions, claimRows) {
  return decisions.map((decision) => {
    const governedClaim = claimRows.find((row) => row.competitor === decision.competitor
      && row.audience === decision.audience
      && row.buyingCriterion === decision.buyingCriterion);
    if (!governedClaim) return {
      ...decision,
      availableProof: [],
      rejectedProof: decision.availableProof,
      missingProof: "No governed claim registry row matches this positioning decision. Compatibility review is required before proof or activation.",
      claimRegistry: null,
    };
    const acceptedProof = governedClaim.evidenceRecords.filter((proof) => proof.compatibility.status === "Applicable");
    const rejectedProof = governedClaim.evidenceRecords.filter((proof) => proof.compatibility.status === "Inapplicable");
    const rejectedUrls = new Set(rejectedProof.map((proof) => canonicalEvidenceUrl(proof.url)));
    return {
      ...decision,
      availableProof: acceptedProof,
      rejectedProof,
      exactSources: decision.exactSources.filter((source) => !rejectedUrls.has(canonicalEvidenceUrl(source.url))),
      missingProof: governedClaim.nextRequiredAction,
      claimRegistry: {
        substantiationStatus: governedClaim.substantiationStatus,
        comparabilityStatus: governedClaim.comparabilityStatus,
        approvalState: governedClaim.approvalState,
        readiness: governedClaim.readiness.value,
      },
    };
  });
}

function pmmClaimsFilterOptions(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function pmmClaimsFilterMarkup(label, key, values, allLabel) {
  const selected = state.marketingClaimsFilters[key];
  return `<label>${escapeHtml(label)}<select data-pmm-claims-filter="${escapeHtml(key)}"><option value="All">${escapeHtml(allLabel)}</option>${values.map((value) => `<option value="${escapeHtml(value)}" ${selected === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>`;
}

function pmmClaimSourceLinksMarkup(sources, limit = 4) {
  if (!sources.length) return `<p class="pmm-matrix-empty-value">Sources unavailable.</p>`;
  return `<div class="pmm-claim-source-links">${sources.slice(0, limit).map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer"><strong>${escapeHtml(source.label || source.sourceName)}</strong><small>${escapeHtml(source.sourceName || "Public source")} · ${source.date ? escapeHtml(formatDate(source.date)) : "Date unavailable"}</small></a>`).join("")}</div>`;
}

function pmmCompatibilityCheckMarkup(check) {
  const tone = check.status === "Match" ? "match" : check.status === "Mismatch" ? "mismatch" : "missing";
  const expected = check.expected.length ? check.expected.join(", ") : "Not required";
  const observed = check.observed.length ? check.observed.join(", ") : "Not established";
  return `<li class="pmm-compatibility-${tone}"><strong>${escapeHtml(check.label)} · ${escapeHtml(check.status)}</strong><small>Required: ${escapeHtml(expected)} · Evidence: ${escapeHtml(observed)}</small></li>`;
}

function pmmClaimEvidenceRegistryMarkup(records) {
  if (!records.length) return `<div class="pmm-missing-indicator"><strong>Unsupported</strong><span>No exact supporting evidence record was located.</span></div>`;
  return `<div class="pmm-registry-evidence-list">${records.map((proof) => {
    const className = proof.compatibility.status.toLowerCase().replace(/\s+/g, "-");
    return `<article class="pmm-registry-evidence pmm-comparability-${escapeHtml(className)}" data-evidence-comparability="${escapeHtml(proof.compatibility.status)}"><header><strong>${escapeHtml(proof.label)}</strong><span>${escapeHtml(proof.compatibility.status)}</span></header><p>${escapeHtml(proof.detail)}</p>${isHttpUrl(proof.url) ? `<a href="${escapeHtml(proof.url)}" target="_blank" rel="noreferrer">Open exact evidence ↗</a>` : `<small>Source unavailable</small>`}<ul>${proof.compatibility.checks.map(pmmCompatibilityCheckMarkup).join("")}</ul></article>`;
  }).join("")}</div>`;
}

function pmmClaimSubstantiationMarkup(row) {
  const className = row.substantiationStatus.toLowerCase();
  return `<div class="pmm-readiness pmm-substantiation-${escapeHtml(className)}"><strong>${escapeHtml(row.substantiationStatus)}</strong><span>${escapeHtml(row.substantiationReason)}</span><small>Commercial readiness: ${escapeHtml(row.readiness.value)} · ${escapeHtml(row.readiness.reason)}</small></div>`;
}

function marketingVisibleClaimRows(rows) {
  return PmmDataContract.filterClaimRows(rows, state.marketingClaimsFilters);
}

function renderMarketingClaimsProof(rows, visibleRows, governingPosition) {
  const target = byId("pmmClaimsProof");
  const audiences = pmmClaimsFilterOptions(rows.map((row) => ({ ...row, audienceCriterion: `${row.audience} · ${row.buyingCriterion}` })), "audienceCriterion");
  const classifications = Object.values(pmmClaimEvidenceClassifications);
  if (state.marketingClaimsFilters.audience !== "All" && !audiences.includes(state.marketingClaimsFilters.audience)) {
    state.marketingClaimsFilters.audience = "All";
  }
  if (state.marketingClaimsFilters.classification !== "All" && !classifications.includes(state.marketingClaimsFilters.classification)) {
    state.marketingClaimsFilters.classification = "All";
  }
  if (state.marketingClaimsFilters.readiness !== "All" && !pmmClaimReadinessValues.includes(state.marketingClaimsFilters.readiness)) {
    state.marketingClaimsFilters.readiness = "All";
  }
  target.innerHTML = `
    <div class="pmm-claims-matrix-intro">
      <div><strong>Governed claims registry for regulated-lab commercialization.</strong><p>Every proposed wording is compatibility-checked across product/workflow, attribute, segment/application, comparator, test conditions, and date/relevance. Inapplicable evidence is blocked from substantiation. No approval records are loaded, so no claim can be Ready.</p></div>
      <div class="pmm-decision-legend" aria-label="Claims evidence classifications">${pmmEvidenceTypeMarkup("observed", pmmClaimEvidenceClassifications.observed)}${pmmEvidenceTypeMarkup("inference", pmmClaimEvidenceClassifications.inference)}${pmmEvidenceTypeMarkup("approval", pmmClaimEvidenceClassifications.approved)}</div>
    </div>
    <form class="pmm-claims-filters" aria-label="Filter governed claims registry">
      ${pmmClaimsFilterMarkup("Substantiation", "readiness", pmmClaimReadinessValues, "All substantiation states")}
      ${pmmClaimsFilterMarkup("Audience / buying criterion", "audience", audiences, "All audiences and criteria")}
      ${pmmClaimsFilterMarkup("Evidence classification", "classification", classifications, "All evidence classifications")}
      <button type="button" data-pmm-claims-clear>Clear matrix filters</button>
      <p>Competitor filtering uses the global Competitor filter above.</p>
    </form>
    <div class="pmm-claims-result-count" aria-live="polite">${visibleRows.length} of ${rows.length} claim${rows.length === 1 ? "" : "s"}</div>
    ${visibleRows.length ? `<div class="pmm-claims-table-wrap"><table class="pmm-claims-matrix pmm-claims-registry"><caption class="sr-only">Governed Product Marketing claims registry</caption><thead><tr><th>Exact proposed claim wording</th><th>Type</th><th>Segment / application</th><th>Buyer / channel</th><th>Reference competitor or baseline</th><th>Exact supporting evidence and compatibility</th><th>Source counts</th><th>Evidence comparability</th><th>Substantiation</th><th>Legal / claims approval</th><th>Governance and next action</th></tr></thead><tbody>${visibleRows.map((row) => `<tr data-claim-context="${escapeHtml(`${row.buyingCriterion} for ${row.audience}`)}" data-claim-readiness="${escapeHtml(row.readiness.value)}" data-substantiation-status="${escapeHtml(row.substantiationStatus)}" data-evidence-comparability="${escapeHtml(row.comparabilityStatus)}" data-claim-classification="${escapeHtml(pmmClaimEvidenceClassifications[row.evidenceClassification])}">
      <td><div class="pmm-registry-claim-wording"><span>Exact proposed wording</span><p>${escapeHtml(row.proposedClaimWording)}</p>${pmmEvidenceTypeMarkup("inference", "Proposed — not approved")}<small>Registry context: ${escapeHtml(row.buyingCriterion)} for ${escapeHtml(row.audience)} · Inherits ${escapeHtml(governingPosition.id)}</small></div></td>
      <td><strong class="pmm-claim-type">${escapeHtml(row.claimType)}</strong></td>
      <td><strong>${escapeHtml(row.segmentApplication)}</strong><small>${escapeHtml(row.caveat)}</small></td>
      <td><strong>${escapeHtml(row.buyerRole)}</strong><span>${escapeHtml(row.intendedChannel)}</span></td>
      <td><strong>${escapeHtml(row.referenceBaseline)}</strong><small>Competitor-specific comparison baseline; equivalence must be demonstrated.</small></td>
      <td>${pmmClaimEvidenceRegistryMarkup(row.evidenceRecords)}</td>
      <td><strong>${row.uniqueRecordCount} unique evidence record${row.uniqueRecordCount === 1 ? "" : "s"}</strong><span>${escapeHtml(row.independentSourceState)}</span><small>Unique URLs are not treated as independent organizations.</small></td>
      <td><div class="pmm-comparability-summary pmm-comparability-${escapeHtml(row.comparabilityStatus.toLowerCase().replace(/\s+/g, "-"))}"><strong>${escapeHtml(row.comparabilityStatus)}</strong><span>${row.evidenceRecords.length ? "Automated checks shown with each evidence record." : "No evidence available for compatibility review."}</span></div></td>
      <td>${pmmClaimSubstantiationMarkup(row)}</td>
      <td>${pmmStatusMarkup("unresolved", "Legal / claims approval", row.approvalState)}<div class="pmm-approved-wording"><span>Approved wording</span><strong>${escapeHtml(row.approvedWording)}</strong></div></td>
      <td><div class="pmm-registry-governance">${pmmStatusMarkup("unresolved", "Owner", row.owner)}${pmmStatusMarkup("unresolved", "Expiration", row.expirationDate)}<div class="pmm-next-required-action"><span>Next required action</span><p>${escapeHtml(row.nextRequiredAction)}</p></div></div></td>
    </tr>`).join("")}</tbody></table></div>` : pmmEmptyState(rows.length ? "No claims match the matrix filters. Clear a matrix filter or adjust the global filters." : "No supported claims match the active global filters. Unrelated evidence was not substituted.")}`;
}

const pmmBuyingCommitteeRoleDefinitions = [
  {
    key: "bench-user",
    label: "Bench user / analyst",
    match: /\banalyst\b|instrument specialist/i,
    decisionPower: "user",
    job: "Execute routine methods, recognize failures, recover quickly, and complete data review without avoidable rework.",
    concern: "Daily usability, reliability, troubleshooting burden, training, and workflow handoffs.",
    message: "Make reliable routine execution and faster issue isolation concrete in the user's actual method and software workflow.",
    proof: "Task-based workflow study measuring setup steps, task completion, error recovery, repeat runs, and review effort.",
    asset: "Workflow demo · application note · operator quick guide",
  },
  {
    key: "method-developer",
    label: "Method developer",
    match: /method developer/i,
    decisionPower: "influencer",
    job: "Develop, transfer, optimize, and troubleshoot methods across instruments, sites, and applications.",
    concern: "Method equivalency, transfer effort, robustness, flexibility, and the cost of redevelopment.",
    message: "Position Next Gen LC around transferable methods with explicit equivalency boundaries and migration support.",
    proof: "Controlled cross-platform method-transfer study with matched conditions, acceptance criteria, failures, and remediation effort.",
    asset: "Method-transfer guide · comparative application note · technical workshop",
  },
  {
    key: "quality-veto",
    label: "QC/QA or validation veto",
    match: /QA|QC|quality|compliance|validation/i,
    decisionPower: "veto",
    job: "Protect validated operation, audit readiness, data integrity, and controlled change.",
    concern: "Validation burden, traceability, audit trails, procedural control, and unsupported compliance claims.",
    message: "Show how the workflow supports controlled, traceable operation without promising regulatory outcomes.",
    proof: "Validation package review, audit-trail and data-integrity assessment, change-control mapping, and regulated-user evidence.",
    asset: "Validation dossier · compliance brief · QA review session",
  },
  {
    key: "it-veto",
    label: "IT / data-integrity veto",
    match: /\bIT\b|informatics|data integrity|CDS administrator|system administrator/i,
    decisionPower: "veto",
    job: "Maintain secure, supportable data flows, system integration, access control, and lifecycle governance.",
    concern: "Integration architecture, cybersecurity, identity and access, auditability, support model, and upgrade impact.",
    message: "Package the instrument and informatics path as one governed data workflow with explicit integration and lifecycle boundaries.",
    proof: "Architecture and security review, interface validation, access-control testing, audit-trail assessment, and lifecycle-support evidence.",
    asset: "IT architecture brief · data-integrity checklist · technical review",
  },
  {
    key: "lab-manager",
    label: "Lab-manager decision maker",
    match: /lab manager|laboratory manager|manager/i,
    decisionPower: "decider",
    job: "Deliver laboratory capacity, quality, uptime, staffing readiness, and service continuity.",
    concern: "Operational risk, uptime, training, service response, utilization, and migration disruption.",
    message: "Frame the decision around reliable throughput and lower workflow risk across implementation and routine use.",
    proof: "Reference workflow, uptime and recovery study, implementation plan, training evidence, and service-level documentation.",
    asset: "Decision brief · customer proof · sales deck",
  },
  {
    key: "economic-buyer",
    label: "Procurement / economic buyer",
    match: /procurement|purchasing|economic buyer/i,
    decisionPower: "buyer",
    job: "Establish commercial comparability, contract terms, lifecycle cost, and purchase defensibility.",
    concern: "Acquisition cost, consumables, service, labor, downtime, contract risk, and economic comparability.",
    message: "Use a transparent lifecycle-value case; do not imply TCO advantage without a controlled economic model.",
    proof: "Segment-specific comparative TCO model with price, service, consumables, labor, downtime, utilization, geography, and time horizon.",
    asset: "Economic value brief · procurement worksheet · commercial proposal",
  },
  {
    key: "executive-sponsor",
    label: "Executive sponsor — where relevant",
    match: /executive|director|vice president|\bVP\b|sponsor/i,
    decisionPower: "decider",
    job: "Sponsor material capital or transformation decisions and ensure alignment with quality, capacity, and business priorities.",
    concern: "Business continuity, strategic fit, implementation exposure, organization-wide adoption, and measurable outcomes.",
    message: "Connect the workflow position to a bounded business outcome and implementation risk; keep performance claims substantiated.",
    proof: "Approved business case, executive reference, implementation-risk plan, and agreed outcome measurement.",
    asset: "Executive brief · business case · sponsor review",
  },
];

const pmmFishbeinAttributes = [
  { key: "reliability", label: "Reliable routine execution", pattern: /reliab|uptime|service|maintenance|diagnostic|reproduc/i },
  { key: "ease", label: "Ease of use and recovery", pattern: /ease|usability|setup|training|troubleshoot|recovery/i },
  { key: "transfer", label: "Method transfer and continuity", pattern: /method transfer|continuity|migration|compatib|validated method/i },
  { key: "compliance", label: "Compliance and data integrity", pattern: /compliance|data integrity|audit|validation|regulated|traceab/i },
  { key: "throughput", label: "Throughput and review efficiency", pattern: /throughput|review|automation|cycle time|capacity|sample/i },
  { key: "economics", label: "Lifecycle economics", pattern: /cost|price|economic|TCO|consumable|downtime|labor/i },
];

function pmmFishbeinHypothesisWeights(segment, targeting = pmmTargetingSelection()) {
  const profiles = {
    Pharma: [20, 15, 20, 20, 15, 10],
    Biopharma: [20, 15, 20, 15, 20, 10],
    Clinical: [20, 20, 10, 20, 20, 10],
    "Food safety": [20, 15, 10, 15, 20, 20],
    Environmental: [20, 15, 10, 20, 20, 15],
    "CRO/CDMO": [20, 15, 20, 15, 20, 10],
    Academic: [20, 20, 10, 10, 20, 20],
    Government: [20, 15, 15, 20, 15, 15],
  };
  const base = [...(profiles[segment] || [17, 17, 17, 17, 16, 16])];
  const applicationAdjustments = {
    MAM: [0, -5, 8, 12, 2, -5],
    Oligo: [-5, -5, 12, 5, 2, -4],
    "LNP/RNA": [-2, 0, 8, 3, 6, -4],
    "Protein characterization": [-3, 0, 0, -3, 12, -6],
    PFAS: [10, -5, -5, 8, 2, -10],
    Nitrosamines: [2, -5, -5, 8, 8, -8],
    "Routine QC": [6, 5, 2, 6, -4, -5],
  };
  const situationAdjustments = {
    Greenfield: [0, 5, -5, 0, 4, 6],
    "Competitive replacement": [6, 2, 2, 0, 2, 3],
    "Waters installed-base upgrade": [3, 2, 8, 2, 0, 5],
    "Validated-method migration": [4, -4, 15, 8, -4, -2],
  };
  const roleAdjustments = {
    "Bench user / analyst": [4, 10, 0, 0, 4, -4],
    "Method developer": [0, 0, 12, 2, 2, -4],
    "QC/QA or validation veto": [2, -3, 5, 12, -3, -3],
    "IT / data-integrity veto": [0, -2, 0, 14, -4, -3],
    "Lab-manager decision maker": [7, 2, 0, 2, 5, 5],
    "Procurement / economic buyer": [0, -3, -3, 0, -3, 18],
    "Executive sponsor": [4, -3, 0, 2, 4, 10],
  };
  [applicationAdjustments[targeting.application], situationAdjustments[targeting.buyingSituation], roleAdjustments[targeting.buyerRole]]
    .filter(Boolean)
    .forEach((adjustment) => adjustment.forEach((value, index) => { base[index] += value; }));
  return base.map((value) => Math.max(1, value));
}

function pmmFishbeinHypothesisScores(competitor) {
  const waters = { reliability: 3, ease: 3, transfer: 4, compliance: 4, throughput: 3, economics: 3 };
  const rivals = {
    Agilent: { reliability: 4, ease: 4, transfer: 3, compliance: 3, throughput: 4, economics: 2 },
    "Thermo Fisher": { reliability: 4, ease: 3, transfer: 3, compliance: 4, throughput: 4, economics: 2 },
    Shimadzu: { reliability: 4, ease: 3, transfer: 3, compliance: 3, throughput: 3, economics: 4 },
    SCIEX: { reliability: 3, ease: 4, transfer: 2, compliance: 3, throughput: 4, economics: 3 },
    PerkinElmer: { reliability: 3, ease: 3, transfer: 3, compliance: 3, throughput: 3, economics: 3 },
  };
  return { waters, competitor: rivals[competitor] || Object.fromEntries(pmmFishbeinAttributes.map((attribute) => [attribute.key, 3])) };
}

function pmmCommitteePrioritySegments(positioningDecisions) {
  const seen = new Set();
  return positioningDecisions.filter((decision) => {
    const segment = String(decision.audience || "").trim();
    if (!segment || /unresolved/i.test(segment) || seen.has(segment)) return false;
    seen.add(segment);
    return true;
  }).map((decision) => ({
    segment: decision.audience,
    competitor: decision.competitor,
    buyingCriterion: decision.buyingCriterion,
    decision,
  }));
}

function pmmCommitteeEvidenceSources(items, limit = 5) {
  return uniqueCustomerVoiceLinks(items, limit).map((link) => ({
    url: link.url,
    label: link.label,
    date: link.sourceDate,
    sourceName: "Exact public customer record",
    confidence: Math.max(...items.map((item) => Number(item.confidence || 0)), 0),
  }));
}

function pmmFishbeinAttributeSources(segmentItems, context, attribute) {
  const customerItems = segmentItems.filter((item) => attribute.pattern.test(`${item.buyingPriority} ${item.category} ${item.theme} ${item.customerLanguageSignal}`));
  const customerSources = pmmCommitteeEvidenceSources(customerItems, 3);
  const competitorSources = (context?.evidenceLinks || []).filter((source) =>
    attribute.pattern.test(`${source.label || ""} ${source.detail || ""} ${source.evidenceType || ""}`)
  ).map((source) => ({ ...source, sourceName: source.sourceName || "Competitor public source" }));
  return pmmDeduplicateSources([...customerSources, ...competitorSources]).slice(0, 4);
}

function pmmCommitteeRoleModel(definition, segmentItems, swingAttribute) {
  const matchedItems = segmentItems.filter((item) => definition.match.test(item.userRole || ""));
  const sources = pmmCommitteeEvidenceSources(matchedItems, 4);
  const objectionItem = matchedItems.find((item) => item.sentiment === "Negative")
    || matchedItems.find((item) => item.sentiment === "Mixed");
  const observed = sources.length > 0;
  return {
    ...definition,
    classification: observed ? "observed" : "inference",
    classificationLabel: observed ? "Role observed · decision model inferred" : "Inferred role · validation required",
    message: `Proposed — not approved: ${definition.message} Current calculated swing attribute: ${swingAttribute.label}.`,
    objection: objectionItem?.theme || "Hypothesis — validation required; no role-specific objection is observed in the filtered evidence.",
    sources,
    confidence: observed ? pmmEvidenceConfidence(sources) : 0,
  };
}

function pmmBuyingCommitteeModel(positioningDecisions, contexts) {
  const prioritySegments = pmmCommitteePrioritySegments(positioningDecisions);
  const targeting = pmmTargetingSelection();
  const segments = prioritySegments.map((priority) => {
    const segmentItems = currentCustomerVoiceItems().filter((item) => item.labType === priority.segment);
    const context = contexts.find((item) => item.competitor === priority.competitor);
    const weights = pmmFishbeinHypothesisWeights(priority.segment, targeting);
    const baselineWeights = pmmFishbeinHypothesisWeights(priority.segment, {
      ...targeting,
      application: "All",
      buyingSituation: "All",
      buyerRole: "All",
    });
    const scores = pmmFishbeinHypothesisScores(priority.competitor);
    const scorecard = PmmDataContract.fishbeinScorecard(pmmFishbeinAttributes.map((attribute, index) => ({
      ...attribute,
      weight: weights[index],
      watersScore: scores.waters[attribute.key],
      competitorScore: scores.competitor[attribute.key],
      sources: pmmFishbeinAttributeSources(segmentItems, context, attribute),
    })));
    const baselineScorecard = PmmDataContract.fishbeinScorecard(pmmFishbeinAttributes.map((attribute, index) => ({
      ...attribute,
      weight: baselineWeights[index],
      watersScore: scores.waters[attribute.key],
      competitorScore: scores.competitor[attribute.key],
      sources: [],
    })));
    return {
      ...priority,
      application: targeting.application,
      buyingSituation: targeting.buyingSituation,
      buyerRole: targeting.buyerRole,
      sourceCount: uniqueCustomerVoiceLinks(segmentItems, 100).length,
      scorecard,
      baselineSwingAttribute: baselineScorecard.swingAttribute,
      roles: pmmBuyingCommitteeRoleDefinitions.map((definition) => pmmCommitteeRoleModel(definition, segmentItems, scorecard.swingAttribute)),
    };
  });
  const selectedSegment = filters.segment.value === "All"
    ? segments[0]
    : segments.find((segment) => segment.segment === filters.segment.value || (filters.segment.value === "CDMO" && segment.segment === "CRO/CDMO"));
  const selectedSwingAttribute = selectedSegment
    ? `${selectedSegment.segment}: ${selectedSegment.scorecard.swingAttribute.label} (${selectedSegment.scorecard.swingAttribute.weight}% hypothesis weight; weighted difference ${selectedSegment.scorecard.swingAttribute.weightedDifference.toFixed(2)}). Hypothesis — replace with win/loss, survey, or conjoint evidence.`
    : "Swing attribute unresolved — no priority-segment scorecard is available";
  return { segments, selectedSwingAttribute };
}

const pmmAccordDimensions = [
  { key: "relative-advantage", label: "Relative advantage", scorecardKeys: ["reliability", "throughput", "economics"], tactic: "Published comparative proof", gate: "A claim-compatible comparative study demonstrates the relevant workflow outcome against the selected baseline." },
  { key: "compatibility", label: "Compatibility", scorecardKeys: ["transfer"], tactic: "Method-migration service", gate: "A documented migration and equivalency protocol is completed in the target workflow." },
  { key: "complexity", label: "Complexity", scorecardKeys: ["ease"], tactic: "Training/onboarding", gate: "Role-based onboarding and task-completion evidence establish the learning and operating burden." },
  { key: "observability", label: "Observability", scorecardKeys: ["reliability", "throughput"], tactic: "Reference-site program", gate: "A reference site makes the workflow result observable with approved, attributable evidence." },
  { key: "risk", label: "Risk", scorecardKeys: ["compliance", "reliability"], tactic: "Validation package + risk-reversal offer", gate: "Validation evidence and approved commercial terms address migration, compliance, and operational downside." },
  { key: "trialability", label: "Trialability", scorecardKeys: [], tactic: "Controlled evaluation program + proof-of-value milestone", gate: "A governed evaluation defines baseline, protocol, acceptance criterion, evidence owner, and decision milestone before trial." },
];

const pmmEvcMetrics = [
  { key: "analyst-time", label: "Analyst time", unit: "hours/year", timing: "Recurring" },
  { key: "method-transfer-effort", label: "Method-transfer effort", unit: "hours/transition", timing: "One-time" },
  { key: "validation-effort", label: "Validation effort", unit: "hours/transition", timing: "One-time" },
  { key: "downtime", label: "Downtime", unit: "hours/year", timing: "Recurring" },
  { key: "service-burden", label: "Service burden", unit: "hours/year", timing: "Recurring" },
  { key: "consumables", label: "Consumables", unit: "currency/year", timing: "Recurring" },
  { key: "failed-runs-rework", label: "Failed runs / rework", unit: "runs/year", timing: "Recurring" },
  { key: "review-time", label: "Review time", unit: "hours/year", timing: "Recurring" },
  { key: "training", label: "Training", unit: "hours/person", timing: "One-time" },
  { key: "outsourcing", label: "Outsourcing", unit: "currency/year", timing: "Recurring" },
];

function pmmAdoptionPlanId(segment) {
  return `${pmmTargetingKey()}::${segment.segment}::${segment.competitor}`;
}

function pmmAccordEvidence(segment, dimension) {
  const scorecardSources = segment.scorecard.rows
    .filter((row) => dimension.scorecardKeys.includes(row.key))
    .flatMap((row) => row.sources || []);
  const decisionProof = dimension.key === "relative-advantage" || dimension.key === "observability"
    ? [...(segment.decision.availableProof || []), ...(segment.decision.exactSources || [])]
    : [];
  return pmmDeduplicateSources([...scorecardSources, ...decisionProof]).slice(0, 4);
}

function pmmAccordBarrier(segment, dimension, baselineName) {
  const target = pmmTargetingSelection();
  const barriers = {
    "relative-advantage": `Relative workflow advantage is not quantified against ${baselineName}.`,
    compatibility: `Compatibility with ${pmmTargetingDisplayValue(target.buyingSituation, "the selected buying situation")} and ${pmmTargetingDisplayValue(target.application, "the target workflow")} is not established.`,
    complexity: `Role-specific setup, learning, and operating burden are not measured for ${segment.segment}.`,
    observability: `Target buyers cannot yet inspect an approved, attributable outcome in a comparable reference workflow.`,
    risk: `Migration, validation, compliance, and operational downside remain unresolved for the buying committee.`,
    trialability: `No governed trial protocol or proof-of-value acceptance milestone is loaded.`,
  };
  const sources = pmmAccordEvidence(segment, dimension);
  return {
    ...dimension,
    barrier: barriers[dimension.key],
    classification: "inference",
    classificationLabel: sources.length ? "Analyst/rule-based barrier inference · evidence context linked" : "Strategic hypothesis requiring validation",
    sources,
  };
}

function pmmIncumbentWatersBaseline(segment) {
  const records = customerVoiceItemsForHorizon(filters.horizon.value, { ignoreCompetitor: true })
    .filter((item) => item.company === "Waters" && item.labType === segment.segment)
    .filter((item) => item.product);
  const record = records[0];
  const sources = record ? pmmCommitteeEvidenceSources([record], 3) : [];
  return {
    id: "incumbent-waters",
    type: "Incumbent Waters system",
    name: record ? `Incumbent Waters system · ${record.product}` : "Incumbent Waters system · exact model unresolved",
    evidenceState: sources.length ? "Observed installed-base context" : "Baseline identity unresolved",
    sources,
  };
}

function pmmNamedCompetitorBaseline(segment, context) {
  const product = context?.selectedLaunch?.product;
  const launchSource = context?.selectedLaunch ? [{
    url: timelineUrlForLaunch(context.selectedLaunch),
    label: product || `${segment.competitor} launch evidence`,
    date: context.selectedLaunch.date,
    sourceName: context.selectedLaunch.sourceName || "Official competitor source",
  }] : [];
  const sources = pmmDeduplicateSources([...launchSource, ...(context?.targetEvidenceLinks || []), ...(segment.decision.exactSources || [])]).slice(0, 4);
  return {
    id: "named-competitor",
    type: "Named competitor",
    name: product ? `${segment.competitor} · ${product}` : `${segment.competitor} · exact product/workflow unresolved`,
    evidenceState: sources.length ? "Named competitor with exact evidence" : "Competitor baseline evidence unresolved",
    sources,
  };
}

function pmmInertiaBaseline(segment, marketChoice) {
  const inertia = marketChoice?.levels?.flatMap((level) => level.alternatives || [])
    .find((alternative) => /do nothing|keep the validated method/i.test(alternative.name || ""));
  return {
    id: "keep-current-method",
    type: "Keep-current-method / do-nothing",
    name: "Keep current validated method / do nothing",
    evidenceState: inertia?.classificationLabel || "Strategic hypothesis requiring validation",
    sources: pmmDeduplicateSources(inertia?.sources || segment.decision.exactSources || []).slice(0, 4),
  };
}

function pmmEvcAssumptionKey(planId, baselineId) {
  return `${planId}::${baselineId}`;
}

function pmmEvcAssumptionsFor(planId, baselineId) {
  return state.marketingEvcAssumptions[pmmEvcAssumptionKey(planId, baselineId)] || {};
}

function pmmAdoptionValuePlan(segment, contexts, marketChoice) {
  const id = pmmAdoptionPlanId(segment);
  const context = contexts.find((item) => item.competitor === segment.competitor);
  const baselines = [
    pmmIncumbentWatersBaseline(segment),
    pmmNamedCompetitorBaseline(segment, context),
    pmmInertiaBaseline(segment, marketChoice),
  ];
  const selectedBaselineId = baselines.some((baseline) => baseline.id === state.marketingEvcBaselines[id])
    ? state.marketingEvcBaselines[id]
    : "named-competitor";
  const selectedBaseline = baselines.find((baseline) => baseline.id === selectedBaselineId);
  const assumptions = pmmEvcAssumptionsFor(id, selectedBaselineId);
  const sensitivity = PmmDataContract.buildEvcSensitivity(pmmEvcMetrics, assumptions);
  const sourcedValues = selectedBaseline.sources.filter((source) => Number.isFinite(Number(source.value)) && source.unit);
  const substantiationStatus = sourcedValues.length ? "Directional" : "Unsupported";
  return {
    id,
    segment: segment.segment,
    application: segment.application,
    competitor: segment.competitor,
    baselines,
    selectedBaseline,
    accord: pmmAccordDimensions.map((dimension) => pmmAccordBarrier(segment, dimension, selectedBaseline.name)),
    evc: {
      metrics: pmmEvcMetrics,
      assumptions,
      sensitivity,
      sourcedValues,
      formula: "EVC = avoided recurring burden + avoided direct cost − migration, validation, training, and implementation investment versus the named baseline.",
      unresolvedConversion: "Total monetary EVC unavailable: labor rates, downtime value, rework cost, implementation cost, price/discount, currency, utilization, and analysis horizon are not established.",
      substantiationStatus,
      approvalState: "Approval not established",
      valueClaimGate: PmmDataContract.valueClaimEligibility({ substantiationStatus, approvalEstablished: false }),
    },
  };
}

function pmmAdoptionValuePlans(buyingCommittee, contexts, marketChoice) {
  return buyingCommittee.segments.map((segment) => pmmAdoptionValuePlan(segment, contexts, marketChoice));
}

function pmmCommitteeSourceLinksMarkup(sources) {
  if (!sources.length) return `<p class="pmm-committee-unresolved">Hypothesis — validation required. No exact role-specific evidence link is available.</p>`;
  return `<div class="pmm-committee-links">${sources.map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.label)}${source.date ? ` · ${escapeHtml(formatDate(source.date))}` : ""} ↗</a>`).join("")}</div>`;
}

function pmmCommitteeRoleMarkup(role) {
  return `<article class="pmm-committee-role pmm-committee-role-${escapeHtml(role.classification)}" data-committee-role="${escapeHtml(role.key)}" data-role-classification="${escapeHtml(role.classification)}">
    <header><h5>${escapeHtml(role.label)}</h5>${pmmEvidenceTypeMarkup(role.classification, role.classificationLabel)}</header>
    <dl>
      <div><dt>Job</dt><dd>${escapeHtml(role.job)}</dd></div>
      <div><dt>Concern</dt><dd>${escapeHtml(role.concern)}</dd></div>
      <div><dt>Decision power</dt><dd><strong>${escapeHtml(role.decisionPower)}</strong><small>Rule-based committee model; authority is not confirmed.</small></dd></div>
      <div><dt>Message</dt><dd>${escapeHtml(role.message)}</dd></div>
      <div><dt>Required proof</dt><dd>${escapeHtml(role.proof)}</dd></div>
      <div><dt>Objection</dt><dd>${escapeHtml(role.objection)}</dd></div>
      <div><dt>Preferred asset / channel</dt><dd>${escapeHtml(role.asset)} <small>Hypothesis — validate with the role.</small></dd></div>
    </dl>
    <div class="pmm-committee-role-evidence"><strong>${role.sources.length ? `${role.sources.length} exact role source${role.sources.length === 1 ? "" : "s"}` : "Role evidence unresolved"}</strong><span>${role.confidence ? `${escapeHtml(confidenceLabel(role.confidence))} confidence · ${role.confidence}/100` : "Confidence unresolved"}</span>${pmmCommitteeSourceLinksMarkup(role.sources)}</div>
  </article>`;
}

function pmmFishbeinSourcesMarkup(sources) {
  if (!sources.length) return `<span class="pmm-fishbein-hypothesis">Hypothesis — validation required</span>`;
  return `<div class="pmm-fishbein-sources">${sources.map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.label)} ↗</a>`).join("")}<small>Sources provide context only; they do not validate the numeric hypothesis score.</small></div>`;
}

function pmmFishbeinScorecardMarkup(segment) {
  const { scorecard } = segment;
  return `<section class="pmm-fishbein" aria-labelledby="pmmFishbein${escapeHtml(segment.segment.replace(/[^a-z0-9]/gi, ""))}">
    <header><div><span>Fishbein-Style Working Model</span><h4 id="pmmFishbein${escapeHtml(segment.segment.replace(/[^a-z0-9]/gi, ""))}">Buying Attribute Scorecard</h4><p>Weights and 1–5 scores are analyst hypotheses, not measured buyer preference or comparative performance.</p><small>Re-derived for ${escapeHtml(pmmTargetingKey())}; geography-specific preference evidence is unavailable.</small></div><div class="pmm-fishbein-total"><strong>${scorecard.weightTotal}%</strong><span>hypothesis weights</span></div></header>
    <div class="pmm-fishbein-table-wrap"><table class="pmm-fishbein-table"><caption class="sr-only">${escapeHtml(segment.segment)} Fishbein-style buying attribute scorecard</caption><thead><tr><th>Buying attribute</th><th>Segment-specific weight</th><th>Waters score</th><th>${escapeHtml(segment.competitor)} score</th><th>Evidence confidence</th><th>Weighted difference</th><th>Swing attribute</th></tr></thead><tbody>${scorecard.rows.map((row) => {
      const confidence = pmmEvidenceConfidence(row.sources);
      const isSwing = row.key === scorecard.swingAttribute.key;
      return `<tr class="${isSwing ? "pmm-fishbein-swing-row" : ""}" data-fishbein-attribute="${escapeHtml(row.key)}" data-weight="${row.weight}" data-weighted-difference="${row.weightedDifference}"><td><strong>${escapeHtml(row.label)}</strong>${pmmFishbeinSourcesMarkup(row.sources)}</td><td><strong>${row.weight}%</strong><small>Hypothesis — validation required</small></td><td><strong>${row.watersScore}/5</strong><small>Hypothesis — validation required</small></td><td><strong>${row.competitorScore}/5</strong><small>Hypothesis — validation required</small></td><td>${confidence ? `<strong>${escapeHtml(confidenceLabel(confidence))} · ${confidence}/100</strong><small>Context-source confidence; numeric score remains hypothetical.</small>` : `<span class="pmm-fishbein-hypothesis">Confidence unresolved</span>`}</td><td><strong>${row.weightedDifference > 0 ? "+" : ""}${row.weightedDifference.toFixed(2)}</strong><small>weight × (Waters − competitor)</small></td><td>${isSwing ? `<strong>Calculated swing</strong><small>Largest absolute weighted difference</small>` : "—"}</td></tr>`;
    }).join("")}</tbody><tfoot><tr><th>Weighted total</th><td>${scorecard.weightTotal}%</td><td>${scorecard.watersWeightedScore.toFixed(2)}</td><td>${scorecard.competitorWeightedScore.toFixed(2)}</td><td colspan="2">Hypothesis model only</td><td>${escapeHtml(scorecard.swingAttribute.label)}</td></tr></tfoot></table></div>
  </section>`;
}

function pmmWeightReplacementWorkflowMarkup() {
  return `<aside class="pmm-weight-workflow" aria-labelledby="pmmWeightWorkflowTitle"><div><span>Replace Hypotheses with Measured Preference</span><h4 id="pmmWeightWorkflowTitle">Weight and Score Validation Workflow</h4></div><ol><li><strong>Win/loss:</strong> code decision criteria, committee role, veto reason, alternative, and outcome by segment.</li><li><strong>Survey:</strong> measure attribute importance and perceived vendor performance with sample and role metadata.</li><li><strong>Conjoint:</strong> estimate trade-offs where price, workflow risk, performance, service, and compliance compete.</li><li><strong>Govern:</strong> replace a hypothesis only with a dated study, methodology, sample, owner, and review/expiration state.</li></ol><p>Owner needed · Deadline needed · Minimum sample and approval threshold unresolved. No backend workflow record is available.</p></aside>`;
}

function pmmAdoptionSourceLinksMarkup(sources, emptyMessage) {
  if (!sources.length) return `<p class="pmm-adoption-unresolved">${escapeHtml(emptyMessage)}</p>`;
  return `<div class="pmm-adoption-links">${sources.map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.label || source.sourceName || "Exact evidence")} ↗</a>`).join("")}</div>`;
}

function pmmAccordMarkup(plan) {
  return `<section class="pmm-accord" aria-labelledby="pmmAccord${escapeHtml(plan.id.replace(/[^a-z0-9]/gi, ""))}">
    <header><div><span>ACCORD Adoption Diagnosis</span><h4 id="pmmAccord${escapeHtml(plan.id.replace(/[^a-z0-9]/gi, ""))}">Barriers and Prescribed Launch Tactics</h4><p>All six adoption dimensions are explicit. Barrier statements are analyst/rule-based inferences; linked records provide context and do not prove prevalence.</p></div><strong>${plan.accord.length} governed barriers</strong></header>
    <div class="pmm-accord-grid">${plan.accord.map((barrier) => `<article class="pmm-accord-card" data-accord-dimension="${escapeHtml(barrier.key)}"><header><h5>${escapeHtml(barrier.label)}</h5>${pmmEvidenceTypeMarkup(barrier.sources.length ? "inference" : "hypothesis", barrier.classificationLabel)}</header><p>${escapeHtml(barrier.barrier)}</p><dl><div><dt>Prescribed launch tactic</dt><dd><strong>${escapeHtml(barrier.tactic)}</strong></dd></div><div><dt>Evidence gate</dt><dd>${escapeHtml(barrier.gate)}</dd></div></dl>${pmmAdoptionSourceLinksMarkup(barrier.sources, "No claim-compatible source was located for this adoption dimension. Validation is required.")}</article>`).join("")}</div>
  </section>`;
}

function pmmEvcBaselineOptionsMarkup(plan) {
  return plan.baselines.map((baseline) => `<option value="${escapeHtml(baseline.id)}" ${baseline.id === plan.selectedBaseline.id ? "selected" : ""}>${escapeHtml(baseline.name)}</option>`).join("");
}

function pmmEvcAssumptionInput(plan, metric, range) {
  const value = plan.evc.assumptions[metric.key]?.[range] ?? "";
  return `<input type="number" inputmode="decimal" step="any" value="${escapeHtml(value)}" data-pmm-evc-assumption data-plan-id="${escapeHtml(plan.id)}" data-baseline-id="${escapeHtml(plan.selectedBaseline.id)}" data-metric-key="${escapeHtml(metric.key)}" data-range="${escapeHtml(range)}" aria-label="${escapeHtml(`${plan.segment} ${metric.label} ${range} assumption in ${metric.unit}`)}">`;
}

function pmmEvcSensitivityMarkup(plan) {
  const { sensitivity } = plan.evc;
  if (!sensitivity.unitRanges.length) return `<p class="pmm-evc-empty">No complete low/base/high assumption range is available. Enter assumptions to create unit-specific sensitivity bands; unlike units will not be combined.</p>`;
  return `<div class="pmm-evc-sensitivity">${sensitivity.unitRanges.map((range) => `<article><span>${escapeHtml(range.unit)} · ${range.count} input${range.count === 1 ? "" : "s"}</span><strong>${range.low.toLocaleString()} / ${range.base.toLocaleString()} / ${range.high.toLocaleString()}</strong><small>Low / base / high aggregate; assumption inputs only</small></article>`).join("")}</div>`;
}

function pmmEvcMarkup(plan) {
  const invalidMessage = plan.evc.sensitivity.invalid.length
    ? `<p class="pmm-evc-invalid" role="alert">${plan.evc.sensitivity.invalid.length} range${plan.evc.sensitivity.invalid.length === 1 ? " is" : "s are"} invalid. Low must be ≤ base ≤ high.</p>`
    : "";
  return `<section class="pmm-evc" aria-labelledby="pmmEvc${escapeHtml(plan.id.replace(/[^a-z0-9]/gi, ""))}" data-value-claim-eligible="${plan.evc.valueClaimGate.registryEligible}">
    <header><div><span>Economic Value to the Customer · Governed Working Model</span><h4 id="pmmEvc${escapeHtml(plan.id.replace(/[^a-z0-9]/gi, ""))}">EVC Against a Named Baseline</h4><p>${escapeHtml(plan.evc.formula)}</p></div><div class="pmm-evc-gate"><strong>${escapeHtml(plan.evc.valueClaimGate.status)}</strong><span>${escapeHtml(plan.evc.approvalState)}</span></div></header>
    <label class="pmm-evc-baseline">Comparison baseline<select data-pmm-evc-baseline data-plan-id="${escapeHtml(plan.id)}">${pmmEvcBaselineOptionsMarkup(plan)}</select><small>${escapeHtml(plan.selectedBaseline.type)} · ${escapeHtml(plan.selectedBaseline.evidenceState)}</small></label>
    <div class="pmm-evc-evidence"><div><strong>Sourced baseline evidence</strong><span>These links establish baseline context only. No numeric time, cost, or performance value was extracted.</span></div>${pmmAdoptionSourceLinksMarkup(plan.selectedBaseline.sources, "No exact source establishes this baseline for the active segment; baseline validation is required.")}</div>
    <div class="pmm-evc-table-wrap"><table class="pmm-evc-table"><caption>Editable EVC assumption ranges for ${escapeHtml(plan.segment)} against ${escapeHtml(plan.selectedBaseline.name)}</caption><thead><tr><th>Value driver</th><th>Unit / timing</th><th>Source state</th><th>Low</th><th>Base</th><th>High</th></tr></thead><tbody>${plan.evc.metrics.map((metric) => `<tr data-evc-metric="${escapeHtml(metric.key)}"><th>${escapeHtml(metric.label)}</th><td>${escapeHtml(metric.unit)}<small>${escapeHtml(metric.timing)}</small></td><td><span class="pmm-evc-assumption-state">Assumption — unsourced</span></td><td>${pmmEvcAssumptionInput(plan, metric, "low")}</td><td>${pmmEvcAssumptionInput(plan, metric, "base")}</td><td>${pmmEvcAssumptionInput(plan, metric, "high")}</td></tr>`).join("")}</tbody></table></div>
    ${invalidMessage}${pmmEvcSensitivityMarkup(plan)}
    <div class="pmm-evc-block"><strong>Total monetary EVC and value claim blocked</strong><p>${escapeHtml(plan.evc.unresolvedConversion)}</p><small>${escapeHtml(plan.evc.valueClaimGate.reason)} Numeric assumptions remain local browser state and are not approval or substantiation records.</small></div>
  </section>`;
}

function pmmAdoptionValuePlanMarkup(plan) {
  return `<section class="pmm-adoption-plan" aria-labelledby="pmmAdoption${escapeHtml(plan.id.replace(/[^a-z0-9]/gi, ""))}"><header><div><span>Adoption and Value Plan</span><h4 id="pmmAdoption${escapeHtml(plan.id.replace(/[^a-z0-9]/gi, ""))}">${escapeHtml(plan.segment)} Adoption and Value Plan</h4><p>Launch adoption barriers and value assumptions are governed separately from approved claims.</p></div><small>${escapeHtml(pmmTargetingKey())}</small></header>${pmmAccordMarkup(plan)}${pmmEvcMarkup(plan)}</section>`;
}

function renderMarketingAudienceCriteria(customerLanguageRecords, buyingCommittee, adoptionValuePlans) {
  const target = byId("pmmAudienceCriteria");
  if (!buyingCommittee.segments.length) {
    target.innerHTML = pmmEmptyState("No evidence-backed positioning decision identifies a priority-segment working set under the active filters. Buying committees and weights are not fabricated.");
    return;
  }
  target.innerHTML = `
    <div class="pmm-audience-intro pmm-committee-intro">
      <div><div class="pmm-eyebrow">Buying committees · governed working hypotheses</div><h3>Segment Buying Committees and Decision Criteria</h3><p><strong>${buyingCommittee.segments.length} priority-segment working set${buyingCommittee.segments.length === 1 ? "" : "s"}</strong> inherit from the displayed positioning decisions. ${customerLanguageRecords.length} unique customer-language URLs match the global filters. Neither segment inclusion nor record frequency establishes commercial attractiveness.</p></div>
      <div class="pmm-decision-legend">${pmmEvidenceTypeMarkup("observed", "Role observed in exact evidence")}${pmmEvidenceTypeMarkup("inference", "Inferred role · validation required")}${pmmEvidenceTypeMarkup("hypothesis", "Weight or score hypothesis")}</div>
    </div>
    <p class="pmm-forum-caveat">Forum evidence can surface objections and customer language, but it is complaint-biased and is not representative market research. Committee authority, veto power, weights, and scores require primary research.</p>
    <div class="pmm-committee-segments">${buyingCommittee.segments.map((segment, index) => `<details class="pmm-committee-segment" ${index === 0 ? "open" : ""}><summary><span><small>Priority-segment working set ${index + 1}</small><strong>${escapeHtml(segment.segment)}${segment.application !== "All" ? ` · ${escapeHtml(segment.application)}` : ""}</strong><em>Reference competitor: ${escapeHtml(segment.competitor)} · criterion: ${escapeHtml(segment.buyingCriterion)}</em></span><span><b>${segment.scorecard.weightTotal}%</b> hypothesis weights · swing: ${escapeHtml(segment.scorecard.swingAttribute.label)}</span></summary><div class="pmm-committee-segment-body">
      <section class="pmm-buying-committee" aria-labelledby="pmmCommittee${index}Title"><header><div><span>Decision Unit</span><h4 id="pmmCommittee${index}Title">${escapeHtml(segment.segment)} Buying Committee</h4><p>Every required role remains visible; missing roles are explicitly inferred rather than treated as observed.</p></div><strong>${segment.sourceCount} unique segment source URL${segment.sourceCount === 1 ? "" : "s"}</strong></header><div class="pmm-committee-grid">${segment.roles.map(pmmCommitteeRoleMarkup).join("")}</div></section>
      ${pmmFishbeinScorecardMarkup(segment)}
      ${pmmAdoptionValuePlanMarkup(adoptionValuePlans.find((plan) => plan.id === pmmAdoptionPlanId(segment)))}
    </div></details>`).join("")}</div>
    ${pmmWeightReplacementWorkflowMarkup()}`;
}

function pmmNarrativeApplicationNotes(context) {
  const notes = currentCompetitorApplicationNotes().filter((note) => note.competitor === context.competitor);
  const relevanceText = [
    context.positioning,
    context.counterMessage,
    context.selectedLaunch?.product,
    context.selectedLaunch?.pmImplication,
    context.profile?.focus,
    context.profile?.intent,
    ...(context.comparison?.positioningMoves || []),
  ].filter(Boolean).join(" ");
  const scored = notes.map((note) => ({
    note,
    relevance: pmmWordOverlap(
      `${note.title} ${note.applicationArea} ${note.marketSegment} ${note.technology} ${note.products} ${note.evidenceStatement}`,
      relevanceText,
    ),
  }));
  const matching = scored.filter((item) => item.relevance > 0);
  return (matching.length ? matching : scored)
    .sort((a, b) => b.relevance - a.relevance || new Date(b.note.date) - new Date(a.note.date))
    .map((item) => item.note);
}

function pmmNarrativeConferenceEvidence(competitor) {
  return currentConferenceSources().flatMap((event) => {
    const content = (event.competitorContent || []).find((item) => String(item.competitor || "").includes(competitor));
    const watch = (event.competitorWatch || []).find((item) => item.name === competitor);
    if (!content && !watch) return [];
    const sourceUrl = content?.sourceUrl
      || (event.monitoringLinks || []).find((link) => isHttpUrl(link.url))?.url
      || event.website;
    return [{
      event,
      content,
      watch,
      url: sourceUrl,
      label: `${event.eventName} competitor evidence`,
      sourceName: event.eventName,
      date: "",
      eventDate: event.startDate,
      confidence: undefined,
      evidenceType: content?.evidenceStatus || "Conference participation evidence",
    }];
  });
}

function pmmNarrativeApplicationRead(competitor, notes) {
  const primaryTheme = notes[0] ? competitorApplicationTheme(notes[0]) : "";
  const primaryNotes = notes.filter((note) => competitorApplicationTheme(note) === primaryTheme);
  if (!primaryTheme) return {
    text: "Workflow ownership signal unresolved — no official competitor application note matches the active filters.",
    theme: "Workflow unresolved",
    repeated: false,
  };
  if (primaryNotes.length > 1) return {
    text: `${primaryNotes.length} official notes repeatedly emphasize ${primaryTheme.toLowerCase()}. This pattern suggests ${competitor} is trying to own that applied workflow through deployable proof, not only instrument specifications.`,
    theme: primaryTheme,
    repeated: true,
  };
  return {
    text: `One official note emphasizes ${primaryTheme.toLowerCase()}. Treat this as an early workflow-ownership signal, not a sustained competitor narrative.`,
    theme: primaryTheme,
    repeated: false,
  };
}

function pmmNarrativeSources(context, notes, conferences, audience) {
  const applicationSources = notes.map((note) => ({
    url: note.sourceUrl,
    label: note.title,
    sourceName: note.sourceType || "Official application note",
    date: note.date,
    confidence: undefined,
    evidenceType: "Observed official workflow emphasis",
  }));
  const launchSources = context.launches.slice(0, 2).map((launch) => ({
    url: timelineUrlForLaunch(launch),
    label: launch.product,
    sourceName: launch.sourceName || "Official launch source",
    date: launch.date,
    confidence: launch.confidence,
    evidenceType: "Observed launch evidence",
  }));
  const technicalSources = (context.technicalProfile?.rows || [])
    .filter((row) => row.evidenceType !== "requires-controlled-testing" && row.competitorValue && isHttpUrl(row.competitorSourceUrl))
    .slice(0, 2)
    .map((row) => ({
      url: row.competitorSourceUrl,
      label: row.dimension,
      sourceName: "Official competitor technical source",
      date: context.selectedLaunch?.date,
      confidence: context.selectedLaunch?.confidence,
      evidenceType: "Observed published claim",
    }));
  const audienceSources = (audience?.links || []).slice(0, 2).map((link) => ({
    url: link.url,
    label: link.label,
    sourceName: "Exact public customer record",
    date: link.sourceDate,
    confidence: audience.confidence,
    evidenceType: "Observed audience evidence",
  }));
  return pmmDeduplicateSources([
    ...applicationSources,
    ...launchSources,
    ...technicalSources,
    ...conferences,
    ...audienceSources,
    ...context.evidenceLinks.slice(0, 3),
  ]);
}

function pmmNarrativeObservedClaim(context, notes) {
  const technicalClaim = (context.technicalProfile?.rows || []).find((row) =>
    row.evidenceType !== "requires-controlled-testing" && row.competitorValue && isHttpUrl(row.competitorSourceUrl)
  );
  if (technicalClaim) return {
    text: technicalClaim.competitorValue,
    caveat: `Published ${technicalClaim.dimension.toLowerCase()} claim; test conditions and comparability limits must be preserved.`,
  };
  const note = notes[0];
  if (note?.evidenceStatement) return {
    text: note.evidenceStatement,
    caveat: "Structured summary of an official competitor application note; not a verbatim quotation.",
  };
  const launchText = context.selectedLaunch?.summary || context.selectedLaunch?.signalType;
  if (launchText) return {
    text: launchText,
    caveat: "Structured summary of an official launch record; not proof of customer adoption or comparative superiority.",
  };
  return {
    text: "Observed competitor claim or workflow emphasis unresolved for the active filters.",
    caveat: "No official claim-bearing application note or launch record matches the active filters.",
  };
}

function pmmNarrativeChange(context, notes, workflowRead) {
  const configuredChange = context.comparison?.shortHorizonDefense?.whatChanged?.[0];
  if (configuredChange && ["30d", "60d"].includes(filters.horizon.value)) return configuredChange;
  const latestSource = [
    ...notes.slice(0, 1).map((note) => ({ date: note.date, label: note.title, kind: "application note", theme: competitorApplicationTheme(note) })),
    ...(context.selectedLaunch ? [{ date: context.selectedLaunch.date, label: context.selectedLaunch.product, kind: "launch", technology: context.selectedLaunch.technology }] : []),
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))[0];
  if (!latestSource) return "Change unresolved — no comparable launch or application-note evidence matches the active filters.";
  const narrativeContext = latestSource.kind === "application note"
    ? `${String(latestSource.theme || workflowRead.theme).toLowerCase()} workflow story`
    : `${String(latestSource.technology || "product").toLowerCase()} launch story`;
  return `The newest matched ${latestSource.kind} evidence adds ${latestSource.label} to ${context.competitor}'s visible ${narrativeContext}. A comparable prior PMM narrative snapshot is not loaded, so no broader message delta is asserted.`;
}

function pmmNarrativeAudience(context, notes) {
  const audience = marketingAudienceOptionsForCompetitor(context.competitor)[0];
  if (audience) return {
    audience,
    text: `${audience.audience} · ${audience.buyerRole}; buying criterion: ${audience.criterion}; situation: ${audience.trigger}`,
    caveat: "This is the most represented matching audience in the current exact-source evidence, not a measure of commercial attractiveness.",
  };
  const note = notes[0];
  if (note) return {
    audience: null,
    text: `${note.marketSegment || "Audience unresolved"}; ${pmmTargetedBuyerRole("buyer role unresolved")}; ${pmmTargetedBuyingSituation("buying situation unresolved")}; evaluation context: ${note.applicationArea || "workflow unresolved"}`,
    caveat: state.marketingTargeting.buyerRole === "All"
      ? "Audience is inferred from official application-note context; no matching customer record establishes buyer role or priority."
      : "The selected buyer role is a targeting hypothesis; the application note does not establish that role's authority, message, or objection.",
  };
  return { audience: null, text: "Audience and buying situation unresolved.", caveat: "No matching customer or application-note context is available." };
}

function pmmNarrativeActivation(context, conferences, workflowRead) {
  const positioningMove = pmmListItems(context.comparison?.positioningMoves || []).find((item) =>
    /position|message|battlecard|proof|claim|application note|enablement|package|quantif/i.test(item)
  );
  const defenseAction = pmmListItems(context.comparison?.shortHorizonDefense?.immediateDefenseActions || []).find((item) =>
    /battlecard|sales|message|proof|claim|position/i.test(item)
  );
  const conference = conferences[0]?.event;
  const conferenceAction = pmmUsableText(conference?.watersPrep?.[0]);
  const action = positioningMove || defenseAction || conferenceAction
    || `Create a ${context.competitor} narrative brief for ${workflowRead.theme.toLowerCase()} with the proposed counter-position, substantiation gaps, and message-testing questions.`;
  const asset = conference
    ? `Conference campaign and battlecard update for ${conference.eventName}`
    : context.selectedLaunch
      ? `Launch-response battlecard for ${context.selectedLaunch.product}`
      : `Workflow campaign brief for ${workflowRead.theme}`;
  const translation = conference && context.selectedLaunch
    ? `Use ${conference.eventName} as the activation moment and ${context.selectedLaunch.product} as supporting launch context; do not present sponsorship or launch activity as proof that the market accepts the claim.`
    : conference
      ? `Translate the conference signal into message testing and campaign preparation; do not treat unconfirmed session content as an observed competitor claim.`
      : context.selectedLaunch
        ? `Translate the launch into a claim-response brief; do not reproduce the raw launch feed in primary PMM content.`
        : "Use the application-note pattern as the campaign input; raw source records remain in the evidence layer.";
  return { asset, action, translation };
}

function pmmCompetitiveNarrative(context, governingPosition) {
  const notes = pmmNarrativeApplicationNotes(context);
  const conferences = pmmNarrativeConferenceEvidence(context.competitor);
  const workflowRead = pmmNarrativeApplicationRead(context.competitor, notes);
  const audienceRead = pmmNarrativeAudience(context, notes);
  const counterPosition = pmmSuggestedCounterPosition(context, audienceRead.audience, governingPosition);
  const sources = pmmNarrativeSources(context, notes, conferences, audienceRead.audience);
  const observedClaim = pmmNarrativeObservedClaim(context, notes);
  const recency = pmmDecisionRecency(sources);
  const sourceDiversity = new Set(sources.map(pmmSourceHostname)).size;
  const confidence = pmmEvidenceConfidence(sources);
  const activation = pmmNarrativeActivation(context, conferences, workflowRead);
  const expectedConference = conferences.find((item) => /expected|not confirmed/i.test(item.content?.evidenceStatus || item.watch?.status || ""));
  const hasForumEvidence = sources.some((source) => ["reddit.com", "chromforum.org", "labwrench.com"].some((host) => pmmSourceHostname(source).includes(host)));
  const limitations = pmmListItems([
    expectedConference ? `${expectedConference.event.eventName}: participation may be confirmed, but the specific competitor message or session is expected — not confirmed.` : "",
    !workflowRead.repeated && notes.length ? "Application-note interpretation rests on one official note and is an early signal." : "",
    sourceDiversity < 3 ? "Low source diversity — fewer than 3 distinct source domains support this synthesis." : "",
    hasForumEvidence ? "Forum evidence can surface objections and language, but is complaint-biased and not representative market research." : "",
    context.comparison?.shortHorizonDefense?.stillWeak?.[0] ? `Analyst weakness to validate: ${context.comparison.shortHorizonDefense.stillWeak[0]}` : "",
    context.comparison?.evidenceBasis || context.technicalProfile?.limitations?.[0],
    "Proposed Waters counter-position is not an approved Waters claim; approval is not established.",
  ]).slice(0, 6);
  const score = recency.points
    + Math.min(3, sourceDiversity) * 7
    + (workflowRead.repeated ? 10 : notes.length ? 4 : 0)
    + (context.selectedLaunch ? 6 : 0)
    + (conferences.length ? 4 : 0)
    + (audienceRead.audience?.links?.length ? 6 : 0)
    + Math.min(20, Math.round(confidence / 5));
  return {
    context,
    competitor: context.competitor,
    notes,
    conferences,
    workflowRead,
    audienceRead,
    sources,
    observedClaim,
    whatChanged: pmmNarrativeChange(context, notes, workflowRead),
    likelyPositioning: context.positioning,
    counterPosition: counterPosition.text,
    governingTrace: counterPosition.trace,
    activation,
    recency,
    sourceDiversity,
    confidence,
    limitations,
    score,
  };
}

function pmmNarrativeSourceMarkup(source) {
  const dateLabel = source.date
    ? formatDate(source.date)
    : source.eventDate
      ? `Event starts ${formatDate(source.eventDate)}`
      : "Date unresolved";
  return `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer"><span>${escapeHtml(source.evidenceType || "Observed public evidence")}</span><strong>${escapeHtml(source.label || source.sourceName)}</strong><small>${escapeHtml(source.sourceName || "Public source")} · ${escapeHtml(dateLabel)}</small></a>`;
}

function pmmMarketChoiceSource(item, link, evidenceRole = "Observed customer evidence") {
  return {
    url: link.url,
    label: link.label || item.theme || "Exact public customer record",
    sourceName: item.sourceName || "Public customer source",
    date: link.sourceDate || item.dateCaptured,
    confidence: item.confidence,
    evidenceType: evidenceRole,
  };
}

function pmmIsDirectCustomerChoiceLink(link) {
  if (!isHttpUrl(link?.url) || link.sourceType === "regulatory") return false;
  return !pmmSourceHostname(link).includes("fda.gov");
}

function pmmMarketChoiceCustomerEvidence(pattern, { company } = {}) {
  const candidateItems = customerVoiceItemsForHorizon(filters.horizon.value, { ignoreCompetitor: true })
    .filter((item) => !company || item.company === company)
    .filter((item) => pattern.test(`${item.theme} ${item.customerLanguageSignal} ${item.category} ${item.productMaturity} ${item.labType}`));
  const items = candidateItems.filter((item) => customerVoiceSourceLinks(item).some(pmmIsDirectCustomerChoiceLink));
  const sources = pmmDeduplicateSources(items.flatMap((item) =>
    customerVoiceSourceLinks(item)
      .filter(pmmIsDirectCustomerChoiceLink)
      .map((link) => pmmMarketChoiceSource(item, link)),
  ));
  return { items, sources };
}

function pmmMarketChoiceEvidenceConfidence(sources) {
  const confidence = pmmEvidenceConfidence(sources);
  return confidence
    ? `${confidenceLabel(confidence)} · ${confidence}/100`
    : "Confidence unscored — exact sources are available, but no compatible confidence score is loaded";
}

function pmmMarketChoiceObservedAlternative({ level, name, items, sources, watersResponse, requiredProof, fallbackSituation }) {
  const primary = items[0];
  const segment = [...new Set(items.map((item) => item.labType).filter(Boolean))].join(", ") || "Segment unresolved";
  return {
    level,
    name,
    classification: "observed",
    classificationLabel: "Observed customer-source evidence",
    whyChoose: primary?.customerLanguageSignal || primary?.theme || "Observed choice rationale unresolved.",
    segment,
    buyingSituation: primary?.theme || fallbackSituation || "Buying situation unresolved",
    objection: primary?.buyingPriority
      ? `${primary.buyingPriority} is an observed decision criterion; a direct switching objection is not established.`
      : "Primary objection to switching is not established in the loaded evidence.",
    watersResponse,
    requiredProof,
    evidenceConfidence: pmmMarketChoiceEvidenceConfidence(sources),
    sources,
    caveat: "Public customer-language records surface criteria and objections but do not establish market prevalence or win/loss causality.",
  };
}

function pmmMarketChoiceHypothesisAlternative({ level, name, whyChoose, buyingSituation, watersResponse, requiredProof, sources = [], caveat }) {
  return {
    level,
    name,
    classification: "hypothesis",
    classificationLabel: sources.length
      ? "Observed competitor evidence · customer-choice hypothesis"
      : "Strategic hypothesis requiring validation",
    whyChoose,
    segment: filters.segment.value === "All"
      ? "Segment unresolved — validation required"
      : `${filters.segment.value} is the active evidence filter, not validated demand evidence`,
    buyingSituation,
    objection: "Primary objection to switching is unresolved — direct customer or win/loss evidence is required.",
    watersResponse,
    requiredProof,
    evidenceConfidence: sources.length
      ? `${pmmMarketChoiceEvidenceConfidence(sources)} · customer-choice confidence unresolved`
      : "Confidence unresolved — validation required",
    sources,
    caveat: caveat || "No direct customer-choice or win/loss evidence was located; this alternative is not a statement of prevalence.",
  };
}

function pmmMarketChoiceFormAlternative(context, governingPosition) {
  const customerEvidence = pmmMarketChoiceCustomerEvidence(/./, { company: context.competitor });
  const supportedChoiceItems = customerEvidence.items.filter((item) => item.sentiment === "Positive");
  const supportedChoiceSources = pmmDeduplicateSources(supportedChoiceItems.flatMap((item) =>
    customerVoiceSourceLinks(item).map((link) => pmmMarketChoiceSource(item, link)),
  ));
  const officialSources = pmmDeduplicateSources(context.evidenceLinks.map((source) => ({
    ...source,
    evidenceType: source.evidenceType || "Observed competitor evidence",
  })));
  const sources = pmmDeduplicateSources([...customerEvidence.sources, ...officialSources]).slice(0, 6);
  const watersResponse = `${governingPosition.pointOfDifference} ${context.competitor} response: ${context.counterMessage}`;
  if (supportedChoiceSources.length) return pmmMarketChoiceObservedAlternative({
    level: "Form rivals",
    name: context.competitor,
    items: supportedChoiceItems,
    sources: pmmDeduplicateSources([...supportedChoiceSources, ...officialSources]).slice(0, 6),
    watersResponse,
    requiredProof: `Direct ${context.competitor} win/loss evidence plus a controlled workflow comparison against the buying criterion are still required.`,
    fallbackSituation: "Direct platform comparison or replacement evaluation",
  });
  return pmmMarketChoiceHypothesisAlternative({
    level: "Form rivals",
    name: context.competitor,
    whyChoose: customerEvidence.sources.length
      ? `Public customer records exist for ${context.competitor}, but no supported positive choice rationale was located; negative or neutral records are treated as objections, not strengths.`
      : `Public ${context.competitor} sources establish visible positioning and product activity; why a customer selects it is not established.`,
    buyingSituation: "Direct platform comparison or replacement evaluation — strategic hypothesis requiring validation",
    watersResponse,
    requiredProof: `Direct ${context.competitor} customer interviews, coded win/loss evidence, and comparable workflow testing.`,
    sources,
    caveat: customerEvidence.sources.length
      ? "Customer-source objections are traceable, but they are not evidence of why customers choose this rival. Choice rationale and prevalence remain unestablished."
      : "Competitor sources are traceable, but they do not establish customer choice, switching behavior, or market prevalence.",
  });
}

function pmmMarketChoiceRelevantFormAlternatives(signals, governingPosition) {
  if (filters.competitor.value !== "All" && marketingBattlecardCompetitors.includes(filters.competitor.value)) return [];
  const eligible = [...signals, ...currentLaunches()]
    .filter((item) => item.competitor && !["Waters", "Market-wide", ...marketingBattlecardCompetitors].includes(item.competitor));
  const names = [...new Set(eligible.map((item) => item.competitor))].slice(0, 3);
  return names.map((name) => {
    const records = eligible.filter((item) => item.competitor === name);
    const sources = pmmDeduplicateSources(records.map((item) => ({
      url: item.sourceUrl || timelineUrlForLaunch(item),
      label: item.title || item.product || `${name} public evidence`,
      sourceName: item.sourceName || "Official public source",
      date: item.date,
      confidence: item.confidence,
      evidenceType: "Observed competitor evidence",
    }))).slice(0, 4);
    const customerEvidence = pmmMarketChoiceCustomerEvidence(/./, { company: name });
    const supportedChoiceItems = customerEvidence.items.filter((item) => item.sentiment === "Positive");
    const supportedChoiceSources = pmmDeduplicateSources(supportedChoiceItems.flatMap((item) =>
      customerVoiceSourceLinks(item).map((link) => pmmMarketChoiceSource(item, link)),
    ));
    const combinedSources = pmmDeduplicateSources([...customerEvidence.sources, ...sources]);
    const response = `${governingPosition.pointOfDifference} A ${name}-specific approved counter-position is not established.`;
    return supportedChoiceSources.length
      ? pmmMarketChoiceObservedAlternative({
        level: "Form rivals",
        name,
        items: supportedChoiceItems,
        sources: pmmDeduplicateSources([...supportedChoiceSources, ...sources]),
        watersResponse: response,
        requiredProof: `Direct ${name} win/loss evidence and a comparable workflow study are required.`,
        fallbackSituation: "Direct platform comparison or replacement evaluation",
      })
      : pmmMarketChoiceHypothesisAlternative({
        level: "Form rivals",
        name,
        whyChoose: customerEvidence.sources.length
          ? `Customer-source records exist for ${name}, but no supported positive selection rationale was located; concerns are not treated as strengths.`
          : `${name} appears in filtered public competitor evidence; customer selection rationale is not established.`,
        buyingSituation: "Buying situation unresolved — customer validation required",
        watersResponse: response,
        requiredProof: `Direct ${name} customer interviews, win/loss evidence, and comparable workflow testing.`,
        sources: combinedSources,
        caveat: "Included as a relevant-other form rival because filtered public evidence exists; customer choice and prevalence are not established.",
      });
  });
}

function pmmMarketChoice(contexts, governingPosition, signals = currentSignals()) {
  const proposedResponse = `${governingPosition.pointOfDifference} Proposed — not approved.`;
  const workaroundEvidence = pmmMarketChoiceCustomerEvidence(/workaround|split software|contact closure|alternative analytical|manual review|local expert/i);
  const inertiaEvidence = pmmMarketChoiceCustomerEvidence(/validated method|method continuity|legacy|replacement timing|upgrade friction|known methods/i);
  const extensionEvidence = pmmMarketChoiceCustomerEvidence(/legacy|parts|serviceability|maintenance|second-hand|extend/i);
  const deferEvidence = pmmMarketChoiceCustomerEvidence(/replacement timing|upgrade friction|validation burden|lower risk migration|defer/i);
  const watersInstalledEvidence = customerVoiceItemsForHorizon(filters.horizon.value, { ignoreCompetitor: true })
    .filter((item) => item.company === "Waters");
  const watersInstalledSources = pmmDeduplicateSources(watersInstalledEvidence.flatMap((item) =>
    customerVoiceSourceLinks(item)
      .filter(pmmIsDirectCustomerChoiceLink)
      .map((link) => pmmMarketChoiceSource(item, link, "Observed Waters-user public evidence")),
  ));
  const currentWorkaround = workaroundEvidence.items[0];
  const switchingRecord = inertiaEvidence.items[0];
  const formRivals = [
    ...contexts.map((context) => pmmMarketChoiceFormAlternative(context, governingPosition)),
    ...pmmMarketChoiceRelevantFormAlternatives(signals, governingPosition),
  ];
  const categoryAlternatives = [
    pmmMarketChoiceHypothesisAlternative({
      level: "Category / resource alternatives",
      name: "Outsource testing",
      whyChoose: "Strategic hypothesis: a buyer may prefer external capacity or specialist execution to purchasing and operating another platform.",
      buyingSituation: "Capacity constraint, specialist-method need, or capital-avoidance decision — validation required",
      watersResponse: proposedResponse,
      requiredProof: "Win/loss coding for outsource-versus-buy decisions, buyer interviews, decision criteria, and comparable cost/risk evidence.",
    }),
    pmmMarketChoiceHypothesisAlternative({
      level: "Category / resource alternatives",
      name: "Use a CRO/CDMO",
      whyChoose: "Strategic hypothesis: a sponsor may transfer analytical execution to an external development or manufacturing partner.",
      buyingSituation: "Development, method transfer, scale-up, or regulated execution requiring external capability — validation required",
      watersResponse: proposedResponse,
      requiredProof: "Direct sponsor and CRO/CDMO interviews, outsource-versus-insource win/loss evidence, and documented workflow economics.",
    }),
    workaroundEvidence.sources.length
      ? pmmMarketChoiceObservedAlternative({
        level: "Category / resource alternatives",
        name: "Alternative analytical workflow",
        items: workaroundEvidence.items,
        sources: workaroundEvidence.sources,
        watersResponse: proposedResponse,
        requiredProof: "Workflow-specific comparison showing when the proposed Waters path reduces handoffs or workaround burden under comparable conditions.",
      })
      : pmmMarketChoiceHypothesisAlternative({
        level: "Category / resource alternatives",
        name: "Alternative analytical workflow",
        whyChoose: "Strategic hypothesis: a laboratory may meet the analytical job through a different instrument, software path, or manual workflow.",
        buyingSituation: "Workflow redesign or method-selection decision — validation required",
        watersResponse: proposedResponse,
        requiredProof: "Customer workflow mapping, alternative-method interviews, and comparable outcome, compliance, and effort evidence.",
      }),
  ];
  const inertiaAlternatives = [
    inertiaEvidence.sources.length
      ? pmmMarketChoiceObservedAlternative({
        level: "Inertia",
        name: "Do nothing / keep the validated method",
        items: inertiaEvidence.items,
        sources: inertiaEvidence.sources,
        watersResponse: proposedResponse,
        requiredProof: "A validated migration study showing method continuity, equivalency boundaries, validation effort, and operational risk.",
      })
      : pmmMarketChoiceHypothesisAlternative({
        level: "Inertia",
        name: "Do nothing / keep the validated method",
        whyChoose: "Strategic hypothesis: retaining a validated method may appear safer than introducing transfer and revalidation risk.",
        buyingSituation: "Validated-method continuity or replacement decision — validation required",
        watersResponse: proposedResponse,
        requiredProof: "Direct buyer evidence and a validated method-migration study with equivalency and revalidation boundaries.",
      }),
    extensionEvidence.sources.length
      ? pmmMarketChoiceObservedAlternative({
        level: "Inertia",
        name: "Extend the existing system",
        items: extensionEvidence.items,
        sources: extensionEvidence.sources,
        watersResponse: proposedResponse,
        requiredProof: "Lifecycle cost, serviceability, parts-risk, downtime, and migration evidence for an extend-versus-replace decision.",
      })
      : pmmMarketChoiceHypothesisAlternative({
        level: "Inertia",
        name: "Extend the existing system",
        whyChoose: "Strategic hypothesis: familiar operation and continued service may defer the disruption of replacement.",
        buyingSituation: "Lifecycle extension or replacement decision — validation required",
        watersResponse: proposedResponse,
        requiredProof: "Installed-system interviews plus lifecycle cost, serviceability, downtime, and migration evidence.",
      }),
    deferEvidence.sources.length
      ? pmmMarketChoiceObservedAlternative({
        level: "Inertia",
        name: "Defer replacement",
        items: deferEvidence.items,
        sources: deferEvidence.sources,
        watersResponse: proposedResponse,
        requiredProof: "Direct deferral-reason coding, replacement timing data, and evidence that de-risks the migration decision.",
      })
      : pmmMarketChoiceHypothesisAlternative({
        level: "Inertia",
        name: "Defer replacement",
        whyChoose: "Strategic hypothesis: the customer may postpone replacement when urgency, budget, or migration confidence is insufficient.",
        buyingSituation: "Replacement timing decision — validation required",
        watersResponse: proposedResponse,
        requiredProof: "Win/loss and no-decision reason codes, buyer interviews, and replacement timing evidence.",
      }),
  ];
  return {
    customer: {
      job: governingPosition.customerJob,
      unmetNeed: governingPosition.pointOfDifference,
      currentWorkaround: currentWorkaround
        ? `${currentWorkaround.customerLanguageSignal || currentWorkaround.theme}`
        : "Current workaround is not established in the filtered customer evidence.",
      workaroundClassification: currentWorkaround ? "observed" : "hypothesis",
      switchingTrigger: switchingRecord?.theme || governingPosition.buyingSituation,
      switchingClassification: switchingRecord ? "observed" : "inference",
      sources: pmmDeduplicateSources([...workaroundEvidence.sources, ...inertiaEvidence.sources]),
    },
    company: {
      capabilities: governingPosition.evidencePillars.map((pillar) => pillar.name),
      proof: pmmDeduplicateSources(governingPosition.evidencePillars.flatMap((pillar) => pillar.sources)),
      installedBase: watersInstalledSources.length
        ? `${watersInstalledSources.length} unique Waters-user public source URL${watersInstalledSources.length === 1 ? "" : "s"} match the active market, geography, technology, and horizon filters. Commercial installed-base advantage is not established.`
        : "Installed-base advantage is not established; no compatible Waters-user source matches the active filters.",
      installedBaseSources: watersInstalledSources.slice(0, 4),
      limitations: governingPosition.exclusions,
    },
    competition: {
      summary: "Customers can choose a direct form rival, a different resource or analytical approach, or inertia. The loaded evidence does not support market-share or prevalence estimates for these choices.",
    },
    levels: [
      { number: 1, name: "Form rivals", alternatives: formRivals },
      { number: 2, name: "Category / resource alternatives", alternatives: categoryAlternatives },
      { number: 3, name: "Inertia", alternatives: inertiaAlternatives },
    ],
  };
}

function pmmMarketChoiceLinksMarkup(sources) {
  if (!sources.length) return `<p class="pmm-market-choice-no-source">Exact customer or win/loss evidence unavailable.</p>`;
  return `<div class="pmm-market-choice-links">${sources.slice(0, 6).map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer"><strong>${escapeHtml(source.label || source.sourceName)}</strong><small>${escapeHtml(source.evidenceType || "Observed public evidence")}${source.date ? ` · ${escapeHtml(formatDate(source.date))}` : " · Date unresolved"}</small></a>`).join("")}</div>`;
}

function pmmMarketChoiceAlternativeMarkup(alternative) {
  const hypothesis = alternative.classification === "hypothesis";
  return `<article class="pmm-market-alternative pmm-market-alternative-${escapeHtml(alternative.classification)}" data-market-choice-classification="${escapeHtml(alternative.classification)}">
    <header><h6>${escapeHtml(alternative.name)}</h6>${pmmEvidenceTypeMarkup(hypothesis ? "hypothesis" : "observed", alternative.classificationLabel)}</header>
    <dl>
      <div><dt>Why customers choose it</dt><dd>${escapeHtml(alternative.whyChoose)}</dd></div>
      <div><dt>Segment and buying situation</dt><dd><strong>${escapeHtml(alternative.segment)}</strong><span>${escapeHtml(alternative.buyingSituation)}</span></dd></div>
      <div><dt>Primary objection to switching</dt><dd>${escapeHtml(alternative.objection)}</dd></div>
      <div><dt>Waters response</dt><dd>${escapeHtml(alternative.watersResponse)} <em>Approval not established.</em></dd></div>
      <div><dt>Required proof</dt><dd>${escapeHtml(alternative.requiredProof)}</dd></div>
      <div><dt>Evidence confidence</dt><dd>${escapeHtml(alternative.evidenceConfidence)}</dd></div>
    </dl>
    <p class="pmm-market-choice-caveat">${escapeHtml(alternative.caveat)}</p>
    ${pmmMarketChoiceLinksMarkup(alternative.sources)}
  </article>`;
}

function pmmMarketChoiceMarkup(marketChoice) {
  return `<section class="pmm-market-choice" aria-labelledby="pmmMarketChoiceTitle">
    <header class="pmm-market-choice-header"><div><div class="pmm-eyebrow">Choice Before Rivalry</div><h4 id="pmmMarketChoiceTitle">Market Choice</h4><p>Define the market around the customer job, Waters' right to compete, and every credible alternative before adapting a competitor narrative.</p></div><div class="pmm-decision-legend">${pmmEvidenceTypeMarkup("observed", "Observed evidence")}${pmmEvidenceTypeMarkup("inference", "Analyst/rule-based inference")}${pmmEvidenceTypeMarkup("hypothesis", "Strategic hypothesis requiring validation")}</div></header>
    <aside class="pmm-market-prevalence-note" role="note"><strong>Market prevalence unavailable.</strong><span>Displayed records and source URLs describe evidence coverage only; they do not establish market share, alternative frequency, or commercial attractiveness.</span></aside>
    <div class="pmm-three-cs" aria-label="Market Choice three Cs">
      <article><header><span>1</span><h5>Customer</h5></header><dl><div><dt>Job</dt><dd>${escapeHtml(marketChoice.customer.job)} ${pmmEvidenceTypeMarkup("inference", "Governing-position inference")}</dd></div><div><dt>Unmet need</dt><dd>${escapeHtml(marketChoice.customer.unmetNeed)} ${pmmEvidenceTypeMarkup("inference", "Proposed — not approved")}</dd></div><div><dt>Current workaround</dt><dd>${escapeHtml(marketChoice.customer.currentWorkaround)} ${pmmEvidenceTypeMarkup(marketChoice.customer.workaroundClassification, marketChoice.customer.workaroundClassification === "observed" ? "Observed customer evidence" : "Strategic hypothesis requiring validation")}</dd></div><div><dt>Switching trigger</dt><dd>${escapeHtml(marketChoice.customer.switchingTrigger)} ${pmmEvidenceTypeMarkup(marketChoice.customer.switchingClassification, marketChoice.customer.switchingClassification === "observed" ? "Observed customer evidence" : "Analyst/rule-based inference")}</dd></div></dl>${pmmMarketChoiceLinksMarkup(marketChoice.customer.sources)}</article>
      <article><header><span>2</span><h5>Company</h5></header><dl><div><dt>Waters capabilities</dt><dd>${escapeHtml(marketChoice.company.capabilities.join(" · ") || "Capabilities unresolved")}</dd></div><div><dt>Proof</dt><dd>${marketChoice.company.proof.length ? `${marketChoice.company.proof.length} exact public proof source URL${marketChoice.company.proof.length === 1 ? "" : "s"}; substantiation and approval remain unresolved.` : "Applicable proof not located."}</dd></div><div><dt>Installed-base advantage</dt><dd>${escapeHtml(marketChoice.company.installedBase)}</dd></div><div><dt>Limitations</dt><dd><ul>${marketChoice.company.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></dd></div></dl>${pmmMarketChoiceLinksMarkup(pmmDeduplicateSources([...marketChoice.company.proof, ...marketChoice.company.installedBaseSources]))}</article>
      <article><header><span>3</span><h5>Competition</h5></header><p>${escapeHtml(marketChoice.competition.summary)}</p><ol>${marketChoice.levels.map((level) => `<li><strong>${escapeHtml(level.name)}</strong><span>${level.alternatives.length} visible alternative${level.alternatives.length === 1 ? "" : "s"}</span></li>`).join("")}</ol></article>
    </div>
    <div class="pmm-competitor-onion" aria-labelledby="pmmCompetitorOnionTitle"><div class="pmm-competitor-onion-heading"><span>Three Explicit Levels</span><h5 id="pmmCompetitorOnionTitle">Competitor Onion</h5></div>${marketChoice.levels.map((level) => `<section class="pmm-onion-level pmm-onion-level-${level.number}" aria-labelledby="pmmOnionLevel${level.number}Title"><header><span>Level ${level.number}</span><h5 id="pmmOnionLevel${level.number}Title">${escapeHtml(level.name)}</h5></header>${level.alternatives.length ? `<div class="pmm-market-alternative-grid">${level.alternatives.map(pmmMarketChoiceAlternativeMarkup).join("")}</div>` : pmmEmptyState("No form-rival evidence matches the active competitor filter.")}</section>`).join("")}</div>
  </section>`;
}

function renderMarketingCompetitiveNarrative(signals = currentSignals(), governingPosition, marketChoice, modelContexts) {
  const target = byId("pmmCompetitiveNarrative");
  const contexts = modelContexts || state.marketingWorkspaceModel?.contexts || marketingPrioritizedCompetitorContexts(signals);
  const competitors = contexts.map((context) => context.competitor);
  const governing = governingPosition || state.marketingGoverningPosition || pmmGoverningPosition(
    contexts,
  );
  const choice = marketChoice || state.marketingMarketChoice || pmmMarketChoice(
    contexts,
    governing,
    signals,
  );
  if (!competitors.length) {
    target.innerHTML = `${pmmMarketChoiceMarkup(choice)}${pmmEmptyState("Prioritized competitor narratives are available for Agilent, Thermo, Shimadzu, and SCIEX; none matches the active competitor filter.")}`;
    return;
  }
  const narratives = contexts
    .map((context) => pmmCompetitiveNarrative(context, governing))
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence || a.competitor.localeCompare(b.competitor));
  if (!narratives.some((item) => item.competitor === state.activeBattlecardCompetitor)) {
    state.activeBattlecardCompetitor = narratives[0].competitor;
  }
  const narrative = narratives.find((item) => item.competitor === state.activeBattlecardCompetitor) || narratives[0];
  target.innerHTML = `
    ${pmmMarketChoiceMarkup(choice)}
    <div class="pmm-narrative-intro"><div><strong>One canonical narrative per competitor.</strong><p>Claims, intent, application-note patterns, comparator guidance, launches, conferences, and short-horizon defense inherit the Governing Position and are synthesized here. Raw feeds remain supporting evidence.</p></div><div class="pmm-decision-legend">${pmmEvidenceTypeMarkup("observed", "Observed competitor evidence")}${pmmEvidenceTypeMarkup("inference", "Analyst/rule-based inference")}${pmmEvidenceTypeMarkup("unresolved", "Proposed Waters position — not approved")}</div></div>
    <div class="battlecard-tabs pmm-narrative-tabs" role="tablist" aria-label="Prioritized competitor narratives">
      ${narratives.map((item, index) => `<button type="button" role="tab" data-battlecard-competitor="${escapeHtml(item.competitor)}" aria-selected="${item.competitor === narrative.competitor}" class="${item.competitor === narrative.competitor ? "active" : ""}"><strong>${escapeHtml(item.competitor === "Thermo Fisher" ? "Thermo" : item.competitor)}</strong><span>Evidence-fit priority ${index + 1} · ${item.context.targetPriority.label}</span></button>`).join("")}
    </div>
    <article class="competitive-battlecard competitive-narrative-card" role="tabpanel" aria-label="${escapeHtml(narrative.competitor)} canonical competitive narrative">
      <header class="battlecard-header pmm-narrative-header">
        <div><span>Prioritized Competitive Narrative · ${escapeHtml(horizonLabel())}</span><h4>${escapeHtml(narrative.competitor)}</h4><p>Canonical PMM synthesis; each intelligence input appears once and links to its underlying evidence.</p></div>
        <div class="battlecard-evidence-status"><strong>${narrative.sourceDiversity}</strong><span>source domain${narrative.sourceDiversity === 1 ? "" : "s"}</span><small>${narrative.confidence ? `${escapeHtml(confidenceLabel(narrative.confidence))} · ${narrative.confidence}/100` : "Confidence unresolved"}</small></div>
      </header>
      <div class="pmm-narrative-core-grid">
        <section><div class="pmm-narrative-label"><span>What Changed</span>${pmmEvidenceTypeMarkup("inference", "Analyst synthesis")}</div><p>${escapeHtml(narrative.whatChanged)}</p></section>
        <section class="pmm-narrative-observed"><div class="pmm-narrative-label"><span>Observed Competitor Claim or Workflow Emphasis</span>${pmmEvidenceTypeMarkup("observed", "Observed competitor evidence")}</div><p>${escapeHtml(narrative.observedClaim.text)}</p><small>${escapeHtml(narrative.observedClaim.caveat)}</small></section>
        <section><div class="pmm-narrative-label"><span>Likely Positioning</span>${pmmEvidenceTypeMarkup("inference", "Analyst/rule-based inference")}</div><p>${escapeHtml(narrative.likelyPositioning)}</p></section>
        <section><div class="pmm-narrative-label"><span>Workflow Ownership Signal</span>${pmmEvidenceTypeMarkup("inference", "Application-note pattern inference")}</div><p>${escapeHtml(narrative.workflowRead.text)}</p><small>Application-note counts are shown only to distinguish a repeated cluster from an early single-note signal. Publication volume is not used.</small></section>
        <section><div class="pmm-narrative-label"><span>Target Audience or Buying Situation</span>${pmmEvidenceTypeMarkup("inference", "Evidence-based audience inference")}</div><p>${escapeHtml(narrative.audienceRead.text)}</p><small>${escapeHtml(narrative.audienceRead.caveat)}</small></section>
        <section class="pmm-narrative-counter"><div class="pmm-narrative-label"><span>Waters Counter-Position</span>${pmmEvidenceTypeMarkup("inference", "Proposed — not approved")}</div><p>${escapeHtml(narrative.counterPosition)}</p><small>Approval not established.</small></section>
      </div>
      ${pmmGoverningTraceMarkup(governing, narrative.governingTrace)}
      <section class="pmm-narrative-decision">
        <div><span>PMM Decision</span><h5>${escapeHtml(narrative.activation.asset)}</h5></div>
        <p><strong>${escapeHtml(narrative.activation.action)}</strong></p>
        <p>${escapeHtml(narrative.activation.translation)}</p>
      </section>
      <div class="pmm-narrative-status-grid" aria-label="Narrative evidence status">
        ${pmmStatusMarkup(narrative.confidence ? "observed" : "unresolved", "Confidence", narrative.confidence ? `${confidenceLabel(narrative.confidence)} · ${narrative.confidence}/100` : "Unresolved")}
        ${pmmStatusMarkup(narrative.recency.date ? "observed" : "unresolved", "Recency", narrative.recency.label)}
        ${pmmStatusMarkup(narrative.sourceDiversity >= 3 ? "observed" : "unresolved", "Source diversity", `${narrative.sourceDiversity} distinct domain${narrative.sourceDiversity === 1 ? "" : "s"}`)}
      </div>
      <section class="pmm-narrative-caveats"><div class="pmm-narrative-label"><span>Evidence Caveats</span></div><ul>${narrative.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>
      <section class="battlecard-sources pmm-narrative-sources"><div><span class="battlecard-kicker">Underlying Evidence Links</span><small>Sources are linked for verification; this is not a raw event or launch feed.</small></div><div class="battlecard-source-links">${narrative.sources.slice(0, 8).map(pmmNarrativeSourceMarkup).join("") || `<p class="pmm-unresolved">Exact evidence links unavailable.</p>`}</div></section>
    </article>`;
}

const pmmActivationAssetTypes = [
  "Battlecard",
  "Webpage",
  "Campaign",
  "Launch kit",
  "Sales deck",
  "Application note",
  "Customer proof",
  "Message test",
];

const pmmActivationActionTypes = [
  "Positioning",
  "Proof/substantiation",
  "Message testing",
  "Packaging",
  "Campaign activation",
  "Launch content",
  "Sales enablement",
  "Customer proof",
];

function pmmActivationAssetType(decision) {
  const recommendation = String(decision.activation || "").toLowerCase();
  if (/application note|technical content/.test(recommendation)) return "Application note";
  if (/launch/.test(recommendation)) return "Launch kit";
  if (/campaign/.test(recommendation)) return "Campaign";
  if (/webpage|web page|website/.test(recommendation)) return "Webpage";
  if (/sales deck|presentation|deck/.test(recommendation)) return "Sales deck";
  if (/customer proof|customer stor|case stud/.test(recommendation)) return "Customer proof";
  if (/message test|test the message|testing question/.test(recommendation)) return "Message test";
  return "Battlecard";
}

function pmmActivationActionType(assetType) {
  return ({
    Battlecard: "Sales enablement",
    Webpage: "Packaging",
    Campaign: "Campaign activation",
    "Launch kit": "Launch content",
    "Sales deck": "Sales enablement",
    "Application note": "Proof/substantiation",
    "Customer proof": "Customer proof",
    "Message test": "Message testing",
  })[assetType] || "Positioning";
}

function pmmActivationDeliverable(decision, rank, governingPosition) {
  const proofCount = decision.availableProof.length;
  const evidenceAvailable = decision.exactSources.length > 0;
  const assetType = evidenceAvailable ? pmmActivationAssetType(decision) : "Asset unresolved";
  const actionType = evidenceAvailable ? pmmActivationActionType(assetType) : "Action type unresolved";
  const relatedDecision = `Priority ${rank} · ${decision.competitor} · ${decision.buyingCriterion}`;
  const reason = decision.missingProof
    ? `Support the governing workflow position by closing this substantiation gap before activation: ${decision.missingProof}`
    : `Package the governing value proposition and ${decision.competitor} adaptation for ${decision.buyerRole} in the identified buying situation.`;
  const requiredProof = proofCount
    ? `${proofCount} sourced Waters proof item${proofCount === 1 ? " is" : "s are"} available for review. ${decision.missingProof || "Any remaining substantiation gap is unresolved."}`
    : decision.missingProof || "Required proof is unresolved.";
  const configuredAction = /defin(?:e|ing) product requirements?|roadmap prioritization|engineering validation|product kpis?/i.test(decision.activation || "")
    ? ""
    : pmmUsableText(decision.activation);
  const action = evidenceAvailable
    ? configuredAction || `Create a ${assetType.toLowerCase()} that packages the proposed position, evidence, caveats, and open proof questions.`
    : "Action unresolved — exact supporting evidence is required before a deliverable is commissioned.";
  const governingTrace = pmmGoverningTrace(governingPosition, `${action} ${reason}`);
  return {
    rank,
    relatedDecision,
    assetType,
    actionType,
    action,
    reason,
    audience: `${decision.buyerRole} · ${decision.audience}`,
    channel: decision.intendedChannel || "Channel unresolved",
    owner: "Owner needed — no workflow assignment is available",
    deadline: "Deadline needed — no workflow date is available",
    status: evidenceAvailable ? "Proposed — workflow not established" : "Unresolved — supporting evidence unavailable",
    requiredProof: `${requiredProof} Approval not established.`,
    successMeasure: "Measure needed — no success measure is assigned",
    sources: decision.exactSources,
    governingPositionId: governingPosition.id,
    governingTrace,
    approvalState: governingPosition.approvalState,
  };
}

const pmmArtifactDefinitions = [
  { id: "competitive-battlecard", title: "One-Page Competitive Battlecard", artifactType: "Competitive battlecard", exportKind: "pptx-battlecard", extension: "PPTX", purpose: "Equip sales to answer the prioritized competitor narrative without overstating proof." },
  { id: "positioning-messaging-brief", title: "Positioning and Messaging Brief", artifactType: "Positioning and messaging brief", exportKind: "docx", extension: "DOCX", purpose: "Package the governing position, buying-committee adaptation, proof boundaries, and message hierarchy." },
  { id: "regulated-claims-sheet", title: "Regulated Claims Sheet", artifactType: "Regulated claims sheet", exportKind: "docx", extension: "DOCX", purpose: "Review proposed wording, substantiation, approval state, comparability, caveats, and next required action." },
  { id: "campaign-message-plan", title: "Campaign and Message Plan", artifactType: "Campaign and message plan", exportKind: "docx", extension: "DOCX", purpose: "Translate the governed position into role-specific message sequencing and activation guardrails." },
  { id: "sales-deck-outline", title: "Sales-Deck Outline", artifactType: "Sales-deck outline", exportKind: "pptx-sales-deck", extension: "PPTX", purpose: "Create an editable six-slide enablement structure tied to the selected target and evidence." },
  { id: "message-test-brief", title: "Message-Test Brief", artifactType: "Message-test brief", exportKind: "docx", extension: "DOCX", purpose: "Test proposed role messages, objections, comprehension, credibility, and proof expectations before activation." },
  { id: "customer-proof-request", title: "Customer-Proof Request Brief", artifactType: "Customer-proof request brief", exportKind: "docx", extension: "DOCX", purpose: "Specify the exact customer evidence needed without inventing a reference site, outcome, owner, or date." },
];

const pmmArtifactWorkflowStorageKey = "competition-engine:pmm-artifact-workflow:v1";

function pmmLoadArtifactWorkflow() {
  try {
    const parsed = JSON.parse(localStorage.getItem(pmmArtifactWorkflowStorageKey) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function pmmPersistArtifactWorkflow() {
  try {
    localStorage.setItem(pmmArtifactWorkflowStorageKey, JSON.stringify(state.marketingArtifactWorkflow));
  } catch {
    // Keep the editable workflow available for this session when browser storage is unavailable.
  }
}

function pmmArtifactSegmentId(segment) {
  return `${segment.segment}::${segment.competitor}`;
}

function pmmArtifactWorkflowKey(segment, artifactId) {
  return `${pmmTargetingKey()}::${pmmArtifactSegmentId(segment)}::${artifactId}`;
}

function pmmArtifactWorkflowState(segment, definition) {
  const stored = state.marketingArtifactWorkflow[pmmArtifactWorkflowKey(segment, definition.id)] || {};
  return {
    owner: String(stored.owner || ""),
    dueDate: String(stored.dueDate || ""),
    status: ["Draft", "Blocked", "Ready for review", "Complete"].includes(stored.status) ? stored.status : "Draft",
    successMeasure: String(stored.successMeasure || ""),
  };
}

function pmmArtifactClaims(segment, claimRows) {
  return claimRows.filter((claim) => claim.competitor === segment.competitor && claim.audience === segment.segment);
}

function pmmArtifactEvidenceSources(segment, claims, narrative) {
  const claimSources = claims.flatMap((claim) => [
    ...(claim.sources || []),
    ...(claim.evidenceRecords || []).map((record) => ({ ...record, url: record.url, label: record.label })),
  ]);
  const roleSources = segment.roles.flatMap((role) => role.sources || []);
  return pmmDeduplicateSources([
    ...(segment.decision.exactSources || []),
    ...(narrative?.sources || []),
    ...claimSources,
    ...roleSources,
  ]).slice(0, 18);
}

function pmmArtifactWarnings(segment, claims, narrative) {
  const warnings = [];
  if (!claims.length) warnings.push("No governed claim registry row matches this segment and competitor. Claim content is unresolved.");
  if (claims.some((claim) => claim.approvalEstablished !== true)) warnings.push("One or more included claims have no established legal/claims approval. The output must remain DRAFT — NOT APPROVED.");
  const unsupported = claims.filter((claim) => claim.substantiationStatus === "Unsupported");
  if (unsupported.length) warnings.push(`${unsupported.length} included claim${unsupported.length === 1 ? " is" : "s are"} Unsupported after compatibility review.`);
  const inapplicable = claims.flatMap((claim) => claim.evidenceRecords || []).filter((record) => record.compatibility?.status === "Inapplicable");
  if (inapplicable.length) warnings.push(`${inapplicable.length} evidence record${inapplicable.length === 1 ? " is" : "s are"} Inapplicable and cannot be used as proof.`);
  if (["contradiction", "unsupported"].includes(segment.decision.governingTrace?.status)) warnings.push(segment.decision.governingTrace.message);
  if (["contradiction", "unsupported"].includes(narrative?.governingTrace?.status)) warnings.push(narrative.governingTrace.message);
  return [...new Set(warnings)];
}

function pmmArtifactModel(definition, segment, governingPosition, claimRows, narratives) {
  const claims = pmmArtifactClaims(segment, claimRows);
  const narrative = narratives.find((item) => item.competitor === segment.competitor);
  const evidenceFootnotes = pmmArtifactEvidenceSources(segment, claims, narrative);
  const proof = claims.flatMap((claim) => claim.evidenceRecords || [])
    .filter((record) => record.compatibility?.status === "Applicable")
    .map((record) => ({ label: record.label, detail: record.detail, url: record.url }));
  const caveats = [...new Set([
    ...claims.map((claim) => claim.caveat).filter(Boolean),
    ...(narrative?.limitations || []),
    ...(proof.length ? [] : ["No claim-compatible proof is currently available for the included proposed wording."]),
  ])];
  return {
    ...definition,
    id: `${pmmArtifactSegmentId(segment)}::${definition.id}`,
    definitionId: definition.id,
    segmentId: pmmArtifactSegmentId(segment),
    target: `${segment.segment}${segment.application !== "All" ? ` · ${segment.application}` : ""} · ${segment.competitor}`,
    buyingSituation: pmmTargetingDisplayValue(segment.buyingSituation, governingPosition.buyingSituation),
    governingPosition: {
      id: governingPosition.id,
      primaryValueProposition: governingPosition.primaryValueProposition,
      pointOfParity: governingPosition.pointOfParity,
      pointOfDifference: governingPosition.pointOfDifference,
      approvalState: governingPosition.approvalState,
    },
    roleMessages: segment.roles.map((role) => ({ role: role.label, message: role.message, classification: role.classificationLabel })),
    competitorResponse: narrative?.counterPosition || segment.decision.counterPosition || "Competitor response unresolved.",
    claims: claims.map((claim) => ({
      competitor: claim.competitor,
      wording: claim.proposedClaimWording,
      approvalState: claim.approvalState,
      approvalEstablished: claim.approvalEstablished,
      approvedWording: claim.approvedWording,
      substantiationStatus: claim.substantiationStatus,
      comparabilityStatus: claim.comparabilityStatus,
      nextRequiredAction: claim.nextRequiredAction,
    })),
    proof,
    caveats,
    objections: segment.roles.map((role) => ({ role: role.label, objection: role.objection, response: role.message })),
    warnings: pmmArtifactWarnings(segment, claims, narrative),
    evidenceFootnotes,
    workflow: pmmArtifactWorkflowState(segment, definition),
    workflowKey: pmmArtifactWorkflowKey(segment, definition.id),
  };
}

function pmmArtifactProductionModel(buyingCommittee, governingPosition, claimRows, narratives) {
  const segments = buyingCommittee.segments;
  if (!segments.length) return { segments: [], selectedSegment: null, artifacts: [], approvedClipboardText: "" };
  const selectedSegment = segments.find((segment) => pmmArtifactSegmentId(segment) === state.marketingArtifactSegmentId) || segments[0];
  state.marketingArtifactSegmentId = pmmArtifactSegmentId(selectedSegment);
  const artifacts = pmmArtifactDefinitions.map((definition) => pmmArtifactModel(definition, selectedSegment, governingPosition, claimRows, narratives));
  const selectedClaims = pmmArtifactClaims(selectedSegment, claimRows);
  return {
    segments,
    selectedSegment,
    selectedSegmentId: pmmArtifactSegmentId(selectedSegment),
    artifacts,
    selectedClaims,
    approvedClipboardText: globalThis.PmmArtifactExports?.approvedClipboardText(selectedClaims) || "",
  };
}

function pmmArtifactStatusOptions(selected) {
  return ["Draft", "Blocked", "Ready for review", "Complete"].map((status) => `<option value="${escapeHtml(status)}" ${status === selected ? "selected" : ""}>${escapeHtml(status)}</option>`).join("");
}

function pmmArtifactWorkflowMarkup(artifact) {
  const inputId = artifact.id.replace(/[^a-z0-9]/gi, "");
  return `<form class="pmm-artifact-workflow" data-artifact-workflow-key="${escapeHtml(artifact.workflowKey)}" aria-label="${escapeHtml(`${artifact.title} production workflow`)}">
    <label for="pmmArtifactOwner${inputId}">Owner<input id="pmmArtifactOwner${inputId}" type="text" value="${escapeHtml(artifact.workflow.owner)}" placeholder="Owner needed" data-pmm-artifact-field="owner" data-workflow-key="${escapeHtml(artifact.workflowKey)}"></label>
    <label for="pmmArtifactDue${inputId}">Due date<input id="pmmArtifactDue${inputId}" type="date" value="${escapeHtml(artifact.workflow.dueDate)}" data-pmm-artifact-field="dueDate" data-workflow-key="${escapeHtml(artifact.workflowKey)}"><small>${artifact.workflow.dueDate ? "Editable workflow date" : "Deadline needed"}</small></label>
    <label for="pmmArtifactStatus${inputId}">Production status <small>Not claims approval</small><select id="pmmArtifactStatus${inputId}" data-pmm-artifact-field="status" data-workflow-key="${escapeHtml(artifact.workflowKey)}">${pmmArtifactStatusOptions(artifact.workflow.status)}</select></label>
    <label for="pmmArtifactMeasure${inputId}">Success measure<textarea id="pmmArtifactMeasure${inputId}" rows="2" placeholder="Measure needed" data-pmm-artifact-field="successMeasure" data-workflow-key="${escapeHtml(artifact.workflowKey)}">${escapeHtml(artifact.workflow.successMeasure)}</textarea></label>
  </form>`;
}

function pmmArtifactClaimsMarkup(artifact) {
  if (!artifact.claims.length) return `<p class="pmm-artifact-unresolved">No governed claim matches the selected segment and competitor.</p>`;
  return `<ul>${artifact.claims.map((claim) => `<li><strong>${escapeHtml(claim.wording)}</strong><span>${escapeHtml(claim.substantiationStatus)} · ${escapeHtml(claim.approvalState)}</span></li>`).join("")}</ul>`;
}

function pmmArtifactEvidenceMarkup(artifact) {
  if (!artifact.evidenceFootnotes.length) return `<p class="pmm-artifact-unresolved">Evidence footnotes unavailable.</p>`;
  return `<ol>${artifact.evidenceFootnotes.slice(0, 10).map((source) => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.label || source.sourceName || "Exact evidence")} ↗</a></li>`).join("")}</ol>`;
}

function pmmArtifactCardMarkup(artifact, index) {
  const approvalEstablished = artifact.claims.length > 0 && artifact.claims.every((claim) => claim.approvalEstablished === true && claim.approvedWording);
  return `<article class="pmm-artifact-card ${approvalEstablished ? "pmm-artifact-approved" : "pmm-artifact-draft"}" data-artifact-id="${escapeHtml(artifact.id)}" data-artifact-approval="${approvalEstablished ? "approved" : "draft"}">
    <header><div><span>Artifact ${index + 1} · ${escapeHtml(artifact.extension)}</span><h4>${escapeHtml(artifact.title)}</h4><p>${escapeHtml(artifact.purpose)}</p></div><strong>${approvalEstablished ? "APPROVAL ESTABLISHED" : "DRAFT — NOT APPROVED"}</strong></header>
    <div class="pmm-artifact-target"><span>Target / buying situation</span><strong>${escapeHtml(artifact.target)}</strong><p>${escapeHtml(artifact.buyingSituation)}</p></div>
    ${pmmArtifactWorkflowMarkup(artifact)}
    <div class="pmm-artifact-actions"><button type="button" data-pmm-artifact-export="${escapeHtml(artifact.id)}">Export ${escapeHtml(artifact.extension)}</button><span aria-live="polite"></span></div>
    <details ${index < 4 ? "open" : ""}><summary>Review governed artifact content</summary><div class="pmm-artifact-content">
      <section><h5>Governing Position</h5><p>${escapeHtml(artifact.governingPosition.primaryValueProposition)}</p><small>Parity: ${escapeHtml(artifact.governingPosition.pointOfParity)} · Difference: ${escapeHtml(artifact.governingPosition.pointOfDifference)} · ${escapeHtml(artifact.governingPosition.approvalState)}</small></section>
      <section><h5>Role-Specific Messages</h5><ul>${artifact.roleMessages.map((role) => `<li><strong>${escapeHtml(role.role)}</strong><span>${escapeHtml(role.message)}</span><small>${escapeHtml(role.classification)}</small></li>`).join("")}</ul></section>
      <section><h5>Competitor Response</h5><p>${escapeHtml(artifact.competitorResponse)}</p><small>Proposed — not approved unless the included claim record establishes otherwise.</small></section>
      <section><h5>Claims and Approval State</h5>${pmmArtifactClaimsMarkup(artifact)}</section>
      <section><h5>Proof and Caveats</h5>${artifact.proof.length ? `<ul>${artifact.proof.map((proof) => `<li>${escapeHtml(proof.detail || proof.label)}</li>`).join("")}</ul>` : `<p class="pmm-artifact-unresolved">Compatible proof unavailable.</p>`}<ul class="pmm-artifact-caveats">${artifact.caveats.map((caveat) => `<li>${escapeHtml(caveat)}</li>`).join("")}</ul></section>
      <section><h5>Objection Handling</h5><ul>${artifact.objections.map((item) => `<li><strong>${escapeHtml(item.role)} · ${escapeHtml(item.objection)}</strong><span>${escapeHtml(item.response)}</span></li>`).join("")}</ul></section>
      <section class="pmm-artifact-warnings"><h5>Unsupported-Content Warnings</h5>${artifact.warnings.length ? `<ul>${artifact.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>` : `<p>No unsupported-content warning is active.</p>`}</section>
      <section class="pmm-artifact-footnotes"><h5>Evidence Footnotes</h5>${pmmArtifactEvidenceMarkup(artifact)}</section>
    </div></details>
  </article>`;
}

function renderMarketingActivationBacklog(decisions, governingPosition, breakReport, activationActions = [], artifactProduction = null) {
  const target = byId("pmmActivationBacklog");
  const breakMarkup = pmmBreakReportMarkup(breakReport, governingPosition.targeting);
  if (!decisions.length || !artifactProduction?.selectedSegment) {
    target.innerHTML = `${breakMarkup}${pmmEmptyState("No PMM artifact can be produced under the active hierarchical target. The export retains this unresolved state.")}`;
    return;
  }
  const approvedTextAvailable = Boolean(artifactProduction.approvedClipboardText);
  target.innerHTML = `
    ${breakMarkup}
    <div class="pmm-backlog-intro">
      <div><div class="pmm-eyebrow">Artifact Production Workflow</div><h3>Governed PMM Artifacts for the Selected Segment</h3><p>Every output inherits the active hierarchy and Governing Position. Editable workflow fields persist in this browser; they are not formal assignments or claims approval records.</p></div>
      <div class="pmm-artifact-governance"><strong>DRAFT — NOT APPROVED</strong><span>Applied whenever any included claim lacks explicit approval.</span></div>
    </div>
    <div class="pmm-artifact-toolbar">
      <label>Artifact target segment<select data-pmm-artifact-segment>${artifactProduction.segments.map((segment) => `<option value="${escapeHtml(pmmArtifactSegmentId(segment))}" ${pmmArtifactSegmentId(segment) === artifactProduction.selectedSegmentId ? "selected" : ""}>${escapeHtml(segment.segment)} · ${escapeHtml(segment.competitor)}</option>`).join("")}</select></label>
      <div><button type="button" data-pmm-claims-csv>Export claims registry CSV</button><button type="button" data-pmm-copy-approved ${approvedTextAvailable ? "" : "disabled"}>${approvedTextAvailable ? "Copy approved text only" : "No approved text to copy"}</button><span aria-live="polite"></span></div>
    </div>
    <p class="pmm-action-scope" role="note"><strong>Export governance:</strong> PPTX for battlecards and sales decks · DOCX for briefs and claims sheets · CSV for the governed claims registry · clipboard output includes approved wording only.</p>
    <div class="pmm-artifact-grid" role="list">${artifactProduction.artifacts.map((artifact, index) => pmmArtifactCardMarkup(artifact, index)).join("")}</div>`;
}

function pmmAppendixRecord({ title, type, sourceName, date, confidence, description, url, caveat = "", linkAvailable = true }) {
  return {
    title: pmmUsableText(title, "Evidence title unresolved"),
    type: pmmUsableText(type, "Observed public evidence"),
    sourceName: pmmUsableText(sourceName, "Source name unresolved"),
    date: date || "",
    confidence: Number.isFinite(Number(confidence)) ? Number(confidence) : null,
    description: pmmUsableText(description),
    url: isHttpUrl(url) ? url : "",
    caveat: pmmUsableText(caveat),
    linkAvailable,
  };
}

function pmmAppendixLaunchConferenceRecords() {
  const launches = currentLaunches().map((launch) => pmmAppendixRecord({
    title: `${launch.competitor}: ${launch.product || launch.title}`,
    type: "Observed official launch",
    sourceName: launch.sourceName || "Official product source",
    date: launch.date,
    confidence: launch.confidence,
    description: launch.summary || launch.signalType,
    url: timelineUrlForLaunch(launch),
  }));
  const conferences = currentConferenceSources().map((event) => {
    const competitorStatus = (event.competitorWatch || [])
      .map((item) => `${item.name}: ${item.status}`)
      .join(" · ");
    return pmmAppendixRecord({
      title: event.eventName,
      type: "Observed official conference record",
      sourceName: "Official event page",
      date: event.startDate,
      description: competitorStatus || event.annualTheme,
      url: event.website || event.monitoringLinks?.[0]?.url,
      caveat: (event.competitorContent || []).some((item) => /expected|not confirmed/i.test(item.evidenceStatus || ""))
        ? "Some competitor participation detail is expected—not confirmed; open the event source before use."
        : "Event presence does not establish claim adoption or performance.",
    });
  });
  return [...launches, ...conferences].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}

function pmmAppendixApplicationPublicationRecords(signals) {
  const notes = currentCompetitorApplicationNotes().map((note) => pmmAppendixRecord({
    title: `${note.competitor}: ${note.title}`,
    type: note.sourceType || "Observed official application note",
    sourceName: `${note.competitor} official source`,
    date: note.date,
    description: note.evidenceStatement,
    url: note.sourceUrl,
    caveat: "An application note demonstrates a published workflow; it does not establish comparative superiority or market adoption.",
  }));
  const publications = signals
    .filter((signal) => signal.category === "Scientific application intelligence" || /publication|journal|pubmed/i.test(`${signal.signalType} ${signal.sourceName}`))
    .map((signal) => pmmAppendixRecord({
      title: `${signal.competitor}: ${signal.title}`,
      type: signal.signalType || "Observed publication record",
      sourceName: signal.sourceName || "Publication source",
      date: signal.date,
      description: signal.summary,
      url: signal.sourceUrl,
      caveat: "Publication activity is scientific evidence, not proof of commercial importance, adoption, or competitive ownership.",
    }));
  return pmmDeduplicateSources([...notes, ...publications]);
}

function pmmAppendixFilingPartnershipRecords(signals) {
  const filings = currentFilingInsights().map((item) => pmmAppendixRecord({
    title: `${item.competitor}: ${item.headline}`,
    type: `Observed ${item.filingType || "company filing"}`,
    sourceName: item.sourceName || "Company filing",
    date: item.date,
    description: item.evidence || item.whyItMatters,
    url: item.sourceUrl,
    caveat: "A company filing supports the reported corporate statement; it does not by itself validate a product claim.",
  }));
  const partnerships = currentStrategicSignals(signals).map((signal) => pmmAppendixRecord({
    title: `${signal.competitor}: ${signal.title}`,
    type: "Observed partnership or strategic move",
    sourceName: signal.sourceName || "Public company source",
    date: signal.date,
    description: signal.summary,
    url: signal.sourceUrl,
    caveat: "A partnership announcement establishes the relationship or activity—not customer adoption or delivered performance.",
  }));
  return pmmDeduplicateSources([...filings, ...partnerships]);
}

function pmmAppendixOtherPublicEvidenceRecords(signals, groupedRecords) {
  const groupedUrls = new Set(groupedRecords.map((record) => canonicalEvidenceUrl(record.url)).filter(Boolean));
  return pmmDeduplicateSources(signals
    .filter((signal) => isHttpUrl(signal.sourceUrl) && !groupedUrls.has(canonicalEvidenceUrl(signal.sourceUrl)))
    .map((signal) => pmmAppendixRecord({
      title: `${signal.competitor}: ${signal.title}`,
      type: `Observed public evidence · ${signal.category || signal.signalType || "classification unresolved"}`,
      sourceName: signal.sourceName || "Public evidence source",
      date: signal.date,
      description: signal.summary,
      url: signal.sourceUrl,
      caveat: "This record is retained for traceability and does not create a PMM recommendation by itself.",
    })));
}

function pmmAppendixCustomerLanguageRecords() {
  const records = currentCustomerVoiceItems().flatMap((item) => customerVoiceSourceLinks(item).map((link) => pmmAppendixRecord({
    title: link.label || `${item.company}: ${item.product}`,
    type: "Observed public customer-language record",
    sourceName: item.sourceName || "Public customer source",
    date: link.sourceDate,
    confidence: item.confidence,
    description: pmmObservedCustomerLanguage(item) || item.customerLanguageSignal,
    url: link.url,
    caveat: ["reddit", "community_forum"].includes(normalizedCustomerVoiceSourceType(link.sourceType))
      ? "Forum evidence can surface objections and language, but is complaint-biased and not representative market research."
      : "A public customer record is directional evidence and is not representative market research.",
  })));
  return pmmDeduplicateSources(records);
}

function pmmAppendixSourceCoverageRecords() {
  const selectedCompetitor = filters.competitor.value;
  return (state.sourceCatalog?.sources || [])
    .filter((source) => selectedCompetitor === "All"
      ? !source.competitor || marketingBattlecardCompetitors.includes(source.competitor)
      : source.competitor === selectedCompetitor)
    .filter((source) => filters.technology.value === "All" || technologyMatchesFilter(
      (source.signalCoverage || []).join(" "),
      filters.technology.value,
      `${source.source} ${(source.signalCoverage || []).join(" ")}`,
    ))
    .filter((source) => pmmTargetingMatches(source))
    .map((source) => pmmAppendixRecord({
      title: source.source,
      type: `Source coverage · ${source.group || "Unclassified"}`,
      sourceName: source.competitor || "Market-wide source",
      date: String(source.lastExtractionCheck || "").slice(0, 10),
      description: `${source.extractionStatus || "Extraction status unresolved"} · ${source.extractionReason || "Coverage detail unresolved"}`,
      url: source.url,
      caveat: source.health === "good"
        ? "A working source improves traceability; it does not establish that coverage is complete."
        : `Link health is ${source.health || "unresolved"}${source.issue ? `: ${source.issue}` : "."}`,
      linkAvailable: source.health !== "bad",
    }));
}

function pmmAppendixHistoricalCapabilityRecords() {
  const selectedCompetitor = filters.competitor.value;
  const competitorProducts = (state.historicalProductCatalog?.products || [])
    .filter((product) => selectedCompetitor === "All"
      ? marketingBattlecardCompetitors.includes(product.competitor)
      : product.competitor === selectedCompetitor)
    .filter((product) => technologyMatchesFilter(
      product.technology,
      filters.technology.value,
      `${product.product} ${product.productFamily || ""} ${product.subtechnology || ""}`,
    ));
  const watersProducts = selectedCompetitor === "All"
    ? (state.historicalWatersCatalog?.products || []).filter((product) => technologyMatchesFilter(
      product.technology,
      filters.technology.value,
      product.product,
    ))
    : [];
  const historical = [...competitorProducts, ...watersProducts].map((product) => pmmAppendixRecord({
    title: `${product.competitor || product.company}: ${product.product}`,
    type: "Observed historical product record",
    sourceName: product.sourceName || "Official historical source",
    date: product.introducedYear ? String(product.introducedYear) : "",
    confidence: product.confidence,
    description: product.dateBasis ? `${product.dateBasis} year` : "Manufacturer introduction year or earliest dated official record.",
    url: product.sourceUrl,
    caveat: "Historical manufacturer archives are incomplete; this is not an exhaustive SKU catalog.",
  }));
  const launchCompetitors = new Map([
    ...(state.productData?.launches || []).map((launch) => [launch.id, launch.competitor]),
    ...(state.historicalProductCatalog?.products || []).map((product) => [product.id, product.competitor]),
  ]);
  const technical = (state.technicalComparisons?.profiles || []).flatMap((profile) => {
    const competitor = launchCompetitors.get(profile.launchId) || "Competitor unresolved";
    if (selectedCompetitor !== "All" && competitor !== selectedCompetitor) return [];
    return (profile.rows || []).flatMap((row) => [
      pmmAppendixRecord({
        title: `${competitor} versus Waters: ${row.dimension}`,
        type: `Observed technical source · ${row.evidenceType || "classification unresolved"}`,
        sourceName: `${competitor} source`,
        date: profile.asOfDate,
        description: row.interpretation,
        url: row.competitorSourceUrl,
        caveat: "Published specifications may use different conditions; review the comparison limitation before reuse.",
      }),
      pmmAppendixRecord({
        title: `Waters comparison source: ${row.dimension}`,
        type: `Observed technical source · ${row.evidenceType || "classification unresolved"}`,
        sourceName: "Waters public source",
        date: profile.asOfDate,
        description: row.watersValue,
        url: row.watersSourceUrl,
        caveat: "Technical evidence does not establish legal approval for a marketing claim.",
      }),
    ]);
  });
  return [...historical, ...technical]
    .filter((record) => record.url)
    .filter((record) => pmmTargetingMatches(record))
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}

function pmmAppendixRecordMarkup(record) {
  const confidence = record.confidence == null
    ? "Confidence unresolved"
    : `${confidenceLabel(record.confidence)} confidence · ${record.confidence}/100`;
  const date = record.date
    ? /^\d{4}$/.test(record.date) ? record.date : formatDate(record.date)
    : "Date unresolved";
  const sourceLink = record.url && record.linkAvailable
    ? `<a href="${escapeHtml(record.url)}" target="_blank" rel="noreferrer">Open exact source ↗</a>`
    : `<span class="pmm-unresolved">Source link unavailable</span>`;
  const consolidationNote = record.mergedRecordCount > 1
    ? `<small class="pmm-appendix-record-caveat">${record.mergedRecordCount} evidence records share this canonical URL and are counted once.</small>`
    : "";
  return `<article class="pmm-appendix-record">
    <div><span>${escapeHtml(record.type)}</span><strong>${escapeHtml(record.title)}</strong>${record.description ? `<p>${escapeHtml(record.description)}</p>` : ""}<small>${escapeHtml(record.sourceName)} · ${escapeHtml(date)} · ${escapeHtml(confidence)}${record.sourceDomain ? ` · ${escapeHtml(record.sourceDomain)}` : ""}</small>${record.caveat ? `<small class="pmm-appendix-record-caveat">${escapeHtml(record.caveat)}</small>` : ""}${consolidationNote}</div>
    ${sourceLink}
  </article>`;
}

function pmmAppendixGroupMarkup(group) {
  return `<details class="pmm-appendix-group">
    <summary><span><strong>${escapeHtml(group.title)}</strong><small>${escapeHtml(group.description)}</small></span><b>${group.records.length} record${group.records.length === 1 ? "" : "s"}</b></summary>
    <div class="pmm-appendix-group-body">${group.caveat ? `<p class="pmm-appendix-group-caveat">${escapeHtml(group.caveat)}</p>` : ""}${group.records.length
      ? `<div class="pmm-appendix-records" tabindex="0" aria-label="${escapeHtml(group.title)} evidence records">${group.records.map(pmmAppendixRecordMarkup).join("")}</div>`
      : pmmEmptyState(group.emptyState)}</div>
  </details>`;
}

function marketingEvidenceAppendixModel(signals) {
  const launchConferenceRecords = pmmAppendixLaunchConferenceRecords();
  const applicationPublicationRecords = pmmAppendixApplicationPublicationRecords(signals);
  const filingPartnershipRecords = pmmAppendixFilingPartnershipRecords(signals);
  const customerLanguageRecords = pmmAppendixCustomerLanguageRecords();
  const otherPublicEvidenceRecords = pmmAppendixOtherPublicEvidenceRecords(signals, [
    ...launchConferenceRecords,
    ...applicationPublicationRecords,
    ...filingPartnershipRecords,
    ...customerLanguageRecords,
  ]);
  const rawGroups = [
    {
      title: "Launches and Conferences",
      description: "Official launches, event programs, sponsorship records, and confirmation caveats.",
      caveat: "Raw launch and event records are reference material; presence and publication do not prove adoption or performance.",
      records: launchConferenceRecords,
      emptyState: "No launch or conference evidence matches the active filters.",
    },
    {
      title: "Application Notes and Publications",
      description: "Exact application-note and article records, without publication-volume interpretation.",
      caveat: "Detailed publication counts and trend tables remain secondary; individual records are provided for verification.",
      records: applicationPublicationRecords,
      emptyState: "No application-note or publication record matches the active filters.",
    },
    {
      title: "Filings and Partnerships",
      description: "SEC filing excerpts and official partnership or strategic-move records.",
      caveat: "Corporate evidence establishes reported activity, not product-claim substantiation.",
      records: filingPartnershipRecords,
      emptyState: "No filing or partnership evidence matches the active filters.",
    },
    {
      title: "Other Public Evidence Records",
      description: "Remaining filtered records from the Public Evidence Library that are not already grouped above.",
      caveat: "These records remain available for source review but do not create recommendations or headline PMM metrics.",
      records: otherPublicEvidenceRecords,
      emptyState: "No additional public evidence record matches the active filters.",
    },
    {
      title: "Customer-Language Records",
      description: "Exact public records used to surface buyer language, objections, and criteria.",
      caveat: "Generic sentiment summaries are intentionally omitted. Forum evidence is complaint-biased and not representative market research.",
      records: customerLanguageRecords,
      emptyState: "No customer-language record matches the active filters.",
    },
    {
      title: "Source Coverage and Confidence",
      description: "Source health, extraction status, recency, and explicit confidence gaps.",
      caveat: "A working source is not evidence that monitoring is complete or representative.",
      records: pmmAppendixSourceCoverageRecords(),
      emptyState: "No source-coverage record matches the active competitor and technology filters.",
    },
    {
      title: "Historical Product and Capability Records",
      description: "Historical product introductions and detailed public technical-comparison sources.",
      caveat: "Historical records apply competitor and technology filters but intentionally ignore the selected horizon. Geography and market fields are unavailable for much of the historical catalog.",
      records: pmmAppendixHistoricalCapabilityRecords(),
      emptyState: "No historical product or technical-comparison record matches the active competitor and technology filters.",
    },
  ];
  const appendix = PmmDataContract.consolidateAppendixGroups(rawGroups);
  return { ...appendix, customerLanguageRecords };
}

function renderMarketingEvidenceAppendix(appendix) {
  const target = byId("pmmEvidenceAppendix");
  const displayedRecords = appendix.groups.reduce((total, group) => total + group.records.length, 0);
  target.innerHTML = `
    <div class="pmm-appendix-intro">
      <div><div class="pmm-eyebrow">Secondary Intelligence · Collapsed by Default</div><h3>Evidence Without Decision-Flow Competition</h3><p>Leadership synthesis remains in the Leadership view. Raw feeds, catalogs, coverage diagnostics, and detailed records are consolidated here and do not create PMM recommendations by themselves.</p></div>
      <div class="pmm-appendix-summary" aria-label="Appendix evidence summary"><strong>${appendix.uniqueSourceCount}</strong><span>unique canonical source URLs</span><small>${displayedRecords} displayed entries · ${appendix.duplicateRecordCount} duplicate record${appendix.duplicateRecordCount === 1 ? "" : "s"} consolidated${appendix.unlinkedRecordCount ? ` · ${appendix.unlinkedRecordCount} unlinked record${appendix.unlinkedRecordCount === 1 ? "" : "s"}` : ""}</small></div>
    </div>
    <div class="pmm-appendix-groups">${appendix.groups.map(pmmAppendixGroupMarkup).join("")}</div>`;
}

function normalizeMarketingClaimFilters(rows) {
  const audiences = pmmClaimsFilterOptions(rows.map((row) => ({ ...row, audienceCriterion: `${row.audience} · ${row.buyingCriterion}` })), "audienceCriterion");
  const classifications = Object.values(pmmClaimEvidenceClassifications);
  if (state.marketingClaimsFilters.audience !== "All" && !audiences.includes(state.marketingClaimsFilters.audience)) state.marketingClaimsFilters.audience = "All";
  if (state.marketingClaimsFilters.classification !== "All" && !classifications.includes(state.marketingClaimsFilters.classification)) state.marketingClaimsFilters.classification = "All";
  if (state.marketingClaimsFilters.readiness !== "All" && !pmmClaimReadinessValues.includes(state.marketingClaimsFilters.readiness)) state.marketingClaimsFilters.readiness = "All";
}

function pmmMetricPill({ id, label, value, target, definition }) {
  const tooltipId = `pmm-metric-${id}-definition`;
  return `<a class="source-pill source-pill-link pmm-metric-pill" href="#${escapeHtml(target)}" data-evidence-target="${escapeHtml(target)}" data-pmm-metric="${escapeHtml(id)}" aria-describedby="${tooltipId}"><span>${escapeHtml(label)} <b class="pmm-metric-info" aria-hidden="true">i</b></span><strong>${value}<small>View →</small></strong><span id="${tooltipId}" class="pmm-metric-tooltip" role="tooltip">${escapeHtml(definition)}</span></a>`;
}

function renderMarketingSourceCounts(model) {
  const { kpis } = model;
  byId("sourceCounts").innerHTML = `
    <div class="source-pill"><span>Role view</span><strong>Product Marketing</strong></div>
    <div class="source-pill"><span>Time window</span><strong>${escapeHtml(horizonLabel())}</strong></div>
    ${pmmMetricPill({ id: "positioning-decisions", label: "Positioning decisions", value: kpis.positioningDecisions, target: "pmm-positioning-decisions", definition: "Displayed positioning-decision cards. Calculation: eligible evidence-backed decision candidates after all global filters, limited to three. Unit: displayed cards. Matrix-only claim filters do not apply." })}
    ${pmmMetricPill({ id: "claims-awaiting-approval", label: "Claims without approval", value: kpis.claimsAwaitingApproval, target: "pmm-claims-proof", definition: "Displayed registry rows with no established legal/claims approval record. Calculation: visible claim rows where approvalEstablished is false, regardless of substantiation status. Unit: displayed rows. Global and claims-registry filters apply." })}
    ${pmmMetricPill({ id: "exact-customer-sources", label: "Exact customer sources", value: kpis.customerLanguageSources, target: "pmm-audience-criteria", definition: "Unique canonical URLs in the filtered customer-language evidence set. Calculation: valid exact customer URLs after URL normalization and deduplication. Unit: unique URLs, not records or independent organizations. All global filters apply." })}
    ${pmmMetricPill({ id: "direct-evidence-sources", label: "Direct evidence sources", value: kpis.directEvidenceSources, target: "pmm-evidence-appendix", definition: "Unique canonical URLs displayed in the Evidence appendix. Calculation: valid linked appendix records after global URL deduplication; unlinked records are excluded. Unit: unique URLs, not records or independent organizations. All applicable global filters apply; the historical group intentionally ignores horizon, geography, and market where those fields do not exist." })}`;
}

function pmmTargetingBreakReportModel(claimRows, buyingCommittee, positioningDecisions, narratives, adoptionValuePlans = []) {
  const adoptionEconomicGaps = adoptionValuePlans.flatMap((plan) => [
    ...(plan.evc.sensitivity.missing.length ? [`${plan.segment} EVC has ${plan.evc.sensitivity.missing.length} incomplete low/base/high assumption range${plan.evc.sensitivity.missing.length === 1 ? "" : "s"}.`] : []),
    ...(plan.evc.sensitivity.invalid.length ? [`${plan.segment} EVC has ${plan.evc.sensitivity.invalid.length} invalid sensitivity range${plan.evc.sensitivity.invalid.length === 1 ? "" : "s"}; low must be ≤ base ≤ high.`] : []),
    ...(plan.evc.sourcedValues.length ? [] : [`${plan.segment} EVC has no sourced numeric time, cost, or outcome value.`]),
    `${plan.segment} EVC monetary conversion inputs and approved economic-model ownership are unresolved.`,
  ]);
  return PmmDataContract.buildTargetingBreakReport({
    claimRows,
    buyingCommittee,
    governingTraces: [
      ...positioningDecisions.map((decision) => ({ ...decision.governingTrace, label: `${decision.competitor} positioning decision` })),
      ...narratives.map((narrative) => ({ ...narrative.governingTrace, label: `${narrative.competitor} competitive narrative` })),
    ],
    requiredBuyerRoles: pmmBuyingCommitteeRoleDefinitions.map((role) => ({ key: role.key, label: role.label })),
    economicAssumptions: adoptionEconomicGaps.length ? adoptionEconomicGaps : [
      "No priority-segment EVC model can be created under the active filters.",
    ],
  });
}

function renderMarketingTargetingContext(model) {
  const target = byId("pmmTargetingContext");
  const targeting = model.governingPosition.targeting;
  const path = [
    ["Market", pmmTargetingDisplayValue(targeting.market, "All markets")],
    ["Application / workflow", pmmTargetingDisplayValue(targeting.application, "All supported applications")],
    ["Buying situation", pmmTargetingDisplayValue(targeting.buyingSituation, "All buying situations")],
    ["Geography", pmmTargetingDisplayValue(targeting.geography, "All geographies")],
    ["Buyer role", pmmTargetingDisplayValue(targeting.buyerRole, "Full buying committee")],
  ];
  target.innerHTML = `<div><div class="pmm-eyebrow">Canonical Targeting Selector</div><h3>Hierarchical Targeting</h3><p id="pmmTargetingHelp">Market and geography reuse the global filters. Application, buying situation, and buyer role narrow the same canonical PMM model; no downstream artifact keeps an earlier segment silently.</p></div>
    <ol class="pmm-targeting-path">${path.map(([label, value]) => `<li><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></li>`).join("")}</ol>
    <div class="pmm-targeting-reconciliation" aria-live="polite"><strong>${model.contexts.length} target-compatible competitor${model.contexts.length === 1 ? "" : "s"}</strong><span>${model.positioningDecisions.length} positioning decision${model.positioningDecisions.length === 1 ? "" : "s"} · ${model.claimRows.length} governed claim${model.claimRows.length === 1 ? "" : "s"} · ${model.appendix.uniqueSourceCount} evidence URL${model.appendix.uniqueSourceCount === 1 ? "" : "s"}</span></div>
    <div class="pmm-targeting-priority"><span>Competitor priority · evidence fit, not market attractiveness</span>${model.contexts.length ? `<ol>${model.contexts.map((context, index) => `<li><b>${index + 1}</b><strong>${escapeHtml(context.competitor)}</strong><small>${escapeHtml(context.targetPriority.label)}</small></li>`).join("")}</ol>` : `<p>No competitor has target-compatible evidence under this hierarchy.</p>`}</div>`;
}

function pmmBreakReportList(items, itemMarkup, emptyMessage) {
  return items.length ? `<ul>${items.map(itemMarkup).join("")}</ul>` : `<p class="pmm-break-clear">${escapeHtml(emptyMessage)}</p>`;
}

function pmmBreakReportMarkup(report, targeting) {
  const swingMessage = report.swingChange.changed
    ? `${report.swingChange.baseline} → ${report.swingChange.current}`
    : `${report.swingChange.current}; no change from the comparable market-baseline hypothesis.`;
  return `<section class="pmm-break-report" aria-labelledby="pmmBreakReportTitle">
    <header><div><div class="pmm-eyebrow">Pre-Activation Gate</div><h3 id="pmmBreakReportTitle">What Breaks?</h3><p>These gaps are recalculated for ${escapeHtml(pmmTargetingKey(targeting))}. They remain attached to the export and block unsupported claims from silently carrying between targets.</p></div><strong>${report.unsupportedClaims.length + report.inapplicableProof.length + report.missingBuyerRoles.length + report.missingEconomicAssumptions.length + report.conflictingMessages.length}</strong></header>
    <div class="pmm-break-grid">
      <article><h4>Unsupported claims <span>${report.unsupportedClaims.length}</span></h4>${pmmBreakReportList(report.unsupportedClaims, (row) => `<li><strong>${escapeHtml(row.competitor)}</strong><span>${escapeHtml(row.proposedClaimWording)}</span></li>`, "No unsupported claim rows are present.")}</article>
      <article><h4>Inapplicable proof <span>${report.inapplicableProof.length}</span></h4>${pmmBreakReportList(report.inapplicableProof, (item) => `<li><strong>${escapeHtml(item.record.label || "Evidence record")}</strong><span>Does not match the governed claim dimensions.</span></li>`, "No proof record is currently classified Inapplicable.")}</article>
      <article><h4>Missing buyer roles <span>${report.missingBuyerRoles.length}</span></h4>${pmmBreakReportList(report.missingBuyerRoles, (role) => `<li><span>${escapeHtml(role.label)}</span></li>`, "Every required role has at least one exact target-compatible source.")}</article>
      <article><h4>Missing economic assumptions <span>${report.missingEconomicAssumptions.length}</span></h4>${pmmBreakReportList(report.missingEconomicAssumptions, (item) => `<li><span>${escapeHtml(item)}</span></li>`, "No economic assumption gap detected.")}</article>
      <article><h4>Changed swing attribute <span>${report.swingChange.changed ? "Changed" : "Stable"}</span></h4><p>${escapeHtml(swingMessage)}</p><small>Both values are hypothesis-model calculations, not measured buyer preference.</small></article>
      <article><h4>Governing-position conflicts <span>${report.conflictingMessages.length}</span></h4>${pmmBreakReportList(report.conflictingMessages, (trace) => `<li><strong>${escapeHtml(trace.label || "Downstream message")}</strong><span>${escapeHtml(trace.message)}</span></li>`, "No contradiction or unsupported deviation was detected by the governing-position rule check.")}</article>
    </div>
    <div class="pmm-export-gate"><div><strong>Governed export</strong><span>The export contains only the current hierarchy plus its unresolved and inapplicable states.</span></div><button type="button" data-pmm-export-targeting>Export current PMM snapshot</button></div>
  </section>`;
}

function exportMarketingTargetingSnapshot() {
  const model = state.marketingWorkspaceModel;
  if (!model) return;
  const exportData = {
    generatedAt: new Date().toISOString(),
    dataAsOf: state.data?.asOfDate || null,
    targeting: model.governingPosition.targeting,
    governingPosition: model.governingPosition,
    breakReport: model.breakReport,
    competitorPriority: model.contexts.map((context, index) => ({ rank: index + 1, competitor: context.competitor, ...context.targetPriority })),
    positioningDecisions: model.positioningDecisions,
    claims: model.claimRows,
    narratives: model.narratives,
    activationActions: model.activationActions,
    artifactProduction: model.artifactProduction,
    adoptionValuePlans: model.adoptionValuePlans,
    caveat: "Internal proposed PMM work product. Approval is not established unless an explicit approval record says otherwise.",
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `waters-pmm-${pmmTargetingKey(model.governingPosition.targeting).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildMarketingWorkspaceModel(signals) {
  normalizeMarketingTargeting();
  const contexts = marketingPrioritizedCompetitorContexts(signals);
  const provisionalGoverningPosition = pmmGoverningPosition(contexts);
  const provisionalPositioningDecisions = marketingPositioningDecisionCandidates(contexts, provisionalGoverningPosition);
  const buyingCommittee = pmmBuyingCommitteeModel(provisionalPositioningDecisions, contexts);
  const governingPosition = pmmGoverningPosition(contexts, buyingCommittee.selectedSwingAttribute);
  state.marketingGoverningPosition = governingPosition;
  const marketChoice = pmmMarketChoice(contexts, governingPosition, signals);
  state.marketingMarketChoice = marketChoice;
  const adoptionValuePlans = pmmAdoptionValuePlans(buyingCommittee, contexts, marketChoice);
  const positioningDecisionCandidates = marketingPositioningDecisionCandidates(contexts, governingPosition);
  const claimRows = marketingClaimsProofRows(contexts, governingPosition);
  const positioningDecisions = pmmApplyClaimsRegistryToDecisions(positioningDecisionCandidates, claimRows);
  const narratives = contexts.map((context) => pmmCompetitiveNarrative(context, governingPosition))
    .sort((left, right) => right.score - left.score || right.confidence - left.confidence || left.competitor.localeCompare(right.competitor));
  const activationActions = positioningDecisions.map((decision, index) => pmmActivationDeliverable(decision, index + 1, governingPosition));
  const breakReport = pmmTargetingBreakReportModel(claimRows, buyingCommittee, positioningDecisions, narratives, adoptionValuePlans);
  const artifactProduction = pmmArtifactProductionModel(buyingCommittee, governingPosition, claimRows, narratives);
  normalizeMarketingClaimFilters(claimRows);
  const visibleClaimRows = marketingVisibleClaimRows(claimRows);
  const appendix = marketingEvidenceAppendixModel(signals);
  const kpis = PmmDataContract.buildKpis({
    positioningDecisions,
    visibleClaimRows,
    customerLanguageRecords: appendix.customerLanguageRecords,
    appendix,
  });
  return { contexts, governingPosition, marketChoice, buyingCommittee, adoptionValuePlans, positioningDecisions, claimRows, visibleClaimRows, narratives, activationActions, artifactProduction, breakReport, appendix, kpis };
}

function renderMarketingWorkspace(signals) {
  const model = buildMarketingWorkspaceModel(signals);
  state.marketingWorkspaceModel = model;
  renderMarketingTargetingContext(model);
  renderMarketingPositioningDecisions(model.positioningDecisions, model.governingPosition);
  renderMarketingClaimsProof(model.claimRows, model.visibleClaimRows, model.governingPosition);
  renderMarketingAudienceCriteria(model.appendix.customerLanguageRecords, model.buyingCommittee, model.adoptionValuePlans);
  renderMarketingCompetitiveNarrative(signals, model.governingPosition, model.marketChoice, model.contexts);
  renderMarketingActivationBacklog(model.positioningDecisions, model.governingPosition, model.breakReport, model.activationActions, model.artifactProduction);
  renderMarketingEvidenceAppendix(model.appendix);
  renderMarketingSourceCounts(model);
}

function renderProductComparator() {
  byId("comparisonTitle").textContent = "Product Comparator";
  byId("comparisonSnapshots").hidden = false;
  document.querySelector("#product-comparator .comparison-controls").hidden = false;
  const launches = comparisonLaunches();
  if (!launches.length) {
    byId("comparisonLaunchSelect").innerHTML = "";
    byId("comparisonWatersSelect").innerHTML = "";
    byId("comparisonTitle").textContent = "Product comparator";
    byId("comparisonSnapshots").innerHTML = "";
    byId("comparisonBody").innerHTML = `<div class="empty">No products in the all-time comparison catalog match the active non-time filters.</div>`;
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
  populateComparisonControls();
  renderComparisonBody();
  const panel = byId("product-comparator");
  if (panel.classList.contains("is-collapsed")) setPanelCollapsed(panel, false);
  lockActiveSectionNav(panel.id);
  window.history.replaceState(null, "", `#${panel.id}`);
  scrollToDashboardSection(panel);
}

function setupComparisonPanel() {
  document.addEventListener("click", (event) => {
    const battlecardTrigger = event.target.closest("[data-battlecard-competitor]");
    if (battlecardTrigger && state.view === "Marketing") {
      event.preventDefault();
      state.activeBattlecardCompetitor = battlecardTrigger.dataset.battlecardCompetitor;
      renderMarketingCompetitiveNarrative();
      return;
    }
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
    populateComparisonControls();
    renderComparisonBody();
  });
  byId("comparisonWatersSelect").addEventListener("change", (event) => {
    state.activeWatersComparatorId = event.target.value;
    renderComparisonBody();
  });
}

function pmmUpdateArtifactWorkflowField(control) {
  const workflowKey = control.dataset.workflowKey;
  const field = control.dataset.pmmArtifactField;
  if (!workflowKey || !["owner", "dueDate", "status", "successMeasure"].includes(field)) return false;
  state.marketingArtifactWorkflow[workflowKey] ||= {};
  state.marketingArtifactWorkflow[workflowKey][field] = control.value;
  pmmPersistArtifactWorkflow();
  const artifact = state.marketingWorkspaceModel?.artifactProduction?.artifacts.find((item) => item.workflowKey === workflowKey);
  if (artifact) artifact.workflow[field] = control.value;
  return true;
}

function setupMarketingWorkspaceControls() {
  state.marketingArtifactWorkflow = pmmLoadArtifactWorkflow();
  document.addEventListener("input", (event) => {
    const artifactField = event.target.closest("[data-pmm-artifact-field]");
    if (artifactField && state.view === "Marketing") pmmUpdateArtifactWorkflowField(artifactField);
  });
  document.addEventListener("change", (event) => {
    const artifactSegmentControl = event.target.closest("[data-pmm-artifact-segment]");
    if (artifactSegmentControl && state.view === "Marketing") {
      state.marketingArtifactSegmentId = artifactSegmentControl.value;
      render();
      return;
    }
    const artifactField = event.target.closest("[data-pmm-artifact-field]");
    if (artifactField && state.view === "Marketing") {
      pmmUpdateArtifactWorkflowField(artifactField);
      return;
    }
    const evcBaselineControl = event.target.closest("[data-pmm-evc-baseline]");
    if (evcBaselineControl && state.view === "Marketing") {
      state.marketingEvcBaselines[evcBaselineControl.dataset.planId] = evcBaselineControl.value;
      render();
      return;
    }
    const evcAssumptionControl = event.target.closest("[data-pmm-evc-assumption]");
    if (evcAssumptionControl && state.view === "Marketing") {
      const assumptionKey = pmmEvcAssumptionKey(evcAssumptionControl.dataset.planId, evcAssumptionControl.dataset.baselineId);
      const metricKey = evcAssumptionControl.dataset.metricKey;
      const range = evcAssumptionControl.dataset.range;
      const parsed = evcAssumptionControl.value === "" ? "" : Number(evcAssumptionControl.value);
      if (!["low", "base", "high"].includes(range) || !metricKey || (parsed !== "" && !Number.isFinite(parsed))) return;
      state.marketingEvcAssumptions[assumptionKey] ||= {};
      state.marketingEvcAssumptions[assumptionKey][metricKey] ||= {};
      state.marketingEvcAssumptions[assumptionKey][metricKey][range] = parsed;
      render();
      return;
    }
    const targetingControl = event.target.closest("[data-pmm-target-filter]");
    if (targetingControl && state.view === "Marketing") {
      const key = targetingControl.dataset.pmmTargetFilter;
      if (key in state.marketingTargeting) {
        state.marketingTargeting[key] = targetingControl.value;
        state.marketingClaimsFilters = { readiness: "All", audience: "All", classification: "All" };
        state.activeBattlecardCompetitor = "";
        render();
      }
      return;
    }
    const control = event.target.closest("[data-pmm-claims-filter]");
    if (!control || state.view !== "Marketing") return;
    const key = control.dataset.pmmClaimsFilter;
    if (!(key in state.marketingClaimsFilters)) return;
    state.marketingClaimsFilters[key] = control.value;
    render();
  });
  document.addEventListener("click", async (event) => {
    const artifactExportButton = event.target.closest("[data-pmm-artifact-export]");
    if (artifactExportButton && state.view === "Marketing") {
      event.preventDefault();
      const artifact = state.marketingWorkspaceModel?.artifactProduction?.artifacts.find((item) => item.id === artifactExportButton.dataset.pmmArtifactExport);
      const status = artifactExportButton.parentElement?.querySelector("span");
      if (!artifact || !globalThis.PmmArtifactExports) {
        if (status) status.textContent = "Export unavailable.";
        return;
      }
      artifactExportButton.disabled = true;
      if (status) status.textContent = "Preparing governed export…";
      try {
        const filename = await globalThis.PmmArtifactExports.exportArtifact(artifact);
        if (status) status.textContent = `${filename} downloaded.`;
      } catch (error) {
        if (status) status.textContent = `Export failed: ${error.message}`;
      } finally {
        artifactExportButton.disabled = false;
      }
      return;
    }
    const claimsCsvButton = event.target.closest("[data-pmm-claims-csv]");
    if (claimsCsvButton && state.view === "Marketing") {
      event.preventDefault();
      const status = claimsCsvButton.parentElement?.querySelector("span");
      try {
        const filename = globalThis.PmmArtifactExports.exportClaimsCsv(state.marketingWorkspaceModel.claimRows, state.marketingWorkspaceModel.governingPosition.targeting);
        if (status) status.textContent = `${filename} downloaded.`;
      } catch (error) {
        if (status) status.textContent = `CSV export failed: ${error.message}`;
      }
      return;
    }
    const copyApprovedButton = event.target.closest("[data-pmm-copy-approved]");
    if (copyApprovedButton && state.view === "Marketing") {
      event.preventDefault();
      const status = copyApprovedButton.parentElement?.querySelector("span");
      const approvedText = state.marketingWorkspaceModel?.artifactProduction?.approvedClipboardText || "";
      if (!approvedText) {
        if (status) status.textContent = "No approved wording is available.";
        return;
      }
      try {
        await navigator.clipboard.writeText(approvedText);
        if (status) status.textContent = "Approved wording copied.";
      } catch {
        if (status) status.textContent = "Clipboard unavailable.";
      }
      return;
    }
    const exportButton = event.target.closest("[data-pmm-export-targeting]");
    if (exportButton && state.view === "Marketing") {
      event.preventDefault();
      exportMarketingTargetingSnapshot();
      return;
    }
    const clearButton = event.target.closest("[data-pmm-claims-clear]");
    if (!clearButton || state.view !== "Marketing") return;
    event.preventDefault();
    state.marketingClaimsFilters = { readiness: "All", audience: "All", classification: "All" };
    render();
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
    .filter((launch) => isHttpUrl(launch.pressReleaseUrl) && !badUrls.has(launch.pressReleaseUrl))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map((launch) => ({
      label: launch.product,
      url: launch.pressReleaseUrl,
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

function pressReleaseUrlForLaunch(launch) {
  return isHttpUrl(launch?.pressReleaseUrl) ? launch.pressReleaseUrl : "";
}

function productPageUrlForLaunch(launch) {
  return isHttpUrl(launch?.sourceUrl) ? launch.sourceUrl : "";
}

function launchPressReleaseEvidenceUrl(launch) {
  const pressReleaseUrl = pressReleaseUrlForLaunch(launch);
  if (!pressReleaseUrl) return "";
  return isHttpUrl(launch?.sourceAnchorUrl) && launch.sourceAnchorUrl.startsWith(pressReleaseUrl)
    ? launch.sourceAnchorUrl
    : pressReleaseUrl;
}

function timelineUrlForLaunch(launch) {
  const sources = state.sourceCatalog?.sources || [];
  const badUrls = new Set(sources.filter((source) => source.health === "bad").map((source) => source.url));
  const pressReleaseUrl = pressReleaseUrlForLaunch(launch);
  if (pressReleaseUrl && !badUrls.has(pressReleaseUrl)) return pressReleaseUrl;
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

function horizonContext(horizonValue = filters.horizon.value) {
  return {
    "30d": {
      summaryLabel: "New evidence in the last 30 days",
      mode: "New alert",
      interpretation: "Treat this as a recent change to triage, not a sustained market conclusion.",
      decisionRule: "Respond only to a dated competitor move or a clearly accelerating signal; otherwise keep monitoring.",
      customerRule: "Verify the exact recent record before treating this as a product strength or gap.",
    },
    "60d": {
      summaryLabel: "Emerging pattern across 60 days",
      mode: "Emerging pattern",
      interpretation: "Look for a second independent signal before opening roadmap validation.",
      decisionRule: "Escalate only when the same problem repeats across sources or a competitor move changes the comparison.",
      customerRule: "Check whether the theme repeats across more than one recent source before acting.",
    },
    "90d": {
      summaryLabel: "Quarterly competitive pattern",
      mode: "Quarterly signal",
      interpretation: "Use the quarter to separate repeated competitive movement from one-off announcements.",
      decisionRule: "Move repeated, cross-source themes into a defined product-validation artifact.",
      customerRule: "Use the quarter's records to decide whether a product-gap validation is warranted.",
    },
    "1y": {
      summaryLabel: "One-year roadmap pattern",
      mode: "Annual pattern",
      interpretation: "Use the year to identify repeated buying criteria, launch themes, and workflow claims.",
      decisionRule: "Prioritize themes that persist across evidence types and affect the next roadmap cycle.",
      customerRule: "Compare the public pattern with annual win/loss, service, and field evidence before prioritizing.",
    },
    "3y": {
      summaryLabel: "Sustained three-year shift",
      mode: "Structural shift",
      interpretation: "Use three years to distinguish durable platform and workflow shifts from short-lived campaigns.",
      decisionRule: "Consider portfolio investment only where the theme persists across product generations and independent sources.",
      customerRule: "Treat only repeated multi-year themes as structural; isolate recent exceptions from the long-term pattern.",
    },
  }[horizonValue] || {
    summaryLabel: `${horizonLabel()} evidence pattern`,
    mode: "Evidence pattern",
    interpretation: "Interpret the evidence within the selected time window.",
    decisionRule: "Validate the linked records before changing roadmap priority.",
    customerRule: "Verify the linked records before acting.",
  };
}

function horizonTrendTitle(title) {
  return String(title || "").replace(/^./, (character) => character.toUpperCase());
}

function horizonCustomerAction(baseAction) {
  return `${baseAction} ${horizonContext().customerRule}`;
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

function itemMarketSegments(item) {
  if (Array.isArray(item?.marketSegments) && item.marketSegments.length) return item.marketSegments;
  return [item?.marketSegment || "All"];
}

function filteredSignalsForHorizon(horizonValue) {
  if (!state.data) return [];
  const allowedCategories = viewCopy[state.view].categories;
  return state.data.signals.filter((signal) => {
    const categoryMatch = allowedCategories.includes(signal.category);
    const horizonMatch = inHorizon(signal.date, horizonValue);
    const geoMatch = geographyMatches(signal.geography);
    const segmentMatch = filters.segment.value === "All" || itemMarketSegments(signal).includes(filters.segment.value);
    const technologyMatch = technologyMatchesFilter(
      signal.technology,
      filters.technology.value,
      `${signal.title} ${signal.summary} ${signal.signalType} ${signal.pmImplication || ""}`,
    );
    const competitorMatch = filters.competitor.value === "All" || signal.competitor === filters.competitor.value;
    return categoryMatch && horizonMatch && geoMatch && segmentMatch && technologyMatch && competitorMatch
      && pmmTargetingMatches(signal);
  });
}

function competitorIntentSignals(signals) {
  const corporateSignals = (state.data?.signals || [])
    .filter((signal) => signal.category === "Corporate intelligence")
    .filter((signal) => inSelectedHorizon(signal.date))
    .filter((signal) => geographyMatches(signal.geography))
    .filter((signal) => filters.competitor.value === "All" || signal.competitor === filters.competitor.value);
  const seen = new Set();
  return [...signals, ...corporateSignals].filter((signal) => {
    const key = signal.id || canonicalEvidenceUrl(signal.sourceUrl || signal.url) || `${signal.competitor}|${signal.date}|${signal.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function currentStrategicSignals(signals) {
  return signals
    .filter((signal) => signal.category === "Corporate intelligence")
    .filter((signal) => /partnership|partner|collaboration|strategic initiative|strategic market investment|ai ecosystem|ecosystem|integration|research hub|customer experience center/i.test(`${signal.signalType} ${signal.title} ${signal.summary}`))
    .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
}

function currentEarningsSignals(signals) {
  return signals
    .filter((signal) => signal.category === "Corporate intelligence")
    .filter((signal) => /(?:reports?|announces?)\s+(?:first|second|third|fourth|q[1-4])\s+quarter.*results|quarterly earnings|earnings results/i.test(`${signal.title} ${signal.theme || ""}`))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
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
    .filter((launch) => launch.launchEvidenceEligible !== false && pressReleaseUrlForLaunch(launch))
    .filter((launch) => inHorizon(launch.date, horizonValue))
    .filter((launch) => geographyMatches(launch.geography))
    .filter((launch) => filters.segment.value === "All" || launch.marketSegment === filters.segment.value)
    .filter((launch) => technologyMatchesFilter(
      launch.technology,
      filters.technology.value,
      `${launch.product} ${launch.launchType} ${launch.marketSegment || ""}`,
    ))
    .filter((launch) => filters.competitor.value === "All" || launch.competitor === filters.competitor.value)
    .filter((launch) => pmmTargetingMatches(launch))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function currentConferenceSources() {
  const events = state.conferencePrep?.events || [];
  const asOfValue = state.conferencePrep?.asOfDate || state.data?.asOfDate || new Date().toISOString().slice(0, 10);
  return events
    .filter((event) => (event.endDate || event.startDate) >= asOfValue)
    .filter((event) => filters.segment.value === "All" || event.marketSegments.includes(filters.segment.value))
    .filter((event) => filters.technology.value === "All" || event.technologyFocus.some((technology) => technologyMatchesFilter(technology, filters.technology.value, event.eventName)))
    .filter((event) => filters.competitor.value === "All" || event.competitorWatch.some((competitor) => competitor.name === filters.competitor.value))
    .filter((event) => pmmTargetingMatches(event))
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
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
      return technologyMatchesFilter(
        insight.technology,
        filters.technology.value,
        `${insight.headline} ${insight.evidence} ${insight.whyItMatters} ${insight.pmImplication}`,
      );
    })
    .filter((insight) => filters.competitor.value === "All" || insight.competitor === filters.competitor.value)
    .filter((insight) => pmmTargetingMatches(insight))
    .sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0));
}

function currentTrends() {
  const horizon = filters.horizon.value;
  return state.data.trends.themes
    .filter((trend) => filters.segment.value === "All" || trend.marketSegment === filters.segment.value)
    .filter((trend) => technologyMatchesFilter(trend.technology, filters.technology.value, `${trend.theme} ${trend.query || ""}`))
    .sort((a, b) => (b.counts[horizon] || 0) - (a.counts[horizon] || 0));
}

function textMatchesTechnology(text, technology) {
  if (technology === "All") return true;
  const haystack = String(text || "").toLowerCase();
  const needle = technology.toLowerCase();
  if (needle === "hplc") return /\bhplc\b|(^|[^a-z0-9])lc(?!\s*-?\s*ms)(?=$|[^a-z0-9])/.test(haystack);
  if (needle === "uhplc\/uplc") return /\buhplc\b|\buplc\b|nexera|acquity/.test(haystack);
  if (needle === "lc-ms") return /lc\s*[-/]?\s*ms|\blcms\b|liquid chromatograph[^.]{0,80}mass spectrom|chromatograph[^.]{0,80}mass spectrom/.test(haystack);
  if (needle === "ms") return /lc\s*[-/]?\s*ms|\bms\/ms\b|mass spectrom|qtof|\btof\b|hrms|triple quadrupole|triple quad|orbitrap|zenotof|xevo|exploris/.test(haystack);
  if (haystack.includes(needle)) return true;
  return false;
}

function technologyMatchesFilter(itemTechnology, selectedTechnology, context = "") {
  if (selectedTechnology === "All") return true;
  return textMatchesTechnology(`${itemTechnology || ""} ${context || ""}`, selectedTechnology);
}

function itemMatchesRecommendation(item, rec) {
  const combined = `${item.technology || ""} ${item.marketSegment || ""} ${item.title || ""} ${item.product || ""} ${item.summary || ""} ${item.pmImplication || ""} ${item.intent || ""}`;
  const technologyMatch = rec.technology === "All" || technologyMatchesFilter(item.technology, rec.technology, combined);
  const segmentMatch = rec.marketSegment === "All" || item.marketSegment === rec.marketSegment || String(combined).toLowerCase().includes(String(rec.marketSegment).toLowerCase());
  return technologyMatch && segmentMatch;
}

function recommendationMatchesFilters(rec) {
  const filterText = `${rec.title} ${rec.why} ${rec.whyNow} ${rec.action} ${rec.nextAction} ${rec.affectedCapability} ${recommendationEvidenceSummary(rec)}`;
  const technologyMatch = technologyMatchesFilter(rec.technology, filters.technology.value, filterText);
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
  if ((breakdown.rankingScore < 35 || breakdown.evidencePriority === "Low") && (momentum?.label === "Accelerating" || directEvidence > 0)) return "Monitor";
  if (breakdown.rankingScore < 35 || breakdown.evidencePriority === "Low") return "Deprioritize";
  if (breakdown.rankingScore < 50) return "Monitor";
  if ((breakdown.customerPull ?? breakdown.customerEvidence) < 10 && /software|automation|informatics|oligo|rna|lnp|pfas|regulated|workflow/.test(text)) return "Validate";
  return breakdown.rankingScore >= 78 ? "Prepare roadmap decision" : "Validate";
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
  const stateLabel = breakdown.evidencePriority === "High"
    ? "Evidence priority: High"
    : breakdown.evidencePriority === "Medium"
      ? "Evidence priority: Medium"
      : "Evidence priority: Low";
  return {
    state: stateLabel,
    className: breakdown.evidencePriority === "High" ? "emerging" : breakdown.evidencePriority === "Medium" ? "directional" : "weak",
    guidance: breakdown.magnitude.status,
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
  const decisionRelevance = Math.min(20, roadmapBase + technologyRelevanceBonus + segmentRelevanceBonus);
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
  const rankingScore = Math.max(0, Math.min(100, trendAcceleration + competitorPressure + customerPull + decisionRelevance + evidenceQualityFreshness + strategicUrgency));
  const magnitude = competitiveMethodology.unquantifiedMagnitude({
    ...(rec.businessMagnitude || {}),
    affectedSegment: rec.businessMagnitude?.affectedSegment || rec.marketSegment || "Not established from public evidence",
    geography: filters.geo.value === "All"
      ? rec.businessMagnitude?.geography || "Not established from public evidence"
      : filters.geo.value,
    installedBaseOrReplacementCohort: rec.businessMagnitude?.installedBaseOrReplacementCohort,
    revenueOrShareAtRiskBand: rec.businessMagnitude?.revenueOrShareAtRiskBand,
    timeHorizon: rec.businessMagnitude?.timeHorizon || "0–24 months",
    basis: rec.businessMagnitude?.basis,
    magnitudeConfidence: rec.businessMagnitude?.magnitudeConfidence,
    validationOwner: rec.businessMagnitude?.validationOwner || rec.decisionOwners || "Product Management + Commercial Analytics",
    nextStep: rec.businessMagnitude?.nextStep,
  });
  const evidencePriority = competitiveMethodology.evidencePriority({
    applicationTrend: activityLevelFromTwenty(trendAcceleration),
    competitorActivity: activityLevelFromTwenty(competitorPressure),
    customerEvidence: activityLevelFromTwenty(customerPull),
    sourceQuality: evidenceQualityFreshness >= 8 ? "High" : evidenceQualityFreshness >= 5 ? "Medium" : "Low",
  });
  const breakdown = {
    trendAcceleration,
    competitorPressure,
    customerPull,
    decisionRelevance,
    evidenceQualityFreshness,
    strategicUrgency,
    sourceConfidence: evidenceQualityFreshness,
    customerEvidence: customerPull,
    publicSourceCount,
    sourceFamilies,
    independentSignals,
    latestEvidenceDate,
    recencyDays,
    total: null,
    rankingScore,
    evidencePriority,
    magnitude,
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
      evidenceQualityFreshness: {
        equation: `min(10, 3 + ${verifiedEvidenceLinks} + ${catalogQualityContribution} + ${freshness}) = ${evidenceQualityFreshness}`,
        inputs: [
          `Public-evidence baseline = 3 points.`,
          `${verifiedEvidenceLinks} verified recommendation links contribute ${verifiedEvidenceLinks} points.`,
          `${sourceQuality.verified} verified catalog sources contribute ${catalogQualityContribution} points (maximum 3).`,
          `Newest evidence inside the selected horizon contributes ${freshness} points.`,
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
    .sort((a, b) => (b.priorityBreakdown.rankingScore + b.roleFit) - (a.priorityBreakdown.rankingScore + a.roleFit) || recommendationPriorityRank(a.priority) - recommendationPriorityRank(b.priority));
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

function activityLevelFromTwenty(score) {
  const value = Number(score || 0);
  if (value >= 15) return "High";
  if (value >= 8) return "Medium";
  return "Low";
}

function scoreDriverMarkup(breakdown, linkAudit = false) {
  const sourceQualityScore = Math.max(0, Math.min(10, Number(breakdown.evidenceQualityFreshness || 0)));
  const drivers = [
    { key: "trendAcceleration", label: "Application trend", value: activityLevelFromTwenty(breakdown.trendAcceleration) },
    { key: "competitorPressure", label: "Competitor activity", value: activityLevelFromTwenty(breakdown.competitorPressure) },
    { key: "evidenceQualityFreshness", label: "Source quality", value: `${sourceQualityScore}/10` },
    { key: "magnitude", label: "Business impact", value: "Unquantified" },
  ];
  const recency = breakdown.recencyDays === null ? "No dated evidence" : `${breakdown.recencyDays} days`;
  const sourceFamilies = breakdown.sourceFamilies || [];
  const seenProofUrls = new Set();
  const proofLinks = decisionEvidenceItems("all", breakdown).filter((item) => {
    if (!isHttpUrl(item.url) || seenProofUrls.has(item.url)) return false;
    seenProofUrls.add(item.url);
    return true;
  });
  const evidenceAuditLinks = [
    proofLinks.length > 0
      ? `<button type="button" data-decision-evidence="all" aria-label="View ${proofLinks.length} linked sources">
          <b>${proofLinks.length}</b> linked sources
        </button>`
      : "",
    sourceFamilies.length > 0
      ? `<button type="button" data-decision-evidence="types" aria-label="View ${sourceFamilies.length} evidence types">
          <b>${sourceFamilies.length}</b> evidence types
        </button>`
      : "",
    proofLinks.length > 0 && breakdown.latestEvidenceDate
      ? `<button type="button" data-decision-evidence="latest" aria-label="View latest evidence, aged ${escapeHtml(recency)}">
          Latest evidence age <b>${escapeHtml(recency)}</b>
        </button>`
      : "",
  ].filter(Boolean).join("");
  return `
    <div class="score-driver-grid">
      ${drivers
        .map((driver) => {
          return `
          <div class="score-driver-card score-driver-card--${escapeHtml(driver.key)}">
            <i class="score-driver-marker" aria-hidden="true"></i>
            <span class="score-driver-label">${escapeHtml(driver.label)}</span>
            <b>${escapeHtml(driver.value)}</b>
          </div>
        `;
        })
        .join("")}
    </div>
    ${evidenceAuditLinks
      ? `<div class="score-evidence-stats" aria-label="Open evidence behind this score" title="Evidence types: ${escapeHtml(sourceFamilies.join(", "))}">${evidenceAuditLinks}</div>`
      : ""}
  `;
}

function priorityBreakdownText(breakdown) {
  return `${breakdown.confidenceState.state}; business impact: Unquantified. Application trend activity is ${activityLevelFromTwenty(breakdown.trendAcceleration)}, competitor activity is ${activityLevelFromTwenty(breakdown.competitorPressure)}, and source quality is ${breakdown.evidenceQualityFreshness}/10. Linked public sources: ${breakdown.publicSourceCount}; newest evidence: ${breakdown.latestEvidenceDate || "not dated"}.`;
}

function businessMagnitudeMarkup(magnitude, compact = false) {
  const value = magnitude || competitiveMethodology.unquantifiedMagnitude();
  if (compact) return `<span class="magnitude-status">${escapeHtml(value.status)}</span>`;
  return `
    <section class="business-magnitude" aria-label="Waters business exposure">
      <div class="business-magnitude-header"><strong>Waters business exposure</strong><span>${escapeHtml(value.status)}</span></div>
      <dl>
        <div><dt>Affected segment</dt><dd>${escapeHtml(value.affectedSegment)}</dd></div>
        <div><dt>Geography</dt><dd>${escapeHtml(value.geography)}</dd></div>
        <div><dt>Installed-base / replacement cohort</dt><dd>${escapeHtml(value.cohort)}</dd></div>
        <div><dt>Revenue / share-at-risk band</dt><dd>${escapeHtml(value.exposureBand)}</dd></div>
        <div><dt>Time horizon</dt><dd>${escapeHtml(value.timeHorizon)}</dd></div>
        <div><dt>Magnitude confidence</dt><dd>${escapeHtml(value.confidence)}</dd></div>
      </dl>
      <p><b>Basis:</b> ${escapeHtml(value.basis)}</p>
      <p><b>Validation owner / next step:</b> ${escapeHtml(value.validationOwner)} — ${escapeHtml(value.nextStep)}</p>
    </section>
  `;
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

function competitorStrategyRead(recommendation, signals, competitorRead) {
  if (state.view !== "Leadership") {
    return {
      label: "What competitors appear to be doing",
      headline: competitorRead.headline,
      detail: competitorIntentForRecommendation(recommendation, signals),
    };
  }

  const themeKey = recommendationThemeKey(recommendation);
  if (themeKey === "software") {
    return {
      label: "Competitive shift and leadership implication",
      headline: "Competitors are trying to reset LC buying criteria around workflow productivity—not instrument specifications alone",
      detail: "Software, automation, serviceability, and application workflows are being packaged as part of the product. If that buying frame wins, Waters could retain core LC performance but lose on perceived operator burden and time-to-value. Leadership choice: sponsor one cross-platform workflow response for Next Gen LC and Alliance iS, or explicitly accept that risk to protect hardware capacity.",
    };
  }
  if (themeKey === "regulated") {
    return {
      label: "Competitive shift and leadership implication",
      headline: "Competitors are moving the regulated-method sale from sensitivity claims to complete, defensible workflows",
      detail: "Method readiness, traceable data, compliance proof, and repeatable execution are becoming part of the platform decision. If buyers adopt that standard, Waters risks losing before instrument performance is compared. Leadership choice: fund a reusable regulated-method package or keep responding application by application.",
    };
  }
  if (themeKey === "advanced-therapeutics") {
    return {
      label: "Competitive shift and leadership implication",
      headline: "Competitors are moving from broad biopharma positioning to oligonucleotide-specific workflow ownership",
      detail: "Packaged methods, software templates, and LC-to-MS handoffs could define the preferred operating model for emerging therapeutics. Waiting preserves near-term capacity but increases the cost of entering after customer workflows standardize. Leadership choice: fund a method-readiness package now, partner for it, or deliberately monitor.",
    };
  }
  if (themeKey === "omics") {
    return {
      label: "Competitive shift and leadership implication",
      headline: "Competitors are competing to own the omics workflow—not only the mass-spectrometer specification",
      detail: "Application methods, informatics, automation, and ecosystem access are becoming the value proposition. If buyers prioritize end-to-end productivity, isolated performance advantages will be less defensible. Leadership choice: sponsor an integrated omics workflow response or narrow investment to the applications Waters can credibly lead.",
    };
  }
  return {
    label: "Competitive shift and leadership implication",
    headline: "Competitor activity is changing the buying frame, but the strategic direction is not yet specific enough for an investment decision",
    detail: `${competitorIntentForRecommendation(recommendation, signals)} Leadership choice: fund targeted validation now or preserve capacity until the customer problem and competitive claim converge in the same evidence set.`,
  };
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

function positiveCountSummary(entries) {
  return entries
    .filter(([, count]) => Number(count) > 0)
    .map(([, count, label]) => `${count} ${label}`)
    .join(", ");
}

function evidenceCountEntries(breakdown) {
  const evidence = breakdown.evidence;
  return [
    ["launches", evidence.launches.length, `launch${evidence.launches.length === 1 ? "" : "es"}`],
    ["strategic", evidence.strategic.length, `strategic move${evidence.strategic.length === 1 ? "" : "s"}`],
    ["filings", evidence.filings.length, `filing insight${evidence.filings.length === 1 ? "" : "s"}`],
    ["customer", breakdown.customerPullEvidence.estimatedMentions, `customer/public mention${breakdown.customerPullEvidence.estimatedMentions === 1 ? "" : "s"}`],
  ].filter(([, count]) => Number(count) > 0);
}

function evidenceCountSummary(breakdown) {
  return positiveCountSummary(evidenceCountEntries(breakdown));
}

function evidenceCountLinkMarkup(breakdown) {
  return evidenceCountEntries(breakdown).map(([kind, count, label]) => `
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
        url: launchPressReleaseEvidenceUrl(item),
        date: item.date,
        evidenceType: "Launches",
        sourceEvidence: item.sourceEvidence,
        evidenceConnection: item.evidenceConnection || item.pmImplication,
        evidenceLimitation: item.evidenceLimitation,
        exactPassage: launchPressReleaseEvidenceUrl(item).includes("#:~:text="),
        sourceLinkLabel: "Open press release ↗",
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
      url: launchPressReleaseEvidenceUrl(item),
      sourceEvidence: item.sourceEvidence,
      evidenceConnection: item.evidenceConnection || item.pmImplication,
      evidenceLimitation: item.evidenceLimitation,
      exactPassage: launchPressReleaseEvidenceUrl(item).includes("#:~:text="),
      sourceLinkLabel: "Open press release ↗",
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

function decisionEvidenceItemMarkup(item) {
  const derivation = item.sourceEvidence || item.evidenceConnection || item.evidenceLimitation
    ? `
        <div class="evidence-derivation">
          ${item.sourceEvidence ? `
            <p>
              <b>What the source says</b>
              <span>${escapeHtml(item.sourceEvidence)}</span>
            </p>
          ` : ""}
          ${item.evidenceConnection ? `
            <p>
              <b>How this supports the recommendation</b>
              <span>${escapeHtml(item.evidenceConnection)}</span>
            </p>
          ` : ""}
          ${item.evidenceLimitation ? `
            <p class="evidence-limitation">
              <b>What it does not prove</b>
              <span>${escapeHtml(item.evidenceLimitation)}</span>
            </p>
          ` : ""}
        </div>
      `
    : "";
  return `
    <article class="decision-evidence-card">
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.detail)}</span>
      ${derivation}
      <a class="decision-evidence-source-link" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">
        ${item.sourceLinkLabel || (item.exactPassage ? "Open highlighted source passage ↗" : "Open exact record ↗")}
      </a>
    </article>
  `;
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
        : kind === "launches"
          ? `${items.length} launch record${items.length === 1 ? "" : "s"} match the active filters. Each card separates the source claim from the product inference and its limitation.`
          : `${items.length} linked public records match the active filters and lead decision.`;
  byId("decisionEvidenceList").innerHTML = items.length
    ? items.map(decisionEvidenceItemMarkup).join("")
    : `<div class="empty">No linked public records match this evidence category.</div>`;
  byId("decisionEvidenceModal").hidden = false;
  document.body.classList.add("modal-open");
  byId("hideDecisionEvidence").focus();
}

function openDecisionUrgencySources(decisionIndex) {
  const recommendation = recommendationsByConfidence(currentSignals())[decisionIndex];
  const actions = recommendation?.urgency?.competitorActions || [];
  if (!recommendation || !actions.length) return;
  byId("decisionEvidenceTitle").textContent = `How this decision insight was derived`;
  byId("decisionEvidenceSummary").textContent = `${actions.length} linked official source${actions.length === 1 ? "" : "s"} underpin the concise decision rationale. Open any record to review the underlying action and its connection to the decision.`;
  byId("decisionEvidenceList").innerHTML = actions.map((item) => decisionEvidenceItemMarkup({
    title: item.competitor,
    detail: `${item.date ? `${item.date} · ` : ""}${item.action}`,
    evidenceConnection: item.decisionLink,
    url: item.sourceUrl,
    sourceLinkLabel: "Open official source ↗",
  })).join("");
  byId("decisionEvidenceModal").hidden = false;
  document.body.classList.add("modal-open");
  byId("hideDecisionEvidence").focus();
}

function hideDecisionEvidenceModal() {
  byId("decisionEvidenceModal").hidden = true;
  document.body.classList.remove("modal-open");
}

function launchMetricEvidenceItems(kind) {
  const allLaunches = currentLaunches();
  const launches = kind === "new"
    ? allLaunches.filter((launch) => /new product|workflow launch|product launch/i.test(launch.signalType))
    : kind === "lcms"
      ? allLaunches.filter((launch) => launch.technology.includes("LC-MS"))
      : [...allLaunches];
  const sortedLaunches = kind === "competitors"
    ? launches.sort((a, b) => a.competitor.localeCompare(b.competitor) || new Date(b.date) - new Date(a.date))
    : launches;
  return sortedLaunches.map((launch) => ({
    title: `${launch.competitor}: ${launch.product}`,
    detail: `${formatDate(launch.date)} · ${launch.signalType} · ${launch.technology} · ${launch.sourceName}`,
    url: launchPressReleaseEvidenceUrl(launch) || timelineUrlForLaunch(launch),
    sourceLinkLabel: "Open official launch source ↗",
  }));
}

function openLaunchMetricEvidenceModal(kind) {
  const items = launchMetricEvidenceItems(kind);
  const competitorCount = new Set(currentLaunches().map((launch) => launch.competitor)).size;
  const titles = {
    all: `${items.length} product-change sources`,
    new: `${items.length} launch sources`,
    lcms: `${items.length} LC-MS product-change sources`,
    competitors: `Activity sources for ${competitorCount} competitors`,
  };
  const summaries = {
    all: "Official launch evidence for every product change matching the active filters.",
    new: "Official launch evidence for new product and workflow launches matching the active filters.",
    lcms: "Official launch evidence for LC-MS and LC-MS/MS product changes matching the active filters.",
    competitors: "Official launch evidence grouped by competitor. Opening this view does not reorder or filter the Competitive Timeline.",
  };
  byId("decisionEvidenceTitle").textContent = titles[kind] || titles.all;
  byId("decisionEvidenceSummary").textContent = summaries[kind] || summaries.all;
  byId("decisionEvidenceList").innerHTML = items.length
    ? items.map(decisionEvidenceItemMarkup).join("")
    : `<div class="empty">No official launch sources match this activity category.</div>`;
  byId("decisionEvidenceModal").hidden = false;
  document.body.classList.add("modal-open");
  byId("hideDecisionEvidence").focus();
}

function leadCompetitorRead(signals, recommendation) {
  const context = horizonContext();
  const competitor = filters.competitor.value !== "All" ? filters.competitor.value : topEvidenceCompetitor(signals);
  if (!competitor) {
    return {
      competitor: "No clear competitor",
      headline: `No competitor has enough ${horizonLabel().toLowerCase()} evidence to identify a clear lead threat`,
      detail: `${context.interpretation} Use launch monitoring, conference capture, and customer-source review before changing roadmap priority.`,
      counts: { launches: 0, strategic: 0, filings: 0, total: 0 },
    };
  }
  const counts = competitorEvidenceCounts(competitor, signals);
  const technology = recommendation?.technology || filters.technology.value;
  const segment = recommendation?.marketSegment || filters.segment.value;
  const headlines = {
    "30d": `${competitor} generated the most new competitor evidence in the last 30 days`,
    "60d": `${competitor} leads the emerging 60-day activity pattern`,
    "90d": `${competitor} leads this quarter's competitor activity`,
    "1y": `${competitor} has the strongest repeated one-year activity`,
    "3y": `${competitor} shows the most sustained activity across three years`,
  };
  return {
    competitor,
    headline: headlines[filters.horizon.value] || `${competitor} has the most matching public evidence in this view`,
    detail: `${counts.launches} launch${counts.launches === 1 ? "" : "es"}, ${counts.strategic} strategic move${counts.strategic === 1 ? "" : "s"}, and ${counts.filings} filing insight${counts.filings === 1 ? "" : "s"} overlap with ${technology} / ${segment}. ${context.interpretation}`,
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
  if (filters.horizon.value === "30d") return `The last 30 days surface ${capability} as a new alert, not yet a sustained trend.`;
  if (filters.horizon.value === "60d") return `Sixty-day evidence shows ${capability} repeating enough to validate, but not yet to fund.`;
  if (filters.horizon.value === "90d") return `This quarter makes ${capability} a focused validation priority.`;
  if (filters.horizon.value === "1y") return `One-year evidence shows ${capability} becoming a repeated competitive theme.`;
  if (filters.horizon.value === "3y") return `Three-year evidence suggests ${capability} is a sustained shift rather than a campaign or one-off launch.`;
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
      return `Action: compare ${latestLaunch.competitor}'s ${product} with its prior platform and Waters' closest match. Document what changed, where the competitor remains weak, the customer impact, and one defend-or-differentiate response for the next PM review.`;
    }
    const momentum = evidence.trend ? trendMomentum(evidence.trend, filters.horizon.value) : null;
    if (momentum?.label === "Accelerating") {
      return `Action: review five recent public sources behind the accelerating ${evidence.trend.theme} signal. Compare them with Waters' current application proof and return one of three calls: continue monitoring, update positioning, or define a roadmap requirement.`;
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
      return `Action: ${recommendation.action}`;
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

function competitorEvidenceLinks(competitor, signals) {
  const records = [
    ...currentLaunches().filter((launch) => launch.competitor === competitor),
    ...currentStrategicSignals(signals).filter((signal) => signal.competitor === competitor),
    ...currentFilingInsights().filter((insight) => insight.competitor === competitor),
    ...signals.filter((signal) => signal.competitor === competitor && signal.signalType === "Official technical insight"),
  ];
  const seen = new Set();
  return records.reduce((links, record) => {
    const url = record.sourceUrl || record.url;
    if (!url || seen.has(url)) return links;
    seen.add(url);
    links.push({
      url,
      label: record.title || record.headline || record.product || record.sourceName || "Public evidence source",
      sourceName: record.sourceName || "Public source",
    });
    return links;
  }, []);
}

function renderCompetitorCoverageHealth(signals) {
  const rows = primaryCompetitors.map((competitor) => {
    const evidence = competitorEvidenceCounts(competitor, signals);
    const evidenceLinks = competitorEvidenceLinks(competitor, signals);
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
    return { competitor, evidence, evidenceLinks, sourceHealth, healthClass, interpretation };
  });
  byId("coverageHealthCount").textContent = `${rows.length} competitors`;
  byId("competitorCoverageHealth").innerHTML = rows
    .map((row) => `
      <article class="coverage-health-card ${row.healthClass}">
        <div class="coverage-health-top">
          <strong>${escapeHtml(row.competitor)}</strong>
          <span>${escapeHtml(row.sourceHealth.status)}</span>
        </div>
        <div class="coverage-health-summary">
          <strong>${row.evidence.total}</strong>
          <span>signals</span>
          <small>${row.evidence.launches} launches · ${row.evidence.strategic} moves · ${row.evidence.filings} filings · ${row.evidence.technical} technical</small>
        </div>
        <div class="coverage-health-extractors">
          <span><b>${row.sourceHealth.extracted}</b> active</span>
          <span><b>${row.sourceHealth.extractionBlocked.length}</b> blocked</span>
        </div>
        <details class="coverage-health-details">
          <summary>Source details</summary>
          <div class="coverage-health-detail-body">
            <p>${escapeHtml(row.interpretation)}</p>
            ${row.evidenceLinks.length ? `
              <strong class="coverage-source-label">Evidence links (${row.evidenceLinks.length})</strong>
              <ul class="extraction-status-list extracted">
                ${row.evidenceLinks.map((source) => `
                  <li>
                    <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label)} ↗</a>
                    <span>${escapeHtml(source.sourceName)}</span>
                  </li>
                `).join("")}
              </ul>
            ` : ""}
            ${row.sourceHealth.extracted ? `
              <strong class="coverage-source-label">Extracted sources</strong>
              <ul class="extraction-status-list extracted">
                ${row.sourceHealth.sources.filter((source) => source.extractionStatus === "extracted").map((source) => `
                  <li>
                    <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.source || "Official source")} ↗</a>
                    ${source.extractionReason ? `<span>${escapeHtml(source.extractionReason)}</span>` : ""}
                  </li>
                `).join("")}
              </ul>
            ` : ""}
            ${row.sourceHealth.sources.some((source) => !["extracted", "blocked"].includes(source.extractionStatus)) ? `
              <strong class="coverage-source-label">Monitored official sources</strong>
              <ul class="extraction-status-list">
                ${row.sourceHealth.sources.filter((source) => !["extracted", "blocked"].includes(source.extractionStatus)).map((source) => `
                  <li>
                    <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.source || "Official source")} ↗</a>
                    <span>Health checked; not automatically extracted.</span>
                  </li>
                `).join("")}
              </ul>
            ` : ""}
            ${row.sourceHealth.extractionBlocked.length ? `
              <strong class="coverage-source-label">Blocked sources</strong>
              <ul class="extraction-status-list">
                ${row.sourceHealth.extractionBlocked.map((source) => `
                  <li><strong><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.source || "Official source")} ↗</a>:</strong> ${escapeHtml(source.extractionReason || "Extraction is blocked.")}</li>
                `).join("")}
              </ul>
            ` : ""}
          </div>
        </details>
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
        <span>${escapeHtml(horizonContext().summaryLabel)}</span>
        <strong>${escapeHtml(horizonContext().interpretation)}</strong>
        <p>Action: ${escapeHtml(horizonContext().decisionRule)}</p>
      </article>
    `;
    return;
  }
  const breakdown = topRecommendation.priorityBreakdown;
  const context = horizonContext();
  const competitorRead = leadCompetitorRead(signals, topRecommendation);
  const validation = validationNeedsForRecommendation(topRecommendation);
  const evidenceLinks = recommendationEvidenceLinks(topRecommendation);
  const items = [
    {
      label: context.summaryLabel,
      headline: `${strategicThemeForRecommendation(topRecommendation)} Evidence priority: ${breakdown.evidencePriority}.`,
      detail: `${evidenceCountSummary(breakdown)} in ${horizonLabel()}. Business impact remains unquantified pending Waters installed-base, pipeline, win/loss, and engineering-effort evidence.`,
      action: `Time-window decision rule: ${context.decisionRule} ${breakdown.confidenceState.guidance}`,
    },
    {
      label: `${context.mode} competitor read`,
      headline: competitorRead.headline,
      detail: `${competitorRead.detail} ${competitorIntentForRecommendation(topRecommendation, signals)}`,
      action: `Action: ${context.decisionRule} Compare ${competitorRead.competitor === "No clear competitor" ? "competitor" : competitorRead.competitor} claims against Waters proof points before the next roadmap review.`,
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
  return recommendation?.leadershipDecision || recommendation?.title || actionDisplayLabel("Monitor");
}

function executiveDecisionMarkup(recommendation, breakdown) {
  const rationale = recommendation.leadershipRationale || recommendation.whyNow || recommendation.why;
  const owners = recommendation.decisionOwners || "Product Management owner";
  const due = recommendation.decisionDue || "Next roadmap review";
  const deliverable = recommendation.decisionDeliverable || recommendation.nextAction || "A go/no-go recommendation";
  const gate = recommendation.decisionGate || validationGateForRecommendation(recommendation, breakdown);
  return `
    <article class="executive-decision-card">
      <span>Recommended decision</span>
      <strong>${escapeHtml(decisionOptionsForRecommendation(recommendation))}</strong>
      <p class="executive-decision-rationale">${escapeHtml(rationale)}</p>
      <dl class="executive-decision-facts">
        <div><dt>Accountable owners</dt><dd>${escapeHtml(owners)}</dd></div>
        <div><dt>Decision due</dt><dd>${escapeHtml(due)}</dd></div>
        <div><dt>Next PM Considerations</dt><dd>${escapeHtml(deliverable)}</dd></div>
      </dl>
      <p class="executive-decision-gate"><b>Investment gate</b><span>${escapeHtml(gate)}</span></p>
      ${businessMagnitudeMarkup(breakdown.magnitude)}
    </article>
  `;
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

function leadershipDecisionFacts(recommendation, breakdown) {
  const nextAction = recommendation.nextAction || "";
  const dueMatch = nextAction.match(/\b(?:By\s+)?([A-Z][a-z]+ \d{1,2}, \d{4})\b/);
  const ownerMatch = nextAction.match(/\b[A-Z][a-z]+ \d{1,2}, \d{4},\s+(.+?)\s+must\b/i);
  return {
    owners: recommendation.decisionOwners || ownerMatch?.[1] || "Product Management owner",
    due: recommendation.decisionDue || dueMatch?.[1] || "Next roadmap review",
    deliverable: recommendation.decisionDeliverable || recommendation.action || nextAction,
    gate: recommendation.decisionGate || validationGateForRecommendation(recommendation, breakdown),
  };
}

function decisionUrgencyMarkup(recommendation, decisionIndex) {
  const urgency = recommendation.urgency;
  if (!urgency?.evidence || !urgency?.decisionWindow || !urgency?.delayRisk) {
    return `<span>${escapeHtml(recommendation.whyNow || recommendation.why)}</span>`;
  }
  const competitorActions = Array.isArray(urgency.competitorActions)
    ? urgency.competitorActions.filter((item) => item?.competitor && item?.pmKeyPoint)
    : [];
  const implications = Array.isArray(urgency.decisionImplications) && urgency.decisionImplications.length
    ? urgency.decisionImplications
    : competitorActions.map((item) => item.pmKeyPoint);
  return `
    <div class="decision-urgency-readout">
      ${implications.length ? `
        <ul class="decision-implication-list">
          ${implications.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}
        </ul>
      ` : `<p><b>What changed</b><span>${escapeHtml(urgency.evidence)}</span></p>`}
      <p class="decision-why-now"><b>Why now</b><span>${escapeHtml(urgency.whyNowInsight || urgency.delayRisk)}</span></p>
      ${competitorActions.length ? `
        <button type="button" class="decision-derivation-button" data-decision-urgency-sources="${decisionIndex}">
          ${competitorActions.length} linked source${competitorActions.length === 1 ? "" : "s"}
        </button>
      ` : ""}
    </div>
  `;
}

function recommendationsByConfidence(signals) {
  return currentRecommendationSet(signals)
    .slice()
    .sort((a, b) =>
      (b.priorityBreakdown?.rankingScore || 0) - (a.priorityBreakdown?.rankingScore || 0)
      || (b.roleFit || 0) - (a.roleFit || 0)
      || String(a.title || "").localeCompare(String(b.title || ""))
    );
}

function leadershipTrendComparison(trend) {
  const horizon = filters.horizon.value;
  const count = Number(trend?.counts?.[horizon] || 0);
  const oneYear = Number(trend?.counts?.["1y"] || 0);
  const expected = {
    "30d": oneYear / 12,
    "60d": oneYear / 6,
    "90d": oneYear / 4,
    "1y": Number(trend?.counts?.["3y"] || oneYear * 3) / 3,
    "3y": (Number(trend?.counts?.["5y"] || count) / 5) * 3,
  }[horizon] || count;
  const ratio = expected > 0 ? count / expected : 1;
  return { count, ratio, delta: Math.round((ratio - 1) * 100) };
}

function trendTechnicalContext(trend) {
  const theme = String(trend?.theme || "").toLowerCase();
  if (theme.includes("lnp") || theme.includes("rna therapeutics")) {
    return "The source set covers LC-MS characterization of lipid composition, RNA payload and impurities, formulation stability, sample preparation, and release-testing workflows.";
  }
  if (theme.includes("oligonucleotide") || theme.includes("nucleic-acid")) {
    return "The source set covers LC-MS oligonucleotide identity, purity and impurity profiling, adsorption and carryover, ion-pairing and solvent compatibility, and intact-mass characterization.";
  }
  if (theme.includes("pfas") || theme.includes("environmental contaminant")) {
    return "Key applications span drinking-water compliance and occurrence monitoring; wastewater, biosolids, leachate, and other environmental matrices; food and food-contact contamination; and human-exposure testing in serum or plasma. Across these applications, LC-MS/MS workflows must control sample preparation and matrix effects while delivering isotope-dilution quantitation, defensible sensitivity and LOQ, and regulated-method validation.";
  }
  if (theme.includes("proteomics") || theme.includes("metabolomics")) {
    return "The source set covers high-resolution LC-MS acquisition, ion mobility, quantitative proteomics and metabolomics, biomarker measurement, and data-processing workflows.";
  }
  if (theme.includes("automation") || theme.includes("software")) {
    return "The source set covers automated sample handling, instrument orchestration, workflow software, AI-assisted review, data integrity, and cross-instrument reporting.";
  }
  return `The source set covers ${String(trend?.technology || "analytical").toUpperCase()} methods and workflow evidence associated with this scientific topic.`;
}

function leadershipLaunchContext(launch) {
  if (launch?.id === "agilent-6230c-lctof-2026") {
    return "Agilent has turned the 6230C from a standalone LC/TOF into a named MAM biopharma workflow, combining full-scan accurate-mass acquisition with software-led attribute monitoring and review.";
  }
  const signalType = String(launch?.signalType || "product change").toLowerCase();
  const market = launch?.marketSegment ? ` for ${launch.marketSegment} workflows` : "";
  const technology = launch?.technology ? ` within its ${launch.technology} portfolio` : "";
  return `${launch?.competitor || "The competitor"} introduced ${launch?.product || "a new offer"} as a ${signalType}${market}${technology}.`;
}

function leadershipConferenceUpdate(conference) {
  if (conference?.eventName === "Bioprocessing Summit US") {
    return "Thermo Fisher has secured premier-sponsor visibility at a program centered on Analytical Intelligence, AI-enabled bioprocessing, next-generation analytical methods, and RNA/LNP CMC. The near-term competitive narrative is shifting toward digital analytical workflows and complex-modality scale-up—not instrument specifications alone.";
  }
  const confirmedContent = (conference?.competitorContent || [])
    .find((item) => item.evidenceStatus === "Confirmed in 2026 program");
  if (confirmedContent?.content) return confirmedContent.content;
  const competitorUpdate = conference?.competitorContent?.[0]?.content;
  if (competitorUpdate) return competitorUpdate;
  const scientificFocus = (conference?.scientificFocus || []).slice(0, 2).join("; ");
  return scientificFocus
    ? `The latest public program emphasizes ${scientificFocus}.`
    : `${conference?.annualTheme || "The latest public program"}.`;
}

const leadershipCustomerMinimumIndependentSources = 3;

function leadershipCustomerHighlight() {
  const items = currentCustomerVoiceItems();
  if (!items.length) return null;
  const itemById = new Map(items.map((item) => [item.id, item]));
  const priorityRank = { High: 3, Medium: 2, Low: 1 };
  const insight = (state.customerVoice?.insights || [])
    .map((entry) => {
      const matchingItems = (entry.evidenceIds || []).map((id) => itemById.get(id)).filter(Boolean);
      const independentSources = groupCustomerVoiceEvidenceMappings(
        matchingItems.flatMap((item) => customerVoiceSourceLinks(item).map((link) => ({ item, link }))),
      );
      return {
        ...entry,
        matchingItems,
        independentSourceCount: independentSources.length,
      };
    })
    .filter((entry) => entry.independentSourceCount >= leadershipCustomerMinimumIndependentSources)
    .sort((a, b) =>
      (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0)
      || b.independentSourceCount - a.independentSourceCount
      || Number(b.confidence || 0) - Number(a.confidence || 0)
    )[0];
  if (!insight) return null;
  return {
    kind: "customer",
    label: "Customer risk",
    badge: `${insight.independentSourceCount} independent sources`,
    title: insight.title,
    detail: insight.whatItMeans,
    sectionId: "customer-voice",
    sectionLabel: "View customer evidence",
    sourceUrl: "",
    sourceLabel: "",
  };
}

function leadershipBriefHighlights(signals) {
  const highlights = [];
  const trendCandidates = currentTrends()
    .map((trend) => ({ trend, comparison: leadershipTrendComparison(trend) }))
    .sort((a, b) => b.comparison.ratio - a.comparison.ratio || b.comparison.count - a.comparison.count);
  const leadTrend = trendCandidates[0];
  if (leadTrend) {
    highlights.push({
      kind: "market",
      label: "Scientific market signal",
      badge: `${leadTrend.comparison.count.toLocaleString()} publication${leadTrend.comparison.count === 1 ? "" : "s"}`,
      title: leadTrend.trend.theme,
      detail: trendTechnicalContext(leadTrend.trend),
      sectionId: "application-trends",
      sectionLabel: "View application trends",
      sourceUrl: pubMedTrendSearchUrl(leadTrend.trend.query, filters.horizon.value),
      sourceLabel: "Open PubMed evidence",
    });
  }

  const launch = currentLaunches()[0];
  if (launch) {
    highlights.push({
      kind: "competitor",
      label: "Latest competitive change",
      badge: formatDate(launch.date),
      title: `${launch.competitor}: ${launch.product}`,
      detail: leadershipLaunchContext(launch),
      sectionId: "competitive-timeline-section",
      sectionLabel: "View competitive timeline",
      sourceUrl: pressReleaseUrlForLaunch(launch),
      sourceLabel: "Open launch release",
    });
  }

  const customerHighlight = leadershipCustomerHighlight();
  if (customerHighlight) highlights.push(customerHighlight);

  const earnings = currentEarningsSignals(competitorIntentSignals(signals))[0];
  const filing = currentFilingInsights()[0];
  const corporateSignal = earnings || filing;
  if (corporateSignal) {
    highlights.push({
      kind: "corporate",
      label: "Corporate signal",
      badge: formatDate(corporateSignal.date),
      title: corporateSignal.title || corporateSignal.headline,
      detail: corporateSignal.summary || corporateSignal.whyItMatters || corporateSignal.pmImplication || corporateSignal.evidence,
      sectionId: earnings ? "competitor-intent-section" : "filing-evidence",
      sectionLabel: earnings ? "View competitor intent" : "View SEC insights",
      sourceUrl: corporateSignal.sourceUrl,
      sourceLabel: `Open ${corporateSignal.sourceName || (earnings ? "earnings release" : "filing")}`,
    });
  }

  const conference = currentConferenceSources()
    .slice()
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))[0];
  if (conference) {
    highlights.push({
      kind: "conference",
      label: "Coming Next",
      badge: `Starts ${formatDate(conference.startDate)}`,
      title: conference.eventName,
      detail: leadershipConferenceUpdate(conference),
      pageUrl: "conference.html",
      sectionLabel: "Open conference page",
      sourceUrl: conference.website,
      sourceLabel: "Open event website",
    });
  }

  return highlights;
}

function leadershipBriefText(highlights, recommendations) {
  const header = [
    "Leadership Brief",
    `Scope: ${filterScopeLabel()}`,
    `Time window: ${horizonLabel()}`,
    `Data current through: ${state.data?.asOfDate || "not available"}`,
  ];
  const highlightText = highlights.map((highlight, index) => [
    `${index + 1}. ${highlight.label.toUpperCase()}: ${highlight.title}`,
    highlight.detail,
    highlight.sourceUrl ? `Source: ${highlight.sourceUrl}` : "",
  ].filter(Boolean).join("\n"));
  const decisionText = recommendations.length
    ? [
        `DECISION QUEUE: ${recommendations.length} prioritized decision${recommendations.length === 1 ? "" : "s"}.`,
        `Highest current evidence priority: ${recommendations[0].title} (${recommendations[0].priorityBreakdown.evidencePriority}; business impact unquantified).`,
      ].join("\n")
    : "DECISION QUEUE: No decision is supported under the active filters.";
  return [...header, ...highlightText, decisionText].join("\n\n");
}

function leadershipDecisionCardMarkup(recommendation, signals, index) {
  const breakdown = recommendation.priorityBreakdown;
  const validation = validationNeedsForRecommendation(recommendation);
  const evidenceLinks = recommendationEvidenceLinks(recommendation).filter((link) => isHttpUrl(link.url));
  return `
    <article class="leadership-decision-card">
      <div class="leadership-decision-card-header">
        <div>
          <span>Decision ${index + 1}</span>
          <h4>${escapeHtml(recommendation.title)}</h4>
        </div>
        <span class="action-chip ${actionClass(breakdown.action)}">${escapeHtml(actionDisplayLabel(breakdown.action))}</span>
      </div>
      <div class="leadership-decision-meta">
        <span>Status: ${escapeHtml(recommendation.decisionStatus || "Decision review required")}</span>
        <span>${escapeHtml(breakdown.confidenceState.state)}; business impact: Unquantified</span>
        <span>${evidenceLinks.length} exact source${evidenceLinks.length === 1 ? "" : "s"}</span>
      </div>
      <div class="leadership-decision-why">
        <span>Why leadership needs to address this now</span>
        <p>${escapeHtml(recommendation.whyNow || recommendation.why)}</p>
      </div>
      <p class="leadership-decision-scope"><b>Waters capability affected</b><span>${escapeHtml(recommendation.affectedCapability || recommendation.technology)}</span></p>
      ${businessMagnitudeMarkup(breakdown.magnitude)}
      <details class="leadership-decision-evidence">
        <summary><span>Review decision evidence and validation</span><small>${evidenceLinks.length} source${evidenceLinks.length === 1 ? "" : "s"}</small></summary>
        <div class="leadership-evidence-body">
          <div class="leadership-evidence-grid">
            <section>
              <h5>Evidence Supporting the Decision</h5>
              <p>${escapeHtml(recommendation.why)}</p>
              <p><strong>Competitor interpretation:</strong> ${escapeHtml(competitorIntentForRecommendation(recommendation, signals))}</p>
            </section>
            <section>
              <h5>Evidence Still Required</h5>
              <p><strong>Customer:</strong> ${escapeHtml(validation.customer)}</p>
              <p><strong>Competitor:</strong> ${escapeHtml(validation.competitor)}</p>
              <p><strong>Technical:</strong> ${escapeHtml(validation.technical)}</p>
              <p><strong>Adoption:</strong> ${escapeHtml(validation.adoption)}</p>
            </section>
            <section class="leadership-evidence-safeguards">
              <h5>Decision Safeguards</h5>
              <p><strong>Action to validate:</strong> ${escapeHtml(recommendation.action)}</p>
              <p><strong>Tradeoff:</strong> ${escapeHtml(recommendation.tradeoff || "Confirm a repeated customer-visible gap before displacing committed roadmap work.")}</p>
              <p><strong>Do not proceed if:</strong> ${escapeHtml(recommendation.falsifier || "The evidence does not confirm a repeated customer-visible gap.")}</p>
            </section>
          </div>
          <div class="leadership-source-links">
            ${evidenceLinks.length
              ? evidenceLinks.map((link) => `
                  <a class="evidence-chip ${escapeHtml(link.health)}" href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">
                    ${escapeHtml(link.label)}
                    <span>${escapeHtml(sourceHealthLabel(link.health))} · Open exact source ↗</span>
                  </a>
                `).join("")
              : `<span class="missing-source">No exact public source is available for this decision.</span>`}
          </div>
        </div>
      </details>
    </article>
  `;
}

function leadershipHighlightCardMarkup(highlight) {
  const sourceLink = isHttpUrl(highlight.sourceUrl)
    ? `<a href="${escapeHtml(highlight.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(highlight.sourceLabel || "Open source")} ↗</a>`
    : "";
  const sectionLink = highlight.pageUrl
    ? `<a href="${escapeHtml(highlight.pageUrl)}">${escapeHtml(highlight.sectionLabel)} →</a>`
    : `<a href="#${escapeHtml(highlight.sectionId)}" data-leadership-target="${escapeHtml(highlight.sectionId)}">${escapeHtml(highlight.sectionLabel)} →</a>`;
  return `
    <article class="leadership-highlight-card" data-highlight-kind="${escapeHtml(highlight.kind)}">
      <div class="leadership-highlight-top">
        <span>${escapeHtml(highlight.label)}</span>
        ${highlight.badge ? `<small>${escapeHtml(highlight.badge)}</small>` : ""}
      </div>
      <h4>${escapeHtml(highlight.title)}</h4>
      <p>${escapeHtml(highlight.detail)}</p>
      <p class="leadership-highlight-magnitude"><b>Waters business exposure:</b> UNQUANTIFIED — validation required</p>
      <footer>
        ${sectionLink}
        ${sourceLink}
      </footer>
    </article>
  `;
}

function leadershipHighlightsMarkup(highlights, recommendations) {
  return `
    <article class="leadership-snapshot" aria-label="Executive highlights across the competitive intelligence page">
      <h4 class="leadership-snapshot-thesis">${escapeHtml(leadershipBriefThesis())}</h4>
      <div class="leadership-highlight-grid">
        ${highlights.map(leadershipHighlightCardMarkup).join("")}
      </div>
      <footer class="leadership-snapshot-footer">
        <span>${recommendations.length} prioritized decision${recommendations.length === 1 ? "" : "s"} are queued for review.</span>
        <a href="#decisions-needed" data-leadership-target="decisions-needed">Review Decisions needed →</a>
      </footer>
    </article>
  `;
}

function renderDecisionPacket(signals) {
  const recommendations = recommendationsByConfidence(signals);
  const highlights = leadershipBriefHighlights(signals);
  const leadershipDecisionCount = byId("leadershipDecisionCount");
  leadershipDecisionCount.textContent = `${highlights.length} executive highlight${highlights.length === 1 ? "" : "s"}`;
  leadershipDecisionCount.dataset.mobileLabel = `${highlights.length} highlight${highlights.length === 1 ? "" : "s"}`;
  if (!highlights.length) {
    state.activeDecisionBreakdown = null;
    lastDecisionPacketText = leadershipBriefText([], recommendations);
    byId("decisionPacket").innerHTML = `
      <article class="leadership-brief-empty">
        <span>${escapeHtml(horizonContext().summaryLabel)}</span>
        <strong>No cross-page highlight is supported under ${escapeHtml(filterScopeLabel())}.</strong>
        <p>Broaden the filters or review the underlying evidence sections.</p>
      </article>
    `;
    return;
  }
  state.activeDecisionBreakdown = recommendations[0]?.priorityBreakdown || null;
  lastDecisionPacketText = leadershipBriefText(highlights, recommendations);
  byId("decisionPacket").innerHTML = `
    ${leadershipHighlightsMarkup(highlights, recommendations)}
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
        <h3>${escapeHtml(horizonContext().summaryLabel)} does not yet support a roadmap action</h3>
        <p>${escapeHtml(horizonContext().interpretation)} ${escapeHtml(horizonContext().decisionRule)}</p>
      </div>
    `;
    return;
  }
  const breakdown = topRecommendation.priorityBreakdown;
  const sourceQuality = sourceQualityLabel();
  const scope = filterScopeLabel();
  const validation = validationNeedsForRecommendation(topRecommendation);
  const roadmapPressure = [topRecommendation.technology, topRecommendation.marketSegment].filter(Boolean).join(" · ");
  const publicEvidenceSummary = positiveCountSummary([
    ["launches", launches.length, `matching launch${launches.length === 1 ? "" : "es"}`],
    ["strategic", strategicSignals.length, `strategic move${strategicSignals.length === 1 ? "" : "s"}`],
    ["customer", breakdown.customerPullEvidence.estimatedMentions, `estimated customer/public mention${breakdown.customerPullEvidence.estimatedMentions === 1 ? "" : "s"}`],
  ]);

  byId("strategicConfidence").textContent = `Evidence priority: ${breakdown.evidencePriority} · Business impact: Unquantified`;
  byId("strategicRead").innerHTML = `
    <div class="readout-hero">
      <div>
        <h3>${escapeHtml(strategicThemeForRecommendation(topRecommendation))}</h3>
        <p><strong>Public evidence:</strong> ${escapeHtml(scope)} includes ${escapeHtml(publicEvidenceSummary)} related to this decision.</p>
        <p><strong>${escapeHtml(horizonContext().mode)} interpretation:</strong> ${escapeHtml(`${horizonContext().interpretation} ${competitorIntentForRecommendation(topRecommendation, signals)}`)}</p>
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
    sourceLinkLabel: "Open press release ↗",
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
    detail: item.dateRange,
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
      family: "Scientific publications",
      title: item.title,
      detail: `${item.sourceName} · ${formatDate(item.date)}`,
      url: item.sourceUrl,
    }));
  const trendItems = matchedTrends.map((item) => ({
    family: "Scientific publications",
    title: item.theme,
    detail: `${Number(item.counts[filters.horizon.value] || 0).toLocaleString()} publication records · ${horizonLabel()}`,
    url: pubMedSearchUrl(item.query),
  }));

  const groups = [
    { label: "Competitor moves", items: [...launchItems, ...strategicItems] },
    { label: "SEC filings", items: filingItems },
    { label: "Conferences", items: conferenceItems },
    { label: "Public customer voice", items: customerItems },
    { label: "Scientific publications", items: [...trendItems, ...publicationSignals] },
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
  return {
    groups,
    activeGroups,
    familyCount: activeGroups.length,
    recordCount: groups.reduce((total, group) => total + group.items.length, 0),
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
      action: "Compare method setup, daily operation, troubleshooting, and data review across the latest competitor workflow and the closest Waters configuration. Select one friction point for a defined roadmap requirement.",
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
      synthesis: "Scientific publications, conference agendas, competitor activity, and corporate disclosures are converging on biopharma workflows rather than stand-alone instruments.",
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

function horizonTrendNarrative(candidate, evidence) {
  const context = horizonContext();
  const evidenceLine = `${evidence.familyCount} evidence type${evidence.familyCount === 1 ? "" : "s"} and ${evidence.recordCount} linked record${evidence.recordCount === 1 ? "" : "s"}`;
  const variants = {
    "30d": {
      synthesis: `In the last 30 days, ${evidenceLine} point to this theme. ${context.interpretation}`,
      implication: "Do not treat this as a roadmap conclusion yet. Test whether the newest evidence changes a Waters comparison or exposes a new customer problem.",
      action: "Review the three newest linked records and classify the signal as monitor, validate, or respond. Record what is genuinely new versus evidence already known before this month.",
    },
    "60d": {
      synthesis: `Across 60 days, ${evidenceLine} form an emerging pattern. ${context.interpretation}`,
      implication: "Open a targeted validation only if the same capability or customer problem repeats across independent sources.",
      action: "Compare the first and second 30-day periods. Identify what repeated, what disappeared, and the one claim or customer problem that now warrants validation.",
    },
    "90d": {
      synthesis: `This quarter, ${evidenceLine} show whether the theme is repeating beyond a single announcement. ${candidate.synthesis}`,
      implication: `Use the quarter's evidence to define one focused Waters validation question. ${candidate.implication}`,
      action: "Build a quarterly claim-and-problem matrix from the linked sources, then choose one capability to validate with product, field, or customer evidence.",
    },
    "1y": {
      synthesis: candidate.synthesis,
      implication: candidate.implication,
      action: candidate.action,
    },
    "3y": {
      synthesis: `${candidate.synthesis} Across three years, the relevant question is whether the pattern persists across product generations and multiple independent sources.`,
      implication: `Treat this as structural only where the linked evidence persists across the full period. ${candidate.implication}`,
      action: "Map how the theme changed across the three-year period, identify the capability that persisted, and separate durable roadmap pressure from short-lived campaign activity.",
    },
  };
  return {
    title: horizonTrendTitle(candidate.title),
    ...(variants[filters.horizon.value] || {
      synthesis: candidate.synthesis,
      implication: candidate.implication,
      action: candidate.action,
    }),
  };
}

function renderOverallTrendAnalysis(signals) {
  const candidates = overallTrendCandidates()
    .map((candidate) => {
      const evidence = overallTrendEvidence(signals, candidate);
      return { ...candidate, evidence, narrative: horizonTrendNarrative(candidate, evidence) };
    })
    .filter((candidate) => candidate.evidence.familyCount >= 2)
    .sort((a, b) => b.evidence.familyCount - a.evidence.familyCount || b.evidence.recordCount - a.evidence.recordCount)
    .slice(0, 3);
  const container = byId("overallTrendAnalysis");
  if (!container) return;
  state.overallTrendCandidates = candidates;
  if (!candidates.length) {
    container.innerHTML = `<div class="empty">No trend appears in at least two different types of public evidence under ${escapeHtml(filterScopeLabel())}. Broaden a filter to inspect the wider market.</div>`;
    return;
  }
  container.innerHTML = `
    <div class="overall-trend-list">
      ${candidates.map((candidate, index) => {
        const evidence = candidate.evidence;
        return `
          <article class="overall-trend-card">
            <div class="overall-trend-card-top">
              <span class="trend-rank">${index + 1}</span>
              <div>
                <h4>${escapeHtml(candidate.narrative.title)}</h4>
              </div>
            </div>
            <p>${escapeHtml(candidate.narrative.synthesis)}</p>
            <div class="trend-source-family" aria-label="Open linked public records by evidence type">
              ${evidence.activeGroups.map((group) => `
                <a class="active" href="#decisionEvidenceModal" data-trend-id="${escapeHtml(candidate.id)}" data-trend-evidence-family="${escapeHtml(group.label)}" title="Open ${group.items.length} linked public records" aria-label="View ${group.items.length} ${escapeHtml(group.label)} proofs">
                  ${escapeHtml(group.label)} <b>${group.items.length}</b>
                </a>
              `).join("")}
            </div>
            <div class="trend-decision">
              <span>What it means for Waters</span>
              <strong>${escapeHtml(candidate.narrative.implication)}</strong>
            </div>
            <div class="trend-action">
              <span>Next PM consideration</span>
              <p>${escapeHtml(candidate.narrative.action)}</p>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderDecisionQueue(signals) {
  const allDecisions = recommendationsByConfidence(signals);
  const decisions = allDecisions.slice(0, 3);
  byId("decisionQueueCount").textContent = `${decisions.length} decision${decisions.length === 1 ? "" : "s"}`;
  byId("decisionQueue").innerHTML = decisions.length
    ? decisions
        .map((rec, index) => {
          const breakdown = rec.priorityBreakdown;
          const tone = confidenceTone(breakdown);
          const facts = leadershipDecisionFacts(rec, breakdown);
          return `
            <article class="decision-card">
              <div class="decision-card-top">
                <div class="decision-queue-title">
                  <span class="decision-queue-rank">Decision ${index + 1}</span>
                </div>
                <span class="confidence-pill ${tone.className}">${escapeHtml(breakdown.confidenceState.state)}; business impact: Unquantified</span>
              </div>
              <h4>${escapeHtml(rec.title)}</h4>
              <div class="decision-why">
                <strong>Details</strong>
                ${decisionUrgencyMarkup(rec, index)}
              </div>
              <dl class="decision-queue-facts">
                <div><dt>Accountable owner</dt><dd>${escapeHtml(rec.decisionOwners || "Product Management owner")}</dd></div>
                <div><dt>Decision date</dt><dd>${escapeHtml(rec.decisionDue || "Next roadmap review")}</dd></div>
                <div><dt>Next PM Considerations</dt><dd>${escapeHtml(facts.deliverable)}</dd></div>
                <div><dt>Decision options</dt><dd>${escapeHtml((rec.decisionOptions || ["Build", "Package", "Reposition", "Partner", "Monitor", "Stop"]).join(" · "))}</dd></div>
                <div><dt>Final go / no-go gate</dt><dd>${escapeHtml(rec.decisionGate || validationGateForRecommendation(rec, breakdown))}</dd></div>
                <div><dt>Engineering / validation effort</dt><dd>${escapeHtml(rec.engineeringValidationEffort || "Unquantified — validation required")}</dd></div>
                <div><dt>Outstanding internal evidence</dt><dd>${escapeHtml((rec.outstandingInternalEvidence || breakdown.magnitude.requiredInternalData || []).join(" · "))}</dd></div>
              </dl>
              ${businessMagnitudeMarkup(breakdown.magnitude)}
              ${scoreDriverMarkup(breakdown)}
            </article>
          `;
        })
        .join("")
    : `<div class="empty">No recommendation has enough public support under ${escapeHtml(filterScopeLabel())}. Gather more conference, product-page, and customer evidence before changing the roadmap.</div>`;
}

function horizonCompetitorProfile(baseProfile, competitor, evidenceItems) {
  const evidenceCount = evidenceItems.length;
  const latest = evidenceItems[0];
  const context = horizonContext();
  const noEvidence = {
    focus: `No dated launch, strategic move, or filing signal appears in ${horizonLabel().toLowerCase()}`,
    intent: `No ${horizonLabel().toLowerCase()} evidence supports a new direction for ${competitor}`,
    shortTermImpact: `Do not carry older evidence into this view. ${context.decisionRule}`,
    midLongTermImpact: "Keep the established competitor hypothesis as background only until new dated evidence appears.",
    response: {
      ...baseProfile.response,
      accelerate: "Do not accelerate a roadmap response without new evidence in the selected window.",
    },
  };
  if (!evidenceCount) return noEvidence;

  const latestLabel = latest ? `${latest.title} (${latest.type.toLowerCase()}, ${formatDate(latest.date)})` : "the newest linked record";
  const variants = {
    "30d": {
      focus: `Newest evidence: ${latestLabel}`,
      intent: `New 30-day alert: ${baseProfile.intent}`,
      shortTermImpact: `Triage whether ${latestLabel} changes an active Waters comparison. Do not infer a sustained direction from one month.`,
      midLongTermImpact: "One month cannot support a 12–36 month conclusion. Reassess only if the same direction persists through the next quarter.",
      response: { ...baseProfile.response, accelerate: "Do not accelerate yet; require a repeat signal or direct customer evidence." },
    },
    "60d": {
      focus: `${evidenceCount} recent item${evidenceCount === 1 ? "" : "s"}; newest is ${latestLabel}`,
      intent: `Emerging 60-day pattern: ${baseProfile.intent}`,
      shortTermImpact: `Validate whether the recent evidence repeats the same capability or buying criterion before changing positioning.`,
      midLongTermImpact: "Treat this as directional. Promote it to a longer-term threat only if it persists through the quarter.",
      response: { ...baseProfile.response, accelerate: "Accelerate only if a second independent source confirms customer or competitive impact." },
    },
    "90d": {
      focus: `${evidenceCount} item${evidenceCount === 1 ? "" : "s"} this quarter; newest is ${latestLabel}`,
      intent: `Quarterly direction: ${baseProfile.intent}`,
      shortTermImpact: `Use this quarter's repeated evidence to define one competitor claim or product gap for validation.`,
      midLongTermImpact: `If the quarterly pattern continues, ${baseProfile.midLongTermImpact}`,
    },
    "1y": {
      focus: `${evidenceCount} item${evidenceCount === 1 ? "" : "s"} across the year. ${baseProfile.focus}`,
      intent: `Repeated one-year direction: ${baseProfile.intent}`,
      shortTermImpact: baseProfile.shortTermImpact,
      midLongTermImpact: baseProfile.midLongTermImpact,
    },
    "3y": {
      focus: `${evidenceCount} item${evidenceCount === 1 ? "" : "s"} across three years. ${baseProfile.focus}`,
      intent: `Sustained three-year direction: ${baseProfile.intent}`,
      shortTermImpact: `Separate the newest move from the longer pattern, then test whether the same capability pressure persisted across product generations.`,
      midLongTermImpact: baseProfile.midLongTermImpact,
      response: { ...baseProfile.response, accelerate: `${baseProfile.response.accelerate} Require evidence that the theme persisted across the multi-year period.` },
    },
  };
  return { ...baseProfile, ...(variants[filters.horizon.value] || {}) };
}

function competitorIntentProfile(competitor, signals) {
  const launches = currentLaunches().filter((launch) => launch.competitor === competitor);
  const strategic = currentStrategicSignals(signals).filter((signal) => signal.competitor === competitor);
  const earnings = currentEarningsSignals(signals).filter((signal) => signal.competitor === competitor);
  const filings = currentFilingInsights().filter((insight) => insight.competitor === competitor);
  const profileCopy = {
    "Thermo Fisher": {
      focus: "Bioproduction adjacency, chromatography/MS resilience, and LC-MS platform visibility",
      intent: "Strengthen end-to-end biopharma workflow position, not only individual instruments",
      activityThemes: [
        {
          title: "Analytical Instruments Expanded Revenue and Margin",
          insight: "Q2 Analytical Instruments revenue rose 6.9% to $1.847 billion; segment income rose 30.5%, and margin expanded 4.2 points to 23.0%.",
          matches: ["Second Quarter 2026 Results"],
        },
        {
          title: "AI-Enabled Orbitrap Platforms Target Application Workflows",
          insight: "Apex and Excedion are positioned around multiomics, biopharma characterization, small molecules and hard-to-detect drug-development targets—not instrument performance alone.",
          matches: ["AI-enabled Orbitrap"],
        },
        {
          title: "Customer Infrastructure Extends the Platform Story",
          insight: "The new Bioprocess Design Center and PRECISE-SG100K collaboration connect Thermo technology to customer co-development and integrated population proteomics.",
          matches: ["bioprocess and proteomics customer infrastructure"],
        },
      ],
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
      activityThemes: [
        {
          title: "Productized End-to-End LC/LC-MS Workflows",
          insight: "Bundled LC/LC-MS instruments with MAM, DMPK, OpenLab Sync, and fluorescence-detector workflows.",
          matches: ["6230C", "Fluorescence Detector", "Sound Analytics", "OpenLab Sync"],
        },
        {
          title: "Expanded Advanced-Biopharma and Regional Access",
          insight: "Expanded APAC access through oligonucleotide and proteomics partnerships plus new South Korea and Mumbai hubs.",
          matches: ["NATi", "ORCA", "OmixAI", "Mumbai"],
        },
        {
          title: "Made AI a Lab and Operating Capability",
          insight: "Partnered with OpenAI and BCG to apply AI across product development, operations, and scientific workflows.",
          matches: ["OpenAI"],
        },
        {
          title: "Confirmed LC/LC-MS and Lifecycle Services as Growth Engines",
          insight: "Reported LC/LC-MS growth in pharma, APAC, and advanced materials while expanding CrossLab services.",
          matches: ["LC and LC-MS are helping drive", "CrossLab and services growth"],
        },
      ],
      likelyNext: "Agilent is likely to package more regulated, application-specific LC/LC-MS workflows that combine OpenLab or partner software, AI-assisted execution, regional co-development hubs, and CrossLab lifecycle services—especially in pharma, advanced therapeutics, APAC, and advanced materials.",
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
      focus: "Software-integrated instrument operation and workflow packaging",
      intent: "Make SCIEX OS part of the instrument value proposition; broader HRMS depth is not verified by the current evidence",
      shortTermImpact: "Waters may need sharper proof in LC-MS/MS quantitation, HRMS sensitivity, high-throughput screening, and software-assisted data review for competitive evaluations.",
      midLongTermImpact: "SCIEX could shape customer expectations around instrument-plus-software performance cycles, making Waters' LC-MS roadmap look slower if workflow speed and informatics are not prominent.",
      response: {
        defend: "Arm LC-MS/MS and HRMS deals with use-case-specific proof for sensitivity, robustness, data confidence, and service support.",
        differentiate: "Make the Waters LC plus MS plus informatics handoff explicit, especially where SCIEX positions instrument and software as one workflow.",
        accelerate: "Prioritize high-throughput screening, HRMS workflow speed, and software-assisted data review only where conference capture and public customer evidence show real demand.",
      },
    },
    PerkinElmer: {
      focus: "Current PerkinElmer LC portfolio activity; Revvity evidence is excluded",
      intent: "Maintain LC portfolio visibility while the current evidence remains too sparse for a broader software or ecosystem conclusion",
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
    earnings.length ? `${earnings.length} earnings result${earnings.length === 1 ? "" : "s"}` : "",
    filings.length ? `${filings.length} filing insight${filings.length === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  const evidenceCount = launches.length + strategic.length + earnings.length + filings.length;
  const evidenceItems = [
    ...launches.map((launch) => ({
      type: "Launch",
      title: launch.product,
      date: launch.date,
      sourceName: launch.sourceName,
      url: timelineUrlForLaunch(launch),
      sourceLinkLabel: "Open press release ↗",
      detail: launch.pmImplication || launch.roadmapQuestion || launch.signalType,
    })),
    ...strategic.map((signal) => ({
      type: "Strategic move",
      title: signal.title,
      date: signal.date,
      sourceName: signal.sourceName,
      url: signal.sourceUrl,
      detail: signal.summary || signal.pmImplication || signal.signalType,
    })),
    ...earnings.map((signal) => ({
      type: "Earnings result",
      title: signal.title,
      date: signal.date,
      sourceName: signal.sourceName,
      url: signal.sourceUrl,
      detail: signal.summary || signal.pmImplication || signal.signalType,
    })),
    ...filings.map((insight) => ({
      type: "Filing insight",
      title: insight.headline,
      date: insight.date,
      sourceName: insight.sourceName,
      url: insight.sourceUrl,
      detail: insight.evidence || insight.whyItMatters || insight.pmImplication,
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));
  const inference = competitiveMethodology.assessInference(evidenceItems, competitor);
  const evidenceGroups = inference.families.map((family, index) => ({
    key: `family-${index}`,
    label: family.familyLabel,
    items: family.records,
  }));
  const sourceHealth = competitorSourceHealth(competitor);
  const confidence = inference.label;
  const risk = "Watch";
  const horizonProfile = horizonCompetitorProfile(profileCopy, competitor, evidenceItems);
  const interpretationChecks = {
    Agilent: {
      alternative: "The activity may reflect coordinated portfolio promotion and regional market development rather than a durable shift toward one integrated platform strategy.",
      falsifier: "The inference weakens if the next two launch cycles stop pairing instruments with OpenLab or partner software, AI-enabled execution, regional hubs, and CrossLab services.",
    },
    "Thermo Fisher": {
      alternative: "Chromatography and MS resilience may be offsetting portfolio weakness rather than signaling a new end-to-end workflow investment thesis.",
      falsifier: "The inference weakens if subsequent earnings and launches do not connect chromatography/MS with bioproduction, software, or account-level workflow bundles.",
    },
    Shimadzu: {
      alternative: "The Nexera activity may be a normal platform refresh concentrated on routine LC replacements rather than a broader workflow-ownership strategy.",
      falsifier: "The inference weakens if follow-on releases do not extend into software, automation, method transfer, or application-specific packages.",
    },
    SCIEX: {
      alternative: "novus V55 with SCIEX OS 5.0 may be a version-cycle packaging decision, not proof of broader HRMS depth or a sustained platform strategy.",
      falsifier: "Any claim about HRMS depth remains unverified until a separate dated primary source shows an HRMS product, method, or workflow expansion.",
    },
    PerkinElmer: {
      alternative: "The limited current PerkinElmer evidence may reflect normal portfolio maintenance; Revvity filings and acquisitions are excluded unless an explicit current entity relationship is documented.",
      falsifier: "The inference remains unconfirmed unless current PerkinElmer sources show repeated LC, software, service, or application-workflow investment.",
    },
  }[competitor] || {};
  const magnitude = competitiveMethodology.unquantifiedMagnitude({
    affectedSegment: profileCopy?.focus || "Not established from public evidence",
    validationOwner: "Competitive Intelligence + Product Management + Commercial Analytics",
  });
  return {
    competitor,
    ...horizonProfile,
    evidence: evidenceBits.length ? evidenceBits.join(" · ") : "No matching public evidence in the selected filters; continue checking the linked sources",
    confidence,
    confidenceScore: null,
    inference,
    alternative: interpretationChecks.alternative || "A normal release cycle could explain the observed activity; additional independent evidence is required.",
    falsifier: interpretationChecks.falsifier || "The inference weakens if the next dated evidence does not repeat the same strategic direction.",
    magnitude,
    sourceHealth,
    risk,
    evidenceCount,
    evidenceItems,
    evidenceGroups,
    evidenceTypeCount: evidenceBits.length,
    className: inference.label === "High" ? "strong" : inference.label === "Low" ? "needs-validation" : "directional",
  };
}

function competitorDirectionStatement(profile) {
  const direction = String(profile.intent || "")
    .replace(/^(?:New 30-day alert|Emerging 60-day pattern|Quarterly direction|Repeated one-year direction|Sustained three-year direction):\s*/i, "")
    .trim();
  if (!direction || /^No\b/i.test(direction)) return direction;
  const statement = `${profile.competitor}'s likely strategy is to ${direction.charAt(0).toLowerCase()}${direction.slice(1)}`;
  return /[.!?]$/.test(statement) ? statement : `${statement}.`;
}

function intentPeriodTitle() {
  return ({
    "30d": "the Last 30 Days",
    "60d": "the Last 60 Days",
    "90d": "the Last 90 Days",
    "1y": "the Last Year",
    "3y": "the Last Three Years",
  })[filters.horizon.value] || `the Selected ${horizonLabel()}`;
}

function competitorActivityThemes(profile) {
  const configuredThemes = Array.isArray(profile.activityThemes) ? profile.activityThemes : [];
  const themes = configuredThemes.map((theme) => ({
    ...theme,
    items: profile.evidenceItems.filter((item) => (theme.matches || []).some((match) => item.title.toLowerCase().includes(String(match).toLowerCase()))),
  })).filter((theme) => theme.items.length);
  if (themes.length) return themes;

  return profile.evidenceItems.slice(0, 4).map((item) => ({
    title: item.title,
    insight: item.detail || `${item.type} published ${formatDate(item.date)}.`,
    items: [item],
  }));
}

function competitorActivityMarkup(profile) {
  const themes = competitorActivityThemes(profile);
  return `
    <section class="intent-activity-summary" aria-label="What ${escapeHtml(profile.competitor)} did in ${escapeHtml(intentPeriodTitle())}">
      <div class="intent-activity-heading">
        <h5>What ${escapeHtml(profile.competitor)} Did in ${escapeHtml(intentPeriodTitle())}</h5>
      </div>
      <div class="intent-activity-theme-grid">
        ${themes.map((theme, themeIndex) => `
          <article class="intent-activity-theme">
            <div class="intent-activity-theme-top">
              <h6>${escapeHtml(theme.title)}</h6>
              <button type="button" class="intent-theme-source-button" data-competitor="${escapeHtml(profile.competitor)}" data-intent-theme-sources="${themeIndex}" aria-label="View ${theme.items.length} source${theme.items.length === 1 ? "" : "s"} for ${escapeHtml(theme.title)}">
                <span>Sources</span><b>${theme.items.length}</b><span aria-hidden="true">→</span>
              </button>
            </div>
            <ul class="intent-activity-bullets"><li>${escapeHtml(theme.insight)}</li></ul>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function competitorIntentOptionMarkup(profile, index, selected) {
  const activityLabel = profile.evidenceCount ? "Active" : "Monitor";
  return `
    <button type="button" class="intent-competitor-option${selected ? " is-selected" : ""}" data-intent-select="${escapeHtml(profile.competitor)}" role="tab" aria-selected="${selected}" aria-controls="intent-selected-detail">
      <span class="intent-option-copy">
        <strong>${escapeHtml(profile.competitor)}</strong>
        <small class="intent-option-status ${profile.evidenceCount ? "active" : "monitor"}">${activityLabel}</small>
        <span>${profile.evidenceCount} public move${profile.evidenceCount === 1 ? "" : "s"}</span>
      </span>
      <span class="intent-option-arrow" aria-hidden="true">›</span>
    </button>
  `;
}

function competitorIntentDetailMarkup(profile) {
  const competitorAccent = competitorColors[profile.competitor] || "#789199";
  return `
    <article id="intent-selected-detail" class="intent-detail-panel risk-${profile.risk.toLowerCase()}" style="--intent-competitor-accent: ${escapeHtml(competitorAccent)}" role="tabpanel" aria-label="${escapeHtml(profile.competitor)} competitor intent">
      <div class="intent-detail-header">
        <div class="intent-detail-identity">
          <div class="intent-detail-title">
            <span>Selected competitor</span>
            <h4>${escapeHtml(profile.competitor)}</h4>
          </div>
        </div>
        <div class="intent-header-meta">
          <div class="intent-badges">
            <span class="confidence-pill ${profile.className}">Inference confidence · ${escapeHtml(profile.confidence)}</span>
            <span class="tag medium">Business impact · Unquantified</span>
          </div>
          ${profile.evidenceGroups.length ? `
            <span class="intent-evidence-count-links intent-header-evidence">
              ${profile.evidenceGroups.map((group) => `
                <a href="#decisionEvidenceModal" data-competitor="${escapeHtml(profile.competitor)}" data-intent-evidence-type="${escapeHtml(group.key)}" aria-label="View ${group.items.length} ${escapeHtml(group.label)} for ${escapeHtml(profile.competitor)}">
                  ${group.items.length} ${escapeHtml(group.label)}
                </a>
              `).join("")}
            </span>
          ` : ""}
        </div>
      </div>
      ${competitorActivityMarkup(profile)}
      <div class="intent-strategy-layout">
        <section class="intent-now intent-likely-direction">
          <span>Strategic inference · ${escapeHtml(profile.competitor)}'s likely direction</span>
          <strong>${escapeHtml(profile.likelyNext || competitorDirectionStatement(profile))}</strong>
        </section>
      </div>
      <div class="intent-methodology-grid">
        <section><span>Alternative reading</span><p>${escapeHtml(profile.alternative)}</p></section>
        <section><span>Falsifier / signal to watch</span><p>${escapeHtml(profile.falsifier)}</p></section>
      </div>
      ${profile.inference.limitation ? `<p class="intent-evidence-limitation"><b>Evidence limitation:</b> ${escapeHtml(profile.inference.limitation)}</p>` : ""}
      <details class="intent-confidence-rubric">
        <summary>Why the inference confidence is ${escapeHtml(profile.confidence)}</summary>
        <dl>
          <div><dt>Source independence</dt><dd>${escapeHtml(profile.inference.rubric.sourceIndependence)}</dd></div>
          <div><dt>Directness</dt><dd>${escapeHtml(profile.inference.rubric.directness)}</dd></div>
          <div><dt>Temporal consistency</dt><dd>${escapeHtml(profile.inference.rubric.temporalConsistency)}</dd></div>
          <div><dt>Corroboration</dt><dd>${escapeHtml(profile.inference.rubric.corroboration)}</dd></div>
          <div><dt>Contradictions / alternatives</dt><dd>${escapeHtml(profile.inference.rubric.contradictions)}</dd></div>
        </dl>
      </details>
      ${businessMagnitudeMarkup(profile.magnitude)}
      <details class="intent-decision-detail">
        <summary>
          <span>Waters PM Considerations</span>
          <small>Defend · differentiate · accelerate</small>
        </summary>
        <div class="intent-decision-detail-body">
          <div class="intent-impact-grid">
            <p><span>0–11 month impact</span>${escapeHtml(profile.shortTermImpact)}</p>
            <p><span>12–36 month impact</span>${escapeHtml(profile.midLongTermImpact)}</p>
          </div>
          <div class="intent-response-grid">
            <p><span>Defend</span>${escapeHtml(profile.response.defend)}</p>
            <p><span>Differentiate</span>${escapeHtml(profile.response.differentiate)}</p>
            <p><span>Accelerate</span>${escapeHtml(profile.response.accelerate)}</p>
          </div>
        </div>
      </details>
    </article>
  `;
}

function renderCompetitorIntentCards(signals) {
  const competitorOrder = ["Thermo Fisher", "Agilent", "Shimadzu", "SCIEX", "PerkinElmer"];
  const competitors = filters.competitor.value === "All" ? competitorOrder : competitorOrder.filter((name) => name === filters.competitor.value);
  const threatRank = { High: 3, Medium: 2, Watch: 1 };
  const profiles = competitors
    .map((competitor) => competitorIntentProfile(competitor, signals))
    .sort((a, b) => (threatRank[b.risk] || 0) - (threatRank[a.risk] || 0) || b.evidenceCount - a.evidenceCount || competitorOrder.indexOf(a.competitor) - competitorOrder.indexOf(b.competitor));
  state.competitorIntentProfiles = profiles;
  const selectedProfile = profiles.find((profile) => profile.competitor === state.activeIntentCompetitor) || profiles[0];
  state.activeIntentCompetitor = selectedProfile?.competitor || "";
  byId("intentCount").textContent = profiles.length === 1 ? "1 competitor" : `${profiles.length} competitors`;
  byId("competitorIntent").innerHTML = selectedProfile
    ? `
        <div class="intent-master-detail">
          <nav class="intent-competitor-rail" role="tablist" aria-label="Competitors">
            <div class="intent-rail-heading">Competitors</div>
            ${profiles.map((profile, index) => competitorIntentOptionMarkup(profile, index, profile.competitor === selectedProfile.competitor)).join("")}
          </nav>
          ${competitorIntentDetailMarkup(selectedProfile)}
        </div>
      `
    : `<div class="empty">No competitor intent profile matches the active filters.</div>`;
}

function roadmapImpactEvidenceRecords(capability, signals) {
  const termsByCapability = {
    "LC platform": ["lc platform", "hplc", "liquid chromatography", "lc system", "routine lc"],
    "UHPLC modules": ["uhplc", "uplc", "module", "detector", "pump"],
    "LC-MS sensitivity": ["lc-ms", "sensitivity", "mass spectrometer", "qtof", "tof"],
    "LC-MS/MS quantitation": ["lc-ms/ms", "quantitation", "quantitative", "triple quadrupole", "triple quad"],
    "2D LC": ["2d lc", "2d-lc", "two-dimensional liquid chromatography"],
    "Software usability": ["software", "usability", "data review", "empower", "chromeleon", "labsolutions", "sciex os"],
    Informatics: ["informatics", "software", "data workflow", "data review", "digital lab"],
    Automation: ["automation", "automated", "autosampler", "plate loader", "workflow execution"],
    "Application kits": ["application kit", "application workflow", "method package", "method readiness", "application note"],
    "Sample prep": ["sample prep", "sample preparation", "extraction", "cleanup"],
    "Regulated methods": ["pfas", "regulated", "compliance", "validated method", "environmental contaminant"],
  };
  const terms = termsByCapability[capability] || [capability.toLowerCase()];
  const records = [];
  const addRecord = (record) => {
    if (!isHttpUrl(record.url) || sourceHealthForUrl(record.url) === "bad") return;
    const searchText = String(record.searchText || `${record.title} ${record.type}`).toLowerCase();
    if (!terms.some((term) => searchText.includes(term))) return;
    records.push(record);
  };

  currentLaunches().forEach((item) => addRecord({
    title: `${item.competitor}: ${item.product || item.title}`,
    type: `Official product launch · ${item.sourceName || "Public source"}`,
    date: item.date,
    url: timelineUrlForLaunch(item),
    sourceLinkLabel: "Open press release ↗",
    searchText: `${item.product} ${item.title} ${item.summary} ${item.technology} ${item.signalType}`,
  }));
  currentStrategicSignals(signals).forEach((item) => addRecord({
    title: `${item.competitor}: ${item.title}`,
    type: `Strategic move · ${item.sourceName || "Public source"}`,
    date: item.date,
    url: item.sourceUrl,
    searchText: `${item.title} ${item.summary} ${item.technology} ${item.signalType}`,
  }));
  currentFilingInsights().forEach((item) => addRecord({
    title: `${item.competitor}: ${item.headline}`,
    type: `Filing insight · ${item.sourceName || "SEC filing"}`,
    date: item.date,
    url: item.sourceUrl,
    searchText: `${item.headline} ${item.summary} ${item.technology} ${item.marketSegment}`,
  }));
  currentCustomerVoiceItems().forEach((item) => {
    customerVoiceSourceLinks(item).forEach((link) => addRecord({
      title: `${item.company}: ${item.product}`,
      type: `Public customer evidence · ${link.label}`,
      date: link.sourceDate,
      url: link.url,
      searchText: `${item.product} ${item.theme} ${item.category} ${item.customerLanguageSignal} ${item.buyingPriority}`,
    }));
  });
  currentTrends().forEach((trend) => addRecord({
    title: trend.theme,
    type: `Scientific publication trend · ${Number(trend.counts?.[filters.horizon.value] || 0).toLocaleString()} PubMed records`,
    date: state.data?.asOfDate,
    url: pubMedTrendSearchUrl(trend.query, filters.horizon.value),
    searchText: `${trend.theme} ${trend.technology} ${trend.marketSegment} ${trend.query}`,
  }));

  const seen = new Set();
  return records
    .filter((record) => {
      if (seen.has(record.url)) return false;
      seen.add(record.url);
      return true;
    })
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}

function roadmapImpactRows(signals) {
  const horizon = filters.horizon.value;
  const capabilities = [
    "LC platform",
    "UHPLC modules",
    "LC-MS sensitivity",
    "LC-MS/MS quantitation",
    "2D LC",
    "Software usability",
    "Informatics",
    "Automation",
    "Application kits",
    "Sample prep",
    "Regulated methods",
  ];
  const publicationThresholds = {
    "30d": { high: 500, medium: 75 },
    "60d": { high: 900, medium: 150 },
    "90d": { high: 1300, medium: 225 },
    "1y": { high: 4000, medium: 800 },
    "3y": { high: 10000, medium: 2000 },
  }[horizon] || { high: 4000, medium: 800 };
  const rows = capabilities.map((capability) => {
    const records = roadmapImpactEvidenceRecords(capability, signals);
    const publicationVolume = records.reduce((total, record) => {
      const match = record.type.match(/([\d,]+) PubMed records/);
      return total + Number((match?.[1] || "0").replaceAll(",", ""));
    }, 0);
    const competitorRecords = records.filter((record) => /Official product launch|Strategic move|Filing insight/.test(record.type)).length;
    const evidenceFamilies = new Set(records.map((record) => record.type.split(" · ")[0])).size;
    const trend = publicationVolume >= publicationThresholds.high ? "High" : publicationVolume >= publicationThresholds.medium ? "Medium" : publicationVolume > 0 ? "Early" : "Early";
    const pressure = competitorRecords >= 3 ? "High" : competitorRecords >= 1 ? "Medium" : "Early";
    const evidence = evidenceFamilies >= 3 && records.length >= 5 ? "" : records.length ? "Limited cross-source support" : "More evidence needed";
    return { row: [capability, trend, pressure, evidence], records };
  });
  const visibleRows = (filters.technology.value === "All"
    ? rows
    : rows.filter(({ row: [capability] }) => textMatchesTechnology(capability, filters.technology.value)));
  const strengthRank = { Early: 1, Medium: 2, High: 3 };
  const { column: sortColumn, direction: sortDirection } = state.roadmapImpactSort;
  const sortValue = ({ row, records }, column) => {
    if (column === 1 || column === 2) return strengthRank[row[column]] || 0;
    if (column === 3) return records.length;
    return row[column] || "";
  };
  visibleRows.sort((a, b) => {
    const aValue = sortValue(a, sortColumn);
    const bValue = sortValue(b, sortColumn);
    const comparison = typeof aValue === "number"
      ? aValue - bValue
      : String(aValue).localeCompare(String(bValue));
    const directed = sortDirection === "asc" ? comparison : -comparison;
    return directed || a.row[0].localeCompare(b.row[0]);
  });
  state.roadmapImpactEvidence = visibleRows.map(({ row, records }) => ({ capability: row[0], records }));
  return visibleRows;
}

function roadmapImpactHeatmapMarkup(signals) {
  const visibleRows = roadmapImpactRows(signals);
  const { column: sortColumn, direction: sortDirection } = state.roadmapImpactSort;
  const columns = ["Waters capability", "Public trend strength", "Competitor pressure", "Linked evidence"];
  const sortHeaders = columns.map((label, index) => {
    const active = sortColumn === index;
    const ariaSort = active ? (sortDirection === "asc" ? "ascending" : "descending") : "none";
    const indicator = active ? (sortDirection === "asc" ? "↑" : "↓") : "↕";
    return `
      <strong role="columnheader" aria-sort="${ariaSort}">
        <button type="button" class="impact-sort-button${active ? " is-active" : ""}" data-impact-sort="${index}" aria-label="Sort by ${escapeHtml(label)}${active ? `, currently ${ariaSort}` : ""}">
          <span>${escapeHtml(label)}</span>
          <span class="impact-sort-indicator" aria-hidden="true">${indicator}</span>
        </button>
      </strong>
    `;
  }).join("");
  return `
    <section class="capability-heatmap" aria-labelledby="capabilityHeatmapTitle">
      <div class="capability-heatmap-heading">
        <div>
          <h4 id="capabilityHeatmapTitle">Waters Capability Priorities</h4>
          <p>Public trend strength, competitor pressure, and exact supporting evidence.</p>
        </div>
        <span>${visibleRows.length} capability areas</span>
      </div>
      <div class="capability-heatmap-grid" role="table" aria-label="Waters capability priority heatmap">
        <div class="capability-heatmap-header" role="row">
        ${sortHeaders}
        <strong role="columnheader">Waters business exposure</strong>
        </div>
        ${visibleRows
          .map(
            ({ row: [capability, trend, pressure, evidence], records }) => `
              <div class="capability-heatmap-row" role="row">
                <strong class="capability-heatmap-name" data-label="Waters capability">${escapeHtml(capability)}</strong>
                <span class="capability-heat-cell capability-trend-${trend.toLowerCase()}" data-label="Public trend strength">${escapeHtml(trend)}</span>
                <span class="capability-heat-cell capability-pressure-${pressure.toLowerCase()}" data-label="Competitor pressure">${escapeHtml(pressure)}</span>
                <span class="capability-heatmap-evidence" data-label="Linked evidence">
                ${records.length ? `
                  <button type="button" data-roadmap-evidence="${escapeHtml(capability)}" aria-label="View ${records.length} linked evidence records for ${escapeHtml(capability)}">
                    <b>${records.length} linked record${records.length === 1 ? "" : "s"}</b>
                    <small>View evidence →</small>
                  </button>
                ` : `<b>No linked records</b>`}
                ${evidence ? `<small>${escapeHtml(evidence)}</small>` : ""}
                </span>
                <span class="capability-heatmap-magnitude" data-label="Waters business exposure"><b>UNQUANTIFIED</b><small>Validation required</small></span>
              </div>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function customerVoiceSourceMap() {
  return new Map((state.customerVoice?.sources || []).map((source) => [source.id, source]));
}

const customerVoiceCommunityHosts = new Set([
  "chromforum.org",
  "fda.gov",
  "labwrench.com",
  "reddit.com",
  "selectscience.net",
]);

const customerVoiceEvidenceSourceTypes = new Set([
  "community_forum",
  "structured_review",
  "regulatory",
  "reddit",
]);

const customerVoiceSourceTypeDefinitions = {
  community_forum: { label: "Community forums", shortLabel: "Forum" },
  structured_review: { label: "Structured reviews", shortLabel: "Review" },
  regulatory: { label: "Regulatory records", shortLabel: "Regulatory" },
  reddit: { label: "Reddit", shortLabel: "Reddit" },
};

function normalizedCustomerVoiceSourceType(sourceType, sourceUrl = "") {
  if (customerVoiceEvidenceSourceTypes.has(sourceType)) return sourceType;
  try {
    const hostname = new URL(sourceUrl).hostname.toLowerCase().replace(/^www\./, "");
    if (hostname === "reddit.com" || hostname.endsWith(".reddit.com")) return "reddit";
    if (hostname === "fda.gov" || hostname.endsWith(".fda.gov")) return "regulatory";
    if (hostname === "selectscience.net" || hostname.endsWith(".selectscience.net")) return "structured_review";
    if (["chromforum.org", "labwrench.com"].some((host) => hostname === host || hostname.endsWith(`.${host}`))) {
      return "community_forum";
    }
  } catch {
    return "";
  }
  return "";
}

function customerVoiceSourceTypeLabel(sourceType, short = false) {
  const definition = customerVoiceSourceTypeDefinitions[sourceType];
  return definition ? (short ? definition.shortLabel : definition.label) : "Public source";
}

function isCustomerAuthoredVoiceSource(source) {
  if (!isHttpUrl(source?.url)) return false;
  let hostname = "";
  try {
    hostname = new URL(source.url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return false;
  }
  const isIndependentCommunity = [...customerVoiceCommunityHosts]
    .some((host) => hostname === host || hostname.endsWith(`.${host}`));
  if (!isIndependentCommunity) return false;
  if (source.sourceType && !customerVoiceEvidenceSourceTypes.has(source.sourceType)) return false;
  const sourceDescription = `${source.recordType || ""} ${source.sourceType || ""} ${source.label || ""}`;
  return !/(employee|vendor-authored|press release|support knowledge base)/i.test(sourceDescription);
}

function customerVoiceSourceLinks(item, horizonValue = filters.horizon.value) {
  const availableExactRecords = (item.evidenceRecords || [])
    .filter(isCustomerAuthoredVoiceSource)
    .map((record) => ({
      label: record.label || "Exact public record",
      url: record.url,
      sourceKeywords: Array.isArray(record.sourceKeywords) ? record.sourceKeywords : [],
      status: "exact_record",
      recordType: record.recordType || "Public evidence record",
      sourceType: normalizedCustomerVoiceSourceType(record.sourceType, record.url),
      sourceCredibility: Number(record.sourceCredibility || 0),
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
    .filter(isCustomerAuthoredVoiceSource)
    .map((source) => ({
      label: source.sourceName,
      url: source.url,
      status: source.status,
      recordType: "Source-discovery page",
      sourceType: normalizedCustomerVoiceSourceType(source.sourceType, source.url),
      sourceCredibility: Number(source.sourceCredibility || 0),
    }));
  const fallbackSource = {
    label: item.sourceName || "Source",
    url: item.sourceUrl,
    status: "source_mapped",
    recordType: "Source-discovery page",
    sourceType: normalizedCustomerVoiceSourceType(item.sourceType, item.sourceUrl),
    sourceCredibility: Number(item.sourceCredibility || 0),
  };
  if (!links.length && isCustomerAuthoredVoiceSource(fallbackSource)) {
    links.push(fallbackSource);
  }
  const seen = new Set();
  return links.filter((link) => {
    const key = canonicalEvidenceUrl(link.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function customerVoiceEvidenceDate(item, horizonValue = filters.horizon.value) {
  return customerVoiceSourceLinks(item, horizonValue)[0]?.sourceDate || null;
}

function sourceKeywordsText(link) {
  return (link?.sourceKeywords || []).join(" · ") || "No keywords validated";
}

function canonicalEvidenceUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    [...url.searchParams.keys()].forEach((key) => {
      if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
    });
    url.searchParams.sort();
    return url.toString();
  } catch {
    return String(value || "").replace(/[#?].*$/, "").replace(/\/+$/, "");
  }
}

function groupCustomerVoiceEvidenceMappings(evidenceItems) {
  const grouped = new Map();
  evidenceItems.forEach(({ item, link }) => {
    const key = canonicalEvidenceUrl(link.url);
    if (!key) return;
    if (!grouped.has(key)) {
      grouped.set(key, {
        link: { ...link },
        mappings: [],
        keywords: new Set(),
        mappingKeys: new Set(),
      });
    }
    const group = grouped.get(key);
    const mappingKey = item.id || `${item.company}|${item.product}|${item.sentiment}`;
    if (!group.mappingKeys.has(mappingKey)) {
      group.mappingKeys.add(mappingKey);
      group.mappings.push(item);
    }
    (link.sourceKeywords || []).forEach((keyword) => group.keywords.add(keyword));
  });
  return [...grouped.values()].map((group) => ({
    link: { ...group.link, sourceKeywords: [...group.keywords] },
    mappings: group.mappings,
  }));
}

function customerVoiceEvidenceCardMarkup({ link, mappings }, includeConfidence = false) {
  const themes = [...new Set(mappings.map((item) => item.category).filter(Boolean))];
  const confidence = Math.max(...mappings.map((item) => Number(item.confidence || 0)));
  return `
    <a class="customer-source-card" href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">
      <span class="customer-source-card-topline">
        <span class="customer-source-card-identity">
          <span class="customer-source-type-badge source-type-${escapeHtml(link.sourceType || "public")}">${escapeHtml(customerVoiceSourceTypeLabel(link.sourceType, true))}</span>
          <strong>${escapeHtml(link.label || "Exact public source")}</strong>
        </span>
        <small>${escapeHtml(formatDate(link.sourceDate))}</small>
      </span>
      <span class="customer-source-signal">${escapeHtml(sourceKeywordsText(link))}</span>
      <span class="customer-source-card-footer">
        <span>${escapeHtml(themes.join(" · ") || link.recordType || "Public evidence")}${includeConfidence && confidence ? ` · confidence ${confidence}` : ""}</span>
        <b>View source →</b>
      </span>
    </a>
  `;
}

function customerVoiceSourceMixGroups(items) {
  const evidenceGroups = groupCustomerVoiceEvidenceMappings(
    items.flatMap((item) => customerVoiceSourceLinks(item).map((link) => ({ item, link }))),
  );
  const counts = new Map();
  evidenceGroups.forEach(({ link }) => {
    const sourceType = normalizedCustomerVoiceSourceType(link.sourceType, link.url);
    if (!sourceType) return;
    counts.set(sourceType, (counts.get(sourceType) || 0) + 1);
  });
  return Object.keys(customerVoiceSourceTypeDefinitions)
    .map((sourceType) => ({ sourceType, count: counts.get(sourceType) || 0 }))
    .filter(({ count }) => count > 0);
}

function renderCustomerVoiceSourceMix(items) {
  const groups = customerVoiceSourceMixGroups(items);
  byId("customerVoiceSourceMix").innerHTML = groups.length
    ? `
      <strong>Public source mix</strong>
      <span class="customer-source-mix-list">
        ${groups.map(({ sourceType, count }) => `
          <button type="button" data-customer-source-type="${escapeHtml(sourceType)}" aria-label="View ${count} ${escapeHtml(customerVoiceSourceTypeLabel(sourceType).toLowerCase())}">
            ${escapeHtml(customerVoiceSourceTypeLabel(sourceType))} <b>${count}</b>
          </button>
        `).join("")}
      </span>
    `
    : "";
}

function openCustomerVoiceSourceTypeEvidence(sourceType) {
  if (!customerVoiceEvidenceSourceTypes.has(sourceType)) return;
  const items = currentCustomerVoiceItems();
  const evidenceGroups = groupCustomerVoiceEvidenceMappings(
    items.flatMap((item) => customerVoiceSourceLinks(item)
      .filter((link) => normalizedCustomerVoiceSourceType(link.sourceType, link.url) === sourceType)
      .map((link) => ({ item, link }))),
  );
  byId("decisionEvidenceTitle").textContent = customerVoiceSourceTypeLabel(sourceType);
  byId("decisionEvidenceSummary").textContent = `${evidenceGroups.length} unique exact public source${evidenceGroups.length === 1 ? "" : "s"} in the active time window.`;
  byId("decisionEvidenceList").innerHTML = evidenceGroups.length
    ? evidenceGroups.map((group) => customerVoiceEvidenceCardMarkup(group)).join("")
    : `<div class="empty">No ${escapeHtml(customerVoiceSourceTypeLabel(sourceType).toLowerCase())} match the active filters.</div>`;
  byId("decisionEvidenceModal").hidden = false;
  document.body.classList.add("modal-open");
  byId("hideDecisionEvidence").focus();
}

function customerVoiceItemsForHorizon(horizonValue, { ignoreCompetitor = false } = {}) {
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
      if (filters.technology.value === "All") return true;
      const text = `${item.platform} ${item.product} ${item.category} ${item.theme}`;
      return technologyMatchesFilter("", filters.technology.value, text);
    })
    .filter((item) => ignoreCompetitor || filters.competitor.value === "All" || item.company === filters.competitor.value)
    .filter((item) => pmmTargetingMatches(item, { includeBuyerRole: true }))
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
    const key = canonicalEvidenceUrl(link.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3);
}

function uniqueCustomerVoiceLinks(items, limit = 4) {
  const seen = new Set();
  return items
    .flatMap(customerVoiceSourceLinks)
    .filter((link) => {
      const key = canonicalEvidenceUrl(link.url);
      if (seen.has(key)) return false;
      seen.add(key);
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

function sentimentClass(sentiment) {
  return {
    Positive: "positive",
    Mixed: "mixed",
    Negative: "negative",
  }[sentiment] || "mixed";
}

function renderSentimentTrendChart(items) {
  const sentiments = ["Positive", "Mixed", "Negative"];
  const totals = sentiments.map((sentiment) => {
    const sentimentItems = items.filter((item) => item.sentiment === sentiment);
    const sourceCount = new Set(sentimentItems.flatMap(customerVoiceSourceLinks).map((link) => canonicalEvidenceUrl(link.url))).size;
    return [sentiment, sentimentItems.length, sourceCount];
  });
  const sentimentContext = {
    Positive: { symbol: "+", label: "Favorable-coded evidence" },
    Mixed: { symbol: "±", label: "Mixed-coded evidence" },
    Negative: { symbol: "!", label: "Concern-coded evidence" },
  };
  byId("sentimentTrendChart").innerHTML = items.length
    ? `
      <div class="sentiment-card-grid">
        ${totals
          .map(([sentiment, total, sourceCount]) => {
            const context = sentimentContext[sentiment];
            return `
            <button type="button" class="sentiment-card sentiment-drilldown ${sentimentClass(sentiment)}" data-sentiment-view="${escapeHtml(sentiment)}" aria-label="View ${sourceCount} independent ${sentiment.toLowerCase()} sources mapped to ${total} theme summaries">
              <div class="sentiment-card-heading">
                <span class="sentiment-symbol" aria-hidden="true">${escapeHtml(context.symbol)}</span>
                <span>
                  <strong>${escapeHtml(sentiment)}</strong>
                  <small>${escapeHtml(context.label)}</small>
                </span>
              </div>
              <div class="sentiment-card-value">
                <strong>${sourceCount}</strong>
                <span>independent source${sourceCount === 1 ? "" : "s"}</span>
              </div>
              <div class="sentiment-card-footer">
                <span>${total} mapped theme summar${total === 1 ? "y" : "ies"}</span>
                <b>Review wording →</b>
              </div>
            </button>
          `;
          })
          .join("")}
      </div>
    `
    : `<div class="empty">No public customer feedback matches the selected filters.</div>`;
}

function openSentimentMentionEvidence(sentiment) {
  const matchedRows = currentCustomerVoiceItems().filter((item) => item.sentiment === sentiment);
  const evidenceMappings = matchedRows.flatMap((item) => {
    const links = customerVoiceSourceLinks(item);
    if (!links.length) return [];
    return links.map((link) => ({ item, link }));
  });
  const evidenceItems = groupCustomerVoiceEvidenceMappings(evidenceMappings);

  byId("decisionEvidenceTitle").textContent = `${sentiment} theme summaries`;
  byId("decisionEvidenceSummary").textContent = `${evidenceItems.length} unique exact public source${evidenceItems.length === 1 ? "" : "s"}.`;
  byId("decisionEvidenceList").innerHTML = evidenceItems.length
    ? evidenceItems.map((group) => customerVoiceEvidenceCardMarkup(group, true)).join("")
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
  const evidenceMappings = matchedRows.flatMap((item) =>
    customerVoiceSourceLinks(item).map((link) => ({ item, link })),
  );
  const evidenceItems = groupCustomerVoiceEvidenceMappings(evidenceMappings);
  const titles = {
    all: "All customer-voice theme summaries",
    positive: "Positive-feedback theme summaries",
    concerns: "All concern-theme summaries",
    buying: `${buyingPriority} buying-consideration summaries`,
  };

  byId("decisionEvidenceTitle").textContent = titles[kind] || "Customer-voice theme summaries";
  const distinctThemeCount = new Set(matchedRows.map((item) => item.category).filter(Boolean)).size;
  byId("decisionEvidenceSummary").textContent = kind === "concerns"
    ? `${matchedRows.length} concern summaries span ${distinctThemeCount} distinct evidence theme${distinctThemeCount === 1 ? "" : "s"} and link to ${evidenceItems.length} unique exact public source${evidenceItems.length === 1 ? "" : "s"}. This is the complete concern set, not evidence for one leading theme. Each source card states its mapped theme.`
    : `${evidenceItems.length} unique exact public source${evidenceItems.length === 1 ? "" : "s"}.`;
  byId("decisionEvidenceList").innerHTML = evidenceItems.length
    ? evidenceItems.map((group) => customerVoiceEvidenceCardMarkup(group)).join("")
    : `<div class="empty">No exact public records match this summary under the active filters.</div>`;
  byId("decisionEvidenceModal").hidden = false;
  document.body.classList.add("modal-open");
  byId("hideDecisionEvidence").focus();
}

const customerVoiceIdentityTerms = {
  Waters: ["waters", "acquity", "empower", "breeze", "alliance", "arc", "masslynx", "unifi"],
  Agilent: ["agilent", "infinitylab", "openlab", "1260", "1290", "6550"],
  "Thermo Fisher": ["thermo", "vanquish", "ultimate", "chromeleon"],
  Shimadzu: ["shimadzu", "nexera", "prominence", "lab solutions", "labsolutions", "i-series"],
  SCIEX: ["sciex", "exionlc", "6500"],
};

function companyVoiceEvidenceGroups(company, companyItems) {
  const identityTerms = customerVoiceIdentityTerms[company] || [company.toLowerCase()];
  const evidenceMappings = companyItems
    .flatMap((item) => customerVoiceSourceLinks(item).map((link) => ({ item, link })))
    .filter(({ link }) => {
      const verifiedWording = (link.sourceKeywords || []).join(" ").toLowerCase();
      return identityTerms.some((term) => verifiedWording.includes(term));
    });
  return groupCustomerVoiceEvidenceMappings(evidenceMappings);
}

const customerVoicePurchaseThemes = [
  {
    key: "method-transfer",
    label: "Method Transfer",
    pmQuestion: "Can validated methods move without rework, retraining, or migration risk?",
    terms: ["method transfer", "method-transfer", "method continuity", "validated method", "migration", "modernization"],
    pain: "Validated methods may require avoidable rework, retraining, or revalidation when moved across platforms.",
    validationStep: "Transfer one legacy LC method and one oligonucleotide method across the selected systems; measure method changes, analyst time, failed acceptance criteria, and retraining effort.",
    roadmapDecision: {
      number: 2,
      title: "Oligonucleotide Method-Readiness Package",
      due: "August 21, 2026",
    },
  },
  {
    key: "troubleshooting-recovery",
    label: "Troubleshooting & Recovery Time",
    pmQuestion: "How quickly can users isolate the cause, recover, and avoid service escalation?",
    terms: ["troubleshoot", "diagnostic", "root cause", "recovery", "pressure", "carryover", "autosampler", "serviceability", "maintenance"],
    pain: "Users may see a downstream error without enough guidance to isolate the true fluidic, carryover, pressure, or autosampler cause.",
    validationStep: "Run seeded failure scenarios and compare time-to-root-cause, recovery steps, false leads, and service escalation across Waters and competitor workflows.",
    roadmapDecision: {
      number: 1,
      title: "End-to-End Workflow Requirements",
      due: "August 14, 2026",
    },
  },
  {
    key: "data-export-portability",
    label: "Data Export & Portability",
    pmQuestion: "Can users access, export, convert, and analyze data outside the vendor stack?",
    terms: ["data portability", "data conversion", "export", "open format", "open-format", "mzml", "lock-in", "data access", "third-party analysis"],
    pain: "Slow or constrained export can make data review, migration, and third-party analysis feel locked to the vendor stack.",
    validationStep: "Time representative native and open-format exports, verify metadata fidelity, and complete one third-party analysis and one migration workflow without expert intervention.",
    roadmapDecision: {
      number: 1,
      title: "End-to-End Workflow Requirements",
      due: "August 14, 2026",
    },
  },
  {
    key: "workflow-setup",
    label: "Workflow Setup",
    pmQuestion: "How much training, configuration, and expert help is needed to start routine work?",
    terms: ["workflow setup", "setup", "training", "onboarding", "template", "software usability", "ecosystem integration", "instrument control", "cross-vendor integration", "contact closure", "ease of use"],
    pain: "Routine regulated work may still depend on expert configuration, manual templates, and repeated onboarding.",
    validationStep: "Have new users configure and execute a PFAS quantitation workflow; measure setup time, interventions, template reuse, errors, and time to an accepted result.",
    roadmapDecision: {
      number: 3,
      title: "PFAS-Ready Regulated Quantitation Workflow",
      due: "August 7, 2026",
    },
  },
];

const customerVoiceComparisonCompanies = ["Waters", "Agilent", "Thermo Fisher", "SCIEX"];

function customerVoiceThemeDefinition(themeKey) {
  return customerVoicePurchaseThemes.find((theme) => theme.key === themeKey);
}

function customerVoiceItemMatchesTheme(item, theme) {
  const wording = [
    item.category,
    item.theme,
    item.customerLanguageSignal,
    item.pmInterpretation,
    item.buyingPriority,
  ].join(" ").toLowerCase();
  return theme.terms.some((term) => wording.includes(term));
}

function customerVoiceThemeItems(items, theme, company) {
  return items
    .filter((item) => item.company === company && customerVoiceItemMatchesTheme(item, theme))
    .sort((a, b) => {
      const sentimentOrder = { Negative: 3, Mixed: 2, Positive: 1 };
      return (sentimentOrder[b.sentiment] || 0) - (sentimentOrder[a.sentiment] || 0) || b.confidence - a.confidence;
    });
}

function customerVoiceThemeStatus(items) {
  if (items.some((item) => item.sentiment === "Negative")) return { label: "Pain point", className: "pain" };
  if (items.some((item) => item.sentiment === "Mixed")) return { label: "Friction to validate", className: "mixed" };
  if (items.some((item) => item.sentiment === "Positive")) return { label: "Strength", className: "strength" };
  return { label: "No direct signal", className: "missing" };
}

function customerVoiceRecurrence(sourceCount) {
  if (sourceCount >= 3) return { label: "Pattern", className: "pattern" };
  if (sourceCount === 2) return { label: "Emerging signal", className: "emerging" };
  if (sourceCount === 1) return { label: "Anecdote", className: "anecdote" };
  return { label: "No evidence", className: "none" };
}

function customerVoiceEvidenceStrengthBadge(sourceCount) {
  const count = Math.max(0, Number(sourceCount) || 0);
  const strength = count >= 3
    ? { label: "Pattern", className: "pattern" }
    : count === 2
      ? { label: "Directional", className: "directional" }
      : count === 1
        ? { label: "Anecdotal", className: "anecdotal" }
        : { label: "No evidence", className: "none" };
  return `
    <span class="customer-voice-strength-badge ${strength.className}">
      <strong>${strength.label}</strong>
      <small>${count} independent source${count === 1 ? "" : "s"}</small>
    </span>
  `;
}

function customerVoiceCategorySourceCounts(items, key) {
  const sourceUrlsByCategory = new Map();
  items.forEach((item) => {
    const category = item[key];
    if (!category) return;
    if (!sourceUrlsByCategory.has(category)) sourceUrlsByCategory.set(category, new Set());
    customerVoiceSourceLinks(item).forEach((link) => {
      const sourceUrl = canonicalEvidenceUrl(link.url);
      if (sourceUrl) sourceUrlsByCategory.get(category).add(sourceUrl);
    });
  });
  return [...sourceUrlsByCategory.entries()]
    .map(([category, sourceUrls]) => ({ category, sourceCount: sourceUrls.size }))
    .filter(({ sourceCount }) => sourceCount > 0)
    .sort((a, b) => b.sourceCount - a.sourceCount || a.category.localeCompare(b.category));
}

function openCustomerThemeEvidence(themeKey, company) {
  const theme = customerVoiceThemeDefinition(themeKey);
  if (!theme) return;
  const comparisonItems = customerVoiceItemsForHorizon(filters.horizon.value, { ignoreCompetitor: true });
  const companySelected = customerVoiceComparisonCompanies.includes(company);
  const matchedItems = companySelected
    ? customerVoiceThemeItems(comparisonItems, theme, company)
    : comparisonItems.filter((item) => customerVoiceItemMatchesTheme(item, theme));
  const evidenceGroups = companySelected
    ? companyVoiceEvidenceGroups(company, matchedItems)
    : groupCustomerVoiceEvidenceMappings(
        matchedItems.flatMap((item) => customerVoiceSourceLinks(item).map((link) => ({ item, link }))),
      );
  byId("decisionEvidenceTitle").textContent = companySelected ? `${theme.label}: ${company}` : theme.label;
  byId("decisionEvidenceSummary").textContent = companySelected
    ? `${evidenceGroups.length} unique exact customer source${evidenceGroups.length === 1 ? "" : "s"} behind this comparison cell.`
    : `${evidenceGroups.length} independent exact customer source${evidenceGroups.length === 1 ? "" : "s"} behind this purchase-driving theme.`;
  byId("decisionEvidenceList").innerHTML = evidenceGroups.length
    ? evidenceGroups.map((group) => customerVoiceEvidenceCardMarkup(group)).join("")
    : `<div class="empty">No vendor-specific exact sources match this theme under the active filters.</div>`;
  byId("decisionEvidenceModal").hidden = false;
  document.body.classList.add("modal-open");
  byId("hideDecisionEvidence").focus();
}

function renderCustomerCompetitorChart(items) {
  const rows = customerVoicePurchaseThemes.map((theme) => ({
    theme,
    sourceCount: new Set(
      items
        .filter((item) => customerVoiceItemMatchesTheme(item, theme))
        .flatMap((item) => customerVoiceSourceLinks(item))
        .filter((link) => link.status === "exact_record")
        .map((link) => canonicalEvidenceUrl(link.url))
        .filter(Boolean),
    ).size,
    companies: customerVoiceComparisonCompanies.map((company) => {
      const matchedItems = customerVoiceThemeItems(items, theme, company);
      const evidenceGroups = companyVoiceEvidenceGroups(company, matchedItems);
      const supportedItems = evidenceGroups.length ? matchedItems : [];
      const status = customerVoiceThemeStatus(supportedItems);
      const recurrence = customerVoiceRecurrence(evidenceGroups.length);
      const leadItem = supportedItems[0];
      return { company, evidenceGroups, status, recurrence, leadItem };
    }),
  }));

  byId("customerCompetitorChart").innerHTML = `
    <div class="customer-theme-matrix-wrap" tabindex="0" aria-label="Customer voice comparison by purchase-driving theme">
      <table class="customer-theme-matrix">
        <colgroup>
          <col class="customer-theme-question-column" />
          ${customerVoiceComparisonCompanies.map(() => "<col />").join("")}
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Purchase-Driving Theme</th>
            ${customerVoiceComparisonCompanies.map((company) => `<th scope="col">${escapeHtml(company)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <th scope="row" class="customer-theme-question">
                <strong>${escapeHtml(row.theme.label)}</strong>
                <span>${escapeHtml(row.theme.pmQuestion)}</span>
              </th>
              ${row.companies.map((cell) => `
                <td class="customer-theme-cell ${escapeHtml(cell.status.className)}">
                  <div class="customer-theme-cell-signals">
                    <span class="customer-theme-status ${escapeHtml(cell.status.className)}">${escapeHtml(cell.status.label)}</span>
                    ${cell.evidenceGroups.length ? `
                      <span class="customer-theme-recurrence ${escapeHtml(cell.recurrence.className)}">
                        <strong>${cell.evidenceGroups.length} independent source${cell.evidenceGroups.length === 1 ? "" : "s"}</strong>
                        <small>${escapeHtml(cell.recurrence.label)}</small>
                      </span>
                    ` : ""}
                  </div>
                  <p>${cell.leadItem
                    ? escapeHtml(compactText(cell.leadItem.customerLanguageSignal || cell.leadItem.theme, 138))
                    : "No vendor-specific customer wording is validated in the current sources."}</p>
                  ${cell.evidenceGroups.length ? `
                    <button type="button"
                      data-customer-theme-sources="${escapeHtml(row.theme.key)}"
                      data-customer-theme-company="${escapeHtml(cell.company)}"
                      aria-label="View ${cell.evidenceGroups.length} exact ${escapeHtml(cell.company)} sources for ${escapeHtml(row.theme.label)}">
                      ${cell.evidenceGroups.length} source${cell.evidenceGroups.length === 1 ? "" : "s"} →
                    </button>
                  ` : ""}
                </td>
              `).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    <section class="customer-roadmap-inputs" aria-label="Customer voice inputs to roadmap decisions">
      <div class="customer-roadmap-inputs-heading">
        <strong>Roadmap Decision Inputs</strong>
        <span>Pain → validation step → decision</span>
      </div>
      <div class="customer-roadmap-input-list">
        ${rows.map((row) => {
          const recurrence = customerVoiceRecurrence(row.sourceCount);
          return `
            <article class="customer-roadmap-input">
              <div class="customer-roadmap-input-theme">
                <strong>${escapeHtml(row.theme.label)}</strong>
                <a class="customer-theme-recurrence customer-theme-source-link ${escapeHtml(recurrence.className)}"
                  href="#customer-voice"
                  data-customer-theme-sources="${escapeHtml(row.theme.key)}"
                  aria-label="View ${row.sourceCount} independent sources for ${escapeHtml(row.theme.label)}">
                  <strong>${row.sourceCount} independent source${row.sourceCount === 1 ? "" : "s"}</strong>
                  <small>${escapeHtml(recurrence.label)}</small>
                </a>
              </div>
              <div class="customer-roadmap-input-copy">
                <small>Pain</small>
                <p>${escapeHtml(row.theme.pain)}</p>
              </div>
              <div class="customer-roadmap-input-copy">
                <small>Validation Step</small>
                <p>${escapeHtml(row.theme.validationStep)}</p>
              </div>
              <a class="customer-roadmap-decision-link" href="#decisions-needed">
                <small>Feeds Decision ${row.theme.roadmapDecision.number}</small>
                <strong>${escapeHtml(row.theme.roadmapDecision.title)}</strong>
                <span>Due ${escapeHtml(row.theme.roadmapDecision.due)} →</span>
              </a>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderCustomerVoiceSummary(items) {
  const positives = items.filter((item) => item.sentiment === "Positive");
  const negatives = items.filter((item) => item.sentiment === "Negative");
  const mixed = items.filter((item) => item.sentiment === "Mixed");
  const concernItems = items.filter((item) => item.sentiment !== "Positive");
  const positiveCounts = customerVoiceCategorySourceCounts(positives, "category");
  const concernCounts = customerVoiceCategorySourceCounts(concernItems, "category");
  const topPositive = positiveCounts[0];
  const topConcern = concernCounts[0];
  const leadingConcerns = concernCounts.filter(({ sourceCount }) => sourceCount === topConcern?.sourceCount);
  const concernHeadline = !topConcern
    ? "No concern evidence is captured in this view"
    : leadingConcerns.length > 1
      ? `${topConcern.category} and ${leadingConcerns.length - 1} other theme${leadingConcerns.length === 2 ? "" : "s"} tie as leading concerns`
      : `${topConcern.category} is the leading concern in current sources`;
  const concernDetail = !topConcern
    ? "No mixed or negative exact sources match the active filters."
    : topConcern.sourceCount === 1
      ? `${concernCounts.length} concern theme${concernCounts.length === 1 ? "" : "s"} currently have one independent source each.`
      : leadingConcerns.length > 1
        ? `${leadingConcerns.length} concern themes recur equally often in the current exact sources.`
        : "This concern recurs more often than the other concern themes in the current exact sources.";
  const buyingCounts = customerVoiceCategorySourceCounts(items, "buyingPriority");
  const thirdPlaceCount = buyingCounts[Math.min(2, buyingCounts.length - 1)]?.sourceCount || 0;
  const leadingBuying = buyingCounts.filter(({ sourceCount }) => sourceCount >= thirdPlaceCount);
  const cards = [
    {
      label: "Observed strength",
      headline: topPositive ? `${topPositive.category} is the leading observed strength` : "No positive finding is established",
      sourceCount: topPositive?.sourceCount || 0,
      detail: topPositive ? "This is the most repeated positive theme in the current exact sources." : "No positive forum evidence was captured; this is not evidence of poor product performance.",
      tone: "positive",
      link: positives.length ? `<button type="button" class="customer-voice-evidence-link" data-customer-voice-records="positive">Review positive evidence <span aria-hidden="true">→</span></button>` : "",
    },
    {
      label: "Observed concern",
      headline: concernHeadline,
      sourceCount: topConcern?.sourceCount || 0,
      detail: concernDetail,
      tone: "concern",
      link: negatives.length + mixed.length ? `<button type="button" class="customer-voice-evidence-link" data-customer-voice-records="concerns">Review concern evidence <span aria-hidden="true">→</span></button>` : "",
    },
  ];
  const topBuying = buyingCounts[0];
  const buyingCard = buyingCounts.length
    ? `
      <article class="customer-voice-card buying-considerations-card">
        <div class="summary-insight-head"><span>Buying consideration</span>${customerVoiceEvidenceStrengthBadge(topBuying.sourceCount)}</div>
        <strong class="summary-insight-title">${escapeHtml(`${topBuying.category} is the leading buying consideration`)}</strong>
        <p>${leadingBuying.length > 1
          ? escapeHtml(`${leadingBuying.length} buying considerations share the highest recurrence in the current exact sources.`)
          : "This buying consideration appears most often in the current exact sources."}</p>
        <small class="summary-insight-caveat">Public-source recurrence does not establish prevalence or market-wide sentiment.</small>
        <div class="buying-consideration-list" aria-label="Leading buying considerations">
          ${leadingBuying.map(({ category, sourceCount }) => `
            <button type="button" data-customer-voice-records="buying" data-buying-priority="${escapeHtml(category)}">
              <span>${escapeHtml(category)}</span>
              <strong>${sourceCount} source${sourceCount === 1 ? "" : "s"}</strong>
            </button>
          `).join("")}
        </div>
        ${leadingBuying.length > 3 ? `<small>${leadingBuying.length - 1} considerations tie for second, so all ties are shown.</small>` : ""}
      </article>
    `
    : `
      <article class="customer-voice-card buying-considerations-card">
        <div class="summary-insight-head"><span>Buying consideration</span>${customerVoiceEvidenceStrengthBadge(0)}</div>
        <strong class="summary-insight-title">No buying consideration is supported</strong>
        <p>Broaden the filters to identify repeated buying considerations.</p>
        <small class="summary-insight-caveat">Public-source recurrence does not establish prevalence or market-wide sentiment.</small>
      </article>
    `;
  byId("customerVoiceSummary").innerHTML = cards
    .map(
      ({ label, headline, sourceCount, detail, tone, link }) => `
        <article class="customer-voice-card summary-insight-card summary-insight-${escapeHtml(tone)}">
          <div class="summary-insight-head"><span>${escapeHtml(label)}</span>${customerVoiceEvidenceStrengthBadge(sourceCount)}</div>
          <strong class="summary-insight-title">${escapeHtml(headline)}</strong>
          <p>${escapeHtml(detail)}</p>
          <small class="summary-insight-caveat">Public-source recurrence does not establish prevalence or market-wide sentiment.</small>
          ${link}
        </article>
      `,
    )
    .join("") + buyingCard;
}

function customerPainText(items) {
  return items
    .flatMap((item) => [
      item.category,
      item.theme,
      item.customerLanguageSignal,
      item.pmInterpretation,
      item.buyingPriority,
      item.product,
      item.platform,
    ])
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function customerPainSeverity(items) {
  const text = customerPainText(items);
  if (/(method transfer|data integrity|data portability|lock-in|reliability|leak|pressure|fluidic|downtime|service continuity|parts availability|serviceability|failure|carryover|autosampler)/i.test(text)) {
    return { score: 3, label: "High", reason: "Can interrupt method continuity, system availability, or access to data." };
  }
  if (/(cost|training|usability|workflow|setup|integration|processing speed|service contract|response time|maintenance|consumable)/i.test(text)) {
    return { score: 2, label: "Medium", reason: "Adds material time, cost, or operator burden." };
  }
  return { score: 1, label: "Low", reason: "Currently reflects a preference or an adjacent workflow concern." };
}

function customerPainStrategicFit(items) {
  const text = customerPainText(items);
  if (/(method transfer|modernization|troubleshoot|fluidic|leak|pressure|carryover|autosampler|workflow setup|software usability|data review|data portability|lock-in|cross-vendor integration|training|ease of use)/i.test(text)) {
    return { score: 3, label: "High", reason: "Directly shapes the Next Gen LC operator and method lifecycle." };
  }
  if (/(cost|consumable|service|support|maintenance|legacy|integration|processing speed|software access|proteomics|lc flow)/i.test(text)) {
    return { score: 2, label: "Medium", reason: "Relevant to the surrounding platform, service, or ownership experience." };
  }
  return { score: 1, label: "Low", reason: "Useful context, but not a direct Next Gen LC requirement signal." };
}

function customerPainPriority(categoryItems) {
  const sourceUrls = new Set(
    categoryItems
      .flatMap((item) => customerVoiceSourceLinks(item))
      .filter((link) => link.status === "exact_record")
      .map((link) => canonicalEvidenceUrl(link.url))
      .filter(Boolean),
  );
  const recurrence = sourceUrls.size;
  const severity = customerPainSeverity(categoryItems);
  const strategicFit = customerPainStrategicFit(categoryItems);
  return {
    recurrence,
    recurrenceLabel: customerVoiceRecurrence(recurrence),
    severity,
    strategicFit,
    score: recurrence * severity.score * strategicFit.score,
  };
}

function painPriorityRowMarkup(row, index, { top = false } = {}) {
  const sourceLabel = `${row.priority.recurrence} source${row.priority.recurrence === 1 ? "" : "s"}`;
  return `
    <article class="pain-priority-row${top ? " pain-priority-row-top" : ""}">
      <div class="pain-priority-rank" aria-label="Priority rank ${index + 1}">#${index + 1}</div>
      <div class="pain-priority-content">
        <div class="pain-priority-title-line">
          <strong>${escapeHtml(row.category)}</strong>
          ${top ? `<span class="pain-quarter-label">Act this quarter</span>` : ""}
        </div>
        <p>${escapeHtml(row.categoryItems[0]?.pmInterpretation || "Review the linked evidence before changing product priority.")}</p>
        <div class="pain-priority-factors" aria-label="Priority score calculation">
          <span><b>${row.priority.recurrence}</b> recurrence</span>
          <span><b>${escapeHtml(row.priority.severity.label)}</b> severity (${row.priority.severity.score})</span>
          <span><b>${escapeHtml(row.priority.strategicFit.label)}</b> Next Gen LC fit (${row.priority.strategicFit.score})</span>
          <strong class="pain-priority-score">Priority ${row.priority.score}</strong>
        </div>
      </div>
      <div class="pain-priority-evidence">
        <span class="recurrence-badge recurrence-${escapeHtml(row.priority.recurrenceLabel.className)}">${escapeHtml(row.priority.recurrenceLabel.label)}</span>
        ${voiceLinksMarkup(row.categoryItems, sourceLabel)}
      </div>
    </article>
  `;
}

function renderPainPointTracker(items) {
  const categoryMap = new Map();
  for (const item of items.filter((item) => item.sentiment !== "Positive")) {
    const group = categoryMap.get(item.category) || [];
    group.push(item);
    categoryMap.set(item.category, group);
  }
  const rows = [...categoryMap.entries()]
    .map(([category, categoryItems]) => ({ category, categoryItems, priority: customerPainPriority(categoryItems) }))
    .filter((row) => row.priority.recurrence > 0)
    .sort((a, b) =>
      b.priority.score - a.priority.score
      || b.priority.recurrence - a.priority.recurrence
      || b.priority.severity.score - a.priority.severity.score
      || a.category.localeCompare(b.category),
    );
  const visibleRows = rows.slice(0, 5);
  const backlogRows = rows.slice(5);
  byId("painPointTracker").innerHTML = rows.length
    ? `
        <div class="pain-priority-explainer">
          <strong>Priority = recurrence × severity × Next Gen LC fit</strong>
          <span>Recurrence counts unique source pages; severity and fit use a 1–3 rubric.</span>
        </div>
        <div class="pain-priority-list">
          ${visibleRows.map((row, index) => painPriorityRowMarkup(row, index, { top: index === 0 })).join("")}
        </div>
        ${backlogRows.length ? `
          <details class="pain-priority-backlog">
            <summary>View ${backlogRows.length} lower-priority concern${backlogRows.length === 1 ? "" : "s"}</summary>
            <div class="pain-priority-list pain-priority-list-backlog">
              ${backlogRows.map((row, index) => painPriorityRowMarkup(row, index + visibleRows.length)).join("")}
            </div>
          </details>
        ` : ""}
      `
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
  const rankedNeeds = needs
    .map(([need, action, triggers], originalIndex) => ({
      need,
      action,
      originalIndex,
      evidence: items.filter((item) => triggers.some((trigger) => `${item.category} ${item.buyingPriority} ${item.theme}`.toLowerCase().includes(trigger.toLowerCase()))),
    }))
    .sort((a, b) => b.evidence.length - a.evidence.length || a.originalIndex - b.originalIndex);
  byId("unmetNeedsList").innerHTML = rankedNeeds
    .map(({ need, action, evidence }) => {
      return `
        <article class="need-row">
          <div>
            <strong>${escapeHtml(need)}</strong>
            <p>${escapeHtml(action)}</p>
          </div>
          <div class="need-evidence-control">
            ${evidence.length
              ? voiceLinksMarkup(evidence, `${evidence.length} supporting record${evidence.length === 1 ? "" : "s"}`)
              : `<span>0 supporting records</span>`}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderMarketPositioning(items) {
  const companies = ["Waters", "Agilent", "Thermo Fisher", "Shimadzu", "SCIEX"];
  const rows = companies
    .map((company) => {
      const companyItems = items.filter((item) => item.company === company);
      if (!companyItems.length) return "";
      const positive = companyItems.find((item) => item.sentiment === "Positive");
      const watch = companyItems.find((item) => item.sentiment !== "Positive");
      const sourceCount = uniqueCustomerVoiceLinks(companyItems, 1000).length;
      return `
        <article class="positioning-row">
          <strong>${escapeHtml(company)}</strong>
          <p><b>Perceived strength:</b> ${positive ? escapeHtml(positive.theme) : `<span class="pmm-unresolved">No supported perceived strength found</span>`}</p>
          <p><b>Watch item:</b> ${watch ? escapeHtml(watch.category) : `<span class="pmm-unresolved">No supported watch item found</span>`}</p>
          <span>${sourceCount} independent source${sourceCount === 1 ? "" : "s"} · ${companyItems.length} coded record${companyItems.length === 1 ? "" : "s"} · ${confidenceLabel(averageConfidence(companyItems))} evidence confidence</span>
          ${sourceCount < 3 ? `<p class="pmm-low-sample">Low sample — fewer than 3 independent sources; perception is provisional.</p>` : ""}
          ${voiceLinksMarkup(companyItems)}
        </article>
      `;
    })
    .filter(Boolean);
  const marketWideItems = items.filter((item) => item.company === "Market-wide");
  const marketWideSourceCount = uniqueCustomerVoiceLinks(marketWideItems, 1000).length;
  const marketWide = marketWideItems.length ? `
    <section class="market-wide-positioning" aria-label="Market-wide themes">
      <div class="mini-header"><h4>Market-Wide Themes</h4><p class="panel-helper">Separate analytical level; these themes are not vendor perception statements.</p></div>
      ${marketWideItems.slice(0, 4).map((item) => `<article><strong>${escapeHtml(item.theme || item.category)}</strong><p>${escapeHtml(item.customerLanguageSignal || item.pmInterpretation || "Interpretation unavailable")}</p></article>`).join("")}
      <span>${marketWideSourceCount} independent source${marketWideSourceCount === 1 ? "" : "s"} · ${marketWideItems.length} coded record${marketWideItems.length === 1 ? "" : "s"}</span>
      ${marketWideSourceCount < 3 ? `<p class="pmm-low-sample">Low sample — fewer than 3 independent sources; market-wide theme is provisional.</p>` : ""}
      ${voiceLinksMarkup(marketWideItems, "View market-wide evidence")}
    </section>` : "";
  const forumCaveat = items.some((item) => customerVoiceSourceLinks(item).some((link) => ["reddit", "community_forum"].includes(normalizedCustomerVoiceSourceType(link.sourceType))))
    ? `<p class="customer-voice-normalization-note" role="note">Forum evidence can surface objections and customer language, but it is complaint-biased and is not representative market research.</p>`
    : "";
  byId("marketPositioning").innerHTML = rows.length || marketWide
    ? `${forumCaveat}<div class="vendor-positioning-comparison" aria-label="Vendor perception comparison">${rows.join("")}</div>${marketWide}`
    : `<div class="empty">No positioning signals match these filters.</div>`;
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
          const sourceCount = uniqueCustomerVoiceLinks(segmentItems, 1000).length;
          const action = segmentActionCopy(labType, topRole, topPriority, maturity, topPain);
          return `
            <article class="segment-decision-card">
              <div class="segment-rank" aria-label="Evidence representation order ${index + 1}">${index + 1}</div>
              <div>
                <div class="segment-card-top">
                  <strong>${escapeHtml(labType)}</strong>
                  <span>${count} coded record${count === 1 ? "" : "s"} across ${sourceCount} traceable source page${sourceCount === 1 ? "" : "s"}</span>
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
  return "Recommended product action: treat this segment as a public customer-evidence research target before committing roadmap capacity.";
}

function renderCompetitiveCustomerSignals(items) {
  const competitorItems = items.filter((item) => !["Waters", "Market-wide"].includes(item.company));
  const rows = ["Agilent", "Thermo Fisher", "Shimadzu", "SCIEX", "PerkinElmer"]
    .map((company) => {
      const companyItems = competitorItems.filter((item) => item.company === company);
      if (!companyItems.length) return "";
      const strength = companyItems.find((item) => item.sentiment === "Positive");
      const concern = companyItems.find((item) => item.sentiment !== "Positive");
      const sourceCount = uniqueCustomerVoiceLinks(companyItems, 1000).length;
      return `
        <article class="competitive-signal-row">
          <div>
            <strong>${escapeHtml(company)}</strong>
            <p>${strength ? escapeHtml(strength.theme) : `<span class="pmm-unresolved">No supported perceived strength found</span>`}</p>
            ${concern ? `<p class="muted">Counter-signal: ${escapeHtml(concern.category)}</p>` : ""}
            ${sourceCount < 3 ? `<p class="pmm-low-sample">Low sample — fewer than 3 independent sources; conclusion is provisional.</p>` : ""}
            ${voiceLinksMarkup(companyItems)}
          </div>
          <span>${sourceCount} source${sourceCount === 1 ? "" : "s"}</span>
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
              <td>${primary ? escapeHtml(sourceKeywordsText(primary)) : "No keyword-validated source"}</td>
              <td>${primary ? `<span class="customer-source-type-badge source-type-${escapeHtml(primary.sourceType || "public")}">${escapeHtml(customerVoiceSourceTypeLabel(primary.sourceType, true))}</span>` : "Public source"}</td>
              <td>${primary ? `<a href="${escapeHtml(primary.url)}" target="_blank" rel="noreferrer">View source</a><span class="source-name">${escapeHtml(primary.label)}</span>` : escapeHtml(item.sourceName)}</td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="10"><div class="empty">No customer voice evidence matches the current filters.</div></td></tr>`;
}

function renderCustomerVoiceSignals() {
  const items = currentCustomerVoiceItems();
  const uniqueSources = groupCustomerVoiceEvidenceMappings(
    items.flatMap((item) => customerVoiceSourceLinks(item).map((link) => ({ item, link }))),
  );
  byId("customerVoiceCount").textContent = `${uniqueSources.length} exact public sources`;
  renderCustomerVoiceSourceMix(items);
  renderCustomerVoiceSummary(items);
  renderSentimentTrendChart(items);
  renderCustomerCompetitorChart(customerVoiceItemsForHorizon(filters.horizon.value, { ignoreCompetitor: true }));
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
  const snapshot = competitiveMethodology.snapshotMetadata(state.data);
  const topDecision = recommendationsByConfidence(currentSignals())[0];
  const headers = ["Snapshot ID", "As-of timestamp", "Decision owner", "Required go/no-go output", "Newest evidence date", "Company", "Product", "Sentiment", "Category", "Lab type", "User role", "Buying priority", "Product maturity", "Geography", "Confidence", "Customer language signal", "Source", "PM interpretation"];
  const body = rows.map((item) => [
    snapshot.snapshotId,
    snapshot.asOfTimestamp,
    topDecision?.decisionOwners || "Product Management",
    topDecision?.decisionDeliverable || "No decision output linked",
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
  link.download = `waters-customer-voice-${snapshot.snapshotId}.csv`;
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
        <a href="#decisionEvidenceModal" data-launch-evidence="all">View all ${launches.length} sources</a>
        <a href="#decisionEvidenceModal" data-launch-evidence="new">View ${newLaunches} launch sources</a>
      </div>
    </article>
    <article class="metric metric-explained">
      <span class="metric-question">Where is activity concentrated?</span>
      <strong>${lcMsLaunches} of ${launches.length} affect LC-MS</strong>
      <p><b>${lcMsShare}%</b> of tracked product changes relate to LC-MS or LC-MS/MS. This overlaps with the launch and update counts in the first card.</p>
      <div class="metric-links">
        <a href="#decisionEvidenceModal" data-launch-evidence="lcms">View ${lcMsLaunches} LC-MS sources</a>
      </div>
    </article>
    <article class="metric metric-explained">
      <span class="metric-question">Who is active?</span>
      <strong>${competitorNames.length} competitors</strong>
      <p>${competitorNames.length ? `${escapeHtml(competitorNames.join(", "))} have at least one matching product change.` : "No competitor product changes match the active filters."}</p>
      <div class="metric-links">
        <a href="#decisionEvidenceModal" data-launch-evidence="competitors">View sources by competitor</a>
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
  byId("timelineLaunchCount").textContent = `${launches.length} ${launches.length === 1 ? "launch" : "launches"}`;
  const competitorOrder = ["Thermo Fisher", "Agilent", "Shimadzu", "SCIEX", "PerkinElmer"];
  const competitors = competitorOrder.filter((competitor) => launches.some((launch) => launch.competitor === competitor));
  byId("competitiveTimeline").innerHTML = `
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
                        const pressReleaseUrl = pressReleaseUrlForLaunch(launch);
                        const productPageUrl = productPageUrlForLaunch(launch);
                        return `
                          <article class="launch-board-card" style="--accent:${color}">
                            <div class="launch-board-card-main">
                              <div class="launch-board-card-content">
                                <span>${dateLabel}</span>
                                <strong>${label}</strong>
                                <em>${escapeHtml(launch.signalType)} · ${escapeHtml(launch.technology)}</em>
                              </div>
                              <div class="launch-board-source-links" aria-label="Official sources for ${label}">
                                ${productPageUrl ? `<a href="${escapeHtml(productPageUrl)}" target="_blank" rel="noreferrer" aria-label="Open the official product launch page for ${label} in a new tab">Product launch page ↗</a>` : ""}
                                ${pressReleaseUrl ? `<a href="${escapeHtml(pressReleaseUrl)}" target="_blank" rel="noreferrer" aria-label="Open the official press release for ${label} in a new tab">Press release ↗</a>` : ""}
                              </div>
                            </div>
                            <div class="launch-board-card-actions">
                              <button class="launch-board-compare" type="button" data-compare-launch="${escapeHtml(launch.id)}" aria-label="Compare ${label} with Waters">Compare with Waters</button>
                            </div>
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
  `;
}

function renderFeatureGapMatrix(signals) {
  byId("featureGapMatrix").innerHTML = `
    <div class="gap-takeaway">
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
    <div class="gap-grid-scroll" tabindex="0" aria-label="Scrollable competitor capability heatmap">
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
    </div>
    <div class="gap-legend">
      <span><i class="legend-box lead"></i>Green: public evidence suggests a strength</span>
      <span><i class="legend-box parity"></i>Yellow: no clear public difference</span>
      <span><i class="legend-box lag"></i>Red: a potential Waters gap needs verification</span>
    </div>
    ${roadmapImpactHeatmapMarkup(signals)}
  `;
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
        <strong>Evidence priority: ${escapeHtml(breakdown.evidencePriority)}; business impact: Unquantified</strong>
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

function compactText(value, maxLength = 150) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  const clipped = text.slice(0, maxLength - 1);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, lastSpace > 80 ? lastSpace : clipped.length)}...`;
}

function renderConferenceSources() {
  const events = currentConferenceSources();
  const count = byId("conferenceCount");
  if (count) count.textContent = `${events.length} upcoming`;
  const conferenceContainer = byId("conferenceSources");
  if (!conferenceContainer) return;
  const pageSize = state.conferencePageSize;
  const pageCount = Math.max(1, Math.ceil(events.length / pageSize));
  state.conferencePage = Math.min(Math.max(1, state.conferencePage), pageCount);
  const pageStart = (state.conferencePage - 1) * pageSize;
  const visibleEvents = events.slice(pageStart, pageStart + pageSize);
  const rangeStart = events.length ? pageStart + 1 : 0;
  const rangeEnd = pageStart + visibleEvents.length;
  count.textContent = events.length > pageSize
    ? `Showing ${rangeStart}–${rangeEnd} of ${events.length}`
    : `${events.length} upcoming`;
  conferenceContainer.innerHTML = events.length
    ? `
      <div class="conference-summary">
        <strong>${events.length} evidence-backed preparation briefs</strong>
        <span>Confirmed competitor sessions are separated from portfolio-based expectations.</span>
      </div>
      ${visibleEvents
        .map((event, eventIndex) => {
          const monitoringLinks = event.monitoringLinks
            .map((link) => `<a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)} ↗</a>`)
            .join("");
          const focusItems = (event.scientificFocus || [])
            .map((focus) => `<li>${escapeHtml(focus)}</li>`)
            .join("");
          const competitorItems = (event.competitorContent || [])
            .map((item) => {
              const isConfirmed = item.evidenceStatus === "Confirmed in 2026 program";
              return `
                <article class="conference-competitor-item">
                  <div class="conference-evidence-head">
                    <strong>${escapeHtml(item.competitor)}</strong>
                    <span class="conference-evidence-status ${isConfirmed ? "confirmed" : "expected"}">${isConfirmed ? "Confirmed" : "Expected · not confirmed"}</span>
                  </div>
                  <p>${escapeHtml(item.content)}</p>
                  <p class="conference-evidence-basis"><strong>How this was derived:</strong> ${escapeHtml(item.evidenceBasis)}</p>
                  <a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.sourceLabel)} ↗</a>
                </article>
              `;
            })
            .join("");
          const scientificItems = (event.watersScientificContent || [])
            .map((item) => `
              <article class="conference-recommendation-item">
                <strong>${escapeHtml(item.title)}</strong>
                <p>${escapeHtml(item.deliverable)}</p>
                <small><strong>Bring proof:</strong> ${escapeHtml(item.proofNeeded)}</small>
              </article>
            `)
            .join("");
          const boothItems = (event.boothRecommendations || [])
            .map((item) => `
              <article class="conference-booth-item">
                <a href="${escapeHtml(item.productUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.product)} ↗</a>
                <p><strong>Booth role:</strong> ${escapeHtml(item.role)}</p>
                <p><strong>Lead message:</strong> ${escapeHtml(item.message)}</p>
              </article>
            `)
            .join("");
          const firstMove = event.watersPrep?.[0] || event.watersScientificContent?.[0]?.deliverable || "Open the brief for preparation recommendations.";
          return `
            <details class="conference-card preparation" ${eventIndex === 0 ? "open" : ""}>
              <summary class="conference-prep-summary">
                <div class="conference-summary-main">
                  <div class="conference-top">
                    <strong>${escapeHtml(event.eventName)}</strong>
                  </div>
                  <p class="muted">${escapeHtml(event.dateRange)} · ${event.marketSegments.map(escapeHtml).join(", ")}</p>
                  <p class="conference-theme"><span>2026 theme</span><strong>${escapeHtml(event.annualTheme)}</strong></p>
                  <div class="conference-action">
                    <span>Recommended Waters move</span>
                    <strong>${escapeHtml(compactText(firstMove, 190))}</strong>
                  </div>
                </div>
                <span class="conference-expand-label">
                  <span class="conference-label-view">View prep brief</span>
                  <span class="conference-label-hide">Hide prep brief</span>
                </span>
              </summary>
              <div class="conference-prep-body">
                <section class="conference-prep-section conference-focus-section">
                  <h4>Theme and Scientific Focus</h4>
                  <ul>${focusItems}</ul>
                  <p class="conference-why"><strong>Why it matters:</strong> ${escapeHtml(event.industryTrendsToWatch?.[0] || "")}</p>
                </section>
                <section class="conference-prep-section conference-competitor-section">
                  <div class="conference-section-heading">
                    <h4>What Competitors May Talk About</h4>
                    <span>Evidence status shown per item</span>
                  </div>
                  <div class="conference-competitor-list">${competitorItems}</div>
                </section>
                <section class="conference-prep-section">
                  <h4>Scientific Content Waters Should Prepare</h4>
                  <div class="conference-recommendation-list">${scientificItems}</div>
                </section>
                <section class="conference-prep-section">
                  <h4>Products and Solutions to Bring to the Booth</h4>
                  <div class="conference-booth-list">${boothItems}</div>
                </section>
                <div class="conference-source-row">
                  <span>Official event sources</span>
                  <div class="conference-links">${monitoringLinks}</div>
                </div>
              </div>
            </details>
          `;
        })
        .join("")}
    `
    : `<div class="empty">No upcoming conference prep items match the current filters.</div>`;

  const pagination = byId("conferencePagination");
  pagination.hidden = events.length <= pageSize;
  pagination.innerHTML = events.length > pageSize
    ? `
        <span class="evidence-pagination-status">Page ${state.conferencePage} of ${pageCount}</span>
        <div class="evidence-pagination-controls">
          <button type="button" class="evidence-page-button evidence-page-step" data-conference-page="${state.conferencePage - 1}" ${state.conferencePage === 1 ? "disabled" : ""} aria-label="Previous conference page">Previous</button>
          ${Array.from({ length: pageCount }, (_, index) => index + 1)
            .map(
              (page) => `
                <button type="button" class="evidence-page-button ${page === state.conferencePage ? "is-current" : ""}" data-conference-page="${page}" ${page === state.conferencePage ? 'aria-current="page"' : ""} aria-label="Conference page ${page}">${page}</button>
              `,
            )
            .join("")}
          <button type="button" class="evidence-page-button evidence-page-step" data-conference-page="${state.conferencePage + 1}" ${state.conferencePage === pageCount ? "disabled" : ""} aria-label="Next conference page">Next</button>
        </div>
      `
    : "";
}

function setupConferencePagination() {
  const pagination = byId("conferencePagination");
  if (!pagination) return;
  pagination.addEventListener("click", (event) => {
    const button = event.target.closest("[data-conference-page]");
    if (!button || button.disabled) return;
    state.conferencePage = Number(button.dataset.conferencePage) || 1;
    renderConferenceSources();
    byId("conferenceCount").scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function renderJournalForumSources() {
  const allSources = state.journalSources?.sources || [];
  const sources = filters.segment.value === "All"
    ? allSources
    : allSources.filter((source) => !source.marketSegments?.length || source.marketSegments.includes(filters.segment.value));
  byId("journalForumCount").textContent = `${sources.length} sources`;
  byId("journalForumSources").innerHTML = sources.length
    ? `
      <div class="journal-summary">
        <strong>${sources.length} mapped sources</strong>
        <span>Use these for LC application trends, competitor narratives, customer language, and buying-criteria signals.</span>
      </div>
      <div class="journal-source-slider">
        <div id="journalSourceViewport" class="journal-source-slider-viewport" tabindex="0" aria-label="Journal, forum, and trade publication sources">
          <div class="journal-source-slider-track">
            ${sources
        .map((source) => {
          const primarySignals = (source.primarySignals || [])
            .slice(0, 4)
            .map((signal) => `<span>${escapeHtml(signal)}</span>`)
            .join("");
          const coverage = (source.coverage || [])
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
                <span class="tag steady" title="${escapeHtml(source.ingestionStatus)}">${escapeHtml(source.ingestionStatus === "Source mapped" ? "Mapped" : source.ingestionStatus)}</span>
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
          </div>
        </div>
        <nav class="journal-source-slider-controls" aria-label="Browse source cards">
          <span id="journalSourceSliderStatus" class="evidence-pagination-status" aria-live="polite"></span>
          <div class="evidence-pagination-controls">
            <button type="button" class="evidence-page-button evidence-page-step" data-journal-slide="previous" aria-label="Previous source cards">Previous</button>
            <button type="button" class="evidence-page-button evidence-page-step" data-journal-slide="next" aria-label="Next source cards">Next</button>
          </div>
        </nav>
      </div>
    `
    : `<div class="empty">No journal or forum source map is loaded.</div>`;

  const viewport = byId("journalSourceViewport");
  if (viewport) {
    viewport.addEventListener("scroll", updateJournalSourceSlider, { passive: true });
    journalSourceResizeObserver?.disconnect();
    journalSourceResizeObserver = new ResizeObserver(updateJournalSourceSlider);
    journalSourceResizeObserver.observe(viewport);
    requestAnimationFrame(updateJournalSourceSlider);
  }
}

function journalSourceSliderMetrics() {
  const viewport = byId("journalSourceViewport");
  const cards = viewport?.querySelectorAll(".journal-source-card") || [];
  const firstCard = cards[0];
  if (!viewport || !firstCard) return null;
  const trackStyles = getComputedStyle(viewport.querySelector(".journal-source-slider-track"));
  const gap = Number.parseFloat(trackStyles.columnGap) || 12;
  const columnWidth = firstCard.getBoundingClientRect().width + gap;
  const visibleColumns = Math.max(1, Math.round((viewport.clientWidth + gap) / columnWidth));
  const totalColumns = Math.ceil(cards.length / 2);
  const currentColumn = Math.min(totalColumns - 1, Math.max(0, Math.round(viewport.scrollLeft / columnWidth)));
  return { viewport, cards, columnWidth, visibleColumns, totalColumns, currentColumn };
}

function updateJournalSourceSlider() {
  const metrics = journalSourceSliderMetrics();
  if (!metrics) return;
  const { viewport, cards, visibleColumns, totalColumns, currentColumn } = metrics;
  const maxStartColumn = Math.max(0, totalColumns - visibleColumns);
  const startColumn = Math.min(currentColumn, maxStartColumn);
  const startSource = startColumn * 2 + 1;
  const endSource = Math.min(cards.length, (startColumn + visibleColumns) * 2);
  byId("journalSourceSliderStatus").textContent = `Showing ${startSource}–${endSource} of ${cards.length}`;
  document.querySelector('[data-journal-slide="previous"]').disabled = viewport.scrollLeft <= 2;
  document.querySelector('[data-journal-slide="next"]').disabled = viewport.scrollLeft >= viewport.scrollWidth - viewport.clientWidth - 2;
}

function setupJournalSourceSlider() {
  byId("journalForumSources").addEventListener("click", (event) => {
    const button = event.target.closest("[data-journal-slide]");
    if (!button || button.disabled) return;
    const metrics = journalSourceSliderMetrics();
    if (!metrics) return;
    const direction = button.dataset.journalSlide === "next" ? 1 : -1;
    const maxStartColumn = Math.max(0, metrics.totalColumns - metrics.visibleColumns);
    const targetColumn = Math.min(
      maxStartColumn,
      Math.max(0, metrics.currentColumn + direction * metrics.visibleColumns),
    );
    metrics.viewport.scrollTo({ left: targetColumn * metrics.columnWidth, behavior: "smooth" });
  });
}

function earningsPmReadoutMarkup(signal) {
  const metrics = Array.isArray(signal.earningsMetrics) ? signal.earningsMetrics : [];
  const insights = Array.isArray(signal.pmInsights) ? signal.pmInsights : [];
  const hasPmReadout = metrics.length || insights.length || signal.watersPmImplication || signal.evidenceBoundary;
  if (!hasPmReadout) {
    return `<p><strong>Reported result:</strong> ${escapeHtml(signal.summary)}</p>`;
  }
  return `
    <p class="filing-earnings-signal"><strong>Product-management signal:</strong> ${escapeHtml(signal.summary)}</p>
    ${metrics.length
      ? `<div class="filing-earnings-metrics" aria-label="Thermo Fisher Analytical Instruments performance">
          ${metrics.map((metric) => `
            <div>
              <span>${escapeHtml(metric.label)}</span>
              <strong>${escapeHtml(metric.value)}</strong>
              <small>${escapeHtml(metric.change)}</small>
            </div>
          `).join("")}
        </div>`
      : ""}
    ${insights.length
      ? `<div class="filing-earnings-insights">
          <strong>What Waters PM should know</strong>
          <ul>${insights.map((insight) => `<li>${escapeHtml(insight)}</li>`).join("")}</ul>
        </div>`
      : ""}
    ${signal.watersPmImplication
      ? `<p class="filing-earnings-implication"><strong>Waters relevance:</strong> ${escapeHtml(signal.watersPmImplication)}</p>`
      : ""}
    ${signal.evidenceBoundary
      ? `<p class="filing-earnings-boundary"><strong>Evidence boundary:</strong> ${escapeHtml(signal.evidenceBoundary)}</p>`
      : ""}
  `;
}

function renderFilingInsights() {
  const insights = currentFilingInsights();
  const earnings = currentEarningsSignals(competitorIntentSignals([]));
  const visibleCompanies = new Set([
    ...insights.map((insight) => insight.competitor),
    ...earnings.map((signal) => signal.competitor),
  ]);
  const corporateMoveCount = (state.filingInsights?.companyCorporateMoves || [])
    .filter((group) => visibleCompanies.has(group.competitor))
    .reduce((total, group) => total + (group.items || []).length, 0);
  byId("filingInsightCount").textContent = `${earnings.length} earnings result${earnings.length === 1 ? "" : "s"} · ${insights.length} filing insights · ${corporateMoveCount} corporate moves`;
  const competitorOrder = ["Agilent", "Thermo Fisher", "Shimadzu", "SCIEX", "PerkinElmer"];
  const groupedInsights = new Map();
  insights.forEach((insight) => {
    if (!groupedInsights.has(insight.competitor)) groupedInsights.set(insight.competitor, []);
    groupedInsights.get(insight.competitor).push(insight);
  });
  earnings.forEach((signal) => {
    if (!groupedInsights.has(signal.competitor)) groupedInsights.set(signal.competitor, []);
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
          const companyEarnings = earnings.filter((signal) => signal.competitor === competitor);
          const corporateMoves = (state.filingInsights?.companyCorporateMoves || [])
            .find((group) => group.competitor === competitor);
          const corporateMoveItems = corporateMoves?.items || [];
          const latestDate = [...companyInsights, ...companyEarnings]
            .map((item) => new Date(item.date))
            .filter((date) => !Number.isNaN(date.getTime()))
            .sort((a, b) => b - a)[0];
          const insightLabel = companyInsights.length === 1 ? "insight" : "insights";
          const earningsLabel = companyEarnings.length === 1 ? "earnings result" : "earnings results";
          return `
            <section class="filing-company-group">
              <div class="filing-company-header">
                <div>
                  <strong>${escapeHtml(competitor)}</strong>
                  <p>${companyEarnings.length} ${earningsLabel} · ${companyInsights.length} filing ${insightLabel} · Latest ${latestDate ? formatDate(latestDate) : "No date"}</p>
                </div>
              </div>
              ${companyEarnings.length
                ? `
                  <div class="filing-company-body filing-earnings-body">
                    ${companyEarnings.map((signal) => `
                      <article class="filing-card filing-earnings-card">
                        <div class="filing-card-top">
                          <strong>${escapeHtml(signal.title)}</strong>
                          <span class="tag medium">Official earnings result</span>
                        </div>
                        <p class="muted">${formatDate(signal.date)} · ${escapeHtml(signal.sourceName)}</p>
                        ${earningsPmReadoutMarkup(signal)}
                        <a href="${escapeHtml(signal.sourceUrl)}" target="_blank" rel="noreferrer">Open official earnings release ↗</a>
                      </article>
                    `).join("")}
                  </div>
                `
                : ""}
              <section class="filing-corporate-moves" aria-label="${escapeHtml(competitor)} partners, mergers, and other corporate transactions">
                <div class="filing-corporate-moves-header">
                  <div>
                    <span>Partners, mergers, and other corporate transactions</span>
                    <strong>${corporateMoveItems.length} named corporate transaction${corporateMoveItems.length === 1 ? "" : "s"} found in the displayed filing</strong>
                  </div>
                </div>
                ${corporateMoveItems.length
                  ? `
                    <div class="filing-corporate-move-grid">
                      ${corporateMoveItems.map((move) => `
                        <article class="filing-corporate-move-card">
                          <div class="filing-corporate-move-top">
                            <span>${escapeHtml(move.type)}</span>
                            <small>${escapeHtml(move.dateLabel || formatDate(move.date))}</small>
                          </div>
                          <strong>${escapeHtml(move.name)}</strong>
                          <p class="filing-transaction-meta">${escapeHtml(move.value)} · ${escapeHtml(move.status)}</p>
                          <p><b>Filing disclosure:</b> ${escapeHtml(move.filingEvidence)}</p>
                          <p class="filing-transaction-readout"><b>Waters implication:</b> ${escapeHtml(move.strategicReadout)}</p>
                          <div class="filing-search-tags" aria-label="Terms to find this transaction in the filing">
                            ${(move.searchTerms || []).map((term) => `<code>${escapeHtml(term)}</code>`).join("")}
                          </div>
                          <a href="${escapeHtml(move.sourceUrl)}" target="_blank" rel="noreferrer">Open SEC filing ↗</a>
                        </article>
                      `).join("")}
                    </div>
                  `
                  : `<p class="filing-corporate-empty">No named acquisition, divestiture, merger, or operating partnership was captured from this displayed filing.</p>`}
                ${corporateMoves?.coverageNote ? `<p class="filing-corporate-coverage-note">${escapeHtml(corporateMoves.coverageNote)}</p>` : ""}
              </section>
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
                                    <span>Waters implication</span>
                                    <p>${escapeHtml(navigation.watersReadout)}</p>
                                  </article>
                                </div>
                                ${
                                  navigation.whyThisSurfacesTheInsight
                                    ? `<p class="muted">${escapeHtml(navigation.whyThisSurfacesTheInsight)}</p>`
                                    : ""
                                }
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
    : `<div class="empty">No earnings results or investor filing insights match the current filters.</div>`;
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
  const pageSize = state.strategicEvidencePageSize;
  const pageCount = Math.max(1, Math.ceil(strategicSignals.length / pageSize));
  state.strategicEvidencePage = Math.min(Math.max(1, state.strategicEvidencePage), pageCount);
  const pageStart = (state.strategicEvidencePage - 1) * pageSize;
  const visibleSignals = strategicSignals.slice(pageStart, pageStart + pageSize);
  const rangeStart = strategicSignals.length ? pageStart + 1 : 0;
  const rangeEnd = pageStart + visibleSignals.length;
  byId("strategicSignalCount").textContent = strategicSignals.length > pageSize
    ? `Showing ${rangeStart}–${rangeEnd} of ${strategicSignals.length}`
    : `${strategicSignals.length} strategic move${strategicSignals.length === 1 ? "" : "s"}`;
  byId("strategicSignals").innerHTML = strategicSignals.length
    ? visibleSignals
        .map(
          (signal) => `
            <article class="strategic-card">
              <div class="strategic-top">
                <strong>${escapeHtml(signal.title)}</strong>
              </div>
              <p class="muted">${escapeHtml(signal.competitor)} · ${escapeHtml(signal.signalType)} · ${formatDate(signal.date)}</p>
              <p>${escapeHtml(signal.summary)}</p>
              ${signal.recommendation ? `<p class="question">${escapeHtml(signal.recommendation)}</p>` : ""}
              <a href="${escapeHtml(signal.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(signal.sourceName)}</a>
            </article>
          `,
        )
        .join("")
    : `<div class="empty">No public partnership or corporate-strategy records match the selected filters.</div>`;

  const pagination = byId("strategicPagination");
  pagination.hidden = strategicSignals.length <= pageSize;
  pagination.innerHTML = strategicSignals.length > pageSize
    ? `
        <span class="evidence-pagination-status">Page ${state.strategicEvidencePage} of ${pageCount}</span>
        <div class="evidence-pagination-controls">
          <button type="button" class="evidence-page-button evidence-page-step" data-strategic-page="${state.strategicEvidencePage - 1}" ${state.strategicEvidencePage === 1 ? "disabled" : ""} aria-label="Previous page">Previous</button>
          ${Array.from({ length: pageCount }, (_, index) => index + 1)
            .map(
              (page) => `
                <button type="button" class="evidence-page-button ${page === state.strategicEvidencePage ? "is-current" : ""}" data-strategic-page="${page}" ${page === state.strategicEvidencePage ? 'aria-current="page"' : ""} aria-label="Page ${page}">${page}</button>
              `,
            )
            .join("")}
          <button type="button" class="evidence-page-button evidence-page-step" data-strategic-page="${state.strategicEvidencePage + 1}" ${state.strategicEvidencePage === pageCount ? "disabled" : ""} aria-label="Next page">Next</button>
        </div>
      `
    : "";
}

function setupStrategicPagination() {
  byId("strategicPagination").addEventListener("click", (event) => {
    const button = event.target.closest("[data-strategic-page]");
    if (!button || button.disabled) return;
    state.strategicEvidencePage = Number(button.dataset.strategicPage) || 1;
    renderStrategicSignals(currentSignals());
    byId("strategicSignalCount").scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function applicationTrendSignal(trend, horizon) {
  const counts = trend.counts || {};
  let currentRate = counts[horizon] || 0;
  let comparisonRate = currentRate;
  let comparisonBasis = "selected-period baseline";

  if (horizon === "30d") {
    comparisonRate = Math.max(0, (counts["60d"] || 0) - (counts["30d"] || 0));
    comparisonBasis = "previous 30 days";
  } else if (horizon === "60d") {
    comparisonRate = Math.max(0, ((counts["1y"] || 0) - (counts["60d"] || 0)) * (60 / 305));
    comparisonBasis = "prior 10-month pace";
  } else if (horizon === "90d") {
    comparisonRate = Math.max(0, ((counts["1y"] || 0) - (counts["90d"] || 0)) * (90 / 275));
    comparisonBasis = "prior nine-month pace";
  } else if (horizon === "1y") {
    comparisonRate = Math.max(0, ((counts["3y"] || 0) - (counts["1y"] || 0)) / 2);
    comparisonBasis = "prior two-year average";
  } else if (horizon === "3y") {
    currentRate = (counts["3y"] || 0) / 3;
    comparisonRate = Math.max(0, ((counts["5y"] || 0) - (counts["3y"] || 0)) / 2);
    comparisonBasis = "prior two-year annual rate";
  }

  const ratio = comparisonRate > 0 ? currentRate / comparisonRate : 1;
  const changePercent = Math.round((ratio - 1) * 100);
  const label = changePercent >= 15 ? "Accelerating" : changePercent <= -10 ? "Cooling" : "Steady";
  const tone = label.toLowerCase();
  const comparison = changePercent === 0
    ? `Flat vs ${comparisonBasis}`
    : `${changePercent > 0 ? "+" : ""}${changePercent}% vs ${comparisonBasis}`;
  return { ratio, changePercent, label, tone, comparison, comparisonBasis };
}

function applicationTrendQuestion(trend, horizon) {
  const theme = trend.theme.toLowerCase();
  const stage = horizon === "30d" ? "pulse" : horizon === "60d" ? "repeat" : horizon === "90d" ? "quarter" : horizon === "1y" ? "annual" : "structural";
  const questions = theme.includes("lnp") || theme.includes("rna therapeutics")
    ? {
        pulse: "Which LNP method, compatibility, carryover, or LC-MS handoff issue is driving the current pulse?",
        repeat: "Do repeated LNP method-transfer and sample-throughput records justify focused customer validation?",
        quarter: "Should LNP method readiness enter the next quarterly application-roadmap review?",
        annual: "Should Next Gen LC package LNP column, solvent, carryover, throughput, and LC-MS handoff readiness?",
        structural: "Should LNP compatibility and method transfer become a sustained platform and application capability?",
      }
    : theme.includes("oligonucleotide")
      ? {
          pulse: "Which oligonucleotide workflow issue should Waters verify first: carryover, method transfer, or software templates?",
          repeat: "Is repeated oligonucleotide activity translating into a customer need for method-readiness proof?",
          quarter: "Should oligonucleotide workflow validation enter the next quarterly roadmap queue?",
          annual: "Should Next Gen LC offer an oligonucleotide method-readiness package with transfer and software proof?",
          structural: "Which oligonucleotide capabilities should become durable parts of the LC and LC-MS workflow strategy?",
        }
      : theme.includes("pfas")
        ? {
            pulse: "Is the PFAS pulse tied to a new regulated method, matrix, or quantitation requirement Waters must capture?",
            repeat: "Do two months of PFAS activity justify refreshing the competitor claims and method matrix?",
            quarter: "Which PFAS method or compliance proof should enter the next quarterly application review?",
            annual: "Should Waters package a clearer regulated PFAS workflow across LC-MS/MS, methods, and compliance proof?",
            structural: "Which PFAS method kits and compliance capabilities deserve sustained investment rather than campaign support?",
          }
        : theme.includes("proteomics") || theme.includes("metabolomics")
          ? {
              pulse: "Which emerging high-resolution workflow claim needs an immediate Waters proof-point check?",
              repeat: "Is repeated omics activity exposing a gap in application notes, software, or LC-MS workflow packaging?",
              quarter: "Which omics workflow should Waters defend in the next quarterly product and applications review?",
              annual: "Where should Waters strengthen high-resolution LC-MS workflow proof versus competitor platforms?",
              structural: "Which omics workflows require durable instrument, informatics, and application investment?",
            }
          : {
              pulse: "Which software or automation workflow claim should Waters verify against current competitor releases?",
              repeat: "Is repeated workflow activity exposing a product UX gap or only a packaging and messaging gap?",
              quarter: "Which automation or software handoff should enter the next quarterly validation queue?",
              annual: "Which software and automation capabilities should become product-level differentiators?",
              structural: "Which workflow, automation, and informatics capabilities require sustained platform investment?",
            };
  return questions[stage];
}

function currentCompetitorApplicationNotes() {
  const notes = state.competitorApplicationNotes?.notes || [];
  return notes
    .filter((note) => inSelectedHorizon(note.date))
    .filter((note) => geographyMatches(note.geography || "Global"))
    .filter((note) => filters.segment.value === "All" || note.marketSegment === filters.segment.value)
    .filter((note) => technologyMatchesFilter(
      note.technology,
      filters.technology.value,
      `${note.title} ${note.applicationArea} ${note.products} ${note.evidenceStatement}`,
    ))
    .filter((note) => filters.competitor.value === "All" || note.competitor === filters.competitor.value)
    .filter((note) => pmmTargetingMatches(note))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function competitorApplicationTheme(note) {
  const text = `${note.applicationArea} ${note.title}`.toLowerCase();
  if (/pfas|tfa|environmental/.test(text)) return "PFAS and environmental testing";
  if (/oligonucleotide|anti-sense|aso/.test(text)) return "Oligonucleotide workflows";
  if (/proteomics|peptide|intact protein|biopharmaceutical/.test(text)) return "Biopharma characterization";
  if (/food|pesticide|milk|seafood/.test(text)) return "Food safety testing";
  if (/metabol|drug/.test(text)) return "Small-molecule discovery";
  if (/nitrosamine|impurity/.test(text)) return "Pharma quality control";
  return note.applicationArea;
}

function rankedApplicationThemes(notes) {
  const counts = new Map();
  notes.forEach((note) => {
    const theme = competitorApplicationTheme(note);
    counts.set(theme, (counts.get(theme) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function competitorApplicationRead(competitor, notes) {
  const rankedThemes = rankedApplicationThemes(notes);
  const repeatedThemes = rankedThemes.filter(([, count]) => count > 1).map(([theme]) => theme.toLowerCase());
  if (repeatedThemes.length) {
    return `${competitor} is repeatedly publishing proof around ${repeatedThemes.slice(0, 2).join(" and ")}.`;
  }
  const areas = [...new Set(notes.map((note) => note.applicationArea.toLowerCase()))].slice(0, 3);
  return `${competitor} is publishing across ${areas.join(", ")}.`;
}

function competitorNoteThemeGroups(notes) {
  const groups = new Map();
  notes.forEach((note) => {
    const theme = competitorApplicationTheme(note);
    if (!groups.has(theme)) groups.set(theme, []);
    groups.get(theme).push(note);
  });
  return [...groups.entries()]
    .map(([theme, themeNotes]) => ({
      theme,
      notes: themeNotes.sort((a, b) => new Date(b.date) - new Date(a.date)),
      competitors: [...new Set(themeNotes.map((note) => note.competitor))].sort(),
      latestDate: themeNotes.map((note) => note.date).sort().at(-1),
    }))
    .sort((a, b) => b.notes.length - a.notes.length
      || new Date(b.latestDate) - new Date(a.latestDate)
      || a.theme.localeCompare(b.theme));
}

function competitorNoteThemeStatus(group) {
  if (group.notes.length >= 3) return "Repeated theme";
  if (group.notes.length >= 2) return "Repeated cluster";
  const ageDays = Math.max(0, Math.floor((Date.now() - new Date(`${group.latestDate}T00:00:00`)) / 86400000));
  return ageDays <= 120 ? "Recent single note" : "Single note";
}

function competitorNoteThemeRead(group) {
  const count = group.notes.length;
  const competitorText = group.competitors.length === 1
    ? group.competitors[0]
    : `${group.competitors.length} competitors (${group.competitors.join(", ")})`;
  if (count >= 2) {
    return `${count} official notes from ${competitorText} make this a repeated competitor-publishing cluster in the selected evidence.`;
  }
  return `One official note from ${competitorText} makes this an early competitor signal, not yet a repeated trend.`;
}

function currentMarketApplicationSources() {
  const baseSources = state.marketApplicationSources?.sources || [];
  const journalSources = (state.journalSources?.sources || [])
    .filter((source) => source.sourceClass === "Peer-reviewed journal")
    .map((source) => ({
      id: `journal-${source.id}`,
      name: source.name,
      publisher: source.publisher,
      sourceType: "Peer-reviewed journal",
      url: source.homepage,
      marketSegments: source.marketSegments || [],
      refreshCadence: source.refreshCadence || "Daily metadata check",
      accessType: source.accessType || "Publisher abstracts; article access varies",
      description: source.pmDecisionUse,
      whatToMeasure: source.monitoringMode,
      whyItMatters: `${source.confidenceUse}${source.extractedRecords ? ` ${source.extractedRecords} recent DOI records are currently indexed for review.` : ""}`,
      extractedRecords: source.extractedRecords || 0,
    }));
  const conferenceSources = (state.conferenceData?.events || [])
    .filter((event) => event.sourceClass === "Conference/poster")
    .map((event) => ({
      id: `conference-${event.id}`,
      name: event.eventName,
      publisher: event.publisher,
      sourceType: "Conference / poster program",
      url: event.website,
      marketSegments: event.marketSegments || [],
      refreshCadence: event.refreshCadence || "Program-window monitoring",
      accessType: event.accessType || "Official public event pages",
      description: event.monitoringUse,
      whatToMeasure: event.whatToMeasure,
      whyItMatters: event.whyItMatters,
    }));
  const regulatorySources = (state.sourceCatalog?.sources || [])
    .filter((source) => source.sourceClass === "Regulatory/pharmacopeial")
    .map((source) => ({
      id: source.id,
      name: source.source,
      publisher: source.publisher,
      sourceType: "Regulatory / pharmacopeial",
      url: source.url,
      marketSegments: source.marketSegments || [],
      refreshCadence: source.refreshCadence || "Weekly official-page check",
      accessType: source.accessType || "Official public source",
      description: source.signalCoverage?.join(" · ") || "Official regulatory or pharmacopeial evidence.",
      whatToMeasure: source.whatToMeasure,
      whyItMatters: source.whyItMatters,
    }));
  const sourceMap = new Map(
    [...baseSources, ...journalSources, ...conferenceSources, ...regulatorySources]
      .map((source) => [source.id, source]),
  );
  const sources = [...sourceMap.values()];
  const market = filters.segment.value;
  return market === "All"
    ? sources
    : sources.filter((source) => (source.marketSegments || []).includes(market));
}

const nonPubmedThemeDefinitions = [
  {
    id: "software-ai-data-analysis",
    label: "AI, chemometrics, and data interpretation",
    technology: "Software / LC-MS",
    marketSegments: ["Pharma", "Biopharma", "Clinical", "Academic", "Government"],
    pattern: /\b(?:artificial intelligence|machine learning|deep learning|neural|informatics|chemometric|algorithm|AI-assisted)\b/i,
    rule: "AI, machine learning, informatics, chemometrics, or algorithm",
  },
  {
    id: "environmental-food-contaminants",
    label: "Environmental and food contaminant testing",
    technology: "LC-MS / MS",
    marketSegments: ["Environmental", "Food & Beverage", "Government", "Academic"],
    pattern: /\b(?:environmental|drinking water|water samples?|pesticid|contaminant|pollut|food safety|food contact|aquaculture|cyanotoxin|mycotoxin|plasticizer|residue analysis|adulterant)\b/i,
    rule: "environmental, water, pesticide, contaminant, food-safety, or residue terms",
  },
  {
    id: "regulated-quantitation-validation",
    label: "Quantitative LC-MS methods and validation",
    technology: "LC / LC-MS",
    marketSegments: ["Pharma", "Biopharma", "CDMO", "Clinical", "Academic"],
    pattern: /\b(?:validat|quantif|quantitat|therapeutic drug monitoring|bioanalytical|assay|method development|determination of|clinical application|quality by design)\b/i,
    rule: "validation, quantitation, assay, method-development, or therapeutic-monitoring terms",
  },
  {
    id: "omics-complex-molecules",
    label: "Omics and complex-molecule characterization",
    technology: "LC-MS / MS",
    marketSegments: ["Biopharma", "Clinical", "Academic", "Pharma"],
    pattern: /\b(?:proteom|metabolom|lipidom|glycom|multi-omics|spatial omics|peptide|protein complex|antibody drug conjugate|biomarker)\b/i,
    rule: "proteomics, metabolomics, other omics, peptide, protein-complex, ADC, or biomarker terms",
  },
  {
    id: "separation-column-science",
    label: "Separation, column, and sample-preparation science",
    technology: "LC / UHPLC",
    marketSegments: ["Pharma", "Biopharma", "CDMO", "Academic", "Government", "Environmental", "Food & Beverage"],
    pattern: /\b(?:liquid chromatograph|ion chromatograph|stationary phase|column coupling|two-dimensional chromatograph|multidimensional chromatograph|retention|selectivity|separation|solid.phase extraction|sample preparation|extraction method)\b/i,
    rule: "chromatography, stationary-phase, separation, retention, selectivity, extraction, or sample-preparation terms",
  },
  {
    id: "advanced-ms-acquisition",
    label: "High-resolution, imaging, and advanced MS acquisition",
    technology: "LC-MS / MS",
    marketSegments: ["Academic", "Biopharma", "Clinical", "Government", "Environmental"],
    pattern: /\b(?:mass spectrom|LC.?MS|MS\/MS|HRMS|Q.?TOF|Orbitrap|MALDI|ion mobility|MRM|mass spectrometry imaging|ionization)\b/i,
    rule: "mass-spectrometry, LC-MS, HRMS, Q-TOF, Orbitrap, MALDI, ion-mobility, MRM, or ionization terms",
  },
];

function currentNonPubmedSignalData() {
  const sourceRecords = [];
  const seen = new Set();
  const selectedMarket = filters.segment.value;
  (state.journalSources?.sources || [])
    .filter((source) => source.sourceClass === "Peer-reviewed journal")
    .filter((source) => selectedMarket === "All" || (source.marketSegments || []).includes(selectedMarket))
    .forEach((source) => {
      (source.recentRecords || []).forEach((record) => {
        const key = String(record.doi || record.sourceUrl || "").toLowerCase();
        if (!key || seen.has(key) || !inSelectedHorizon(record.date)) return;
        seen.add(key);
        sourceRecords.push({
          ...record,
          journal: source.name,
          publisher: source.publisher,
          sourceMarketSegments: source.marketSegments || [],
        });
      });
    });

  const groups = new Map(nonPubmedThemeDefinitions.map((definition) => [definition.id, []]));
  sourceRecords.forEach((record) => {
    const definition = nonPubmedThemeDefinitions.find((candidate) => candidate.pattern.test(record.title));
    if (definition) groups.get(definition.id).push(record);
  });

  const signals = nonPubmedThemeDefinitions
    .filter((definition) => selectedMarket === "All" || definition.marketSegments.includes(selectedMarket))
    .filter((definition) => technologyMatchesFilter(definition.technology, filters.technology.value, definition.label))
    .map((definition) => {
      const records = groups.get(definition.id)
        .filter((record) => selectedMarket === "All" || record.sourceMarketSegments.includes(selectedMarket))
        .sort((a, b) => new Date(b.date) - new Date(a.date) || a.title.localeCompare(b.title));
      return {
        ...definition,
        records,
        journalCount: new Set(records.map((record) => record.journal)).size,
        latestDate: records[0]?.date || "",
      };
    })
    .filter((signal) => signal.records.length)
    .sort((a, b) => b.records.length - a.records.length || b.journalCount - a.journalCount || a.label.localeCompare(b.label));

  const displayedRecords = signals.flatMap((signal) => signal.records);

  return {
    signals,
    totalRecords: sourceRecords.length,
    journalCount: new Set(displayedRecords.map((record) => record.journal)).size,
    classifiedRecords: displayedRecords.length,
  };
}

function nonPubmedObservedSignalsMarkup(signalData, label) {
  if (!signalData.signals.length) {
    return `<div class="empty">No dated non-PubMed journal records match the active market, technology, and ${escapeHtml(label.toLowerCase())} filters. Source mappings below are coverage only and are not counted as trends.</div>`;
  }
  return `
    <section class="non-pubmed-signal-layer" aria-labelledby="nonPubmedSignalTitle">
      <div class="non-pubmed-signal-header">
        <div>
          <span>Observed beyond PubMed</span>
          <h5 id="nonPubmedSignalTitle">${signalData.classifiedRecords} dated records form recurring topics across ${signalData.journalCount} peer-reviewed journals</h5>
        </div>
        <div class="non-pubmed-signal-stat"><strong>${signalData.totalRecords}</strong><span>records reviewed</span></div>
      </div>
      <div class="non-pubmed-signal-grid">
        ${signalData.signals.map((signal, index) => `
          <article class="non-pubmed-signal-card">
            <span>#${index + 1} observed topic</span>
            <h6>${escapeHtml(signal.label)}</h6>
            <strong>${signal.records.length} exact records · ${signal.journalCount} ${signal.journalCount === 1 ? "journal" : "journals"}</strong>
            <p><b>Matched on:</b> ${escapeHtml(signal.rule)}.</p>
            <small>Latest record: ${escapeHtml(formatDate(signal.latestDate))}</small>
            <a href="#decisionEvidenceModal" data-non-pubmed-theme="${escapeHtml(signal.id)}">View ${signal.records.length} exact records →</a>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function marketSourceCoverageMarkup(sources) {
  const selectedMarket = filters.segment.value;
  const sourceTypes = [...new Set(sources.map((source) => source.sourceType))];
  const publishers = [...new Set(sources.map((source) => source.publisher))];
  const scopeNote = selectedMarket === "All"
    ? "Select a market to see the exact sources and the signal each source contributes."
    : `These sources are mapped to ${selectedMarket}; they are not constrained by the dashboard time filter until their records are ingested.`;

  if (selectedMarket === "All") {
    const markets = state.marketApplicationSources?.marketFilters || [];
    return `
      <section class="market-source-layer" aria-labelledby="marketSourceLayerTitle">
        <div class="market-source-layer-header">
          <div>
          <span>Source coverage — not trend data</span>
            <h5 id="marketSourceLayerTitle">${sources.length} additional sources mapped across every market filter</h5>
            <p>This inventory shows where the app can monitor next. A mapped source is not counted in the observed signals above until a dated, exact record is collected.</p>
          </div>
          <div class="market-source-stats">
            <strong>${sourceTypes.length}</strong><span>source types</span>
            <strong>${publishers.length}</strong><span>publishers</span>
          </div>
        </div>
        <div class="market-source-coverage-grid">
          ${markets.map((market) => {
            const matching = sources.filter((source) => (source.marketSegments || []).includes(market));
            const types = [...new Set(matching.map((source) => source.sourceType))];
            return `
              <article>
                <span>${escapeHtml(market)}</span>
                <a class="market-source-count-link" href="#decisionEvidenceModal" data-market-source-list="${escapeHtml(market)}" aria-label="View ${matching.length} exact sources for ${escapeHtml(market)}">${matching.length} mapped sources</a>
                <small>${escapeHtml(types.slice(0, 3).join(" · "))}${types.length > 3 ? ` · +${types.length - 3} more` : ""}</small>
              </article>
            `;
          }).join("")}
        </div>
        <p class="market-source-scope-note">${escapeHtml(scopeNote)}</p>
      </section>
    `;
  }

  return `
    <section class="market-source-layer" aria-labelledby="marketSourceLayerTitle">
      <div class="market-source-layer-header">
        <div>
          <span>Source coverage — not trend data · ${escapeHtml(selectedMarket)}</span>
          <h5 id="marketSourceLayerTitle">${sources.length} additional sources for this market</h5>
          <p>Each source contributes a different observable signal. No single source is treated as market demand or adoption by itself.</p>
        </div>
        <div class="market-source-stats">
          <strong>${sourceTypes.length}</strong><span>source types</span>
          <strong>${publishers.length}</strong><span>publishers</span>
        </div>
      </div>
      <div class="market-source-grid">
        ${sources.map((source) => `
          <article class="market-source-card">
            <div class="market-source-card-top">
              <span>${escapeHtml(source.sourceType)}</span>
              <small>${escapeHtml(source.refreshCadence)}</small>
            </div>
            <h6>${escapeHtml(source.name)}</h6>
            <p class="market-source-publisher">${escapeHtml(source.publisher)} · ${escapeHtml(source.accessType)}</p>
            <p>${escapeHtml(source.description)}</p>
            <p><strong>Track:</strong> ${escapeHtml(source.whatToMeasure)}</p>
            <p class="market-source-decision-use"><strong>Why it matters:</strong> ${escapeHtml(source.whyItMatters)}</p>
            <a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">Open exact source ↗</a>
          </article>
        `).join("")}
      </div>
      <p class="market-source-scope-note">${escapeHtml(scopeNote)}</p>
    </section>
  `;
}

function marketApplicationTrendMarkup(trends, horizon, label) {
  if (!trends.length) return `<div class="empty">No market-wide publication trends match the current market and technology filters.</div>`;
  const fastest = trends[0];
  const largest = [...trends].sort((a, b) => (b.trend.counts[horizon] || 0) - (a.trend.counts[horizon] || 0))[0];
  return `
    <div class="trend-horizon-summary">
      <div>
        <span>Fastest change in ${escapeHtml(label.toLowerCase())}</span>
        <strong>${escapeHtml(fastest.trend.theme)}</strong>
        <small>${escapeHtml(fastest.signal.comparison)}</small>
      </div>
      <div>
        <span>Largest scientific evidence base</span>
        <strong>${escapeHtml(largest.trend.theme)}</strong>
        <small>${(largest.trend.counts[horizon] || 0).toLocaleString()} PubMed records</small>
      </div>
    </div>
    ${trends.map(({ trend, signal }, index) => {
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
          <p class="trend-pm-question"><strong>PM question:</strong> ${escapeHtml(applicationTrendQuestion(trend, horizon))}</p>
          <div class="trend-card-footer">
            <a class="trend-source-link" href="${escapeHtml(pubMedTrendSearchUrl(trend.query, horizon))}" target="_blank" rel="noreferrer" aria-label="View PubMed sources for ${escapeHtml(trend.theme)} in ${escapeHtml(label.toLowerCase())}">View PubMed sources ↗</a>
          </div>
        </article>
      `;
    }).join("")}
  `;
}

function competitorApplicationNoteMarkup(notes, label) {
  if (!notes.length) return `<div class="empty">No official competitor application notes match the active filters and ${escapeHtml(label.toLowerCase())} horizon. This is a competitor-source coverage gap, not a market-trend conclusion.</div>`;
  const themes = competitorNoteThemeGroups(notes);
  const competitorGroups = new Map();
  notes.forEach((note) => {
    if (!competitorGroups.has(note.competitor)) competitorGroups.set(note.competitor, []);
    competitorGroups.get(note.competitor).push(note);
  });
  const competitors = [...competitorGroups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const leadingCompetitor = competitors[0];
  const leadingTheme = themes[0];
  const latestNote = [...notes].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  return `
    <div class="competitor-application-summary">
      <div>
        <span>Most repeated competitor-note theme</span>
        <strong>${escapeHtml(leadingTheme.theme)} · ${leadingTheme.notes.length} ${leadingTheme.notes.length === 1 ? "note" : "notes"}</strong>
      </div>
      <div>
        <span>${competitors.length === 1 ? "Selected competitor" : "Most active note publisher"}</span>
        <strong>${escapeHtml(leadingCompetitor[0])} · ${leadingCompetitor[1].length} ${leadingCompetitor[1].length === 1 ? "note" : "notes"}</strong>
      </div>
      <div>
        <span>Latest official note activity</span>
        <strong>${escapeHtml(formatDate(latestNote.date))} · ${escapeHtml(competitorApplicationTheme(latestNote))}</strong>
      </div>
    </div>
    <div class="competitor-note-theme-grid">
      ${themes.map((group, index) => `
          <article class="competitor-note-theme-card">
            <div class="competitor-note-theme-header">
              <div>
                <span>#${index + 1} · ${escapeHtml(competitorNoteThemeStatus(group))}</span>
                <h5>${escapeHtml(group.theme)}</h5>
              </div>
              <strong>${group.notes.length} ${group.notes.length === 1 ? "note" : "notes"}</strong>
            </div>
            <p class="competitor-note-theme-read"><strong>Observed note pattern:</strong> ${escapeHtml(competitorNoteThemeRead(group))}</p>
            <div class="competitor-note-theme-meta">
              <span>Competitors: ${escapeHtml(group.competitors.join(", "))}</span>
              <span>Latest: ${escapeHtml(formatDate(group.latestDate))}</span>
            </div>
            <div class="competitor-application-note-list">
              ${group.notes.map((note) => `
                <article class="competitor-application-note">
                  <div>
                    <span>${escapeHtml(note.dateLabel || formatDate(note.date))} · ${escapeHtml(note.competitor)} · ${escapeHtml(note.applicationArea)}</span>
                    <strong>${escapeHtml(note.title)}</strong>
                    <small>${escapeHtml(note.products)}</small>
                    <p>${escapeHtml(note.evidenceStatement)}</p>
                  </div>
                  <a href="${escapeHtml(note.sourceUrl)}" target="_blank" rel="noreferrer">Open exact ${escapeHtml(note.sourceType.toLowerCase())} ↗</a>
                </article>
              `).join("")}
            </div>
          </article>
      `).join("")}
    </div>
    </div>
  `;
}

function renderTrends() {
  const horizon = filters.horizon.value;
  const label = filters.horizon.options[filters.horizon.selectedIndex].text;
  byId("horizonLabel").textContent = label;
  const trends = state.data.trends.themes
    .filter((trend) => filters.segment.value === "All" || trend.marketSegment === filters.segment.value)
    .filter((trend) => technologyMatchesFilter(trend.technology, filters.technology.value, `${trend.theme} ${trend.query || ""}`))
    .map((trend) => ({ trend, signal: applicationTrendSignal(trend, horizon) }))
    .sort((a, b) => b.signal.ratio - a.signal.ratio || (b.trend.counts[horizon] || 0) - (a.trend.counts[horizon] || 0));
  const competitorNotes = currentCompetitorApplicationNotes();
  const marketSources = currentMarketApplicationSources();
  const nonPubmedSignals = currentNonPubmedSignalData();
  byId("trendList").innerHTML = `
    <section class="application-trend-section" aria-labelledby="marketApplicationTrendTitle">
      <div class="application-trend-section-header">
        <span>1</span>
        <div>
          <h4 id="marketApplicationTrendTitle">What the Market Is Doing</h4>
        </div>
      </div>
      ${nonPubmedObservedSignalsMarkup(nonPubmedSignals, label)}
      <div class="application-trend-grid">${marketApplicationTrendMarkup(trends, horizon, label)}</div>
    </section>
    <section class="application-trend-section competitor-view" aria-labelledby="competitorApplicationTrendTitle">
      <div class="application-trend-section-header">
        <span>2</span>
        <div>
          <h4 id="competitorApplicationTrendTitle">Competitor Application-Note Trends</h4>
        </div>
      </div>
      ${competitorApplicationNoteMarkup(competitorNotes, label)}
    </section>
  `;
  byId("marketSourceCoverage").innerHTML = marketSourceCoverageMarkup(marketSources);
}

function displaySignals(signals) {
  return signals.filter((signal) => {
    const genericInvestorFiling = signal.signalType === "Investor filing" && /\bfiled\b/i.test(signal.title);
    return !genericInvestorFiling;
  });
}

function updatePublicEvidenceFilterOptions(signals) {
  const filterDefinitions = [
    { control: publicEvidenceFilters.company, values: signals.map((signal) => signal.competitor), allLabel: "All Companies" },
    { control: publicEvidenceFilters.technology, values: signals.map((signal) => signal.technology), allLabel: "All Technologies" },
    { control: publicEvidenceFilters.source, values: signals.map((signal) => signal.sourceName), allLabel: "All Sources" },
  ];
  filterDefinitions.forEach(({ control, values, allLabel }) => {
    const selectedValue = control.value || "All";
    const options = [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
    control.innerHTML = `<option value="All">${allLabel}</option>${options
      .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
      .join("")}`;
    control.value = options.includes(selectedValue) ? selectedValue : "All";
  });
}

function filterPublicEvidenceLibrary(signals) {
  const searchTerm = publicEvidenceSearchTerm.trim().toLowerCase();
  return signals.filter((signal) => {
    const companyMatch = publicEvidenceFilters.company.value === "All" || signal.competitor === publicEvidenceFilters.company.value;
    const technologyMatch = publicEvidenceFilters.technology.value === "All" || signal.technology === publicEvidenceFilters.technology.value;
    const sourceMatch = publicEvidenceFilters.source.value === "All" || signal.sourceName === publicEvidenceFilters.source.value;
    const searchableText = [
      signal.title,
      signal.summary,
      signal.intent,
      signal.theme,
      signal.competitor,
      signal.technology,
      signal.signalType,
      signal.sourceName,
    ].filter(Boolean).join(" ").toLowerCase();
    return companyMatch && technologyMatch && sourceMatch && (!searchTerm || searchableText.includes(searchTerm));
  });
}

function renderSignals(signals) {
  const availableSignals = displaySignals(signals);
  updatePublicEvidenceFilterOptions(availableSignals);
  const visibleSignals = filterPublicEvidenceLibrary(availableSignals);
  const pageSize = state.signalPageSize;
  const pageCount = Math.max(1, Math.ceil(visibleSignals.length / pageSize));
  state.signalPage = Math.min(Math.max(1, state.signalPage), pageCount);
  const pageStart = (state.signalPage - 1) * pageSize;
  const pageSignals = visibleSignals.slice(pageStart, pageStart + pageSize);
  const locallyFiltered = publicEvidenceSearchTerm.trim()
    || Object.values(publicEvidenceFilters).some((control) => control.value !== "All");
  byId("signalCount").textContent = locallyFiltered
    ? `${visibleSignals.length} of ${availableSignals.length} public records`
    : `${visibleSignals.length} public records`;
  byId("signalTable").innerHTML = visibleSignals.length
    ? pageSignals
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
              <td><a href="${signal.sourceUrl}" target="_blank" rel="noreferrer">${signal.sourceName}</a></td>
            </tr>
          `,
        )
        .join("")
    : `<tr><td colspan="5"><div class="empty">No records match the current search and filters.</div></td></tr>`;

  const pagination = byId("signalPagination");
  pagination.hidden = visibleSignals.length <= pageSize;
  pagination.innerHTML = visibleSignals.length > pageSize
    ? `
        <span class="evidence-pagination-status">Showing ${pageStart + 1}–${Math.min(pageStart + pageSize, visibleSignals.length)} of ${visibleSignals.length} · Page ${state.signalPage} of ${pageCount}</span>
        <div class="evidence-pagination-controls">
          <button type="button" class="evidence-page-button evidence-page-step" data-signal-page="${state.signalPage - 1}" ${state.signalPage === 1 ? "disabled" : ""} aria-label="Previous public evidence page">Previous</button>
          <button type="button" class="evidence-page-button evidence-page-step" data-signal-page="${state.signalPage + 1}" ${state.signalPage === pageCount ? "disabled" : ""} aria-label="Next public evidence page">Next</button>
        </div>
      `
    : "";
}

function setupPublicEvidenceFilters() {
  const form = byId("publicEvidenceFilters");
  form.addEventListener("submit", (event) => event.preventDefault());
  byId("signalSearch").addEventListener("input", (event) => {
    publicEvidenceSearchTerm = event.target.value;
    state.signalPage = 1;
    renderSignals(filteredSignalsForHorizon(filters.horizon.value));
  });
  Object.values(publicEvidenceFilters).forEach((control) => control.addEventListener("change", () => {
    state.signalPage = 1;
    renderSignals(filteredSignalsForHorizon(filters.horizon.value));
  }));
  byId("clearSignalFilters").addEventListener("click", () => {
    publicEvidenceSearchTerm = "";
    byId("signalSearch").value = "";
    Object.values(publicEvidenceFilters).forEach((control) => {
      control.value = "All";
    });
    state.signalPage = 1;
    renderSignals(filteredSignalsForHorizon(filters.horizon.value));
  });
}

function setupSignalPagination() {
  byId("signalPagination").addEventListener("click", (event) => {
    const button = event.target.closest("[data-signal-page]");
    if (!button || button.disabled) return;
    state.signalPage = Number(button.dataset.signalPage) || 1;
    renderSignals(filteredSignalsForHorizon(filters.horizon.value));
    byId("signalCount").scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function trendRecordTotalForHorizon(horizonValue) {
  if (!state.data) return 0;
  return state.data.trends.themes
    .filter((trend) => filters.segment.value === "All" || trend.marketSegment === filters.segment.value)
    .filter((trend) => technologyMatchesFilter(trend.technology, filters.technology.value, `${trend.theme} ${trend.query || ""}`))
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
  const launches = currentLaunches();
  const customerVoiceSignals = currentCustomerVoiceItems();
  const filingInsights = currentFilingInsights();
  const publicationRecords = trendRecordTotalForHorizon(filters.horizon.value);
  const upcomingConferenceSources = currentConferenceSources();
  const activeCompetitors = new Set(launches.map((launch) => launch.competitor)).size;
  const horizonDelta = horizonDeltaSummary();
  byId("sourceCounts").innerHTML = `
    <div class="source-pill"><span>Role view</span><strong>${escapeHtml(state.view)}</strong></div>
    <div class="source-pill"><span>Time window</span><strong>${horizonLabel()}</strong></div>
    <div class="source-pill source-pill-comparison">
      <span>${escapeHtml(horizonDelta.label)}</span>
      <strong><small>${escapeHtml(horizonDelta.launches)}</small><small>${escapeHtml(horizonDelta.signals)}</small></strong>
    </div>
    <a class="source-pill source-pill-link" href="#competitive-timeline-section" data-evidence-target="competitive-timeline-section" aria-label="View ${launches.length} matching launches"><span>Matching launches</span><strong>${launches.length}<small>View →</small></strong></a>
    <a class="source-pill source-pill-link" href="#evidence-signal-feed" data-evidence-target="evidence-signal-feed" aria-label="View ${displaySignals(signals).length} public evidence records"><span>Public evidence records</span><strong>${displaySignals(signals).length}<small>View →</small></strong></a>
    <a class="source-pill source-pill-link" href="#filing-evidence" data-evidence-target="filing-evidence" aria-label="View ${filingInsights.length} filing insights"><span>Filing insights</span><strong>${filingInsights.length}<small>View →</small></strong></a>
    <div class="source-pill"><span>Publication records</span><strong>${publicationRecords.toLocaleString()}</strong></div>
    <a class="source-pill source-pill-link" href="#customer-voice" data-evidence-target="customer-voice" aria-label="View ${customerVoiceSignals.length} customer-voice theme summaries and their public sources"><span>Public customer voice</span><strong>${customerVoiceSignals.length} theme summaries<small>View →</small></strong></a>
    <a class="source-pill source-pill-link" href="#competitor-intent-section" data-evidence-target="competitor-intent-section" aria-label="View ${activeCompetitors} competitors with matching launches"><span>Competitors with launches</span><strong>${activeCompetitors}<small>View →</small></strong></a>
    <a class="source-pill source-pill-link" href="conference.html" aria-label="Open ${upcomingConferenceSources.length} upcoming conferences on the conference page"><span>Upcoming conferences</span><strong>${upcomingConferenceSources.length}<small>View →</small></strong></a>
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

function updateRolePanelVisibility() {
  const competitorCoveragePanel = document.querySelector(".competitor-coverage-panel");
  const hiddenForProductManagement = state.view === "Product";
  if (competitorCoveragePanel) {
    competitorCoveragePanel.hidden = hiddenForProductManagement;
    competitorCoveragePanel.setAttribute("aria-hidden", String(hiddenForProductManagement));
  }

  const marketingView = state.view === "Marketing";
  const appShell = document.querySelector(".app-shell");
  const visualDashboard = document.querySelector(".visual-dashboard");
  const comparatorPanel = byId("product-comparator");
  const leadershipBrief = byId("leadership-brief");
  const marketingWorkspace = byId("marketingWorkspace");
  const standardNavigation = byId("standardSectionNavigation");
  const marketingNavigation = byId("marketingSectionNavigation");
  const navigationLabel = byId("sectionNavigationLabel");

  appShell?.classList.toggle("marketing-view", marketingView);
  document.querySelectorAll(".pmm-hierarchy-filter").forEach((control) => {
    control.hidden = !marketingView;
    control.setAttribute("aria-hidden", String(!marketingView));
  });
  if (appShell) {
    [...appShell.children].forEach((child) => {
      child.classList.toggle("standard-role-section", !child.matches(".topbar, .filters, #marketingWorkspace"));
    });
  }
  if (marketingWorkspace) {
    marketingWorkspace.hidden = !marketingView;
    marketingWorkspace.setAttribute("aria-hidden", String(!marketingView));
  }
  if (standardNavigation) standardNavigation.hidden = marketingView;
  if (marketingNavigation) marketingNavigation.hidden = !marketingView;
  if (navigationLabel) navigationLabel.textContent = marketingView ? "Product Marketing Workspace" : "Roadmap Intelligence";
  if (leadershipBrief) leadershipBrief.hidden = false;
  if (visualDashboard && comparatorPanel && comparatorPanel.parentElement !== visualDashboard) {
    visualDashboard.insertAdjacentElement("afterbegin", comparatorPanel);
  }
  if (byId("comparisonSnapshots")) byId("comparisonSnapshots").hidden = false;
  const comparisonControls = document.querySelector("#product-comparator .comparison-controls");
  if (comparisonControls) comparisonControls.hidden = false;

  const inactiveNavigation = marketingView ? standardNavigation : marketingNavigation;
  inactiveNavigation?.querySelectorAll("[data-section-nav]").forEach((link) => {
    link.classList.remove("active");
    link.removeAttribute("aria-current");
  });
}

function render() {
  state.view = filters.role.value;
  updateRolePanelVisibility();
  if (state.view === "Marketing") normalizeMarketingTargeting();
  const signals = currentSignals();
  byId("currentViewBadge").textContent = viewCopy[state.view].viewLabel;
  byId("viewSubtitle").textContent = viewCopy[state.view].subtitle;
  if (state.view === "Marketing") {
    document.title = viewCopy.Marketing.title;
    byId("viewTitle").textContent = viewCopy.Marketing.title;
    renderMarketingWorkspace(signals);
    scheduleSectionNavRefresh();
    return;
  }

  document.title = "Next Gen Competitive Intelligence Engine";
  byId("viewTitle").textContent = "Next Gen Competitive Intelligence Engine";
  setCustomerVoiceTab(state.activeCustomerVoiceTab);
  renderSourceCounts(signals);
  renderDirectorSummary(signals);
  renderDecisionPacket(signals);
  renderDecisionQueue(signals);
  renderOverallTrendAnalysis(signals);
  renderCompetitorIntentCards(competitorIntentSignals(signals));
  renderCompetitorCoverageHealth(signals);
  renderCustomerVoiceSignals();
  renderMetrics(signals);
  renderProductComparator();
  renderCompetitiveTimeline();
  renderFeatureGapMatrix(signals);
  renderFilingInsights();
  renderStrategicSignals(signals);
  renderConferenceSources();
  renderJournalForumSources();
  renderShortHorizonDefense();
  renderTrends();
  renderSignals(signals);
  scheduleSectionNavRefresh();
}

async function loadData() {
  const [
    response,
    productResponse,
    sourceResponse,
    conferenceResponse,
    conferencePrepResponse,
    journalSourceResponse,
    competitorApplicationNoteResponse,
    marketApplicationSourceResponse,
    productComparisonResponse,
    historicalProductCatalogResponse,
    historicalWatersCatalogResponse,
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
    fetch("data/competitor_application_notes.json", { cache: "no-store" }),
    fetch("data/market_application_sources.json", { cache: "no-store" }),
    fetch("data/product_comparisons.json", { cache: "no-store" }),
    fetch("data/historical_product_catalog.json", { cache: "no-store" }),
    fetch("data/historical_waters_catalog.json", { cache: "no-store" }),
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
  if (!competitorApplicationNoteResponse.ok) throw new Error(`Competitor application-note data load failed: ${competitorApplicationNoteResponse.status}`);
  if (!marketApplicationSourceResponse.ok) throw new Error(`Market application source data load failed: ${marketApplicationSourceResponse.status}`);
  if (!productComparisonResponse.ok) throw new Error(`Product comparison data load failed: ${productComparisonResponse.status}`);
  if (!historicalProductCatalogResponse.ok) throw new Error(`Historical product catalog load failed: ${historicalProductCatalogResponse.status}`);
  if (!historicalWatersCatalogResponse.ok) throw new Error(`Historical Waters catalog load failed: ${historicalWatersCatalogResponse.status}`);
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
  state.competitorApplicationNotes = await competitorApplicationNoteResponse.json();
  state.marketApplicationSources = await marketApplicationSourceResponse.json();
  state.productComparisons = await productComparisonResponse.json();
  state.historicalProductCatalog = await historicalProductCatalogResponse.json();
  state.historicalWatersCatalog = await historicalWatersCatalogResponse.json();
  state.technicalComparisons = await technicalComparisonResponse.json();
  state.filingInsights = await filingInsightResponse.json();
  state.customerVoice = await customerVoiceResponse.json();
  state.refreshStatus = await refreshStatusResponse.json();
  byId("asOf").textContent = `Real public data as of ${state.data.asOfDate}`;
  renderRefreshStatus();
  populateCompetitors();
  setupSourceCountLinks();
  setupMetricDrilldowns();
  setupDecisionEvidenceDrilldowns();
  setupOverallTrendEvidenceLinks();
  setupCompetitorIntentEvidenceLinks();
  setupRoadmapImpactEvidenceLinks();
  setupMarketSourceLinks();
  setupSentimentMentionDrilldowns();
  setupCustomerVoiceSummaryDrilldowns();
  setupCompanyVoiceDrilldowns();
  setupCustomerVoiceTabs();
  setupComparisonPanel();
  setupMarketingWorkspaceControls();
  setupConferencePagination();
  setupJournalSourceSlider();
  setupStrategicPagination();
  setupPublicEvidenceFilters();
  setupSignalPagination();
  render();
  const initialSectionId = window.location.hash.slice(1);
  if (sectionNavigatorTargets.some((target) => target.id === initialSectionId)) {
    navigateToDashboardSection(initialSectionId, { behavior: "auto", updateHistory: false });
  }
  schedulePublishedDataCheck();
}

Object.values(filters).forEach((filter) => filter.addEventListener("change", () => {
  state.conferencePage = 1;
  state.strategicEvidencePage = 1;
  state.signalPage = 1;
  render();
}));

byId("customerVoiceSearch").addEventListener("input", (event) => {
  customerVoiceSearchTerm = event.target.value;
  render();
});

byId("exportCustomerVoice").addEventListener("click", exportCustomerVoiceSummary);

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

setupCollapsiblePanels();
setupSidebarNavigation();
setupSectionNavigator();

loadData().catch((error) => {
  document.body.innerHTML = `
    <main class="app-shell" style="margin-left:0">
      <section class="panel">
        <h2>Data File Not Loaded</h2>
        <p class="muted">Run the real-data collector, then open this dashboard through a local web server.</p>
        <p class="muted">${error.message}</p>
      </section>
    </main>
  `;
});
