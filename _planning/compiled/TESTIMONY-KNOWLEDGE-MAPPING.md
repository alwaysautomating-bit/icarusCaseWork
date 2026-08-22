# Testimony Knowledge Mapping v1

## Boundary

This layer turns committed transcript segments and deterministic courtroom structure into reviewable, provenance-preserved knowledge candidates. It does not decide truth, guilt, diagnosis, credibility, support, contradiction, causation, or canonical identity.

SAME owns canonical entity resolution. This layer stores the raw mention, normalized candidate text, an optional externally supplied resolved entity ID, and the resolution basis. It never merges entities or aliases.

## Reused substrate

- `source_artifacts` and `source_segments`: immutable source representation and exact locators.
- `proceedings`, `proceeding_speakers`, `qa_exchanges`: committed proceeding record.
- `extraction_candidates` and `extraction_review_versions`: candidate review history.
- `claims`: attributable assertions. The knowledge layer makes proposition linkage optional instead of manufacturing a proposition.
- `events`: reviewed canonical events only; unreviewed transcript output goes to `event_candidates`.
- `propositions`: optional shared semantic target; never created merely to satisfy a foreign key.
- `audit_events`: user-facing operational audit. The new `case_ledger` is the append-only Clock-1 order.

## Pipeline

```text
preserved transcript artifact
  -> exact committed source segments
  -> deterministic witness blocks / phase candidates / procedural markers
  -> testimony units with exact segment membership
  -> semantic extraction contract
  -> knowledge items + attributable candidate records
  -> atomic database commit + append-only ledger
```

The deterministic pass remains authoritative only for what it can observe. Witness boundaries, examination phase, jury state, and procedural classifications remain candidates with confidence and review status.

## Three clocks

1. **Clock 1 — record time:** `case_ledger.logical_order` is allocated per case at commit. Replaying entries through `logical_order <= N` cannot include later objects.
2. **Clock 2 — event time:** `temporal_assertions` preserves raw language, precision, optional bounds, and relative event references. Unknown time has no manufactured timestamp. Transcript timestamps remain source locators.
3. **Clock 3 — information provenance:** `provenance_activities` and `provenance_relations` represent source -> deterministic structure -> extraction activity -> knowledge item -> derived records. Claims also record information basis such as personally observed, heard from a person, read in a record, or unknown.

## Identity contract

- UUID is the database identity.
- New mapped objects also receive a stable, case-scoped display code (`TST-…`, `KI-…`, `CLM-…`, `EVT-…`, `TMP-…`, `REL-…`, `FLG-…`). Codes are derived from immutable source identity and segment membership, not mutable summaries.
- Parser labels and imported IDs are retained in `source_ref`/`imported_id`; they are never primary keys.
- Corrections create version or ledger rows and do not recycle identity.

## Testimony unit contract

A testimony unit is a coherent source window inside one deterministic witness block. It stores raw witness label, optional externally resolved witness entity, phase and jury candidates, boundary confidence, procedural context, and ordered source-segment membership. Every semantic record must cite segments contained in its parent unit.

## Knowledge item contract

A knowledge item contains a concise qualified summary, review state, extraction method/model/compiler/contract versions, witness and examination context inherited from its testimony unit, unknowns, and exact segment membership. Claims, mentions, event candidates, temporal assertions, relationships, flags, and provenance relations remain separately addressable.

## Temporal and relationship semantics

- Precision: exact timestamp, exact date, approximate, interval, bounded interval, relative only, or unknown.
- Temporal bands are coarse case-scoped placement aids, never substitutes for time assertions.
- Relationships are attributable edges between typed nodes. `before`/`after` are distinct from `claimed_causes`; chronology never creates causation.
- This compiler may preserve an explicitly asserted causal edge as a pending claim, but it does not infer or accept one.
- No support, contradiction, verification, reconciliation, or truth assessment is created by the transcript mapper.

## Provenance and correction rules

- Every derived object cites a knowledge item and/or claim plus exact source segments.
- Every extraction run records compiler, model (or `none`), contract version, configuration hash, and source artifact.
- Original text and normalized/summary text are distinct fields.
- Review and correction are append-oriented. Database guards reject update/delete of ledger and provenance activity records by ordinary authenticated clients.

## Database additions

- `knowledge_extraction_runs`
- `witness_blocks` and segment membership
- `testimony_units` and segment membership
- `knowledge_items`, versions, and segment membership
- `entity_mentions` (SAME handoff boundary)
- `event_candidates`
- `temporal_bands` and `temporal_assertions`
- `knowledge_relationships`
- `knowledge_flags`
- `provenance_activities` and `provenance_relations`
- `case_ledger`
- claim extensions and claim-to-segment membership

## Acceptance invariants

- All 2,197 Day 6 source segments remain addressable; knowledge mapping does not rewrite them.
- Deterministic blocks are monotonic, non-overlapping, and timestamp-safe; gaps are reported.
- The 82.1°F and 95.2°F exchanges remain distinct Q/A-backed knowledge items.
- Measurement time remains `unknown` with null asserted start/end.
- Christina Carpio remains a raw transcript label unless SAME supplies a reviewed resolution.
- Every mapped object traces through an extraction activity to the exact source segments and source artifact.
- No canonical event, proposition, entity, support edge, contradiction, truth assessment, or Casework theory is created by acceptance compilation.
