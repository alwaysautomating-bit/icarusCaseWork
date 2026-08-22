# Icarus Casework — Current Status

Date: 2026-08-22

## Executive position

Icarus Casework has a working, local, source-grounded evidence-navigation spine. Phase 0/Foundation, the Trial Navigation Index, Court Record, testimony search, canonical source navigation, read-only Structure, governed Structure review, testimony timeline candidates, immutable timeline views, and the first read-only Testimony Reconstruction slice are implemented.

The governed middle layer between extraction and downstream analysis now exists. The next requirement is the interactive graph and Reconcile workspace over reviewed candidates. Editable reconstruction, Actor Knowledge, operational Evidence Gaps, Outputs, and hosted release work remain after that boundary.

## Capability status

| Capability | Status | Current boundary |
| --- | --- | --- |
| Explicit case shell and routing | Complete locally | Active case is URL-addressed; case creation and switching are available. |
| Foundation / Phase 0 | Complete for the first vertical slice | Case definition, source inventory, proceedings/speakers, entities/aliases, provisional T0, event/temporal skeleton, and deterministic readiness are production-backed. Durable versioned T0 remains deferred. |
| Trial Navigation Index | Complete locally | Historical and live cases can maintain trial day/date, witness, general topic, phase, status, references, and canonical proceeding links. It is searchable, immutable-versioned, owner/reviewer managed, and explicitly never evidence or reconstruction input. |
| Court Record | Complete locally | Canonical, windowed transcript reader with exact segment highlighting, surrounding context, provenance, and linked structure. |
| Testimony search | Complete locally | RLS-aware lexical FTS, natural-question normalization, and trigram/fuzzy retrieval over the canonical corpus. Search returns source testimony, not generated answers. |
| Search to canonical source | Complete locally | Search state and `source_segments.id` are URL-backed and survive reload and browser history. |
| Read-only Structure workspace | Complete for browsing | Knowledge items, claims, event candidates, temporal assertions, entity mentions, canonical entities, relationships, and flags are filterable and source-linked. |
| Structure review workflow | Complete locally | Owners/reviewers can accept, amend, reject, or defer seven candidate types beside complete source lineage; decisions are atomic, immutable, concurrency-safe, and case-ledger audited. Researchers/viewers remain read-only. |
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
- Structure Review v1 browser acceptance: one four-source Day 6 event amendment recorded as immutable version 1 and ledger order 233; the next pending event remained selected under the same filters; the exact Court Record jump and browser Back path passed; viewer mutation controls remained unavailable.
- Trial Navigation Index acceptance: 18 days, 14 canonical proceeding links, four editorial-only days, 36 witness entries, and 54 topic entries. “Apple Watch” located Day 14 and its canonical link opened the matching Court Record proceeding. Day 1’s date disagreement remains visibly preserved; Day 18’s corrected current state is immutable version 3.

## Epistemic boundary

- Source evidence, attributed claims, candidates, temporal assertions, reconstruction proposals, canonical events, and findings remain distinct.
- Search retrieves real testimony and does not produce generated case answers.
- Transcript/proceeding timestamps remain source provenance and are not substituted for real-world event time.
- Candidate review does not automatically create canonical events or resolve entity identity.
- Trial-index summaries and reporting references are navigation-only and never become claims, findings, canonical events, or reconstruction input.
- Uncertainty, competing temporal assertions, attribution differences, and unresolved tensions remain visible.

## Verification at this checkpoint

- ESLint: passed.
- TypeScript: passed.
- Vitest: 25 files and 106 tests passed.
- Next.js 16.3 production build: passed.
- Local Supabase migration chain: 17 migrations applied through `20260822214141_trial_navigation_index_v1.sql`; the complete chain passes automated zero-state replay, and the 29,757-segment local corpus remains preserved.
- Supabase database advisors: no issues.
- Database lint: no schema errors or warnings. The legacy `review_extraction_candidate` UUID-array initialization is corrected without changing its review contract.
- Direct authenticated writes to all seven Structure Review targets are denied. The older claim-to-event promotion behavior remains available only through its separate atomic `review_and_promote_claim` RPC and is not part of Structure Review.

## Repository checkpoint

- Reconstruction v1 remains included in `main` through checkpoint `242a97d`.
- Structure Review v1 is merged into local `main` with its migration, loader, route contract, UI, database tests, browser acceptance, and operational documentation.
- Trial Navigation Index v1 is merged into local `main` with governed persistence, search, Foundation and Court Record integration, immutable revision history, Day 1–18 acceptance data, browser acceptance, tests, and operating documentation.

## Next delivery boundary

The next build slice is the interactive graph and Reconcile workspace over reviewed candidates: source-backed graph traversal, clustering, conflicts, derivation lineage, and governed reconciliation without silently promoting events or resolving identity. Reconstruction editing remains the following slice.
