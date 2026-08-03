(function exposeBuyingCommitteeTransformer(root) {
  "use strict";

  const committeeRoleDefinitions = Object.freeze([
    { key: "uses", label: "Who uses", decisionPower: "uses", match: /^(?:analyst|instrument specialist|data scientist)$/i },
    { key: "influences", label: "Who influences", decisionPower: "influences", match: /^method developer$/i },
    { key: "vetoes", label: "Who vetoes", decisionPower: "vetoes", match: /^qa\/compliance$/i },
    { key: "decides", label: "Who decides", decisionPower: "decides", match: /^lab manager$/i },
    { key: "buys", label: "Who buys", decisionPower: "buys", match: /^procurement$/i },
  ]);

  function text(value) {
    return String(value || "").trim();
  }

  function canonicalUrl(value) {
    try {
      const parsed = new URL(value);
      if (!["http:", "https:"].includes(parsed.protocol)) return "";
      parsed.hash = "";
      parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
      if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, "");
      [...parsed.searchParams.keys()].forEach((key) => {
        if (/^(?:utm_|fbclid$|gclid$)/i.test(key)) parsed.searchParams.delete(key);
      });
      parsed.searchParams.sort();
      return parsed.toString();
    } catch {
      return "";
    }
  }

  function stableSlug(value, fallback = "record") {
    return text(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || fallback;
  }

  function roleForTag(value) {
    const tag = text(value);
    return committeeRoleDefinitions.find((definition) => definition.match.test(tag)) || null;
  }

  function exactSources(record = {}) {
    const sources = [];
    const seen = new Set();
    const add = (source = {}) => {
      const url = canonicalUrl(source.url || source.sourceUrl || source.primarySourceUrl);
      if (!url || seen.has(url)) return;
      seen.add(url);
      sources.push({
        id: source.id || `${record.id || "customer-voice"}-source-${sources.length + 1}`,
        url,
        label: source.label || source.title || `${record.company || "Customer Voice"}: ${record.product || record.theme || "decision criterion"}`,
        sourceName: source.sourceName || record.sourceName || "Public customer source",
        date: source.sourceDate || source.date || record.sourceDate || record.dateCaptured || "",
        fieldCitable: source.fieldCitable === true || (source.fieldCitable !== false && record.fieldCitable === true),
        approvalState: source.approvalState || record.approvalState || "draft",
      });
    };
    (record.evidenceRecords || []).forEach(add);
    add({
      label: `${record.company || "Customer Voice"}: ${record.product || record.theme || "decision criterion"}`,
      sourceName: record.sourceName,
      url: record.primarySourceUrl || record.sourceUrl,
      sourceDate: record.sourceDate || record.dateCaptured,
    });
    return sources;
  }

  function evidenceLanguage(record = {}) {
    return text(record.customerLanguageSignal) || text(record.theme) || text(record.category);
  }

  function proofDemand(record = {}, index = 0) {
    const basis = evidenceLanguage(record);
    const sources = exactSources(record);
    const demandEstablished = Boolean(basis && sources.length && ["Negative", "Mixed"].includes(record.sentiment));
    return {
      id: `role-proof-${stableSlug(record.id, String(index + 1))}`,
      sourceRecordId: record.id || "",
      proofState: demandEstablished ? "evidence-backed-demand" : "unresolved",
      proofDemandText: demandEstablished
        ? basis
        : `Unresolved — this record identifies ${text(record.buyingPriority) || "a decision criterion"} but does not state a role-specific proof demand.`,
      evidenceBasis: basis || "Evidence language unresolved.",
      languageMode: record.languageType === "verbatim_quote" ? "verbatim" : "synthesis",
      languageLabel: record.languageType === "verbatim_quote" ? "Verbatim customer phrasing" : "Analyst synthesis — not a customer quote",
      sentiment: record.sentiment || "Sentiment unresolved",
      company: record.company || "Company unresolved",
      product: record.product || "Product unresolved",
      sources,
      fieldCitable: false,
      fieldUsable: false,
      approvalState: record.approvalState || "draft",
    };
  }

  function criterionModels(records = []) {
    const grouped = new Map();
    records.forEach((record) => {
      const criterion = text(record.buyingPriority) || "Decision criterion unresolved";
      if (!grouped.has(criterion)) grouped.set(criterion, []);
      grouped.get(criterion).push(record);
    });
    return [...grouped.entries()].map(([criterion, items]) => {
      const demands = items.map(proofDemand);
      const sourceMap = new Map();
      demands.flatMap((demand) => demand.sources).forEach((source) => sourceMap.set(source.url, source));
      return {
        key: stableSlug(criterion, "criterion-unresolved"),
        criterion,
        recordCount: items.length,
        proofDemands: demands,
        evidenceBackedDemandCount: demands.filter((demand) => demand.proofState === "evidence-backed-demand").length,
        sources: [...sourceMap.values()],
        fieldCitable: false,
        approvalState: "draft",
      };
    }).sort((left, right) => right.recordCount - left.recordCount || left.criterion.localeCompare(right.criterion));
  }

  function roleModel(definition, records = []) {
    const memberTags = [...new Set(records.map((record) => text(record.userRole)).filter(Boolean))].sort();
    const criteria = criterionModels(records);
    const sourceMap = new Map();
    criteria.flatMap((criterion) => criterion.sources).forEach((source) => sourceMap.set(source.url, source));
    const objection = records.find((record) => ["Negative", "Mixed"].includes(record.sentiment));
    return {
      ...definition,
      memberTags,
      recordCount: records.length,
      criteria,
      sources: [...sourceMap.values()],
      classification: records.length ? "observed" : "unresolved",
      classificationLabel: records.length ? "Exact role tag mapped" : "Unresolved — no exact role-tag mapping",
      confidence: records.length ? Math.max(...records.map((record) => Number(record.confidence || 0)), 0) : 0,
      message: "Unresolved — no approved role message is loaded; use only the evidence-backed criteria and proof demands.",
      objection: objection ? evidenceLanguage(objection) : "Unresolved — no role-specific objection is recorded.",
      fieldCitable: false,
      approvalState: "draft",
    };
  }

  function unresolvedRoleGroups(records = []) {
    const grouped = new Map();
    records.forEach((record) => {
      const tag = text(record.userRole) || "Role tag missing";
      if (!grouped.has(tag)) grouped.set(tag, []);
      grouped.get(tag).push(record);
    });
    return [...grouped.entries()].map(([roleTag, items]) => ({
      roleTag,
      recordCount: items.length,
      criteria: criterionModels(items),
      sources: [...new Map(items.flatMap(exactSources).map((source) => [source.url, source])).values()],
      status: "unresolved",
      reason: "The loaded role tag does not distinguish a committee function; no committee assignment was inferred.",
      fieldCitable: false,
      approvalState: "draft",
    })).sort((left, right) => right.recordCount - left.recordCount || left.roleTag.localeCompare(right.roleTag));
  }

  function transformBuyingCommittee({ records = [] } = {}) {
    const buckets = new Map(committeeRoleDefinitions.map((definition) => [definition.key, []]));
    const unresolvedRecords = [];
    records.forEach((record) => {
      const mappedRole = roleForTag(record.userRole);
      if (!mappedRole) unresolvedRecords.push(record);
      else buckets.get(mappedRole.key).push(record);
    });
    const roles = committeeRoleDefinitions.map((definition) => roleModel(definition, buckets.get(definition.key)));
    const mappedRecordCount = roles.reduce((total, role) => total + role.recordCount, 0);
    return {
      roles,
      unresolvedRoleGroups: unresolvedRoleGroups(unresolvedRecords),
      recordCount: records.length,
      mappedRecordCount,
      unresolvedRecordCount: unresolvedRecords.length,
      exactSourceCount: new Set(records.flatMap(exactSources).map((source) => source.url)).size,
      segmentation: "buying-committee-role",
    };
  }

  const api = {
    committeeRoleDefinitions,
    exactSources,
    proofDemand,
    roleForTag,
    transformBuyingCommittee,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.BuyingCommitteeTransformer = api;
})(typeof window !== "undefined" ? window : globalThis);
