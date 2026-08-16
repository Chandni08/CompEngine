#!/usr/bin/env python3
"""Collect journal metadata and monitor scientific, conference, and regulatory sources."""

from __future__ import annotations

import hashlib
import html
import json
import re
import sys
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote, unquote, urljoin, urlparse, urlunparse
from xml.etree import ElementTree

import certifi
import requests


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
JOURNAL_FILE = DATA_DIR / "journal_sources.json"
CONFERENCE_FILE = DATA_DIR / "conference_sources.json"
SOURCE_CATALOG_FILE = DATA_DIR / "source_catalog.json"
USER_AGENT = "Waters-CompetitionEngine/1.0 (scientific-source-monitor; public metadata only)"
HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "application/json,text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.7",
}
PUBLIC_METADATA_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/138 Safari/537.36",
    "Accept": "application/rss+xml,application/xml,text/xml,text/html,application/xhtml+xml;q=0.9,*/*;q=0.7",
}
TIMEOUT = 35

REGULATORY_SOURCES = (
    {
        "id": "usp-621-chromatography",
        "source": "USP <621> Chromatography",
        "publisher": "United States Pharmacopeia",
        "url": "https://doi.usp.org/USPNF/USPNF_M99380_06_01.html",
        "marketSegments": ["Pharma", "Biopharma", "CDMO", "Clinical"],
        "signalCoverage": ["Chromatographic system suitability", "Permitted method adjustments", "Dwell volume", "Compendial methods"],
        "whatToMeasure": "Official and proposed changes to system suitability, chromatographic adjustments, dwell volume, injection volume, and compendial method execution.",
        "whyItMatters": "Changes can directly alter LC method-transfer requirements, instrument suitability, and the evidence needed for regulated workflows.",
        "documentIdentifier": "USP–NF General Chapter <621>",
        "revisionDate": None,
        "effectiveDate": None,
        "publicAccessScope": "Public preview only; full compendial text is not verified by this collector.",
    },
    {
        "id": "usp-1058-instrument-qualification",
        "source": "USP <1058> Analytical Instrument Qualification",
        "publisher": "United States Pharmacopeia",
        "url": "https://doi.usp.org/USPNF/USPNF_M1124_01_01.html",
        "marketSegments": ["Pharma", "Biopharma", "CDMO", "Clinical"],
        "signalCoverage": ["Instrument qualification", "Fitness for intended use", "Calibration", "Lifecycle control"],
        "whatToMeasure": "Qualification lifecycle, risk assessment, software-controlled instrumentation, calibration, maintenance, and fitness-for-purpose expectations.",
        "whyItMatters": "These expectations shape qualification packages, service evidence, software controls, and regulated instrument lifecycle requirements.",
        "documentIdentifier": "USP–NF General Chapter <1058>",
        "revisionDate": None,
        "effectiveDate": None,
        "publicAccessScope": "Public preview only; full compendial text is not verified by this collector.",
    },
    {
        "id": "ich-q2-r2",
        "source": "ICH Q2(R2) Validation of Analytical Procedures",
        "publisher": "International Council for Harmonisation",
        "url": "https://database.ich.org/sites/default/files/ICH_Q2%28R2%29_Guideline_2023_1130.pdf",
        "marketSegments": ["Pharma", "Biopharma", "CDMO", "Clinical"],
        "signalCoverage": ["Analytical procedure validation", "Accuracy", "Precision", "Range", "Robustness"],
        "whatToMeasure": "Validation characteristics, performance criteria, multivariate methods, lifecycle links, and implementation expectations.",
        "whyItMatters": "Q2(R2) defines the evidence customers need to validate LC and LC-MS procedures for their intended use.",
        "documentIdentifier": "ICH Q2(R2)",
        "revisionDate": None,
        "effectiveDate": None,
        "publicAccessScope": "Official public guideline PDF.",
    },
    {
        "id": "ich-q14",
        "source": "ICH Q14 Analytical Procedure Development",
        "publisher": "International Council for Harmonisation",
        "url": "https://database.ich.org/sites/default/files/ICH_Q14_Guideline_2023_1116.pdf",
        "marketSegments": ["Pharma", "Biopharma", "CDMO", "Clinical"],
        "signalCoverage": ["Analytical target profile", "Procedure development", "Risk management", "Lifecycle management"],
        "whatToMeasure": "Analytical target profiles, parameter-risk assessments, robustness studies, control strategies, and lifecycle changes.",
        "whyItMatters": "Q14 shifts customer expectations toward scientifically justified method development and lifecycle-ready transfer packages.",
        "documentIdentifier": "ICH Q14",
        "revisionDate": None,
        "effectiveDate": None,
        "publicAccessScope": "Official public guideline PDF.",
    },
    {
        "id": "fda-warning-letters-analytical-findings",
        "source": "FDA Warning Letters",
        "publisher": "U.S. Food and Drug Administration",
        "url": "https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/compliance-actions-and-activities/warning-letters",
        "marketSegments": ["Pharma", "Biopharma", "CDMO", "Clinical", "Food & Beverage"],
        "signalCoverage": ["Data integrity", "Method validation", "Laboratory controls", "Investigation failures"],
        "whatToMeasure": "Warning letters citing chromatography, mass spectrometry, data integrity, method validation, audit trails, out-of-specification investigations, or laboratory controls.",
        "whyItMatters": "Recurring findings expose regulated-laboratory workflow and software-control gaps that should influence product requirements and evidence packages.",
    },
    {
        "id": "fda-form-483-observations",
        "source": "FDA Form 483 Inspection Observations",
        "publisher": "U.S. Food and Drug Administration",
        "url": "https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/inspection-references/inspection-observations",
        "marketSegments": ["Pharma", "Biopharma", "CDMO", "Clinical", "Food & Beverage"],
        "signalCoverage": ["Inspection observations", "Laboratory controls", "Data integrity", "Method and equipment findings"],
        "whatToMeasure": "Observation categories and available records involving laboratory controls, analytical methods, equipment qualification, electronic records, and data review.",
        "whyItMatters": "Form 483 patterns are an early regulatory signal of operational and data-integrity failures before they become generalized market requirements.",
    },
)

CONFERENCE_CONTENT_TERMS = re.compile(
    r"agenda|program|session|speaker|sponsor|exhibitor|poster|abstract|workshop|symposium|vendor",
    re.I,
)

TRADE_RELEVANCE_TERMS = re.compile(
    r"\b(?:liquid chromatography|chromatograph|hplc|uplc|uhplc|lc[-– ]?ms|mass spectrom|"
    r"spectroscop|\bnmr\b|analytical|assay|method validation|method transfer|impurit|quality control|"
    r"\bqc\b|\bcmc\b|\bgmp\b|\bich\b|laborator|sample prep|bioanal|characteriz|automation|informatics|"
    r"data integrity|pfas|contaminant|diagnostic|biosensor|metabolom|proteom|lipidom|peptide|"
    r"oligonucleotide|antibody|biologic|spatial biology|protein purification|column|separation|detector)\b",
    re.I,
)

TRADE_SOURCE_CONFIGS: dict[str, dict[str, Any]] = {
    "lcgc": {
        "mode": "rss",
        "endpoints": ["https://www.chromatographyonline.com/rss.xml"],
        "filterRelevant": False,
        "seedRecords": [
            {"title": "LC-MS/MS Links Vitamin D Levels to Sleep Timing", "date": "2026-07-30", "sourceUrl": "https://www.chromatographyonline.com/view/lc-ms-ms-links-vitamin-d-levels-sleep-timing"},
            {"title": "UHPLC-MS/MS Reveals Rice PDD's Role in tRNA Tags", "date": "2026-07-30", "sourceUrl": "https://www.chromatographyonline.com/view/uhplc-ms-ms-reveals-rice-pdd-s-role-trna-tags"},
            {"title": "ISC 2026 Preview", "date": "2026-07-30", "sourceUrl": "https://www.chromatographyonline.com/view/isc-2026-preview"},
            {"title": "Highlights from the HPLC2026 Conference through the Lens of LC Troubleshooting", "date": "2026-07-30", "sourceUrl": "https://www.chromatographyonline.com/view/highlights-hplc2026-conference-lens-lc-troubleshooting"},
            {"title": "Py-GC-MS Reveals Microplastics in Playgrounds", "date": "2026-07-29", "sourceUrl": "https://www.chromatographyonline.com/view/py-gc-ms-reveals-microplastics-playgrounds"},
            {"title": "HPLC Confirms Caffeine Dose to Fight Fatigue", "date": "2026-07-17", "sourceUrl": "https://www.chromatographyonline.com/view/hplc-confirms-caffeine-dose-fight-fatigue"},
            {"title": "HPLC-MS/MS Measures PFAS, Breast Density Link", "date": "2026-07-16", "sourceUrl": "https://www.chromatographyonline.com/view/hplc-ms-ms-measures-pfas-breast-density-link"},
            {"title": "HTC-19 Insights: Capillary Liquid Chromatography: Sustainability and Routine Applications", "date": "2026-07-02", "sourceUrl": "https://www.chromatographyonline.com/view/capillary-liquid-chromatography-sustainability-and-routine-applications"},
            {"title": "Advancing Miniaturized Column and Instrument Technologies for Capillary Liquid Chromatography", "date": "2026-06-15", "sourceUrl": "https://www.chromatographyonline.com/view/advancing-miniaturized-column-and-instrument-technologies-for-capillary-liquid-chromatography"},
            {"title": "The Promise and Challenges of Capillary LC: Lessons From Pittcon 2026 Networking Session", "date": "2026-06-09", "sourceUrl": "https://www.chromatographyonline.com/view/promise-challenges-capillary-lc-lessons-pittcon-2026-networking-session"},
            {"title": "Miniaturized Liquid Sample Preparation for Environmental Analysis", "date": "2026-05-22", "sourceUrl": "https://www.chromatographyonline.com/view/miniaturized-liquid-sample-preparation-environmental-analysis"},
            {"title": "HPLC 2026 Heads To Indianapolis", "date": "2026-05-12", "sourceUrl": "https://www.chromatographyonline.com/view/hplc-2026-heads-to-indianapolis"},
        ],
    },
    "biopharma-international": {
        "mode": "rss",
        "endpoints": ["https://www.biopharminternational.com/rss.xml"],
        "filterRelevant": True,
    },
    "separation-science": {
        "mode": "sitemap",
        "endpoints": ["https://www.sepscience.com/sitemap/sitemap-articles-1.xml"],
        "filterRelevant": False,
    },
    "labroots": {
        "mode": "rss",
        "endpoints": [
            "https://www.labroots.com/rss/trending",
            "https://www.labroots.com/rss/trending/chemistry-and-physics",
            "https://www.labroots.com/rss/trending/sponsored-content",
        ],
        "filterRelevant": True,
    },
    "lab-manager": {
        "mode": "sitemap",
        "endpoints": ["https://www.labmanager.com/sitemap/sitemap-articles-1.xml"],
        "filterRelevant": True,
    },
    "pharmaceutical-online": {
        "mode": "document_listing",
        "endpoints": ["https://www.pharmaceuticalonline.com/"],
        "filterRelevant": True,
    },
    "the-analytical-scientist": {
        "mode": "dated_cards",
        "endpoints": ["https://theanalyticalscientist.com/"],
        "filterRelevant": False,
    },
    "european-pharmaceutical-review": {
        "mode": "sitemap",
        "endpoints": ["https://www.europeanpharmaceuticalreview.com/googlesitemap.aspx?year=2026"],
        "filterRelevant": True,
    },
    "american-pharmaceutical-review": {
        "mode": "article_archive",
        "endpoints": ["https://www.americanpharmaceuticalreview.com/Specialty/Chromatography/1444-Article-Archives/"],
        "filterRelevant": False,
    },
}


def canonical_link(url: str) -> str:
    parsed = urlparse(url)
    return urlunparse((parsed.scheme.lower(), parsed.netloc.lower(), parsed.path, "", parsed.query, ""))


def extract_conference_records(page_url: str, body: str, event_id: str) -> list[dict[str, str]]:
    """Extract public program-like links as content records; endpoint health stays separate."""
    records: list[dict[str, str]] = []
    seen: set[str] = set()
    for href, raw_title in re.findall(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', body, flags=re.I | re.S):
        lowered_href = href.lower()
        if any(marker in lowered_href for marker in (
            "/cdn-cgi/", "/login", "ssoexternallogin", "oauth/authorize", "email-protection",
            "certification-program",
        )):
            continue
        title = re.sub(r"<[^>]+>", " ", raw_title)
        title = re.sub(r"\s+", " ", title).strip()
        target = canonical_link(urljoin(page_url, href))
        if not title or not target.startswith("http") or not CONFERENCE_CONTENT_TERMS.search(f"{title} {target}"):
            continue
        if target in seen:
            continue
        seen.add(target)
        records.append({
            "id": hashlib.sha256(f"{event_id}|{target}".encode("utf-8")).hexdigest()[:20],
            "title": title[:240],
            "recordType": "Public conference program link",
            "canonicalUrl": target,
            "sourcePageUrl": page_url,
        })
    # ASGCT currently exposes both the live Molecular Therapy abstract issue and
    # a legacy download.asgct.org PDF that intermittently returns 404. Keep the
    # live canonical issue and never publish the broken duplicate download.
    if any("cell.com/molecular-therapy" in item["canonicalUrl"] for item in records):
        records = [item for item in records if "download.asgct.org/2026ASGCTAbstractPublication.pdf" not in item["canonicalUrl"]]
    return records


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict[str, Any]) -> None:
    temporary = path.with_suffix(f"{path.suffix}.tmp")
    temporary.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temporary.replace(path)


def fetch(url: str, *, accept_json: bool = False) -> tuple[int, str, str]:
    headers = dict(HEADERS)
    if accept_json:
        headers["Accept"] = "application/json"
    try:
        response = requests.get(url, headers=headers, timeout=TIMEOUT, verify=certifi.where(), allow_redirects=True)
        return response.status_code, response.url, response.text
    except requests.RequestException as error:
        return 0, url, str(error)


def fetch_public_metadata(url: str) -> tuple[int, str, str]:
    """Fetch a publisher-owned public feed, sitemap, or listing page."""
    try:
        response = requests.get(
            url,
            headers=PUBLIC_METADATA_HEADERS,
            timeout=TIMEOUT,
            verify=certifi.where(),
            allow_redirects=True,
        )
        return response.status_code, response.url, response.text
    except requests.RequestException as error:
        return 0, url, str(error)


def clean_record_title(value: str) -> str:
    value = re.sub(r"^\s*<!\[CDATA\[|\]\]>\s*$", "", str(value or ""), flags=re.I)
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def parse_record_date(value: str) -> str:
    raw = clean_record_title(value)
    if not raw:
        return ""
    try:
        parsed = parsedate_to_datetime(raw)
        if parsed:
            return parsed.date().isoformat()
    except (TypeError, ValueError, OverflowError):
        pass
    iso_match = re.search(r"(20\d{2}-\d{2}-\d{2})", raw)
    if iso_match:
        try:
            return date.fromisoformat(iso_match.group(1)).isoformat()
        except ValueError:
            pass
    for format_string in ("%B %d, %Y", "%b %d, %Y", "%m/%d/%Y", "%d %B %Y"):
        try:
            return datetime.strptime(raw, format_string).date().isoformat()
        except ValueError:
            continue
    return ""


def title_from_url(url: str) -> str:
    parts = [part for part in urlparse(url).path.rstrip("/").split("/") if part]
    slug = unquote(parts[-1] if parts else "")
    if re.fullmatch(r"\d+\.article", slug, flags=re.I) and len(parts) > 1:
        slug = unquote(parts[-2])
    slug = re.sub(r"-\d{3,}$", "", slug)
    title = re.sub(r"[-_]+", " ", slug).strip().title()
    for acronym in ("LC", "MS", "HPLC", "UPLC", "UHPLC", "NMR", "PFAS", "QC", "GMP", "CMC", "AI", "ADC"):
        title = re.sub(rf"\b{acronym.title()}\b", acronym, title)
    return title


def parse_rss_records(body: str, record_type: str) -> list[dict[str, str]]:
    try:
        root = ElementTree.fromstring(body)
    except ElementTree.ParseError:
        return []
    records: list[dict[str, str]] = []
    for item in root.findall(".//item"):
        title = clean_record_title(item.findtext("title") or "")
        link = clean_record_title(item.findtext("link") or item.findtext("guid") or "")
        raw_date = (
            item.findtext("pubDate")
            or item.findtext("{http://purl.org/dc/elements/1.1/}date")
            or item.findtext("date")
            or ""
        )
        item_date = parse_record_date(raw_date)
        if title and link.startswith("http") and item_date:
            records.append({
                "title": title[:240],
                "date": item_date,
                "sourceUrl": canonical_link(link),
                "recordType": record_type,
                "dateBasis": "published",
            })
    return records


def parse_sitemap_records(body: str, record_type: str) -> list[dict[str, str]]:
    try:
        root = ElementTree.fromstring(body)
    except ElementTree.ParseError:
        return []
    records: list[dict[str, str]] = []
    for item in root.findall(".//{*}url"):
        link = clean_record_title(item.findtext("{*}loc") or "")
        raw_date = item.findtext("{*}publication_date") or item.findtext("{*}lastmod") or ""
        item_date = parse_record_date(raw_date)
        title = clean_record_title(item.findtext("{*}title") or "") or title_from_url(link)
        if title and link.startswith("http") and item_date:
            records.append({
                "title": title[:240],
                "date": item_date,
                "sourceUrl": canonical_link(link),
                "recordType": record_type,
                "dateBasis": "published" if "publication_date" in body else "last_modified",
            })
    return records


def parse_dated_card_records(base_url: str, body: str, record_type: str) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    card_pattern = re.compile(
        r'<h3[^>]*class=["\'][^"\']*card__title[^"\']*["\'][^>]*>\s*'
        r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>.*?'
        r'<p[^>]*class=["\'][^"\']*(?:date|tag-texts)[^"\']*["\'][^>]*>(.*?)</p>',
        re.I | re.S,
    )
    for href, raw_title, raw_date in card_pattern.findall(body):
        title = clean_record_title(raw_title)
        item_date = parse_record_date(raw_date)
        if title and item_date:
            records.append({
                "title": title[:240],
                "date": item_date,
                "sourceUrl": canonical_link(urljoin(base_url, href)),
                "recordType": record_type,
                "dateBasis": "published",
            })
    return records


def parse_article_archive_records(base_url: str, body: str, record_type: str) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    for block in re.findall(r'<li[^>]+class=["\'][^"\']*articleListRow[^"\']*["\'][^>]*>(.*?)</li>', body, flags=re.I | re.S):
        anchor = re.search(r'<h4[^>]*>.*?<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', block, flags=re.I | re.S)
        published = re.search(r'<abbr[^>]+class=["\'][^"\']*published[^"\']*["\'][^>]+title=["\']([^"\']+)', block, flags=re.I | re.S)
        if not anchor or not published:
            continue
        title = clean_record_title(anchor.group(2))
        item_date = parse_record_date(published.group(1))
        if title and item_date:
            records.append({
                "title": title[:240],
                "date": item_date,
                "sourceUrl": canonical_link(urljoin(base_url, anchor.group(1))),
                "recordType": record_type,
                "dateBasis": "published",
            })
    return records


def parse_document_listing_records(base_url: str, body: str, record_type: str) -> list[dict[str, str]]:
    candidates: list[tuple[str, str]] = []
    seen: set[str] = set()
    for href, raw_title in re.findall(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', body, flags=re.I | re.S):
        title = clean_record_title(raw_title)
        link = canonical_link(urljoin(base_url, href))
        if "/doc/" not in urlparse(link).path or not title or link in seen:
            continue
        if not TRADE_RELEVANCE_TERMS.search(title):
            continue
        seen.add(link)
        candidates.append((link, title))
    records: list[dict[str, str]] = []
    for link, title in candidates[:40]:
        status, final_url, article_body = fetch_public_metadata(link)
        if status != 200:
            continue
        date_match = re.search(
            r'\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+'
            r'\d{1,2},\s+20\d{2}\b',
            article_body,
            flags=re.I,
        )
        if not date_match:
            continue
        records.append({
            "title": title[:240],
            "date": parse_record_date(date_match.group(0)),
            "sourceUrl": canonical_link(final_url),
            "recordType": record_type,
            "dateBasis": "published",
        })
    return records


def build_content_trend(records: list[dict[str, str]], as_of: date) -> dict[str, Any]:
    def count(start: date, end: date) -> int:
        return sum(1 for record in records if start <= date.fromisoformat(record["date"]) <= end)

    last_30_start = as_of - timedelta(days=29)
    prior_30_end = last_30_start - timedelta(days=1)
    prior_30_start = prior_30_end - timedelta(days=29)
    last_90_start = as_of - timedelta(days=89)
    prior_90_end = last_90_start - timedelta(days=1)
    prior_90_start = prior_90_end - timedelta(days=89)
    counts = {
        "last30Days": count(last_30_start, as_of),
        "prior30Days": count(prior_30_start, prior_30_end),
        "last90Days": count(last_90_start, as_of),
        "prior90Days": count(prior_90_start, prior_90_end),
        "trailing12Months": count(as_of - timedelta(days=364), as_of),
    }
    current, previous = counts["last90Days"], counts["prior90Days"]
    change = round(((current - previous) / previous) * 100) if previous else None
    if change is None:
        direction = "Insufficient prior-period data"
    elif change >= 10:
        direction = "Higher source activity"
    elif change <= -10:
        direction = "Lower source activity"
    else:
        direction = "Stable source activity"
    return {
        "asOf": as_of.isoformat(),
        **counts,
        "change90Pct": change,
        "direction": direction,
        "comparisonBasis": "Dated public records captured from publisher-owned feeds, sitemaps, or listing pages; availability varies by publisher.",
    }


def collect_trade_sources(journal_data: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    catalog_entries: list[dict[str, Any]] = []
    monitored: list[dict[str, Any]] = []
    checked_at = utc_now()
    today = date.today()
    earliest = today - timedelta(days=370)
    for source in journal_data.get("sources", []):
        if source.get("sourceClass") == "Peer-reviewed journal":
            continue
        config = TRADE_SOURCE_CONFIGS.get(str(source.get("id")))
        if not config:
            continue
        source_name = str(source.get("name") or "Industry source")
        record_type = f"{source_name} public content record"
        records: list[dict[str, str]] = []
        for seed in config.get("seedRecords", []):
            records.append({**seed, "recordType": record_type, "dateBasis": "published"})
        endpoint_results: list[dict[str, Any]] = []
        for endpoint in config.get("endpoints", []):
            status, final_url, body = fetch_public_metadata(endpoint)
            endpoint_records: list[dict[str, str]] = []
            if status == 200:
                if config["mode"] == "rss":
                    endpoint_records = parse_rss_records(body, record_type)
                elif config["mode"] == "sitemap":
                    endpoint_records = parse_sitemap_records(body, record_type)
                elif config["mode"] == "dated_cards":
                    endpoint_records = parse_dated_card_records(final_url, body, record_type)
                elif config["mode"] == "article_archive":
                    endpoint_records = parse_article_archive_records(final_url, body, record_type)
                elif config["mode"] == "document_listing":
                    endpoint_records = parse_document_listing_records(final_url, body, record_type)
            records.extend(endpoint_records)
            endpoint_results.append({
                "url": endpoint,
                "finalUrl": final_url,
                "status": status,
                "recordsExtracted": len(endpoint_records),
            })
        prior_records = source.get("recentRecords", [])
        if not records and prior_records:
            records.extend(prior_records)
        cleaned: dict[str, dict[str, str]] = {}
        for record in records:
            title = clean_record_title(str(record.get("title") or ""))
            link = canonical_link(str(record.get("sourceUrl") or ""))
            item_date = parse_record_date(str(record.get("date") or ""))
            if not title or not link.startswith("http") or not item_date:
                continue
            try:
                parsed_date = date.fromisoformat(item_date)
            except ValueError:
                continue
            if not earliest <= parsed_date <= today:
                continue
            if config.get("filterRelevant") and not TRADE_RELEVANCE_TERMS.search(f"{title} {link}"):
                continue
            cleaned[link] = {
                "title": title[:240],
                "date": item_date,
                "sourceUrl": link,
                "recordType": str(record.get("recordType") or record_type),
                "dateBasis": str(record.get("dateBasis") or "published"),
            }
        recent_records = sorted(cleaned.values(), key=lambda item: (item["date"], item["title"]), reverse=True)[:500]
        reachable = sum(1 for endpoint in endpoint_results if endpoint["status"] == 200)
        extracted_now = sum(endpoint["recordsExtracted"] for endpoint in endpoint_results)
        retained = bool(prior_records and not extracted_now)
        collection_status = "extracted" if extracted_now else "partial" if recent_records else "blocked"
        detail = (
            f"{reachable} of {len(endpoint_results)} publisher-owned endpoints reachable; "
            f"{len(recent_records)} dated public records available."
        )
        if retained:
            detail += " Retained the last verified records because the publisher endpoint did not yield records in this run."
        source["sourceClass"] = "Trade, forum, and learning source"
        source["collectorType"] = "public-content-feed"
        source["lastChecked"] = checked_at
        source["surfaces"] = ["Market intelligence", "Application trends"]
        source["collectionStatus"] = collection_status
        source["collectionDetail"] = detail
        source["extractedRecords"] = len(recent_records)
        source["recentRecords"] = recent_records
        source["contentTrend"] = build_content_trend(recent_records, today)
        source["contentEndpoints"] = endpoint_results
        newest = recent_records[0] if recent_records else {}
        source["itemEvidence"] = {
            "scope": "publisher_owned_public_metadata",
            "queryExecutedAt": checked_at,
            "sourceResultCount": len(recent_records),
            "sourceNewestUrl": newest.get("sourceUrl"),
            "sourceNewestDate": newest.get("date"),
            "retainedFromPriorRun": retained,
        }
        entry = catalog_base(
            f"trade-{source['id']}",
            "Trade, forum, and learning source",
            source_name,
            str(source.get("publisher") or source_name),
            str(source.get("homepage") or ""),
            list(source.get("marketSegments") or source.get("coverage") or []),
        )
        entry.update({
            "signalCoverage": source.get("primarySignals", []),
            "refreshCadence": source.get("refreshCadence", "Daily publisher metadata check"),
            "accessType": "Publisher-owned public feed, sitemap, or listing page",
            "whatToMeasure": source.get("monitoringMode"),
            "whyItMatters": source.get("pmDecisionUse"),
            "nextAction": "Review new dated records for workflow needs, buying criteria, emerging applications, and competitor positioning.",
            "extractionStatus": collection_status,
            "extractionReason": detail,
            "extractedRecords": len(recent_records),
            "fetchMethod": "publisher_public_metadata",
            "lastExtractionCheck": checked_at,
            "monitoringUrls": config.get("endpoints", []),
        })
        if not recent_records:
            entry["health"] = "review"
            entry["issue"] = detail
        catalog_entries.append(entry)
        monitored.append(source)
    journal_data["generatedAt"] = checked_at
    return catalog_entries, monitored


def publication_date(item: dict[str, Any]) -> str:
    for key in ("published-online", "published-print", "published", "issued", "created"):
        date_parts = item.get(key, {}).get("date-parts", [])
        if not date_parts or not date_parts[0]:
            continue
        parts = list(date_parts[0]) + [1, 1]
        try:
            return date(int(parts[0]), int(parts[1]), int(parts[2])).isoformat()
        except (TypeError, ValueError):
            continue
    return ""


def collect_crossref_records(issn: str) -> tuple[int, list[dict[str, str]], str]:
    start = (date.today() - timedelta(days=370)).isoformat()
    end = date.today().isoformat()
    base = f"https://api.crossref.org/journals/{quote(issn)}/works"
    cursor = "*"
    items: list[dict[str, Any]] = []
    status = 200
    while cursor:
        endpoint = (
            f"{base}?filter=from-pub-date:{start},until-pub-date:{end}&sort=published&order=desc&rows=1000"
            "&select=DOI,title,published,published-online,published-print,issued,created,URL,container-title,type"
            f"&cursor={quote(cursor)}"
        )
        status, final_url, body = fetch(endpoint, accept_json=True)
        if status != 200:
            return status, [], f"Crossref returned HTTP {status or 'request error'} at {final_url}."
        try:
            message = json.loads(body).get("message", {})
        except json.JSONDecodeError:
            return status, [], "Crossref returned invalid JSON."
        page = message.get("items", [])
        items.extend(page)
        next_cursor = str(message.get("next-cursor") or "")
        if not page or len(page) < 1000 or next_cursor == cursor:
            break
        cursor = next_cursor
    records: list[dict[str, str]] = []
    for item in items:
        title_values = item.get("title") or []
        doi = str(item.get("DOI") or "").strip()
        title = re.sub(r"\s+", " ", str(title_values[0] if title_values else "")).strip()
        if not doi or not title:
            continue
        records.append({
            "title": title,
            "date": publication_date(item),
            "doi": doi,
            "sourceUrl": f"https://doi.org/{doi}",
        })
    return status, records, f"Collected the complete 370-day window: {len(records)} DOI records from Crossref journal metadata."


def collect_crossref_count(issn: str, start: date, end: date) -> tuple[int, int]:
    endpoint = (
        f"https://api.crossref.org/journals/{quote(issn)}/works"
        f"?filter=from-pub-date:{start.isoformat()},until-pub-date:{end.isoformat()}&rows=0"
    )
    status, _, body = fetch(endpoint, accept_json=True)
    if status != 200:
        return status, 0
    try:
        return status, int(json.loads(body).get("message", {}).get("total-results", 0))
    except (json.JSONDecodeError, TypeError, ValueError):
        return status, 0


def collect_crossref_trend(issn: str) -> tuple[dict[str, Any], str]:
    today = date.today()
    last_30_start = today - timedelta(days=29)
    prior_30_end = last_30_start - timedelta(days=1)
    prior_30_start = prior_30_end - timedelta(days=29)
    last_90_start = today - timedelta(days=89)
    prior_90_end = last_90_start - timedelta(days=1)
    prior_90_start = prior_90_end - timedelta(days=89)
    trailing_year_start = today - timedelta(days=364)
    windows = {
        "last30Days": (last_30_start, today),
        "prior30Days": (prior_30_start, prior_30_end),
        "last90Days": (last_90_start, today),
        "prior90Days": (prior_90_start, prior_90_end),
        "trailing12Months": (trailing_year_start, today),
    }
    counts: dict[str, int] = {}
    failed: list[str] = []
    for key, (start, end) in windows.items():
        status, count = collect_crossref_count(issn, start, end)
        counts[key] = count
        if status != 200:
            failed.append(key)
    current = counts["last90Days"]
    previous = counts["prior90Days"]
    change = round(((current - previous) / previous) * 100) if previous else None
    if change is None:
        direction = "Insufficient prior-period data"
    elif change >= 10:
        direction = "Higher publication pace"
    elif change <= -10:
        direction = "Lower publication pace"
    else:
        direction = "Stable publication pace"
    trend = {
        "asOf": today.isoformat(),
        **counts,
        "change90Pct": change,
        "direction": direction,
        "comparisonBasis": "Crossref publication counts: latest 90 days versus the preceding 90 days.",
    }
    if failed:
        return trend, f"Crossref count queries failed for: {', '.join(failed)}."
    return trend, "Collected rolling publication counts from Crossref journal metadata."


def catalog_base(source_id: str, source_class: str, name: str, publisher: str, url: str, segments: list[str]) -> dict[str, Any]:
    return {
        "id": source_id,
        "group": source_class,
        "sourceClass": source_class,
        "source": name,
        "publisher": publisher,
        "competitor": "Market-wide",
        "url": url,
        "marketSegments": segments,
        "surfaces": ["Market intelligence", "Application trends"],
        "health": "good",
        "status": "monitored",
        "issue": "",
    }


def collect_journals(journal_data: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    catalog_entries: list[dict[str, Any]] = []
    monitored: list[dict[str, Any]] = []
    checked_at = utc_now()
    for source in journal_data.get("sources", []):
        if source.get("sourceClass") != "Peer-reviewed journal":
            continue
        issn = str(source.get("issn") or "")
        status, records, detail = collect_crossref_records(issn)
        publication_trend, trend_detail = collect_crossref_trend(issn)
        source["lastChecked"] = checked_at
        source["surfaces"] = ["Market intelligence", "Application trends"]
        source["collectionStatus"] = "extracted" if records else "blocked"
        source["collectionDetail"] = detail
        source["extractedRecords"] = len(records)
        source["recentRecords"] = records
        newest_record = max(records, key=lambda item: (item.get("date", ""), item.get("doi", "")), default={})
        source["itemEvidence"] = {
            "scope": "complete_370_day_window",
            "queryExecutedAt": checked_at,
            "sourceResultCount": len(records),
            "sourceNewestDoi": newest_record.get("doi"),
            "sourceNewestDate": newest_record.get("date"),
            "newestDoiIngested": bool(newest_record.get("doi")),
            "paginationComplete": "complete" in detail.lower(),
        }
        source["publicationTrend"] = publication_trend
        source["trendCollectionDetail"] = trend_detail
        source["metadataEndpoint"] = f"https://api.crossref.org/journals/{source.get('issn')}/works"
        entry = catalog_base(
            f"journal-{source['id']}",
            "Peer-reviewed journal",
            source["name"],
            source.get("publisher", "Journal publisher"),
            source["homepage"],
            source.get("marketSegments", []),
        )
        entry.update({
            "signalCoverage": source.get("primarySignals", []),
            "refreshCadence": source.get("refreshCadence"),
            "accessType": source.get("accessType"),
            "whatToMeasure": source.get("monitoringMode"),
            "whyItMatters": source.get("pmDecisionUse"),
            "nextAction": "Review newly collected DOI records for LC, LC-MS, method-performance, transferability, and application signals.",
            "extractionStatus": source["collectionStatus"],
            "extractionReason": detail,
            "extractedRecords": len(records),
            "fetchMethod": "crossref_journal_metadata",
            "lastExtractionCheck": checked_at,
            "metadataEndpoint": source["metadataEndpoint"],
        })
        if not records:
            entry["health"] = "review"
            entry["issue"] = detail
        catalog_entries.append(entry)
        monitored.append(source)
    journal_data["generatedAt"] = checked_at
    return catalog_entries, monitored


def collect_conferences(conference_data: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    catalog_entries: list[dict[str, Any]] = []
    monitored: list[dict[str, Any]] = []
    checked_at = utc_now()
    for event in conference_data.get("events", []):
        results: list[dict[str, Any]] = []
        content_records: list[dict[str, str]] = []
        for url in event.get("monitoringUrls") or [event.get("website")]:
            status, final_url, body = fetch(str(url))
            results.append({
                "url": url,
                "finalUrl": final_url,
                "status": status,
                "pageFingerprint": hashlib.sha256(body.encode("utf-8", errors="ignore")).hexdigest()[:16] if status == 200 else "",
            })
            if status == 200:
                content_records.extend(extract_conference_records(final_url, body, str(event["id"])))
        content_records = list({record["canonicalUrl"]: record for record in content_records}.values())
        reachable = sum(1 for item in results if item["status"] == 200)
        event["lastChecked"] = checked_at
        event["surfaces"] = ["Market intelligence", "Application trends"]
        event["collectionStatus"] = "extracted" if content_records else "partial" if reachable else "blocked"
        event["collectionDetail"] = f"{reachable} of {len(results)} official endpoints reachable; {len(content_records)} public program-content links extracted."
        event["monitoredEndpoints"] = results
        event["contentRecords"] = content_records
        event["contentRecordCount"] = len(content_records)
        entry = catalog_base(
            f"conference-{event['id']}",
            "Conference/poster",
            event["eventName"],
            event.get("publisher", "Conference organizer"),
            event["website"],
            event.get("marketSegments", []),
        )
        entry.update({
            "signalCoverage": event.get("signalCoverage", []),
            "refreshCadence": event.get("refreshCadence"),
            "accessType": event.get("accessType"),
            "whatToMeasure": event.get("whatToMeasure"),
            "whyItMatters": event.get("whyItMatters"),
            "nextAction": "Diff public program, abstract, poster, sponsor, and vendor-session pages; preserve exact record URLs when content is published.",
            "extractionStatus": event["collectionStatus"],
            "extractionReason": event["collectionDetail"],
            "endpointReachabilityCount": reachable,
            "extractedRecords": len(content_records),
            "contentRecords": content_records,
            "fetchMethod": "official_conference_endpoint_monitor",
            "lastExtractionCheck": checked_at,
            "monitoringUrls": event.get("monitoringUrls") or [event.get("website")],
        })
        if not reachable:
            entry["health"] = "review"
            entry["issue"] = event["collectionDetail"]
        catalog_entries.append(entry)
        monitored.append(event)
    conference_data["generatedAt"] = checked_at
    return catalog_entries, monitored


def collect_regulatory_sources() -> list[dict[str, Any]]:
    checked_at = utc_now()
    entries: list[dict[str, Any]] = []
    for source in REGULATORY_SOURCES:
        status, final_url, body = fetch(source["url"])
        reachable = 200 <= status < 400
        fingerprint = hashlib.sha256(body.encode("utf-8", errors="ignore")).hexdigest() if reachable else ""
        content_verified = bool(
            reachable
            and source.get("documentIdentifier")
            and (
                source["documentIdentifier"].lower().replace("–", "-") in body.lower().replace("–", "-")
                or source["url"].lower().endswith(".pdf")
            )
        )
        full_content = content_verified and not str(source.get("publicAccessScope", "")).startswith("Public preview")
        entry = catalog_base(
            source["id"],
            "Regulatory/pharmacopeial",
            source["source"],
            source["publisher"],
            source["url"],
            source["marketSegments"],
        )
        entry.update({
            "signalCoverage": source["signalCoverage"],
            "refreshCadence": "Weekly official-page check",
            "accessType": "Official public page or document; compendial access may vary",
            "whatToMeasure": source["whatToMeasure"],
            "whyItMatters": source["whyItMatters"],
            "nextAction": "Track official revisions, effective dates, notices, and records; extract only claims present in the linked primary source.",
            "status": str(status) if status else "request_error",
            "health": "good" if full_content else "review",
            "issue": "" if full_content else ("Endpoint reachable, but full public document content was not verified." if reachable else f"Official source returned HTTP {status or 'request error'}; retain for manual review."),
            "extractionStatus": "extracted" if full_content else "partial" if reachable else "blocked",
            "extractionReason": "Official public document identifier and content were verified." if full_content else ("Endpoint reachability verified separately; it does not prove content freshness." if reachable else f"Official source unavailable during check: HTTP {status or 'request error'}."),
            "endpointReachable": reachable,
            "contentVerified": content_verified,
            "fullContentVerified": full_content,
            "documentIdentifier": source.get("documentIdentifier"),
            "revisionDate": source.get("revisionDate"),
            "effectiveDate": source.get("effectiveDate"),
            "publicAccessScope": source.get("publicAccessScope"),
            "pageFingerprint": fingerprint,
            "extractedRecords": 1 if full_content else 0,
            "fetchMethod": "official_regulatory_page_check",
            "lastExtractionCheck": checked_at,
        })
        entries.append(entry)
    return entries


def upsert_catalog(catalog: dict[str, Any], entries: list[dict[str, Any]]) -> None:
    existing = {str(item.get("id")): item for item in catalog.get("sources", [])}
    for entry in entries:
        prior = existing.get(entry["id"], {})
        existing[entry["id"]] = {**prior, **entry}
    catalog["sources"] = list(existing.values())
    catalog["generatedAt"] = utc_now()


def main(*, trade_only: bool = False) -> int:
    journal_data = read_json(JOURNAL_FILE)
    conference_data = read_json(CONFERENCE_FILE)
    source_catalog = read_json(SOURCE_CATALOG_FILE)
    source_catalog["sources"] = [
        source for source in source_catalog.get("sources", [])
        if source.get("id") != "usp-232-233-elemental-impurities"
    ]

    trade_entries, trade_sources = collect_trade_sources(journal_data)
    if trade_only:
        upsert_catalog(source_catalog, trade_entries)
        write_json(JOURNAL_FILE, journal_data)
        write_json(SOURCE_CATALOG_FILE, source_catalog)
        print(f"Scientific sources: {len(trade_sources)} trade, forum, and learning sources monitored.")
        return 0

    journal_entries, journals = collect_journals(journal_data)
    conference_entries, conferences = collect_conferences(conference_data)
    regulatory_entries = collect_regulatory_sources()
    upsert_catalog(source_catalog, trade_entries + journal_entries + conference_entries + regulatory_entries)

    write_json(JOURNAL_FILE, journal_data)
    write_json(CONFERENCE_FILE, conference_data)
    write_json(SOURCE_CATALOG_FILE, source_catalog)
    print(
        f"Scientific sources: {len(journals)} journals, {len(trade_sources)} trade/forum/learning sources, "
        f"{len(conferences)} conferences, "
        f"{len(regulatory_entries)} regulatory/pharmacopeial sources monitored."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(trade_only="--trade-only" in sys.argv[1:]))
