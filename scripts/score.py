#!/usr/bin/env python3
"""Compute auditable priority scores for public intelligence signals.

Formula (100 points total):
  - source authority: 30 points
  - recency: 25 points, decaying with a 180-day half-life
  - LC relevance: 30 points from explicit LC/workflow term matches
  - corroboration: 15 points from unique source records sharing a theme

The dataset is written only when no single integer score is shared by more
than 20% of signals.
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
MAX_SHARED_SCORE_RATIO = 0.20
RECENCY_HALF_LIFE_DAYS = 180

LC_PATTERNS: tuple[tuple[str, int, re.Pattern[str]], ...] = (
    ("LC-MS/MS", 12, re.compile(r"\blc\s*[-–]?\s*ms\s*/\s*ms\b|\blc\s*[-–]?\s*msms\b", re.I)),
    ("LC-MS", 10, re.compile(r"\blc\s*[-–]?\s*ms\b|liquid chromatography.{0,30}mass spectrom", re.I)),
    ("UHPLC/UPLC", 8, re.compile(r"\b(?:uhplc|uplc)\b", re.I)),
    ("LC/HPLC", 7, re.compile(r"\b(?:lc|hplc)\b|liquid chromatograph", re.I)),
    ("chromatography", 5, re.compile(r"\bchromatograph(?:y|ic|er|s)?\b", re.I)),
    ("columns", 4, re.compile(r"\b(?:column|columns|stationary phase)\b", re.I)),
    ("pumps", 4, re.compile(r"\b(?:pump|pumps|solvent delivery)\b", re.I)),
    (
        "chromatography software",
        6,
        re.compile(r"\b(?:chromeleon|empower|labsolutions|openlab|chromatography software|chromatography data system|cds)\b", re.I),
    ),
)


def parse_date(value: object, fallback: date) -> date:
    text = str(value or "")
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except ValueError:
        try:
            return date.fromisoformat(text[:10])
        except ValueError:
            return fallback


def source_authority(signal: dict[str, Any]) -> dict[str, object]:
    source_name = str(signal.get("sourceName") or "")
    signal_type = str(signal.get("signalType") or "")
    source_url = str(signal.get("sourceUrl") or "")
    host = urlparse(source_url).netloc.lower()
    combined = f"{source_name} {signal_type} {source_url}".lower()

    if "sec.gov" in host or "sec edgar" in combined or "investor filing" in combined:
        rating, contribution, basis = "High", 30, "SEC filing"
    elif "press release" in combined or "newsroom" in combined:
        rating, contribution, basis = "High", 28, "Official press release or newsroom"
    elif "pubmed" in combined or "ncbi.nlm.nih.gov" in host:
        rating, contribution, basis = "Medium", 20, "PubMed scientific record"
    elif any(marker in combined for marker in ("reddit.com", "forum", "chromforum", "community discussion")):
        rating, contribution, basis = "Low-but-real", 8, "Public forum or community record"
    elif any(marker in combined for marker in ("official", "product page", "corporate")):
        rating, contribution, basis = "High", 26, "Official company source"
    elif any(marker in combined for marker in ("journal", "publication", "review")):
        rating, contribution, basis = "Medium", 16, "Trade or editorial publication"
    else:
        rating, contribution, basis = "Medium-low", 12, "Other public source"

    return {
        "rating": rating,
        "contribution": contribution,
        "max": 30,
        "basis": basis,
    }


def recency(signal: dict[str, Any], as_of: date) -> dict[str, object]:
    signal_date = parse_date(signal.get("date"), as_of)
    age_days = max(0, (as_of - signal_date).days)
    contribution = round(25 * math.pow(0.5, age_days / RECENCY_HALF_LIFE_DAYS), 2)
    return {
        "ageDays": age_days,
        "contribution": contribution,
        "max": 25,
        "halfLifeDays": RECENCY_HALF_LIFE_DAYS,
    }


def lc_relevance(signal: dict[str, Any]) -> dict[str, object]:
    text = " ".join(
        str(signal.get(key) or "")
        for key in ("title", "summary", "technology", "theme", "intent", "recommendation")
    )
    matched_terms: list[str] = []
    points = 0
    for label, weight, pattern in LC_PATTERNS:
        if pattern.search(text):
            matched_terms.append(label)
            points += weight
    contribution = min(30, points)
    return {
        "matchedTerms": matched_terms,
        "contribution": contribution,
        "max": 30,
    }


def source_identity(signal: dict[str, Any]) -> str:
    url = str(signal.get("sourceUrl") or "").strip()
    if url:
        return url.rstrip("/").lower()
    return "|".join(
        str(signal.get(key) or "").strip().lower()
        for key in ("sourceName", "competitor", "title")
    )


def corroboration(signal: dict[str, Any], theme_sources: dict[str, set[str]]) -> dict[str, object]:
    theme = str(signal.get("theme") or signal.get("category") or "Unclassified")
    independent_sources = len(theme_sources.get(theme, set()))
    contribution = round(min(15, 4 * math.log2(independent_sources + 1)), 2)
    return {
        "theme": theme,
        "independentSources": independent_sources,
        "contribution": contribution,
        "max": 15,
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

    as_of = parse_date(data.get("asOfDate"), date.today())
    theme_sources: dict[str, set[str]] = defaultdict(set)
    for signal in signals:
        theme = str(signal.get("theme") or signal.get("category") or "Unclassified")
        theme_sources[theme].add(source_identity(signal))

    scored: list[dict[str, Any]] = []
    for original in signals:
        signal = dict(original)
        authority_part = source_authority(signal)
        recency_part = recency(signal, as_of)
        relevance_part = lc_relevance(signal)
        corroboration_part = corroboration(signal, theme_sources)
        breakdown = {
            "sourceAuthority": authority_part,
            "recency": recency_part,
            "lcRelevance": relevance_part,
            "corroboration": corroboration_part,
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
    most_common_share = most_common_count / signal_count
    print(
        f"\nMost common score: {most_common_score} "
        f"({most_common_count}/{signal_count}, {most_common_share:.1%})."
    )
    if most_common_share > MAX_SHARED_SCORE_RATIO:
        print(
            "Scoring stopped: more than 20% of signals share one score. "
            "The formula is not discriminating enough.",
            file=sys.stderr,
        )
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
