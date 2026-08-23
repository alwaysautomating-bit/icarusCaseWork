# Supabase Data Recovery and Destructive-Operation SOP

Status: canonical operating procedure

Effective date: 2026-08-23

Applies to: Icarus Casework local, staging, and production Supabase environments

Owner: project maintainer or designated database operator

Review cadence: before each hosted deployment and whenever the Supabase CLI, PostgreSQL major version, backup method, seed configuration, or corpus importer changes

## Purpose

This SOP prevents database data loss during migration replay, local-stack repair, upgrades, and other destructive operations. It closes the failure mode in which the schema is fully reproducible but database rows are not represented by migrations, seed data, committed source/import fixtures, or a verified backup.

Migrations protect structure. They do not back up database contents. Supabase `db reset` destroys the selected database, reapplies migrations, and then runs configured seeds. Docker volumes are working state, not durable recovery coverage.

No destructive operation may proceed merely because the migration chain passes.

## Covered destructive operations

This SOP is mandatory before:

- `pnpm exec supabase db reset --local`
- Any use of `supabase db reset --linked` or `--db-url`
- `supabase stop --no-backup`
- Deleting or recreating Supabase Docker volumes
- Reinitializing the local Supabase project
- Replacing a database from a dump or snapshot
- PostgreSQL or Supabase upgrades that require clean volumes
- Any script or manual SQL operation expected to delete, truncate, or overwrite material data

Normal `supabase stop --project-id IcarusCasework` without `--no-backup` does not delete volumes, but it also does not create a durable backup.

## Recovery model

Every dataset must have exactly one documented recovery class before a destructive operation.

| Recovery class | Examples | Required recovery coverage |
| --- | --- | --- |
| Schema | Tables, indexes, functions, RLS, grants, views | Ordered migration committed to Git and proven by zero-state replay |
| Seeded reference data | Small deterministic development fixtures | Reviewed seed file configured in `supabase/config.toml` and committed to Git |
| Rebuildable corpus data | Preserved testimony, source artifacts, compiled proceeding segments | Preserved source bytes, checksummed manifests, deterministic idempotent importer, and expected-count integrity report |
| Mutable recoverable data | Review decisions, saved versions, reconciliation work, analyst-created records, unlinked legacy rows | Verified logical dump or hosted backup with a rehearsed restore path |
| Disposable data | Explicitly temporary or synthetic test records | Written declaration that deletion is intentional; no recovery expected |

Unclassified data is a stop condition. A row is not disposable merely because its purpose is unknown or because it is unlinked.

Supabase Auth identities, Storage metadata, and stored objects require service-specific recovery coverage. Do not assume a normal application-schema data dump captures all Auth or Storage state.

## Responsibility

The operator executing the destructive command is responsible for completing and retaining the preflight record. For a linked staging or production environment, a second authorized maintainer must review the target, backup, restore evidence, and rollback plan before execution.

Agents and automation must stop when a required classification, backup, target identity, or restore result is missing. They may not infer that unexplained data is disposable.

## Required preflight procedure

### 1. Identify the exact target

From the repository root, confirm the local runtime and migration history:

```powershell
pnpm exec supabase status
pnpm exec supabase migration list --local
git rev-parse HEAD
git status --short
```

Do not save or paste the complete `supabase status` output because it contains local credentials. Record only the environment name, explicit target mode (`--local`, `--linked`, or reviewed `--db-url`), project reference when applicable, Git commit, and PostgreSQL major version.

If the intended target is local, every destructive command must include `--local`. If a hosted target is intended, confirm the linked project independently. Never use `db reset --linked` against production.

### 2. Inventory and classify current data

Record exact pre-operation counts for all material application tables. At minimum, record:

- cases, proceedings, source artifacts, and source segments
- proceeding-linked and unlinked source segments separately
- claims, events, event candidates, and temporal assertions
- testimony units, knowledge items, and knowledge relationships
- reconstruction, timeline-view, structure-review, trial-index, and reconciliation versions
- case-ledger, audit, review, provenance, and unresolved-mention records

The minimum source-segment check is:

```sql
select
  count(*) as all_segments,
  count(*) filter (where proceeding_id is not null) as proceeding_linked_segments,
  count(*) filter (where proceeding_id is null) as unlinked_segments
from public.source_segments;
```

Compare the reproducible testimony corpus with the current accepted baseline in `reports/testimony-corpus-integrity.md`. A changed count is not automatically a failure, but every difference must be explained by a committed importer/manifest change or by recoverable mutable data.

For every nonzero unlinked or unexpected count, identify the source and assign a recovery class. If that cannot be done, stop.

### 3. Prove rebuild coverage

Before relying on rebuildability, verify that:

- Each schema change exists in `supabase/migrations`.
- Each seeded record exists in a configured, committed seed file.
- Each corpus record can be recreated from preserved source bytes and a committed deterministic importer.
- Source and package SHA-256 values match their manifests.
- Expected detected, parsed, and committed counts agree.
- Re-running the importer is idempotent.
- No current database-only row is being mistaken for committed source data.

A corpus integrity report proves only the corpus and checks listed in that report. It does not prove restoration coverage for unrelated or legacy rows.

### 4. Create a protected data dump

Create the dump outside Git and outside disposable Docker volumes. The repository's ignored `.data/backups` directory is acceptable for short-lived reset protection, but material recovery copies must also be placed on separately protected storage.

Example local logical dump:

```powershell
$recoveryStamp = Get-Date -Format "yyyyMMdd-HHmmss"
$recoveryDirectory = Join-Path "C:\Backups\IcarusCasework" $recoveryStamp
New-Item -ItemType Directory -Force $recoveryDirectory
pnpm exec supabase db dump --local --data-only --use-copy `
  --file (Join-Path $recoveryDirectory "application-data.sql")
Get-FileHash -Algorithm SHA256 `
  (Join-Path $recoveryDirectory "application-data.sql")
```

The dump must be nonempty, readable only by authorized users, and kept out of Git. Do not place credentials, database URLs, service-role keys, or `supabase status` output in its manifest.

For a hosted environment, use the approved platform backup and logical-export strategy. Record the backup identifier, retention, encryption/access controls, and restore destination. A local dump is not a substitute for the hosted backup policy.

### 5. Create the recovery manifest

Store a manifest beside the protected backup containing:

- Operation purpose and operator
- Timestamp and environment
- Explicit database target
- Git commit and branch
- Supabase CLI and PostgreSQL versions
- Applied migration list
- Exact table and integrity counts
- Data classification decisions
- Dump filename, size, and SHA-256
- Auth and Storage recovery method, or confirmation that their data is intentionally reproducible/disposable
- Restore-test result and location
- Expected post-operation counts
- Approval for a linked environment

The manifest must not contain secrets or source testimony text.

### 6. Verify restoration

Restore the backup into a disposable database that matches the target PostgreSQL major version. Apply the committed migration chain first when testing a data-only dump, then load the dump and compare:

- Exact counts from the recovery manifest
- Primary and foreign-key integrity
- Source-artifact and preserved-source checksums
- Proceeding-linked and unlinked segment counts
- Version, ledger, audit, and provenance counts
- Representative application reads

Resolve seed conflicts, foreign-key failures, incompatible schema changes, and count differences before proceeding. A dump is not verified merely because it was created successfully.

If a restore rehearsal is not currently possible, material unreproducible data makes the destructive operation a stop condition. Do not downgrade it to disposable data to bypass this requirement.

## Go/no-go gate

The destructive operation may proceed only when every answer below is **yes**:

- Is the exact target identified and explicitly selected?
- Is the operation prohibited from targeting production?
- Is every material dataset classified?
- Are all unexpected and unlinked rows explained?
- Does rebuildable data have committed, idempotent rebuild coverage?
- Does mutable data have a protected backup?
- Has that backup been restored successfully in a disposable environment?
- Are pre-operation and expected post-operation counts recorded?
- Are Auth and Storage covered separately when they contain material state?
- Is the rollback owner identified?
- Has a second maintainer approved a linked-environment operation?

Any **no** means stop. Preserve the current database and resolve the gap first.

Until repository-enforced wrapper commands exist, this checklist is a mandatory manual control. The existing `pnpm supabase:reset` command is destructive and does not itself perform the preflight.

## Execution

After the gate passes, use the narrowest explicit command. For local migration replay:

```powershell
pnpm exec supabase db reset --local
```

Do not use `--no-seed` unless the recovery manifest explicitly defines why seed omission is correct. Do not use `stop --no-backup`, delete volumes, or broaden a command to `--all` unless that exact action passed the gate.

## Post-operation validation

Immediately after the destructive operation:

1. Confirm migration history.
2. Run database lint and advisors.
3. Rebuild the reproducible corpus through its approved importer when required.
4. Restore mutable recoverable data through the rehearsed procedure.
5. Re-run corpus and provenance integrity checks.
6. Compare every recorded expected count with the actual count.
7. Run the application verification suite and representative case-workspace reads.

```powershell
pnpm exec supabase migration list --local
pnpm exec supabase db lint --local --level warning --fail-on error
pnpm exec supabase db advisors --local --type all --level warn --fail-on error
pnpm verify
```

Do not declare the operation successful while a count, checksum, migration, relation, or application read differs without an approved explanation. Preserve the backup until the post-operation validation has passed and the retention requirement has expired.

## Incident response

If data is missing or restoration fails:

1. Stop writes to the affected environment.
2. Preserve the failed environment, dump, manifest, logs, and Git state.
3. Do not run another reset or cleanup command.
4. Determine whether the missing records were rebuildable, backed up, or never covered.
5. Restore into a separate environment first; do not experiment on the only remaining copy.
6. Record the root cause, affected data classes, recovery result, and required control changes in the dated build/status documentation.

## Required future automation

The next database-safety implementation slice should add:

- `pnpm db:preflight`
- `pnpm db:backup`
- `pnpm db:restore-verify`
- `pnpm db:reset-safe`
- A committed machine-readable corpus baseline and expected-count manifest
- CI zero-state rebuild and restore-audit jobs
- A hard failure when unexpected unlinked or unclassified rows are present

After those controls exist, direct reset commands should be removed from normal operator workflows. Automation supplements this SOP; it does not remove the need to identify the target and approve linked-environment destruction.

## Official references

- [Supabase local development workflow](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Supabase database seeding](https://supabase.com/docs/guides/local-development/seeding-your-database)
- [Supabase CLI database commands](https://supabase.com/docs/reference/cli/supabase-db)
- [Supabase changelog](https://supabase.com/changelog?types=breaking-change)
