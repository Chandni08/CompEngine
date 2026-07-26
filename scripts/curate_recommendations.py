#!/usr/bin/env python3
"""Keep the recommendation queue limited to evidence-backed decision artifacts."""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INTELLIGENCE_FILE = ROOT / "data" / "intelligence.json"
BOILERPLATE_PREFIX = "Review whether Waters positioning, application notes, and roadmap coverage address this "


RECOMMENDATIONS = [
    {
        "title": "Decide whether to package a PFAS-ready regulated quantitation workflow",
        "ownerView": "Product",
        "why": "The dataset contains 325 PFAS and environmental-contaminant PubMed records in the last year, a current PFAS serum LC-MS/MS method, and a Shimadzu LCMS-8065XE product record positioned for PFAS and regulated quantitation.",
        "whyNow": "A directly relevant PFAS method was published while competitor PFAS positioning is already active, and the claims-matrix go/no-go is due August 7, 2026.",
        "urgency": {
            "evidence": "323 PFAS and environmental-contaminant records were published in the last year, including 28 in the last 30 days; a directly relevant serum LC-MS/MS method was published July 21, 2026, and Shimadzu is already positioning the LCMS-8065XE for PFAS and regulated quantitation.",
            "competitorActions": [
                {
                    "competitor": "Shimadzu · LCMS-8065XE PFAS methods",
                    "date": "Jul 21, 2026",
                    "action": "Published LCMS-8065XE proof for 29 PFAS compounds in drinking water at below 1 ng/L by direct injection, plus complex-matrix robustness evidence tied to EPA Method 1633A.",
                    "pmKeyPoint": "Shimadzu now proves sub-1 ng/L PFAS performance and EPA 1633A matrix robustness. Determine whether Xevo TQ needs new capability or a stronger regulated proof package.",
                    "decisionLink": "Waters must decide whether Xevo TQ already matches the sensitivity and robustness proof and only needs a regulated method package, or whether a material product-capability gap remains.",
                    "sourceUrl": "https://www.shimadzu.com/an/apl/25705/index.html",
                },
            ],
            "decisionWindow": "The claims-matrix go/no-go is due August 7, 2026, before the next roadmap review.",
            "delayRisk": "Waiting leaves the next roadmap review without a decision on whether Waters has a product-capability gap or an application-package gap, while current method and competitor proof are already available.",
        },
        "action": "Build a PFAS claims matrix comparing Waters, Thermo Fisher, SCIEX, and Shimadzu across sensitivity, sample preparation, method runtime, robustness, compliance evidence, and application-note coverage; finish with a go/no-go decision for a packaged regulated-method workflow.",
        "nextAction": "By August 7, 2026, Product Management and Applications must deliver the completed claims matrix, identify the three largest proof gaps, and recommend whether to fund a PFAS workflow package for the next roadmap review.",
        "affectedCapability": "Alliance iS and Next Gen LC regulated-method execution when paired with Xevo TQ, including sample-path robustness, method transfer, compliance-ready operation, and application packaging",
        "decisionStatus": "Decision artifact required",
        "evidenceBasis": {
            "summary": "One current PFAS method record, the 325-record publication trend, and Shimadzu's PFAS-positioned LCMS-8065XE provide linked scientific and competitive evidence.",
            "links": [
                {"label": "PFAS serum LC-MS/MS method", "url": "https://pubmed.ncbi.nlm.nih.gov/42398371/", "signalId": "pubmed-42398371"},
                {"label": "PFAS publication trend", "url": "https://pubmed.ncbi.nlm.nih.gov/", "signalId": "trend-pfas"},
                {"label": "Shimadzu LCMS-8065XE product evidence", "url": "https://www.shimadzu.com/an/products/liquid-chromatograph-mass-spectrometry/triple-quadrupole-lc-msms/lcms-8065xe/index.html"},
            ],
        },
        "tradeoff": "Funding a PFAS-specific package consumes applications, compliance, and product capacity that could support broader regulated quantitation; approve it only if the proof gaps are commercially material and reusable.",
        "falsifier": "If false, we should NOT fund a PFAS-specific workflow package.",
        "priority": "High",
        "technology": "LC-MS/MS",
        "marketSegment": "Environmental",
    },
    {
        "title": "Decide whether Next Gen LC and Alliance iS need new end-to-end workflow requirements",
        "leadershipDecision": "Decide whether Next Gen LC and Alliance iS need new end-to-end workflow requirements",
        "leadershipRationale": "Competitors are differentiating through workflow speed, automation, and software, but the current public evidence does not yet show a repeated Waters customer gap worth displacing committed roadmap work.",
        "decisionOwners": "LC Platform PM and Software Lead",
        "decisionDue": "August 14, 2026",
        "decisionDeliverable": "One recommendation: build, package existing capabilities, reposition, or stop",
        "decisionGate": "Shift roadmap capacity only if at least five customer or field records confirm the same customer-visible gap and both customer value and engineering effort are quantified.",
        "ownerView": "Product",
        "why": "The dataset shows 1,103 lab-automation and software-workflow publications, Shimadzu's Nexera X4 launch, Thermo Fisher's Vanquish Amplify page update, and SCIEX's software-led novus V55 launch.",
        "whyNow": "Three dated competitor workflow moves landed between March and June 2026, and Waters' build/package/reposition/stop recommendation is due August 14, 2026.",
        "urgency": {
            "evidence": "1,103 lab-automation and software-workflow records were published in the last year, including 98 in the last 30 days; Shimadzu launched Nexera X4 on March 3, SCIEX launched novus V55 with SCIEX OS 5.0 on June 1, and Thermo Fisher updated Vanquish Amplify on June 29.",
            "competitorActions": [
                {
                    "competitor": "Shimadzu · Nexera X4",
                    "date": "Mar 3, 2026",
                    "action": "Made method performance the workflow claim: 7 µL extra-column band broadening, stable high-speed solvent delivery, up to 92% shorter analysis time, and up to 14× laboratory productivity.",
                    "pmKeyPoint": "Nexera X4 turns low dispersion and high-speed delivery into productivity claims. Benchmark ACQUITY proof before adding fluidic or control requirements.",
                    "decisionLink": "Waters must determine whether low dispersion and high-speed method performance require new fluidic or control requirements, or whether current ACQUITY capability only needs stronger comparative proof.",
                    "sourceUrl": "https://www.shimadzu.com/news/2026/k8iri3_20_z4uvwt.html",
                },
                {
                    "competitor": "SCIEX · novus V55 with SCIEX OS 5.0",
                    "date": "Jun 1, 2026",
                    "action": "Bundled Central Metrics Tracker, fleet-status monitoring, custom report creation, natural-language AI help, and calculated columns into the instrument launch.",
                    "pmKeyPoint": "SCIEX OS makes fleet monitoring, reporting, and AI guidance part of the instrument offer. Decide whether Alliance iS and Empower need deeper integration or clearer packaging.",
                    "decisionLink": "Waters must determine whether instrument-to-software monitoring, review, reporting, and operator guidance need deeper Alliance iS/Empower integration or can be closed through packaging and positioning.",
                    "sourceUrl": "https://sciex.com/about-us/press-releases/2026/sciex-launches-its-5th-generation-of-nominal-mass-novus-v55-system-with-sciexos-5-0-software",
                },
                {
                    "competitor": "Thermo Fisher · Vanquish Amplify",
                    "date": "Jun 29, 2026",
                    "action": "Packaged a fully inert LC path with SurePac columns, Orbitrap MS, and Chromeleon CDS as one biopharma workflow spanning early research through manufacturing QC.",
                    "pmKeyPoint": "Vanquish Amplify packages inert LC, columns, MS, and CDS as one biopharma workflow. Validate Waters' end-to-end handoffs before adding platform requirements.",
                    "decisionLink": "Waters must determine whether sample-path compatibility, method transfer, and LC-to-MS/software handoffs are already defensible end to end or require new platform requirements and application assets.",
                    "sourceUrl": "https://www.thermofisher.com/order/catalog/product/VQ-AMPLIFY",
                },
            ],
            "decisionWindow": "The cross-functional build, package, reposition, or stop recommendation is due August 14, 2026.",
            "delayRisk": "Waiting carries the workflow question into the next roadmap review without knowing whether Waters needs a product requirement, a packaging change, or only stronger positioning—so capacity could be shifted for the wrong reason or not shifted when a real gap exists.",
        },
        "action": "Run a four-week validation across five end-to-end workflows—method setup, daily operation, diagnostics and recovery, method transfer, and data review/software handoffs—against Nexera X4, Vanquish Amplify, and SCIEX OS 5.0.",
        "nextAction": "Name the LC platform PM and software lead as joint owners. By August 14, 2026, they must return with one go/no-go recommendation: add a product requirement, package existing capabilities, change positioning, or take no action. Do not move roadmap capacity unless at least five customer or field records confirm one repeated customer-visible gap and its benefit and engineering effort are quantified.",
        "affectedCapability": "Next Gen LC and Alliance iS end-to-end operator experience, including method setup, diagnostics, serviceability, method continuity, and chromatography-software handoffs",
        "decisionStatus": "Cross-functional decision artifact required",
        "evidenceBasis": {
            "summary": "A 1,099-record workflow trend is corroborated by current official Nexera X4, Vanquish Amplify, and novus V55/SCIEX OS evidence.",
            "links": [
                {"label": "Shimadzu Nexera X4 release", "url": "https://www.shimadzu.com/news/2026/k8iri3_20_z4uvwt.html", "signalId": "shimadzu-monitor-press-release-9f9572aeee0c"},
                {"label": "Thermo Fisher Vanquish Amplify page", "url": "https://www.thermofisher.com/us/en/home/industrial/chromatography/liquid-chromatography-lc/hplc-uhplc-systems/vanquish-amplify-uhplc-system.html"},
                {"label": "SCIEX novus V55 and SCIEX OS 5.0 release", "url": "https://sciex.com/about-us/press-releases/2026/sciex-launches-its-5th-generation-of-nominal-mass-novus-v55-system-with-sciexos-5-0-software", "signalId": "sciex-monitor-press-release-6e5bfd32b037"},
            ],
        },
        "tradeoff": "Prioritizing workflow and software requirements may displace hardware performance work; only shift capacity where the scorecard shows a repeated customer-visible gap rather than a messaging difference.",
        "falsifier": "If fewer than five customer or field records confirm a repeated workflow gap, or the gap can be closed through packaging or positioning, do not add a new product requirement.",
        "priority": "High",
        "technology": "Software",
        "marketSegment": "Pharma",
    },
    {
        "title": "Decide whether Next Gen LC needs an oligonucleotide method-readiness package",
        "ownerView": "Product",
        "why": "The dataset contains 651 oligonucleotide and nucleic-acid publications in the last year and an official Agilent-NATi partnership focused on lipid-conjugated oligonucleotide research.",
        "whyNow": "Oligonucleotide activity is current and competitor-specific, and the fund, partner, or monitor recommendation is due August 21, 2026.",
        "urgency": {
            "evidence": "651 oligonucleotide and nucleic-acid records were published in the last year, including 63 in the last 30 days; Agilent announced its lipid-conjugated oligonucleotide research partnership with NATi on May 20, 2026.",
            "competitorActions": [
                {
                    "competitor": "Agilent · NATi oligonucleotide collaboration",
                    "date": "May 20, 2026",
                    "action": "Committed to a two-year program combining 1290 Infinity III Bio UHPLC, mass detection, preparative HPLC, QTOF, structured training, and end-to-end analytical and preparative workflow development for lipid-conjugated oligonucleotides.",
                    "pmKeyPoint": "Agilent is building an end-to-end oligonucleotide workflow and training ecosystem. Decide whether Waters should build a reference package or partner.",
                    "decisionLink": "Waters must decide whether to fund a reference workflow and application asset package that connects analysis, purification, characterization, training, and method transfer—or partner instead.",
                    "sourceUrl": "https://www.agilent.com/about/newsroom/presrel/2026/20may-ca26015.html",
                },
                {
                    "competitor": "Thermo Fisher · Vanquish Amplify",
                    "date": "Jun 29, 2026",
                    "action": "Targets oligonucleotides and RNA with an inert sample path intended to reduce adsorption and metal adducts, integrated with SurePac columns, Orbitrap MS, and Chromeleon CDS from research through QC.",
                    "pmKeyPoint": "Vanquish Amplify targets oligo and RNA adsorption and metal-adduct problems across LC-to-MS. Benchmark recovery, carryover, transfer, and software templates before funding a dedicated package.",
                    "decisionLink": "Waters must benchmark compatibility, recovery, carryover, method transfer, detector/MS handoff, and software templates before deciding whether a dedicated Next Gen LC package is necessary.",
                    "sourceUrl": "https://www.thermofisher.com/order/catalog/product/VQ-AMPLIFY",
                },
            ],
            "decisionWindow": "The fund, partner, or monitor recommendation is due August 21, 2026, after benchmarking three competitor workflow claims and five public user needs.",
            "delayRisk": "Waiting leaves the next roadmap review without a decision on dedicated compatibility, carryover, transfer, and software-template requirements while competitors continue building workflow-specific proof.",
        },
        "action": "Build a Next Gen LC oligonucleotide method-readiness dossier covering column and solvent compatibility, carryover, sample throughput, method transfer, detector/MS handoff, software templates, and the application assets required for one reference workflow.",
        "nextAction": "By August 21, 2026, Biopharma Applications and the Next Gen LC PM must map the current Waters assets, benchmark three competitor workflow claims, document five public user needs, and return a fund, partner, or monitor recommendation.",
        "affectedCapability": "Next Gen LC biopharma method readiness and Alliance iS method-transfer patterns, including carryover control, fluidics compatibility, software templates, and LC-to-MS workflow handoff",
        "decisionStatus": "Validation artifact required",
        "evidenceBasis": {
            "summary": "The 639-record oligonucleotide publication trend is corroborated by Agilent's dated NATi partnership and a public nucleic-acid automation partnership already tracked in the dataset.",
            "links": [
                {"label": "Oligonucleotide publication trend", "url": "https://pubmed.ncbi.nlm.nih.gov/", "signalId": "trend-oligos"},
                {"label": "Agilent and NATi oligonucleotide partnership", "url": "https://www.agilent.com/about/newsroom/presrel/2026/20may-ca26015.html", "signalId": "agilent-nati-oligo-2026"},
                {"label": "PerkinElmer, Covaris, and Hamilton nucleic-acid automation", "url": "https://www.perkinelmer.com/corporate-and-newsroom/strategic-partnership-between-covaris-and-hamilton-empowers-labs-with-sonication-star", "signalId": "perkinelmer-covaris-hamilton-automation-2025"},
            ],
        },
        "tradeoff": "A dedicated oligonucleotide package could fragment the platform and applications roadmap; fund it only if reusable LC requirements and credible adoption evidence justify specialization.",
        "falsifier": "If false, we should NOT create a dedicated oligonucleotide method-readiness package for Next Gen LC.",
        "priority": "High",
        "technology": "LC-MS",
        "marketSegment": "Biopharma",
    },
]


def trend_counts(data: dict, theme_fragment: str) -> dict:
    trends = data.get("trends", {})
    themes = trends.get("themes", []) if isinstance(trends, dict) else trends
    for theme in themes:
        if theme_fragment.lower() in str(theme.get("theme", "")).lower():
            return theme.get("counts", {})
    return {}


def hydrate_recommendations(data: dict) -> list[dict]:
    recommendations = deepcopy(RECOMMENDATIONS)
    by_title = {item["title"]: item for item in recommendations}

    workflow = by_title["Decide whether Next Gen LC and Alliance iS need new end-to-end workflow requirements"]
    workflow_counts = trend_counts(data, "Lab automation and software-enabled workflows")
    workflow_1y = int(workflow_counts.get("1y", 0))
    workflow_30d = int(workflow_counts.get("30d", 0))
    workflow["why"] = f"The dataset shows {workflow_1y:,} lab-automation and software-workflow publications, Shimadzu's Nexera X4 launch, Thermo Fisher's Vanquish Amplify page update, and SCIEX's software-led novus V55 launch."
    workflow["urgency"]["evidence"] = f"{workflow_1y:,} lab-automation and software-workflow records were published in the last year, including {workflow_30d:,} in the last 30 days; Shimadzu launched Nexera X4 on March 3, SCIEX launched novus V55 with SCIEX OS 5.0 on June 1, and Thermo Fisher updated Vanquish Amplify on June 29."

    oligo = by_title["Decide whether Next Gen LC needs an oligonucleotide method-readiness package"]
    oligo_counts = trend_counts(data, "Oligonucleotide and nucleic-acid analytics")
    oligo_1y = int(oligo_counts.get("1y", 0))
    oligo_30d = int(oligo_counts.get("30d", 0))
    oligo["why"] = f"The dataset contains {oligo_1y:,} oligonucleotide and nucleic-acid publications in the last year and an official Agilent-NATi partnership focused on lipid-conjugated oligonucleotide research."
    oligo["urgency"]["evidence"] = f"{oligo_1y:,} oligonucleotide and nucleic-acid records were published in the last year, including {oligo_30d:,} in the last 30 days; Agilent announced its lipid-conjugated oligonucleotide research partnership with NATi on May 20, 2026."

    pfas = by_title["Decide whether to package a PFAS-ready regulated quantitation workflow"]
    pfas_counts = trend_counts(data, "PFAS and environmental contaminant testing")
    pfas_1y = int(pfas_counts.get("1y", 0))
    pfas_30d = int(pfas_counts.get("30d", 0))
    pfas["why"] = f"The dataset contains {pfas_1y:,} PFAS and environmental-contaminant PubMed records in the last year, a current PFAS serum LC-MS/MS method, and a Shimadzu LCMS-8065XE product record positioned for PFAS and regulated quantitation."
    pfas["urgency"]["evidence"] = f"{pfas_1y:,} PFAS and environmental-contaminant records were published in the last year, including {pfas_30d:,} in the last 30 days; a directly relevant serum LC-MS/MS method was published July 21, 2026, and Shimadzu is already positioning the LCMS-8065XE for PFAS and regulated quantitation."

    for recommendation in recommendations:
        urgency = recommendation["urgency"]
        recommendation["whyNow"] = " ".join([
            f"What changed: {urgency['evidence']}",
            f"Decision window: {urgency['decisionWindow']}",
            f"Cost of waiting: {urgency['delayRisk']}",
        ])
    return recommendations


def main() -> int:
    data = json.loads(INTELLIGENCE_FILE.read_text(encoding="utf-8"))
    removed = 0
    for signal in data.get("signals", []):
        if isinstance(signal, dict) and str(signal.get("recommendation", "")).startswith(BOILERPLATE_PREFIX):
            signal.pop("recommendation", None)
            removed += 1
    recommendations = hydrate_recommendations(data)
    data["recommendations"] = recommendations
    temporary = INTELLIGENCE_FILE.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temporary.replace(INTELLIGENCE_FILE)
    print(f"Wrote exactly {len(recommendations)} recommendations and removed {removed} boilerplate signal lines.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
