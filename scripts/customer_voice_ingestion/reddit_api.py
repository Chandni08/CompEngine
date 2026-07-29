"""Official Reddit OAuth Data API adapter (execution order 4).

No Reddit HTML or unauthenticated ``*.json`` endpoint is used.  The adapter first
reads Reddit's robots policy (which prohibits HTML crawling), then uses only an
approved OAuth application's bearer token and the official listing API.
"""

from __future__ import annotations

import logging
import os
import re
import time
from datetime import datetime, timezone
from typing import Any

import requests

from .common import (
    DEFAULT_CRAWL_DELAY_SECONDS,
    EvidenceRecord,
    REQUEST_TIMEOUT_SECONDS,
    RobotsAwareClient,
    USER_AGENT,
    enabled,
    unique_keywords,
)


LOGGER = logging.getLogger(__name__)
ENV_NAME = "CUSTOMER_VOICE_REDDIT_ENABLED"
SUBREDDITS = ("Chromatography", "analyticalchemistry", "labrats")
TOKEN_URL = "https://www.reddit.com/api/v1/access_token"
API_ROOT = "https://oauth.reddit.com"
TERMS = (
    "Waters", "ACQUITY", "Alliance", "Agilent", "InfinityLab", "Thermo", "Vanquish", "Chromeleon",
    "Shimadzu", "Nexera", "SCIEX", "ExionLC", "HPLC", "UHPLC", "LC-MS", "mass spectrometry",
    "method transfer", "carryover", "autosampler", "pressure", "leak", "software", "data export",
    "troubleshooting", "service", "maintenance", "workflow setup", "cost",
)


def _lc_relevant(text: str) -> bool:
    lowered = text.lower()
    return any(term in lowered for term in ("hplc", "uhplc", "lc-ms", "lc/ms", "liquid chromat", "chromatograph", "mass spec"))


def _access_token(session: requests.Session, client: RobotsAwareClient) -> str | None:
    client_id = os.getenv("REDDIT_CLIENT_ID", "").strip()
    client_secret = os.getenv("REDDIT_CLIENT_SECRET", "").strip()
    if not client_id or not client_secret:
        LOGGER.info("Reddit adapter skipped: REDDIT_CLIENT_ID/REDDIT_CLIENT_SECRET are not configured")
        return None
    client.wait_for(TOKEN_URL)
    try:
        response = session.post(
            TOKEN_URL,
            auth=(client_id, client_secret),
            data={"grant_type": "client_credentials"},
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        client.mark_request(TOKEN_URL)
        if response.status_code != 200:
            LOGGER.warning("Reddit OAuth token request failed with HTTP %s; adapter skipped", response.status_code)
            return None
        token = str(response.json().get("access_token") or "").strip()
        if not token:
            LOGGER.warning("Reddit OAuth response contained no access token; adapter skipped")
            return None
        return token
    except (requests.RequestException, ValueError) as error:
        client.mark_request(TOKEN_URL)
        LOGGER.warning("Reddit OAuth token request failed; adapter skipped: %s", error)
        return None


def collect(client: RobotsAwareClient | None = None) -> list[EvidenceRecord]:
    if not enabled(ENV_NAME):
        LOGGER.info("Reddit adapter disabled by %s", ENV_NAME)
        return []
    client = client or RobotsAwareClient()
    # Runtime robots check is deliberate: it documents that HTML crawling is
    # disallowed.  This adapter therefore never requests Reddit content pages.
    if client.inspect_robots("https://www.reddit.com/") is None:
        LOGGER.warning("Reddit robots policy could not be loaded; adapter skipped")
        return []
    session = client.session
    token = _access_token(session, client)
    if not token:
        return []
    session.headers.update({"Authorization": f"bearer {token}", "User-Agent": USER_AGENT})
    records: list[EvidenceRecord] = []
    limit = min(100, max(1, int(os.getenv("REDDIT_POST_LIMIT_PER_SUB", "100"))))
    for subreddit in SUBREDDITS:
        endpoint = f"{API_ROOT}/r/{subreddit}/new"
        client.wait_for(endpoint)
        try:
            response = session.get(
                endpoint,
                params={"limit": limit, "raw_json": 1},
                headers={"Accept": "application/json"},
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            client.mark_request(endpoint)
            if response.status_code != 200:
                LOGGER.warning("Reddit API returned HTTP %s for r/%s; skipping", response.status_code, subreddit)
                continue
            payload = response.json()
            for child in payload.get("data", {}).get("children", []):
                data: dict[str, Any] = child.get("data", {})
                if bool(data.get("over_18")) or str(data.get("removed_by_category") or ""):
                    continue
                title = str(data.get("title") or "").strip()
                body = str(data.get("selftext") or "").strip()
                text = f"{title} {body}".strip()
                if not _lc_relevant(text):
                    continue
                permalink = str(data.get("permalink") or "").strip()
                created = data.get("created_utc")
                if not permalink or not isinstance(created, (int, float)):
                    continue
                published = datetime.fromtimestamp(created, tz=timezone.utc).date().isoformat()
                records.append(EvidenceRecord(
                    label=f"Reddit r/{subreddit}: {title}",
                    url=f"https://www.reddit.com{permalink}",
                    source_keywords=unique_keywords(text, TERMS),
                    record_type="Public Reddit discussion via official OAuth API",
                    source_date=published,
                    source_type="reddit",
                    source_name=f"Reddit r/{subreddit}",
                    excerpt=text[:900],
                    metadata={"redditId": str(data.get("name") or data.get("id") or ""), "subreddit": subreddit},
                ))
            remaining = response.headers.get("x-ratelimit-remaining")
            reset = response.headers.get("x-ratelimit-reset")
            try:
                if remaining is not None and float(remaining) < 2 and reset is not None:
                    time.sleep(max(DEFAULT_CRAWL_DELAY_SECONDS, float(reset)))
            except ValueError:
                pass
        except (requests.RequestException, ValueError) as error:
            client.mark_request(endpoint)
            LOGGER.warning("Reddit API fetch failed for r/%s; skipping: %s", subreddit, error)
    return records
