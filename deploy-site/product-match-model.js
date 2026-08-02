(function exposeHeadToHeadProductMatchModel(root) {
  "use strict";

  function clean(value) {
    return String(value || "").trim();
  }

  function normalize(value) {
    return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function techniqueClass(value) {
    const text = normalize(value);
    if (/lc ms ms|triple quadrupole|tandem quadrupole/.test(text)) return "LC-MS/MS";
    if (/lc ms|tof|qtof|orbitrap|mass spect/.test(text)) return "LC-MS";
    if (/uhplc|uplc|ultra high/.test(text)) return "UHPLC";
    if (/hplc|liquid chromatography|\blc\b/.test(` ${text} `)) return "HPLC/LC";
    if (/software|cds|informatics|data system/.test(text)) return "Software/CDS";
    if (/\bms\b/.test(` ${text} `)) return "MS";
    return "Unresolved";
  }

  function positioningTier(product = {}) {
    const text = normalize([product.decisionRole, product.product, ...(product.bestFor || []), ...(product.strengths || [])].join(" "));
    if (/premium|high performance|high resolution|advanced|demanding/.test(text)) return "Premium / advanced";
    if (/routine|value|legacy|modernization|quality control|qc/.test(text)) return "Routine / value";
    if (/research|discovery|omics|characterization/.test(text)) return "Research / specialist";
    return "Tier unresolved";
  }

  function segmentTokens(product = {}) {
    const text = normalize([product.marketSegment, ...(product.marketSegments || []), ...(product.bestFor || []), product.decisionRole].join(" "));
    const definitions = [
      ["Pharma", /pharma|regulated|quality control|\bqc\b/],
      ["Biopharma", /biopharma|biotherapeutic|protein|mam/],
      ["Clinical", /clinical|bioanalysis/],
      ["Environmental", /environmental|pfas|water testing/],
      ["Food safety", /food|pesticide/],
      ["Research", /research|discovery|omics|characterization/],
      ["Routine LC", /routine|legacy|method transfer|modernization/],
    ];
    return definitions.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
  }

  function pressureRange(product = {}) {
    const value = Number(product.maxPressureBar || product.pressureRangeBar || product.maxPressure);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  function techniqueScore(watersClass, competitorClass) {
    if (watersClass === competitorClass && watersClass !== "Unresolved") return 42;
    const lc = new Set(["UHPLC", "HPLC/LC"]);
    if (lc.has(watersClass) && lc.has(competitorClass)) return 28;
    const ms = new Set(["LC-MS", "LC-MS/MS", "MS"]);
    if (ms.has(watersClass) && ms.has(competitorClass)) return 24;
    return 0;
  }

  function productRows(data = {}) {
    const launchRows = (data.launches || []).map((product) => ({ ...product, company: product.competitor, catalogType: "Dated launch" }));
    const historicalRows = (data.historicalProducts || []).map((product) => ({ ...product, company: product.competitor, date: product.introducedYear ? `${product.introducedYear}-01-01` : "", catalogType: "Historical product" }));
    const comparatorRows = (data.thirdComparators || []).map((product) => ({ ...product, competitor: product.company, catalogType: "Comparator catalog" }));
    const preferred = [...launchRows, ...historicalRows, ...comparatorRows];
    const seen = new Set();
    return preferred.filter((product) => {
      if (!product.id || !product.product || !product.competitor) return false;
      const key = `${normalize(product.competitor)}::${normalize(product.product).replace(/\b(?:series|system|platform|stack)\b/g, "").trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function similarityBasis(waters, competitor, explicitClosest) {
    const watersTechnique = techniqueClass(`${waters.technology} ${waters.product}`);
    const competitorTechnique = techniqueClass(`${competitor.technology} ${competitor.product}`);
    const watersSegments = segmentTokens(waters);
    const competitorSegments = segmentTokens(competitor);
    const segmentOverlap = watersSegments.filter((segment) => competitorSegments.includes(segment));
    const watersTier = positioningTier(waters);
    const competitorTier = positioningTier(competitor);
    const watersPressure = pressureRange(waters);
    const competitorPressure = pressureRange(competitor);
    const pressureDifference = watersPressure && competitorPressure
      ? Math.abs(watersPressure - competitorPressure) / Math.max(watersPressure, competitorPressure)
      : null;
    const technique = techniqueScore(watersTechnique, competitorTechnique);
    const segment = segmentOverlap.length ? Math.min(21, 9 + segmentOverlap.length * 4) : 0;
    const tier = watersTier !== "Tier unresolved" && watersTier === competitorTier ? 12 : 0;
    const pressure = pressureDifference == null ? 0 : pressureDifference <= 0.15 ? 10 : pressureDifference <= 0.35 ? 6 : 0;
    const explicit = explicitClosest ? 15 : 0;
    return {
      score: Math.min(100, technique + segment + tier + pressure + explicit),
      techniqueClass: { waters: watersTechnique, competitor: competitorTechnique, status: watersTechnique === competitorTechnique ? "Match" : "Different" },
      pressureRange: watersPressure && competitorPressure
        ? { waters: `${watersPressure} bar`, competitor: `${competitorPressure} bar`, status: pressureDifference <= 0.15 ? "Comparable" : "Different" }
        : { waters: watersPressure ? `${watersPressure} bar` : "Not established", competitor: competitorPressure ? `${competitorPressure} bar` : "Not established", status: "Unresolved — catalog lacks comparable pressure data" },
      segment: { waters: watersSegments, competitor: competitorSegments, overlap: segmentOverlap, status: segmentOverlap.length ? "Overlap" : "No coded overlap" },
      positioningTier: { waters: watersTier, competitor: competitorTier, status: watersTier === competitorTier ? "Match" : "Different", classification: "Rule-based inference" },
      explicitClosestMapping: explicitClosest,
      method: "Deterministic catalog fit: technique class + available pressure data + coded segment overlap + rule-based positioning tier + existing closest-comparator mapping.",
    };
  }

  function build(data = {}) {
    const watersProducts = (data.watersSystems || []).filter((product) => product.id && product.product);
    const competitors = productRows(data);
    const explicit = new Map((data.launchComparisons || []).map((row) => [row.launchId, row.closestWatersId]));
    const matches = watersProducts.flatMap((waters) => competitors.map((competitor) => {
      const basis = similarityBasis(waters, competitor, explicit.get(competitor.id) === waters.id);
      return {
        id: `${waters.id}::${competitor.id}`,
        watersProductId: waters.id,
        competitor: competitor.competitor,
        competitorProductId: competitor.id,
        competitorProduct: competitor.product,
        score: basis.score,
        similarityBasis: basis,
        source: {
          watersUrl: waters.sourceUrl || "",
          watersDate: waters.introducedYear ? `${waters.introducedYear}-01-01` : "",
          competitorUrl: competitor.pressReleaseUrl || competitor.sourceUrl || "",
          competitorDate: competitor.date || (competitor.introducedYear ? `${competitor.introducedYear}-01-01` : ""),
        },
        competitorIntroducedYear: Number(competitor.introducedYear || String(competitor.date || "").slice(0, 4)) || null,
        catalogType: competitor.catalogType,
      };
    }));
    return { watersProducts, competitorProducts: competitors, matches };
  }

  function candidates(model, watersProductId, competitor) {
    return (model?.matches || [])
      .filter((row) => row.watersProductId === watersProductId && row.competitor === competitor)
      .sort((left, right) => right.score - left.score
        || Number(right.similarityBasis.explicitClosestMapping) - Number(left.similarityBasis.explicitClosestMapping)
        || Number(right.competitorIntroducedYear || 0) - Number(left.competitorIntroducedYear || 0)
        || left.competitorProduct.localeCompare(right.competitorProduct));
  }

  function closest(model, watersProductId, competitor) {
    return candidates(model, watersProductId, competitor)[0] || null;
  }

  function portfolioPairs(model, competitor) {
    return (model?.watersProducts || []).map((watersProduct) => ({
      watersProduct,
      match: closest(model, watersProduct.id, competitor),
    })).filter((pair) => pair.match);
  }

  function availableCompetitors(model, watersProductId) {
    if (!watersProductId || watersProductId === "All") return [];
    return [...new Set((model?.matches || [])
      .filter((row) => row.watersProductId === watersProductId)
      .map((row) => row.competitor)
      .filter(Boolean))];
  }

  function normalizeCompetitorFilter(model, watersProductId, selectedCompetitor = "All") {
    if (!selectedCompetitor || selectedCompetitor === "All") return "All";
    return availableCompetitors(model, watersProductId).includes(selectedCompetitor)
      ? selectedCompetitor
      : "All";
  }

  const api = { availableCompetitors, build, candidates, closest, normalize, normalizeCompetitorFilter, portfolioPairs, positioningTier, productRows, segmentTokens, similarityBasis, techniqueClass };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.HeadToHeadProductMatchModel = api;
})(typeof window !== "undefined" ? window : globalThis);
