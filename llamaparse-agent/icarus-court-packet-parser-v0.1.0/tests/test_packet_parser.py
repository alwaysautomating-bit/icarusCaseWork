from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from icarus_court_packet.llamaparse import pages_from_result  # noqa: E402
from icarus_court_packet.models import PageParse  # noqa: E402
from icarus_court_packet.segment import build_bundle, segment_pages  # noqa: E402


class PacketParserTests(unittest.TestCase):
    def test_saved_result_preserves_every_page_and_locator(self) -> None:
        payload = json.loads((ROOT / "data" / "sample-parse-result.json").read_text())
        pages = pages_from_result(payload, "packet.pdf")
        self.assertEqual([page.page_number for page in pages], [1, 2, 3, 4, 5])
        self.assertEqual(pages[2].locator, "packet.pdf#page=3")
        self.assertIn("AFFIDAVIT", pages[2].text)

    def test_warrant_affidavit_and_return_become_review_candidates(self) -> None:
        payload = json.loads((ROOT / "data" / "sample-parse-result.json").read_text())
        pages = pages_from_result(payload, "packet.pdf")
        segments = segment_pages(pages, "a" * 64)
        self.assertEqual(
            [(segment.document_type, segment.start_page, segment.end_page) for segment in segments],
            [
                ("search_warrant", 1, 2),
                ("affidavit", 3, 4),
                ("warrant_return", 5, 5),
            ],
        )
        self.assertTrue(all(segment.review_status == "review_required" for segment in segments))

    def test_empty_page_survives_and_is_warned(self) -> None:
        pages = (
            PageParse(1, "SEARCH WARRANT", "# SEARCH WARRANT", "packet.pdf#page=1"),
            PageParse(2, "", "", "packet.pdf#page=2"),
        )
        bundle = build_bundle(
            case_id="case-1",
            source_name="packet.pdf",
            source_sha256="b" * 64,
            pages=pages,
            parse_job_id="job-1",
            sdk_version="fixture",
            parse_version="fixture",
        )
        self.assertEqual(bundle.source["page_count"], 2)
        self.assertIn("empty_page_output:2", bundle.warnings)
        self.assertEqual(bundle.segments[0].page_numbers, (1, 2))

    def test_exact_repetition_is_flagged_without_claiming_corroboration(self) -> None:
        pages = (
            PageParse(1, "AFFIDAVIT same allegation", "", "packet.pdf#page=1"),
            PageParse(2, "RETURN OF SEARCH WARRANT", "", "packet.pdf#page=2"),
            PageParse(3, "AFFIDAVIT same allegation", "", "packet.pdf#page=3"),
        )
        segments = segment_pages(pages, "c" * 64)
        first, _, third = segments
        self.assertEqual(first.fingerprint, third.fingerprint)
        self.assertEqual(first.possible_duplicate_of, (third.candidate_id,))
        self.assertEqual(third.possible_duplicate_of, (first.candidate_id,))


if __name__ == "__main__":
    unittest.main()
