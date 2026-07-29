"""Chromatography Forum public topic adapter (execution order 1)."""

from __future__ import annotations

import logging
import os
import re
from urllib.parse import parse_qs, urlsplit

from .common import (
    EvidenceRecord,
    RobotsAwareClient,
    enabled,
    extract_page_date,
    parse_page,
    public_html,
    unique_keywords,
)


LOGGER = logging.getLogger(__name__)
ENV_NAME = "CUSTOMER_VOICE_CHROMFORUM_ENABLED"
HOSTS = {"chromforum.org", "www.chromforum.org"}
DEFAULT_SEEDS = (
    "https://www.chromforum.org/viewtopic.php?t=8508",
    "https://www.chromforum.org/viewforum.php?f=1",
)
DISALLOWED_PATHS = (
    "/adm/", "/cache/", "/files/", "/images/", "/includes/", "/store/", "/download/",
    "/ucp.php", "/mcp.php", "/search.php", "/faq.php", "/memberlist.php", "/login.php",
    "/privmsg.php", "/viewonline.php", "/posting.php", "/report.php",
)
VENDORS = ("Waters", "ACQUITY", "Alliance", "Agilent", "InfinityLab", "Thermo", "Vanquish", "Shimadzu", "Nexera", "SCIEX", "ExionLC")
TECHNICAL_TERMS = (
    *VENDORS, "HPLC", "UHPLC", "LC-MS", "chromatography", "method transfer", "carryover",
    "autosampler", "pressure", "leak", "software", "data export", "troubleshoot", "troubleshooting", "service",
)


def in_scope(url: str) -> bool:
    parts = urlsplit(url)
    path = parts.path.lower()
    if parts.scheme not in {"http", "https"} or parts.hostname not in HOSTS:
        return False
    if any(path.startswith(blocked) for blocked in DISALLOWED_PATHS):
        return False
    query = parse_qs(parts.query, keep_blank_values=True)
    if any(key.lower() == "sid" for key in query):
        return False
    return path in {"/viewtopic.php", "/viewforum.php"}


def _comparison_score(title: str) -> int:
    lowered = title.lower()
    vendor_count = sum(term.lower() in lowered for term in VENDORS)
    return vendor_count * 10 + sum(term in lowered for term in (" vs ", " versus ", "compare", "comparison", "which system"))


def collect(client: RobotsAwareClient | None = None) -> list[EvidenceRecord]:
    if not enabled(ENV_NAME):
        LOGGER.info("Chromatography Forum adapter disabled by %s", ENV_NAME)
        return []
    client = client or RobotsAwareClient()
    seeds = [item.strip() for item in os.getenv("CHROMFORUM_SEEDS", ",".join(DEFAULT_SEEDS)).split(",") if item.strip()]
    max_topics = max(1, int(os.getenv("CHROMFORUM_MAX_TOPICS", "4")))
    topic_candidates: list[tuple[int, str]] = []
    records: list[EvidenceRecord] = []

    for seed in seeds:
        response = client.get(seed, in_scope)
        html = public_html(response)
        if not html or response is None:
            continue
        parser = parse_page(response.url, html)
        if urlsplit(response.url).path.lower() == "/viewforum.php":
            for link, anchor in parser.links:
                if in_scope(link) and urlsplit(link).path.lower() == "/viewtopic.php":
                    topic_candidates.append((_comparison_score(anchor), link))
            continue
        record = _topic_record(response.url, html, parser)
        if record:
            records.append(record)

    seen = {record.url for record in records}
    for _, url in sorted(topic_candidates, key=lambda item: (-item[0], item[1])):
        if len(records) >= max_topics or url in seen:
            break
        response = client.get(url, in_scope)
        html = public_html(response)
        if not html or response is None:
            continue
        parser = parse_page(response.url, html)
        record = _topic_record(response.url, html, parser)
        if record:
            records.append(record)
            seen.add(record.url)
    return records


def _topic_record(url: str, html: str, parser) -> EvidenceRecord | None:
    text = parser.text
    if not any(term.lower() in text.lower() for term in ("HPLC", "UHPLC", "LC-MS", "chromatograph")):
        return None
    source_date = extract_page_date(parser, html, fallback="")
    if not source_date:
        LOGGER.warning("Chromatography Forum topic has no public date; skipping %s", url)
        return None
    title = re.sub(r"\s*[-|].*Chromatography Forum.*$", "", parser.title, flags=re.I).strip()
    return EvidenceRecord(
        label=f"Chromatography Forum: {title or 'LC discussion'}",
        url=url,
        source_keywords=unique_keywords(text, TECHNICAL_TERMS),
        record_type="Public chromatography forum discussion",
        source_date=source_date,
        source_type="community_forum",
        source_name="Chromatography Forum",
        excerpt=text[:900],
    )
