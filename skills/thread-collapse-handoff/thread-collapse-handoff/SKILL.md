---
name: thread-collapse-handoff
description: Transform long conversations and legal/evidentiary source discussions into durable operational memory. Use for thread collapse, operational handoff, and source-linked Day Intelligence generated from testimony or court records.
---

# Thread Collapse Handoff

Produce a knowledge artifact, not a conversational summary.

Assume the reader has never seen the original thread. Reconstruct the thread's meaning so future work can continue without replaying the conversation.

## Modes

- `standard`: use the existing workflow and output contract.
- `legal_evidentiary`: use for testimony, court records, filings, expert reports, evidence packets, and legal case analysis. Apply every rule below in addition to the standard workflow.

## Legal / Evidentiary Mode

This mode produces an analytical artifact about the record. It does not replace the record or establish canonical facts.

Authority hierarchy:

```text
source_artifact + source_segments
  -> generated Day Intelligence context.md
  -> card.json + agent-pack.json + relationships.json + UI
```

Required preservation rules:

1. Treat testimony, expert opinion, party argument, investigative description, and generated interpretation as attributed assertions rather than established facts.
2. Keep source artifacts, derivatives, source statements, witness testimony, expert opinions, party positions, court rulings, stipulations, and analytical inferences distinct.
3. Preserve competing assertions independently. Do not reconcile or overwrite them unless the source contains an authoritative resolution whose scope is preserved.
4. Never convert repetition into independent corroboration. Preserve known source ancestry.
5. Never use provenance, extraction confidence, or human acceptance as proof of truth, credibility, admissibility, or legal sufficiency.
6. Do not convert an attorney question into witness testimony unless the witness expressly adopts it.
7. Use neutral attribution: “testified,” “opined,” “argued,” “the record reflects,” and “the analysis identifies.”
8. Link every material source-backed item to exact `source_segments.id` values when available. If unresolved, use `source_linkage_incomplete`; never invent IDs or locators.
9. Keep `extraction_confidence` separate from `evidentiary_assessment`.
10. Do not ingest, reference, or promote private Scratchpad content.

When creating `day-intelligence/1.0`, every material item requires:

```yaml
item_id: stable-id
section: insights | positions_working_conclusions | evidence_chains | relationships | risks_tensions | open_questions | actions | memory_candidates | handoff
epistemic_class: source_statement | witness_testimony | expert_opinion | party_position | court_ruling | stipulation | analytical_inference | working_conclusion | evidence_chain | relationship | tension | risk | research_question | research_action | memory_candidate | handoff_state
title: short title
content: neutral analytical content
importance: high | medium | low
extraction_confidence: 0.0
evidentiary_assessment: direct | corroborated | partially_corroborated | single_source | derived | conflicted | unsupported | not_assessed
source_linkage_status: complete | source_linkage_incomplete
review_status: generated | needs_review | accepted | amended | rejected | deferred
sources: []
tags: []
notes: []
```

Preserve artifact-level provenance: artifact set ID/version, input artifact IDs and hashes, skill/model/configuration versions, generation timestamp, and superseded artifact ID when applicable. A correction creates a new versioned directory; this mode neither requires nor prescribes database persistence.

## Operating Rules

- Prioritize decisions over discussion.
- Prioritize insights over opinions.
- Prioritize evidence over unsupported claims.
- Prioritize relationships over isolated facts.
- Prioritize context over chronology.
- Ignore greetings, filler, repeated arguments, and duplicate framing unless they materially affect a decision or risk.
- State uncertainty explicitly when the thread does not support a strong conclusion.
- Do not answer unresolved questions unless the user explicitly asks for analysis beyond extraction.
- Preserve important disagreements, caveats, and confidence levels.

## Extraction Workflow

### 1. Determine the thread's real job

Identify:

- Primary topic
- Secondary topics
- Why the thread mattered
- Intended outcome

Write this as a short synthesis, not a timeline.

### 2. Extract understanding-changing insights

Include only observations that changed the working model of the problem, plan, or opportunity.

For each insight, capture:

- The insight itself
- Why it matters
- Potential implication

Skip obvious statements that merely restate the thread topic.

### 3. Capture decisions and commitments

Record:

- Explicit decisions
- Resolved debates
- Commitments
- Conclusions treated as settled

For each decision, include the reasoning and a confidence level.

### 4. Build the evidence chain

When the thread supports a conclusion, trace:

Observation -> Evidence -> Interpretation -> Decision

If the evidence is weak, contradictory, or missing, say so.

### 5. Map relationships

List entities and how they connect. Entities may include people, teams, companies, systems, projects, documents, models, concepts, or workflows.

Prefer directional statements such as:

`Entity A -> relationship -> Entity B`

Add a brief rationale when the relationship is not self-evident.

### 6. Extract project intelligence

For each project or initiative discussed, capture:

- Purpose
- Current status
- Key decisions
- Dependencies
- Risks
- Next actions

Only include projects that materially appear in the thread.

### 7. Preserve operational context

Capture the assumptions future work depends on:

- Background the thread assumed
- Terminology introduced or normalized
- Constraints and non-negotiables
- Setup knowledge needed before continuing

### 8. Surface risks and concerns

Record known risks, failure modes, unresolved concerns, and areas needing validation.

For each risk, capture:

- Risk
- Potential impact
- Mitigation

### 9. Preserve open questions

List unresolved questions without answering them.

Include why each question matters.

### 10. Extract next actions

Capture future work as operational tasks.

For each action, include:

- Priority
- Owner if known
- Task
- Reason

### 11. Nominate memory candidates

Identify information that should persist beyond the thread, such as:

- Operating principles
- Repeated patterns
- Canonical definitions
- Proven workflows
- Important relationships

Only include items worth reusing in future work.

### 12. Capture implementation ideas

Record any newly proposed, discussed, or referenced implementation concepts, even if immature.

Include discoverability entries for:

- Features
- Skills
- Scripts
- Automation ideas
- Code concepts
- Screens
- Dashboards
- Tools
- Workflows
- System components

### 13. Write the handoff brief

Finish with a concise briefing for the next operator covering:

- Current state
- What was learned
- What was decided
- What remains
- Recommended next step

## Output Contract

Use exactly these section headings unless the user asks for a different format:

### Thread Purpose

[1-3 paragraph explanation]

### Key Insights

- Insight
- Why it matters
- Potential implications

### Decisions

| Decision | Reasoning | Confidence |
| --- | --- | --- |

### Evidence

Claim:
Supporting Evidence:
Source:
Confidence:

### Relationships

Entity A
-> Relationship
-> Entity B

### Projects Discussed

Project:
Purpose:
Current Status:
Key Decisions:
Dependencies:
Risks:
Next Actions:

### Context Required For Future Work

### Risks

Risk:
Potential Impact:
Mitigation:

### Open Questions

- Question
- Why it matters

### Next Actions

Priority:
Owner:
Task:
Reason:

### Memory Candidates

Memory:
Category:
Why it should persist:

### Features / Skills / Scripts / Code / Screens

Type:
Name:
Status: New / Proposed / Discussed / Existing
Notes:

### Handoff Brief

Current State:
What Was Learned:
What Was Decided:
What Remains:
Recommended Next Step:

## Quality Bar

Before finishing, check that:

- A new reader can continue the work without reading the source thread.
- The artifact explains why decisions were made, not just what was said.
- The artifact distinguishes evidence, inference, and uncertainty.
- The artifact preserves unresolved risks and questions.
- The artifact is dense with reusable context and light on conversational residue.

If a section has no meaningful content, keep the heading and state `None identified` rather than silently dropping it.

## Legal Output Contract

When `mode = legal_evidentiary`, replace `Decisions` with `Positions & Working Conclusions` and use these headings:

### Thread / Proceeding Purpose

### Key Insights

### Positions & Working Conclusions

### Evidence Chains

### Relationships

### Context Required For Future Work

### Risks & Tensions

### Open Questions

### Next Actions

### Memory Candidates

### Features / Skills / Scripts / Code / Screens

### Handoff Brief

The structured item fields are authoritative for identity, provenance, epistemic class, review state, and source linkage. Follow `contracts/day-intelligence-1.0.md` for Day Intelligence artifact sets.
