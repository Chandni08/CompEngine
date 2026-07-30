(function attachCompetitiveMethodology(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CompetitiveMethodology = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCompetitiveMethodology() {
  const ENTITY_ALIASES = {
    thermo: "Thermo Fisher",
    "thermo fisher scientific": "Thermo Fisher",
    sciex: "SCIEX",
    agilent: "Agilent",
    shimadzu: "Shimadzu",
    perkinelmer: "PerkinElmer",
    revvity: "Revvity",
  };

  function canonicalEntity(value) {
    const text = String(value || "").trim();
    return ENTITY_ALIASES[text.toLowerCase()] || text || "Unknown";
  }

  function canonicalUrl(value) {
    try {
      const url = new URL(String(value || ""));
      url.hash = "";
      ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"].forEach((key) => url.searchParams.delete(key));
      url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
      url.pathname = url.pathname.replace(/\/$/, "") || "/";
      return url.toString();
    } catch (_) {
      return String(value || "").trim();
    }
  }

  function sourceDomain(value) {
    try { return new URL(String(value || "")).hostname.toLowerCase().replace(/^www\./, ""); }
    catch (_) { return "unknown"; }
  }

  function normalizedAnnouncementKey(record) {
    if (record.announcementId) return String(record.announcementId);
    const title = String(record.title || record.headline || record.product || "")
      .toLowerCase()
      .replace(/\b(agilent|shimadzu|sciex|thermo fisher(?: scientific)?|perkinelmer|revvity)\b/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    return `${record.date || "undated"}:${title}`;
  }

  function classifySource(record, competitor) {
    const entity = canonicalEntity(competitor || record.competitor || record.company);
    const domain = sourceDomain(record.url || record.sourceUrl);
    const name = String(record.sourceName || record.source || "").toLowerCase();
    const type = String(record.type || record.filingType || "").toLowerCase();
    const issuerDomains = {
      Agilent: ["agilent.com"],
      "Thermo Fisher": ["thermofisher.com"],
      Shimadzu: ["shimadzu.com", "shimadzu.eu"],
      SCIEX: ["sciex.com"],
      PerkinElmer: ["perkinelmer.com"],
      Revvity: ["revvity.com"],
    };
    const isSec = domain === "sec.gov" || /10-[qk]|8-k|sec filing/.test(`${type} ${name}`);
    const isIssuer = (issuerDomains[entity] || []).some((candidate) => domain === candidate || domain.endsWith(`.${candidate}`));
    if (isSec) {
      return {
        familyId: `filing:${entity}:${record.accession || record.date || canonicalUrl(record.url || record.sourceUrl)}`,
        familyLabel: `${entity} filing (${record.date || "undated"})`,
        independenceGroup: `issuer-controlled:${entity}`,
        directness: "Direct primary evidence",
      };
    }
    if (isIssuer) {
      return {
        familyId: `issuer:${entity}`,
        familyLabel: `${entity} press releases and product pages`,
        independenceGroup: `issuer-controlled:${entity}`,
        directness: "Direct primary evidence",
      };
    }
    return {
      familyId: `external:${domain}`,
      familyLabel: domain === "unknown" ? "Unclassified external source" : domain,
      independenceGroup: `external:${domain}`,
      directness: "External corroboration",
    };
  }

  function dedupeEvidence(records, competitor) {
    const urls = new Set();
    const announcements = new Set();
    const deduped = [];
    (records || []).forEach((record) => {
      const url = canonicalUrl(record.url || record.sourceUrl);
      const announcement = normalizedAnnouncementKey(record);
      if ((url && urls.has(url)) || (announcement && announcements.has(announcement))) return;
      if (url) urls.add(url);
      if (announcement) announcements.add(announcement);
      deduped.push({ ...record, canonicalUrl: url, sourceFamily: classifySource(record, competitor) });
    });
    return deduped;
  }

  function groupEvidenceByFamily(records, competitor) {
    const groups = new Map();
    dedupeEvidence(records, competitor).forEach((record) => {
      const key = record.sourceFamily.familyId;
      if (!groups.has(key)) groups.set(key, { ...record.sourceFamily, records: [] });
      groups.get(key).records.push(record);
    });
    return [...groups.values()];
  }

  function assessInference(records, competitor, options = {}) {
    const deduped = dedupeEvidence(records, competitor);
    const families = groupEvidenceByFamily(deduped, competitor);
    const independenceGroups = [...new Set(families.map((family) => family.independenceGroup))];
    const externalGroups = independenceGroups.filter((group) => group.startsWith("external:"));
    const dates = deduped.map((record) => record.date).filter(Boolean);
    const directCount = deduped.filter((record) => record.sourceFamily.directness.startsWith("Direct")).length;
    const contradictionCount = Number(options.contradictionCount || 0);
    const repeatedAcrossTime = new Set(dates.map((date) => String(date).slice(0, 7))).size >= 2;
    const highEligible = independenceGroups.length >= 2 && externalGroups.length >= 1 && directCount >= 1 && contradictionCount === 0;
    const mediumEligible = independenceGroups.length >= 2 && directCount >= 1;
    const label = highEligible ? "High" : mediumEligible ? "Medium" : deduped.length ? "Directional" : "Low";
    return {
      label,
      limitation: highEligible ? "" : "Directional—insufficient independent corroboration.",
      rubric: {
        sourceIndependence: independenceGroups.length >= 2 ? "Multiple independent families" : "Single independence group",
        directness: directCount ? "Direct primary evidence present" : "Indirect evidence only",
        temporalConsistency: repeatedAcrossTime ? "Repeated across multiple periods" : "Single-period evidence",
        corroboration: externalGroups.length ? `${externalGroups.length} external corroborating family${externalGroups.length === 1 ? "" : "ies"}` : "No independent external corroboration",
        contradictions: contradictionCount ? `${contradictionCount} unresolved contradiction${contradictionCount === 1 ? "" : "s"}` : "No contradiction recorded; alternatives remain testable",
      },
      dedupedRecords: deduped,
      families,
      independentFamilyCount: independenceGroups.length,
      externalFamilyCount: externalGroups.length,
    };
  }

  function unquantifiedMagnitude(overrides = {}) {
    return {
      status: "UNQUANTIFIED — validation required",
      affectedSegment: overrides.affectedSegment || "Not established from public evidence",
      geography: overrides.geography || "Not established from public evidence",
      cohort: overrides.cohort || overrides.installedBaseOrReplacementCohort || "Installed-base / replacement cohort not linked",
      exposureBand: overrides.exposureBand || overrides.revenueOrShareAtRiskBand || "Unquantified",
      timeHorizon: overrides.timeHorizon || "0–24 months",
      basis: overrides.basis || "Public evidence establishes relevance, not Waters revenue or share exposure.",
      confidence: overrides.confidence || overrides.magnitudeConfidence || "Unquantified",
      validationOwner: overrides.validationOwner || "Product Management + Commercial Analytics",
      nextStep: overrides.nextStep || "Join CRM installed base, opportunity, win/loss, renewal, and segment-revenue data to the public signal.",
      requiredInternalData: overrides.requiredInternalData || ["installed base", "replacement timing", "pipeline and win/loss", "segment revenue", "engineering effort"],
    };
  }

  function evidencePriority(components = {}) {
    const values = Object.values(components).filter((value) => ["High", "Medium", "Low"].includes(value));
    const high = values.filter((value) => value === "High").length;
    const medium = values.filter((value) => value === "Medium").length;
    return high >= 2 ? "High" : high + medium >= 2 ? "Medium" : "Low";
  }

  function snapshotMetadata(data) {
    const asOf = data?.generatedAt || `${data?.asOfDate || "unknown"}T23:59:59Z`;
    const compact = String(asOf).replace(/[^0-9]/g, "").slice(0, 14) || "unknown";
    return { asOfTimestamp: asOf, snapshotId: data?.snapshotId || `waters-ci-${compact}` };
  }

  return {
    canonicalEntity,
    canonicalUrl,
    sourceDomain,
    normalizedAnnouncementKey,
    classifySource,
    dedupeEvidence,
    groupEvidenceByFamily,
    assessInference,
    unquantifiedMagnitude,
    evidencePriority,
    snapshotMetadata,
  };
});
