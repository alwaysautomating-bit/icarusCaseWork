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

## Run locally

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm supabase:reset
pnpm dev
```

Populate `.env.local` with the Supabase URL and publishable key shown by `pnpm exec supabase status`, then open [http://localhost:3000](http://localhost:3000). Local magic-link emails appear in Mailpit at [http://127.0.0.1:54324](http://127.0.0.1:54324). Use the guided form to preserve a source, extract a cited claim, review it, and promote it to a distinct timeline event.

## Verify

```powershell
pnpm verify
```

The Supabase deployment migration is exercised from zero by the test suite. Full local replay requires Docker:

```powershell
pnpm supabase:reset
pnpm supabase:migrations
```

See `DEPLOYMENT_08-13-2026.md` for the controlled cloud deployment gate.

## Data constraints

- `.data/` and environment files are excluded from Git.
- The local vertical slice accepts pasted public or authorized text only.
- The original text is stored separately from normalized database records and addressed by a SHA-256 checksum plus character offsets.
- Authentication is intentionally not part of this local proof slice. Do not expose it to the public internet.

## Project memory

Active project state lives in the dated `PROJECT`, `BACKLOG`, and `BUILD_LOG` files and stable `ONTOLOGY.md`. Compiled kickoff artifacts live under `_planning/compiled`.
