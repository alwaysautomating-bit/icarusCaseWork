---
type: pork-school-concept
title: Evidence Weighting
description: Teaches agents how to judge which evidence matters, how reliable it is, and how gaps or contradictions should affect confidence.
tags: [pork, evidence, weighting, reliability]
source_files:
  - /C:/Projects/immutableos/IMMUTABLEOS_EVIDENCE_BURN_DOWN_DOCTRINE.md
  - /C:/Projects/skills/operational-memory/SKILL.md
  - /C:/Projects/design-systems/icarus/README.md
  - /C:/Users/Laura/Documents/conTEXT/context-catalog/examples/bae/context.md
related_agents:
  - /C:/Users/Laura/Documents/conTEXT/context-catalog/examples/bae/agent-pack.json
related_skills:
  - /C:/Projects/skills/operational-memory/SKILL.md
related_workflows:
  - /knowledge/pork/tests/evaluations/operational-memory-eval.md
portable: true
status: canonical-draft
---

# Evidence Weighting

## Teaches

How agents should decide which evidence is strong, weak, missing, contradictory, or merely decorative.

## Use When

Use when an agent must justify confidence, compare conflicting records, or decide whether there is enough support to proceed.

## Inputs

- Raw evidence artifacts
- Verification state
- Contradictions and omissions
- Domain-specific weighting cues

## Outputs

- Evidence ranking
- Confidence statement
- Missing-evidence notes
- Explicit uncertainty explanation

## Agent Lesson

Evidence is not equal just because it exists. Agents should distinguish verified support from weak, missing, or contradictory signals.

## Failure Modes

- Treating all evidence as equally trustworthy
- Ignoring missing evidence
- Overstating certainty when the evidence base is thin

## Source Evidence

- `C:/Projects/immutableos/IMMUTABLEOS_EVIDENCE_BURN_DOWN_DOCTRINE.md`
- `C:/Projects/skills/operational-memory/SKILL.md`
- `C:/Projects/design-systems/icarus/README.md`
- `context-catalog/examples/bae/context.md`

## Example Application

An agent sees a field note, a timestamped system event, and a retrospective summary.
Evidence Weighting teaches it to privilege the immutable event, use the field note as supporting context, and treat the retrospective summary as weaker evidence.
