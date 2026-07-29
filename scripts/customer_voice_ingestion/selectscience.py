"""SelectScience public product-review and article adapter (execution order 2)."""

from __future__ import annotations

import logging
import os
import re
from datetime import date
from typing import Any, Iterable
from urllib.parse import urlsplit

from .common import EvidenceRecord, RobotsAwareClient, enabled, extract_page_date, parse_page, public_html, unique_keywords


LOGGER = logging.getLogger(__name__)
ENV_NAME = "CUSTOMER_VOICE_SELECTSCIENCE_ENABLED"
HOSTS = {"selectscience.net", "www.selectscience.net"}
DEFAULT_SEEDS = (
    "https://www.selectscience.net/product/acquity-uplc-r-beh-c18-and-c8-columns",
)
DISALLOWED_PREFIXES = ("/search", "/register", "/review", "/user/")
TERMS = (
    "Waters", "ACQUITY", "Alliance", "Agilent", "InfinityLab", "Thermo Fisher", "Vanquish",
    "Shimadzu", "Nexera", "SCIEX", "HPLC", "UHPLC", "LC-MS", "rating", "review", "reliable",
    "ease of use", "software", "service", "maintenance", "carryover", "method transfer",
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
        review_bodies: list[str] = []
        ratings: list[float] = []
        dates: list[str] = []
        for root in parser.json_ld:
            for item in _walk_json(root):
                item_type = str(item.get("@type") or "").lower()
                if item_type == "review" or "reviewBody" in item:
                    body = str(item.get("reviewBody") or item.get("description") or "").strip()
                    if body:
                        review_bodies.append(body)
                    score = _rating(item.get("reviewRating"))
                    if score is not None:
                        ratings.append(score)
                    candidate_date = str(item.get("datePublished") or "")[:10]
                    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", candidate_date):
                        dates.append(candidate_date)
                if item_type in {"product", "article", "newsarticle"}:
                    score = _rating(item.get("aggregateRating"))
                    if score is not None:
                        ratings.append(score)
                    candidate_date = str(item.get("datePublished") or "")[:10]
                    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", candidate_date):
                        dates.append(candidate_date)
        # Product reviews are only useful when the public page exposes both the
        # review wording and a numeric rating. Articles remain valid without them.
        is_product = urlsplit(response.url).path.lower().startswith("/product/")
        if is_product and (not review_bodies or not ratings):
            LOGGER.warning("SelectScience product page lacks public rating + review text; skipping %s", response.url)
            continue
        source_date = max(dates, default=extract_page_date(parser, html, fallback=""))
        if not source_date:
            LOGGER.warning("SelectScience page has no public date; skipping %s", response.url)
            continue
        title = re.sub(r"\s*[-|].*SelectScience.*$", "", parser.title, flags=re.I).strip()
        review_text = " | ".join(dict.fromkeys(review_bodies))[:1800]
        source_text = f"{parser.text} {review_text}"
        records.append(EvidenceRecord(
            label=f"SelectScience: {title or 'LC product evidence'}",
            url=response.url,
            source_keywords=unique_keywords(source_text, TERMS),
            record_type="Public structured product review" if is_product else "Public SelectScience article",
            source_date=source_date,
            source_type="structured_review",
            source_name="SelectScience",
            excerpt=parser.text[:900],
            rating=round(sum(ratings) / len(ratings), 2) if ratings else None,
            review_text=review_text,
            metadata={"ratingScale": 5} if ratings else {},
        ))
    return records
