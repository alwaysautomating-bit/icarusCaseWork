# Icarus Court Packet Parser

This is the first document-intelligence slice for Icarus Casework. It sends a
court packet to LlamaParse, preserves page-level output, detects likely document
boundaries, and writes review candidates with exact page provenance.

It deliberately does **not** publish assertions or case facts. Segments remain
`review_required` until Icarus accepts them through its governed review path.

## Proven workflow

```text
immutable packet -> page parse -> boundary candidates -> review bundle
```

The initial search-warrant vocabulary recognizes:

- search warrants;
- warrant applications;
- affidavits;
- warrant returns;
- attachments and exhibits;
- property receipts and inventories.

Every source page survives even when no boundary can be classified.

## Local setup

```bash
uv sync
cp .env.example .env
# Add LLAMA_CLOUD_API_KEY to .env or export it in your shell.
```

Run the deterministic tests without making an API call:

```bash
uv run python -m unittest discover -s tests -v
```

Parse a packet:

```bash
uv run icarus-packet parse ./packet.pdf \
  --case-id 413d071f-6299-46ae-aa85-46390aca38a6 \
  --out ./results/search-warrant-packet.json
```

The parser configuration defaults to the dated `2026-07-24` agentic version
for reproducibility. Change `LLAMAPARSE_VERSION` deliberately and retain it in
the provenance record when evaluating a newer parser version.

Inspect an already-retrieved LlamaParse JSON result without using credits:

```bash
uv run icarus-packet inspect ./data/sample-parse-result.json \
  --case-id example-case \
  --source-name sample-packet.pdf \
  --out ./results/sample-review-bundle.json
```

## Output contract

The JSON bundle includes:

- the original file name and SHA-256;
- parser version and parse job identifier;
- every page's text and markdown;
- stable page locators such as `packet.pdf#page=12`;
- candidate segment type and page range;
- the exact heading evidence that caused a boundary;
- a normalized-content fingerprint used only to flag possible duplicates;
- `review_required` status for every segment.

See [docs/contract.md](docs/contract.md) for the Icarus integration boundary.

## Current limitation

The supplied acceptance ZIP in this workspace is incomplete and cannot be
expanded. The deterministic path is tested with a representative synthetic
warrant/affidavit/return packet. Re-upload the original PDF or a complete ZIP
to run the live acceptance fixture.
