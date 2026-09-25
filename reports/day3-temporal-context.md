# Testimony → Temporal Context Compiler — Day 3 acceptance

Generated: 2026-09-20T23:01:34.823Z
Compiler: `testimony-knowledge/1.0+timeline-candidate/1.0+temporal-context/1.0` v1.0.0
Source: MA v. Lindsay Clancy Day 3, 1873 committed segments (sha256 `6393970b4e8c4733…`)
Accounts: **Officer Stephen Hall**, then **Officer Brian Josephine**

## Second-pass proof

| Check | Result |
|---|---|
| Hall's account after Josephine is processed: pipeline payload byte-identical | PASS |
| Hall's event candidates and constraints unchanged | PASS |
| Rerun is idempotent (identical content hash) | PASS |
| New event candidates added by the second witness | 20 |
| New temporal assertions added | 20 |
| Possible shared anchors proposed | 11 |
| Possible same-event links proposed (pending review) | 9 |
| Conflicts preserved | duration_ranges_disjoint, state_disagreement |

## Compiler report

| Measure | Count |
|---|---|
| Testimony units reviewed | 23 |
| Knowledge items created | 23 |
| Claims created | 23 |
| Event candidates created | 40 |
| Temporal assertions created | 40 |
| — exact times | 0 |
| — exact dates | 0 |
| — approximate times | 2 |
| — intervals | 0 |
| — durations | 4 |
| — relative-only | 5 |
| — sequence-only | 25 |
| — lower / upper bounds | 0 / 0 |
| — unknown time | 4 |
| Qualified assertions (witness wording) | 7 |
| Assertions adopted from a question's premise | 2 |
| State observations | 6 |
| Knowledge-state changes | 5 |
| Temporal constraints | 32 |
| Candidate anchors identified | 13 |
| Possible shared anchors | 11 |
| Possible same-event links | 9 |
| Temporal conflicts | 2 |
| Additional accounts of existing candidates | 9 |
| Additional details attached | 1 |
| Events with sequence position but no clock time | 34 |
| Unresolved entity mentions | 15 |
| Source irregularities in cited ranges | 0 |
| Source irregularities preserved (whole proceeding) | 3 |
| **Canonical events created** | **0** |
| **Automatic SAME resolutions** | **0** |

## Preserved conflicts

- **duration ranges disjoint** — “Seven to 10 minutes.” (Officer Stephen Hall) and “I would say anywhere from three to four minutes.” (Officer Brian Josephine) do not overlap.
- **state disagreement** — Accounts differ on screaming-at-kitchen-entry: Officer Stephen Hall “ended”, Officer Brian Josephine “continuing”.

Neither side of a conflict was averaged, chosen, or rewritten.

## Candidate anchors

- `ANC-103573A3FF` **Ambulance arrives in the driveway** (STATE) — one account
- `ANC-E86D10FD6D` **First child carried to the ambulance** (TRANSITION) — shared by 2 accounts
- `ANC-1FCBF0C2C2` **Dispatch to 47 Summer Street** (CLOCK) — shared by 2 accounts
- `ANC-82F708AECD` **Dispatch relays that Patrick cannot wake them** (INFORMATION) — shared by 2 accounts
- `ANC-692FE8C3EE` **EMS care underway in the left basement** (STATE) — shared by 2 accounts
- `ANC-EA874EB9DE` **Fire personnel arrive** (ARRIVAL_DEPARTURE) — shared by 2 accounts
- `ANC-AB1953CFDF` **Officers enter the kitchen** (TRANSITION) — shared by 2 accounts
- `ANC-89646CF6B5` **Officers return to the basement** (TRANSITION) — shared by 2 accounts
- `ANC-843671B5A7` **Patrick goes inside** (TRANSITION) — one account
- `ANC-80BC545299` **Patrick's statement in the right basement** (SHARED_OBSERVATION) — shared by 2 accounts
- `ANC-3AA9CFEFEF` **First police arrival** (ARRIVAL_DEPARTURE) — shared by 2 accounts
- `ANC-EC76685EC9` **Police response travel duration** (ARRIVAL_DEPARTURE) — shared by 2 accounts
- `ANC-41951833CE` **Loud scream heard from inside** (SHARED_OBSERVATION) — shared by 2 accounts

## Boundaries

- The 6:11 PM dispatch time appears as **counsel's premise that each officer affirmed**; it is stored as approximate and flagged `adopted-question-premise`, not as the officers' own recollection.
- Response-travel durations remain two separate assertions (7–10 min vs 3–4 min). The dispatch clock plus either duration would imply different arrival times; no arrival time was computed.
- Josephine's uncertainty about whether dispatch spoke of the basement is retained as an additional detail on Hall's radio-relay candidate. It is not used to reorder the relay and scream, because her wording carries no sequence cue.
- Testimony timestamps are source locators only and were not used as event time.
- Constraints exist only where the witness's own wording carries a matching sequence, simultaneity, or state cue.
