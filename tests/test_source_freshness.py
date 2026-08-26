"""Regression tests for source-level freshness, completeness, and coverage."""

from __future__ import annotations

import json
import os
import tempfile
import unittest
from datetime import date, datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import sys

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
for candidate in (str(ROOT), str(SCRIPTS)):
    if candidate not in sys.path:
        sys.path.insert(0, candidate)

from scripts import collect_agilent, collect_competitors, collect_customer_voice, collect_real_data, collect_scientific_sources, refresh_daily
from scripts.customer_voice_ingestion import chromforum, labwrench, selectscience
from scripts.source_health import SourceHealth, migrate_legacy_source, write_ledger


def response(url: str, body: str) -> SimpleNamespace:
    return SimpleNamespace(url=url, text=body, headers={"content-type": "text/html; charset=utf-8"}, status_code=200)


class FakeClient:
    def __init__(self, pages: dict[str, str]) -> None:
        self.pages = pages
        self.requested: list[str] = []

    def get(self, url, scope_check, **_kwargs):
        self.requested.append(url)
        body = self.pages.get(url)
        return response(url, body) if body is not None and scope_check(url) else None


class SourceHealthContractTests(unittest.TestCase):
    def test_agilent_detail_enrichment_rejects_access_denied_bodies(self) -> None:
        self.assertFalse(collect_agilent.valid_detail_page_content(
            "Access Denied",
            "You don't have permission to access this URL. errors.edgesuite.net",
        ))
        self.assertTrue(collect_agilent.valid_detail_page_content(
            "Agilent launches an LC workflow",
            "The official release describes the new chromatography workflow.",
        ))

    def test_thermo_browser_cache_requires_exact_archive_count_and_high_water(self) -> None:
        newest_url = "https://example.com/new"
        releases = {
            newest_url: {"date": "2026-08-12", "title": "Newest official release", "url": newest_url},
            "https://example.com/old": {"date": "2026-07-23", "title": "Older official release", "url": "https://example.com/old"},
        }
        cache = {
            "validationMethod": "full_official_archive_dom",
            "verifiedAt": "2026-08-17T12:00:00Z",
            "maxAgeHours": 24,
            "asOfYear": 2026,
            "sourceCount": 2,
            "newestDate": "2026-08-12",
            "newestTitle": "Newest official release",
            "newestUrl": newest_url,
        }
        with tempfile.TemporaryDirectory() as directory:
            cache_path = Path(directory) / "cache.json"
            snapshot_dir = Path(directory) / "snapshots"
            snapshot_dir.mkdir()
            cache_path.write_text(json.dumps(cache), encoding="utf-8")
            (snapshot_dir / "thermo.json").write_text(json.dumps({"pressReleases": releases}), encoding="utf-8")
            with patch.object(collect_competitors, "THERMO_PRESS_BROWSER_CACHE_FILE", cache_path), patch.object(collect_competitors, "SNAPSHOT_DIR", snapshot_dir), patch.object(collect_competitors, "date") as mocked_date:
                mocked_date.today.return_value = date(2026, 8, 17)
                result = collect_competitors.cached_thermo_browser_verified_releases(
                    datetime(2026, 8, 17, 14, tzinfo=timezone.utc)
                )
        self.assertEqual(result, releases)

    def test_agilent_browser_cache_requires_recent_full_archive_and_matching_high_water(self) -> None:
        releases = {
            "https://example.com/new": {"date": "2026-07-29", "title": "Newest official release"},
            "https://example.com/old": {"date": "2026-07-28", "title": "Older official release"},
        }
        cache = {
            "validationMethod": "full_official_archive_dom",
            "verifiedAt": "2026-08-17T12:00:00Z",
            "maxAgeHours": 24,
            "asOfYear": 2026,
            "sourceCount": 2,
            "newestDate": "2026-07-29",
            "newestTitle": "Newest official release",
        }
        with tempfile.TemporaryDirectory() as directory:
            cache_path = Path(directory) / "cache.json"
            snapshot_path = Path(directory) / "snapshot.json"
            cache_path.write_text(json.dumps(cache), encoding="utf-8")
            snapshot_path.write_text(json.dumps({"pressReleases": releases}), encoding="utf-8")
            with patch.object(collect_agilent, "PRESS_BROWSER_CACHE_FILE", cache_path), patch.object(collect_agilent, "SNAPSHOT_FILE", snapshot_path), patch.object(collect_agilent, "date") as mocked_date:
                mocked_date.today.return_value = date(2026, 8, 17)
                result = collect_agilent.cached_browser_verified_releases(
                    datetime(2026, 8, 17, 14, tzinfo=timezone.utc)
                )
        self.assertEqual(result, releases)

    def test_newest_source_url_must_match_the_newest_ingested_url(self) -> None:
        source = SourceHealth(
            "press", "https://example.com/news", True, "archive", "collected", "2026-08-16T00:00:00Z",
            engineNewestDate="2026-08-16", sourceNewestDate="2026-08-16",
            engineNewestUrl="https://example.com/news/older", sourceNewestUrl="https://example.com/news/newest",
            recordsSeen=2, recordsIngested=2, completeness="complete", coverage="complete",
        )
        self.assertFalse(source.newestItemPresent)
        self.assertEqual(source.state, "PARTIAL")

    def test_required_stale_or_skipped_source_blocks_global_current(self) -> None:
        sources = [
            SourceHealth("current", "https://example.com/current", True, "api", "collected", "2026-07-30T00:00:00Z", engineNewestDate="2026-07-30", sourceNewestDate="2026-07-30", recordsSeen=1, recordsIngested=1, completeness="complete", coverage="complete"),
            SourceHealth("stale", "https://example.com/stale", True, "api", "stale", "2026-07-30T00:00:00Z", engineNewestDate="2026-07-29", sourceNewestDate="2026-07-30", recordsSeen=2, recordsIngested=1, completeness="partial", coverage="complete"),
            SourceHealth("reddit", "https://oauth.reddit.com", True, "official_api", "skipped_missing_credentials", "2026-07-30T00:00:00Z", completeness="unverified", coverage="unverified"),
        ]
        with tempfile.TemporaryDirectory() as directory:
            ledger = write_ledger(Path(directory) / "health.json", sources)
        self.assertFalse(ledger["allRequiredSourcesCurrent"])
        self.assertEqual(set(ledger["requiredSourceBlockers"]), {"stale", "reddit"})
        self.assertIsNone(ledger["sourcesVerifiedAt"])

    def test_missing_reddit_credentials_are_skipped_not_checked(self) -> None:
        with patch.dict(os.environ, {"CUSTOMER_VOICE_REDDIT_ENABLED": "true"}, clear=False):
            with patch.dict(os.environ, {"REDDIT_CLIENT_ID": "", "REDDIT_CLIENT_SECRET": ""}, clear=False):
                outcome, completeness, _ = collect_customer_voice._adapter_outcome("reddit", [], {})
        self.assertEqual(outcome, "skipped_missing_credentials")
        self.assertEqual(completeness, "unverified")

        migrated = migrate_legacy_source({
            "id": "reddit-lc-discussions",
            "url": "https://www.reddit.com/dev/api/",
            "collectionOutcome": "skipped_missing_credentials",
            "lastCheckedAt": "2026-08-02T20:00:24+00:00",
            "completeness": "unverified",
            "coverageState": "unverified",
        })
        self.assertIsNone(migrated.succeededAt)
        self.assertEqual(migrated.to_dict()["reachabilityStatus"], "UNVERIFIED")


class CommunityTraversalTests(unittest.TestCase):
    def test_chromforum_uses_newest_board_page_before_older_comparison_page(self) -> None:
        seed0 = "https://www.chromforum.org/viewforum.php?f=1&start=0"
        seed1 = "https://www.chromforum.org/viewforum.php?f=1&start=25"
        newest = "https://www.chromforum.org/viewtopic.php?t=200"
        older = "https://www.chromforum.org/viewtopic.php?t=100"
        pages = {
            seed0: f'<html><title>LC board</title><a href="{newest}">Current HPLC maintenance</a></html>',
            seed1: f'<html><title>LC board</title><a href="{older}">Waters vs Agilent comparison</a></html>',
            newest: '<html><title>Current HPLC maintenance</title><body>HPLC troubleshooting Fri Jul 24, 2026 9:00 am</body></html>',
            older: '<html><title>Waters vs Agilent</title><body>HPLC comparison Fri Jul 24, 2025 9:00 am</body></html>',
        }
        with tempfile.TemporaryDirectory() as directory, patch.object(chromforum, "CURSOR_FILE", Path(directory) / "cursor.json"), patch.dict(os.environ, {"CUSTOMER_VOICE_CHROMFORUM_ENABLED": "true", "CHROMFORUM_MAX_TOPICS": "1", "CHROMFORUM_MAX_FORUM_PAGES": "2"}):
            records = chromforum.collect(FakeClient(pages))
        self.assertEqual([item.url for item in records], [newest])

    def test_labwrench_traverses_board_instead_of_fixed_historical_seeds(self) -> None:
        board = "https://www.labwrench.com/forums/"
        newest = "https://www.labwrench.com/thread/999/current-hplc"
        pages = {
            board: f'<html><title>HPLC forum</title><a href="{newest}">Current HPLC thread</a></html>',
            newest: '<html><title>Current HPLC issue</title><body>HPLC pressure troubleshooting Fri Jul 24, 2026 9:00 am</body></html>',
        }
        with tempfile.TemporaryDirectory() as directory, patch.object(labwrench, "CURSOR_FILE", Path(directory) / "cursor.json"), patch.dict(os.environ, {"CUSTOMER_VOICE_LABWRENCH_ENABLED": "true", "LABWRENCH_MAX_RECORDS": "1", "LABWRENCH_MAX_PAGES": "1"}):
            records = labwrench.collect(FakeClient(pages))
        self.assertEqual([item.url for item in records], [newest])

    def test_selectscience_emits_one_record_per_public_review(self) -> None:
        product = "https://www.selectscience.net/product/example"
        body = '''<html><title>LC column | SelectScience</title><script type="application/ld+json">{
          "@type":"Product","name":"LC column","review":[
            {"@type":"Review","@id":"r1","datePublished":"2026-07-20","reviewBody":"Reliable HPLC column","reviewRating":{"ratingValue":5}},
            {"@type":"Review","@id":"r2","datePublished":"2026-07-21","reviewBody":"Useful LC-MS method transfer","reviewRating":{"ratingValue":4}}
          ]}</script></html>'''
        with patch.dict(os.environ, {"CUSTOMER_VOICE_SELECTSCIENCE_ENABLED": "true", "SELECTSCIENCE_SEEDS": product}):
            records = selectscience.collect(FakeClient({product: body}))
        self.assertEqual(len(records), 2)
        self.assertEqual({item.rating for item in records}, {4.0, 5.0})
        self.assertEqual(len({item.url for item in records}), 2)


class CompletenessTests(unittest.TestCase):
    def test_crossref_cursor_pagination_exceeds_40_and_preserves_newest_doi(self) -> None:
        first = [{"DOI": f"10.1000/{index}", "title": [f"Title {index}"], "published": {"date-parts": [[2026, 7, 29]]}, "URL": ""} for index in range(1000)]
        second = [{"DOI": "10.1000/newest", "title": ["Newest DOI"], "published": {"date-parts": [[2026, 7, 30]]}, "URL": ""}]
        payloads = [first, second]
        requested_urls = []

        def fake_fetch(_url: str, **_kwargs):
            requested_urls.append(_url)
            page = payloads.pop(0)
            cursor = "next" if len(page) == 1000 else ""
            return 200, _url, json.dumps({"message": {"items": page, "next-cursor": cursor}})

        with patch.object(collect_scientific_sources, "fetch", side_effect=fake_fetch):
            status, records, detail = collect_scientific_sources.collect_crossref_records("1234-5678")
        self.assertEqual(status, 200)
        self.assertEqual(len(records), 1001)
        self.assertIn("10.1000/newest", {item["doi"] for item in records})
        self.assertEqual(records[0]["doi"], "10.1000/newest")
        self.assertTrue(all("sort=" not in url and "order=" not in url for url in requested_urls))
        self.assertIn("complete 370-day window", detail)

    def test_sec_retains_all_in_window_8k_and_deduplicates_accessions(self) -> None:
        accessions = [f"0000000000-26-{index:06d}" for index in range(12)]
        recent = {
            "form": ["8-K"] * 13,
            "filingDate": ["2026-07-01"] * 13,
            "accessionNumber": accessions + [accessions[0]],
            "primaryDocument": [f"filing-{index}.htm" for index in range(13)],
        }
        competitor = {"id": "example", "name": "Example Corp", "cik": "0000000123"}
        with patch.object(collect_real_data, "COMPETITORS", [competitor]), patch.object(collect_real_data, "fetch_json", return_value={"name": "Example Corp", "filings": {"recent": recent}}), patch.object(collect_real_data.time, "sleep", return_value=None):
            signals = collect_real_data.collect_sec_signals()
        self.assertEqual(len(signals), 12)
        self.assertEqual(len({item["id"] for item in signals}), 12)


class CoverageIntegrityTests(unittest.TestCase):
    def test_known_retired_source_urls_are_migrated_before_collection(self) -> None:
        retired, current = next(iter(refresh_daily.KNOWN_SOURCE_URL_MIGRATIONS.items()))
        with tempfile.TemporaryDirectory() as directory:
            data_dir = Path(directory)
            artifact = data_dir / "source.json"
            artifact.write_text(json.dumps({"sourceUrl": retired}) + "\n", encoding="utf-8")
            with patch.object(refresh_daily, "DATA_DIR", data_dir):
                replacements = refresh_daily.migrate_known_source_urls()
            self.assertEqual(replacements, 1)
            self.assertEqual(json.loads(artifact.read_text(encoding="utf-8"))["sourceUrl"], current)

    def test_asgct_legacy_broken_download_is_omitted_when_live_issue_exists(self) -> None:
        page = """
        <a href="https://www.cell.com/molecular-therapy-family/molecular-therapy/fulltext/S1525-0016(26)00312-6">Download the 2026 Abstracts</a>
        <a href="https://download.asgct.org/2026ASGCTAbstractPublication.pdf">Download the Abstracts</a>
        """
        records = collect_scientific_sources.extract_conference_records("https://annualmeeting.asgct.org/", page, "asgct-2026")
        urls = {item["canonicalUrl"] for item in records}
        self.assertIn("https://www.cell.com/molecular-therapy-family/molecular-therapy/fulltext/S1525-0016(26)00312-6", urls)
        self.assertNotIn("https://download.asgct.org/2026ASGCTAbstractPublication.pdf", urls)

    def test_trade_feed_and_sitemap_parsers_preserve_exact_dated_records(self) -> None:
        rss = """<?xml version="1.0"?><rss><channel><item>
          <title>LC-MS method validation for regulated QC</title>
          <link>https://publisher.example/lc-ms-validation</link>
          <pubDate>Thu, 30 Jul 2026 12:00:00 GMT</pubDate>
        </item></channel></rss>"""
        sitemap = """<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url>
          <loc>https://publisher.example/hplc-column-selectivity-12345</loc>
          <lastmod>2026-07-29T10:00:00.000Z</lastmod>
        </url></urlset>"""
        rss_records = collect_scientific_sources.parse_rss_records(rss, "Trade record")
        sitemap_records = collect_scientific_sources.parse_sitemap_records(sitemap, "Trade record")
        self.assertEqual(rss_records[0]["date"], "2026-07-30")
        self.assertEqual(rss_records[0]["title"], "LC-MS method validation for regulated QC")
        self.assertEqual(sitemap_records[0]["date"], "2026-07-29")
        self.assertEqual(sitemap_records[0]["title"], "HPLC Column Selectivity")
        self.assertEqual(sitemap_records[0]["dateBasis"], "last_modified")

    def test_conference_endpoint_count_is_not_content_record_count(self) -> None:
        data = {"events": [{"id": "asms-2026", "eventName": "ASMS", "website": "https://example.com/asms", "publisher": "ASMS", "marketSegments": [], "monitoringUrls": ["https://example.com/asms"]}]}
        with patch.object(collect_scientific_sources, "fetch", return_value=(200, "https://example.com/asms", "<html><body>Home page</body></html>")):
            entries, events = collect_scientific_sources.collect_conferences(data)
        self.assertEqual(entries[0]["endpointReachabilityCount"], 1)
        self.assertEqual(entries[0]["extractedRecords"], 0)
        self.assertEqual(events[0]["contentRecordCount"], 0)

    def test_conference_transient_failure_retains_recent_verified_snapshot(self) -> None:
        today = date.today().isoformat()
        record = {"canonicalUrl": "https://example.com/program", "title": "Program"}
        data = {"events": [{
            "id": "imsis-2026",
            "eventName": "IMSIS",
            "website": "https://example.com/imsis",
            "publisher": "IMSIS",
            "marketSegments": [],
            "lastChecked": today,
            "collectionStatus": "extracted",
            "contentRecords": [record],
            "monitoredEndpoints": [{"url": "https://example.com/imsis", "status": 200}],
        }]}
        with patch.object(collect_scientific_sources, "fetch", return_value=(0, "https://example.com/imsis", "timeout")):
            entries, events = collect_scientific_sources.collect_conferences(data)
        self.assertEqual(events[0]["collectionStatus"], "extracted")
        self.assertEqual(events[0]["contentRecords"], [record])
        self.assertEqual(events[0]["lastAttemptStatus"], "unreachable")
        self.assertEqual(entries[0]["currentAttemptReachabilityCount"], 0)
        self.assertEqual(entries[0]["endpointReachabilityCount"], 1)

    def test_regulatory_http_200_alone_cannot_pass_content_freshness(self) -> None:
        with patch.object(collect_scientific_sources, "REGULATORY_SOURCES", ({"id": "reg", "source": "Reg", "publisher": "Official", "url": "https://example.com/reg", "marketSegments": [], "signalCoverage": [], "whatToMeasure": "", "whyItMatters": "", "documentIdentifier": "Missing document"},)), patch.object(collect_scientific_sources, "fetch", return_value=(200, "https://example.com/reg", "<html>reachable only</html>")):
            entry = collect_scientific_sources.collect_regulatory_sources()[0]
        self.assertTrue(entry["endpointReachable"])
        self.assertFalse(entry["contentVerified"])
        self.assertEqual(entry["extractedRecords"], 0)
        self.assertEqual(entry["health"], "review")

    def test_source_id_domain_and_type_are_reconciled(self) -> None:
        data = {"feedback": [{"sourceIds": ["chromforum-lc-discussions"], "sourceName": "Chromatography Forum", "sourceUrl": "https://reddit.com/r/labrats/comments/abc", "evidenceRecords": [{"url": "https://reddit.com/r/labrats/comments/abc", "sourceName": "Chromatography Forum", "sourceType": "community_forum"}]}]}
        repaired = collect_customer_voice.reconcile_source_identity(data)
        feedback = data["feedback"][0]
        self.assertGreater(repaired, 0)
        self.assertEqual(feedback["sourceIds"], ["reddit-lc-discussions"])
        self.assertEqual(feedback["evidenceRecords"][0]["sourceType"], "reddit")

    def test_failed_refresh_retains_last_validated_dataset(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            data_dir = root / "data"
            deploy_dir = root / "deploy" / "data"
            data_dir.mkdir(parents=True)
            intelligence = data_dir / "intelligence.json"
            status = data_dir / "refresh_status.json"
            intelligence.write_text('{"validated": true}\n', encoding="utf-8")
            secondary = data_dir / "secondary.json"
            secondary.write_text('{"validated": true}\n', encoding="utf-8")
            status.write_text('{"lastSuccessfulRefreshAt":"2026-07-29T00:00:00Z"}\n', encoding="utf-8")
            def failed_collector(*_args, **_kwargs):
                secondary.write_text('{"validated": false}\n', encoding="utf-8")
                raise RuntimeError("collector failed")
            with patch.object(refresh_daily, "DATA_DIR", data_dir), patch.object(refresh_daily, "DEPLOY_DATA_DIR", deploy_dir), patch.object(refresh_daily, "INTELLIGENCE_FILE", intelligence), patch.object(refresh_daily, "STATUS_FILE", status), patch.object(refresh_daily.subprocess, "run", side_effect=failed_collector):
                result = refresh_daily.main()
            self.assertEqual(result, 1)
            self.assertEqual(json.loads(intelligence.read_text(encoding="utf-8")), {"validated": True})
            self.assertEqual(json.loads(secondary.read_text(encoding="utf-8")), {"validated": True})
            self.assertEqual(json.loads(status.read_text(encoding="utf-8"))["status"], "failed")


if __name__ == "__main__":
    unittest.main()
