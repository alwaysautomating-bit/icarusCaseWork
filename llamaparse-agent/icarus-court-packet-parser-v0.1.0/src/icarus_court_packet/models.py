from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass(frozen=True)
class PageParse:
    page_number: int
    text: str
    markdown: str
    locator: str
    parser_page_id: str | None = None
    items: tuple[dict[str, Any], ...] = ()

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class SegmentCandidate:
    candidate_id: str
    document_type: str
    start_page: int
    end_page: int
    page_numbers: tuple[int, ...]
    boundary_evidence: tuple[str, ...]
    fingerprint: str
    review_status: str = "review_required"
    possible_duplicate_of: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class PacketBundle:
    schema_version: str
    case_id: str
    source: dict[str, Any]
    parser: dict[str, Any]
    pages: tuple[PageParse, ...]
    segments: tuple[SegmentCandidate, ...]
    warnings: tuple[str, ...] = field(default_factory=tuple)

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "case_id": self.case_id,
            "source": self.source,
            "parser": self.parser,
            "pages": [page.to_dict() for page in self.pages],
            "segments": [segment.to_dict() for segment in self.segments],
            "warnings": list(self.warnings),
        }

