# Day 6 Testimony → Timeline Candidate Compiler v1 acceptance

Generated: 2026-08-22T23:31:45.246Z

- Acceptance witness: **Maureen Hartnett**, complete **488-segment** block
- Proceeding completeness: **2197 detected = 2197 parsed = 2197 committed**
- Final transcript timestamp: **04:16:42**
- Reviewed output: **11 testimony units, 11 knowledge items, 11 claims**
- Timeline output: **12 event candidates, 12 temporal assertions**
- Time forms: **0 exact clock times, 3 exact dates, 1 approximate, 2 intervals, 1 relative-only, 1 sequence-only, 4 unknown**
- Wording-qualified assertions: **4**
- Unresolved entity mentions: **19**
- Canonical events created: **0**
- SAME resolutions created: **0**
- Persistence: **complete and idempotent** through `public.commit_testimony_timeline_candidates`

## Provenance and projection

The security-invoker `public.timeline_candidate_projection` joins Event Candidate → Temporal Assertion → Claim → Knowledge Item → Testimony Unit → Source Segment → Witness/Proceeding metadata. It contains 13 source-linked rows and does not duplicate source text in a new table.

## Source irregularities

- Selected Hartnett block: **0** timestamp reversals
- Complete Day 6 proceeding: **3** preserved provider timestamp reversals

No source timestamp was repaired, and no testimony timestamp was used as event time.

## Remaining gaps

- This acceptance run compiles reviewed event-bearing units from one complete witness block; it does not auto-extract the entire block without human review.
- Unresolved person, organization, and location mentions remain for SAME review.
- Timeline candidates remain pending for event-level review and are not canonical events.
