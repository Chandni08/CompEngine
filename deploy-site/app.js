const competitiveMethodology = globalThis.CompetitiveMethodology || {
  assessInference: (records) => ({ label: records?.length ? "Directional" : "Low", limitation: "Directional—insufficient independent corroboration.", rubric: {}, families: [], dedupedRecords: records || [] }),
  unquantifiedMagnitude: (overrides = {}) => ({ status: "UNQUANTIFIED — validation required", affectedSegment: overrides.affectedSegment || "Not established", geography: overrides.geography || "Not established", cohort: "Installed-base / replacement cohort not linked", exposureBand: "Unquantified", timeHorizon: "0–24 months", basis: "Public evidence establishes relevance, not Waters revenue or share exposure.", confidence: "Unquantified", validationOwner: overrides.validationOwner || "Product Management + Commercial Analytics", nextStep: "Join CRM installed base, opportunity, win/loss, renewal, and segment-revenue data to the public signal." }),
  evidencePriority: () => "Medium",
  snapshotMetadata: (data) => ({ asOfTimestamp: data?.generatedAt || data?.asOfDate || "unknown", snapshotId: data?.snapshotId || `waters-ci-${data?.asOfDate || "unknown"}` }),
};
const headToHeadProductMatchModel = globalThis.HeadToHeadProductMatchModel;
const pmmEvidenceGovernance = globalThis.PmmEvidenceGovernance;
const productComparatorClaimTransformer = globalThis.ProductComparatorClaimTransformer;
const proofPriorityTransformer = globalThis.ProofPriorityTransformer;
const competitorSellingMotionTransformer = globalThis.CompetitorSellingMotionTransformer;
const customerVoiceBarrierTransformer = globalThis.CustomerVoiceBarrierTransformer;
const buyingCommitteeTransformer = globalThis.BuyingCommitteeTransformer;
const gapQueue = [];

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
  activeBattlecardCompetitor: "",
  marketingMarketChoice: null,
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
  marketingClaimsFilters: { readiness: "All", audience: "All", classification: "All" },
  marketingTargeting: { watersProduct: "All", application: "All", buyingSituation: "All", buyerRole: "All" },
  marketingGovernanceFilters: { fieldCitable: "All", approvalState: "All" },
  marketingEvcBaselines: {},
  marketingEvcAssumptions: {},
  marketingArtifactSegmentId: "",
  marketingArtifactWorkflow: {},
  marketingWorkspaceModel: null,
  gapQueue,
  headToHead: { activeCompetitor: "", competitorProductId: "", competitorProductOverrides: {}, matchModel: null, model: null, models: [], initialized: false },
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

const marketingTargetFilters = {
  watersProduct: document.querySelector("#pmmWatersProductFilter"),
  application: document.querySelector("#pmmApplicationFilter"),
  buyingSituation: document.querySelector("#pmmBuyingSituationFilter"),
  buyerRole: document.querySelector("#pmmBuyerRoleFilter"),
};
const marketingGovernanceFilters = {
  fieldCitable: document.querySelector("#pmmFieldCitableFilter"),
  approvalState: document.querySelector("#pmmApprovalStateFilter"),
};
const headToHeadCompetitorProductFilter = document.querySelector("#pmmCompetitorProductFilter");

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
    title: "PMM Market Leadership Workspace",
    viewLabel: "Product Marketing view",
    subtitle: "Win product selections with evidence-backed claims, competitive battlecards, and proof priorities.",
    decisionQuestion: "What can Waters credibly claim, prove, and activate to win?",
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
  const currentProducts = pmmGovernedRecords(state.productData?.launches || []);
  const historicalProducts = pmmGovernedRecords(state.historicalProductCatalog?.products || []).map((product) => ({
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
  const selectedWatersProduct = pmmSelectedWatersProduct();
  const profiles = pmmGovernedRecords(state.technicalComparisons?.profiles || []);
  const launchMatchesProduct = (launch) => {
    if (!selectedWatersProduct) return Boolean(comparisonByLaunchId(launch.id));
    const comparison = comparisonByLaunchId(launch.id);
    const technicalProfile = profiles.find((profile) => profile.launchId === launch.id);
    return comparison?.closestWatersId === selectedWatersProduct.id || technicalProfile?.watersId === selectedWatersProduct.id;
  };
  const selectedLaunch = launches.find(launchMatchesProduct) || (selectedWatersProduct ? null : launches[0]);
  const comparison = selectedLaunch ? comparisonByLaunchId(selectedLaunch.id) : null;
  const waters = selectedWatersProduct || (selectedLaunch
    ? watersComparatorById(comparison?.closestWatersId || defaultWatersComparatorForLaunch(selectedLaunch))
    : null);
  const technicalProfile = selectedLaunch
    ? profiles.find((profile) => profile.launchId === selectedLaunch.id
      && (!selectedWatersProduct || !profile.watersId || profile.watersId === selectedWatersProduct.id))
    : null;
  return { launches, selectedLaunch, comparison, waters, technicalProfile, productComparisonMatched: !selectedWatersProduct || Boolean(selectedLaunch) };
}

function battlecardEvidenceLinks(competitor) {
  const records = [
    ...pmmGovernedRecords(currentLaunches())
      .filter((item) => item.competitor === competitor)
      .map((item) => ({
        url: timelineUrlForLaunch(item),
        label: item.product,
        sourceName: item.sourceName || "Official product source",
        date: item.date,
        confidence: item.confidence,
        evidenceType: "Official launch",
        ...pmmGovernanceFields(item),
      })),
    ...pmmGovernedRecords(currentSignals())
      .filter((item) => item.competitor === competitor)
      .map((item) => ({
        url: item.sourceUrl || item.url,
        label: item.title || item.headline,
        sourceName: item.sourceName || "Public evidence source",
        date: item.date,
        confidence: item.confidence,
        evidenceType: item.category || "Public evidence",
        ...pmmGovernanceFields(item),
      })),
    ...pmmGovernedRecords(currentFilingInsights())
      .filter((item) => item.competitor === competitor)
      .map((item) => ({
        url: item.sourceUrl || item.url,
        label: item.headline || item.title,
        sourceName: item.sourceName || "Company filing",
        date: item.date,
        confidence: item.confidence,
        evidenceType: "Company filing",
        ...pmmGovernanceFields(item),
      })),
  ];
  const customerLinks = pmmGovernedRecords(customerVoiceItemsForHorizon(filters.horizon.value, { ignoreCompetitor: true }))
    .filter((item) => item.company === competitor)
    .flatMap((item) => customerVoiceSourceLinks(item).map((link) => ({
      url: link.url,
      label: link.label,
      sourceName: "Public customer voice",
      date: link.sourceDate,
      confidence: item.confidence,
      evidenceType: "Exact public customer record",
      ...pmmGovernanceFields(item),
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
  const sourcedTechnicalProof = pmmGovernedRecords(technicalProfile?.rows || [])
    .filter((row) => row.evidenceType !== "requires-controlled-testing" && row.watersValue && isHttpUrl(row.watersSourceUrl))
    .slice(0, 3)
    .map((row) => ({
      label: row.dimension,
      detail: row.watersValue,
      url: row.watersSourceUrl,
      date: technicalProfile?.asOfDate || "",
      watersProductId: technicalProfile?.watersId || waters?.id || "",
      ...pmmGovernanceFields(row),
    }));
  const productProof = pmmGovernedRecords(waters ? [waters] : []).flatMap((product) => (product.strengths || []).map((strength, index) => ({
    label: index === 0 ? waters.product : `${waters.product} proof point ${index + 1}`,
    detail: strength,
    url: waters.sourceUrl,
    date: waters.launchDate || waters.date || "",
    watersProductId: waters.id,
    ...pmmGovernanceFields(waters),
  })));
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
  const customerThemes = pmmGovernedRecords(customerVoiceItemsForHorizon(filters.horizon.value, { ignoreCompetitor: true }))
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

function pmmTargetCompetitorEvidenceSources(competitor, signals = pmmGovernedRecords(currentSignals())) {
  const applicationNotes = pmmGovernedRecords(currentCompetitorApplicationNotes())
    .filter((note) => note.competitor === competitor)
    .map((note) => ({
      url: note.sourceUrl,
      label: note.title,
      sourceName: note.sourceType || "Official application note",
      date: note.date,
      evidenceType: "Observed application evidence",
      detail: note.evidenceStatement,
      ...pmmGovernanceFields(note),
    }));
  const signalSources = pmmGovernedRecords(signals)
    .filter((signal) => signal.competitor === competitor)
    .map((signal) => ({
      url: signal.sourceUrl,
      label: signal.title,
      sourceName: signal.sourceName || "Public evidence source",
      date: signal.date,
      confidence: signal.confidence,
      evidenceType: signal.category || signal.signalType,
      detail: signal.summary,
      ...pmmGovernanceFields(signal),
    }));
  const launchSources = pmmGovernedRecords(currentLaunches())
    .filter((launch) => launch.competitor === competitor)
    .map((launch) => ({
      url: timelineUrlForLaunch(launch),
      label: launch.product,
      sourceName: launch.sourceName || "Official launch source",
      date: launch.date,
      confidence: launch.confidence,
      evidenceType: "Observed launch evidence",
      detail: launch.summary || launch.pmImplication,
      ...pmmGovernanceFields(launch),
    }));
  const conferenceSources = pmmGovernedRecords(currentConferenceSources()).flatMap((event) => {
    const content = pmmGovernedRecords(event.competitorContent || []).find((item) => String(item.competitor || "").includes(competitor));
    const watch = pmmGovernedRecords(event.competitorWatch || []).find((item) => item.name === competitor);
    if (!content && !watch) return [];
    return [{
      url: content?.sourceUrl || event.website || event.monitoringLinks?.[0]?.url,
      label: `${event.eventName} competitor evidence`,
      sourceName: event.eventName,
      date: event.startDate,
      evidenceType: content?.evidenceStatus || "Conference participation evidence",
      detail: content?.content || watch?.status,
      ...pmmGovernanceFields(content || watch || event),
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
  if (!pmmHasNarrowTarget()) return [];
  return pmmGovernedRecords(currentConferenceSources()).flatMap((event) => pmmGovernedRecords(event.boothRecommendations || [])
    .filter((item) => pmmTargetingMatches({ ...item, event }))
    .filter((item) => pmmWatersProductMatchesTarget(item))
    .filter((item) => isHttpUrl(item.productUrl))
    .map((item) => ({
      label: item.product,
      detail: item.message || item.role,
      url: item.productUrl,
      date: event.startDate,
      sourceName: "Waters public product source",
      evidenceType: "Observed Waters application context",
      watersProductId: pmmMatchingWatersProductIds(item)[0] || "",
      ...pmmGovernanceFields(item),
    })));
}

function pmmUsableText(value, fallback = "") {
  const text = String(value || "").trim();
  return text && !/\broadmap\b|product requirements?/i.test(text) ? text : fallback;
}

function pmmTargetingSelection() {
  const selectedWatersProduct = pmmSelectedWatersProduct();
  return {
    market: filters.segment.value,
    watersProduct: selectedWatersProduct?.product || "All",
    watersProductId: selectedWatersProduct?.id || "All",
    application: state.marketingTargeting.application,
    buyingSituation: state.marketingTargeting.buyingSituation,
    geography: filters.geo.value,
    buyerRole: state.marketingTargeting.buyerRole,
  };
}

function pmmTargetingKey(targeting = pmmTargetingSelection()) {
  return [targeting.market, targeting.watersProduct, targeting.application, targeting.buyingSituation, targeting.geography, targeting.buyerRole].join(" > ");
}

function pmmTargetingDisplayValue(value, allLabel) {
  return value === "All" ? allLabel : value;
}

function pmmGovernanceFields(record = {}) {
  return {
    fieldCitable: record.fieldCitable === true,
    approvalState: pmmEvidenceGovernance.normalizeApprovalState(record.approvalState),
  };
}

function pmmApprovalStateLabel(value) {
  return ({
    draft: "Draft — not approved",
    "in-review": "In review",
    approved: "Approved",
    blocked: "Blocked",
  })[pmmEvidenceGovernance.normalizeApprovalState(value)];
}

function pmmGovernedRecords(records = []) {
  return pmmEvidenceGovernance.filterRecords(records, state.marketingGovernanceFilters);
}

function pmmComparatorClaimEvidencePool() {
  const records = [];
  const visited = new WeakSet();
  const walk = (value) => {
    if (!value || typeof value !== "object" || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (Object.prototype.hasOwnProperty.call(value, "fieldCitable")) records.push(value);
    Object.values(value).forEach(walk);
  };
  [
    state.data,
    state.productData,
    state.conferenceData,
    state.conferencePrep,
    state.journalSources,
    state.competitorApplicationNotes,
    state.marketApplicationSources,
    state.productComparisons,
    state.historicalProductCatalog,
    state.historicalWatersCatalog,
    state.technicalComparisons,
    state.filingInsights,
    state.customerVoice,
  ].forEach(walk);
  return records;
}

function pmmProductComparatorClaimTransformation() {
  if (!productComparatorClaimTransformer) throw new Error("Product Comparator claim transformer failed to load");
  const eligibleLaunchIds = new Set(comparisonLaunches().map((launch) => launch.id));
  const selectedWatersProduct = pmmSelectedWatersProduct();
  const linkHealthIndex = pmmEvidenceGovernance.buildLinkHealthIndex(state.linkHealth || []);
  const transformation = productComparatorClaimTransformer.transformProductComparatorClaims({
    productComparisons: state.productComparisons,
    technicalComparisons: state.technicalComparisons,
    productLaunches: [
      ...(state.productData?.launches || []),
      ...(state.historicalProductCatalog?.products || []),
    ],
    eligibleLaunchIds,
    watersProductId: selectedWatersProduct?.id || "All",
    evidencePool: pmmComparatorClaimEvidencePool(),
    deriveFieldCitable: (record) => pmmEvidenceGovernance.deriveFieldCitable(record, {
      datasetName: "product_comparator_claim_evidence",
      linkHealthIndex,
    }),
  });
  gapQueue.splice(0, gapQueue.length, ...transformation.gapQueue);
  return {
    ...transformation,
    allClaimControlClaims: [...transformation.claimControlClaims],
    claimControlClaims: pmmGovernedRecords(transformation.claimControlClaims),
    gapQueue: [...gapQueue],
  };
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

function pmmWatersProductOptions() {
  return (state.productComparisons?.watersSystems || [])
    .filter((product) => product?.id && product?.product)
    .sort((left, right) => left.product.localeCompare(right.product));
}

function pmmSelectedWatersProduct() {
  if (state.marketingTargeting.watersProduct === "All") return null;
  return pmmWatersProductOptions().find((product) => product.id === state.marketingTargeting.watersProduct) || null;
}

function pmmWatersProductCode(productId) {
  return productId && productId !== "All"
    ? `WATERS_PRODUCT_${String(productId).toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`
    : "LC_PLATFORM";
}

function pmmWatersProductWorkflowCodes(productId) {
  const product = pmmWatersProductOptions().find((item) => item.id === productId);
  const technologyCode = /UHPLC|^LC$/i.test(product?.technology || "")
    ? "LC_PLATFORM"
    : /LC-MS\/MS/i.test(product?.technology || "")
      ? "LCMSMS_WORKFLOW"
      : /LC-MS/i.test(product?.technology || "")
        ? "LCMS_WORKFLOW"
        : /Software/i.test(product?.technology || "")
          ? "CDS_WORKFLOW"
          : "";
  return [...new Set([pmmWatersProductCode(productId), technologyCode].filter(Boolean))];
}

function pmmNormalizedProductText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function pmmWatersProductAliases(product) {
  if (!product) return [];
  const names = [
    product.id,
    product.product,
    String(product.product).split(/\s+with\s+/i)[0],
    String(product.product).replace(/\s+(?:system|workflow)$/i, ""),
  ];
  return [...new Set(names.map(pmmNormalizedProductText).filter((name) => name.length >= 5))];
}

function pmmMatchingWatersProductIds(item) {
  const explicitId = item?.watersProductId || item?.watersId || item?.closestWatersId;
  if (explicitId && pmmWatersProductOptions().some((product) => product.id === explicitId)) return [explicitId];
  const text = pmmNormalizedProductText(pmmRecordTargetingText(item));
  return pmmWatersProductOptions()
    .filter((product) => pmmWatersProductAliases(product).some((alias) => text.includes(alias)))
    .map((product) => product.id);
}

function pmmWatersProductMatchesTarget(item) {
  const selected = state.marketingTargeting.watersProduct;
  return selected === "All" || pmmMatchingWatersProductIds(item).includes(selected);
}

function pmmHasNarrowTarget({ includeBuyerRole = false } = {}) {
  return state.marketingTargeting.watersProduct !== "All"
    || state.marketingTargeting.application !== "All"
    || state.marketingTargeting.buyingSituation !== "All"
    || (includeBuyerRole && state.marketingTargeting.buyerRole !== "All");
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
  const watersProducts = pmmWatersProductOptions();
  if (state.marketingTargeting.watersProduct !== "All"
    && !watersProducts.some((product) => product.id === state.marketingTargeting.watersProduct)) {
    state.marketingTargeting.watersProduct = "All";
  }
  const applications = pmmApplicationsForSelectedMarket();
  if (state.marketingTargeting.application !== "All"
    && !applications.some((definition) => definition.value === state.marketingTargeting.application)) {
    state.marketingTargeting.application = "All";
  }
  const optionMarkup = (value, label, selected) => `<option value="${escapeHtml(value)}" ${selected === value ? "selected" : ""}>${escapeHtml(label)}</option>`;
  marketingTargetFilters.watersProduct.innerHTML = [
    optionMarkup("All", "Choose a Waters product", state.marketingTargeting.watersProduct),
    ...watersProducts.map((product) => optionMarkup(product.id, product.product, state.marketingTargeting.watersProduct)),
  ].join("");
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
  marketingGovernanceFilters.fieldCitable.value = state.marketingGovernanceFilters.fieldCitable;
  marketingGovernanceFilters.approvalState.value = state.marketingGovernanceFilters.approvalState;
}

const headToHeadStorageKey = "competition-engine:pmm-head-to-head:v1";
const headToHeadAttributes = [
  { key: "reliability", label: "Reliability", pattern: /reliab|uptime|failure|leak|pressure|robust|maintenance|diagnostic/i },
  { key: "method-transfer", label: "Method transfer", pattern: /method transfer|migration|continuity|validated method|equivalen|compatib/i },
  { key: "ease", label: "Ease of use", pattern: /ease|usability|setup|training|complex|guided|workflow friction/i },
  { key: "service", label: "Service", pattern: /service|support|repair|parts|preventive maintenance|response time/i },
  { key: "data-integrity", label: "Data integrity", pattern: /data integrity|audit|compliance|traceab|cds|software|data review/i },
  { key: "throughput", label: "Throughput", pattern: /throughput|speed|analysis time|cycle time|automation|walkaway|sample capacity/i },
];

function headToHeadBuildMatchModel() {
  if (!headToHeadProductMatchModel) return { watersProducts: [], competitorProducts: [], matches: [] };
  return headToHeadProductMatchModel.build({
    watersSystems: state.productComparisons?.watersSystems || [],
    thirdComparators: state.productComparisons?.thirdComparators || [],
    launchComparisons: state.productComparisons?.launchComparisons || [],
    launches: pmmGovernedRecords(state.productData?.launches || []),
    historicalProducts: pmmGovernedRecords(state.historicalProductCatalog?.products || []),
  });
}

function headToHeadCandidates(competitor = state.headToHead.activeCompetitor || filters.competitor.value) {
  const watersId = state.marketingTargeting.watersProduct;
  if (watersId === "All" || competitor === "All" || !headToHeadProductMatchModel) return [];
  return headToHeadProductMatchModel.candidates(state.headToHead.matchModel, watersId, competitor);
}

function headToHeadAvailableCompetitors() {
  if (state.marketingTargeting.watersProduct === "All") return [];
  const available = headToHeadProductMatchModel.availableCompetitors(
    state.headToHead.matchModel,
    state.marketingTargeting.watersProduct,
  );
  const ordered = [...primaryCompetitors, ...available.filter((competitor) => !primaryCompetitors.includes(competitor))]
    .filter((competitor, index, values) => available.includes(competitor) && values.indexOf(competitor) === index);
  return filters.competitor.value === "All" ? ordered : ordered.filter((competitor) => competitor === filters.competitor.value);
}

function initializeHeadToHeadSelection() {
  if (state.headToHead.initialized) return;
  state.headToHead.matchModel = headToHeadBuildMatchModel();
  const params = new URLSearchParams(window.location.search);
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(headToHeadStorageKey) || "{}"); } catch { stored = {}; }
  const fromUrl = params.has("h2hWaters") || params.has("h2hCompetitor") || params.has("h2hProduct");
  const selection = fromUrl ? {
    watersProduct: params.get("h2hWaters"),
    competitor: params.get("h2hCompetitor"),
    competitorProductId: params.get("h2hProduct"),
    market: params.get("h2hMarket"),
    application: params.get("h2hApplication"),
    buyingSituation: params.get("h2hSituation"),
    buyerRole: params.get("h2hBuyer"),
    geography: params.get("h2hGeo"),
  } : stored;
  if (selection.competitorProductOverrides && typeof selection.competitorProductOverrides === "object") state.headToHead.competitorProductOverrides = { ...selection.competitorProductOverrides };
  if (selection.watersProduct && state.headToHead.matchModel.watersProducts.some((product) => product.id === selection.watersProduct)) state.marketingTargeting.watersProduct = selection.watersProduct;
  if (selection.competitor) state.headToHead.activeCompetitor = selection.competitor;
  if (selection.competitorProductId && selection.competitor) state.headToHead.competitorProductOverrides[selection.competitor] = selection.competitorProductId;
  if (selection.market && [...filters.segment.options].some((option) => option.value === selection.market)) filters.segment.value = selection.market;
  if (selection.application) state.marketingTargeting.application = selection.application;
  if (selection.buyingSituation) state.marketingTargeting.buyingSituation = selection.buyingSituation;
  if (selection.buyerRole) state.marketingTargeting.buyerRole = selection.buyerRole;
  if (selection.geography && [...filters.geo.options].some((option) => option.value === selection.geography)) filters.geo.value = selection.geography;
  if (fromUrl) filters.role.value = "Marketing";
  state.headToHead.initialized = true;
}

function persistHeadToHeadSelection() {
  if (state.view !== "Marketing") return;
  const selection = {
    watersProduct: state.marketingTargeting.watersProduct,
    competitor: state.headToHead.activeCompetitor,
    competitorProductId: state.headToHead.competitorProductId,
    market: filters.segment.value,
    application: state.marketingTargeting.application,
    buyingSituation: state.marketingTargeting.buyingSituation,
    buyerRole: state.marketingTargeting.buyerRole,
    geography: filters.geo.value,
    competitorProductOverrides: state.headToHead.competitorProductOverrides,
  };
  try { localStorage.setItem(headToHeadStorageKey, JSON.stringify(selection)); } catch { /* device-local persistence unavailable */ }
  const url = new URL(window.location.href);
  if (selection.watersProduct !== "All" && selection.competitor && selection.competitorProductId) {
    url.searchParams.set("h2hWaters", selection.watersProduct);
    url.searchParams.set("h2hCompetitor", selection.competitor);
    url.searchParams.set("h2hProduct", selection.competitorProductId);
    const optionalParams = {
      h2hMarket: selection.market,
      h2hApplication: selection.application,
      h2hSituation: selection.buyingSituation,
      h2hBuyer: selection.buyerRole,
      h2hGeo: selection.geography,
    };
    Object.entries(optionalParams).forEach(([key, value]) => value && value !== "All" ? url.searchParams.set(key, value) : url.searchParams.delete(key));
  } else {
    ["h2hWaters", "h2hCompetitor", "h2hProduct", "h2hMarket", "h2hApplication", "h2hSituation", "h2hBuyer", "h2hGeo"].forEach((key) => url.searchParams.delete(key));
  }
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function normalizeHeadToHeadSelection() {
  state.headToHead.matchModel ||= headToHeadBuildMatchModel();
  const normalizedCompetitorFilter = headToHeadProductMatchModel.normalizeCompetitorFilter(
    state.headToHead.matchModel,
    state.marketingTargeting.watersProduct,
    filters.competitor.value,
  );
  if (filters.competitor.value !== normalizedCompetitorFilter) {
    filters.competitor.value = normalizedCompetitorFilter;
  }
  const competitors = headToHeadAvailableCompetitors();
  if (!competitors.includes(state.headToHead.activeCompetitor)) state.headToHead.activeCompetitor = competitors[0] || "";
  competitors.forEach((competitor) => {
    const candidates = headToHeadCandidates(competitor);
    if (!candidates.some((candidate) => candidate.competitorProductId === state.headToHead.competitorProductOverrides[competitor])) {
      state.headToHead.competitorProductOverrides[competitor] = candidates[0]?.competitorProductId || "";
    }
  });
  const candidates = headToHeadCandidates(state.headToHead.activeCompetitor);
  state.headToHead.competitorProductId = state.headToHead.competitorProductOverrides[state.headToHead.activeCompetitor] || candidates[0]?.competitorProductId || "";
  if (!headToHeadCompetitorProductFilter) return;
  headToHeadCompetitorProductFilter.disabled = !candidates.length;
  headToHeadCompetitorProductFilter.innerHTML = candidates.length
    ? candidates.map((candidate, index) => `<option value="${escapeHtml(candidate.competitorProductId)}" ${candidate.competitorProductId === state.headToHead.competitorProductId ? "selected" : ""}>${escapeHtml(candidate.competitorProduct)} · ${candidate.score}/100${index === 0 ? " · closest" : ""}</option>`).join("")
    : `<option value="">${state.marketingTargeting.watersProduct === "All" ? "Choose a Waters product" : "No catalog product match available"}</option>`;
  persistHeadToHeadSelection();
}

function headToHeadSelectedContext(competitor = state.headToHead.activeCompetitor, competitorProductId = state.headToHead.competitorProductOverrides[competitor]) {
  const match = headToHeadCandidates(competitor).find((candidate) => candidate.competitorProductId === competitorProductId);
  if (!match) return null;
  const waters = state.headToHead.matchModel.watersProducts.find((product) => product.id === match.watersProductId);
  const competitorProduct = state.headToHead.matchModel.competitorProducts.find((product) => product.id === match.competitorProductId);
  return waters && competitorProduct ? { match, waters, competitorProduct } : null;
}

function headToHeadProductMatchesRecord(record, product) {
  if (!record || !product) return false;
  const normalize = headToHeadProductMatchModel?.normalize || pmmNormalizedProductText;
  const text = normalize([record.product, record.platform, record.title, record.theme, record.summary, record.customerLanguageSignal].join(" "));
  const productText = normalize(product.product);
  if (text.includes(productText) || (normalize(record.product).length >= 6 && productText.includes(normalize(record.product)))) return true;
  const ignored = new Set(["system", "series", "platform", "stack", "with", "plus", "hplc", "uhplc", "uplc", "lc", "ms"]);
  const tokens = productText.split(" ").filter((token) => token.length >= 4 && !ignored.has(token));
  return tokens.length > 0 && tokens.slice(0, 2).every((token) => text.includes(token));
}

function headToHeadSource({ url, label, date, dateType = "Source date", sourceName = "Public source", confidence, independentSourceCount = 0, fieldCitable = false, approvalState = "draft" }) {
  return { url, label, date, dateType, sourceName, confidence, independentSourceCount: Number(independentSourceCount || 0), fieldCitable: fieldCitable === true, approvalState: pmmEvidenceGovernance.normalizeApprovalState(approvalState) };
}

function headToHeadCustomerRecords(company, product) {
  return pmmGovernedRecords(customerVoiceItemsForHorizon(filters.horizon.value, { ignoreCompetitor: true }))
    .filter((record) => record.company === company && headToHeadProductMatchesRecord(record, product))
    .filter((record) => pmmTargetingMatches(record, { includeBuyerRole: true }));
}

function headToHeadCustomerSources(record) {
  return customerVoiceSourceLinks(record).map((link) => headToHeadSource({
    url: link.url,
    label: link.label || `${record.company} customer-language evidence`,
    date: link.sourceDate || record.sourceDate,
    sourceName: record.sourceName || "Public customer source",
    confidence: record.confidence,
    ...pmmGovernanceFields(record),
  }));
}

function headToHeadClaim(statement, classification, sources = [], caveat = "") {
  const uniqueSources = pmmDeduplicateSources(sources.filter((source) => isHttpUrl(source.url)));
  const datedSources = uniqueSources.filter((source) => /^\d{4}-\d{2}-\d{2}$/.test(source.date || ""));
  const confidenceValues = uniqueSources.map((source) => Number(source.confidence)).filter((value) => Number.isFinite(value) && value > 0);
  const explicitIndependent = Math.max(0, ...uniqueSources.map((source) => Number(source.independentSourceCount || 0)));
  const establishedOrganizations = new Set(uniqueSources.filter((source) => source.independent === true && source.sourceOrganizationId).map((source) => source.sourceOrganizationId)).size;
  const independentSourceCount = Math.max(explicitIndependent, establishedOrganizations);
  const substantiation = independentSourceCount >= 2 ? "Proven" : datedSources.length ? "Directional" : "Unsupported";
  const fieldCitable = !/analyst|inference|rule-based|proposed/i.test(classification)
    && uniqueSources.some((source) => source.fieldCitable === true);
  return {
    statement: pmmUsableText(statement, "Claim unresolved"),
    classification,
    sources: uniqueSources,
    datedSourceCount: datedSources.length,
    independentSourceCount,
    confidence: confidenceValues.length ? Math.round(confidenceValues.reduce((total, value) => total + value, 0) / confidenceValues.length) : null,
    recency: datedSources.map((source) => source.date).sort().at(-1) || null,
    substantiation,
    fieldCitable,
    approvalState: "draft",
    caveat: caveat || (substantiation === "Unsupported" ? "No dated primary source supports this statement; exclude it from customer-facing use." : "Public evidence is directional and does not establish market prevalence or legal approval."),
  };
}

function headToHeadTechnicalEvidence(context) {
  const profile = pmmGovernedRecords(state.technicalComparisons?.profiles || []).find((item) => item.launchId === context.competitorProduct.id && (!item.watersId || item.watersId === context.waters.id));
  if (!profile) return { profile: null, rows: [] };
  return {
    profile,
    rows: pmmGovernedRecords(profile.rows || []).map((row) => ({
      row,
      watersSource: headToHeadSource({ url: row.watersSourceUrl, label: `${context.waters.product}: ${row.dimension}`, date: profile.asOfDate, dateType: "Evidence reviewed", sourceName: "Waters primary source", fieldCitable: false, approvalState: row.approvalState }),
      competitorSource: headToHeadSource({ url: row.competitorSourceUrl, label: `${context.competitorProduct.product}: ${row.dimension}`, date: profile.asOfDate, dateType: "Evidence reviewed", sourceName: `${context.match.competitor} primary source`, ...pmmGovernanceFields(row) }),
    })),
  };
}

function headToHeadWins(context, technical) {
  const supportedClaims = state.marketingWorkspaceModel?.productComparatorSupportedClaims || [];
  return supportedClaims
    .filter((candidate) => candidate.watersProduct === context.waters.product
      && candidate.competitorProduct === context.competitorProduct.product
      && candidate.fieldUsable === true)
    .map((candidate) => ({
      ...headToHeadClaim(
        candidate.claimText,
        "Field-citable Product Comparator advantage",
        candidate.supportingEvidence,
        "Use only the exact proposed wording and preserve the conditions in each cited proof record.",
      ),
      approvalState: candidate.approvalState,
      fieldCitable: true,
    }));
}

function headToHeadWeaknesses(context, competitorRecords) {
  return competitorRecords.filter((record) => /negative|mixed|neutral/i.test(record.sentiment || ""))
    .map((record) => headToHeadClaim(
      record.theme,
      "Observed customer concern",
      headToHeadCustomerSources(record),
      `${record.sentiment} public customer record; it surfaces a concern, not representative market prevalence.`,
    ))
    .filter((claim) => claim.datedSourceCount > 0);
}

function headToHeadScorecard(watersRecords, competitorRecords) {
  const sentimentScore = { Positive: 5, Neutral: 3, Mixed: 3, Negative: 1 };
  const rows = headToHeadAttributes.map((attribute) => {
    const waters = watersRecords.filter((record) => attribute.pattern.test(`${record.category} ${record.theme} ${record.buyingPriority}`));
    const competitor = competitorRecords.filter((record) => attribute.pattern.test(`${record.category} ${record.theme} ${record.buyingPriority}`));
    const all = [...waters, ...competitor];
    const sourceCount = pmmDeduplicateSources(all.flatMap(headToHeadCustomerSources)).filter((source) => /^\d{4}-\d{2}-\d{2}$/.test(source.date || "")).length;
    const score = (records) => records.length ? records.reduce((total, record) => total + (sentimentScore[record.sentiment] || 3), 0) / records.length : null;
    return { ...attribute, watersRecords: waters, competitorRecords: competitor, sourceCount, watersScore: score(waters), competitorScore: score(competitor) };
  });
  const totalSignals = rows.reduce((total, row) => total + row.sourceCount, 0);
  let assigned = 0;
  rows.forEach((row, index) => {
    row.weight = totalSignals ? (index === rows.length - 1 ? 100 - assigned : Math.round((row.sourceCount / totalSignals) * 100)) : 0;
    assigned += row.weight;
    row.weightedDifference = row.watersScore == null || row.competitorScore == null ? null : (row.weight / 100) * (row.watersScore - row.competitorScore);
    row.sources = pmmDeduplicateSources([...row.watersRecords, ...row.competitorRecords].flatMap(headToHeadCustomerSources));
    row.confidence = averageConfidence([...row.watersRecords, ...row.competitorRecords]);
  });
  const eligible = rows.filter((row) => row.weightedDifference != null && row.weightedDifference > 0);
  const swingAttribute = [...eligible].sort((left, right) => (right.weightedDifference ?? -Infinity) - (left.weightedDifference ?? -Infinity))[0] || null;
  return { rows, totalSignals, weightTotal: rows.reduce((total, row) => total + row.weight, 0), swingAttribute };
}

function headToHeadTargetContext() {
  const targeting = pmmTargetingSelection();
  return {
    ...targeting,
    marketLabel: pmmTargetingDisplayValue(targeting.market, "all supported markets"),
    applicationLabel: pmmTargetingDisplayValue(targeting.application, "the selected analytical workflow"),
    buyingSituationLabel: pmmTargetingDisplayValue(targeting.buyingSituation, "an active system evaluation"),
    buyerRoleLabel: pmmTargetingDisplayValue(targeting.buyerRole, "the laboratory buying committee"),
  };
}

function headToHeadNextStep(targeting, swingAttribute) {
  if (targeting.buyingSituation === "Validated-method migration") return "Offer a method-migration workshop: agree the incumbent method, transfer acceptance criteria, validation burden, and proof package before proposing a switch.";
  if (targeting.buyingSituation === "Waters installed-base upgrade") return "Offer an installed-base workflow assessment that documents method continuity, training impact, data-system compatibility, and the acceptance plan for the upgrade.";
  if (targeting.buyingSituation === "Greenfield") return "Run a workflow-design session and agree the evaluation method, success criteria, onboarding plan, and data-integrity requirements before configuration selection.";
  if (targeting.buyingSituation === "Competitive replacement") return `Propose a controlled side-by-side evaluation${swingAttribute ? ` centered on ${swingAttribute.label.toLowerCase()}` : " using the customer’s ranked buying criteria"}, with agreed acceptance criteria and source-backed proof.`;
  return `Agree the buying criteria, then propose a controlled evaluation${swingAttribute ? ` centered on ${swingAttribute.label.toLowerCase()}` : " using a representative workflow"}.`;
}

function buildHeadToHeadComparisonModel(context = headToHeadSelectedContext()) {
  if (!context) return null;
  const targeting = headToHeadTargetContext();
  const watersRecords = headToHeadCustomerRecords("Waters", context.waters);
  const competitorRecords = headToHeadCustomerRecords(context.match.competitor, context.competitorProduct);
  const technical = headToHeadTechnicalEvidence(context);
  const wins = headToHeadWins(context, technical);
  const weaknesses = headToHeadWeaknesses(context, competitorRecords);
  const scorecard = headToHeadScorecard(watersRecords, competitorRecords);
  const comparison = comparisonByLaunchId(context.competitorProduct.id);
  const pointOfParity = context.match.similarityBasis.techniqueClass.status === "Match"
    ? `Both products compete in the ${context.match.similarityBasis.techniqueClass.waters} reference class.`
    : `The matchup spans ${context.match.similarityBasis.techniqueClass.waters} and ${context.match.similarityBasis.techniqueClass.competitor}; validate configuration equivalence.`;
  const pointOfDifference = pmmUsableText(comparison?.watersPositioning, context.waters.decisionRole || "Differentiation requires customer validation.");
  const positioning = `For ${targeting.buyerRoleLabel} in ${targeting.marketLabel} evaluating ${context.competitorProduct.product} for ${targeting.applicationLabel}, position ${context.waters.product} as ${context.waters.decisionRole || "the Waters workflow alternative"}.`;
  const catalogSource = headToHeadSource({
    url: context.match.source.watersUrl || context.waters.sourceUrl,
    label: `${context.waters.product} product source`,
    date: context.match.source.watersDate || (context.waters.introducedYear ? `${context.waters.introducedYear}-01-01` : ""),
    dateType: "Catalog date",
    sourceName: context.waters.sourceName || "Waters product source",
    confidence: context.waters.confidence,
    fieldCitable: false,
    approvalState: context.waters.approvalState,
  });
  const catalogReasons = (context.waters.strengths || []).map((strength) => headToHeadClaim(
    strength,
    "Analyst-curated Waters product-catalog evidence",
    [catalogSource],
    "This is proposed positioning derived from the linked Waters product record. It is not an approved comparative claim and must not be presented as measured superiority.",
  ));
  const matchupReason = headToHeadClaim(
    pointOfDifference,
    "Analyst/rule-based matchup positioning",
    [catalogSource, headToHeadSource({
      url: context.match.source.competitorUrl,
      label: `${context.competitorProduct.product} product source`,
      date: context.match.source.competitorDate,
      sourceName: `${context.match.competitor} product source`,
      ...pmmGovernanceFields(context.competitorProduct),
    })],
    "This is a proposed counter-position derived from the two linked product records. It is not an approved Waters claim or controlled superiority finding.",
  );
  const observedWatersReasons = watersRecords.filter((record) => /positive/i.test(record.sentiment || "")).map((record) => headToHeadClaim(
    record.customerLanguageSignal || record.theme,
    "Observed Waters customer language",
    headToHeadCustomerSources(record),
    `${record.sentiment} public customer record; useful for language and objections, not market prevalence.`,
  ));
  const watersReasons = [...wins, ...observedWatersReasons]
    .filter((claim, index, items) => items.findIndex((item) => item.statement === claim.statement) === index)
    .slice(0, 3);
  const positioningHypotheses = [matchupReason, ...catalogReasons]
    .filter((claim, index, items) => items.findIndex((item) => item.statement === claim.statement) === index)
    .slice(0, 3);
  const customerTalk = [...watersRecords, ...competitorRecords]
    .filter((record) => record.customerLanguageSignal)
    .map((record) => headToHeadClaim(record.customerLanguageSignal, "Observed customer language", headToHeadCustomerSources(record), record.caveat));
  const talkTrack = [...watersReasons, ...customerTalk].filter((claim, index, items) => items.findIndex((item) => item.statement === claim.statement) === index).slice(0, 5);
  const servicePattern = /service|support|repair|parts|uptime|maintenance|training|software|data integrity|method transfer|migration/i;
  const serviceClaims = [...watersRecords, ...competitorRecords].filter((record) => servicePattern.test(`${record.category} ${record.theme} ${record.pmInterpretation}`))
    .map((record) => headToHeadClaim(`${record.company}: ${record.theme}`, "Observed customer service/workflow concern", headToHeadCustomerSources(record), record.caveat));
  const evcDimensions = [
    ["Purchase price", /purchase price|acquisition|capital cost|instrument price/],
    ["Implementation and training", /implementation|installation|training|onboarding|setup/],
    ["Workflow operating cost", /workflow cost|consumable|rework|failed run|review time|processing/],
    ["Reliability and downtime", /downtime|uptime|failure|reliab/],
    ["Serviceability and service burden", /serviceability|service|repair|maintenance|parts/],
    ["Expected lifecycle", /lifecycle|useful life|obsolescence|support period|replacement cycle/],
  ].map(([label, pattern]) => {
    const records = [...watersRecords, ...competitorRecords].filter((record) => pattern.test(`${record.category} ${record.theme} ${record.customerLanguageSignal}`));
    return { label, records, sources: pmmDeduplicateSources(records.flatMap(headToHeadCustomerSources)), assumption: records.length ? "Value magnitude remains an assumption; no comparable monetary input is loaded." : "Assumption required — no product-specific value evidence is loaded." };
  });
  const objections = technical.rows.slice(0, 3).map(({ row, watersSource, competitorSource }) => ({
    competitorClaim: headToHeadClaim(row.competitorValue, "Observed competitor-published value", [competitorSource], row.interpretation),
    response: headToHeadClaim(row.watersValue, "Observed Waters-published value", [watersSource], row.interpretation),
  }));
  const watersConcerns = watersRecords.filter((record) => /negative|mixed|neutral/i.test(record.sentiment || "")).map((record) => ({
    concern: headToHeadClaim(record.theme, "Observed Waters customer concern", headToHeadCustomerSources(record), record.caveat),
    response: `Address directly with a controlled evaluation, documented acceptance criterion, and service/migration plan; no resolved performance claim is available in the current evidence.`,
  }));
  const substantiated = (claim) => claim.substantiation !== "Unsupported";
  const exportClaims = [...talkTrack, ...wins, ...weaknesses, ...serviceClaims, ...objections.flatMap((item) => [item.competitorClaim, item.response])].filter(substantiated);
  const evidenceGaps = [
    !wins.length ? "No dated, directly comparable source establishes a Waters superiority claim for this exact pair." : "",
    !weaknesses.length ? "No dated product-specific public weakness record was located for the competitor product." : "",
    !serviceClaims.length ? "Product-specific service/support evidence is missing." : "",
    !scorecard.totalSignals ? "No product-specific customer buying-signal records can support scorecard weights." : "",
    !evcDimensions.some((item) => item.records.length) ? "No product-specific cost/value record supports an EVC input." : "",
    pmmHasNarrowTarget({ includeBuyerRole: true }) && !watersRecords.length && !competitorRecords.length ? `No product-specific customer-language record matches ${targeting.marketLabel}, ${targeting.applicationLabel}, ${targeting.buyingSituationLabel}, and ${targeting.buyerRoleLabel}.` : "",
  ].filter(Boolean);
  const reasonSummary = watersReasons.map((claim) => claim.statement.replace(/[.]+$/, "")).join("; ");
  const tailoredPitch = reasonSummary
    ? `For ${targeting.buyerRoleLabel} evaluating ${context.competitorProduct.product}, test ${context.waters.product} against the customer’s ${targeting.applicationLabel} criteria. The current public evidence supports this direction: ${reasonSummary}. This is evidence-backed but not an approved comparative claim; keep the cited conditions and propose the controlled next step below.`
    : `Do not assert that ${context.waters.product} is superior to ${context.competitorProduct.product}: no dated, directly comparable public proof supports that claim under the current filters. Lead with the customer’s ${targeting.applicationLabel} decision criteria, expose the switching risk, and propose the controlled evaluation below.`;
  const nextStep = headToHeadNextStep(targeting, scorecard.swingAttribute);
  return { ...context, targeting, positioning, tailoredPitch, nextStep, pointOfParity, pointOfDifference, watersReasons, positioningHypotheses, watersRecords, competitorRecords, technical, talkTrack, wins, weaknesses, scorecard, serviceClaims, evcDimensions, objections, watersConcerns, exportClaims, evidenceGaps, approvalState: "draft" };
}

function headToHeadSourceMarkup(source) {
  if (!isHttpUrl(source.url)) return `<span class="pmm-unresolved">Source unavailable</span>`;
  const date = source.date ? formatDate(source.date) : "Date unresolved";
  return `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.label || "Open source")} ↗<small>${escapeHtml(source.dateType || "Source date")}: ${escapeHtml(date)}</small></a>`;
}

function headToHeadClaimMarkup(claim) {
  return `<article class="pmm-h2h-claim" data-substantiation="${escapeHtml(claim.substantiation)}"><header><span class="pmm-h2h-badge pmm-h2h-${claim.substantiation.toLowerCase()}">${escapeHtml(claim.substantiation)}</span><small>${escapeHtml(claim.classification)}</small></header><p>${escapeHtml(claim.statement)}</p><div class="pmm-h2h-claim-meta"><span>${claim.datedSourceCount} dated source${claim.datedSourceCount === 1 ? "" : "s"}</span><span>${claim.independentSourceCount} established independent source organization${claim.independentSourceCount === 1 ? "" : "s"}</span><span>${claim.confidence == null ? "Confidence not established" : `Confidence ${claim.confidence}%`}</span><span>${claim.recency ? `Latest dated evidence ${formatDate(claim.recency)}` : "Recency not established"}</span><span>${escapeHtml(pmmApprovalStateLabel(claim.approvalState))}</span></div><div class="pmm-h2h-sources">${claim.sources.length ? claim.sources.map(headToHeadSourceMarkup).join("") : `<span class="pmm-unresolved">No source available</span>`}</div><details><summary>Evidence caveat</summary><p>${escapeHtml(claim.caveat)}</p></details></article>`;
}

function headToHeadClaimsSection(title, description, claims, emptyMessage) {
  return `<section class="pmm-h2h-section"><header><h4>${escapeHtml(title)}</h4><p>${escapeHtml(description)}</p></header>${claims.length ? `<div class="pmm-h2h-claims">${claims.map(headToHeadClaimMarkup).join("")}</div>` : `<div class="empty"><strong>Evidence-poor</strong><span>${escapeHtml(emptyMessage)}</span></div>`}</section>`;
}

function renderLegacyHeadToHeadComparison() {
  const target = byId("pmmHeadToHeadComparison");
  if (!target) return;
  const model = buildHeadToHeadComparisonModel();
  state.headToHead.model = model;
  if (!model) {
    target.innerHTML = pmmEmptyState("Choose a Waters product and a specific competitor above. The closest competitor product will be suggested from the governed product-match model.");
    return;
  }
  const scoreRows = model.scorecard.rows.map((row) => `<tr><th scope="row">${escapeHtml(row.label)}</th><td>${row.weight}%<small>${row.sourceCount} dated buying-signal source${row.sourceCount === 1 ? "" : "s"}</small></td><td>${row.watersScore == null ? "Not established" : row.watersScore.toFixed(1)}</td><td>${row.competitorScore == null ? "Not established" : row.competitorScore.toFixed(1)}</td><td>${row.weightedDifference == null ? "Unavailable" : row.weightedDifference.toFixed(2)}</td><td>${row.sources.length ? row.sources.slice(0, 2).map(headToHeadSourceMarkup).join("") : "Evidence unavailable"}</td></tr>`).join("");
  const basis = model.match.similarityBasis;
  target.innerHTML = `<div class="pmm-h2h-hero"><div><span>Governed matchup · ${escapeHtml(pmmApprovalStateLabel(model.approvalState))}</span><h3>${escapeHtml(model.waters.product)} <b>vs</b> ${escapeHtml(model.competitorProduct.product)}</h3><p>${escapeHtml(model.positioning)}</p></div><div class="pmm-h2h-actions"><button type="button" data-h2h-copy>Copy talk track</button><button type="button" data-h2h-export-pptx>Export battlecard PPTX</button><button type="button" data-h2h-print>Print / save PDF</button><span aria-live="polite"></span></div></div>
    <section class="pmm-h2h-match-basis"><header><div><span>Closest-product suggestion</span><strong>${model.match.score}/100 deterministic similarity</strong></div><small>${basis.explicitClosestMapping ? "Existing closest-comparator mapping" : "Ranked catalog fit"} · override remains available above</small></header><dl><div><dt>Technique class</dt><dd>${escapeHtml(basis.techniqueClass.waters)} vs ${escapeHtml(basis.techniqueClass.competitor)} · ${escapeHtml(basis.techniqueClass.status)}</dd></div><div><dt>Pressure range</dt><dd>${escapeHtml(basis.pressureRange.waters)} vs ${escapeHtml(basis.pressureRange.competitor)} · ${escapeHtml(basis.pressureRange.status)}</dd></div><div><dt>Segment overlap</dt><dd>${escapeHtml(basis.segment.overlap.join(", ") || "None coded")}</dd></div><div><dt>Positioning tier</dt><dd>${escapeHtml(basis.positioningTier.waters)} vs ${escapeHtml(basis.positioningTier.competitor)} · ${escapeHtml(basis.positioningTier.classification)}</dd></div></dl><p>${escapeHtml(basis.method)}</p><div class="pmm-h2h-match-sources">${headToHeadSourceMarkup(headToHeadSource({ url: model.match.source.watersUrl, label: `${model.waters.product} catalog source`, date: model.match.source.watersDate, dateType: "Catalog date" }))}${headToHeadSourceMarkup(headToHeadSource({ url: model.match.source.competitorUrl, label: `${model.competitorProduct.product} catalog source`, date: model.match.source.competitorDate }))}</div></section>
    <section class="pmm-h2h-position"><div><span>Target</span><strong>${escapeHtml(model.waters.bestFor?.join(", ") || "Target unresolved")}</strong></div><div><span>Reference class / parity</span><strong>${escapeHtml(model.pointOfParity)}</strong></div><div><span>Point of difference</span><strong>${escapeHtml(model.pointOfDifference)}</strong><small>Proposed — not approved</small></div></section>
    ${headToHeadClaimsSection("Messaging / Talk Track", "Customer-ready statements are limited to dated, linked evidence. Copy/export excludes Unsupported items.", model.talkTrack, "No substantiated customer-ready talking point is available for this exact pair.")}
    ${headToHeadClaimsSection("Where Waters Wins", "Only directly supported comparative advantages appear here.", model.wins, "No dated, directly comparable public evidence establishes a Waters superiority claim for this exact pair.")}
    ${headToHeadClaimsSection("Where the Competitor Is Weak / Lacking", "Only dated product-specific public concerns qualify.", model.weaknesses, "No public evidence of a weakness on this dimension.")}
    <section class="pmm-h2h-section"><header><h4>Attribute Scorecard</h4><p>Weights are calculated from dated product-specific customer buying signals; scores are sentiment-coded evidence, not measured performance ratings.</p></header>${model.scorecard.totalSignals ? `<div class="table-scroll"><table class="pmm-h2h-scorecard"><thead><tr><th>Attribute</th><th>Importance</th><th>Waters score</th><th>Competitor score</th><th>Weighted difference</th><th>Evidence</th></tr></thead><tbody>${scoreRows}</tbody></table></div><p class="pmm-h2h-swing"><strong>Swing attribute:</strong> ${model.scorecard.swingAttribute ? `${escapeHtml(model.scorecard.swingAttribute.label)} · calculated weighted difference ${model.scorecard.swingAttribute.weightedDifference.toFixed(2)}` : "Unavailable — both products need evidence on the same weighted attribute."} <small>Weights total ${model.scorecard.weightTotal}%.</small></p>` : `<div class="empty"><strong>Scorecard unavailable</strong><span>No product-specific dated buying-signal evidence can support real weights or scores.</span></div>`}</section>
    ${headToHeadClaimsSection("Service & Support", "Serviceability, uptime, training, software, data integrity, and migration evidence for the selected products.", model.serviceClaims, "No product-specific dated service/support evidence is available.")}
    <section class="pmm-h2h-section"><header><h4>Total Cost / Value</h4><p>Qualitative EVC framing against ${escapeHtml(model.competitorProduct.product)}. No acquisition price or monetary conversion is inferred.</p></header><div class="pmm-h2h-evc">${model.evcDimensions.map((item) => `<article><strong>${escapeHtml(item.label)}</strong><span>${item.records.length ? `${item.records.length} matching evidence record${item.records.length === 1 ? "" : "s"}` : "Evidence unavailable"}</span><p>${escapeHtml(item.assumption)}</p>${item.sources.slice(0, 2).map(headToHeadSourceMarkup).join("")}</article>`).join("")}</div></section>
    <section class="pmm-h2h-section"><header><h4>Objection Handling</h4><p>Published competitor statements and Waters responses remain paired with their exact evidence.</p></header>${model.objections.length ? `<div class="pmm-h2h-objections">${model.objections.map((item) => `<article><div><span>What the competitor may claim</span>${headToHeadClaimMarkup(item.competitorClaim)}</div><div><span>Evidence-backed Waters response</span>${headToHeadClaimMarkup(item.response)}</div></article>`).join("")}</div>` : `<div class="empty"><strong>Objections unresolved</strong><span>No exact paired technical comparison is available.</span></div>`}${model.watersConcerns.length ? `<div class="pmm-h2h-waters-concerns"><h5>Known Waters Concerns to Address</h5>${model.watersConcerns.map((item) => `<article>${headToHeadClaimMarkup(item.concern)}<p><strong>How to address:</strong> ${escapeHtml(item.response)}</p></article>`).join("")}</div>` : ""}</section>
    <section class="pmm-h2h-nudge"><span>Recommended Customer Nudge · Analyst/rule-based inference</span><strong>${model.scorecard.swingAttribute ? `Propose a controlled side-by-side evaluation centered on ${escapeHtml(model.scorecard.swingAttribute.label.toLowerCase())}, using an agreed method, acceptance criteria, and the cited evidence.` : `Ask the customer to agree the decision criteria and run a controlled side-by-side evaluation; the current evidence cannot identify a defensible swing attribute.`}</strong><small>No approval, owner, deadline, or outcome is implied.</small></section>
    <section class="pmm-h2h-gaps"><header><h4>Evidence Gaps to Substantiate</h4><span>${model.evidenceGaps.length}</span></header>${model.evidenceGaps.length ? `<ul>${model.evidenceGaps.map((gap) => `<li>${escapeHtml(gap)}</li>`).join("")}</ul>` : `<p>No feature-specific evidence gap detected.</p>`}</section>`;
}

function headToHeadBattlecardModels() {
  return headToHeadAvailableCompetitors().map((competitor) => buildHeadToHeadComparisonModel(headToHeadSelectedContext(
    competitor,
    state.headToHead.competitorProductOverrides[competitor],
  ))).filter(Boolean);
}

function headToHeadProductPickerMarkup() {
  const options = pmmWatersProductOptions().map((product) => `<option value="${escapeHtml(product.id)}">${escapeHtml(product.product)}</option>`).join("");
  return `<section class="pmm-h2h-product-gateway"><div><span>Start with Waters</span><h4>Which Product Are You Selling?</h4><p>Select one Waters product. The workspace will find its closest alternatives and create a battlecard for every available competitor.</p></div><label>Waters product<select data-h2h-product-picker><option value="All">Choose a product…</option>${options}</select></label><ol><li><strong>Choose the product</strong><small>From the governed Waters catalog</small></li><li><strong>Tailor the audience</strong><small>Market, workflow, buying situation, and buyer role</small></li><li><strong>Use the pitch</strong><small>Select a competitor battlecard, copy, or export</small></li></ol></section>`;
}

function headToHeadContextChips(model) {
  const values = [
    model.targeting.marketLabel,
    model.targeting.applicationLabel,
    model.targeting.buyingSituationLabel,
    model.targeting.buyerRoleLabel,
  ];
  return `<div class="pmm-h2h-context-chips" aria-label="Pitch targeting">${values.map((value) => `<span>${escapeHtml(value)}</span>`).join("")}</div>`;
}

function headToHeadCardMarkup(model, active) {
  const candidates = headToHeadCandidates(model.match.competitor);
  const reasons = model.watersReasons.length
    ? model.watersReasons.map((claim) => `<li><strong>${escapeHtml(claim.statement)}</strong><small>${escapeHtml(claim.substantiation)} · ${claim.datedSourceCount} dated source${claim.datedSourceCount === 1 ? "" : "s"}</small></li>`).join("")
    : `<li class="pmm-battlecard-no-claim"><strong>No defensible public superiority claim is loaded.</strong><small>Use question-led discovery and commission the controlled comparison in the selected pitch.</small></li>`;
  const substantiatedCount = model.wins.filter((claim) => claim.substantiation !== "Unsupported").length;
  return `<article class="pmm-product-battlecard ${active ? "is-active" : ""}">
    <header><div><span>${escapeHtml(model.match.competitor)} battlecard</span><h5>${escapeHtml(model.competitorProduct.product)}</h5></div><b>${model.match.score}/100 match</b></header>
    <p class="pmm-product-battlecard-thesis">Defensible reasons to prefer ${escapeHtml(model.waters.product)}:</p>
    <ul>${reasons}</ul>
    <div class="pmm-product-battlecard-meta"><span>${substantiatedCount} sourced comparative advantage${substantiatedCount === 1 ? "" : "s"}</span><span>${model.evidenceGaps.length} proof gap${model.evidenceGaps.length === 1 ? "" : "s"}</span><span>DRAFT — NOT APPROVED</span></div>
    <label>Compared product<select data-h2h-product-override="${escapeHtml(model.match.competitor)}">${candidates.map((candidate, index) => `<option value="${escapeHtml(candidate.competitorProductId)}" ${candidate.competitorProductId === model.competitorProduct.id ? "selected" : ""}>${escapeHtml(candidate.competitorProduct)}${index === 0 ? " · closest" : ""}</option>`).join("")}</select></label>
    <button type="button" data-h2h-competitor="${escapeHtml(model.match.competitor)}" aria-pressed="${active}">${active ? "Pitch selected" : "Build tailored pitch"}</button>
  </article>`;
}

function headToHeadPitchReasonMarkup(claim, index) {
  return `<article><span>${index + 1}</span><div><h5>${escapeHtml(claim.statement)}</h5><p>${escapeHtml(claim.classification)} · ${escapeHtml(claim.substantiation)} · ${escapeHtml(pmmApprovalStateLabel(claim.approvalState))}</p>${claim.sources[0] ? `<div class="pmm-h2h-pitch-source">${headToHeadSourceMarkup(claim.sources[0])}</div>` : `<small class="pmm-unresolved">Proof source unresolved</small>`}</div></article>`;
}

function headToHeadProofDrawerMarkup(model) {
  const scoreRows = model.scorecard.rows.map((row) => `<tr><th scope="row">${escapeHtml(row.label)}</th><td>${row.weight}%</td><td>${row.watersScore == null ? "Not established" : row.watersScore.toFixed(1)}</td><td>${row.competitorScore == null ? "Not established" : row.competitorScore.toFixed(1)}</td><td>${row.weightedDifference == null ? "Unavailable" : row.weightedDifference.toFixed(2)}</td></tr>`).join("");
  return `<details class="pmm-h2h-proof-drawer"><summary><span>Proof, weaknesses, scorecard, and caveats</span><small>Open evidence detail</small></summary><div>
    ${headToHeadClaimsSection("Where Waters Wins", "Only sourced comparative advantages appear here.", model.wins, "No dated, directly comparable public evidence establishes a Waters superiority claim for this exact pair.")}
    ${headToHeadClaimsSection("Competitor Weaknesses", "Only dated product-specific public concerns qualify.", model.weaknesses, "No public evidence of a weakness on this dimension.")}
    ${headToHeadClaimsSection("Service & Support", "Product-specific service, uptime, software, data-integrity, and migration evidence.", model.serviceClaims, "No product-specific dated service/support evidence is available.")}
    <section class="pmm-h2h-section"><header><h4>Buying-Attribute Scorecard</h4><p>Evidence-frequency weights and sentiment-coded observations—not measured performance.</p></header>${model.scorecard.totalSignals ? `<div class="table-scroll"><table class="pmm-h2h-scorecard"><thead><tr><th>Attribute</th><th>Weight</th><th>Waters</th><th>Competitor</th><th>Weighted difference</th></tr></thead><tbody>${scoreRows}</tbody></table></div>` : `<div class="empty"><strong>Scorecard unavailable</strong><span>No product-specific customer evidence supports comparable scores.</span></div>`}</section>
    <section class="pmm-h2h-section"><header><h4>Value Assumptions</h4><p>Qualitative EVC against ${escapeHtml(model.competitorProduct.product)}; no price or ROI is inferred.</p></header><div class="pmm-h2h-evc">${model.evcDimensions.map((item) => `<article><strong>${escapeHtml(item.label)}</strong><span>${item.records.length ? `${item.records.length} evidence record${item.records.length === 1 ? "" : "s"}` : "Assumption"}</span><p>${escapeHtml(item.assumption)}</p></article>`).join("")}</div></section>
    <section class="pmm-h2h-gaps"><header><h4>Evidence Gaps</h4><span>${model.evidenceGaps.length}</span></header>${model.evidenceGaps.length ? `<ul>${model.evidenceGaps.map((gap) => `<li>${escapeHtml(gap)}</li>`).join("")}</ul>` : `<p>No feature-specific evidence gap detected.</p>`}</section>
  </div></details>`;
}

function renderHeadToHeadComparison() {
  const target = byId("pmmHeadToHeadComparison");
  if (!target) return;
  const waters = pmmSelectedWatersProduct();
  if (!waters) {
    state.headToHead.model = null;
    state.headToHead.models = [];
    target.innerHTML = headToHeadProductPickerMarkup();
    return;
  }
  const models = headToHeadBattlecardModels();
  state.headToHead.models = models;
  if (!models.length) {
    state.headToHead.model = null;
    target.innerHTML = `<section class="pmm-h2h-product-gateway"><div><span>${escapeHtml(waters.product)}</span><h4>No Competitor Battlecard Matches the Current Competitor Filter</h4><p>Reset the optional competitor filter to All or choose another cataloged competitor.</p></div></section>`;
    return;
  }
  const active = models.find((model) => model.match.competitor === state.headToHead.activeCompetitor) || models[0];
  state.headToHead.activeCompetitor = active.match.competitor;
  state.headToHead.competitorProductId = active.competitorProduct.id;
  state.headToHead.model = active;
  const objection = active.objections.find((item) => item.competitorClaim || item.response);
  const objectionMarkup = objection
    ? `<div><span>Likely competitor claim</span><strong>${escapeHtml(objection.competitorClaim.statement)}</strong></div><div><span>Your response</span><strong>${escapeHtml(objection.response.statement)}</strong><small>Use only with the linked evidence and caveat.</small></div>`
    : `<div><span>Likely competitor claim</span><strong>Not established for this exact matchup.</strong></div><div><span>Your response</span><strong>Ask the customer to rank the buying criteria before asserting a product advantage.</strong></div>`;
  target.innerHTML = `<section class="pmm-h2h-product-summary"><div><span>Selected Waters product</span><h4>${escapeHtml(waters.product)}</h4><p>${escapeHtml(waters.decisionRole || "Product positioning unresolved")}</p></div>${headToHeadContextChips(active)}</section>
    <section class="pmm-battlecard-selector"><header><div><span>Battlecard library</span><h4>Who Are You Competing Against?</h4></div><p>${models.length} closest catalog matchup${models.length === 1 ? "" : "s"}. Choose one to create the tailored pitch; override the matched product when needed.</p></header><div class="pmm-product-battlecards">${models.map((model) => headToHeadCardMarkup(model, model === active)).join("")}</div></section>
    <section class="pmm-tailored-pitch" aria-labelledby="pmmTailoredPitchTitle"><header><div><span>Seller-ready draft · ${escapeHtml(pmmApprovalStateLabel(active.approvalState))}</span><h4 id="pmmTailoredPitchTitle">Tailored pitch: ${escapeHtml(active.waters.product)} vs ${escapeHtml(active.competitorProduct.product)}</h4></div><div class="pmm-h2h-actions"><button type="button" data-h2h-copy>Copy tailored pitch</button><button type="button" data-h2h-export-pptx>Export battlecard PPTX</button><button type="button" data-h2h-print>Print / save PDF</button><span aria-live="polite"></span></div></header>
      <blockquote>${escapeHtml(active.tailoredPitch)}</blockquote>
      <section class="pmm-pitch-reasons"><header><span>Why Waters for this customer</span><p>Only dated comparative proof or observed product-specific customer language appears here. Catalog positioning hypotheses are excluded.</p></header><div>${active.watersReasons.length ? active.watersReasons.map(headToHeadPitchReasonMarkup).join("") : `<div class="empty"><strong>No defensible claim yet</strong><span>Do not make a superiority claim. Use the controlled evaluation and proof request below.</span></div>`}</div></section>
      <section class="pmm-pitch-play"><div><span>Lead with</span><strong>${active.watersReasons[0] ? escapeHtml(active.watersReasons[0].statement) : "No approved lead claim — use question-led discovery."}</strong><small>${active.watersReasons[0] ? `${escapeHtml(active.watersReasons[0].substantiation)} · Approval not established` : "Claim blocked"}</small></div>${objectionMarkup}<div><span>Close with</span><strong>${escapeHtml(active.nextStep)}</strong></div></section>
      <footer><span>Reference class</span><strong>${escapeHtml(active.pointOfParity)}</strong><a href="${escapeHtml(active.match.source.watersUrl)}" target="_blank" rel="noreferrer">Open Waters product source ↗</a></footer>
    </section>
    ${headToHeadProofDrawerMarkup(active)}`;
  persistHeadToHeadSelection();
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

function marketingCompetitorContext(competitor, signals = pmmGovernedRecords(currentSignals())) {
  const profile = competitorIntentProfile(competitor, signals);
  const comparisonContext = battlecardComparisonForCompetitor(competitor);
  const broadEvidenceLinks = battlecardEvidenceLinks(competitor);
  const targetEvidenceLinks = pmmTargetCompetitorEvidenceSources(competitor, signals);
  const targeted = pmmHasNarrowTarget();
  const evidenceLinks = targeted ? targetEvidenceLinks : broadEvidenceLinks;
  const targeting = pmmTargetingSelection();
  const baseCounterMessage = pmmUsableText(
    comparisonContext.comparison?.watersPositioning || profile?.response?.differentiate,
    "A counter-message is unresolved because the filtered evidence does not support one.",
  );
  const counterMessage = targeted
    ? `For ${pmmTargetingDisplayValue(targeting.watersProduct, "the Waters portfolio")} in ${pmmTargetingDisplayValue(targeting.application, "the selected workflow")}, adapt the governing workflow position to the observed ${competitor} emphasis; do not assert advantage until target-compatible proof and approval are established.`
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

function marketingPrioritizedCompetitorContexts(signals = pmmGovernedRecords(currentSignals())) {
  const targeted = pmmHasNarrowTarget();
  const selectedWatersProduct = pmmSelectedWatersProduct();
  return marketingActiveCompetitors()
    .map((competitor) => marketingCompetitorContext(competitor, signals))
    .filter((context) => !selectedWatersProduct || context.productComparisonMatched)
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
  pmmGovernedRecords(currentCustomerVoiceItems())
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
      links: uniqueCustomerVoiceLinks(group.items, 4).map((link) => {
        const sourceItem = group.items.find((item) => customerVoiceSourceLinks(item).some((candidate) => canonicalEvidenceUrl(candidate.url) === canonicalEvidenceUrl(link.url)));
        return { ...link, ...pmmGovernanceFields(sourceItem) };
      }),
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
  }).map((source) => ({ ...source, ...pmmGovernanceFields(source) }));
}

function marketingDecisionThemes(context) {
  const targeted = pmmHasNarrowTarget();
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
    ...pmmGovernanceFields(proof),
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
      ...pmmGovernanceFields(record),
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
  const targetingAdaptation = `Proposed — not approved: adapt the governing workflow position for ${pmmTargetingDisplayValue(targeting.market, "all supported markets")} · ${pmmTargetingDisplayValue(targeting.watersProduct, "the Waters portfolio")} · ${pmmTargetingDisplayValue(targeting.application, "all supported applications")} · ${pmmTargetingDisplayValue(targeting.buyingSituation, "all buying situations")} · ${pmmTargetingDisplayValue(targeting.geography, "all geographies")} · ${pmmTargetingDisplayValue(targeting.buyerRole, "the full buying committee")}.`;
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
    fieldCitable: false,
    approvalState: "draft",
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
  const targeted = pmmHasNarrowTarget({ includeBuyerRole: true });
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
      fieldCitable: false,
      approvalState: "draft",
    };
  }
  const themeSources = (theme?.items || []).map((item) => ({
    url: item.url,
    label: item.title || theme.label,
    sourceName: item.sourceName || "Competitor public source",
    date: item.date || item.sourceDate,
    confidence: item.confidence,
    evidenceRole: "Competitor evidence",
    ...pmmGovernanceFields(item),
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
    ...pmmGovernanceFields(proof),
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
    fieldCitable: false,
    approvalState: "draft",
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

function pmmDecisionProofTags(decision = {}) {
  const explicit = [...(decision.tags || []), ...(decision.decisionTags || [])]
    .map((tag) => String(tag || "").trim().toLowerCase())
    .filter(Boolean);
  const content = `${decision.title || ""} ${decision.action || ""} ${decision.nextAction || ""} ${decision.decisionDeliverable || ""} ${decision.decisionGate || ""}`;
  const tags = new Set(explicit);
  if ((decision.outstandingInternalEvidence || []).length || /benchmark|evidence|proof|claims? matrix|validation/i.test(content)) tags.add("proof");
  if (/application asset|battlecard|claims? matrix|commercial|message|package|position|sales/i.test(content)) tags.add("commercial");
  return [...tags];
}

function pmmProofPrioritySellerAsset(item = {}) {
  const content = `${item.title || ""} ${item.action || ""} ${item.nextAction || ""} ${item.decisionDeliverable || ""}`;
  if (/claims? matrix|claims? sheet/i.test(content)) return "Regulated Claims Sheet";
  if (/position|message/i.test(content)) return "Positioning and Messaging Brief";
  if (/application asset|workflow package|package a|packaged/i.test(content)) return "Sales-Deck Outline";
  return "One-Page Competitive Battlecard";
}

function pmmProofDecisionInputs(signals) {
  return currentRecommendationSet(signals).map((decision) => ({
    ...decision,
    decisionTags: pmmDecisionProofTags(decision),
    commercialClaim: decision.commercialClaim || decision.proposedClaimWording || "",
    missingStudyEvidence: (decision.outstandingInternalEvidence || []).map((item) => String(item || "").trim()).filter(Boolean).join("; ")
      || decision.decisionGate
      || "Gap — the required study or evidence is not recorded.",
    sellerAsset: pmmProofPrioritySellerAsset(decision),
    dealImpact: decision.dealImpact ?? decision.businessMagnitude?.dealImpact ?? null,
    customerVoiceTerms: [decision.commercialClaim, decision.proposedClaimWording, decision.title, decision.affectedCapability, decision.technology, decision.marketSegment],
    approvalState: decision.approvalState || "draft",
    fieldCitable: false,
  }));
}

function pmmCustomerVoiceBarrierTransformation() {
  if (!customerVoiceBarrierTransformer) throw new Error("Customer Voice barrier transformer failed to load");
  return customerVoiceBarrierTransformer.transformCustomerVoiceBarriers({
    records: pmmGovernedRecords(currentCustomerVoiceItems()),
  });
}

function pmmProofPriorities(signals, comparatorClaimTransformation, customerVoiceBarrierTransformation) {
  if (!proofPriorityTransformer) throw new Error("Proof priority transformer failed to load");
  const customerVoiceRecords = pmmGovernedRecords(currentCustomerVoiceItems()).filter((record) => record.fieldCitable === true);
  return proofPriorityTransformer.aggregateProofPriorities({
    gapQueue: [
      ...comparatorClaimTransformation.gapQueue,
      ...(customerVoiceBarrierTransformation?.valueAssumptionGapQueue || []),
    ].map((item) => ({
      ...item,
      sellerAsset: item.sellerAsset || "One-Page Competitive Battlecard",
      customerVoiceTerms: item.customerVoiceTerms || [item.claimText, item.dimension, item.watersProduct],
    })),
    decisionItems: pmmProofDecisionInputs(signals),
    customerVoiceRecords,
    supportedClaims: comparatorClaimTransformation.allClaimControlClaims,
    limit: 3,
  });
}

function pmmDecisionSourceMarkup(source) {
  return pmmCanonicalEvidenceReferenceMarkup(source, source.evidenceRole || source.evidenceType || "Observed evidence");
}

function pmmEvidenceObjectId(value) {
  const canonical = PmmDataContract.canonicalUrl(value);
  if (!canonical) return "";
  let hash = 2166136261;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `EV-${(hash >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
}

function pmmCanonicalEvidenceReferenceMarkup(source, context = "Canonical evidence") {
  const evidenceId = pmmEvidenceObjectId(source?.url);
  if (!evidenceId) return `<span class="pmm-evidence-reference pmm-evidence-reference-unresolved"><span>Evidence unresolved</span><strong>${escapeHtml(source?.label || source?.sourceName || "Source unavailable")}</strong></span>`;
  return `<a class="pmm-evidence-reference" href="#pmm-evidence-object-${escapeHtml(evidenceId)}" data-pmm-evidence-ref="${escapeHtml(evidenceId)}"><span>${escapeHtml(evidenceId)} · ${escapeHtml(context)}</span><strong>${escapeHtml(source.label || source.sourceName || "Canonical evidence object")}</strong><small>Open canonical evidence and caveats →</small></a>`;
}

function pmmCaveatDetailsMarkup(summary, items = []) {
  const caveats = [...new Set(items.filter(Boolean).map((item) => String(item).trim()).filter(Boolean))];
  if (!caveats.length) return "";
  return `<details class="pmm-caveat-details"><summary>${escapeHtml(summary)}</summary><ul>${caveats.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></details>`;
}

function pmmChangeSummaryMarkup() {
  return `<aside class="pmm-change-summary" aria-label="What changed since the last refresh"><div><span>What Changed Since the Last Refresh</span><strong>Change detection unavailable</strong></div><p>The current refresh records completion time, but no comparable prior PMM positioning-decision snapshot is loaded. No delta is inferred.</p></aside>`;
}

function pmmGoverningPositionMarkup(position) {
  return `<article class="pmm-governing-position" data-governing-position-id="${escapeHtml(position.id)}" aria-labelledby="pmmGoverningPositionTitle">
    <header class="pmm-governing-header">
      <div><div class="pmm-eyebrow">Canonical PMM Object</div><h4 id="pmmGoverningPositionTitle">One Narrative Spine</h4><p>Competitor narratives, counter-positions, claims, and activation assets inherit from this proposed position.</p></div>
      ${pmmEvidenceTypeMarkup("inference", pmmApprovalStateLabel(position.approvalState))}
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
    <section class="pmm-governing-pillars" aria-labelledby="pmmEvidencePillarsTitle"><div><span>Evidence architecture</span><h4 id="pmmEvidencePillarsTitle">Three Evidence Pillars</h4></div><div>${position.evidencePillars.map((pillar, index) => `<article><span>Pillar ${index + 1}</span><strong>${escapeHtml(pillar.name)}</strong><p>${escapeHtml(pillar.statement)}</p><small>${escapeHtml(pillar.supportState)}</small>${pillar.sources.length ? `<div class="pmm-inline-links">${pillar.sources.map((source) => pmmCanonicalEvidenceReferenceMarkup(source, `Pillar ${index + 1}`)).join("")}</div>` : `<p class="pmm-unresolved">Supporting evidence link unavailable.</p>`}</article>`).join("")}</div></section>
    <section class="pmm-governing-exclusions"><span>Explicit exclusions — what we are not claiming</span><ul>${position.exclusions.map((exclusion) => `<li>${escapeHtml(exclusion)}</li>`).join("")}</ul></section>
    <div class="pmm-governing-governance" aria-label="Governing position approval and review state">
      ${pmmStatusMarkup("unresolved", "Approval state", pmmApprovalStateLabel(position.approvalState))}
      ${pmmStatusMarkup("unresolved", "Approver", position.approver)}
      ${pmmStatusMarkup("unresolved", "Last reviewed", position.lastReviewedDate)}
      ${pmmStatusMarkup("inference", "Classification", position.evidenceClassification)}
    </div>
  </article>`;
}

function renderMarketingGoverningPosition(position) {
  byId("pmmGoverningPosition").innerHTML = pmmGoverningPositionMarkup(position);
}

function pmmGoverningTraceMarkup(position, trace) {
  const statusKind = trace.status === "aligned" ? "observed" : "unresolved";
  const statusLabel = trace.status === "contradiction" ? "Contradiction flagged" : trace.status === "unsupported" ? "Unsupported deviation" : "Aligned adaptation";
  return `<details class="pmm-governing-trace" data-governing-position-ref="${escapeHtml(trace.governingPositionId)}" data-alignment-status="${escapeHtml(trace.status)}">
    <summary><span>Position trace · ${escapeHtml(statusLabel)}</span><small>Show inherited position and deviations</small></summary>
    <div class="pmm-governing-trace-heading"><span>Governing Position Trace</span>${pmmEvidenceTypeMarkup("inference", pmmApprovalStateLabel(position.approvalState))}</div>
    <dl><div><dt>Inherited customer / segment</dt><dd>${escapeHtml(position.targetCustomer)} · ${escapeHtml(position.prioritySegment)}</dd></div><div><dt>Inherited targeting adaptation</dt><dd>${escapeHtml(position.targetingAdaptation)}</dd></div><div><dt>Inherited job / category</dt><dd>${escapeHtml(position.customerJob)} · ${escapeHtml(position.referenceClass)}</dd></div><div><dt>Inherited value proposition</dt><dd>${escapeHtml(position.primaryValueProposition)}</dd></div><div><dt>Inherited point of parity</dt><dd>${escapeHtml(position.pointOfParity)}</dd></div><div><dt>Inherited point of difference</dt><dd>${escapeHtml(position.pointOfDifference)}</dd></div><div><dt>Local adaptation</dt><dd>${escapeHtml(trace.localAdaptation)}</dd></div></dl>
    <div class="pmm-governing-alignment pmm-governing-alignment-${escapeHtml(trace.status)}">${pmmStatusMarkup(statusKind, statusLabel, trace.message)}</div>
  </details>`;
}

function pmmProofPriorityRankMarkup(priority) {
  if (priority.priorityScore === null) {
    return `<div class="pmm-proof-priority-score is-unresolved"><strong>Pending</strong><span>rank score</span><small>Deal impact unquantified</small></div>`;
  }
  return `<div class="pmm-proof-priority-score"><strong>${priority.priorityScore}</strong><span>impact × frequency</span><small>${priority.dealImpact} × ${priority.claimFrequency}</small></div>`;
}

function pmmProofPriorityCardMarkup(priority, index, { backlog = false } = {}) {
  const anchorId = `pmm-proof-priority-${String(priority.id || `priority-${index + 1}`).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  return `<article id="${escapeHtml(anchorId)}" class="pmm-proof-priority-card${backlog ? " is-backlog" : ""}" data-proof-priority-rank="${index + 1}" data-claim-status="gap" data-field-usable="false" tabindex="-1">
    <header><div class="pmm-decision-rank" aria-label="Priority ${index + 1}">${index + 1}</div><div><span>${escapeHtml(priority.sources.join(" + "))} · cannot yet make</span><h4>${escapeHtml(priority.claimText)}</h4></div>${pmmProofPriorityRankMarkup(priority)}</header>
    <div class="pmm-proof-priority-fields">
      <section><span>Commercial claim we want to make</span><p>${escapeHtml(priority.claimText)}</p></section>
      <section><span>Specific missing study / evidence</span><p>${escapeHtml(priority.missingStudyEvidence)}</p></section>
      <section><span>One seller asset it unblocks</span><p>${escapeHtml(priority.sellerAsset)}</p></section>
    </div>
    <footer><span>${priority.claimFrequency} exact field-citable Customer Voice record${priority.claimFrequency === 1 ? "" : "s"} matched</span><span>${priority.dealImpact === null ? "Deal impact: unquantified — internal deal data required" : `Deal impact: ${priority.dealImpact}`}</span><strong>GAP · NOT FIELD-USABLE</strong></footer>
  </article>`;
}

function renderMarketingPositioningDecisions(proofPriorities) {
  const target = byId("pmmPositioningDecisions");
  if (!proofPriorities.top.length && !proofPriorities.backlog.length) {
    target.innerHTML = pmmEmptyState("No unsupported commercial claim remains under the active filters. Supported claims are governed in Claim Control.");
    return;
  }
  target.innerHTML = `
    <p class="pmm-priority-method" role="note"><strong>Ranking formula:</strong> deal impact × exact claim frequency in field-citable Customer Voice records. Items without a recorded deal-impact value remain unscored, follow any measured items, and use Customer Voice frequency only as a transparent tie-break. Supported, non-blocked claims are excluded before ranking.</p>
    <div class="pmm-proof-priority-list">${proofPriorities.top.map((priority, index) => pmmProofPriorityCardMarkup(priority, index)).join("")}</div>
    ${proofPriorities.backlog.length ? `<details class="pmm-proof-priority-backlog"><summary><span>Backlog</span><strong>${proofPriorities.backlog.length} additional unsupported claim${proofPriorities.backlog.length === 1 ? "" : "s"}</strong><small>Collapsed by default</small></summary><div>${proofPriorities.backlog.map((priority, index) => pmmProofPriorityCardMarkup(priority, proofPriorities.top.length + index, { backlog: true })).join("")}</div></details>` : ""}`;
}

function pmmCompetitorIntentSellingMotions(signals, supportedClaims, proofPriorities) {
  if (!competitorSellingMotionTransformer) throw new Error("Competitor selling-motion transformer failed to load");
  const competitorOrder = ["Thermo Fisher", "Agilent", "Shimadzu", "SCIEX", "PerkinElmer"];
  const competitors = filters.competitor.value === "All"
    ? competitorOrder
    : competitorOrder.filter((competitor) => competitor === filters.competitor.value);
  const profiles = competitors.map((competitor) => competitorIntentProfile(competitor, signals)).map((profile) => ({
    ...profile,
    evidenceItems: pmmGovernedRecords(profile.evidenceItems || []),
  }));
  return competitorSellingMotionTransformer.transformCompetitorIntentProfiles({
    profiles,
    supportedClaims,
    proofPriorities,
  });
}

const pmmClaimEvidenceClassifications = {
  observed: "Observed customer or competitor language",
  inference: "Analyst/rule-based inference",
  approved: "Approved Waters claim",
};

const pmmClaimReadinessValues = ["Proven", "Directional", "Unsupported"];

function pmmObservedCustomerLanguage(item) {
  const language = String(item?.customerLanguageSignal || "").trim();
  const exactEvidence = item?.languageType === "verbatim_quote";
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
    productWorkflow: [pmmWatersProductCode(governingPosition.targeting.watersProductId)],
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
  const matchedWatersProductCodes = [...new Set(pmmMatchingWatersProductIds(proof).flatMap(pmmWatersProductWorkflowCodes))];
  const productWorkflow = matchedWatersProductCodes.length
    ? matchedWatersProductCodes
    : /bioaccord|multi-attribute monitoring|\bmam\b/.test(text)
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
    ...pmmGovernanceFields(source),
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
    approvalState: "draft",
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
    fieldCitable: false,
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
  return `<div class="pmm-claim-source-links">${sources.slice(0, limit).map((source) => pmmCanonicalEvidenceReferenceMarkup(source, "Claim source")).join("")}</div>`;
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
    return `<article class="pmm-registry-evidence pmm-comparability-${escapeHtml(className)}" data-evidence-comparability="${escapeHtml(proof.compatibility.status)}"><header><strong>${escapeHtml(proof.label)}</strong><span>${escapeHtml(proof.compatibility.status)}</span></header>${pmmCanonicalEvidenceReferenceMarkup(proof, "Claim substantiation")}<details class="pmm-caveat-details"><summary>Compatibility and caveat details</summary><p>${escapeHtml(proof.detail)}</p><ul>${proof.compatibility.checks.map(pmmCompatibilityCheckMarkup).join("")}</ul></details></article>`;
  }).join("")}</div>`;
}

function pmmClaimSubstantiationMarkup(row) {
  const className = row.substantiationStatus.toLowerCase();
  return `<div class="pmm-readiness pmm-substantiation-${escapeHtml(className)}"><strong>${escapeHtml(row.substantiationStatus)}</strong><span>${escapeHtml(row.substantiationReason)}</span><small>Commercial readiness: ${escapeHtml(row.readiness.value)} · ${escapeHtml(row.readiness.reason)}</small></div>`;
}

function marketingVisibleClaimRows(rows) {
  return PmmDataContract.filterClaimRows(rows, state.marketingClaimsFilters);
}

function pmmComparatorClaimEvidenceMarkup(records, { blocked = false } = {}) {
  if (!records.length) return `<p class="pmm-matrix-empty-value">${blocked ? "No evidence was blocked." : "Applicable field-citable proof unavailable."}</p>`;
  return `<ul class="pmm-comparator-claim-evidence">${records.map((record) => `<li>
    <strong>${escapeHtml(record.label || record.title || "Evidence record")}</strong>
    <span>${escapeHtml(record.sourceName || "Source unresolved")} · ${record.fieldCitable === true ? "Field-citable" : "Not field-citable"}</span>
    ${blocked && record.blockedReason ? `<small>${escapeHtml(record.blockedReason)}</small>` : ""}
    ${isHttpUrl(record.url) ? `<a href="${escapeHtml(record.url)}" target="_blank" rel="noreferrer">Open exact source ↗</a>` : `<small>Exact source link unavailable.</small>`}
  </li>`).join("")}</ul>`;
}

function pmmComparatorClaimControlMarkup(supportedClaims = [], queuedGaps = []) {
  return `<section class="pmm-comparator-claim-control" aria-labelledby="pmmComparatorClaimControlTitle">
    <header><div><span>Product Comparator Transformer</span><h4 id="pmmComparatorClaimControlTitle">Field-Usable Comparator Claim Candidates</h4><p>Only exact comparator wording with at least one field-citable backing record and a non-blocked approval state appears below.</p></div><div><strong>${supportedClaims.length}</strong><span>supported</span><small>${queuedGaps.length} routed to gapQueue for Prompt 3</small></div></header>
    <div class="pmm-claims-table-wrap"><table class="pmm-comparator-claims-table"><caption class="sr-only">Supported Product Comparator claim candidates</caption><thead><tr><th>Exact wording</th><th>Applicable proof</th><th>Blocked evidence</th><th>Approval state</th><th>Study required before field use</th></tr></thead><tbody>${supportedClaims.length
      ? supportedClaims.map((claim) => `<tr data-comparator-claim-id="${escapeHtml(claim.id)}" data-claim-status="supported" data-field-usable="true">
        <td><strong>${escapeHtml(claim.claimText)}</strong><small>${escapeHtml(claim.watersProduct)} vs ${escapeHtml(claim.competitorProduct)} · ${escapeHtml(claim.dimension)}</small></td>
        <td>${pmmComparatorClaimEvidenceMarkup(claim.supportingEvidence)}</td>
        <td>${pmmComparatorClaimEvidenceMarkup(claim.blockedEvidence, { blocked: true })}</td>
        <td>${pmmStatusMarkup(claim.approvalState === "approved" ? "observed" : "unresolved", "Approval state", pmmApprovalStateLabel(claim.approvalState))}</td>
        <td><strong>${escapeHtml(claim.studyRequiredBeforeFieldUse)}</strong><small>Field-use gate: citable proof present and approval state is not blocked.</small></td>
      </tr>`).join("")
      : `<tr class="pmm-comparator-claims-empty"><td colspan="5"><strong>No Product Comparator claim is field-usable under the active filters.</strong><span>Gap wording is withheld from this table and remains only in the shared gapQueue.</span></td></tr>`}</tbody></table></div>
  </section>`;
}

function renderMarketingClaimsProof(rows, visibleRows, governingPosition, supportedComparatorClaims = [], queuedComparatorGaps = []) {
  const target = byId("pmmClaimsProof");
  const riskRows = [...visibleRows].sort((left, right) => pmmClaimRiskScore(right) - pmmClaimRiskScore(left));
  const highestRiskClaim = riskRows[0];
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
    ${pmmComparatorClaimControlMarkup(supportedComparatorClaims, queuedComparatorGaps)}
    <aside class="pmm-claim-risk-summary" aria-label="Highest-risk governed claim"><span>Highest Risk Under Current Filters</span><strong>${highestRiskClaim ? escapeHtml(highestRiskClaim.proposedClaimWording) : "No matching claim"}</strong><p>${highestRiskClaim ? `${escapeHtml(highestRiskClaim.substantiationStatus)} substantiation · ${escapeHtml(pmmApprovalStateLabel(highestRiskClaim.approvalState))} · ${pmmClaimRiskScore(highestRiskClaim)} governed risk points` : "No unrelated claim was substituted."}</p></aside>
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
    ${riskRows.length ? `<div class="pmm-claims-table-wrap"><table class="pmm-claims-matrix pmm-claims-registry"><caption class="sr-only">Governed Product Marketing claims registry ordered by risk</caption><thead><tr><th>Exact proposed claim wording</th><th>Type</th><th>Segment / application</th><th>Buyer / channel</th><th>Reference competitor or baseline</th><th>Exact supporting evidence and compatibility</th><th>Source counts</th><th>Evidence comparability</th><th>Substantiation</th><th>Legal / claims approval</th><th>Governance and next action</th></tr></thead><tbody>${riskRows.map((row) => `<tr data-claim-context="${escapeHtml(`${row.buyingCriterion} for ${row.audience}`)}" data-claim-risk-score="${pmmClaimRiskScore(row)}" data-claim-readiness="${escapeHtml(row.readiness.value)}" data-substantiation-status="${escapeHtml(row.substantiationStatus)}" data-evidence-comparability="${escapeHtml(row.comparabilityStatus)}" data-claim-classification="${escapeHtml(pmmClaimEvidenceClassifications[row.evidenceClassification])}">
      <td><div class="pmm-registry-claim-wording"><span>Exact proposed wording</span><p>${escapeHtml(row.proposedClaimWording)}</p>${pmmEvidenceTypeMarkup("inference", "Proposed — not approved")}<small>Registry context: ${escapeHtml(row.buyingCriterion)} for ${escapeHtml(row.audience)} · Inherits ${escapeHtml(governingPosition.id)}</small></div></td>
      <td><strong class="pmm-claim-type">${escapeHtml(row.claimType)}</strong></td>
      <td><strong>${escapeHtml(row.segmentApplication)}</strong><small>${escapeHtml(row.caveat)}</small></td>
      <td><strong>${escapeHtml(row.buyerRole)}</strong><span>${escapeHtml(row.intendedChannel)}</span></td>
      <td><strong>${escapeHtml(row.referenceBaseline)}</strong><small>Competitor-specific comparison baseline; equivalence must be demonstrated.</small></td>
      <td>${pmmClaimEvidenceRegistryMarkup(row.evidenceRecords)}</td>
      <td><strong>${row.uniqueRecordCount} unique evidence record${row.uniqueRecordCount === 1 ? "" : "s"}</strong><span>${escapeHtml(row.independentSourceState)}</span><small>Unique URLs are not treated as independent organizations.</small></td>
      <td><div class="pmm-comparability-summary pmm-comparability-${escapeHtml(row.comparabilityStatus.toLowerCase().replace(/\s+/g, "-"))}"><strong>${escapeHtml(row.comparabilityStatus)}</strong><span>${row.evidenceRecords.length ? "Automated checks shown with each evidence record." : "No evidence available for compatibility review."}</span></div></td>
      <td>${pmmClaimSubstantiationMarkup(row)}</td>
      <td>${pmmStatusMarkup("unresolved", "Legal / claims approval", pmmApprovalStateLabel(row.approvalState))}<div class="pmm-approved-wording"><span>Approved wording</span><strong>${escapeHtml(row.approvedWording)}</strong></div></td>
      <td><div class="pmm-registry-governance">${pmmStatusMarkup("unresolved", "Owner", row.owner)}${pmmStatusMarkup("unresolved", "Expiration", row.expirationDate)}<div class="pmm-next-required-action"><span>Next required action</span><p>${escapeHtml(row.nextRequiredAction)}</p></div></div></td>
    </tr>`).join("")}</tbody></table></div>` : pmmEmptyState(rows.length ? "No claims match the matrix filters. Clear a matrix filter or adjust the global filters." : "No supported claims match the active global filters. Unrelated evidence was not substituted.")}`;
}

const pmmBuyingCommitteeRoleDefinitions = buyingCommitteeTransformer?.committeeRoleDefinitions || [];

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
  return uniqueCustomerVoiceLinks(items, limit).map((link) => {
    const sourceItem = items.find((item) => customerVoiceSourceLinks(item).some((candidate) => canonicalEvidenceUrl(candidate.url) === canonicalEvidenceUrl(link.url)));
    return {
      url: link.url,
      label: link.label,
      date: link.sourceDate,
      sourceName: "Exact public customer record",
      confidence: Math.max(...items.map((item) => Number(item.confidence || 0)), 0),
      ...pmmGovernanceFields(sourceItem),
    };
  });
}

function pmmFishbeinAttributeSources(segmentItems, context, attribute) {
  const customerItems = segmentItems.filter((item) => attribute.pattern.test(`${item.buyingPriority} ${item.category} ${item.theme} ${item.customerLanguageSignal}`));
  const customerSources = pmmCommitteeEvidenceSources(customerItems, 3);
  const competitorSources = (context?.evidenceLinks || []).filter((source) =>
    attribute.pattern.test(`${source.label || ""} ${source.detail || ""} ${source.evidenceType || ""}`)
  ).map((source) => ({ ...source, sourceName: source.sourceName || "Competitor public source" }));
  return pmmDeduplicateSources([...customerSources, ...competitorSources]).slice(0, 4);
}

function pmmBuyingCommitteeModel(positioningDecisions, contexts) {
  if (!buyingCommitteeTransformer) throw new Error("Buying committee transformer failed to load");
  const prioritySegments = pmmCommitteePrioritySegments(positioningDecisions);
  const targeting = pmmTargetingSelection();
  const committeeRecords = pmmGovernedRecords(currentCustomerVoiceItems());
  const roleTransformation = buyingCommitteeTransformer.transformBuyingCommittee({ records: committeeRecords });
  const segments = prioritySegments.map((priority) => {
    const segmentItems = committeeRecords.filter((item) => item.labType === priority.segment);
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
      roles: roleTransformation.roles,
    };
  });
  const selectedSegment = filters.segment.value === "All"
    ? segments[0]
    : segments.find((segment) => segment.segment === filters.segment.value || (filters.segment.value === "CDMO" && segment.segment === "CRO/CDMO"));
  const selectedSwingAttribute = selectedSegment
    ? `${selectedSegment.segment}: ${selectedSegment.scorecard.swingAttribute.label} (${selectedSegment.scorecard.swingAttribute.weight}% hypothesis weight; weighted difference ${selectedSegment.scorecard.swingAttribute.weightedDifference.toFixed(2)}). Hypothesis — replace with win/loss, survey, or conjoint evidence.`
    : "Swing attribute unresolved — no priority-segment scorecard is available";
  return { ...roleTransformation, segments, selectedSwingAttribute };
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
  const records = pmmGovernedRecords(customerVoiceItemsForHorizon(filters.horizon.value, { ignoreCompetitor: true }))
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
    ...pmmGovernanceFields(context.selectedLaunch),
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
      approvalState: "draft",
      valueClaimGate: PmmDataContract.valueClaimEligibility({ substantiationStatus, approvalEstablished: false }),
    },
  };
}

function pmmAdoptionValuePlans(buyingCommittee, contexts, marketChoice) {
  return buyingCommittee.segments.map((segment) => pmmAdoptionValuePlan(segment, contexts, marketChoice));
}

function pmmCommitteeSourceLinksMarkup(sources) {
  if (!sources.length) return `<p class="pmm-committee-unresolved">Unresolved — no exact role-specific evidence link is available.</p>`;
  return `<div class="pmm-committee-links">${sources.map((source) => pmmCanonicalEvidenceReferenceMarkup(source, "Role evidence")).join("")}</div>`;
}

function pmmRoleProofDemandMarkup(demand) {
  const demandLanguage = demand.proofState === "evidence-backed-demand" && demand.languageMode === "verbatim"
    ? `<blockquote><p>“${escapeHtml(demand.proofDemandText)}”</p></blockquote>`
    : `<p>${escapeHtml(demand.proofDemandText)}</p>`;
  return `<article class="pmm-role-proof-demand is-${escapeHtml(demand.proofState)}" data-proof-demand-state="${escapeHtml(demand.proofState)}" data-field-usable="false">
    <header><span>Specific proof this role demands</span>${pmmEvidenceTypeMarkup(demand.proofState === "evidence-backed-demand" ? "observed" : "unresolved", demand.proofState === "evidence-backed-demand" ? "Demand pulled from exact evidence" : "Proof demand unresolved")}</header>
    ${demandLanguage}
    <small>${escapeHtml(demand.languageLabel)} · ${escapeHtml(demand.company)} · ${escapeHtml(demand.product)}</small>
    <aside>${demand.proofState === "evidence-backed-demand" ? "This record establishes what the role needs resolved; it does not satisfy the requirement or provide field-usable proof." : "No study type or proof package was inferred from this record."}</aside>
    ${pmmCommitteeSourceLinksMarkup(demand.sources)}
  </article>`;
}

function pmmRoleCriterionMarkup(criterion) {
  return `<section class="pmm-role-criterion" data-decision-criterion="${escapeHtml(criterion.key)}">
    <header><div><span>Decision criterion</span><strong>${escapeHtml(criterion.criterion)}</strong></div><small>${criterion.recordCount} exact role-tagged record${criterion.recordCount === 1 ? "" : "s"}</small></header>
    <div class="pmm-role-proof-demands">${criterion.proofDemands.map(pmmRoleProofDemandMarkup).join("")}</div>
  </section>`;
}

function pmmCommitteeRoleMarkup(role) {
  const memberTags = role.memberTags.length ? role.memberTags.join(" · ") : "Unresolved";
  return `<article class="pmm-role-function-card is-${escapeHtml(role.classification)}" data-committee-role="${escapeHtml(role.key)}" data-role-classification="${escapeHtml(role.classification)}">
    <header><div><span>Buying-committee function</span><h4>${escapeHtml(role.label)}</h4><p>${escapeHtml(memberTags)}</p></div>${pmmEvidenceTypeMarkup(role.classification, role.classificationLabel)}</header>
    <div class="pmm-role-function-summary"><strong>${role.recordCount}</strong><span>mapped Customer Voice record${role.recordCount === 1 ? "" : "s"}</span><small>Decision power: ${escapeHtml(role.decisionPower)}</small></div>
    ${role.criteria.length ? `<div class="pmm-role-criteria">${role.criteria.map(pmmRoleCriterionMarkup).join("")}</div>` : `<div class="pmm-role-empty"><strong>Role unresolved</strong><p>No loaded Customer Voice record has a role tag that maps exactly to this committee function. Criteria and proof demands were not guessed.</p></div>`}
  </article>`;
}

function pmmUnresolvedRoleGroupMarkup(group) {
  return `<article><header><div><span>Unresolved role tag</span><strong>${escapeHtml(group.roleTag)}</strong></div><small>${group.recordCount} record${group.recordCount === 1 ? "" : "s"}</small></header><p>${escapeHtml(group.reason)}</p><div>${group.criteria.map((criterion) => `<span>${escapeHtml(criterion.criterion)} · ${criterion.recordCount}</span>`).join("")}</div>${pmmCommitteeSourceLinksMarkup(group.sources.slice(0, 6))}</article>`;
}

function pmmFishbeinSourcesMarkup(sources) {
  if (!sources.length) return `<span class="pmm-fishbein-hypothesis">Hypothesis — validation required</span>`;
  return `<div class="pmm-fishbein-sources">${sources.map((source) => pmmCanonicalEvidenceReferenceMarkup(source, "Score context")).join("")}<small>Sources provide context only; they do not validate the numeric hypothesis score.</small></div>`;
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
  return `<div class="pmm-adoption-links">${sources.map((source) => pmmCanonicalEvidenceReferenceMarkup(source, "Adoption evidence")).join("")}</div>`;
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
    <header><div><span>Economic Value to the Customer · Governed Working Model</span><h4 id="pmmEvc${escapeHtml(plan.id.replace(/[^a-z0-9]/gi, ""))}">EVC Against a Named Baseline</h4><p>${escapeHtml(plan.evc.formula)}</p></div><div class="pmm-evc-gate"><strong>${escapeHtml(plan.evc.valueClaimGate.status)}</strong><span>${escapeHtml(pmmApprovalStateLabel(plan.evc.approvalState))}</span></div></header>
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

function renderMarketingAudienceCriteria(customerLanguageRecords, buyingCommittee) {
  const target = byId("pmmAudienceCriteria");
  target.innerHTML = `
    <div class="pmm-audience-intro pmm-committee-intro">
      <div><div class="pmm-eyebrow">Role-segmented Customer Voice</div><h3>Buying Committee and Decision Criteria</h3><p><strong>${buyingCommittee.mappedRecordCount} of ${buyingCommittee.recordCount} Customer Voice records</strong> map to an exact committee-role tag under the active filters. Evidence is grouped by who uses, who influences, who vetoes, who decides, and who buys—not by market or technology. Global filters scope the evidence but do not define the grouping.</p></div>
      <div class="pmm-committee-coverage"><strong>${buyingCommittee.exactSourceCount}</strong><span>exact source URL${buyingCommittee.exactSourceCount === 1 ? "" : "s"}</span><small>${buyingCommittee.unresolvedRecordCount} unresolved role record${buyingCommittee.unresolvedRecordCount === 1 ? "" : "s"}</small></div>
    </div>
    <p class="pmm-forum-caveat">Proof demands below retain the loaded evidence language and source. Analyst synthesis is never quoted as customer wording, and a demand record does not satisfy the requirement or provide field-usable proof. Forum evidence remains complaint-biased and is not representative market research.</p>
    <div class="pmm-role-function-grid">${buyingCommittee.roles.map(pmmCommitteeRoleMarkup).join("")}</div>
    ${buyingCommittee.unresolvedRoleGroups.length ? `<details class="pmm-unresolved-role-groups"><summary><span>Unresolved role mapping</span><strong>${buyingCommittee.unresolvedRecordCount} record${buyingCommittee.unresolvedRecordCount === 1 ? "" : "s"}</strong><small>Collapsed · no committee assignment inferred</small></summary><div>${buyingCommittee.unresolvedRoleGroups.map(pmmUnresolvedRoleGroupMarkup).join("")}</div></details>` : ""}`;
}

function pmmCustomerBarrierSourceMarkup(barrier) {
  if (!barrier.sources.length) return `<p class="pmm-adoption-unresolved">Exact Customer Voice source unavailable.</p>`;
  return `<div class="pmm-customer-barrier-sources">${barrier.sources.slice(0, 4).map((source) => pmmCanonicalEvidenceReferenceMarkup(source, "Customer Voice barrier")).join("")}</div>`;
}

function pmmCustomerBarrierValueMarkup(barrier) {
  const proven = barrier.provenValue;
  const assumed = barrier.assumedValue;
  const provenMarkup = proven.status === "proven"
    ? `<section class="pmm-customer-value-state is-proven" data-value-state="proven"><span>Proven value</span><strong>${escapeHtml(proven.statement)}</strong><small>Customer-validated outcome with field-citable evidence.</small><div>${proven.supportingEvidence.map((source) => pmmCanonicalEvidenceReferenceMarkup(source, "Customer-validated value")).join("")}</div></section>`
    : `<section class="pmm-customer-value-state is-unproven" data-value-state="not-established"><span>Proven value</span><strong>Not established</strong><small>${escapeHtml(proven.statement)}</small></section>`;
  if (assumed.status !== "assumed") return `<div class="pmm-customer-value-grid">${provenMarkup}<section class="pmm-customer-value-state is-cleared" data-value-state="none"><span>Assumed value</span><strong>None outstanding</strong><small>The loaded customer-validation record leaves no unvalidated tactic-value assumption.</small></section></div>`;
  const priority = assumed.proofPriority;
  return `<div class="pmm-customer-value-grid">
    ${provenMarkup}
    <section class="pmm-customer-value-state is-assumed" data-value-state="assumed" data-customer-validated="false"><span>Assumed value</span><strong>${escapeHtml(assumed.statement)}</strong><small>UNVALIDATED ASSUMPTION · not customer-validated</small><a href="${escapeHtml(priority.href)}" data-proof-priority-link="${escapeHtml(priority.id)}"><span>Validation gap · Three Proof Priorities</span><strong>${escapeHtml(priority.claimText)}</strong><small>${escapeHtml(priority.missingStudyEvidence)} →</small></a></section>
  </div>`;
}

function pmmCustomerBarrierCardMarkup(barrier) {
  const languageMarkup = barrier.languageMode === "verbatim"
    ? `<blockquote><p>“${escapeHtml(barrier.barrierText)}”</p></blockquote>`
    : `<p class="pmm-customer-barrier-paraphrase">${escapeHtml(barrier.barrierText)}</p>`;
  return `<article class="pmm-customer-barrier-card" data-customer-barrier-id="${escapeHtml(barrier.id)}" data-customer-language-mode="${escapeHtml(barrier.languageMode)}">
    <header><div><span>${escapeHtml(barrier.barrierLabel)}</span><strong>${escapeHtml(barrier.company)} · ${escapeHtml(barrier.product)}</strong><small>${escapeHtml(barrier.segment)} · ${escapeHtml(barrier.buyerRole)} · ${escapeHtml(barrier.buyingPriority)}</small></div>${pmmEvidenceTypeMarkup(barrier.languageMode === "verbatim" ? "observed" : "inference", barrier.languageLabel)}</header>
    <section class="pmm-customer-barrier-language"><span>Customer barrier</span>${languageMarkup}<small>${barrier.languageMode === "verbatim" ? "Exact phrasing retained from the Customer Voice record." : "The loaded record contains analyst-synthesized language; it is not rendered as a quotation."}</small></section>
    <section class="pmm-customer-barrier-tactic"><span>Tactic to remove it</span><strong>${escapeHtml(barrier.tactic)}</strong><small>PMM adoption tactic — not a roadmap item.</small></section>
    ${pmmCustomerBarrierValueMarkup(barrier)}
    ${pmmCustomerBarrierSourceMarkup(barrier)}
  </article>`;
}

function pmmCustomerBarrierGroups(barriers) {
  const groups = new Map();
  barriers.forEach((barrier) => {
    if (!groups.has(barrier.segment)) groups.set(barrier.segment, []);
    groups.get(barrier.segment).push(barrier);
  });
  return [...groups.entries()].map(([segment, items]) => ({ segment, items }));
}

function pmmCustomerVoiceBarriersMarkup(transformation) {
  const barriers = transformation?.barriers || [];
  if (!barriers.length) return pmmEmptyState("No Customer Voice record is classified as a switching or adoption barrier under the active filters. Feature requests were not substituted.");
  const groups = pmmCustomerBarrierGroups(barriers);
  return `<section class="pmm-customer-barriers" aria-labelledby="pmmCustomerBarrierTitle">
    <header><div><span>Customer Voice transformation</span><h4 id="pmmCustomerBarrierTitle">Observed Switching and Adoption Barriers</h4><p>Customer phrasing is quoted only when the record is explicitly verbatim. Tactics remain PMM adoption actions, and value is separated into customer-validated outcomes versus assumptions that still require proof.</p></div><div class="pmm-customer-barrier-count"><strong>${barriers.length}</strong><span>barrier${barriers.length === 1 ? "" : "s"}</span><small>${transformation.quotedCount} verbatim · ${transformation.assumedValueCount} validation gap${transformation.assumedValueCount === 1 ? "" : "s"}</small></div></header>
    <aside role="note"><strong>Feature requests excluded.</strong><span>${transformation.excludedFeatureRequestCount} explicit feature-request record${transformation.excludedFeatureRequestCount === 1 ? " was" : "s were"} excluded; no barrier is converted into a roadmap item.</span></aside>
    <div class="pmm-customer-barrier-groups">${groups.map((group, index) => `<details class="pmm-customer-barrier-group" ${index === 0 ? "open" : ""}><summary><span><strong>${escapeHtml(group.segment)}</strong><small>${group.items.filter((item) => item.languageMode === "verbatim").length} verbatim customer barrier${group.items.filter((item) => item.languageMode === "verbatim").length === 1 ? "" : "s"}</small></span><b>${group.items.length}</b></summary><div>${group.items.map(pmmCustomerBarrierCardMarkup).join("")}</div></details>`).join("")}</div>
  </section>`;
}

function renderMarketingAdoptionValuePlans(adoptionValuePlans, customerVoiceBarriers) {
  const target = byId("pmmAdoptionValuePlans");
  const barrierMarkup = pmmCustomerVoiceBarriersMarkup(customerVoiceBarriers);
  if (!adoptionValuePlans.length) {
    target.innerHTML = `${barrierMarkup}${pmmEmptyState("No target-compatible segment is available for the ACCORD and EVC planning model. Assumptions were not fabricated.")}`;
    return;
  }
  target.innerHTML = `${barrierMarkup}<div class="pmm-adoption-value-intro"><strong>Planning model below: ACCORD and EVC.</strong><p>These modeled barriers, launch tactics, and value assumptions remain separate from the Customer Voice extraction above and from approved commercial claims.</p></div><div class="pmm-adoption-value-plans">${adoptionValuePlans.map((plan, index) => `<details class="pmm-adoption-value-plan" ${index === 0 ? "open" : ""}><summary><span><strong>${escapeHtml(plan.segment)}${plan.application !== "All" ? ` · ${escapeHtml(plan.application)}` : ""}</strong><small>${escapeHtml(plan.selectedBaseline.name)} · ${plan.accord.length} ACCORD barriers</small></span><b>${escapeHtml(plan.evc.valueClaimGate.status)}</b></summary>${pmmAdoptionValuePlanMarkup(plan)}</details>`).join("")}</div>`;
}

function pmmNarrativeApplicationNotes(context) {
  const notes = pmmGovernedRecords(currentCompetitorApplicationNotes()).filter((note) => note.competitor === context.competitor);
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
  return pmmGovernedRecords(currentConferenceSources()).flatMap((event) => {
    const content = pmmGovernedRecords(event.competitorContent || []).find((item) => String(item.competitor || "").includes(competitor));
    const watch = pmmGovernedRecords(event.competitorWatch || []).find((item) => item.name === competitor);
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
      ...pmmGovernanceFields(content || watch || event),
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
    ...pmmGovernanceFields(note),
  }));
  const launchSources = context.launches.slice(0, 2).map((launch) => ({
    url: timelineUrlForLaunch(launch),
    label: launch.product,
    sourceName: launch.sourceName || "Official launch source",
    date: launch.date,
    confidence: launch.confidence,
    evidenceType: "Observed launch evidence",
    ...pmmGovernanceFields(launch),
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
      ...pmmGovernanceFields(row),
    }));
  const audienceSources = (audience?.links || []).slice(0, 2).map((link) => ({
    url: link.url,
    label: link.label,
    sourceName: "Exact public customer record",
    date: link.sourceDate,
    confidence: audience.confidence,
    evidenceType: "Observed audience evidence",
    fieldCitable: link.fieldCitable === true,
    approvalState: pmmEvidenceGovernance.normalizeApprovalState(link.approvalState),
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
    fieldCitable: false,
    approvalState: "draft",
  };
}

function pmmNarrativeSourceMarkup(source) {
  return pmmCanonicalEvidenceReferenceMarkup(source, source.evidenceType || "Narrative evidence");
}

function pmmMarketChoiceSource(item, link, evidenceRole = "Observed customer evidence") {
  return {
    url: link.url,
    label: link.label || item.theme || "Exact public customer record",
    sourceName: item.sourceName || "Public customer source",
    date: link.sourceDate || item.dateCaptured,
    confidence: item.confidence,
    evidenceType: evidenceRole,
    ...pmmGovernanceFields(item),
  };
}

function pmmIsDirectCustomerChoiceLink(link) {
  if (!isHttpUrl(link?.url) || link.sourceType === "regulatory") return false;
  return !pmmSourceHostname(link).includes("fda.gov");
}

function pmmMarketChoiceCustomerEvidence(pattern, { company } = {}) {
  const candidateItems = pmmGovernedRecords(customerVoiceItemsForHorizon(filters.horizon.value, { ignoreCompetitor: true }))
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
    fieldCitable: false,
    approvalState: "draft",
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
    fieldCitable: false,
    approvalState: "draft",
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
  const eligible = [...pmmGovernedRecords(signals), ...pmmGovernedRecords(currentLaunches())]
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
      ...pmmGovernanceFields(item),
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

function pmmMarketChoice(contexts, governingPosition, signals = pmmGovernedRecords(currentSignals())) {
  const proposedResponse = `${governingPosition.pointOfDifference} Proposed — not approved.`;
  const workaroundEvidence = pmmMarketChoiceCustomerEvidence(/workaround|split software|contact closure|alternative analytical|manual review|local expert/i);
  const inertiaEvidence = pmmMarketChoiceCustomerEvidence(/validated method|method continuity|legacy|replacement timing|upgrade friction|known methods/i);
  const extensionEvidence = pmmMarketChoiceCustomerEvidence(/legacy|parts|serviceability|maintenance|second-hand|extend/i);
  const deferEvidence = pmmMarketChoiceCustomerEvidence(/replacement timing|upgrade friction|validation burden|lower risk migration|defer/i);
  const watersInstalledEvidence = pmmGovernedRecords(customerVoiceItemsForHorizon(filters.horizon.value, { ignoreCompetitor: true }))
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
  return `<div class="pmm-market-choice-links">${sources.slice(0, 6).map((source) => pmmCanonicalEvidenceReferenceMarkup(source, source.evidenceType || "Market-choice evidence")).join("")}</div>`;
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

function pmmSellingMotionObservedSourceMarkup(move) {
  if (!move.observedMove.url) return `<p class="pmm-unresolved">Observed source link unavailable.</p>`;
  return pmmCanonicalEvidenceReferenceMarkup({
    url: move.observedMove.url,
    label: move.observedMove.text,
    sourceName: move.observedMove.sourceName,
    fieldCitable: move.observedMove.fieldCitable,
    approvalState: move.observedMove.approvalState,
  }, "Observed move source");
}

function pmmSellingMotionResponseMarkup(move) {
  const response = move.watersResponse;
  if (response.status === "defensible") {
    const citableEvidence = response.supportingEvidence.filter((record) => record.fieldCitable === true && record.approvalState !== "blocked");
    return `<section class="pmm-selling-motion-response is-defensible" data-response-status="defensible" data-field-usable="true">
      <div class="pmm-selling-motion-label"><span>Waters response</span>${pmmEvidenceTypeMarkup("observed", "Citable proof attached")}</div>
      <p>${escapeHtml(response.responseText)}</p>
      <small>Claim approval: ${escapeHtml(pmmApprovalStateLabel(response.approvalState))}. Exact wording inherited from Claim Control.</small>
      <div class="pmm-selling-motion-evidence">${citableEvidence.map((source) => pmmCanonicalEvidenceReferenceMarkup(source, "Field-citable counter proof")).join("")}</div>
    </section>`;
  }
  const priority = response.proofPriority;
  return `<section class="pmm-selling-motion-response needs-proof" data-response-status="needs-proof" data-field-usable="false">
    <div class="pmm-selling-motion-label"><span>Waters response</span>${pmmEvidenceTypeMarkup("unresolved", "Needs proof")}</div>
    <p>${escapeHtml(response.responseText)}</p>
    <small>No customer-facing counter is emitted. This move is not field-usable.</small>
    <a class="pmm-selling-motion-proof-link" href="${escapeHtml(priority.href)}" data-proof-priority-link="${escapeHtml(priority.id)}"><span>Three Proof Priorities</span><strong>${escapeHtml(priority.claimText)}</strong><small>${escapeHtml(priority.missingStudyEvidence)} →</small></a>
  </section>`;
}

function pmmSellingMotionCardMarkup(move, index) {
  const observed = move.observedMove;
  const date = observed.date ? formatDate(observed.date) : "Date unresolved";
  return `<article class="pmm-selling-motion-card" data-selling-motion-id="${escapeHtml(move.id)}" data-response-status="${escapeHtml(move.watersResponse.status)}">
    <header><span>Move ${index + 1} · ${escapeHtml(observed.type)}</span><strong>${escapeHtml(observed.text)}</strong><small>${escapeHtml(observed.sourceName)} · ${escapeHtml(date)} · ${observed.fieldCitable ? "Field-citable observation" : "Observation not field-citable"} · ${escapeHtml(pmmApprovalStateLabel(observed.approvalState))}</small></header>
    <div class="pmm-selling-motion-grid">
      <section class="pmm-selling-motion-observed"><div class="pmm-selling-motion-label"><span>Observed move</span>${pmmEvidenceTypeMarkup("observed", "Source-backed record")}</div><p>${escapeHtml(observed.detail || observed.text)}</p>${pmmSellingMotionObservedSourceMarkup(move)}</section>
      <section><div class="pmm-selling-motion-label"><span>Inferred intent</span>${pmmEvidenceTypeMarkup("inference", "Analyst inference")}</div><p>${escapeHtml(move.inferredIntent)}</p><small>Intent is an inference from the Competitor Intent profile, not an observed customer claim.</small></section>
      <section><div class="pmm-selling-motion-label"><span>Buying situation targeted</span>${pmmEvidenceTypeMarkup("inference", "Validate with deal evidence")}</div><dl><div><dt>Deal type</dt><dd>${escapeHtml(move.buyingSituation.dealType)}</dd></div><div><dt>Committee role</dt><dd>${escapeHtml(move.buyingSituation.committeeRole)}</dd></div></dl><small>${escapeHtml(move.buyingSituation.basis)} ${escapeHtml(move.namedCustomer)}.</small></section>
      ${pmmSellingMotionResponseMarkup(move)}
    </div>
  </article>`;
}

function renderMarketingCompetitiveNarrative(signals = pmmGovernedRecords(currentSignals()), governingPosition, marketChoice, modelContexts, modelSellingMotions) {
  const target = byId("pmmCompetitiveNarrative");
  const contexts = modelContexts || state.marketingWorkspaceModel?.contexts || marketingPrioritizedCompetitorContexts(signals);
  const governing = governingPosition || state.marketingGoverningPosition || pmmGoverningPosition(contexts);
  const choice = marketChoice || state.marketingMarketChoice || pmmMarketChoice(contexts, governing, signals);
  const sellingMotions = modelSellingMotions || state.marketingWorkspaceModel?.competitorPlays || pmmCompetitorIntentSellingMotions(
    signals,
    state.marketingWorkspaceModel?.productComparatorSupportedClaims || [],
    state.marketingWorkspaceModel?.proofPriorities || { top: [], backlog: [] },
  );
  if (!sellingMotions.groups.length) {
    target.innerHTML = `${pmmMarketChoiceMarkup(choice)}${pmmEmptyState("No governed Competitor Intent move matches the active filters. No selling motion was fabricated.")}`;
    return;
  }
  if (!sellingMotions.groups.some((group) => group.competitor === state.activeBattlecardCompetitor)) {
    state.activeBattlecardCompetitor = sellingMotions.groups[0].competitor;
  }
  const activeGroup = sellingMotions.groups.find((group) => group.competitor === state.activeBattlecardCompetitor) || sellingMotions.groups[0];
  target.innerHTML = `
    ${pmmMarketChoiceMarkup(choice)}
    <div class="pmm-narrative-intro pmm-selling-motion-intro"><div><strong>One selling motion per Competitor Intent record.</strong><p>${sellingMotions.moves.length} observed move${sellingMotions.moves.length === 1 ? "" : "s"} stay separate from intent inference and customer-facing response. ${sellingMotions.defensibleCount} have an exact citable counter; ${sellingMotions.needsProofCount} route to Three Proof Priorities.</p></div><div class="pmm-decision-legend">${pmmEvidenceTypeMarkup("observed", "Observed move")}${pmmEvidenceTypeMarkup("inference", "Inferred target")}${pmmEvidenceTypeMarkup("unresolved", "Needs proof — not field-usable")}</div></div>
    <div class="battlecard-tabs pmm-narrative-tabs" role="tablist" aria-label="Competitor selling motions">
      ${sellingMotions.groups.map((group) => `<button type="button" role="tab" data-battlecard-competitor="${escapeHtml(group.competitor)}" aria-selected="${group.competitor === activeGroup.competitor}" class="${group.competitor === activeGroup.competitor ? "active" : ""}"><strong>${escapeHtml(group.competitor === "Thermo Fisher" ? "Thermo" : group.competitor)}</strong><span>${group.moves.length} move${group.moves.length === 1 ? "" : "s"} · ${group.moves.filter((move) => move.watersResponse.status === "needs proof").length} need proof</span></button>`).join("")}
    </div>
    <section class="pmm-selling-motion-list" role="tabpanel" aria-label="${escapeHtml(activeGroup.competitor)} competitor plays and Waters responses">
      <header class="pmm-selling-motion-list-header"><div><span>Competitor plays · ${escapeHtml(horizonLabel())}</span><h4>${escapeHtml(activeGroup.competitor)}</h4></div><small>Only field-citable, non-blocked evidence can support a Waters response.</small></header>
      ${activeGroup.moves.map(pmmSellingMotionCardMarkup).join("")}
    </section>`;
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
    fieldCitable: false,
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
    .map((record) => ({ label: record.label, detail: record.detail, url: record.url, ...pmmGovernanceFields(record) }));
  const caveats = [...new Set([
    ...claims.map((claim) => claim.caveat).filter(Boolean),
    ...(narrative?.limitations || []),
    ...(proof.length ? [] : ["No claim-compatible proof is currently available for the included proposed wording."]),
  ])];
  return {
    ...definition,
    id: `${pmmArtifactSegmentId(segment)}::${definition.id}`,
    fieldCitable: false,
    approvalState: governingPosition.approvalState,
    definitionId: definition.id,
    segmentId: pmmArtifactSegmentId(segment),
    target: `${segment.segment}${segment.application !== "All" ? ` · ${segment.application}` : ""} · ${pmmTargetingDisplayValue(governingPosition.targeting.watersProduct, "All Waters products")} · ${segment.competitor}`,
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
      fieldCitable: false,
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
  return `<ul>${artifact.claims.map((claim) => `<li><strong>${escapeHtml(claim.wording)}</strong><span>${escapeHtml(claim.substantiationStatus)} · ${escapeHtml(pmmApprovalStateLabel(claim.approvalState))}</span></li>`).join("")}</ul>`;
}

function pmmArtifactEvidenceMarkup(artifact) {
  if (!artifact.evidenceFootnotes.length) return `<p class="pmm-artifact-unresolved">Evidence footnotes unavailable.</p>`;
  return `<div class="pmm-evidence-reference-list">${artifact.evidenceFootnotes.slice(0, 10).map((source) => pmmCanonicalEvidenceReferenceMarkup(source, "Artifact footnote")).join("")}</div>`;
}

function pmmArtifactCardMarkup(artifact, index) {
  const approvalEstablished = artifact.claims.length > 0 && artifact.claims.every((claim) => claim.approvalEstablished === true && claim.approvedWording);
  return `<article class="pmm-artifact-card ${approvalEstablished ? "pmm-artifact-approved" : "pmm-artifact-draft"}" data-artifact-id="${escapeHtml(artifact.id)}" data-artifact-approval="${approvalEstablished ? "approved" : "draft"}">
    <header><div><span>Artifact ${index + 1} · ${escapeHtml(artifact.extension)}</span><h4>${escapeHtml(artifact.title)}</h4><p>${escapeHtml(artifact.purpose)}</p></div><strong>${approvalEstablished ? "APPROVAL ESTABLISHED" : "DRAFT — NOT APPROVED"}</strong></header>
    <div class="pmm-artifact-target"><span>Target / buying situation</span><strong>${escapeHtml(artifact.target)}</strong><p>${escapeHtml(artifact.buyingSituation)}</p></div>
    ${pmmArtifactWorkflowMarkup(artifact)}
    <div class="pmm-artifact-actions"><button type="button" data-pmm-artifact-export="${escapeHtml(artifact.id)}">Export ${escapeHtml(artifact.extension)}</button><span aria-live="polite"></span></div>
    <details ${index < 4 ? "open" : ""}><summary>Review governed artifact content</summary><div class="pmm-artifact-content">
      <section><h5>Governing Position</h5><p>${escapeHtml(artifact.governingPosition.primaryValueProposition)}</p><small>Parity: ${escapeHtml(artifact.governingPosition.pointOfParity)} · Difference: ${escapeHtml(artifact.governingPosition.pointOfDifference)} · ${escapeHtml(pmmApprovalStateLabel(artifact.governingPosition.approvalState))}</small></section>
      <section><h5>Role-Specific Messages</h5><ul>${artifact.roleMessages.map((role) => `<li><strong>${escapeHtml(role.role)}</strong><span>${escapeHtml(role.message)}</span><small>${escapeHtml(role.classification)}</small></li>`).join("")}</ul></section>
      <section><h5>Competitor Response</h5><p>${escapeHtml(artifact.competitorResponse)}</p><small>Proposed — not approved unless the included claim record establishes otherwise.</small></section>
      <section><h5>Claims and Approval State</h5>${pmmArtifactClaimsMarkup(artifact)}</section>
      <section><h5>Proof and Caveats</h5>${artifact.proof.length ? `<div class="pmm-evidence-reference-list">${artifact.proof.map((proof) => pmmCanonicalEvidenceReferenceMarkup(proof, "Artifact proof")).join("")}</div>` : `<p class="pmm-artifact-unresolved">Compatible proof unavailable.</p>`}${pmmCaveatDetailsMarkup(`${artifact.caveats.length} caveat${artifact.caveats.length === 1 ? "" : "s"}`, artifact.caveats)}</section>
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

function pmmAppendixRecord({ title, type, sourceName, date, confidence, description, url, caveat = "", linkAvailable = true, fieldCitable = false, approvalState = "draft" }) {
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
    fieldCitable: fieldCitable === true,
    approvalState: pmmEvidenceGovernance.normalizeApprovalState(approvalState),
  };
}

function pmmAppendixLaunchConferenceRecords() {
  const launches = pmmGovernedRecords(currentLaunches()).map((launch) => pmmAppendixRecord({
    ...pmmGovernanceFields(launch),
    title: `${launch.competitor}: ${launch.product || launch.title}`,
    type: "Observed official launch",
    sourceName: launch.sourceName || "Official product source",
    date: launch.date,
    confidence: launch.confidence,
    description: launch.summary || launch.signalType,
    url: timelineUrlForLaunch(launch),
  }));
  const conferences = pmmGovernedRecords(currentConferenceSources()).map((event) => {
    const competitorStatus = (event.competitorWatch || [])
      .map((item) => `${item.name}: ${item.status}`)
      .join(" · ");
    return pmmAppendixRecord({
      ...pmmGovernanceFields(event),
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
  const notes = pmmGovernedRecords(currentCompetitorApplicationNotes()).map((note) => pmmAppendixRecord({
    ...pmmGovernanceFields(note),
    title: `${note.competitor}: ${note.title}`,
    type: note.sourceType || "Observed official application note",
    sourceName: `${note.competitor} official source`,
    date: note.date,
    description: note.evidenceStatement,
    url: note.sourceUrl,
    caveat: "An application note demonstrates a published workflow; it does not establish comparative superiority or market adoption.",
  }));
  const publications = pmmGovernedRecords(signals)
    .filter((signal) => signal.category === "Scientific application intelligence" || /publication|journal|pubmed/i.test(`${signal.signalType} ${signal.sourceName}`))
    .map((signal) => pmmAppendixRecord({
      ...pmmGovernanceFields(signal),
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
  const filings = pmmGovernedRecords(currentFilingInsights()).map((item) => pmmAppendixRecord({
    ...pmmGovernanceFields(item),
    title: `${item.competitor}: ${item.headline}`,
    type: `Observed ${item.filingType || "company filing"}`,
    sourceName: item.sourceName || "Company filing",
    date: item.date,
    description: item.evidence || item.whyItMatters,
    url: item.sourceUrl,
    caveat: "A company filing supports the reported corporate statement; it does not by itself validate a product claim.",
  }));
  const partnerships = pmmGovernedRecords(currentStrategicSignals(signals)).map((signal) => pmmAppendixRecord({
    ...pmmGovernanceFields(signal),
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
  return pmmDeduplicateSources(pmmGovernedRecords(signals)
    .filter((signal) => isHttpUrl(signal.sourceUrl) && !groupedUrls.has(canonicalEvidenceUrl(signal.sourceUrl)))
    .map((signal) => pmmAppendixRecord({
      ...pmmGovernanceFields(signal),
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
  const records = pmmGovernedRecords(currentCustomerVoiceItems()).flatMap((item) => customerVoiceSourceLinks(item).map((link) => pmmAppendixRecord({
    ...pmmGovernanceFields(item),
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
  return pmmGovernedRecords(state.sourceCatalog?.sources || [])
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
      ...pmmGovernanceFields(source),
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
  const competitorProducts = pmmGovernedRecords(state.historicalProductCatalog?.products || [])
    .filter((product) => selectedCompetitor === "All"
      ? marketingBattlecardCompetitors.includes(product.competitor)
      : product.competitor === selectedCompetitor)
    .filter((product) => technologyMatchesFilter(
      product.technology,
      filters.technology.value,
      `${product.product} ${product.productFamily || ""} ${product.subtechnology || ""}`,
    ));
  const watersProducts = selectedCompetitor === "All"
    ? pmmGovernedRecords(state.historicalWatersCatalog?.products || []).filter((product) => technologyMatchesFilter(
      product.technology,
      filters.technology.value,
      product.product,
    ))
    : [];
  const historical = [...competitorProducts, ...watersProducts].map((product) => pmmAppendixRecord({
    ...pmmGovernanceFields(product),
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
    ...pmmGovernedRecords(state.productData?.launches || []).map((launch) => [launch.id, launch.competitor]),
    ...pmmGovernedRecords(state.historicalProductCatalog?.products || []).map((product) => [product.id, product.competitor]),
  ]);
  const technical = pmmGovernedRecords(state.technicalComparisons?.profiles || []).flatMap((profile) => {
    const competitor = launchCompetitors.get(profile.launchId) || "Competitor unresolved";
    if (selectedCompetitor !== "All" && competitor !== selectedCompetitor) return [];
    return pmmGovernedRecords(profile.rows || []).flatMap((row) => [
      pmmAppendixRecord({
        ...pmmGovernanceFields(row),
        title: `${competitor} versus Waters: ${row.dimension}`,
        type: `Observed technical source · ${row.evidenceType || "classification unresolved"}`,
        sourceName: `${competitor} source`,
        date: profile.asOfDate,
        description: row.interpretation,
        url: row.competitorSourceUrl,
        caveat: "Published specifications may use different conditions; review the comparison limitation before reuse.",
      }),
      pmmAppendixRecord({
        approvalState: row.approvalState,
        fieldCitable: false,
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
  const evidenceId = record.canonicalEvidenceId || pmmEvidenceObjectId(record.url);
  const citationState = record.fieldCitable ? "Field-citable" : "Not field-citable";
  const approvalLabel = pmmApprovalStateLabel(record.approvalState);
  const detailItems = [
    record.description,
    record.caveat,
    record.mergedRecordCount > 1 ? `${record.mergedRecordCount} evidence records share this canonical URL and are counted once.` : "",
  ];
  return `<article class="pmm-appendix-record" data-field-citable="${record.fieldCitable === true}" data-approval-state="${escapeHtml(record.approvalState)}" ${evidenceId ? `id="pmm-evidence-object-${escapeHtml(evidenceId)}" data-canonical-evidence-id="${escapeHtml(evidenceId)}" tabindex="-1"` : ""}>
    <div><span>${evidenceId ? `${escapeHtml(evidenceId)} · ` : ""}${escapeHtml(record.type)}</span><strong>${escapeHtml(record.title)}</strong><small>${escapeHtml(record.sourceName)} · ${escapeHtml(date)} · ${escapeHtml(confidence)}${record.sourceDomain ? ` · ${escapeHtml(record.sourceDomain)}` : ""} · ${escapeHtml(citationState)} · ${escapeHtml(approvalLabel)}</small>${pmmCaveatDetailsMarkup("Evidence summary and caveats", detailItems)}</div>
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

function pmmCollectCanonicalEvidenceSources(value, output = [], visited = new WeakSet()) {
  if (!value || typeof value !== "object") return output;
  if (visited.has(value)) return output;
  visited.add(value);
  if (isHttpUrl(value.url)) output.push(value);
  if (Array.isArray(value)) value.forEach((item) => pmmCollectCanonicalEvidenceSources(item, output, visited));
  else Object.values(value).forEach((item) => pmmCollectCanonicalEvidenceSources(item, output, visited));
  return output;
}

function pmmCanonicalizeEvidenceAppendix(appendix, decisionObjects) {
  const existingUrls = new Set(appendix.groups.flatMap((group) => group.records)
    .map((record) => PmmDataContract.canonicalUrl(record.url)).filter(Boolean));
  const missingRecords = [];
  pmmCollectCanonicalEvidenceSources(decisionObjects).forEach((source) => {
    const canonical = PmmDataContract.canonicalUrl(source.url);
    if (!canonical || existingUrls.has(canonical)) return;
    existingUrls.add(canonical);
    missingRecords.push(pmmAppendixRecord({
      ...pmmGovernanceFields(source),
      title: source.label || source.title || source.sourceName || "Decision evidence",
      type: source.evidenceType || source.evidenceRole || "Decision-support evidence",
      sourceName: source.sourceName || PmmDataContract.sourceDomain(source.url) || "Public source",
      date: source.date || source.eventDate || "",
      confidence: source.confidence,
      description: source.detail || source.description || source.summary || "Referenced by a governed PMM object.",
      url: source.url,
      caveat: source.caveat || "Use only for the governed context that references this evidence object.",
    }));
  });
  const groups = missingRecords.length ? [...appendix.groups, {
    id: "decision-support-evidence",
    title: "Decision-Support Evidence Objects",
    description: "Canonical evidence referenced by a PMM decision but not otherwise represented in the appendix groups.",
    caveat: "Presence in this group establishes traceability, not approval, comparability, or commercial importance.",
    records: missingRecords,
    emptyState: "Every decision evidence object is represented in another appendix group.",
  }] : appendix.groups;
  const decoratedGroups = groups.map((group) => ({
    ...group,
    records: group.records.map((record) => ({ ...record, canonicalEvidenceId: pmmEvidenceObjectId(record.url) })),
  }));
  const allRecords = decoratedGroups.flatMap((group) => group.records);
  return {
    ...appendix,
    groups: decoratedGroups,
    uniqueSourceCount: appendix.uniqueSourceCount + missingRecords.length,
    sourceDomainCount: new Set(allRecords.map((record) => record.sourceDomain || PmmDataContract.sourceDomain(record.url)).filter(Boolean)).size,
    sourceFamilyCount: new Set(allRecords.map((record) => record.sourceFamily || PmmDataContract.sourceFamily(record)).filter(Boolean)).size,
    canonicalEvidenceObjectCount: allRecords.filter((record) => record.canonicalEvidenceId).length,
  };
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

function pmmClaimRiskScore(row) {
  const substantiation = { Unsupported: 60, Directional: 35, Proven: 0 }[row.substantiationStatus] ?? 45;
  const approval = row.approvalEstablished === true ? 0 : 25;
  const inapplicable = (row.evidenceRecords || []).some((record) => record.compatibility?.status === "Inapplicable") ? 15 : 0;
  return substantiation + approval + inapplicable;
}

function pmmHighestRiskClaim(rows) {
  return [...rows].sort((left, right) => pmmClaimRiskScore(right) - pmmClaimRiskScore(left)
    || String(left.proposedClaimWording).localeCompare(String(right.proposedClaimWording)))[0] || null;
}

function pmmNearestActivationDeadline(artifactProduction) {
  const dated = (artifactProduction?.artifacts || []).map((artifact) => ({ artifact, time: Date.parse(artifact.workflow.dueDate) }))
    .filter((item) => Number.isFinite(item.time)).sort((left, right) => left.time - right.time);
  if (!dated.length) return { label: "Deadline needed", artifact: null };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nearest = dated.find((item) => item.time >= today.getTime()) || dated[0];
  return { label: `${formatDate(nearest.artifact.workflow.dueDate)} · ${nearest.artifact.title}`, artifact: nearest.artifact };
}

function pmmStartHereModel(model) {
  const selectedSegment = model.artifactProduction?.selectedSegment || model.buyingCommittee.segments[0] || null;
  const claimPool = model.visibleClaimRows.length ? model.visibleClaimRows : model.claimRows;
  const highestRiskClaim = pmmHighestRiskClaim(claimPool);
  const approvedClaims = claimPool.filter((claim) => claim.approvalEstablished === true && claim.approvedWording);
  const defensibleDirections = claimPool
    .filter((claim) => claim.substantiationStatus !== "Unsupported"
      && claim.evidenceRecords.some((proof) => proof.compatibility.status === "Applicable"))
    .sort((left, right) => Number(right.substantiationStatus === "Proven") - Number(left.substantiationStatus === "Proven")
      || right.independentSourceCount - left.independentSourceCount
      || right.confidence - left.confidence);
  const inertia = model.marketChoice.levels.find((level) => level.name === "Inertia")?.alternatives?.[0];
  const primaryCompetitor = model.contexts[0]?.competitor || "Competitor unresolved";
  return {
    chosenSegment: selectedSegment ? `${selectedSegment.segment}${selectedSegment.application !== "All" ? ` · ${selectedSegment.application}` : ""}` : pmmTargetingDisplayValue(model.governingPosition.targeting.market, "Segment unresolved"),
    watersProduct: pmmTargetingDisplayValue(model.governingPosition.targeting.watersProduct, "All Waters products"),
    governingStatus: pmmApprovalStateLabel(model.governingPosition.approvalState),
    swingAttribute: model.governingPosition.selectedSwingAttribute,
    highestRiskClaim,
    approvedClaim: approvedClaims[0] || null,
    approvedClaimCount: approvedClaims.length,
    defensibleDirection: defensibleDirections[0] || null,
    defensibleDirectionCount: defensibleDirections.length,
    battlecardCount: headToHeadAvailableCompetitors().length,
    threat: `${primaryCompetitor} · ${inertia?.name || "Inertia threat unresolved"}`,
    nextDecision: model.proofPriorities.top[0] || model.positioningDecisions[0] || null,
    nearestDeadline: pmmNearestActivationDeadline(model.artifactProduction),
  };
}

function renderMarketingStartHere(summary) {
  const target = byId("pmmStartHere");
  const blockedClaim = summary.highestRiskClaim;
  const approvedClaim = summary.approvedClaim;
  const direction = summary.defensibleDirection;
  const decision = summary.nextDecision;
  const directionSources = direction?.evidenceRecords
    .filter((proof) => proof.compatibility.status === "Applicable")
    .slice(0, 2) || [];
  target.innerHTML = `<header class="pmm-command-header"><div><div class="pmm-eyebrow">Senior PMM Command Brief</div><h2 id="pmmStartHereTitle">What Waters Can Credibly Use to Win</h2><p>Customer-facing claims are separated from message hypotheses. Every usable direction has exact proof; every unsupported statement is visibly blocked.</p></div><div class="pmm-command-score"><strong>${summary.approvedClaimCount}</strong><span>approved claims available</span><small>${summary.defensibleDirectionCount} evidence-backed direction${summary.defensibleDirectionCount === 1 ? "" : "s"} still require approval</small></div></header>
    <div class="pmm-command-grid">
      <article class="pmm-command-card pmm-command-approved"><span>Approved claim to use now</span>${approvedClaim ? `<strong>${escapeHtml(approvedClaim.approvedWording)}</strong><small>${escapeHtml(approvedClaim.referenceBaseline)} · approval established</small>` : `<strong>None loaded — do not copy a superiority claim.</strong><small>Legal/claims approval is not established for any filtered statement.</small>`}</article>
      <article class="pmm-command-card pmm-command-direction"><span>Best evidence-backed direction</span>${direction ? `<strong>${escapeHtml(direction.proposedClaimWording)}</strong><small>${escapeHtml(direction.substantiationStatus)} · ${escapeHtml(pmmApprovalStateLabel(direction.approvalState))} · ${direction.independentSourceCount} established independent source organization${direction.independentSourceCount === 1 ? "" : "s"}</small><div class="pmm-command-sources">${directionSources.map((source) => pmmCanonicalEvidenceReferenceMarkup(source, "Applicable claim proof")).join("")}</div>` : `<strong>No applicable claim proof matches these filters.</strong><small>Use the battlecard discovery path and commission the required comparison.</small>`}</article>
      <article class="pmm-command-card pmm-command-blocked"><span>Do not say</span>${blockedClaim ? `<strong>${escapeHtml(blockedClaim.proposedClaimWording)}</strong><small>${escapeHtml(blockedClaim.substantiationStatus)} · ${escapeHtml(blockedClaim.comparabilityStatus)} · ${escapeHtml(pmmApprovalStateLabel(blockedClaim.approvalState))}</small>` : `<strong>No governed claim row matches this target.</strong><small>Unrelated evidence was not substituted.</small>`}</article>
      <article class="pmm-command-card pmm-command-build"><span>Build this proof next</span><strong>${escapeHtml(direction?.nextRequiredAction || blockedClaim?.nextRequiredAction || decision?.missingStudyEvidence || decision?.missingProof || "Proof requirement unresolved")}</strong><small>Owner needed · Deadline needed · Success measure needed</small></article>
    </div>
    <div class="pmm-command-actions" aria-label="Product Marketing priority actions"><a href="#pmm-head-to-head" data-section-nav="pmm-head-to-head"><span>1</span><strong>Open ${summary.battlecardCount} product battlecard${summary.battlecardCount === 1 ? "" : "s"}</strong><small>${escapeHtml(summary.watersProduct)}</small></a><a href="#pmm-claims-risk" data-section-nav="pmm-claims-risk"><span>2</span><strong>Govern claims</strong><small>Proof compatibility and approval</small></a><a href="#pmm-positioning-decisions" data-section-nav="pmm-positioning-decisions"><span>3</span><strong>Fund the proof gap</strong><small>${decision ? escapeHtml(decision.sellerAsset || decision.activation || "Seller asset unresolved") : "Decision unresolved"}</small></a><a href="#pmm-activation-artifacts" data-section-nav="pmm-activation-artifacts"><span>4</span><strong>Ship the asset</strong><small>${escapeHtml(summary.nearestDeadline.label)}</small></a></div>
    <dl class="pmm-command-context"><div><dt>Chosen segment</dt><dd>${escapeHtml(summary.chosenSegment)}</dd></div><div><dt>Waters product</dt><dd>${escapeHtml(summary.watersProduct)}</dd></div><div><dt>Governing position status</dt><dd>${escapeHtml(summary.governingStatus)}</dd></div><div><dt>Swing attribute</dt><dd>${escapeHtml(summary.swingAttribute)}</dd></div><div><dt>Competitor / inertia threat</dt><dd>${escapeHtml(summary.threat)}</dd></div><div><dt>Next required decision</dt><dd>${decision ? escapeHtml(decision.missingStudyEvidence || decision.missingProof || "Decision unavailable") : "Decision unavailable"}</dd></div><div><dt>Nearest activation deadline</dt><dd>${escapeHtml(summary.nearestDeadline.label)}</dd></div></dl>`;
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
    ${pmmMetricPill({ id: "proof-priorities", label: "Proof priorities", value: model.proofPriorities.top.length, target: "pmm-positioning-decisions", definition: "Displayed unsupported commercial-claim priorities. Calculation: gapQueue plus commercial/proof-tagged Decisions Needed items, excluding supported non-blocked Claim Control claims, ranked by deal impact × exact field-citable Customer Voice frequency and limited to three. Unit: displayed gap cards." })}
    ${pmmMetricPill({ id: "claims-awaiting-approval", label: "Claims without approval", value: kpis.claimsAwaitingApproval, target: "pmm-claims-risk", definition: "Displayed registry rows with no established legal/claims approval record. Calculation: visible claim rows where approvalEstablished is false, regardless of substantiation status. Unit: displayed rows. Global and claims-registry filters apply." })}
    ${pmmMetricPill({ id: "exact-customer-sources", label: "Exact customer sources", value: kpis.customerLanguageSources, target: "pmm-segment-cascade", definition: "Unique canonical URLs in the filtered customer-language evidence set. Calculation: valid exact customer URLs after URL normalization and deduplication. Unit: unique URLs, not records or independent organizations. All global filters apply." })}
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
    productComparatorClaimCandidates: model.productComparatorClaimCandidates,
    gapQueue: model.gapQueue,
    proofPriorities: model.proofPriorities,
    competitorPlays: model.competitorPlays,
    customerVoiceBarriers: model.customerVoiceBarriers,
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
  const governedSignals = pmmGovernedRecords(signals);
  const contexts = marketingPrioritizedCompetitorContexts(governedSignals);
  const provisionalGoverningPosition = pmmGoverningPosition(contexts);
  const provisionalPositioningDecisions = marketingPositioningDecisionCandidates(contexts, provisionalGoverningPosition);
  const buyingCommittee = pmmBuyingCommitteeModel(provisionalPositioningDecisions, contexts);
  const governingPosition = pmmGoverningPosition(contexts, buyingCommittee.selectedSwingAttribute);
  state.marketingGoverningPosition = governingPosition;
  const marketChoice = pmmMarketChoice(contexts, governingPosition, governedSignals);
  state.marketingMarketChoice = marketChoice;
  const adoptionValuePlans = pmmAdoptionValuePlans(buyingCommittee, contexts, marketChoice);
  const positioningDecisionCandidates = marketingPositioningDecisionCandidates(contexts, governingPosition);
  const claimRows = marketingClaimsProofRows(contexts, governingPosition);
  const comparatorClaimTransformation = pmmProductComparatorClaimTransformation();
  const customerVoiceBarrierDraft = pmmCustomerVoiceBarrierTransformation();
  const proofPriorities = pmmProofPriorities(governedSignals, comparatorClaimTransformation, customerVoiceBarrierDraft);
  const customerVoiceBarriers = customerVoiceBarrierTransformer.linkBarriersToProofPriorities(customerVoiceBarrierDraft, proofPriorities);
  const sharedGapQueue = [...comparatorClaimTransformation.gapQueue, ...customerVoiceBarrierDraft.valueAssumptionGapQueue];
  gapQueue.splice(0, gapQueue.length, ...sharedGapQueue);
  const competitorPlays = pmmCompetitorIntentSellingMotions(
    governedSignals,
    comparatorClaimTransformation.claimControlClaims,
    proofPriorities,
  );
  const positioningDecisions = pmmApplyClaimsRegistryToDecisions(positioningDecisionCandidates, claimRows);
  const narratives = contexts.map((context) => pmmCompetitiveNarrative(context, governingPosition))
    .sort((left, right) => right.score - left.score || right.confidence - left.confidence || left.competitor.localeCompare(right.competitor));
  const activationActions = positioningDecisions.map((decision, index) => pmmActivationDeliverable(decision, index + 1, governingPosition));
  const breakReport = pmmTargetingBreakReportModel(claimRows, buyingCommittee, positioningDecisions, narratives, adoptionValuePlans);
  const artifactProduction = pmmArtifactProductionModel(buyingCommittee, governingPosition, claimRows, narratives);
  normalizeMarketingClaimFilters(claimRows);
  const visibleClaimRows = marketingVisibleClaimRows(claimRows);
  let appendix = marketingEvidenceAppendixModel(governedSignals);
  appendix = pmmCanonicalizeEvidenceAppendix(appendix, {
    governingPosition,
    positioningDecisions,
    claimRows,
    buyingCommittee,
    narratives,
    adoptionValuePlans,
    artifactProduction,
    marketChoice,
    competitorPlays,
    customerVoiceBarriers,
  });
  const kpis = PmmDataContract.buildKpis({
    positioningDecisions,
    visibleClaimRows,
    customerLanguageRecords: appendix.customerLanguageRecords,
    appendix,
  });
  const baseModel = {
    contexts,
    governingPosition,
    marketChoice,
    buyingCommittee,
    adoptionValuePlans,
    positioningDecisions,
    claimRows,
    visibleClaimRows,
    productComparatorClaimCandidates: comparatorClaimTransformation.candidates,
    productComparatorSupportedClaims: comparatorClaimTransformation.claimControlClaims,
    comparatorGapQueue: comparatorClaimTransformation.gapQueue,
    gapQueue: sharedGapQueue,
    proofPriorities,
    competitorPlays,
    customerVoiceBarriers,
    narratives,
    activationActions,
    artifactProduction,
    breakReport,
    appendix,
    kpis,
    governanceFilters: { ...state.marketingGovernanceFilters },
  };
  return { ...baseModel, startHere: pmmStartHereModel(baseModel) };
}

function renderMarketingWorkspace(signals) {
  normalizeHeadToHeadSelection();
  const model = buildMarketingWorkspaceModel(signals);
  state.marketingWorkspaceModel = model;
  renderMarketingStartHere(model.startHere);
  renderHeadToHeadComparison();
  renderMarketingGoverningPosition(model.governingPosition);
  renderMarketingPositioningDecisions(model.proofPriorities);
  renderMarketingClaimsProof(
    model.claimRows,
    model.visibleClaimRows,
    model.governingPosition,
    model.productComparatorSupportedClaims,
    model.comparatorGapQueue,
  );
  renderMarketingAudienceCriteria(model.appendix.customerLanguageRecords, model.buyingCommittee);
  renderMarketingCompetitiveNarrative(signals, model.governingPosition, model.marketChoice, model.contexts);
  renderMarketingAdoptionValuePlans(model.adoptionValuePlans, model.customerVoiceBarriers);
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
  if (field === "dueDate" && state.marketingWorkspaceModel) {
    state.marketingWorkspaceModel.startHere = pmmStartHereModel(state.marketingWorkspaceModel);
    renderMarketingStartHere(state.marketingWorkspaceModel.startHere);
  }
  return true;
}

function setupMarketingWorkspaceControls() {
  state.marketingArtifactWorkflow = pmmLoadArtifactWorkflow();
  document.addEventListener("input", (event) => {
    const artifactField = event.target.closest("[data-pmm-artifact-field]");
    if (artifactField && state.view === "Marketing") pmmUpdateArtifactWorkflowField(artifactField);
  });
  document.addEventListener("change", (event) => {
    const productPicker = event.target.closest("[data-h2h-product-picker]");
    if (productPicker && state.view === "Marketing") {
      state.marketingTargeting.watersProduct = productPicker.value;
      state.headToHead.activeCompetitor = "";
      state.headToHead.competitorProductOverrides = {};
      render();
      return;
    }
    const productOverride = event.target.closest("[data-h2h-product-override]");
    if (productOverride && state.view === "Marketing") {
      const competitor = productOverride.dataset.h2hProductOverride;
      state.headToHead.competitorProductOverrides[competitor] = productOverride.value;
      if (state.headToHead.activeCompetitor === competitor) state.headToHead.competitorProductId = productOverride.value;
      persistHeadToHeadSelection();
      renderHeadToHeadComparison();
      return;
    }
    const headToHeadProductControl = event.target.closest("#pmmCompetitorProductFilter");
    if (headToHeadProductControl && state.view === "Marketing") {
      state.headToHead.competitorProductId = headToHeadProductControl.value;
      persistHeadToHeadSelection();
      renderHeadToHeadComparison();
      return;
    }
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
        if (key === "watersProduct") {
          state.headToHead.activeCompetitor = "";
          state.headToHead.competitorProductOverrides = {};
        }
        state.marketingClaimsFilters = { readiness: "All", audience: "All", classification: "All" };
        state.activeBattlecardCompetitor = "";
        render();
      }
      return;
    }
    const governanceControl = event.target.closest("[data-pmm-governance-filter]");
    if (governanceControl && state.view === "Marketing") {
      const key = governanceControl.dataset.pmmGovernanceFilter;
      if (key in state.marketingGovernanceFilters) {
        state.marketingGovernanceFilters[key] = governanceControl.value;
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
    const battlecardSelector = event.target.closest("[data-h2h-competitor]");
    if (battlecardSelector && state.view === "Marketing") {
      event.preventDefault();
      state.headToHead.activeCompetitor = battlecardSelector.dataset.h2hCompetitor;
      state.headToHead.competitorProductId = state.headToHead.competitorProductOverrides[state.headToHead.activeCompetitor] || "";
      persistHeadToHeadSelection();
      renderHeadToHeadComparison();
      byId("pmmTailoredPitchTitle")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const headToHeadCopy = event.target.closest("[data-h2h-copy]");
    if (headToHeadCopy && state.view === "Marketing") {
      event.preventDefault();
      const status = headToHeadCopy.parentElement?.querySelector("[aria-live]");
      const copyText = globalThis.PmmArtifactExports?.headToHeadTalkTrackText(state.headToHead.model);
      if (!copyText) {
        if (status) status.textContent = "No substantiated talk track is available.";
        return;
      }
      try {
        await navigator.clipboard.writeText(copyText);
        if (status) status.textContent = "Substantiated talk track copied.";
      } catch {
        if (status) status.textContent = "Clipboard unavailable.";
      }
      return;
    }
    const headToHeadPptx = event.target.closest("[data-h2h-export-pptx]");
    if (headToHeadPptx && state.view === "Marketing") {
      event.preventDefault();
      const status = headToHeadPptx.parentElement?.querySelector("[aria-live]");
      headToHeadPptx.disabled = true;
      if (status) status.textContent = "Preparing governed battlecard…";
      try {
        const filename = await globalThis.PmmArtifactExports.exportHeadToHeadPptx(state.headToHead.model);
        if (status) status.textContent = `${filename} downloaded.`;
      } catch (error) {
        if (status) status.textContent = `Export failed: ${error.message}`;
      } finally {
        headToHeadPptx.disabled = false;
      }
      return;
    }
    const headToHeadPrint = event.target.closest("[data-h2h-print]");
    if (headToHeadPrint && state.view === "Marketing") {
      event.preventDefault();
      document.body.classList.add("pmm-h2h-printing");
      const clearPrintMode = () => document.body.classList.remove("pmm-h2h-printing");
      window.addEventListener("afterprint", clearPrintMode, { once: true });
      window.print();
      window.setTimeout(clearPrintMode, 1000);
      return;
    }
    const proofPriorityLink = event.target.closest("[data-proof-priority-link]");
    if (proofPriorityLink && state.view === "Marketing") {
      event.preventDefault();
      const targetId = String(proofPriorityLink.getAttribute("href") || "").replace(/^#/, "");
      const priorityPanel = byId("pmm-positioning-decisions");
      if (priorityPanel?.classList.contains("is-collapsed")) setPanelCollapsed(priorityPanel, false);
      const priorityCard = byId(targetId);
      if (priorityCard) {
        priorityCard.closest("details")?.setAttribute("open", "");
        window.history.replaceState(null, "", `#${targetId}`);
        priorityCard.scrollIntoView({ behavior: "smooth", block: "center" });
        priorityCard.focus({ preventScroll: true });
      } else {
        navigateToDashboardSection("pmm-positioning-decisions");
      }
      return;
    }
    const evidenceReference = event.target.closest("[data-pmm-evidence-ref]");
    if (evidenceReference && state.view === "Marketing") {
      event.preventDefault();
      const evidenceId = evidenceReference.dataset.pmmEvidenceRef;
      const record = byId(`pmm-evidence-object-${evidenceId}`);
      const appendixPanel = byId("pmm-evidence-appendix");
      if (appendixPanel?.classList.contains("is-collapsed")) setPanelCollapsed(appendixPanel, false);
      if (record) {
        record.closest("details")?.setAttribute("open", "");
        window.history.replaceState(null, "", `#${record.id}`);
        record.scrollIntoView({ behavior: "smooth", block: "center" });
        record.focus({ preventScroll: true });
      } else {
        navigateToDashboardSection("pmm-evidence-appendix");
      }
      return;
    }
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
      ...pmmGovernanceFields(launch),
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
      ...pmmGovernanceFields(signal),
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
      ...pmmGovernanceFields(signal),
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
      ...pmmGovernanceFields(insight),
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
      child.classList.toggle("standard-role-section", !child.matches(".topbar, .filters, #marketingWorkspace, #customer-voice"));
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
    setCustomerVoiceTab(state.activeCustomerVoiceTab);
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
  if (!pmmEvidenceGovernance) throw new Error("Evidence governance schema gate failed to load");
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
  const linkHealthIndex = pmmEvidenceGovernance.buildLinkHealthIndex(linkHealth);
  const governed = async (dataResponse, datasetName) => pmmEvidenceGovernance.normalizeDataset(
    await dataResponse.json(),
    { datasetName, linkHealthIndex },
  );
  state.data = await governed(response, "intelligence");
  state.productData = await governed(productResponse, "product_launches");
  state.sourceCatalog = await governed(sourceResponse, "source_catalog");
  state.conferenceData = await governed(conferenceResponse, "conference_sources");
  state.conferencePrep = await governed(conferencePrepResponse, "conference_preparation");
  state.journalSources = await governed(journalSourceResponse, "journal_sources");
  state.competitorApplicationNotes = await governed(competitorApplicationNoteResponse, "competitor_application_notes");
  state.marketApplicationSources = await governed(marketApplicationSourceResponse, "market_application_sources");
  state.productComparisons = await governed(productComparisonResponse, "product_comparisons");
  state.historicalProductCatalog = await governed(historicalProductCatalogResponse, "historical_product_catalog");
  state.historicalWatersCatalog = await governed(historicalWatersCatalogResponse, "historical_waters_catalog");
  state.technicalComparisons = await governed(technicalComparisonResponse, "technical_comparisons");
  state.filingInsights = await governed(filingInsightResponse, "filing_insights");
  state.customerVoice = await governed(customerVoiceResponse, "customer_voice");
  state.refreshStatus = await refreshStatusResponse.json();
  state.linkHealth = linkHealth;
  byId("asOf").textContent = `Real public data as of ${state.data.asOfDate}`;
  renderRefreshStatus();
  populateCompetitors();
  initializeHeadToHeadSelection();
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
