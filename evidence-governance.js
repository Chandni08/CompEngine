(function exposeEvidenceGovernance(root) {
  "use strict";

  const approvalStates = Object.freeze(["draft", "in-review", "approved", "blocked"]);
  const urlFields = Object.freeze([
    "url",
    "sourceUrl",
    "primarySourceUrl",
    "pressReleaseUrl",
    "productUrl",
    "website",
    "homepage",
    "resultsUrl",
    "finalUrl",
  ]);
  const recordMarkers = Object.freeze([
    "id",
    "claimID",
    "signalType",
    "sourceType",
    "sourceName",
    "evidenceStatus",
    "languageType",
    "sourceControl",
  ]);
  const genericAttribution = /^(?:public|official|external|customer|competitor|company|scientific)?\s*(?:evidence|source|record|link|page|material)s?$/i;
  const watersSource = /(?:^|\b)waters(?: corporation| official| public| product| chromatography| support)?(?:\b|$)/i;
  const disallowedEvidenceState = /unsupported|partial|unverified|unresolved|missing|expected|not[- ]confirmed|inapplicable/i;
  const inferenceLanguage = /analyst|inference|directional[_ -]synthesis|hypothesis|internal/i;
  const unsafeText = /not[- ]confirmed|unverified|unsupported|requires? validation|do not (?:claim|cite|use)|not customer[- ]safe/i;
  const unhealthyLink = /blocked|bad|broken|error|failed|missing|manual|unavailable|unknown/i;
  const healthyLink = /^(?:ok|good|healthy|available|verified|success)$/i;

  function isHttpUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  function canonicalUrl(value) {
    if (!isHttpUrl(value)) return "";
    const url = new URL(value);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    [...url.searchParams.keys()].forEach((key) => {
      if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
    });
    url.searchParams.sort();
    return url.toString();
  }

  function recordUrls(record = {}) {
    const values = urlFields.flatMap((field) => {
      const value = record?.[field];
      return Array.isArray(value) ? value : [value];
    });
    return [...new Set(values.map(canonicalUrl).filter(Boolean))];
  }

  function buildLinkHealthIndex(rows = []) {
    const index = new Map();
    (Array.isArray(rows) ? rows : rows?.links || rows?.sources || []).forEach((row) => {
      const key = canonicalUrl(row?.url);
      if (!key) return;
      index.set(key, String(row.status || row.health || "").toLowerCase());
      const finalKey = canonicalUrl(row.finalUrl);
      if (finalKey) index.set(finalKey, String(row.status || row.health || "").toLowerCase());
    });
    return index;
  }

  function explicitLinkHealth(record = {}) {
    const values = [record.linkStatus, record.health, record.status, record.collectionStatus]
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    if (values.some((value) => unhealthyLink.test(value))) return false;
    if (record.linkAvailable === false) return false;
    return record.linkAvailable === true || values.some((value) => healthyLink.test(value));
  }

  function hasWorkingLink(record = {}, linkHealthIndex = new Map()) {
    const urls = recordUrls(record);
    if (!urls.length) return false;
    const indexed = urls.map((url) => linkHealthIndex.get(url)).filter(Boolean);
    if (indexed.length) return indexed.some((status) => status === "ok" || status === "good");
    return explicitLinkHealth(record);
  }

  function attributionName(record = {}, inheritedSourceName = "") {
    const candidates = [
      record.sourceName,
      record.publisher,
      record.source,
      record.eventName,
      record.registrant,
      record.competitor,
      inheritedSourceName,
    ];
    return candidates
      .map((value) => typeof value === "string" ? value.trim() : "")
      .find((value) => value && value !== "Market-wide" && !genericAttribution.test(value)) || "";
  }

  function isWatersOnly(record = {}, inheritedSourceName = "") {
    const urls = recordUrls(record);
    const urlDomains = urls.map((value) => new URL(value).hostname.toLowerCase().replace(/^www\./, ""));
    const sourceText = [record.sourceName, record.publisher, record.source, record.registrant, record.sourceControl, inheritedSourceName]
      .filter((value) => typeof value === "string")
      .join(" ");
    return urlDomains.length > 0 && urlDomains.every((domain) => domain === "waters.com" || domain.endsWith(".waters.com"))
      || watersSource.test(sourceText);
  }

  function isPublicRecord(record = {}) {
    if (record.public === false || record.isPublic === false) return false;
    const accessText = [record.visibility, record.accessType, record.sourceType, record.collectionMethod]
      .filter((value) => typeof value === "string")
      .join(" ");
    return !/internal|private|confidential|restricted/i.test(accessText) && recordUrls(record).length > 0;
  }

  function isCustomerSafeRecord(record = {}, datasetName = "") {
    if (record.customerSafe === false || record.customerFacingSafe === false) return false;
    if (/source_catalog|market_application_sources/i.test(datasetName)) return false;
    if (disallowedEvidenceState.test(String(record.evidenceStatus || ""))) return false;
    if (inferenceLanguage.test(`${record.languageType || ""} ${record.classification || ""} ${record.evidenceClassification || ""}`)) return false;
    if (record.languageType === "verbatim_quote" && record.evidenceStatus === "verified") return true;
    const caveatText = `${record.caveat || ""} ${record.limitation || ""}`;
    if (unsafeText.test(caveatText)) return false;
    if (record.pmImplication || record.roadmapQuestion || record.pmInterpretation || record.pmAction || record.pmDecisionUse || record.watersPrep || record.boothRecommendations) return false;
    return true;
  }

  function normalizeApprovalState(value) {
    return approvalStates.includes(value) ? value : "draft";
  }

  function deriveFieldCitable(record = {}, { linkHealthIndex = new Map(), datasetName = "", inheritedSourceName = "" } = {}) {
    if (record.fieldCitable === false) return false;
    return isPublicRecord(record)
      && Boolean(attributionName(record, inheritedSourceName))
      && !isWatersOnly(record, inheritedSourceName)
      && hasWorkingLink(record, linkHealthIndex)
      && isCustomerSafeRecord(record, datasetName);
  }

  function isGovernedRecord(record, { inArray = false, isRoot = false } = {}) {
    if (!record || typeof record !== "object" || Array.isArray(record) || isRoot) return false;
    return inArray
      || recordMarkers.some((field) => Object.prototype.hasOwnProperty.call(record, field))
      || urlFields.some((field) => Object.prototype.hasOwnProperty.call(record, field));
  }

  function normalizeDataset(value, options = {}, context = { inArray: false, isRoot: true }) {
    if (Array.isArray(value)) {
      return value.map((item) => normalizeDataset(item, options, { inArray: true, isRoot: false }));
    }
    if (!value || typeof value !== "object") return value;
    const inheritedSourceName = [value.sourceName, value.publisher, value.eventName, value.source]
      .find((candidate) => typeof candidate === "string" && candidate.trim())
      || (value.name && (value.sourceType || value.sourceClass || value.homepage) ? value.name : "")
      || options.inheritedSourceName
      || "";
    const childOptions = { ...options, inheritedSourceName };
    const normalized = Object.fromEntries(Object.entries(value).map(([key, child]) => [
      key,
      normalizeDataset(child, childOptions, { inArray: Array.isArray(value), isRoot: false }),
    ]));
    if (!isGovernedRecord(value, context)) return normalized;
    normalized.approvalState = normalizeApprovalState(value.approvalState);
    normalized.fieldCitable = deriveFieldCitable(value, childOptions);
    return normalized;
  }

  function recordMatchesFilters(record = {}, filters = {}) {
    const citable = filters.fieldCitable;
    const approval = filters.approvalState;
    return (!citable || citable === "All" || String(Boolean(record.fieldCitable)) === String(citable))
      && (!approval || approval === "All" || record.approvalState === approval);
  }

  function filterRecords(records = [], filters = {}) {
    return (records || []).filter((record) => recordMatchesFilters(record, filters));
  }

  const api = {
    approvalStates,
    attributionName,
    buildLinkHealthIndex,
    canonicalUrl,
    deriveFieldCitable,
    filterRecords,
    hasWorkingLink,
    isCustomerSafeRecord,
    isPublicRecord,
    isWatersOnly,
    normalizeApprovalState,
    normalizeDataset,
    recordMatchesFilters,
    recordUrls,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.PmmEvidenceGovernance = api;
})(typeof window !== "undefined" ? window : globalThis);

