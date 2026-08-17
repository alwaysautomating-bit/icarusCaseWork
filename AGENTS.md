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
