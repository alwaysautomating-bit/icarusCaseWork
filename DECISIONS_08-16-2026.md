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
