(function exposeProofPriorityTransformer(root) {
  "use strict";

  const ignoredWords = new Set([
    "about", "across", "against", "around", "before", "being", "between", "claim", "could", "drive", "field",
    "from", "have", "into", "make", "only", "product", "required", "should", "study", "support", "that", "their",
    "these", "this", "through", "under", "using", "waters", "where", "which", "with", "workflow", "workflows",
  ]);

  function text(value) {
    return String(value || "").trim();
  }

  function normalizedText(value) {
    return text(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function meaningfulTerms(values) {
    return [...new Set((Array.isArray(values) ? values : [values])
      .flatMap((value) => normalizedText(value).split(" "))
      .filter((word) => word.length >= 4 && !ignoredWords.has(word)))];
  }

  function customerVoiceText(record = {}) {
    return [
      record.theme,
      record.category,
      record.customerLanguageSignal,
      record.pmInterpretation,
      record.buyingPriority,
      record.platform,
      record.product,
    ].map(normalizedText).filter(Boolean).join(" ");
  }

  function recordMatchesTerms(record, terms) {
    if (!terms.length) return false;
    const haystack = customerVoiceText(record);
    const matched = terms.filter((term) => new RegExp(`(?:^| )${term}(?:s|es|ing|ed)?(?: |$)`).test(haystack));
    return matched.length >= Math.min(2, terms.length);
  }

  function claimFrequency(item, customerVoiceRecords = []) {
    const terms = meaningfulTerms(item.customerVoiceTerms?.length
      ? item.customerVoiceTerms
      : [item.claimText, item.dimension, item.buyingCriterion, item.affectedCapability]);
    return customerVoiceRecords.filter((record) => record && recordMatchesTerms(record, terms)).length;
  }

  function explicitDealImpact(item = {}) {
    const values = [item.dealImpact, item.dealImpactScore, item.commercialImpact, item.commercialImpactScore];
    const found = values.find((value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0);
    return found === undefined ? null : Number(found);
  }

  function normalizedTags(item = {}) {
    return [...new Set([...(item.tags || []), ...(item.decisionTags || [])]
      .map((tag) => normalizedText(tag).replace(/ /g, "-"))
      .filter(Boolean))];
  }

  function isCommercialProofDecision(item = {}) {
    const tags = normalizedTags(item);
    return tags.includes("commercial") || tags.includes("proof") || tags.includes("commercial-proof");
  }

  function normalizeGap(item = {}, index = 0) {
    return {
      id: item.id || `gap-${index + 1}`,
      source: "gapQueue",
      sourceIds: [item.id || `gap-${index + 1}`],
      claimText: text(item.claimText) || "Gap — proposed commercial claim wording is not recorded.",
      missingStudyEvidence: text(item.studyRequiredBeforeFieldUse) || "Gap — the required study or evidence is not recorded.",
      sellerAsset: text(item.sellerAsset) || "One-Page Competitive Battlecard",
      customerVoiceTerms: item.customerVoiceTerms || [item.claimText, item.dimension, item.watersProduct],
      dimension: item.dimension || "",
      buyingCriterion: item.buyingCriterion || "",
      affectedCapability: item.affectedCapability || "",
      dealImpact: explicitDealImpact(item),
      status: "gap",
      fieldUsable: false,
      approvalState: item.approvalState || "draft",
    };
  }

  function normalizeDecision(item = {}, index = 0) {
    return {
      id: item.id || `decision-${index + 1}`,
      source: "Decisions Needed",
      sourceIds: [item.id || `decision-${index + 1}`],
      claimText: text(item.commercialClaim || item.proposedClaimWording || item.claimText)
        || `Claim wording gap — no proposed commercial claim is recorded for “${text(item.title) || `Decision ${index + 1}`}.”`,
      missingStudyEvidence: text(item.missingStudyEvidence || item.missingProof)
        || (item.outstandingInternalEvidence || []).map(text).filter(Boolean).join("; ")
        || text(item.decisionGate)
        || "Gap — the required study or evidence is not recorded.",
      sellerAsset: text(item.sellerAsset) || "One-Page Competitive Battlecard",
      customerVoiceTerms: item.customerVoiceTerms || [item.title, item.affectedCapability, item.technology, item.marketSegment],
      dimension: item.dimension || "",
      buyingCriterion: item.buyingCriterion || "",
      affectedCapability: item.affectedCapability || "",
      dealImpact: explicitDealImpact(item),
      status: "gap",
      fieldUsable: false,
      approvalState: item.approvalState || "draft",
      decisionTags: normalizedTags(item),
    };
  }

  function mergeItems(items = []) {
    const merged = new Map();
    items.forEach((item) => {
      const key = normalizedText(item.claimText);
      if (!merged.has(key)) {
        merged.set(key, { ...item, sourceIds: [...item.sourceIds], sources: [item.source] });
        return;
      }
      const current = merged.get(key);
      current.sourceIds = [...new Set([...current.sourceIds, ...item.sourceIds])];
      current.sources = [...new Set([...current.sources, item.source])];
      const missing = [current.missingStudyEvidence, item.missingStudyEvidence].filter(Boolean);
      current.missingStudyEvidence = [...new Set(missing)].join("; ");
      if (current.dealImpact === null && item.dealImpact !== null) current.dealImpact = item.dealImpact;
    });
    return [...merged.values()];
  }

  function supportedClaimKeys(supportedClaims = []) {
    return new Set(supportedClaims
      .filter((claim) => claim && claim.status === "supported" && claim.approvalState !== "blocked")
      .map((claim) => normalizedText(claim.claimText || claim.proposedClaimWording))
      .filter(Boolean));
  }

  function rankItems(items = []) {
    return [...items].sort((left, right) => {
      const leftMeasured = left.priorityScore !== null;
      const rightMeasured = right.priorityScore !== null;
      if (leftMeasured !== rightMeasured) return Number(rightMeasured) - Number(leftMeasured);
      if (leftMeasured && rightMeasured && right.priorityScore !== left.priorityScore) return right.priorityScore - left.priorityScore;
      if (right.claimFrequency !== left.claimFrequency) return right.claimFrequency - left.claimFrequency;
      if ((right.dealImpact ?? -1) !== (left.dealImpact ?? -1)) return (right.dealImpact ?? -1) - (left.dealImpact ?? -1);
      return String(left.id).localeCompare(String(right.id));
    });
  }

  function aggregateProofPriorities({ gapQueue = [], decisionItems = [], customerVoiceRecords = [], supportedClaims = [], limit = 3 } = {}) {
    const supported = supportedClaimKeys(supportedClaims);
    const sourceItems = [
      ...gapQueue.map(normalizeGap),
      ...decisionItems.filter(isCommercialProofDecision).map(normalizeDecision),
    ];
    const normalized = sourceItems.filter((item) => item.status === "gap" && item.fieldUsable === false && !supported.has(normalizedText(item.claimText)));
    const merged = mergeItems(normalized);
    const ranked = rankItems(merged.map((item) => {
      const frequency = claimFrequency(item, customerVoiceRecords);
      return {
        ...item,
        claimFrequency: frequency,
        priorityScore: item.dealImpact === null ? null : item.dealImpact * frequency,
        rankFormula: "deal impact × Customer Voice claim frequency",
        rankState: item.dealImpact === null ? "deal-impact-unresolved" : "calculated",
      };
    }));
    return {
      top: ranked.slice(0, limit),
      backlog: ranked.slice(limit),
      all: ranked,
      supportedClaimsExcluded: sourceItems.length - normalized.length,
      duplicateClaimsMerged: normalized.length - merged.length,
      formula: "deal impact × Customer Voice claim frequency",
    };
  }

  const api = {
    aggregateProofPriorities,
    claimFrequency,
    explicitDealImpact,
    isCommercialProofDecision,
    meaningfulTerms,
    normalizedText,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.ProofPriorityTransformer = api;
})(typeof window !== "undefined" ? window : globalThis);
