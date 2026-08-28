# Reusable Testimony Processing Framework

This directory uses one operational workflow:

```text
inbox
  -> preserved source + intake manifest
     |-> Thread Collapse over preserved raw transcript -> Day X index
     `-> deterministic transcript processing -> segments -> witness blocks
         -> examination phases -> procedural markers -> explicit Supabase publication
```

## Folders

| Folder | Role | Authority |
| --- | --- | --- |
| `inbox/` | New `.md` or `.txt` transcript captures awaiting processing | Queue only |
| `preserved/` | Byte-preserved canonical source artifacts | Source of record |
| `manifests/` | Source identity, checksum, trial-day identity, and intake rules | Canonical intake metadata |
| `first-pass/` | Candidate witness blocks, examination phases, and procedural markers | Derived and reviewable |
| `trial-index/` | Thread-collapse day indexes and corpus table of contents | Navigation-only analytical memory |
| `archive/processed-inputs/` | Original inbox files retained after successful governed intake | Historical intake copies |
| `archive/experiments/` | Superseded processors, test runs, ZIPs, and generated experiments | Retained reference only |

## Commands

Run deterministic intake and structure processing:

```powershell
pnpm testimony:process
```

This processes every supported file directly inside `inbox/`. Failed or unrecognized files remain in place for review. Thread Collapse and trial-index generation are a separate command and do not consume first-pass output:

```powershell
pnpm testimony:index
```

Both branches start from the same preserved source and manifest. Neither derived branch is an input to the other. Existing derived artifacts are retained until an intentional rebuild; changing this workflow does not require rerunning the corpus.

Rebuild only the trial-day indexes:

```powershell
pnpm testimony:index
```

Verify manifest/source/structure/index identity before publication:

```powershell
pnpm testimony:verify
```

Publish canonical proceeding packages to the complete local Supabase stack:

```powershell
pnpm testimony:publish-corpus
```

Publication is deliberately separate because it mutates the authenticated local database. Its command first runs the filesystem identity preflight, then reads only `preserved/` plus `manifests/`, verifies complete source linkage, and uses the governed `commit_testimony_compiler_run` and `publish_proceeding_package` RPCs. First-pass and trial-index artifacts are not evidence and are not published as canonical facts.

## Non-negotiable boundaries

- Never edit a preserved transcript to improve parsing.
- Never overwrite a different-checksum source for the same trial day.
- Boundary confidence measures cue coverage, not credibility or truth.
- Examination phases and procedural markers are candidate structure until reviewed.
- Every later analytical result must retain source-segment and timestamp/deep-link lineage.
- Supabase publication and downstream Casework analysis remain explicit, separate actions.
