#!/usr/bin/env python3
"""Apply deterministic provenance repairs identified by the 2026-07-29 fact audit.

This is deliberately a data migration, not a collector.  It preserves the original
observation while removing claims that the evidence cannot support.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

from provenance import stable_hash, utc_now


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
EXPORTS = ROOT / "exports"
RETRIEVED_AT = utc_now()


def excerpt(text: str, limit: int = 15) -> str:
    """Return a short, non-invented excerpt suitable for a provenance card."""
    return " ".join(str(text or "").split()[:limit])


def read_json(name: str) -> dict[str, Any]:
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def write_json(name: str, value: dict[str, Any]) -> None:
    (DATA / name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def repair_intelligence() -> dict[str, int]:
    data = read_json("intelligence.json")
    reclassified = 0
    sec_fixed = 0

    for signal in data.get("signals", []):
        signal.setdefault("claimID", signal.get("id"))
        signal.setdefault("retrievalDate", data.get("generatedAt") or RETRIEVED_AT)
        signal.setdefault("sourceDate", signal.get("date"))
        signal.setdefault("sourceDateType", "publication")
        signal.setdefault("languageType", "analyst_paraphrase")
        # Default to partial. A claim is promoted to verified below only when a
        # primary record explicitly supports the displayed factual element.
        signal.setdefault("evidenceStatus", "partial")
        signal.setdefault("caveat", "")

        if signal.get("signalType") in {"Product page added", "Product page updated"}:
            prior_type = signal["signalType"]
            competitor = signal.get("competitor", "Competitor")
            signal["previousClassification"] = prior_type
            signal["signalType"] = "Monitored product page"
            signal["title"] = f"{competitor} official product page observed"
            signal["summary"] = (
                "The URL was observed in an official product sitemap or product-page inventory. "
                "No preserved before/after page content supports an addition or update claim."
            )
            signal["theme"] = "Portfolio monitoring coverage"
            signal["intent"] = "Current-page inventory observation"
            signal["recommendation"] = (
                "Treat this as monitoring coverage only. Require two timestamped content snapshots, "
                "different content hashes, changed fields, and an exact diff before asserting a change."
            )
            signal["evidenceStatus"] = "unsupported"
            signal["sourceDateType"] = "ingestion"
            signal["caveat"] = "Initial observation is not evidence that a page or product changed."
            signal["changeEvidence"] = None
            reclassified += 1

        url = str(signal.get("sourceUrl") or "")
        if "/edgar/data/313616/" in url:
            related = "SCIEX" if signal.get("competitor") == "SCIEX" else signal.get("relatedOperatingBusiness")
            form = str(signal.get("signalType") or "SEC filing").replace("Investor filing", "SEC filing")
            form_label = signal.get("title", "").split(" filed ")[-1] or "SEC filing"
            signal["registrant"] = "Danaher Corporation"
            signal["relatedOperatingBusiness"] = related
            signal["competitor"] = "Danaher Corporation"
            signal["title"] = f"Danaher Corporation filed {form_label}"
            signal["summary"] = (
                "Danaher Corporation is the SEC registrant. SCIEX may be retained only as a related "
                "operating business when the cited filing passage explicitly discusses it."
            )
            signal["attributionBoundary"] = (
                "Do not attribute the filing or a corporate conclusion to SCIEX without an exact filing passage."
            )
            signal["caveat"] = signal["attributionBoundary"]
            signal["evidenceStatus"] = "partial" if related else "verified"
            signal["signalType"] = form
            sec_fixed += 1

        elif "/edgar/data/31791/" in url:
            signal["registrant"] = "Revvity, Inc."
            signal["relatedOperatingBusiness"] = None
            signal["competitor"] = "Revvity, Inc."
            is_q2_2026_earnings = signal.get("id") == "sec-perkinelmer-0000031791-26-000022"
            if not is_q2_2026_earnings:
                form_label = signal.get("title", "").split(" filed ")[-1] or "SEC filing"
                signal["title"] = f"Revvity, Inc. filed {form_label}"
                signal["summary"] = (
                    "Revvity, Inc. is the SEC registrant for CIK 31791. This filing must not be presented "
                    "as a filing by the separately operated PerkinElmer business."
                )
                signal["attributionBoundary"] = (
                    "Do not attribute this filing to PerkinElmer; use Revvity as the registrant."
                )
            signal["caveat"] = signal["attributionBoundary"]
            signal["evidenceStatus"] = "verified"
            sec_fixed += 1

        # Publication titles and reproducible PubMed counts are the two signal
        # families for which this data set retains an exact supporting element.
        # Other analyst summaries remain partial even when their URL is primary.
        query_provenance = signal.get("queryProvenance") or {}
        if signal.get("signalType") in {"Publication", "Scientific publication"} and signal.get("sourceUrl"):
            signal["evidenceStatus"] = "verified"
            signal["supportingExcerpt"] = excerpt(signal.get("title"))
            signal["sourceLocation"] = "PubMed record title"
        elif signal.get("signalType") == "Application trend" and query_provenance:
            one_year = query_provenance.get("1y") or query_provenance.get("1 year") or {}
            if one_year.get("retrievedCount") is not None and one_year.get("apiUrl"):
                signal["evidenceStatus"] = "verified"
                signal["supportingExcerpt"] = f"esearchresult.count: {one_year['retrievedCount']}"
                signal["sourceLocation"] = "NCBI E-utilities esearchresult.count"

        if signal.get("evidenceStatus") == "verified" and not signal.get("supportingExcerpt"):
            # Verified is never a proxy for a reachable URL. Without an exact,
            # short supporting element the claim remains only partially supported.
            signal["evidenceStatus"] = "partial"

    data["schemaVersion"] = 2
    data["provenanceRemediatedAt"] = RETRIEVED_AT
    write_json("intelligence.json", data)
    return {"productPageClaimsReclassified": reclassified, "secAttributionsCorrected": sec_fixed}


def repair_customer_voice() -> dict[str, int]:
    data = read_json("customer_voice.json")
    verbatim = 0
    synthesized = 0
    for item in data.get("feedback", []):
        records = item.get("evidenceRecords") or []
        exact_review = next(
            (record for record in records if record.get("reviewText") == item.get("customerLanguageSignal")),
            None,
        )
        item["claimID"] = item.get("id")
        item["retrievalDate"] = data.get("generatedAt") or RETRIEVED_AT
        item["sourceDate"] = next((r.get("sourceDate") for r in records if r.get("sourceDate")), None)
        item["sourceDateType"] = "publication"
        item["primarySourceUrl"] = item.get("sourceUrl") or next((r.get("url") for r in records), "")
        if exact_review:
            item["languageType"] = "verbatim_quote"
            item["sourceLocation"] = "Embedded structured product review text"
            item["supportingExcerpt"] = excerpt(item.get("customerLanguageSignal"))
            item["caveat"] = "One dated public review; do not generalize prevalence from a single reviewer."
            item["evidenceStatus"] = "verified"
            verbatim += 1
        else:
            item["languageType"] = "analyst_paraphrase" if len(records) <= 1 else "directional_synthesis"
            item["sourceLocation"] = "Mapped public evidence record(s); see evidenceRecords"
            item["caveat"] = (
                "Analyst-authored synthesis, not a verbatim customer quotation; public forums "
                "over-represent problem reports and volume does not equal sentiment or prevalence."
            )
            item["evidenceStatus"] = "partial"
            synthesized += 1
        for record in records:
            record.setdefault("retrievalDate", data.get("generatedAt") or RETRIEVED_AT)
            if record.get("dateType"):
                record["dateType"] = str(record["dateType"]).lower()

    data["schemaVersion"] = 2
    data["provenanceRemediatedAt"] = RETRIEVED_AT
    write_json("customer_voice.json", data)
    return {"verbatimQuotes": verbatim, "analystOrDirectional": synthesized}


def repair_known_dates() -> dict[str, int]:
    changes = 0
    notes = read_json("competitor_application_notes.json")
    for note in notes.get("notes", []):
        if note.get("id") == "thermo-oligo-system-test-2026":
            note.update({
                "date": "2023-07-01",
                "dateLabel": "Jul 2023",
                "datePrecision": "month",
                "sourceDate": "2023-07",
                "sourceDateType": "publication",
                "ingestionDate": notes.get("asOfDate"),
            })
            changes += 1
        elif note.get("id") == "shimadzu-pfas-seafood-2026":
            note.update({
                "date": "2024-07-01",
                "dateLabel": "Jul 2024",
                "datePrecision": "month",
                "sourceDate": "2024-07",
                "sourceDateType": "publication",
                "ingestionDate": notes.get("asOfDate"),
            })
            changes += 1
    # Do not downgrade the daily catalog contract added by the application-note
    # collector; this remediation only repairs record-level source dates.
    notes["schemaVersion"] = max(3, int(notes.get("schemaVersion") or 0))
    write_json("competitor_application_notes.json", notes)

    prep = read_json("conference_preparation.json")
    for event in prep.get("events", []):
        for record in event.get("competitorContent", []):
            url = record.get("sourceUrl", "")
            if "an-001954" in url:
                record.update({"sourceDate": "2023-07", "sourceDateType": "publication", "sourceDatePrecision": "month"})
                changes += 1
            elif "an_02-ssi-lcms-157" in url:
                record.update({"sourceDate": "2024-07", "sourceDateType": "publication", "sourceDatePrecision": "month"})
                changes += 1
    prep["schemaVersion"] = 2
    write_json("conference_preparation.json", prep)

    launches = read_json("product_launches.json")
    for launch in launches.get("launches", []):
        if launch.get("id") == "shimadzu-nexera-cl-lcms-2025":
            launch.update({
                "date": "2025-10-03",
                "launchDate": "2025-10-03",
                "publicationDate": "2025-11-12",
                "sourceDate": "2025-11-12",
                "sourceDateType": "publication",
                "dateCaveat": "Official news page published Nov 12, 2025; body states Japan launch on Oct 3, 2025.",
            })
            changes += 1
    launches["schemaVersion"] = 2
    write_json("product_launches.json", launches)
    return {"dateRecordsCorrected": changes}


def repair_links() -> dict[str, int]:
    data = read_json("conference_sources.json")
    changes = 0
    for event in data.get("events", []):
        if event.get("website") == "https://www.aaps.org/pharmsci/meeting":
            event["website"] = "https://www.aaps.org/pharmsci/annual-meeting"
            changes += 1
    data["schemaVersion"] = 2
    write_json("conference_sources.json", data)
    return {"mislinksCorrected": changes}


def repair_filing_insights() -> dict[str, int]:
    data = read_json("filing_insights.json")
    registrants = {
        "Agilent": "Agilent Technologies, Inc.",
        "Thermo Fisher": "Thermo Fisher Scientific Inc.",
        "Revvity": "Revvity, Inc.",
    }
    corrected = 0

    def repair(item: dict[str, Any], competitor: str) -> None:
        nonlocal corrected
        registrant = registrants.get(competitor)
        if registrant and item.get("registrant") != registrant:
            item["registrant"] = registrant
            corrected += 1
        item.setdefault("relatedOperatingBusiness", None)
        item.setdefault("languageType", "analyst_paraphrase")
        item.setdefault("retrievalDate", data.get("generatedAt") or RETRIEVED_AT)
        item.setdefault("sourceDate", item.get("date"))
        item.setdefault("sourceDateType", "filing")
        item.setdefault("attributionBoundary", f"The cited filing is attributable to {registrant or competitor} as registrant.")
        if item.get("supportingExcerpt") and item.get("sourceLocation") and item.get("sourceUrl"):
            item.setdefault("evidenceStatus", "verified")
        else:
            item["evidenceStatus"] = "partial"
            item.setdefault("caveat", "Analyst interpretation; no exact filing excerpt is retained for this claim.")

    for item in data.get("insights", []):
        repair(item, str(item.get("competitor") or ""))
    for company in data.get("companyCorporateMoves", []):
        competitor = str(company.get("competitor") or "")
        company["registrant"] = registrants.get(competitor)
        for item in company.get("items", []):
            repair(item, competitor)

    data["schemaVersion"] = 2
    data["provenanceRemediatedAt"] = RETRIEVED_AT
    write_json("filing_insights.json", data)
    return {"filingRegistrantRecordsCorrected": corrected}


def repair_historical_catalogs() -> dict[str, int]:
    marked = 0
    for name in ("historical_product_catalog.json", "historical_waters_catalog.json"):
        data = read_json(name)
        for product in data.get("products", []):
            exact_support = bool(product.get("supportingExcerpt") and product.get("sourceLocation"))
            if exact_support:
                product["evidenceStatus"] = "verified"
            else:
                product["evidenceStatus"] = "unsupported"
                product["caveat"] = (
                    "The official URL supports portfolio or historical context, but no retained exact passage "
                    "proves this product-year introduction record."
                )
                marked += 1
            product.setdefault("retrievalDate", data.get("generatedAt") or RETRIEVED_AT)
            product.setdefault("sourceDateType", "publication")
        data["schemaVersion"] = 2
        data["provenanceRemediatedAt"] = RETRIEVED_AT
        write_json(name, data)
    return {"historicalRowsMarkedUnsupported": marked}


def repair_pubmed_observation_history() -> dict[str, int]:
    intelligence = read_json("intelligence.json")
    path = DATA / "pubmed_query_observations.json"
    history = {"schemaVersion": 1, "observations": []}
    if path.exists():
        history = json.loads(path.read_text(encoding="utf-8"))
    seen = {item.get("observationID") for item in history.get("observations", [])}
    added = 0
    for group in ("themes", "competitors"):
        for item in intelligence.get("trends", {}).get(group, []):
            for observation in (item.get("queryProvenance") or {}).values():
                observation_id = observation.get("observationID") or stable_hash({
                    "queryHash": observation.get("queryHash"),
                    "retrievedAt": observation.get("retrievedAt"),
                    "retrievedCount": observation.get("retrievedCount"),
                })
                observation["observationID"] = observation_id
                if observation_id and observation_id not in seen:
                    history.setdefault("observations", []).append(observation)
                    seen.add(observation_id)
                    added += 1
    path.write_text(json.dumps(history, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    write_json("intelligence.json", intelligence)
    return {"pubmedObservationsAdded": added, "pubmedObservationsRetained": len(history.get("observations", []))}


def export_claim_registry() -> int:
    intelligence = read_json("intelligence.json")
    customer = read_json("customer_voice.json")
    filings = read_json("filing_insights.json")
    link_health = {
        str(item.get("url") or ""): str(item.get("status") or "").lower()
        for item in read_json("link_health.json")
    }

    def current_status(status: Any, url: Any) -> str:
        health = link_health.get(str(url or ""))
        if health in {"blocked", "dead"}:
            return "unreachable"
        if health == "mislink":
            return "contradicted"
        return str(status or "partial")
    EXPORTS.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, Any]] = []
    for signal in intelligence.get("signals", []):
        rows.append({
            "claimID": signal.get("claimID") or signal.get("id"),
            "claim": signal.get("title"),
            "status": current_status(signal.get("evidenceStatus"), signal.get("sourceUrl")),
            "languageType": signal.get("languageType"),
            "url": signal.get("sourceUrl"),
            "retrievalDate": signal.get("retrievalDate"),
            "sourceDate": signal.get("sourceDate"),
            "sourceDateType": signal.get("sourceDateType"),
            "sourceLocation": signal.get("sourceLocation"),
            "supportingExcerpt": signal.get("supportingExcerpt"),
            "caveat": signal.get("caveat"),
        })
    for item in customer.get("feedback", []):
        rows.append({
            "claimID": item.get("claimID") or item.get("id"),
            "claim": item.get("customerLanguageSignal"),
            "status": current_status(item.get("evidenceStatus"), item.get("primarySourceUrl")),
            "languageType": item.get("languageType"),
            "url": item.get("primarySourceUrl"),
            "retrievalDate": item.get("retrievalDate"),
            "sourceDate": item.get("sourceDate"),
            "sourceDateType": item.get("sourceDateType"),
            "sourceLocation": item.get("sourceLocation"),
            "supportingExcerpt": item.get("supportingExcerpt"),
            "caveat": item.get("caveat"),
        })
    for item in filings.get("insights", []):
        rows.append({
            "claimID": item.get("claimID") or item.get("id"),
            "claim": item.get("headline"),
            "status": current_status(item.get("evidenceStatus"), item.get("sourceUrl")),
            "languageType": item.get("languageType") or "analyst_paraphrase",
            "url": item.get("sourceUrl"),
            "retrievalDate": item.get("retrievalDate") or filings.get("generatedAt"),
            "sourceDate": item.get("sourceDate") or item.get("date"),
            "sourceDateType": item.get("sourceDateType") or "filing",
            "sourceLocation": item.get("sourceLocation") or (item.get("filingNavigation") or {}).get("whereToLook"),
            "supportingExcerpt": item.get("supportingExcerpt"),
            "caveat": item.get("caveat") or "Analyst interpretation of the cited filing passage.",
        })
    for company in filings.get("companyCorporateMoves", []):
        for index, item in enumerate(company.get("items", []), start=1):
            rows.append({
                "claimID": item.get("claimID") or f"filing-move-{str(company.get('competitor', 'company')).lower().replace(' ', '-')}-{index}",
                "claim": item.get("filingEvidence") or item.get("name"),
                "status": current_status(item.get("evidenceStatus"), item.get("sourceUrl")),
                "languageType": item.get("languageType") or "analyst_paraphrase",
                "url": item.get("sourceUrl"),
                "retrievalDate": item.get("retrievalDate") or filings.get("generatedAt"),
                "sourceDate": item.get("sourceDate") or item.get("date"),
                "sourceDateType": item.get("sourceDateType") or "filing",
                "sourceLocation": item.get("sourceLocation"),
                "supportingExcerpt": item.get("supportingExcerpt"),
                "caveat": item.get("caveat") or "Analyst interpretation of the cited filing passage.",
            })
    fields = [
        "claimID", "claim", "status", "languageType", "url", "retrievalDate",
        "sourceDate", "sourceDateType", "sourceLocation", "supportingExcerpt", "caveat",
    ]
    with (EXPORTS / "claims-registry.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    return len(rows)


def main() -> None:
    result: dict[str, Any] = {}
    result.update(repair_intelligence())
    result.update(repair_customer_voice())
    result.update(repair_known_dates())
    result.update(repair_links())
    result.update(repair_filing_insights())
    result.update(repair_historical_catalogs())
    result.update(repair_pubmed_observation_history())
    result["claimsExported"] = export_claim_registry()
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
