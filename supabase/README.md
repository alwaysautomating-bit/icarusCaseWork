# Supabase Project Directory

The canonical architecture, Docker runtime, startup, migration, security, recovery, troubleshooting, and hosted-deployment procedures are in [`../SUPABASE_OPERATIONS.md`](../SUPABASE_OPERATIONS.md).

Directory contract:

- `config.toml` configures the complete Docker-backed local Supabase stack.
- `migrations/` is the ordered and reviewable database schema history.
- `seed.sql` contains development-only seed data.
- `templates/` contains versioned Auth email templates.
- `snippets/` contains developer SQL scratchpads; snippets are not schema history and must not replace migrations.
- `.temp/` and `.branches/` are ignored Supabase CLI state and must not be committed.

Use the pinned CLI through `pnpm exec supabase`. Target database commands explicitly with `--local` or `--linked`; this repository currently has no approved hosted-project linkage, so use `--local` unless a deployment task explicitly identifies the target environment.
