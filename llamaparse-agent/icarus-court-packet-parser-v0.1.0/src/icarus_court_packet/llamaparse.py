from __future__ import annotations

import hashlib
import importlib.metadata
import os
from pathlib import Path
from typing import Any

from .models import PacketBundle, PageParse
from .segment import build_bundle


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _as_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    raise TypeError(f"Unsupported LlamaParse result type: {type(value)!r}")


def pages_from_result(result: Any, source_name: str) -> tuple[PageParse, ...]:
    payload = _as_dict(result)
    markdown_pages = (payload.get("markdown") or {}).get("pages") or []
    text_pages = (payload.get("text") or {}).get("pages") or []
    item_pages = (payload.get("items") or {}).get("pages") or []

    page_numbers: set[int] = set()
    for collection in (markdown_pages, text_pages, item_pages):
        for index, page in enumerate(collection, start=1):
            page_numbers.add(int(page.get("page_number") or page.get("page") or index))

    def find_page(collection: list[dict[str, Any]], page_number: int) -> dict[str, Any]:
        for index, page in enumerate(collection, start=1):
            number = int(page.get("page_number") or page.get("page") or index)
            if number == page_number:
                return page
        return {}

    pages: list[PageParse] = []
    for page_number in sorted(page_numbers):
        markdown_page = find_page(markdown_pages, page_number)
        text_page = find_page(text_pages, page_number)
        item_page = find_page(item_pages, page_number)
        markdown = str(markdown_page.get("markdown") or "")
        text = str(text_page.get("text") or markdown_page.get("text") or markdown)
        raw_items = item_page.get("items") or item_page.get("value") or []
        if not isinstance(raw_items, list):
            raw_items = []
        parser_page_id = markdown_page.get("id") or text_page.get("id") or item_page.get("id")
        pages.append(
            PageParse(
                page_number=page_number,
                text=text,
                markdown=markdown,
                locator=f"{Path(source_name).name}#page={page_number}",
                parser_page_id=str(parser_page_id) if parser_page_id else None,
                items=tuple(item for item in raw_items if isinstance(item, dict)),
            )
        )
    return tuple(pages)


def parse_packet(path: Path, case_id: str) -> PacketBundle:
    if not os.environ.get("LLAMA_CLOUD_API_KEY"):
        raise RuntimeError("LLAMA_CLOUD_API_KEY is required for a live parse")

    from llama_cloud import LlamaCloud

    parse_version = os.environ.get("LLAMAPARSE_VERSION", "2026-07-24")
    client = LlamaCloud()
    uploaded = client.files.create(file=path, purpose="parse")
    result = client.parsing.parse(
        file_id=uploaded.id,
        tier="agentic",
        version=parse_version,
        output_options={
            "markdown": {"tables": {"output_tables_as_markdown": True}},
            "images_to_save": ["screenshot"],
        },
        processing_options={"ocr_parameters": {"languages": ["en"]}},
        expand=["text", "markdown", "items", "images_content_metadata"],
    )
    payload = _as_dict(result)
    job = payload.get("job") or {}
    parse_job_id = job.get("id") or payload.get("id")
    return build_bundle(
        case_id=case_id,
        source_name=path.name,
        source_sha256=file_sha256(path),
        pages=pages_from_result(payload, path.name),
        parse_job_id=str(parse_job_id) if parse_job_id else None,
        sdk_version=importlib.metadata.version("llama-cloud"),
        parse_version=parse_version,
    )
