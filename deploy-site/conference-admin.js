const conferenceAdminState = {
  records: [],
  publishedRecords: [],
  search: "",
  tier: "All",
};

const CONFERENCE_ADMIN_STORAGE_KEY = "waters-conference-admin-catalog-v1";
const CONFERENCE_ADMIN_SESSION_KEY = "waters-conference-admin-authorized-v1";
const CONFERENCE_ADMIN_USER_ID = "admin";
const CONFERENCE_ADMIN_PASSWORD_HASH = "14e3fd9cabc868dc8ead6ca4daea0fdeca90288ce2b4a66d0a47175f31ad127d";
const adminById = (id) => document.getElementById(id);
let conferenceAdminInitialized = false;

async function hashAdminCredential(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function setAdminAuthVisibility(isAuthorized) {
  document.body.classList.toggle("admin-auth-locked", !isAuthorized);
  adminById("adminAuthGate").hidden = isAuthorized;
  if (!isAuthorized) window.setTimeout(() => adminById("adminUserId").focus(), 0);
}

async function submitAdminCredentials(event) {
  event.preventDefault();
  const userId = adminById("adminUserId").value.trim();
  const passwordHash = await hashAdminCredential(adminById("adminPassword").value);
  const isAuthorized = userId === CONFERENCE_ADMIN_USER_ID && passwordHash === CONFERENCE_ADMIN_PASSWORD_HASH;
  if (!isAuthorized) {
    adminById("adminAuthError").hidden = false;
    adminById("adminPassword").value = "";
    adminById("adminPassword").focus();
    return;
  }
  sessionStorage.setItem(CONFERENCE_ADMIN_SESSION_KEY, "true");
  adminById("adminAuthError").hidden = true;
  setAdminAuthVisibility(true);
  await initConferenceAdmin();
}

function signOutConferenceAdmin() {
  sessionStorage.removeItem(CONFERENCE_ADMIN_SESSION_KEY);
  adminById("adminAuthForm").reset();
  setAdminAuthVisibility(false);
}

function adminEscapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeConferenceUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const parsed = new URL(candidate);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error("Enter a valid HTTP or HTTPS link.");
  return parsed.href;
}

function safeHostname(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

function recordId(title) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "conference";
  return `${slug}-${Date.now().toString(36)}`;
}

function readDraftCatalog() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONFERENCE_ADMIN_STORAGE_KEY));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveDraftCatalog() {
  localStorage.setItem(CONFERENCE_ADMIN_STORAGE_KEY, JSON.stringify(conferenceAdminState.records));
}

function publishedCatalogRecords(catalog) {
  return (catalog.events || []).map((event) => ({
    id: event.id,
    title: event.eventName,
    link: event.website,
    tier: event.tier || "Tier 3",
    source: "Published catalog",
    updatedAt: catalog.generatedAt || "",
  }));
}

function tierClass(tier) {
  return String(tier).toLowerCase().replace(" ", "-");
}

function filteredAdminRecords() {
  const query = conferenceAdminState.search.trim().toLowerCase();
  return conferenceAdminState.records
    .filter((record) => conferenceAdminState.tier === "All" || record.tier === conferenceAdminState.tier)
    .filter((record) => !query || `${record.title} ${record.link}`.toLowerCase().includes(query))
    .sort((a, b) => a.tier.localeCompare(b.tier) || a.title.localeCompare(b.title));
}

function renderAdminStats() {
  const count = (tier) => conferenceAdminState.records.filter((record) => record.tier === tier).length;
  const cards = [
    { label: "Total conferences", value: conferenceAdminState.records.length, icon: "▤", className: "" },
    { label: "Tier 1 · Highest priority", value: count("Tier 1"), icon: "1", className: "tier-1" },
    { label: "Tier 2 · Targeted", value: count("Tier 2"), icon: "2", className: "tier-2" },
    { label: "Tier 3 · Watch list", value: count("Tier 3"), icon: "3", className: "tier-3" },
  ];
  adminById("adminStats").innerHTML = cards.map((card) => `
    <article class="admin-stat-card ${card.className}">
      <span class="admin-stat-icon" aria-hidden="true">${card.icon}</span>
      <div class="admin-stat-copy"><strong>${card.value}</strong><span>${card.label}</span></div>
    </article>
  `).join("");
}

function renderAdminCatalog() {
  const records = filteredAdminRecords();
  adminById("conferenceCatalogSummary").textContent = `${records.length} of ${conferenceAdminState.records.length} conference${conferenceAdminState.records.length === 1 ? "" : "s"} shown`;
  adminById("conferenceAdminList").innerHTML = records.map((record) => `
    <article class="admin-conference-card ${record.source === "Admin entry" ? "is-new" : ""}" role="listitem">
      <div class="admin-conference-card-topline">
        <span class="admin-tier-badge ${tierClass(record.tier)}">${adminEscapeHtml(record.tier)}</span>
        <small>${adminEscapeHtml(record.source || "Admin entry")}</small>
      </div>
      <div class="admin-conference-card-copy">
        <h3>${adminEscapeHtml(record.title)}</h3>
        <a class="admin-source-link" href="${adminEscapeHtml(record.link)}" target="_blank" rel="noreferrer" title="${adminEscapeHtml(record.link)}">${adminEscapeHtml(safeHostname(record.link))} ↗</a>
      </div>
      <div class="admin-row-actions">
        <button class="admin-row-action" type="button" data-admin-edit="${adminEscapeHtml(record.id)}" aria-label="Edit ${adminEscapeHtml(record.title)}">Edit</button>
        <button class="admin-row-action delete" type="button" data-admin-delete="${adminEscapeHtml(record.id)}" aria-label="Delete ${adminEscapeHtml(record.title)}">Delete</button>
      </div>
    </article>
  `).join("");
  adminById("conferenceAdminEmpty").hidden = records.length > 0;
  adminById("conferenceAdminList").closest(".admin-catalog-list-wrap").hidden = records.length === 0;
  renderAdminStats();
}

function clearFieldValidation() {
  ["conferenceTitle", "conferenceLink", "conferenceTier"].forEach((id) => adminById(id).removeAttribute("aria-invalid"));
  adminById("conferenceFormError").hidden = true;
}

function resetAdminForm() {
  adminById("conferenceAdminForm").reset();
  adminById("conferenceRecordId").value = "";
  adminById("adminFormMode").textContent = "New Entry";
  adminById("adminFormHeading").textContent = "Add a Conference";
  adminById("saveConference").textContent = "Add Conference";
  adminById("cancelConferenceEdit").hidden = true;
  clearFieldValidation();
}

function showAdminError(message, fieldIds = []) {
  clearFieldValidation();
  fieldIds.forEach((id) => adminById(id).setAttribute("aria-invalid", "true"));
  const error = adminById("conferenceFormError");
  error.textContent = message;
  error.hidden = false;
}

let toastTimeout;
function showAdminToast(message) {
  window.clearTimeout(toastTimeout);
  const toast = adminById("adminToast");
  toast.textContent = message;
  toast.hidden = false;
  toastTimeout = window.setTimeout(() => { toast.hidden = true; }, 2600);
}

function editConference(record) {
  adminById("conferenceRecordId").value = record.id;
  adminById("conferenceTitle").value = record.title;
  adminById("conferenceLink").value = record.link;
  adminById("conferenceTier").value = record.tier;
  adminById("adminFormMode").textContent = "Editing Entry";
  adminById("adminFormHeading").textContent = "Update Conference";
  adminById("saveConference").textContent = "Save Changes";
  adminById("cancelConferenceEdit").hidden = false;
  clearFieldValidation();
  adminById("conferenceTitle").focus();
  adminById("conferenceAdminForm").scrollIntoView({ behavior: "smooth", block: "center" });
}

function submitConference(event) {
  event.preventDefault();
  const id = adminById("conferenceRecordId").value;
  const title = adminById("conferenceTitle").value.trim();
  const tier = adminById("conferenceTier").value;
  let link = "";

  if (!title) return showAdminError("Enter the conference title.", ["conferenceTitle"]);
  try {
    link = normalizeConferenceUrl(adminById("conferenceLink").value);
  } catch (error) {
    return showAdminError(error.message, ["conferenceLink"]);
  }
  if (!link) return showAdminError("Enter the official conference link.", ["conferenceLink"]);
  if (!tier) return showAdminError("Select a monitoring tier.", ["conferenceTier"]);

  const duplicate = conferenceAdminState.records.find((record) => record.id !== id && (record.title.toLowerCase() === title.toLowerCase() || record.link === link));
  if (duplicate) return showAdminError("This conference title or link is already in the catalog.", ["conferenceTitle", "conferenceLink"]);

  const existing = conferenceAdminState.records.find((record) => record.id === id);
  const nextRecord = {
    id: id || recordId(title),
    title,
    link,
    tier,
    source: existing?.source === "Published catalog" ? "Edited draft" : "Admin entry",
    updatedAt: new Date().toISOString(),
  };
  if (existing) conferenceAdminState.records = conferenceAdminState.records.map((record) => record.id === id ? nextRecord : record);
  else conferenceAdminState.records = [nextRecord, ...conferenceAdminState.records];
  saveDraftCatalog();
  renderAdminCatalog();
  resetAdminForm();
  showAdminToast(existing ? "Conference updated." : "Conference added to the draft catalog.");
}

function deleteConference(id) {
  const record = conferenceAdminState.records.find((item) => item.id === id);
  if (!record || !window.confirm(`Remove “${record.title}” from the draft catalog?`)) return;
  conferenceAdminState.records = conferenceAdminState.records.filter((item) => item.id !== id);
  saveDraftCatalog();
  if (adminById("conferenceRecordId").value === id) resetAdminForm();
  renderAdminCatalog();
  showAdminToast("Conference removed.");
}

function resetToPublishedCatalog() {
  if (!window.confirm("Discard browser changes and restore the published conference catalog?")) return;
  conferenceAdminState.records = structuredClone(conferenceAdminState.publishedRecords);
  localStorage.removeItem(CONFERENCE_ADMIN_STORAGE_KEY);
  resetAdminForm();
  renderAdminCatalog();
  showAdminToast("Published catalog restored.");
}

function exportConferenceCatalog() {
  const payload = {
    generatedAt: new Date().toISOString(),
    source: "Conference Admin draft export",
    events: conferenceAdminState.records.map(({ id, title, link, tier }) => ({ id, eventName: title, website: link, tier })),
  };
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `conference-catalog-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  showAdminToast("Conference catalog exported.");
}

function setupAdminInteractions() {
  adminById("conferenceAdminForm").addEventListener("submit", submitConference);
  adminById("cancelConferenceEdit").addEventListener("click", resetAdminForm);
  adminById("resetConferenceCatalog").addEventListener("click", resetToPublishedCatalog);
  adminById("exportConferenceCatalog").addEventListener("click", exportConferenceCatalog);
  adminById("conferenceAdminSearch").addEventListener("input", (event) => {
    conferenceAdminState.search = event.target.value;
    renderAdminCatalog();
  });
  adminById("conferenceAdminTierFilter").addEventListener("change", (event) => {
    conferenceAdminState.tier = event.target.value;
    renderAdminCatalog();
  });
  document.addEventListener("click", (event) => {
    const edit = event.target.closest("[data-admin-edit]");
    if (edit) {
      const record = conferenceAdminState.records.find((item) => item.id === edit.dataset.adminEdit);
      if (record) editConference(record);
      return;
    }
    const remove = event.target.closest("[data-admin-delete]");
    if (remove) deleteConference(remove.dataset.adminDelete);
  });
}

async function initConferenceAdmin() {
  if (conferenceAdminInitialized) return;
  const response = await fetch("data/conference_sources.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Conference source catalog load failed: ${response.status}`);
  const catalog = await response.json();
  conferenceAdminState.publishedRecords = publishedCatalogRecords(catalog);
  conferenceAdminState.records = readDraftCatalog() || structuredClone(conferenceAdminState.publishedRecords);
  setupAdminInteractions();
  renderAdminCatalog();
  conferenceAdminInitialized = true;
}

async function startConferenceAdmin() {
  adminById("adminAuthForm").addEventListener("submit", (event) => {
    submitAdminCredentials(event).catch(() => {
      adminById("adminAuthError").textContent = "Sign in could not be completed. Try again.";
      adminById("adminAuthError").hidden = false;
    });
  });
  adminById("adminSignOut").addEventListener("click", signOutConferenceAdmin);
  const isAuthorized = sessionStorage.getItem(CONFERENCE_ADMIN_SESSION_KEY) === "true";
  setAdminAuthVisibility(isAuthorized);
  if (isAuthorized) await initConferenceAdmin();
}

startConferenceAdmin().catch((error) => {
  setAdminAuthVisibility(true);
  adminById("conferenceCatalogSummary").textContent = "Conference sources could not be loaded.";
  adminById("conferenceAdminList").closest(".admin-catalog-list-wrap").hidden = true;
  const empty = adminById("conferenceAdminEmpty");
  empty.hidden = false;
  empty.querySelector("strong").textContent = "Catalog unavailable";
  empty.querySelector("p").textContent = error.message;
});
