---
name: intake-transcripts
description: Run Icarus Casework's deterministic Transcript Intake Compiler and its testimony first pass, which splits each trial day into candidate witness blocks. Use when asked to intake, process, preserve, normalize, or standardize new transcript captures in the project's transcripts folder, including Rev markdown and text captures, or to list, review, export, or re-run witness blocks.
---

# Intake Transcripts

Use the repository compiler for all transcript intake behavior. Keep source preparation separate from testimony, claim, event, or case analysis.

## What intake produces

```text
transcripts/inbox/            new .md or .txt Rev captures (queue only)
  -> transcripts/preserved/   byte-preserved source of record
  -> transcripts/manifests/   source identity, checksum, trial-day identity
  -> transcripts/first-pass/  candidate witness blocks, examination phases, procedural markers
```

The first pass is written by `scripts/transcript-first-pass-lib.mjs` (compiler `icarus-testimony-first-pass`). One file per trial day, named `Lindsay-Clancy_Trial-Day-NN_Testimony-First-Pass.json`, holding:

- `witness_blocks`: one block per witness (`witness_001`, `witness_002`, …) with `witness_name_candidate`, `start` and `end` locators (`segment_index`, `source_line`, `timestamp_display`, `timestamp_seconds`, Rev `url`), `oath_detected`, `excusal_detected`, and `boundary_confidence`.
- `phase_sets`: candidate direct, cross, redirect, and recross phases per witness, with examiner candidates.
- `procedural_markers`: objections, sidebars, recesses, exhibits, and similar cues.

A block runs from the line where a party calls the witness to the line before the next witness is called. It can include procedure before testimony begins or after it ends. `boundary_confidence` measures cue coverage (a call, an oath, an excusal) and nothing about accuracy or credibility.

## Workflow

1. Work from the Icarus Casework repository root containing the `transcript:intake` package script.
2. Run `pnpm testimony:process` to preserve and deterministically structure supported inbox transcripts, generate the first pass with witness blocks, and archive successful inbox originals.
3. Run `pnpm testimony:index` separately when the request calls for Thread Collapse trial-day indexes. That branch reads preserved raw-source intelligence and must not consume the first-pass output.
4. For specific files elsewhere, run `pnpm transcript:intake <path> [...more paths]`.
5. Report each generated or reused preserved transcript, manifest, first-pass artifact, and processed-input archive path. Report trial indexes separately when that independent branch is run.
6. For every day processed, report the witness-block count and list any block with `boundary_confidence` below 0.80, no detected oath, or no detected excusal, so a person can check the boundaries. Do not correct boundaries by hand.
7. Surface every `WARN`, `SOURCE_CONFLICT`, or other failure without weakening or bypassing it.

## Reviewing and exporting witness blocks

Open `/cases/<case-id>/record/testimony` in the app. It reads the preserved transcripts and first-pass files directly, so it works for every processed day without a database load. It shows every witness by trial day, the witness's testimony as plain text with the transcript timestamps, and a files card with downloads:

- testimony as plain text (`.txt`)
- the witness block with its segments (`.json`)
- the day's preserved source transcript
- the day's first-pass JSON
- the Rev transcript and video link

Timelines, the Trial Index, and cited transcript positions link to this view by witness name.

`transcripts/preserved` and `transcripts/first-pass` are the authorities for this view. The Python `transcript_tools` prototype (`split_witnesses.py`) predates the compiler; the JavaScript library is the maintained implementation, so do not run the prototype for new work.

## Boundaries with the database

- Intake and first pass never write to Supabase. Publication is a separate, explicit step (`pnpm testimony:publish-corpus`, which runs `pnpm testimony:verify` first).
- Corpus publication creates preserved artifacts, exact segments, and proceedings. It creates no claims, events, or witness units. The `witness_blocks` and `witness_block_segments` tables are populated only by governed knowledge mapping, and only for the days that have been mapped.
- The Court Record search runs against published segments. The witness-testimony view runs against the files. A day can appear in one and not the other.

## Guardrails

- Never manually rename or rewrite a transcript source.
- Never infer `proceeding_date` from a publisher display or publication date.
- Never overwrite a preserved source when its checksum differs.
- Treat witness names, block boundaries, examination phases, jury state, and procedural markers as candidates that need review. Names can include a title ("Officer Brian Josephine") and can be wrong where the call was phrased unusually.
- Transcript timestamps are media positions in each day's own recording, not event times, and are not comparable across days or witnesses.
- Do not promote anything in a witness block to a fact, event, claim, or database record.
- Do not perform downstream evidence analysis unless the user separately requests it.
