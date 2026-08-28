---
name: intake-transcripts
description: Run Icarus Casework's deterministic Transcript Intake Compiler. Use when asked to intake, process, preserve, normalize, or standardize new transcript captures in the project's transcripts folder, including Rev markdown and text captures.
---

# Intake Transcripts

Use the repository compiler for all transcript intake behavior. Keep source preparation separate from testimony, claim, event, or case analysis.

## Workflow

1. Work from the Icarus Casework repository root containing the `transcript:intake` package script.
2. Run `pnpm testimony:process` to preserve and deterministically structure supported inbox transcripts and archive successful inbox originals.
3. Run `pnpm testimony:index` separately when the request calls for Thread Collapse trial-day indexes. That branch reads preserved raw-source intelligence and must not consume deterministic first-pass output.
4. For specific files elsewhere, run `pnpm transcript:intake <path> [...more paths]`.
5. Report each generated or reused preserved transcript, manifest, first-pass artifact, and processed-input archive path. Report trial indexes separately when that independent branch is run.
6. Surface every `WARN`, `SOURCE_CONFLICT`, or other failure without weakening or bypassing it.

## Guardrails

- Never manually rename or rewrite a transcript source.
- Never infer `proceeding_date` from a publisher display or publication date.
- Never overwrite a preserved source when its checksum differs.
- Do not perform downstream evidence analysis unless the user separately requests it.
