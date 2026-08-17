(function exposePositionGuardrailsTransformer(root) {
  "use strict";

  const validApprovalStates = Object.freeze(["draft", "in-review", "approved", "blocked"]);
  const baseExclusions = Object.freeze([
    {
      id: "market-prevalence",
      claimText: "We will not claim that the public trend records prove market-wide demand, buyer preference, or prevalence.",
      reason: "Overall Trend Analysis is directional public evidence, not representative buyer research, win/loss data, or a market-prevalence study.",
    },
    {
      id: "volume-proxy",
      claimText: "We will not claim that publication counts or source-family volume prove adoption, market share, or commercial impact.",
      reason: "Record volume measures visible activity in the loaded sources; it does not measure purchases, installed share, or business outcomes.",
    },
    {
      id: "trend-superiority",
      claimText: "We will not claim that trend context alone proves Waters or competitor product superiority.",
      reason: "A directional trend is not a controlled, product-matched comparative study and cannot substantiate fastest, superior, or best-in-class wording.",
    },
    {
      id: "guaranteed-outcomes",
      claimText: "We will not claim guaranteed uptime, method-transfer, compliance, productivity, or customer outcomes.",
      reason: "Overall Trend Analysis identifies areas of attention but contains no approved record that guarantees those outcomes for a named customer or workflow.",
    },
  ]);

  function text(value) {
    return String(value || "").trim();
  }

  function normalizeApprovalState(value) {
    return validApprovalStates.includes(value) ? value : "draft";
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

  function citableTrendSources(trend = {}) {
    const seen = new Set();
    return (trend.evidence?.activeGroups || []).flatMap((group) => (group.items || []).map((item) => ({
      ...item,
      family: item.family || group.label,
      evidenceRole: "Overall Trend Analysis pillar",
      url: canonicalUrl(item.url),
      approvalState: normalizeApprovalState(item.approvalState),
    }))).filter((source) => source.url
      && source.fieldCitable === true
      && source.approvalState !== "blocked"
      && !seen.has(source.url)
      && seen.add(source.url));
  }

  function meaningfulKeywords(value) {
    const ignored = new Set(["becoming", "complete", "demand", "instrument", "large", "part", "remains", "source", "toward", "trend", "visible", "workflow", "workflows"]);
    return [...new Set(text(value).toLowerCase().match(/[a-z0-9-]{5,}/g)?.filter((word) => !ignored.has(word)) || [])];
  }

  function narrativeSpine(trends = []) {
    const arc = trends.map((trend) => ({
      trendId: trend.id,
      title: text(trend.narrative?.title || trend.title) || "Trend unresolved",
      whyNow: text(trend.narrative?.synthesis) || "Why-now framing unresolved in Overall Trend Analysis.",
      whyWaters: text(trend.narrative?.implication) || "Why-Waters implication unresolved in Overall Trend Analysis.",
      fieldCitableSourceCount: citableTrendSources(trend).length,
    }));
    return {
      arc,
      whyNow: arc.map((item) => item.whyNow).join(" "),
      whyWaters: arc.map((item) => item.whyWaters).join(" "),
      source: "Overall Trend Analysis",
      fieldCitable: false,
      approvalState: "draft",
    };
  }

  function pillarForTrend(trend = {}, index = 0) {
    const sources = citableTrendSources(trend);
    if (!sources.length) return null;
    return {
      id: `trend-pillar-${trend.id || index + 1}`,
      trendId: trend.id || "",
      name: text(trend.narrative?.title || trend.title) || `Trend pillar ${index + 1}`,
      statement: text(trend.narrative?.implication) || "Waters implication unresolved in Overall Trend Analysis.",
      framing: text(trend.narrative?.synthesis),
      sources,
      fieldCitableSourceCount: sources.length,
      supportState: `${sources.length} field-citable record${sources.length === 1 ? "" : "s"} trace to this pillar. The pillar wording remains a draft synthesis, not an approved claim.`,
      fieldCitable: false,
      approvalState: "draft",
    };
  }

  function uncitableTrendExclusion(trend = {}, index = 0) {
    const title = text(trend.narrative?.title || trend.title) || `Trend ${index + 1}`;
    return {
      id: `uncitable-trend-${trend.id || index + 1}`,
      claimText: `We will not present “${title}” as an evidence pillar or field claim.`,
      reason: "The trend can inform narrative framing, but no fieldCitable record in its loaded Overall Trend Analysis evidence backs it.",
      trendId: trend.id || "",
      keywords: meaningfulKeywords(title),
    };
  }

  function transformOverallTrends({ trends = [], approvalState = "draft" } = {}) {
    const eligibleTrends = trends.filter(Boolean).slice(0, 5);
    const pillars = eligibleTrends.map(pillarForTrend).filter(Boolean).slice(0, 5);
    const framingOnlyTrends = eligibleTrends.filter((trend) => !citableTrendSources(trend).length);
    const exclusionRecords = [
      ...baseExclusions.map((item) => ({ ...item })),
      ...framingOnlyTrends.map(uncitableTrendExclusion),
    ];
    return {
      narrativeSpine: narrativeSpine(eligibleTrends),
      evidencePillars: pillars,
      framingOnlyTrends: framingOnlyTrends.map((trend) => ({
        id: trend.id || "",
        title: text(trend.narrative?.title || trend.title) || "Trend unresolved",
        reason: "No fieldCitable record is available in the loaded Overall Trend Analysis evidence.",
      })),
      exclusionRecords,
      exclusions: exclusionRecords.map((item) => `${item.claimText} Why: ${item.reason}`),
      approvalState: normalizeApprovalState(approvalState),
      pillarRequirement: {
        minimum: 3,
        maximum: 5,
        met: pillars.length >= 3 && pillars.length <= 5,
        gap: pillars.length >= 3 ? "" : `Gap — only ${pillars.length} trend${pillars.length === 1 ? " has" : "s have"} field-citable backing; at least 3 are required.`,
      },
      fieldCitable: false,
      source: "Overall Trend Analysis",
    };
  }

  function usableEvidence(records = []) {
    return records.filter((record) => record?.fieldCitable === true && normalizeApprovalState(record.approvalState) !== "blocked");
  }

  function overlapCount(value, keywords = []) {
    const words = new Set(text(value).toLowerCase().match(/[a-z0-9-]{5,}/g) || []);
    return keywords.filter((keyword) => words.has(keyword)).length;
  }

  function detectExclusionConflicts({ claimText = "", evidenceRecords = [], exclusions = [] } = {}) {
    const claim = text(claimText);
    if (!claim) return [];
    const citableEvidence = usableEvidence(evidenceRecords);
    return exclusions.filter((exclusion) => {
      if (exclusion.id === "market-prevalence") {
        return /\b(?:all|every|market[- ]wide|industry[- ]wide)\b.{0,50}\b(?:buyers?|customers?|demand|preference|prevalence)\b|\b(?:buyers?|customers?)\s+(?:demand|prefer|expect|require)\b|\b(?:market demand|buyer preference)\s+(?:is|has|proves?|shows?)\b/i.test(claim);
      }
      if (exclusion.id === "volume-proxy") {
        return /\b(?:publication|record|source|signal|evidence)(?:s| volume| count)?\b.{0,90}\b(?:proves?|establishes?|demonstrates?)\b.{0,90}\b(?:adoption|demand|market share|commercial impact)\b|\b(?:adoption|demand|market share|commercial impact)\b.{0,90}\b(?:publication|record|source|signal|evidence)(?:s| volume| count)?\b/i.test(claim);
      }
      if (exclusion.id === "trend-superiority") {
        const superiority = /\b(?:fastest|best-in-class|superior|outperform(?:s|ed)?|market-leading|unmatched|better than|advantage over)\b/i.test(claim);
        return superiority && citableEvidence.length === 0;
      }
      if (exclusion.id === "guaranteed-outcomes") {
        return /\b(?:guarantee(?:d|s)?|always|zero downtime|eliminate(?:s|d)? (?:compliance|regulatory|transfer|migration|service|failure|risk)|ensures? (?:regulatory )?compliance|regulatory approval)\b/i.test(claim);
      }
      return exclusion.id?.startsWith("uncitable-trend-")
        && overlapCount(claim, exclusion.keywords) >= Math.min(2, exclusion.keywords.length)
        && citableEvidence.length === 0;
    }).map((exclusion) => ({
      exclusionId: exclusion.id,
      claimText: exclusion.claimText,
      reason: exclusion.reason,
    }));
  }

  function flagDownstreamClaim(claim = {}, { exclusions = [], textField = "claimText", evidenceField = "supportingEvidence" } = {}) {
    const guardrailConflicts = detectExclusionConflicts({
      claimText: claim[textField],
      evidenceRecords: claim[evidenceField] || [],
      exclusions,
    });
    return {
      ...claim,
      guardrailStatus: guardrailConflicts.length ? "conflict" : "aligned",
      guardrailConflicts,
      fieldUsable: claim.fieldUsable === true && guardrailConflicts.length === 0,
    };
  }

  const api = {
    baseExclusions,
    citableTrendSources,
    detectExclusionConflicts,
    flagDownstreamClaim,
    transformOverallTrends,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.PositionGuardrailsTransformer = api;
})(typeof window !== "undefined" ? window : globalThis);

