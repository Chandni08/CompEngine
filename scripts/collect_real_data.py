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
from datetime import date, datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path

from provenance import pubmed_esearch_url, pubmed_provenance


TODAY = date.today()
OUT = Path(__file__).resolve().parents[1] / "data" / "intelligence.json"
PUBMED_OBSERVATIONS = Path(__file__).resolve().parents[1] / "data" / "pubmed_query_observations.json"
USER_AGENT = "WatersCompetitiveIntelligenceEngine/0.2 (+https://www.waters.com/)"
AUTOMATED_PUBMED_PREFIXES = ("pubmed-", "trend-")
AUTOMATED_SEC_PREFIXES = ("sec-",)
REVVITY_Q2_2026_ACCESSION = "0000031791-26-000022"
REVVITY_Q2_2026_EXHIBIT_URL = (
    "https://www.sec.gov/Archives/edgar/data/31791/000003179126000022/"
    "q22026pressrelease.htm"
)

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
        "type": "Investor relations news",
        "url": "https://ir.thermofisher.com/investors/news-events/news/default.aspx",
        "coverage": "Earnings, investor events, corporate strategy, product, partnership, and investment announcements",
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


def pubmed_counts_with_provenance(query: str) -> tuple[dict[str, int], dict[str, dict]]:
    """Retrieve every horizon once and preserve the exact auditable query."""
    retrieved_at = datetime.now(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")
    counts: dict[str, int] = {}
    provenance: dict[str, dict] = {}
    for label, days in HORIZONS.items():
        start = TODAY - timedelta(days=days)
        count = pubmed_count(query, start)
        counts[label] = count
        provenance[label] = pubmed_provenance(query, start, TODAY, count, retrieved_at=retrieved_at)
    append_pubmed_observations(provenance.values())
    # Never repair, smooth, or normalize a retrieved count. If nested horizons
    # are inconsistent, downstream validation must fail and retain the last
    # known-good dataset rather than changing the primary observation.
    return counts, provenance


def append_pubmed_observations(observations) -> None:
    """Append immutable PubMed query observations without rewriting prior retrievals."""
    existing = {"schemaVersion": 1, "observations": []}
    if PUBMED_OBSERVATIONS.exists():
        existing = json.loads(PUBMED_OBSERVATIONS.read_text(encoding="utf-8"))
    seen = {item.get("observationID") for item in existing.get("observations", [])}
    for observation in observations:
        if observation.get("observationID") not in seen:
            existing.setdefault("observations", []).append(observation)
            seen.add(observation.get("observationID"))
    PUBMED_OBSERVATIONS.write_text(
        json.dumps(existing, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


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
        return ""
    text = match.group(0)
    for fmt in ("%Y %b %d", "%Y %b", "%Y"):
        try:
            parsed = datetime.strptime(text, fmt)
            if parsed.date() > TODAY:
                return ""
            return f"{parsed:%Y-%m-%d}"
        except ValueError:
            continue
    return ""


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
        title = ""
        if body and b"<html" in body[:1000].lower():
            parser = TitleParser()
            parser.feed(body[:150000].decode("utf-8", errors="replace"))
            title = parser.title
        health.append(
            {
                **source,
                "httpStatus": status,
                "status": "live" if status and 200 <= status < 400 else "blocked" if status in {401, 403} else "check_needed",
                "sourceQuality": "standard",
                "collectionStatus": "blocked_by_access_control" if status in {401, 403} else "plain_fetch",
                "reliabilityNote": "A blocked fetch is not counted as a healthy extraction." if status in {401, 403} else "",
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
        counts, query_provenance = pubmed_counts_with_provenance(query)
        trends["competitors"].append(
            {
                "competitor": competitor["name"],
                "technology": "LC-MS",
                "counts": counts,
                "source": "PubMed",
                "query": query,
                "queryProvenance": query_provenance,
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
            if not date_str:
                continue
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
        newest_item = max(
            (
                {"pmid": str(item.get("uid", "")), "date": clean_pubdate(item.get("pubdate", ""))}
                for item in summaries
                if item.get("uid") and clean_pubdate(item.get("pubdate", ""))
            ),
            key=lambda item: item["date"],
            default={"pmid": None, "date": None},
        )
        trends["competitors"][-1]["itemEvidence"] = {
            "scope": "representative_sample",
            "sampleStrategy": "Up to two newest PubMed records per calendar-year slice in the rolling three-year window.",
            "queryExecutedAt": query_provenance["1y"]["retrievedAt"],
            "currentResultCount": counts["1y"],
            "newestSampledPmid": newest_item["pmid"],
            "newestSampledDate": newest_item["date"],
            "newestSampledPmidIngested": bool(newest_item["pmid"] and f"pubmed-{newest_item['pmid']}" in {signal["id"] for signal in signals}),
        }
        time.sleep(0.25)

    for theme in THEMES:
        counts, query_provenance = pubmed_counts_with_provenance(theme["query"])
        one_year = counts["1y"]
        three_year_avg = max(round(counts["3y"] / 3, 1), 1)
        strength = min(100, int((one_year / three_year_avg) * 50))
        latest_ids = pubmed_ids_between(theme["query"], TODAY - timedelta(days=HORIZONS["1y"]), TODAY, retmax=1)
        latest_summaries = pubmed_summaries(latest_ids)
        latest_summary = latest_summaries[0] if latest_summaries else {}
        latest_pmid = str(latest_summary.get("uid") or "")
        latest_date = clean_pubdate(latest_summary.get("pubdate", ""))
        latest_ingested = False
        if latest_pmid and latest_date:
            if latest_pmid not in seen_pmids:
                title = re.sub(r"\s+", " ", latest_summary.get("title", "")).strip().rstrip(".")
                if title:
                    signals.append({
                        "id": f"pubmed-{latest_pmid}", "date": latest_date, "competitor": "Market-wide",
                        "category": "Scientific application intelligence", "signalType": "Scientific publication",
                        "title": title, "summary": f"Newest PubMed item returned for the {theme['name']} query.",
                        "sourceName": "PubMed", "sourceUrl": f"https://pubmed.ncbi.nlm.nih.gov/{latest_pmid}/",
                        "geography": "Global", "marketSegment": theme["segment"], "technology": theme["technology"],
                        "theme": theme["name"], "evidenceCount": 1, "intent": "Newest-item freshness verification",
                    })
                    seen_pmids.add(latest_pmid)
            latest_ingested = any(signal.get("id") == f"pubmed-{latest_pmid}" for signal in signals)
        trends["themes"].append(
            {
                "theme": theme["name"],
                "technology": theme["technology"],
                "marketSegment": theme["segment"],
                "counts": counts,
                "strengthScore": strength,
                "source": "PubMed",
                "query": theme["query"],
                "queryProvenance": query_provenance,
                "itemEvidence": {
                    "scope": "representative_sample",
                    "sampleStrategy": "Newest item in the one-year query plus aggregate counts for every configured horizon.",
                    "queryExecutedAt": query_provenance["1y"]["retrievedAt"],
                    "currentResultCount": one_year,
                    "newestPmid": latest_pmid or None,
                    "newestDate": latest_date or None,
                    "newestPmidIngested": latest_ingested,
                },
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
                    "sourceUrl": query_provenance["1y"]["resultsUrl"],
                    "sourceApiUrl": query_provenance["1y"]["apiUrl"],
                    "retrievedAt": query_provenance["1y"]["retrievedAt"],
                    "queryHash": query_provenance["1y"]["queryHash"],
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


def revvity_q2_2026_earnings_enrichment() -> dict:
    """Return the official Q2 result without attributing Revvity to PerkinElmer."""
    return {
        "competitor": "Revvity, Inc.",
        "registrant": "Revvity, Inc.",
        "relatedOperatingBusiness": None,
        "attributionBoundary": (
            "Revvity is the former public PerkinElmer Life Sciences and Diagnostics company. "
            "These are not financial results for the separately operated, privately held PerkinElmer business."
        ),
        "category": "Corporate intelligence",
        "signalType": "Quarterly earnings result",
        "title": "Revvity Announces Financial Results for the Second Quarter of 2026",
        "summary": (
            "Revvity reported $730 million of Q2 revenue and $1.41 of adjusted EPS. "
            "For Waters PMs, the relevant segment split was Life Sciences revenue of $359 million "
            "with pro forma organic revenue down 3%, versus Diagnostics revenue of $371 million "
            "with pro forma organic revenue up 11%."
        ),
        "earningsMetrics": [
            {"label": "Revenue", "value": "$730M", "change": "vs $720M one year ago"},
            {"label": "Adjusted EPS", "value": "$1.41", "change": "vs $1.18 one year ago"},
            {"label": "Life Sciences revenue", "value": "$359M", "change": "-3% pro forma organic"},
            {"label": "Diagnostics revenue", "value": "$371M", "change": "+11% pro forma organic"},
            {"label": "2026 revenue guidance", "value": "$2.83–$2.86B", "change": "raised; 4–5% pro forma organic"},
        ],
        "pmInsights": [
            "Demand diverged sharply by segment: Diagnostics grew 11% on a pro forma organic basis while Life Sciences declined 3%.",
            "Adjusted operating margin increased to 28.9%; the quarter included $16 million of tariff-related refunds, and management said it would reinvest a portion in growth opportunities.",
            "Revvity raised full-year guidance and agreed to divest China Immunodiagnostics for up to $200 million, sharpening the portfolio around its remaining growth priorities.",
        ],
        "watersPmImplication": (
            "Track whether Revvity's increased investment reaches life-science workflows, informatics, or customer programs, "
            "but do not use Revvity's results as evidence of current PerkinElmer financial capacity or LC share movement."
        ),
        "evidenceBoundary": (
            "Revvity does not separately report LC or chromatography revenue, units, pricing, or market share. "
            "Revvity and the current PerkinElmer business have operated separately since the March 2023 divestiture."
        ),
        "sourceName": "SEC EDGAR Exhibit 99.1",
        "sourceUrl": REVVITY_Q2_2026_EXHIBIT_URL,
        "marketSegment": "Corporate",
        "technology": "Portfolio",
        "theme": "Quarterly earnings and end-market demand",
        "intent": "Corporate performance and investment capacity",
        "recommendation": (
            "Use the segment divergence, raised guidance, and reinvestment language as Revvity context only; "
            "keep current PerkinElmer conclusions grounded in PerkinElmer-owned sources."
        ),
        "supportingExcerpt": (
            "Revenue of $730 million; pro forma revenue of $711 million; "
            "4% pro forma revenue growth; 3% pro forma organic revenue growth"
        ),
        "sourceLocation": "SEC Exhibit 99.1 release headline and opening highlights",
    }


def collect_sec_signals() -> list[dict]:
    signals: list[dict] = []
    earliest_supported = TODAY - timedelta(days=HORIZONS["3y"])
    canonical_registrants = {
        "0000313616": "Danaher Corporation",
        "0000031791": "Revvity, Inc.",
    }
    for competitor in COMPETITORS:
        cik = competitor.get("cik")
        if not cik:
            continue
        url = f"https://data.sec.gov/submissions/CIK{cik}.json"
        data = fetch_json(url)
        registrant = canonical_registrants.get(
            cik,
            re.sub(r"\s+/[A-Z]+/?$", "", str(data.get("name") or competitor["name"]), flags=re.I).strip(),
        )
        related_business = competitor["name"] if registrant.lower() != competitor["name"].lower() else None
        recent = data.get("filings", {}).get("recent", {})
        forms = recent.get("form", [])
        dates = recent.get("filingDate", [])
        accessions = recent.get("accessionNumber", [])
        documents = recent.get("primaryDocument", [])
        # Retain every in-window 8-K. Completeness is a collection concern;
        # ranking/noise control belongs in the presentation layer.
        limits = {"10-K": 10_000, "10-Q": 10_000, "8-K": 10_000}
        added_by_form = {form: 0 for form in limits}
        seen_accessions: set[str] = set()
        for form, filing_date, accession, document in zip(forms, dates, accessions, documents):
            if form not in limits or filing_date < earliest_supported.isoformat():
                continue
            if not accession or accession in seen_accessions:
                continue
            if added_by_form[form] >= limits[form]:
                continue
            seen_accessions.add(accession)
            accession_path = accession.replace("-", "")
            cik_path = str(int(cik))
            filing_url = f"https://www.sec.gov/Archives/edgar/data/{cik_path}/{accession_path}/{document}"
            signal = {
                    "id": f"sec-{competitor['id']}-{accession}",
                    "date": filing_date,
                    "competitor": registrant,
                    "registrant": registrant,
                    "relatedOperatingBusiness": related_business,
                    "attributionBoundary": (
                        f"This is a {registrant} filing. It is not attributed to {related_business} unless the cited filing passage explicitly names that operating business."
                        if related_business else "The filing is attributed to the SEC registrant."
                    ),
                    "category": "Corporate intelligence",
                    "signalType": "Investor filing",
                    "title": f"{registrant} filed {form}",
                    "summary": f"Public SEC filing by {registrant}; useful for strategy, capital allocation, risk, and segment-language tracking.",
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
            if accession == REVVITY_Q2_2026_ACCESSION:
                signal.update(revvity_q2_2026_earnings_enrichment())
            signals.append(signal)
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
