const conferenceState = {
  data: null,
  sourceCatalog: [],
  publishedSourceCatalog: [],
  sourceCatalogExpanded: false,
  selectedEventId: "",
  eventPage: 1,
  eventPageSize: 4,
  filters: { market: "All", technology: "All", competitor: "All" },
};

const CONFERENCE_ADMIN_STORAGE_KEY = "waters-conference-admin-catalog-v1";

const byId = (id) => document.getElementById(id);
const conferenceDatePolicy = globalThis.ConferenceDatePolicy;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value, options = { month: "short", day: "numeric", year: "numeric" }) {
  if (!value) return "Date to be confirmed";
  return new Intl.DateTimeFormat("en-US", options).format(new Date(`${value}T12:00:00`));
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function readConferenceAdminCatalog() {
  try {
    const catalog = JSON.parse(localStorage.getItem(CONFERENCE_ADMIN_STORAGE_KEY));
    return Array.isArray(catalog) ? catalog : null;
  } catch {
    return null;
  }
}

function publishedConferenceCatalog(catalog) {
  return (catalog?.events || []).map((event) => ({
    id: event.id,
    title: event.eventName,
    link: event.website,
    tier: event.tier || "Tier 3",
    source: "Published catalog",
  }));
}

function conferenceTierClass(tier) {
  return String(tier || "Tier 3").toLowerCase().replace(" ", "-");
}

function preparationEventForSource(source) {
  const normalizedTitle = String(source.title || "").toLowerCase();
  const normalizedLink = String(source.link || "").replace(/\/$/, "");
  return (conferenceState.data?.events || []).find((event) =>
    event.id === source.id
    || event.eventName.toLowerCase() === normalizedTitle
    || String(event.website || "").replace(/\/$/, "") === normalizedLink
  );
}

function renderConferenceSourceCatalog() {
  const catalog = byId("conferenceSourceCatalog");
  if (!catalog) return;
  const sorted = [...conferenceState.sourceCatalog].sort((a, b) => {
    const aDraft = a.source === "Published catalog" ? 1 : 0;
    const bDraft = b.source === "Published catalog" ? 1 : 0;
    return aDraft - bDraft || a.tier.localeCompare(b.tier) || a.title.localeCompare(b.title);
  });
  const visible = conferenceState.sourceCatalogExpanded ? sorted : sorted.slice(0, 8);
  byId("conferenceSourceCatalogCount").textContent = `${sorted.length} monitored source${sorted.length === 1 ? "" : "s"}`;
  const toggle = byId("toggleConferenceSourceCatalog");
  toggle.hidden = sorted.length <= 8;
  toggle.textContent = conferenceState.sourceCatalogExpanded ? "Show less" : `Show all ${sorted.length}`;
  toggle.setAttribute("aria-expanded", String(conferenceState.sourceCatalogExpanded));
  catalog.innerHTML = visible.map((source) => {
    const event = preparationEventForSource(source);
    const isAdminUpdate = source.source !== "Published catalog";
    return `
      <article class="conference-source-card${isAdminUpdate ? " admin-update" : ""}">
        <div class="conference-source-card-topline">
          <span class="conference-tier-badge ${conferenceTierClass(source.tier)}">${escapeHtml(source.tier || "Tier 3")}</span>
          <small>${isAdminUpdate ? "Admin update" : event ? "Brief available" : "Monitoring only"}</small>
        </div>
        <strong>${escapeHtml(source.title)}</strong>
        <p>${event ? `${escapeHtml(event.dateRange)} · Preparation brief available` : "Awaiting dates and intelligence enrichment"}</p>
        <div class="conference-source-card-actions">
          <a href="${escapeHtml(source.link)}" target="_blank" rel="noreferrer">Official source ↗</a>
          ${event ? `<button type="button" data-conference-event="${escapeHtml(event.id)}">Open brief →</button>` : `<a href="conference-admin.html">Edit source →</a>`}
        </div>
      </article>
    `;
  }).join("") || `<p class="conference-empty-note">No conference sources are currently monitored.</p>`;
}

function refreshConferenceSourceCatalog() {
  conferenceState.sourceCatalog = readConferenceAdminCatalog() || [...conferenceState.publishedSourceCatalog];
  renderConferenceSourceCatalog();
}

function competitorNames(event) {
  return uniqueSorted([
    ...(event.competitorWatch || []).map((item) => item.name),
    ...(event.competitorContent || []).flatMap((item) => item.competitor.split(/,| and /).map((name) => name.trim())),
  ]);
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

function filteredEvents() {
  const cutoffDate = conferenceDatePolicy.effectiveCurrentDate(conferenceState.data?.asOfDate);
  return [...(conferenceState.data?.events || [])]
    .filter((event) => conferenceDatePolicy.isCurrentOrUpcoming(event, cutoffDate))
    .filter((event) => conferenceState.filters.market === "All" || event.marketSegments.includes(conferenceState.filters.market))
    .filter((event) => conferenceState.filters.technology === "All" || event.technologyFocus.includes(conferenceState.filters.technology))
    .filter((event) => conferenceState.filters.competitor === "All" || competitorNames(event).includes(conferenceState.filters.competitor))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

function daysUntil(value) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDate = new Date(`${value}T00:00:00`);
  return Math.max(0, Math.ceil((eventDate - today) / 86400000));
}

function renderStats(events) {
  const competitorMentions = events.reduce((sum, event) => sum + (event.competitorWatch || []).length, 0);
  const nextEvent = events[0];
  byId("conferenceStats").innerHTML = `
    <article><span class="stat-icon blue">▣</span><div><strong>${events.length}</strong><p>upcoming event${events.length === 1 ? "" : "s"}</p></div></article>
    <button type="button" class="conference-stat-card interactive" data-view-competitor-appearances aria-label="View ${competitorMentions} competitor appearances to monitor"><span class="stat-icon amber">◎</span><div><strong>${competitorMentions}</strong><p>competitor appearances to monitor</p><small>View details →</small></div></button>
    <article><span class="stat-icon green">◷</span><div><strong>${nextEvent ? daysUntil(nextEvent.startDate) : "—"}</strong><p>${nextEvent ? `days to ${escapeHtml(nextEvent.eventName)}` : "no matching event"}</p></div></article>
  `;
}

function competitorAppearanceSource(event, competitor) {
  const normalized = competitor.toLowerCase();
  const evidence = (event.competitorContent || []).find((item) => item.competitor.toLowerCase().includes(normalized));
  return evidence
    ? { label: evidence.sourceLabel, url: evidence.sourceUrl }
    : { label: "Official event page", url: event.website };
}

function renderCompetitorAppearancesModal(events) {
  const appearances = events.flatMap((event) => (event.competitorWatch || []).map((item) => ({ event, ...item })));
  byId("competitorAppearancesSummary").textContent = `${appearances.length} appearances across ${events.length} matching conference${events.length === 1 ? "" : "s"}. Status text is preserved from the reviewed event evidence.`;
  byId("competitorAppearancesList").innerHTML = events.map((event) => {
    const rows = (event.competitorWatch || []).map((item) => {
      const source = competitorAppearanceSource(event, item.name);
      return `
        <article class="competitor-appearance-row">
          <div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.status)}</span></div>
          <a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.label)} ↗</a>
        </article>
      `;
    }).join("");
    if (!rows) return "";
    return `
      <section class="competitor-appearance-group">
        <header><div><strong>${escapeHtml(event.eventName)}</strong><span>${escapeHtml(event.dateRange)}</span></div></header>
        <div>${rows}</div>
      </section>
    `;
  }).join("") || `<p class="conference-empty-note">No competitor appearances match the active filters.</p>`;
}

function openCompetitorAppearancesModal() {
  const modal = byId("competitorAppearancesModal");
  renderCompetitorAppearancesModal(filteredEvents());
  if (typeof modal.showModal === "function") modal.showModal();
  else modal.setAttribute("open", "");
}

function closeCompetitorAppearancesModal() {
  const modal = byId("competitorAppearancesModal");
  if (typeof modal.close === "function") modal.close();
  else modal.removeAttribute("open");
}

function eventButtonMarkup(event, index, selected, kind) {
  const start = new Date(`${event.startDate}T12:00:00`);
  const month = new Intl.DateTimeFormat("en-US", { month: "short" }).format(start);
  const day = start.getDate();
  if (kind === "timeline") {
    return `
      <button type="button" class="timeline-event${selected ? " selected" : ""}" data-conference-event="${escapeHtml(event.id)}" role="tab" aria-selected="${selected}" aria-controls="conferenceEventDetail">
        <span class="timeline-dot"></span>
        <small>${escapeHtml(month)} ${day}</small>
        <strong>${escapeHtml(event.eventName)}</strong>
      </button>
    `;
  }
  return `
    <button type="button" class="conference-event-option${selected ? " selected" : ""}" data-conference-event="${escapeHtml(event.id)}" role="tab" aria-selected="${selected}" aria-controls="conferenceEventDetail">
      <span class="event-date-box"><small>${escapeHtml(month)}</small><strong>${day}</strong></span>
      <span class="event-option-copy">
        <strong>${escapeHtml(event.eventName)}</strong>
        <small>${escapeHtml(event.dateRange)} · ${escapeHtml(event.marketSegments.join(", "))}</small>
        <span>${escapeHtml(event.annualTheme)}</span>
      </span>
    </button>
  `;
}

function competitorContentMarkup(items) {
  if (!items?.length) return `<p class="conference-empty-note">No competitor-specific content has been mapped for this event.</p>`;
  return items.map((item) => {
    const confirmed = item.evidenceStatus === "Confirmed in 2026 program";
    return `
      <article class="competitor-evidence-card">
        <div><strong>${escapeHtml(item.competitor)}</strong><span class="evidence-status ${confirmed ? "confirmed" : "expected"}">${confirmed ? "Confirmed" : "Expected · not confirmed"}</span></div>
        <p>${escapeHtml(item.content)}</p>
        ${item.displayEvidenceBasis === false ? "" : `<small><strong>How this was derived:</strong> ${escapeHtml(item.evidenceBasis)}</small>`}
        <a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.sourceLabel)} ↗</a>
      </article>
    `;
  }).join("");
}

function scientificContentMarkup(items) {
  return (items || []).map((item, index) => `
    <article class="scientific-prep-card">
      <span>${index + 1}</span>
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.deliverable)}</p>
        <small><strong>Proof to bring:</strong> ${escapeHtml(item.proofNeeded)}</small>
      </div>
    </article>
  `).join("");
}

function boothMarkup(items) {
  return (items || []).map((item) => `
    <article class="booth-product-card">
      <a href="${escapeHtml(item.productUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.product)} ↗</a>
      <p><strong>Booth role:</strong> ${escapeHtml(item.role)}</p>
      <p><strong>Lead message:</strong> ${escapeHtml(item.message)}</p>
    </article>
  `).join("");
}

function renderEventDetail(event) {
  if (!event) {
    byId("conferenceEventDetail").innerHTML = `<div class="conference-no-results"><strong>No conferences match these filters.</strong><p>Reset or broaden the filters to restore the preparation briefs.</p></div>`;
    return;
  }
  const focus = (event.scientificFocus || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const trends = (event.industryTrendsToWatch || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const prep = (event.watersPrep || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const sources = (event.monitoringLinks || []).map((item) => `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.label)} ↗</a>`).join("");
  const tags = [
    event.location ? `<span class="location-capsule" aria-label="Conference location">⌖ ${escapeHtml(event.location)}</span>` : "",
    ...[...event.marketSegments, ...event.technologyFocus].map((item) => `<span>${escapeHtml(item)}</span>`),
  ].join("");

  byId("conferenceEventDetail").innerHTML = `
    <header class="event-detail-header">
      <div>
        <span class="event-detail-kicker">Selected conference</span>
        <h2>${escapeHtml(event.eventName)}</h2>
        <p>${escapeHtml(event.dateRange)}</p>
      </div>
      <a class="event-website-link" href="${escapeHtml(event.website)}" target="_blank" rel="noreferrer">Open event website ↗</a>
    </header>
    <div class="event-tag-row">${tags}</div>

    <section class="event-theme-hero">
      <span>2026 event theme</span>
      <h3>${escapeHtml(event.annualTheme)}</h3>
      <div class="waters-move-callout">
        <small>Recommended Waters move</small>
        <strong>${escapeHtml(event.watersPrep?.[0] || "Open the full brief and confirm the priority proof points.")}</strong>
      </div>
    </section>

    <div class="event-detail-grid">
      <section class="event-content-card">
        <div class="content-card-heading"><span>01</span><h3>Theme and Scientific Focus</h3></div>
        <ul>${focus}</ul>
        <h4>Why It Matters</h4>
        <ul class="trend-list">${trends}</ul>
      </section>
      <section class="event-content-card competitor-intelligence-card">
        <div class="content-card-heading"><span>02</span><div><h3>What Competitors May Talk About</h3><p>Confirmed sessions are separated from evidence-based expectations.</p></div></div>
        <div class="competitor-evidence-grid">${competitorContentMarkup(event.competitorContent)}</div>
      </section>
    </div>

    <section class="event-full-section">
      <div class="content-card-heading"><span>03</span><div><h3>Scientific Content Waters Should Prepare</h3><p>Each recommendation states the deliverable and proof required.</p></div></div>
      <div class="scientific-prep-grid">${scientificContentMarkup(event.watersScientificContent)}</div>
    </section>

    <section class="event-full-section">
      <div class="content-card-heading"><span>04</span><div><h3>Products and Solutions to Bring to the Booth</h3><p>Product role and lead message for this specific audience.</p></div></div>
      <div class="booth-product-grid">${boothMarkup(event.boothRecommendations)}</div>
    </section>

    <section class="event-prep-source-grid">
      <div class="event-prep-priorities">
        <span>Waters preparation priorities</span>
        <ol>${prep}</ol>
      </div>
      <div class="event-source-panel">
        <span>Official event sources</span>
        <div>${sources}</div>
      </div>
    </section>
  `;
}

function renderConferencePage() {
  const events = filteredEvents();
  const pageCount = Math.max(1, Math.ceil(events.length / conferenceState.eventPageSize));
  conferenceState.eventPage = Math.min(Math.max(1, conferenceState.eventPage), pageCount);
  if (!events.some((event) => event.id === conferenceState.selectedEventId)) {
    conferenceState.eventPage = 1;
    conferenceState.selectedEventId = events[0]?.id || "";
  }
  const pageStart = (conferenceState.eventPage - 1) * conferenceState.eventPageSize;
  const visibleEvents = events.slice(pageStart, pageStart + conferenceState.eventPageSize);
  if (events.length && !visibleEvents.some((event) => event.id === conferenceState.selectedEventId)) {
    conferenceState.selectedEventId = visibleEvents[0]?.id || "";
  }
  const selected = events.find((event) => event.id === conferenceState.selectedEventId);
  byId("conferenceResultCount").textContent = `${events.length} matching event${events.length === 1 ? "" : "s"}`;
  byId("conferenceTimeline").innerHTML = events.map((event, index) => eventButtonMarkup(event, index, event.id === conferenceState.selectedEventId, "timeline")).join("") || `<p class="conference-empty-note">No events match the current filters.</p>`;
  byId("conferenceEventList").innerHTML = visibleEvents.map((event, index) => eventButtonMarkup(event, pageStart + index, event.id === conferenceState.selectedEventId, "list")).join("") || `<p class="conference-empty-note">No matching conferences.</p>`;
  const pagination = byId("conferenceEventPagination");
  pagination.hidden = events.length <= conferenceState.eventPageSize;
  pagination.innerHTML = events.length > conferenceState.eventPageSize ? `
    <span>Page ${conferenceState.eventPage} of ${pageCount}</span>
    <div>
      <button type="button" data-conference-page="${conferenceState.eventPage - 1}" ${conferenceState.eventPage === 1 ? "disabled" : ""}>Previous</button>
      <button type="button" data-conference-page="${conferenceState.eventPage + 1}" ${conferenceState.eventPage === pageCount ? "disabled" : ""}>Next</button>
    </div>
  ` : "";
  renderStats(events);
  renderConferenceSourceCatalog();
  renderEventDetail(selected);
}

function selectConference(eventId) {
  const index = filteredEvents().findIndex((event) => event.id === eventId);
  if (index >= 0) conferenceState.eventPage = Math.floor(index / conferenceState.eventPageSize) + 1;
  conferenceState.selectedEventId = eventId;
  renderConferencePage();
  byId("conferenceEventDetail").scrollIntoView({ behavior: "smooth", block: "start" });
}

function selectedEvent() {
  return (conferenceState.data?.events || []).find((event) => event.id === conferenceState.selectedEventId);
}

async function copySelectedBrief() {
  const event = selectedEvent();
  if (!event) return;
  const brief = [
    event.eventName,
    event.dateRange,
    `Theme: ${event.annualTheme}`,
    "",
    "Waters preparation priorities:",
    ...(event.watersPrep || []).map((item) => `- ${item}`),
    "",
    "Scientific content:",
    ...(event.watersScientificContent || []).map((item) => `- ${item.title}: ${item.deliverable} Proof: ${item.proofNeeded}`),
    "",
    "Booth products:",
    ...(event.boothRecommendations || []).map((item) => `- ${item.product}: ${item.role} Message: ${item.message}`),
  ].join("\n");
  await navigator.clipboard.writeText(brief);
  const button = byId("copyConferenceBrief");
  button.textContent = "Brief copied";
  window.setTimeout(() => { button.textContent = "Copy selected brief"; }, 1600);
}

function setupInteractions() {
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-view-competitor-appearances]")) {
      openCompetitorAppearancesModal();
      return;
    }
    if (event.target.closest("[data-close-competitor-appearances]")) {
      closeCompetitorAppearancesModal();
      return;
    }
    const trigger = event.target.closest("[data-conference-event]");
    if (trigger) selectConference(trigger.dataset.conferenceEvent);
    const pageTrigger = event.target.closest("[data-conference-page]");
    if (pageTrigger && !pageTrigger.disabled) {
      conferenceState.eventPage = Number(pageTrigger.dataset.conferencePage) || 1;
      renderConferencePage();
      byId("conferenceEventList").scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });
  byId("toggleConferenceSourceCatalog").addEventListener("click", () => {
    conferenceState.sourceCatalogExpanded = !conferenceState.sourceCatalogExpanded;
    renderConferenceSourceCatalog();
  });
  window.addEventListener("storage", (event) => {
    if (event.key === CONFERENCE_ADMIN_STORAGE_KEY) refreshConferenceSourceCatalog();
  });
  window.addEventListener("pageshow", refreshConferenceSourceCatalog);
  window.addEventListener("focus", refreshConferenceSourceCatalog);
  byId("competitorAppearancesModal").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeCompetitorAppearancesModal();
  });
  [
    ["conferenceMarketFilter", "market"],
    ["conferenceTechnologyFilter", "technology"],
    ["conferenceCompetitorFilter", "competitor"],
  ].forEach(([id, key]) => byId(id).addEventListener("change", (event) => {
    conferenceState.filters[key] = event.target.value;
    conferenceState.eventPage = 1;
    renderConferencePage();
  }));
  byId("resetConferenceFilters").addEventListener("click", () => {
    Object.keys(conferenceState.filters).forEach((key) => { conferenceState.filters[key] = "All"; });
    conferenceState.eventPage = 1;
    ["conferenceMarketFilter", "conferenceTechnologyFilter", "conferenceCompetitorFilter"].forEach((id) => { byId(id).value = "All"; });
    renderConferencePage();
  });
  byId("copyConferenceBrief").addEventListener("click", copySelectedBrief);
}

async function initConferencePage() {
  const [preparationResponse, sourceResponse] = await Promise.all([
    fetch("data/conference_preparation.json", { cache: "no-store" }),
    fetch("data/conference_sources.json", { cache: "no-store" }),
  ]);
  if (!preparationResponse.ok) throw new Error(`Conference preparation data load failed: ${preparationResponse.status}`);
  if (!sourceResponse.ok) throw new Error(`Conference source catalog load failed: ${sourceResponse.status}`);
  conferenceState.data = await preparationResponse.json();
  conferenceState.publishedSourceCatalog = publishedConferenceCatalog(await sourceResponse.json());
  conferenceState.sourceCatalog = readConferenceAdminCatalog() || [...conferenceState.publishedSourceCatalog];
  const events = conferenceState.data.events || [];
  conferenceState.selectedEventId = events.find((event) => event.id === decodeURIComponent(location.hash.slice(1)))?.id || [...events].sort((a, b) => a.startDate.localeCompare(b.startDate))[0]?.id || "";
  populateSelect("conferenceMarketFilter", uniqueSorted(events.flatMap((event) => event.marketSegments)));
  populateSelect("conferenceTechnologyFilter", uniqueSorted(events.flatMap((event) => event.technologyFocus)));
  populateSelect("conferenceCompetitorFilter", uniqueSorted(events.flatMap(competitorNames)));
  setupInteractions();
  renderConferencePage();
}

initConferencePage().catch((error) => {
  byId("conferenceEventDetail").innerHTML = `<div class="conference-no-results"><strong>Conference preparation could not be loaded.</strong><p>${escapeHtml(error.message)}</p></div>`;
});
