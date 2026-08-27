import copy
import sys
import unittest
from datetime import date, datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import check_links  # noqa: E402
import collect_scientific_sources  # noqa: E402
import refresh_daily  # noqa: E402


class DailyRefreshResilienceTests(unittest.TestCase):
    def test_domain_wide_runner_anomaly_can_continue_across_days(self):
        urls = [f"https://www.fda.gov/example-{index}" for index in range(5)]
        current = [
            {"url": url, "httpStatus": 404, "status": "dead", "reason": ""}
            for url in urls
        ]
        previous = [
            {
                "url": url,
                "httpStatus": 404,
                "status": "blocked",
                "reason": f"{check_links.DOMAIN_WIDE_404_REASON_PREFIX} prior run",
            }
            for url in urls
        ]

        changed = check_links.reclassify_domain_wide_404_anomalies(current, previous)

        self.assertEqual(changed, 5)
        self.assertTrue(all(item["status"] == "blocked" for item in current))

    def test_domain_wide_exception_does_not_hide_a_partial_real_404(self):
        urls = [f"https://www.fda.gov/example-{index}" for index in range(6)]
        current = [
            {"url": url, "httpStatus": 404, "status": "dead", "reason": ""}
            for url in urls[:5]
        ] + [{"url": urls[5], "httpStatus": 200, "status": "ok", "reason": ""}]
        previous = [{"url": url, "httpStatus": 200, "status": "ok", "reason": ""} for url in urls]

        changed = check_links.reclassify_domain_wide_404_anomalies(current, previous)

        self.assertEqual(changed, 0)
        self.assertEqual(sum(item["status"] == "dead" for item in current), 5)

    def test_waf_challenge_to_404_stays_blocked_not_dead(self):
        url = "https://www.pharmaceuticalonline.com/doc/example-0001"
        current = [{
            "url": url,
            "httpStatus": 404,
            "status": "mislink",
            "reason": "HTTP success response contains a custom not-found page",
        }]
        previous = [{
            "url": url,
            "httpStatus": 200,
            "status": "blocked",
            "reason": "HTTP response contains an access-control or bot-challenge page",
        }]

        changed = check_links.reclassify_waf_404_transitions(current, previous)

        self.assertEqual(changed, 1)
        self.assertEqual(current[0]["status"], "blocked")

    def test_bare_external_conference_link_is_not_joined_to_conference_host(self):
        target = collect_scientific_sources.resolve_public_link(
            "https://www.msacl.org/program/",
            "www.sciex.com/events/clinical/amer/msacl-2026",
        )

        self.assertEqual(target, "https://www.sciex.com/events/clinical/amer/msacl-2026")

    def test_relative_php_conference_link_stays_on_conference_host(self):
        target = collect_scientific_sources.resolve_public_link(
            "https://www.msacl.org/",
            "index.php?header=MSACL_2026&tab=Agenda",
        )

        self.assertEqual(target, "https://www.msacl.org/index.php?header=MSACL_2026&tab=Agenda")

    def test_retired_conference_document_is_not_republished_from_stale_index(self):
        body = '''<a href="https://www.casss.org/docs/default-source/mass-spec/2025-speaker-presentations/whitty-l&#233;veill&#233;-laurence-merck-co-inc-2025.pdf?sfvrsn=f1e4a7a1_5">Whitty-L&#233;veill&#233; Laurence, 2025 presentation</a>'''

        records = collect_scientific_sources.extract_conference_records(
            "https://www.casss.org/meetings-and-events/symposia/mass-spectrometry",
            body,
            "casss-mass-spec",
        )

        self.assertEqual(records, [])

    def test_retired_thermo_product_page_migrates_to_current_catalog(self):
        retired = "https://www.thermofisher.com/us/en/home/industrial/chromatography/liquid-chromatography-lc/hplc-uhplc-systems/vanquish-amplify-uhplc-system.html"

        self.assertEqual(
            refresh_daily.KNOWN_SOURCE_URL_MIGRATIONS[retired],
            "https://www.thermofisher.com/order/catalog/product/VQ-AMPLIFY",
        )

    def test_fda_abuse_detection_redirect_is_blocked_not_dead(self):
        current = [{
            "url": "https://www.fda.gov/example",
            "httpStatus": 404,
            "finalUrl": "https://www.fda.gov/apology_objects/abuse-detection-apology.html",
            "status": "dead",
            "reason": "",
        }]

        changed = check_links.reclassify_known_access_control_destinations(current)

        self.assertEqual(changed, 1)
        self.assertEqual(current[0]["status"], "blocked")

    def test_publish_gate_rejects_stale_or_missing_implication_analysis(self):
        today = date.today().isoformat()
        base = {
            "asOfDate": today,
            "signals": [{} for _ in range(10)],
            "recommendations": [{
                "title": "Current decision",
                "canonicalDecision": {"generatedAt": datetime.now().astimezone().isoformat()},
                "urgency": {"decisionImplications": ["Current implication"]},
            }],
            "trends": {"themes": [
                {"theme": f"Theme {index}", "counts": {key: index for key in ("30d", "60d", "90d", "1y", "3y", "5y")}}
                for index in range(5)
            ]},
            "refresh": {"pubmed": "success"},
        }
        refresh_daily.validate_intelligence(base)

        stale = copy.deepcopy(base)
        stale["recommendations"][0]["canonicalDecision"]["generatedAt"] = "2020-01-01T00:00:00+00:00"
        with self.assertRaisesRegex(ValueError, "not regenerated today"):
            refresh_daily.validate_intelligence(stale)

        missing = copy.deepcopy(base)
        missing["recommendations"][0]["urgency"]["decisionImplications"] = []
        with self.assertRaisesRegex(ValueError, "no decision implications"):
            refresh_daily.validate_intelligence(missing)


if __name__ == "__main__":
    unittest.main()
