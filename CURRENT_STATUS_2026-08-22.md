# Icarus Casework — Current Status

Date: 2026-08-22

## Executive position

Icarus Casework has a working, local, source-grounded evidence-navigation spine. Phase 0/Foundation, Court Record, testimony search, canonical source navigation, read-only Structure, testimony timeline candidates, immutable timeline views, and the first read-only Testimony Reconstruction slice are implemented.

The product is now at the middle analytical layer between source retrieval and higher-order reasoning. The next requirement is a governed human review workflow for structural candidates. Interactive graph/reconciliation, editable reconstruction, Actor Knowledge, operational Evidence Gaps, Outputs, and hosted release work remain after that boundary.

## Capability status

| Capability | Status | Current boundary |
| --- | --- | --- |
| Explicit case shell and routing | Complete locally | Active case is URL-addressed; case creation and switching are available. |
| Foundation / Phase 0 | Complete for the first vertical slice | Case definition, source inventory, proceedings/speakers, entities/aliases, provisional T0, event/temporal skeleton, and deterministic readiness are production-backed. Durable versioned T0 remains deferred. |
| Court Record | Complete locally | Canonical, windowed transcript reader with exact segment highlighting, surrounding context, provenance, and linked structure. |
| Testimony search | Complete locally | RLS-aware lexical FTS, natural-question normalization, and trigram/fuzzy retrieval over the canonical corpus. Search returns source testimony, not generated answers. |
| Search to canonical source | Complete locally | Search state and `source_segments.id` are URL-backed and survive reload and browser history. |
| Read-only Structure workspace | Complete for browsing | Knowledge items, claims, event candidates, temporal assertions, entity mentions, canonical entities, relationships, and flags are filterable and source-linked. |
| Structure review workflow | Planned, not built | No unified accept/amend/reject/defer workflow exists yet for knowledge-mapping objects. |
| Interactive graph and Reconcile | Not built | Source-backed data and route seams exist, but no graph, clustering, conflict, or derivation-lineage workspace exists. |
| Timeline Candidate Compiler v1 | Complete as a reviewed acceptance slice | Day 6 Maureen Hartnett acceptance produced 12 event candidates and 12 temporal assertions with zero canonical-event or SAME promotion. |
| Immutable timeline views | Complete locally | Saved case-scoped snapshots can be compared four at a time. |
| Testimony Reconstruction v1 | Complete as a read-only acceptance slice | Day 3 first-responder testimony is compiled into source-linked proposed nodes, lanes, constraints, tensions, and immutable comparison versions. |
| Reconstruction editor | Planned, not built | Drafting, regrouping, edge editing, cycle checks, reviewed tension decisions, change notes, and version diffs remain. |
| Actor Knowledge | Not built | Knowledge-state, acquisition/origin, disclosure, corroboration, and timepoint inspection require a dedicated contract and UI. |
| Evidence Gaps | Partial | Foundation exposes existing acquisition records and knowledge flags; a dedicated operational Gaps workspace is not built. |
| Outputs / Case Context Pack | Not built | Cited narrative, research packet, export manifests, and agent context remain future slices. |
| Hosted release | Not complete | The full Supabase stack is verified locally through Docker. Hosted Supabase, OAuth credentials, private deployed object storage, and deployment acceptance remain separate gates. |

## Canonical corpus and acceptance evidence

- Canonical testimony corpus: 14 proceedings and approximately 27,150 committed source segments.
- Day 6 Timeline Candidate Compiler acceptance: 488-segment Maureen Hartnett witness block; 11 reviewed testimony units, 12 event candidates, 12 temporal assertions, 19 unresolved entity mentions, zero canonical events, and zero SAME resolutions.
- Day 3 Reconstruction v1: 1,873 source segments; six witness lanes; 25 reviewed assertions; 10 proposed reconstruction nodes across five incident lanes; nine ordering/overlap constraints; four unresolved tensions; zero canonical events; zero SAME resolutions; zero testimony timestamps used as event time.
- Reconstruction versions are immutable, case-scoped, source-linked, and comparable four at a time.

## Epistemic boundary

- Source evidence, attributed claims, candidates, temporal assertions, reconstruction proposals, canonical events, and findings remain distinct.
- Search retrieves real testimony and does not produce generated case answers.
- Transcript/proceeding timestamps remain source provenance and are not substituted for real-world event time.
- Candidate review does not automatically create canonical events or resolve entity identity.
- Uncertainty, competing temporal assertions, attribution differences, and unresolved tensions remain visible.

## Verification at this checkpoint

- ESLint: passed.
- TypeScript: passed.
- Vitest: 21 files and 95 tests passed.
- Next.js 16.3 production build: passed.
- Local Supabase migration chain: 14 migrations applied through `20260822143000_testimony_reconstruction_versions_v1.sql`.
- Supabase database advisors: no issues.
- Database lint: one existing warning remains in `public.review_extraction_candidate` for a text-to-`uuid[]` initialization. It predates Reconstruction v1 and is included in the next Structure review migration plan.

## Repository checkpoint

- Reconstruction v1, migration `20260822143000_testimony_reconstruction_versions_v1.sql`, acceptance reports, documentation, and reviewed Supabase Studio query snippets are included in Git history.
- The `codex/provisional-t0` feature history is merged into `main` for this checkpoint.
- The intended completion state is a clean working tree with no untracked files.

## Next delivery boundary

The next build slice is the Structure Review Queue middle layer: an authenticated, case-scoped, immutable and auditable workflow for reviewing every supported structural candidate beside its complete source lineage. Its execution plan is `_planning/NEXT_BUILD_SLICE_MIDDLE_LAYER_2026-08-22.md`; the detailed technical contract remains `_planning/STRUCTURE_REVIEW_QUEUE_V1.md`.
