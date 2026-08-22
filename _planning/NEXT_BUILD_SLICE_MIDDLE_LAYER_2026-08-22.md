# Next Build Slice — Governed Structure Review Middle Layer

Date: 2026-08-22

Status: next approved implementation slice

Canonical technical specification: `STRUCTURE_REVIEW_QUEUE_V1.md`

## Outcome

Build the missing governed middle layer between source-backed extraction and analytical reconstruction:

```text
Canonical source
  -> extracted structural candidate
  -> complete source comparison
  -> authorized human decision
  -> immutable review version and audit event
  -> reviewed candidate available to graph/reconstruction
```

An owner or reviewer must be able to accept, amend, reject, or defer a candidate without rewriting source evidence, silently resolving identity, promoting a canonical event, or changing a previously saved timeline or reconstruction snapshot.

## Why this slice is next

The Court Record and read-only Structure workspace already expose canonical source lineage. Timeline and Reconstruction acceptance slices already demonstrate how reviewed candidate data can be compiled into useful analytical views. What is missing is the production human workflow that governs the transition from extracted candidate to reviewed candidate.

Building the review queue before the interactive graph or Reconstruction editor prevents those later interfaces from depending on code-authored acceptance fixtures as their normal operating path.

## Scope

### Included

- Case-scoped route `/cases/[caseId]/structure/review`.
- Queue filters and selected-object state encoded in the URL.
- Review of knowledge items, claims, entity mentions, event candidates, temporal assertions, knowledge relationships, and knowledge flags.
- Accept, amend, reject, and defer decisions.
- Type-specific amendment allowlists.
- Complete supporting-source comparison before submission.
- Immutable review versions with before state, patch, after state, rationale, actor, timestamp, and source-segment snapshot.
- Atomic target-status update, review-version append, and case-ledger append.
- Optimistic concurrency and typed stale-version errors.
- Owner/reviewer mutation permission; researcher/viewer read-only behavior.
- Exact `Jump to Segment` return to the Court Record.
- Fix and regression coverage for the existing `review_extraction_candidate` UUID-array database-lint warning.

### Excluded

- Canonical event promotion.
- Entity merge or SAME resolution.
- Interactive graph visualization.
- Automated contradiction adjudication.
- Reconstruction editing.
- Actor-knowledge inference.
- Credibility, truthfulness, guilt, diagnosis, admissibility, or evidentiary-weight scoring.
- Hosted deployment.

## Delivery phases

### Phase 1 — Persistence and authorization

1. Generate the versioned Supabase migration with the pinned CLI.
2. Add append-only `structure_review_versions` with indexes, RLS, and explicit grants.
3. Add the case-membership authorization helper using database roles, never user metadata.
4. Add the atomic `review_structure_object` RPC with row locking, case validation, field allowlists, server-captured source lineage, and expected-version checks.
5. Append the human decision to the case ledger in the same transaction.
6. Correct the legacy UUID-array lint warning without changing the legacy review contract.

Exit gate: migration replay, role/RLS tests, concurrency tests, audit tests, clean database lint, and clean advisors.

### Phase 2 — Shared loader and URL contract

1. Reuse the normalized objects from `case-structure.ts` instead of building a parallel object model.
2. Add review eligibility, authoritative membership permission, current review version, history, queue counts, and deterministic ordering.
3. Add route helpers for type, object, source segment, proceeding, status, asserted-by, unresolved-only, and temporal-only state.
4. Return next and previous eligible objects without losing active filters.

Exit gate: route round-trip tests, deterministic ordering, cross-case isolation, and unavailable-object behavior.

### Phase 3 — Review workspace

Build the established three-pane evidence workflow:

1. Queue and filter pane.
2. Candidate fields, immutable history, field-level differences, and decision form.
3. Complete ordered source comparison with exact testimony, proceeding, speaker, locator, artifact hash, and Court Record links.
4. Success, validation, permission, empty-queue, and stale-version states.
5. Preserve filters and selection through refresh, copied URLs, and browser Back/Forward.

Exit gate: an owner/reviewer can complete a decision; a researcher/viewer can inspect but cannot mutate; outsider and anonymous access remain denied.

### Phase 4 — Acceptance and checkpoint

1. Run a full local Supabase reset from committed migrations.
2. Run migration listing, database lint, and advisors.
3. Run ESLint, TypeScript, all tests, and the production build.
4. Complete an authenticated browser acceptance against the Docker-backed local Supabase stack.
5. Confirm saved timeline and reconstruction versions remain byte-for-byte unchanged.
6. Confirm review creates zero canonical events and zero SAME resolutions.
7. Commit the completed slice as an independently reversible checkpoint.

## Required acceptance demonstration

1. Sign in as a case owner or reviewer.
2. Open the Structure review queue for the canonical case.
3. Filter to pending Day 6 event candidates.
4. Select a candidate and inspect every supporting testimony segment.
5. Amend an allowlisted descriptive field and provide a rationale.
6. Save and observe the resulting status, immutable version, actor, before/after difference, and case-ledger entry.
7. Confirm the next pending object is selected without losing filters.
8. Jump to the exact Court Record segment and return with browser Back.
9. Open an older saved timeline/reconstruction snapshot and confirm it did not change.
10. Confirm a researcher and viewer cannot mutate; confirm outsider and anonymous users cannot retrieve protected review data.

## Follow-on sequence

After this slice passes its acceptance gate:

1. Build interactive graph, clustering, lineage, conflicts, and the Reconcile workspace over reviewed candidates.
2. Build the Reconstruction editor and immutable v2 publishing/diff contract.
3. Define and implement Actor Knowledge, knowledge origin, disclosure, and corroboration.
4. Build the operational Evidence Gaps/Acquisition workspace.
5. Build cited narratives, Case Context Pack, and versioned research outputs.

## Completion boundary

This slice is complete only when a consequential structural review decision is source-visible, explicitly human, atomic, immutable, case-scoped, concurrency-safe, and auditable—without modifying source evidence, manufacturing certainty, creating canonical events, resolving entity identity, or rewriting historical analytical snapshots.
