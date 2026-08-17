# Deployment

Status: PLANNED — cloud resources not provisioned

## Target Infrastructure

- Application: Vercel-compatible Next.js deployment
- Database and authentication: Supabase
- Object storage: Vercel Blob or equivalent Blob-compatible service
- Local development: PGlite and local checksum-addressed objects
- Fallback database option: Neon if a documented constraint makes Supabase unsuitable
- Firebase: prohibited as a default; requires a recorded concrete reason

## Authentication Order

1. Google OAuth
2. Apple OAuth
3. Email magic links

Clerk is prohibited. OAuth secrets must be environment references and must never be committed. Provider configuration exists in `supabase/config.toml` but remains disabled until credentials and redirect domains are provisioned.

## Controlled Migration Workflow

1. Create migrations with `supabase migration new <name>`.
2. Review SQL, RLS policies, grants, ownership, and rollback implications.
3. Run `supabase db reset` against the local Docker stack.
4. Run `supabase migration list --local` and the automated migration test.
5. Link the intended remote project explicitly.
6. Preview with `supabase db push --dry-run`.
7. Apply pending migrations with `supabase db push` through the deployment workflow.

Never reset a production database. Never include seed data in a production push. If Prisma is introduced, production uses `prisma migrate deploy`; `prisma db push` remains prohibited.

## Access Controls

- Every exposed table has RLS enabled.
- Authenticated grants are explicit because newly created tables may not be exposed to the Data API automatically.
- Case ownership and membership govern row access.
- Application authorization remains mandatory; RLS is defense in depth.
- Authorization decisions must not use user-editable metadata.
- Service-role or secret keys must never reach the browser.

## Current Verification

- Supabase CLI version pinned: `2.113.0`
- Bootstrap migration generated through the CLI
- Bootstrap migration applies from zero in the automated PostgreSQL-compatible test
- RLS, policies, grants, private authorization helpers, and owner-membership trigger are present
- Docker Desktop `4.86.0` and Docker CLI `29.7.2` are installed; local Supabase replay is not yet evidenced because WSL/Virtual Machine Platform enablement and a Windows restart are still required
- Private Vercel Blob adapter is implemented with pinned `@vercel/blob` `2.8.0`; credentialed cloud verification is still pending

## Deployment Gate

Deployment is blocked until:

- a Supabase project and Vercel project are explicitly selected;
- Google, Apple, and magic-link redirect domains are configured;
- Blob storage is provisioned with case-scoped access rules;
- Docker-backed `supabase db reset` and `supabase migration list --local` pass;
- remote migration dry-run is reviewed;
- authentication, application authorization, and RLS are tested together;
- backup, restore, deletion, secret rotation, and incident procedures are rehearsed.

Allowed terminal dispositions: approved for deployment, rejected for remediation, superseded by Neon with recorded rationale, or cancelled. Provisioning activity alone does not satisfy the gate.
