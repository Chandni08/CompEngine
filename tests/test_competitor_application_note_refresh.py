import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

import scripts.collect_competitor_application_notes as catalog_collector


class CompetitorApplicationNoteRefreshTests(unittest.TestCase):
    def test_full_monitor_inventory_is_merged_into_catalog(self):
        today = datetime.now(timezone.utc).date().isoformat()
        now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            catalog_file = root / "competitor_application_notes.json"
            monitor_file = root / "competitor_monitors.json"
            snapshot_dir = root / "source_snapshots"
            snapshot_dir.mkdir()

            catalog_file.write_text(json.dumps({
                "notes": [
                    {
                        "id": f"seed-{index}",
                        "date": today,
                        "competitor": competitor,
                        "sourceUrl": f"https://example.invalid/{index}",
                    }
                    for index, competitor in enumerate(catalog_collector.COMPETITORS)
                ]
            }))
            new_url = "https://www.thermofisher.com/blog/analyteguru/example-technical-note/"
            monitor_file.write_text(json.dumps({
                "generatedAt": now,
                "competitors": {
                    "Thermo Fisher": {
                        "generatedAt": now,
                        "technical_insights": [{
                            "date": today,
                            "title": "New Technical Note: Example LC-MS workflow",
                            "url": new_url,
                            "sourceId": "thermo-ms-insights",
                            "sourceName": "Thermo Fisher mass spectrometry insights",
                        }],
                    }
                },
            }))

            with (
                patch.object(catalog_collector, "CATALOG_FILE", catalog_file),
                patch.object(catalog_collector, "MONITOR_FILE", monitor_file),
                patch.object(catalog_collector, "SNAPSHOT_DIR", snapshot_dir),
            ):
                result = catalog_collector.collect()

            self.assertTrue(any(note.get("sourceUrl") == new_url for note in result["notes"]))
            thermo = next(row for row in result["sourceStatus"] if row["competitor"] == "Thermo Fisher")
            self.assertEqual(thermo["inventoryMode"], "official_full_feed")
            self.assertEqual(thermo["inventoryRecordsSeen"], 1)
            self.assertEqual(thermo["completenessStatus"], "complete")


if __name__ == "__main__":
    unittest.main()
