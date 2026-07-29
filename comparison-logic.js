(function exposeComparisonLogic(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ComparisonLogic = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createComparisonLogic() {
  function yearOf(item) {
    return Number(item?.introducedYear || String(item?.date || "").slice(0, 4)) || null;
  }

  function technologyFamily(item) {
    const value = `${item?.technology || ""} ${item?.product || ""}`.toLowerCase();
    if (/software|informatics|data system|cds\b/.test(value)) return "Software";
    if (/ion chromatography|\bics\b|integrion|\bic\b/.test(value)) return "IC";
    if (/lc[- ]?ms|mass spect|\btof\b|quadrupole|orbitrap|qtrap/.test(value)) return "LC-MS";
    if (/uhplc|uplc|hplc|liquid chromat|\blc\b/.test(value)) return "LC";
    return "Other";
  }

  function pairRelationship(launch, waters) {
    const competitorFamily = technologyFamily(launch);
    const watersFamily = technologyFamily(waters);
    const competitorYear = yearOf(launch);
    const watersYear = yearOf(waters);
    const historical = Boolean(launch?.legacyReference)
      || (competitorYear && competitorYear < 2016)
      || (watersYear && watersYear < 2016);
    const direct = competitorFamily === watersFamily
      || ([competitorFamily, watersFamily].every((family) => ["LC", "IC"].includes(family)))
      || ([competitorFamily, watersFamily].every((family) => ["LC", "LC-MS"].includes(family)));
    const adjacent = !direct && (competitorFamily === "Software" || watersFamily === "Software" || [competitorFamily, watersFamily].includes("LC-MS"));
    return { competitorFamily, watersFamily, competitorYear, watersYear, historical, direct, adjacent };
  }

  function pairImpact(launch, waters) {
    const relationship = pairRelationship(launch, waters);
    if (relationship.historical) {
      return {
        value: "Historical benchmark",
        note: `${launch.product} and ${waters.product} form a lifecycle and method-migration reference pair. This supports portfolio-history analysis, not a claim about current buying pressure.`,
      };
    }
    if (relationship.direct) {
      return {
        value: "Direct competitive impact",
        note: `${launch.product} and ${waters.product} occupy overlapping ${relationship.competitorFamily} workflow roles. Validate the customer-visible difference under a shared application before changing requirements or positioning.`,
      };
    }
    if (relationship.adjacent) {
      return {
        value: "Adjacent workflow impact",
        note: `${launch.product} does not directly replace ${waters.product}, but it can influence the same connected workflow, software, or detector decision.`,
      };
    }
    return {
      value: "Portfolio-context impact",
      note: `${launch.product} and ${waters.product} serve different primary roles. Use this pair to test portfolio coverage and handoffs rather than to infer direct product substitution.`,
    };
  }

  function buildGeneratedPairComparison(launch, waters) {
    const relationship = pairRelationship(launch, waters);
    const impact = pairImpact(launch, waters);
    const competitorSource = launch.pressReleaseUrl || launch.sourceUrl || "Official competitor product record";
    const watersSource = waters.sourceUrl || "Official Waters product record";
    const competitorRole = `${relationship.competitorFamily}${relationship.competitorYear ? ` product introduced in ${relationship.competitorYear}` : " product"}`;
    const watersRole = `${relationship.watersFamily}${relationship.watersYear ? ` system introduced in ${relationship.watersYear}` : " system"}`;
    const strengths = (waters.strengths || []).slice(0, 2);
    const strengthText = strengths.length
      ? strengths.join("; ")
      : `the sourced capabilities and supported use cases of ${waters.product}`;

    return {
      generatedForPair: true,
      impactValue: impact.value,
      impactRationale: impact.note,
      pmRead: relationship.historical
        ? `Use ${launch.product} versus ${waters.product} to understand installed-base continuity, method migration, and lifecycle expectations. The official records establish portfolio history; they do not establish current product superiority.`
        : `${launch.product} is a ${competitorRole}; ${waters.product} is a ${watersRole}. The PM question is whether the competitor changes the same customer workflow, buying criterion, or handoff that Waters must defend.`,
      watersPositioning: `Position ${waters.product} using sourced, customer-visible proof for ${strengthText}. Do not claim superiority until both products are tested under the same method, configuration, and workflow conditions.`,
      evidenceBasis: `Pair result derived from the official competitor record (${competitorSource}) and official Waters record (${watersSource}). Product-family and lifecycle relevance are directional classifications; performance differences require comparable testing.`,
      dimensions: [
        {
          dimension: "Portfolio role",
          competitor: `${launch.product}: ${competitorRole}.`,
          waters: `${waters.product}: ${watersRole}.`,
          pmRead: impact.note,
        },
        {
          dimension: "Method and workflow transfer",
          competitor: "Public product history confirms the platform record; common-condition transfer performance is not inferred.",
          waters: "Public product history confirms the Waters platform record; common-condition transfer performance is not inferred.",
          pmRead: "Compare method setup, transfer adjustments, operator steps, troubleshooting, data handoffs, and acceptance criteria on the selected application.",
        },
        {
          dimension: "Decision use",
          competitor: relationship.historical ? "Historical portfolio and installed-base benchmark." : "Current or recent competitive workflow reference.",
          waters: relationship.historical ? "Historical or current Waters lifecycle reference." : "Selected Waters response platform.",
          pmRead: relationship.historical
            ? "Use this pair for migration and lifecycle planning, not a current win/loss claim."
            : "Use customer evidence and shared-method testing to decide whether the response is positioning, packaging, applications proof, or a product requirement.",
        },
      ],
      positioningMoves: [
        `Build a sourced ${launch.product} versus ${waters.product} comparison using the exact target workflow.`,
        `Translate ${waters.product} strengths into measurable customer outcomes rather than generic platform claims.`,
      ],
      validationQuestions: [
        `Do target customers consider ${launch.product} and ${waters.product} in the same purchase or method-transfer decision?`,
        "Which setup, performance, compliance, service, and software outcomes differ under a shared workflow?",
        "Does the evidence support a product requirement, an application asset, packaging, or positioning only?",
      ],
    };
  }

  function resolvePairComparison(launch, waters, curatedComparison) {
    if (curatedComparison?.closestWatersId === waters?.id) {
      return {
        ...curatedComparison,
        impactValue: curatedComparison.threatLevel ? `${curatedComparison.threatLevel} impact` : "Direct competitive impact",
      };
    }
    return buildGeneratedPairComparison(launch, waters);
  }

  function technicalDimensionsFor(launch, waters) {
    const families = [technologyFamily(launch), technologyFamily(waters)];
    if (families.includes("Software")) {
      return [
        "Method setup and template portability",
        "Instrument and data-system interoperability",
        "Audit trail and regulated-workflow support",
        "Diagnostics and operator guidance",
        "Data review and reporting throughput",
      ];
    }
    if (families.includes("LC-MS")) {
      return [
        "Sensitivity / LOQ on a shared method",
        "Polarity-switching speed",
        "Dwell allocation and points across peak at panel scale",
        "Cross-talk",
        "Linear dynamic range",
      ];
    }
    return [
      "System / gradient dwell (delay) volume",
      "Extra-column dispersion / band broadening",
      "Injection precision (%RSD)",
      "Carryover on a shared method",
      "Column plate efficiency (plates/m)",
      "Particle and bonding technology",
      "Column batch-to-batch reproducibility",
      "USP L-column class",
    ];
  }

  function buildGeneratedTechnicalProfile(launch, waters) {
    return {
      generatedForPair: true,
      watersProduct: waters.product,
      asOfDate: new Date().toISOString().slice(0, 10),
      comparisonBasis: `Published technical comparison for ${launch.product} versus ${waters.product}.`,
      rows: [],
      limitations: [
        "The technical table is shown only when published specifications are loaded for the selected pair.",
      ],
    };
  }

  return {
    buildGeneratedPairComparison,
    buildGeneratedTechnicalProfile,
    pairImpact,
    resolvePairComparison,
    technologyFamily,
  };
}));
