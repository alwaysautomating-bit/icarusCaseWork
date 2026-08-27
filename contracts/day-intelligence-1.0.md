# Day Intelligence Artifact Contract

Contract: `day-intelligence/1.0`

Status: V1

This contract defines generated analytical artifacts and UI-consumable structure. It does not require or prescribe database persistence.

## Purpose

Day Intelligence answers: **What did this court day change in the working understanding of the case?**

It is a generated analytical view over preserved testimony. It is reference material, not canonical fact, evidence, a finding, or a substitute for the Court Record.

```text
source_artifact + source_segments (read only)
  -> thread-collapse-handoff / legal_evidentiary
  -> context.md
  -> context-card-compiler / legal_case_analysis
  -> card.json + agent-pack.json + relationships.json
  -> authenticated Day Intelligence view
```

## Filesystem Layout

Each immutable artifact set occupies a versioned directory:

```text
generated/day-intelligence/
  day-20/
    v1/
      context.md
      card.json
      agent-pack.json
      relationships.json
```

A correction or reviewed replacement is written as `v2`; do not overwrite `v1`.

## Authority Boundary

```text
Evidentiary source of record
  source_artifact + source_segments

Canonical analytical representation for one artifact version
  context.md

Generated projections
  card.json + agent-pack.json + relationships.json + UI
```

Acceptance into an analytical artifact does not promote an assertion into canonical fact, Structure, Evidence, agent memory, or another governed Icarus layer.

## Shared Identity

All JSON files must repeat:

```yaml
contract_version: day-intelligence/1.0
artifact_set_id: stable-id
case_id: case-id
trial_day_id: day-id
day_number: 20
version: 1
```

The four files must describe the same artifact set and version.

## `context.md`

The durable human-readable analysis. It must state the authority boundary and should contain:

- proceeding purpose;
- key insights;
- positions and working conclusions;
- evidence chains;
- relationships;
- risks and tensions;
- open questions;
- actions;
- memory candidates;
- handoff;
- source-linkage limitations;
- generation and input provenance.

## `card.json`

The concise UI projection. Required fields:

```yaml
id: day-intelligence:case-id:day-id:v1
profile: legal_case_analysis
contract_version: day-intelligence/1.0
artifact_set_id: stable-id
case_id: case-id
trial_day_id: day-id
day_number: 20
version: 1
title: Day 20 Intelligence
subtitle: Short day purpose
one_liner: Short analytical description
purpose: What the proceeding addressed
what_changed: What changed in the working understanding
primary_topics: []
review_status: generated | needs_review | accepted | amended | rejected | deferred
source_linkage_status: complete | partial | source_linkage_incomplete
item_counts: {}
generated_at: ISO-8601
authority:
  evidentiary_source_of_record: source_artifact + source_segments
  canonical_analytical_representation: context.md
```

## `agent-pack.json`

The complete machine-readable analytical projection. It preserves generation metadata, source inputs, summary, items, visible limitations, and governance.

Every material item requires:

```yaml
item_id: stable-id
section: insights | positions_working_conclusions | evidence_chains | relationships | risks_tensions | open_questions | actions | memory_candidates | handoff
epistemic_class: source_statement | witness_testimony | expert_opinion | party_position | court_ruling | stipulation | analytical_inference | working_conclusion | evidence_chain | relationship | tension | risk | research_question | research_action | memory_candidate | handoff_state
title: Short title
content: Neutral analytical text
importance: high | medium | low
extraction_confidence: 0.0
evidentiary_assessment: direct | corroborated | partially_corroborated | single_source | derived | conflicted | unsupported | not_assessed
source_linkage_status: complete | source_linkage_incomplete
review_status: generated | needs_review | accepted | amended | rejected | deferred
sources: []
tags: []
notes: []
```

`extraction_confidence` describes extraction accuracy, not truth, credibility, admissibility, or evidentiary weight.

Each source may retain an exact `source_segment_id`, artifact/proceeding IDs, speaker and examination context, locator, source status, and role. If a material source-backed item lacks an exact canonical segment, it must be `source_linkage_incomplete`; identifiers must never be invented.

The agent pack must contain:

```yaml
governance:
  human_review_required: true
  auto_action_allowed: false
  audit_log_required: true
  analytical_acceptance_is_canonical_fact: false
  cross_day_auto_promotion_allowed: false
  scratchpad_input_allowed: false
```

These fields are artifact governance declarations. They do not create a database review or audit subsystem.

## `relationships.json`

V1 contains only accepted, human-declared, within-day relationships. Trusted entries require:

```yaml
relationship_id: stable-id
from_item_id: stable-item-id
to_item_id: stable-item-id
relationship_type: supports | contradicts | qualifies | relied_on | omitted_from_review | independent_anchor | originates_from | repeats | derived_from | context_only | related_to
rationale: Neutral explanation
source_type: declared
review_status: accepted
confidence: 1
```

Generated suggestions remain ordinary analytical notes until a later artifact version declares them. V1 does not publish cross-day links or merge identities across days.

## Required Preservation Rules

- Attribute testimony, expert opinions, party positions, and analytical inferences separately.
- Preserve competing assertions independently.
- Do not transform an attorney question into witness testimony unless adopted by the witness.
- Do not transform repetition into independent corroboration.
- Provenance establishes lineage, not truth.
- Preserve uncertainty and missing provenance visibly.
- Use neutral legal-facing language.
- Reference existing Structure objects without mutating or promoting into Structure.

## Scratchpad Exclusion

Scratchpad is a separate private-notes feature. It is not a Day Intelligence source, output, relationship source, or memory source. Day Intelligence generation must not read or reference Scratchpad content. A future explicit promotion action, outside this contract, may create a distinct governed research object.

## UI Interpretation

The UI reads the newest valid artifact directory for the requested case and day. It uses:

- `card.json` for overview and status;
- `agent-pack.json` for sections, items, provenance, and limitations;
- `relationships.json` for accepted within-day edges;
- `context.md` as the human-readable analytical source.

Exact segment IDs link back to the authenticated Court Record. Missing links remain visibly incomplete.

## Validation

Reject an artifact set when:

- a required file is missing or malformed;
- identities or versions differ among the JSON projections;
- item IDs are duplicated;
- an accepted relationship references an unknown item;
- a source-backed item claims complete linkage without an exact segment;
- legal analytical governance permits automatic action, cross-day promotion, canonical-fact promotion, or Scratchpad input.

## Explicit Non-Requirements

V1 adds no:

- database table or JSONB payload;
- migration, RLS policy, grant, trigger, or RPC;
- database-backed run/review record;
- normalized item or relationship storage;
- ingestion-path change;
- automatic cross-day synthesis;
- Scratchpad integration.
