<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Icarus Casework infrastructure rules

These rules are binding for architecture, implementation, and deployment work:

## Preferred infrastructure

- Prefer Supabase and Neon for managed PostgreSQL infrastructure.
- Prefer Vercel Blob or an equivalent object-storage service for source artifacts and exports.
- Firebase is acceptable only when a concrete product or technical requirement justifies it. It is not the default.

## Authentication

Use this default sign-in order:

1. Google
2. Apple
3. Magic links

Do not use Clerk.

## Database migrations

- Use versioned, controlled migrations in every environment.
- If Prisma is introduced, production migrations must run with `prisma migrate deploy`.
- Never use `prisma db push` as the production migration strategy.

## Local Supabase runtime

- `SUPABASE_OPERATIONS.md` is the canonical Supabase architecture and operations guide. Read it before changing local infrastructure, Auth, RLS, grants, migrations, storage, or deployment behavior.
- Docker Desktop with WSL 2 is the container engine for the complete local Supabase stack. The pinned Supabase CLI orchestrates the containers from `supabase/config.toml`; do not introduce a separate local `docker-compose.yml` without a documented requirement.
- Run the repository-pinned CLI through `pnpm exec supabase`.
- Use explicit `--local` or `--linked` targeting for database commands. Until a hosted project is deliberately selected and linked, use `--local` only.
- Never expose the local stack publicly, commit credentials printed by `supabase status`, or place service-role/secret keys in browser-visible environment variables.
- Never change a hosted schema directly in Studio or the SQL editor. Create, replay, verify, and commit a migration before applying it through the controlled deployment workflow.
