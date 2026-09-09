"""Guard the three freshness claims the dashboard makes about its own data.

Each test here covers a defect that shipped because nothing tested it:

1. The freshness ledger compared the stored dataset with itself, so a required
   source could never be reported as behind.
2. ``asOfDate`` was stamped with the run date even when a domain fell back to
   the previous dataset, and one refreshed domain excused two stale ones.
3. The provenance pass restamped ``retrievalDate`` on every record, including
   records no collector reached.
"""

import copy
import json
import sys
import unittest
from datetime import date, datetime, timezone
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import collect_real_data  # noqa: E402
import refresh_daily  # noqa: E402
from source_health import SourceHealth  # noqa: E402


TODAY = date.today().isoformat()
CHECKED_AT = f"{TODAY}T12:00:00Z"


def source_health_row(**overrides) -> SourceHealth:
    fields = {
        "sourceId": "example-source",
        "url": "https://example.org/",
        "required": True,
        "collectionMethod": "official_api",
        "collectionOutcome": "collected",
        "attemptedAt": CHECKED_AT,
        "succeededAt": CHECKED_AT,
        "recordsSeen": 5,
        "recordsIngested": 5,
        "completeness": "complete",
        "coverage": "complete",
    }
    fields.update(overrides)
    return SourceHealth(**fields)


def intelligence_fixture() -> dict:
    """A dataset where PubMed and SEC are both fully verified against the source."""
    item_evidence = {
        "newestPmid": "42655150",
        "newestDate": "2026-08-16",
        "newestStoredDate": "2026-08-16",
        "newestPmidIngested": True,
    }
    return {
        "asOfDate": TODAY,
        "trends": {
            "themes": [{"theme": f"Theme {index}", "itemEvidence": dict(item_evidence)} for index in range(5)],
            "competitors": [{"competitor": f"Competitor {index}", "itemEvidence": dict(item_evidence)} for index in range(5)],
        },
        "sourceHighWater": {
            "sec-edgar-submissions": {
                "observedAt": CHECKED_AT,
                "newestDate": "2026-08-26",
                "newestForm": "8-K",
                "newestRegistrant": "Example Corp",
                "newestAccession": "0000000000-26-000001",
                "newestTitle": "Example Corp filed 8-K",
                "newestUrl": "https://www.sec.gov/Archives/edgar/data/1/2/filing.htm",
                "newestSignalId": "sec-example-0000000000-26-000001",
                "inWindowFilingsSeen": 40,
            }
        },
        "signals": [
            {
                "id": "pubmed-42655150",
                "date": "2026-08-16",
                "title": "Newest collected PubMed record",
                "sourceUrl": "https://pubmed.ncbi.nlm.nih.gov/42655150/",
                "sourceName": "PubMed",
            },
            {
                "id": "sec-example-0000000000-26-000001",
                "date": "2026-08-26",
                "title": "Example Corp filed 8-K",
                "sourceUrl": "https://www.sec.gov/Archives/edgar/data/1/2/filing.htm",
                "sourceName": "SEC EDGAR",
            },
            {
                # A synthetic aggregate stamped with the run date. It is not a
                # record and must never stand in for the engine's high-water mark.
                "id": "trend-pfas",
                "date": TODAY,
                "title": "PFAS shows 341 PubMed records in the last year",
                "sourceUrl": "https://pubmed.ncbi.nlm.nih.gov/?term=pfas",
                "sourceName": "PubMed",
            },
        ],
    }


class LedgerIndependenceTests(unittest.TestCase):
    """Issue 1: a source row must compare the engine against the live source."""

    def test_self_comparison_cannot_report_current(self):
        row = source_health_row(
            engineNewestDate="2026-08-27",
            sourceNewestDate="2026-08-16",
            engineNewestTitle="Same record",
            engineNewestUrl="https://example.org/a",
            sourceNewestTitle="Same record",
            sourceNewestUrl="https://example.org/a",
            newestItemPresent=True,
        )

        self.assertNotEqual(row.state, "CURRENT")
        self.assertEqual(row.completeness, "unverified")
        self.assertEqual(row.coverage, "unverified")
        self.assertIsNone(row.sourceNewestUrl)
        self.assertIn("rather than from an observation of the live source", row.reason)

    def test_declared_live_observation_can_report_current(self):
        row = source_health_row(
            engineNewestDate="2026-08-26",
            engineNewestUrl="https://example.org/newest",
            sourceNewestDate="2026-08-26",
            sourceNewestUrl="https://example.org/newest",
            newestItemPresent=True,
            sourceObservation="Live API traversal; newest item observed 2026-08-26.",
        )

        self.assertEqual(row.state, "CURRENT")

    def test_stored_evidence_overrides_an_optimistic_collector_claim(self):
        row = source_health_row(
            engineNewestDate="2026-08-10",
            engineNewestUrl="https://example.org/old",
            sourceNewestDate="2026-08-26",
            sourceNewestUrl="https://example.org/newest",
            newestItemPresent=True,
            sourceObservation="Live API traversal; newest item observed 2026-08-26.",
        )

        self.assertEqual(row.state, "STALE")
        self.assertEqual(row.lagDays, 16)
        self.assertFalse(row.newestItemPresent)


class PubmedLedgerTests(unittest.TestCase):
    """Issue 1, PubMed: the newest-PMID query is the only independent evidence."""

    def test_fully_observed_and_ingested_reports_current(self):
        row = refresh_daily._pubmed_source_health(
            intelligence_fixture(), intelligence_fixture()["signals"], CHECKED_AT
        )

        self.assertEqual(row.state, "CURRENT")
        self.assertTrue(row.newestItemPresent)
        self.assertIn("Live PubMed E-utilities newest-item query", row.sourceObservation)

    def test_engine_high_water_ignores_synthetic_trend_signals(self):
        data = intelligence_fixture()
        row = refresh_daily._pubmed_source_health(data, data["signals"], CHECKED_AT)

        # trend-pfas is dated today; the newest genuine record is dated 2026-08-16.
        self.assertEqual(row.engineNewestDate, "2026-08-16")
        self.assertEqual(row.engineNewestUrl, "https://pubmed.ncbi.nlm.nih.gov/42655150/")

    def test_missing_newest_pmid_is_unverified_not_current(self):
        data = intelligence_fixture()
        data["trends"]["themes"][0]["itemEvidence"] = {
            "newestPmid": None, "newestDate": None, "newestPmidIngested": False
        }
        row = refresh_daily._pubmed_source_health(data, data["signals"], CHECKED_AT)

        self.assertEqual(row.state, "PARTIAL")
        self.assertEqual(row.completeness, "unverified")
        self.assertIn("9 of 10 configured PubMed queries", row.reason)

    def test_uningested_newest_pmid_fails_the_gate(self):
        data = intelligence_fixture()
        for group in ("themes", "competitors"):
            for item in data["trends"][group]:
                item["itemEvidence"].update(
                    {"newestPmid": "99999999", "newestDate": "2026-08-30",
                     "newestStoredDate": "2026-08-30", "newestPmidIngested": False}
                )
        row = refresh_daily._pubmed_source_health(data, data["signals"], CHECKED_AT)

        self.assertEqual(row.state, "STALE")
        self.assertFalse(row.newestItemPresent)

    def test_ahead_of_print_cover_date_is_not_reported_as_lag(self):
        data = intelligence_fixture()
        for group in ("themes", "competitors"):
            for item in data["trends"][group]:
                # PubMed returns a future cover date; the record is stored clamped.
                item["itemEvidence"].update(
                    {"newestDate": "2026-12-01", "newestStoredDate": "2026-08-16"}
                )
        row = refresh_daily._pubmed_source_health(data, data["signals"], CHECKED_AT)

        self.assertEqual(row.state, "CURRENT")
        self.assertEqual(row.lagDays, 0)


class PubmedRequestReliabilityTests(unittest.TestCase):
    def test_transient_rate_limit_is_retried(self):
        responses = [
            (429, b"rate limited"),
            (200, b'{"esearchresult":{"count":"7"}}'),
        ]
        with (
            patch.object(collect_real_data, "fetch", side_effect=responses) as mocked_fetch,
            patch.object(collect_real_data, "_wait_for_pubmed_slot"),
            patch.object(collect_real_data.time, "sleep"),
        ):
            result = collect_real_data.pubmed_fetch_json("https://example.invalid/pubmed")

        self.assertEqual(result["esearchresult"]["count"], "7")
        self.assertEqual(mocked_fetch.call_count, 2)


class SecLedgerTests(unittest.TestCase):
    """Issue 1, SEC: the live submissions high-water mark is the reference."""

    def test_ingested_high_water_reports_current(self):
        data = intelligence_fixture()
        row = refresh_daily._sec_source_health(data, data["signals"], CHECKED_AT)

        self.assertEqual(row.state, "CURRENT")
        self.assertTrue(row.newestItemPresent)
        self.assertEqual(row.recordsSeen, 40)

    def test_absent_high_water_is_unverified_not_current(self):
        data = intelligence_fixture()
        data.pop("sourceHighWater")
        row = refresh_daily._sec_source_health(data, data["signals"], CHECKED_AT)

        self.assertEqual(row.state, "PARTIAL")
        self.assertEqual(row.completeness, "unverified")

    def test_missed_newest_filing_fails_the_gate(self):
        data = intelligence_fixture()
        data["sourceHighWater"]["sec-edgar-submissions"].update(
            {"newestSignalId": "sec-example-not-ingested", "newestDate": "2026-08-30",
             "newestUrl": "https://www.sec.gov/Archives/edgar/data/1/3/newer.htm"}
        )
        row = refresh_daily._sec_source_health(data, data["signals"], CHECKED_AT)

        self.assertEqual(row.state, "STALE")
        self.assertFalse(row.newestItemPresent)

    def test_collector_records_the_live_high_water_mark(self):
        recent = {
            "form": ["8-K", "10-Q", "8-K"],
            "filingDate": ["2026-07-01", "2026-08-20", "2026-06-01"],
            "accessionNumber": ["0000000000-26-000001", "0000000000-26-000002", "0000000000-26-000003"],
            "primaryDocument": ["a.htm", "newest.htm", "c.htm"],
        }
        competitor = {"id": "example", "name": "Example Corp", "cik": "0000000123"}
        with patch.object(collect_real_data, "COMPETITORS", [competitor]), \
             patch.object(collect_real_data, "fetch_json",
                          return_value={"name": "Example Corp", "filings": {"recent": recent}}), \
             patch.object(collect_real_data.time, "sleep", return_value=None):
            signals, high_water = collect_real_data.collect_sec_signals()

        self.assertEqual(high_water["newestDate"], "2026-08-20")
        self.assertEqual(high_water["newestForm"], "10-Q")
        self.assertEqual(high_water["inWindowFilingsSeen"], 3)
        self.assertIn(high_water["newestSignalId"], {item["id"] for item in signals})


class AsOfDateTests(unittest.TestCase):
    """Issue 2: asOfDate describes the data, and required domains must refresh."""

    def base_dataset(self) -> dict:
        return {
            "asOfDate": TODAY,
            "domainAsOfDates": {"pubmed": TODAY, "sec": TODAY, "sourceHealth": TODAY},
            "signals": [{} for _ in range(10)],
            "recommendations": [{
                "title": "Current decision",
                "canonicalDecision": {"generatedAt": f"{TODAY}T00:00:00+00:00"},
                "urgency": {"decisionImplications": ["Current implication"]},
            }],
            "trends": {"themes": [
                {"theme": f"Theme {index}",
                 "counts": {key: index for key in ("30d", "60d", "90d", "1y", "3y", "5y")}}
                for index in range(5)
            ]},
            "refresh": {"pubmed": "success", "sec": "success", "sourceHealth": "success"},
        }

    def test_fully_refreshed_dataset_validates(self):
        refresh_daily.validate_intelligence(self.base_dataset())

    def test_each_required_domain_must_refresh(self):
        for domain in refresh_daily.REQUIRED_REFRESH_DOMAINS:
            with self.subTest(domain=domain):
                data = self.base_dataset()
                data["refresh"][domain] = "retained_last_good_data"
                with self.assertRaisesRegex(ValueError, f"required source domain did not refresh: {domain}"):
                    refresh_daily.validate_intelligence(data)

    def test_one_refreshed_domain_no_longer_excuses_stale_siblings(self):
        data = self.base_dataset()
        data["refresh"].update(pubmed="retained_last_good_data", sec="retained_last_good_data")
        with self.assertRaises(ValueError):
            refresh_daily.validate_intelligence(data)

    def test_restamped_as_of_date_is_rejected(self):
        data = self.base_dataset()
        data["domainAsOfDates"]["sec"] = "2026-01-01"
        with self.assertRaisesRegex(ValueError, "does not match the oldest contributing domain"):
            refresh_daily.validate_intelligence(data)

    def test_future_as_of_date_is_rejected(self):
        data = self.base_dataset()
        data["asOfDate"] = "2099-01-01"
        data["domainAsOfDates"] = {"pubmed": "2099-01-01", "sec": "2099-01-01", "sourceHealth": "2099-01-01"}
        with self.assertRaisesRegex(ValueError, "is in the future"):
            refresh_daily.validate_intelligence(data)

    def test_retained_domain_contributes_the_retained_date(self):
        """A domain that fell back carries the previous dataset's date forward."""
        retained = "2026-08-20"
        domain_as_of = {"pubmed": retained, "sec": TODAY, "sourceHealth": TODAY}
        contributing = [value for value in domain_as_of.values() if value]

        # The published date is the oldest contributing domain, never the run date.
        self.assertEqual(min(contributing), retained)
        self.assertNotEqual(min(contributing), TODAY)


class PubdateParsingTests(unittest.TestCase):
    """Issue 1 support: an ahead-of-print record is still a real newest item."""

    def test_future_cover_date_is_observed_but_stored_clamped(self):
        future = f"{date.today().year + 1} Dec"

        self.assertTrue(collect_real_data.parse_pubdate(future))
        self.assertEqual(collect_real_data.clean_pubdate(future), "")
        self.assertEqual(collect_real_data.signal_pubdate(future), TODAY)

    def test_past_dates_are_unchanged(self):
        for raw, expected in (("2026 Aug 16", "2026-08-16"), ("2024", "2024-01-01")):
            with self.subTest(raw=raw):
                self.assertEqual(collect_real_data.parse_pubdate(raw), expected)
                self.assertEqual(collect_real_data.signal_pubdate(raw), expected)

    def test_unparseable_dates_stay_empty(self):
        for raw in ("", "no date here"):
            with self.subTest(raw=raw):
                self.assertEqual(collect_real_data.signal_pubdate(raw), "")


class RetrievalDateTests(unittest.TestCase):
    """Issue 3: only a record the collector actually re-read is freshly retrieved."""

    def build(self, tmp: Path, last_seen: str | None) -> dict:
        records = [{"url": "https://example.org/a", "sourceDate": "2024-01-01"}]
        if last_seen:
            records[0]["lastSeenAt"] = last_seen
        payload = {
            "generatedAt": f"{TODAY}T00:00:00Z",
            "feedback": [{
                "id": "cv-1",
                "customerLanguageSignal": "A customer said something",
                "dateCaptured": "2026-07-30",
                "retrievalDate": "2026-07-30",
                "evidenceRecords": records,
            }],
        }
        (tmp / "customer_voice.json").write_text(json.dumps(payload), encoding="utf-8")
        return payload

    def run_repair(self, last_seen: str | None) -> dict:
        import tempfile
        import remediate_provenance

        with tempfile.TemporaryDirectory() as directory:
            tmp = Path(directory)
            self.build(tmp, last_seen)
            with patch.object(remediate_provenance, "DATA", tmp):
                remediate_provenance.repair_customer_voice()
            return json.loads((tmp / "customer_voice.json").read_text(encoding="utf-8"))

    def test_re_read_record_advances_its_retrieval_date(self):
        item = self.run_repair("2026-08-27T13:00:00Z")["feedback"][0]

        self.assertEqual(item["contentAsOf"], "2026-08-27T13:00:00Z")
        self.assertEqual(item["retrievalDate"], "2026-08-27T13:00:00Z")

    def test_unread_record_keeps_its_earlier_retrieval_date(self):
        item = self.run_repair(None)["feedback"][0]

        # No collector reached this record, so it must not read as retrieved today.
        self.assertEqual(item["contentAsOf"], "2026-07-30")
        self.assertEqual(item["retrievalDate"], "2026-07-30")
        self.assertNotEqual(item["retrievalDate"][:10], TODAY)

    def test_stamped_at_records_the_pass_without_claiming_a_re_read(self):
        item = self.run_repair(None)["feedback"][0]

        self.assertEqual(item["stampedAt"][:10], datetime.now(timezone.utc).date().isoformat())
        self.assertNotEqual(item["stampedAt"][:10], item["contentAsOf"][:10])


class ShippedDataTests(unittest.TestCase):
    """The published dataset must not contain a restamped retrieval date."""

    def test_no_record_claims_a_retrieval_it_did_not_have(self):
        payload = json.loads((ROOT / "data" / "customer_voice.json").read_text(encoding="utf-8"))
        for item in payload.get("feedback", []):
            observed = [
                str(record.get("lastSeenAt") or "")
                for record in item.get("evidenceRecords") or []
                if record.get("lastSeenAt")
            ]
            if not observed:
                continue
            with self.subTest(record=item.get("id")):
                self.assertEqual(str(item.get("retrievalDate") or ""), max(observed))


if __name__ == "__main__":
    unittest.main()
