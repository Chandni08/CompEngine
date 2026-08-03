(function exposeEvidenceAppendixTransformer(root) {
  "use strict";

  const validApprovalStates = Object.freeze(["draft", "in-review", "approved", "blocked"]);
  const sourceTypeOrder = Object.freeze([
    "Customer language",
    "Scientific publication",
    "Corporate filing",
    "Conference or event",
    "Competitor official",
    "Waters official",
    "Other public source",
    "Unresolved evidence",
  ]);

  function text(value) {
    return String(value || "").trim();
  }

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
      if (/^(?:utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
    });
    url.searchParams.sort();
    return url.toString();
  }

  function recordUrl(record = {}) {
    return [record.url, record.sourceUrl, record.primarySourceUrl, record.competitorSourceUrl, record.watersSourceUrl]
      .find(isHttpUrl) || "";
  }

  function hashText(value) {
    let hash = 2166136261;
    const input = text(value);
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).toUpperCase().padStart(8, "0");
  }

  function evidenceObjectId(value) {
    const canonical = canonicalUrl(value);
    return canonical ? `EV-${hashText(canonical)}` : "";
  }

  function referenceDomId(kind, value) {
    const normalizedKind = text(kind).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "reference";
    const normalizedValue = text(value);
    const slug = normalizedValue.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "item";
    return `pmm-${normalizedKind}-${slug}-${hashText(normalizedValue).toLowerCase()}`;
  }

  function normalizeApprovalState(value) {
    return validApprovalStates.includes(value) ? value : "draft";
  }

  function sourceType(record = {}) {
    if (record.sourceFamily && sourceTypeOrder.includes(record.sourceFamily)) return record.sourceFamily;
    const url = recordUrl(record);
    const domain = canonicalUrl(url) ? new URL(canonicalUrl(url)).hostname : "";
    const value = `${record.type || ""} ${record.sourceType || ""} ${record.evidenceType || ""} ${record.evidenceRole || ""} ${record.sourceName || ""} ${domain}`.toLowerCase();
    if (/customer|reddit|forum|community/.test(value)) return "Customer language";
    if (/waters/.test(value)) return "Waters official";
    if (/filing|sec\.|annual report|investor/.test(value)) return "Corporate filing";
    if (/conference|event|symposium/.test(value)) return "Conference or event";
    if (/journal|publication|pubmed|application note/.test(value)) return "Scientific publication";
    if (/competitor|agilent|thermo|shimadzu|sciex|perkinelmer/.test(value)) return "Competitor official";
    return url ? "Other public source" : "Unresolved evidence";
  }

  function explicitUnlinkedEvidence(record = {}) {
    return !recordUrl(record)
      && Boolean(record.evidenceRole || record.evidenceType || record.sourceType)
      && Boolean(record.label || record.title || record.sourceName);
  }

  function collectEvidenceRecords(value, output = [], visited = new WeakSet()) {
    if (!value || typeof value !== "object") return output;
    if (visited.has(value)) return output;
    visited.add(value);
    if (recordUrl(value) || explicitUnlinkedEvidence(value)) output.push(value);
    if (Array.isArray(value)) value.forEach((item) => collectEvidenceRecords(item, output, visited));
    else Object.values(value).forEach((item) => collectEvidenceRecords(item, output, visited));
    return output;
  }

  function unlinkedKey(record = {}) {
    const identity = record.id || record.evidenceId || `${record.sourceName || ""}|${record.label || record.title || ""}|${record.description || record.detail || ""}`;
    return `unlinked:${hashText(identity)}`;
  }

  function evidenceKey(record = {}) {
    const canonical = canonicalUrl(recordUrl(record));
    return canonical || unlinkedKey(record);
  }

  function baseRecordIndex(baseAppendix = {}) {
    const index = new Map();
    (baseAppendix.groups || []).flatMap((group) => group.records || []).forEach((record) => {
      const canonical = canonicalUrl(recordUrl(record));
      if (canonical && !index.has(canonical)) index.set(canonical, record);
    });
    return index;
  }

  function mergeEvidenceRecord(base = {}, used = {}) {
    const url = recordUrl(used) || recordUrl(base);
    const canonical = canonicalUrl(url);
    const fieldCitable = typeof used.fieldCitable === "boolean" ? used.fieldCitable : base.fieldCitable === true;
    const approvalState = normalizeApprovalState(used.approvalState || base.approvalState);
    return {
      ...base,
      ...used,
      title: text(base.title || used.label || used.title || used.sourceName) || "Evidence title unresolved",
      type: text(base.type || used.evidenceType || used.evidenceRole || used.sourceType) || "PMM supporting evidence",
      sourceName: text(base.sourceName || used.sourceName || used.publisher) || "Source name unresolved",
      date: base.date || used.date || used.eventDate || used.sourceDate || "",
      confidence: Number.isFinite(Number(base.confidence ?? used.confidence)) ? Number(base.confidence ?? used.confidence) : null,
      description: text(base.description || used.detail || used.description || used.summary || used.evidenceStatement),
      caveat: text(base.caveat || used.caveat),
      url,
      canonicalUrl: canonical,
      canonicalEvidenceId: evidenceObjectId(url),
      sourceDomain: canonical ? new URL(canonical).hostname : "",
      sourceFamily: sourceType({ ...base, ...used, url }),
      linkAvailable: Boolean(canonical) && base.linkAvailable !== false && used.linkAvailable !== false,
      fieldCitable,
      approvalState,
    };
  }

  function normalizeSupport(section = {}, reference = {}) {
    const sectionId = text(section.id) || "pmm-section";
    const href = text(reference.href || section.href) || "#pmm-evidence-appendix";
    const referenceId = text(reference.referenceId) || `${sectionId}:${href}:${reference.label || section.title || "section"}`;
    return {
      referenceId,
      referenceType: text(reference.kind) || "section",
      sectionId,
      sectionTitle: text(section.title) || "PMM section",
      label: text(reference.label) || text(section.title) || "PMM section",
      href,
    };
  }

  function addSupport(recordMap, baseIndex, source, support) {
    const key = evidenceKey(source);
    const existing = recordMap.get(key);
    if (!existing) {
      const merged = mergeEvidenceRecord(baseIndex.get(canonicalUrl(recordUrl(source))) || {}, source);
      recordMap.set(key, { ...merged, evidenceKey: key, mergedRecordCount: 1, supports: [support] });
      return;
    }
    existing.mergedRecordCount += 1;
    if (!existing.supports.some((item) => item.referenceId === support.referenceId)) existing.supports.push(support);
  }

  function referenceBackingKeys(reference = {}) {
    const seen = new Set();
    return collectEvidenceRecords(reference.backingRecords ?? reference.records ?? [])
      .map(evidenceKey)
      .filter((key) => key && !seen.has(key) && seen.add(key));
  }

  function validateTraceability(references = [], recordMap = new Map()) {
    const required = references.filter((reference) => reference.kind === "pillar"
      || (reference.kind === "claim" && normalizeApprovalState(reference.approvalState) === "approved"));
    const results = required.map((reference) => {
      const backingKeys = referenceBackingKeys(reference);
      const backed = backingKeys.some((key) => recordMap.get(key)?.supports.some((support) => support.referenceId === reference.referenceId));
      return {
        referenceId: reference.referenceId,
        kind: reference.kind,
        label: text(reference.label) || (reference.kind === "claim" ? "Approved claim" : "Position Guardrails pillar"),
        href: text(reference.href),
        backed,
        backingRecordCount: backingKeys.filter((key) => recordMap.has(key)).length,
        reason: backed ? "" : reference.kind === "claim"
          ? "Approved claim has zero Evidence Appendix backing records. Remove field clearance or attach approved, field-citable evidence."
          : "Position Guardrails pillar has zero Evidence Appendix backing records and cannot remain a pillar.",
      };
    });
    const approvedClaims = results.filter((result) => result.kind === "claim");
    const pillars = results.filter((result) => result.kind === "pillar");
    return {
      passed: results.every((result) => result.backed),
      approvedClaimCount: approvedClaims.length,
      backedApprovedClaimCount: approvedClaims.filter((result) => result.backed).length,
      pillarCount: pillars.length,
      backedPillarCount: pillars.filter((result) => result.backed).length,
      missingApprovedClaims: approvedClaims.filter((result) => !result.backed),
      missingPillars: pillars.filter((result) => !result.backed),
      results,
    };
  }

  function buildTraceableAppendix({ baseAppendix = {}, sections = [] } = {}) {
    const baseIndex = baseRecordIndex(baseAppendix);
    const recordMap = new Map();
    const allReferences = [];
    sections.forEach((section) => {
      (section.references || []).forEach((reference, index) => {
        const support = normalizeSupport(section, reference);
        const normalizedReference = {
          ...reference,
          referenceId: support.referenceId || `${section.id}:${index + 1}`,
          href: support.href,
          label: support.label,
        };
        allReferences.push(normalizedReference);
        collectEvidenceRecords(reference.records || []).forEach((source) => addSupport(recordMap, baseIndex, source, support));
      });
    });
    const records = [...recordMap.values()].sort((left, right) => String(right.date || "").localeCompare(String(left.date || ""))
      || left.sourceFamily.localeCompare(right.sourceFamily)
      || left.title.localeCompare(right.title));
    const groups = sourceTypeOrder.map((type) => ({
      id: referenceDomId("appendix-source-type", type),
      title: type,
      description: `Filtered ${type.toLowerCase()} records actually consumed by the current PMM transformation.`,
      caveat: "A trace link identifies where the record is used; it does not change field-citability, approval, independence, or claim compatibility.",
      records: records.filter((record) => record.sourceFamily === type),
      emptyState: `No ${type.toLowerCase()} record is used by the PMM sections under the active filters.`,
    })).filter((group) => group.records.length);
    const linked = records.filter((record) => record.canonicalUrl);
    const validation = validateTraceability(allReferences, recordMap);
    return {
      ...baseAppendix,
      groups,
      uniqueSourceCount: linked.length,
      displayedRecordCount: records.length,
      duplicateRecordCount: records.reduce((total, record) => total + Math.max(0, record.mergedRecordCount - 1), 0),
      unlinkedRecordCount: records.filter((record) => !record.canonicalUrl).length,
      sourceDomainCount: new Set(linked.map((record) => record.sourceDomain).filter(Boolean)).size,
      sourceFamilyCount: groups.length,
      canonicalEvidenceObjectCount: linked.length,
      validation,
    };
  }

  const api = {
    buildTraceableAppendix,
    canonicalUrl,
    collectEvidenceRecords,
    evidenceObjectId,
    normalizeApprovalState,
    referenceDomId,
    sourceType,
    validateTraceability,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.EvidenceAppendixTransformer = api;
})(typeof window !== "undefined" ? window : globalThis);
