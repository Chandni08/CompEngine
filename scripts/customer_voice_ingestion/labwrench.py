"""LabWrench public forum, thread, and article adapter (execution order 3)."""

from __future__ import annotations

import logging
import os
import re
from urllib.parse import urlsplit

from .common import EvidenceRecord, RobotsAwareClient, enabled, extract_page_date, parse_page, public_html, unique_keywords


LOGGER = logging.getLogger(__name__)
ENV_NAME = "CUSTOMER_VOICE_LABWRENCH_ENABLED"
HOSTS = {"labwrench.com", "www.labwrench.com"}
DEFAULT_SEEDS = (
    "https://www.labwrench.com/thread/135698/hplc-pump-and-autosampler-preventative-performance-maintenance",
    "https://www.labwrench.com/thread/187926/waters-alliance-2695-seal-wash-pump-on-during-operation",
)
DISALLOWED_PREFIXES = (
    "/search", "/ask-a-question", "/equipment-results", "/sign-out", "/unsubscribe", "/update-profile", "/my-",
)
TERMS = (
    "Waters", "ACQUITY", "Alliance", "Agilent", "InfinityLab", "Thermo", "Vanquish", "Shimadzu",
    "Nexera", "SCIEX", "HPLC", "UHPLC", "LC-MS", "pump", "autosampler", "seal wash", "maintenance",
    "service", "software", "pressure", "carryover", "troubleshooting", "method transfer",
)


def in_scope(url: str) -> bool:
    parts = urlsplit(url)
    path = parts.path.lower()
    if parts.scheme not in {"http", "https"} or parts.hostname not in HOSTS:
        return False
    if any(path.startswith(prefix) for prefix in DISALLOWED_PREFIXES):
        return False
    return path.startswith("/forums/") or path.startswith("/thread/") or path.startswith("/articles/")


def collect(client: RobotsAwareClient | None = None) -> list[EvidenceRecord]:
    if not enabled(ENV_NAME):
        LOGGER.info("LabWrench adapter disabled by %s", ENV_NAME)
        return []
    client = client or RobotsAwareClient()
    seeds = [item.strip() for item in os.getenv("LABWRENCH_SEEDS", ",".join(DEFAULT_SEEDS)).split(",") if item.strip()]
    records: list[EvidenceRecord] = []
    for seed in seeds:
        response = client.get(seed, in_scope)
        html = public_html(response)
        if not html or response is None:
            continue
        parser = parse_page(response.url, html)
        text = parser.text
        if not any(term.lower() in text.lower() for term in ("HPLC", "UHPLC", "LC-MS", "chromatograph", "Waters", "Agilent", "Thermo", "Shimadzu", "SCIEX")):
            continue
        source_date = extract_page_date(parser, html, fallback="")
        if not source_date:
            LOGGER.warning("LabWrench page has no public date; skipping %s", response.url)
            continue
        title = re.sub(r"\s*[-|].*LabWrench.*$", "", parser.title, flags=re.I).strip()
        records.append(EvidenceRecord(
            label=f"LabWrench: {title or 'LC discussion'}",
            url=response.url,
            source_keywords=unique_keywords(text, TERMS),
            record_type="Public LabWrench discussion" if "/thread/" in urlsplit(response.url).path.lower() else "Public LabWrench article",
            source_date=source_date,
            source_type="community_forum",
            source_name="LabWrench",
            excerpt=text[:900],
        ))
    return records
