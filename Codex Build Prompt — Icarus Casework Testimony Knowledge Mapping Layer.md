# Codex Build Prompt — Icarus Casework Testimony Knowledge Mapping Layer

Build the next Icarus Casework testimony-processing layer.

The objective is to take the existing deterministic transcript structure pass and extend it into a provenance-preserving knowledge-mapping pipeline that assigns durable IDs, produces semantically useful testimony chunks, maps those chunks into entities/events/claims/temporal assertions/relationships, and persists the resulting rich case model for later timeline reconstruction, graph traversal, evidence analysis, human review, and agent retrieval.

This is not a transcript summarization feature. It is the beginning of the canonical Casework knowledge substrate.

## Existing deterministic testimony pass

There is already a deterministic preprocessing package containing:

- `split_witnesses.py`
  - strongest/currently most reliable component
  - detects witness starts and ends
  - collapses repeated witness calls caused by objections/sidebar interruptions
  - emits witness blocks with confidence

- `classify_exam_phase.py`
  - provisional/experimental
  - generates deterministic candidates for:
    - direct
    - cross
    - redirect
    - recross
    - voir dire
    - jury state
  - do not promote uncertain classifications to authoritative facts

- `extract_procedural_markers.py`
  - detects:
    - objections
    - sustained/overruled rulings
    - sidebar
    - voir dire
    - jury in/out
    - recess
    - oath
    - witness excusal
    - exhibit references
    - admission/procedural evidence events
    - similar courtroom markers

- `transcript_utils.py`
  - shared Rev Markdown parser and rules

The deterministic layer is deliberately cheap.

Preserve it.

Do not replace it with an LLM.

Its job is to reduce the transcript into structurally meaningful witness/testimony regions before semantic reasoning begins.

Target flow:

```text
REV MARKDOWN
    ↓
Rev parser
    ↓
witness segmentation
    ↓
exam-phase candidates
    ↓
procedural markers
    ↓
testimony/content windows
    ↓
semantic knowledge extraction
    ↓
case graph / knowledge store
```

## Core architecture principle

Maintain three independent clocks.

### Clock 1 — Case / knowledge time

When did this information enter the Casework record?

Examples:

```text
T0     pretrial packet
T1     opening statements
T2     witness 1 testimony
T3     witness 2 testimony
...
```

At the implementation level this should ultimately be represented by an append-oriented, case-scoped logical ordering.

Example:

```text
logical_order = 12884
```

This permits reproducible case-state snapshots:

```text
case state as of logical_order <= 12884
```

Later knowledge must never leak backward into an earlier snapshot.

### Clock 2 — IRL / event time

When is the underlying real-world event asserted to have happened?

This may be:

- exact timestamp
- exact date
- approximate time
- bounded interval
- broad interval
- relative ordering only
- unknown

Examples:

```text
2023-01-24T18:11:03
approximately 5:40 PM
Jan 1–5
after discharge
before Patrick returned
while Patrick was away
before the 911 call
unknown
```

Never invent precision.

### Clock 3 — provenance / information time

How did the information reach the current speaker/source/system?

Examples:

```text
event
↓ observed by EMS
EMS
↓ told trauma physician
physician
↓ testified
transcript
↓ parsed into
claim
```

or:

```text
Patrick
↓ told investigator
investigator
↓ recorded in affidavit
affidavit
↓ ingested at T0
Casework
```

Clock 3 must preserve information lineage independently from Clock 2.

A speaker can testify on Day 6 about an event that happened years earlier and can be reporting information originally received from another person.

Do not collapse these dimensions.

---

# Stable identity

Every persisted object must receive a durable internal identity.

Do not use temporary parser labels such as `EV4`, `ENT18`, `witness_004`, or CSV row numbers as database primary keys.

Preserve imported/source IDs separately.

Use UUID primary keys plus human-readable case-scoped object codes.

Target concepts:

```text
ENT-000031     Entity
WIT-000013     Witness identity/context if separate from entity
SRC-000087     Source
REP-000087     Source representation
SEG-004410     Transcript segment
TST-000221     Testimony/content unit
KI-000184      Knowledge item
CLM-001922     Claim
EVT-000266     Event
PRP-000266     Proposition
TMP-000771     Temporal assertion
REL-002771     Relationship
FLG-000118     Flag
EVD-000144     Evidence item
```

Human-readable codes are for addressing/display.

UUIDs remain database identities.

Do not reuse IDs.

---

# Testimony pipeline

Implement this in layers.

## Stage 1 — deterministic transcript structure

Run the existing deterministic scripts.

Produce normalized witness-block output containing at minimum:

```text
proceeding_id
witness_block_id
witness_label_raw
start_segment_id
end_segment_id
start_timestamp
end_timestamp
boundary_confidence

exam_phase_candidate
exam_phase_confidence

jury_state_candidate

procedural_markers[]

source_segment_ids[]
```

Do not require perfect exam-phase inference before continuing.

Low-confidence phase output must remain explicitly provisional.

Witness labels are also candidates until entity resolution occurs.

Example:

```text
witness_008
raw_label: "Dr. Shah"
resolved_entity_id: null
```

Later entity resolution can map this to a canonical person without altering the original parser output.

## Stage 2 — testimony/content windows

Within each witness block, identify semantically useful content windows.

The goal is to give a reasoning model a coherent testimony thread rather than an entire witness examination or arbitrary token-sized slices.

Procedural interruptions should be retained as metadata but should not necessarily break one substantive thread.

Example:

```text
question
answer
objection
sidebar
question resumed
answer
```

may remain one content window if the substantive thread clearly continues.

Do not discard:

- objection
- ruling
- sidebar
- jury state
- exhibit interaction
- interruption

Instead distinguish:

```text
substantive testimony
vs.
procedural context
```

Content windows must retain exact source segment membership.

No summary or derived object may become detached from its original transcript segments.

---

# Stage 3 — testimony knowledge items

Compile each useful content window into a durable `knowledge_item`.

A knowledge item is the compact, retrievable representation of what a testimony portion materially contributes.

Minimum conceptual structure:

```yaml
knowledge_item:
  id:
  case_id:
  proceeding_id:
  witness_block_id:

  source_segments: []

  witness:
    raw_label:
    entity_id:
    resolution_status:

  examination:
    phase_candidate:
    phase_confidence:
    jury_state:

  summary:

  claims: []
  entity_refs: []
  event_refs: []
  event_candidates: []
  temporal_assertions: []
  relationships: []
  evidence_refs: []
  proposition_refs: []
  flags: []
  unknowns: []

  information_provenance: []

  review_status:
  extraction_method:
  model_version:
  compiler_version:

  logical_order:
```

The summary is one attribute of the knowledge item.

It is not the canonical truth representation.

Claims, event references, temporal assertions, relationships, provenance, and source locators must remain independently addressable.

---

# Claims

A claim represents something asserted.

Examples:

```text
Witness says patient appeared confused.

Witness says EMS told her the patient fell approximately 20 feet.

Witness says medication X was discontinued.

Witness says Event A occurred before Event B.
```

Every claim must retain:

```text
claim_id
case_id
asserted_by_entity_id
speaker_capacity
knowledge_item_id
source_segment_ids
verbatim/source locator
normalized assertion
claim_type
assertion_status
logical_order
```

Do not convert a claim into a fact merely because it exists in testimony.

Preserve:

```text
asserted
disputed
qualified
corrected
withdrawn
stipulated
court-found
etc.
```

where supported.

---

# Information provenance

Distinguish personal observation from information received from another source.

Examples:

```text
PERSONALLY_OBSERVED
HEARD_FROM_PERSON
READ_IN_RECORD
REVIEWED_DEVICE_DATA
RECALLED
EXPERT_INFERENCE
PARTY_ARGUMENT
UNKNOWN_BASIS
```

Represent information chains explicitly where possible.

Example:

```text
EMS
→ communicated_to
Dr. Carpio
→ later_reported_through
testimony claim
```

Do not silently transform:

```text
"EMS told me X"
```

into:

```text
X happened.
```

The claim that EMS communicated X is directly supported by the testimony.

The underlying proposition X remains separately modeled.

---

# Event modeling

Existing case events should receive stable canonical IDs.

When testimony refers to a known event:

```text
claim
→ describes
EVT-...
```

When testimony appears to introduce a new event:

```text
event_candidate
```

Do not silently add inferred events as established events.

Preserve the candidate's:

```text
description
participants
source claims
temporal information
confidence
review status
```

Later reconciliation may resolve:

```text
candidate → same_as → canonical event
```

without deleting the candidate's original provenance.

---

# Temporal model

Temporal assertions are first-class records.

Do not use one mutable timestamp field on an event as the entire temporal truth model.

A temporal assertion should support:

```text
exact timestamp
exact date
approximate
interval
bounded interval
relative only
unknown
```

Suggested fields:

```text
temporal_assertion_id
case_id
event_id or candidate_event_id
knowledge_item_id
source_claim_id

raw_temporal_language

asserted_start
asserted_end
precision

temporal_band_id

lower_bound_event_id
upper_bound_event_id

asserted_by
source_id
confidence
review_status

logical_order
```

Examples:

```text
"around 5:40"
```

becomes an approximate assertion.

```text
"after Patrick left but before he returned"
```

becomes event-bounded temporal information.

```text
"after she came home from McLean"
```

becomes a relative temporal constraint.

Do not invent timestamps from relative statements.

---

# Temporal bands

Support coarse temporal placement before exact chronology is known.

For this case, initial bands may include concepts such as:

```text
postpartum treatment
late-2022 deterioration/treatment changes
Dec 20 evaluation
Jan 1–5 McLean
post-McLean / pre-Jan 24
Jan 24 before Patrick leaves
Patrick away
return/discovery
911 / first response
hospital/investigative aftermath
trial
```

These are case-scoped ordering aids.

They are not substitutes for exact timestamps.

An event may span multiple bands or remain uncertain between bands.

---

# Relationships

Edges are first-class objects.

A dispute can concern the relationship between two objects even when both underlying objects are accepted.

Use a generic relationship model capable of linking Casework nodes.

Examples:

```text
claim → concerns → proposition
claim → describes → event
claim → contradicts → claim
claim → qualifies → claim

event → before → event
event → after → event
event → during → event
event → overlaps → event

event → claimed_causes → event
event → contributed_to → event

witness → made → claim
source → contains → segment
segment → contributes_to → knowledge_item
knowledge_item → produces → claim

evidence → supports → proposition
evidence → contradicts → proposition

person → communicated_to → person
claim → derived_from → source
```

Relationship records should support:

```text
relationship_id
case_id

from_node_type
from_node_id

relation_type

to_node_type
to_node_id

source_claim_id
knowledge_item_id
source_id

assertion_status
confidence
review_status

logical_order
```

Chronology and causality must remain separate.

These:

```text
A BEFORE B
```

and:

```text
A CAUSED B
```

are different relationship objects.

Never infer causation from chronology alone.

---

# PROV / provenance requirements

Use the existing Icarus PROV and legal evidence provenance concepts as the integrity foundation.

Important principles:

- append-oriented provenance
- stable IDs
- preserve source representations
- derived outputs point back to their inputs
- distinguish item from representation from assertion
- distinguish original text from normalization/extraction/AI summary
- preserve model/tool/compiler version at transformation boundaries
- preserve source locators
- preserve uncertainty
- corrections create new records rather than silently rewriting history
- provenance edges must be inspectable
- do not treat hashing as proof that content is true
- do not treat testimony as automatic proof of the proposition asserted

At minimum, every AI-derived testimony knowledge item must be traceable:

```text
source transcript
↓
exact segments
↓
deterministic witness/content structure
↓
knowledge extraction activity
↓
knowledge item
↓
claims / events / temporal assertions / relationships
```

Store transformation/activity metadata sufficient to answer:

```text
Which source segments produced this?
Which compiler/model generated it?
Which version?
When?
Under which extraction contract?
Was it reviewed?
Has it been corrected?
```

---

# Case ledger / Clock 1

Introduce a case-scoped logical ordering mechanism.

This must be independent of IRL event chronology.

Conceptually:

```text
case_ledger
-----------
logical_order
case_id
object_type
object_id
operation
ingest_run_id
created_at
actor/system
```

A Day 6 testimony claim about an event from January 2023 receives a late logical order while retaining its January 2023 Clock-2 placement.

This is required for eventual replay:

```text
CASE STATE
AS OF logical_order <= N
```

Do not implement "current state only" in a way that makes earlier evidentiary states unrecoverable.

---

# Flags

Create first-class flag objects.

Flags may originate from:

```text
human
agent
deterministic rule
```

Agent-generated flags must remain proposals until accepted where review is required.

Flag types should be extensible and may include:

```text
linguistic_significance
temporal_significance
timeline_constraint
contradiction
provenance_concern
information_chain
missing_source
new_event_candidate
new_entity_candidate
causal_assertion
medical_significance
evidence_status
unexpected_testimony
theory_relevance
needs_expert_review
open_question
```

A flag must be attachable to any useful Casework node:

```text
segment
knowledge item
claim
event
relationship
evidence item
proposition
entity
```

A flag should preserve:

```text
why it was flagged
who/what flagged it
source object
status
reviewer
created logical order
supporting context
```

---

# Summaries

Generate concise human-readable summaries for testimony content windows.

The summary should answer:

```text
What materially happened in this portion of testimony?
What did this witness personally establish or assert?
What information came from elsewhere?
What case objects does it affect?
```

Do not write narrative summaries that erase source distinctions.

Prefer language such as:

```text
The witness testified...
The witness personally observed...
The witness reported being told...
The record was referenced...
The testimony did not establish...
The timing remained approximate...
```

The summary must remain traceable to the exact source segments.

---

# Entity resolution

Do not automatically merge witness labels or referenced people into canonical entities on weak evidence.

Preserve:

```text
raw mention
normalized candidate
resolved entity
resolution confidence
resolution basis
```

Reuse the existing SAME/entity-resolution infrastructure if appropriate.

Identity decisions must remain explainable and reversible.

---

# Propositions

Claims may concern shared propositions.

Example:

```text
CLM-100
CLM-211
CLM-877
        ↓
all concern
PRP-42
```

Do not duplicate a proposition merely because multiple witnesses discuss it.

Do not force early proposition resolution when semantics are uncertain.

Support:

```text
claim → supports → proposition
claim → contradicts → proposition
claim → qualifies → proposition
```

without automatically deciding which side is correct.

---

# Knowledge graph

Supabase/Postgres remains the canonical persistence layer.

The implementation may use relational tables to represent the graph.

Do not introduce a separate graph database unless there is a demonstrated requirement.

The rich graph should be reconstructable from canonical nodes + relationships.

Likely canonical concepts include:

```text
cases
entities
sources
representations
proceedings
transcript_segments
witness_blocks
testimony_units
knowledge_items
claims
events
event_candidates
propositions
temporal_assertions
temporal_bands
relationships
flags
evidence_items
provenance_activities
case_ledger
```

Do not blindly create all tables before reviewing the existing Casework schema.

First inventory what already exists and reuse/extend existing primitives where semantics align.

Avoid creating duplicate concepts under new names.

---

# Current seed state

The existing T0 material and seed entity/event/temporal data represent the provisional starting case model.

Treat these as seed/acceptance data rather than absolute truth.

The transcript system must be capable of:

```text
resolving testimony to an existing T0 object
adding support to an existing proposition
contradicting an existing claim
refining an existing event's temporal placement
introducing a new event candidate
introducing a new entity candidate
introducing a new temporal relationship
identifying a new source/evidence object
preserving a new unknown
```

without destructive rewriting.

---

# Case-state evolution

Design for this eventual capability:

```text
T0 packet
↓
opening statements
↓
Day 1 testimony
↓
Day 2 testimony
↓
...
```

The evidence substrate grows.

Party theories/projections remain separately versionable.

Future queries should be possible such as:

```text
What did the prosecution claim in opening that had actually
received evidentiary support through Day 6?

Which propositions had no support as of Day 3?

What new events first appeared in testimony?

Which packet assertions were revealed to be secondhand?

Which temporal placements changed as better timestamps appeared?

Which claimed causal links remained only argument?

What evidence introduced by one party supported another
party's proposition?
```

Do not build the full theory-projection system in this slice unless required by existing architecture.

Do make the data model capable of supporting it.

---

# Build approach

Do this as a controlled architecture + implementation slice.

## First

Inventory the current repository for:

- transcript schema
- Supabase schema/migrations
- current segment IDs
- proceeding IDs
- case IDs
- claims
- evidence/provenance records
- existing entity resolution
- existing event models
- existing audit/event ledger patterns

Report reuse opportunities before adding duplicate tables.

## Then

Create concise architecture artifacts in-repo covering:

1. Casework testimony ontology additions
2. Three-clock model
3. ID/identity contract
4. testimony-unit contract
5. knowledge-item contract
6. temporal assertion model
7. relationship semantics
8. provenance requirements
9. invariants
10. proposed Supabase changes

These should be implementation-oriented, not academic ontology documents.

## Then implement

Start with one already-ingested proceeding as the acceptance corpus.

Prefer a proceeding for which witness-block segmentation has already been tested.

Pipeline:

```text
existing transcript segments
↓
existing deterministic scripts
↓
witness blocks
↓
content/testimony units
↓
structured knowledge items
↓
IDs + provenance
↓
temporal / relational mapping
↓
persist
```

Do not process the entire corpus until one proceeding passes acceptance tests.

---

# Deterministic QA

Before semantic extraction, validate:

- no transcript segment unexpectedly unassigned
- no invalid witness-block overlaps
- witness blocks remain monotonically ordered
- block start < end
- no impossible timestamp regression
- repeated witness call after procedural interruption collapses correctly
- witness excusal closes block when supported
- new sworn witness opens a new block when supported
- low-confidence boundaries are surfaced for review

Generate a corpus/acceptance report.

---

# Semantic extraction contract

The model performing knowledge extraction must be explicitly instructed:

1. Do not determine guilt.
2. Do not infer diagnosis.
3. Do not promote assertions to facts.
4. Do not infer causation from temporal order.
5. Do not invent timestamps.
6. Do not infer a first-hand observation when the speaker reports information from another source.
7. Do not silently resolve identity.
8. Do not silently resolve contradictions.
9. Preserve exact source segment IDs.
10. Mark unsupported fields unknown.
11. Prefer candidate objects over unjustified canonical objects.
12. Preserve the difference between:
   - observed
   - asserted
   - reported by another person
   - inferred
   - documented
   - argued
   - judicially determined

---

# Acceptance criteria for first proceeding

A successful implementation should demonstrate that for selected testimony chunks:

- exact transcript source segments remain addressable
- every relevant persisted object has a stable ID
- human-readable knowledge-item summary exists
- witness/exam context is preserved
- claims receive stable IDs
- entities resolve where justified
- unresolved identities stay unresolved
- existing events can be referenced
- new events become candidates
- temporal language becomes temporal assertions
- exact/approximate/bounded/relative time remains distinguishable
- obvious BEFORE/AFTER relationships can be represented
- chronology does not create causal relations automatically
- information provenance survives hearsay/secondhand chains
- evidence references resolve or create referenced/missing evidence objects
- contradictions can coexist
- flags can attach to relevant objects
- agent flags can remain proposed
- every derived object traces to source transcript segments
- model/compiler version is recorded
- case logical order is separate from event time
- prior state can be reconstructed conceptually from logical ordering
- knowledge items can later be retrieved by:
  - witness
  - entity
  - event
  - proposition
  - temporal band
  - relationship
  - evidence item
  - flag
  - proceeding
  - source segment

---

# Important invariants

These are non-negotiable:

```text
IDENTITY
Persisted objects have stable identity.

SOURCE
Derived information never replaces its source.

CLAIM
An assertion remains attributable.

TIME
Unknown or approximate time cannot silently become exact.

CLOCKS
record/knowledge time ≠ IRL event time ≠ information provenance.

RELATIONSHIPS
Edges are first-class, attributable records.

CHRONOLOGY
BEFORE does not imply CAUSED.

CONFLICT
Competing claims may coexist.

CORRECTION
Correction does not erase prior state.

PROJECTION
A timeline or narrative is derived from the substrate and cannot
rewrite it.

PROVENANCE
Every important derived object can be traced to exact source material.

REPLAY
Later knowledge must not contaminate an earlier case-state snapshot.
```

---

# Scope control

Do not attempt to solve all legal reasoning in this slice.

The immediate milestone is:

> Convert one proceeding from deterministic transcript structure into provenance-preserving, ID-addressable testimony knowledge items with temporal and relational mappings stored in the Casework data model.

Build the substrate first.

Do not spend frontier-model reasoning on tasks already handled deterministically.

Do not redesign working transcript ingestion unnecessarily.

Do not discard raw transcript data.

Do not mass-process the corpus until the model and first-proceeding acceptance tests are sound.

At the end, report:

- repository components reused
- schema additions/changes
- migrations created
- deterministic pipeline integration
- new ID conventions
- three-clock implementation
- knowledge-item structure
- temporal model
- relationship model
- provenance implementation
- acceptance corpus used
- test results
- unresolved design questions
- what should be the next build slice