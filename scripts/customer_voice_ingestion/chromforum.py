"""Chromatography Forum public topic adapter (execution order 1)."""

from __future__ import annotations

import logging
import os
import re
import json
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlsplit, urlunsplit

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
    "https://www.chromforum.org/viewforum.php?f=1",
    "https://www.chromforum.org/viewtopic.php?t=8508",
    "https://www.chromforum.org/viewtopic.php?t=24303",
    "https://www.chromforum.org/viewtopic.php?t=46491",
    "https://www.chromforum.org/viewtopic.php?t=45171",
    "https://www.chromforum.org/viewtopic.php?t=119394",
    # Exact user discussions that directly name the purchase-driving themes.
    "https://www.chromforum.org/viewtopic.php?t=3574",
    "https://www.chromforum.org/viewtopic.php?t=12125",
)
ROOT = Path(__file__).resolve().parents[2]
CURSOR_FILE = ROOT / "data" / "source_cursors.json"
DISALLOWED_PATHS = (
    "/adm/", "/cache/", "/files/", "/images/", "/includes/", "/store/", "/download/",
    "/ucp.php", "/mcp.php", "/search.php", "/faq.php", "/memberlist.php", "/login.php",
    "/privmsg.php", "/viewonline.php", "/posting.php", "/report.php",
)
VENDORS = ("Waters", "ACQUITY", "Alliance", "Agilent", "InfinityLab", "Thermo", "Vanquish", "Shimadzu", "Nexera", "SCIEX", "ExionLC")
TECHNICAL_TERMS = (
    *VENDORS, "HPLC", "UHPLC", "LC-MS", "chromatography", "method transfer", "carryover",
    "autosampler", "pressure", "leak", "software", "data export", "troubleshoot", "troubleshooting", "service",
    "method continuity", "validated method", "migration", "modernization", "diagnostic", "root cause", "recovery",
    "serviceability", "data portability", "data conversion", "data processing", "data access", "export", "open format",
    "mzML", "lock-in", "third-party analysis", "workflow setup", "setup", "training", "onboarding", "template",
    "software usability", "ecosystem integration", "instrument control", "cross-vendor integration", "contact closure",
    "operating cost", "cost",
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
    max_topics = max(1, int(os.getenv("CHROMFORUM_MAX_TOPICS", "20")))
    max_pages = max(1, int(os.getenv("CHROMFORUM_MAX_FORUM_PAGES", "3")))
    # Boards are traversed newest page first. Comparison priority is applied
    # only within the same board page, never ahead of a newer page.
    topic_candidates: list[tuple[int, int, int, str]] = []
    records: list[EvidenceRecord] = []

    expanded_seeds: list[str] = []
    for seed in seeds:
        if urlsplit(seed).path.lower() != "/viewforum.php":
            expanded_seeds.append(seed)
            continue
        parts = urlsplit(seed)
        base_query = parse_qs(parts.query, keep_blank_values=True)
        for page in range(max_pages):
            query = {key: values[-1] for key, values in base_query.items()}
            query["start"] = str(page * 25)
            expanded_seeds.append(urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), "")))

    for page_index, seed in enumerate(expanded_seeds):
        response = client.get(seed, in_scope)
        html = public_html(response)
        if not html or response is None:
            continue
        parser = parse_page(response.url, html)
        if urlsplit(response.url).path.lower() == "/viewforum.php":
            for link_index, (link, anchor) in enumerate(parser.links):
                if in_scope(link) and urlsplit(link).path.lower() == "/viewtopic.php":
                    topic_candidates.append((page_index, -_comparison_score(anchor), link_index, link))
            continue
        record = _topic_record(response.url, html, parser)
        if record:
            records.append(record)

    seen = {record.url for record in records}
    for _, _, _, url in sorted(topic_candidates):
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
    if records:
        try:
            cursors = json.loads(CURSOR_FILE.read_text(encoding="utf-8")) if CURSOR_FILE.exists() else {}
        except (OSError, json.JSONDecodeError):
            cursors = {}
        newest = max(records, key=lambda item: (item.source_date, item.url))
        cursors["chromforum"] = {"sourceDate": newest.source_date, "url": newest.url}
        CURSOR_FILE.write_text(json.dumps(cursors, indent=2) + "\n", encoding="utf-8")
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
