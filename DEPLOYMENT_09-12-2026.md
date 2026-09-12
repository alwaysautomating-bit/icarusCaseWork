# Deployment

Status: PRIVATE RESEARCH PILOT ACTIVE — populated hosted data, private media, and owner access verified; cross-user and recovery acceptance remain gated

Canonical Supabase architecture, operations, migration, security, recovery, and troubleshooting procedures live in `SUPABASE_OPERATIONS.md`. This file records the deployment gate and must not duplicate or override that operational contract.

## Target Infrastructure

- Application: Vercel-compatible Next.js deployment
- Database and authentication: Supabase
- Object storage: Vercel Blob or equivalent Blob-compatible service
- Local development: Docker-backed Supabase and local checksum-addressed objects
- Fallback database option: Neon if a documented constraint makes Supabase unsuitable
- Firebase: prohibited as a default; requires a recorded concrete reason
- Read-only trial index: CockroachDB Basic cluster `icarus-lite-dev` in AWS `us-east-2`, accessed only through the server-side `icarus_lite_app` SELECT role

## Authentication Order

1. Google OAuth
2. Apple OAuth
3. Email magic links

Clerk is prohibited. OAuth secrets must be environment references and must never be committed. Provider configuration exists in `supabase/config.toml`; magic links are enabled and locally verified, while Google and Apple remain disabled until credentials and hosted redirect domains are provisioned.

## Controlled Migration Workflow

1. Create migrations with `pnpm exec supabase migration new <name>`.
2. Review SQL, RLS policies, grants, ownership, and rollback implications.
3. Run `pnpm exec supabase db reset --local` against the local Docker stack.
4. Run local migration history, database lint, database advisors, and the automated verification suite as specified in `SUPABASE_OPERATIONS.md`.
5. Link the intended remote project explicitly.
6. Preview with `pnpm exec supabase db push --linked --dry-run`.
7. Apply pending migrations with `pnpm exec supabase db push --linked` through the deployment workflow.

Never reset a production database. Never include seed data in a production push. If Prisma is introduced, production uses `prisma migrate deploy`; `prisma db push` remains prohibited.

## Access Controls

- Every exposed table has RLS enabled.
- Authenticated grants are explicit because newly created tables may not be exposed to the Data API automatically.
- Case ownership and membership govern row access.
- Application authorization remains mandatory; RLS is defense in depth.
- Authorization decisions must not use user-editable metadata.
- Service-role or secret keys must never reach the browser.

## Current Verification

- Vercel production: `https://icarus-case-work.vercel.app`
- Production deployment `dpl_FoKSyjvShpbsDbY3F9qKeVPn7t23` is Ready at application commit `14dd9ab`; its runtime error scan is clean.
- The role-aware document-first Casework UI is live. Non-owner navigation is limited to Court Record, Trial Index, Evidence, Questions, and Reports; the actual case owner retains the complete navigation.
- Cockroach Lite route: `/lite`; 21 proceedings, 18 witness blocks, 70 speakers, and 3,988 segments published and validated twice with identical counts and hashes
- Hosted Supabase project: `Icarus Casework Full`, active and explicitly linked
- All 24 hosted migration versions through `20260912012500_supporting_media_delete.sql` match the repository; linked status reports no pending migrations or seeds.
- Vercel holds the hosted Supabase URL and publishable key; no secret/service key is exposed to the client
- Production `/login` returns `200`; unauthenticated protected routes return the expected redirect to `/login`.
- The hosted Clancy corpus contains 20 proceedings and 35,291 exact source segments. Repeat governed publication produced no duplicate proceeding, segment, or analytical rows.
- Trial Index contains 18 navigation-only days and 18 immutable versions. Its repeat publication is idempotent.
- An authenticated hosted owner opened Casework, Trial Index, Court Record, Files, Questions, and Evidence successfully.
- A private Vercel Blob store is connected to Production and Preview. Authenticated supporting-picture upload, read, and deletion passed the 4 MB server-action MVP smoke test.
- A pre-pilot backup snapshot is preserved at `C:\Backups\IcarusCasework\20260912-001707`; a restore rehearsal remains open.
- The detailed publication and acceptance record is maintained in `PILOT_DEPLOYMENT.md`.

- Supabase CLI version pinned: `2.113.0`
- WSL 2 with Ubuntu is installed and verified on the Microsoft WSL 2 kernel
- Docker Desktop `4.86.0` and Docker CLI `29.7.2` are installed and the local engine runs successfully
- All 24 migrations through `20260912012500_supporting_media_delete.sql` apply locally and match hosted migration history
- RLS, policies, grants, private authorization helpers, and the owner-membership trigger are exercised by an authenticated browser session
- Local magic-link delivery, OTP confirmation, cookie session refresh, case bootstrap, artifact/claim insertion, and authenticated audit attribution are verified end to end
- Testimony intake RLS, cross-user denial, atomic commit, forbidden reconciliation fields, duplicate reuse, and read-only support/verification contracts pass against the live local Data API
- The real Rev MA v. Lindsay Clancy Day 6 page passes the authenticated browser flow with 410 segments, 123 claims, four acquisition targets, and zero support or verification rows
- Remote advisors report the expected authenticated governed `SECURITY DEFINER` RPCs; each remains protected by its internal case-authorization contract
- ESLint, TypeScript, the maintained test suites, and the Next.js production build pass
- The private Vercel Blob adapter uses pinned `@vercel/blob` `2.8.0`; credentialed cloud upload/read/delete is verified.
- Local development can use a real Supabase identity through the development-only Auth bypass. Commit `ee436a2` makes the bypass replace stale or different local sessions; this commit is not part of the verified production deployment and does not change production Auth.

## Deployment Gate

Full Casework production acceptance is blocked until:

- a signed-in non-owner member and an unassigned outsider complete the hosted browser/RLS isolation pass;
- Google, Apple, and magic-link redirect domains are configured for the hosted environment, with Google and Apple verified using deployed credentials;
- the divergent Drizzle schema reference is reconciled or formally retired;
- the preserved backup is restored into an isolated target and row-count, checksum, Auth, and source-link checks pass;
- secret rotation and incident procedures are rehearsed.

Allowed terminal dispositions: approved for deployment, rejected for remediation, superseded by Neon with recorded rationale, or cancelled. Provisioning activity alone does not satisfy the gate.
