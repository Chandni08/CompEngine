#!/usr/bin/env python3
"""Keep the recommendation queue limited to evidence-backed decision artifacts."""

from __future__ import annotations

import json
import re
from copy import deepcopy
from datetime import date, datetime
from pathlib import Path

from provenance import assess_source_quality, compute_decision_score, unique_urls


ROOT = Path(__file__).resolve().parents[1]
INTELLIGENCE_FILE = ROOT / "data" / "intelligence.json"
BOILERPLATE_PREFIX = "Review whether Waters positioning, application notes, and roadmap coverage address this "


DECISION_METHOD = {
    "Decide whether to package a PFAS-ready regulated quantitation workflow": {
        "decisionOwners": "Product Management and Applications",
        "decisionDeliverable": "One recommendation: package, build, partner, monitor, or stop",
        "decisionOptions": ["Package", "Build", "Partner", "Monitor", "Stop"],
        "decisionGate": "Go/no-go only if shared-method benchmarking establishes a material capability or proof gap.",
        "engineeringValidationEffort": "Unquantified; estimate after the shared-method benchmark defines the gap.",
        "outstandingInternalEvidence": [
            "Shared-method sensitivity, recovery, matrix-effect, and robustness results",
            "Customer value and demand from regulated PFAS accounts",
            "Engineering and applications effort for any identified capability gap",
        ],
        "affectedSegment": "Environmental and regulated testing",
    },
    "Decide whether Next Gen LC and Alliance iS need new end-to-end workflow requirements": {
        "decisionOwners": "LC Platform PM and Software Lead",
        "decisionDeliverable": "One recommendation: build, package existing capabilities, reposition, or stop",
        "decisionOptions": ["Build", "Package existing capabilities", "Reposition", "Monitor", "Stop"],
        "decisionGate": "Shift roadmap capacity only if at least five customer or field records confirm the same customer-visible gap and both customer value and engineering effort are quantified.",
        "engineeringValidationEffort": "Unquantified; estimate after the five-workflow validation isolates product gaps from packaging or positioning gaps.",
        "outstandingInternalEvidence": [
            "Five-workflow comparative benchmark results",
            "At least five independent customer or field confirmations of one repeated gap",
            "Quantified customer value and engineering effort",
        ],
        "affectedSegment": "Pharma and biopharma LC workflows",
    },
    "Decide whether Next Gen LC needs an oligonucleotide method-readiness package": {
        "decisionOwners": "Biopharma Applications and Next Gen LC PM",
        "decisionDeliverable": "One recommendation: package, build, partner, monitor, or stop",
        "decisionOptions": ["Package", "Build", "Partner", "Monitor", "Stop"],
        "decisionGate": "Go/no-go only if benchmarked customer needs establish reusable LC requirements or a material application-proof gap.",
        "engineeringValidationEffort": "Unquantified; estimate after recovery, carryover, transfer, and software-template benchmarking.",
        "outstandingInternalEvidence": [
            "Recovery, carryover, compatibility, and method-transfer benchmarks",
            "Independent customer validation of workflow-specific needs",
            "Build-versus-partner effort and commercial exposure",
        ],
        "affectedSegment": "Biopharma and advanced therapeutics",
    },
}


RECOMMENDATIONS = [
    {
        "title": "Decide whether to package a PFAS-ready regulated quantitation workflow",
        "ownerView": "Product",
        "why": "The dataset contains 325 PFAS and environmental-contaminant PubMed records in the last year, a current PFAS serum LC-MS/MS method, and a Shimadzu LCMS-8065XE product record positioned for PFAS and regulated quantitation.",
        "whyNow": "A directly relevant PFAS method was published while competitor PFAS positioning is already active, so the claims-matrix go/no-go should be resolved at the next roadmap review.",
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
            "decisionImplications": [
                "Shimadzu has already published sub-1 ng/L PFAS performance and EPA 1633A matrix-robustness proof on the LCMS-8065XE.",
                "Waters must separate a true Xevo TQ capability gap from a missing regulated workflow and evidence package before the next review.",
            ],
            "whyNowInsight": "Shimadzu's current sub-1 ng/L and EPA 1633A proof is already available to buyers, while PFAS scientific activity remains high. Waters needs a capability-versus-packaging answer at the next roadmap review so the next roadmap cycle is not based on an untested competitive assumption.",
            "decisionWindow": "Resolve the claims-matrix go/no-go at the next roadmap review; no calendar deadline is established by the public evidence.",
            "delayRisk": "Waiting leaves the next roadmap review without a decision on whether Waters has a product-capability gap or an application-package gap, while current method and competitor proof are already available.",
        },
        "action": "Build a PFAS claims matrix comparing Waters, Thermo Fisher, SCIEX, and Shimadzu across sensitivity, sample preparation, method runtime, robustness, compliance evidence, and application-note coverage; finish with a go/no-go decision for a packaged regulated-method workflow.",
        "nextAction": "Product Management and Applications should deliver the completed claims matrix, identify the three largest proof gaps, and recommend whether to fund a PFAS workflow package at the next roadmap review.",
        "affectedCapability": "Alliance iS and Next Gen LC regulated-method execution when paired with Xevo TQ, including sample-path robustness, method transfer, compliance-ready operation, and application packaging",
        "decisionStatus": "Decision artifact required",
        "evidenceBasis": {
            "summary": "One current PFAS method record, the 325-record publication trend, and Shimadzu's PFAS-positioned LCMS-8065XE provide linked scientific and competitive evidence.",
            "links": [
                {
                    "label": "PFAS serum LC-MS/MS method",
                    "url": "https://pubmed.ncbi.nlm.nih.gov/42398371/",
                    "signalId": "pubmed-42398371",
                    "publisher": "Peer-reviewed journal indexed by PubMed",
                    "sourceType": "peer_reviewed_article",
                    "sourceControl": "independent",
                    "independenceGroup": "pubmed-42398371",
                    "claimSupport": "direct",
                    "evidenceStatus": "partial",
                },
                {
                    "label": "Shimadzu LCMS-8065XE product evidence",
                    "url": "https://www.shimadzu.com/an/products/liquid-chromatograph-mass-spectrometry/triple-quadrupole-lc-msms/lcms-8065xe/index.html",
                    "publisher": "Shimadzu",
                    "sourceType": "official_product_page",
                    "sourceControl": "issuer",
                    "independenceGroup": "shimadzu",
                    "claimSupport": "direct",
                    "evidenceStatus": "partial",
                },
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
        "decisionDeliverable": "One recommendation: build, package existing capabilities, reposition, or stop",
        "decisionGate": "Shift roadmap capacity only if at least five customer or field records confirm the same customer-visible gap and both customer value and engineering effort are quantified.",
        "ownerView": "Product",
        "why": "The dataset shows 1,103 lab-automation and software-workflow publications, Shimadzu's Nexera X4 launch, Thermo Fisher's current Vanquish Amplify product positioning, and SCIEX's software-led novus V55 launch.",
        "whyNow": "Three dated competitor workflow moves landed between March and June 2026, requiring Waters to distinguish a product requirement from a packaging or positioning response before capacity is assigned.",
        "urgency": {
            "evidence": "1,103 lab-automation and software-workflow records were published in the last year, including 98 in the last 30 days; Shimadzu launched Nexera X4 on March 3 and SCIEX launched novus V55 with SCIEX OS 5.0 on June 1. Thermo Fisher's Vanquish Amplify page is current product evidence, not proof of a dated update.",
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
                    "date": "Current product page",
                    "action": "Packaged a fully inert LC path with SurePac columns, Orbitrap MS, and Chromeleon CDS as one biopharma workflow spanning early research through manufacturing QC.",
                    "pmKeyPoint": "Vanquish Amplify packages inert LC, columns, MS, and CDS as one biopharma workflow. Validate Waters' end-to-end handoffs before adding platform requirements.",
                    "decisionLink": "Waters must determine whether sample-path compatibility, method transfer, and LC-to-MS/software handoffs are already defensible end to end or require new platform requirements and application assets.",
                    "sourceUrl": "https://www.thermofisher.com/order/catalog/product/VQ-AMPLIFY",
                },
            ],
            "decisionImplications": [
                "Shimadzu is turning low-dispersion fluidics and high-speed delivery into measurable productivity claims, raising the bar for comparative ACQUITY proof.",
                "SCIEX is making fleet monitoring, reporting, and AI guidance part of the instrument offer rather than a separate software story.",
                "Thermo Fisher is packaging inert LC, columns, MS, and CDS as one biopharma workflow, increasing pressure on Waters' end-to-end handoffs.",
            ],
            "whyNowInsight": "Three competitors have recently converged on the same buying story: measurable method performance, integrated software guidance, and complete LC-to-MS workflows. Waters needs to determine whether the response is a product requirement, packaging change, or stronger comparative proof before capacity is assigned.",
            "decisionWindow": "Resolve the build, package, reposition, or stop choice before assigning roadmap capacity.",
            "delayRisk": "Waiting carries the workflow question into the next roadmap review without knowing whether Waters needs a product requirement, a packaging change, or only stronger positioning—so capacity could be shifted for the wrong reason or not shifted when a real gap exists.",
        },
        "action": "Run a four-week validation across five end-to-end workflows—method setup, daily operation, diagnostics and recovery, method transfer, and data review/software handoffs—against Nexera X4, Vanquish Amplify, and SCIEX OS 5.0.",
        "nextAction": "Name the LC platform PM and software lead as joint owners. Return with one go/no-go recommendation: add a product requirement, package existing capabilities, change positioning, or take no action. Do not move roadmap capacity unless at least five customer or field records confirm one repeated customer-visible gap and its benefit and engineering effort are quantified.",
        "affectedCapability": "Next Gen LC and Alliance iS end-to-end operator experience, including method setup, diagnostics, serviceability, method continuity, and chromatography-software handoffs",
        "decisionStatus": "Cross-functional decision artifact required",
        "evidenceBasis": {
            "summary": "A 1,099-record workflow trend is corroborated by current official Nexera X4, Vanquish Amplify, and novus V55/SCIEX OS evidence.",
            "links": [
                {
                    "label": "Shimadzu Nexera X4 release",
                    "url": "https://www.shimadzu.com/news/2026/k8iri3_20_z4uvwt.html",
                    "signalId": "shimadzu-monitor-press-release-9f9572aeee0c",
                    "publisher": "Shimadzu",
                    "sourceType": "official_press_release",
                    "sourceControl": "issuer",
                    "independenceGroup": "shimadzu",
                    "claimSupport": "direct",
                    "evidenceStatus": "partial",
                },
                {
                    "label": "Thermo Fisher Vanquish Amplify page",
                    "url": "https://www.thermofisher.com/us/en/home/industrial/chromatography/liquid-chromatography-lc/hplc-uhplc-systems/vanquish-amplify-uhplc-system.html",
                    "publisher": "Thermo Fisher Scientific",
                    "sourceType": "official_product_page",
                    "sourceControl": "issuer",
                    "independenceGroup": "thermo-fisher",
                    "claimSupport": "direct",
                    "evidenceStatus": "partial",
                },
                {
                    "label": "SCIEX novus V55 and SCIEX OS 5.0 release",
                    "url": "https://sciex.com/about-us/press-releases/2026/sciex-launches-its-5th-generation-of-nominal-mass-novus-v55-system-with-sciexos-5-0-software",
                    "signalId": "sciex-monitor-press-release-6e5bfd32b037",
                    "publisher": "SCIEX",
                    "sourceType": "official_press_release",
                    "sourceControl": "issuer",
                    "independenceGroup": "sciex",
                    "claimSupport": "direct",
                    "evidenceStatus": "partial",
                },
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
        "whyNow": "Oligonucleotide activity is current and competitor-specific, so the fund, partner, or monitor recommendation should be resolved at the next roadmap review.",
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
                    "date": "Current product page",
                    "action": "Targets oligonucleotides and RNA with an inert sample path intended to reduce adsorption and metal adducts, integrated with SurePac columns, Orbitrap MS, and Chromeleon CDS from research through QC.",
                    "pmKeyPoint": "Vanquish Amplify targets oligo and RNA adsorption and metal-adduct problems across LC-to-MS. Benchmark recovery, carryover, transfer, and software templates before funding a dedicated package.",
                    "decisionLink": "Waters must benchmark compatibility, recovery, carryover, method transfer, detector/MS handoff, and software templates before deciding whether a dedicated Next Gen LC package is necessary.",
                    "sourceUrl": "https://www.thermofisher.com/order/catalog/product/VQ-AMPLIFY",
                },
            ],
            "decisionImplications": [
                "Agilent is combining UHPLC, mass detection, purification, QTOF, training, and co-development into an oligonucleotide workflow ecosystem.",
                "Thermo Fisher is targeting oligo and RNA adsorption and metal-adduct problems with an inert LC-to-MS workflow spanning research through QC.",
            ],
            "whyNowInsight": "Agilent and Thermo Fisher are already packaging oligonucleotide-specific workflows while scientific activity remains substantial. Waters needs a reference-package, partnership, or monitor decision at the next roadmap review so customer-facing proof and platform requirements are not deferred into another roadmap cycle.",
            "decisionWindow": "Resolve the fund, partner, or monitor choice at the next roadmap review after benchmarking three competitor workflow claims and five public user needs; no calendar deadline is established by the public evidence.",
            "delayRisk": "Waiting leaves the next roadmap review without a decision on dedicated compatibility, carryover, transfer, and software-template requirements while competitors continue building workflow-specific proof.",
        },
        "action": "Build a Next Gen LC oligonucleotide method-readiness dossier covering column and solvent compatibility, carryover, sample throughput, method transfer, detector/MS handoff, software templates, and the application assets required for one reference workflow.",
        "nextAction": "Biopharma Applications and the Next Gen LC PM should map the current Waters assets, benchmark three competitor workflow claims, document five public user needs, and return a fund, partner, or monitor recommendation at the next roadmap review.",
        "affectedCapability": "Next Gen LC biopharma method readiness and Alliance iS method-transfer patterns, including carryover control, fluidics compatibility, software templates, and LC-to-MS workflow handoff",
        "decisionStatus": "Validation artifact required",
        "evidenceBasis": {
            "summary": "The oligonucleotide publication trend is corroborated by Agilent's dated NATi partnership and Thermo Fisher's current Vanquish Amplify oligonucleotide workflow claims.",
            "links": [
                {
                    "label": "Agilent and NATi oligonucleotide partnership",
                    "url": "https://www.agilent.com/about/newsroom/presrel/2026/20may-ca26015.html",
                    "signalId": "agilent-nati-oligo-2026",
                    "publisher": "Agilent Technologies",
                    "sourceType": "official_press_release",
                    "sourceControl": "issuer",
                    "independenceGroup": "agilent",
                    "claimSupport": "direct",
                    "evidenceStatus": "partial",
                },
                {
                    "label": "Thermo Fisher Vanquish Amplify oligonucleotide workflow",
                    "url": "https://www.thermofisher.com/order/catalog/product/VQ-AMPLIFY",
                    "publisher": "Thermo Fisher Scientific",
                    "sourceType": "official_product_page",
                    "sourceControl": "issuer",
                    "independenceGroup": "thermo-fisher",
                    "claimSupport": "direct",
                    "evidenceStatus": "partial",
                },
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


def trend_record(data: dict, theme_fragment: str) -> dict:
    trends = data.get("trends", {})
    themes = trends.get("themes", []) if isinstance(trends, dict) else trends
    for theme in themes:
        if theme_fragment.lower() in str(theme.get("theme", "")).lower():
            return theme
    return {}


def replace_evidence_summary(recommendation: dict, count: int, label: str) -> None:
    recommendation.setdefault("evidenceBasis", {})["summary"] = (
        f"The current PubMed retrieval returned {count:,} {label} records in the rolling one-year window. "
        "Official competitor sources linked below provide the separate product or partnership evidence."
    )


def attach_canonical_decision(recommendation: dict, trend: dict, decision_id: str) -> None:
    links = recommendation.get("evidenceBasis", {}).get("links", [])
    source_urls = unique_urls(links)
    source_quality = assess_source_quality(links)
    provenance = trend.get("queryProvenance", {}).get("1y", {})
    action_count = len(recommendation.get("urgency", {}).get("competitorActions", []))
    trend_strength = int(trend.get("strengthScore", 0))
    # Customer evidence is intentionally zero unless the recommendation stores
    # independent, mapped customer records.  This avoids manufacturing support
    # from generic forum volume.
    customer_sources = int(recommendation.get("customerIndependentSources", 0))
    latest_dates = []
    for action in recommendation.get("urgency", {}).get("competitorActions", []):
        raw = str(action.get("date", ""))
        for fmt in ("%b %d, %Y", "%B %d, %Y", "%Y-%m-%d"):
            try:
                latest_dates.append(datetime.strptime(raw, fmt).date())
                break
            except ValueError:
                pass
    newest = max(latest_dates) if latest_dates else None
    recency = 10 if newest and (date.today() - newest).days <= 90 else 6 if newest and (date.today() - newest).days <= 365 else 0
    score = compute_decision_score({
        "applicationTrend": min(20, round(trend_strength / 5)),
        "competitorActivity": min(20, action_count * 6),
        "customerEvidence": min(20, customer_sources * 4),
        "decisionRelevance": 15,
        "sourceQuality": source_quality["score"],
        "recency": recency,
    })
    score["sourceQualityAssessment"] = source_quality
    recommendation["id"] = decision_id
    recommendation["priorityScore"] = score["score"]
    recommendation["canonicalDecision"] = {
        "id": decision_id,
        "title": recommendation["title"],
        "why": recommendation["why"],
        "score": score,
        "trend": {
            "theme": trend.get("theme"),
            "count": int(trend.get("counts", {}).get("1y", 0)),
            "window": "1y",
            "queryProvenance": provenance,
        },
        "sourceUrls": source_urls + ([provenance.get("resultsUrl")] if provenance.get("resultsUrl") else []),
        "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
    }


def attach_decision_method(recommendation: dict) -> None:
    """Attach the review contract that cannot be derived from public activity counts."""
    method = DECISION_METHOD[recommendation["title"]]
    recommendation.update({key: deepcopy(value) for key, value in method.items() if key != "affectedSegment"})
    recommendation["businessMagnitude"] = {
        "status": "UNQUANTIFIED — validation required",
        "exposureBand": "Unquantified",
        "affectedSegment": method["affectedSegment"],
        "geography": "Not established from public evidence",
        "requiredInternalData": [
            "installed base and account exposure",
            "win/loss and service evidence",
            "price, margin, and adoption assumptions",
        ],
    }


def hydrate_recommendations(data: dict) -> list[dict]:
    recommendations = deepcopy(RECOMMENDATIONS)
    by_title = {item["title"]: item for item in recommendations}

    workflow = by_title["Decide whether Next Gen LC and Alliance iS need new end-to-end workflow requirements"]
    workflow_trend = trend_record(data, "Lab automation and software-enabled workflows")
    workflow_counts = workflow_trend.get("counts", {})
    workflow_1y = int(workflow_counts.get("1y", 0))
    workflow_30d = int(workflow_counts.get("30d", 0))
    workflow["why"] = f"The current one-year PubMed query returned {workflow_1y:,} lab-automation and software-workflow records. Separate official evidence shows Shimadzu's dated Nexera X4 launch and SCIEX's dated novus V55/SCIEX OS 5.0 launch; Thermo Fisher's Vanquish Amplify product page is monitored as a current product page, not a dated update."
    workflow["urgency"]["evidence"] = f"{workflow_1y:,} lab-automation and software-workflow records were published in the last year, including {workflow_30d:,} in the last 30 days. Official dated releases document Nexera X4 on March 3 and novus V55 with SCIEX OS 5.0 on June 1."
    replace_evidence_summary(workflow, workflow_1y, "lab-automation and software-workflow")

    oligo = by_title["Decide whether Next Gen LC needs an oligonucleotide method-readiness package"]
    oligo_trend = trend_record(data, "Oligonucleotide and nucleic-acid analytics")
    oligo_counts = oligo_trend.get("counts", {})
    oligo_1y = int(oligo_counts.get("1y", 0))
    oligo_30d = int(oligo_counts.get("30d", 0))
    oligo["why"] = f"The dataset contains {oligo_1y:,} oligonucleotide and nucleic-acid publications in the last year and an official Agilent-NATi partnership focused on lipid-conjugated oligonucleotide research."
    oligo["urgency"]["evidence"] = f"{oligo_1y:,} oligonucleotide and nucleic-acid records were published in the last year, including {oligo_30d:,} in the last 30 days; Agilent announced its lipid-conjugated oligonucleotide research partnership with NATi on May 20, 2026."
    replace_evidence_summary(oligo, oligo_1y, "oligonucleotide and nucleic-acid")

    pfas = by_title["Decide whether to package a PFAS-ready regulated quantitation workflow"]
    pfas_trend = trend_record(data, "PFAS and environmental contaminant testing")
    pfas_counts = pfas_trend.get("counts", {})
    pfas_1y = int(pfas_counts.get("1y", 0))
    pfas_30d = int(pfas_counts.get("30d", 0))
    pfas["why"] = f"The dataset contains {pfas_1y:,} PFAS and environmental-contaminant PubMed records in the last year, a current PFAS serum LC-MS/MS method, and a Shimadzu LCMS-8065XE product record positioned for PFAS and regulated quantitation."
    pfas["urgency"]["evidence"] = f"{pfas_1y:,} PFAS and environmental-contaminant records were published in the last year, including {pfas_30d:,} in the last 30 days; a directly relevant serum LC-MS/MS method was published July 21, 2026, and Shimadzu is already positioning the LCMS-8065XE for PFAS and regulated quantitation."
    replace_evidence_summary(pfas, pfas_1y, "PFAS and environmental-contaminant")

    attach_canonical_decision(workflow, workflow_trend, "decision-workflow-requirements")
    attach_canonical_decision(oligo, oligo_trend, "decision-oligo-readiness")
    attach_canonical_decision(pfas, pfas_trend, "decision-pfas-workflow")

    for recommendation in recommendations:
        attach_decision_method(recommendation)
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
