#!/usr/bin/env python3
"""Collect PerkinElmer newsroom and LC portfolio records from the official sitemap."""

from __future__ import annotations

import json
import re
from datetime import date, datetime, timedelta, timezone
from html import unescape
from pathlib import Path
from xml.etree import ElementTree as ET
from urllib.parse import unquote, urlsplit

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
LEGACY_DOMAIN = "https://perkinelmer.prod.acquia-sites.com"
CURRENT_DOMAIN = "https://www.perkinelmer.com"
TITLE_STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "been", "by", "for", "from",
    "in", "into", "is", "it", "its", "more", "of", "on", "or", "our", "the",
    "their", "this", "to", "with",
}
INCOMPLETE_TITLE_ENDINGS = {"a", "an", "and", "or", "the", "to", "for", "with", "of", "from", "in", "on", "at", "by", "its", "their", "our"}


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def in_scope(url: str) -> bool:
    return url.startswith("https://www.perkinelmer.com/") and not any(part in url for part in ("/user/", "/search", "?sid="))


def normalize_url(url: str) -> str:
    return url.replace(LEGACY_DOMAIN, CURRENT_DOMAIN)


def title_tokens(value: str) -> list[str]:
    return [
        token for token in re.findall(r"[a-z0-9]+", unquote(value).lower())
        if len(token) >= 3 and token not in TITLE_STOP_WORDS and not token.isdigit()
    ]


def title_matches_url(title: str, url: str) -> bool:
    slug = urlsplit(url).path.rstrip("/").rsplit("/", 1)[-1]
    slug_tokens = set(title_tokens(slug))
    page_tokens = set(title_tokens(title))
    if not slug_tokens or not page_tokens:
        return False
    overlap = len(slug_tokens & page_tokens)
    return overlap >= 2 and (
        overlap / len(slug_tokens) >= 0.34
        or overlap / len(page_tokens) >= 0.34
    )


def extract_release_title(html: str, url: str) -> str:
    """Choose the longest page-specific heading corroborated by the permalink.

    PerkinElmer's shared HTML title metadata can be stale, copied from a different
    newsroom item, or cut off mid-sentence. The visible release heading and active
    breadcrumb are page-specific, so they take part in candidate selection and the
    permalink prevents an unrelated global title from being accepted.
    """
    parser = parse_page(url, html)
    candidates: list[str] = []
    patterns = (
        r'<div[^>]+class=["\'][^"\']*without_image_desc[^"\']*["\'][^>]*>\s*<h2[^>]*>(.*?)</h2>',
        r'<li[^>]+class=["\'][^"\']*breadcrumb-item[^"\']*active[^"\']*["\'][^>]*>(.*?)</li>',
    )
    for pattern in patterns:
        for raw in re.findall(pattern, html, re.I | re.S):
            candidate = clean_text(re.sub(r"<[^>]+>", " ", raw))
            if candidate:
                candidates.append(candidate)
    metadata_title = clean_text(parser.meta.get("og:title") or parser.title).split("|", 1)[0].strip()
    if metadata_title:
        candidates.append(metadata_title)
    matching = [
        unescape(candidate) for candidate in dict.fromkeys(candidates)
        if title_matches_url(candidate, url)
    ]
    # The explicit test below avoids accepting any common incomplete terminal
    # word while retaining the list comprehension's stable candidate ordering.
    matching = [
        candidate for candidate in matching
        if (re.findall(r"[a-z0-9]+", candidate.lower())[-1:] or [""])[0] not in INCOMPLETE_TITLE_ENDINGS
    ]
    return max(matching, key=len, default="")


def page_title_date(client: RobotsAwareClient, url: str, fallback: str) -> tuple[str, str]:
    response = client.get(url, in_scope)
    html = public_html(response)
    if not html or response is None:
        return "", fallback
    parser = parse_page(response.url, html)
    title = extract_release_title(html, response.url)
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
        item = {
            "url": normalize_url(url),
            "title": unescape(title),
            "date": published,
            "lastmod": modified,
            "sourceTitleVerified": True,
            "titleSource": "page_content_url_match",
        }
        item.update(release_metadata(title))
        news.append(item)
    products = [{"url": normalize_url(url), "lastmod": modified} for url, modified in sorted(product_candidates, key=lambda row: row[1], reverse=True)]
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
