\---

name: transcript-intake
description: >
Register a court proceeding day (a transcript, or a transcript-derived
document like a Rev output or chat transcript of one) as a Casework Source
and Proceeding Day, before any extraction happens. Use whenever a new
transcript, transcript excerpt, or day-of-trial document is received. Do
not use this to extract claims or events — this skill only creates the
intake record and preserves the source as received.
compatibility: Requires a Casework-style store (Source, Proceeding Day objects) or an approved local staging area.
metadata:
domain: legal-provenance
risk-level: high-integrity
---

# Purpose

Create a stable, append-only record of what was received before interpreting
it. A transcript is a Source; the trial day it documents is a Proceeding Day;
they are not the same object, and a day may accumulate more than one Source
(a Rev transcript today, an official court transcript later) without either
overwriting the other.

## Required inputs

Collect, infer, or explicitly mark as unknown:

* Case/matter identifier (e.g. `MAT-2026-001`)
* Proceeding date and day number (e.g. "Day 6 — August 5, 2026")
* Source type: `rev\_transcript | official\_transcript | rough\_draft | video\_derived | third\_party\_summary`
* Source publisher/producer (e.g. Rev, court reporter)
* Original URL or file, capture timestamp, acquisition method
* Content hash if the source is a stable file
* Parser/extraction tool version that will later process it (record now, even if extraction happens in a later step)

## Workflow

1. Create or locate the `ProceedingDay` entity for the case (one per trial day; do not create duplicates for the same date).
2. Create a new `Source` entity for this specific document. Never merge a new source into a prior one, even if it covers the same day — link them as siblings under the same `ProceedingDay`.
3. Preserve the source text byte-for-byte in storage. Do not clean, summarize, or re-format it at intake.
4. Record `published\_at` (when the underlying event/document was produced), `captured\_at` (when Casework received it), and `source\_publisher`, keeping all three distinct.
5. If the source is itself a derivative — e.g. a chat-tool summary discussing a Rev transcript, rather than the Rev transcript itself — record that explicitly as `source\_of\_source: unknown | named | not\_yet\_acquired`. Do not treat a summary-of-a-transcript as equivalent in evidentiary weight to the transcript itself.
6. Return an intake receipt. Do not proceed to extraction in the same step.

## Integrity rules

* A `ProceedingDay` accumulates sources; it never replaces one source with another. An "official transcript" arriving later is a new, additional `Source`, not a correction of the Rev transcript — even though it may later be preferred for extraction.
* Mark unknown provenance as `unknown`, not as the most likely guess. If you cannot tell whether the uploaded text is a full transcript, an excerpt, or a paraphrase, say so.
* Never assume a document is the official court record because it reads like one.

## Output format

```yaml
intake\_receipt:
  proceeding\_day\_id: "PD-2026-006"
  source\_id: "S-006-REV"
  case\_id: "MAT-2026-001"
  source\_type: "rev\_transcript"
  published\_at: "2026-08-05"
  captured\_at: "2026-08-16T23:00:00Z"
  source\_of\_source: "unknown"
  status: "accepted | needs-review"
  unresolved\_items: \[]
```

## Example

A chat-tool transcript summarizing "Day 6" testimony is uploaded. Create `PD-2026-006` if it doesn't exist. Create `S-006-CHATLOG` as the source (not `S-006-REV`, since the actual Rev transcript was not uploaded — only a discussion referencing it). Record `source\_of\_source: "Rev transcript, not directly acquired"` so later extraction steps know this is a second-order document.

