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
