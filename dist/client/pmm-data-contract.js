(function exposePmmDataContract(root) {
  "use strict";

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

  function sourceDomain(value) {
    const canonical = canonicalUrl(value);
    return canonical ? new URL(canonical).hostname.replace(/^www\./, "") : "";
  }

  function sourceFamily(record = {}) {
    const text = `${record.type || ""} ${record.sourceName || ""} ${sourceDomain(record.url)}`.toLowerCase();
    if (/customer|reddit|forum|community/.test(text)) return "Customer language";
    if (/waters/.test(text)) return "Waters official";
    if (/filing|sec\.|annual report|investor/.test(text)) return "Corporate filing";
    if (/conference|event|symposium/.test(text)) return "Conference or event";
    if (/journal|publication|pubmed|application note/.test(text)) return "Scientific publication";
    if (/competitor|agilent|thermo|shimadzu|sciex/.test(text)) return "Competitor official";
    return "Other public source";
  }

  function uniqueUrlRecords(records = []) {
    const seen = new Set();
    return records.filter((record) => {
      const key = canonicalUrl(record?.url);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map((record) => ({
      ...record,
      canonicalUrl: canonicalUrl(record.url),
      sourceDomain: sourceDomain(record.url),
      sourceFamily: sourceFamily(record),
    }));
  }

  function selectPositioningDecisions(candidates = [], limit = 3) {
    return candidates
      .filter((candidate) => candidate
        && (candidate.customerCriteriaSources > 0 || candidate.targetEvidenceEligible === true)
        && candidate.exactSources?.length > 0)
      .sort((left, right) => right.priorityScore - left.priorityScore
        || right.confidence - left.confidence
        || String(left.competitor).localeCompare(String(right.competitor)))
      .slice(0, limit);
  }

  function evaluateGoverningAlignment(localAdaptation, governingText) {
    const local = String(localAdaptation || "").trim();
    const explicitContradiction = /\b(fastest|best-in-class|superior|guarantee(?:d)?|zero downtime|eliminate(?:s|d)? compliance risk)\b/i.test(local);
    const governingWords = new Set(String(governingText || "").toLowerCase().match(/[a-z0-9-]{4,}/g) || []);
    const localWords = String(local).toLowerCase().match(/[a-z0-9-]{4,}/g) || [];
    const aligned = localWords.some((word) => governingWords.has(word));
    if (explicitContradiction) return {
      status: "contradiction",
      message: "Contradictory downstream claim detected — comparative or guaranteed language conflicts with the governing exclusions and must not activate.",
    };
    if (!aligned) return {
      status: "unsupported",
      message: "Unsupported deviation — the local adaptation does not explicitly connect to reliable, transferable, or compliant workflow value. Review before activation.",
    };
    return {
      status: "aligned",
      message: "No contradiction detected. Local language inherits the governing workflow frame; approval remains unresolved.",
    };
  }

  function normalizeCompatibilityValues(values) {
    return [...new Set((Array.isArray(values) ? values : [values])
      .map((value) => String(value || "").trim().toUpperCase())
      .filter(Boolean))];
  }

  function compatibilityDimension(label, requiredValues, evidenceValues, { required = true } = {}) {
    const expected = normalizeCompatibilityValues(requiredValues);
    const observed = normalizeCompatibilityValues(evidenceValues);
    if (!expected.length) return { label, status: "Not required", expected, observed };
    if (!observed.length) return { label, status: required ? "Missing" : "Unresolved", expected, observed };
    const match = expected.some((value) => observed.includes(value));
    return { label, status: match ? "Match" : "Mismatch", expected, observed };
  }

  function evaluateClaimEvidenceCompatibility(claim = {}, evidence = {}) {
    const segmentChecks = claim.segment || claim.application
      ? [
        compatibilityDimension("Segment", claim.segment, evidence.segment),
        compatibilityDimension("Application / workflow", claim.application, evidence.application),
      ]
      : [compatibilityDimension("Segment / application", claim.segmentApplication, evidence.segmentApplication)];
    const checks = [
      compatibilityDimension("Product / workflow", claim.productWorkflow, evidence.productWorkflow),
      compatibilityDimension("Attribute", claim.attributes, evidence.attributes),
      ...segmentChecks,
      compatibilityDimension("Comparator", claim.comparator, evidence.comparator),
      compatibilityDimension("Test conditions", claim.testConditions, evidence.testConditions),
    ];
    let dateCheck = { label: "Date / relevance", status: "Missing", expected: [], observed: [] };
    if (evidence.date && claim.asOfDate) {
      const ageDays = Math.max(0, Math.round((new Date(`${claim.asOfDate}T00:00:00Z`) - new Date(`${evidence.date}T00:00:00Z`)) / 86400000));
      dateCheck = {
        label: "Date / relevance",
        status: ageDays <= Number(claim.maxAgeDays || 1095) ? "Match" : "Mismatch",
        expected: [`≤${Number(claim.maxAgeDays || 1095)} days`],
        observed: [`${ageDays} days`],
      };
    }
    checks.push(dateCheck);
    const hardMismatch = checks.some((check) => check.status === "Mismatch");
    const complete = checks.every((check) => check.status === "Match" || check.status === "Not required");
    return {
      status: hardMismatch ? "Inapplicable" : complete ? "Applicable" : "Partially applicable",
      checks,
      missingDimensions: checks.filter((check) => check.status === "Missing").map((check) => check.label),
      mismatchedDimensions: checks.filter((check) => check.status === "Mismatch").map((check) => check.label),
    };
  }

  function establishedIndependentSourceCount(evidenceRecords = []) {
    return new Set(evidenceRecords
      .filter((record) => record.independent === true && record.sourceOrganizationId)
      .map((record) => String(record.sourceOrganizationId))).size;
  }

  function claimSubstantiation(evidenceRecords = []) {
    const applicable = evidenceRecords.filter((record) => record.compatibility?.status === "Applicable");
    const directional = evidenceRecords.filter((record) => record.compatibility?.status === "Partially applicable");
    const independentSourceCount = establishedIndependentSourceCount(applicable);
    if (applicable.length && independentSourceCount >= 2) return {
      status: "Proven",
      reason: "Compatible evidence and at least two established independent source organizations support the claim.",
      independentSourceCount,
    };
    if (applicable.length || directional.length) return {
      status: "Directional",
      reason: "Some relevant evidence exists, but compatibility or independent corroboration is incomplete.",
      independentSourceCount,
    };
    return {
      status: "Unsupported",
      reason: "No applicable supporting evidence remains after compatibility checks.",
      independentSourceCount,
    };
  }

  function claimCommercialReadiness(substantiationStatus, approvalEstablished) {
    if (substantiationStatus === "Proven" && approvalEstablished === true) return {
      value: "Ready",
      reason: "Substantiation is Proven and legal/claims approval is established.",
    };
    return {
      value: "Blocked",
      reason: substantiationStatus !== "Proven"
        ? `${substantiationStatus} substantiation cannot support commercial readiness.`
        : "Legal/claims approval is not established.",
    };
  }

  function filterClaimRows(rows = [], activeFilters = {}) {
    return rows.filter((row) => {
      const audienceCriterion = `${row.audience} · ${row.buyingCriterion}`;
      return (!activeFilters.readiness || activeFilters.readiness === "All" || (row.substantiationStatus || row.readiness?.value) === activeFilters.readiness)
        && (!activeFilters.audience || activeFilters.audience === "All" || audienceCriterion === activeFilters.audience)
        && (!activeFilters.classification || activeFilters.classification === "All" || row.classificationLabel === activeFilters.classification);
    });
  }

  function consolidateAppendixGroups(groups = []) {
    const seen = new Map();
    let duplicateRecordCount = 0;
    let unlinkedRecordCount = 0;
    const consolidatedGroups = groups.map((group) => {
      const records = [];
      group.records.forEach((record) => {
        const key = canonicalUrl(record.url);
        if (!key || record.linkAvailable === false) {
          unlinkedRecordCount += 1;
          records.push({ ...record, canonicalUrl: "", sourceDomain: "", sourceFamily: sourceFamily(record) });
          return;
        }
        if (seen.has(key)) {
          duplicateRecordCount += 1;
          const first = seen.get(key);
          first.mergedRecordCount = (first.mergedRecordCount || 1) + 1;
          return;
        }
        const normalized = {
          ...record,
          canonicalUrl: key,
          sourceDomain: sourceDomain(key),
          sourceFamily: sourceFamily(record),
          mergedRecordCount: 1,
        };
        seen.set(key, normalized);
        records.push(normalized);
      });
      return { ...group, records };
    });
    return {
      groups: consolidatedGroups,
      uniqueSourceCount: seen.size,
      duplicateRecordCount,
      unlinkedRecordCount,
      sourceDomainCount: new Set([...seen.values()].map((record) => record.sourceDomain).filter(Boolean)).size,
      sourceFamilyCount: new Set([...seen.values()].map((record) => record.sourceFamily).filter(Boolean)).size,
    };
  }

  function buildKpis({ positioningDecisions = [], visibleClaimRows = [], customerLanguageRecords = [], appendix = {} } = {}) {
    return {
      positioningDecisions: positioningDecisions.length,
      claimsAwaitingApproval: visibleClaimRows.filter((row) => row.approvalEstablished === false || row.readiness?.value === "Legally unapproved").length,
      customerLanguageSources: uniqueUrlRecords(customerLanguageRecords).length,
      directEvidenceSources: Number(appendix.uniqueSourceCount || 0),
    };
  }

  function normalizeHypothesisWeights(attributes = []) {
    if (!attributes.length) return [];
    const positive = attributes.map((attribute) => Math.max(0, Number(attribute.weight || 0)));
    const total = positive.reduce((sum, value) => sum + value, 0);
    const raw = total > 0
      ? positive.map((value) => (value / total) * 100)
      : positive.map(() => 100 / positive.length);
    const weights = raw.map((value) => Math.floor(value));
    let remainder = 100 - weights.reduce((sum, value) => sum + value, 0);
    raw
      .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
      .sort((left, right) => right.fraction - left.fraction || left.index - right.index)
      .forEach(({ index }) => {
        if (remainder <= 0) return;
        weights[index] += 1;
        remainder -= 1;
      });
    return attributes.map((attribute, index) => ({ ...attribute, weight: weights[index] }));
  }

  function fishbeinScorecard(attributes = []) {
    const rows = normalizeHypothesisWeights(attributes).map((attribute) => {
      const watersScore = Math.min(5, Math.max(1, Number(attribute.watersScore || 3)));
      const competitorScore = Math.min(5, Math.max(1, Number(attribute.competitorScore || 3)));
      const weightedDifference = Number(((attribute.weight / 100) * (watersScore - competitorScore)).toFixed(2));
      return { ...attribute, watersScore, competitorScore, weightedDifference };
    });
    const swingAttribute = rows.reduce((swing, row) => {
      if (!swing) return row;
      const difference = Math.abs(row.weightedDifference) - Math.abs(swing.weightedDifference);
      if (difference > 0) return row;
      if (difference === 0 && row.weight > swing.weight) return row;
      return swing;
    }, null);
    return {
      rows,
      weightTotal: rows.reduce((sum, row) => sum + row.weight, 0),
      watersWeightedScore: Number(rows.reduce((sum, row) => sum + (row.weight / 100) * row.watersScore, 0).toFixed(2)),
      competitorWeightedScore: Number(rows.reduce((sum, row) => sum + (row.weight / 100) * row.competitorScore, 0).toFixed(2)),
      swingAttribute,
    };
  }

  function normalizeEvcRange(range = {}) {
    const value = (candidate) => {
      if (candidate === "" || candidate === null || candidate === undefined) return null;
      const parsed = Number(candidate);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const normalized = {
      low: value(range.low),
      base: value(range.base),
      high: value(range.high),
    };
    const complete = Object.values(normalized).every((candidate) => candidate !== null);
    return {
      ...normalized,
      complete,
      ordered: !complete || (normalized.low <= normalized.base && normalized.base <= normalized.high),
    };
  }

  function buildEvcSensitivity(metrics = [], assumptions = {}) {
    const rows = metrics.map((metric) => {
      const range = normalizeEvcRange(assumptions[metric.key]);
      return { ...metric, range, sourceState: metric.sourceState || "Assumption — unsourced" };
    });
    const groups = new Map();
    rows.filter((row) => row.range.complete && row.range.ordered).forEach((row) => {
      if (!groups.has(row.unit)) groups.set(row.unit, { unit: row.unit, low: 0, base: 0, high: 0, count: 0 });
      const group = groups.get(row.unit);
      group.low += row.range.low;
      group.base += row.range.base;
      group.high += row.range.high;
      group.count += 1;
    });
    return {
      rows,
      unitRanges: [...groups.values()],
      completedCount: rows.filter((row) => row.range.complete).length,
      missing: rows.filter((row) => !row.range.complete).map((row) => row.key),
      invalid: rows.filter((row) => row.range.complete && !row.range.ordered).map((row) => row.key),
    };
  }

  function valueClaimEligibility({ substantiationStatus, approvalEstablished = false } = {}) {
    const registryEligible = substantiationStatus === "Proven";
    return {
      registryEligible,
      commercialEligible: registryEligible && approvalEstablished === true,
      status: registryEligible ? "Registry eligible" : "Blocked — substantiation required",
      reason: registryEligible
        ? (approvalEstablished ? "Substantiation and approval are established." : "Substantiation is established; approval remains unresolved.")
        : "A value claim cannot enter the governed claims registry until claim-compatible substantiation is Proven.",
    };
  }

  function buildTargetingBreakReport({
    claimRows = [],
    buyingCommittee = {},
    governingTraces = [],
    requiredBuyerRoles = [],
    economicAssumptions = [],
  } = {}) {
    const unsupportedClaims = claimRows.filter((row) => row.substantiationStatus === "Unsupported");
    const inapplicableProof = claimRows.flatMap((row) => (row.evidenceRecords || [])
      .filter((record) => record.compatibility?.status === "Inapplicable")
      .map((record) => ({ claim: row.proposedClaimWording, record })));
    const committeeRoles = (buyingCommittee.segments || []).flatMap((segment) => segment.roles || []);
    const observedRoleKeys = new Set(committeeRoles
      .filter((role) => role.classification === "observed")
      .map((role) => role.key));
    const missingBuyerRoles = requiredBuyerRoles.filter((role) => !observedRoleKeys.has(role.key));
    const selectedSegment = buyingCommittee.segments?.[0];
    const currentSwing = selectedSegment?.scorecard?.swingAttribute?.label || "Swing attribute unresolved";
    const baselineSwing = selectedSegment?.baselineSwingAttribute?.label || "Market-baseline swing unavailable";
    const conflictingMessages = governingTraces.filter((trace) => ["contradiction", "unsupported"].includes(trace?.status));
    return {
      unsupportedClaims,
      inapplicableProof,
      missingBuyerRoles,
      missingEconomicAssumptions: economicAssumptions,
      swingChange: {
        current: currentSwing,
        baseline: baselineSwing,
        changed: currentSwing !== "Swing attribute unresolved"
          && baselineSwing !== "Market-baseline swing unavailable"
          && currentSwing !== baselineSwing,
      },
      conflictingMessages,
    };
  }

  const api = {
    buildKpis,
    buildTargetingBreakReport,
    canonicalUrl,
    consolidateAppendixGroups,
    evaluateGoverningAlignment,
    evaluateClaimEvidenceCompatibility,
    establishedIndependentSourceCount,
    claimSubstantiation,
    claimCommercialReadiness,
    filterClaimRows,
    fishbeinScorecard,
    buildEvcSensitivity,
    normalizeEvcRange,
    normalizeHypothesisWeights,
    selectPositioningDecisions,
    sourceDomain,
    sourceFamily,
    uniqueUrlRecords,
    valueClaimEligibility,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.PmmDataContract = api;
})(typeof window !== "undefined" ? window : globalThis);
