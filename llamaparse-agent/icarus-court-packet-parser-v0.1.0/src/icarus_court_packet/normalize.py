from __future__ import annotations

import hashlib
import re


_SPACE = re.compile(r"\s+")
_PAGE_NOISE = re.compile(r"\bpage\s+\d+\s+(?:of\s+\d+)?\b", re.IGNORECASE)


def normalized_text(value: str) -> str:
    value = _PAGE_NOISE.sub(" ", value)
    value = value.casefold()
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return _SPACE.sub(" ", value).strip()


def content_fingerprint(value: str) -> str:
    return hashlib.sha256(normalized_text(value).encode("utf-8")).hexdigest()

