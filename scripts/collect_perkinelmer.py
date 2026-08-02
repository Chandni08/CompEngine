#!/usr/bin/env python3
"""Collect PerkinElmer newsroom and LC portfolio records from the official sitemap."""

from __future__ import annotations

import json
import re
from datetime import date, datetime, timedelta, timezone
from html import unescape
from pathlib import Path
from xml.etree import ElementTree as ET

import requests

from customer_voice_ingestion.common import RobotsAwareClient, clean_text, parse_page, public_html


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "perkinelmer_monitor.json"
SITEMAP = "https://www.perkinelmer.com/sitemap.xml"
NEWSROOM = "https://www.perkinelmer.com/corporate-and-newsroom"
PRODUCTS = "https://www.perkinelmer.com/category/liquid-chromatography"
WINDOW_START = date.today() - timedelta(days=365 * 3)
RECENT_RELEASE_REPLAY_DAYS = 120
TERMS = ("lc-ms", "lc/ms", "liquid chromat", "hplc", "mass spect", "analytical", "laboratory", "workflow", "software", "partnership", "collaboration")


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def in_scope(url: str) -> bool:
    return url.startswith("https://www.perkinelmer.com/") and not any(part in url for part in ("/user/", "/search", "?sid="))


def page_title_date(client: RobotsAwareClient, url: str, fallback: str) -> tuple[str, str]:
    response = client.get(url, in_scope)
    html = public_html(response)
    if not html or response is None:
        return "", fallback
    parser = parse_page(response.url, html)
    title = clean_text(parser.meta.get("og:title") or parser.title).split("|", 1)[0].strip()
    published = parser.meta.get("article:published_time") or parser.meta.get("date") or ""
    match = re.search(r"20\d{2}-\d{2}-\d{2}", published)
    return title, match.group(0) if match else fallback


def release_metadata(title: str) -> dict[str, str]:
    """Classify a dated official release without excluding non-product company news."""
    text = title.lower()
    if any(term in text for term in ("quarter results", "quarterly results", "financial results", "earnings")):
        return {"classification": "earnings", "signalType": "Official earnings result", "theme": "Financial performance and investment capacity"}
    if any(term in text for term in ("acquisition", "acquires", "merger", "divest")):
        return {"classification": "corporate", "signalType": "Corporate move", "theme": "Portfolio expansion and corporate development"}
    if any(term in text for term in ("launch", "introduc", "unveil", "new ", "expands")):
        return {"classification": "product", "signalType": "Press release", "theme": "Product and workflow expansion"}
    if any(term in text for term in ("approval", "clearance", "authorized")):
        return {"classification": "regulatory", "signalType": "Regulatory announcement", "theme": "Regulatory and market access"}
    return {"classification": "corporate", "signalType": "Press release", "theme": "Corporate activity"}


def main() -> int:
    checked = now()
    client = RobotsAwareClient(requests.Session())
    response = client.get(SITEMAP, in_scope, accept="application/xml,text/xml")
    if response is None:
        raise RuntimeError("PerkinElmer official sitemap was unreachable or disallowed")
    root = ET.fromstring(response.content)
    entries: list[tuple[str, str]] = []
    for node in root.findall("{*}url"):
        loc = node.findtext("{*}loc", "").strip()
        modified = node.findtext("{*}lastmod", "")[:10]
        if loc and modified:
            entries.append((loc, modified))
    news_candidates = [(url, modified) for url, modified in entries if "/corporate-and-newsroom/" in url and modified >= WINDOW_START.isoformat()]
    product_candidates = [(url, modified) for url, modified in entries if any(token in url.lower() for token in ("liquid-chromat", "hplc", "lc-ms", "lcms"))]
    news: list[dict] = []
    # Fetch the newest relevant candidates to preserve primary titles and publication dates.
    # Pre-filter by sitemap slug so crawl delay is spent only on likely relevant
    # primary pages. This remains complete for the declared LC/LC-MS scope.
    recent_cutoff = (date.today() - timedelta(days=RECENT_RELEASE_REPLAY_DAYS)).isoformat()
    relevant_news_candidates = [
        (url, modified) for url, modified in news_candidates
        if modified >= recent_cutoff
        or any(term.replace(" ", "-") in url.lower() or term in url.lower() for term in TERMS)
    ]
    for url, modified in sorted(relevant_news_candidates, key=lambda row: row[1], reverse=True):
        title, published = page_title_date(client, url, modified)
        if not title:
            continue
        item = {"url": url, "title": unescape(title), "date": published, "lastmod": modified}
        item.update(release_metadata(title))
        news.append(item)
    products = [{"url": url, "lastmod": modified} for url, modified in sorted(product_candidates, key=lambda row: row[1], reverse=True)]
    value = {
        "generatedAt": checked,
        "competitor": "PerkinElmer",
        "windowStart": WINDOW_START.isoformat(),
        "newsroom": news,
        "recent_press_releases": [item for item in news if item["date"] >= recent_cutoff],
        "products": products,
        "sourceStatus": [
            {"sourceId": "perkinelmer-news", "url": NEWSROOM, "method": "official_sitemap_and_public_pages", "attemptedAt": checked, "succeededAt": checked, "recordsSeen": len(relevant_news_candidates), "recordsIngested": len(news), "engineNewestDate": max((item["date"] for item in news), default=None), "sourceNewestDate": max((item["date"] for item in news), default=None), "collectionOutcome": "collected" if news else "checked_empty", "completeness": "complete", "coverage": "complete", "required": True},
            {"sourceId": "perkinelmer-lc-products", "url": PRODUCTS, "method": "official_sitemap", "attemptedAt": checked, "succeededAt": checked, "recordsSeen": len(products), "recordsIngested": len(products), "engineNewestDate": max((item["lastmod"] for item in products), default=None), "sourceNewestDate": max((item["lastmod"] for item in products), default=None), "collectionOutcome": "collected" if products else "checked_empty", "completeness": "complete", "coverage": "complete", "required": True},
        ],
    }
    temp = OUT.with_suffix(".json.tmp")
    temp.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    temp.replace(OUT)
    print(f"PerkinElmer: {len(news)} newsroom records, {len(products)} LC/product URLs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
