const competitiveMethodology = globalThis.CompetitiveMethodology || {
  assessInference: (records) => ({ label: records?.length ? "Directional" : "Low", limitation: "Directional—insufficient independent corroboration.", rubric: {}, families: [], dedupedRecords: records || [] }),
  unquantifiedMagnitude: (overrides = {}) => ({ status: "UNQUANTIFIED — validation required", affectedSegment: overrides.affectedSegment || "Not established", geography: overrides.geography || "Not established", cohort: "Installed-base / replacement cohort not linked", exposureBand: "Unquantified", timeHorizon: "0–24 months", basis: "Public evidence establishes relevance, not Waters revenue or share exposure.", confidence: "Unquantified", validationOwner: overrides.validationOwner || "Product Management + Commercial Analytics", nextStep: "Join CRM installed base, opportunity, win/loss, renewal, and segment-revenue data to the public signal." }),
  evidencePriority: () => "Medium",
  snapshotMetadata: (data) => ({ asOfTimestamp: data?.generatedAt || data?.asOfDate || "unknown", snapshotId: data?.snapshotId || `waters-ci-${data?.asOfDate || "unknown"}` }),
};
const headToHeadProductMatchModel = globalThis.HeadToHeadProductMatchModel;
const conferenceDatePolicy = globalThis.ConferenceDatePolicy;

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
  linkHealth: null,
  view: "Product",
  activeComparisonLaunchId: null,
  activeWatersComparatorId: null,
  activeDecisionBreakdown: null,
  overallTrendCandidates: [],
  competitorIntentProfiles: [],
  activeIntentCompetitor: "",
  activeFilingCompetitor: "",
  activeCustomerVoiceCompany: "",
  roadmapImpactEvidence: [],
  roadmapImpactSort: { column: 2, direction: "desc" },
  capabilityGapEvidence: [],
  capabilityGapScope: { mode: "product", watersProductId: "", competitor: "", competitorProductId: "", competitorProductOverrides: {} },
  activeCustomerVoiceTab: "summary",
  headToHead: { matchModel: null },
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
let intentActivityCarouselResizeObserver = null;

const filters = {
  role: document.querySelector("#roleFilter"),
  geo: document.querySelector("#geoFilter"),
  segment: document.querySelector("#segmentFilter"),
  technology: document.querySelector("#technologyFilter"),
  competitor: document.querySelector("#competitorFilter"),
  horizon: document.querySelector("#horizonFilter"),
};

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

// Canonical Waters capability inventory used by both capability-priority and gap-map views.
// A capability is displayed only when the loaded evidence base contains a dated matching record.
const watersCapabilityDefinitions = [
  { key: "lc-ms-sensitivity", label: "LC-MS sensitivity", scope: "instrument", terms: ["lc-ms sensitivity"], pattern: /(?:(?:lc[- /]?ms|mass spectrom|qtof|\btof\b|triple quadrupole|triple quad|zenotof|xevo|lcms).{0,120}(?:sensitiv|signal[- ]to[- ]noise|limit of detection|low[- ]level)|(?:sensitiv|signal[- ]to[- ]noise|limit of detection|low[- ]level).{0,120}(?:lc[- /]?ms|mass spectrom|qtof|\btof\b|triple quadrupole|triple quad|zenotof|xevo|lcms))/i },
  { key: "lod-loq", label: "LOD / LOQ", scope: "instrument", terms: ["limit of detection", "limit of quantitation", "limit of quantification", "lod", "loq"] },
  { key: "analysis-time", label: "Analysis time", scope: "instrument", terms: ["analysis time", "run time", "cycle time", "polarity-switching speed", "acquisition rate"] },
  { key: "pressure-range", label: "Pressure range", scope: "instrument", terms: ["pressure range", "maximum pressure", "max pressure", "pressure limit", "bar", "psi"] },
  { key: "throughput", label: "Throughput", scope: "instrument", terms: ["throughput", "sample capacity", "injections per", "samples per", "points across peak"] },
  { key: "lc-platform", label: "LC platform", scope: "instrument", terms: ["lc platform", "hplc", "liquid chromatography", "lc system", "routine lc"] },
  { key: "uhplc-modules", label: "UHPLC modules", scope: "instrument", terms: ["uhplc", "uplc", "module", "detector", "pump"] },
  { key: "lc-ms-ms-quantitation", label: "LC-MS/MS quantitation", scope: "instrument", terms: ["lc-ms/ms", "quantitation", "quantitative", "triple quadrupole", "triple quad"] },
  { key: "2d-lc", label: "2D LC", scope: "instrument", terms: ["2d lc", "2d-lc", "two-dimensional liquid chromatography"] },
  { key: "method-transfer", label: "Method transfer", scope: "platform", terms: ["method transfer", "method-transfer", "method continuity", "migration", "validated method", "compatibility", "equivalency"] },
  { key: "software-usability", label: "Software usability", scope: "platform", terms: ["software usability", "ease of use", "data review", "setup", "training", "workflow friction"] },
  { key: "informatics", label: "Informatics / software", scope: "platform", terms: ["informatics", "software", "data workflow", "data review", "digital lab", "empower", "openlab", "chromeleon", "labsolutions", "sciex os"] },
  { key: "automation", label: "Automation ecosystem", scope: "platform", terms: ["automation", "automated", "autosampler", "plate loader", "sample handling", "walkaway", "workflow execution"] },
  { key: "application-kits", label: "Application kits", scope: "platform", terms: ["application kit", "application workflow", "method package", "method readiness", "application note"] },
  { key: "sample-prep", label: "Sample prep ecosystem", scope: "platform", terms: ["sample prep", "sample preparation", "extraction", "cleanup"] },
  { key: "regulated-methods", label: "Regulatory / compliance ecosystem", scope: "platform", terms: ["pfas", "regulated", "compliance", "validated method", "environmental contaminant", "audit trail", "data integrity"] },
  { key: "serviceability", label: "Service network / serviceability", scope: "platform", terms: ["serviceability", "service", "support", "repair", "maintenance", "parts", "diagnostic", "uptime", "downtime"] },
];

function formatDate(value) {
  if (!value) return "Unknown";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function launchDateLabel(launch) {
  const launchDate = launch?.launchDate || launch?.date;
  const publicationDate = launch?.publicationDate || launch?.sourceDate;
  const launched = `Launched ${formatDate(launchDate)}`;
  if (publicationDate && publicationDate !== launchDate) {
    return `${launched} · News published ${formatDate(publicationDate)}`;
  }
  return launched;
}

function renderRefreshStatus() {
  const node = byId("generatedAt");
  const status = state.refreshStatus || {};
  const buildPublished = status.buildPublishedAt || status.lastAttemptAt || status.lastSuccessfulRefreshAt || state.data?.generatedAt;
  const sourcesVerified = status.sourcesVerifiedAt;
  const parsed = buildPublished ? new Date(buildPublished) : null;
  const ageHours = parsed && !Number.isNaN(parsed.getTime()) ? (Date.now() - parsed.getTime()) / (1000 * 60 * 60) : Infinity;
  const failed = status.status === "failed";
  const partial = status.status === "partial" || status.allRequiredSourcesCurrent === false;
  const setupRequired = status.status === "setup_required";
  const overdue = ageHours > 36;

  node.className = `refresh-status ${failed || partial ? "failed" : setupRequired ? "setup-required" : overdue ? "overdue" : "current"}`;
  node.textContent = failed
    ? `Build published ${formatDate(buildPublished)} · Source verification failed`
    : partial
      ? `Build published ${formatDate(buildPublished)} · ${(status.requiredSourceBlockers || []).length} required sources need attention`
    : setupRequired
      ? `Build published ${formatDate(buildPublished)} · Source verification setup required`
    : overdue
      ? `Build published ${formatDate(buildPublished)} · Verification overdue`
      : `Build published ${formatDate(buildPublished)} · Sources verified ${formatDate(sourcesVerified)}`;
  node.title = status.reloadSemantics || status.message || "The browser checks for newly published data; it does not refetch source systems.";
}

function schedulePublishedDataCheck() {
  if (publishedDataCheckTimer) return;
  const loadedRefreshTime = state.refreshStatus?.buildPublishedAt || state.refreshStatus?.lastAttemptAt || state.refreshStatus?.lastSuccessfulRefreshAt || state.data?.generatedAt;
  publishedDataCheckTimer = window.setInterval(async () => {
    try {
      const response = await fetch(`data/refresh_status.json?check=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) return;
      const latest = await response.json();
      const latestTime = new Date(latest.buildPublishedAt || latest.lastAttemptAt || latest.lastSuccessfulRefreshAt || 0).getTime();
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
    const carouselTrigger = event.target.closest("button[data-intent-carousel-action]");
    if (carouselTrigger) {
      moveIntentActivityCarousel(carouselTrigger.dataset.intentCarouselAction);
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
  byId("competitorIntent").addEventListener("keydown", (event) => {
    if (!event.target.closest("[data-intent-carousel-viewport]")) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveIntentActivityCarousel("previous");
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveIntentActivityCarousel("next");
    }
  });
}

function setupFilingInsightNavigation() {
  byId("filingInsights").addEventListener("click", (event) => {
    const trigger = event.target.closest("button[data-filing-select]");
    if (!trigger) return;
    state.activeFilingCompetitor = trigger.dataset.filingSelect;
    renderFilingInsights();
  });
}

function setupCapabilityGapEvidenceLinks() {
  const matrix = byId("featureGapMatrix");
  matrix.addEventListener("change", (event) => {
    const control = event.target.closest("[data-gap-scope-control]");
    if (!control) return;
    const scope = state.capabilityGapScope;
    if (control.dataset.gapScopeControl === "mode") scope.mode = control.value;
    if (control.dataset.gapScopeControl === "waters") scope.watersProductId = control.value;
    if (control.dataset.gapScopeControl === "competitor-product") {
      const competitor = control.dataset.gapCompetitor;
      if (competitor) scope.competitorProductOverrides[competitor] = control.value;
    }
    renderFeatureGapMatrix();
  });
  matrix.addEventListener("click", (event) => {
    const trigger = event.target.closest("button[data-gap-evidence-key]");
    if (!trigger) return;
    const entry = state.capabilityGapEvidence.find((item) => item.key === trigger.dataset.gapEvidenceKey);
    if (!entry) return;
    const directionLabel = { ahead: "Ahead", parity: "Parity", behind: "Behind", "no-evidence": "No evidence" }[entry.direction];
    const sourceMixLabel = entry.authorityMix.map((item) => `${item.label} ${item.count}`).join(" · ");
    byId("decisionEvidenceTitle").textContent = `${entry.capability}: ${entry.scopeLabel}`;
    byId("decisionEvidenceSummary").textContent = entry.records.length
      ? `${directionLabel} · ${entry.tier} · ${entry.independentSourceCount} independent source${entry.independentSourceCount === 1 ? "" : "s"} · ${entry.sourceCount} total dated source${entry.sourceCount === 1 ? "" : "s"}. Authority mix: ${sourceMixLabel}. ${entry.selfClaimOnly ? "Vendor-stated / self-claim evidence is unverified and capped at Directional. " : ""}${entry.rollupBasis ? `${entry.rollupBasis} ` : ""}Color shows direction only.`
      : `No dated public source matches ${entry.capability} for ${entry.scopeLabel}. No direction is inferred.`;
    byId("decisionEvidenceList").innerHTML = entry.records.length
      ? entry.records.map((record) => `
          <article class="decision-evidence-card">
            <strong>${escapeHtml(record.title)}</strong>
            <div class="gap-evidence-tags">
              <span class="gap-authority gap-authority-${escapeHtml(record.sourceAuthorityTier.toLowerCase().replace("_", "-"))}">${escapeHtml(record.sourceAuthorityTier.replace("_", " "))}</span>
              <span class="gap-source-type">${escapeHtml(record.sourceType.replaceAll("_", " "))}</span>
            </div>
            <span>${escapeHtml(gapMapEvidenceFamilyLabels[record.evidenceFamily] || "Public evidence")} · ${escapeHtml(record.dateType)} ${escapeHtml(formatDate(record.date))}</span>
            <p>${escapeHtml(record.detail)}</p>
            <a class="decision-evidence-source-link" href="${escapeHtml(record.url)}" target="_blank" rel="noreferrer">Open dated primary source ↗</a>
          </article>
        `).join("")
      : `<div class="empty"><strong>No evidence</strong><span>This cell is intentionally unscored. Add a dated public source before assigning Ahead, Parity, or Behind.</span></div>`;
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
    const companySelect = event.target.closest("[data-company-voice-select]");
    if (companySelect) {
      state.activeCustomerVoiceCompany = companySelect.dataset.companyVoiceSelect;
      renderCustomerCompetitorChart(customerVoiceItemsForHorizon(filters.horizon.value, { ignoreCompetitor: true }));
      return;
    }
    const companyTrigger = event.target.closest("[data-company-voice-sources]");
    if (companyTrigger) {
      openCompanyVoiceEvidence(companyTrigger.dataset.companyVoiceSources);
      return;
    }
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
  const activeTab = tabName === "positioning" ? "summary" : tabName;
  state.activeCustomerVoiceTab = activeTab;
  document.querySelectorAll("[data-customer-voice-tab]").forEach((button) => {
    const active = button.dataset.customerVoiceTab === activeTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll("[data-customer-voice-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.customerVoicePanel !== activeTab;
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

function headToHeadBuildMatchModel() {
  if (!headToHeadProductMatchModel) return { watersProducts: [], competitorProducts: [], matches: [] };
  return headToHeadProductMatchModel.build({
    watersSystems: state.productComparisons?.watersSystems || [],
    thirdComparators: state.productComparisons?.thirdComparators || [],
    launchComparisons: state.productComparisons?.launchComparisons || [],
    launches: state.productData?.launches || [],
    historicalProducts: state.historicalProductCatalog?.products || [],
  });
}

function headToHeadProductMatchesRecord(record, product) {
  if (!record || !product) return false;
  const fallbackNormalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const normalize = headToHeadProductMatchModel?.normalize || fallbackNormalize;
  const text = normalize([record.product, record.platform, record.title, record.theme, record.summary, record.customerLanguageSignal].join(" "));
  const productText = normalize(product.product);
  if (text.includes(productText) || (normalize(record.product).length >= 6 && productText.includes(normalize(record.product)))) return true;
  const ignored = new Set(["system", "series", "platform", "stack", "with", "plus", "hplc", "uhplc", "uplc", "lc", "ms"]);
  const tokens = productText.split(" ").filter((token) => token.length >= 4 && !ignored.has(token));
  return tokens.length > 0 && tokens.slice(0, 2).every((token) => text.includes(token));
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

function recommendationSourceQualityAssessment(rec) {
  const authorityPoints = {
    government_or_regulatory: 3,
    peer_reviewed_article: 3,
    official_press_release: 3,
    official_product_page: 3,
    independent_trade_press: 2,
    analyst_report: 2,
    community_or_aggregator: 1,
  };
  const directnessPoints = { direct: 3, supporting: 2, contextual: 1 };
  const seenUrls = new Set();
  const sources = (Array.isArray(rec.evidenceBasis?.links) ? rec.evidenceBasis.links : []).filter((source) => {
    if (!isHttpUrl(source?.url) || seenUrls.has(source.url)) return false;
    seenUrls.add(source.url);
    return true;
  });
  const roundedAverage = (values) => values.length
    ? Math.floor((values.reduce((total, value) => total + value, 0) / values.length) + 0.5)
    : 0;
  const authority = roundedAverage(sources.map((source) => authorityPoints[source.sourceType] || 0));
  const directness = roundedAverage(sources.map((source) => directnessPoints[source.claimSupport] || 0));
  const families = new Set(sources.map((source) => source.independenceGroup).filter(Boolean));
  let corroboration = families.size >= 2 ? 1 : 0;
  if (corroboration && sources.some((source) => source.sourceControl === "independent")) corroboration = 2;
  const statuses = new Set(sources.map((source) => source.evidenceStatus || ""));
  const evidenceStatus = statuses.size === 1 && statuses.has("verified")
    ? 2
    : statuses.size > 0 && [...statuses].every((status) => ["verified", "partial"].includes(status))
      ? 1
      : 0;
  const dimensions = {
    authority: { score: authority, max: 3 },
    directness: { score: directness, max: 3 },
    corroboration: { score: corroboration, max: 2 },
    evidenceStatus: { score: evidenceStatus, max: 2 },
  };
  return {
    rubricVersion: 1,
    score: Object.values(dimensions).reduce((total, dimension) => total + dimension.score, 0),
    sourceCount: sources.length,
    independentFamilies: families.size,
    dimensions,
  };
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
    return categoryMatch && horizonMatch && geoMatch && segmentMatch && technologyMatch && competitorMatch;
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
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function currentConferenceSources() {
  const events = state.conferencePrep?.events || [];
  const asOfValue = state.conferencePrep?.asOfDate || state.data?.asOfDate || new Date().toISOString().slice(0, 10);
  const cutoffDate = conferenceDatePolicy.effectiveCurrentDate(asOfValue);
  return events
    .filter((event) => conferenceDatePolicy.isCurrentOrUpcoming(event, cutoffDate))
    .filter((event) => filters.segment.value === "All" || event.marketSegments.includes(filters.segment.value))
    .filter((event) => filters.technology.value === "All" || event.technologyFocus.some((technology) => technologyMatchesFilter(technology, filters.technology.value, event.eventName)))
    .filter((event) => filters.competitor.value === "All" || event.competitorWatch.some((competitor) => competitor.name === filters.competitor.value))
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
  const sourceCatalogQuality = sourceQualitySummary();
  const canonicalScore = rec?.canonicalDecision?.score;
  const canonicalInputs = canonicalScore?.inputs || null;
  const sourceQualityAssessment = canonicalScore?.sourceQualityAssessment || recommendationSourceQualityAssessment(rec);
  const evidenceQualityFreshness = Number(sourceQualityAssessment.score || 0);
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
  if (sourceCatalogQuality.issues > 0) evidenceLimitations.push("one or more sources need review");
  const rankingScore = Number.isFinite(Number(canonicalScore?.score))
    ? Number(canonicalScore.score)
    : Math.max(0, Math.min(100, trendAcceleration + competitorPressure + customerPull + decisionRelevance + evidenceQualityFreshness + strategicUrgency));
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
  const displayedSourceQuality = canonicalInputs ? Number(canonicalInputs.sourceQuality || 0) : evidenceQualityFreshness;
  const evidencePriority = competitiveMethodology.evidencePriority({
    applicationTrend: activityLevelFromTwenty(trendAcceleration),
    competitorActivity: activityLevelFromTwenty(competitorPressure),
    customerEvidence: activityLevelFromTwenty(customerPull),
    sourceQuality: displayedSourceQuality >= 8 ? "High" : displayedSourceQuality >= 5 ? "Medium" : "Low",
  });
  const breakdown = {
    trendAcceleration: canonicalInputs ? Number(canonicalInputs.applicationTrend || 0) : trendAcceleration,
    competitorPressure: canonicalInputs ? Number(canonicalInputs.competitorActivity || 0) : competitorPressure,
    customerPull: canonicalInputs ? Number(canonicalInputs.customerEvidence || 0) : customerPull,
    decisionRelevance: canonicalInputs ? Number(canonicalInputs.decisionRelevance || 0) : decisionRelevance,
    evidenceQualityFreshness: displayedSourceQuality,
    strategicUrgency: canonicalInputs ? Number(canonicalInputs.recency || 0) : strategicUrgency,
    sourceConfidence: displayedSourceQuality,
    sourceQualityAssessment,
    customerEvidence: customerPull,
    publicSourceCount,
    sourceFamilies,
    independentSignals,
    latestEvidenceDate,
    recencyDays,
    total: null,
    rankingScore,
    scoreType: canonicalScore?.scoreType || "evidence_priority",
    scoreFormulaVersion: canonicalScore?.formulaVersion || null,
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
        equation: `${sourceQualityAssessment.dimensions.authority.score} + ${sourceQualityAssessment.dimensions.directness.score} + ${sourceQualityAssessment.dimensions.corroboration.score} + ${sourceQualityAssessment.dimensions.evidenceStatus.score} = ${displayedSourceQuality}`,
        inputs: [
          `Authority contributes ${sourceQualityAssessment.dimensions.authority.score}/3.`,
          `Direct claim support contributes ${sourceQualityAssessment.dimensions.directness.score}/3.`,
          `Independent corroboration contributes ${sourceQualityAssessment.dimensions.corroboration.score}/2.`,
          `Evidence status contributes ${sourceQualityAssessment.dimensions.evidenceStatus.score}/2.`,
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
  const drivers = [
    { key: "trendAcceleration", label: "Application trend", value: activityLevelFromTwenty(breakdown.trendAcceleration) },
    { key: "competitorPressure", label: "Competitor activity", value: activityLevelFromTwenty(breakdown.competitorPressure) },
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
          <div class="score-driver-card score-driver-card--${escapeHtml(driver.key)}"${driver.detail ? ` title="${escapeHtml(driver.detail)}" aria-label="${escapeHtml(`${driver.label} ${driver.value}. ${driver.detail}`)}"` : ""}>
            <i class="score-driver-marker" aria-hidden="true"></i>
            <span class="score-driver-label">${escapeHtml(driver.label)}${driver.detail ? `<span class="score-driver-help" aria-hidden="true">ⓘ</span>` : ""}</span>
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
  return `${breakdown.confidenceState.state}. Application trend activity is ${activityLevelFromTwenty(breakdown.trendAcceleration)}, competitor activity is ${activityLevelFromTwenty(breakdown.competitorPressure)}, and source quality is ${breakdown.evidenceQualityFreshness}/10. Linked public sources: ${breakdown.publicSourceCount}; newest evidence: ${breakdown.latestEvidenceDate || "not dated"}.`;
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
      detail: `${evidenceCountSummary(breakdown)} in ${horizonLabel()}.`,
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
  const deliverable = recommendation.decisionDeliverable || recommendation.nextAction || "A go/no-go recommendation";
  const gate = recommendation.decisionGate || validationGateForRecommendation(recommendation, breakdown);
  return `
    <article class="executive-decision-card">
      <span>Recommended decision</span>
      <strong>${escapeHtml(decisionOptionsForRecommendation(recommendation))}</strong>
      <p class="executive-decision-rationale">${escapeHtml(rationale)}</p>
      <dl class="executive-decision-facts">
        <div><dt>Accountable owners</dt><dd>${escapeHtml(owners)}</dd></div>
        <div><dt>Next PM Considerations</dt><dd>${escapeHtml(deliverable)}</dd></div>
      </dl>
      <p class="executive-decision-gate"><b>Investment gate</b><span>${escapeHtml(gate)}</span></p>
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
  const ownerMatch = nextAction.match(/\b[A-Z][a-z]+ \d{1,2}, \d{4},\s+(.+?)\s+must\b/i);
  return {
    owners: recommendation.decisionOwners || ownerMatch?.[1] || "Product Management owner",
    deliverable: recommendation.action || recommendation.decisionDeliverable || nextAction,
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
        `Highest current evidence priority: ${recommendations[0].title} (${recommendations[0].priorityBreakdown.evidencePriority}).`,
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
        <span>${escapeHtml(breakdown.confidenceState.state)}</span>
        <span>${evidenceLinks.length} exact source${evidenceLinks.length === 1 ? "" : "s"}</span>
      </div>
      <div class="leadership-decision-why">
        <span>Why leadership needs to address this now</span>
        <p>${escapeHtml(recommendation.whyNow || recommendation.why)}</p>
      </div>
      <p class="leadership-decision-scope"><b>Waters capability affected</b><span>${escapeHtml(recommendation.affectedCapability || recommendation.technology)}</span></p>
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
  const sourceArrow = highlight.pageUrl ? "→" : "↗";
  const sourceLink = isHttpUrl(highlight.sourceUrl)
    ? `<a href="${escapeHtml(highlight.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(highlight.sourceLabel || "Open source")} ${sourceArrow}</a>`
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

  byId("strategicConfidence").textContent = `Evidence priority: ${breakdown.evidencePriority}`;
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
    sourceName: item.sourceName || item.competitor,
  }));
  const strategicItems = matchedStrategic.map((item) => ({
    family: "Competitor moves",
    title: `${item.competitor}: ${item.title}`,
    detail: `${item.signalType} · ${formatDate(item.date)}`,
    url: item.sourceUrl,
    sourceName: item.sourceName || item.competitor,
  }));
  const filingItems = matchedFilings.map((item) => ({
    family: "SEC filings",
    title: `${item.competitor}: ${item.headline}`,
    detail: `${item.sourceName} · ${formatDate(item.date)}`,
    url: item.sourceUrl,
    sourceName: item.sourceName,
  }));
  const conferenceItems = matchedConferences.map((item) => ({
    family: "Conferences",
    title: item.eventName,
    detail: item.dateRange,
    url: item.website,
    sourceName: item.organizer || item.eventName,
  }));
  const customerItems = matchedCustomers.flatMap((item) => {
    const links = customerVoiceSourceLinks(item);
    return (links.length ? links : [{ label: item.sourceName, url: item.sourceUrl }]).map((link) => ({
      family: "Public customer voice",
      title: `${item.company}: ${item.theme}`,
      detail: `${item.product} · ${item.sentiment} · ${item.category}`,
      url: link.url,
      sourceName: item.sourceName || link.label,
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
      sourceName: item.sourceName,
    }));
  const trendItems = matchedTrends.map((item) => ({
    family: "Scientific publications",
    title: item.theme,
    detail: `${Number(item.counts[filters.horizon.value] || 0).toLocaleString()} publication records · ${horizonLabel()}`,
    url: pubMedSearchUrl(item.query),
    sourceName: item.sourceName || "PubMed",
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
      narratives: {
        "30d": {
          synthesis: "The newest workflow records connect instrument choice to software, automation, setup, troubleshooting, training, and data review. They should be read for a newly visible friction point, not as proof that every buyer has changed priorities.",
          implication: "Waters should check whether a recent competitor workflow or customer complaint changes the next-gen LC comparison beyond hardware specifications.",
          action: "Inspect the newest workflow evidence and compare the affected setup, operation, troubleshooting, or data-review step with the closest Waters configuration. Classify the difference as new, recurring, or already addressed.",
        },
        "60d": {
          synthesis: "Across two months, repeated references to connected software, automation, training, and data handling would make workflow experience an emerging buying criterion rather than an isolated usability comment.",
          implication: "Waters should determine which workflow issue is repeating across independent sources and whether it creates a measurable usability or integration disadvantage.",
          action: "Compare workflow evidence from the first and second 30-day periods. Select the repeated friction point and define the user task, current Waters experience, and validation evidence needed.",
        },
        "90d": {
          synthesis: "This quarter's evidence shows whether competitors are consistently packaging instruments with software, automation, services, and application workflows while customers judge the complete operating experience.",
          implication: "Waters should evaluate next-gen LC as a quarterly end-to-end workflow benchmark, with explicit attention to the tasks that influence adoption and daily productivity.",
          action: "Build a quarterly workflow comparison covering method setup, daily operation, troubleshooting, training, and data review. Convert the largest verified friction point into one roadmap validation question.",
        },
        "1y": {
          synthesis: "Over the year, competitors are connecting instruments to software, automation, services, and application workflows. Public customer feedback also places setup, troubleshooting, training, and data review inside the product experience.",
          implication: "Waters should evaluate next-gen LC as an end-to-end workflow, not as a hardware specification exercise.",
          action: "Compare method setup, daily operation, troubleshooting, and data review across the leading competitor workflow and the closest Waters configuration. Select one friction point for a defined roadmap requirement.",
        },
        "3y": {
          synthesis: "Across three years, instrument differentiation increasingly extends into operating software, automation, service interactions, training, and data review, making the workflow experience part of the durable product proposition.",
          implication: "Waters should identify which workflow expectations persisted across product generations and treat those durable expectations as platform requirements for next-gen LC.",
          action: "Trace competitor workflow claims and customer friction across product generations. Separate durable operating expectations from short-lived features, then assign the strongest persistent gap to the platform roadmap.",
        },
      },
    },
    {
      id: "platform-modernization",
      title: "Routine LC modernization is becoming a serviceability and method-continuity contest",
      pattern: /nexera|infinitylab|vanquish|ultimate|exion|acquity|alliance|arc hplc|\bhplc\b|\buhplc\b|liquid chromatograph|uptime|reliability|maintenance|service|method transfer|pressure|leak|autosampler|carryover|lifecycle/,
      narratives: {
        "30d": {
          synthesis: "The newest platform records put uptime, maintenance, method transfer, and service burden beside performance specifications. The immediate signal is whether one recent launch or user report changes the practical replacement comparison.",
          implication: "Waters should verify whether the latest LC evidence exposes a new continuity or serviceability weakness in the Arc, Alliance, or next-gen upgrade path.",
          action: "Review the newest platform and service records, identify the affected replacement step, and compare it with Waters on method-transfer effort, diagnostic clarity, maintenance work, and expected downtime.",
        },
        "60d": {
          synthesis: "Across two months, recurring platform and customer evidence can reveal whether routine LC replacement is becoming a contest over method continuity, diagnostics, maintenance, and service response.",
          implication: "Waters should validate any serviceability or continuity problem that repeats in separate sources before changing the modernization roadmap.",
          action: "Compare platform evidence from both 30-day periods and isolate the repeated replacement concern. Quantify its effect on transfer time, operator effort, service steps, or downtime.",
        },
        "90d": {
          synthesis: "This quarter's LC activity tests whether new platforms consistently compete on upgrade simplicity and operational continuity, not only speed, pressure, or detector specifications.",
          implication: "Waters should use the quarterly pattern to decide whether installed-base protection requires a stronger method-transfer, diagnostics, or maintenance proposition.",
          action: "Create a quarterly replacement-path scorecard for the leading new competitor platform versus Arc, Alliance, and planned next-gen LC, then validate the largest continuity or serviceability gap.",
        },
        "1y": {
          synthesis: "Over the year, new LC platforms are arriving alongside public concerns about uptime, maintenance, method transfer, and service burden. The replacement decision is therefore broader than speed or pressure specifications.",
          implication: "Waters can defend its installed base only if the upgrade path protects validated methods while making diagnostics and maintenance visibly easier.",
          action: "Create one replacement-path scorecard for the leading competitor LC platform versus Arc, Alliance, and the planned next-gen LC: method-transfer time, diagnostics, planned maintenance, service steps, and expected downtime.",
        },
        "3y": {
          synthesis: "Across three years, LC modernization pressure is sustained where successive platforms promise easier transfer, higher uptime, clearer diagnostics, and lower maintenance or service burden.",
          implication: "Waters should treat method continuity and serviceability as structural platform requirements when those expectations persist across multiple competitor generations.",
          action: "Map three years of LC platform generations against Arc and Alliance replacement needs. Identify the continuity or serviceability expectation that persisted, and make it a measurable next-gen acceptance criterion.",
        },
      },
    },
    {
      id: "biopharma-applications",
      title: "Biopharma competition is concentrating around complete LC-MS application workflows",
      pattern: /biopharma|bioproduction|oligonucleotide|nucleic acid|\brna\b|\blnp\b|lipid nanoparticle|protein|peptide|mam workflow|multi-attribute|proteomics|metabolomics|bioanalysis|biologics/,
      narratives: {
        "30d": {
          synthesis: "The newest biopharma records should be examined for a specific workflow move in oligo, LNP, MAM, protein characterization, or bioanalysis rather than read as a broad shift in platform demand.",
          implication: "Waters should determine whether the latest application evidence introduces a method, kit, informatics, or performance proof that changes one priority LC-MS workflow comparison.",
          action: "Open the newest biopharma records, identify the workflow and buyer task they address, and compare the claimed method, informatics, consumables, and proof package with Waters' current offer.",
        },
        "60d": {
          synthesis: "Across two months, repeated scientific, conference, competitor, or corporate signals can show which biopharma workflow is gaining coordinated investment beyond a single application announcement.",
          implication: "Waters should validate the biopharma workflow that repeats across independent evidence types and identify whether the emerging gap is capability, packaging, or proof.",
          action: "Compare the two 30-day periods by oligo, LNP, MAM, protein characterization, and bioanalysis. Select the repeating workflow and document the competitor claim and missing Waters proof point.",
        },
        "90d": {
          synthesis: "This quarter's evidence shows whether biopharma competition is cohering around complete application workflows that combine instruments, methods, consumables, informatics, and demonstrated performance.",
          implication: "Waters should use the quarterly pattern to choose one biopharma workflow where application completeness could influence the next roadmap or evidence-package decision.",
          action: "Build a quarterly workflow map for the strongest biopharma theme, compare Waters with the two leading competitor offers, and define the capability or proof needed to close the most consequential gap.",
        },
        "1y": {
          synthesis: "Over the year, scientific publications, conference agendas, competitor activity, and corporate disclosures are converging on biopharma workflows rather than stand-alone instruments.",
          implication: "Application kits, methods, informatics, and proof of workflow performance may influence buying decisions as much as the LC or MS platform itself.",
          action: "Choose one priority workflow from oligo, LNP, MAM, or protein characterization. Map the Waters workflow against the two strongest competitor claims and identify one missing proof point or capability for the next roadmap review.",
        },
        "3y": {
          synthesis: "Across three years, durable biopharma competition appears where vendors repeatedly invest in complete workflows for oligos, LNPs, MAM, protein characterization, or bioanalysis rather than isolated instrument claims.",
          implication: "Waters should distinguish persistent application-platform requirements from temporary campaign themes and invest where workflow completeness repeatedly affects competitive position.",
          action: "Trace priority biopharma workflows across product generations, publications, and conference cycles. Select the persistent workflow gap and define the long-term method, informatics, consumables, and proof package required.",
        },
      },
    },
    {
      id: "regulated-testing",
      title: "Regulated testing demand is shifting toward complete, defensible methods",
      pattern: /pfas|environmental|contaminant|regulated|compliance|audit|quality control|\bqc\b|food safety|clinical|quantitation|triple quadrupole/,
      narratives: {
        "30d": {
          synthesis: "The newest regulated-testing evidence should reveal whether a recent PFAS, environmental, food-safety, clinical, or QC method raises the bar for readiness, traceability, or repeatable quantitation.",
          implication: "Waters should verify whether the latest method claim creates a new proof gap in compliance, reproducibility, sample preparation, or routine laboratory execution.",
          action: "Inspect the newest regulated-method records and compare their matrix, preparation, quantitation, traceability, and validation claims with the closest Waters method package. Record the newly exposed gap, if any.",
        },
        "60d": {
          synthesis: "Across two months, repeated method publications and application activity can show whether regulated laboratories are converging on more complete, defensible execution rather than isolated sensitivity claims.",
          implication: "Waters should validate the readiness or compliance requirement that repeats across separate regulated-testing sources before reprioritizing method development.",
          action: "Compare regulated-testing evidence from both 30-day periods. Identify the recurring method requirement and determine whether Waters needs stronger validation data, compliance documentation, or an application package.",
        },
        "90d": {
          synthesis: "This quarter's evidence tests whether regulated markets consistently reward validated methods, traceable data, robust sample handling, and repeatable quantitation as a complete laboratory solution.",
          implication: "Waters should use the quarterly pattern to identify the regulated workflow where method readiness and defensibility can create the clearest differentiation.",
          action: "Create a quarterly matrix of the strongest public regulated-method claims. Select the most consequential readiness or proof gap and assign a Waters method package, compliance asset, or application note to close it.",
        },
        "1y": {
          synthesis: "Over the year, publication growth and competitor application activity point to demand for validated methods, traceable data, and repeatable quantitation rather than sensitivity claims alone.",
          implication: "Waters' differentiation should connect LC-MS/MS performance to method readiness, compliance, and reproducible laboratory execution.",
          action: "Review the five strongest public method claims in the selected market. Identify the one Waters method package, compliance proof point, or application note that would close the clearest evidence gap.",
        },
        "3y": {
          synthesis: "Across three years, regulated-testing demand is structural where methods repeatedly combine quantitation performance with validation, traceability, compliance, and reproducible routine execution.",
          implication: "Waters should treat complete method readiness as a durable differentiation requirement in regulated markets where those proof expectations persist across standards and instrument cycles.",
          action: "Map recurring regulated-method requirements across three years and identify the proof elements that remain constant. Use them to define the long-term Waters method-package and compliance roadmap.",
        },
      },
    },
    {
      id: "high-resolution-omics",
      title: "High-resolution omics remains a large and visible source of LC-MS demand",
      pattern: /high-resolution|hrms|qtof|tof|orbitrap|proteomics|metabolomics|single-cell|omics|mass spectrom/,
      narratives: {
        "30d": {
          synthesis: "The newest high-resolution records should be read for a specific change in proteomics, metabolomics, single-cell, or translational workflows rather than as confirmation of broad omics demand.",
          implication: "Waters should test whether a recent HRMS claim, application result, or workflow complaint changes the competitive position of one priority omics use case.",
          action: "Review the newest omics evidence, identify the affected discovery task, and compare competitor performance, informatics, application proof, and customer friction with the relevant Waters workflow.",
        },
        "60d": {
          synthesis: "Across two months, repeated high-resolution application, conference, and customer signals can identify which omics workflow is developing momentum beyond publication volume alone.",
          implication: "Waters should validate the proteomics, metabolomics, single-cell, or translational use case that repeats across independent sources and clarify the actual competitive gap.",
          action: "Compare omics evidence across the two 30-day periods. Select the recurring workflow, then document whether Waters needs stronger performance proof, application depth, informatics, or usability evidence.",
        },
        "90d": {
          synthesis: "This quarter's evidence shows where high-resolution LC-MS visibility translates into a repeated workflow opportunity across discovery and translational research.",
          implication: "Waters should use the quarterly pattern to choose where to defend broad discovery capability and where a narrower application or informatics advantage can differentiate.",
          action: "Rank the quarter's omics workflows by repeated evidence and strategic value. Compare the top two with competitor claims and define the proof package required for each Waters position.",
        },
        "1y": {
          synthesis: "Over the year, publication volume, conference themes, and competitor product narratives continue to reinforce high-resolution LC-MS workflows across discovery and translational research.",
          implication: "Waters needs a clear choice of where to defend broad discovery workflows and where to differentiate through application depth or informatics.",
          action: "Select the two highest-value omics workflows for Waters. Compare competitor claims, public application proof, and customer workflow friction, then define the proof package needed for each.",
        },
        "3y": {
          synthesis: "Across three years, high-resolution demand is durable where proteomics, metabolomics, single-cell, and translational workflows persist through multiple platform and informatics cycles.",
          implication: "Waters should base long-term omics investment on workflows with sustained scientific and competitive relevance, then differentiate through application depth, informatics, or execution quality.",
          action: "Trace the highest-value omics workflows across three years of scientific, competitor, and customer evidence. Select the durable positions and define the platform, application, and informatics proof each requires.",
        },
      },
    },
  ];
}

function horizonTrendNarrative(candidate) {
  const narratives = candidate.narratives || {};
  const narrative = narratives[filters.horizon.value] || narratives["1y"] || {};
  return {
    title: horizonTrendTitle(candidate.title),
    synthesis: narrative.synthesis || "",
    implication: narrative.implication || "",
    action: narrative.action || "",
  };
}

function renderOverallTrendAnalysis(signals) {
  const candidates = overallTrendCandidates()
    .map((candidate) => {
      const evidence = overallTrendEvidence(signals, candidate);
      return { ...candidate, evidence, narrative: horizonTrendNarrative(candidate) };
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
  const decisionQueue = byId("decisionQueue");
  decisionQueue.dataset.cardCount = String(Math.max(1, decisions.length));
  byId("decisionQueueCount").textContent = `${decisions.length} decision${decisions.length === 1 ? "" : "s"}`;
  decisionQueue.innerHTML = decisions.length
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
                <span class="confidence-pill ${tone.className}">${escapeHtml(breakdown.confidenceState.state)}</span>
              </div>
              <h4>${escapeHtml(rec.title)}</h4>
              <div class="decision-why">
                <strong>Details</strong>
                ${decisionUrgencyMarkup(rec, index)}
              </div>
              <dl class="decision-queue-facts">
                <div><dt>Next PM Considerations</dt><dd>${escapeHtml(facts.deliverable)}</dd></div>
              </dl>
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
      id: launch.id,
      type: "Launch",
      title: launch.product,
      date: launch.date,
      sourceName: launch.sourceName,
      url: timelineUrlForLaunch(launch),
      sourceLinkLabel: "Open press release ↗",
      detail: launch.pmImplication || launch.roadmapQuestion || launch.signalType,
      observedDetail: launch.summary || launch.signalType || "",
      customerName: launch.customerName || launch.customer || launch.accountName || "",
    })),
    ...strategic.map((signal) => ({
      id: signal.id,
      type: "Strategic move",
      title: signal.title,
      date: signal.date,
      sourceName: signal.sourceName,
      url: signal.sourceUrl,
      detail: signal.summary || signal.pmImplication || signal.signalType,
      observedDetail: signal.summary || signal.signalType || "",
      customerName: signal.customerName || signal.customer || signal.accountName || "",
    })),
    ...earnings.map((signal) => ({
      id: signal.id,
      type: "Earnings result",
      title: signal.title,
      date: signal.date,
      sourceName: signal.sourceName,
      url: signal.sourceUrl,
      detail: signal.summary || signal.pmImplication || signal.signalType,
      observedDetail: signal.summary || signal.signalType || "",
      customerName: signal.customerName || signal.customer || signal.accountName || "",
    })),
    ...filings.map((insight) => ({
      id: insight.id,
      type: "Filing insight",
      title: insight.headline,
      date: insight.date,
      sourceName: insight.sourceName,
      url: insight.sourceUrl,
      detail: insight.evidence || insight.whyItMatters || insight.pmImplication,
      observedDetail: insight.evidence || "",
      customerName: insight.customerName || insight.customer || insight.accountName || "",
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

function intentActivityCardsPerView(width, total) {
  const responsiveCount = width >= 1080 ? 4 : width >= 760 ? 3 : width >= 500 ? 2 : 1;
  return Math.max(1, Math.min(total, responsiveCount));
}

function updateIntentActivityCarousel({ reset = false, behavior = "auto" } = {}) {
  const carousel = byId("competitorIntent")?.querySelector("[data-intent-activity-carousel]");
  if (!carousel) return;
  const viewport = carousel.querySelector("[data-intent-carousel-viewport]");
  const track = carousel.querySelector("[data-intent-carousel-track]");
  const cards = [...carousel.querySelectorAll(".intent-activity-theme")];
  if (!viewport || !track || !cards.length) return;

  const gap = Number.parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 8;
  const perView = intentActivityCardsPerView(viewport.clientWidth, cards.length);
  const cardWidth = Math.max(0, (viewport.clientWidth - gap * (perView - 1)) / perView);
  carousel.style.setProperty("--intent-card-width", `${cardWidth}px`);
  carousel.dataset.perView = String(perView);

  const maxIndex = Math.max(0, cards.length - perView);
  const requestedIndex = reset ? 0 : Number(carousel.dataset.index || 0);
  const index = Math.min(maxIndex, Math.max(0, requestedIndex));
  carousel.dataset.index = String(index);
  viewport.scrollTo({ left: index * (cardWidth + gap), behavior });

  const status = carousel.querySelector("[data-intent-carousel-status]");
  if (status) status.textContent = `${index + 1}–${Math.min(cards.length, index + perView)} of ${cards.length}`;
  const previous = carousel.querySelector('[data-intent-carousel-action="previous"]');
  const next = carousel.querySelector('[data-intent-carousel-action="next"]');
  if (previous) previous.disabled = index === 0;
  if (next) next.disabled = index === maxIndex;
  const controls = carousel.querySelector(".intent-carousel-controls");
  if (controls) controls.hidden = cards.length <= perView;
}

function moveIntentActivityCarousel(action) {
  const carousel = byId("competitorIntent")?.querySelector("[data-intent-activity-carousel]");
  if (!carousel) return;
  const perView = Number(carousel.dataset.perView || 1);
  const currentIndex = Number(carousel.dataset.index || 0);
  carousel.dataset.index = String(action === "previous" ? currentIndex - perView : currentIndex + perView);
  updateIntentActivityCarousel({ behavior: "smooth" });
}

function initializeIntentActivityCarousel() {
  intentActivityCarouselResizeObserver?.disconnect();
  intentActivityCarouselResizeObserver = null;
  const carousel = byId("competitorIntent")?.querySelector("[data-intent-activity-carousel]");
  const viewport = carousel?.querySelector("[data-intent-carousel-viewport]");
  if (!carousel || !viewport) return;
  carousel.dataset.index = "0";
  updateIntentActivityCarousel({ reset: true });
  if (typeof ResizeObserver === "function") {
    intentActivityCarouselResizeObserver = new ResizeObserver(() => updateIntentActivityCarousel());
    intentActivityCarouselResizeObserver.observe(viewport);
  }
}

function competitorActivityMarkup(profile) {
  const themes = competitorActivityThemes(profile);
  return `
    <section class="intent-activity-summary" data-intent-activity-carousel aria-label="What ${escapeHtml(profile.competitor)} did in ${escapeHtml(intentPeriodTitle())}">
      <div class="intent-activity-heading">
        <h5>What ${escapeHtml(profile.competitor)} Did in ${escapeHtml(intentPeriodTitle())}</h5>
        ${themes.length > 1 ? `
          <div class="intent-carousel-controls" aria-label="Activity carousel controls">
            <span class="intent-carousel-status" data-intent-carousel-status aria-live="polite"></span>
            <button type="button" data-intent-carousel-action="previous" aria-label="Show previous activity cards">‹</button>
            <button type="button" data-intent-carousel-action="next" aria-label="Show next activity cards">›</button>
          </div>
        ` : ""}
      </div>
      <div class="intent-activity-viewport" data-intent-carousel-viewport tabindex="0" aria-label="Competitor activity cards">
        <div class="intent-activity-theme-grid" data-intent-carousel-track>
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
  requestAnimationFrame(initializeIntentActivityCarousel);
}

function roadmapImpactEvidenceRecords(capability, signals) {
  const terms = watersCapabilityDefinitions.find((definition) => definition.label === capability)?.terms || [capability.toLowerCase()];
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
  const capabilities = watersCapabilityDefinitions.map((definition) => definition.label);
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
      if (link?.status !== "exact_record") return false;
      const verifiedWording = (link.sourceKeywords || []).join(" ").toLowerCase();
      return identityTerms.some((term) => verifiedWording.includes(term));
    });
  return groupCustomerVoiceEvidenceMappings(evidenceMappings);
}

function companyVoiceStatements(items, field, fallback, limit = 2) {
  const statements = [...new Set(items
    .map((item) => compactText(item[field], 132))
    .filter(Boolean))]
    .slice(0, limit);
  if (!statements.length) return `<p class="company-voice-empty">${escapeHtml(fallback)}</p>`;
  return `<ul>${statements.map((statement) => `<li>${escapeHtml(statement)}</li>`).join("")}</ul>`;
}

function openCompanyVoiceEvidence(company) {
  const companyItems = currentCustomerVoiceItems().filter((item) => item.company === company);
  const evidenceGroups = companyVoiceEvidenceGroups(company, companyItems);
  byId("decisionEvidenceTitle").textContent = `${company} customer voice sources`;
  byId("decisionEvidenceSummary").textContent = `${evidenceGroups.length} unique exact source${evidenceGroups.length === 1 ? "" : "s"} behind the customer themes and PM implications shown for ${company}.`;
  byId("decisionEvidenceList").innerHTML = evidenceGroups.length
    ? evidenceGroups.map((group) => customerVoiceEvidenceCardMarkup(group)).join("")
    : `<div class="empty">No vendor-specific exact sources match the active filters.</div>`;
  byId("decisionEvidenceModal").hidden = false;
  document.body.classList.add("modal-open");
  byId("hideDecisionEvidence").focus();
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
    },
  },
  {
    key: "troubleshooting-recovery",
    label: "Troubleshooting & Recovery Time",
    pmQuestion: "How quickly can users isolate the cause, recover, and avoid service escalation?",
    terms: ["troubleshoot", "diagnostic", "lab advisor", "root cause", "recovery", "pressure", "carryover", "autosampler", "serviceability", "maintenance"],
    pain: "Users may see a downstream error without enough guidance to isolate the true fluidic, carryover, pressure, or autosampler cause.",
    validationStep: "Run seeded failure scenarios and compare time-to-root-cause, recovery steps, false leads, and service escalation across Waters and competitor workflows.",
    roadmapDecision: {
      number: 1,
      title: "End-to-End Workflow Requirements",
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
    },
  },
  {
    key: "workflow-setup",
    label: "Workflow Setup",
    pmQuestion: "How much training, configuration, and expert help is needed to start routine work?",
    terms: ["workflow setup", "setup", "training", "onboarding", "template", "software usability", "ecosystem integration", "instrument control", "cross-vendor integration", "contact closure", "ease of use", "user friendly", "user-friendly", "easy to use"],
    pain: "Routine regulated work may still depend on expert configuration, manual templates, and repeated onboarding.",
    validationStep: "Have new users configure and execute a PFAS quantitation workflow; measure setup time, interventions, template reuse, errors, and time to an accepted result.",
    roadmapDecision: {
      number: 3,
      title: "PFAS-Ready Regulated Quantitation Workflow",
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

function customerVoiceLinkMatchesTheme(link, theme) {
  if (link?.status !== "exact_record") return false;
  const verifiedSourceWording = (link.sourceKeywords || []).join(" ").toLowerCase();
  return theme.terms.some((term) => verifiedSourceWording.includes(term));
}

function customerVoiceThemeEvidenceGroups(items, theme, company = "") {
  const identityTerms = company ? (customerVoiceIdentityTerms[company] || [company.toLowerCase()]) : [];
  const evidenceMappings = items
    .filter((item) => !company || item.company === company)
    .flatMap((item) => customerVoiceSourceLinks(item)
      .filter((link) => customerVoiceLinkMatchesTheme(link, theme))
      .filter((link) => {
        if (!company) return true;
        const verifiedSourceWording = (link.sourceKeywords || []).join(" ").toLowerCase();
        return identityTerms.some((term) => verifiedSourceWording.includes(term));
      })
      .map((link) => ({ item, link })));
  return groupCustomerVoiceEvidenceMappings(evidenceMappings);
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
  if (sourceCount >= 3) return { className: "pattern" };
  if (sourceCount === 2) return { className: "emerging" };
  if (sourceCount === 1) return { className: "anecdote" };
  return { className: "none" };
}

function customerVoiceEvidenceStrengthBadge(sourceCount) {
  const count = Math.max(0, Number(sourceCount) || 0);
  const className = count >= 3 ? "pattern" : count === 2 ? "directional" : count === 1 ? "anecdotal" : "none";
  return `
    <span class="customer-voice-strength-badge ${className}">
      <strong>${count} independent source${count === 1 ? "" : "s"}</strong>
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

function customerRoadmapInputsMarkup(items) {
  const rows = customerVoicePurchaseThemes.map((theme) => {
    const evidenceGroups = customerVoiceThemeEvidenceGroups(items, theme);
    const sourceCount = evidenceGroups.length;
    const recurrence = customerVoiceRecurrence(sourceCount);
    return { theme, sourceCount, recurrence };
  });
  return `
    <section class="customer-roadmap-inputs" aria-label="Roadmap Decision Inputs">
      <div class="customer-roadmap-inputs-heading">
        <strong>Roadmap Decision Inputs</strong>
        <span>Pain → validation step → decision</span>
      </div>
      <div class="customer-roadmap-input-list">
        ${rows.map((row) => {
          const recurrence = row.recurrence;
          return `
          <article class="customer-roadmap-input">
            <div class="customer-roadmap-input-theme">
              <strong>${escapeHtml(row.theme.label)}</strong>
              ${row.sourceCount > 0 ? `
                <a class="customer-theme-recurrence customer-theme-source-link ${escapeHtml(recurrence.className)}" href="#customer-voice" data-customer-theme-sources="${escapeHtml(row.theme.key)}" data-customer-theme-company="">
                  <strong>${row.sourceCount} independent source${row.sourceCount === 1 ? "" : "s"}</strong>
                  <small>View exact records</small>
                </a>
              ` : `
                <span class="customer-theme-recurrence ${escapeHtml(recurrence.className)}">
                  <strong>0 independent sources</strong>
                  <small>Validation required</small>
                </span>
              `}
            </div>
            <div class="customer-roadmap-input-copy">
              <small>Pain</small>
              <p>${escapeHtml(row.theme.pain)}</p>
            </div>
            <div class="customer-roadmap-input-copy">
              <small>Validation step</small>
              <p>${escapeHtml(row.theme.validationStep)}</p>
            </div>
            <a class="customer-roadmap-decision-link" href="#decisions-needed" data-section-nav="decisions-needed">
              <small>Decision ${row.theme.roadmapDecision.number}</small>
              <strong>${escapeHtml(row.theme.roadmapDecision.title)}</strong>
              <span>Open decision →</span>
            </a>
          </article>
        `;
        }).join("")}
      </div>
    </section>
  `;
}

const customerVoiceSummaryMinimumIndependentSources = 2;

function customerVoiceSubstantiatedCategoryCounts(items, key) {
  return customerVoiceCategorySourceCounts(items, key)
    .filter(({ sourceCount }) => sourceCount >= customerVoiceSummaryMinimumIndependentSources);
}

function openCustomerThemeEvidence(themeKey, company) {
  const theme = customerVoiceThemeDefinition(themeKey);
  if (!theme) return;
  const comparisonItems = customerVoiceItemsForHorizon(filters.horizon.value, { ignoreCompetitor: true });
  const companySelected = customerVoiceComparisonCompanies.includes(company);
  const evidenceGroups = customerVoiceThemeEvidenceGroups(
    comparisonItems,
    theme,
    companySelected ? company : "",
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
  const vendorRows = Object.keys(customerVoiceIdentityTerms)
    .map((company) => {
      const companyItems = items.filter((item) => item.company === company);
      if (!companyItems.length) return null;
      const positiveItems = companyItems.filter((item) => item.sentiment === "Positive");
      const concernItems = companyItems
        .filter((item) => item.sentiment !== "Positive")
        .sort((a, b) => Number(b.sentiment === "Negative") - Number(a.sentiment === "Negative") || b.confidence - a.confidence);
      return {
        company,
        companyItems,
        positiveItems,
        concernItems,
        evidenceGroups: companyVoiceEvidenceGroups(company, companyItems),
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(b.company === "Waters") - Number(a.company === "Waters") || b.evidenceGroups.length - a.evidenceGroups.length || a.company.localeCompare(b.company));

  const selectedRow = vendorRows.find((row) => row.company === state.activeCustomerVoiceCompany) || vendorRows[0];
  state.activeCustomerVoiceCompany = selectedRow?.company || "";

  byId("customerCompetitorChart").innerHTML = selectedRow
    ? `
      <div class="company-voice-list">
      <div class="intent-master-detail company-voice-master-detail">
        <nav class="intent-competitor-rail company-voice-company-rail" role="tablist" aria-label="Companies with customer voice evidence">
          <div class="intent-rail-heading">Companies</div>
          ${vendorRows.map((row) => {
            const selected = row.company === selectedRow.company;
            return `
              <button type="button" class="intent-competitor-option${selected ? " is-selected" : ""}" data-company-voice-select="${escapeHtml(row.company)}" role="tab" aria-selected="${selected}" aria-controls="company-voice-selected-detail">
                <span class="intent-option-copy">
                  <strong>${escapeHtml(row.company)}</strong>
                  <span>${row.positiveItems.length} strength${row.positiveItems.length === 1 ? "" : "s"} · ${row.concernItems.length} concern${row.concernItems.length === 1 ? "" : "s"}</span>
                  <small>${row.evidenceGroups.length} exact source${row.evidenceGroups.length === 1 ? "" : "s"}</small>
                </span>
                <span class="intent-option-arrow" aria-hidden="true">›</span>
              </button>
            `;
          }).join("")}
        </nav>
        <article id="company-voice-selected-detail" class="company-voice-card company-voice-selected-detail ${selectedRow.company === "Waters" ? "is-waters" : ""}" role="tabpanel" aria-label="${escapeHtml(selectedRow.company)} customer voice">
          <header class="company-voice-header">
            <strong>${escapeHtml(selectedRow.company)}</strong>
            <div class="company-voice-meta">
              <span class="company-voice-count strength">${selectedRow.positiveItems.length} strength${selectedRow.positiveItems.length === 1 ? "" : "s"}</span>
              <span class="company-voice-count concern">${selectedRow.concernItems.length} concern${selectedRow.concernItems.length === 1 ? "" : "s"}</span>
              ${selectedRow.evidenceGroups.length ? `
                <button type="button" data-company-voice-sources="${escapeHtml(selectedRow.company)}" aria-label="View ${selectedRow.evidenceGroups.length} exact customer voice sources for ${escapeHtml(selectedRow.company)}">
                  Sources <b>${selectedRow.evidenceGroups.length}</b> →
                </button>
              ` : ""}
            </div>
          </header>
          <div class="company-voice-insight-grid">
            <section class="company-voice-insight strength">
              <span>What Customers Value</span>
              ${companyVoiceStatements(selectedRow.positiveItems, "theme", "No validated positive theme in the current sources.")}
            </section>
            <section class="company-voice-insight concern">
              <span>Pain Points and Unmet Needs</span>
              ${companyVoiceStatements(selectedRow.concernItems, "customerLanguageSignal", "No validated concern theme in the current sources.")}
            </section>
            <section class="company-voice-insight opportunity">
              <span>${selectedRow.company === "Waters" ? "Waters PM Opportunity" : "Whitespace for Waters"}</span>
              ${companyVoiceStatements(selectedRow.concernItems.length ? selectedRow.concernItems : selectedRow.companyItems, "pmInterpretation", "More customer evidence is needed before identifying an opportunity.")}
            </section>
          </div>
        </article>
      </div>
      </div>
      ${customerRoadmapInputsMarkup(items)}
    `
    : `<div class="empty">No company-grouped customer voice signals match the current filters.</div>`;
}

function renderCustomerVoiceSummary(items) {
  const positives = items.filter((item) => item.sentiment === "Positive");
  const negatives = items.filter((item) => item.sentiment === "Negative");
  const mixed = items.filter((item) => item.sentiment === "Mixed");
  const concernItems = items.filter((item) => item.sentiment !== "Positive");
  const positiveCounts = customerVoiceSubstantiatedCategoryCounts(positives, "category");
  const concernCounts = customerVoiceSubstantiatedCategoryCounts(concernItems, "category");
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
  const buyingCounts = customerVoiceSubstantiatedCategoryCounts(items, "buyingPriority");
  const thirdPlaceCount = buyingCounts[Math.min(2, buyingCounts.length - 1)]?.sourceCount || 0;
  const leadingBuying = buyingCounts.filter(({ sourceCount }) => sourceCount >= thirdPlaceCount);
  const cards = [
    topPositive ? {
      label: "Observed strength",
      headline: `${topPositive.category} is the leading observed strength`,
      sourceCount: topPositive.sourceCount,
      detail: "This is the most repeated corroborated positive theme in the current exact sources.",
      tone: "positive",
      link: positives.length ? `<button type="button" class="customer-voice-evidence-link" data-customer-voice-records="positive">Review positive evidence <span aria-hidden="true">→</span></button>` : "",
    } : null,
    topConcern ? {
      label: "Observed concern",
      headline: concernHeadline,
      sourceCount: topConcern.sourceCount,
      detail: concernDetail,
      tone: "concern",
      link: negatives.length + mixed.length ? `<button type="button" class="customer-voice-evidence-link" data-customer-voice-records="concerns">Review concern evidence <span aria-hidden="true">→</span></button>` : "",
    } : null,
  ].filter(Boolean);
  const topBuying = buyingCounts[0];
  const buyingCard = buyingCounts.length
    ? `
      <article class="customer-voice-card buying-considerations-card">
        <div class="summary-insight-head"><span>Buying consideration</span>${customerVoiceEvidenceStrengthBadge(topBuying.sourceCount)}</div>
        <strong class="summary-insight-title">${escapeHtml(`${topBuying.category} is the leading buying consideration`)}</strong>
        <p>${leadingBuying.length > 1
          ? escapeHtml(`${leadingBuying.length} buying considerations share the highest recurrence in the current exact sources.`)
          : "This buying consideration appears most often in the current exact sources."}</p>
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
    : "";
  byId("customerVoiceSummary").innerHTML = cards
    .map(
      ({ label, headline, sourceCount, detail, tone, link }) => `
        <article class="customer-voice-card summary-insight-card summary-insight-${escapeHtml(tone)}">
          <div class="summary-insight-head"><span>${escapeHtml(label)}</span>${customerVoiceEvidenceStrengthBadge(sourceCount)}</div>
          <strong class="summary-insight-title">${escapeHtml(headline)}</strong>
          <p>${escapeHtml(detail)}</p>
          ${link}
        </article>
      `,
    )
    .join("") + buyingCard || `<div class="empty">No customer-voice finding has enough independent corroboration to be promoted in the summary.</div>`;
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
        </div>
      </div>
      <div class="pain-priority-evidence">
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
  const headers = ["Snapshot ID", "As-of timestamp", "Decision owner", "Required go/no-go output", "Newest evidence date", "Company", "Product", "Sentiment", "Category", "Lab type", "User role", "Buying priority", "Product maturity", "Geography", "Confidence", "Language type", "Customer language", "Claim ID", "Evidence status", "Primary source URL", "Retrieval date", "Source date", "Caveat", "PM interpretation"];
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
    item.languageType || "directional_synthesis",
    item.customerLanguageSignal,
    item.claimID || item.id,
    item.evidenceStatus || "partial",
    customerVoiceSourceLinks(item)[0]?.url || "",
    item.retrievalDate || snapshot.asOfTimestamp,
    item.sourceDate || customerVoiceEvidenceDate(item),
    item.caveat || (item.languageType === "verbatim_quote" ? "" : "Analyst language; recurrence does not establish prevalence."),
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
  const updates = Math.max(0, launches.length - newLaunches);
  const competitorNames = [...new Set(launches.map((launch) => launch.competitor))].sort();
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
                        const dateLabel = escapeHtml(launchDateLabel(launch));
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

function gapMapIsoDate(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return String(value);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function gapMapCapabilityMatches(definition, text) {
  const normalized = String(text || "").toLowerCase();
  return definition.pattern?.test(normalized) || definition.terms.some((term) => normalized.includes(term));
}

function gapMapDirectionFromComparativeText(text, competitor) {
  const normalized = String(text || "").toLowerCase().replace(/[–—]/g, "-");
  if (!normalized) return null;
  if (/(?:requires controlled testing|no clear|not a useful differentiation|aligned|substantially overlap|cannot support (?:a )?winner|does not (?:establish|demonstrate)|not a demonstrated|no common-condition|conditions differ|determine whether|validate whether)/i.test(normalized)) return "parity";
  const competitorName = String(competitor || "").toLowerCase();
  const favorable = "stronger|greater|faster|higher|twice|advantage|lead|wider|tighter|smaller nominal|better";
  const escapedCompetitor = competitorName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (escapedCompetitor && new RegExp(`(?:${escapedCompetitor}|competitor).{0,140}(?:${favorable})`, "i").test(normalized)) return "behind";
  if (new RegExp(`waters.{0,140}(?:${favorable})`, "i").test(normalized)) return "ahead";
  if (/waters.{0,120}(?:inferior|behind|lower performance|slower)/i.test(normalized)) return "behind";
  if (escapedCompetitor && new RegExp(`(?:${escapedCompetitor}|competitor).{0,120}(?:inferior|behind|lower performance|slower)`, "i").test(normalized)) return "ahead";
  return null;
}

const gapMapEvidenceFamilyLabels = {
  "vendor-specification": "Vendor-stated specifications",
  "vendor-positioning": "Vendor positioning and releases",
  "independent-evaluation": "Independent papers and evaluations",
  "regulatory-record": "Regulatory records",
  "user-experience": "Reviews and user discussions",
  "application-workflow": "Application workflows",
};

const gapMapAuthorityWeights = { INDEPENDENT: 3, USER_GENERATED: 2, VENDOR_PUBLISHED: 1 };
const gapMapCompetitorOrder = ["Agilent", "Thermo Fisher", "Shimadzu", "SCIEX", "PerkinElmer"];
let gapMapIndependentCapabilityCache = new Map();

function gapMapSourceType(value, url = "") {
  const text = `${value || ""} ${url}`.toLowerCase();
  if (/fda\.gov|regulator|warning letter|510\(k\)/.test(text)) return "REGULATORY_DOCUMENT";
  if (/doi\.org|peer.review|journal|conference poster|scientific paper/.test(text)) return "PEER_REVIEWED_PAPER";
  if (/reddit/.test(text)) return "REDDIT_DISCUSSION";
  if (/selectscience|review/.test(text)) return "PRODUCT_REVIEW";
  if (/chromforum|labwrench|community|forum/.test(text)) return "COMMUNITY_FORUM";
  if (/release note|firmware|software release|version update/.test(text)) return "RELEASE_NOTES";
  if (/press release|newsroom|news-details|\/news\//.test(text)) return "PRESS_RELEASE";
  if (/specification|spec sheet|datasheet|user manual|operator guide|usermanual|\/spec\.|specifications|manual/.test(text)) return "SPEC_SHEET";
  if (/application note/.test(text)) return "APPLICATION_NOTE";
  if (/sec\.gov|annual report|investor/.test(text)) return "INVESTOR_FILING";
  if (/third.party evaluation|independent evaluation|benchmark study/.test(text)) return "THIRD_PARTY_EVALUATION";
  return "PRODUCT_PAGE";
}

function gapMapAuthorityFor(sourceType) {
  if (["REGULATORY_DOCUMENT", "PEER_REVIEWED_PAPER", "THIRD_PARTY_EVALUATION"].includes(sourceType)) return "INDEPENDENT";
  if (["PRODUCT_REVIEW", "COMMUNITY_FORUM", "REDDIT_DISCUSSION"].includes(sourceType)) return "USER_GENERATED";
  return "VENDOR_PUBLISHED";
}

function gapMapEvidenceRecord({ url, date, title, detail, sourceType, sourceAuthorityTier, evidenceFamily, direction = null, dateType = "Published", comparisonKind = "", specComparison = null, positioningSignal = false }) {
  const sourceDate = gapMapIsoDate(date);
  if (!isHttpUrl(url) || !sourceDate || sourceHealthForUrl(url) === "bad") return null;
  const normalizedSourceType = sourceType || gapMapSourceType(title, url);
  const authority = sourceAuthorityTier || gapMapAuthorityFor(normalizedSourceType);
  return {
    url,
    date: sourceDate,
    title,
    detail,
    sourceType: normalizedSourceType,
    sourceAuthorityTier: authority,
    authorityWeight: gapMapAuthorityWeights[authority],
    evidenceFamily,
    direction,
    dateType,
    comparisonKind,
    specComparison,
    positioningSignal,
  };
}

function gapMapIndependentKey(record) {
  return canonicalEvidenceUrl(record.url);
}

function gapMapProductText(product) {
  return `${product?.product || ""} ${product?.technology || ""} ${product?.decisionRole || ""} ${(product?.bestFor || []).join(" ")} ${(product?.strengths || []).join(" ")} ${(product?.watchouts || []).join(" ")}`;
}

function gapMapNormalizeScope() {
  const scope = state.capabilityGapScope;
  state.headToHead.matchModel ||= headToHeadBuildMatchModel();
  const model = state.headToHead.matchModel;
  if (!model?.watersProducts?.length || !headToHeadProductMatchModel) return { model, scope, waters: null, competitors: [], selections: [] };
  if (!model.watersProducts.some((product) => product.id === scope.watersProductId)) {
    scope.watersProductId = model.watersProducts.find((product) => product.id === "acquity-premier-system")?.id || model.watersProducts[0].id;
  }
  const available = headToHeadProductMatchModel.availableCompetitors(model, scope.watersProductId);
  const orderedCompetitors = gapMapCompetitorOrder.filter((competitor) => available.includes(competitor));
  const waters = model.watersProducts.find((product) => product.id === scope.watersProductId) || null;
  const selections = orderedCompetitors.map((competitor) => {
    const candidates = headToHeadProductMatchModel.candidates(model, scope.watersProductId, competitor);
    const override = scope.competitorProductOverrides[competitor];
    if (!candidates.some((candidate) => candidate.competitorProductId === override)) scope.competitorProductOverrides[competitor] = candidates[0]?.competitorProductId || "";
    const match = candidates.find((candidate) => candidate.competitorProductId === scope.competitorProductOverrides[competitor]) || candidates[0] || null;
    const competitorProduct = model.competitorProducts.find((product) => product.id === match?.competitorProductId) || null;
    return { competitor, candidates, match, competitorProduct, pair: waters && match && competitorProduct ? { waters, match, competitorProduct } : null };
  }).filter((selection) => selection.pair);
  return { model, scope, waters, competitors: orderedCompetitors, selections };
}

function gapMapProductPrimaryEvidence(definition, pair) {
  if (definition.scope !== "instrument" || !pair?.waters || !pair?.competitorProduct) return [];
  const records = [];
  const addArtifact = (product, company, url, date, label, dateType, explicitSourceType = "", capabilityText = "") => {
    const artifactText = `${label} ${capabilityText} ${gapMapProductText(product)}`;
    if (!gapMapCapabilityMatches(definition, artifactText)) return;
    const sourceType = explicitSourceType || gapMapSourceType(label, url);
    records.push(gapMapEvidenceRecord({
      url,
      date,
      title: `${company}: ${product.product}`,
      detail: `${label} establishes the vendor's dated capability or positioning claim. It does not prove superiority by itself.`,
      sourceType,
      sourceAuthorityTier: "VENDOR_PUBLISHED",
      evidenceFamily: "vendor-positioning",
      dateType,
      positioningSignal: true,
    }));
  };
  const addLinkedArtifacts = (product, company) => (product.artifacts || []).forEach((artifact) => addArtifact(
    product,
    company,
    artifact.url,
    artifact.date,
    artifact.title,
    artifact.dateType || "Published",
    artifact.sourceType,
    (artifact.capabilities || []).join(" "),
  ));
  addLinkedArtifacts(pair.waters, "Waters");
  addLinkedArtifacts(pair.competitorProduct, pair.match.competitor);
  addArtifact(pair.waters, "Waters", pair.waters.sourceUrl, pair.waters.introducedYear ? `${pair.waters.introducedYear}-01-01` : "", pair.waters.sourceName || "Waters product page", pair.waters.dateBasis || "Product introduced");
  addArtifact(pair.competitorProduct, pair.match.competitor, pair.competitorProduct.sourceUrl, pair.competitorProduct.date || (pair.competitorProduct.introducedYear ? `${pair.competitorProduct.introducedYear}-01-01` : ""), pair.competitorProduct.sourceName || "Competitor product page", "Published");
  addArtifact(pair.competitorProduct, pair.match.competitor, pair.competitorProduct.pressReleaseUrl, pair.competitorProduct.date || (pair.competitorProduct.introducedYear ? `${pair.competitorProduct.introducedYear}-01-01` : ""), "Press release / launch claim", "Published");
  return records.filter(Boolean);
}

function gapMapTechnicalEvidence(definition, pair) {
  if (definition.scope !== "instrument" || !pair?.waters || !pair?.competitorProduct) return [];
  const profile = (state.technicalComparisons?.profiles || []).find((item) => item.launchId === pair.competitorProduct.id && (!item.watersId || item.watersId === pair.waters.id));
  if (!profile) return [];
  return (profile.rows || []).flatMap((row) => {
    const text = `${row.dimension} ${row.competitorValue} ${row.watersValue} ${row.interpretation}`;
    if (!gapMapCapabilityMatches(definition, text)) return [];
    const direction = gapMapDirectionFromComparativeText(text, pair.match.competitor);
    const specComparison = { dimension: row.dimension, waters: row.watersValue, competitor: row.competitorValue, interpretation: row.interpretation };
    const detail = `${row.interpretation} Vendor-stated values may use different conditions and are not independently verified.`;
    return [
      gapMapEvidenceRecord({ url: row.watersSourceUrl, date: profile.asOfDate, title: `Waters published value: ${row.dimension}`, detail, sourceType: gapMapSourceType("", row.watersSourceUrl), sourceAuthorityTier: "VENDOR_PUBLISHED", evidenceFamily: "vendor-specification", direction, dateType: "Evidence reviewed", comparisonKind: "SPEC_TO_SPEC", specComparison }),
      gapMapEvidenceRecord({ url: row.competitorSourceUrl, date: profile.asOfDate, title: `${pair.match.competitor} published value: ${row.dimension}`, detail, sourceType: gapMapSourceType("", row.competitorSourceUrl), sourceAuthorityTier: "VENDOR_PUBLISHED", evidenceFamily: "vendor-specification", direction, dateType: "Evidence reviewed", comparisonKind: "SPEC_TO_SPEC", specComparison }),
    ].filter(Boolean);
  });
}

function gapMapLaunchEvidence(definition, pair) {
  if (!pair?.match) return [];
  const competitor = pair.match.competitor;
  const exactProductId = pair.competitorProduct?.id;
  const launches = (state.productData?.launches || []).filter((launch) => launch.competitor === competitor && inSelectedHorizon(launch.date));
  const scoped = definition.scope === "instrument" ? launches.filter((launch) => launch.id === exactProductId) : launches;
  return scoped.flatMap((launch) => {
    const text = `${launch.product} ${launch.technology} ${launch.signalType} ${launch.sourceEvidence || ""} ${launch.pmImplication || ""} ${launch.roadmapQuestion || ""}`;
    if (!gapMapCapabilityMatches(definition, text)) return [];
    const sourceType = gapMapSourceType(`${launch.sourceName} ${launch.signalType}`, pressReleaseUrlForLaunch(launch) || productPageUrlForLaunch(launch));
    return [
      gapMapEvidenceRecord({
        url: pressReleaseUrlForLaunch(launch) || productPageUrlForLaunch(launch),
        date: launch.date,
        title: `${competitor}: ${launch.product}`,
        detail: `${launch.sourceEvidence || launch.pmImplication || "Dated vendor launch claim."} This is a positioning pressure signal only; it cannot score Waters Behind without corroboration.`,
        sourceType,
        sourceAuthorityTier: "VENDOR_PUBLISHED",
        evidenceFamily: "vendor-positioning",
        positioningSignal: true,
      }),
    ].filter(Boolean);
  });
}

function gapMapApplicationNoteEvidence(definition, pair) {
  if (!pair?.match) return [];
  const notes = (state.competitorApplicationNotes?.notes || []).filter((note) => note.competitor === pair.match.competitor && inSelectedHorizon(note.date));
  const scoped = definition.scope === "instrument"
    ? notes.filter((note) => headToHeadProductMatchesRecord({ product: note.products, title: note.title }, pair.competitorProduct))
    : notes;
  return scoped.filter((note) => gapMapCapabilityMatches(definition, `${note.title} ${note.applicationArea} ${note.technology} ${note.products} ${note.evidenceStatement}`))
    .map((note) => gapMapEvidenceRecord({
      url: note.sourceUrl,
      date: note.date,
      title: `${note.competitor}: ${note.title}`,
      detail: `${note.evidenceStatement} Official application evidence establishes a vendor workflow claim, not comparative superiority.`,
      sourceType: "APPLICATION_NOTE",
      sourceAuthorityTier: "VENDOR_PUBLISHED",
      evidenceFamily: "application-workflow",
      positioningSignal: true,
    })).filter(Boolean);
}

function gapMapCustomerEvidence(definition, pair) {
  if (!pair?.match) return [];
  const competitor = pair.match.competitor;
  const all = customerVoiceItemsForHorizon(filters.horizon.value, { ignoreCompetitor: true })
    .filter((item) => ["Waters", competitor].includes(item.company))
    .filter((item) => gapMapCapabilityMatches(definition, `${item.product} ${item.platform} ${item.category} ${item.theme} ${item.customerLanguageSignal} ${item.pmInterpretation}`));
  const scoped = definition.scope === "instrument"
    ? all.filter((item) => item.company === "Waters" ? headToHeadProductMatchesRecord(item, pair.waters) : headToHeadProductMatchesRecord(item, pair.competitorProduct))
    : all;
  const watersItems = scoped.filter((item) => item.company === "Waters");
  const competitorItems = scoped.filter((item) => item.company === competitor);
  const sentimentValue = (item) => ({ positive: 1, negative: -1, mixed: 0, neutral: 0 }[String(item.sentiment || "").toLowerCase()] ?? 0);
  const average = (items) => items.length ? items.reduce((sum, item) => sum + sentimentValue(item), 0) / items.length : null;
  const watersAverage = average(watersItems);
  const competitorAverage = average(competitorItems);
  // User-generated sources may direct software/workflow/service rows, but never hard-performance rows.
  const pairedDirection = definition.scope === "platform" && watersAverage != null && competitorAverage != null && watersAverage !== competitorAverage
    ? watersAverage > competitorAverage ? "ahead" : "behind"
    : null;
  return scoped.flatMap((item) => customerVoiceSourceLinks(item).map((link) => {
    const sourceType = gapMapSourceType(`${link.sourceType} ${link.recordType}`, link.url);
    const authority = gapMapAuthorityFor(sourceType);
    const direction = authority === "INDEPENDENT" && definition.key === "regulated-methods" ? pairedDirection : authority === "USER_GENERATED" ? pairedDirection : null;
    return gapMapEvidenceRecord({
      url: link.url,
      date: link.sourceDate,
      title: `${item.company}: ${item.theme}`,
      detail: direction
        ? `Both companies have matched dated records; the vote compares coded sentiment for this platform/company capability. This is directional, not prevalence evidence.`
        : `This dated record adds capability context but does not independently establish a product-performance lead.`,
      sourceType,
      sourceAuthorityTier: authority,
      evidenceFamily: authority === "INDEPENDENT" ? "regulatory-record" : "user-experience",
      direction,
      dateType: link.dateType || "Published",
    });
  })).filter(Boolean);
}

function gapMapIndependentEvidence(definition, pair) {
  if (!pair?.match) return [];
  const companies = ["Waters", pair.match.competitor];
  let candidates = gapMapIndependentCapabilityCache.get(definition.key);
  if (!candidates) {
    candidates = (state.journalSources?.sources || []).flatMap((source) => (source.recentRecords || []).flatMap((record) => {
      const governedIndependentSource = /peer-reviewed/i.test(`${source.sourceClass || ""} ${source.sourceType || ""}`)
        || /doi\.org|fda\.gov|regulatory|independent evaluation|benchmark study/i.test(`${record.sourceUrl || ""} ${record.recordType || ""}`);
      // Trade-news coverage can be useful context elsewhere, but it is not promoted to the
      // INDEPENDENT tier here unless the record is explicitly an evaluation or benchmark.
      if (!governedIndependentSource || !inSelectedHorizon(record.date)) return [];
      const text = `${record.title || ""} ${record.recordType || ""}`;
      return gapMapCapabilityMatches(definition, text) ? [{ source, record, text }] : [];
    }));
    gapMapIndependentCapabilityCache.set(definition.key, candidates);
  }
  return candidates.flatMap(({ source, record, text }) => {
    const companyMatched = companies.some((company) => text.toLowerCase().includes(company.toLowerCase()));
    const productMatched = definition.scope === "instrument" && [pair.waters, pair.competitorProduct].some((product) => headToHeadProductMatchesRecord({ title: record.title }, product));
    if (definition.scope === "instrument" ? !productMatched : !companyMatched) return [];
    const sourceType = gapMapSourceType(`${source.sourceClass} ${source.sourceType} ${record.recordType}`, record.sourceUrl);
    const direction = gapMapDirectionFromComparativeText(text, pair.match.competitor);
    return [gapMapEvidenceRecord({
      url: record.sourceUrl,
      date: record.date,
      title: record.title,
      detail: direction ? "Independent public record contains explicit comparative language used as a directional vote." : "Independent public record corroborates capability relevance but does not state a comparative winner.",
      sourceType: ["PEER_REVIEWED_PAPER", "REGULATORY_DOCUMENT"].includes(sourceType) ? sourceType : "THIRD_PARTY_EVALUATION",
      sourceAuthorityTier: "INDEPENDENT",
      evidenceFamily: sourceType === "REGULATORY_DOCUMENT" ? "regulatory-record" : "independent-evaluation",
      direction,
      dateType: record.dateBasis || "Published",
    })].filter(Boolean);
  });
}

function gapMapDeduplicateRecords(records) {
  const byKey = new Map();
  records.filter(Boolean).forEach((record) => {
    const key = `${canonicalEvidenceUrl(record.url)}::${record.sourceType}`;
    const existing = byKey.get(key);
    if (!existing || (!existing.direction && record.direction)) byKey.set(key, record);
  });
  return [...byKey.values()].sort((left, right) => new Date(right.date) - new Date(left.date));
}

function gapMapScoreCell(definition, pair, keySuffix = "") {
  const records = gapMapDeduplicateRecords([
    ...gapMapProductPrimaryEvidence(definition, pair),
    ...gapMapTechnicalEvidence(definition, pair),
    ...gapMapLaunchEvidence(definition, pair),
    ...gapMapApplicationNoteEvidence(definition, pair),
    ...gapMapCustomerEvidence(definition, pair),
    ...gapMapIndependentEvidence(definition, pair),
  ]);
  const voteBuckets = new Map();
  records.forEach((record) => {
    if (!["ahead", "behind"].includes(record.direction)) return;
    if (record.sourceAuthorityTier === "VENDOR_PUBLISHED" && record.comparisonKind !== "SPEC_TO_SPEC") return;
    const key = `${record.sourceAuthorityTier}::${record.evidenceFamily}`;
    const score = record.direction === "ahead" ? record.authorityWeight : -record.authorityWeight;
    voteBuckets.set(key, (voteBuckets.get(key) || 0) + score);
  });
  const votes = [...voteBuckets.values()].map((score) => score > 0 ? 1 : score < 0 ? -1 : 0);
  const weightedNet = [...voteBuckets.entries()].reduce((sum, [key, score]) => {
    const authority = key.split("::")[0];
    return sum + (score > 0 ? gapMapAuthorityWeights[authority] : score < 0 ? -gapMapAuthorityWeights[authority] : 0);
  }, 0);
  const direction = !records.length ? "no-evidence" : !votes.some(Boolean) || weightedNet === 0 ? "parity" : weightedNet > 0 ? "ahead" : "behind";
  const independentRecords = records.filter((record) => record.sourceAuthorityTier === "INDEPENDENT");
  const independentSourceCount = new Set(independentRecords.map(gapMapIndependentKey)).size;
  const sourceCount = records.length;
  const tier = independentSourceCount >= 2 ? "Proven" : sourceCount ? "Directional" : "Insufficient";
  const authorityMix = ["INDEPENDENT", "USER_GENERATED", "VENDOR_PUBLISHED"].map((authority) => ({
    authority,
    label: authority.replace("_", " "),
    count: records.filter((record) => record.sourceAuthorityTier === authority).length,
  })).filter((item) => item.count);
  const specComparison = records.find((record) => record.specComparison)?.specComparison || null;
  const selfClaimOnly = sourceCount > 0 && records.every((record) => record.sourceAuthorityTier === "VENDOR_PUBLISHED");
  const scopeLabel = definition.scope === "instrument"
    ? `${pair.waters.product} vs ${pair.competitorProduct.product}`
    : `Waters vs ${pair.match.competitor} (company/platform)`;
  return {
    key: `${definition.key}::${pair.waters.id}::${pair.competitorProduct.id}${keySuffix}`,
    capability: definition.label,
    capabilityKey: definition.key,
    capabilityScope: definition.scope,
    competitor: pair.match.competitor,
    competitorProduct: pair.competitorProduct.product,
    watersProduct: pair.waters.product,
    scopeLabel,
    direction,
    sourceCount,
    independentSourceCount,
    tier,
    authorityMix,
    records,
    specComparison,
    selfClaimOnly,
    positioningSignalCount: records.filter((record) => record.positioningSignal).length,
  };
}

function gapMapPairFromMatch(model, waters, match) {
  const competitorProduct = model.competitorProducts.find((product) => product.id === match?.competitorProductId);
  return waters && match && competitorProduct ? { waters, match, competitorProduct } : null;
}

function gapMapRollupCell(definition, normalized, competitor) {
  if (definition.scope === "platform") {
    const companyPair = normalized.selections.find((selection) => selection.competitor === competitor)?.pair;
    if (!companyPair) return null;
    return {
      ...gapMapScoreCell(definition, companyPair, "::rollup-company"),
      key: `${definition.key}::overall::${competitor}`,
      scopeLabel: `Waters vs ${competitor} (company/platform)`,
      rollupBasis: "Platform/company rows are company-scoped and do not change with product selection.",
    };
  }
  const productCells = headToHeadProductMatchModel.portfolioPairs(normalized.model, competitor)
    .map(({ watersProduct, match }) => gapMapPairFromMatch(normalized.model, watersProduct, match))
    .filter(Boolean)
    .map((pair) => gapMapScoreCell(definition, pair, "::rollup-source"));
  const rank = { behind: 3, parity: 2, ahead: 1, "no-evidence": 0 };
  const worst = productCells.sort((left, right) => rank[right.direction] - rank[left.direction] || right.independentSourceCount - left.independentSourceCount)[0];
  if (!worst) return null;
  return {
    ...worst,
    key: `${definition.key}::overall::${competitor}`,
    scopeLabel: definition.scope === "instrument" ? `Overall portfolio vs ${competitor}` : `Waters vs ${competitor} (company/platform)`,
    rollupBasis: definition.scope === "instrument" ? `Worst-case exposure: ${worst.watersProduct} vs ${worst.competitorProduct}.` : "Platform/company rows are company-scoped and do not change with product selection.",
  };
}

function gapMapArtifactCoverage(pair) {
  if (!pair) return [];
  const profiles = state.technicalComparisons?.profiles || [];
  const exactLaunches = (state.productData?.launches || []).filter((launch) => launch.id === pair.competitorProduct.id);
  const artifactRecord = ({ url, date, title, sourceType = "", dateType = "Published" }) => {
    const normalizedDate = gapMapIsoDate(date);
    if (!isHttpUrl(url) || !normalizedDate) return null;
    return { url, date: normalizedDate, title, sourceType: sourceType || gapMapSourceType(title, url), dateType };
  };
  const typesFor = (product, isCompetitor) => {
    const records = [
      ...(product.artifacts || []).map((artifact) => artifactRecord({ ...artifact, url: artifact.url, title: artifact.title })),
      artifactRecord({
        url: product.sourceUrl,
        date: product.date || (product.introducedYear ? `${product.introducedYear}-01-01` : ""),
        title: product.sourceName || `${product.product} product page`,
        dateType: product.dateBasis || "Published",
      }),
      ...(isCompetitor ? exactLaunches.flatMap((launch) => [
        artifactRecord({ url: launch.sourceUrl, date: launch.date, title: `${launch.sourceName || launch.product} ${launch.signalType || ""}` }),
        artifactRecord({ url: launch.pressReleaseUrl, date: launch.date, title: `${launch.product} press release`, sourceType: "PRESS_RELEASE" }),
      ]) : []),
      ...profiles.filter((profile) => isCompetitor ? profile.launchId === product.id : profile.watersId === product.id).flatMap((profile) => (profile.rows || []).map((row) => artifactRecord({
        url: isCompetitor ? row.competitorSourceUrl : row.watersSourceUrl,
        date: profile.asOfDate,
        title: `${product.product}: ${row.dimension}`,
        sourceType: gapMapSourceType("", isCompetitor ? row.competitorSourceUrl : row.watersSourceUrl),
        dateType: "Evidence reviewed",
      }))),
    ].filter(Boolean);
    const byUrl = new Map();
    records.forEach((record) => {
      const key = canonicalEvidenceUrl(record.url);
      if (!byUrl.has(key) || byUrl.get(key).sourceType === "PRODUCT_PAGE") byUrl.set(key, record);
    });
    const uniqueRecords = [...byUrl.values()];
    return [
      { type: "Spec sheet", sourceType: "SPEC_SHEET" },
      { type: "Release notes", sourceType: "RELEASE_NOTES" },
      { type: "Press / launch", sourceType: "PRESS_RELEASE" },
    ].map((artifactType) => {
      const matchingRecords = uniqueRecords.filter((record) => record.sourceType === artifactType.sourceType);
      return { ...artifactType, present: matchingRecords.length > 0, records: matchingRecords };
    });
  };
  return [
    { company: "Waters", product: pair.waters.product, artifacts: typesFor(pair.waters, false) },
    { company: pair.match.competitor, product: pair.competitorProduct.product, artifacts: typesFor(pair.competitorProduct, true) },
  ];
}

function buildCapabilityGapMap() {
  gapMapIndependentCapabilityCache = new Map();
  const normalized = gapMapNormalizeScope();
  if (!normalized.selections.length) return { normalized, columns: [], capabilities: [], cells: [], hiddenCapabilities: watersCapabilityDefinitions, hiddenCompetitors: [], artifactCoverage: [] };
  const allCells = watersCapabilityDefinitions.flatMap((definition) => normalized.selections.map((selection) => normalized.scope.mode === "overall"
    ? gapMapRollupCell(definition, normalized, selection.competitor)
    : gapMapScoreCell(definition, selection.pair)));
  const columns = normalized.selections.filter((selection) => allCells.some((cell) => cell?.competitor === selection.competitor && cell.sourceCount > 0));
  const capabilities = watersCapabilityDefinitions.filter((definition) => allCells.some((cell) => cell?.capabilityKey === definition.key && columns.some((column) => column.competitor === cell.competitor) && cell.sourceCount > 0));
  const cells = allCells.filter((cell) => cell && capabilities.some((definition) => definition.key === cell.capabilityKey) && columns.some((column) => column.competitor === cell.competitor));
  state.capabilityGapEvidence = cells;
  return {
    normalized,
    columns,
    capabilities,
    cells,
    hiddenCapabilities: watersCapabilityDefinitions.filter((definition) => !capabilities.includes(definition)),
    hiddenCompetitors: normalized.selections.filter((selection) => !columns.includes(selection)).map((selection) => selection.competitor),
    artifactCoverage: normalized.selections.map((selection) => ({
      competitor: selection.competitor,
      product: selection.competitorProduct.product,
      entries: gapMapArtifactCoverage(selection.pair),
    })),
  };
}

function gapMapCellMarkup(cell) {
  const labels = { ahead: "Ahead", parity: "Parity", behind: "Behind", "no-evidence": "No evidence" };
  const label = labels[cell.direction];
  const specs = cell.specComparison ? `
    <span class="gap-vendor-specs"><b>Vendor-stated specs</b><span>Waters: ${escapeHtml(compactText(cell.specComparison.waters, 58))}</span><span>${escapeHtml(cell.competitor)}: ${escapeHtml(compactText(cell.specComparison.competitor, 58))}</span></span>` : "";
  return `
    <button type="button" class="gap-map-cell gap-map-${cell.direction}" data-gap-evidence-key="${escapeHtml(cell.key)}" role="cell" aria-label="${escapeHtml(cell.scopeLabel)} on ${escapeHtml(cell.capability)}: ${label}; ${cell.independentSourceCount} independent sources; ${cell.tier}">
      <strong>${label}</strong>
      <span class="gap-map-confidence"><b>I ${cell.independentSourceCount}</b><span>${cell.tier}</span></span>
      ${cell.selfClaimOnly ? `<small class="gap-self-claim">Vendor-stated · unverified</small>` : ""}
      ${cell.rollupBasis ? `<small class="gap-rollup-basis">${escapeHtml(cell.rollupBasis)}</small>` : ""}
      ${specs}
      <small>${cell.sourceCount} total source${cell.sourceCount === 1 ? "" : "s"}${cell.positioningSignalCount ? ` · ${cell.positioningSignalCount} positioning` : ""} · view</small>
    </button>
  `;
}

function gapMapArtifactBadgeMarkup(artifact) {
  const record = artifact.records?.[0];
  return record
    ? `<a class="available" href="${escapeHtml(record.url)}" target="_blank" rel="noreferrer" title="${escapeHtml(`${record.title} · ${formatDate(record.date)}`)}">${escapeHtml(artifact.type)} linked ↗</a>`
    : `<i class="missing">${escapeHtml(artifact.type)} not linked</i>`;
}

function renderFeatureGapMatrix() {
  const model = buildCapabilityGapMap();
  const { normalized } = model;
  const scope = normalized.scope;
  const scopeLabel = scope.mode === "overall"
    ? "Overall portfolio roll-up vs all competitors · worst-case across each competitor's closest product pairs"
    : normalized.waters ? `${normalized.waters.product} vs all competitors' closest matched products` : "Product pairs unavailable";
  const noteItems = [
    model.hiddenCapabilities.length ? `${model.hiddenCapabilities.length} capability row${model.hiddenCapabilities.length === 1 ? " is" : "s are"} collapsed because every competitor column has no dated public evidence` : "",
    model.hiddenCompetitors.length ? `${model.hiddenCompetitors.join(", ")} ${model.hiddenCompetitors.length === 1 ? "is" : "are"} collapsed because the entire column has no dated public evidence` : "",
  ].filter(Boolean);
  const watersArtifactCoverage = model.artifactCoverage.length ? model.artifactCoverage[0].entries[0] : null;
  const mergedWatersArtifacts = watersArtifactCoverage ? watersArtifactCoverage.artifacts.map((artifact) => ({
    ...artifact,
    records: model.artifactCoverage.flatMap((coverage) => coverage.entries[0]?.artifacts.find((candidate) => candidate.type === artifact.type)?.records || []),
    present: model.artifactCoverage.some((coverage) => coverage.entries[0]?.artifacts.find((candidate) => candidate.type === artifact.type)?.present),
  })) : [];
  byId("featureGapMatrix").innerHTML = `
    <div class="gap-scope-controls gap-scope-controls-primary" aria-label="Capability gap-map scope">
      <label>View<select data-gap-scope-control="mode"><option value="product" ${scope.mode === "product" ? "selected" : ""}>Product comparison</option><option value="overall" ${scope.mode === "overall" ? "selected" : ""}>Overall (portfolio roll-up)</option></select></label>
      <label>Waters product<select data-gap-scope-control="waters" ${scope.mode === "overall" ? "disabled" : ""}>${normalized.model.watersProducts.map((product) => `<option value="${escapeHtml(product.id)}" ${product.id === scope.watersProductId ? "selected" : ""}>${escapeHtml(product.product)}</option>`).join("")}</select></label>
    </div>
    <div class="gap-match-controls" aria-label="Closest competitor product matches">
      ${normalized.selections.map((selection) => `<label><span>${escapeHtml(selection.competitor)}</span><select data-gap-scope-control="competitor-product" data-gap-competitor="${escapeHtml(selection.competitor)}" ${scope.mode === "overall" ? "disabled" : ""}>${scope.mode === "overall" ? `<option>Closest product per Waters product</option>` : selection.candidates.map((candidate, index) => `<option value="${escapeHtml(candidate.competitorProductId)}" ${candidate.competitorProductId === selection.match.competitorProductId ? "selected" : ""}>${escapeHtml(candidate.competitorProduct)} · ${candidate.score}/100${index === 0 ? " · closest" : ""}</option>`).join("")}</select></label>`).join("")}
    </div>
    <div class="gap-current-scope"><span>Current scope</span><strong>${escapeHtml(scopeLabel)}</strong>${scope.mode === "overall" ? `<em>Aggregation — never a single-product comparison</em>` : ""}</div>
    ${scope.mode === "product" ? `<div class="gap-artifact-coverage gap-artifact-coverage-all">${watersArtifactCoverage ? `<div><strong>Waters · ${escapeHtml(watersArtifactCoverage.product)}</strong><span>${mergedWatersArtifacts.map(gapMapArtifactBadgeMarkup).join("")}</span></div>` : ""}${model.artifactCoverage.map((coverage) => { const entry = coverage.entries[1]; return `<div><strong>${escapeHtml(coverage.competitor)} · ${escapeHtml(coverage.product)}</strong><span>${entry.artifacts.map(gapMapArtifactBadgeMarkup).join("")}</span></div>`; }).join("")}</div>` : ""}
    <div class="gap-map-guide"><strong>Reading guide:</strong> read across one Waters capability against every competitor's closest matched product; platform rows compare the companies. <b>Red = Waters is behind this competitor here.</b></div>
    <div class="gap-grid-scroll" tabindex="0" aria-label="Scrollable competitor capability heatmap">
      ${model.capabilities.length && model.columns.length ? `<div class="gap-map-grid" role="table" aria-label="Directional Waters competitive capability gap map" style="--gap-columns:${model.columns.length}">
        <div class="gap-map-corner" role="columnheader">Waters capability</div>
        ${model.columns.map((column) => `<div class="gap-map-competitor" role="columnheader"><strong>${escapeHtml(column.competitor)}</strong><span>${scope.mode === "overall" ? "Portfolio worst case" : escapeHtml(column.competitorProduct.product)}</span><small>${scope.mode === "overall" ? "closest pairs" : "closest match"}</small></div>`).join("")}
        ${model.capabilities.map((definition) => `<div class="gap-map-capability" role="rowheader"><strong>${escapeHtml(definition.label)}</strong><span class="gap-scope-tag gap-scope-${definition.scope}">${definition.scope === "instrument" ? "Instrument-level" : "Platform/company-level"}</span></div>${model.columns.map((column) => gapMapCellMarkup(model.cells.find((cell) => cell.capabilityKey === definition.key && cell.competitor === column.competitor))).join("")}`).join("")}
      </div>` : `<div class="empty"><strong>Not enough evidence yet</strong><span>No dated public capability evidence matches this product pair.</span></div>`}
    </div>
    <div class="gap-map-legend" aria-label="Gap map legend">
      <span><i class="legend-box gap-map-ahead"></i><b>Ahead</b> Waters stronger</span>
      <span><i class="legend-box gap-map-parity"></i><b>Parity</b> no clear difference</span>
      <span><i class="legend-box gap-map-behind"></i><b>Behind</b> competitor stronger</span>
      <span><i class="legend-box gap-map-no-evidence"></i><b>No evidence</b> insufficient to judge</span>
    </div>
    <div class="gap-map-confidence-legend"><b>Evidence strength is separate from color:</b> I = independent-source count · Proven ≥2 independent sources · Directional = one independent source or vendor/user-only evidence · Insufficient = zero sources. Vendor-only comparisons remain Directional even when two vendor specs are present.</div>
    ${noteItems.length ? `<p class="gap-map-coverage-note"><strong>Not enough evidence yet:</strong> ${escapeHtml(noteItems.join("; "))}.</p>` : ""}
    <details class="gap-map-method">
      <summary>Evidence authority and direction scoring rule</summary>
      <p>Evidence is filtered to the selected capability and exact product pair for instrument rows; platform rows always compare Waters with the competitor company. Dated records are tagged INDEPENDENT (weight 3), USER_GENERATED (weight 2), or VENDOR_PUBLISHED (weight 1). Each authority + evidence family contributes at most one signed vote, preventing Reddit/review volume from dominating. Independent comparative records may set direction; user-generated evidence may set direction for software, workflow, and service rows when both companies have matched records. Vendor press releases, product pages, release notes, application notes, and launch claims are positioning signals only and can never make Waters Behind. The sole vendor-only directional exception is a matched spec-to-spec comparison; it is labeled vendor-stated and remains capped at Directional. A weighted positive/negative result becomes Ahead/Behind, a tie or sourced non-comparative record becomes Parity, and zero dated sources always becomes No evidence. Overall is the worst product-level direction (Behind before Parity before Ahead), never an average.</p>
    </details>
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
        <strong>Evidence priority: ${escapeHtml(breakdown.evidencePriority)}</strong>
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
                  ${item.displayEvidenceBasis === false ? "" : `<p class="conference-evidence-basis"><strong>How this was derived:</strong> ${escapeHtml(item.evidenceBasis)}</p>`}
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
  // The detailed mapped-source summary and source-card panels are intentionally
  // disabled in the dashboard. The dedicated publications page remains available.
  const showMappedSourcePanels = false;
  if (!showMappedSourcePanels) {
    byId("journalForumSources").innerHTML = "";
    return;
  }
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
  const activeCompetitor = sortedGroups.some(([competitor]) => competitor === state.activeFilingCompetitor)
    ? state.activeFilingCompetitor
    : sortedGroups[0]?.[0] || "";
  state.activeFilingCompetitor = activeCompetitor;
  const activeGroup = sortedGroups.find(([competitor]) => competitor === activeCompetitor);
  byId("filingInsights").innerHTML = activeGroup
    ? `
        <div class="intent-master-detail filing-master-detail">
          <nav class="intent-competitor-rail filing-company-rail" role="tablist" aria-label="Companies with earnings and filing evidence">
            <div class="intent-rail-heading">Companies</div>
            ${sortedGroups.map(([competitor, companyInsights]) => {
              const companyEarnings = earnings.filter((signal) => signal.competitor === competitor);
              const corporateMoveItems = (state.filingInsights?.companyCorporateMoves || [])
                .find((group) => group.competitor === competitor)?.items || [];
              const totalRecords = companyEarnings.length + companyInsights.length + corporateMoveItems.length;
              const selected = competitor === activeCompetitor;
              return `
                <button type="button" class="intent-competitor-option${selected ? " is-selected" : ""}" data-filing-select="${escapeHtml(competitor)}" role="tab" aria-selected="${selected}" aria-controls="filing-selected-detail">
                  <span class="intent-option-copy">
                    <strong>${escapeHtml(competitor)}</strong>
                    <span>${companyEarnings.length} earnings · ${companyInsights.length} filing insights</span>
                    <small>${totalRecords} public record${totalRecords === 1 ? "" : "s"}</small>
                  </span>
                  <span class="intent-option-arrow" aria-hidden="true">›</span>
                </button>
              `;
            }).join("")}
          </nav>
          ${[activeGroup]
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
            <section id="filing-selected-detail" class="filing-company-group filing-selected-detail" role="tabpanel" aria-label="${escapeHtml(competitor)} earnings and filing evidence">
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
                        <a href="${escapeHtml(insight.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(insight.sourceName)}</a>
                      </article>
                    `;
                  })
                  .join("")}
              </div>
            </section>
          `;
        })
        .join("")}
        </div>
      `
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
    <section class="non-pubmed-signal-layer" aria-label="Observed beyond PubMed">
      <div class="non-pubmed-signal-header">
        <div>
          <span>Observed beyond PubMed</span>
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
  const publicEvidenceSourcePill = state.view === "Product"
    ? ""
    : `<a class="source-pill source-pill-link" href="#evidence-signal-feed" data-evidence-target="evidence-signal-feed" aria-label="View ${displaySignals(signals).length} public evidence records"><span>Public evidence records</span><strong>${displaySignals(signals).length}<small>View →</small></strong></a>`;
  byId("sourceCounts").innerHTML = `
    <div class="source-pill"><span>Role view</span><strong>${escapeHtml(state.view)}</strong></div>
    <div class="source-pill"><span>Time window</span><strong>${horizonLabel()}</strong></div>
    <div class="source-pill source-pill-comparison">
      <span>${escapeHtml(horizonDelta.label)}</span>
      <strong><small>${escapeHtml(horizonDelta.launches)}</small><small>${escapeHtml(horizonDelta.signals)}</small></strong>
    </div>
    <a class="source-pill source-pill-link" href="#competitive-timeline-section" data-evidence-target="competitive-timeline-section" aria-label="View ${launches.length} matching launches"><span>Matching launches</span><strong>${launches.length}<small>View →</small></strong></a>
    ${publicEvidenceSourcePill}
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
  const publicEvidencePanel = byId("evidence-signal-feed");
  const publicEvidenceNav = byId("publicEvidenceNav");
  const refreshBlock = document.querySelector(".refresh-block");
  const hiddenForProductManagement = state.view === "Product";
  if (refreshBlock) {
    refreshBlock.hidden = hiddenForProductManagement;
    refreshBlock.setAttribute("aria-hidden", String(hiddenForProductManagement));
  }
  if (competitorCoveragePanel) {
    competitorCoveragePanel.hidden = hiddenForProductManagement;
    competitorCoveragePanel.setAttribute("aria-hidden", String(hiddenForProductManagement));
  }
  if (publicEvidencePanel) {
    publicEvidencePanel.hidden = hiddenForProductManagement;
    publicEvidencePanel.setAttribute("aria-hidden", String(hiddenForProductManagement));
  }
  if (publicEvidenceNav) {
    publicEvidenceNav.hidden = hiddenForProductManagement;
    publicEvidenceNav.setAttribute("aria-hidden", String(hiddenForProductManagement));
  }
}

function render() {
  state.view = filters.role.value;
  updateRolePanelVisibility();
  const signals = currentSignals();
  byId("currentViewBadge").textContent = viewCopy[state.view].viewLabel;
  byId("viewSubtitle").textContent = viewCopy[state.view].subtitle;
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
    linkHealthResponse,
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
    fetch("data/link_health.json", { cache: "no-store" }),
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
  if (!linkHealthResponse.ok) throw new Error(`Link-health data failed: ${linkHealthResponse.status}`);
  const linkHealth = await linkHealthResponse.json();
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
  state.linkHealth = linkHealth;
  byId("asOf").textContent = `Real public data as of ${state.data.asOfDate}`;
  renderRefreshStatus();
  populateCompetitors();
  setupSourceCountLinks();
  setupMetricDrilldowns();
  setupDecisionEvidenceDrilldowns();
  setupOverallTrendEvidenceLinks();
  setupCompetitorIntentEvidenceLinks();
  setupFilingInsightNavigation();
  setupCapabilityGapEvidenceLinks();
  setupMarketSourceLinks();
  setupSentimentMentionDrilldowns();
  setupCustomerVoiceSummaryDrilldowns();
  setupCompanyVoiceDrilldowns();
  setupCustomerVoiceTabs();
  setupComparisonPanel();
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
