"""Safety and schema regression tests for public customer-voice adapters."""

from __future__ import annotations

import unittest
from unittest.mock import Mock

import requests

from scripts.collect_customer_voice import ADAPTERS, prune_out_of_scope_labwrench_feedback
from scripts.customer_voice_ingestion import SOURCE_CREDIBILITY, EvidenceRecord
from scripts.customer_voice_ingestion import chromforum, fda_bulk, labwrench, selectscience
from scripts.customer_voice_ingestion.common import DEFAULT_CRAWL_DELAY_SECONDS, RobotsAwareClient, deduplicate_records, extract_page_date, parse_page


class CustomerVoiceScopeTests(unittest.TestCase):
    def test_adapter_order_is_the_approved_order(self) -> None:
        self.assertEqual([name for name, _ in ADAPTERS], ["chromforum", "selectscience", "labwrench", "reddit", "fda"])

    def test_chromforum_scope_is_exact_and_rejects_session_ids(self) -> None:
        self.assertTrue(chromforum.in_scope("https://www.chromforum.org/viewtopic.php?t=8508"))
        self.assertTrue(chromforum.in_scope("https://chromforum.org/viewforum.php?f=1"))
        self.assertFalse(chromforum.in_scope("https://www.chromforum.org/search.php?keywords=Waters"))
        self.assertFalse(chromforum.in_scope("https://www.chromforum.org/viewtopic.php?t=8508&sid=secret"))
        self.assertFalse(chromforum.in_scope("https://www.chromforum.org/download/file.php?id=1"))

    def test_selectscience_scope_allows_only_products_and_articles(self) -> None:
        self.assertTrue(selectscience.in_scope("https://www.selectscience.net/product/example"))
        self.assertTrue(selectscience.in_scope("https://www.selectscience.net/article/example"))
        self.assertTrue(selectscience.in_scope("https://www.selectscience.net/articles/example"))
        self.assertFalse(selectscience.in_scope("https://www.selectscience.net/review?id=1"))
        self.assertFalse(selectscience.in_scope("https://www.selectscience.net/user/example"))
        self.assertFalse(selectscience.in_scope("https://www.selectscience.net/search?search=lc-ms"))

    def test_labwrench_scope_is_exact(self) -> None:
        self.assertTrue(labwrench.in_scope("https://www.labwrench.com/forums/hplc"))
        self.assertTrue(labwrench.in_scope("https://www.labwrench.com/thread/123/example"))
        self.assertTrue(labwrench.in_scope("https://www.labwrench.com/articles/example"))
        self.assertFalse(labwrench.in_scope("https://www.labwrench.com/my-profile"))
        self.assertFalse(labwrench.in_scope("https://www.labwrench.com/ask-a-question"))
        self.assertFalse(labwrench.in_scope("https://www.labwrench.com/search?q=hplc"))

    def test_labwrench_discovered_titles_must_be_lc_or_vendor_workflow_specific(self) -> None:
        self.assertTrue(labwrench.discovered_title_relevant("HPLC flow stoppage"))
        self.assertTrue(labwrench.discovered_title_relevant("Waters autosampler pressure issue"))
        self.assertFalse(labwrench.discovered_title_relevant("TexturePro CT Software"))
        self.assertFalse(labwrench.discovered_title_relevant("Health Care"))

    def test_fda_scope_is_limited_to_official_bulk_downloads(self) -> None:
        self.assertTrue(fda_bulk.in_scope(fda_bulk.WARNING_LETTERS_XLSX))
        self.assertTrue(fda_bulk.in_scope(fda_bulk.FORM_483_XLSX))
        self.assertFalse(fda_bulk.in_scope("https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/warning-letters/example"))
        self.assertFalse(fda_bulk.in_scope("https://example.com/fda.xlsx"))


class CustomerVoiceSchemaTests(unittest.TestCase):
    def test_legacy_labwrench_navigation_noise_is_pruned(self) -> None:
        data = {"feedback": [
            {
                "id": "cv-public-noise",
                "sourceUrl": "https://www.labwrench.com/thread/999/texturepro",
                "evidenceRecords": [{
                    "label": "LabWrench: TexturePro CT Software",
                    "url": "https://www.labwrench.com/thread/999/texturepro",
                }],
            },
            {
                "id": "cv-public-valid",
                "sourceUrl": "https://www.labwrench.com/thread/998/hplc-pressure",
                "evidenceRecords": [{
                    "label": "LabWrench: HPLC pressure issue",
                    "url": "https://www.labwrench.com/thread/998/hplc-pressure",
                }],
            },
        ]}
        self.assertEqual(prune_out_of_scope_labwrench_feedback(data), 1)
        self.assertEqual([item["id"] for item in data["feedback"]], ["cv-public-valid"])

    def test_selectscience_visible_review_cards_are_normalized(self) -> None:
        html = '''<div><p>Average Rating <!-- -->4.7</p></div>
          <div class="Review_applicationArea__abc"><span><strong>Application Area:</strong></span><p>Pharmaceutical QC</p></div>
          <p>Suitable dwell volume made the method transfer successful and maintenance is easy.</p>
          <p class="Review_reviewDate__abc"><strong>Review Date: </strong>2 Sept 2023<!-- --> | Example Corp</p>'''
        reviews = selectscience._visible_reviews(html)
        self.assertEqual(len(reviews), 1)
        self.assertEqual(reviews[0][1], 4.7)
        self.assertEqual(reviews[0][2], "2023-09-02")
        self.assertEqual(reviews[0][4], "Pharmaceutical QC")

    def test_evidence_schema_has_type_and_numeric_credibility(self) -> None:
        record = EvidenceRecord(
            label="Example",
            url="https://example.com/topic?utm_source=test",
            source_keywords=["HPLC", "method transfer"],
            record_type="Public example",
            source_date="2026-07-28",
            source_type="community_forum",
            source_name="Example",
        ).to_schema()
        self.assertEqual(record["sourceType"], "community_forum")
        self.assertEqual(record["sourceCredibility"], SOURCE_CREDIBILITY["community_forum"])
        self.assertIsInstance(record["sourceCredibility"], float)

    def test_canonical_url_dedup_is_preserved(self) -> None:
        first = EvidenceRecord("First", "https://example.com/topic?sid=a", ["HPLC", "Waters"], "Forum", "2026-07-28", "community_forum", "Example")
        richer = EvidenceRecord("Second", "https://example.com/topic?sid=b", ["HPLC", "Waters", "pressure"], "Forum", "2026-07-28", "community_forum", "Example", excerpt="More complete evidence")
        records = deduplicate_records([first, richer])
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].label, "Second")

    def test_forum_human_timestamp_is_preserved_without_today_fallback(self) -> None:
        parser = parse_page("https://www.chromforum.org/viewtopic.php?t=1", "<html><body>by analyst » Fri Aug 08, 2025 9:31 am</body></html>")
        self.assertEqual(extract_page_date(parser, "", fallback=""), "2025-08-08")
        parser = parse_page("https://www.labwrench.com/thread/1", "<html><body>Question Wed May 11 2016 Asked by analyst</body></html>")
        self.assertEqual(extract_page_date(parser, "", fallback=""), "2016-05-11")
        parser = parse_page("https://example.com/topic", "<html><body>No published date</body></html>")
        self.assertEqual(extract_page_date(parser, "", fallback=""), "")


class RobotsTests(unittest.TestCase):
    def test_robots_crawl_delay_defaults_to_at_least_ten_seconds(self) -> None:
        response = Mock(status_code=200, text="User-agent: *\nAllow: /viewtopic.php\n", url="https://example.com/robots.txt")
        session = Mock()
        session.headers = {}
        session.get.return_value = response
        client = RobotsAwareClient(session)
        self.assertIsNotNone(client.inspect_robots("https://example.com/viewtopic.php?t=1"))
        self.assertGreaterEqual(client._delays["https://example.com"], 10)
        self.assertGreaterEqual(client._delays["https://example.com"], DEFAULT_CRAWL_DELAY_SECONDS)

    def test_robots_fetch_failure_fails_closed(self) -> None:
        session = Mock()
        session.headers = {}
        session.get.side_effect = requests.RequestException("offline")
        client = RobotsAwareClient(session)
        self.assertFalse(client.allowed("https://example.com/viewtopic.php?t=1", lambda _url: True))


if __name__ == "__main__":
    unittest.main()
