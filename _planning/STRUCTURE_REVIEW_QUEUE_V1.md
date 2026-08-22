# Structure Review Queue v1

Status: implemented and accepted locally on 2026-08-22

Prepared: 2026-08-22

Depends on: canonical testimony corpus, Court Record ↔ Structure lineage, Timeline Candidate Compiler v1, saved timeline view versions, and the Supabase operations contract

## Outcome

Build a case-scoped human review queue where an authorized reviewer can inspect a structural candidate beside every supporting source, then accept, amend, reject, or defer it through an immutable, audited decision.

The slice completes this loop:

```text
Pending structural candidate
  -> inspect current fields and extraction provenance
  -> compare every cited source segment
  -> record accept / amend / reject / defer
  -> append immutable review version and case-ledger event
  -> update candidate review status atomically
  -> remain on the next reviewable object without losing filters
```

This is a review workflow, not a graph, event promotion system, entity resolution system, or Reconstruction timeline.

## Current-state findings

- `/cases/[caseId]/structure` is a read-only, source-backed object browser.
- The loader already normalizes knowledge items, claims, entity mentions, event candidates, temporal assertions, relationships, flags, and canonical entities.
- Every selected object can expose exact source segments, extraction metadata, provenance, and case-ledger history.
- `extraction_candidates` already have a versioned compiler-review workflow through `review_extraction_candidate`, but that RPC does not review knowledge-mapping objects.
- `review_decisions` applies only to claims and does not provide a common version contract for the Structure workspace.
- `knowledge_item_versions` versions only knowledge items.
- Knowledge-mapping tables are intentionally SELECT-only for `authenticated`; direct client updates are not an acceptable review path.
- Review status representation differs by object type:
  - Knowledge objects generally use `review_status`.
  - Claims use the `claim_status` enum.
  - Flags use `status`.
  - Canonical entities do not have a candidate review state.
- The known database-lint warning is in the legacy `review_extraction_candidate` function's text-to-`uuid[]` initialization.

## Product decisions

1. Add a dedicated route at `/cases/[caseId]/structure/review` and keep the existing Structure browser read-only.
2. Owners and reviewers may record decisions. Researchers and viewers remain read-only.
3. Review actions are `accept`, `amend`, `reject`, and `defer`.
4. Every action requires a rationale for `amend`, `reject`, or `defer`; accept may include an optional note.
5. Every decision creates an immutable version containing the before state, requested patch, resulting state, actor, timestamp, and source-segment snapshot.
6. The decision and target status update occur in one database transaction.
7. Source IDs, source text, case ownership, object UUIDs, extraction-run IDs, logical order, and canonical links are never editable through this workflow.
8. Review does not promote an event candidate to `events`.
9. Review does not set `reconciled_event_id` or resolve an entity mention to a canonical entity.
10. Review does not mutate saved timeline snapshots. Saved versions remain historical views of the state captured at save time.
11. Optimistic concurrency prevents one reviewer from silently overwriting another review.
12. The database membership role—not application `user_metadata` or the current `CaseActor.role` placeholder—is authoritative for review permission.

## Reviewable objects

| Structure type | Database target | Actions | Amendable fields in v1 | Explicitly immutable or deferred |
| --- | --- | --- | --- | --- |
| Knowledge item | `knowledge_items` | accept, amend, reject, defer | `summary`, `unknowns` | Source links, witness identity resolution, extraction metadata |
| Claim | `claims` | accept, amend, reject, defer | `normalized_assertion`, `assertion_status`, `information_basis` | Source quote, source segments, claimant identity, event promotion |
| Entity mention | `entity_mentions` | accept, amend, reject, defer | `normalized_candidate`, `mention_type` | `resolved_entity_id`, SAME resolution |
| Event candidate | `event_candidates` | accept, amend, reject, defer | `neutral_description`, `participant_mentions` | Source claims, `reconciled_event_id`, canonical event creation |
| Temporal assertion | `temporal_assertions` | accept, amend, reject, defer | Derived date/time, precision, qualification, bounds, duration, recurrence, relative and sequence fields | Raw source wording, source segments, event identity |
| Relationship | `knowledge_relationships` | accept, amend, reject, defer | `relation_type`, `assertion_status` | From/to node IDs, source claim, knowledge item, source |
| Flag | `knowledge_flags` | accept, amend, reject, defer | `rationale`, `supporting_context` | Target identity; resolving the underlying issue |
| Canonical entity | `entities` | none | None | Canonical entities remain read-only in this slice |

Objects in terminal or separately governed states are not placed in the default queue:

- Rejected objects remain inspectable through filters but are not pending.
- Reconciled event candidates are read-only here.
- Canonical, court-found, and stipulated objects are not candidate-review targets.
- Flags marked resolved are historical results, not pending candidates.

## Status mapping

The immutable decision action is the cross-object truth. The RPC maps it to each target table's existing status vocabulary:

| Action | General `review_status` | Claim `status` | Flag `status` |
| --- | --- | --- | --- |
| accept | `accepted` | `accepted` | `accepted` |
| amend | `amended` | `accepted` | `accepted` |
| reject | `rejected` | `rejected` | `rejected` |
| defer | `deferred` | `deferred` | `deferred` |

The review-version row preserves `action = amend` even where a legacy target column cannot distinguish amended acceptance.

## Database design

Create the migration with the pinned CLI before writing SQL:

```powershell
pnpm exec supabase migration new structure_review_queue_v1
```

### `public.structure_review_versions`

Add an append-only table with:

- `id uuid primary key default gen_random_uuid()`
- `case_id uuid not null`
- `target_type text not null` constrained to the seven reviewable types
- `target_id uuid not null`
- `version integer not null check (version > 0)`
- `action text not null` constrained to accept/amend/reject/defer
- `previous_status text not null`
- `resulting_status text not null`
- `before_state jsonb not null`
- `patch jsonb not null default '{}'`
- `after_state jsonb not null`
- `note text not null default ''`
- `source_segment_ids uuid[] not null`
- `reviewed_by_user_id uuid not null references auth.users(id)`
- `ledger_logical_order bigint not null`
- `reviewed_at timestamptz not null default now()`
- unique `(case_id, target_type, target_id, version)`

Indexes:

- `(case_id, reviewed_at desc)` for recent case activity
- `(case_id, target_type, resulting_status, reviewed_at desc)` for queue/history filters
- `(target_type, target_id, version desc)` for inspector history

The table is append-only to authenticated users. Enable RLS, grant case-scoped SELECT, and revoke direct INSERT, UPDATE, and DELETE. Writes occur only through the controlled RPC.

### Review authorization helper

Add `private.can_review_case(target_case_id uuid)`:

- `SECURITY DEFINER`
- fixed empty `search_path`
- checks `(select auth.uid())`
- returns true only for `case_members.role in ('owner', 'reviewer')`
- revoked from `PUBLIC` and `anon`
- callable only where needed by the review mutation path

Do not authorize from user metadata.

### Mutation API

Expose one authenticated RPC:

```text
public.review_structure_object(
  p_case_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_action text,
  p_patch jsonb,
  p_note text,
  p_expected_version integer
) returns jsonb
```

Preferred security shape:

- Public `SECURITY INVOKER` wrapper for the Data API contract.
- Private, fixed-search-path mutation core with the minimum required definer privileges.
- Explicitly revoke default execution from `PUBLIC` and `anon`.
- Grant only the intended entry point to `authenticated`.

The mutation core must:

1. Require a signed-in actor.
2. Require `private.can_review_case(p_case_id)`.
3. Validate the target type and action.
4. Lock the target row with `FOR UPDATE` and confirm it belongs to the case.
5. Reject canonical, reconciled, resolved, or otherwise ineligible targets.
6. Load the latest review version and compare it with `p_expected_version`.
7. Reject stale submissions with a typed concurrency error.
8. Validate `p_patch` against a type-specific allowlist.
9. Require a note for amend, reject, and defer.
10. Capture the authoritative before state and source-segment IDs server-side.
11. Apply only allowlisted fields and the mapped status.
12. Capture the authoritative after state.
13. Append a `case_ledger` entry through `private.append_case_ledger` with the human actor and review action.
14. Insert the immutable `structure_review_versions` row.
15. Return target ID, target type, version, resulting status, ledger order, and review timestamp.

No client-provided source IDs, before state, after state, actor ID, or resulting status are trusted.

### Legacy review warning

Correct the explicit text-to-`uuid[]` initialization in `review_extraction_candidate` in the same reviewed migration or in a preceding narrowly scoped migration. Preserve the legacy RPC's behavior and add a regression assertion so database lint becomes clean.

## Application data contract

Extend `StructureObject` and `StructureWorkspace` with:

- `reviewable: boolean`
- `reviewPermission: 'review' | 'read_only'`
- `reviewVersion: number`
- `reviewHistory: StructureReviewVersion[]`
- `queueCounts` by object type and pending/deferred status

The loader must retrieve the actor's actual `case_members.role`. Do not use the hard-coded `CaseActor.role` field for authorization or UI permission.

Add a queue loader in `src/lib/structure-review.ts` that:

- Reuses the normalized source-backed objects from `case-structure.ts` rather than rebuilding a second object model.
- Filters only reviewable candidates.
- Orders by proceeding date, object logical order, and UUID as a stable tie-breaker.
- Supports object type, proceeding, status, asserted-by, unresolved-only, temporal-only, and source-segment filters.
- Loads the latest review version and complete history for the selected object.
- Returns the next and previous reviewable object IDs under the active filter set.
- Never substitutes an object from another case or fixture.

## Route and URL contract

Add:

```text
/cases/[caseId]/structure/review
  ?type=event
  &object=<object-uuid>
  &segment=<source-segment-uuid>
  &proceeding=<proceeding-uuid>
  &status=pending
  &assertedBy=<actor>
  &unresolved=1
  &temporal=1
```

Add `structureReviewHref` and parser tests in `src/lib/case-routes.ts`.

Filters and selection remain URL-backed so refresh, Back/Forward, and copied links preserve review context. After a successful action, redirect to the next eligible object under the same filters and include a short success notice in URL state or a server-rendered result banner.

## Screen design

Use the established three-pane evidence workspace:

```text
Review queue | Candidate + decision form | Complete source comparison
```

### Queue pane

- Pending count and counts by object type.
- Stable queue position such as `4 of 12`.
- Review state, proceeding, speaker, confidence, unresolved and temporal indicators.
- Selected object remains bookmarkable.
- Deferred and rejected candidates are available through explicit filters.

### Candidate and decision pane

- Object UUID, code, current status, extraction run, and compiler contract.
- Current structured fields.
- Previous review versions with actor, timestamp, action, note, and field-level before/after differences.
- Accept, amend, reject, and defer controls.
- Amendment inputs only for the allowlisted fields of the selected object type.
- Clear text that extraction confidence is not evidentiary weight.
- Clear text that acceptance does not make an event canonical or resolve an entity.

### Source pane

- Every supporting source segment in recorded order.
- Exact text, speaker, proceeding, timestamp, artifact hash, and locator.
- Active source selection and `Jump to Segment` links.
- Multi-source comparison without selecting a hidden primary source.
- Source pane remains visible before the decision controls can submit.

## Server Action

Add `reviewStructureObjectAction` in the review route:

- Authenticate with `requireCaseActor` for session presence.
- Validate all form values with Zod.
- Load the case and membership role for a friendly authorization failure.
- Call only `review_structure_object`; do not issue direct target-table updates.
- Map known RPC validation and concurrency errors to user-visible form state.
- Revalidate both Structure and review routes.
- Redirect to the next queue item only after a confirmed database result.
- Preserve active filters, selected source segment where applicable, and Court Record query state.

The database remains the final authorization boundary.

## Expected files

Create:

- `supabase/migrations/<timestamp>_structure_review_queue_v1.sql`
- `src/lib/structure-review.ts`
- `src/lib/structure-review.test.ts`
- `src/app/cases/[caseId]/structure/review/page.tsx`
- `src/app/cases/[caseId]/structure/review/loading.tsx`
- `src/app/cases/[caseId]/structure/review/error.tsx`
- `src/app/cases/[caseId]/structure/review/actions.ts`
- `src/app/cases/[caseId]/structure/review/_components/review-queue.tsx`
- `src/app/cases/[caseId]/structure/review/_components/review-form.tsx`
- `src/app/cases/[caseId]/structure/review/_components/review-history.tsx`
- `src/app/cases/[caseId]/structure/review/_components/review-source-comparison.tsx`
- `src/db/structure-review-persistence.test.ts`

Modify:

- `src/lib/case-structure.ts` to expose reusable normalized objects and review history metadata.
- `src/lib/case-routes.ts` and its tests for the review URL contract.
- `src/lib/case-access.ts` if a typed membership-role helper is needed.
- `src/app/cases/[caseId]/structure/page.tsx` to link to the review queue without making the page mutable.
- `src/app/cases/[caseId]/structure/_components/structure-inspector.tsx` to show immutable review history.
- `src/app/cases/[caseId]/layout.tsx` to expose review navigation only to eligible roles.
- `src/app/case-workspace.css` for queue, form, diff, history, and responsive source comparison styles.
- `src/db/case-workspace-rls.test.ts` for reviewer/researcher/viewer boundaries.
- `src/db/supabase-migration.test.ts` for zero-state replay and review-function contracts.
- `SUPABASE_OPERATIONS.md` only if the migration introduces a new operational requirement.

## Implementation sequence

### Phase 1 — Persistence and security

1. Generate the migration with the CLI.
2. Add the review-version table, indexes, RLS, grants, authorization helper, and atomic RPC.
3. Add type-specific patch validation and source capture.
4. Append case-ledger history.
5. Correct the legacy UUID-array lint warning.
6. Apply locally without destructive data loss during iteration, then prove full reset replay before completion.

### Phase 2 — Loader and routes

1. Extract reusable normalized Structure-object loading.
2. Add review eligibility, membership permission, latest version, history, and queue counts.
3. Add review route helpers and URL-state tests.
4. Prove cross-case and malformed UUID behavior remains indistinguishable from unavailable data.

### Phase 3 — Review UI

1. Build the queue and selection flow.
2. Build complete source comparison.
3. Build type-specific amendment forms.
4. Add immutable history and field-level differences.
5. Add success, validation, stale-version, and permission states.
6. Preserve Back/Forward and `Jump to Segment` behavior.

### Phase 4 — Verification and acceptance

1. Add persistence, concurrency, role, RLS, and audit tests.
2. Run database reset, migration list, lint, and advisors.
3. Run ESLint, TypeScript, all tests, and production build.
4. Verify an authenticated review flow in the browser against local Supabase.
5. Verify a researcher, viewer, outsider, and anonymous actor cannot mutate review state.

## Required tests

### Database and RPC

- Owner can review a candidate in their case.
- Reviewer can review a candidate in their case.
- Researcher and viewer can read but cannot review.
- Outsider and anonymous actors cannot read review history or mutate a target.
- Cross-case target IDs are rejected without leaking target existence.
- Accept updates status and appends exactly one immutable version.
- Amend updates only allowlisted fields.
- Reject and defer require a note.
- Source-segment IDs in the version are captured server-side.
- Client attempts to alter source IDs, canonical links, extraction IDs, object IDs, case IDs, or logical order are rejected.
- Stale `p_expected_version` is rejected without partial writes.
- Replaying a completed request with a stale version does not duplicate history.
- Case-ledger order remains contiguous.
- Event review creates zero canonical events.
- Entity-mention review creates zero entities and zero SAME resolutions.
- Saved timeline snapshots remain unchanged after later live reviews.
- Direct authenticated writes to the review-version and target tables remain denied.
- Migration applies from zero.
- Database lint and advisors pass without the current UUID-array warning.

### Application

- Review URLs round-trip every supported filter.
- Queue order is deterministic.
- Successful actions select the next eligible candidate while preserving filters.
- The final item produces an honest empty-queue state.
- Invalid, cross-case, or RLS-hidden objects produce the unavailable state.
- All supporting sources are visible before review.
- `Jump to Segment` returns to the exact highlighted Court Record segment.
- Back/Forward restores candidate and source selection.
- Permission state hides mutation controls but not authorized read-only Structure access.

## Acceptance demo

The slice ships when this exact flow works:

1. Sign in as a case owner or reviewer.
2. Open the Structure review queue for the canonical case.
3. Filter to pending event candidates from Day 6.
4. Select one candidate and inspect every supporting testimony segment.
5. Amend an allowlisted descriptive field and provide a rationale.
6. Save the review.
7. See the new status, immutable version, actor, before/after difference, and case-ledger entry.
8. Confirm the next pending candidate is selected without losing filters.
9. Jump from a supporting source to the exact Court Record segment and return with Back.
10. Open a saved timeline snapshot and confirm it still shows the historical captured state.
11. Confirm no canonical event or SAME resolution was created.
12. Sign in as a researcher or viewer and confirm the same evidence is readable but review controls and RPC mutation are denied.
13. Confirm an outsider and anonymous actor cannot retrieve the candidate, sources, or review history.

## Verification commands

```powershell
pnpm exec supabase db reset --local
pnpm exec supabase migration list --local
pnpm supabase:lint
pnpm supabase:advisors
pnpm verify
```

Run an authenticated browser acceptance against the local Docker-backed Supabase stack after the automated suite.

## Non-goals

- Interactive graph visualization.
- Event-candidate reconciliation or canonical event creation.
- Entity merge or SAME resolution.
- Actor-knowledge inference.
- Automated credibility, truth, guilt, diagnosis, admissibility, or evidentiary-weight judgments.
- Bulk auto-acceptance.
- AI-generated amendment text submitted without human confirmation.
- Editing source text, source locators, artifact hashes, or provenance.
- Replacing or rewriting previously saved timeline snapshots.
- Hosted deployment.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Generic review RPC updates the wrong table or field | Evidence mutation outside the intended contract | Strict target registry, type-specific SQL branches, row lock, case check, allowlisted patches, persistence tests |
| Concurrent reviewers overwrite one another | Lost review reasoning | Expected-version check and target row lock |
| UI role check is mistaken for authorization | Unauthorized mutation | Database membership helper and RPC enforcement remain authoritative |
| Amendment rewrites provenance | Loss of source fidelity | Source text and lineage columns are immutable; source snapshot is captured server-side |
| Acceptance is mistaken for canonical truth | Epistemic overclaim | Preserve candidate terminology and explicitly prohibit promotion in RPC and UI |
| Saved timeline views appear to change | Historical comparison loses meaning | Snapshots remain immutable JSON; live review changes only current objects |
| Existing review systems diverge | Confusing parallel semantics | Treat unified Structure review versions as the new workspace contract; document legacy compiler and claim review tables as separate workflows |
| Large queue becomes slow | Reviewer friction | Indexed case/type/status history and paginated candidate loading if production counts require it |

## Completion boundary

The slice is complete when authorized human decisions are atomic, immutable, source-visible, case-scoped, concurrency-safe, and auditable across all seven candidate object types—without creating canonical events, resolving entities, modifying source evidence, or changing saved timeline snapshots.

Implementation note (2026-08-22): direct authenticated claim mutations were removed in the follow-on migration `20260822204848_protect_legacy_claim_promotion.sql`. The older claim-to-event action is preserved behind the separate atomic `review_and_promote_claim` RPC and remains outside this slice's UI and `review_structure_object` contract.
