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
RECENT_RELEASE_REPLAY_DAYS = 45
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
        "status": "available" if extraction_status == "extracted" else "collection_review_needed",
        "extractionStatus": extraction_status,
        "extractionReason": reason,
        "extractedRecords": records,
        "checkedAt": utc_now(),
    }


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


def parse_thermo_ir_releases(body: str) -> dict[str, dict[str, str]]:
    """Parse Thermo Fisher's official Q4 investor-relations news API response."""
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        return {}
    releases: dict[str, dict[str, str]] = {}
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
            "sourceId": "thermo-news",
            "sourceName": "Thermo Fisher investor relations news",
        }
    return releases


def parse_shimadzu_releases(body: str) -> dict[str, dict[str, str]]:
    releases: dict[str, dict[str, str]] = {}
    blocks = re.split(r'<li class="updateInformation-list-item">', body, flags=re.I)[1:]
    for block in blocks:
        date_match = re.search(r'updateInformation-list-item-date">(.*?)</span>', block, re.I | re.S)
        title_match = re.search(r'updateInformation-list-item-main-text">(.*?)</p>', block, re.I | re.S)
        url_match = re.search(rf'href="(/news/{CURRENT_YEAR}/[^\"]+\.html)"', block, re.I)
        if not (date_match and title_match and url_match):
            continue
        title = clean_text(title_match.group(1))
        if not relevant_release(title):
            continue
        url = urljoin("https://www.shimadzu.com", url_match.group(1))
        releases[url] = normalize_release(url, title, parse_date(date_match.group(1)))
    return releases


def parse_sciex_releases(body: str) -> dict[str, dict[str, str]]:
    releases: dict[str, dict[str, str]] = {}
    blocks = re.findall(
        r'<div class="tw-flex tw-flex-col md:tw-flex-row.*?tw-border-t">(.*?)'
        r'(?=<div class="tw-flex tw-flex-col md:tw-flex-row|</section>)',
        body,
        re.I | re.S,
    )
    for block in blocks:
        paragraphs = re.findall(r"<p[^>]*>(.*?)</p>", block, re.I | re.S)
        url_match = re.search(rf'href="([^\"]+/press-releases/{CURRENT_YEAR}/[^\"]+)"', block, re.I)
        if len(paragraphs) < 2 or not url_match:
            continue
        title = clean_text(paragraphs[1])
        if not relevant_release(title):
            continue
        url = url_match.group(1).replace("sciex.com//", "sciex.com/")
        releases[url] = normalize_release(url, title, parse_date(paragraphs[0]))
    return releases


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

    write_json(snapshot_file, {
        "capturedAt": utc_now(),
        "initialized": True,
        "products": products,
        "productMetadata": product_metadata,
        "monitoredFamilies": monitored_families,
        "pressReleases": releases,
        # RSS feeds expose only a rolling window. Retain previously seen URLs so
        # an older post cannot be emitted again after it leaves and re-enters a feed.
        "technicalInsights": {**previous_technical_insights, **technical_insights},
        "technicalFeedVersion": TECHNICAL_FEED_VERSION,
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
        "new_press_releases": sorted(new_releases, key=lambda item: item.get("date", ""), reverse=True),
        "new_technical_insights": sorted(new_technical_insights, key=lambda item: item.get("date", ""), reverse=True),
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
                row["loc"]: row.get("lastmod", "")[:10]
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
    press_extraction = "extracted" if releases else "blocked"
    press_reason = (
        f"Official Thermo Fisher investor-relations feed parsed; {len(releases)} dated {CURRENT_YEAR} corporate releases extracted."
        if releases
        else f"Investor-relations feed unavailable or contained no dated records: {press_detail or press_status}."
    )
    statuses.append(source_status("thermo-news", THERMO_IR_NEWS_PAGE, "official_ir_news_api", press_status, press_extraction, press_reason, len(releases)))

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
    product_status, product_body, product_detail = fetch(product_url, timeout=120)
    products: dict[str, str] = {}
    if product_status == 200:
        try:
            products = {row["loc"]: row.get("lastmod", "")[:10] for row in parse_sitemap(product_body) if shimadzu_product_page(row.get("loc", ""))}
        except ET.ParseError:
            products = {}
    statuses.append(source_status("shimadzu-lcms", product_url, "product_sitemap_xml", product_status, "extracted" if products else "blocked", f"Official analytical sitemap parsed; {len(products)} LC/LC-MS/software product pages tracked." if products else f"Analytical sitemap unavailable or invalid: {product_detail or product_status}", len(products)))

    press_status, press_body, press_detail = fetch(press_url)
    releases = parse_shimadzu_releases(press_body) if press_status == 200 else {}
    statuses.append(source_status("shimadzu-news", press_url, "dated_press_index", press_status, "extracted" if releases else "blocked", f"Official dated news index parsed; {len(releases)} relevant releases extracted." if releases else f"Dated news index unavailable or contained no usable LC/MS records: {press_detail or press_status}", len(releases)))
    return monitor_delta("shimadzu", products, releases, statuses)


def collect_sciex() -> dict[str, object]:
    statuses: list[dict[str, object]] = []
    product_url = "https://www.sciex.com/sitemap.xml"
    press_url = f"https://sciex.com/about-us/press-releases/{CURRENT_YEAR}"
    product_status, product_body, product_detail = fetch(product_url, timeout=120)
    products: dict[str, str] = {}
    if product_status == 200:
        try:
            products = {row["loc"]: row.get("lastmod", "")[:10] for row in parse_sitemap(product_body) if sciex_product_page(row.get("loc", ""))}
        except ET.ParseError:
            products = {}
    statuses.append(source_status("sciex-products", product_url, "product_sitemap_xml", product_status, "extracted" if products else "blocked", f"Official sitemap parsed; {len(products)} MS/LC/software product pages tracked." if products else f"Sitemap unavailable or invalid: {product_detail or product_status}", len(products)))

    press_status, press_body, press_detail = fetch(press_url, timeout=90)
    releases = parse_sciex_releases(press_body) if press_status == 200 else {}
    statuses.append(source_status("sciex-news", press_url, "dated_press_index", press_status, "extracted" if releases else "blocked", f"Official dated press index parsed; {len(releases)} relevant releases extracted." if releases else f"Dated press index unavailable or contained no usable records: {press_detail or press_status}", len(releases)))
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
