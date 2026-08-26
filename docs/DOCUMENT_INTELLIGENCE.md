# Court packet document intelligence

Status: integrated v1, live acceptance pending local API key

Companion reference: [LlamaParse MCP reference](./LLAMAPARSE_MCP_REFERENCE.md)

## Boundary

The source PDF is preserved before parsing and identified by its SHA-256. LlamaParse owns OCR and layout recovery. Icarus owns page normalization, candidate segmentation, case access, review decisions, accepted document boundaries, citations, and audit history.

The v1 flow is:

```text
immutable PDF -> LlamaParse v2 page output -> deterministic boundary candidates -> governed review -> accepted document boundaries
```

Parsing never creates claims, events, truth assessments, support relationships, contradiction resolutions, or corroboration decisions. Every page is committed as a canonical `source_segments` row and a `court_packet_pages` row. Every detected boundary begins as `review_required`.

## Commands

Set `LLAMA_CLOUD_API_KEY` in ignored local environment configuration. The key is server-only and must never use a `NEXT_PUBLIC_` prefix.

```powershell
pnpm court-packet:parse "evidence/court-packet.pdf" `
  --case-id <case-uuid> `
  --out ".data/court-packets/search-warrant-review.json"
```

Inspect a saved LlamaParse response without a cloud call:

```powershell
pnpm court-packet:inspect saved-result.json `
  --source packet.pdf `
  --case-id <case-uuid> `
  --out ".data/court-packets/review.json"
```

Both commands preserve the source in the configured immutable object-storage adapter and write a validated review bundle. They do not write database rows. Application code commits a bundle through `commitCourtPacketBundle`, which calls the atomic `commit_court_packet_parse` RPC under the signed-in user's case-scoped session.

## Reproducibility

- SDK: `@llamaindex/llama-cloud@2.14.1`
- Default tier: `agentic`
- Default parse version: `2026-07-24`
- Expanded outputs: `text`, `markdown`, and `items`
- Default OCR language: English

Change `LLAMAPARSE_VERSION` deliberately. The parse version and a SHA-256 of the complete parser configuration are retained with every run.

## Review contract

`review_court_packet_boundary` accepts owner/reviewer decisions with optimistic concurrency. Accept and amend create or version an accepted `court_packet_documents` boundary. Reject and defer retain the candidate and append an immutable review version. Direct writes to parse, page, candidate, accepted-document, and review-version tables are denied to application roles.
