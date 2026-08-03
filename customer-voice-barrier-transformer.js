(function exposeCustomerVoiceBarrierTransformer(root) {
  "use strict";

  const featureRequestPattern = /\b(?:feature request|please add|should add|wish (?:it|this|the)|would like (?:a|an|the|to)|needs? (?:a|an|the) (?:new )?feature|no display|can't perform as many test|cannot perform as many test)\b/i;
  const boilerplatePattern = /advertisement|register log in|sign in \| register|notifications settings|equipment view all|skip to content/i;
  const barrierSignalPattern = /adopt|barrier|breakdown|burden|can't|cannot|carryover|challenge|compatib|complex|concern|cost|couldn't|could not|delayed|difficult|downtime|environmental change|expensive|failure|figure out|forced|friction|hard to|inconsistent|issue|legacy|leak|lock[- ]in|maintenance problem|manual|not as smooth|overpriced|pain|pressure|problem|reliance|risk|sensitive|service-only|slow|split software|switch|training burden|troubleshoot|unable|unreliable|uptime|validation burden|workaround/i;

  const barrierTypes = Object.freeze([
    {
      key: "method-migration",
      label: "Method continuity and migration risk",
      match: /compatib|known method|legacy|method continuity|method transfer|migrat|revalidat|validation burden/i,
      tactic: "Run a governed method-migration pilot with an agreed incumbent baseline, equivalency criteria, validation scope, and go/no-go milestone.",
      valueAssumption: "A governed method-migration pilot reduces switching risk and validation effort for the target laboratory.",
      validationStudy: "Measure migration effort, revalidation effort, exceptions, time to accepted equivalency, and buyer confidence against the incumbent method in target laboratories.",
    },
    {
      key: "training-onboarding",
      label: "Training and initial operating complexity",
      match: /figure out|hard to learn|learning (?:curve|burden)|local expert|novice|setup (?:confusion|complexity|friction|issue)|training|user complexity|workflow friction/i,
      tactic: "Deliver role-based onboarding and a task-based workflow rehearsal before cutover, with explicit proficiency and recovery criteria.",
      valueAssumption: "Role-based onboarding reduces time to proficiency and avoidable operating errors during adoption.",
      validationStudy: "Run a role-based usability study measuring training hours, task completion, error recovery, assistance required, and time to independent operation.",
    },
    {
      key: "economic-value",
      label: "Price and total-cost concern",
      match: /afford|consumable|\bcost\b|economic|expensive|forced to buy|overpriced|price|value for money/i,
      tactic: "Use a transparent, baseline-specific total-cost and proof-of-value review; keep price, consumables, service, labor, and implementation assumptions explicit.",
      valueAssumption: "A transparent total-cost review can overcome price concern without relying on an unsubstantiated savings claim.",
      validationStudy: "Validate acquisition, consumables, service, labor, downtime, implementation, utilization, currency, and analysis-horizon inputs with target customers and completed deals.",
    },
    {
      key: "service-readiness",
      label: "Service, maintenance, and downtime exposure",
      match: /breakdown|downtime|maintenance|parts|repair|service|serviceability|uptime/i,
      tactic: "Define a service-readiness and risk-reversal plan with response terms, escalation paths, maintenance scope, and attributable uptime evidence.",
      valueAssumption: "A documented service-readiness and risk-reversal plan reduces perceived downtime and continuity risk.",
      validationStudy: "Validate response time, resolution time, maintenance burden, downtime avoided, escalation effectiveness, and renewal or purchase impact with target accounts.",
    },
    {
      key: "software-integration",
      label: "Software, connectivity, and data-handoff friction",
      match: /connection|connectivity|data export|data file|data handoff|downstream analysis|informat|integration|not as smooth|software/i,
      tactic: "Run a controlled integration and data-handoff evaluation in the customer's actual software and review workflow before commitment.",
      valueAssumption: "A controlled integration evaluation reduces implementation risk and data-handoff effort during adoption.",
      validationStudy: "Measure configuration effort, successful handoffs, review time, error recovery, manual workarounds, and implementation confidence in the customer's target environment.",
    },
    {
      key: "operational-risk",
      label: "Reliability and troubleshooting burden",
      match: /carryover|environmental change|failure|leak|pressure|repeat diagnostic|root cause|sensitive for every|troubleshoot|unreliable|reliability (?:concern|issue|problem|risk)/i,
      tactic: "Use a controlled workflow evaluation with failure-recovery criteria and an agreed service escalation plan before field commitment.",
      valueAssumption: "A controlled recovery evaluation reduces perceived operational risk and time lost to troubleshooting.",
      validationStudy: "Measure failure frequency, diagnosis time, recovery time, assistance required, repeat work, and buyer confidence under a governed customer protocol.",
    },
    {
      key: "adoption-risk",
      label: "Unresolved adoption risk",
      match: barrierSignalPattern,
      tactic: "Offer a governed evaluation with a named baseline, customer-owned protocol, acceptance criteria, evidence owner, and decision milestone.",
      valueAssumption: "A governed proof-of-value evaluation reduces uncertainty enough to support an adoption decision.",
      validationStudy: "Record pre/post decision confidence, acceptance-criterion attainment, unresolved objections, time to decision, and the customer's stated adoption outcome.",
    },
  ]);

  function text(value) {
    return String(value || "").trim();
  }

  function stableSlug(value, fallback = "barrier") {
    return text(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || fallback;
  }

  function splitSentences(value) {
    return text(value).split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
  }

  function usableCustomerLanguage(record = {}) {
    const language = text(record.customerLanguageSignal);
    if (!language) return false;
    return !(language.length > 360 && boilerplatePattern.test(language));
  }

  function isCustomerVoiceSource(record = {}) {
    const sourceTypes = (record.evidenceRecords || []).map((source) => text(source.sourceType || source.recordType));
    if (sourceTypes.length && sourceTypes.every((sourceType) => /regulatory|filing|patent|scientific publication/i.test(sourceType))) return false;
    return !/inspection finding|regulator/i.test(text(record.userRole));
  }

  function barrierTypeFor(record = {}) {
    if (!usableCustomerLanguage(record)) return null;
    const value = record.languageType === "verbatim_quote"
      ? splitSentences(record.customerLanguageSignal).filter((sentence) => !featureRequestPattern.test(sentence)).join(" ")
      : text(record.customerLanguageSignal);
    if (!barrierSignalPattern.test(value)) return null;
    const specificTypes = barrierTypes.slice(0, -1);
    return specificTypes.find((type) => type.match.test(value))
      || barrierTypes.at(-1);
  }

  function verbatimBarrierPhrasing(record = {}, type) {
    if (record.languageType !== "verbatim_quote" || !usableCustomerLanguage(record)) return "";
    const eligible = splitSentences(record.customerLanguageSignal)
      .filter((sentence) => !featureRequestPattern.test(sentence));
    const typeMatches = eligible.filter((sentence) => type.match.test(sentence));
    if (typeMatches.length) return typeMatches.join(" ");
    return eligible.filter((sentence) => barrierSignalPattern.test(sentence)).join(" ");
  }

  function paraphrasedBarrierPhrasing(record = {}, type) {
    if (record.languageType === "verbatim_quote") return "";
    const language = usableCustomerLanguage(record) ? text(record.customerLanguageSignal) : "";
    const candidate = language && (type.match.test(language) || barrierSignalPattern.test(language)) ? language : "";
    return featureRequestPattern.test(candidate) ? "" : candidate;
  }

  function exactSourceRecords(record = {}) {
    const sources = [];
    const seen = new Set();
    const add = (source = {}) => {
      const url = text(source.url || source.sourceUrl || source.primarySourceUrl);
      if (!/^https?:\/\//i.test(url) || seen.has(url)) return;
      seen.add(url);
      sources.push({
        id: source.id || `${record.id || "customer-voice"}-source-${sources.length + 1}`,
        label: source.label || source.title || `${record.company || "Customer Voice"}: ${record.product || record.theme || "barrier source"}`,
        sourceName: source.sourceName || record.sourceName || "Public customer source",
        url,
        date: source.sourceDate || source.date || record.sourceDate || record.dateCaptured || "",
        fieldCitable: record.fieldCitable === true && source.fieldCitable !== false,
        approvalState: source.approvalState || record.approvalState || "draft",
      });
    };
    (record.evidenceRecords || []).forEach(add);
    add({
      label: `${record.company || "Customer Voice"}: ${record.product || record.theme || "barrier source"}`,
      sourceName: record.sourceName,
      url: record.primarySourceUrl || record.sourceUrl,
      sourceDate: record.sourceDate || record.dateCaptured,
    });
    return sources;
  }

  function customerValidatedValue(record = {}) {
    const statement = text(record.validatedValueStatement || record.customerValidatedValueStatement || record.valueOutcome);
    const validated = record.customerValidatedValue === true || record.valueValidation?.status === "proven";
    const sources = exactSourceRecords(record).filter((source) => source.fieldCitable === true && source.approvalState !== "blocked");
    if (!validated || !statement || !sources.length) return {
      status: "not-established",
      statement: "No customer-validated outcome for this tactic is linked to the barrier record.",
      supportingEvidence: [],
    };
    return { status: "proven", statement, supportingEvidence: sources };
  }

  function valueGap(type, record) {
    const id = `cv-barrier-gap-${type.key}-${stableSlug(record.id || record.customerLanguageSignal)}`;
    return {
      id,
      source: "Customer Voice barrier",
      sourceRecordId: record.id || "",
      claimText: type.valueAssumption,
      studyRequiredBeforeFieldUse: type.validationStudy,
      missingStudyEvidence: type.validationStudy,
      sellerAsset: "Customer-Proof Request Brief",
      customerVoiceTerms: [type.key, type.label, record.category, record.theme, record.customerLanguageSignal],
      dimension: type.label,
      buyingCriterion: record.buyingPriority || "",
      affectedCapability: "PMM adoption evidence",
      dealImpact: null,
      status: "gap",
      fieldCitable: false,
      fieldUsable: false,
      approvalState: "draft",
    };
  }

  function transformBarrier(record, index) {
    const type = barrierTypeFor(record);
    if (!type) return null;
    const quoted = verbatimBarrierPhrasing(record, type);
    const paraphrased = quoted ? "" : paraphrasedBarrierPhrasing(record, type);
    const barrierText = quoted || paraphrased;
    if (!barrierText) return null;
    const provenValue = customerValidatedValue(record);
    const gap = provenValue.status === "proven" ? null : valueGap(type, record);
    return {
      id: `cv-barrier-${stableSlug(record.id, String(index + 1))}`,
      sourceRecordId: record.id || "",
      company: record.company || "Company unresolved",
      product: record.product || "Product unresolved",
      segment: record.labType || "Segment unresolved",
      buyerRole: record.userRole || "Buyer role unresolved",
      buyingPriority: record.buyingPriority || "Buying priority unresolved",
      sentiment: record.sentiment || "Sentiment unresolved",
      barrierType: type.key,
      barrierLabel: type.label,
      barrierText,
      languageMode: quoted ? "verbatim" : "paraphrase",
      languageLabel: quoted ? "Verbatim customer phrasing" : "Analyst paraphrase — not a customer quote",
      tactic: type.tactic,
      provenValue,
      assumedValue: gap ? {
        status: "assumed",
        statement: type.valueAssumption,
        customerValidated: false,
        validationGapId: gap.id,
        validationStudy: type.validationStudy,
      } : {
        status: "none",
        statement: "No unvalidated value assumption remains for this tactic.",
        customerValidated: true,
        validationGapId: "",
        validationStudy: "",
      },
      sources: exactSourceRecords(record),
      fieldCitable: record.fieldCitable === true,
      approvalState: record.approvalState || "draft",
      gap,
    };
  }

  function transformCustomerVoiceBarriers({ records = [] } = {}) {
    let excludedFeatureRequestCount = 0;
    const barriers = records.flatMap((record, index) => {
      const signal = text(record.customerLanguageSignal);
      if (!isCustomerVoiceSource(record)) return [];
      if (featureRequestPattern.test(signal) && record.languageType !== "verbatim_quote") {
        excludedFeatureRequestCount += 1;
        return [];
      }
      if (!["Negative", "Mixed"].includes(record.sentiment)) return [];
      const barrier = transformBarrier(record, index);
      if (!barrier && featureRequestPattern.test(signal)) excludedFeatureRequestCount += 1;
      return barrier ? [barrier] : [];
    }).sort((left, right) => Number(right.languageMode === "verbatim") - Number(left.languageMode === "verbatim")
      || Number(right.fieldCitable) - Number(left.fieldCitable)
      || left.id.localeCompare(right.id));
    const valueAssumptionGapQueue = barriers.map((barrier) => barrier.gap).filter(Boolean);
    return {
      barriers,
      valueAssumptionGapQueue,
      quotedCount: barriers.filter((barrier) => barrier.languageMode === "verbatim").length,
      paraphrasedCount: barriers.filter((barrier) => barrier.languageMode === "paraphrase").length,
      provenValueCount: barriers.filter((barrier) => barrier.provenValue.status === "proven").length,
      assumedValueCount: valueAssumptionGapQueue.length,
      excludedFeatureRequestCount,
    };
  }

  function linkBarriersToProofPriorities(transformation, proofPriorities = {}) {
    const priorities = [
      ...(proofPriorities.top || []).map((priority) => ({ ...priority, queueLocation: "top" })),
      ...(proofPriorities.backlog || []).map((priority) => ({ ...priority, queueLocation: "backlog" })),
    ];
    const barriers = transformation.barriers.map((barrier) => {
      if (!barrier.assumedValue.validationGapId) return barrier;
      const priority = priorities.find((item) => (item.sourceIds || []).includes(barrier.assumedValue.validationGapId));
      return {
        ...barrier,
        assumedValue: {
          ...barrier.assumedValue,
          proofPriority: priority ? {
            id: priority.id,
            claimText: priority.claimText,
            missingStudyEvidence: priority.missingStudyEvidence,
            queueLocation: priority.queueLocation,
            href: `#pmm-proof-priority-${stableSlug(priority.id, "validation-gap")}`,
          } : {
            id: "",
            claimText: barrier.assumedValue.statement,
            missingStudyEvidence: barrier.assumedValue.validationStudy,
            queueLocation: "unmapped",
            href: "#pmm-positioning-decisions",
          },
        },
      };
    });
    return { ...transformation, barriers };
  }

  const api = {
    barrierTypeFor,
    featureRequestPattern,
    isCustomerVoiceSource,
    linkBarriersToProofPriorities,
    transformCustomerVoiceBarriers,
    verbatimBarrierPhrasing,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CustomerVoiceBarrierTransformer = api;
})(typeof window !== "undefined" ? window : globalThis);
