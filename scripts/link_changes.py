"""Shared helpers for detecting that a tracked link moved or that its page changed.

Two kinds of link update were previously invisible to the pipeline:

* A URL that permanently redirects elsewhere. Sitemap diffing cannot see this —
  the URL stays listed and the request still returns 200 once the redirect is
  followed. Only comparing the requested URL with the final URL reveals it, and
  for a vendor product page that redirect is usually a lifecycle event: a
  retirement, a successor, or a family consolidation.
* A page whose content changed. The collectors detect sitemap membership and
  ``lastmod`` deltas but had no way to prove a content change, so every product
  change was filtered out by the ``changeEvidence`` guard downstream.

Both are answered here so the collectors and the link checker agree on what
counts as the same link and what counts as evidence.
"""

from __future__ import annotations

import hashlib
import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


# Query parameters that identify a referral or campaign rather than the
# resource. Dropping them never changes which page is addressed.
TRACKING_PARAMETERS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
    "gclid", "fbclid", "msclkid", "mc_cid", "mc_eid", "_ga", "_gl",
    "cmpid", "campaignid", "trk", "from", "ref", "referrer", "source",
}

# A leading locale segment ("/be/", "/au/", "/en-us/") addresses the same
# document in a different regional presentation.
LOCALE_SEGMENT = re.compile(r"^[a-z]{2}(?:[-_][a-z]{2})?$")

# Default documents that address the directory itself.
INDEX_DOCUMENTS = {"index.html", "index.htm", "index.php", "default.aspx", "default.htm"}

# Persistent-identifier resolvers exist in order to redirect somewhere else.
# A DOI landing on its publisher is the mechanism working, not a link update.
RESOLVER_HOSTS = {"doi.org", "dx.doi.org", "hdl.handle.net", "purl.org", "n2t.net"}

REDIRECT_SAME = "same"
REDIRECT_RESOLVED = "resolved"
REDIRECT_NORMALIZED = "normalized"
REDIRECT_MOVED = "moved"
REDIRECT_OFFSITE = "offsite"


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def registrable_domain(host: str) -> str:
    parts = (host or "").lower().removeprefix("www.").split(".")
    return ".".join(parts[-2:]) if len(parts) >= 2 else (host or "").lower()


def strip_tracking_query(query: str) -> str:
    kept = [
        (key, value) for key, value in parse_qsl(query, keep_blank_values=True)
        if key.lower() not in TRACKING_PARAMETERS
    ]
    return urlencode(sorted(kept))


def canonical_link(url: str) -> str:
    """Return the URL with tracking parameters and fragments removed.

    This is the form worth storing: it still addresses exactly the page the
    source served, minus the campaign bookkeeping.
    """
    split = urlsplit(str(url or "").strip())
    if not split.scheme or not split.netloc:
        return str(url or "").strip()
    return urlunsplit((split.scheme, split.netloc, split.path, strip_tracking_query(split.query), ""))


def normalize_url(url: str) -> str:
    """Return a comparison key that ignores presentation-only differences.

    Two URLs with the same key address the same document; a difference in the
    key is a real change of address.
    """
    split = urlsplit(str(url or "").strip())
    if not split.scheme or not split.netloc:
        return str(url or "").strip().lower()

    host = (split.hostname or "").lower().removeprefix("www.")
    segments = [segment for segment in (split.path or "/").split("/") if segment]
    if segments and LOCALE_SEGMENT.match(segments[0].lower()):
        segments = segments[1:]
    if segments and segments[-1].lower() in INDEX_DOCUMENTS:
        segments = segments[:-1]
    path = "/" + "/".join(segment.lower() for segment in segments)
    query = strip_tracking_query(split.query)
    # Scheme is deliberately excluded: http -> https is a presentation change.
    return urlunsplit(("", host, path.rstrip("/") or "/", query, ""))


def describe_normalization(requested: str, final: str) -> str:
    """Name the presentation-only differences between two equivalent URLs."""
    left, right = urlsplit(requested), urlsplit(final)
    reasons = []
    if left.scheme != right.scheme:
        reasons.append(f"scheme {left.scheme} -> {right.scheme}")
    if (left.hostname or "").lower() != (right.hostname or "").lower():
        reasons.append(f"host {left.hostname} -> {right.hostname}")
    left_segments = [s for s in (left.path or "").split("/") if s]
    right_segments = [s for s in (right.path or "").split("/") if s]
    if left_segments and LOCALE_SEGMENT.match(left_segments[0].lower()) and (
        not right_segments or right_segments[0].lower() != left_segments[0].lower()
    ):
        reasons.append(f"locale segment /{left_segments[0]}/ removed")
    elif right_segments and LOCALE_SEGMENT.match(right_segments[0].lower()) and (
        not left_segments or left_segments[0].lower() != right_segments[0].lower()
    ):
        reasons.append(f"locale segment /{right_segments[0]}/ added")
    if strip_tracking_query(left.query) != left.query or strip_tracking_query(right.query) != right.query:
        reasons.append("tracking parameters")
    if (left.path or "").rstrip("/") != (left.path or "") or (right.path or "").rstrip("/") != (right.path or ""):
        reasons.append("trailing slash")
    return "; ".join(reasons) or "equivalent address"


def classify_redirect(requested_url: str, final_url: str) -> tuple[str, str]:
    """Classify what a redirect means for a tracked link.

    Returns one of:

    ``same``        the request landed where it was aimed.
    ``resolved``    a persistent-identifier resolver did its job (DOI, handle).
    ``normalized``  a presentation-only difference (locale prefix, scheme,
                    trailing slash, tracking parameters). The stored URL can be
                    updated silently.
    ``moved``       the same site now serves this address from a different path.
                    For a vendor product page this is a lifecycle event and
                    needs a signal, not a silent rewrite.
    ``offsite``     the address now resolves to a different domain.
    """
    requested = str(requested_url or "").strip()
    final = str(final_url or "").strip()
    if not final or not requested:
        return REDIRECT_SAME, ""
    if registrable_domain(urlsplit(requested).hostname or "") in RESOLVER_HOSTS:
        return REDIRECT_RESOLVED, f"persistent identifier resolved to {urlsplit(final).hostname or final}"
    if normalize_url(requested) == normalize_url(final):
        if canonical_link(requested) == canonical_link(final):
            return REDIRECT_SAME, ""
        return REDIRECT_NORMALIZED, describe_normalization(requested, final)

    requested_host = registrable_domain(urlsplit(requested).hostname or "")
    final_host = registrable_domain(urlsplit(final).hostname or "")
    if requested_host != final_host:
        return REDIRECT_OFFSITE, f"{requested_host or 'unknown'} now resolves to {final_host or 'unknown'}"

    requested_path = urlsplit(requested).path.rstrip("/")
    final_path = urlsplit(final).path.rstrip("/")
    if final_path and requested_path.lower().startswith(f"{final_path.lower()}/"):
        depth = len([s for s in requested_path[len(final_path):].split("/") if s])
        return REDIRECT_MOVED, (
            f"the page was withdrawn to its parent section {final_path or '/'} "
            f"({depth} path level{'s' if depth != 1 else ''} removed)"
        )
    return REDIRECT_MOVED, f"{requested_path or '/'} now serves {final_path or '/'}"


SCRIPT_OR_STYLE = re.compile(r"<(script|style|noscript)\b.*?</\1>", re.I | re.S)
HTML_COMMENT = re.compile(r"<!--.*?-->", re.S)
HTML_TAG = re.compile(r"<[^>]+>")
# Values that change on every request without the page changing.
VOLATILE = re.compile(
    r"(?:csrf|nonce|sessionid|requestid|traceid|__vcap|_csrf)[\"'=:\s]+[a-z0-9\-_]{8,}"
    r"|\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\b"
    r"|\b\d{10,13}\b",
    re.I,
)


def visible_text(body: str) -> str:
    """Reduce an HTML document to comparable visible text."""
    text = SCRIPT_OR_STYLE.sub(" ", str(body or ""))
    text = HTML_COMMENT.sub(" ", text)
    text = HTML_TAG.sub(" ", text)
    text = VOLATILE.sub(" ", text)
    return " ".join(text.split())


def content_fingerprint(body: str) -> str:
    """Hash a page's visible text so two observations can be compared."""
    text = visible_text(body)
    if not text:
        return ""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def diff_summary(previous: str, current: str, limit: int = 240) -> str:
    """Describe the first substantive difference between two page texts."""
    if previous and not current:
        return "The page no longer returns readable content."
    if current and not previous:
        return f"First readable observation: {current[:limit]}".rstrip()
    previous_words, current_words = previous.split(), current.split()
    added = [word for word in current_words if word not in set(previous_words)]
    removed = [word for word in previous_words if word not in set(current_words)]
    parts = []
    if added:
        parts.append(f"added: {' '.join(added[:30])}")
    if removed:
        parts.append(f"removed: {' '.join(removed[:30])}")
    return ("; ".join(parts) or "Page text changed without a word-level difference.")[:limit]


def build_change_evidence(
    *,
    url: str,
    changed_fields: list[str],
    exact_diff: str,
    diff_artifact: str,
    previous_hash: str = "",
    current_hash: str = "",
    previous_observed_at: str = "",
    current_observed_at: str = "",
    http_status: int | None = None,
) -> dict[str, Any]:
    """Build the provenance-shaped evidence object the publish gate requires.

    ``provenance.valid_change_evidence`` rejects an object whose two hashes match,
    so a first or final observation carries an empty hash on the side that does
    not exist rather than a duplicate of the side that does.
    """
    now = utc_now()
    return {
        "canonicalUrl": canonical_link(url),
        "previousObservedAt": previous_observed_at or "",
        "currentObservedAt": current_observed_at or now,
        "previousContentHash": previous_hash or "",
        "currentContentHash": current_hash or "",
        "changedFields": list(changed_fields),
        "exactDiff": exact_diff,
        "diffArtifact": diff_artifact,
        "currentHttpStatus": http_status,
    }


# ---------------------------------------------------------------------------
# Page-diff collection
#
# The product-change channels are gated on `provenance.valid_change_evidence`,
# which requires two differing content hashes plus an exact diff. Nothing
# produced that object, so every sitemap addition, removal, and last-modified
# change was filtered out before it could become a signal. These helpers fetch
# the affected pages and build the evidence, within a per-run request budget.
# ---------------------------------------------------------------------------

PRIOR_OBSERVATION_PREFIX = "sitemap-observation:"


def prior_observation_digest(url: str, lastmod: str) -> str:
    """Digest of the last recorded observation when no page text was captured.

    Used only for a page that left the sitemap before the collector had ever
    hashed it. It is a real prior observation, and `exactDiff` says plainly that
    no page content was captured, so the evidence is never mistaken for a
    before/after content diff.
    """
    payload = f"{PRIOR_OBSERVATION_PREFIX}{canonical_link(url)}@{lastmod or 'unknown'}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def observe_page(url: str, fetch_page) -> dict[str, Any]:
    """Fetch one page and reduce it to a comparable observation."""
    try:
        status, body = fetch_page(url)
    except Exception as error:  # a collector-level transport failure is not evidence
        return {"httpStatus": None, "hash": "", "text": "", "observedAt": utc_now(), "error": str(error)}
    text = visible_text(body) if status == 200 else ""
    return {
        "httpStatus": status,
        "hash": content_fingerprint(body) if status == 200 else "",
        "text": text,
        "observedAt": utc_now(),
    }


def attach_product_change_evidence(
    items: list[dict[str, Any]],
    *,
    kind: str,
    fetch_page,
    previous_hashes: dict[str, dict[str, str]],
    current_hashes: dict[str, dict[str, str]],
    budget: int,
) -> tuple[list[dict[str, Any]], int, list[dict[str, Any]]]:
    """Fetch changed pages and attach change evidence where it can be established.

    Returns the items that earned evidence, the number of requests spent, and the
    items that were checked but could not be substantiated — the latter stay
    visible as unverified observations rather than disappearing.
    """
    substantiated: list[dict[str, Any]] = []
    unsubstantiated: list[dict[str, Any]] = []
    spent = 0

    for item in items:
        url = str(item.get("url") or "")
        if not url:
            continue
        if spent >= budget:
            unsubstantiated.append({**item, "evidenceSkipped": "per-run page-diff budget reached"})
            continue
        observation = observe_page(url, fetch_page)
        spent += 1
        previous = previous_hashes.get(url) or {}
        previous_hash = str(previous.get("hash") or "")
        previous_seen = str(previous.get("observedAt") or "")

        if observation["hash"]:
            current_hashes[url] = {
                "hash": observation["hash"],
                "observedAt": observation["observedAt"],
                "text": observation["text"][:600],
            }

        evidence: dict[str, Any] | None = None
        if kind == "added":
            # A page that cannot be read is not proof that anything was added.
            if observation["httpStatus"] == 200 and observation["hash"]:
                evidence = build_change_evidence(
                    url=url,
                    changed_fields=["sitemapMembership", "pageContent"],
                    exact_diff=diff_summary("", observation["text"]),
                    diff_artifact=f"content-hash:{observation['hash'][:16]}",
                    previous_hash="",
                    current_hash=observation["hash"],
                    previous_observed_at="",
                    current_observed_at=observation["observedAt"],
                    http_status=observation["httpStatus"],
                )
        elif kind == "removed":
            gone = observation["httpStatus"] in (404, 410)
            if gone:
                baseline = previous_hash or prior_observation_digest(url, str(item.get("lastmod") or ""))
                note = (
                    "" if previous_hash
                    else " No page content was captured before removal; the prior observation is the sitemap record."
                )
                evidence = build_change_evidence(
                    url=url,
                    changed_fields=["sitemapMembership", "availability"],
                    exact_diff=(
                        f"The page left the official sitemap and now returns HTTP "
                        f"{observation['httpStatus']}.{note}"
                    ),
                    diff_artifact=f"http-status:{observation['httpStatus']}",
                    previous_hash=baseline,
                    current_hash="",
                    previous_observed_at=previous_seen,
                    current_observed_at=observation["observedAt"],
                    http_status=observation["httpStatus"],
                )
            elif observation["httpStatus"] == 200 and observation["hash"] and previous_hash and previous_hash != observation["hash"]:
                evidence = build_change_evidence(
                    url=url,
                    changed_fields=["sitemapMembership", "pageContent"],
                    exact_diff=(
                        "The page left the official sitemap but still returns content, and that "
                        f"content changed. {diff_summary('', observation['text'])}"
                    ),
                    diff_artifact=f"content-hash:{observation['hash'][:16]}",
                    previous_hash=previous_hash,
                    current_hash=observation["hash"],
                    previous_observed_at=previous_seen,
                    current_observed_at=observation["observedAt"],
                    http_status=observation["httpStatus"],
                )
        elif kind == "updated":
            # A last-modified bump is only a content change if the content differs.
            if (
                observation["httpStatus"] == 200
                and observation["hash"]
                and previous_hash
                and previous_hash != observation["hash"]
            ):
                evidence = build_change_evidence(
                    url=url,
                    changed_fields=["lastmod", "pageContent"],
                    exact_diff=diff_summary(str(previous.get("text") or ""), observation["text"]),
                    diff_artifact=f"content-hash:{previous_hash[:16]}->{observation['hash'][:16]}",
                    previous_hash=previous_hash,
                    current_hash=observation["hash"],
                    previous_observed_at=previous_seen,
                    current_observed_at=observation["observedAt"],
                    http_status=observation["httpStatus"],
                )

        if evidence:
            substantiated.append({**item, "changeEvidence": evidence})
        else:
            unsubstantiated.append({
                **item,
                "evidenceSkipped": (
                    "no prior content hash was stored for comparison" if not previous_hash and kind == "updated"
                    else f"page returned HTTP {observation['httpStatus']}"
                ),
            })

    return substantiated, spent, unsubstantiated


def warm_content_hashes(
    urls: list[str],
    *,
    fetch_page,
    previous_hashes: dict[str, dict[str, str]],
    current_hashes: dict[str, dict[str, str]],
    budget: int,
    day_index: int | None = None,
) -> int:
    """Hash a rotating slice of pages that have no stored baseline.

    Without this, a last-modified change can never be substantiated the first
    time it happens, because there is nothing to compare against. Seeding a few
    pages per run gives the whole inventory a baseline within a couple of weeks
    while keeping the daily request count small.
    """
    missing = [url for url in urls if url not in previous_hashes]
    if not missing or budget < 1:
        return 0
    if day_index is None:
        day_index = datetime.now(timezone.utc).toordinal()
    ordered = sorted(
        missing,
        key=lambda url: hashlib.sha256(f"{day_index}:{url}".encode("utf-8")).hexdigest(),
    )
    spent = 0
    for url in ordered[:budget]:
        observation = observe_page(url, fetch_page)
        spent += 1
        if observation["hash"]:
            current_hashes[url] = {
                "hash": observation["hash"],
                "observedAt": observation["observedAt"],
                "text": observation["text"][:600],
            }
    return spent
