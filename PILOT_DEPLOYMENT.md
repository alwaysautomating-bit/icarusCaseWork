# Icarus five-tab research pilot

This is the controlled release plan for the first hosted Casework slice.

## Included surface

- **Court Record** — authenticated testimony search, exact transcript text, timestamps, speakers, and source links
- **Trial Index** — the navigation-only Day 1–18 index
- **Files** — private supporting pictures and folders; uploads remain non-canonical
- **Questions** — open/resolved research queue with sourced known points and findings
- **Evidence** — manually established items, underlying sources, sourced facts, and linked questions
- **Access** — owner-only pilot membership management required to add testers

Vercel defaults to `research_pilot`. Advanced analytical routes are absent from navigation and direct requests to Structure, Review, Reconcile, Reconstruct, Care Trajectory, or Reports redirect to Trial Index. Local development defaults to the complete workspace. A later reviewed release can set `ICARUS_DEPLOYMENT_SLICE=full`.

## Storage behavior

Supporting images use the local `.data/case-media` directory when running off Vercel. On Vercel they use the connected private Blob store. Reads continue through the authenticated Icarus media route, so the Blob URL is never the authorization boundary.

The MVP upload limit is 4 MB. This keeps the complete multipart request inside the hosted function request envelope. Larger files should move to a direct-to-Blob upload flow later.

If Vercel does not provide `BLOB_READ_WRITE_TOKEN`, uploads fail closed. The application never falls back to ephemeral deployment storage.

## Current hosted state

Audited on 2026-09-12:

- Vercel project `icarus-case-work` is live at `https://icarus-case-work.vercel.app`; the `main` deployment is ready.
- Production and Preview have the hosted Supabase URL, publishable key, and the connected private `icarus-casework-private-media` Blob store.
- Hosted Supabase has all 24 migrations through `20260912012500_supporting_media_delete.sql`; a follow-up dry run reports no pending migrations or seeds.
- The Clancy corpus is owned by the confirmed hosted account and contains 20 published proceedings and 35,291 exact source segments.
- A complete rerun reused all 20 packages, created no duplicates, and created no claims, events, or other analytical findings.
- Trial Index contains 18 navigation-only days, all linked to Court Record proceedings, with 18 immutable versions and a successful idempotent rerun.
- The owner-authenticated production smoke check passed for Casework, Trial Index, Court Record, Files, Questions, and Evidence. A Preview upload was written to private Blob, read through the authenticated media route, and removed through the case-scoped delete action; the store was empty afterward.
- The pre-write free-plan logical snapshot and checksum manifest are stored outside Git under `C:\Backups\IcarusCasework\20260912-001707`.

## Release sequence

Do not deploy directly from an unexplained dirty working tree. Resolve or deliberately preserve every unrelated modification first. The removed legacy PDF artifacts are an intentional retirement; a new downloadable Reports experience is deferred to a later release.

1. Run the local gate:

   ```powershell
   pnpm verify:pilot
   pnpm exec supabase db lint --local --level warning --fail-on error
   pnpm exec supabase db advisors --local --type all --level warn --fail-on error
   ```

   `verify:pilot` runs the complete repository verification gate with no test exclusions. Reports remains outside this release even though the retained reference artifact is still integrity-checked.

2. Complete the hosted backup and restore-rehearsal gate in `SUPABASE_DATA_RECOVERY_SOP.md`.

3. Reconfirm the migration plan, then apply it through the linked workflow:

   ```powershell
   pnpm exec supabase migration list --linked
   pnpm exec supabase db push --linked --dry-run
   pnpm exec supabase db push --linked
   pnpm exec supabase migration list --linked
   ```

4. Run hosted Supabase security and performance advisors. Verify that the new research and supporting-media tables are exposed only through their authenticated grants and case-scoped RLS policies.

5. Publish the preserved testimony corpus as the existing hosted owner. Keep the hosted secret key in the terminal session only—never in Vercel or a committed environment file:

   ```powershell
   $env:ICARUS_PUBLISH_TARGET='hosted'
   $env:ICARUS_PUBLISH_CONFIRM='I_UNDERSTAND_THIS_WRITES_TO_HOSTED_SUPABASE'
   $env:ICARUS_PUBLISH_SUPABASE_URL='<hosted HTTPS Supabase URL>'
   $env:ICARUS_PUBLISH_SUPABASE_PUBLISHABLE_KEY='<hosted publishable key>'
   $env:ICARUS_PUBLISH_SUPABASE_SECRET_KEY='<terminal-only hosted secret key>'
   $env:ICARUS_PUBLISH_OWNER_EMAIL='<existing hosted owner email>'
   pnpm testimony:publish-corpus
   pnpm testimony:publish-corpus
   pnpm trial-index:lindsay
   ```

   The second corpus publication must report duplicate-free reuse. The Trial Index command must report 18 navigation-only days and idempotent replay.

6. Create a preview from the reviewed commit:

   ```powershell
   vercel deploy
   ```

7. Verify the preview with the owner and one viewer account:

   - login and logout;
   - all five pilot tabs are visible;
   - advanced case routes redirect to Trial Index;
   - Court Record search returns Clancy testimony and opens exact segments;
   - Trial Index opens the corresponding Court Record proceeding;
   - a test image uploads, renders through the private authenticated route, and remains invisible to an outsider;
   - Questions and Evidence create, source, link, search, and enforce viewer read-only behavior;
   - an unassigned user sees no Clancy case.

8. Promote the verified preview without rebuilding a different artifact:

   ```powershell
   vercel promote <verified-preview-url>
   ```

9. Scan production runtime errors and re-run the five-tab smoke check. Add testers from the owner-only **Access** tab after each tester signs in once.

## Rollback

Application rollback uses `vercel rollback`. The pilot database migrations are additive and remain in place; do not reverse production migration history casually. The previous application version does not depend on the added tables, so an application rollback remains compatible.
