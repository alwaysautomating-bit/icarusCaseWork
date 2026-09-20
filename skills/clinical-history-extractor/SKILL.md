---
name: clinical-history-extractor
description: Extract source-backed medical assertions (medications, symptoms, diagnoses, encounters, instructions, referrals) from a witness block or record, then project medication lineages, a clinical chronology, and conflict candidates. Use when asked to compile medical history, extract medical data, or track medication starts, dose changes, tapers, and stops across days and providers in Icarus Casework.
---

# Clinical History Extractor

One extraction pass produces granular assertions with verbatim spans. Deterministic code projects everything else. The model never merges, reconciles, or normalizes.

Read `contracts/medical-assertion-1.0.md` first. The extraction rules are in `references/rules.md`.

## Pipeline

```text
transcripts/preserved + transcripts/first-pass   (witness block, segment indices)
  -> content/investigation/medical/assertions/<id>.assertions.json    (model extraction, reviewed: false)
  -> node scripts/build-medical-projections.mjs                       (validation + projections, no model)
  -> medication-lineages/ conflicts/ timelines/ reports/
```

## Workflow

1. Pick the witness block from `transcripts/first-pass/*.json` (`witness_blocks[].start.segment_index` to `end.segment_index`). A witness may also appear on other days (cross-examination); each block is its own extraction.
2. Dump the block's segments with their `segment_index` using `parseTranscriptTurns` from `scripts/transcript-first-pass-lib.mjs`. Segment indices in the assertions must be those indices.
3. Extract assertions following `references/rules.md`. Work one witness block at a time and in chunks small enough to keep every span exact; write the parts, then merge them into one `<witness>-day<NN>.assertions.json`.
4. Set `extractor.reviewed` to `false`. A person flips it after review.
5. Run `node scripts/build-medical-projections.mjs`. Fix every validation error by correcting the extraction, never by loosening the validator. The common error is citing the answer's segment number for text that is in the question's segment.
6. Check the source for defects before citing it: repeated passages, timestamp jumps, and testimony outside any first-pass block (a witness who continues on a later day may have no block). Record them in `source_notes` and cite only segments that are intact. Do not correct first-pass boundaries by hand.
7. Add `content/investigation/medical/acceptance/<id>.expect.json` when hand-built ground truth exists (for example the corroborating medication CSV), so the projections are scored.
8. Run `pnpm medical:build`; when one witness has several extraction files it also writes a `<witness>-combined` set, which is the projection to read for lineage across days. Report counts, every review candidate, and every acceptance failure. Do not resolve a conflict candidate.

## Guardrails

- Never write to Supabase or promote an assertion to T0.
- Never infer `proceeding_date`; keep it `null` until verified.
- A record read aloud, a patient statement, a provider act, and counsel's question the witness affirmed are different bases; record the right one.
- Keep act and report separate: instructed, prescribed, dispensed, reported taking, and listed are five different claims.
- A hedged answer is `uncertain`, a denial is `negated`, a plan only discussed is `hypothetical`.
- Do not use this skill's output as testimony truth. It is an investigative index of what was said.

## References

- `references/rules.md`: extraction rules
- `references/ontology.md`: pointer to the contract and how the three clocks apply
- `references/medication-actions.md`: how to choose action, act, report, and basis
- `references/provenance-rules.md`: span, segment, and chain rules
