"""Guard the ranking against rewarding collection volume over evidence.

The scorer previously ranked the 157 records it classified ``unsupported`` above
the 12 it classified ``verified``.  Three mechanisms caused it: a crawl timestamp
earned recency, an unparseable date earned full recency, and corroboration
counted records in a theme rather than the organizations behind them.
"""

import json
import sys
import unittest
from datetime import date, timedelta
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import score  # noqa: E402


AS_OF = date(2026, 8, 27)


def signal(**overrides) -> dict:
    base = {
        "id": "sig-1",
        "date": "2026-08-20",
        "sourceDate": "2026-08-20",
        "sourceDateType": "publication",
        "title": "An LC-MS/MS method",
        "summary": "",
        "competitor": "Example",
        "sourceName": "Example",
        "sourceUrl": "https://example.org/a",
        "signalType": "Press release",
        "theme": "A theme",
        "evidenceStatus": "partial",
    }
    base.update(overrides)
    return base


class RecencyTests(unittest.TestCase):
    def test_ingestion_date_earns_no_recency(self):
        """A crawl timestamp says when we looked, not when anything happened."""
        crawled = score.recency(
            signal(sourceDateType="ingestion", date=AS_OF.isoformat(), sourceDate=AS_OF.isoformat()),
            AS_OF,
        )

        self.assertEqual(crawled["contribution"], 0.0)
        self.assertIsNone(crawled["ageDays"])
        self.assertIn("Observation date only", crawled["basis"])

    def test_publication_date_earns_recency(self):
        published = score.recency(signal(sourceDate=AS_OF.isoformat()), AS_OF)

        self.assertEqual(published["contribution"], float(score.RECENCY_MAX))
        self.assertEqual(published["ageDays"], 0)

    def test_unparseable_date_is_not_treated_as_today(self):
        undated = score.recency(signal(date="not a date", sourceDate=None), AS_OF)

        self.assertEqual(undated["contribution"], 0.0)
        self.assertIn("not established", undated["basis"])

    def test_a_crawled_page_never_out_scores_a_dated_release_on_recency(self):
        crawled = score.recency(
            signal(sourceDateType="ingestion", sourceDate=AS_OF.isoformat()), AS_OF
        )
        older_release = score.recency(
            signal(sourceDate=(AS_OF - timedelta(days=120)).isoformat()), AS_OF
        )

        self.assertGreater(older_release["contribution"], crawled["contribution"])

    def test_half_life_still_applies_to_event_dates(self):
        aged = score.recency(
            signal(sourceDate=(AS_OF - timedelta(days=score.RECENCY_HALF_LIFE_DAYS)).isoformat()),
            AS_OF,
        )

        self.assertAlmostEqual(aged["contribution"], score.RECENCY_MAX / 2, places=1)


class AuthorityTests(unittest.TestCase):
    def test_catalogue_page_scores_below_a_dated_announcement(self):
        page = score.source_authority(signal(
            signalType="Monitored product page",
            sourceUrl="https://www.shimadzu.com/an/products/lc/index.html",
        ))
        release = score.source_authority(signal(
            signalType="Press release",
            sourceUrl="https://www.shimadzu.com/news/2026/launch.html",
        ))

        self.assertLess(page["contribution"], release["contribution"])
        self.assertIn("catalogue page", page["basis"])

    def test_authority_comes_from_the_host_not_a_substring(self):
        """A blog whose URL contains 'press-release' is not an official source."""
        blog = score.source_authority(signal(
            signalType="Blog post",
            sourceName="Someone's newsletter",
            sourceUrl="https://blog.example.com/press-release-analysis",
        ))
        filing = score.source_authority(signal(
            signalType="SEC filing",
            sourceUrl="https://www.sec.gov/Archives/edgar/data/1/2/f.htm",
        ))

        self.assertLess(blog["contribution"], filing["contribution"])
        self.assertEqual(filing["contribution"], score.AUTHORITY_MAX)

    def test_forum_records_stay_low_but_real(self):
        forum = score.source_authority(signal(
            signalType="Discussion", sourceUrl="https://www.reddit.com/r/labrats/comments/x/",
        ))

        self.assertGreater(forum["contribution"], 0)
        self.assertLess(forum["contribution"], 10)


class CorroborationTests(unittest.TestCase):
    def score_theme(self, signals: list[dict]) -> list[dict]:
        data = {"asOfDate": AS_OF.isoformat(), "signals": signals}
        scored, _ = score.score_signals(data)
        return scored

    def test_one_vendors_volume_is_not_corroboration(self):
        """Two hundred pages from one vendor are one organization, not two hundred."""
        signals = [
            signal(id=f"s{index}", sourceUrl=f"https://www.shimadzu.com/p/{index}",
                   signalType="Monitored product page", theme="Portfolio monitoring coverage")
            for index in range(200)
        ]
        scored = self.score_theme(signals)
        corroboration = scored[0]["scoreBreakdown"]["corroboration"]

        self.assertEqual(corroboration["organizationCount"], 1)
        self.assertEqual(corroboration["contribution"], 0.0)

    def test_issuer_self_description_is_capped_below_independent_agreement(self):
        issuers = [
            signal(id=f"v{index}", theme="T", signalType="Press release",
                   sourceUrl=f"https://www.{host}/news/{index}")
            for index, host in enumerate(("shimadzu.com", "sciex.com", "agilent.com", "thermofisher.com"))
        ]
        independents = [
            signal(id=f"i{index}", theme="T", signalType="Press release",
                   sourceUrl=f"https://www.{host}/news/{index}")
            for index, host in enumerate(("chromatographyonline.com", "sepscience.com",
                                          "labmanager.com", "europeanpharmaceuticalreview.com"))
        ]

        issuer_only = self.score_theme(issuers)[0]["scoreBreakdown"]["corroboration"]
        independent = self.score_theme(independents)[0]["scoreBreakdown"]["corroboration"]

        self.assertEqual(issuer_only["independentOrganizations"], 0)
        self.assertLessEqual(issuer_only["contribution"], 7)
        self.assertGreater(independent["contribution"], issuer_only["contribution"])

    def test_pubmed_is_an_index_so_each_paper_is_its_own_author_group(self):
        papers = [
            signal(id=f"pubmed-{index}", theme="T", signalType="Scientific publication",
                   sourceUrl=f"https://pubmed.ncbi.nlm.nih.gov/{index}/")
            for index in range(8)
        ]
        corroboration = self.score_theme(papers)[0]["scoreBreakdown"]["corroboration"]

        self.assertEqual(corroboration["organizationCount"], 8)
        self.assertGreater(corroboration["contribution"], 0)

    def test_sec_is_a_registry_so_each_registrant_is_its_own_organization(self):
        filings = [
            signal(id=f"sec-{index}", theme="T", signalType="SEC filing", registrant=name,
                   sourceUrl=f"https://www.sec.gov/Archives/edgar/data/{index}/f.htm")
            for index, name in enumerate(("Agilent", "Thermo Fisher", "Danaher", "Revvity"))
        ]
        corroboration = self.score_theme(filings)[0]["scoreBreakdown"]["corroboration"]

        self.assertEqual(corroboration["organizationCount"], 4)
        # Each registrant is describing itself, so this is capped self-description.
        self.assertEqual(corroboration["independentOrganizations"], 0)
        self.assertLessEqual(corroboration["contribution"], 7)


class RelevanceTests(unittest.TestCase):
    def test_relevance_does_not_saturate_for_every_lc_record(self):
        narrow = score.lc_relevance(signal(title="A chromatography column note", summary=""))
        broad = score.lc_relevance(signal(
            title="LC-MS/MS UHPLC method on a new column",
            summary="Pump and Empower chromatography data system workflow",
        ))

        self.assertLess(narrow["contribution"], broad["contribution"])
        self.assertLess(narrow["contribution"], score.RELEVANCE_MAX)

    def test_non_lc_records_score_zero(self):
        self.assertEqual(
            score.lc_relevance(signal(title="A corporate donation", summary=""))["contribution"], 0
        )


class EvidenceOrderingTests(unittest.TestCase):
    def build(self, unsupported_score_high: bool) -> list[dict]:
        scored = []
        for index in range(5):
            scored.append({"evidenceStatus": "verified", "priorityScore": 80})
        for index in range(5):
            scored.append({
                "evidenceStatus": "unsupported",
                "priorityScore": 90 if unsupported_score_high else 30,
            })
        return scored

    def test_publish_is_blocked_when_unsupported_outranks_verified(self):
        with self.assertRaisesRegex(ValueError, "unsupported records outrank verified records"):
            score.assert_evidence_ordering(self.build(unsupported_score_high=True))

    def test_publish_proceeds_when_the_ordering_is_right(self):
        score.assert_evidence_ordering(self.build(unsupported_score_high=False))


class DiscriminationGateTests(unittest.TestCase):
    def test_identical_inputs_are_allowed_to_tie(self):
        """Indistinguishable records agreeing is the formula working, not failing."""
        identical = [{
            "priorityScore": 36,
            "scoreBreakdown": {
                "sourceAuthority": {"basis": "Issuer catalogue page observed in a sitemap"},
                "evidenceStrength": {"status": "unsupported"},
                "recency": {"ageDays": None},
                "lcRelevance": {"matchedTerms": ["LC/HPLC"]},
                "corroboration": {"organizationCount": 3},
            },
        } for _ in range(200)]
        distinct = [{
            "priorityScore": 40 + index,
            "scoreBreakdown": {
                "sourceAuthority": {"basis": f"basis-{index}"},
                "evidenceStrength": {"status": "partial"},
                "recency": {"ageDays": index},
                "lcRelevance": {"matchedTerms": ["LC-MS"]},
                "corroboration": {"organizationCount": 2},
            },
        } for index in range(10)]

        share, _score, _count, distinct_inputs = score.discrimination_share(identical + distinct)

        self.assertEqual(distinct_inputs, 11)
        self.assertLessEqual(share, score.MAX_SHARED_SCORE_RATIO)

    def test_a_formula_that_cannot_separate_differing_inputs_is_rejected(self):
        flat = [{
            "priorityScore": 50,
            "scoreBreakdown": {
                "sourceAuthority": {"basis": f"basis-{index}"},
                "evidenceStrength": {"status": "partial"},
                "recency": {"ageDays": index},
                "lcRelevance": {"matchedTerms": [f"term-{index}"]},
                "corroboration": {"organizationCount": index},
            },
        } for index in range(20)]

        share, _score, _count, distinct_inputs = score.discrimination_share(flat)

        self.assertEqual(distinct_inputs, 20)
        self.assertGreater(share, score.MAX_SHARED_SCORE_RATIO)


class ShippedRankingTests(unittest.TestCase):
    """The published dataset must not point readers at its weakest evidence."""

    def setUp(self) -> None:
        self.signals = json.loads(
            (ROOT / "data" / "intelligence.json").read_text(encoding="utf-8")
        )["signals"]

    def scores_for(self, status: str) -> list[int]:
        return [
            int(item["priorityScore"]) for item in self.signals
            if item.get("evidenceStatus") == status
        ]

    def test_no_unsupported_record_is_ranked_high(self):
        high = [
            item for item in self.signals
            if item.get("evidenceStatus") == "unsupported" and item.get("tier") == "High"
        ]
        self.assertEqual(high, [])

    def test_verified_records_outrank_unsupported_ones(self):
        verified, unsupported = self.scores_for("verified"), self.scores_for("unsupported")
        self.assertTrue(verified and unsupported)
        self.assertGreater(min(verified), max(unsupported))

    def test_crawl_dated_records_carry_no_recency(self):
        for item in self.signals:
            if item.get("sourceDateType") == "ingestion":
                with self.subTest(signal=item.get("id")):
                    self.assertEqual(
                        item["scoreBreakdown"]["recency"]["contribution"], 0.0
                    )


if __name__ == "__main__":
    unittest.main()
