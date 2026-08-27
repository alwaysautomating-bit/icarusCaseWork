from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Sequence

from .llamaparse import pages_from_result, parse_packet
from .segment import build_bundle


def _write_json(path: Path, value: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Parse court packets for Icarus Casework review")
    subparsers = parser.add_subparsers(dest="command", required=True)

    live = subparsers.add_parser("parse", help="Upload and parse a packet with LlamaParse")
    live.add_argument("packet", type=Path)
    live.add_argument("--case-id", required=True)
    live.add_argument("--out", type=Path, required=True)

    inspect = subparsers.add_parser("inspect", help="Inspect saved LlamaParse JSON without an API call")
    inspect.add_argument("result", type=Path)
    inspect.add_argument("--case-id", required=True)
    inspect.add_argument("--source-name", required=True)
    inspect.add_argument("--source-sha256")
    inspect.add_argument("--out", type=Path, required=True)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if args.command == "parse":
        bundle = parse_packet(args.packet, args.case_id)
    else:
        payload = json.loads(args.result.read_text(encoding="utf-8"))
        source_sha256 = args.source_sha256 or hashlib.sha256(
            args.source_name.encode("utf-8")
        ).hexdigest()
        bundle = build_bundle(
            case_id=args.case_id,
            source_name=args.source_name,
            source_sha256=source_sha256,
            pages=pages_from_result(payload, args.source_name),
            parse_job_id=str((payload.get("job") or {}).get("id") or payload.get("id") or "fixture"),
            sdk_version="saved-result",
            parse_version="saved-result",
        )
    _write_json(args.out, bundle.to_dict())
    print(f"wrote {args.out} ({len(bundle.pages)} pages, {len(bundle.segments)} candidates)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
