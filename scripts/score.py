#!/usr/bin/env python3
"""Compute auditable priority scores for public intelligence signals.

Formula (100 points total):
  - source authority: 25 points, resolved from the publisher and record kind
  - evidence status: 15 points, from the pipeline's own verification verdict
  - recency: 20 points, decaying with a 180-day half-life from an *event* date
  - LC relevance: 25 points from explicit LC/workflow term matches
  - corroboration: 15 points from independent organizations sharing a theme

Three rules keep the ranking aligned with evidential strength rather than with
collection volume:

  - Only an event date earns recency.  A sitemap observation records when the
    crawler looked, not when anything happened, so it earns none.  A date that
    cannot be parsed earns none either, rather than being treated as today.
  - Corroboration counts distinct independent organizations, not records.  A
    theme containing two hundred pages from one vendor is not corroborated.
  - A record the pipeline classifies as unsupported cannot collect the evidence
    points that a verified record collects.

The dataset is written only when the ranking survives two checks: verified
records must not rank below unsupported ones, and no more than 25% of *distinct
input combinations* may collapse onto one score.  The second check deliberately
measures distinct inputs rather than raw signals, so a large set of genuinely
indistinguishable records cannot halt the refresh for agreeing with each other.
"""

from __future__ import annotations

import json
import math
import re
import sys
from collections import Counter, defaultdict
from datetime import date, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
INTELLIGENCE_FILE = ROOT / "data" / "intelligence.json"
MAX_SHARED_SCORE_RATIO = 0.25
RECENCY_HALF_LIFE_DAYS = 180

AUTHORITY_MAX = 25
EVIDENCE_MAX = 15
RECENCY_MAX = 20
RELEVANCE_MAX = 25
CORROBORATION_MAX = 15

# Date types that record when something happened.  "ingestion" and "retrieval"
# record when the collector looked, which says nothing about the event's age.
# A detected change is dated: the observation bounds when it happened, between
# the previous successful check and this one. An inventory observation is not —
# "this URL is in the sitemap" says nothing about when anything occurred.
EVENT_DATE_TYPES = {"publication", "launch", "filing", "effective", "change_detection"}
OBSERVATION_DATE_TYPES = {"ingestion", "retrieval"}

GOVERNMENT_HOSTS = ("sec.gov", "fda.gov", "europa.eu", "usp.org", "ich.org", "nist.gov")
PEER_REVIEW_HOSTS = ("pubmed.ncbi.nlm.nih.gov", "ncbi.nlm.nih.gov", "doi.org", "pubs.acs.org")
COMMUNITY_HOSTS = ("reddit.com", "chromforum.org", "labwrench.com", "researchgate.net")

# Issuer-controlled hosts.  Records from these are the vendor talking about
# itself, so several of them together are not independent corroboration.
ISSUER_HOSTS = (
    "agilent.com", "thermofisher.com", "shimadzu.com", "sciex.com",
    "perkinelmer.com", "revvity.com", "waters.com", "danaher.com", "bruker.com",
)

# A dated announcement is an event.  A monitored catalogue page is inventory:
# it proves a URL exists, not that anything was launched, so it cannot carry
# announcement-grade authority.
DATED_ANNOUNCEMENT_TYPES = {
    "press release", "product release", "acquisition", "regulatory approval",
    "earnings event announcement", "quarterly earnings result",
    "official technical insight",
    # A permanent redirect between official product pages is the vendor itself
    # retiring or superseding a product, observed on a known date.
    "source page redirected",
}
INVENTORY_TYPES = {"monitored product page", "product page added", "product page updated"}

EVIDENCE_STATUS_POINTS = {
    "verified": EVIDENCE_MAX,
    "partial": 8,
    "unsupported": 0,
    "contradicted": 0,
    "unreachable": 0,
}

LC_PATTERNS: tuple[tuple[str, int, re.Pattern[str]], ...] = (
    ("LC-MS/MS", 25, re.compile(r"\blc\s*[-–]?\s*ms\s*/\s*ms\b|\blc\s*[-–]?\s*msms\b", re.I)),
    ("LC-MS", 21, re.compile(r"\blc\s*[-–]?\s*ms\b|liquid chromatography.{0,30}mass spectrom", re.I)),
    ("UHPLC/UPLC", 18, re.compile(r"\b(?:uhplc|uplc)\b", re.I)),
    (
        "chromatography software",
        16,
        re.compile(r"\b(?:chromeleon|empower|labsolutions|openlab|chromatography software|chromatography data system|cds)\b", re.I),
    ),
    ("LC/HPLC", 14, re.compile(r"\b(?:lc|hplc)\b|liquid chromatograph", re.I)),
    ("chromatography", 10, re.compile(r"\bchromatograph(?:y|ic|er|s)?\b", re.I)),
    ("columns", 7, re.compile(r"\b(?:column|columns|stationary phase)\b", re.I)),
    ("pumps", 7, re.compile(r"\b(?:pump|pumps|solvent delivery)\b", re.I)),
)
# Each additional distinct match adds a little breadth evidence.  Summing the
# raw weights instead would push almost every LC record to the cap and collapse
# the distribution, which is what the shared-score gate then rejects.
RELEVANCE_BREADTH_BONUS = 2


def host_of(url: object) -> str:
    return (urlparse(str(url or "")).hostname or "").lower().removeprefix("www.")


def host_matches(host: str, suffixes: tuple[str, ...]) -> bool:
    return any(host == suffix or host.endswith(f".{suffix}") for suffix in suffixes)


def parse_date(value: object) -> date | None:
    """Parse a date, or return None.  There is no 'assume today' fallback."""
    text = str(value or "")
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except ValueError:
        pass
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def source_authority(signal: dict[str, Any]) -> dict[str, object]:
    host = host_of(signal.get("sourceUrl"))
    signal_type = str(signal.get("signalType") or "").strip().lower()
    source_name = str(signal.get("sourceName") or "").lower()

    if host_matches(host, GOVERNMENT_HOSTS) or signal_type in {"sec filing", "investor filing"}:
        rating, contribution, basis = "High", 25, "Government or regulatory filing"
    elif host_matches(host, PEER_REVIEW_HOSTS) or signal_type == "scientific publication":
        rating, contribution, basis = "High", 22, "Peer-reviewed scientific record"
    elif signal_type in INVENTORY_TYPES:
        # Inventory, not an announcement: the page exists, nothing is claimed.
        rating, contribution, basis = "Low", 8, "Issuer catalogue page observed in a sitemap"
    elif signal_type in DATED_ANNOUNCEMENT_TYPES and host_matches(host, ISSUER_HOSTS):
        rating, contribution, basis = "Medium-high", 20, "Official dated announcement from the issuer"
    elif signal_type in DATED_ANNOUNCEMENT_TYPES:
        rating, contribution, basis = "Medium", 16, "Dated announcement from a non-issuer publisher"
    elif host_matches(host, COMMUNITY_HOSTS):
        rating, contribution, basis = "Low-but-real", 6, "Public forum or community record"
    elif host_matches(host, ISSUER_HOSTS):
        rating, contribution, basis = "Medium-low", 12, "Issuer-controlled page, kind not established"
    elif "trend" in signal_type or "trend" in source_name:
        rating, contribution, basis = "Medium", 14, "Aggregate query result, not a single record"
    else:
        rating, contribution, basis = "Medium-low", 10, "Other public source"

    return {
        "rating": rating,
        "contribution": contribution,
        "max": AUTHORITY_MAX,
        "basis": basis,
        "host": host or "unknown",
    }


def evidence_strength(signal: dict[str, Any]) -> dict[str, object]:
    """Score the pipeline's own verification verdict for this record."""
    status = str(signal.get("evidenceStatus") or "").strip().lower()
    contribution = EVIDENCE_STATUS_POINTS.get(status)
    if contribution is None:
        contribution, basis = 0, "No evidence status recorded"
    elif status == "verified":
        basis = "A primary record supports the displayed claim"
    elif status == "partial":
        basis = "Partially supported; the displayed claim is not fully substantiated"
    else:
        basis = f"Classified {status}: the source does not establish the displayed claim"
    return {
        "status": status or "unrecorded",
        "contribution": contribution,
        "max": EVIDENCE_MAX,
        "basis": basis,
    }


def recency(signal: dict[str, Any], as_of: date) -> dict[str, object]:
    date_type = str(signal.get("sourceDateType") or "publication").strip().lower()
    if date_type in OBSERVATION_DATE_TYPES:
        return {
            "ageDays": None,
            "contribution": 0.0,
            "max": RECENCY_MAX,
            "halfLifeDays": RECENCY_HALF_LIFE_DAYS,
            "dateType": date_type,
            "basis": "Observation date only; the source establishes no event date",
        }

    signal_date = parse_date(signal.get("sourceDate")) or parse_date(signal.get("date"))
    if signal_date is None:
        return {
            "ageDays": None,
            "contribution": 0.0,
            "max": RECENCY_MAX,
            "halfLifeDays": RECENCY_HALF_LIFE_DAYS,
            "dateType": date_type,
            "basis": "No parseable event date; recency is not established",
        }

    age_days = max(0, (as_of - signal_date).days)
    contribution = round(RECENCY_MAX * math.pow(0.5, age_days / RECENCY_HALF_LIFE_DAYS), 2)
    return {
        "ageDays": age_days,
        "contribution": contribution,
        "max": RECENCY_MAX,
        "halfLifeDays": RECENCY_HALF_LIFE_DAYS,
        "dateType": date_type if date_type in EVENT_DATE_TYPES else "publication",
        "basis": (
            f"Change detected {signal_date.isoformat()}, bounded by the previous check"
            if date_type == "change_detection" else f"Event dated {signal_date.isoformat()}"
        ),
    }


def lc_relevance(signal: dict[str, Any]) -> dict[str, object]:
    text = " ".join(
        str(signal.get(key) or "")
        for key in ("title", "summary", "technology", "theme", "intent", "recommendation")
    )
    matched_terms = [label for label, _weight, pattern in LC_PATTERNS if pattern.search(text)]
    if matched_terms:
        strongest = max(
            weight for label, weight, _pattern in LC_PATTERNS if label in matched_terms
        )
        contribution = min(
            RELEVANCE_MAX,
            strongest + RELEVANCE_BREADTH_BONUS * (len(matched_terms) - 1),
        )
    else:
        contribution = 0
    return {
        "matchedTerms": matched_terms,
        "strongestTerm": matched_terms[0] if matched_terms else None,
        "contribution": contribution,
        "max": RELEVANCE_MAX,
    }


def independence_key(signal: dict[str, Any]) -> str:
    """Identify the organization behind a record.

    Corroboration means several organizations independently pointing at the same
    thing.  Counting records instead lets one vendor's publishing volume look
    like agreement.

    Two hosts need special handling because they are registries, not authors:
    every PubMed record shares one host but comes from a different research
    group, and every SEC filing shares one host but comes from a different
    registrant.  Keying on the host would collapse each set to one organization.
    """
    declared = str(signal.get("independenceGroup") or "").strip().lower()
    if declared:
        return declared
    host = host_of(signal.get("sourceUrl"))
    if host_matches(host, PEER_REVIEW_HOSTS):
        # An index, not a publisher: each record is an independent author group.
        return f"paper:{str(signal.get('id') or signal.get('sourceUrl') or '').strip().lower()}"
    if host_matches(host, GOVERNMENT_HOSTS):
        # A registry, not an author: the filer is the organization.
        registrant = str(signal.get("registrant") or signal.get("competitor") or "").strip().lower()
        return f"filer:{registrant}" if registrant else f"registry:{host}"
    if host:
        parts = host.split(".")
        return ".".join(parts[-2:]) if len(parts) >= 2 else host
    return str(signal.get("competitor") or signal.get("sourceName") or "unattributed").strip().lower()


def is_issuer_controlled(signal: dict[str, Any]) -> bool:
    """True when the record is the subject describing itself.

    A vendor page and a registrant's own filing are both self-description.  They
    can establish what a company says; several of them do not independently
    confirm that it is so.
    """
    host = host_of(signal.get("sourceUrl"))
    if host_matches(host, ISSUER_HOSTS):
        return True
    if host_matches(host, GOVERNMENT_HOSTS) and str(signal.get("signalType") or "").lower() in {
        "sec filing", "investor filing", "quarterly earnings result", "earnings event announcement"
    }:
        return True
    return False


def theme_of(signal: dict[str, Any]) -> str:
    return str(signal.get("theme") or signal.get("category") or "Unclassified")


def corroboration(
    signal: dict[str, Any],
    theme_organizations: dict[str, set[str]],
    theme_independent_organizations: dict[str, set[str]],
) -> dict[str, object]:
    theme = theme_of(signal)
    organizations = theme_organizations.get(theme, set())
    independent = theme_independent_organizations.get(theme, set())

    if len(organizations) < 2:
        contribution = 0.0
        basis = "Only one organization is represented in this theme"
    elif not independent:
        # Every source is the issuer describing itself.
        contribution = min(7.0, round(3 * math.log2(len(organizations)), 2))
        basis = "Multiple issuer-controlled organizations; no independent corroboration"
    else:
        contribution = min(float(CORROBORATION_MAX), round(5 * math.log2(len(organizations)), 2))
        basis = f"{len(independent)} of {len(organizations)} organizations are not issuer-controlled"

    return {
        "theme": theme,
        "independentOrganizations": len(independent),
        "organizations": sorted(organizations),
        "organizationCount": len(organizations),
        "contribution": contribution,
        "max": CORROBORATION_MAX,
        "basis": basis,
    }


def tier_for_score(score: int) -> str:
    if score >= 75:
        return "High"
    if score >= 50:
        return "Medium"
    return "Low"


def score_signals(data: dict[str, Any]) -> tuple[list[dict[str, Any]], Counter[int]]:
    signals = data.get("signals", [])
    if not isinstance(signals, list) or not signals:
        raise ValueError("intelligence.json contains no signals to score")

    as_of = parse_date(data.get("asOfDate")) or date.today()
    theme_organizations: dict[str, set[str]] = defaultdict(set)
    theme_independent_organizations: dict[str, set[str]] = defaultdict(set)
    for signal in signals:
        theme = theme_of(signal)
        key = independence_key(signal)
        theme_organizations[theme].add(key)
        if not is_issuer_controlled(signal):
            theme_independent_organizations[theme].add(key)

    scored: list[dict[str, Any]] = []
    for original in signals:
        signal = dict(original)
        breakdown = {
            "sourceAuthority": source_authority(signal),
            "evidenceStrength": evidence_strength(signal),
            "recency": recency(signal, as_of),
            "lcRelevance": lc_relevance(signal),
            "corroboration": corroboration(
                signal, theme_organizations, theme_independent_organizations
            ),
        }
        priority_score = round(
            sum(float(part["contribution"]) for part in breakdown.values())
        )
        signal.pop("confidence", None)
        signal.pop("impactScore", None)
        signal.pop("urgencyScore", None)
        signal["priorityScore"] = max(0, min(100, priority_score))
        signal["tier"] = tier_for_score(signal["priorityScore"])
        signal["scoreBreakdown"] = breakdown
        scored.append(signal)

    return scored, Counter(int(signal["priorityScore"]) for signal in scored)


def assert_evidence_ordering(scored: list[dict[str, Any]]) -> None:
    """Refuse to publish a ranking that rewards unsupported records.

    The ranking exists to point a reader at the strongest evidence.  If records
    the pipeline classifies as unsupported outrank the ones it verified, the
    ranking is inverted and should not ship.
    """
    def median(values: list[int]) -> float:
        ordered = sorted(values)
        middle = len(ordered) // 2
        if not ordered:
            return 0.0
        if len(ordered) % 2:
            return float(ordered[middle])
        return (ordered[middle - 1] + ordered[middle]) / 2

    by_status: dict[str, list[int]] = defaultdict(list)
    for signal in scored:
        by_status[str(signal.get("evidenceStatus") or "unrecorded").lower()].append(
            int(signal["priorityScore"])
        )

    unsupported = by_status.get("unsupported", [])
    verified = by_status.get("verified", [])
    if not unsupported or not verified:
        return

    unsupported_median = median(unsupported)
    verified_median = median(verified)
    print(
        f"\nEvidence ordering: verified median {verified_median:.1f} "
        f"({len(verified)} signals), unsupported median {unsupported_median:.1f} "
        f"({len(unsupported)} signals)."
    )
    high_unsupported = sum(1 for value in unsupported if value >= 75)
    if high_unsupported:
        print(f"{high_unsupported} unsupported signals are ranked High.", file=sys.stderr)
    if unsupported_median >= verified_median:
        raise ValueError(
            "Scoring stopped: unsupported records outrank verified records "
            f"({unsupported_median:.1f} vs {verified_median:.1f}). "
            "The ranking would point readers at the weakest evidence."
        )


def score_inputs_fingerprint(signal: dict[str, Any]) -> tuple:
    """The inputs the formula actually reads for one signal.

    Two records with the same inputs *should* receive the same score; that is the
    formula working, not failing.  Discrimination is only meaningful across
    records whose inputs differ.
    """
    breakdown = signal.get("scoreBreakdown", {})
    return (
        breakdown.get("sourceAuthority", {}).get("basis"),
        breakdown.get("evidenceStrength", {}).get("status"),
        breakdown.get("recency", {}).get("ageDays"),
        tuple(breakdown.get("lcRelevance", {}).get("matchedTerms") or ()),
        breakdown.get("corroboration", {}).get("organizationCount"),
    )


def discrimination_share(scored: list[dict[str, Any]]) -> tuple[float, int, int, int]:
    """Return the most-common score's share across *distinct* input combinations.

    The previous check counted raw signals, so a large set of genuinely
    indistinguishable records — ninety sitemap pages with the same publisher,
    no event date, and the same LC terms — could halt the whole refresh for
    agreeing with each other.
    """
    by_fingerprint: dict[tuple, int] = {}
    for signal in scored:
        by_fingerprint.setdefault(score_inputs_fingerprint(signal), int(signal["priorityScore"]))
    distinct = Counter(by_fingerprint.values())
    if not distinct:
        return 0.0, 0, 0, 0
    score, count = distinct.most_common(1)[0]
    return count / len(by_fingerprint), score, count, len(by_fingerprint)


def print_distribution(distribution: Counter[int], signal_count: int) -> None:
    print("Priority score distribution")
    print("| Score | Signals | Share |")
    print("| ---: | ---: | ---: |")
    for score in sorted(distribution, reverse=True):
        count = distribution[score]
        print(f"| {score} | {count} | {count / signal_count:.1%} |")


def main() -> int:
    data = json.loads(INTELLIGENCE_FILE.read_text(encoding="utf-8"))
    boilerplate_prefix = "Review whether Waters positioning, application notes, and roadmap coverage address this "
    for signal in data.get("signals", []):
        if isinstance(signal, dict) and str(signal.get("recommendation", "")).startswith(boilerplate_prefix):
            signal.pop("recommendation", None)
    scored, distribution = score_signals(data)
    signal_count = len(scored)
    print_distribution(distribution, signal_count)

    most_common_score, most_common_count = distribution.most_common(1)[0]
    print(
        f"\nMost common score: {most_common_score} "
        f"({most_common_count}/{signal_count}, {most_common_count / signal_count:.1%}); "
        "records with identical inputs are expected to tie."
    )

    share, tied_score, tied_count, distinct_inputs = discrimination_share(scored)
    print(
        f"Discrimination: {distinct_inputs} distinct input combinations; the most common "
        f"score across them is {tied_score} ({tied_count}, {share:.1%})."
    )
    if share > MAX_SHARED_SCORE_RATIO:
        print(
            f"Scoring stopped: more than {MAX_SHARED_SCORE_RATIO:.0%} of distinct input "
            "combinations collapse onto one score. The formula is not discriminating enough.",
            file=sys.stderr,
        )
        return 1

    try:
        assert_evidence_ordering(scored)
    except ValueError as error:
        print(error, file=sys.stderr)
        return 1

    data["signals"] = scored
    for recommendation in data.get("recommendations", []):
        if isinstance(recommendation, dict):
            recommendation.pop("confidence", None)
    temporary = INTELLIGENCE_FILE.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    temporary.replace(INTELLIGENCE_FILE)
    print(f"Wrote {signal_count} auditable scores to {INTELLIGENCE_FILE.relative_to(ROOT)}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
