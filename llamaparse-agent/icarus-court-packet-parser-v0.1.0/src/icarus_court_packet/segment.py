from __future__ import annotations

import hashlib
import re
from dataclasses import replace
from pathlib import Path
from typing import Iterable

from .models import PageParse, PacketBundle, SegmentCandidate
from .normalize import content_fingerprint


BOUNDARY_RULES: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("warrant_return", re.compile(r"\b(?:return\s+of|warrant\s+return|return\s+on)\b.{0,40}\bsearch\s+warrant\b", re.I | re.S)),
    ("warrant_application", re.compile(r"\bapplication\s+for\s+(?:a\s+)?search\s+warrant\b", re.I)),
    ("search_warrant", re.compile(r"\bsearch\s+warrant\b", re.I)),
    ("affidavit", re.compile(r"\baffidavit\b(?:\s+in\s+support\s+of\s+(?:an?\s+)?application)?", re.I)),
    ("property_inventory", re.compile(r"\b(?:property|evidence)\s+(?:receipt|inventory)\b", re.I)),
    ("attachment", re.compile(r"\b(?:attachment|exhibit)\s+[a-z0-9]+\b", re.I)),
)


def classify_page(page: PageParse) -> tuple[str | None, tuple[str, ...]]:
    sample = "\n".join((page.text, page.markdown))[:8000]
    matches: list[tuple[str, str]] = []
    for document_type, pattern in BOUNDARY_RULES:
        match = pattern.search(sample)
        if match:
            evidence = " ".join(match.group(0).split())[:160]
            matches.append((document_type, evidence))
    if not matches:
        return None, ()
    return matches[0][0], tuple(evidence for _, evidence in matches)


def _candidate_id(source_sha256: str, start_page: int, end_page: int) -> str:
    value = f"{source_sha256}:{start_page}:{end_page}".encode("utf-8")
    return "DOC-CAND-" + hashlib.sha256(value).hexdigest()[:12].upper()


def segment_pages(pages: Iterable[PageParse], source_sha256: str) -> tuple[SegmentCandidate, ...]:
    ordered = tuple(sorted(pages, key=lambda page: page.page_number))
    if not ordered:
        return ()

    runs: list[dict[str, object]] = []
    current_type = "unclassified"
    current_pages: list[PageParse] = []
    current_evidence: list[str] = []

    for page in ordered:
        detected_type, evidence = classify_page(page)
        begins_new_run = detected_type is not None and current_pages and detected_type != current_type
        if begins_new_run:
            runs.append({"type": current_type, "pages": current_pages, "evidence": current_evidence})
            current_pages = []
            current_evidence = []
        if detected_type is not None and (not current_pages or detected_type != current_type):
            current_type = detected_type
        current_pages.append(page)
        current_evidence.extend(evidence)

    runs.append({"type": current_type, "pages": current_pages, "evidence": current_evidence})

    candidates: list[SegmentCandidate] = []
    for run in runs:
        run_pages = tuple(run["pages"])  # type: ignore[arg-type]
        start_page = run_pages[0].page_number
        end_page = run_pages[-1].page_number
        joined = "\n".join(page.text or page.markdown for page in run_pages)
        candidates.append(
            SegmentCandidate(
                candidate_id=_candidate_id(source_sha256, start_page, end_page),
                document_type=str(run["type"]),
                start_page=start_page,
                end_page=end_page,
                page_numbers=tuple(page.page_number for page in run_pages),
                boundary_evidence=tuple(dict.fromkeys(run["evidence"])),  # type: ignore[arg-type]
                fingerprint=content_fingerprint(joined),
            )
        )

    by_fingerprint: dict[str, list[str]] = {}
    for candidate in candidates:
        by_fingerprint.setdefault(candidate.fingerprint, []).append(candidate.candidate_id)

    resolved: list[SegmentCandidate] = []
    for candidate in candidates:
        duplicates = tuple(
            candidate_id
            for candidate_id in by_fingerprint[candidate.fingerprint]
            if candidate_id != candidate.candidate_id
        )
        resolved.append(replace(candidate, possible_duplicate_of=duplicates))
    return tuple(resolved)


def build_bundle(
    *,
    case_id: str,
    source_name: str,
    source_sha256: str,
    pages: Iterable[PageParse],
    parse_job_id: str | None,
    sdk_version: str,
    parse_version: str,
) -> PacketBundle:
    ordered_pages = tuple(sorted(pages, key=lambda page: page.page_number))
    warnings: list[str] = []
    if not ordered_pages:
        warnings.append("parse_returned_no_pages")
    empty_pages = [page.page_number for page in ordered_pages if not (page.text.strip() or page.markdown.strip())]
    if empty_pages:
        warnings.append("empty_page_output:" + ",".join(map(str, empty_pages)))
    expected = set(range(1, len(ordered_pages) + 1))
    actual = {page.page_number for page in ordered_pages}
    if expected != actual:
        warnings.append("non_contiguous_page_numbers")
    return PacketBundle(
        schema_version="icarus.court_packet.parse.v1",
        case_id=case_id,
        source={
            "name": Path(source_name).name,
            "sha256": source_sha256,
            "page_count": len(ordered_pages),
        },
        parser={
            "provider": "llamaparse",
            "sdk": "llama-cloud",
            "sdk_version": sdk_version,
            "parse_version": parse_version,
            "parse_job_id": parse_job_id,
        },
        pages=ordered_pages,
        segments=segment_pages(ordered_pages, source_sha256),
        warnings=tuple(warnings),
    )
