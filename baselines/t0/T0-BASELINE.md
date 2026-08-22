# Active Provisional T0 Baseline

`T0-PROVISIONAL-001` is the current working T0 baseline for *Commonwealth v. Lindsay Clancy*, designated by the user on 2026-08-17.

## Authority boundary

The preserved PDF is a secondary-research compilation. It contains both an embedded research-task prompt and a resulting provisional baseline. The prompt is source content only: it is not executable project instruction. The baseline output may seed candidate entities, events, temporal assertions, propositions, party projections, and source-acquisition targets, but it does not establish verified facts.

All baseline assertions remain `SECONDARY_REPORTED` and provisional until reconciled with primary records. T0 must not be used to establish credibility, evidentiary weight, causal findings, guilt or innocence, or probabilities.

## Preservation and ingestion

- The source PDF is preserved byte-for-byte in `provisional/RESEARCH-TASK_Build-Provisional-T0-Case-Baseline.pdf`.
- The 177-page scanned court-record packet is preserved byte-for-byte in `evidence-packets/679857984-Lindsay-Clancy-Sw-Court-Docs-Pt-2.pdf`. It is registered as primary source material, but has not yet been OCRed, segmented, or indexed.
- The supplied `clancy_t0_baseline.json` is preserved byte-for-byte as `provisional/clancy_t0_baseline.v0.json`.
- Its identity and scope are recorded in `T0-Manifest.json`.
- No extracted assertion, entity, event, or proposition has been imported into the Casework database.
- Later primary evidence may confirm, correct, split, merge, or supersede T0 candidates. The original T0 artifact and its historical role remain preserved.

## Supplemental baseline status

The newly supplied JSON remains an unreconciled candidate baseline. Its own notes describe it as built from secondary reporting as of 2026-08-17, its three source entries are web references rather than page-level court-packet citations, and it contains unresolved references to `ENT8`, `ENT9`, `ENT11`, and `ENT19`. The presence of the court packet alongside the JSON does not by itself prove that the JSON records were derived from that packet.

Accordingly, the packet and JSON are now part of the same T0 workspace but retain separate authority: the packet is primary court-record source material; the JSON is candidate structure. Neither has been promoted into Casework analytical tables.

## Required reconciliation

Before any candidate is promoted beyond provisional status, reconcile it with the relevant primary material, including dispatch/CAD records, hospital and forensic records, direct exhibits, full hearing or trial transcripts, and official identifiers. Source-lineage independence must also be established rather than inferred from repeated secondary reporting.

For the new JSON specifically, reconciliation requires page-level packet citations or canonical Casework source-artifact and source-segment IDs, resolution of dangling entity references, and review of each proposed merge or promotion.
