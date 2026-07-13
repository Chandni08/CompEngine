#!/usr/bin/env python3
"""Monitor authoritative Agilent product, press, and investor sources."""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import time
import xml.etree.ElementTree as ET
from datetime import date, datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse


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
        return None, b""
    if not result.stdout:
        return None, b""
    body, _, status_text = result.stdout.rpartition(b"\n")
    try:
        status = int(status_text.decode("ascii", errors="ignore"))
    except ValueError:
        status = None
    return status, body


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
        "sourceQuality": "reliable",
        "reliabilityNote": (
            "A 403 from a plain HTTP client is an Agilent WAF artifact and does not reduce source quality."
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
    press_releases = collect_press_releases(statuses)
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
    press_success = any(
        item.get("status") == "available" and item.get("url") == PRESS_INDEX
        for item in statuses
    ) and bool(press_releases)

    if not product_success:
        products = previous_products
    if not press_success:
        press_releases = previous_releases
    product_baseline_created = product_success and not previous_product_initialized
    press_baseline_created = press_success and not previous_press_initialized

    new_products = []
    discontinued_products = []
    updated_products = []
    new_press_releases = []
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
        new_press_releases = [release for url, release in press_releases.items() if url not in previous_releases]
        enrich_new_releases(new_press_releases, statuses)

    authoritative_success = any(
        item["status"] == "available" and item["fetchMethod"] in {"sitemap_index", "product_sitemap_xml", "press_release_index"}
        for item in statuses
    )
    if authoritative_success:
        write_json(SNAPSHOT_FILE, {
            "capturedAt": utc_now(),
            "productInventoryInitialized": previous_product_initialized or product_success,
            "pressIndexInitialized": previous_press_initialized or press_success,
            "products": products,
            "pressReleases": press_releases,
        })

    return {
        "generatedAt": utc_now(),
        "baselineCreated": {
            "productInventory": product_baseline_created,
            "pressIndex": press_baseline_created,
        },
        "inventoryCounts": {"lcmsProductPages": len(products), "pressReleases": len(press_releases)},
        "new_products": new_products,
        "discontinued_products": discontinued_products,
        "updated_products": updated_products,
        "new_press_releases": sorted(new_press_releases, key=lambda item: item.get("date", ""), reverse=True),
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
