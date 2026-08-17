(function exposeSellerAssetsTransformer(root) {
  "use strict";

  const validApprovalStates = new Set(["draft", "in-review", "approved", "blocked"]);
  const assetDefinitions = Object.freeze([
    { id: "battlecard", title: "Battlecard", sourceLabel: "Competitor Plays + Claim Control", audience: "field" },
    { id: "claims-sheet", title: "Claims Sheet", sourceLabel: "Claim Control", audience: "field" },
    { id: "lead-vertical-pitch", title: "Lead-Vertical Pitch", sourceLabel: "Application Trends + Claim Control", audience: "field" },
    { id: "proof-request-list", title: "Proof-Request List", sourceLabel: "Three Proof Priorities", audience: "internal" },
  ]);

  function text(value) {
    return String(value ?? "").trim();
  }

  function normalizeApprovalState(value) {
    return validApprovalStates.has(value) ? value : "draft";
  }

  function stableSlug(value, fallback = "item") {
    return text(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || fallback;
  }

  function isApprovedCitableRecord(record = {}) {
    return record.fieldCitable === true
      && normalizeApprovalState(record.approvalState) === "approved"
      && /^https?:\/\//i.test(text(record.url || record.sourceUrl || record.primarySourceUrl));
  }

  function dedupeRecords(records = []) {
    const seen = new Set();
    return records.filter((record) => {
      const key = text(record.url || record.sourceUrl || record.primarySourceUrl).toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function approvedEvidence(records = []) {
    return dedupeRecords(records.filter(isApprovedCitableRecord));
  }

  function claimTargetValues(claim = {}) {
    return [
      claim.targetSegment,
      claim.segment,
      claim.audience,
      ...(Array.isArray(claim.targetSegments) ? claim.targetSegments : []),
    ].map(text).filter(Boolean);
  }

  function claimMatchesTarget(claim, targetSegment) {
    const target = text(targetSegment);
    const values = claimTargetValues(claim);
    if (!target || target === "All") return true;
    return values.some((value) => value === target || value.startsWith(`${target} ·`) || target.startsWith(`${value} ·`));
  }

  function claimMatchesCompetitor(claim, competitor) {
    return !text(competitor) || text(competitor) === "All" || text(claim.competitor) === text(competitor);
  }

  function normalizeComparatorClaim(claim = {}) {
    const supportingEvidence = approvedEvidence(claim.supportingEvidence || []);
    const exactWording = text(claim.claimText);
    const cleared = exactWording
      && claim.status === "supported"
      && normalizeApprovalState(claim.approvalState) === "approved"
      && claim.fieldCitable === true
      && claim.fieldUsable !== false
      && claim.guardrailStatus !== "conflict"
      && supportingEvidence.length > 0;
    return {
      id: text(claim.id) || `comparator-${stableSlug(exactWording)}`,
      source: "Product Comparator Claim Control",
      competitor: text(claim.competitor),
      targetValues: claimTargetValues(claim),
      claimText: exactWording,
      approvalState: normalizeApprovalState(claim.approvalState),
      fieldCitable: claim.fieldCitable === true,
      supportingEvidence,
      cleared: Boolean(cleared),
      reason: cleared
        ? "Approved exact wording with approved field-citable proof."
        : claim.guardrailStatus === "conflict"
          ? "Blocked by a Position Guardrails exclusion."
          : normalizeApprovalState(claim.approvalState) !== "approved"
            ? `Approval state is ${normalizeApprovalState(claim.approvalState)}.`
            : supportingEvidence.length === 0
              ? "No approved field-citable supporting record is attached."
              : "Claim Control field-use gate is not cleared.",
    };
  }

  function validApprovedWording(value) {
    const wording = text(value);
    return wording && !/unavailable|not (?:established|approved)|needed|unresolved/i.test(wording);
  }

  function normalizeRegistryClaim(claim = {}) {
    const exactWording = validApprovedWording(claim.approvedWording) ? text(claim.approvedWording) : "";
    const supportingEvidence = approvedEvidence([
      ...(claim.evidenceRecords || []).filter((record) => !record.compatibility || record.compatibility.status === "Applicable"),
      ...(claim.sources || []),
    ]);
    const cleared = exactWording
      && claim.approvalEstablished === true
      && normalizeApprovalState(claim.approvalState) === "approved"
      && claim.guardrailStatus !== "conflict"
      && supportingEvidence.length > 0;
    return {
      id: text(claim.id) || `registry-${stableSlug(claim.competitor)}-${stableSlug(exactWording || claim.proposedClaimWording)}`,
      source: "Claims Registry",
      competitor: text(claim.competitor),
      targetValues: claimTargetValues(claim),
      claimText: exactWording || text(claim.proposedClaimWording),
      approvalState: normalizeApprovalState(claim.approvalState),
      fieldCitable: supportingEvidence.length > 0,
      supportingEvidence,
      cleared: Boolean(cleared),
      reason: cleared
        ? "Approved registry wording with approved field-citable proof."
        : claim.guardrailStatus === "conflict"
          ? "Blocked by a Position Guardrails exclusion."
          : !exactWording || claim.approvalEstablished !== true
            ? "No explicit approved wording record is loaded."
            : normalizeApprovalState(claim.approvalState) !== "approved"
              ? `Approval state is ${normalizeApprovalState(claim.approvalState)}.`
              : "No approved field-citable applicable proof is attached.",
    };
  }

  function collectClaims({ comparatorClaims = [], registryClaims = [], competitor = "", targetSegment = "" } = {}) {
    const normalized = [
      ...comparatorClaims.map(normalizeComparatorClaim),
      ...registryClaims.map(normalizeRegistryClaim),
    ].filter((claim) => claimMatchesCompetitor(claim, competitor));
    const targetScoped = normalized.map((claim) => ({
      ...claim,
      targetMatched: claimMatchesTarget({ targetSegments: claim.targetValues }, targetSegment),
    }));
    return {
      all: targetScoped,
      approved: targetScoped.filter((claim) => claim.cleared && claim.targetMatched),
      notCleared: targetScoped.filter((claim) => !claim.cleared || !claim.targetMatched).map((claim) => ({
        id: claim.id,
        text: claim.claimText || "Claim wording gap — no exact wording is recorded.",
        source: claim.source,
        reason: claim.targetMatched ? claim.reason : `Target-segment applicability to ${text(targetSegment) || "the selected segment"} is unresolved.`,
        approvalState: claim.approvalState,
        fieldCitable: claim.fieldCitable,
        internalOnly: true,
      })),
    };
  }

  function moveMatchesTarget(move = {}, targetSegment) {
    if (!text(targetSegment) || text(targetSegment) === "All") return true;
    const values = [
      move.targetSegment,
      move.marketSegment,
      move.segment,
      move.buyingSituation?.segment,
      ...(move.targetSegments || []),
    ].map(text).filter(Boolean);
    return values.length > 0 && values.some((value) => value === targetSegment || value.includes(targetSegment));
  }

  function collectBattlecardPlays({ competitorPlays = [], competitor = "", targetSegment = "", approvedClaims = [] } = {}) {
    const approvedClaimById = new Map(approvedClaims.map((claim) => [claim.id, claim]));
    const plays = competitorPlays.filter((move) => text(move.competitor) === text(competitor));
    const approved = [];
    const notCleared = [];
    plays.forEach((move) => {
      const observation = move.observedMove || {};
      const response = move.watersResponse || {};
      const observationApproved = isApprovedCitableRecord(observation);
      const responseEvidence = approvedEvidence(response.supportingEvidence || []);
      const approvedClaim = approvedClaimById.get(text(response.claimId));
      const responseApproved = response.status === "defensible"
        && normalizeApprovalState(response.approvalState) === "approved"
        && responseEvidence.length > 0
        && approvedClaim
        && text(response.responseText) === approvedClaim.claimText;
      const targetMatched = moveMatchesTarget(move, targetSegment) || Boolean(approvedClaim);
      if (observationApproved && responseApproved && targetMatched) {
        approved.push({
          id: text(move.id) || `play-${approved.length + 1}`,
          observedMove: text(observation.text || observation.label),
          responseText: approvedClaim.claimText,
          approvalState: "approved",
          fieldCitable: true,
          supportingEvidence: dedupeRecords([observation, ...responseEvidence, ...approvedClaim.supportingEvidence]),
        });
        return;
      }
      notCleared.push({
        id: text(move.id) || `play-${notCleared.length + 1}`,
        text: text(response.responseText) || text(observation.text) || "Competitor play wording unresolved.",
        source: "Competitor Plays",
        reason: !targetMatched
          ? `Buying-situation applicability to ${text(targetSegment) || "the selected segment"} is unresolved.`
          : !observationApproved
            ? "Observed move is not both approved and field-citable."
            : !approvedClaim
              ? "Response does not resolve to an approved Claim Control record."
              : normalizeApprovalState(response.approvalState) !== "approved"
                ? `Response approval state is ${normalizeApprovalState(response.approvalState)}.`
                : "Response lacks approved field-citable proof.",
        approvalState: normalizeApprovalState(response.approvalState),
        fieldCitable: responseEvidence.length > 0,
        internalOnly: true,
      });
    });
    return { approved, notCleared };
  }

  function leadVertical(applicationTrends = [], targetSegment = "") {
    const target = text(targetSegment);
    const scoped = applicationTrends.filter((trend) => !target || target === "All" || text(trend.marketSegment) === target);
    const candidates = scoped.length ? scoped : applicationTrends.filter((trend) => !target || target === "All");
    return [...candidates].sort((left, right) => {
      const ratioDifference = Number(right.signal?.ratio ?? right.growthRatio ?? 0) - Number(left.signal?.ratio ?? left.growthRatio ?? 0);
      if (ratioDifference) return ratioDifference;
      const countDifference = Number(right.selectedPeriodCount ?? right.count ?? 0) - Number(left.selectedPeriodCount ?? left.count ?? 0);
      if (countDifference) return countDifference;
      return text(left.theme).localeCompare(text(right.theme));
    })[0] || null;
  }

  function approvedClaimContent(claim, kind = "claim") {
    return {
      id: claim.id,
      kind,
      text: claim.claimText,
      approvalState: "approved",
      fieldCitable: true,
      supportingEvidence: claim.supportingEvidence,
    };
  }

  function assetModel(definition, { competitor, targetSegment, fieldContent = [], internalNotes = [], ready = false, context = {} }) {
    const fieldExportable = definition.audience === "field" && ready && fieldContent.length > 0;
    return {
      ...definition,
      assetId: `${stableSlug(competitor, "competitor")}-${stableSlug(targetSegment, "segment")}-${definition.id}`,
      competitor: text(competitor) || "Competitor unresolved",
      targetSegment: text(targetSegment) || "Target segment unresolved",
      context,
      fieldContent,
      internalNotes,
      fieldExportable,
      shipStatus: definition.audience === "internal" ? "internal-only" : fieldExportable ? "ready-to-ship" : "not-yet-cleared",
      approvalState: fieldExportable ? "approved" : "draft",
      fieldCitable: fieldExportable,
    };
  }

  function proofPriorityNotes(proofPriorities = {}) {
    return [
      ...(proofPriorities.top || []).map((priority) => ({ ...priority, queueLocation: "top-three" })),
      ...(proofPriorities.backlog || []).map((priority) => ({ ...priority, queueLocation: "backlog" })),
    ].map((priority) => ({
      id: text(priority.id) || `proof-${stableSlug(priority.claimText)}`,
      text: text(priority.claimText) || "Commercial claim wording gap.",
      missingStudyEvidence: text(priority.missingStudyEvidence) || "Missing study/evidence is unresolved.",
      sellerAsset: text(priority.sellerAsset) || "Seller asset unresolved.",
      queueLocation: priority.queueLocation,
      reason: "Unsupported claim gap; internal proof request only.",
      approvalState: normalizeApprovalState(priority.approvalState),
      fieldCitable: false,
      internalOnly: true,
    }));
  }

  function assembleSellerAssets({
    competitor = "",
    targetSegment = "",
    competitorPlays = [],
    comparatorClaims = [],
    registryClaims = [],
    applicationTrends = [],
    proofPriorities = {},
    horizon = "",
  } = {}) {
    const claims = collectClaims({ comparatorClaims, registryClaims, competitor, targetSegment });
    const plays = collectBattlecardPlays({ competitorPlays, competitor, targetSegment, approvedClaims: claims.approved });
    const vertical = leadVertical(applicationTrends, targetSegment);
    const proofNotes = proofPriorityNotes(proofPriorities);
    const claimContent = claims.approved.map((claim) => approvedClaimContent(claim));
    const battlecardContent = [
      ...plays.approved.map((play) => ({
        id: play.id,
        kind: "competitor-response",
        text: play.responseText,
        observedMove: play.observedMove,
        approvalState: "approved",
        fieldCitable: true,
        supportingEvidence: play.supportingEvidence,
      })),
      ...claimContent,
    ];
    const pitchContent = claims.approved.map((claim) => approvedClaimContent(claim, "pitch-claim"));
    const commonInternal = [...claims.notCleared, ...plays.notCleared];
    const assets = [
      assetModel(assetDefinitions[0], {
        competitor,
        targetSegment,
        fieldContent: battlecardContent,
        internalNotes: commonInternal,
        ready: plays.approved.length > 0 && claims.approved.length > 0,
      }),
      assetModel(assetDefinitions[1], {
        competitor,
        targetSegment,
        fieldContent: claimContent,
        internalNotes: claims.notCleared,
        ready: claims.approved.length > 0,
      }),
      assetModel(assetDefinitions[2], {
        competitor,
        targetSegment,
        fieldContent: pitchContent,
        internalNotes: [
          ...claims.notCleared,
          ...(!vertical ? [{
            id: "lead-vertical-gap",
            text: "Lead vertical unresolved.",
            reason: "No applicable Application Trends record is available for this target segment.",
            approvalState: "draft",
            fieldCitable: false,
            internalOnly: true,
          }] : []),
        ],
        ready: Boolean(vertical) && claims.approved.length > 0,
        context: vertical ? {
          leadVertical: text(vertical.marketSegment) || text(targetSegment),
          leadApplication: text(vertical.theme) || "Application trend unresolved",
          selectionBasis: `Highest Application Trends growth signal for ${text(targetSegment) || "the active target"}`,
          horizon: text(horizon),
          signal: vertical.signal || null,
          internalTargetingOnly: true,
        } : {},
      }),
      assetModel(assetDefinitions[3], {
        competitor,
        targetSegment,
        fieldContent: [],
        internalNotes: proofNotes,
        ready: false,
      }),
    ];
    return {
      competitor: text(competitor) || "Competitor unresolved",
      targetSegment: text(targetSegment) || "Target segment unresolved",
      leadVertical: vertical,
      approvedClaims: claims.approved,
      notClearedClaims: claims.notCleared,
      proofRequests: proofNotes,
      assets,
      shippableCount: assets.filter((asset) => asset.fieldExportable).length,
      notYetClearedCount: assets.filter((asset) => asset.shipStatus === "not-yet-cleared").length,
      internalOnlyCount: assets.filter((asset) => asset.shipStatus === "internal-only").length,
    };
  }

  function assertFieldSafeAsset(asset = {}) {
    if (asset.fieldExportable !== true || asset.approvalState !== "approved" || asset.fieldCitable !== true) return false;
    return (asset.fieldContent || []).length > 0 && asset.fieldContent.every((item) =>
      item.fieldCitable === true
      && normalizeApprovalState(item.approvalState) === "approved"
      && approvedEvidence(item.supportingEvidence || []).length > 0
    );
  }

  const api = {
    approvedEvidence,
    assembleSellerAssets,
    assertFieldSafeAsset,
    assetDefinitions,
    collectClaims,
    isApprovedCitableRecord,
    leadVertical,
    normalizeApprovalState,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.SellerAssetsTransformer = api;
})(typeof window !== "undefined" ? window : globalThis);

