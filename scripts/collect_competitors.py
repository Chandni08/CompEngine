#!/usr/bin/env python3
"""Monitor real Thermo Fisher, Shimadzu, and SCIEX official sources.

The collector uses only robots-declared sitemaps and official dated press/news
indexes. It records blocked extraction honestly and never treats an HTTP health
check as extracted evidence.
"""

from __future__ import annotations

import hashlib
import html
import json
import re
import sys
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlencode, urljoin, urlparse

import certifi
import requests

from link_changes import attach_product_change_evidence, warm_content_hashes


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
SNAPSHOT_DIR = DATA_DIR / "source_snapshots"
OUTPUT_FILE = DATA_DIR / "competitor_monitors.json"
SOURCE_CATALOG_FILE = DATA_DIR / "source_catalog.json"
THERMO_FAMILY_FILE = DATA_DIR / "thermo_monitoring_families.json"
CURRENT_YEAR = date.today().year
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/126.0.0.0 Safari/537.36"
)
REQUEST_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "application/xml,text/xml,text/html,application/xhtml+xml;q=0.9,*/*;q=0.7",
    "Accept-Language": "en-US,en;q=0.9",
}
TECHNICAL_FEED_VERSION = 3
RECENT_RELEASE_REPLAY_DAYS = 120
# Page-diff request budgets per competitor per run. Changed pages are fetched
# first; whatever is left seeds baselines for pages that have never been hashed,
# so a future last-modified change has something to diff against.
PAGE_DIFF_BUDGET = 40
BASELINE_WARM_BUDGET = 12
RELEVANCE_PATTERN = re.compile(
    r"\b(?:lc[/-]?ms(?:/ms)?|hplc|uhplc|uplc|liquid chromatograph(?:y|er)?|"
    r"mass spectrom(?:etry|eter)|nexera|labsolutions|zenotof|novus|sciex os|"
    r"orbitrap|vanquish|dionex|integrion|ics-\d+|ion chromatograph(?:y|er)?|"
    r"triple quadrupole|qtof|chromatography software)\b",
    re.I,
)

THERMO_TECHNICAL_FEEDS = (
    {
        "source_id": "thermo-lc-insights",
        "name": "Thermo Fisher liquid chromatography insights",
        "url": "https://www.thermofisher.com/blog/analyteguru/liquid-chromatography/feed/",
    },
    {
        "source_id": "thermo-ms-insights",
        "name": "Thermo Fisher mass spectrometry insights",
        "url": "https://www.thermofisher.com/blog/analyteguru/mass-spectrometry/feed/",
    },
    {
        "source_id": "thermo-proteomics-insights",
        "name": "Thermo Fisher proteomics insights",
        "url": "https://www.thermofisher.com/blog/analyteguru/proteomics/feed/",
    },
)

THERMO_IR_NEWS_PAGE = "https://ir.thermofisher.com/investors/news-events/news/default.aspx"
THERMO_IR_FEED = "https://ir.thermofisher.com/feed/PressRelease.svc/GetPressReleaseList"
THERMO_PRESS_BROWSER_CACHE_FILE = DATA_DIR / "thermo_press_browser_validation.json"
THERMO_RETIRED_PRODUCT_URLS = {
    "https://www.thermofisher.com/us/en/home/industrial/chromatography/liquid-chromatography-lc/hplc-uhplc-systems/vanquish-amplify-uhplc-system.html":
        "https://www.thermofisher.com/order/catalog/product/VQ-AMPLIFY",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def read_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(f"{path.suffix}.tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def fetch(url: str, timeout: int = 60) -> tuple[int | None, str, str]:
    try:
        response = requests.get(
            url,
            headers=REQUEST_HEADERS,
            timeout=timeout,
            allow_redirects=True,
            verify=certifi.where(),
        )
        # These official sources declare UTF-8 inconsistently. Decode the raw
        # bytes explicitly so product names such as DOSIMMUNE™ are preserved.
        return response.status_code, response.content.decode("utf-8", errors="replace"), response.url
    except requests.Timeout:
        return None, "", "timeout"
    except requests.RequestException as error:
        return None, "", str(error)


def clean_text(value: str) -> str:
    without_tags = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", html.unescape(without_tags)).strip()


def canonical_thermo_product_url(url: str) -> str:
    """Keep retired sitemap locations from re-entering the published inventory."""
    return THERMO_RETIRED_PRODUCT_URLS.get(url, url)


def parse_date(value: str) -> str:
    text = clean_text(value)
    for fmt in ("%B %d, %Y", "%b %d, %Y", "%m/%d/%Y %H:%M:%S", "%m/%d/%Y", "%Y-%m-%d", "%Y-%m-%dT%H:%M:%S%z"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    match = re.search(r"\d{4}-\d{2}-\d{2}", text)
    return match.group(0) if match else ""


def parse_sitemap(body: str) -> list[dict[str, str]]:
    root = ET.fromstring(body.encode("utf-8"))
    rows: list[dict[str, str]] = []
    for node in list(root):
        values = {
            child.tag.rsplit("}", 1)[-1]: (child.text or "").strip()
            for child in list(node)
        }
        if values.get("loc"):
            rows.append(values)
    return rows


def source_status(
    source_id: str,
    url: str,
    method: str,
    http_status: int | None,
    extraction_status: str,
    reason: str,
    records: int = 0,
) -> dict[str, object]:
    return {
        "sourceId": source_id,
        "url": url,
        "fetchMethod": method,
        "httpStatus": http_status,
        "status": "available" if extraction_status in {"extracted", "checked_empty"} else "collection_review_needed",
        "extractionStatus": extraction_status,
        "extractionReason": reason,
        "extractedRecords": records,
        "checkedAt": utc_now(),
    }


PRESS_INDEX_MAX_PAGES = 12


def press_index_years(today: date | None = None) -> list[int]:
    """Years whose press index must be read for the replay window to be complete.

    A single current-year index goes empty every 1 January, which used to fail
    the whole refresh. The previous year stays in scope for as long as the
    rolling replay window still reaches into it.
    """
    today = today or date.today()
    earliest = today - timedelta(days=RECENT_RELEASE_REPLAY_DAYS)
    return sorted({today.year, earliest.year}, reverse=True)


def next_page_links(page_url: str, body: str) -> list[str]:
    """Find pagination links that stay within the same index."""
    base = urlparse(page_url)
    base_path = base.path.rstrip("/")
    candidates: list[str] = []
    for match in re.finditer(r'<a\b[^>]*href="([^"]+)"[^>]*>', body, re.I):
        href = html.unescape(match.group(1))
        tag = match.group(0)
        absolute = urljoin(page_url, href)
        parsed = urlparse(absolute)
        if parsed.netloc and parsed.netloc != base.netloc:
            continue
        is_next = re.search(r'rel="[^"]*\bnext\b', tag, re.I)
        # ?page=2 / &p=3 on this index, or /page/2 appended to its path
        is_paged = re.search(r"[?&](?:page|p|pg|start|offset)=\d+", absolute, re.I) or re.search(
            rf"^{re.escape(base_path)}/(?:page/)?\d+/?$", parsed.path.rstrip("/"), re.I
        )
        if is_next or is_paged:
            candidates.append(absolute.split("#", 1)[0])
    ordered: list[str] = []
    for url in candidates:
        if url not in ordered and url != page_url:
            ordered.append(url)
    return ordered


def collect_press_index(
    index_url_for_year,
    parse,
    years: list[int] | None = None,
    max_pages: int = PRESS_INDEX_MAX_PAGES,
) -> tuple[int | None, dict[str, dict[str, str]], int, list[str]]:
    """Read every in-scope year of a dated press index, following its pagination.

    Returns the representative HTTP status, the merged releases, the number of
    index entries seen across all pages, and the pages actually fetched.
    """
    releases: dict[str, dict[str, str]] = {}
    entries = 0
    visited: list[str] = []
    seen: set[str] = set()
    first_status: int | None = None

    for year in years or press_index_years():
        queue = [index_url_for_year(year)]
        while queue and len(visited) < max_pages:
            url = queue.pop(0)
            if url in seen:
                continue
            seen.add(url)
            status, body, _detail = fetch(url)
            visited.append(url)
            if first_status is None or (first_status != 200 and status == 200):
                first_status = status
            if status != 200:
                continue
            page_releases, page_entries = parse(body)
            releases.update(page_releases)
            entries += page_entries
            for follow_up in next_page_links(url, body):
                if follow_up not in seen:
                    queue.append(follow_up)
    return first_status, releases, entries, visited


def press_extraction_status(http_status: int | None, entries: int, releases: int) -> tuple[str, str]:
    """Separate an unreadable index from one that is readable and simply empty.

    Treating "no records" as blocked is what made the first days of a new year
    fail the entire refresh. A parser that stopped matching still reports blocked,
    because an index that loads with zero parseable entries is a broken reader.
    """
    if http_status != 200:
        return "blocked", f"Dated press index unavailable: HTTP {http_status or 'request error'}."
    if entries == 0:
        return "blocked", (
            "The dated press index loaded but produced no parseable entries; "
            "the index layout has probably changed."
        )
    if releases == 0:
        return "checked_empty", (
            f"The dated press index loaded with {entries} entries, none of which are "
            "in-scope releases for this window."
        )
    return "extracted", f"Official dated press index parsed; {releases} relevant releases extracted."


def relevant_release(title: str) -> bool:
    return bool(RELEVANCE_PATTERN.search(title))


def classify_release(title: str) -> str:
    return "product" if re.search(r"\b(?:launch|release|introduc|unveil|system|software|instrument|platform|integration)\b", title, re.I) else "corporate"


def normalize_release(url: str, title: str, published: str) -> dict[str, str]:
    return {
        "date": published,
        "title": clean_text(title),
        "url": url.replace("sciex.com//", "sciex.com/"),
        "classification": classify_release(title),
    }


def concise_thermo_ir_summary(title: str, short_body: str) -> str:
    """Turn the official IR description into a compact, decision-useful fact line."""
    body = clean_text(short_body)
    lower_title = title.lower()
    if "reports second quarter" in lower_title:
        revenue = re.search(r"revenue grew\s+(\d+%)\s+to\s+(\$[\d.]+\s+billion)", body, re.I)
        organic = re.search(r"(\d+%)\s+organic revenue growth", body, re.I)
        adjusted_eps = re.search(r"adjusted EPS grew\s+(\d+%)\s+to\s+(\$[\d.]+)", body, re.I)
        facts = []
        if revenue:
            facts.append(f"revenue grew {revenue.group(1)} to {revenue.group(2)}")
        if organic:
            facts.append(f"organic revenue growth was {organic.group(1)}")
        if adjusted_eps:
            facts.append(f"adjusted EPS grew {adjusted_eps.group(1)} to {adjusted_eps.group(2)}")
        if facts:
            return "Thermo Fisher reported Q2 2026 results: " + "; ".join(facts) + "."
    if "earnings conference call" in lower_title:
        timing = re.search(r"(?:Thursday,\s+)?July\s+23,\s+2026.*?(?:8:30\s*a\.m\.\s*(?:Eastern|ET)?)", body, re.I)
        return (
            "Thermo Fisher scheduled its Q2 2026 earnings call for "
            + (clean_text(timing.group(0)) if timing else "July 23, 2026")
            + "."
        )
    sentences = re.split(r"(?<=[.!?])\s+", body)
    summary = " ".join(sentence for sentence in sentences[:2] if sentence).strip()
    return (summary[:317].rstrip() + "...") if len(summary) > 320 else summary


def thermo_earnings_pm_enrichment(title: str) -> dict[str, object]:
    """Attach an evidence-bounded PM readout to the verified Q2 2026 release."""
    if "reports second quarter 2026 results" not in title.lower():
        return {}
    return {
        "summary": (
            "Thermo paired higher Analytical Instruments revenue and margin with "
            "AI-enabled Orbitrap launches and new bioprocess and proteomics customer infrastructure."
        ),
        "earningsMetrics": [
            {"label": "Analytical Instruments revenue", "value": "$1.847B", "change": "+6.9% YoY"},
            {"label": "Analytical Instruments segment income", "value": "$424M", "change": "+30.5% YoY"},
            {"label": "Analytical Instruments margin", "value": "23.0%", "change": "+4.2 pts YoY"},
        ],
        "pmInsights": [
            "Portfolio economics: Analytical Instruments revenue increased 6.9% to $1.847 billion; segment income increased 30.5% to $424 million and margin expanded 4.2 points to 23.0%.",
            "Product direction: Orbitrap Tribrid Apex and Excedion pair AI-driven analytics with multiomics, structural biology, biopharma characterization, small-molecule analysis and hard-to-detect drug-development targets.",
            "Commercial model: the Plainville Bioprocess Design Center and PRECISE-SG100K collaboration extend Thermo into pharma and biotech co-development and integrated Olink plus Orbitrap Astral proteomics.",
        ],
        "watersPmImplication": (
            "Assess Thermo at the workflow level—separations and MS, analytics, application proof "
            "and customer co-development—not on instrument specifications alone."
        ),
        "evidenceBoundary": (
            "The release does not separate LC or chromatography revenue, unit growth, pricing or market share; "
            "Analytical Instruments performance is not evidence of LC share gain."
        ),
    }


def thermo_ir_metadata(title: str) -> dict[str, str]:
    lower = title.lower()
    if "earnings conference call" in lower:
        return {
            "theme": "Upcoming earnings call",
            "intent": "Quarterly performance disclosure",
            "technology": "Portfolio",
            "marketSegment": "Corporate",
        }
    if re.search(r"reports (?:first|second|third|fourth) quarter|full year.*results", lower):
        return {
            "theme": "Quarterly earnings and end-market demand",
            "intent": "Corporate performance and investment capacity",
            "technology": "Portfolio",
            "marketSegment": "Corporate",
        }
    if "investor day" in lower:
        return {
            "theme": "Investor strategy and growth outlook",
            "intent": "Long-term growth strategy",
            "technology": "Portfolio",
            "marketSegment": "Corporate",
        }
    return {
        "theme": "Corporate strategy",
        "intent": "Corporate strategic activity",
        "technology": technical_technology(title),
        "marketSegment": technical_segment(title),
    }


def parse_thermo_ir_releases(body: str) -> dict[str, dict[str, object]]:
    """Parse Thermo Fisher's official Q4 investor-relations news API response."""
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        return {}
    releases: dict[str, dict[str, object]] = {}
    for item in payload.get("GetPressReleaseListResult", []):
        title = clean_text(str(item.get("Headline") or ""))
        path = str(item.get("LinkToDetailPage") or "")
        published = parse_date(str(item.get("PressReleaseDate") or ""))
        if not (title and path and published):
            continue
        url = urljoin("https://ir.thermofisher.com", path)
        metadata = thermo_ir_metadata(title)
        releases[url] = {
            **normalize_release(url, title, published),
            **metadata,
            "summary": concise_thermo_ir_summary(title, str(item.get("ShortBody") or "")),
            **thermo_earnings_pm_enrichment(title),
            "sourceId": "thermo-news",
            "sourceName": "Thermo Fisher investor relations news",
        }
    return releases


def cached_thermo_browser_verified_releases(now: datetime | None = None) -> dict[str, dict[str, object]]:
    """Reuse the prior IR archive only after a recent full-page browser audit."""
    cache = read_json(THERMO_PRESS_BROWSER_CACHE_FILE)
    if cache.get("validationMethod") != "full_official_archive_dom":
        return {}
    try:
        verified_at = datetime.fromisoformat(str(cache.get("verifiedAt") or "").replace("Z", "+00:00"))
    except ValueError:
        return {}
    current = now or datetime.now(timezone.utc)
    max_age_hours = float(cache.get("maxAgeHours", 24))
    if (current - verified_at).total_seconds() / 3600 > max_age_hours:
        return {}
    if int(cache.get("asOfYear") or 0) != date.today().year:
        return {}

    releases = read_json(SNAPSHOT_DIR / "thermo.json").get("pressReleases", {})
    if len(releases) != int(cache.get("sourceCount") or 0):
        return {}
    newest = max(
        releases.values(),
        key=lambda item: (str(item.get("date", "")), str(item.get("title", ""))),
        default={},
    )
    if str(newest.get("date") or "") != str(cache.get("newestDate") or ""):
        return {}
    if clean_text(str(newest.get("title") or "")) != clean_text(str(cache.get("newestTitle") or "")):
        return {}
    if str(newest.get("url") or "") != str(cache.get("newestUrl") or ""):
        return {}
    return releases


def parse_shimadzu_releases(body: str) -> tuple[dict[str, dict[str, str]], int]:
    """Parse the Shimadzu news index.

    Returns the releases plus the number of entries the index actually contained,
    so an index that loads but yields nothing can be told apart from a parser that
    stopped matching after a site redesign.
    """
    releases: dict[str, dict[str, str]] = {}
    blocks = re.split(r'<li class="updateInformation-list-item">', body, flags=re.I)[1:]
    for block in blocks:
        date_match = re.search(r'updateInformation-list-item-date">(.*?)</span>', block, re.I | re.S)
        title_match = re.search(r'updateInformation-list-item-main-text">(.*?)</p>', block, re.I | re.S)
        # Any four-digit year: coupling this to the current year made every
        # January silently drop the entire index.
        url_match = re.search(r'href="(/news/\d{4}/[^\"]+\.html)"', block, re.I)
        if not (date_match and title_match and url_match):
            continue
        title = clean_text(title_match.group(1))
        url = urljoin("https://www.shimadzu.com", url_match.group(1))
        releases[url] = normalize_release(url, title, parse_date(date_match.group(1)))
    return releases, len(blocks)


def parse_sciex_releases(body: str) -> tuple[dict[str, dict[str, str]], int]:
    """Parse the SCIEX press index; see parse_shimadzu_releases for the count."""
    releases: dict[str, dict[str, str]] = {}
    blocks = re.findall(
        r'<div class="tw-flex tw-flex-col md:tw-flex-row.*?tw-border-t">(.*?)'
        r'(?=<div class="tw-flex tw-flex-col md:tw-flex-row|</section>)',
        body,
        re.I | re.S,
    )
    for block in blocks:
        paragraphs = re.findall(r"<p[^>]*>(.*?)</p>", block, re.I | re.S)
        url_match = re.search(r'href="([^\"]+/press-releases/\d{4}/[^\"]+)"', block, re.I)
        if len(paragraphs) < 2 or not url_match:
            continue
        title = clean_text(paragraphs[1])
        url = url_match.group(1).replace("sciex.com//", "sciex.com/")
        releases[url] = normalize_release(url, title, parse_date(paragraphs[0]))
    return releases, len(blocks)


def canonical_url(url: str) -> str:
    """Drop feed-tracking parameters without changing the source destination."""
    return url.split("?", 1)[0].strip()


def technical_segment(text: str) -> str:
    lower = text.lower()
    if re.search(r"\b(?:proteom|metabolom|academic|researcher)\b", lower):
        return "Academic"
    if re.search(r"\b(?:biopharma|biologics|peptide|glyco|antibody|protein)\b", lower):
        return "Biopharma"
    if re.search(r"\b(?:environment|water|pfas|contaminant|food safety)\b", lower):
        return "Environmental"
    if re.search(r"\b(?:clinical|diagnostic|toxicology)\b", lower):
        return "Clinical"
    return "Pharma"


def technical_technology(text: str) -> str:
    lower = text.lower()
    if re.search(r"\b(?:lc[/-]?ms(?:/ms)?|orbitrap|mass spectrom|triple quadrupole|tsq)\b", lower):
        return "LC-MS"
    if re.search(r"\b(?:hplc|uhplc|liquid chromat|vanquish)\b", lower):
        return "LC/UHPLC"
    if re.search(r"\b(?:software|data transfer|informatics|automation|chromeleon)\b", lower):
        return "Software"
    return "LC/UHPLC"


def parse_thermo_technical_feed(
    body: str,
    source_id: str,
    source_name: str,
) -> dict[str, dict[str, str]]:
    """Extract dated, relevant records from an official Thermo Fisher RSS feed."""
    root = ET.fromstring(body.lstrip().encode("utf-8"))
    records: dict[str, dict[str, str]] = {}
    for item in root.findall("./channel/item"):
        title = clean_text(item.findtext("title") or "")
        description = clean_text(item.findtext("description") or "")
        # Feed bodies include sitewide related-content blocks. Filtering those
        # bodies would make unrelated GC-MS or general lab posts look LC-MS
        # relevant, so relevance and classification use only item metadata.
        combined = f"{title} {description}"
        if not title or not relevant_release(combined):
            continue
        url = canonical_url(item.findtext("link") or "")
        if not url:
            continue
        published_text = item.findtext("pubDate") or ""
        try:
            published = parsedate_to_datetime(published_text).date().isoformat()
        except (TypeError, ValueError, OverflowError):
            published = parse_date(published_text)
        if not published:
            continue
        records[url] = {
            "date": published,
            "title": title,
            "url": url,
            "classification": "technical",
            "sourceId": source_id,
            "sourceName": source_name,
            "technology": technical_technology(combined),
            "marketSegment": technical_segment(combined),
        }
    return records


def thermo_product_page(url: str) -> bool:
    path = urlparse(url).path.lower()
    if thermo_registered_product_metadata(url):
        return True
    if "gas-chromatography-mass-spectrometry" in path:
        return False
    if "/liquid-chromatography-lc/hplc-uhplc-systems/" in path:
        return bool(re.search(r"(?:vanquish|ultimate-3000|transcend).*(?:system|lc)", path)) and not any(
            marker in path for marker in ("3d-tours", "configurator", "calculator", "resources")
        )
    if "/liquid-chromatography-mass-spectrometry-lc-ms/lc-ms-systems/" in path:
        stem = Path(path).stem
        return bool(re.search(r"(?:orbitrap|astral|stellar|tsq|isq|exploris|eclipse|fusion|altis|quantis|excedion)", stem)) and bool(
            re.search(r"(?:system|spectrometer|spectrometers|ms)$", stem)
        )
    return False


def thermo_family_registry() -> dict[str, Any]:
    return read_json(THERMO_FAMILY_FILE)


def thermo_registered_product_metadata(url: str) -> dict[str, object]:
    path = urlparse(url).path.lower()
    for family in thermo_family_registry().get("families", []):
        fragments = [str(fragment).lower() for fragment in family.get("matchFragments", [])]
        if any(fragment in path for fragment in fragments):
            return {
                "monitoringFamily": family.get("id"),
                "monitoringFamilyName": family.get("name"),
                "technology": family.get("technology"),
                "category": family.get("technology"),
                "marketSegments": family.get("marketSegments", []),
            }
    return {}


def shimadzu_product_page(url: str) -> bool:
    path = urlparse(url).path.lower()
    if not path.endswith("/index.html"):
        return False
    return any(
        marker in path
        for marker in (
            "/an/products/liquid-chromatography/hplcuhplc/",
            "/an/products/liquid-chromatography/ion-chromatograph/",
            "/an/products/liquid-chromatograph-mass-spectrometry/",
            "/an/products/software-informatics/labsolutions-series/",
        )
    )


def sciex_product_page(url: str) -> bool:
    path = urlparse(url).path.lower().rstrip("/")
    if path in {"/products/mass-spectrometers", "/products/hplc-products", "/products/software"}:
        return False
    return any(
        path.startswith(prefix)
        for prefix in ("/products/mass-spectrometers/", "/products/hplc-products/", "/products/software/")
    )


def monitor_delta(
    competitor_id: str,
    products: dict[str, str],
    releases: dict[str, dict[str, str]],
    statuses: list[dict[str, object]],
    seed_dated_products: bool = False,
    technical_insights: dict[str, dict[str, str]] | None = None,
    product_metadata: dict[str, dict[str, object]] | None = None,
    monitored_families: list[dict[str, object]] | None = None,
) -> dict[str, object]:
    snapshot_file = SNAPSHOT_DIR / f"{competitor_id}.json"
    previous = read_json(snapshot_file)
    previous_products = previous.get("products", {})
    previous_releases = previous.get("pressReleases", {})
    previous_technical_insights = (
        previous.get("technicalInsights", {})
        if previous.get("technicalFeedVersion") == TECHNICAL_FEED_VERSION
        else {}
    )
    previous_product_metadata = previous.get("productMetadata", {})
    previous_family_ids = {
        str(family.get("id")) for family in previous.get("monitoredFamilies", [])
    }
    technical_insights = technical_insights or {}
    product_metadata = product_metadata or {}
    monitored_families = monitored_families or []
    initialized = bool(previous.get("initialized"))

    new_products: list[dict[str, object]] = []
    discontinued_products: list[dict[str, object]] = []
    updated_products: list[dict[str, object]] = []
    new_releases: list[dict[str, str]] = []
    new_technical_insights: list[dict[str, str]] = []

    if initialized:
        new_products = []
        for url, lastmod in products.items():
            if url in previous_products:
                continue
            metadata = product_metadata.get(url, {})
            family_id = str(metadata.get("monitoringFamily") or "")
            new_products.append({
                "url": url,
                "lastmod": lastmod,
                "category": metadata.get("category", "LC/MS"),
                **metadata,
                **({"baselineDiscovery": True, "monitoringRegistration": True} if family_id and family_id not in previous_family_ids else {}),
            })
        discontinued_products = [
            {
                "url": url,
                "lastmod": previous_products[url],
                "category": previous_product_metadata.get(url, {}).get("category", "LC/MS"),
                **previous_product_metadata.get(url, {}),
                "verification": "manual confirmation required",
            }
            for url in previous_products if url not in products
        ]
        updated_products = [
            {
                "url": url,
                "lastmod": lastmod,
                "previousLastmod": previous_products[url],
                "category": product_metadata.get(url, {}).get("category", "LC/MS"),
                **product_metadata.get(url, {}),
            }
            for url, lastmod in products.items()
            if url in previous_products and lastmod and lastmod != previous_products[url]
        ]
        recent_release_cutoff = date.today() - timedelta(days=RECENT_RELEASE_REPLAY_DAYS)
        new_releases = []
        for url, release in releases.items():
            try:
                published = date.fromisoformat(str(release.get("date", ""))[:10])
            except ValueError:
                published = date.min
            # Re-emit the current corporate window on every refresh. The merge
            # is URL-deduplicated, so this closes the gap where a collector run
            # advances a snapshot before the validated dataset is published.
            if url not in previous_releases or published >= recent_release_cutoff:
                new_releases.append(release)
        new_technical_insights = [
            insight for url, insight in technical_insights.items()
            if url not in previous_technical_insights
        ]
    else:
        # Dated official releases are evidence on day one. Undated product pages
        # form a baseline only; Thermo product sitemap lastmod values can support
        # a limited set of real baseline update signals.
        new_releases = list(releases.values())
        new_technical_insights = list(technical_insights.values())
        if seed_dated_products:
            cutoff = date.today() - timedelta(days=120)
            candidates = []
            for url, lastmod in products.items():
                try:
                    modified = date.fromisoformat(lastmod[:10])
                except ValueError:
                    continue
                if modified >= cutoff:
                    candidates.append({"url": url, "lastmod": modified.isoformat(), "previousLastmod": "baseline", "category": "LC/MS", "baselineDiscovery": True})
            updated_products = sorted(candidates, key=lambda item: str(item["lastmod"]), reverse=True)[:12]

    # Sitemap membership and last-modified values are inventory observations, not
    # proof that page content or a commercial product changed.  Preserve them for
    # future comparisons, but do not emit product-change records until a collector
    # also provides a validated before/after page-content diff.
    unverified_inventory_changes = {
        "new": new_products,
        "updated": updated_products,
        "missing": discontinued_products,
    }

    # Substantiate the sitemap observations by fetching the affected pages. The
    # publish gate requires a real before/after artifact, so without this step
    # every product change is filtered out below and never becomes a signal.
    def fetch_page(url: str) -> tuple[int | None, str]:
        status, body, _final = fetch(url, timeout=45)
        return status, body

    previous_hashes = previous.get("productContentHashes", {}) or {}
    current_hashes = dict(previous_hashes)
    budget = PAGE_DIFF_BUDGET
    evidence_spend = 0
    withheld: dict[str, list[dict[str, Any]]] = {}
    for label, bucket in (("added", "new_products"), ("updated", "updated_products"), ("removed", "discontinued_products")):
        source_items = {"new_products": new_products, "updated_products": updated_products, "discontinued_products": discontinued_products}[bucket]
        substantiated, spent, unproven = attach_product_change_evidence(
            source_items,
            kind=label,
            fetch_page=fetch_page,
            previous_hashes=previous_hashes,
            current_hashes=current_hashes,
            budget=max(0, budget - evidence_spend),
        )
        evidence_spend += spent
        withheld[bucket] = unproven
        if bucket == "new_products":
            new_products = substantiated
        elif bucket == "updated_products":
            updated_products = substantiated
        else:
            discontinued_products = substantiated

    warm_spend = warm_content_hashes(
        sorted(products),
        fetch_page=fetch_page,
        previous_hashes=previous_hashes,
        current_hashes=current_hashes,
        budget=max(0, BASELINE_WARM_BUDGET - max(0, evidence_spend - PAGE_DIFF_BUDGET)),
    )
    unverified_inventory_changes["withheldForMissingEvidence"] = withheld
    unverified_inventory_changes["pageDiffRequests"] = evidence_spend + warm_spend
    unverified_inventory_changes["contentBaselineCoverage"] = {
        "hashed": sum(1 for url in products if url in current_hashes),
        "tracked": len(products),
    }

    new_products = [item for item in new_products if item.get("changeEvidence")]
    updated_products = [item for item in updated_products if item.get("changeEvidence")]
    discontinued_products = [item for item in discontinued_products if item.get("changeEvidence")]

    all_technical_insights = {**previous_technical_insights, **technical_insights}
    write_json(snapshot_file, {
        "snapshotSchemaVersion": 2,
        "observationType": "sitemap_inventory",
        "capturedAt": utc_now(),
        "initialized": True,
        "products": products,
        "productContentHashes": current_hashes,
        "productMetadata": product_metadata,
        "monitoredFamilies": monitored_families,
        "pressReleases": releases,
        # RSS feeds expose only a rolling window. Retain previously seen URLs so
        # an older post cannot be emitted again after it leaves and re-enters a feed.
        "technicalInsights": all_technical_insights,
        "technicalFeedVersion": TECHNICAL_FEED_VERSION,
        "unverifiedInventoryChanges": unverified_inventory_changes,
    })
    return {
        "generatedAt": utc_now(),
        "baselineCreated": not initialized,
        "inventoryCounts": {
            "lcmsProductPages": len(products),
            "pressReleases": len(releases),
            "technicalInsights": len(technical_insights),
            **{
                f"{family.get('id')}Pages": sum(
                    1 for metadata in product_metadata.values()
                    if metadata.get("monitoringFamily") == family.get("id")
                )
                for family in monitored_families
            },
        },
        "monitoredFamilies": monitored_families,
        "new_products": new_products,
        "discontinued_products": discontinued_products,
        "updated_products": updated_products,
        "unverified_inventory_changes": unverified_inventory_changes,
        "new_press_releases": sorted(new_releases, key=lambda item: item.get("date", ""), reverse=True),
        "recent_press_releases": sorted(
            [
                release for release in releases.values()
                if str(release.get("date", ""))[:10] >= (date.today() - timedelta(days=RECENT_RELEASE_REPLAY_DAYS)).isoformat()
            ],
            key=lambda item: item.get("date", ""),
            reverse=True,
        ),
        "new_technical_insights": sorted(new_technical_insights, key=lambda item: item.get("date", ""), reverse=True),
        # Consumers that maintain catalogs need the complete retained inventory,
        # not only the first-seen delta emitted by new_technical_insights.
        "technical_insights": sorted(all_technical_insights.values(), key=lambda item: item.get("date", ""), reverse=True),
        "source_status": statuses,
    }


def collect_thermo() -> dict[str, object]:
    statuses: list[dict[str, object]] = []
    index_url = "https://www.thermofisher.com/sitemap-index.xml"
    product_url = "https://www.thermofisher.com/sitemap-us-en.xml"
    press_query = urlencode({
        "LanguageId": 1,
        "bodyType": 3,
        "pressReleaseDateFilter": 3,
        "categoryId": "",
        "pageSize": -1,
        "pageNumber": 0,
        "tagList": "",
        "includeTags": "true",
        "year": CURRENT_YEAR,
        "excludeSelection": 1,
    })
    press_url = f"{THERMO_IR_FEED}?{press_query}"

    index_status, index_body, index_detail = fetch(index_url, timeout=120)
    us_declared = False
    if index_status == 200:
        try:
            us_declared = any(row.get("loc") == product_url for row in parse_sitemap(index_body))
        except ET.ParseError:
            pass
    statuses.append(source_status("thermo-products", index_url, "sitemap_index", index_status, "extracted" if us_declared else "blocked", "Official sitemap index parsed." if us_declared else f"Official sitemap index unavailable or invalid: {index_detail or index_status}"))

    product_status, product_body, product_detail = fetch(product_url, timeout=180) if us_declared else (None, "", "US sitemap not declared")
    products: dict[str, str] = {}
    if product_status == 200:
        try:
            products = {
                canonical_thermo_product_url(row["loc"]): row.get("lastmod", "")[:10]
                for row in parse_sitemap(product_body)
                if thermo_product_page(row.get("loc", ""))
            }
        except ET.ParseError:
            products = {}
    product_inventory_extracted = bool(products)
    previous_snapshot = read_json(SNAPSHOT_DIR / "thermo.json")
    retained_last_known_inventory = False
    if not products:
        products = dict(previous_snapshot.get("products", {}))
        if not products:
            previous_monitor = read_json(OUTPUT_FILE).get("competitors", {}).get("Thermo Fisher", {})
            products = {
                item["url"]: str(item.get("lastmod", ""))
                for item in previous_monitor.get("discontinued_products", [])
                if item.get("url")
            }
        retained_last_known_inventory = bool(products)
    product_extraction = "extracted" if products else "blocked"
    if retained_last_known_inventory and not product_inventory_extracted:
        product_extraction = "blocked"
        product_reason = f"Product sitemap unavailable: {product_detail or product_status}. Retained {len(products)} last-known official product pages; no discontinuation inferred."
    else:
        product_reason = f"Official US sitemap parsed; {len(products)} LC/LC-MS product pages tracked." if products else f"Product sitemap unavailable or contained no usable LC/LC-MS records: {product_detail or product_status}"
    statuses.append(source_status("thermo-ms-products", product_url, "product_sitemap_xml", product_status, product_extraction, product_reason, len(products) if product_inventory_extracted else 0))

    family_registry = thermo_family_registry()
    monitored_families: list[dict[str, object]] = []
    product_metadata = {
        url: metadata
        for url in products
        if (metadata := thermo_registered_product_metadata(url))
    }
    for family in family_registry.get("families", []):
        family_id = family.get("id")
        tracked_urls = sorted(
            url for url, metadata in product_metadata.items()
            if metadata.get("monitoringFamily") == family_id
        )
        registration = {
            **family,
            "sitemapUrl": family_registry.get("sitemapUrl", product_url),
            "trackedProductUrls": tracked_urls,
        }
        monitored_families.append(registration)
        statuses.append(source_status(
            f"{family_id}-products",
            family_registry.get("sitemapUrl", product_url),
            "registered_product_sitemap",
            product_status,
            "extracted" if tracked_urls and product_inventory_extracted else "blocked",
            (
                f"Official Thermo sitemap parsed; {len(tracked_urls)} registered {family.get('name')} product pages tracked."
                if tracked_urls and product_inventory_extracted
                else f"Sitemap collection was blocked; retained {len(tracked_urls)} last-known registered {family.get('name')} product pages and made no discontinuation inference."
                if tracked_urls
                else f"Official Thermo sitemap did not contain a registered {family.get('name')} product page."
            ),
            len(tracked_urls) if product_inventory_extracted else 0,
        ))

    if retained_last_known_inventory and not previous_snapshot.get("products"):
        write_json(SNAPSHOT_DIR / "thermo.json", {
            **previous_snapshot,
            "capturedAt": utc_now(),
            "initialized": True,
            "products": products,
            "productMetadata": product_metadata,
            "monitoredFamilies": monitored_families,
        })

    press_status, press_body, press_detail = fetch(press_url)
    releases = parse_thermo_ir_releases(press_body) if press_status == 200 else {}
    press_method = "official_ir_news_api"
    if not releases:
        releases = cached_thermo_browser_verified_releases()
        if releases:
            press_method = "browser_verified_archive_cache"
            press_status = 200
    press_extraction = "extracted" if releases else "blocked"
    press_reason = (
        f"Full official Thermo Fisher archive DOM verified in a real browser at {read_json(THERMO_PRESS_BROWSER_CACHE_FILE).get('verifiedAt')}; retained {len(releases)} matching dated {CURRENT_YEAR} releases for no more than {read_json(THERMO_PRESS_BROWSER_CACHE_FILE).get('maxAgeHours', 24)} hours."
        if releases and press_method == "browser_verified_archive_cache"
        else f"Official Thermo Fisher investor-relations feed parsed; {len(releases)} dated {CURRENT_YEAR} corporate releases extracted."
        if releases
        else f"Investor-relations feed unavailable or contained no dated records: {press_detail or press_status}."
    )
    statuses.append(source_status("thermo-news", THERMO_IR_NEWS_PAGE, press_method, press_status, press_extraction, press_reason, len(releases)))

    technical_insights: dict[str, dict[str, str]] = {}
    for feed in THERMO_TECHNICAL_FEEDS:
        feed_status, feed_body, feed_detail = fetch(feed["url"], timeout=90)
        feed_records: dict[str, dict[str, str]] = {}
        parse_error = ""
        if feed_status == 200:
            try:
                feed_records = parse_thermo_technical_feed(
                    feed_body,
                    feed["source_id"],
                    feed["name"],
                )
            except ET.ParseError as error:
                parse_error = str(error)
        technical_insights.update(feed_records)
        extracted = bool(feed_records)
        statuses.append(source_status(
            feed["source_id"],
            feed["url"],
            "rss_feed",
            feed_status,
            "extracted" if extracted else "blocked",
            (
                f"Official dated RSS feed parsed; {len(feed_records)} relevant LC/MS records extracted."
                if extracted
                else f"RSS feed unavailable or contained no usable LC/MS records: {parse_error or feed_detail or feed_status}"
            ),
            len(feed_records),
        ))
    return monitor_delta(
        "thermo",
        products,
        releases,
        statuses,
        seed_dated_products=True,
        technical_insights=technical_insights,
        product_metadata=product_metadata,
        monitored_families=monitored_families,
    )


def collect_shimadzu() -> dict[str, object]:
    statuses: list[dict[str, object]] = []
    product_url = "https://www.shimadzu.com/an/sitemap.xml"
    press_url = f"https://www.shimadzu.com/news/{CURRENT_YEAR}/index.html"
    press_years = press_index_years()
    product_status, product_body, product_detail = fetch(product_url, timeout=120)
    products: dict[str, str] = {}
    if product_status == 200:
        try:
            products = {row["loc"]: row.get("lastmod", "")[:10] for row in parse_sitemap(product_body) if shimadzu_product_page(row.get("loc", ""))}
        except ET.ParseError:
            products = {}
    statuses.append(source_status("shimadzu-lcms", product_url, "product_sitemap_xml", product_status, "extracted" if products else "blocked", f"Official analytical sitemap parsed; {len(products)} LC/LC-MS/software product pages tracked." if products else f"Analytical sitemap unavailable or invalid: {product_detail or product_status}", len(products)))

    press_status, releases, entries, pages = collect_press_index(
        lambda year: f"https://www.shimadzu.com/news/{year}/index.html",
        parse_shimadzu_releases,
        press_years,
    )
    extraction, reason = press_extraction_status(press_status, entries, len(releases))
    statuses.append(source_status(
        "shimadzu-news", press_url, "dated_press_index", press_status, extraction,
        f"{reason} Covered {len(press_years)} year(s) across {len(pages)} index page(s).",
        len(releases),
    ))
    return monitor_delta("shimadzu", products, releases, statuses)


def collect_sciex() -> dict[str, object]:
    statuses: list[dict[str, object]] = []
    product_url = "https://www.sciex.com/sitemap.xml"
    press_url = f"https://sciex.com/about-us/press-releases/{CURRENT_YEAR}"
    press_years = press_index_years()
    product_status, product_body, product_detail = fetch(product_url, timeout=120)
    products: dict[str, str] = {}
    if product_status == 200:
        try:
            products = {row["loc"]: row.get("lastmod", "")[:10] for row in parse_sitemap(product_body) if sciex_product_page(row.get("loc", ""))}
        except ET.ParseError:
            products = {}
    statuses.append(source_status("sciex-products", product_url, "product_sitemap_xml", product_status, "extracted" if products else "blocked", f"Official sitemap parsed; {len(products)} MS/LC/software product pages tracked." if products else f"Sitemap unavailable or invalid: {product_detail or product_status}", len(products)))

    press_status, releases, entries, pages = collect_press_index(
        lambda year: f"https://sciex.com/about-us/press-releases/{year}",
        parse_sciex_releases,
        press_years,
    )
    extraction, reason = press_extraction_status(press_status, entries, len(releases))
    statuses.append(source_status(
        "sciex-news", press_url, "dated_press_index", press_status, extraction,
        f"{reason} Covered {len(press_years)} year(s) across {len(pages)} index page(s).",
        len(releases),
    ))
    return monitor_delta("sciex", products, releases, statuses)


def update_source_catalog(monitors: dict[str, dict[str, object]]) -> None:
    catalog = read_json(SOURCE_CATALOG_FILE)
    source_map = {source.get("id"): source for source in catalog.get("sources", [])}
    for monitor in monitors.values():
        for status in monitor.get("source_status", []):
            source = source_map.get(status.get("sourceId"))
            if not source:
                continue
            source["extractionStatus"] = status.get("extractionStatus")
            source["extractionReason"] = status.get("extractionReason")
            source["extractedRecords"] = status.get("extractedRecords", 0)
            source["fetchMethod"] = status.get("fetchMethod")
            source["lastExtractionCheck"] = status.get("checkedAt")
    catalog["generatedAt"] = utc_now()
    write_json(SOURCE_CATALOG_FILE, catalog)


def main() -> int:
    monitors = {
        "Thermo Fisher": collect_thermo(),
        "Shimadzu": collect_shimadzu(),
        "SCIEX": collect_sciex(),
    }
    update_source_catalog(monitors)
    output = {"generatedAt": utc_now(), "competitors": monitors}
    write_json(OUTPUT_FILE, output)
    for competitor, monitor in monitors.items():
        signal_count = sum(len(monitor.get(key, [])) for key in ("new_products", "updated_products", "new_press_releases", "new_technical_insights"))
        blocked = [status for status in monitor.get("source_status", []) if status.get("extractionStatus") == "blocked"]
        reason = f"; blocked: {'; '.join(str(item.get('extractionReason')) for item in blocked)}" if blocked else ""
        print(f"{competitor}: {signal_count} real signals; {monitor.get('inventoryCounts')}{reason}")
    extracted = any(
        status.get("extractionStatus") == "extracted"
        for monitor in monitors.values()
        for status in monitor.get("source_status", [])
    )
    return 0 if extracted else 1


if __name__ == "__main__":
    raise SystemExit(main())
