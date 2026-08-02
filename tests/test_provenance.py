import json
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from provenance import DATE_TYPES, assess_source_quality, pubmed_provenance, valid_change_evidence  # noqa: E402
from check_links import semantic_body_status, semantic_redirect_status  # noqa: E402
import collect_real_data as collector  # noqa: E402


class ProvenanceTests(unittest.TestCase):
    def test_source_quality_rewards_quality_and_not_link_volume(self):
        strong_sources = [
            {
                "url": "https://journal.example.test/article",
                "sourceType": "peer_reviewed_article",
                "sourceControl": "independent",
                "independenceGroup": "journal-study",
                "claimSupport": "direct",
                "evidenceStatus": "verified",
            },
            {
                "url": "https://vendor.example.test/product",
                "sourceType": "official_product_page",
                "sourceControl": "issuer",
                "independenceGroup": "vendor",
                "claimSupport": "direct",
                "evidenceStatus": "partial",
            },
        ]
        weak_sources = [
            {
                "url": f"https://aggregator.example.test/{index}",
                "sourceType": "community_or_aggregator",
                "sourceControl": "issuer",
                "independenceGroup": "same-aggregator",
                "claimSupport": "contextual",
                "evidenceStatus": "unsupported",
            }
            for index in range(8)
        ]

        strong = assess_source_quality(strong_sources)
        duplicated = assess_source_quality(strong_sources + [strong_sources[0]] * 8)
        weak = assess_source_quality(weak_sources)

        self.assertEqual(strong["score"], 9)
        self.assertEqual(duplicated["score"], strong["score"])
        self.assertEqual(duplicated["sourceCount"], 2)
        self.assertGreater(strong["score"], weak["score"])
        self.assertEqual(strong["dimensions"]["corroboration"]["score"], 2)

    def test_initial_snapshot_cannot_be_a_change(self):
        self.assertFalse(valid_change_evidence({"canonicalUrl": "https://example.test/product"}))

    def test_change_requires_distinct_hashes_exact_diff_and_artifact(self):
        evidence = {
            "canonicalUrl": "https://example.test/product",
            "previousObservedAt": "2026-07-28T00:00:00Z",
            "currentObservedAt": "2026-07-29T00:00:00Z",
            "previousContentHash": "a",
            "currentContentHash": "b",
            "changedFields": ["headline"],
            "exactDiff": "- old\n+ new",
            "diffArtifact": "data/diffs/example.diff",
        }
        self.assertTrue(valid_change_evidence(evidence))
        evidence["currentContentHash"] = "a"
        self.assertFalse(valid_change_evidence(evidence))

    def test_pubmed_count_is_reproducible(self):
        item = pubmed_provenance("LC-MS", date(2025, 7, 29), date(2026, 7, 29), 42, retrieved_at="2026-07-29T12:00:00Z")
        self.assertEqual(item["database"], "pubmed")
        self.assertEqual(item["dateField"], "Date - Publication")
        self.assertTrue(item["rangeInclusive"])
        self.assertEqual(item["retrievedCount"], 42)
        self.assertIn("term=", item["resultsUrl"])
        self.assertIn("esearch.fcgi", item["apiUrl"])
        self.assertEqual(len(item["queryHash"]), 64)
        self.assertEqual(len(item["observationID"]), 64)
        self.assertIn("filing", DATE_TYPES)

    def test_pubmed_observation_history_is_append_only_and_exact(self):
        history = json.loads((ROOT / "data" / "pubmed_query_observations.json").read_text())
        observations = history["observations"]
        self.assertTrue(observations)
        ids = [item["observationID"] for item in observations]
        self.assertEqual(len(ids), len(set(ids)))
        for item in observations:
            self.assertEqual(item["database"], "pubmed")
            self.assertIsInstance(item["retrievedCount"], int)
            self.assertTrue(item["retrievedAt"])
            self.assertTrue(item["queryHash"])

    def test_pubmed_retrieval_never_smooths_or_normalizes_counts(self):
        raw_counts = [7, 5, 9, 41, 120, 200]
        with tempfile.TemporaryDirectory() as directory:
            with (
                patch.object(collector, "PUBMED_OBSERVATIONS", Path(directory) / "observations.json"),
                patch.object(collector, "pubmed_count", side_effect=raw_counts),
            ):
                counts, provenance = collector.pubmed_counts_with_provenance("LC-MS")
        self.assertEqual(list(counts.values()), raw_counts)
        self.assertEqual(
            [item["retrievedCount"] for item in provenance.values()],
            raw_counts,
        )

    def test_no_dated_product_change_without_diff(self):
        data = json.loads((ROOT / "data" / "intelligence.json").read_text())
        unsupported_types = {"Product page added", "Product page updated"}
        self.assertFalse([s["id"] for s in data["signals"] if s.get("signalType") in unsupported_types and not valid_change_evidence(s.get("changeEvidence"))])

    def test_sec_registrants_are_not_operating_brand_names(self):
        data = json.loads((ROOT / "data" / "intelligence.json").read_text())
        for signal in data["signals"]:
            url = signal.get("sourceUrl", "")
            if "/edgar/data/313616/" in url:
                self.assertEqual(signal.get("registrant"), "Danaher Corporation")
                self.assertNotIn("SCIEX filed", signal.get("title", ""))
            if "/edgar/data/31791/" in url:
                self.assertEqual(signal.get("registrant"), "Revvity, Inc.")
                self.assertNotIn("PerkinElmer filed", signal.get("title", ""))

    def test_filing_insight_registrants_are_explicit(self):
        data = json.loads((ROOT / "data" / "filing_insights.json").read_text())
        expected = {
            "Agilent": "Agilent Technologies, Inc.",
            "Thermo Fisher": "Thermo Fisher Scientific Inc.",
            "Revvity": "Revvity, Inc.",
        }
        for item in data["insights"]:
            self.assertEqual(item.get("registrant"), expected[item["competitor"]], item["id"])
            self.assertEqual(item.get("sourceDateType"), "filing", item["id"])

    def test_historical_catalogs_do_not_treat_official_domain_as_exact_proof(self):
        for name in ("historical_product_catalog.json", "historical_waters_catalog.json"):
            data = json.loads((ROOT / "data" / name).read_text())
            for item in data["products"]:
                self.assertIn(item.get("evidenceStatus"), {"verified", "unsupported"}, item["id"])
                if item["evidenceStatus"] == "verified":
                    self.assertTrue(item.get("supportingExcerpt"), item["id"])
                    self.assertTrue(item.get("sourceLocation"), item["id"])
                else:
                    self.assertTrue(item.get("caveat"), item["id"])

    def test_customer_language_types_are_explicit(self):
        data = json.loads((ROOT / "data" / "customer_voice.json").read_text())
        allowed = {"verbatim_quote", "analyst_paraphrase", "directional_synthesis"}
        self.assertTrue(all(item.get("languageType") in allowed for item in data["feedback"]))
        quote = next(item for item in data["feedback"] if item.get("customerLanguageSignal") == "Perfect column for metabolomic purpose!")
        self.assertEqual(quote["languageType"], "verbatim_quote")

    def test_canonical_decision_count_and_query_match_trend(self):
        data = json.loads((ROOT / "data" / "intelligence.json").read_text())
        themes = {item["theme"]: item for item in data["trends"]["themes"]}
        for recommendation in data["recommendations"]:
            canonical = recommendation["canonicalDecision"]
            trend = themes[canonical["trend"]["theme"]]
            self.assertEqual(canonical["trend"]["count"], trend["counts"]["1y"])
            self.assertEqual(canonical["trend"]["queryProvenance"]["retrievedCount"], trend["counts"]["1y"])
            self.assertEqual(recommendation["priorityScore"], canonical["score"]["score"])

    def test_semantic_link_failures_are_not_healthy(self):
        status, _ = semantic_redirect_status(
            "https://example.test/deep/evidence",
            "https://example.test/",
        )
        self.assertEqual(status, "mislink")
        status, _ = semantic_body_status("text/html", "<title>404 - Page not found</title>")
        self.assertEqual(status, "mislink")
        status, _ = semantic_body_status("text/html", "Please verify you are human")
        self.assertEqual(status, "blocked")

    def test_nexera_cl_keeps_publication_and_launch_dates_distinct(self):
        data = json.loads((ROOT / "data" / "product_launches.json").read_text())
        record = next(item for item in data["launches"] if item["id"] == "shimadzu-nexera-cl-lcms-2025")
        self.assertEqual(record["launchDate"], "2025-10-03")
        self.assertEqual(record["publicationDate"], "2025-11-12")
        self.assertEqual(record["sourceDateType"], "publication")

    def test_every_verified_export_claim_has_exact_support(self):
        import csv
        with (ROOT / "exports" / "claims-registry.csv").open(encoding="utf-8") as handle:
            rows = list(csv.DictReader(handle))
        verified = [row for row in rows if row["status"] == "verified"]
        self.assertTrue(verified)
        for row in verified:
            self.assertTrue(row["url"].startswith("https://"), row["claimID"])
            self.assertGreater(len(row["supportingExcerpt"].split()), 0, row["claimID"])
            self.assertLessEqual(len(row["supportingExcerpt"].split()), 15, row["claimID"])


if __name__ == "__main__":
    unittest.main()
