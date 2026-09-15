"""Guard the refresh job's ability to notice that a tracked link changed.

Each class covers one defect that let a real link update pass unreported:

1. A permanent redirect was observed on every run and discarded, so vendor
   product retirements and successors were never surfaced.
2. Product-change signals were filtered on a ``changeEvidence`` field no
   collector produced, so every sitemap addition, removal, and last-modified
   change was silently dropped.
3. Thousands of URLs the dashboard renders were never submitted to the link
   check, because the walk was non-recursive and skipped bulk record keys.
4. Press indexes were read one page deep, for the current year only, and an
   empty index failed the whole refresh.
5. ``SKIP_LINK_CHECK=1`` promoted an unreachable required source to verified.
"""

import json
import sys
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import check_links  # noqa: E402
import collect_competitors  # noqa: E402
import link_changes  # noqa: E402
import refresh_daily  # noqa: E402
from provenance import valid_change_evidence  # noqa: E402


SCIEX = "https://sciex.com/products/mass-spectrometers"


class RedirectClassificationTests(unittest.TestCase):
    """Issue 1: tell a page that moved apart from one that merely reformatted."""

    def assert_kind(self, requested, final, expected):
        kind, reason = link_changes.classify_redirect(requested, final)
        self.assertEqual(kind, expected, f"{requested} -> {final} ({reason})")
        return reason

    def test_locale_prefix_is_presentation_only(self):
        self.assert_kind(
            "https://www.perkinelmer.com/be/corporate-and-newsroom/project-farma-acquires-simotech",
            "https://www.perkinelmer.com/corporate-and-newsroom/project-farma-acquires-simotech",
            link_changes.REDIRECT_NORMALIZED,
        )

    def test_scheme_www_and_trailing_slash_are_presentation_only(self):
        for final in (
            "https://www.example.org/a/b",
            "https://example.org/a/b/",
            "https://example.org/a/b/index.html",
            "https://example.org/a/b?utm_source=news",
        ):
            with self.subTest(final=final):
                kind, _ = link_changes.classify_redirect("http://example.org/a/b", final)
                self.assertIn(kind, {link_changes.REDIRECT_NORMALIZED, link_changes.REDIRECT_SAME})

    def test_vendor_product_succession_is_a_move(self):
        reason = self.assert_kind(
            f"{SCIEX}/qtof-systems/tripletof-systems/tripletof-6600-system",
            f"{SCIEX}/qtof-systems/zenotof-7600-system",
            link_changes.REDIRECT_MOVED,
        )
        self.assertIn("zenotof-7600-system", reason)

    def test_withdrawal_to_a_parent_section_is_a_move(self):
        reason = self.assert_kind(
            f"{SCIEX}/qtof-systems/tripletof-systems",
            f"{SCIEX}/qtof-systems",
            link_changes.REDIRECT_MOVED,
        )
        self.assertIn("parent section", reason)

    def test_tracking_parameter_does_not_hide_a_real_move(self):
        """The Shimadzu PFAS page moved and appended ?from=mpeb; the move still shows."""
        base = "https://www.shimadzu.com/an/products/liquid-chromatograph-mass-spectrometry/lc-ms-system"
        self.assert_kind(
            f"{base}/lcmsms-method-package-for-pfas/index.html",
            f"{base}/lcmsms-pfas-database/index.html?from=mpeb",
            link_changes.REDIRECT_MOVED,
        )

    def test_doi_resolution_is_not_a_link_update(self):
        self.assert_kind(
            "https://doi.org/10.1016/s0039-9140(26)00637-5",
            "https://linkinghub.elsevier.com/retrieve/pii/S0039914026006375",
            link_changes.REDIRECT_RESOLVED,
        )

    def test_a_new_domain_is_reported_as_offsite(self):
        self.assert_kind(
            "https://www.example.org/a", "https://acquired.test/a", link_changes.REDIRECT_OFFSITE
        )

    def test_landing_on_an_error_page_is_a_mislink_not_a_move(self):
        for destination in (
            "https://www.asms.org/error404",
            "https://x.org/custom404",
            "https://x.org/a/page-not-found",
            "https://x.org/login",
        ):
            with self.subTest(destination=destination):
                status, _ = check_links.semantic_redirect_status("https://x.org/a/b", destination)
                self.assertEqual(status, "mislink")

    def test_an_ordinary_page_is_not_mistaken_for_an_error_page(self):
        status, _ = check_links.semantic_redirect_status(
            "https://x.org/a/b", "https://x.org/guides/errorless-workflow"
        )
        self.assertIsNone(status)

    def test_only_a_successful_request_yields_a_redirect_verdict(self):
        """A bot challenge served from a login page says nothing about the target."""
        with patch.object(check_links.requests, "get", side_effect=check_links.requests.Timeout()):
            result = check_links.check_url("https://x.org/a")
        self.assertEqual(result["status"], "blocked")
        self.assertEqual(result["redirectKind"], link_changes.REDIRECT_SAME)


class RedirectWriteBackTests(unittest.TestCase):
    """Issue 1: presentation-only moves are applied; real moves are reported."""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(lambda: __import__("shutil").rmtree(self.tmp, ignore_errors=True))
        self.data = self.tmp / "data"
        (self.data / "source_snapshots").mkdir(parents=True)
        self.patches = [
            patch.object(check_links, "ROOT", self.tmp),
            patch.object(check_links, "DATA_DIR", self.data),
            patch.object(check_links, "OUTPUT_FILE", self.data / "link_health.json"),
            patch.object(check_links, "REDIRECT_FILE", self.data / "link_redirects.json"),
        ]
        for item in self.patches:
            item.start()
            self.addCleanup(item.stop)

    def test_presentation_only_move_rewrites_every_stored_reference(self):
        stale = "https://www.perkinelmer.com/be/newsroom/story"
        served = "https://www.perkinelmer.com/newsroom/story"
        (self.data / "intelligence.json").write_text(json.dumps({
            "signals": [{"id": "a", "sourceUrl": stale}, {"id": "b", "sourceUrl": stale}],
            "notes": [f"See {stale} for detail"],
        }))
        rewritten = check_links.apply_url_replacements({stale: served})

        self.assertEqual(rewritten, 2)  # the two exact-match fields, not the prose
        written = json.loads((self.data / "intelligence.json").read_text())
        self.assertTrue(all(s["sourceUrl"] == served for s in written["signals"]))

    def test_sitemap_snapshots_are_never_rewritten(self):
        """The diff baseline must mirror what the source listed, verbatim.

        Canonicalising a snapshot key would make the next run report the original
        URL as newly added and the rewritten one as missing.
        """
        stale = "https://vendor.test/be/products/a"
        served = "https://vendor.test/products/a"
        snapshot = self.data / "source_snapshots" / "vendor.json"
        snapshot.write_text(json.dumps({"products": {stale: "2026-01-01"}}))
        (self.data / "intelligence.json").write_text(
            json.dumps({"signals": [{"id": "a", "sourceUrl": stale}]})
        )

        check_links.apply_url_replacements({stale: served})

        self.assertIn(stale, json.loads(snapshot.read_text())["products"])
        self.assertEqual(
            json.loads((self.data / "intelligence.json").read_text())["signals"][0]["sourceUrl"],
            served,
        )

    def test_a_real_move_is_reported_and_never_silently_followed(self):
        results = [{
            "url": f"{SCIEX}/qtof-systems/tripletof-systems/tripletof-6600-system",
            "finalUrl": f"{SCIEX}/qtof-systems/zenotof-7600-system",
            "status": "ok", "httpStatus": 200, "checkedAt": "2026-09-12T00:00:00+00:00",
            "redirectKind": link_changes.REDIRECT_MOVED, "redirectReason": "now serves zenotof",
        }]
        report = check_links.write_redirect_report(results)

        self.assertEqual(len(report["movedLinks"]), 1)
        self.assertEqual(report["counts"][link_changes.REDIRECT_MOVED], 1)
        # A moved link is not a rewrite candidate.
        self.assertEqual(check_links.apply_url_replacements({}), 0)


class LinkCheckCoverageTests(unittest.TestCase):
    """Issue 3: everything the dashboard can surface reaches the checker."""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(lambda: __import__("shutil").rmtree(self.tmp, ignore_errors=True))
        self.data = self.tmp / "data"
        (self.data / "source_snapshots").mkdir(parents=True)
        for item in (
            patch.object(check_links, "ROOT", self.tmp),
            patch.object(check_links, "DATA_DIR", self.data),
            patch.object(check_links, "OUTPUT_FILE", self.data / "link_health.json"),
            patch.object(check_links, "REDIRECT_FILE", self.data / "link_redirects.json"),
        ):
            item.start()
            self.addCleanup(item.stop)

    def test_nested_directories_are_walked(self):
        (self.data / "top.json").write_text(json.dumps({"u": "https://a.test/top"}))
        (self.data / "source_snapshots" / "sciex.json").write_text(
            json.dumps({"products": {"https://a.test/nested": "2026-01-01"}})
        )
        urls = check_links.collect_urls(day_index=0)
        self.assertIn("https://a.test/nested", urls)
        self.assertIn("https://a.test/top", urls)

    def test_bulk_records_are_sampled_rather_than_skipped(self):
        bulk = [{"sourceUrl": f"https://journal.test/{i}"} for i in range(280)]
        (self.data / "journal_sources.json").write_text(
            json.dumps({"sources": [{"id": "j", "recentRecords": bulk}]})
        )
        seen = set()
        for day in range(link_changes and check_links.BULK_ROTATION_DAYS):
            seen.update(check_links.collect_urls(day_index=day))
        self.assertEqual(len(seen), 280, "every bulk record must be covered within one rotation")

    def test_a_single_day_checks_only_its_share_of_the_bulk_set(self):
        bulk = [{"sourceUrl": f"https://journal.test/{i}"} for i in range(280)]
        (self.data / "journal_sources.json").write_text(
            json.dumps({"sources": [{"id": "j", "recentRecords": bulk}]})
        )
        today = check_links.collect_urls(day_index=3)
        self.assertLess(len(today), 280)
        self.assertGreater(len(today), 0)

    def test_bucketing_is_stable_as_the_collection_grows(self):
        """A URL keeps its slot when neighbours are added, so coverage stays even."""
        small = {f"https://journal.test/{i}" for i in range(50)}
        large = small | {f"https://journal.test/{i}" for i in range(50, 400)}
        for day in (0, 5, 13):
            with self.subTest(day=day):
                before = check_links.rotating_slice(small, day) & small
                after = check_links.rotating_slice(large, day) & small
                self.assertEqual(before, after)


class ChangeEvidenceTests(unittest.TestCase):
    """Issue 2: sitemap observations become evidence the publish gate accepts."""

    def build(self, pages, baseline_products, baseline_hashes, current_products):
        tmp = Path(tempfile.mkdtemp())
        self.addCleanup(lambda: __import__("shutil").rmtree(tmp, ignore_errors=True))
        (tmp / "demo.json").write_text(json.dumps({
            "initialized": True,
            "products": baseline_products,
            "productContentHashes": baseline_hashes,
            "productMetadata": {}, "pressReleases": {}, "monitoredFamilies": [],
        }))
        fetch = lambda url, timeout=60: (*pages.get(url, (None, "")), url)
        with patch.object(collect_competitors, "SNAPSHOT_DIR", tmp), \
             patch.object(collect_competitors, "fetch", fetch):
            return collect_competitors.monitor_delta("demo", current_products, {}, [])

    def test_an_added_page_produces_gate_valid_evidence(self):
        out = self.build(
            {"https://v.test/new": (200, "<html><h1>New system</h1></html>")},
            {}, {}, {"https://v.test/new": "2026-09-12"},
        )
        self.assertEqual(len(out["new_products"]), 1)
        evidence = out["new_products"][0]["changeEvidence"]
        self.assertTrue(valid_change_evidence(evidence))
        self.assertIn("sitemapMembership", evidence["changedFields"])

    def test_an_added_page_that_cannot_be_read_claims_nothing(self):
        out = self.build(
            {"https://v.test/new": (403, "")}, {}, {}, {"https://v.test/new": "2026-09-12"},
        )
        self.assertEqual(out["new_products"], [])
        self.assertEqual(len(out["unverified_inventory_changes"]["new"]), 1)

    def test_a_removed_page_confirmed_gone_produces_evidence(self):
        out = self.build(
            {"https://v.test/old": (404, "not found")},
            {"https://v.test/old": "2026-01-01"},
            {"https://v.test/old": {"hash": "OLD", "observedAt": "2026-01-01T00:00:00Z"}},
            {},
        )
        self.assertEqual(len(out["discontinued_products"]), 1)
        evidence = out["discontinued_products"][0]["changeEvidence"]
        self.assertTrue(valid_change_evidence(evidence))
        self.assertEqual(evidence["currentContentHash"], "")
        self.assertIn("404", evidence["exactDiff"])

    def test_a_delisted_page_that_still_serves_content_is_not_called_gone(self):
        out = self.build(
            {"https://v.test/old": (200, "<html>Still here, unchanged</html>")},
            {"https://v.test/old": "2026-01-01"},
            {"https://v.test/old": {"hash": link_changes.content_fingerprint(
                "<html>Still here, unchanged</html>"), "observedAt": "2026-01-01T00:00:00Z"}},
            {},
        )
        self.assertEqual(out["discontinued_products"], [])
        withheld = out["unverified_inventory_changes"]["withheldForMissingEvidence"]
        self.assertEqual(len(withheld["discontinued_products"]), 1)

    def test_a_lastmod_bump_without_a_content_change_is_not_a_signal(self):
        page = "<html><h1>Unchanged</h1></html>"
        out = self.build(
            {"https://v.test/a": (200, page)},
            {"https://v.test/a": "2026-01-01"},
            {"https://v.test/a": {"hash": link_changes.content_fingerprint(page),
                                  "observedAt": "2026-01-01T00:00:00Z", "text": "Unchanged"}},
            {"https://v.test/a": "2026-09-12"},
        )
        self.assertEqual(out["updated_products"], [])

    def test_a_lastmod_bump_with_a_content_change_is_a_signal(self):
        out = self.build(
            {"https://v.test/a": (200, "<html><h1>Now with Zeno trap</h1></html>")},
            {"https://v.test/a": "2026-01-01"},
            {"https://v.test/a": {"hash": "OLD", "observedAt": "2026-01-01T00:00:00Z",
                                  "text": "Standard trap"}},
            {"https://v.test/a": "2026-09-12"},
        )
        self.assertEqual(len(out["updated_products"]), 1)
        evidence = out["updated_products"][0]["changeEvidence"]
        self.assertTrue(valid_change_evidence(evidence))
        self.assertIn("Zeno", evidence["exactDiff"])

    def test_content_hashes_are_persisted_for_the_next_comparison(self):
        out = self.build(
            {"https://v.test/new": (200, "<html>A</html>")}, {}, {},
            {"https://v.test/new": "2026-09-12"},
        )
        self.assertGreaterEqual(out["unverified_inventory_changes"]["contentBaselineCoverage"]["hashed"], 1)

    def test_the_request_budget_is_respected(self):
        pages = {f"https://v.test/p{i}": (200, f"<html>{i}</html>") for i in range(200)}
        with patch.object(collect_competitors, "PAGE_DIFF_BUDGET", 5), \
             patch.object(collect_competitors, "BASELINE_WARM_BUDGET", 0):
            out = self.build(pages, {}, {}, {url: "2026-09-12" for url in pages})
        self.assertLessEqual(out["unverified_inventory_changes"]["pageDiffRequests"], 5)
        self.assertLessEqual(len(out["new_products"]), 5)

    def test_volatile_markup_does_not_read_as_a_content_change(self):
        first = '<html><meta name="csrf" content="abc123def456"><p>Body</p><span>1757700000</span></html>'
        second = '<html><meta name="csrf" content="zzz999yyy888"><p>Body</p><span>1757786400</span></html>'
        self.assertEqual(
            link_changes.content_fingerprint(first), link_changes.content_fingerprint(second)
        )

    def test_a_real_body_change_does_read_as_a_content_change(self):
        self.assertNotEqual(
            link_changes.content_fingerprint("<html><p>Body</p></html>"),
            link_changes.content_fingerprint("<html><p>Body and more</p></html>"),
        )


class PressIndexTests(unittest.TestCase):
    """Issue 4: read every in-scope year, follow pagination, survive January."""

    def test_the_replay_window_pulls_in_the_previous_year(self):
        january = date(2027, 1, 5)
        self.assertEqual(collect_competitors.press_index_years(january), [2027, 2026])

    def test_mid_year_needs_only_the_current_year(self):
        self.assertEqual(collect_competitors.press_index_years(date(2026, 9, 12)), [2026])

    def test_the_year_set_follows_the_replay_window_exactly(self):
        window = collect_competitors.RECENT_RELEASE_REPLAY_DAYS
        today = date(2027, 1, 1) + timedelta(days=window)
        self.assertEqual(collect_competitors.press_index_years(today), [2027])
        self.assertEqual(
            collect_competitors.press_index_years(today - timedelta(days=1)), [2027, 2026]
        )

    def test_parsers_accept_any_year_not_just_the_current_one(self):
        body = (
            '<li class="updateInformation-list-item">'
            '<span class="updateInformation-list-item-date">December 20, 2026</span>'
            '<p class="updateInformation-list-item-main-text">A December LC-MS release</p>'
            '<a href="/news/2026/a-december-release.html">x</a>'
        )
        releases, entries = collect_competitors.parse_shimadzu_releases(body)
        self.assertEqual(entries, 1)
        self.assertEqual(len(releases), 1)

    def test_pagination_links_are_followed(self):
        pages = {
            "https://v.test/news/2026": '<a href="?page=2">2</a><a rel="next" href="?page=2">n</a>',
            "https://v.test/news/2026?page=2": '<a href="?page=3">3</a>',
            "https://v.test/news/2026?page=3": "<p>end</p>",
        }
        fetched = []

        def fake_fetch(url, timeout=60):
            fetched.append(url)
            return (200, pages.get(url, ""), url) if url in pages else (404, "", url)

        with patch.object(collect_competitors, "fetch", fake_fetch):
            status, releases, entries, visited = collect_competitors.collect_press_index(
                lambda year: "https://v.test/news/2026", lambda body: ({}, 0), [2026],
            )
        self.assertEqual(status, 200)
        self.assertEqual(set(visited), set(pages))

    def test_pagination_is_bounded(self):
        def fake_fetch(url, timeout=60):
            # An index that always advertises another page must not loop forever.
            page = int(url.rsplit("=", 1)[-1]) if "=" in url else 1
            return 200, f'<a href="?page={page + 1}">next</a>', url

        with patch.object(collect_competitors, "fetch", fake_fetch):
            _s, _r, _e, visited = collect_competitors.collect_press_index(
                lambda year: "https://v.test/news", lambda body: ({}, 0), [2026], max_pages=4,
            )
        self.assertLessEqual(len(visited), 4)

    def test_offsite_pagination_links_are_not_followed(self):
        with patch.object(collect_competitors, "fetch",
                          lambda url, timeout=60: (200, '<a href="https://elsewhere.test/?page=2">x</a>', url)):
            _s, _r, _e, visited = collect_competitors.collect_press_index(
                lambda year: "https://v.test/news", lambda body: ({}, 0), [2026],
            )
        self.assertEqual(visited, ["https://v.test/news"])

    def test_a_readable_but_empty_index_is_not_a_failure(self):
        status, reason = collect_competitors.press_extraction_status(200, entries=14, releases=0)
        self.assertEqual(status, "checked_empty")
        self.assertIn("none of which", reason)

    def test_an_index_with_no_parseable_entries_is_still_a_failure(self):
        """A site redesign that breaks the parser must not read as 'nothing new'."""
        status, reason = collect_competitors.press_extraction_status(200, entries=0, releases=0)
        self.assertEqual(status, "blocked")
        self.assertIn("layout", reason)

    def test_an_unreachable_index_is_a_failure(self):
        self.assertEqual(collect_competitors.press_extraction_status(503, 0, 0)[0], "blocked")

    def test_records_found_report_extracted(self):
        self.assertEqual(collect_competitors.press_extraction_status(200, 14, 3)[0], "extracted")


class PublishGateTests(unittest.TestCase):
    """Issue 4, downstream: January must not fail the whole refresh."""

    def monitor(self, news_outcome, sitemap_outcome="extracted"):
        def status(source_id, outcome):
            return {"sourceId": source_id, "extractionStatus": outcome}
        fields = {
            "new_products": [], "discontinued_products": [], "updated_products": [],
            "new_press_releases": [], "recent_press_releases": [], "new_technical_insights": [],
        }
        return {"competitors": {
            "Thermo Fisher": {**fields, "source_status": [
                status("thermo-products", sitemap_outcome), status("thermo-ms-products", sitemap_outcome),
                status("thermo-news", news_outcome)]},
            "Shimadzu": {**fields, "source_status": [
                status("shimadzu-lcms", sitemap_outcome), status("shimadzu-news", news_outcome)]},
            "SCIEX": {**fields, "source_status": [
                status("sciex-products", sitemap_outcome), status("sciex-news", news_outcome)]},
        }}

    def test_an_empty_but_readable_press_index_publishes(self):
        refresh_daily.validate_competitor_monitor(self.monitor("checked_empty"))

    def test_a_broken_press_index_still_blocks(self):
        with self.assertRaisesRegex(ValueError, "critical source refresh incomplete"):
            refresh_daily.validate_competitor_monitor(self.monitor("blocked"))

    def test_an_empty_product_sitemap_still_blocks(self):
        """A product sitemap is never legitimately empty, so it keeps the stricter rule."""
        with self.assertRaisesRegex(ValueError, "critical source refresh incomplete"):
            refresh_daily.validate_competitor_monitor(
                self.monitor("extracted", sitemap_outcome="checked_empty")
            )

    def test_a_healthy_monitor_publishes(self):
        refresh_daily.validate_competitor_monitor(self.monitor("extracted"))


class SkipLinkCheckTests(unittest.TestCase):
    """Issue 5: skipping the recheck must not manufacture a verification."""

    def ledger_row(self, required, skip):
        catalog = {"sources": [{
            "id": "conference-demo", "url": "https://conf.test/", "sourceClass": "Conference/poster",
            "required": required, "extractedRecords": 0, "endpointReachable": False,
            "extractionStatus": "unreachable", "contentVerified": False,
        }]}
        prior = {"sources": [{
            "sourceId": "conference-demo", "url": "https://conf.test/",
            "succeededAt": "2026-08-01T00:00:00Z", "state": "CURRENT",
        }]}
        env = {"SKIP_LINK_CHECK": "1"} if skip else {}
        with patch.object(refresh_daily, "read_json", side_effect=lambda path, default=None: (
            catalog if "source_catalog" in str(path)
            else prior if "source_health" in str(path)
            else (default if default is not None else {})
        )), patch.dict("os.environ", env, clear=False):
            if not skip:
                __import__("os").environ.pop("SKIP_LINK_CHECK", None)
            rows = refresh_daily._source_health_from_artifacts(
                {"signals": [], "trends": {}}, "2026-09-12T00:00:00Z"
            )
        return next(r for r in rows if r.sourceId == "conference-demo")

    def test_a_required_unreachable_source_is_never_promoted(self):
        row = self.ledger_row(required=True, skip=True)
        self.assertNotEqual(row.state, "CURRENT")
        self.assertEqual(row.completeness, "unverified")

    def test_an_optional_source_is_retained_but_still_marked_unverified(self):
        row = self.ledger_row(required=False, skip=True)
        self.assertNotEqual(row.state, "CURRENT")
        self.assertEqual(row.coverage, "unverified")


class RequiredSourceTests(unittest.TestCase):
    """Which sources may block publication.

    ACS publishes its programme through an event platform with no machine-readable
    public page, so those sources are monitored for context but do not gate the
    refresh. They stay visible in the ledger rather than being promoted.
    """

    def test_an_explicit_catalog_value_always_wins(self):
        self.assertFalse(refresh_daily.conference_source_is_required(
            {"id": "conference-acs-spring-2026", "required": False}))
        self.assertTrue(refresh_daily.conference_source_is_required(
            {"id": "conference-acs-spring-2026", "required": True}))

    def test_a_future_acs_event_inherits_the_optional_default(self):
        """Next year's id must not silently reinstate the block."""
        for event_id in ("conference-acs-spring-2027", "conference-acs-fall-2030"):
            with self.subTest(event_id=event_id):
                self.assertFalse(refresh_daily.conference_source_is_required({"id": event_id}))

    def test_other_conferences_still_default_to_required(self):
        for event_id in ("conference-asms-2026", "conference-hplc-2027", "conference-msacl-2026"):
            with self.subTest(event_id=event_id):
                self.assertTrue(refresh_daily.conference_source_is_required({"id": event_id}))

    def test_the_shipped_catalog_marks_the_acs_sources_optional(self):
        catalog = json.loads((ROOT / "data" / "source_catalog.json").read_text(encoding="utf-8"))
        acs = [s for s in catalog["sources"] if str(s.get("id", "")).startswith("conference-acs-")]
        self.assertTrue(acs)
        for source in acs:
            with self.subTest(source=source["id"]):
                self.assertIs(source.get("required"), False)
                self.assertTrue(source.get("requiredRationale"))

    def test_the_shipped_ledger_has_no_required_blockers(self):
        intel = json.loads((ROOT / "data" / "intelligence.json").read_text(encoding="utf-8"))
        rows = refresh_daily._source_health_from_artifacts(intel, "2026-09-12T00:00:00Z")
        blockers = [r.sourceId for r in rows if r.required and r.state != "CURRENT"]
        self.assertEqual(blockers, [])

    def test_an_unreachable_optional_source_stays_visible_as_failing(self):
        """Non-required must mean 'does not block', never 'reported as healthy'."""
        intel = json.loads((ROOT / "data" / "intelligence.json").read_text(encoding="utf-8"))
        rows = {r.sourceId: r for r in
                refresh_daily._source_health_from_artifacts(intel, "2026-09-12T00:00:00Z")}
        for source_id in ("conference-acs-spring-2026", "conference-acs-fall-2026"):
            with self.subTest(source_id=source_id):
                row = rows[source_id]
                self.assertFalse(row.required)
                self.assertNotEqual(row.state, "CURRENT")


class RedirectMergeTests(unittest.TestCase):
    """Issue 1, downstream: a moved citation becomes a reviewable signal."""

    def dataset(self):
        return {"signals": [{
            "id": "sciex-monitored-1",
            "date": "2026-07-23",
            "competitor": "SCIEX",
            "signalType": "Monitored product page",
            "title": "SCIEX official product page observed",
            "sourceName": "SCIEX official product sitemap",
            "sourceUrl": f"{SCIEX}/qtof-systems/tripletof-systems/tripletof-6600-system",
            "technology": "LC-MS", "marketSegment": "Pharma", "geography": "Global",
        }]}

    def report(self, **overrides):
        entry = {
            "url": f"{SCIEX}/qtof-systems/tripletof-systems/tripletof-6600-system",
            "finalUrl": f"{SCIEX}/qtof-systems/zenotof-7600-system",
            "redirectKind": link_changes.REDIRECT_MOVED,
            "reason": "now serves zenotof-7600-system",
            "httpStatus": 200, "observedAt": "2026-09-12T00:00:00+00:00",
        }
        entry.update(overrides)
        return {"movedLinks": [entry]}

    def test_a_moved_product_page_becomes_a_signal(self):
        data = self.dataset()
        self.assertEqual(refresh_daily.merge_link_redirects(data, self.report()), 1)
        signal = data["signals"][-1]
        self.assertEqual(signal["signalType"], "Source page redirected")
        self.assertIn("Zenotof 7600 System", signal["title"])
        self.assertEqual(signal["previousSourceUrl"], self.dataset()["signals"][0]["sourceUrl"])
        self.assertEqual(signal["competitor"], "SCIEX")
        # A detected change is dated evidence: the observation bounds when the
        # redirect appeared, unlike a bare "this URL exists" inventory record.
        self.assertEqual(signal["sourceDateType"], "change_detection")

    def test_the_merge_is_idempotent(self):
        data = self.dataset()
        refresh_daily.merge_link_redirects(data, self.report())
        self.assertEqual(refresh_daily.merge_link_redirects(data, self.report()), 0)

    def test_a_redirect_nothing_cites_is_not_published(self):
        data = self.dataset()
        added = refresh_daily.merge_link_redirects(
            data, self.report(url="https://unrelated.test/a", finalUrl="https://unrelated.test/b")
        )
        self.assertEqual(added, 0)

    def test_an_offsite_move_is_described_as_a_domain_change(self):
        data = self.dataset()
        refresh_daily.merge_link_redirects(data, self.report(
            finalUrl="https://acquired.test/product", redirectKind=link_changes.REDIRECT_OFFSITE,
        ))
        self.assertIn("different domain", data["signals"][-1]["summary"])

    def test_an_empty_report_changes_nothing(self):
        data = self.dataset()
        self.assertEqual(refresh_daily.merge_link_redirects(data, {}), 0)
        self.assertEqual(len(data["signals"]), 1)

    def test_directory_style_urls_are_named_by_their_product_segment(self):
        base = "https://www.shimadzu.com/an/products/lc-ms-system"
        self.assertEqual(
            refresh_daily.product_name(f"{base}/lcmsms-pfas-database/index.html?from=mpeb"),
            "Lcmsms Pfas Database",
        )


class ChangeDetectionScoringTests(unittest.TestCase):
    """A detected change is dated; an inventory observation is not."""

    def setUp(self):
        import score
        self.score = score
        self.as_of = date(2026, 9, 12)

    def signal(self, **overrides):
        base = {
            "id": "s", "date": "2026-09-12", "sourceDate": "2026-09-12",
            "sourceDateType": "change_detection",
            "title": "SCIEX TripleTOF 6600 page now redirects to ZenoTOF 7600",
            "summary": "LC-MS product page redirect",
            "signalType": "Source page redirected",
            "sourceUrl": f"{SCIEX}/qtof-systems/zenotof-7600-system",
            "theme": "Portfolio lifecycle change", "evidenceStatus": "partial",
        }
        base.update(overrides)
        return base

    def test_a_detected_change_earns_recency(self):
        part = self.score.recency(self.signal(), self.as_of)
        self.assertEqual(part["contribution"], float(self.score.RECENCY_MAX))
        self.assertIn("bounded by the previous check", part["basis"])

    def test_an_inventory_observation_still_earns_none(self):
        part = self.score.recency(self.signal(sourceDateType="ingestion"), self.as_of)
        self.assertEqual(part["contribution"], 0.0)

    def test_a_detected_change_decays_like_any_event(self):
        stale = self.signal(sourceDate="2026-03-16", date="2026-03-16")
        self.assertLess(
            self.score.recency(stale, self.as_of)["contribution"], self.score.RECENCY_MAX / 1.5
        )

    def test_a_vendor_redirect_carries_announcement_authority(self):
        part = self.score.source_authority(self.signal())
        self.assertGreaterEqual(part["contribution"], 20)
        self.assertIn("announcement", part["basis"].lower())

    def test_a_redirect_outranks_the_inventory_record_it_replaces(self):
        redirect = self.signal()
        inventory = self.signal(
            signalType="Monitored product page", sourceDateType="ingestion",
            evidenceStatus="unsupported",
        )
        data = {"asOfDate": self.as_of.isoformat(), "signals": [redirect, inventory]}
        scored, _ = self.score.score_signals(data)
        self.assertGreater(scored[0]["priorityScore"], scored[1]["priorityScore"])

    def test_the_new_date_type_is_registered_in_the_provenance_contract(self):
        from provenance import DATE_TYPES
        self.assertIn("change_detection", DATE_TYPES)


class ShippedDataTests(unittest.TestCase):
    """The redirects visible in today's published data are the ones to catch."""

    def test_known_product_successions_classify_as_moves(self):
        health = json.loads((ROOT / "data" / "link_health.json").read_text(encoding="utf-8"))
        moved = 0
        for row in health:
            if row.get("status") != "ok" or not row.get("finalUrl"):
                continue
            kind, _ = link_changes.classify_redirect(row["url"], row["finalUrl"])
            if kind in {link_changes.REDIRECT_MOVED, link_changes.REDIRECT_OFFSITE}:
                moved += 1
        # The 9 September dataset carries a known set of vendor product moves.
        # If this drops to zero the detector has stopped working.
        self.assertGreater(moved, 0)

    def test_sciex_product_successions_are_detected_in_the_published_dataset(self):
        health = {r["url"]: r for r in json.loads(
            (ROOT / "data" / "link_health.json").read_text(encoding="utf-8"))}
        succession = f"{SCIEX}/qtof-systems/tripletof-systems/tripletof-6600-system"
        row = health.get(succession)
        if row is None or not row.get("finalUrl"):
            self.skipTest("the TripleTOF 6600 page is no longer in the published dataset")
        kind, _ = link_changes.classify_redirect(succession, row["finalUrl"])
        self.assertEqual(kind, link_changes.REDIRECT_MOVED)


if __name__ == "__main__":
    unittest.main()
