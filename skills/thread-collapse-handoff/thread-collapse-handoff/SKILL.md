---
name: thread-collapse-handoff
description: Transform long conversations, research threads, brainstorming sessions, project discussions, and decision-making exchanges into durable operational memory. Use when Codex must extract decisions, insights, evidence, relationships, risks, open questions, project status, future actions, or a handoff brief for someone who did not read the original thread. Use for thread collapse, operational handoff, knowledge transfer, project dossiers, and future context retrieval artifacts.
---

# Thread Collapse Handoff

Produce a knowledge artifact, not a conversational summary.

Assume the reader has never seen the original thread. Reconstruct the thread's meaning so future work can continue without replaying the conversation.

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
