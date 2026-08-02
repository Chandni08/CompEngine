"""LabWrench public forum, thread, and article adapter (execution order 3)."""

from __future__ import annotations

import logging
import os
import re
import json
from pathlib import Path
from urllib.parse import urlsplit

from .common import EvidenceRecord, RobotsAwareClient, enabled, extract_page_date, parse_page, public_html, unique_keywords


LOGGER = logging.getLogger(__name__)
ENV_NAME = "CUSTOMER_VOICE_LABWRENCH_ENABLED"
HOSTS = {"labwrench.com", "www.labwrench.com"}
DEFAULT_SEEDS = (
    "https://www.labwrench.com/forums/",
    "https://www.labwrench.com/thread/821/trying-to-compare-to-waters-uplc",
    "https://www.labwrench.com/thread/260254/flow-stoppage",
    "https://www.labwrench.com/thread/13625/hplc-problems-rt-off-compounds-missing-not-seperating",
    "https://www.labwrench.com/thread/112979/no-signal-in-the-els-detector",
    "https://www.labwrench.com/thread/135698/hplc-pump-and-autosampler-preventative-performance-maintenance",
    "https://www.labwrench.com/thread/12858/serious-software-and-pump-problems",
)
ROOT = Path(__file__).resolve().parents[2]
CURSOR_FILE = ROOT / "data" / "source_cursors.json"
DISALLOWED_PREFIXES = (
    "/search", "/ask-a-question", "/equipment-results", "/sign-out", "/unsubscribe", "/update-profile", "/my-",
)
TERMS = (
    "Waters", "ACQUITY", "Alliance", "Agilent", "InfinityLab", "Thermo", "Vanquish", "Shimadzu",
    "Nexera", "SCIEX", "HPLC", "UHPLC", "LC-MS", "pump", "autosampler", "seal wash", "maintenance",
    "service", "software", "pressure", "carryover", "troubleshooting", "method transfer",
    "method continuity", "validated method", "migration", "modernization", "diagnostic", "root cause",
    "recovery", "serviceability", "data portability", "data conversion", "data processing", "data access",
    "data export", "export", "open format", "mzML", "lock-in", "third-party analysis", "workflow setup",
    "setup", "training", "onboarding", "template", "software usability", "ecosystem integration",
    "instrument control", "cross-vendor integration", "contact closure", "operating cost", "cost",
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
    max_pages = max(1, int(os.getenv("LABWRENCH_MAX_PAGES", "3")))
    max_records = max(1, int(os.getenv("LABWRENCH_MAX_RECORDS", "20")))
    records: list[EvidenceRecord] = []
    candidates: list[str] = []
    direct_seeds = [seed for seed in dict.fromkeys(seeds) if urlsplit(seed).path.lower().startswith(("/thread/", "/articles/"))]
    forum_queue = [seed for seed in dict.fromkeys(seeds) if urlsplit(seed).path.lower().startswith("/forums/")]
    visited_forums: set[str] = set()
    for seed in direct_seeds:
        response = client.get(seed, in_scope)
        html = public_html(response)
        if not html or response is None:
            continue
        record = _record(response.url, html, parse_page(response.url, html), trusted_seed=True)
        if record:
            records.append(record)
    while forum_queue and len(visited_forums) < max_pages:
        seed = forum_queue.pop(0)
        if seed in visited_forums:
            continue
        visited_forums.add(seed)
        response = client.get(seed, in_scope)
        html = public_html(response)
        if not html or response is None:
            continue
        parser = parse_page(response.url, html)
        if urlsplit(response.url).path.lower().startswith("/forums/"):
            for link, _ in parser.links:
                if in_scope(link) and urlsplit(link).path.lower().startswith(("/thread/", "/articles/")):
                    candidates.append(link)
            for link, _ in parser.links:
                if in_scope(link) and urlsplit(link).path.lower().startswith("/forums/") and link not in visited_forums:
                    forum_queue.append(link)
            continue
        record = _record(response.url, html, parser, trusted_seed=False)
        if record:
            records.append(record)

    seen = {record.url for record in records}
    for url in dict.fromkeys(candidates):
        if len(records) >= max_records or url in seen or urlsplit(url).path.lower().startswith("/forums/"):
            continue
        response = client.get(url, in_scope)
        html = public_html(response)
        if not html or response is None:
            continue
        record = _record(response.url, html, parse_page(response.url, html), trusted_seed=False)
        if record:
            records.append(record)
            seen.add(record.url)

    if records:
        try:
            cursors = json.loads(CURSOR_FILE.read_text(encoding="utf-8")) if CURSOR_FILE.exists() else {}
        except (OSError, json.JSONDecodeError):
            cursors = {}
        newest = max(records, key=lambda item: (item.source_date, item.url))
        cursors["labwrench"] = {"sourceDate": newest.source_date, "url": newest.url}
        CURSOR_FILE.write_text(json.dumps(cursors, indent=2) + "\n", encoding="utf-8")
    return records


def discovered_title_relevant(title: str) -> bool:
    """Reject forum-index noise before shared page chrome can add LC terms."""
    lowered = title.lower()
    lc_terms = ("hplc", "uhplc", "lc-ms", "chromatograph")
    vendor_terms = ("waters", "acquity", "alliance", "agilent", "thermo", "vanquish", "shimadzu", "nexera", "sciex")
    workflow_terms = ("pump", "autosampler", "column", "detector", "pressure", "carryover", "method", "software")
    return any(term in lowered for term in lc_terms) or (
        any(term in lowered for term in vendor_terms) and any(term in lowered for term in workflow_terms)
    )


def _record(url: str, html: str, parser, *, trusted_seed: bool = False) -> EvidenceRecord | None:
    title = re.sub(r"\s*[-|].*LabWrench.*$", "", parser.title, flags=re.I).strip()
    if not trusted_seed and not discovered_title_relevant(title):
        LOGGER.info("LabWrench discovered page is not LC-relevant; skipping %s", url)
        return None
    text = parser.text
    lowered = text.lower()
    lc_terms = ("hplc", "uhplc", "lc-ms", "chromatograph")
    vendor_terms = ("waters", "agilent", "thermo", "shimadzu", "sciex")
    workflow_terms = ("pump", "autosampler", "column", "detector", "pressure", "carryover", "method", "software")
    if not any(term in lowered for term in lc_terms) and not (
        any(term in lowered for term in vendor_terms) and any(term in lowered for term in workflow_terms)
    ):
        return None
    source_date = extract_page_date(parser, html, fallback="")
    if not source_date:
        LOGGER.warning("LabWrench page has no public date; skipping %s", url)
        return None
    return EvidenceRecord(
        label=f"LabWrench: {title or 'LC discussion'}",
        url=url,
        source_keywords=unique_keywords(text, TERMS),
        record_type="Public LabWrench discussion" if "/thread/" in urlsplit(url).path.lower() else "Public LabWrench article",
        source_date=source_date,
        source_type="community_forum",
        source_name="LabWrench",
        excerpt=text[:900],
    )
