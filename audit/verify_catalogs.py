#!/usr/bin/env python3
"""Conservative primary-source verifier for the two historical product catalogs."""

from __future__ import annotations

import html
import json
import re
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
from pathlib import Path

import certifi
import requests


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "audit" / "current_catalog_claim_check_2026-08-02.json"
HEADERS = {
    "User-Agent": "Waters-competitive-intelligence-fact-audit/1.0 contact=qa-audit@example.com",
    "Accept": "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8",
}


def clean_text(value: str) -> str:
    value = html.unescape(value or "")
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def norm(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").lower())


def product_tokens(value: str) -> list[str]:
    stop = {
        "system", "systems", "platform", "series", "mass", "spectrometer",
        "spectrometry", "liquid", "chromatography", "hplc", "uhplc", "uplc",
        "lc", "ms", "msms", "tof", "qtof", "triple", "quadrupole", "detector",
        "analyzer", "autosampler", "pump", "workstation", "software",
    }
    parts = re.findall(r"[a-z0-9]+", (value or "").lower())
    return [p for p in parts if p not in stop and len(p) >= 2]


def extract_pdf(content: bytes) -> str:
    try:
        result = subprocess.run(
            ["pdftotext", "-f", "1", "-l", "12", "-", "-"],
            input=content,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=20,
            check=False,
        )
        return clean_text(result.stdout.decode("utf-8", errors="replace"))
    except Exception:
        return ""


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self.skip_depth = 0

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in {"script", "style", "noscript", "svg"}:
            self.skip_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript", "svg"} and self.skip_depth:
            self.skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if not self.skip_depth:
            self.parts.append(data)


def extract_html(content: bytes) -> str:
    parser = TextExtractor()
    parser.feed(content.decode("utf-8", errors="replace"))
    return clean_text(" ".join(parser.parts))


def fetch(url: str) -> dict:
    try:
        response = requests.get(url, headers=HEADERS, timeout=12, allow_redirects=True, verify=certifi.where())
        ctype = response.headers.get("content-type", "").lower()
        if response.status_code >= 400:
            return {"httpStatus": response.status_code, "finalUrl": response.url, "text": "", "error": ""}
        if "pdf" in ctype or response.content[:4] == b"%PDF":
            text = extract_pdf(response.content)
        else:
            text = extract_html(response.content)
        return {"httpStatus": response.status_code, "finalUrl": response.url, "text": text, "error": ""}
    except Exception as exc:
        return {"httpStatus": 0, "finalUrl": url, "text": "", "error": f"{type(exc).__name__}: {exc}"}


def quote_near(text: str, tokens: list[str], year: str) -> str:
    lower = text.lower()
    points = [lower.find(token) for token in tokens if lower.find(token) >= 0]
    if year and lower.find(year) >= 0:
        points.append(lower.find(year))
    if not points:
        return ""
    start = max(0, min(points) - 100)
    segment = clean_text(text[start:start + 500])
    words = segment.split()
    return " ".join(words[:15])


def main() -> None:
    catalogs = [
        ("historical-competitor", ROOT / "data" / "historical_product_catalog.json"),
        ("historical-waters", ROOT / "data" / "historical_waters_catalog.json"),
    ]
    records = []
    for category, path in catalogs:
        for product in json.loads(path.read_text())["products"]:
            records.append((category, product))

    link_results = {row["url"]: row for row in json.loads((ROOT / "audit" / "current_presented_link_check_2026-08-02.json").read_text())}
    cache: dict[str, dict] = {}
    candidate_urls = set()
    for _, product in records:
        url = product.get("sourceUrl", "")
        link = link_results.get(url, {})
        if link.get("classification") in {"Broken", "Mislink"}:
            cache[url] = {
                "httpStatus": link.get("httpStatus", 0),
                "finalUrl": link.get("finalUrl", url),
                "text": "",
                "error": link.get("error", ""),
            }
        elif url:
            candidate_urls.add(url)
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(fetch, url): url for url in candidate_urls}
        for future in as_completed(futures):
            cache[futures[future]] = future.result()

    results = []
    for category, product in records:
        url = product.get("sourceUrl", "")
        fetched = cache.get(url, {"httpStatus": 0, "finalUrl": url, "text": "", "error": "missing URL"})
        text = fetched.get("text", "")
        tokens = product_tokens(product.get("product", ""))
        token_hits = sum(1 for token in set(tokens) if token in text.lower())
        token_ratio = token_hits / max(1, len(set(tokens)))
        exact_name = bool(product.get("product")) and norm(product["product"]) in norm(text)
        year = str(product.get("introducedYear") or "")
        year_found = bool(year and year in text)

        if fetched.get("httpStatus", 0) >= 400 or not text:
            verdict = "UNREACHABLE"
            discrepancy = "Primary source could not be fetched or extracted."
        elif (exact_name or token_ratio >= 0.8) and year_found:
            verdict = "Verified"
            discrepancy = ""
        elif exact_name or token_ratio >= 0.6:
            verdict = "Partially supported"
            discrepancy = "Product identity is supported, but the introduction year was not found in the fetched source."
        else:
            verdict = "Unsupported/Hallucinated"
            discrepancy = "Fetched source did not identify the claimed product with sufficient specificity."

        results.append({
            "category": category,
            "id": product.get("id", ""),
            "competitor": product.get("competitor", "Waters"),
            "product": product.get("product", ""),
            "introducedYear": product.get("introducedYear"),
            "sourceUrl": url,
            "httpStatus": fetched.get("httpStatus"),
            "finalUrl": fetched.get("finalUrl"),
            "verdict": verdict,
            "sourceQuote": quote_near(text, tokens, year),
            "discrepancy": discrepancy,
            "error": fetched.get("error", ""),
        })

    OUT.write_text(json.dumps(results, indent=2, ensure_ascii=False) + "\n")
    counts: dict[str, int] = {}
    for row in results:
        counts[row["verdict"]] = counts.get(row["verdict"], 0) + 1
    print(json.dumps({"records": len(results), "counts": counts, "output": str(OUT)}, indent=2))


if __name__ == "__main__":
    main()
