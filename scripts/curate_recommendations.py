#!/usr/bin/env python3
"""Keep the recommendation queue limited to evidence-backed decision artifacts."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INTELLIGENCE_FILE = ROOT / "data" / "intelligence.json"
BOILERPLATE_PREFIX = "Review whether Waters positioning, application notes, and roadmap coverage address this "


RECOMMENDATIONS = [
    {
        "title": "Decide whether to package a PFAS-ready regulated quantitation workflow",
        "ownerView": "Product",
        "why": "The dataset contains 325 PFAS and environmental-contaminant PubMed records in the last year, a current PFAS serum LC-MS/MS method, and a Shimadzu LCMS-8065XE product record positioned for PFAS and regulated quantitation.",
        "whyNow": "A July 2026 PFAS method signal and active triple-quadrupole competition make method readiness, sensitivity proof, sample preparation, and compliance language immediate buying-criteria questions.",
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
        "title": "Choose the workflow experience requirements for Next Gen LC and Alliance iS",
        "ownerView": "Product",
        "why": "The dataset shows 1,099 lab-automation and software-workflow publications, Shimadzu's Nexera X4 launch, Thermo Fisher's Vanquish Amplify page update, and SCIEX's software-led novus V55 launch.",
        "whyNow": "Three competitors are making current product value legible through workflow speed, reduced operator burden, software, and automation rather than hardware specifications alone.",
        "action": "Build a competitive workflow friction scorecard for Next Gen LC and Alliance iS covering installation, method setup, daily operation, diagnostics, maintenance, method transfer, data review, and software handoffs against Nexera X4, Vanquish Amplify, and SCIEX OS 5.0.",
        "nextAction": "By August 14, 2026, the LC platform PM and software lead must complete five scored workflows, document the three highest-confidence gaps with evidence, and choose one response: product requirement, workflow packaging, positioning change, or no action.",
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
        "falsifier": "If false, we should NOT add a new workflow-experience requirement to Next Gen LC or Alliance iS.",
        "priority": "High",
        "technology": "Software",
        "marketSegment": "Pharma",
    },
    {
        "title": "Decide whether Next Gen LC needs an oligonucleotide method-readiness package",
        "ownerView": "Product",
        "why": "The dataset contains 639 oligonucleotide and nucleic-acid publications in the last year and an official Agilent-NATi partnership focused on lipid-conjugated oligonucleotide research.",
        "whyNow": "Competitor investment is moving from general biopharma positioning into oligonucleotide-specific research while the scientific evidence base is already substantial.",
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


def main() -> int:
    data = json.loads(INTELLIGENCE_FILE.read_text(encoding="utf-8"))
    removed = 0
    for signal in data.get("signals", []):
        if isinstance(signal, dict) and str(signal.get("recommendation", "")).startswith(BOILERPLATE_PREFIX):
            signal.pop("recommendation", None)
            removed += 1
    data["recommendations"] = RECOMMENDATIONS
    temporary = INTELLIGENCE_FILE.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temporary.replace(INTELLIGENCE_FILE)
    print(f"Wrote exactly {len(RECOMMENDATIONS)} recommendations and removed {removed} boilerplate signal lines.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
