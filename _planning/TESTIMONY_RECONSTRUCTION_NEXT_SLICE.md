# Testimony Reconstruction — next slice

Status: planned after Reconstruction v1 read-only acceptance

## Current proven baseline

- Six Day 3 first-responder witness lanes
- 25 reviewed, source-linked event assertions
- 10 proposed incident nodes across five lanes
- Nine explicit before/overlap constraints
- Four unresolved tensions
- Immutable, case-scoped saved versions with four-way comparison
- Zero canonical events, zero SAME resolutions, and zero courtroom-timestamp substitutions

## Next slice: reconstruction editor and review contract

Build an authorized editor over the saved-snapshot contract. A researcher should be able to create a draft from a prior version, reorder or regroup assertion references, add or remove a proposed edge, record a tension, and save the result as a new immutable version.

### Required behavior

1. A draft starts from an explicit saved version and never mutates that version.
2. Only existing, case-visible Event Candidate and Temporal Assertion UUIDs can enter a reconstruction.
3. Each node retains every referenced witness assertion and exact source segment.
4. `before` edges remain acyclic; `overlaps`, `during`, and `same_episode_candidate` stay analytically distinct.
5. Exact event time may come only from a reviewed temporal assertion or a separately cited external clock source.
6. A disagreement cannot be dismissed by editing a node. It must be resolved through a reviewed tension decision with rationale and audit history.
7. Saving creates the next immutable version and records the parent version, actor, source snapshot hash, and change note.
8. No editor action promotes a candidate to a canonical event or resolves an entity.

### Proposed schema addition

- `reconstruction_drafts`: mutable per-user working state, case-scoped by RLS.
- `reconstruction_draft_versions`: append-only draft changes for recovery and audit.
- Extend `saved_reconstruction_versions` with nullable `parent_version_id` and a structured change summary.
- Atomic RPCs for creating a draft, updating it with optimistic concurrency, and publishing a new immutable version.

### UI slice

- Draft/source version selector
- Incident spine with drag-free accessible move controls
- Witness assertion tray filtered by witness, precision, and unresolved tension
- Edge editor with cycle validation before save
- Side-by-side source inspector
- Version diff showing nodes, assertions, edges, time labels, and tensions added/removed/changed

### Acceptance demo

1. Open Day 3 Reconstruction v1.
2. Create a draft from v1.
3. Split one node without changing its source assertions.
4. Add one proposed `before` edge; verify a cycle is rejected.
5. Preserve the Dawson-carrier disagreement as unresolved.
6. Save as v2 with a change note.
7. Compare v1 and v2 side by side.
8. Jump from both versions to the exact canonical testimony.
9. Verify v1 is byte-for-byte unchanged.
10. Verify an outsider cannot read the draft or either saved version.

## Deferred

- Canonical event promotion
- SAME/entity resolution
- Credibility scoring
- Automatic contradiction adjudication
- Probabilistic reconstruction
- Minute-level clock anchoring without external dispatch or device records
