# Reconcile v1 — Governed Reviewed-Object Graph

Date: 2026-08-22

Status: completed locally

## Outcome

Reconcile is the governed analytical layer between Structure Review and Reconstruction. It lets an owner or reviewer group accepted/amended, exact-source-backed objects and explicitly classify how they relate while preserving disagreement and uncertainty.

```text
Canonical source
  -> extracted structure
  -> governed Structure Review
  -> Reconcile group + relationship classifications
  -> later Reconstruction drafting
```

## Product contract

- Route: `/cases/[caseId]/reconcile`.
- Inputs: accepted or amended knowledge items, claims, event candidates, temporal assertions, entity mentions, knowledge relationships, and flags with at least one exact source segment.
- Member roles: `anchor`, `supporting`, `conflicting`, `context`, and `unresolved`.
- Relationship classes: `supports`, `conflicts_with`, `qualifies`, `duplicates`, `derives_from`, `same_occurrence_candidate`, `distinct_occurrence`, `sequence_consistent`, and `leaves_unresolved`.
- Group statuses: `open`, `reviewed`, and `deferred`.
- Dashed source-graph edges are derived context. They are never silently persisted as reviewer classifications.
- Every save is authorized and revalidated in PostgreSQL. Browser-supplied labels, statuses, and source IDs are not trusted.
- An update requires an expected version and change note. Identical replay creates neither a new version nor a ledger entry.

## Persistence

Migration: `20260822225846_governed_reconciliation_groups_v1.sql`

- `reconciliation_groups` stores current group identity, state, actors, and version pointer.
- `reconciliation_group_versions` stores immutable enriched snapshots, change notes, actors, timestamps, and case-ledger order.
- `reconciliation_group_projection` is a case-scoped `security_invoker` read model.
- `save_reconciliation_group` is the only authenticated mutation boundary.
- The private core locks updates, checks owner/reviewer authority, validates case ownership and reviewed status, captures exact source IDs server-side, validates endpoints and relation classes, appends the ledger, and freezes the version atomically.
- Direct authenticated table writes are denied; anonymous access is denied; service-role administration remains explicit.

## Permanent boundaries

A Reconcile save creates none of the following:

- canonical events;
- SAME/entity resolutions or aliases;
- source mutations;
- factual findings;
- credibility, diagnosis, guilt, admissibility, or evidentiary-weight decisions;
- changes to saved timeline or reconstruction snapshots.

`same_occurrence_candidate` is a reviewer classification for later inspection, not occurrence identity. `sequence_consistent` does not assign an event clock. `leaves_unresolved` is a valid reviewed outcome.

## Acceptance demonstration

The repeatable command `pnpm reconcile:day3` creates or replays “Day 3 responder timing — governed reconciliation” using four reviewed nodes:

- Hall's seven-to-ten-minute response estimate;
- the accepted missing-clock flag;
- Hall's same-time-as-Josephine arrival account;
- Josephine's three-to-four-minute response estimate.

It records two governed edges, freezes three distinct exact source segments, verifies idempotent replay, and confirms zero canonical event, entity, SAME, or source mutation side effects. The browser acceptance verifies the graph, history, action path, and exact Court Record jump to Hall's “Seven to 10 minutes” segment.

## Follow-on boundary

The next slice is the Reconstruction editor and immutable v2 publishing/diff contract. It may consume reviewed Reconcile groups as analytical input, but it must preserve attribution, unresolved tensions, exact source lineage, and the same zero-silent-promotion boundaries.
