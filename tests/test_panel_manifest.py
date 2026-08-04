import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class PanelManifestTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads((ROOT / "audit" / "panel_manifest.json").read_text())
        cls.registry = json.loads((ROOT / "data" / "source_registry.json").read_text())
        cls.health = json.loads((ROOT / "data" / "source_health.json").read_text())
        cls.matrix = json.loads((ROOT / "audit" / "panel_dependency_matrix.json").read_text())

    def test_every_manifest_row_has_an_owner_refresh_path_and_validation(self):
        required = {
            "pageId", "parentPanelId", "subpanelId", "visibleTitle", "navigationRoute",
            "htmlContainer", "renderFunction", "sourceDataFiles", "sourceFields", "derivedFields",
            "competitorsRepresented", "sourceFamiliesRepresented", "availableFilters",
            "availableTimeFrames", "defaultState", "hiddenExpandedStates", "externalLinks",
            "internalLinks", "emptyStateBehavior", "currentAsOfDate", "refreshCollector",
            "validationFunction", "dataMode",
        }
        for row in self.manifest["panels"]:
            self.assertFalse(required - row.keys(), row["panelId"])
            self.assertTrue(row["sourceDataFiles"], row["panelId"])
            self.assertTrue(row["refreshCollector"], row["panelId"])
            self.assertTrue(row["validationFunction"], row["panelId"])

    def test_every_id_backed_html_panel_is_in_the_manifest(self):
        selectors = {row["htmlContainer"] for row in self.manifest["panels"]}
        for page in ("index.html", "conference.html", "publications.html"):
            body = (ROOT / page).read_text()
            ids = re.findall(r'<(?:section|article|dialog)[^>]*\bid="([^"]+)"[^>]*', body)
            for element_id in ids:
                expected = f"#{element_id}"
                self.assertIn(expected, selectors, f"{page}:{element_id}")

    def test_every_dashboard_data_load_has_a_manifest_consumer(self):
        app = (ROOT / "app.js").read_text()
        loaded = {f"data/{name}" for name in re.findall(r'fetch\("data/([^"?]+\.json)', app)}
        owned = {path for row in self.manifest["panels"] for path in row["sourceDataFiles"]}
        self.assertFalse(loaded - owned, sorted(loaded - owned))

    def test_source_health_records_expose_the_full_truth_contract(self):
        required = {
            "sourceId", "sourceName", "sourceType", "baseUrl", "method", "required", "cadence",
            "attemptedAt", "succeededAt", "engineNewestDate", "engineNewestTitle", "engineNewestUrl",
            "sourceNewestDate", "sourceNewestTitle", "sourceNewestUrl", "lagDays", "newestItemPresent",
            "sourceCount", "engineCount", "estimatedMissingCount", "freshnessStatus",
            "completenessStatus", "coverageStatus", "reachabilityStatus", "policyStatus",
            "errorCode", "errorMessage", "nextRetryAt",
        }
        for row in self.health["sources"]:
            self.assertFalse(required - row.keys(), row["sourceId"])
        self.assertEqual(len(self.health["sources"]), len({row["sourceId"] for row in self.health["sources"]}))

    def test_registry_dependency_matrix_and_deployment_are_synchronized(self):
        self.assertEqual(
            (ROOT / "data" / "source_registry.json").read_bytes(),
            (ROOT / "deploy-site" / "data" / "source_registry.json").read_bytes(),
        )
        registry_ids = {row["sourceId"] for row in self.registry["sources"]}
        matrix_ids = {row["sourceId"] for row in self.matrix["sources"]}
        self.assertEqual(registry_ids, matrix_ids)
        for row in self.matrix["sources"]:
            self.assertTrue(row["affectedPanels"], row["sourceId"])
            self.assertTrue(row["dataFiles"], row["sourceId"])

    def test_utc_time_windows_are_exact_and_deployed(self):
        source = json.loads((ROOT / "data" / "time_frame_boundaries.json").read_text())
        deployed = json.loads((ROOT / "deploy-site" / "data" / "time_frame_boundaries.json").read_text())
        self.assertEqual(source, deployed)
        expected = {
            "30d", "60d", "90d", "current_quarter", "prior_quarter", "ytd", "1y",
            "trailing_12_months", "3y", "5y", "since_2023_07", "current_calendar_year",
            "prior_calendar_year", "all_historical", "past_conferences", "upcoming_conferences",
        }
        self.assertEqual(expected, {row["id"] for row in source["windows"]})
        for row in source["windows"]:
            self.assertLessEqual(row["startUtc"], row["endUtc"], row["id"])
            self.assertIn("start <= timestamp <= end", row["boundaryConvention"])


if __name__ == "__main__":
    unittest.main()
