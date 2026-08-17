"""Regression tests for PerkinElmer newsroom title extraction."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from collect_perkinelmer import extract_release_title  # noqa: E402


class PerkinElmerTitleIntegrityTests(unittest.TestCase):
    def test_visible_full_heading_wins_over_stale_truncated_metadata(self) -> None:
        url = "https://www.perkinelmer.com/corporate-and-newsroom/project-farma-acquires-simotech"
        html = """
          <title>PerkinElmer Publishes 2025 Sustainability Report, Advancing its Commitment to Cleaner Science and a</title>
          <li class="breadcrumb-item active">Project Farma Acquires SimoTech</li>
          <div class="without_image_desc"><h2>Project Farma Acquires SimoTech, Bringing End-to-End GMP Automation and Digital Manufacturing Capabilities to Life Sciences Customers Worldwide</h2></div>
        """
        self.assertEqual(
            extract_release_title(html, url),
            "Project Farma Acquires SimoTech, Bringing End-to-End GMP Automation and Digital Manufacturing Capabilities to Life Sciences Customers Worldwide",
        )

    def test_permalink_rejects_an_unrelated_global_title(self) -> None:
        url = "https://www.perkinelmer.com/corporate-and-newsroom/project-farma-expands-pmis-offering-oracle-primavera-cloud"
        html = """
          <title>Project Farma Partners with Valkit.ai - Modernizing Digital Validation with AI</title>
          <li class="breadcrumb-item active">Project Farma Expands PMIS Offering with Oracle Primavera Cloud to Address Growing Pharma Capital Project Complexity</li>
        """
        self.assertEqual(
            extract_release_title(html, url),
            "Project Farma Expands PMIS Offering with Oracle Primavera Cloud to Address Growing Pharma Capital Project Complexity",
        )

    def test_incomplete_only_candidate_fails_closed(self) -> None:
        url = "https://www.perkinelmer.com/corporate-and-newsroom/perkinelmer-publishes-2025-sustainability-report-advancing-its-commitment-cleaner-science-and-more-sustainable-future"
        html = "<title>PerkinElmer Publishes 2025 Sustainability Report, Advancing its Commitment to Cleaner Science and a</title>"
        self.assertEqual(extract_release_title(html, url), "")


if __name__ == "__main__":
    unittest.main()
