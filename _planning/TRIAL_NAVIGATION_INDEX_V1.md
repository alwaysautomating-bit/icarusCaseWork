# Trial Navigation Index v1

Date: 2026-08-22

Status: completed locally

## Product contract

The Trial Navigation Index is the table of contents for a trial:

```text
trial day and date -> witness -> general testimony or event topic -> canonical proceeding
```

It answers navigation questions such as “What day was the Apple Watch testimony?”, “When was the 911 call played?”, “Which day did a witness appear?”, and “When did the defense begin?” It does not answer what actually happened in the underlying case.

The index is established during initial case setup and can be maintained in either direction:

- Historical cases: backfill the known trial calendar, then link days to canonical proceedings as transcripts are ingested.
- Live cases: create planned or in-progress days, update witnesses and topics as sessions unfold, and attach canonical proceedings when they become available.

## Epistemic boundary

Every index day is permanently marked `navigation_only`. An index entry is not evidence, a factual finding, reconstruction input, or a substitute for transcript testimony. Reporting references are lookup aids only. Canonical testimony remains in the Court Record.

Saving an index day never creates a claim, event candidate, canonical event, identity resolution, finding, timeline view, or reconstruction version. Conflicts between index metadata and linked canonical metadata remain visible until a reviewer deliberately resolves them.

## User workflow

1. Open a case’s Foundation page and establish or open its Trial Index.
2. Create a day with its number, date, session status, trial phase, headline, summary, and basis.
3. Add one witness and one topic per line. A witness can be marked appeared, continued, expected, or reported.
4. Optionally add non-evidentiary navigation references and link a canonical proceeding.
5. Search across day summaries, witness names, roles, topics, and topic descriptions.
6. Open the linked canonical proceeding or an exact source segment in the Court Record.
7. Save later changes as immutable versions with a change note.

Owners and reviewers can create and amend index days. Researchers and viewers can search and navigate but cannot mutate the index.

## Persistence contract

Migration: `20260822214141_trial_navigation_index_v1.sql`

- `trial_index_days`: current case-scoped day record, unique by case and day number.
- `trial_index_day_versions`: immutable snapshot for every accepted change.
- `trial_index_projection`: security-invoker read model with linked proceeding metadata and searchable witness/topic labels.
- `upsert_trial_index_day`: authenticated public invoker that delegates to a fixed-search-path private mutation core.

The RPC validates case membership, linked proceeding ownership, referenced source segments, speakers, and witness blocks server-side. The mutation locks the day, appends its immutable version, and writes the case audit event atomically. Direct client writes to both tables are denied; authenticated reads remain case-scoped by RLS; anonymous access is denied.

## Lindsay Clancy acceptance slice

The reviewed fixture and repeatable importer establish the supplied Day 1–18 navigation index for the canonical testimony-corpus workspace:

```powershell
pnpm trial-index:lindsay
```

Normal reruns preserve every existing day. A deliberate reviewed refresh of one fixture day requires an explicit target:

```powershell
pnpm trial-index:lindsay -- --update-day 18
```

Acceptance result:

- 18 indexed trial days.
- 14 linked canonical proceedings and four editorial-only days awaiting canonical transcripts.
- 36 witness entries and 54 topic entries.
- Search acceptance for “Apple Watch” returned Day 14.
- The Day 14 canonical link opened the matching proceeding in the Court Record.
- Day 1’s index/canonical date disagreement is preserved and visibly flagged.
- Day 18 has three immutable versions; the corrected current version retains four topics.
- Default importer replay preserved all 18 days without creating another version.
- Zero claims, canonical events, identity resolutions, findings, or reconstruction versions created.

Acceptance reports:

- `reports/lindsay-clancy-trial-index-v1.md`
- `reports/lindsay-clancy-trial-index-v1.json`

## Deferred scope

- Automated transcript-to-index compilation.
- Calendar/docket ingestion and scheduled live-session reminders.
- Witness identity resolution beyond the recorded navigation label.
- Automatic reconciliation of date, witness, or topic disagreements.
- Hosted deployment and OAuth acceptance.
