# Lindsay Clancy Longitudinal Care Trajectory v1

Date: 2026-08-23
Status: Reviewed testimony demo; not a canonical clinical record

## Build result

The case workspace now includes a **Care Trajectory** route with two synchronized time scales:

- Full trajectory: September 15, 2022 through January 23, 2023
- Post-McLean focus: January 9 through January 23, 2023

Both scales keep one continuing episode visible while aligning medication exposure and amount, sleep burden, clinical state, diagnostic framing, care ownership, and escalation on the same calendar.

## January medication sequence represented

- January 9: diazepam 5 mg prescription, 14-count
- January 12: trazodone 150 mg prescription, 30-count
- January 16: amitriptyline 10 mg prescription and reported administration
- January 23: authorization to increase amitriptyline to 20 mg, visually distinguished as apparently not taken based on pill-count testimony

The UI does not treat prescribed, reportedly taken, dose-change, taper, stopped, and recommended-but-apparently-not-taken states as interchangeable.

## Interpretation boundary

The continuing episode is an analytical candidate. It links the age and persistence of the condition across successive interventions without claiming that the testimony projection is a complete medical chart. Starting a new medication does not reset the episode clock.

The January accountability frame also separates two different questions:

1. Whether emergency commitment criteria were present at a visit.
2. Whether persistent non-stabilization warranted diagnostic consultation, coordinated handoff, collateral information, records acquisition, or a higher level of ongoing treatment support.

## Provenance

Every medication period and state observation in the reviewed fixture carries an exact source-segment identifier. Selecting an item opens that testimony segment in the canonical Court Record. The current projection uses reviewed Day 10 and Day 11 testimony.

All 28 distinct source-segment identifiers used by the fixture were verified against the local reproducible corpus.

## Deliberately unresolved

- Medication prescriptions and pill counts are not automatically converted into confirmed daily administration.
- Proposed dose changes remain separate from doses demonstrated as taken.
- Sleep burden is displayed as sourced observations; no false cumulative-hour total is manufactured between observation dates.
- Resnick's later direct examination, retrospective clinical interpretation, and trial testimony remain separate clocks and are not included until the full transcript is reconciled.
- Causal conclusions about medication, diagnosis, or outcome are not encoded by this demo.
- Persistence and saved comparison of multiple trajectory versions will require a governed database contract after the visual semantics are reviewed.

## Verification

- Focused longitudinal model tests: passed
- TypeScript: passed
- ESLint: passed
- Production build: passed
- Full regression: 113 unique tests passed; five migration-heavy tests first exceeded the 30-second limit under concurrent load and then passed when their five files were rerun serially (14 assertions passed)
- Auth boundary: direct unauthenticated route request redirected to `/login` as designed
