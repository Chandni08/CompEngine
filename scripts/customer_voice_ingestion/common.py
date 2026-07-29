"""Shared safety, normalization, and deduplication primitives for evidence ingestion."""

from __future__ import annotations

import json
import logging
import os
import re
import time
from dataclasses import asdict, dataclass, field
from datetime import date, datetime
from html import unescape
from html.parser import HTMLParser
from typing import Any, Callable, Iterable
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit
from urllib.robotparser import RobotFileParser

import requests


LOGGER = logging.getLogger("customer_voice_ingestion")
USER_AGENT = os.getenv(
    "CUSTOMER_VOICE_USER_AGENT",
    "WatersCompetitionEngine/1.0 (public LC-MS evidence research; +https://www.waters.com/)",
)
DEFAULT_CRAWL_DELAY_SECONDS = max(10.0, float(os.getenv("CUSTOMER_VOICE_MIN_CRAWL_DELAY", "10")))
REQUEST_TIMEOUT_SECONDS = max(10.0, float(os.getenv("CUSTOMER_VOICE_REQUEST_TIMEOUT", "35")))

# Source-class weights are intentionally explicit and stable.  They express the
# relative credibility of the source class, not the truth of an individual claim.
SOURCE_CREDIBILITY: dict[str, float] = {
    "community_forum": 0.65,
    "structured_review": 0.80,
    "regulatory": 1.00,
    "reddit": 0.55,
}
SOURCE_TYPES = frozenset(SOURCE_CREDIBILITY)


def enabled(env_name: str, default: bool = True) -> bool:
    raw = os.getenv(env_name)
    if raw is None:
        return default
    return raw.strip().lower() not in {"0", "false", "no", "off", "disabled"}


def clean_text(value: Any) -> str:
    text = unescape(str(value or ""))
    return re.sub(r"\s+", " ", text).strip()


def canonical_url(value: str) -> str:
    """Canonicalize a public evidence URL using the existing URL-level dedup model."""
    parts = urlsplit(str(value or "").strip())
    query = []
    for key, item in parse_qsl(parts.query, keep_blank_values=True):
        if key.lower() in {"sid", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"}:
            continue
        query.append((key, item))
    path = re.sub(r"/{2,}", "/", parts.path or "/")
    if path != "/":
        path = path.rstrip("/")
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), path, urlencode(query), ""))


def unique_keywords(text: str, candidates: Iterable[str], minimum: int = 2) -> list[str]:
    lowered = text.lower()
    matched = [candidate for candidate in candidates if candidate.lower() in lowered]
    unique = list(dict.fromkeys(matched))
    if len(unique) >= minimum:
        return unique[:8]
    words = [word for word in re.findall(r"[A-Za-z][A-Za-z0-9+/-]{3,}", text) if word.lower() not in {"this", "that", "with", "from", "have", "were"}]
    return list(dict.fromkeys(unique + words))[: max(minimum, 8)]


@dataclass(slots=True)
class EvidenceRecord:
    label: str
    url: str
    source_keywords: list[str]
    record_type: str
    source_date: str
    source_type: str
    source_name: str
    excerpt: str = ""
    rating: float | None = None
    review_text: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.source_type not in SOURCE_TYPES:
            raise ValueError(f"Unsupported sourceType: {self.source_type}")
        self.url = canonical_url(self.url)
        self.label = clean_text(self.label)
        self.excerpt = clean_text(self.excerpt)
        self.review_text = clean_text(self.review_text)
        self.source_keywords = [clean_text(item) for item in self.source_keywords if clean_text(item)]
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", self.source_date):
            raise ValueError(f"Evidence sourceDate must be YYYY-MM-DD: {self.source_date!r}")

    def to_schema(self) -> dict[str, Any]:
        output: dict[str, Any] = {
            "label": self.label,
            "url": self.url,
            "sourceKeywords": self.source_keywords,
            "recordType": self.record_type,
            "sourceDate": self.source_date,
            "dateType": "Published",
            "sourceType": self.source_type,
            "sourceCredibility": SOURCE_CREDIBILITY[self.source_type],
            "sourceName": self.source_name,
        }
        if self.excerpt:
            output["excerpt"] = self.excerpt
        if self.rating is not None:
            output["rating"] = self.rating
        if self.review_text:
            output["reviewText"] = self.review_text
        output.update(self.metadata)
        return output


def deduplicate_records(records: Iterable[EvidenceRecord]) -> list[EvidenceRecord]:
    """Keep the existing canonical-URL dedup rule while preferring richer records."""
    selected: dict[str, EvidenceRecord] = {}
    for record in records:
        key = canonical_url(record.url)
        current = selected.get(key)
        if current is None:
            selected[key] = record
            continue
        current_score = len(current.excerpt) + len(current.review_text) + 30 * len(current.source_keywords)
        candidate_score = len(record.excerpt) + len(record.review_text) + 30 * len(record.source_keywords)
        if candidate_score > current_score:
            selected[key] = record
    return list(selected.values())


class PageParser(HTMLParser):
    """Small dependency-free HTML extractor for public content pages and JSON-LD."""

    def __init__(self, base_url: str) -> None:
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.title = ""
        self.text_parts: list[str] = []
        self.links: list[tuple[str, str]] = []
        self.meta: dict[str, str] = {}
        self.json_ld: list[dict[str, Any] | list[Any]] = []
        self._in_title = False
        self._in_script = False
        self._script_type = ""
        self._script_parts: list[str] = []
        self._current_link = ""
        self._link_text: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key.lower(): value or "" for key, value in attrs}
        if tag in {"script", "style", "noscript", "svg"}:
            self._skip_depth += 1
        if tag == "title":
            self._in_title = True
        if tag == "script":
            self._in_script = True
            self._script_type = values.get("type", "").lower()
            self._script_parts = []
        if tag == "a" and values.get("href"):
            self._current_link = urljoin(self.base_url, values["href"])
            self._link_text = []
        if tag == "meta":
            key = values.get("name") or values.get("property")
            if key and values.get("content"):
                self.meta[key.lower()] = values["content"]

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False
        if tag == "a" and self._current_link:
            self.links.append((self._current_link, clean_text(" ".join(self._link_text))))
            self._current_link = ""
            self._link_text = []
        if tag == "script":
            if "ld+json" in self._script_type:
                try:
                    value = json.loads("".join(self._script_parts).strip())
                    if isinstance(value, (dict, list)):
                        self.json_ld.append(value)
                except (json.JSONDecodeError, TypeError):
                    pass
            self._in_script = False
            self._script_type = ""
            self._script_parts = []
        if tag in {"script", "style", "noscript", "svg"} and self._skip_depth:
            self._skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._in_script:
            self._script_parts.append(data)
            return
        if self._skip_depth:
            return
        text = clean_text(data)
        if not text:
            return
        if self._in_title:
            self.title = clean_text(f"{self.title} {text}")
        if self._current_link:
            self._link_text.append(text)
        self.text_parts.append(text)

    @property
    def text(self) -> str:
        return clean_text(" ".join(self.text_parts))


def parse_page(url: str, html: str) -> PageParser:
    parser = PageParser(url)
    parser.feed(html)
    return parser


def extract_page_date(parser: PageParser, html: str, fallback: str | None = None) -> str:
    candidates = [
        parser.meta.get("article:published_time", ""),
        parser.meta.get("date", ""),
        parser.meta.get("datepublished", ""),
    ]
    candidates.extend(re.findall(r'(?:datetime|datePublished)=["\'](\d{4}-\d{2}-\d{2})', html, re.I))
    candidates.extend(re.findall(r'\b(20\d{2}-\d{2}-\d{2})\b', html))
    for candidate in candidates:
        match = re.search(r"(20\d{2})-(\d{2})-(\d{2})", str(candidate))
        if match:
            return match.group(0)
    # phpBB and similar public forums commonly render a human-readable post
    # timestamp rather than an ISO value. Use the first displayed timestamp,
    # which is the topic's primary post, instead of page/footer dates.
    month_date = re.search(
        r"\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+"
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+"
        r"(\d{1,2}),?\s+(20\d{2})\b",
        parser.text,
        re.I,
    )
    if month_date:
        return datetime.strptime(
            f"{month_date.group(1)[:3]} {month_date.group(2)} {month_date.group(3)}",
            "%b %d %Y",
        ).date().isoformat()
    return fallback if fallback is not None else date.today().isoformat()


class RobotsAwareClient:
    """HTTP client that fails closed on robots errors and rate-limits per host."""

    def __init__(self, session: requests.Session | None = None) -> None:
        self.session = session or requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT})
        self._robots: dict[str, RobotFileParser] = {}
        self._delays: dict[str, float] = {}
        self._last_request: dict[str, float] = {}

    @staticmethod
    def _origin(url: str) -> str:
        parts = urlsplit(url)
        return f"{parts.scheme.lower()}://{parts.netloc.lower()}"

    def _wait(self, origin: str) -> None:
        delay = self._delays.get(origin, DEFAULT_CRAWL_DELAY_SECONDS)
        elapsed = time.monotonic() - self._last_request.get(origin, 0.0)
        if elapsed < delay:
            time.sleep(delay - elapsed)

    def wait_for(self, url: str, minimum_delay: float | None = None) -> None:
        """Apply the per-host delay to an official API or bulk-data request."""
        origin = self._origin(url)
        if minimum_delay is not None:
            self._delays[origin] = max(self._delays.get(origin, DEFAULT_CRAWL_DELAY_SECONDS), minimum_delay)
        self._wait(origin)

    def mark_request(self, url: str) -> None:
        self._last_request[self._origin(url)] = time.monotonic()

    def inspect_robots(self, url: str) -> RobotFileParser | None:
        origin = self._origin(url)
        if origin in self._robots:
            return self._robots[origin]
        robots_url = f"{origin}/robots.txt"
        try:
            response = self.session.get(
                robots_url,
                headers={"Accept": "text/plain,*/*;q=0.1"},
                timeout=REQUEST_TIMEOUT_SECONDS,
                allow_redirects=True,
            )
            self._last_request[origin] = time.monotonic()
            if response.status_code >= 500:
                raise requests.RequestException(f"HTTP {response.status_code}")
            lines = response.text.splitlines() if response.status_code != 404 else []
            parser = RobotFileParser(robots_url)
            parser.parse(lines)
            delay = self._crawl_delay(lines)
            self._robots[origin] = parser
            self._delays[origin] = max(DEFAULT_CRAWL_DELAY_SECONDS, delay)
            LOGGER.info("robots policy loaded for %s; crawl delay %.1fs", origin, self._delays[origin])
            return parser
        except requests.RequestException as error:
            LOGGER.warning("robots fetch failed for %s; adapter will skip this host: %s", origin, error)
            return None

    @staticmethod
    def _crawl_delay(lines: list[str]) -> float:
        active = False
        delays: list[float] = []
        for raw in lines:
            line = raw.split("#", 1)[0].strip()
            if not line or ":" not in line:
                continue
            key, value = [part.strip() for part in line.split(":", 1)]
            if key.lower() == "user-agent":
                active = value == "*" or value.lower() in USER_AGENT.lower()
            elif active and key.lower() == "crawl-delay":
                try:
                    delays.append(float(value))
                except ValueError:
                    continue
        return max(delays, default=DEFAULT_CRAWL_DELAY_SECONDS)

    def allowed(self, url: str, scope_check: Callable[[str], bool]) -> bool:
        if not scope_check(url):
            LOGGER.warning("explicit adapter scope rejected %s", url)
            return False
        policy = self.inspect_robots(url)
        if policy is None:
            return False
        if not policy.can_fetch(USER_AGENT, url):
            LOGGER.warning("robots.txt disallowed %s", url)
            return False
        return True

    def get(self, url: str, scope_check: Callable[[str], bool], *, accept: str = "text/html") -> requests.Response | None:
        if not self.allowed(url, scope_check):
            return None
        origin = self._origin(url)
        self._wait(origin)
        try:
            response = self.session.get(
                url,
                headers={"Accept": accept},
                timeout=REQUEST_TIMEOUT_SECONDS,
                allow_redirects=True,
            )
            self._last_request[origin] = time.monotonic()
            if response.status_code >= 400:
                LOGGER.warning("fetch skipped after HTTP %s: %s", response.status_code, url)
                return None
            if not scope_check(response.url):
                LOGGER.warning("redirect left approved adapter scope: %s -> %s", url, response.url)
                return None
            return response
        except requests.RequestException as error:
            self._last_request[origin] = time.monotonic()
            LOGGER.warning("fetch failed; skipping %s: %s", url, error)
            return None


def public_html(response: requests.Response | None) -> str | None:
    if response is None:
        return None
    content_type = response.headers.get("content-type", "").lower()
    if "html" not in content_type and "text" not in content_type:
        LOGGER.warning("non-HTML public page skipped: %s (%s)", response.url, content_type)
        return None
    text = response.text
    title = re.search(r"<title[^>]*>(.*?)</title>", text, re.I | re.S)
    challenge = clean_text(title.group(1) if title else "")
    if re.search(r"sign in|log in|access denied|captcha|verification required|account required", challenge, re.I):
        LOGGER.warning("gated or challenged page skipped: %s", response.url)
        return None
    return text
