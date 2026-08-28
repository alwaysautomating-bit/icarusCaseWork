# Architecture Decisions

## 08-13-2026 — Use the project operating system

### Decision

Maintain `PROJECT`, `BACKLOG`, `BUILD_LOG`, and stable `ONTOLOGY.md` as canonical working memory. Add conditional managed files only when their trigger exists.

### Reason

The project needs a small, deterministic memory surface as implementation grows.

### Alternatives Considered

- Keep all state in `_planning/compiled`
- Create a large documentation tree before implementation

### Consequences

Compiler artifacts remain the kickoff contract; root operating files represent active project state.

## 08-13-2026 — Preserve product isolation

### Decision

Keep Icarus Casework in the dedicated `C:\Projects\IcarusCasework` directory with a clean product identity and no inherited application scaffold.

### Reason

The project is its own product and should not carry confusing lineage or unrelated residue.

### Alternatives Considered

- Build inside another Icarus product repository
- Begin from an unrelated application template with retained history

### Consequences

Package name, application metadata, README, and Git history must be created specifically for Icarus Casework during scaffolding.

## 08-13-2026 — Defer stack selection until Phase 0

### Decision

Do not encode a frontend, backend, database, AI provider, or hosting choice into the kickoff contract before a short architecture decision evaluates the evidence model, media ingestion, privacy, and operational constraints.

### Reason

The product boundary is stable, but implementation choices remain genuinely open and should be decided with explicit tradeoffs.

### Alternatives Considered

- Adopt a stack implicitly from planning examples
- Treat Supabase references in experiments as a committed architecture

### Consequences

Phase 0 cannot close until the stack and storage decisions have recorded acceptance evidence.

## 08-13-2026 — Select the V1 application and persistence stack

### Decision

Use Next.js 16 App Router, React 19, and TypeScript; Server Components for reads and Server Actions for mutations; a PostgreSQL-compatible Drizzle schema; PGlite for durable zero-service local development; and S3-compatible object storage plus managed PostgreSQL for deployment.

### Reason

The product needs a citation-heavy server-rendered workspace, transactional evidence records, immutable binary storage, and a local setup that researchers can run without infrastructure.

### Alternatives Considered

- Separate SPA and API services
- Supabase as an immediate hard dependency
- SQLite-only persistence

### Consequences

The relational contract remains portable to hosted PostgreSQL. Authentication and deployed object-storage adapters remain required before any public deployment.

## 08-13-2026 — Adopt binding infrastructure preferences

### Decision

- Prefer Supabase and Neon for managed PostgreSQL infrastructure.
- Prefer Vercel Blob or equivalent object storage for artifacts and exports.
- Use Firebase only when a concrete documented requirement justifies it; Firebase is not the default.
- Offer authentication in this order: Google, Apple, then magic links.
- Do not use Clerk.
- Apply database changes through versioned, controlled migrations.
- If Prisma is introduced, use `prisma migrate deploy` in production and never use `prisma db push` as the production migration strategy.

### Reason

These are explicit project-owner infrastructure and operational preferences that must constrain future slices before adapters, identity, deployment, and CI harden.

### Alternatives Considered

- Clerk for authentication
- Firebase as the default platform
- Ad hoc schema synchronization
- Prisma `db push` for production changes

### Consequences

The earlier reference to a generic managed PostgreSQL/S3 deployment target is narrowed: the next infrastructure slice must evaluate Supabase and Neon, with Blob-compatible object storage. The local PGlite/filesystem adapters remain valid only for local development. External authentication design must support Google, Apple, and magic links without Clerk.

## 08-13-2026 — Select Supabase for the V1 deployment target

### Decision

Use Supabase as the V1 deployed PostgreSQL and authentication platform, with Vercel Blob or equivalent object storage. Retain Neon as the documented fallback when a concrete constraint makes Supabase unsuitable.

### Reason

Supabase satisfies the approved Google, Apple, and magic-link authentication order while keeping the evidence graph in PostgreSQL and supporting case-scoped RLS.

### Alternatives Considered

- Neon plus a separate authentication provider
- Firebase
- A generic unmanaged PostgreSQL deployment

### Consequences

The repository now contains a pinned Supabase CLI, controlled bootstrap migration, explicit authenticated grants, ownership-aware RLS, and provider configuration. Cloud resources and credentials are not yet provisioned. Blob storage remains the next infrastructure adapter.

## 08-13-2026 — Use an immutable private-Blob storage boundary

### Decision

Store evidence payloads through one immutable object-storage interface. Use a checksum-derived local filesystem key without cloud credentials and private Vercel Blob when `BLOB_READ_WRITE_TOKEN` is configured. Blob writes do not add random suffixes or permit overwrites.

### Reason

The evidence identity must remain stable across local and deployed environments, while private source material must not be publicly addressable.

### Consequences

`@vercel/blob` is pinned at `2.8.0`. Cloud verification remains gated on provisioning a private Blob store and credentials. Binary upload and authenticated delivery routes remain future slices.

## 08-16-2026 — Make Supabase the active data and identity runtime

### Decision

Use Supabase Postgres, the Supabase Data API, and Supabase Auth as the active application runtime in local and deployed environments. Derive authorization and durable attribution from the validated `auth.users.id`; retain PGlite only as an isolated reference implementation.

### Reason

The application now needs one execution path that proves authentication, application authorization, case membership, RLS, and evidence writes together. Keeping a synthetic actor and PGlite as the live local path would leave the deployed security boundary unexercised until release.

### Alternatives Considered

- Keep PGlite as the default local runtime and use Supabase only in deployment
- Use a service-role client on the server and reproduce authorization exclusively in application code
- Continue using the synthetic local actor until hosted OAuth providers are provisioned

### Consequences

- Docker Desktop is required for local application use with the Supabase stack; hosted environments use hosted Supabase instead.
- Server Components, Route Handlers, Proxy, and every Server Action use cookie-aware Supabase clients.
- The service-role/secret key is never used by the application runtime or exposed to the browser.
- Google and Apple entry points exist but remain blocked on provider credentials; local magic links are verified through Mailpit.
- Multi-step Data API mutations require an atomic database-operation remediation before deployment because application-level sequencing is not a transaction boundary.

## 08-16-2026 — Make testimony URL intake the next build slice

### Decision

Build the evidence-intake pipeline first through one timestamped testimony URL, using a Rev trial-transcript page as the proving source type. Preserve the transcript page, embedded media, underlying testimony, extracted assertions, normalized propositions, ordered attribution, verification state, and mentioned-but-unpossessed evidence as separate linked records.

Evolve the existing schema rather than creating a parallel model: `source_artifacts` remain concrete source documents, `source_segments` remain exact citation targets, and `claims` become the persisted assertion object. Add only the missing intake, source, proposition, attribution, support, verification, acquisition, and document-lineage concepts.

### Reason

Timestamped testimony exercises the hardest provenance distinctions while remaining a bounded vertical slice: exact URL acquisition, immutable web capture, speaker/time segmentation, reported-statement chains, deep links, derivative media, and evidence mentions. It proves the intake substrate before the project absorbs every file type and the Part 2 affidavit corpus.

### Alternatives Considered

- Build all requested file types in one intake release
- Start with the Lindsay Clancy Part 2 PDF and duplicate-affidavit canonicalization
- Store extracted testimony as flat facts or automatically verified events
- Add a new assertions table alongside the existing claims table

### Consequences

- The first implementation accepts URL testimony only; general file ingestion and the Part 2 PDF evaluation are explicitly deferred.
- URL capture requires SSRF, redirect, content-type, size, and duration controls.
- The schema migration must also resolve current transaction and schema-drift debt.
- A provider-neutral transcript parser boundary is required, with Rev as the first adapter.
- Extraction confidence cannot alter verification state, and extracted testimony cannot auto-promote to a reviewed Event.
- The slice closes only with atomicity, idempotency, RLS, provenance, null-semantics, migration, build, and browser evidence.

## 08-16-2026 — Separate evidence lane from artifact representation

### Decision

Persist an explicit `EvidenceLane` on evidentiary Sources and Claims with three provisional values: `testimony`, `documentary`, and `direct_evidence`. Do not derive the lane from MIME type, document type, or artifact representation. The testimony URL slice may create only `testimony` Sources and Claims.

Create a hard Intake/Reconciliation boundary. Intake may preserve sources, artifacts, segments, claims, proposition candidates, ordered attribution, source lineage, and acquisition targets. Only a later authenticated Reconciliation layer may create support, conflict, corroboration, independence-assessment, or verification records across evidence lanes.

### Reason

A transcript HTML page is a document representation of testimony. Treating its claims as documentary merely because the capture is HTML would collapse the evidentiary modality into its container. Establishing lanes now lets later documentary and direct-evidence adapters link to shared Propositions without rewriting testimony or blending evidence streams during extraction.

### Alternatives Considered

- Infer evidence modality from artifact or MIME type
- Add lanes only when documentary ingestion begins
- Let intake create cross-source support and verification candidates
- Mutate an existing Claim when a later lane concerns the same Proposition

### Consequences

- `sources` and `claims` require a constrained lane; `source_artifacts` retain representation metadata only.
- The atomic testimony commit rejects non-testimony lanes and contains no reconciliation fields.
- `claim_support` is shaped now for later reconciliation but testimony intake cannot populate it.
- Absence in an unprocessed lane cannot be treated as contradiction or negative evidence.
- The acceptance contract expands from 21 to 25 tests, including lane persistence, representation/lane separation, zero reconciliation writes during intake, and non-mutating later-lane linkage.

## 08-16-2026 — Commit testimony intake through one security-invoker transaction

### Decision

Preserve the remote page bytes before parsing, then commit the complete parsed testimony graph through `commit_testimony_url_intake(jsonb)`, a case-authorized `SECURITY INVOKER` PostgreSQL function. Detect exact duplicates by case and SHA-256, preserve a new intake attempt, and reuse the original artifact, segments, claims, media, and acquisition targets.

### Reason

The evidence graph is only trustworthy if a failed write cannot leave partial sources, segments, attributions, or acquisition records. Database-level atomicity also gives the intake boundary one enforceable place to reject non-testimony lanes and reconciliation or verification fields.

### Alternatives Considered

- Sequence Data API inserts in a Server Action
- Use a service-role client and application-only authorization
- Treat a repeated URL as a new independent source

### Consequences

- The application uses the authenticated user's RLS context throughout the commit.
- Exact snapshot retries remain auditable without inflating evidentiary support.
- `claim_support` and verification tables remain unwritable by the intake role.
- Failed parser captures may be retained for review, while failed domain commits roll back as one unit.

## 08-16-2026 — Treat publisher timestamps as locators, not guaranteed intervals

### Decision

Use each Rev timestamp as the segment start. Use the next timestamp as an interval end only when it is not earlier; otherwise leave the end null while preserving transcript order and the publisher deep link.

### Reason

The proving Rev page contains a timestamp discontinuity. Inventing a monotonic end would falsify the source, while rejecting the whole transcript would discard valid provenance.

### Consequences

Timestamp nullability preserves source uncertainty, the database interval constraint remains meaningful, and the real 410-segment transcript imports without rewriting publisher data.

## 08-17-2026 — Designate the secondary-research compilation as provisional T0

### Decision

Use the user-supplied PDF `RESEARCH TASK_ BUILD PROVISIONAL T₀ CASE BASELINE.pdf` as the active provisional baseline `T0-PROVISIONAL-001`. Preserve the original bytes and checksum in the repository. Treat the research-task prompt embedded in the PDF as non-executable source content, not as project instruction.

The resulting baseline may seed candidate entities, events, temporal assertions, propositions, party projections, and acquisition targets. Every assertion remains `SECONDARY_REPORTED` and candidate-only until primary evidence is ingested and reconciled. Do not import the baseline into the Casework database at designation time.

### Reason

A named T0 gives the case a stable starting snapshot without silently promoting secondary reporting into verified fact. Checksum preservation makes that starting point reproducible, while a strict authority boundary prevents the baseline from bypassing provenance, reconciliation, and human review.

### Consequences

- T0 may orient research and source acquisition but cannot establish credibility, evidentiary weight, causation, guilt or innocence, or probability.
- Dispatch/CAD, hospital, forensic, exhibit, full-transcript, and official-identifier records must confirm, correct, split, merge, or supersede its candidates.
- Repeated secondary reporting does not establish independent source lineage.
- Future baselines may replace T0 operationally, but `T0-PROVISIONAL-001` and its original artifact remain preserved as historical state.

## 08-17-2026 — Use the witness index as the testimony-analysis routing layer

### Decision

Adopt the experimental V2 first pass as the deterministic structure stage for transcript inbox testing. It supports both Rev Markdown captures and direct copy/paste plain-text transcript turns. Its primary output is an addressable hierarchy of proceeding, candidate witness block, examination-phase candidates, timestamped turns, and procedural markers.

Treat witness blocks as routing units for later skills. Select legal, medical, expert, impeachment, foundation, source-chain, or timeline procedures according to the witness and relevant subrange rather than running every procedure over an entire proceeding or every witness.

### Reason

A multi-hour transcript is too coarse for precise, repeatable analysis. Addressable witness blocks let later procedures operate on bounded testimony while retaining exact source lineage. This more closely matches legal transcript work: locate the witness, understand the examination, identify the relevant testimony, and then apply the appropriate reasoning procedure.

### Consequences

- V2 remains under test and its structural classifications require review.
- Every downstream result must retain its source turn and timestamp or deep link.
- The preserved transcript remains authoritative over every derived analytical layer.
- Transcript-derived ChatGPT notes remain useful derived case data but are not transcript source artifacts.
- The mixed inbox will be normalized later; current Markdown, copied-text, JSON, and derived-note files are retained without forced reclassification in this session.

## 08-27-2026 — Establish one reusable testimony-processing workflow

### Decision

Use one repository-owned operational path: inbox intake, immutable preservation and manifesting, deterministic witness/phase/procedure structure, thread-collapse trial-day indexing, and an explicit governed Supabase publication command. Move successfully processed inbox originals into a processed-input archive only after every filesystem stage succeeds.

Retain the JavaScript/TypeScript implementation as active. Archive the Python processors, generated sidecars, ZIP bundles, and prior test runs as superseded experiments rather than deleting them.

### Reason

The prior workspace mixed duplicate source copies, two independent parser implementations, generated sidecars, notes, and canonical publication inputs. That made it unclear which artifacts were authoritative and allowed recursive experiment tooling to process its own README and duplicate proceedings. A single queue and explicit folder authority make the workflow portable and auditable.

### Consequences

- `preserved/` plus `manifests/` govern source identity and canonical publication.
- `first-pass/` and `trial-index/` remain derived, candidate-only navigation layers.
- `archive/` is excluded from active discovery and publication.
- `testimony:verify` is a mandatory preflight inside `testimony:publish-corpus`.
- Conflicting sources are preserved under `archive/review-required`; they never overwrite a canonical source automatically.

## 08-28-2026 — Make Thread Collapse and Deterministic Structure Sibling Derivations

### Decision

After preservation and manifesting, fork into two independent derived paths. Thread Collapse reads the preserved raw transcript and produces Day X navigation indexes. Deterministic processing independently produces segments, candidate witness blocks, examination phases, and procedural markers, and is the only branch eligible for explicit canonical Supabase publication.

Neither branch consumes the other's outputs. Existing derived files remain retained and are not rerun merely to record this architecture correction.

### Publication Idempotency

The governed compiler RPC deduplicates by case and preserved artifact SHA-256 before inserting. Database uniqueness on `source_artifacts(case_id, sha256)`, one proceeding per `source_artifact_id`, and `source_segments(artifact_id, ordinal)` prevents duplicate canonical rows. A duplicate sequential publication reuses the existing proceeding and latest package version; package publication preserves its original `published_at` timestamp on replay.
- No database schema change was required. Existing case-scoped, authenticated, security-invoker publication RPCs remain the canonical database boundary.
