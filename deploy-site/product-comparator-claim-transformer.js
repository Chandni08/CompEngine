(function exposeProductComparatorClaimTransformer(root) {
  "use strict";

  const validApprovalStates = Object.freeze(["draft", "in-review", "approved", "blocked"]);
  const favorableTerms = /\b(?:advantage|better|faster|greater|higher|improved|lead|lower|reduced|smaller|stronger|tighter|wider)\b/i;
  const comparisonLimitations = /\b(?:aligned|cannot|conditions differ|different conditions|do not|does not|gap|not (?:a |an )?(?:advantage|demonstrated|established|useful)|proof required|requires? controlled|should|substantially overlap|unresolved|validate)\b/i;
  const actionLanguage = /^(?:defend|lead with|needs?|position|show|use|validate)\b/i;

  function normalizeApprovalState(value) {
    return validApprovalStates.includes(value) ? value : "draft";
  }

  function isHttpUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  function recordUrl(record = {}) {
    return [record.url, record.sourceUrl, record.primarySourceUrl, record.competitorSourceUrl, record.watersSourceUrl]
      .find(isHttpUrl) || "";
  }

  function evidenceKey(record = {}) {
    return record.id || record.evidenceId || recordUrl(record) || `${record.sourceName || ""}|${record.label || record.title || ""}`;
  }

  function dedupeEvidence(records = []) {
    const seen = new Set();
    return records.filter((record) => {
      const key = evidenceKey(record);
      return key && !seen.has(key) && seen.add(key);
    });
  }

  function sentenceList(value) {
    return String(value || "").trim().split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
  }

  function watersSubjectPattern(watersProduct = "") {
    const productLead = String(watersProduct || "").split(/\s+(?:system|with)\b/i)[0].trim();
    const escaped = productLead.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b(?:Waters${escaped ? `|${escaped}` : ""})\\b`, "i");
  }

  function explicitTechnicalAdvantage(sentence, watersProduct) {
    if (!sentence || comparisonLimitations.test(sentence)) return false;
    const subject = watersSubjectPattern(watersProduct);
    if (!subject.test(sentence) || !favorableTerms.test(sentence)) return false;
    const subjectThenAdvantage = new RegExp(`${subject.source}.{0,140}${favorableTerms.source}`, "i");
    return subjectThenAdvantage.test(sentence);
  }

  function explicitCuratedAdvantage(text, record = {}) {
    const wording = String(text || "").trim();
    if (!wording || actionLanguage.test(wording) || comparisonLimitations.test(wording)) return false;
    if (record.isAdvantage === true || record.advantage === true) return true;
    return /\bsourced differentiation\b/i.test(wording)
      || (/\bWaters\b|\bACQUITY\b|\bAlliance\b|\bXevo\b|\bBioAccord\b|\bSELECT SERIES\b|\bEmpower\b/i.test(wording)
        && favorableTerms.test(wording));
  }

  function explicitAdvantageEntries(comparison = {}) {
    return [comparison.advantages, comparison.watersAdvantages]
      .flatMap((value) => Array.isArray(value) ? value : [])
      .map((value, index) => typeof value === "string"
        ? { record: { claimText: value }, claimText: value, dimension: `Explicit advantage ${index + 1}` }
        : {
          record: value,
          claimText: value.claimText || value.exactWording || value.wording || value.text || "",
          dimension: value.dimension || `Explicit advantage ${index + 1}`,
        })
      .filter((entry) => entry.claimText);
  }

  function collectAdvantages({ productComparisons = {}, technicalComparisons = {}, productLaunches = [], eligibleLaunchIds = null, watersProductId = "All" } = {}) {
    const launchById = new Map(productLaunches.map((launch) => [launch.id, launch]));
    const watersById = new Map((productComparisons.watersSystems || []).map((product) => [product.id, product]));
    const profileByPair = new Map((technicalComparisons.profiles || []).map((profile) => [`${profile.launchId}|${profile.watersId || ""}`, profile]));
    const advantages = [];

    (productComparisons.launchComparisons || []).forEach((comparison) => {
      if (eligibleLaunchIds && !eligibleLaunchIds.has(comparison.launchId)) return;
      if (watersProductId !== "All" && comparison.closestWatersId !== watersProductId) return;
      const launch = launchById.get(comparison.launchId) || { id: comparison.launchId, competitor: "Competitor unresolved", product: "Competitor product unresolved" };
      const waters = watersById.get(comparison.closestWatersId) || { id: comparison.closestWatersId, product: "Waters product unresolved" };
      const base = {
        launchId: comparison.launchId,
        watersId: comparison.closestWatersId,
        competitor: launch.competitor || "Competitor unresolved",
        competitorProduct: launch.product || "Competitor product unresolved",
        watersProduct: waters.product || "Waters product unresolved",
      };

      explicitAdvantageEntries(comparison).forEach((entry) => advantages.push({ ...base, ...entry, advantageType: entry.record.advantageType || "positioning" }));

      (waters.strengths || []).filter(Boolean).forEach((strength, index) => advantages.push({
        ...base,
        advantageType: "product-strength",
        claimText: String(strength).trim(),
        dimension: `Waters comparator strength ${index + 1}`,
        record: waters,
      }));

      (comparison.dimensions || []).forEach((dimension) => {
        if (!explicitCuratedAdvantage(dimension.waters, dimension)) return;
        advantages.push({
          ...base,
          advantageType: dimension.advantageType || "positioning",
          claimText: String(dimension.waters).trim(),
          dimension: dimension.dimension || "Comparator advantage",
          record: dimension,
        });
      });

      const profile = profileByPair.get(`${comparison.launchId}|${comparison.closestWatersId}`)
        || (technicalComparisons.profiles || []).find((item) => item.launchId === comparison.launchId);
      (profile?.rows || []).forEach((row) => {
        sentenceList(row.interpretation).filter((sentence) => explicitTechnicalAdvantage(sentence, profile.watersProduct || waters.product)).forEach((sentence) => {
          advantages.push({
            ...base,
            advantageType: "spec",
            claimText: sentence,
            dimension: row.dimension || "Technical specification",
            record: row,
            profile,
          });
        });
      });
    });

    const seen = new Set();
    return advantages.filter((advantage) => {
      const key = `${advantage.launchId}|${advantage.watersId}|${advantage.dimension}|${advantage.claimText}`;
      return !seen.has(key) && seen.add(key);
    });
  }

  function claimCandidateId(advantage, index) {
    const slug = `${advantage.launchId}-${advantage.watersId}-${advantage.dimension}`
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return `pc-claim-${slug || index + 1}`;
  }

  function claimReferences(record = {}) {
    return [record.supportsClaimId, record.claimCandidateId, record.claimId, record.supportedClaimId]
      .flatMap((value) => Array.isArray(value) ? value : [value])
      .concat(record.supportsClaimIds || [], record.claimIds || [], record.supportedClaimIds || [])
      .filter(Boolean);
  }

  function recordBacksClaim(record, candidateId, claimText) {
    return claimReferences(record).includes(candidateId)
      || [record.supportsClaimText, record.claimText, record.exactClaimWording].some((value) => String(value || "").trim() === claimText);
  }

  function normalizeEvidence(record = {}, fallback = {}) {
    return {
      ...record,
      id: record.id || fallback.id || "",
      label: record.label || record.title || fallback.label || "Evidence record",
      sourceName: record.sourceName || record.publisher || fallback.sourceName || "Source unresolved",
      url: recordUrl(record) || fallback.url || "",
      fieldCitable: record.fieldCitable === true,
      approvalState: normalizeApprovalState(record.approvalState),
    };
  }

  function singleSidedSpecEvidence(advantage, deriveFieldCitable) {
    if (advantage.advantageType !== "spec") return [];
    const row = advantage.record || {};
    const sources = [
      {
        id: `${advantage.launchId}-${advantage.dimension}-competitor-source`,
        label: `${advantage.competitorProduct}: ${advantage.dimension}`,
        sourceName: advantage.competitor,
        sourceType: "Competitor primary source",
        sourceUrl: row.competitorSourceUrl,
        evidenceStatus: row.evidenceStatus || row.evidenceType,
        approvalState: row.approvalState,
        blockedReason: "A competitor source alone does not substantiate a relative Waters advantage.",
      },
      {
        id: `${advantage.launchId}-${advantage.dimension}-waters-source`,
        label: `${advantage.watersProduct}: ${advantage.dimension}`,
        sourceName: "Waters",
        sourceType: "Waters primary source",
        sourceUrl: row.watersSourceUrl,
        evidenceStatus: row.evidenceStatus || row.evidenceType,
        approvalState: row.approvalState,
        blockedReason: "Waters-only material is not field-citable.",
      },
    ].filter((record) => isHttpUrl(record.sourceUrl));
    return sources.map((record) => normalizeEvidence({
      ...record,
      fieldCitable: typeof deriveFieldCitable === "function" ? deriveFieldCitable(record) : false,
    }));
  }

  function studyRequirement(advantage, status, approvalState) {
    if (approvalState === "blocked") return "Resolve the blocked approval state before field use.";
    if (status === "supported") return "No study gap identified — field-citable proof backs this exact wording.";
    if (advantage.advantageType === "spec") return `Run a controlled common-condition study comparing ${advantage.watersProduct} with ${advantage.competitorProduct} on ${advantage.dimension} before field use.`;
    return "Add a field-citable external record that supports this exact wording before field use.";
  }

  function buildCandidate(advantage, index, evidencePool, deriveFieldCitable) {
    const id = claimCandidateId(advantage, index);
    const embedded = [advantage.record, ...(advantage.record?.supportingEvidence || []), ...(advantage.record?.evidenceRecords || [])]
      .filter(Boolean)
      .map((record) => normalizeEvidence(record, { label: advantage.dimension }));
    const linked = evidencePool.filter((record) => recordBacksClaim(record, id, advantage.claimText)).map((record) => normalizeEvidence(record));
    const directEvidence = dedupeEvidence([...embedded, ...linked]);
    const supportingEvidence = directEvidence.filter((record) => record.fieldCitable === true);
    const blockedEvidence = dedupeEvidence([
      ...directEvidence.filter((record) => !supportingEvidence.includes(record)).map((record) => ({
        ...record,
        blockedReason: record.blockedReason || (record.approvalState === "blocked"
          ? "Evidence approval state is blocked."
          : "Record is not field-citable under the evidence governance gate."),
      })),
      ...singleSidedSpecEvidence(advantage, deriveFieldCitable),
    ]);
    const approvalState = normalizeApprovalState(advantage.record?.approvalState);
    const status = supportingEvidence.length >= 1 ? "supported" : "gap";
    const claimEligible = status === "supported" && approvalState !== "blocked";
    return {
      id,
      source: "Product Comparator",
      advantageType: advantage.advantageType,
      competitor: advantage.competitor,
      competitorProduct: advantage.competitorProduct,
      watersProduct: advantage.watersProduct,
      dimension: advantage.dimension,
      claimText: advantage.claimText,
      supportingEvidence,
      blockedEvidence,
      approvalState,
      status,
      fieldCitable: status === "supported",
      claimEligible,
      fieldUsable: claimEligible,
      studyRequiredBeforeFieldUse: studyRequirement(advantage, status, approvalState),
    };
  }

  function transformProductComparatorClaims(options = {}) {
    const advantages = collectAdvantages(options);
    const evidencePool = (options.evidencePool || []).filter((record) => record && typeof record === "object");
    const candidates = advantages.map((advantage, index) => buildCandidate(advantage, index, evidencePool, options.deriveFieldCitable));
    const claimControlClaims = candidates.filter((candidate) => candidate.status === "supported" && candidate.approvalState !== "blocked");
    const gapQueue = candidates.filter((candidate) => candidate.status === "gap" || candidate.approvalState === "blocked").map((candidate) => ({
      ...candidate,
      queue: "gapQueue",
      consumer: "Prompt 3",
      queueReason: candidate.status === "gap" ? "citable-proof-gap" : "approval-blocked",
      fieldUsable: false,
    }));
    return { advantages, candidates, claimControlClaims, gapQueue };
  }

  const api = {
    collectAdvantages,
    explicitCuratedAdvantage,
    explicitTechnicalAdvantage,
    normalizeApprovalState,
    recordBacksClaim,
    transformProductComparatorClaims,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.ProductComparatorClaimTransformer = api;
})(typeof window !== "undefined" ? window : globalThis);

