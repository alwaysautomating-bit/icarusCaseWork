# Day 3 temporal context — persistence acceptance

Generated: 2026-09-20T23:14:21.254Z
Migration: `20260920120000_temporal_context_v1.sql` (local Supabase only)
RPC: `public.commit_temporal_context`

| Check | Result |
|---|---|
| Hall committed alone, then Hall + Josephine | committed |
| Replay of either pass | duplicate (idempotent) |
| Anchors / constraints persisted | 13 / 32 |
| Possible cross-account links (pending review) | 32 — {"possible_shared_anchor":22,"possible_same_event":9,"possible_additional_detail":1} |
| Conflict flags (proposed, deterministic rule) | 2 |
| Temporal assertions with form and adopted-premise flag | 40 |
| Projection rows (`temporal_context_projection`) | 40 |
| Ledger entries for the context runs | 245 |
| Provenance relations for the context runs | 164 |
| Canonical events created | 0 |
| Entities / SAME resolutions created | 0 |
| Outsider can read any context row | no |
| Outsider can commit | no |
| Direct writes to `temporal_constraints` | denied |

Applied to the local stack only. No hosted project was linked, and nothing was changed in Studio.
