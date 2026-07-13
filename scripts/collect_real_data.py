#!/usr/bin/env python3
"""Collect public competitive-intelligence signals for the Waters prototype."""

from __future__ import annotations

import json
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from html.parser import HTMLParser
from pathlib import Path


TODAY = date.today()
OUT = Path(__file__).resolve().parents[1] / "data" / "intelligence.json"
USER_AGENT = "WatersCompetitiveIntelligenceEngine/0.2 (+https://www.waters.com/)"
AUTOMATED_PUBMED_PREFIXES = ("pubmed-", "trend-")
AUTOMATED_SEC_PREFIXES = ("sec-",)

HORIZONS = {
    "30d": 30,
    "60d": 60,
    "90d": 90,
    "1y": 365,
    "3y": 365 * 3,
    "5y": 365 * 5,
}

COMPETITORS = [
    {
        "id": "thermo",
        "name": "Thermo Fisher",
        "ticker": "TMO",
        "cik": "0000097745",
        "queries": ["Orbitrap", "Vanquish", "Q Exactive", "TSQ Altis", "Thermo Fisher Scientific"],
    },
    {
        "id": "agilent",
        "name": "Agilent",
        "ticker": "A",
        "cik": "0001090872",
        "queries": ["Agilent 1290", "Agilent InfinityLab", "Agilent LC/MS", "Agilent 6495", "Ultivo"],
    },
    {
        "id": "shimadzu",
        "name": "Shimadzu",
        "ticker": "7701.T",
        "cik": None,
        "queries": ["Shimadzu LCMS", "Shimadzu Nexera", "LCMS-8060", "LCMS-9030", "LCMS-9050"],
    },
    {
        "id": "sciex",
        "name": "SCIEX",
        "ticker": "DHR",
        "cik": "0000313616",
        "queries": ["SCIEX", "ZenoTOF", "TripleTOF", "QTRAP", "Echo MS"],
    },
    {
        "id": "perkinelmer",
        "name": "PerkinElmer",
        "ticker": "RVTY",
        "cik": "0000031791",
        "queries": ["PerkinElmer QSight", "PerkinElmer LC", "PerkinElmer chromatography"],
    },
]

THEMES = [
    {
        "id": "lnp-rna",
        "name": "LNP and RNA therapeutics workflows",
        "query": '("lipid nanoparticle" OR LNP OR "RNA therapeutics" OR mRNA) AND ("LC-MS" OR chromatography OR "mass spectrometry")',
        "technology": "LC-MS",
        "segment": "Biopharma",
    },
    {
        "id": "oligos",
        "name": "Oligonucleotide and nucleic-acid analytics",
        "query": '(oligonucleotide OR "nucleic acid" OR siRNA) AND ("LC-MS" OR chromatography OR "mass spectrometry")',
        "technology": "LC-MS",
        "segment": "Biopharma",
    },
    {
        "id": "pfas",
        "name": "PFAS and environmental contaminant testing",
        "query": '(PFAS OR "per- and polyfluoroalkyl") AND ("LC-MS" OR "LC-MS/MS" OR chromatography)',
        "technology": "LC-MS/MS",
        "segment": "Environmental",
    },
    {
        "id": "proteomics",
        "name": "High-resolution proteomics and metabolomics",
        "query": '(proteomics OR metabolomics) AND ("LC-MS" OR Orbitrap OR "mass spectrometry")',
        "technology": "LC-MS",
        "segment": "Academic",
    },
    {
        "id": "automation",
        "name": "Lab automation and software-enabled workflows",
        "query": '("laboratory automation" OR "workflow software" OR "AI") AND ("LC-MS" OR chromatography OR "mass spectrometry")',
        "technology": "Software",
        "segment": "Pharma",
    },
]

SOURCE_REGISTRY = [
    {
        "id": "thermo-news",
        "competitor": "Thermo Fisher",
        "type": "Press releases",
        "url": "https://newsroom.thermofisher.com/newsroom/press-releases/default.aspx",
        "coverage": "Corporate, product, partnership, investment announcements",
    },
    {
        "id": "thermo-ms-products",
        "competitor": "Thermo Fisher",
        "type": "Product pages",
        "url": "https://www.thermofisher.com/us/en/home/industrial/mass-spectrometry.html",
        "coverage": "Mass spectrometry and workflow positioning",
    },
    {
        "id": "thermo-lc-insights",
        "competitor": "Thermo Fisher",
        "type": "Official technical RSS",
        "url": "https://www.thermofisher.com/blog/analyteguru/liquid-chromatography/feed/",
        "coverage": "Dated LC, UHPLC, Vanquish, and LC-MS workflow insights",
    },
    {
        "id": "thermo-ms-insights",
        "competitor": "Thermo Fisher",
        "type": "Official technical RSS",
        "url": "https://www.thermofisher.com/blog/analyteguru/mass-spectrometry/feed/",
        "coverage": "Dated Orbitrap, TSQ, LC-MS product, application, and workflow insights",
    },
    {
        "id": "thermo-proteomics-insights",
        "competitor": "Thermo Fisher",
        "type": "Official technical RSS",
        "url": "https://www.thermofisher.com/blog/analyteguru/proteomics/feed/",
        "coverage": "Dated proteomics LC-MS workflows, software, and instrument proof points",
    },
    {
        "id": "agilent-news",
        "competitor": "Agilent",
        "type": "Press releases",
        "url": "https://www.agilent.com/about/newsroom/presrel.html",
        "coverage": "Corporate, product, partnership, investment announcements",
    },
    {
        "id": "agilent-lcms",
        "competitor": "Agilent",
        "type": "Product pages",
        "url": "https://www.agilent.com/products0.xml",
        "coverage": "LC/MS product inventory and last-modified dates via authoritative sitemap",
    },
    {
        "id": "shimadzu-news",
        "competitor": "Shimadzu",
        "type": "Press releases",
        "url": "https://www.shimadzu.com/news/",
        "coverage": "Corporate and product announcements",
    },
    {
        "id": "shimadzu-lcms",
        "competitor": "Shimadzu",
        "type": "Product pages",
        "url": "https://www.shimadzu.com/an/products/liquid-chromatograph-mass-spectrometry/index.html",
        "coverage": "LCMS product portfolio",
    },
    {
        "id": "sciex-news",
        "competitor": "SCIEX",
        "type": "Press releases",
        "url": "https://sciex.com/about-us/press-releases",
        "coverage": "Product and corporate announcements",
    },
    {
        "id": "sciex-products",
        "competitor": "SCIEX",
        "type": "Product pages",
        "url": "https://sciex.com/products/mass-spectrometers",
        "coverage": "Mass spectrometer portfolio positioning",
    },
    {
        "id": "perkinelmer-lc-products",
        "competitor": "PerkinElmer",
        "type": "Product pages",
        "url": "https://www.perkinelmer.com/category/liquid-chromatography",
        "coverage": "Liquid chromatography product portfolio",
    },
    {
        "id": "pubmed",
        "competitor": "All",
        "type": "Scientific publications",
        "url": "https://pubmed.ncbi.nlm.nih.gov/",
        "coverage": "Peer-reviewed publication volume and metadata",
    },
    {
        "id": "sec",
        "competitor": "Public-company parents",
        "type": "Investor relations / SEC filings",
        "url": "https://www.sec.gov/edgar/search/",
        "coverage": "10-K, 10-Q, and 8-K strategic disclosure activity",
    },
]

INTERNAL_CONNECTORS = [
    {
        "name": "Salesforce CRM",
        "status": "needs_credentials_or_export",
        "signals": ["Customer partnerships", "Reference customers", "Adoption patterns", "Pipeline shifts"],
        "minimum_fields": ["account", "segment", "region", "technology", "competitor", "stage", "close_date", "notes"],
    },
    {
        "name": "Customer feedback",
        "status": "needs_export",
        "signals": ["VOC inputs", "Feature requests", "Customer feedback themes"],
        "minimum_fields": ["date", "account_segment", "region", "product", "theme", "sentiment", "verbatim"],
    },
    {
        "name": "Service feedback",
        "status": "needs_export",
        "signals": ["Service feedback", "Escalation trends", "Reliability pain points"],
        "minimum_fields": ["date", "product", "issue_type", "severity", "region", "resolution_time_days"],
    },
]


class TitleParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_title = False
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.in_title = tag.lower() == "title"

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.parts.append(data.strip())

    @property
    def title(self) -> str:
        return re.sub(r"\s+", " ", " ".join(self.parts)).strip()


def fetch(url: str, timeout: int = 20) -> tuple[int | None, bytes]:
    command = [
        "curl",
        "-L",
        "-sS",
        "--max-time",
        str(timeout),
        "-A",
        USER_AGENT,
        "-H",
        "Accept: application/json,text/html",
        "-w",
        "\n%{http_code}",
        url,
    ]
    try:
        result = subprocess.run(command, check=False, capture_output=True, timeout=timeout + 3)
    except Exception:
        return None, b""
    if not result.stdout:
        return None, b""
    body, _, status_text = result.stdout.rpartition(b"\n")
    try:
        status = int(status_text.decode("ascii", errors="ignore"))
    except ValueError:
        status = None
    return status, body


def fetch_json(url: str, timeout: int = 20) -> dict:
    status, body = fetch(url, timeout=timeout)
    if status and 200 <= status < 300 and body:
        return json.loads(body.decode("utf-8", errors="replace"))
    return {}


def pubmed_count(query: str, start: date, end: date = TODAY) -> int:
    term = f'({query}) AND ("{start:%Y/%m/%d}"[Date - Publication] : "{end:%Y/%m/%d}"[Date - Publication])'
    url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?" + urllib.parse.urlencode(
        {"db": "pubmed", "term": term, "retmode": "json", "retmax": 0}
    )
    for attempt in range(3):
        data = fetch_json(url)
        try:
            count = int(data.get("esearchresult", {}).get("count", 0))
        except (TypeError, ValueError):
            count = 0
        if count or attempt == 2:
            return count
        time.sleep(0.4)
    return 0


def pubmed_ids(query: str, years: int = 5, retmax: int = 6) -> list[str]:
    start = TODAY - timedelta(days=365 * years)
    term = f'({query}) AND ("{start:%Y/%m/%d}"[Date - Publication] : "{TODAY:%Y/%m/%d}"[Date - Publication])'
    url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?" + urllib.parse.urlencode(
        {"db": "pubmed", "term": term, "retmode": "json", "retmax": retmax, "sort": "pub+date"}
    )
    data = fetch_json(url)
    return data.get("esearchresult", {}).get("idlist", [])


def pubmed_ids_between(query: str, start: date, end: date, retmax: int = 2) -> list[str]:
    """Return a small, auditable sample for a specific historical period."""
    term = f'({query}) AND ("{start:%Y/%m/%d}"[Date - Publication] : "{end:%Y/%m/%d}"[Date - Publication])'
    url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?" + urllib.parse.urlencode(
        {"db": "pubmed", "term": term, "retmode": "json", "retmax": retmax, "sort": "pub+date"}
    )
    data = fetch_json(url)
    return data.get("esearchresult", {}).get("idlist", [])


def three_year_periods() -> list[tuple[date, date]]:
    """Split the rolling horizon into calendar-year samples, including partial years."""
    earliest = TODAY - timedelta(days=HORIZONS["3y"])
    periods: list[tuple[date, date]] = []
    start = earliest
    while start <= TODAY:
        end = min(date(start.year, 12, 31), TODAY)
        periods.append((start, end))
        start = end + timedelta(days=1)
    return periods


def pubmed_summaries(ids: list[str]) -> list[dict]:
    if not ids:
        return []
    url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?" + urllib.parse.urlencode(
        {"db": "pubmed", "id": ",".join(ids), "retmode": "json"}
    )
    data = fetch_json(url)
    result = data.get("result", {})
    return [result.get(uid, {}) for uid in result.get("uids", []) if result.get(uid)]


def clean_pubdate(raw: str) -> str:
    match = re.search(r"\d{4}(?:\s+[A-Za-z]{3})?(?:\s+\d{1,2})?", raw or "")
    if not match:
        return f"{TODAY:%Y-%m-%d}"
    text = match.group(0)
    for fmt in ("%Y %b %d", "%Y %b", "%Y"):
        try:
            parsed = datetime.strptime(text, fmt)
            if parsed.date() > TODAY:
                return f"{TODAY:%Y-%m-%d}"
            return f"{parsed:%Y-%m-%d}"
        except ValueError:
            continue
    return f"{TODAY:%Y-%m-%d}"


def normalize_counts(counts: dict[str, int]) -> dict[str, int]:
    ordered = ["30d", "60d", "90d", "1y", "3y", "5y"]
    running_max = 0
    normalized = {}
    for label in ordered:
        running_max = max(running_max, int(counts.get(label, 0)))
        normalized[label] = running_max
    return normalized


def pubmed_counts_by_horizon(query: str) -> dict[str, int]:
    counts = {
        label: pubmed_count(query, TODAY - timedelta(days=days))
        for label, days in HORIZONS.items()
    }
    ordered = ["30d", "60d", "90d", "1y", "3y", "5y"]
    for index, label in enumerate(ordered[1:], start=1):
        previous = ordered[index - 1]
        if counts[label] < counts[previous]:
            for _ in range(2):
                retried = pubmed_count(query, TODAY - timedelta(days=HORIZONS[label]))
                counts[label] = max(counts[label], retried)
                if counts[label] >= counts[previous]:
                    break
                time.sleep(0.5)
    return normalize_counts(counts)


def infer_theme(text: str) -> tuple[str, str, str]:
    lower = text.lower()
    if any(token in lower for token in ["lipid nanoparticle", "lnp", "mrna", "rna"]):
        return "LNP and RNA therapeutics workflows", "LC-MS", "Biopharma"
    if any(token in lower for token in ["oligonucleotide", "sirna", "nucleic acid"]):
        return "Oligonucleotide and nucleic-acid analytics", "LC-MS", "Biopharma"
    if any(token in lower for token in ["pfas", "polyfluoroalkyl"]):
        return "PFAS and environmental contaminant testing", "LC-MS/MS", "Environmental"
    if any(token in lower for token in ["proteomic", "metabolomic"]):
        return "High-resolution proteomics and metabolomics", "LC-MS", "Academic"
    if any(token in lower for token in ["software", "automation", "ai"]):
        return "Lab automation and software-enabled workflows", "Software", "Pharma"
    return "Scientific application activity", "LC-MS", "Pharma"


def source_health() -> list[dict]:
    health = []
    for source in SOURCE_REGISTRY:
        status, body = fetch(source["url"], timeout=12)
        agilent_waf_challenge = source.get("competitor") == "Agilent" and status == 403
        title = ""
        if body and b"<html" in body[:1000].lower():
            parser = TitleParser()
            parser.feed(body[:150000].decode("utf-8", errors="replace"))
            title = parser.title
        health.append(
            {
                **source,
                "httpStatus": status,
                "status": "live" if (status and 200 <= status < 400) or agilent_waf_challenge else "check_needed",
                "sourceQuality": "reliable" if source.get("competitor") == "Agilent" else "standard",
                "collectionStatus": "headless_browser_required" if agilent_waf_challenge else "plain_fetch",
                "reliabilityNote": (
                    "Agilent WAF challenges do not reduce source quality; sitemap and press-release indexes remain authoritative."
                    if agilent_waf_challenge else ""
                ),
                "title": title,
                "lastChecked": f"{datetime.now().isoformat(timespec='seconds')}",
            }
        )
        time.sleep(0.15)
    return health


def collect_pubmed_signals() -> tuple[list[dict], dict]:
    signals: list[dict] = []
    trends = {"themes": [], "competitors": []}
    seen_pmids: set[str] = set()

    for competitor in COMPETITORS:
        query = " OR ".join(f'"{term}"' for term in competitor["queries"])
        counts = pubmed_counts_by_horizon(query)
        trends["competitors"].append(
            {
                "competitor": competitor["name"],
                "technology": "LC-MS",
                "counts": counts,
                "source": "PubMed",
                "query": query,
            }
        )
        # Keep representative records from every year in the supported horizon.
        # This avoids a misleading three-year selector backed only by the newest
        # handful of publications while keeping the evidence feed reviewable.
        summaries: list[dict] = []
        for period_start, period_end in three_year_periods():
            period_ids = pubmed_ids_between(query, period_start, period_end, retmax=2)
            summaries.extend(pubmed_summaries(period_ids))
            time.sleep(0.15)
        for item in summaries:
            uid = str(item.get("uid", ""))
            if not uid or uid in seen_pmids:
                continue
            seen_pmids.add(uid)
            title = re.sub(r"\s+", " ", item.get("title", "")).strip().rstrip(".")
            if not title:
                continue
            date_str = clean_pubdate(item.get("pubdate", ""))
            theme, technology, segment = infer_theme(f"{title} {item.get('fulljournalname', '')}")
            signals.append(
                {
                    "id": f"pubmed-{uid}",
                    "date": date_str,
                    "competitor": competitor["name"],
                    "category": "Scientific application intelligence",
                    "signalType": "Scientific publication",
                    "title": title,
                    "summary": f"PubMed record mentioning {competitor['name']} query terms in {item.get('fulljournalname') or item.get('source') or 'scientific literature'}.",
                    "sourceName": "PubMed",
                    "sourceUrl": f"https://pubmed.ncbi.nlm.nih.gov/{uid}/",
                    "geography": "Global",
                    "marketSegment": segment,
                    "technology": technology,
                    "theme": theme,
                    "evidenceCount": 1,
                    "intent": "Application pull-through or workflow visibility",
                }
            )
        time.sleep(0.25)

    for theme in THEMES:
        counts = pubmed_counts_by_horizon(theme["query"])
        one_year = counts["1y"]
        three_year_avg = max(round(counts["3y"] / 3, 1), 1)
        strength = min(100, int((one_year / three_year_avg) * 50))
        trends["themes"].append(
            {
                "theme": theme["name"],
                "technology": theme["technology"],
                "marketSegment": theme["segment"],
                "counts": counts,
                "strengthScore": strength,
                "source": "PubMed",
                "query": theme["query"],
            }
        )
        if one_year > 0:
            signals.append(
                {
                    "id": f"trend-{theme['id']}",
                    "date": f"{TODAY:%Y-%m-%d}",
                    "competitor": "Market-wide",
                    "category": "Market intelligence",
                    "signalType": "Publication trend",
                    "title": f"{theme['name']} shows {one_year} PubMed records in the last year",
                    "summary": f"Real PubMed count for the last year: {one_year}; five-year count: {counts['5y']}.",
                    "sourceName": "PubMed",
                    "sourceUrl": "https://pubmed.ncbi.nlm.nih.gov/",
                    "geography": "Global",
                    "marketSegment": theme["segment"],
                    "technology": theme["technology"],
                    "theme": theme["name"],
                    "evidenceCount": one_year,
                    "intent": "Market demand and application focus are increasing",
                    "recommendation": f"Assess roadmap, application notes, and GTM proof points for {theme['name'].lower()}.",
                }
            )
        time.sleep(0.25)

    return signals, trends


def collect_sec_signals() -> list[dict]:
    signals: list[dict] = []
    earliest_supported = TODAY - timedelta(days=HORIZONS["3y"])
    for competitor in COMPETITORS:
        cik = competitor.get("cik")
        if not cik:
            continue
        url = f"https://data.sec.gov/submissions/CIK{cik}.json"
        data = fetch_json(url)
        recent = data.get("filings", {}).get("recent", {})
        forms = recent.get("form", [])
        dates = recent.get("filingDate", [])
        accessions = recent.get("accessionNumber", [])
        documents = recent.get("primaryDocument", [])
        # Annual and quarterly filings provide an auditable historical spine;
        # retain only a small recent sample of 8-Ks to prevent event noise from
        # dominating competitor activity scores.
        limits = {"10-K": 3, "10-Q": 9, "8-K": 4}
        added_by_form = {form: 0 for form in limits}
        for form, filing_date, accession, document in zip(forms, dates, accessions, documents):
            if form not in limits or filing_date < earliest_supported.isoformat():
                continue
            if added_by_form[form] >= limits[form]:
                continue
            accession_path = accession.replace("-", "")
            cik_path = str(int(cik))
            filing_url = f"https://www.sec.gov/Archives/edgar/data/{cik_path}/{accession_path}/{document}"
            signals.append(
                {
                    "id": f"sec-{competitor['id']}-{accession}",
                    "date": filing_date,
                    "competitor": competitor["name"],
                    "category": "Corporate intelligence",
                    "signalType": "Investor filing",
                    "title": f"{competitor['name']} filed {form}",
                    "summary": f"Public SEC filing from {data.get('name', competitor['name'])}; useful for strategy, capital allocation, risk, and segment-language tracking.",
                    "sourceName": "SEC EDGAR",
                    "sourceUrl": filing_url,
                    "geography": "Global",
                    "marketSegment": "Pharma",
                    "technology": "Portfolio",
                    "theme": "Corporate strategy disclosure",
                    "evidenceCount": 1,
                    "intent": "Strategic disclosure or corporate event",
                    "recommendation": "Review filing language for capital-allocation priorities, segment focus, risk factors, and acquisition signals.",
                }
            )
            added_by_form[form] += 1
            if all(added_by_form[key] >= limits[key] for key in limits):
                break
        time.sleep(0.2)
    return signals


def build_recommendations(signals: list[dict], trends: dict) -> list[dict]:
    recs = []
    top_themes = sorted(trends.get("themes", []), key=lambda item: item.get("strengthScore", 0), reverse=True)[:4]
    for theme in top_themes:
        recs.append(
            {
                "title": f"Prioritize evidence review for {theme['theme']}",
                "ownerView": "Product",
                "why": f"PubMed trend strength is {theme['strengthScore']} with {theme['counts']['1y']} records in the last year.",
                "action": "Compare Waters application coverage, feature gaps, launch narratives, and roadmap capability needs.",
                "priority": "High" if theme["strengthScore"] >= 75 else "Medium",
                "technology": theme["technology"],
                "marketSegment": theme["marketSegment"],
            }
        )
    if any("LNP" in item.get("theme", "") or "RNA" in item.get("theme", "") for item in top_themes):
        recs.append(
            {
                "title": "Evaluate LNP/RNA workflow roadmap exposure",
                "ownerView": "Product",
                "why": "LNP/RNA signals can indicate strategic focus around RNA therapeutics, sample prep, separation, and MS workflows.",
                "action": "Review LNP-related roadmap coverage, application notes, workflow gaps, and differentiated product proof points.",
                "priority": "High",
                "technology": "LC-MS",
                "marketSegment": "Biopharma",
            }
        )
    return recs


def load_existing_data() -> dict:
    if not OUT.exists():
        return {}
    try:
        return json.loads(OUT.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def signal_has_prefix(signal: dict, prefixes: tuple[str, ...]) -> bool:
    return str(signal.get("id", "")).startswith(prefixes)


def deduplicate_signals(signals: list[dict]) -> list[dict]:
    deduplicated: dict[str, dict] = {}
    for signal in signals:
        signal_id = str(signal.get("id", "")).strip()
        if signal_id:
            deduplicated[signal_id] = signal
    return sorted(deduplicated.values(), key=lambda item: item.get("date", ""), reverse=True)


def main() -> None:
    existing = load_existing_data()
    existing_signals = existing.get("signals", [])
    pubmed_signals, trends = collect_pubmed_signals()
    sec_signals = collect_sec_signals()
    pubmed_refresh_ok = len(trends.get("themes", [])) >= len(THEMES) and all(
        int(theme.get("counts", {}).get("5y", 0)) > 0 for theme in trends.get("themes", [])
    )
    sec_refresh_ok = bool(sec_signals)

    if not pubmed_refresh_ok:
        pubmed_signals = [signal for signal in existing_signals if signal_has_prefix(signal, AUTOMATED_PUBMED_PREFIXES)]
        trends = existing.get("trends", trends)
    if not sec_refresh_ok:
        sec_signals = [signal for signal in existing_signals if signal_has_prefix(signal, AUTOMATED_SEC_PREFIXES)]

    curated_signals = [
        signal
        for signal in existing_signals
        if not signal_has_prefix(signal, AUTOMATED_PUBMED_PREFIXES + AUTOMATED_SEC_PREFIXES)
    ]
    signals = deduplicate_signals(curated_signals + pubmed_signals + sec_signals)
    refreshed_source_health = source_health()
    source_health_ok = any(item.get("status") == "live" for item in refreshed_source_health)
    if not source_health_ok and existing.get("sourceHealth"):
        refreshed_source_health = existing["sourceHealth"]

    data = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "asOfDate": f"{TODAY:%Y-%m-%d}",
        "competitors": [
            {key: value for key, value in competitor.items() if key != "queries"}
            for competitor in COMPETITORS
        ],
        "horizons": list(HORIZONS.keys()),
        "sourceHealth": refreshed_source_health,
        "trends": trends,
        "signals": signals,
        "recommendations": existing.get("recommendations") or build_recommendations(signals, trends),
        "refresh": {
            "cadence": "daily",
            "pubmed": "success" if pubmed_refresh_ok else "retained_last_good_data",
            "sec": "success" if sec_refresh_ok else "retained_last_good_data",
            "sourceHealth": "success" if source_health_ok else "retained_last_good_data",
            "curatedSignalsPreserved": len(curated_signals),
        },
        "notes": [
            "Scientific and market trend metrics are collected from PubMed E-utilities.",
            "Corporate intelligence for public-company parents is collected from SEC EDGAR submissions.",
            "Official product and press pages are registered and checked for availability; richer extraction can be added per source.",
            "Curated product, partnership, conference, customer-voice, and PM recommendation records are preserved during automated refreshes.",
            "This PM-focused prototype uses public external signals only.",
        ],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"Wrote {OUT}")
    print(f"Signals: {len(signals)}")
    print(f"Sources checked: {len(data['sourceHealth'])}")


if __name__ == "__main__":
    main()
