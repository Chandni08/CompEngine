import csv
import json
import unittest
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PPTX = ROOT / "output" / "waters-nextgen-leadership-brief.pptx"


class ExportIntegrityTests(unittest.TestCase):
    def test_pptx_uses_current_canonical_values_and_external_links(self):
        data = json.loads((ROOT / "data" / "intelligence.json").read_text())
        scores = [str(rec["canonicalDecision"]["score"]["score"]) for rec in data["recommendations"]]
        counts = [f"{rec['canonicalDecision']['trend']['count']:,}" for rec in data["recommendations"]]
        with zipfile.ZipFile(PPTX) as archive:
            slide_xml = " ".join(
                archive.read(name).decode("utf-8", errors="ignore")
                for name in archive.namelist()
                if name.startswith("ppt/slides/slide") and name.endswith(".xml")
            )
            rels = " ".join(
                archive.read(name).decode("utf-8", errors="ignore")
                for name in archive.namelist()
                if name.startswith("ppt/slides/_rels/")
            )
            notes = " ".join(
                archive.read(name).decode("utf-8", errors="ignore")
                for name in archive.namelist()
                if name.startswith("ppt/notesSlides/notesSlide") and name.endswith(".xml")
            )
        plain = slide_xml.replace("</a:t>", " ")
        for score in scores:
            self.assertIn(score, plain)
        for count in counts:
            self.assertIn(count, plain)
        self.assertIn(str(data["asOfDate"]), plain)
        self.assertIn('TargetMode="External"', rels)
        self.assertIn("https://", notes)
        self.assertNotIn("Workflow execution is becoming part of product competition", plain)

    def test_claim_csv_has_required_provenance_columns(self):
        with (ROOT / "exports" / "claims-registry.csv").open(encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            required = {
                "claimID", "status", "languageType", "url", "retrievalDate", "sourceDate",
                "sourceLocation", "supportingExcerpt", "caveat",
            }
            self.assertTrue(required.issubset(set(reader.fieldnames or [])))

    def test_blocked_sources_cannot_receive_verified_verdicts(self):
        with (ROOT / "audit" / "link_inventory.csv").open(encoding="utf-8-sig") as handle:
            blocked_urls = {
                row["original_url"]
                for row in csv.DictReader(handle)
                if row["link_status"] == "Blocked"
            }

        with (ROOT / "audit" / "per_claim_appendix.csv").open(encoding="utf-8-sig") as handle:
            blocked_claims = [
                row
                for row in csv.DictReader(handle)
                if row["source_url"] in blocked_urls
            ]

        self.assertTrue(blocked_claims, "Expected the audit fixture to include blocked-source claims")
        for claim in blocked_claims:
            self.assertNotEqual(
                claim["verdict"],
                "Verified",
                f"Blocked source incorrectly verified: {claim['claim_id']}",
            )

        with (ROOT / "exports" / "claims-registry.csv").open(encoding="utf-8-sig") as handle:
            exported_claims = list(csv.DictReader(handle))
        for claim in exported_claims:
            if claim["url"] in blocked_urls:
                self.assertNotEqual(
                    claim["status"],
                    "verified",
                    f"Blocked source incorrectly verified in canonical export: {claim['claimID']}",
                )


if __name__ == "__main__":
    unittest.main()
