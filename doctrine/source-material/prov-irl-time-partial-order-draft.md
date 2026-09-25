# PROV + IRL Time — Temporal Context & Partial-Order Reconstruction

Icarus should distinguish between **the order in which information enters the case record** and **the order in which events occurred in the real world**.

Every persisted object receives a stable identity:

```text
EVT-000184   event
CLM-001922   claim
WIT-000031   witness
SRC-000087   source
SEG-004410   transcript segment
PRP-000266   proposition
REL-002771   relationship
EVD-000144   evidence item
```

Persisted changes may also receive a case-scoped logical sequence:

```text
logical_order = 4817
```

This provides deterministic ordering for storage, replay, audit, pagination, snapshots, and reproducibility.

But that sequence does not determine when something happened in the real world.

Icarus must preserve:

```text
RECORD ORDER
when information entered or changed in Icarus

TEMPORAL ORDER
when real-world events occurred or can be placed relative to one another

INFORMATION ORDER
when information became available to a person or system

CAUSAL ORDER
what a source claims caused, contributed to, or resulted from something else
```

These are separate dimensions.

---

## Temporal reconstruction is a partial-order problem

Case evidence rarely provides a clean sequence of exact timestamps.

Instead, sources provide a mixture of:

* exact clock times
* approximate times
* durations
* before/after statements
* observations of resulting states
* overlapping activity
* arrival sequences
* information transfers
* synchronized observations
* physical constraints
* conflicting estimates
* events with no known clock time

Icarus should therefore reconstruct chronology as a **partial-order temporal graph**, rather than assigning an invented timestamp to every event.

The question is not always:

> What time did this happen?

Often the answerable questions are:

> What had to happen before this?

> What was already true when this witness arrived?

> Which accounts appear to describe the same event?

> What event can synchronize otherwise independent accounts?

> How tightly can this event be bounded?

---

# Temporal assertions

An event can have any number of temporal assertions.

```text
EVENT E-142
Responder enters basement
```

Possible assertions:

```text
TA-001
type = AFTER
target = responder arrival

TA-002
type = BEFORE
target = child brought upstairs

TA-003
type = APPROXIMATE_TIME
value = ~18:15
source = witness estimate

TA-004
type = AFTER
target = scream

TA-005
type = OVERLAPS
target = second responder entering house
```

Each temporal assertion has its own provenance.

```text
TA-004
E-142 AFTER T-001

derived_from → CLM-184
derived_from → SEG-421
contained_in → Day 3 testimony
attributed_to → Witness A
```

The temporal relationship therefore remains traceable to the evidence that established it.

---

# Temporal anchors

Some evidence provides stronger temporal structure than other evidence.

Icarus should identify **anchors** and use them to organize weaker temporal information.

Examples include:

```text
CLOCK ANCHOR
18:11 dispatch

SURVEILLANCE ANCHOR
17:32:32 store entry

SYSTEM ANCHOR
18:14:07 CAD status change

MEDICAL ANCHOR
18:46 hospital registration

SYNCHRONIZATION ANCHOR
multiple witnesses hear the same scream

STATE ANCHOR
child is already upstairs when Witness B arrives

INFORMATION ANCHOR
Witness A learns the children are in the basement
```

An anchor does not have to be a clock timestamp.

A distinctive shared event can synchronize multiple accounts even when nobody provides a reliable time.

---

# Cross-source synchronization

Suppose three witnesses independently describe:

```text
Witness A:
"I heard someone scream."

Witness B:
"I was coming through the gate when I heard screaming."

Witness C:
"I had just reached the window when I heard the scream."
```

Icarus can create:

```text
T-001
shared scream / child-discovery alert
```

and relate each account to that common anchor:

```text
A-ACCOUNT ── BEFORE ── T-001
B-ARRIVAL  ── OVERLAPS ── T-001
C-WINDOW   ── OVERLAPS ── T-001
```

Now events from three different narratives can be positioned relative to one another without pretending the exact clock time of the scream is known.

This is the same principle used to reconstruct a multi-witness incident from testimony.

---

# Slotting events around anchors

Once anchors are established, other events can be placed around them.

For example:

```text
                     18:11 DISPATCH
                           │
                           ▼
                    responders travel
                           │
                           ▼
                    A₀ — arrivals
                           │
             ┌─────────────┴─────────────┐
             │                           │
      Witness A actions           Witness B actions
             │                           │
             └─────────────┬─────────────┘
                           ▼
                    T₀ — SCREAM
                           │
                 shared synchronization
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
        window event   discovery      movement
             │             │             │
             └─────────────┼─────────────┘
                           ▼
                    later anchor
```

The reconstruction can become increasingly precise as more constraints are added.

No exact timestamp is required for an event merely because surrounding events have timestamps.

---

# Temporal constraints

Icarus should represent temporal knowledge as constraints.

Examples:

```text
E1 BEFORE E2

E3 AFTER E2

E4 OVERLAPS E5

E6 DURING interval I1

E7 APPROXIMATELY 18:15

E8 BETWEEN E2 AND E9

E10 ALREADY_TRUE_AT E11

E12 NO_LATER_THAN E13

E14 NO_EARLIER_THAN E15
```

These constraints can come from different kinds of evidence.

```text
E1 BEFORE E2
basis = direct testimony

E3 BEFORE E4
basis = surveillance timestamps

E5 ALREADY_TRUE_AT E6
basis = witness observation

E7 AFTER E8
basis = physical state dependency

E9 OVERLAPS E10
basis = cross-witness synchronization
```

The basis should remain explicit.

---

# State-based temporal inference

Some of the strongest ordering information comes from observed state.

Suppose Witness B observes:

```text
door already open
band already removed
child already upstairs
ambulance already parked
```

Those observations establish constraints on earlier events.

```text
OPEN_DOOR
    BEFORE
WITNESS_B_OBSERVES_OPEN_DOOR

REMOVE_BAND
    BEFORE
WITNESS_B_OBSERVES_BAND_REMOVED

MOVE_CHILD_UPSTAIRS
    BEFORE
WITNESS_B_OBSERVES_CHILD_UPSTAIRS

AMBULANCE_ARRIVAL
    BEFORE_OR_AT
WITNESS_B_OBSERVES_AMBULANCE
```

Icarus should preserve the distinction between:

```text
SOURCE SAYS:
"The band was already off."

TEMPORAL CONSEQUENCE:
Any removal event must precede this observation.
```

The first is a sourced claim.

The second is a derived temporal constraint.

The derivation itself should be recorded and reviewable.

---

# Knowledge-state changes

Temporal reconstruction should also model **when people knew things**.

An event occurring and a person learning about that event are separate nodes.

For example:

```text
E-100
children are in basement

K-101
Patrick learns children are in basement

K-102
Responder learns children are in basement

E-103
Responder enters basement
```

Possible relationships:

```text
E-100 BEFORE K-101

K-101 BEFORE K-102

K-102 BEFORE E-103
```

This allows Icarus to reconstruct not only:

> What happened?

but also:

> Who knew what, and when did they know it?

That distinction becomes especially important when testimony contains prior knowledge, instructions, warnings, discoveries, or information passed between people.

---

# Competing temporal assertions

Conflicting testimony should remain visible.

Suppose:

```text
Witness A:
arrival occurred 3–4 minutes after dispatch

Witness B:
arrival occurred 7–10 minutes after dispatch
```

Icarus should not silently average these into:

```text
arrival = 6 minutes
```

Instead:

```text
EVENT
A₀ responder arrival

ASSERTION A
dispatch + 3–4 min
source = Witness A

ASSERTION B
dispatch + 7–10 min
source = Witness B
```

Both assertions remain attached to the same candidate event.

Other anchors may later narrow the event without deleting either witness's account.

---

# Event identity and event matching

Different sources may describe the same real-world event differently.

Icarus should therefore distinguish:

```text
SOURCE ASSERTION
from

CANONICAL / CANDIDATE EVENT
```

For example:

```text
Witness A:
"I heard screaming."

Witness B:
"I heard someone yell about a child."

Witness C:
"That's when everyone started moving toward the window."
```

These may be candidates for a shared synchronization event:

```text
T-001
possible shared alert event
```

The match itself must remain reviewable.

```text
REL-800
Witness A assertion
    SAME_EVENT_CANDIDATE
Witness B assertion

status = reviewed
basis = wording + relative sequence + surrounding actions
```

Icarus should never collapse accounts merely because their descriptions sound similar.

---

# Event windows

As constraints accumulate, an event may acquire a defensible temporal window.

Suppose:

```text
18:11:00 dispatch

E1 occurs after dispatch

18:14:32 surveillance/system anchor

E1 occurs before that anchor
```

Then:

```text
E1

earliest_possible = 18:11:00
latest_possible   = 18:14:32

bound_basis:
- dispatch record
- system timestamp
- relative-order assertions
```

This is stronger than assigning:

```text
E1 = 18:13
```

when no evidence actually establishes 18:13.

The system should distinguish:

```text
EXACT TIME
APPROXIMATE TIME
SOURCE-CLAIMED WINDOW
DERIVED BOUND
UNBOUNDED
UNKNOWN
```

---

# Relationships are evidence-bearing objects

Temporal and causal relationships should themselves be first-class records.

Sometimes both events are established while the relationship between them remains disputed.

```text
E1 occurred      ✓
E2 occurred      ✓

E1 CAUSED E2     ?
```

Represent that disagreement at the relationship level:

```text
REL-501
E1 → caused → E2
source = prosecution argument

REL-502
E1 → contributed_to → E2
source = witness testimony

REL-503
E1 → causal_relationship_not_established → E2
source = expert testimony
```

The same applies to temporal relationships:

```text
REL-601
E1 → before → E2
source = Witness A

REL-602
E2 → before → E1
source = Witness B
```

Neither relationship needs to be silently discarded.

---

# PROV lineage

Every temporal assertion and relationship should be traceable backward.

For example:

```text
E1 → BEFORE → E2
        ↑
      REL-601
        ↑
supported by CLM-184
        ↑
derived from SEG-421
        ↑
Day 6 testimony
        ↑
associated with Witness A
```

This allows Icarus to answer:

> Why is E1 shown before E2?

with an evidence-backed explanation.

For example:

```text
E1 → BEFORE → E2

Basis:
- surveillance timestamp
- testimony segment 00:14:39
- medical record timestamp

Status:
reviewed

Conflicting evidence:
- Witness B estimated E2 occurred first
```

---

# Record order remains separate

Icarus still needs a deterministic total ordering of its own record.

For example:

```text
4817  SEG — testimony segment
4818  CLM — extracted claim
4819  EVT — candidate event
4820  REL — proposed before/after relationship
4821  REV — reviewer decision
```

This provides:

```text
immutable additions
        ↓
logical ordering
        ↓
case state at N
        ↓
reproducible projections
```

A snapshot can therefore be defined as:

```text
CASE SNAPSHOT
through logical record 12,884
```

Every timeline, contradiction report, witness account, causal graph, or other projection can then be regenerated against the same state of the case record.

But logical record `4819` tells us when the event candidate entered Icarus.

It does **not** tell us when the event happened.

---

# Core model

The resulting temporal model is:

```text
IDENTITY
Every object has a stable address.

RECORD ORDER
Every persisted change has a deterministic position in the case ledger.

EVENT
A candidate or reviewed representation of something that occurred.

TEMPORAL ASSERTION
What a particular source says about when an event occurred.

ANCHOR
A high-value temporal or synchronization point used to organize other events.

CONSTRAINT
A before/after/overlap/window/state relationship supported by evidence or explicit derivation.

KNOWLEDGE STATE
When information became known to a person or system.

PROVENANCE
Where each assertion, anchor, constraint, and derivation came from.

REVIEWED BOUND
The temporal range currently justified by the available evidence.

PROJECTION
A timeline or reconstruction generated from the underlying graph.
```

The result is deliberately two different structures:

```text
TOTALLY ORDERED CASE LEDGER
What Icarus knew, recorded, changed, and reviewed — in order.

PARTIALLY ORDERED REALITY GRAPH
What the available evidence allows Icarus to establish about the sequence of real-world events.
```

The second graph should not become artificially precise merely because the first one is precise.

Icarus reconstructs temporal context by finding reliable anchors, matching shared events across independent sources, preserving competing assertions, deriving explicit ordering constraints, and progressively slotting events around the strongest available evidence.

The objective is not to manufacture a complete clock timeline.

It is to establish **the strongest chronology the evidence actually supports, while retaining the path back to why every event is where it is.**

