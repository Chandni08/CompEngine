"""SelectScience public product-review and article adapter (execution order 2)."""

from __future__ import annotations

import logging
import os
import re
import hashlib
from datetime import date, datetime
from typing import Any, Iterable
from urllib.parse import urlsplit

from .common import EvidenceRecord, RobotsAwareClient, clean_text, enabled, extract_page_date, parse_page, public_html, unique_keywords


LOGGER = logging.getLogger(__name__)
ENV_NAME = "CUSTOMER_VOICE_SELECTSCIENCE_ENABLED"
HOSTS = {"selectscience.net", "www.selectscience.net"}
DEFAULT_SEEDS = (
    # Waters
    "https://www.selectscience.net/product/acquity-uplc-system",
    "https://www.selectscience.net/product/arc-hplc-system",
    "https://www.selectscience.net/product/acquity-uplc-r-i-class-plus-system",
    "https://www.selectscience.net/product/waters-alliance-tm-hplc-system",
    "https://www.selectscience.net/product/acquity-uplc-beh-columns",
    # Agilent
    "https://www.selectscience.net/product/agilent-1290-infinity-ii-lc-system/",
    "https://www.selectscience.net/product/agilent-1290-infinity-iii-lc-system",
    "https://www.selectscience.net/product/agilent-1260-infinity-iii-binary-pump/",
    # Thermo Fisher
    "https://www.selectscience.net/product/thermo-scientific-tm-vanquish-tm-horizon-uhplc-system",
    "https://www.selectscience.net/product/thermo-scientific-tm-vanquish-tm-flex-quaternary-uhplc-system",
    "https://www.selectscience.net/product/thermo-scientific-tm-vanquish-tm-neo-uhplc-system/",
    "https://www.selectscience.net/product/high-performance-liquid-chromatography",
    # Shimadzu
    "https://www.selectscience.net/product/nexera-40-series-uhplc",
    "https://www.selectscience.net/product/i-series-integrated-u-hplc-systems",
    "https://www.selectscience.net/product/prominence-hplc-system",
    # Additional vendor comparison context
    "https://www.selectscience.net/product/lc-300-tm-hplc-and-uhplc-system/",
)
DISALLOWED_PREFIXES = ("/search", "/register", "/review", "/user/")
TERMS = (
    "Waters", "ACQUITY", "Alliance", "Agilent", "InfinityLab", "Thermo Fisher", "Thermo Scientific",
    "Dionex", "Ultimate 3000", "Vanquish",
    "Shimadzu", "Nexera", "SCIEX", "HPLC", "UHPLC", "LC-MS", "rating", "review", "reliable",
    "ease of use", "software", "service", "maintenance", "carryover", "method transfer",
    "method continuity", "validated method", "migration", "modernization", "troubleshoot",
    "troubleshooting", "diagnostic", "root cause", "recovery", "pressure", "autosampler",
    "serviceability", "data portability", "data conversion", "data processing", "data access",
    "data export", "export", "open format", "mzML", "lock-in", "third-party analysis",
    "workflow setup", "setup", "training", "onboarding", "template", "software usability",
    "user friendly", "user-friendly", "easy to use", "lab advisor",
    "ecosystem integration", "instrument control", "cross-vendor integration", "contact closure",
    "operating cost", "cost", "reproducible", "robustness",
)


def in_scope(url: str) -> bool:
    parts = urlsplit(url)
    path = parts.path.lower()
    if parts.scheme not in {"http", "https"} or parts.hostname not in HOSTS:
        return False
    if any(path.startswith(prefix) for prefix in DISALLOWED_PREFIXES):
        return False
    return path.startswith("/product/") or path.startswith("/article/") or path.startswith("/articles/")


def _walk_json(value: Any) -> Iterable[dict[str, Any]]:
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from _walk_json(child)
    elif isinstance(value, list):
        for child in value:
            yield from _walk_json(child)


def _rating(value: Any) -> float | None:
    if isinstance(value, dict):
        value = value.get("ratingValue")
    try:
        result = float(value)
        return result if 0 <= result <= 10 else None
    except (TypeError, ValueError):
        return None


def _public_review_date(value: str) -> str:
    """Normalize the human-readable date rendered on a public review card."""
    text = clean_text(re.sub(r"<[^>]+>", " ", value)).split("|", 1)[0].strip()
    text = re.sub(r"\bSept\b", "Sep", text, flags=re.I)
    for pattern in ("%d %b %Y", "%d %B %Y", "%b %d, %Y", "%B %d, %Y"):
        try:
            return datetime.strptime(text, pattern).date().isoformat()
        except ValueError:
            continue
    return ""


def _visible_reviews(html: str) -> list[tuple[str, float, str, str, str]]:
    """Extract the dated review cards rendered on a public product page.

    SelectScience exposes its full review wording and numeric rating in the
    product-page HTML, while its JSON-LD currently contains only an undated
    summary review. The visible cards are therefore the primary public record.
    """
    card_pattern = re.compile(
        r'<div\s+class="Review_applicationArea[^\"]*">.*?<p>(?P<area>.*?)</p>\s*</div>'
        r'\s*<p>(?P<body>.*?)</p>\s*'
        r'<p\s+class="Review_reviewDate[^\"]*">.*?Review Date:\s*</strong>(?P<date>.*?)</p>',
        re.I | re.S,
    )
    rating_pattern = re.compile(r"<p>\s*Average Rating\s*(?:<!--.*?-->\s*)*(\d+(?:\.\d+)?)\s*</p>", re.I | re.S)
    reviews: list[tuple[str, float, str, str, str]] = []
    for index, match in enumerate(card_pattern.finditer(html)):
        preceding = html[max(0, match.start() - 6000):match.start()]
        ratings = rating_pattern.findall(preceding)
        score = _rating(ratings[-1] if ratings else None)
        review_date = _public_review_date(match.group("date"))
        body = clean_text(re.sub(r"<[^>]+>", " ", match.group("body")))
        application_area = clean_text(re.sub(r"<[^>]+>", " ", match.group("area")))
        if body and score is not None and review_date:
            reviews.append((body, score, review_date, f"visible-review-{index}", application_area))
    return reviews


def collect(client: RobotsAwareClient | None = None) -> list[EvidenceRecord]:
    if not enabled(ENV_NAME):
        LOGGER.info("SelectScience adapter disabled by %s", ENV_NAME)
        return []
    client = client or RobotsAwareClient()
    seeds = [item.strip() for item in os.getenv("SELECTSCIENCE_SEEDS", ",".join(DEFAULT_SEEDS)).split(",") if item.strip()]
    records: list[EvidenceRecord] = []
    for seed in seeds:
        response = client.get(seed, in_scope)
        html = public_html(response)
        if not html or response is None:
            continue
        parser = parse_page(response.url, html)
        reviews: list[tuple[str, float, str, str, str]] = []
        article_dates: list[str] = []
        for root in parser.json_ld:
            for item in _walk_json(root):
                item_type = str(item.get("@type") or "").lower()
                if item_type == "review" or "reviewBody" in item:
                    body = str(item.get("reviewBody") or item.get("description") or "").strip()
                    score = _rating(item.get("reviewRating"))
                    candidate_date = str(item.get("datePublished") or "")[:10]
                    review_id = str(item.get("@id") or item.get("url") or "")
                    if body and score is not None and re.fullmatch(r"\d{4}-\d{2}-\d{2}", candidate_date):
                        reviews.append((body, score, candidate_date, review_id, ""))
                if item_type in {"product", "article", "newsarticle"}:
                    candidate_date = str(item.get("datePublished") or "")[:10]
                    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", candidate_date):
                        article_dates.append(candidate_date)
        # Product reviews are only useful when the public page exposes both the
        # review wording and a numeric rating. Articles remain valid without them.
        is_product = urlsplit(response.url).path.lower().startswith("/product/")
        if is_product:
            visible = _visible_reviews(html)
            if visible:
                reviews = visible
        if is_product and not reviews:
            LOGGER.warning("SelectScience product page lacks public rating + review text; skipping %s", response.url)
            continue
        source_date = max(
            [item[2] for item in reviews] if is_product else article_dates,
            default=extract_page_date(parser, html, fallback=""),
        )
        if not source_date:
            LOGGER.warning("SelectScience page has no public date; skipping %s", response.url)
            continue
        title = re.sub(r"\s*[-|].*SelectScience.*$", "", parser.title, flags=re.I).strip()
        if is_product:
            for body, score, review_date, review_id, application_area in reviews:
                digest = hashlib.sha256(f"{review_id}|{review_date}|{body}".encode("utf-8")).hexdigest()[:16]
                record_url = f"{response.url}?reviewItem={digest}"
                records.append(EvidenceRecord(
                    label=f"SelectScience review: {title or 'LC product evidence'}",
                    url=record_url,
                    # Theme validation must be grounded in this review's visible
                    # wording, not in manufacturer copy elsewhere on the page.
                    source_keywords=unique_keywords(f"{title} {body} {application_area}", TERMS),
                    record_type="Public structured product review",
                    source_date=review_date,
                    source_type="structured_review",
                    source_name="SelectScience",
                    excerpt=body[:900],
                    rating=score,
                    review_text=body[:1800],
                    metadata={
                        "ratingScale": 5,
                        "productPageUrl": response.url,
                        "reviewItemId": digest,
                        **({"applicationArea": application_area} if application_area else {}),
                    },
                ))
        else:
            records.append(EvidenceRecord(
                label=f"SelectScience: {title or 'LC article'}",
                url=response.url,
                source_keywords=unique_keywords(parser.text, TERMS),
                record_type="Public SelectScience article",
                source_date=source_date,
                source_type="structured_review",
                source_name="SelectScience",
                excerpt=parser.text[:900],
            ))
    return records
