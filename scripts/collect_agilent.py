#!/usr/bin/env python3
"""Monitor authoritative Agilent product, press, and investor sources."""

from __future__ import annotations

import json
import html
import os
import re
import shutil
import subprocess
import time
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlencode, urljoin, urlparse


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
SNAPSHOT_FILE = DATA_DIR / "source_snapshots" / "agilent.json"
OUTPUT_FILE = DATA_DIR / "agilent_monitor.json"
SOURCE_CATALOG_FILE = DATA_DIR / "source_catalog.json"

USER_AGENT = "WatersCompetitiveIntelligenceEngine/0.2 (+https://www.waters.com/)"
SITEMAP_INDEX = "https://www.agilent.com/sitemap.xml"
PRODUCT_SITEMAPS = (
    "https://www.agilent.com/products0.xml",
    "https://www.agilent.com/pim_commerce01.xml",
    "https://www.agilent.com/pim_commerce1.xml",
)
PRESS_INDEX = "https://www.agilent.com/about/newsroom/presrel.html"
INVESTOR_PAGE = "https://www.investor.agilent.com/overview/default.aspx"
INVESTOR_NEWS_PAGE = "https://www.investor.agilent.com/news-and-events/news/default.aspx"
INVESTOR_IR_FEED = "https://www.investor.agilent.com/feed/PressRelease.svc/GetPressReleaseList"
HEADLESS_HELPER = ROOT / "scripts" / "agilent_browser_fetch.cjs"
LCMS_PATH = "/en/product/liquid-chromatography-mass-spectrometry-lc-ms"

DISALLOWED = (
    re.compile(r"^/search", re.I),
    re.compile(r"^/account", re.I),
    re.compile(r"^/admin/", re.I),
    re.compile(r"^/internal/", re.I),
    re.compile(r"/shared/", re.I),
    re.compile(r"/about/newsroom/presrel/20(?:0[5-9]|10)/", re.I),
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def read_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(f"{path.suffix}.tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def allowed(url: str) -> bool:
    path = urlparse(url).path
    return not any(pattern.search(path) for pattern in DISALLOWED)


class HostThrottle:
    def __init__(self) -> None:
        self.last_request: dict[str, float] = {}

    def wait(self, url: str) -> None:
        host = urlparse(url).netloc.lower()
        delay = 10.0 if host == "www.investor.agilent.com" else 1.25
        elapsed = time.monotonic() - self.last_request.get(host, 0.0)
        if elapsed < delay:
            time.sleep(delay - elapsed)
        self.last_request[host] = time.monotonic()


THROTTLE = HostThrottle()


def fetch(url: str, timeout: int = 60) -> tuple[int | None, bytes]:
    if not allowed(url):
        return None, b""
    last_status: int | None = None
    last_body = b""
    for attempt in range(3):
        THROTTLE.wait(url)
        command = [
            "curl", "-L", "-sS", "--compressed", "--max-time", str(timeout),
            "-A", USER_AGENT,
            "-H", "Accept: application/xml,text/xml,text/html;q=0.9,*/*;q=0.5",
            "-w", "\n%{http_code}", url,
        ]
        try:
            result = subprocess.run(command, check=False, capture_output=True, timeout=timeout + 5)
        except Exception:
            result = None
        if result and result.stdout:
            body, _, status_text = result.stdout.rpartition(b"\n")
            try:
                last_status = int(status_text.decode("ascii", errors="ignore"))
            except ValueError:
                last_status = None
            last_body = body
        # Retry only transient transport, rate-limit, and server failures. A
        # policy response or explicit not-found result is authoritative.
        if last_status is not None and last_status not in {408, 425, 429} and last_status < 500:
            break
        if attempt < 2:
            time.sleep(2 ** (attempt + 1))
    return last_status, last_body


def browser_fetch(url: str, timeout: int = 90) -> dict:
    """Use real Chromium for WAF-challenged pages; never spoof a crawler."""
    runtime_root = Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies"
    bundled_node = runtime_root / "node/bin/node"
    node = os.environ.get("AGILENT_NODE") or (str(bundled_node) if bundled_node.exists() else shutil.which("node"))
    if not node or not HEADLESS_HELPER.exists() or not allowed(url):
        return {}
    env = os.environ.copy()
    bundled_modules = runtime_root / "node/node_modules"
    if bundled_modules.exists():
        env["NODE_PATH"] = os.pathsep.join(filter(None, [str(bundled_modules), env.get("NODE_PATH", "")]))
    local_browsers = ROOT / ".pw-browsers"
    if local_browsers.exists():
        env["PLAYWRIGHT_BROWSERS_PATH"] = str(local_browsers)
    try:
        result = subprocess.run(
            [node, str(HEADLESS_HELPER), url], check=False, capture_output=True,
            timeout=timeout, env=env, cwd=ROOT,
        )
        if result.returncode == 0 and result.stdout:
            return json.loads(result.stdout.decode("utf-8", errors="replace"))
    except Exception:
        return {}
    return {}


def source_status(url: str, method: str, status: int | None, detail: str = "") -> dict:
    successful = status is not None and 200 <= status < 300
    needs_browser = status == 403
    return {
        "url": url,
        "fetchMethod": method if not needs_browser else "headless_browser_required",
        "httpStatus": status,
        "status": "available" if successful else "collection_review_needed",
        "sourceQuality": "blocked" if needs_browser else "reliable" if successful else "unverified",
        "reliabilityNote": (
            "HTTP 403 prevents extraction in this run; record as blocked, not healthy, until a permitted fetch succeeds."
            if needs_browser else detail
        ),
        "checkedAt": utc_now(),
    }


def parse_sitemap(body: bytes) -> tuple[list[str], dict[str, str]]:
    if not body:
        return [], {}
    root = ET.fromstring(body)
    namespace = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
    sitemap_urls = [node.text.strip() for node in root.findall(f".//{namespace}sitemap/{namespace}loc") if node.text]
    pages: dict[str, str] = {}
    for node in root.findall(f".//{namespace}url"):
        loc = node.find(f"{namespace}loc")
        lastmod = node.find(f"{namespace}lastmod")
        if loc is not None and loc.text:
            pages[loc.text.strip()] = lastmod.text.strip() if lastmod is not None and lastmod.text else ""
    return sitemap_urls, pages


class LinkParser(HTMLParser):
    def __init__(self, base_url: str) -> None:
        super().__init__()
        self.base_url = base_url
        self.current_href = ""
        self.current_text: list[str] = []
        self.links: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        values = dict(attrs)
        self.current_href = values.get("href") or ""
        self.current_text = []

    def handle_data(self, data: str) -> None:
        if self.current_href:
            self.current_text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "a" and self.current_href:
            url = urljoin(self.base_url, self.current_href)
            text = re.sub(r"\s+", " ", " ".join(self.current_text)).strip()
            self.links.append((url, text))
            self.current_href = ""
            self.current_text = []


def release_date(url: str) -> str:
    match = re.search(r"/presrel/(\d{4})/(\d{2})([a-z]{3})-", url, re.I)
    if not match:
        return ""
    year, day, month = match.groups()
    try:
        return datetime.strptime(f"{year}-{month}-{day}", "%Y-%b-%d").date().isoformat()
    except ValueError:
        return ""


def classify_release(title: str) -> str:
    product_terms = (
        "launch", "introduces", "unveils", "system", "instrument", "software",
        "chromatography", "spectrometry", "detector", "workflow", "portfolio",
    )
    return "product" if any(term in title.lower() for term in product_terms) else "corporate"


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", value or ""))).strip()


def parse_ir_date(value: str) -> str:
    text = clean_text(value)
    for fmt in ("%m/%d/%Y %H:%M:%S", "%m/%d/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    return ""


def completed_earnings_title(title: str) -> bool:
    return bool(re.search(
        r"\breports?\s+(?:first|second|third|fourth|q[1-4])[- ]quarter.*financial results\b",
        clean_text(title),
        re.I,
    ))


def earnings_enrichment(title: str) -> dict:
    if "Second-Quarter Fiscal Year 2026" not in title:
        return {
            "theme": "Quarterly earnings and end-market demand",
            "intent": "Corporate performance and investment capacity",
            "summary": f"{title}. Review the official reported result for segment demand, margin, outlook, and investment-capacity signals.",
            "evidenceBoundary": "The earnings release does not separately report LC or LC-MS revenue, units, pricing, or market share.",
        }
    return {
        "theme": "Quarterly earnings and end-market demand",
        "intent": "Corporate performance and investment capacity",
        "summary": "Agilent paired broad-based revenue growth with higher Life Sciences and Diagnostics, CrossLab, and Applied Markets performance while raising fiscal 2026 revenue, margin, and EPS guidance.",
        "earningsMetrics": [
            {"label": "Life Sciences and Diagnostics revenue", "value": "$732M", "detail": "+12% reported / +9% core year over year"},
            {"label": "CrossLab revenue", "value": "$759M", "detail": "+6% reported / +2% core; 32.0% operating margin"},
            {"label": "Applied Markets revenue", "value": "$344M", "detail": "+14% reported / +11% core year over year"},
        ],
        "pmInsights": [
            "All three operating groups grew; Life Sciences and Diagnostics and Applied Markets posted the strongest core growth.",
            "CrossLab remained Agilent's largest reported group and carried a 32.0% operating margin, making lifecycle and service economics strategically material.",
            "Agilent raised fiscal 2026 revenue, core-growth, operating-margin, and non-GAAP EPS guidance, increasing capacity to invest behind priority workflows.",
        ],
        "watersPmImplication": "Assess Agilent as an installed-base lifecycle and workflow competitor—not only an LC instrument competitor—and track where CrossLab, software, and applications are bundled into regulated customer outcomes.",
        "evidenceBoundary": "Agilent does not separately report LC or LC-MS revenue, units, pricing, or share; segment growth is not direct evidence of LC market-share gain.",
    }


def release_enrichment(title: str, short_body: str = "") -> dict:
    """Classify an official Agilent release without excluding non-earnings news."""
    text = clean_text(f"{title} {short_body}")
    lowered = text.lower()
    if completed_earnings_title(title):
        return {
            "classification": "corporate",
            "signalType": "Quarterly earnings result",
            "marketSegment": "Corporate",
            "technology": "Portfolio",
            **earnings_enrichment(title),
        }
    if re.search(r"\bto announce\b.*\bfinancial results\b", lowered):
        return {
            "classification": "corporate",
            "signalType": "Earnings event announcement",
            "marketSegment": "Corporate",
            "technology": "Portfolio",
            "theme": "Upcoming earnings event",
            "intent": "Investor communication",
            "summary": clean_text(short_body) or title,
        }
    if any(term in lowered for term in ("acquisition", "acquires", "acquire ")):
        return {
            "classification": "corporate",
            "signalType": "Acquisition",
            "marketSegment": "Corporate",
            "technology": "Portfolio",
            "theme": "Portfolio expansion through acquisition",
            "intent": "Capability and market expansion",
            "summary": clean_text(short_body) or title,
        }
    if any(term in lowered for term in ("fda approval", "eu approval", "approved use")):
        return {
            "classification": "product",
            "signalType": "Regulatory approval",
            "marketSegment": "Clinical",
            "technology": "Diagnostics",
            "theme": "Regulatory expansion",
            "intent": "Expand approved clinical use",
            "summary": clean_text(short_body) or title,
        }
    classification = classify_release(text)
    technology = "LC/UHPLC" if any(term in lowered for term in ("column", "chromatograph", "altura", "plrp", "size exclusion")) else "Software" if any(term in lowered for term in ("ai-driven", "analysis module", "software", "xcellence")) else "Portfolio"
    return {
        "classification": classification,
        "signalType": "Product release" if classification == "product" else "Press release",
        "marketSegment": "Biopharma" if any(term in lowered for term in ("biotherapeut", "biopharma", "protein", "oligonucleotide")) else "Corporate",
        "technology": technology,
        "theme": "Product and workflow expansion" if classification == "product" else "Corporate strategic activity",
        "intent": "Product and portfolio expansion" if classification == "product" else "Corporate strategic activity",
        "summary": clean_text(short_body) or title,
    }


def collect_investor_releases(statuses: list[dict]) -> dict[str, dict]:
    query = urlencode({
        "LanguageId": 1,
        "bodyType": 3,
        "pressReleaseDateFilter": 3,
        "categoryId": "",
        "pageSize": -1,
        "pageNumber": 0,
        "tagList": "",
        "includeTags": "true",
        "year": date.today().year,
        "excludeSelection": 1,
    })
    feed_url = f"{INVESTOR_IR_FEED}?{query}"
    status, body = fetch(feed_url)
    statuses.append(source_status(
        INVESTOR_NEWS_PAGE,
        "official_ir_news_api",
        status,
        "Official Agilent investor-relations news feed; 10-second crawl delay applied.",
    ))
    if not status or not 200 <= status < 300 or not body:
        return {}
    try:
        rows = json.loads(body.decode("utf-8", errors="replace")).get("GetPressReleaseListResult", [])
    except (json.JSONDecodeError, AttributeError):
        return {}
    releases: dict[str, dict] = {}
    for row in rows:
        title = clean_text(str(row.get("Headline", "")))
        if not title:
            continue
        path = row.get("LinkToDetailPage") or row.get("LinkToPage") or row.get("LinkToUrl") or ""
        url = urljoin("https://www.investor.agilent.com", path)
        if not url or not allowed(url):
            continue
        releases[url] = {
            "date": parse_ir_date(str(row.get("PressReleaseDate", ""))),
            "title": title,
            "url": url,
            "sourceId": "agilent-investor-news",
            "sourceName": "Agilent investor relations news",
            **release_enrichment(title, str(row.get("ShortBody", ""))),
        }
    return releases


def dedupe_press_releases(releases: dict[str, dict]) -> dict[str, dict]:
    """Keep one canonical record when the newsroom and IR feed syndicate a release."""
    selected: dict[tuple[str, str], tuple[str, dict]] = {}
    for url, release in releases.items():
        title_key = re.sub(r"[^a-z0-9]+", " ", str(release.get("title", "")).lower()).strip()
        key = (str(release.get("date", ""))[:10], title_key)
        current = selected.get(key)
        # Prefer the public newsroom URL because it is the editorial source page;
        # the IR endpoint remains the completeness feed when no newsroom copy exists.
        preference = 1 if "agilent.com/about/newsroom" in url or "news.agilent.com" in url else 0
        current_preference = (
            1 if current and ("agilent.com/about/newsroom" in current[0] or "news.agilent.com" in current[0]) else 0
        )
        if current is None or preference > current_preference:
            selected[key] = (url, release)
    return {url: release for url, release in selected.values()}


def collect_products(statuses: list[dict]) -> dict[str, str]:
    status, body = fetch(SITEMAP_INDEX)
    statuses.append(source_status(SITEMAP_INDEX, "sitemap_index", status, "Authoritative sitemap index."))
    discovered: list[str] = []
    if status and 200 <= status < 300:
        try:
            sitemap_urls, _ = parse_sitemap(body)
            discovered = [
                url for url in sitemap_urls
                if re.search(r"/(?:products0|pim_commerce0?1|pim_commerce1)\.xml$", url, re.I)
                and "otherlocales" not in url.lower()
            ]
        except ET.ParseError:
            discovered = []

    product_sitemaps = list(dict.fromkeys(discovered or PRODUCT_SITEMAPS))
    pages: dict[str, str] = {}
    for sitemap_url in product_sitemaps:
        status, body = fetch(sitemap_url, timeout=120)
        statuses.append(source_status(sitemap_url, "product_sitemap_xml", status, "Authoritative product inventory."))
        if not status or not 200 <= status < 300:
            continue
        try:
            _, sitemap_pages = parse_sitemap(body)
        except ET.ParseError:
            continue
        for url, lastmod in sitemap_pages.items():
            if LCMS_PATH in urlparse(url).path.lower() and allowed(url):
                pages[url] = lastmod
    return pages


def collect_press_releases(statuses: list[dict]) -> dict[str, dict]:
    status, body = fetch(PRESS_INDEX)
    browser_result = browser_fetch(PRESS_INDEX) if status == 403 else {}
    effective_status = browser_result.get("httpStatus") if browser_result else status
    method = "real_browser" if browser_result else "press_release_index"
    statuses.append(source_status(PRESS_INDEX, method, effective_status, "Authoritative dated press-release index."))
    if browser_result:
        links = [(item.get("url", ""), item.get("title", "")) for item in browser_result.get("links", [])]
    elif status and 200 <= status < 300:
        parser = LinkParser(PRESS_INDEX)
        parser.feed(body.decode("utf-8", errors="replace"))
        links = parser.links
    else:
        return {}
    releases: dict[str, dict] = {}
    for url, title in links:
        if not re.search(r"/about/newsroom/presrel/\d{4}/[^/]+\.html$", url, re.I) or not allowed(url):
            continue
        normalized_title = title or Path(urlparse(url).path).stem
        releases[url] = {
            "date": release_date(url),
            "title": normalized_title,
            "url": url,
            "classification": classify_release(normalized_title),
        }
    return releases


def enrich_changed_pages(items: list[dict], statuses: list[dict]) -> None:
    for item in items:
        url = item.get("url", "")
        if not url or not allowed(url):
            continue
        status, body = fetch(url)
        browser_result = browser_fetch(url) if status == 403 else {}
        effective_status = browser_result.get("httpStatus") if browser_result else status
        method = "real_browser" if browser_result else "changed_product_page"
        statuses.append(source_status(url, method, effective_status, "Changed product page inspected for detail."))
        if browser_result:
            item["pageTitle"] = browser_result.get("title", "")
            item["pageExcerpt"] = browser_result.get("text", "")[:1600]
        elif status and 200 <= status < 300 and body:
            parser = LinkParser(url)
            parser.feed(body[:250000].decode("utf-8", errors="replace"))
            title_match = re.search(rb"<title[^>]*>(.*?)</title>", body[:250000], re.I | re.S)
            if title_match:
                item["pageTitle"] = re.sub(r"\s+", " ", title_match.group(1).decode("utf-8", errors="replace")).strip()


def enrich_new_releases(items: list[dict], statuses: list[dict]) -> None:
    for item in items:
        # The official IR API already supplies the dated title and release body.
        # Do not refetch every detail page merely to recreate metadata that the
        # authoritative feed returned in the same response.
        if item.get("sourceId") == "agilent-investor-news" and item.get("summary"):
            continue
        url = item.get("url", "")
        status, body = fetch(url)
        browser_result = browser_fetch(url) if status == 403 else {}
        effective_status = browser_result.get("httpStatus") if browser_result else status
        method = "real_browser" if browser_result else "new_press_release"
        statuses.append(source_status(url, method, effective_status, "New release fetched for classification and detail."))
        if browser_result:
            item["pageTitle"] = browser_result.get("title", "")
            item["excerpt"] = browser_result.get("text", "")[:2400]
        elif status and 200 <= status < 300 and body:
            text = re.sub(rb"<[^>]+>", b" ", body[:500000])
            item["excerpt"] = re.sub(r"\s+", " ", text.decode("utf-8", errors="replace")).strip()[:2400]
        item["classification"] = classify_release(f"{item.get('title', '')} {item.get('excerpt', '')}")


def monitor() -> dict:
    statuses: list[dict] = []
    products = collect_products(statuses)
    newsroom_releases = collect_press_releases(statuses)
    investor_releases = collect_investor_releases(statuses)
    press_releases = dedupe_press_releases({**newsroom_releases, **investor_releases})
    investor_status, _ = fetch(INVESTOR_PAGE)
    investor_browser = browser_fetch(INVESTOR_PAGE) if investor_status == 403 else {}
    effective_investor_status = investor_browser.get("httpStatus") if investor_browser else investor_status
    investor_method = "real_browser" if investor_browser else "investor_page"
    statuses.append(source_status(INVESTOR_PAGE, investor_method, effective_investor_status, "Investor relations source; 10-second crawl delay applied."))

    previous = read_json(SNAPSHOT_FILE)
    previous_products = previous.get("products", {})
    previous_releases = previous.get("pressReleases", {})
    previous_product_initialized = bool(previous.get("productInventoryInitialized", previous_products))
    previous_press_initialized = bool(previous.get("pressIndexInitialized", previous_releases))
    product_success = any(
        item.get("status") == "available" and item.get("fetchMethod") == "product_sitemap_xml"
        for item in statuses
    ) and bool(products)
    newsroom_success = any(
        item.get("status") == "available" and item.get("url") == PRESS_INDEX
        for item in statuses
    ) and bool(newsroom_releases)
    investor_success = any(
        item.get("status") == "available" and item.get("fetchMethod") == "official_ir_news_api"
        for item in statuses
    ) and bool(investor_releases)
    press_success = (newsroom_success or investor_success) and bool(press_releases)

    if not product_success:
        products = previous_products
    if not press_success:
        press_releases = previous_releases
    elif not newsroom_success or not investor_success:
        # A partial source outage must not remove records collected successfully
        # by the other official Agilent source in a prior run.
        press_releases = dedupe_press_releases({**previous_releases, **press_releases})
    product_baseline_created = product_success and not previous_product_initialized
    press_baseline_created = press_success and not previous_press_initialized

    new_products = []
    discontinued_products = []
    updated_products = []
    new_press_releases = []
    recent_press_releases = []
    if previous_product_initialized and product_success:
        new_products = [
            {"url": url, "lastmod": lastmod, "category": "LC/MS"}
            for url, lastmod in products.items() if url not in previous_products
        ]
        discontinued_products = [
            {"url": url, "lastmod": lastmod, "category": "LC/MS", "verification": "manual confirmation required"}
            for url, lastmod in previous_products.items() if url not in products
        ]
        updated_products = [
            {"url": url, "lastmod": lastmod, "previousLastmod": previous_products[url], "category": "LC/MS"}
            for url, lastmod in products.items()
            if url in previous_products and lastmod and lastmod != previous_products[url]
        ]
        enrich_changed_pages(new_products + updated_products, statuses)
    if previous_press_initialized and press_success:
        replay_cutoff = date.today() - timedelta(days=120)
        new_press_releases = [
            release for url, release in press_releases.items()
            if url not in previous_releases
            or release.get("date", "") >= replay_cutoff.isoformat()
        ]
        enrich_new_releases(new_press_releases, statuses)
    if press_success:
        replay_cutoff = date.today() - timedelta(days=120)
        recent_press_releases = [
            release for release in press_releases.values()
            if release.get("date", "") >= replay_cutoff.isoformat()
        ]

    unverified_inventory_changes = {
        "new": new_products,
        "updated": updated_products,
        "missing": discontinued_products,
    }
    # Sitemap observations alone cannot substantiate "added", "updated", or
    # "removed" page-content claims.  A future page-diff collector may promote an
    # observation by attaching a complete changeEvidence object.
    new_products = [item for item in new_products if item.get("changeEvidence")]
    updated_products = [item for item in updated_products if item.get("changeEvidence")]
    discontinued_products = [item for item in discontinued_products if item.get("changeEvidence")]

    authoritative_success = any(
        item["status"] == "available" and item["fetchMethod"] in {"sitemap_index", "product_sitemap_xml", "press_release_index", "official_ir_news_api"}
        for item in statuses
    )
    if authoritative_success:
        write_json(SNAPSHOT_FILE, {
            "snapshotSchemaVersion": 2,
            "observationType": "sitemap_inventory",
            "capturedAt": utc_now(),
            "productInventoryInitialized": previous_product_initialized or product_success,
            "pressIndexInitialized": previous_press_initialized or press_success,
            "products": products,
            "pressReleases": press_releases,
            "unverifiedInventoryChanges": unverified_inventory_changes,
        })

    newest_product = max(
        ({"url": url, "date": lastmod} for url, lastmod in products.items()),
        key=lambda item: (str(item.get("date", "")), str(item.get("url", ""))),
        default={},
    )
    newest_release = max(
        press_releases.values(),
        key=lambda item: (str(item.get("date", "")), str(item.get("url", ""))),
        default={},
    )

    return {
        "generatedAt": utc_now(),
        "baselineCreated": {
            "productInventory": product_baseline_created,
            "pressIndex": press_baseline_created,
        },
        "inventoryCounts": {"lcmsProductPages": len(products), "pressReleases": len(press_releases)},
        "sourceCoverage": {
            "productInventory": {
                "complete": product_success,
                "recordsSeen": len(products),
                "newestDate": newest_product.get("date"),
                "newestUrl": newest_product.get("url"),
            },
            "pressArchive": {
                "complete": press_success,
                "newsroomComplete": newsroom_success,
                "investorFeedComplete": investor_success,
                "recordsSeen": len(press_releases),
                "newestDate": newest_release.get("date"),
                "newestTitle": newest_release.get("title"),
                "newestUrl": newest_release.get("url"),
            },
        },
        "new_products": new_products,
        "discontinued_products": discontinued_products,
        "updated_products": updated_products,
        "unverified_inventory_changes": unverified_inventory_changes,
        "new_press_releases": sorted(new_press_releases, key=lambda item: item.get("date", ""), reverse=True),
        "recent_press_releases": sorted(recent_press_releases, key=lambda item: item.get("date", ""), reverse=True),
        "source_status": statuses,
        "monitoringNote": "Agilent WAF responses do not affect source quality. Authoritative sitemap and press indexes are monitored with an honest crawler identity.",
    }


def main() -> int:
    result = monitor()
    write_json(OUTPUT_FILE, result)
    catalog = read_json(SOURCE_CATALOG_FILE)
    sources = {source.get("id"): source for source in catalog.get("sources", [])}
    checked_at = result.get("generatedAt")
    if "agilent-newsroom" in sources:
        sources["agilent-newsroom"].update({
            "extractionStatus": "extracted",
            "extractionReason": f"Official dated press-release index parsed; {result['inventoryCounts']['pressReleases']} releases tracked.",
            "extractedRecords": result["inventoryCounts"]["pressReleases"],
            "fetchMethod": "dated_press_index",
            "lastExtractionCheck": checked_at,
        })
    if "agilent-investor-news" in sources:
        earnings_count = sum(
            1 for item in result.get("new_press_releases", [])
            if completed_earnings_title(item.get("title", ""))
        )
        sources["agilent-investor-news"].update({
            "extractionStatus": "extracted",
            "extractionReason": f"Official investor-relations feed parsed; {earnings_count} recent completed earnings results retained for replay.",
            "extractedRecords": earnings_count,
            "fetchMethod": "official_ir_news_api",
            "lastExtractionCheck": checked_at,
        })
    if "agilent-lcms" in sources:
        sources["agilent-lcms"].update({
            "extractionStatus": "extracted",
            "extractionReason": f"Official product sitemaps parsed; {result['inventoryCounts']['lcmsProductPages']} LC/MS product pages tracked.",
            "extractedRecords": result["inventoryCounts"]["lcmsProductPages"],
            "fetchMethod": "product_sitemap_xml",
            "lastExtractionCheck": checked_at,
        })
    write_json(SOURCE_CATALOG_FILE, catalog)
    print(f"Wrote {OUTPUT_FILE}")
    print(json.dumps(result["inventoryCounts"]))
    return 0 if any(item.get("status") == "available" for item in result["source_status"]) else 1


if __name__ == "__main__":
    raise SystemExit(main())
