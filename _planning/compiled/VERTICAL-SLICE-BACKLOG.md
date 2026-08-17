# Vertical Slice Backlog

## Completed — Testimony URL Intake

- Built the first intake slice around one authenticated testimony URL, using a timestamped Rev trial-transcript page as the proving example.
- Preserve the exact submitted URL, a canonical URL, an immutable HTML snapshot, checksum, capture metadata, and processing state.
- Keep the transcript document, embedded media reference, underlying testimony source, and mentioned exhibits/records separate but linked.
- Persist `evidence_lane = testimony` independently from the transcript artifact's HTML representation; reject documentary/direct-evidence intake in this slice.
- Reuse and extend `source_artifacts`, `source_segments`, `claims`, `events`, `review_decisions`, and `audit_events`; add sources, intake records, propositions, ordered claim attributions, independence-aware support, verification assessments, and acquisition targets.
- Enforce the intake/reconciliation boundary: intake cannot create support, contradiction, corroboration, independence-assessment, or verification records, and later lanes must link to shared propositions without mutating testimony claims.
- Add one atomic, idempotent parsed-result commit boundary protected by authenticated case membership and RLS.
- Add the smallest assertion inspection drawer needed to prove assertion -> proposition -> attribution -> segment -> source/deep-link traceability.
- Passed the implemented automated and live acceptance contract: URL safety, migration replay, exact-duplicate behavior, cross-user RLS, lane preservation, reconciliation isolation, no confidence-to-verification promotion, real Rev browser navigation, and production build. Further induced-stage failure and future-lane fixtures remain tracked as test expansion rather than blockers to this completed vertical slice.

## Now

- Reconcile or formally retire `src/db/schema.ts` so the Supabase migration set remains the single authoritative schema contract.
- Formalize the provider-adapter contract and add pagination/search before expanding transcript providers or claim volume.

## Soon

- Add file upload adapters for PDF, HTML/SingleFile, TXT/Markdown, DOCX, and images over the same intake contract.
- Run the Lindsay Clancy Part 2 PDF evaluation for repeated warrant packets and March/April affidavit lineages without hard-coded production rules.
- Add core entity resolution for people, organizations, devices, and locations.
- Add claim lineage and repeated-report handling.
- Add contradiction representation and unresolved-state surfacing.
- Add timeline filtering by claims, events, and evidence types.
- Add reproducibility metadata for evidence snapshot and output regeneration.

## Later

- Add hypothesis/proposition objects as Projections.
- Add constrained feasibility testing for at least two competing accounts.
- Add evidence-backed case brief / cited story output.
- Add richer source-reader and evidence-map interfaces.

## Someday

- Rich Scenario Lab
- Monte Carlo reconstruction beyond constrained feasibility
- Bayesian proposition comparison
- responsibility allocation
- longitudinal pattern-of-life analysis
- regulated-domain extensions
