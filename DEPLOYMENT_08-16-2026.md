# Deployment

Status: LOCAL STACK VERIFIED — cloud resources not provisioned

## Target Infrastructure

- Application: Vercel-compatible Next.js deployment
- Database and authentication: Supabase
- Object storage: Vercel Blob or equivalent Blob-compatible service
- Local development: Docker-backed Supabase and local checksum-addressed objects
- Fallback database option: Neon if a documented constraint makes Supabase unsuitable
- Firebase: prohibited as a default; requires a recorded concrete reason

## Authentication Order

1. Google OAuth
2. Apple OAuth
3. Email magic links

Clerk is prohibited. OAuth secrets must be environment references and must never be committed. Provider configuration exists in `supabase/config.toml`; magic links are enabled and locally verified, while Google and Apple remain disabled until credentials and hosted redirect domains are provisioned.

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
- WSL 2 with Ubuntu is installed and verified on the Microsoft WSL 2 kernel
- Docker Desktop `4.86.0` and Docker CLI `29.7.2` are installed and the local engine runs successfully
- Bootstrap and testimony migrations apply from zero through `supabase db reset`; `supabase migration list --local` confirms `20260813090819` and `20260817035154`
- RLS, policies, grants, private authorization helpers, and the owner-membership trigger are exercised by an authenticated browser session
- Local magic-link delivery, OTP confirmation, cookie session refresh, case bootstrap, artifact/claim insertion, and authenticated audit attribution are verified end to end
- Testimony intake RLS, cross-user denial, atomic commit, forbidden reconciliation fields, duplicate reuse, and read-only support/verification contracts pass against the live local Data API
- The real Rev MA v. Lindsay Clancy Day 6 page passes the authenticated browser flow with 410 segments, 123 claims, four acquisition targets, and zero support or verification rows
- Supabase database lint reports no schema errors
- ESLint, TypeScript, 20 Vitest tests, the maintained local integration script, and the Next.js production build pass
- Private Vercel Blob adapter is implemented with pinned `@vercel/blob` `2.8.0`; credentialed cloud verification is still pending

## Deployment Gate

Deployment is blocked until:

- a Supabase project and Vercel project are explicitly selected;
- Google, Apple, and magic-link redirect domains are configured for the hosted environment;
- Blob storage is provisioned with case-scoped access rules;
- remote migration dry-run is reviewed;
- Google and Apple OAuth are verified with deployed credentials, and authentication/application authorization/RLS are retested against hosted Supabase;
- the divergent Drizzle schema reference is reconciled or formally retired;
- backup, restore, deletion, secret rotation, and incident procedures are rehearsed.

Allowed terminal dispositions: approved for deployment, rejected for remediation, superseded by Neon with recorded rationale, or cancelled. Provisioning activity alone does not satisfy the gate.
