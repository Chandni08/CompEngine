(function exposeCompetitorSellingMotionTransformer(root) {
  "use strict";

  const validApprovalStates = new Set(["draft", "in-review", "approved", "blocked"]);
  const ignoredTerms = new Set([
    "about", "across", "after", "against", "around", "before", "being", "company", "competitor", "customer",
    "from", "have", "instrument", "into", "move", "only", "platform", "product", "record", "source", "that",
    "their", "these", "this", "through", "under", "using", "waters", "where", "which", "with", "workflow",
  ]);
  const conceptPatterns = Object.freeze({
    automation: /\bai\b|automat|assisted execution|screening/i,
    biopharma: /biopharma|bioproduction|bioprocess|multi[- ]attribute|\bmam\b|\blnp\b|lipid nanoparticle|oligo|protein characterization|proteomics/i,
    compliance: /compliance|compliant|data integrity|audit trail|regulated|validation|validated/i,
    economics: /\bcost\b|\btco\b|economic|price|value-sensitive|procurement/i,
    environmental: /environmental|\bpfas\b|food safety|contaminant/i,
    informatics: /software|informatics|data review|openlab|empower|sciex os/i,
    methodTransfer: /method (?:continuity|setup|transfer)|migration|transferable/i,
    performance: /accuracy|carryover|precision|reproduc|resolution|robust|sensitivity|specificity/i,
    reliability: /downtime|maintenance|reliab|service lifecycle|serviceability|uptime/i,
    routineQc: /quality control|\bqc\b|routine (?:analysis|lab|testing)|system suitability/i,
    throughput: /faster|high[- ]throughput|productivity|speed|throughput/i,
  });

  function text(value) {
    return String(value || "").trim();
  }

  function normalizeApprovalState(value) {
    return validApprovalStates.has(value) ? value : "draft";
  }

  function meaningfulTerms(values) {
    return new Set((Array.isArray(values) ? values : [values])
      .flatMap((value) => text(value).toLowerCase().match(/[a-z0-9-]{4,}/g) || [])
      .filter((term) => !ignoredTerms.has(term)));
  }

  function conceptsFor(values) {
    const value = (Array.isArray(values) ? values : [values]).map(text).join(" ");
    return Object.entries(conceptPatterns).filter(([, pattern]) => pattern.test(value)).map(([name]) => name);
  }

  function sharedCount(left, right) {
    const rightSet = right instanceof Set ? right : new Set(right);
    return [...left].filter((item) => rightSet.has(item)).length;
  }

  function inferBuyingSituation(move = {}) {
    const value = [move.title, move.observedDetail, move.type].map(text).join(" ");
    let dealType = "Deal type unresolved — validation required";
    let committeeRole = "Committee role unresolved — validation required";
    const basis = [];

    if (/validated|validation|method (?:continuity|transfer)|migration|compliance|audit trail|regulated/i.test(value)) {
      dealType = "Validated-method migration";
      basis.push("validated-method, migration, or compliance language");
    } else if (/replacement|refresh|upgrade|modernization|nexera|version-cycle/i.test(value)) {
      dealType = "Competitive replacement";
      basis.push("replacement, refresh, or upgrade language");
    } else if (/new (?:lab|center|facility|hub)|greenfield|expansion|expanded access|new capacity/i.test(value)) {
      dealType = "Greenfield / capacity expansion";
      basis.push("new-facility, access, or capacity language");
    } else if (/service|lifecycle|installed base|maintenance|uptime/i.test(value)) {
      dealType = "Waters installed-base upgrade";
      basis.push("service, lifecycle, or installed-base language");
    }

    if (/procurement|price|\bcost\b|\btco\b|margin|revenue|value-sensitive/i.test(value)) {
      committeeRole = "Procurement / economic buyer";
      basis.push("economic or procurement language");
    } else if (/compliance|data integrity|audit trail|regulated|validation|validated|quality control|\bqc\b/i.test(value)) {
      committeeRole = "QC / QA or validation veto";
      basis.push("quality, validation, or compliance language");
    } else if (/software|informatics|data review|openlab|empower|sciex os|\bai\b/i.test(value)) {
      committeeRole = "Informatics / data-integrity evaluator";
      basis.push("software, informatics, or data-review language");
    } else if (/method|application|proteomics|multiomics|biopharma characterization|screening|quantitation/i.test(value)) {
      committeeRole = "Method developer / application scientist";
      basis.push("method or application-workflow language");
    } else if (/service|maintenance|uptime|productivity|throughput|routine lab/i.test(value)) {
      committeeRole = "Lab manager / operations decision maker";
      basis.push("operations, service, or productivity language");
    }

    return {
      dealType,
      committeeRole,
      classification: "inference",
      basis: basis.length ? `Inferred from ${[...new Set(basis)].join(" and ")}; validate with deal evidence.` : "No source field establishes a deal type or committee role; validate with deal evidence.",
    };
  }

  function cleanIntent(value) {
    return text(value)
      .replace(/^(?:New 30-day alert|Emerging 60-day pattern|Quarterly direction|Repeated one-year direction|Sustained three-year direction):\s*/i, "")
      .trim();
  }

  function namedCustomer(move = {}) {
    return text(move.customerName || move.customer || move.accountName || move.namedCustomer);
  }

  function claimCustomerCompatible(claim, customer) {
    if (!customer) return true;
    const scopes = [claim.applicableCustomers, claim.targetCustomers, claim.customerNames]
      .flatMap((value) => Array.isArray(value) ? value : value ? [value] : [])
      .map((value) => text(value).toLowerCase());
    return scopes.includes(customer.toLowerCase());
  }

  function defensibleEvidence(claim = {}) {
    return (claim.supportingEvidence || []).filter((record) => record?.fieldCitable === true && normalizeApprovalState(record.approvalState) !== "blocked");
  }

  function claimMatchScore(move, claim) {
    if (text(claim.competitor).toLowerCase() !== text(move.competitor).toLowerCase()) return -1;
    const moveValues = [move.title, move.observedDetail, move.type];
    const claimValues = [claim.claimText, claim.dimension, claim.competitorProduct, claim.watersProduct];
    const conceptOverlap = sharedCount(conceptsFor(moveValues), conceptsFor(claimValues));
    const termOverlap = sharedCount(meaningfulTerms(moveValues), meaningfulTerms(claimValues));
    if (!conceptOverlap) return -1;
    return conceptOverlap * 10 + Math.min(termOverlap, 9);
  }

  function selectCounter(move, supportedClaims = []) {
    const customer = namedCustomer(move);
    return supportedClaims
      .filter((claim) => claim?.status === "supported" && claim.approvalState !== "blocked" && claim.fieldUsable !== false)
      .filter((claim) => defensibleEvidence(claim).length > 0)
      .filter((claim) => claimCustomerCompatible(claim, customer))
      .map((claim) => ({ claim, score: claimMatchScore(move, claim) }))
      .filter((item) => item.score >= 10)
      .sort((left, right) => right.score - left.score || text(left.claim.id).localeCompare(text(right.claim.id)))[0]?.claim || null;
  }

  function priorityMatchScore(move, priority) {
    const competitors = (priority.competitors?.length ? priority.competitors : [priority.competitor])
      .map((value) => text(value).toLowerCase()).filter(Boolean);
    if (competitors.length && !competitors.includes(text(move.competitor).toLowerCase())) return -1;
    const moveValues = [move.title, move.observedDetail, move.type];
    const priorityValues = [priority.claimText, priority.dimension, priority.competitorProduct, priority.watersProduct, priority.buyingCriterion];
    const conceptOverlap = sharedCount(conceptsFor(moveValues), conceptsFor(priorityValues));
    const termOverlap = sharedCount(meaningfulTerms(moveValues), meaningfulTerms(priorityValues));
    return (competitors.length ? 20 : 0) + conceptOverlap * 10 + Math.min(termOverlap, 9);
  }

  function selectProofPriority(move, proofPriorities = {}) {
    const priorities = [
      ...(proofPriorities.top || []).map((priority) => ({ ...priority, queueLocation: "top" })),
      ...(proofPriorities.backlog || []).map((priority) => ({ ...priority, queueLocation: "backlog" })),
    ];
    return priorities
      .map((priority) => ({ priority, score: priorityMatchScore(move, priority) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || text(left.priority.id).localeCompare(text(right.priority.id)))[0]?.priority || null;
  }

  function stableId(value, fallback) {
    const slug = text(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return slug || fallback;
  }

  function transformMove(profile, move, moveIndex, supportedClaims, proofPriorities) {
    const competitor = text(profile.competitor) || "Competitor unresolved";
    const normalizedMove = { ...move, competitor };
    const counter = selectCounter(normalizedMove, supportedClaims);
    const priority = counter ? null : selectProofPriority(normalizedMove, proofPriorities);
    const evidence = counter ? defensibleEvidence(counter) : [];
    const customer = namedCustomer(move);
    return {
      id: `selling-motion-${stableId(competitor, "competitor")}-${stableId(move.id || move.title, `move-${moveIndex + 1}`)}`,
      competitor,
      observedMove: {
        label: text(move.title) || "Observed move unresolved",
        text: text(move.title) || "Observed move unresolved — source record has no title.",
        detail: text(move.observedDetail),
        type: text(move.type) || "Record type unresolved",
        date: text(move.date),
        sourceName: text(move.sourceName) || "Source unresolved",
        url: text(move.url),
        fieldCitable: move.fieldCitable === true,
        approvalState: normalizeApprovalState(move.approvalState),
      },
      inferredIntent: cleanIntent(profile.likelyNext || profile.intent) || "Intent gap — no backing inference is recorded.",
      buyingSituation: inferBuyingSituation(move),
      namedCustomer: customer || "No customer named in source record",
      watersResponse: counter ? {
        status: "defensible",
        responseText: text(counter.claimText),
        claimId: counter.id,
        approvalState: normalizeApprovalState(counter.approvalState),
        supportingEvidence: evidence,
        proofPriority: null,
        fieldUsable: true,
      } : {
        status: "needs proof",
        responseText: "Needs proof — no field-citable, non-blocked counter matches this move and buying context.",
        claimId: "",
        approvalState: "draft",
        supportingEvidence: [],
        proofPriority: priority ? {
          id: priority.id,
          claimText: priority.claimText,
          missingStudyEvidence: priority.missingStudyEvidence,
          queueLocation: priority.queueLocation,
          href: `#pmm-proof-priority-${stableId(priority.id, "unmapped")}`,
        } : {
          id: "",
          claimText: "No exact proof-priority claim is mapped to this move.",
          missingStudyEvidence: "Add a field-citable external record supporting exact counter wording, then clear the claim approval gate.",
          queueLocation: "unmapped",
          href: "#pmm-positioning-decisions",
        },
        fieldUsable: false,
      },
    };
  }

  function transformCompetitorIntentProfiles({ profiles = [], supportedClaims = [], proofPriorities = {} } = {}) {
    const moves = profiles.flatMap((profile) => (profile.evidenceItems || []).map((move, index) =>
      transformMove(profile, move, index, supportedClaims, proofPriorities)
    ));
    const groups = profiles.map((profile) => ({
      competitor: profile.competitor,
      moves: moves.filter((move) => move.competitor === profile.competitor),
    })).filter((group) => group.moves.length);
    return {
      moves,
      groups,
      defensibleCount: moves.filter((move) => move.watersResponse.status === "defensible").length,
      needsProofCount: moves.filter((move) => move.watersResponse.status === "needs proof").length,
    };
  }

  const api = {
    conceptsFor,
    inferBuyingSituation,
    selectCounter,
    selectProofPriority,
    transformCompetitorIntentProfiles,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CompetitorSellingMotionTransformer = api;
})(typeof window !== "undefined" ? window : globalThis);

