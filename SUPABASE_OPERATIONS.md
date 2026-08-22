# Supabase Operations

Status: canonical infrastructure and operations guide

Last verified: 2026-08-22

Local project ID: `IcarusCasework`

This document is the source of truth for running, changing, securing, and eventually deploying the Icarus Casework Supabase environment. Update it whenever the CLI version, local ports, enabled services, authentication providers, migration workflow, or hosted-project status changes.

## Architecture boundary

Icarus Casework uses two distinct Supabase environments:

```text
Next.js application
  |
  +-- local development --> Supabase CLI --> Docker Desktop/WSL 2
  |                                            |
  |                                            +-- Postgres
  |                                            +-- Auth
  |                                            +-- Data API
  |                                            +-- Storage
  |                                            +-- Realtime
  |                                            +-- Studio and Mailpit
  |
  +-- hosted deployment --> explicitly selected Supabase Platform project
```

Docker is the container engine for the complete local Supabase stack. The Supabase CLI creates and coordinates the containers from `supabase/config.toml`; this repository does not need or maintain a separate `docker-compose.yml` for local development.

The local stack is development-only. It uses local credentials, has no production hardening, and must never be exposed to the public internet. A hosted Supabase project does not depend on this machine's Docker engine.

## Versioned sources of truth

| Path | Purpose | Commit? |
| --- | --- | --- |
| `supabase/config.toml` | Local services, ports, Auth behavior, PostgreSQL version, and seed configuration | Yes |
| `supabase/migrations/*.sql` | Ordered database schema, RLS, grants, functions, views, and migration history | Yes |
| `supabase/seed.sql` | Development-only seed data applied by reset | Yes |
| `supabase/templates/magic_link.html` | Local and deployed magic-link email template | Yes |
| `.env.example` | Names and safe examples for application configuration | Yes |
| `.env.local` | Local URLs, publishable key, and local-only secrets | Never |
| `supabase/.temp/`, `supabase/.branches/` | Supabase CLI internal state and project linkage | Never |

Do not make the hosted database the only place where a schema change exists. Every schema change must be represented by an ordered migration in Git.

## Current local runtime

The project pins Supabase CLI `2.113.0` in `package.json` and PostgreSQL major version `17` in `supabase/config.toml`.

| Service | Local address | Notes |
| --- | --- | --- |
| Application | `http://localhost:3000` | Next.js development server |
| Supabase API | `http://127.0.0.1:54321` | Auth, REST, GraphQL, Storage, and related APIs |
| PostgreSQL | `127.0.0.1:54322` | Local database; obtain the complete connection string from `supabase status` only when needed |
| Supabase Studio | `http://127.0.0.1:54323/project/default` | Local database and service UI |
| Mailpit | `http://127.0.0.1:54324` | Captures local magic-link email; it sends no real email |
| Analytics | `127.0.0.1:54327` | Local analytics service configured in `config.toml` |
| Pooler | `127.0.0.1:54329` | Configured but currently disabled |
| Shadow database | `127.0.0.1:54320` | Used by schema diff tooling |
| Edge inspector | `127.0.0.1:8083` | Edge Runtime debugging when that service is running |

`supabase status` prints local secret and service-role credentials as well as public values. Treat its complete output as sensitive operational output: do not paste it into documentation, tickets, chat, screenshots, or commits.

## Prerequisites

- Windows with WSL 2 available.
- Docker Desktop running with Linux containers.
- At least 7 GB of memory available to the complete Supabase stack.
- Node.js 20 or later.
- pnpm `11.19.0` through the repository's `packageManager` declaration.
- Dependencies installed with `pnpm install`.

The CLI is a pinned project dependency. Run it as `pnpm exec supabase ...`; do not depend on an unrelated global CLI version.

## First start and daily startup

1. Start Docker Desktop and wait until the engine is ready.
2. From the repository root, start the complete local stack:

   ```powershell
   pnpm exec supabase start
   ```

3. Confirm the services and obtain the local public values:

   ```powershell
   pnpm exec supabase status
   ```

4. Copy `.env.example` to `.env.local` if it does not already exist. Set only the browser-safe values reported by the local stack:

   ```dotenv
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local-publishable-key>
   ```

5. Replay the database from the committed migrations when setting up a fresh workspace or explicitly validating migration replay:

   ```powershell
   pnpm exec supabase db reset --local
   ```

   This destroys and recreates the local database. Do not run it when unexported local data must be preserved.

6. Start the application:

   ```powershell
   pnpm dev
   ```

Open the application at `http://localhost:3000`, Studio at `http://127.0.0.1:54323/project/default`, and local email at `http://127.0.0.1:54324`.

## Normal shutdown

Stop this project's containers while retaining its Docker volumes:

```powershell
pnpm exec supabase stop --project-id IcarusCasework
```

Do not add `--no-backup` during normal shutdown. That option removes the local data volumes. Do not use `--all` unless stopping every local Supabase project on the machine is intentional.

## Migration workflow

All environments use controlled, timestamped migrations. Never use a production schema-push shortcut and never edit a migration that has already been applied to a shared environment.

### Create and test a migration

1. Create the file through the pinned CLI:

   ```powershell
   pnpm exec supabase migration new <descriptive_name>
   ```

2. Write and review the SQL. Review schema ownership, locks, RLS, grants, function execution privileges, view security, data backfills, idempotency where required, and rollback implications.
3. Rebuild the local database from zero:

   ```powershell
   pnpm exec supabase db reset --local
   ```

4. Verify local migration history:

   ```powershell
   pnpm exec supabase migration list --local
   ```

5. Run database checks:

   ```powershell
   pnpm exec supabase db lint --local --level warning --fail-on error
   pnpm exec supabase db advisors --local --type all --level warn --fail-on error
   pnpm verify
   ```

6. Commit the migration together with the application code and tests that depend on it.

Use local Studio or direct SQL for exploration only. Capture the final schema change in a migration and prove a zero-state replay before committing. Never make schema changes directly in a hosted project's Studio or SQL editor.

### Apply an existing pending migration locally without rebuilding data

When the migration has already been reviewed and a destructive reset is unnecessary:

```powershell
pnpm exec supabase migration up --local
pnpm exec supabase migration list --local
```

This is not a substitute for eventually proving that the full migration chain replays from zero.

## Hosted deployment workflow

No hosted Supabase project is currently selected, linked, or authenticated from this repository. Until an environment is explicitly named, all commands must target `--local`.

When a staging or production project is provisioned:

1. Record the environment owner and project reference in the approved secret/deployment system, not in source code.
2. Authenticate and link deliberately:

   ```powershell
   pnpm exec supabase login
   pnpm exec supabase link --project-ref <approved-project-ref>
   ```

3. Compare migration histories and run the remote advisors:

   ```powershell
   pnpm exec supabase migration list --linked
   pnpm exec supabase db advisors --linked --type all --level warn --fail-on error
   ```

4. Preview the exact pending migrations:

   ```powershell
   pnpm exec supabase db push --linked --dry-run
   ```

5. Have one designated operator review and apply the migration:

   ```powershell
   pnpm exec supabase db push --linked
   ```

6. Recheck migration history, Auth redirects, RLS isolation, application smoke tests, and observability.

Never run `db reset --linked` against production. Never include the development seed in a production push. Never use `migration repair` until the mismatch is understood and the intended history is documented.

## Authentication

The required provider order is Google, Apple, then passwordless magic links. Clerk is prohibited.

Current local state:

- Magic-link sign-in is enabled. Confirmation messages appear in Mailpit.
- Google and Apple provider blocks exist but remain disabled until credentials and hosted callback domains are provisioned.
- Local callback allow-list entries cover `localhost:3000` and `127.0.0.1:3000`.
- Anonymous sign-in is disabled.
- Email confirmation is disabled locally for development convenience; hosted behavior must be reviewed deliberately.

Secrets referenced through `env(...)` in `supabase/config.toml` belong in an ignored environment file or the deployment secret store. Never commit OAuth secrets, database passwords, service-role JWTs, secret API keys, signing keys, or Blob credentials.

Only the Supabase URL and publishable key may use the `NEXT_PUBLIC_` prefix. Service-role and secret keys are server-only and must never be imported by browser code.

## Database and Data API security contract

Every database change must preserve these rules:

- Enable RLS on every table in an exposed schema, including `public`.
- Use explicit PostgreSQL grants as the object-access layer and RLS policies as the row-access layer. Passing one layer does not replace the other.
- Scope case data through ownership or membership checks such as `private.can_access_case(case_id)`; `TO authenticated` alone is not authorization.
- Use both `USING` and `WITH CHECK` for ownership-sensitive updates.
- Never authorize from user-editable `user_metadata`. Use database membership or trusted application metadata.
- Prefer `SECURITY INVOKER` views and functions.
- A necessary `SECURITY DEFINER` function must have an empty or fixed `search_path`, validate `auth.uid()`, enforce case authorization, expose only the minimum required operation, revoke default `PUBLIC`/`anon` execution, and receive an explicit role grant.
- Never put service-role or secret keys into client code, logs, documentation, or screenshots.
- Treat source artifacts and case data as private even when the underlying source was public.
- Storage replacement requires INSERT, SELECT, and UPDATE permissions; bucket policies must remain case-scoped.

The automated migration, persistence, and RLS tests are part of the security boundary. A migration is incomplete until those tests pass against the updated migration chain.

## Local data, backup, and recovery

The migration files are the canonical schema backup. Docker volumes are convenient local state, not a durable backup strategy.

Before a destructive local reset when data matters, export it with a reviewed destination outside Git. Do not commit dumps containing case data or credentials. For hosted environments, configure platform backups and rehearse restore before deployment approval.

The repository ignores `.data/`, so a local data-only export can be placed there deliberately:

```powershell
New-Item -ItemType Directory -Force .data\backups
pnpm exec supabase db dump --local --data-only --use-copy --file .data\backups\supabase-local-data.sql
```

Confirm the dump exists and is protected before resetting. Restoring a data-only dump can conflict with seed rows, foreign-key ordering, or newer migrations, so rehearse and review the restore against a disposable local database instead of treating the dump as automatically restorable.

Recovery order for a disposable local environment:

1. Confirm the needed migration and seed files are committed.
2. Stop only this project without deleting volumes.
3. Restart Docker Desktop if the engine is unhealthy.
4. Start Supabase again.
5. If the database remains disposable and broken, run `db reset --local` to rebuild it from migrations.
6. Run migration history, lint, advisors, tests, and application smoke checks.

## Troubleshooting

### Studio does not load

```powershell
docker version
pnpm exec supabase status
```

If Docker is unavailable, start Docker Desktop and confirm WSL 2 is healthy. If the engine is running but services are unhealthy, use a normal `supabase stop` followed by `supabase start`. Preserve volumes unless data deletion is intentional.

### One or more services are stopped

`supabase status` may report optional or unhealthy containers separately. Check whether the application actually needs the service, inspect Docker Desktop container logs, and restart the local stack. Do not use `--ignore-health-check` as a permanent fix.

### A new table or function is inaccessible through the API

Check both layers:

1. Does `anon` or `authenticated` have the required object grant?
2. Is RLS enabled, and does a case-scoped policy permit the requested row and operation?

New public objects are not automatically exposed by this project's configuration. Add explicit grants and RLS policies in the same migration.

### Migration histories differ

Run the appropriate explicit comparison:

```powershell
pnpm exec supabase migration list --local
pnpm exec supabase migration list --linked
```

Do not repair history reflexively. Determine whether a migration is missing from Git, missing from the database, or was applied outside the controlled workflow. Record the decision before using `migration repair`.

### Ports are already in use

Stop the conflicting process or another local Supabase project. Do not casually change ports because `.env.local`, Auth redirects, tests, and documentation depend on the configured values.

## Upgrade procedure

Supabase CLI, service images, PostgreSQL, Auth, Studio, and Data API behavior can change independently.

Before upgrading:

1. Read the current Supabase changelog, especially breaking changes.
2. Confirm PostgreSQL compatibility and extension availability.
3. Preserve any local data that cannot be recreated.
4. Change the pinned CLI version and lockfile in one reviewed change.
5. Rebuild from migrations and rerun lint, advisors, tests, and the production build.
6. Update this document and the deployment record with the verified versions and date.

The current configuration intentionally targets PostgreSQL 17. Do not change the major version without a tested data-migration and rollback plan.

## Current verification and open gates

Verified locally on 2026-08-22:

- Docker-backed Supabase database, API, Auth, Storage, Studio, and Mailpit are operational.
- All 16 versioned migrations through `20260822204848_protect_legacy_claim_promotion.sql` are applied locally. The Structure Review chain passed a full Docker-backed reset before the preserved local corpus was restored, and the complete chain passes automated zero-state replay.
- Local database advisors report no security or performance issues.
- Database lint and advisors report no issues. The legacy `review_extraction_candidate` UUID-array warning is fixed in the Structure Review migration without changing that RPC's contract.
- ESLint, TypeScript, 101 tests, and the Next.js production build pass.
- Candidate-only reconstruction snapshots are case-scoped, immutable, RLS-readable, and saved atomically through `save_reconstruction_version`; the function rejects snapshots that claim canonical event creation, SAME resolution, courtroom-timestamp substitution, or collapsed tensions.
- Structure review versions are append-only and case-scoped. The public invoker RPC delegates to a fixed-search-path private mutation core that authorizes owner/reviewer membership, locks the target, enforces type-specific patch allowlists and expected versions, captures source lineage server-side, and appends the target change, immutable version, and case-ledger event atomically.
- Knowledge-mapping claims are select-only to authenticated clients. The separately governed legacy claim-to-event action is preserved through the atomic `review_and_promote_claim` RPC; Structure Review never calls it.

Hosted deployment remains blocked until:

- Supabase and Vercel projects are explicitly selected and owned.
- CLI authentication and hosted project linkage are configured.
- Google, Apple, and magic-link hosted redirect behavior is verified.
- Hosted RLS, grants, backups, restore, deletion, secret rotation, and incident procedures are tested.
- Blob storage is provisioned and its case-scoped access model is verified.
- A reviewed remote migration dry-run is approved.

## Official references

- [Supabase CLI and local Docker stack](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [Local development workflow](https://supabase.com/docs/guides/local-development/cli-workflows)
- [CLI configuration](https://supabase.com/docs/guides/local-development/cli/config)
- [Database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Securing the Data API](https://supabase.com/docs/guides/api/securing-your-api)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase changelog](https://supabase.com/changelog?types=breaking-change)
