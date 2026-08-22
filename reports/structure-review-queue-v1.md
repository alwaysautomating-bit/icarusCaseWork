# Structure Review Queue v1 — Acceptance Report

Date: 2026-08-22

Status: passed locally

## Delivered boundary

The governed middle layer now supports source-visible human review of knowledge items, claims, entity mentions, event candidates, temporal assertions, knowledge relationships, and knowledge flags. Owners and reviewers may accept, amend, reject, or defer. Researchers and viewers remain read-only.

Every successful decision updates the eligible candidate, appends an immutable `structure_review_versions` row, and appends the case ledger in one database transaction. Expected-version checks prevent silent concurrent overwrites. Source text, source IDs, canonical links, extraction IDs, reconciled events, and resolved entities are not client-editable.

## Live Day 6 demonstration

- Case: Commonwealth v. Lindsay M. Clancy — Day 6 acceptance corpus
- Target: event candidate `8cd80bee-5281-5c3a-a967-3d0eeeaf5c94`
- Supporting sources compared: 4
- Action: amend
- Previous status: pending
- Resulting status: amended
- Immutable version: 1
- Case-ledger logical order: 233
- Canonical events created: 0
- Saved reconstruction versions after review: 1

The review clarified that the 82.1°F number appeared in the examiner's question and was not independently affirmed by the witness. The next pending event was selected with the active event/pending filters preserved. `Jump to Segment` opened the exact canonical segment and browser Back returned to the queue. The older review version displays actor, timestamp, rationale, and field-level before/after values.

An existing viewer account could read the queue, candidate, history, and complete source comparison, but received the read-only membership state instead of decision controls. Database tests separately cover reviewer success plus researcher, viewer, outsider, and anonymous denial.

## Verification

- Full Docker-backed Supabase reset replay: passed
- Local corpus backup/restore after reset: counts matched, including 29,757 source segments
- Migration list: 16 local migrations through `20260822204848_protect_legacy_claim_promotion.sql`
- Database lint: no issues
- Database advisors: no issues
- ESLint: passed
- TypeScript: passed
- Vitest: 23 files, 101 tests passed
- Next.js 16.3 production build: passed
- Authenticated browser acceptance: passed

## Preserved non-goals

The slice creates no canonical events, performs no entity merge or SAME resolution, does not adjudicate contradictions, does not infer credibility or evidentiary weight, and does not mutate saved timeline or reconstruction snapshots.

Direct authenticated writes to all seven review targets are denied. The pre-existing claim-to-event promotion action remains a separate legacy workflow behind its own atomic RPC; it is neither exposed nor invoked by the Structure Review queue.
