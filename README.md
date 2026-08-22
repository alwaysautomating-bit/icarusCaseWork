# Icarus Casework

Icarus Casework is a source-grounded research workspace for true-crime creators. It preserves source artifacts, separates attributed claims from reviewed events, and keeps every timeline item linked to exact evidence.

## V1 boundary

The application supports public records and authorized research material. It does not determine guilt, diagnosis, credibility, admissibility, or the probability that an account is true.

## Stack

- Next.js 16 App Router, React 19, and TypeScript
- Server Components for reads and Server Actions for mutations
- Drizzle schema targeting PostgreSQL
- Supabase Postgres with row-level security for authenticated case data
- Supabase Auth with Google, Apple, and passwordless magic links
- Filesystem object storage locally; S3-compatible immutable object storage in deployment
- Zod validation and Vitest

## Infrastructure policy

- Managed data infrastructure should use Supabase or Neon.
- Source artifacts and exports should use Vercel Blob or equivalent object storage.
- Firebase requires a concrete documented reason and is not the default.
- Authentication should offer Google first, Apple second, and magic links third.
- Clerk is prohibited for this project.
- Database changes must use versioned, controlled migrations. If Prisma is introduced, production uses `prisma migrate deploy`; `prisma db push` is not an acceptable production migration strategy.

The legacy PGlite adapter remains as an isolated reference implementation; the application runtime uses Supabase.

Docker Desktop is the container engine for the complete local Supabase stack. The pinned Supabase CLI coordinates Postgres, Auth, the Data API, Storage, Realtime, Studio, Mailpit, and supporting services from `supabase/config.toml`. See [SUPABASE_OPERATIONS.md](SUPABASE_OPERATIONS.md) for the canonical architecture, startup, migration, security, recovery, and deployment procedures.

## Run locally

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm exec supabase start
pnpm exec supabase status
pnpm exec supabase db reset --local
pnpm dev
```

Start Docker Desktop before the Supabase command. Populate `.env.local` with only the Supabase URL and publishable key shown by `pnpm exec supabase status`; never copy the service-role or secret key into a `NEXT_PUBLIC_` variable. The reset command rebuilds the local database from committed migrations and destroys unexported local database data.

Open [http://localhost:3000](http://localhost:3000) for Icarus Casework, [local Supabase Studio](http://127.0.0.1:54323/project/default) for the local stack, and [Mailpit](http://127.0.0.1:54324) for local magic-link emails. Use the guided form to preserve a source, extract a cited claim, review it, and promote it to a distinct timeline event.

## Transcript intake

Place new Rev markdown or text captures in `transcripts/inbox`, then run:

```powershell
pnpm transcript:intake
```

To process one source elsewhere, pass its path explicitly. The compiler copies the source byte-for-byte to `transcripts/preserved`, writes a versioned JSON manifest to `transcripts/manifests`, and runs the experimental V2 deterministic structure pass into `transcripts/first-pass`. V2 accepts both Rev Markdown and plain-text transcript shapes. It identifies witness blocks, examination-phase runs, and procedural markers with source-line, timestamp, and deep-link locators. These outputs are reviewable navigation aids, not verified facts, credibility findings, or canonical legal classifications.

The intake uses trial day—not a publisher display date—as filename identity. It never promotes a publisher date to `proceeding_date`, never edits the source, and stops with `SOURCE_CONFLICT` if a trial day already has a different preserved checksum. Re-running an identical source validates and reuses both its manifest and first-pass output.

## Verify

```powershell
pnpm verify
```

The Supabase migration chain is exercised from zero by the test suite. Full local replay requires Docker Desktop and the local Supabase stack:

```powershell
pnpm exec supabase db reset --local
pnpm exec supabase migration list --local
pnpm exec supabase db lint --local --level warning --fail-on error
pnpm exec supabase db advisors --local --type all --level warn --fail-on error
```

See [SUPABASE_OPERATIONS.md](SUPABASE_OPERATIONS.md) for normal operations and [DEPLOYMENT_08-16-2026.md](DEPLOYMENT_08-16-2026.md) for the controlled cloud deployment gate.

## Data constraints

- `.data/` and environment files are excluded from Git.
- The local vertical slice accepts pasted public or authorized text only.
- The original text is stored separately from normalized database records and addressed by a SHA-256 checksum plus character offsets.
- Authentication is intentionally not part of this local proof slice. Do not expose it to the public internet.

## Project memory

Active project state lives in the dated `PROJECT`, `BACKLOG`, and `BUILD_LOG` files and stable `ONTOLOGY.md`. Compiled kickoff artifacts live under `_planning/compiled`.
