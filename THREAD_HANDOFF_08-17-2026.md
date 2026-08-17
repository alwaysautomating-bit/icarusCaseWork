# Icarus Casework — Session Handoff

### Thread Purpose

This session moved Icarus Casework from a local prototype blocked on Windows infrastructure into an authenticated Supabase-backed testimony-intake application, then applied the existing Icarus visual system to the researcher workspace. The practical objective was to prove one end-to-end intake slice using the public Rev transcript for *MA v. Lindsay Clancy Day 6*, while preserving the core Casework boundary between source capture, extracted assertions, human review, and later evidentiary reconciliation.

The session also established the intended next product shape: a serious dossier/console research instrument capable of preserving an entire trial day, extracting testimony without converting it into fact, reconstructing events with explicit temporal uncertainty, tracking acquisition and resolution gaps, and evaluating evidence against propositions and competing positions only through a later human-controlled reconciliation layer.

The final audit materially changed the project status. Although the intake workflow, migration, tests, and UI all passed for the records that were committed, inspection of the preserved Day 6 HTML proved that the Rev parser truncated the source. The artifact contains 2,197 timestamped transcript segments through `04:16:42`; the database contains only 410 segments through `00:40:58` and nevertheless marks the intake complete. Correcting parser completeness is therefore the next required build slice before adding higher-level analysis screens.

### Key Insights

- The evidence artifact, evidence lane, and extracted claim are different objects.
  - Why it matters: a captured HTML page is a documentary representation of testimony, not documentary evidence merely because it is HTML.
  - Potential implications: `testimony`, `documentary`, and `direct_evidence` must remain independent from MIME type and source-artifact format.

- Intake must stop before reconciliation.
  - Why it matters: extraction confidence only indicates parser certainty; it cannot establish support, corroboration, contradiction, independence, or truth.
  - Potential implications: support and verification relations must be created only by a later authenticated reconciliation workflow.

- Preserving the source before parsing prevented loss when parsing later proved incomplete.
  - Why it matters: the full 727 KB Day 6 HTML is available locally even though structured extraction stopped early.
  - Potential implications: Day 6 can be reprocessed from the immutable stored artifact without relying on a new network fetch.

- Parser success and intake completeness are not the same condition.
  - Why it matters: the current parser matched a syntactically valid prefix, committed 410 segments, and returned success even though 1,787 later timestamped segments were omitted.
  - Potential implications: every provider adapter needs completeness evidence such as segment counts, first/last timestamps, skipped-block reporting, and provider-specific structural validation.

- Testimony claims often exist at the question-and-answer level rather than in one speaker segment.
  - Why it matters: the Day 6 `82.1°F` and `95.2°F` values occur in questions followed by short affirmative answers. The current parser excludes questions and short answers, so neither number becomes a candidate assertion.
  - Potential implications: the review model needs contextual exchanges or compound Q/A candidates while retaining exact segment provenance.

- A proceeding day should be a first-class organizing object.
  - Why it matters: Day 6 contains testimony, court procedure, stipulations, exhibits, scene evidence, toxicology, and bloodstain analysis that should not be flattened into one transcript or one list of facts.
  - Potential implications: the next product layer should organize `Proceeding Day -> Sources -> Extracted Evidence -> Claims -> Events -> Resolution Items -> Assessments/Findings`.

- Stipulations collapse a chain-of-custody graph but do not manufacture testimony from every named technician.
  - Why it matters: Exhibits 184–186 and Exhibit J should be modeled as stipulations and their agreed facts, with the stipulation as the source.
  - Potential implications: exhibits and stipulations require first-class records and dedicated review screens.

- Positions and advocacy are not ordinary evidence.
  - Why it matters: prosecution and defense openings frame hypotheses but are not evidence, and expert opinions are interpretations with distinct provenance.
  - Potential implications: a future `Position` primitive and Opening Statement Audit should remain separate from evidence and findings.

- The existing Icarus design system fits Casework when its infrastructure vocabulary is replaced with provenance vocabulary.
  - Why it matters: paper surfaces support reading; dark console surfaces support review/triage; rectangular density and hairlines improve record legibility.
  - Potential implications: continue using the exact archive tokens and components rather than introducing a generic SaaS card system.

### Decisions

| Decision | Reasoning | Confidence |
| --- | --- | --- |
| Use Supabase Postgres and Supabase Auth as the active runtime. | It exercises authentication, application authorization, RLS, migrations, and evidence writes in one path. | High |
| Keep Neon as a documented fallback, not the current runtime. | Supabase satisfies the selected auth and PostgreSQL requirements; no contrary constraint is known. | High |
| Use Google, Apple, then magic links; do not use Clerk. | This is a binding owner preference and is encoded in project rules. | High |
| Require Docker Desktop for the local Supabase stack. | Local Supabase runs containers; hosted Supabase will not require local Docker for normal use. | High |
| Preserve remote bytes before parsing. | Failed or incomplete parsing must not destroy the evidentiary source. | High |
| Commit testimony intake through one security-invoker PostgreSQL function. | The source, artifact, segments, claims, attributions, media, and acquisition targets must commit atomically under the authenticated user's RLS context. | High |
| Reuse exact-checksum artifacts rather than treating retries as independent sources. | Repeated representations must not inflate apparent corroboration. | High |
| Keep evidence lane independent from artifact representation. | HTML can represent testimony; modality cannot be inferred from format. | High |
| Treat publisher timestamps as locators, not guaranteed event times or monotonic intervals. | The source contains timestamp discontinuities and transcript timestamps are not necessarily occurrence timestamps. | High |
| Separate Evidence Lane, Record State, Evidentiary Assessment, and Extraction Confidence visually and semantically. | Reviewed, ledgered, or high-confidence extraction must never imply that the underlying proposition is verified. | High |
| Structure the UI into DOSSIER/PAPER and CONSOLE modes. | Reading/evidence inspection and human triage/reconciliation are distinct modes of work. | High |
| Make parser completeness the next priority before theory analysis. | The Day 6 artifact is only partially represented in the structured record. Higher analysis would amplify incomplete evidence. | High |
| Treat the earlier statement that Day 6 intake was “complete” at 410 segments as superseded. | Later inspection directly proved the saved source contains 2,197 matching timestamped segments. | High |

### Evidence

Claim: Windows infrastructure and the local Supabase runtime are operational.
Supporting Evidence: WSL 2 with Ubuntu was installed and initialized; Docker Desktop started; `supabase db reset` replayed the migrations; local migration listing and database lint passed.
Source: `BUILD_LOG_08-16-2026.md`, `DEPLOYMENT_08-16-2026.md`, local command evidence from this session.
Confidence: High.

Claim: Supabase authentication and case-scoped authorization work locally.
Supporting Evidence: Magic-link delivery through Mailpit, OTP confirmation, cookie session establishment, case bootstrap, authenticated writes, RLS denial checks, and actor-attributed audit records were exercised.
Source: `BUILD_LOG_08-16-2026.md`; `src/lib/supabase/*`; `src/lib/casework-supabase.ts`; integration verification script.
Confidence: High.

Claim: The testimony intake boundary is atomic and prevents intake from writing reconciliation state.
Supporting Evidence: `commit_testimony_url_intake(jsonb)` is security-invoker and case-authorized; migration tests cover rollback, exact-duplicate reuse, forbidden reconciliation payload keys, read-only support/verification tables, and lane constraints.
Source: `supabase/migrations/20260817035154_testimony_url_intake.sql`; `src/db/supabase-migration.test.ts`; `scripts/verify-testimony-intake.mjs`.
Confidence: High for implemented tests.

Claim: The current stored Day 6 structured intake is incomplete.
Supporting Evidence: The immutable HTML file `.data/objects/48cca058a0bc10ec900010f0271d2bd6ede40c88b7db57e2790ee07aa2de55d2.html` contains 2,197 matches for the provider timestamped-segment pattern and ends at `04:16:42`; the database contains 410 segments and ends at `00:40:58`.
Source: direct inspection of the preserved artifact and local Supabase queries on 2026-08-17.
Confidence: High.

Claim: The parser truncation comes from nested-HTML handling.
Supporting Evidence: `parseSegments` extracts `main-content` using a non-greedy regular expression ending at the first `</div>`, then runs the segment matcher only over that prefix.
Source: `src/lib/rev-testimony.ts`, especially lines 74–81 at the time of handoff.
Confidence: High.

Claim: The present claim builder cannot independently surface the numeric `82.1°F` and `95.2°F` statements.
Supporting Evidence: the numbers occur in attorney questions; the answers are short confirmations. `isSubstantiveAssertion` excludes questions and short answers such as “yes” and “correct.” Database inspection found the surrounding source segments but no numeric candidate claims.
Source: stored Day 6 segments around ordinals 156–171; `src/lib/rev-testimony.ts` claim filtering.
Confidence: High.

Claim: The first UI pass follows the supplied design system and builds successfully.
Supporting Evidence: exact tokens and component grammar were read from `Icarus design system.zip`; the application now uses Inter, JetBrains Mono, warm paper, dark console, hairlines, rectangular dense layouts, and limited orange. Desktop and mobile were checked in Playwright. `pnpm verify` passed ESLint, TypeScript, 20 tests, and the Next.js production build.
Source: `src/app/casework-ui.tsx`, `src/app/testimony-source-reader.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/app/layout.tsx`, `output/playwright/ui-pass`.
Confidence: High.

Claim: One newly attached text source does not belong to Day 6.
Supporting Evidence: the file begins with and contains “MA v. Lindsay Clancy Opening Statements,” while the request and second attachment concern Day 6.
Source: `C:\Users\Laura\.codex\attachments\57377eca-7771-4d95-b028-a8ead60662b4\pasted-text.txt`.
Confidence: High.

### Relationships

Windows WSL 2
-> enables Linux container runtime used by
-> Docker Desktop

Docker Desktop
-> runs local development services for
-> Supabase

Supabase Auth user
-> owns or belongs to
-> Case through `case_members`

Case
-> scopes through RLS
-> Sources, Artifacts, Claims, Events, Entities, Conflicts, and audit records

Evidence Intake
-> preserves submitted/canonical URL and parser attempt for
-> Source Artifact

Source
-> carries evidentiary modality through
-> Evidence Lane

Source Artifact
-> preserves a concrete HTML representation and contains
-> Source Segments

Source Segment
-> provides exact source location for
-> Claim

Claim
-> concerns but does not verify
-> Proposition

Claim Attribution
-> orders source dependency such as
-> Witness -> Rev -> Captured Transcript

Human Review Decision
-> may promote an accepted Claim into
-> Event

Acquisition Record
-> identifies an unpossessed underlying source discovered from
-> Source Segment

Claim Support / Verification Assessment
-> reserved for a later authenticated
-> Reconciliation layer

Proceeding Day
-> proposed container for
-> Sources, witnesses, exhibits, stipulations, claims, events, issues, and theory impacts

Position
-> proposed interpretation of evidence by
-> Prosecution, defense, or expert

### Projects Discussed

Project: Icarus Casework
Purpose: Build a source-grounded case-reconstruction workspace that preserves provenance, separates claims from events and findings, exposes uncertainty and contradiction, and supports defensible narrative research.
Current Status: Supabase runtime/authentication and the first Rev testimony URL intake are implemented locally. The first design-system UI pass is implemented and verified. The testimony parser is now known to truncate the Day 6 source, so the intake slice cannot be considered complete end to end until reprocessing and completeness validation are added. Cloud deployment is not provisioned. Most work after commit `709dd91` is uncommitted.
Key Decisions: Supabase/Postgres; authenticated RLS; immutable artifact preservation; explicit evidence lanes; hard intake/reconciliation boundary; paper/console UI; versioned migrations; no Clerk; no production `db push` strategy outside the approved Supabase migration workflow.
Dependencies: WSL 2; Docker Desktop; local Supabase; Next.js 16; React 19; Supabase CLI `2.113.0`; `@supabase/ssr` `0.12.4`; `@supabase/supabase-js` `2.112.3`; future hosted Supabase/Vercel/Blob credentials.
Risks: parser truncation; no completeness gate; question/answer claim loss; divergent `src/db/schema.ts`; uncommitted working tree; no hosted OAuth or Blob validation; large unpaginated claim selectors; reconciliation UI not built.
Next Actions: repair and validate the Rev adapter; reprocess the stored Day 6 artifact; build a full transcript reader and claim-review workbench; add Proceeding Day, exhibits/stipulations, and resolution items; only then build reconciliation and position/theory analysis.

### Context Required For Future Work

- Workspace: `C:\Projects\IcarusCasework`.
- Branch: `main`.
- Current HEAD: `709dd91` — `Initialize Icarus Casework with Supabase integration`.
- No push was performed during the session.
- The working tree is substantially dirty. It contains the testimony intake implementation, design-system UI pass, updated lifecycle files, planning changes, screenshots, the design-system archive, and user-supplied Day 6 working text. Do not discard or reset these changes.
- Repository rules require Supabase/Neon preference, Blob-compatible storage, Google -> Apple -> magic-link authentication, no Clerk, controlled migrations, and no Prisma `db push` production strategy.
- Next.js 16 local documentation under `node_modules/next/dist/docs/` must be read before new Next.js implementation work because repository agent rules state this version may differ from prior conventions.
- Local Supabase requires Docker Desktop to be running. WSL and Ubuntu are already installed.
- The local Day 6 test corpus belongs to `laura-testimony@example.test` and currently contains one intake, 410 stored segments, 123 candidate claims, four acquisition targets, 20 entities, zero promoted events, and zero contradictions.
- A disposable user `laura-ui-pass@example.test` was created only for visual testing and was deleted with its empty case.
- The development server was stopped at the end of verification. The Playwright browser session was closed.
- Current verification command: `pnpm verify`.
- Maintained local integration command: `pnpm test:integration`.
- Local migration replay: `pnpm supabase:reset` with Docker running.
- The design system source of truth is `C:\Projects\IcarusCasework\Icarus design system.zip`. Do not invent replacement tokens or components.
- UI language must keep four independent concepts:
  - Evidence Lane: testimony / documentary / direct evidence
  - Record State: captured -> extracted -> reviewed -> ledgered
  - Evidentiary Assessment: unassessed / supported / conflicted / corroborated / disputed
  - Extraction Confidence: `0.00–1.00`
- Record state and confidence must not visually or semantically imply proposition verification.
- The first newly supplied pasted-text attachment is Opening Statements content and should be quarantined from Day 6 unless deliberately linked as a separate proceeding source.

### Risks

Risk: Rev transcript parser truncates nested HTML.
Potential Impact: 81% of the Day 6 transcript is absent from the structured record while the intake is marked complete; summaries and downstream analysis would be materially incomplete.
Mitigation: replace the `main-content` regular-expression extraction with robust DOM traversal or a provider structure parser; add stored-artifact fixture coverage, expected last-timestamp/completeness checks, and explicit partial/failure status.

Risk: Questions and short answers are discarded as claims without contextual pairing.
Potential Impact: central evidence such as `82.1°F -> 95.2°F` is preserved only as raw segments and cannot enter review as a defensible assertion.
Mitigation: create Q/A exchange candidates that retain both segment IDs, speaker roles, exact wording, and human-review requirements; never transform a question into fact without the corresponding answer.

Risk: Intake status currently conflates successful prefix parsing with complete processing.
Potential Impact: researchers may rely on incomplete records without warning.
Mitigation: add processing diagnostics and an Intake Integrity screen; require a completeness decision before `complete` status.

Risk: Acquisition extraction is narrow and partial.
Potential Impact: only Exhibit J, EMS information, a medical record, and Exhibit 144 were detected from the truncated prefix; later exhibits and stipulations are absent.
Mitigation: parse the complete source, add structured exhibit/stipulation detection, and require human confirmation.

Risk: Proposition normalization is not real normalization.
Potential Impact: near-duplicate claims cannot reliably converge on a shared proposition and support/conflict analysis will fragment.
Mitigation: add a human proposition-review workbench with merge/split/edit operations and audit history.

Risk: The source reader currently renders extracted assertions rather than the complete transcript.
Potential Impact: users cannot see omitted questions, short answers, procedure, or surrounding context and may mistake the reader for a full source representation.
Mitigation: render all source segments with search, filtering, virtualization/pagination, examination boundaries, and selected-exchange context.

Risk: Some legacy consequential mutations use multiple Data API calls rather than one transaction.
Potential Impact: induced failures could leave partial review/entity/conflict state.
Mitigation: move multi-record operations to atomic database functions or prove compensating rollback through integration tests.

Risk: `src/db/schema.ts` diverges from the authoritative Supabase migration set.
Potential Impact: future migrations may be designed from a stale contract.
Mitigation: reconcile it or formally retire it before the next broad schema change.

Risk: Current work is uncommitted and mixed with document rollover and generated visual evidence.
Potential Impact: accidental loss, an oversized checkpoint, or unclear review scope.
Mitigation: review `git status`, separate intentional source/docs changes from generated output where appropriate, then create a clear checkpoint before the next slice.

Risk: Hosted authentication, Blob, backup, and deployment procedures remain unverified.
Potential Impact: local success cannot be treated as deployment readiness.
Mitigation: preserve the existing deployment gate and provision cloud resources only with explicit project ownership and credentials.

### Open Questions

- Should the current partial Day 6 intake be invalidated, marked partial, or retained as parser version `1.0.0` beside a reprocessed intake?
  - Why it matters: reprocessing must preserve auditability without making the partial graph appear independently corroborative.

- What provider-level completeness evidence should be mandatory for Rev and future transcript adapters?
  - Why it matters: raw segment count alone may not prove completeness across changing publisher markup.

- How should a compound Q/A assertion reference two or more source segments without erasing their individual locators?
  - Why it matters: many courtroom facts are established by leading questions plus short confirmation.

- Which testimony classifications are required in the first review workbench: testimony, procedural, advocacy, expert opinion, court instruction, stipulation, and exhibit foundation?
  - Why it matters: the current generic “testified” assertion label mischaracterizes judges, lawyers, and procedural speech.

- Should `Proceeding Day`, `Exhibit`, `Stipulation`, `Resolution Item`, and `Position` become new persisted primitives or projections over existing records?
  - Why it matters: the choice affects the next migration and the long-term evidence graph.

- What is the exact terminal meaning of `ledgered` in Record State?
  - Why it matters: the UI shows the stage but no implemented transition currently creates it.

- Should the evidentiary assessment vocabulary use `disputed`, `contradicted`, or both, and at what level?
  - Why it matters: the requested UI vocabulary and current database enums are not identical.

- Should full transcript claims remain available in the existing large selectors or move immediately to searchable/paginated pickers?
  - Why it matters: 2,197 segments and hundreds of candidates will make current selects unusable.

- Which exact source supplied the Day 6 prose summary, and should it be stored as a derivative research note distinct from the Rev transcript?
  - Why it matters: the summary is useful analysis but cannot inherit the transcript's evidentiary status.

### Next Actions

Priority: P0
Owner: Next implementation operator
Task: Create a clean checkpoint of the intentional testimony-intake and UI-pass work after reviewing the dirty working tree.
Reason: The current root commit predates most of the session's implementation and the user previously requested committing before further expansion.

Priority: P0
Owner: Next implementation operator
Task: Replace the Rev `main-content` regex extraction with robust complete-document parsing and add the full stored Day 6 artifact as a regression fixture or controlled integration fixture.
Reason: No downstream screen can be trusted while the source is truncated.

Priority: P0
Owner: Next implementation operator
Task: Add completeness diagnostics and prevent incomplete provider parsing from receiving `complete` status.
Reason: Silent partial success is the highest current integrity risk.

Priority: P0
Owner: Next implementation operator
Task: Design a versioned reprocessing path for the preserved Day 6 artifact and prove that it does not create false source independence.
Reason: The stored source should be repaired without losing the original intake audit trail.

Priority: P0
Owner: Next implementation operator
Task: Upgrade the Source Reader to display all segments and contextual Q/A exchanges with search and bounded rendering.
Reason: Current UI exposes only extracted assertions and hides material source context.

Priority: P0
Owner: Product/implementation
Task: Build the Claim Review Workbench with amend, reject, defer, split/merge, classification, proposition normalization, and Q/A pairing.
Reason: Day 6 cannot be transformed defensibly from transcript into structured claims without human review tools.

Priority: P1
Owner: Product/implementation
Task: Add the Proceeding Day overview plus Exhibit/Stipulation and Resolution Item screens.
Reason: These are the minimum structures required to represent the supplied Day 6 summary faithfully.

Priority: P1
Owner: Product/implementation
Task: Add event temporal-constraint detail, proposition reconciliation, and Position/Theory screens only after intake completeness is restored.
Reason: Analysis must sit on a complete, reviewable evidence substrate.

Priority: P1
Owner: Infrastructure
Task: Reconcile or retire `src/db/schema.ts`, then expand failure-path integration coverage for legacy multi-step mutations.
Reason: Schema drift and non-atomic writes are current technical debt before another broad migration.

Priority: P2
Owner: Infrastructure/product owner
Task: Provision hosted Supabase, Google/Apple OAuth, Vercel project, and private Blob only when credentials and ownership are available.
Reason: Local validation does not close the deployment gate.

### Memory Candidates

Memory: Evidence lane is independent from artifact representation.
Category: Canonical domain rule.
Why it should persist: Prevents HTML transcripts from being mislabeled as documentary evidence and protects later cross-lane analysis.

Memory: Intake cannot create support, contradiction, corroboration, independence, or verification state.
Category: Control boundary.
Why it should persist: Preserves epistemic integrity and keeps extraction confidence from becoming truth status.

Memory: Preserve source bytes before parsing and make parser completeness observable.
Category: Proven workflow.
Why it should persist: The Day 6 truncation demonstrated that immutable source preservation is necessary but insufficient without completeness diagnostics.

Memory: Courtroom assertions may span a question and short answer.
Category: Domain-specific extraction rule.
Why it should persist: Segment-only substantive-text filtering loses important sworn confirmations.

Memory: A proceeding day is a container, not a fact.
Category: Canonical information architecture.
Why it should persist: It organizes heterogeneous sources without flattening their provenance.

Memory: Stipulated facts derive from the stipulation source, not fictional independent testimony from named chain-of-custody personnel.
Category: Evidentiary modeling rule.
Why it should persist: Prevents false corroboration and preserves the legal meaning of stipulation.

Memory: Positions and advocacy are interpretations, not evidence.
Category: Canonical domain rule.
Why it should persist: Enables opening-statement audits and theory comparison without contaminating the evidence graph.

Memory: Icarus Casework uses the existing Icarus design grammar: warm paper, dark console, Inter, JetBrains Mono, hairlines, rectangular density, and orange only for attention/unresolved states.
Category: Design system.
Why it should persist: Future UI work must remain visually coherent and avoid generic SaaS patterns.

### Features / Skills / Scripts / Code / Screens

Type: Screen
Name: Authentication
Status: Existing
Notes: Google, Apple, and magic-link order; only local magic link is fully verified.

Type: Screen
Name: Source Intake and Source Registry
Status: Existing
Notes: Captures authorized Rev URLs and displays publisher, dates, SHA-256, canonical source, and processing state.

Type: Screen
Name: Source Reader with Provenance Inspector
Status: Existing
Notes: New UI pass; presently reads extracted assertion segments, not the complete transcript.

Type: Screen
Name: Chronology and Saved Research Views
Status: Existing
Notes: Shows human-promoted events in time windows and supports URL-addressable saved views.

Type: Screen
Name: Entities and Artifact Provenance
Status: Existing
Notes: Durable entities, aliases, and provenance roles.

Type: Screen
Name: Acquisition Console
Status: Existing
Notes: Tracks known-but-unpossessed sources; automatic detection is incomplete.

Type: Screen
Name: Human Review
Status: Existing
Notes: Accepts one candidate and promotes an event; lacks broader dispositions and editing.

Type: Screen
Name: Lineage, Conflicts, Dispositions, and Authority Log
Status: Existing
Notes: Supports explicit lineage and unresolved contradiction workflows with audit attribution.

Type: Screen
Name: Intake Integrity / Processing Report
Status: Proposed
Notes: Must show parsed-versus-preserved completeness, last timestamp, warnings, and partial/failure state.

Type: Screen
Name: Proceeding Day Overview
Status: Proposed
Notes: Tabs/panes for Record, Transcript, Claims, Events, Issues, and Theories.

Type: Screen
Name: Full Transcript Reader
Status: Proposed
Notes: All segments, Q/A exchanges, search, speaker/witness filters, examination phases, and bounded rendering.

Type: Screen
Name: Claim Review Workbench
Status: Proposed
Notes: Contextual extraction review, classifications, amend/reject/defer, proposition merge/split, and exact provenance.

Type: Screen
Name: Exhibits and Stipulations Register
Status: Proposed
Notes: First-class Exhibit J and 184–186 representation with chain-of-custody collapse semantics.

Type: Screen
Name: Resolution Queue
Status: Proposed
Notes: Open questions, known/unknown fields, importance, candidate resolving sources, and status; distinct from acquisition.

Type: Screen
Name: Event Detail / Temporal Reconstruction
Status: Proposed
Notes: Observed, measured, recorded, reported, estimated, bounded, and unknown time plus constraints.

Type: Screen
Name: Proposition Reconciliation
Status: Proposed
Notes: Support, conflict, corroboration, dispute, qualification, source independence, strength, and limitations.

Type: Screen
Name: Positions / Theory Matrix and Opening Statement Audit
Status: Proposed
Notes: Evaluate evidence against narrow propositions while preserving advocacy as non-evidence.

Type: Code
Name: `commit_testimony_url_intake(jsonb)`
Status: Existing
Notes: Atomic authenticated testimony graph commit and duplicate reuse boundary.

Type: Code
Name: Rev transcript provider adapter
Status: Existing
Notes: Metadata, media, segments, candidate claims, attribution, and acquisition extraction; currently has a critical nested-HTML truncation defect.

Type: Script
Name: `scripts/verify-testimony-intake.mjs`
Status: Existing
Notes: Maintained authenticated integration verification with cleanup.

Type: Skill
Name: Project Kickoff Session Lifecycle
Status: Existing
Notes: Used to maintain root project memory files and session closeout documentation.

Type: Skill
Name: Supabase
Status: Existing
Notes: Used for local stack, migrations, Auth/RLS, and PostgreSQL integration practices.

Type: Skill
Name: Playwright
Status: Existing
Notes: Used for authenticated desktop/mobile workflow and visual verification.

Type: Skill
Name: Analyst
Status: Existing
Notes: Used for the Day 6 capability and screen-gap audit.

Type: Skill
Name: Thread Collapse Handoff
Status: Existing
Notes: Used to create this operational memory artifact.

### Handoff Brief

Current State: Icarus Casework runs locally on Next.js 16 and Docker-backed Supabase with authenticated magic-link access, case-scoped RLS, controlled migrations, immutable source capture, atomic Rev testimony intake, human review/event promotion, entity/provenance, lineage/conflict, chronology, and audit workflows. The existing Icarus design language has been applied in a paper/console UI with a new Source Reader and persistent provenance inspector. `pnpm verify` passes. The dev server is stopped. Most work after root commit `709dd91` remains uncommitted.

What Was Learned: The immutable Day 6 source is complete, but the structured extraction is not. A nested-HTML regex stopped after 410 of 2,197 timestamped segments. The same audit showed that segment-only claim extraction misses evidence expressed through a leading question plus short confirmation, including the `82.1°F` and `95.2°F` temperature exchange. The current UI is therefore a sound visual and provenance foundation but not yet capable of producing the supplied Day 6 summary end to end.

What Was Decided: Preserve the Supabase architecture, evidence-lane separation, hard intake/reconciliation boundary, atomic testimony commit, and exact Icarus design grammar. Treat the earlier 410-segment “complete” result as superseded. Fix intake completeness before building theory analysis. Organize the next product layer around a first-class Proceeding Day, full transcript context, human claim review, exhibits/stipulations, and resolution items.

What Remains: Commit the intentional working tree, repair and reprocess the Rev adapter, add completeness diagnostics, upgrade the Source Reader, model Q/A claims, decide new proceeding/exhibit/stipulation/resolution/position primitives, reconcile the schema reference, add reconciliation and theory screens, and later provision hosted Supabase/OAuth/Blob infrastructure.

Recommended Next Step: Review and checkpoint the current uncommitted testimony/UI work, then implement one bounded “Day 6 completeness” slice: parse all 2,197 stored segments through `04:16:42`, reject silent partial success, reprocess without false source duplication, display the full transcript with Q/A context, and prove the `82.1°F -> 95.2°F` exchange is reviewable without inventing a medical measurement timestamp.
