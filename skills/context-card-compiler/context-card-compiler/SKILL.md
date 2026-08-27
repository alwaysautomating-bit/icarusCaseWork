---
name: context-card-compiler
description: Compile a canonical markdown context object into synchronized artifacts for humans, UI, and agents. Use for ordinary context objects and for artifact-only Day Intelligence with the legal_case_analysis profile.
---

# Context Card Compiler

Turn a full markdown context file into a reusable catalog object with four artifacts:

1. `context.md`
2. `card.json`
3. `agent-pack.json`
4. `relationships.json`

For ordinary context objects, the markdown file remains the source of truth. For `legal_case_analysis`, the evidentiary source remains `source_artifact + source_segments`; `context.md` is canonical only for that version of the generated analysis.

## Profiles

- `default`: preserve the existing workflow.
- `legal_case_analysis`: compile a `day-intelligence/1.0` analytical context without reinterpreting its legal or provenance fields.

## Workflow

1. Start from a canonical `context.md`.
2. Generate or refresh `card.json`, `agent-pack.json`, and `relationships.json`.
3. Keep the UI card short and readable.
4. Keep the agent pack explicit and versioned.
5. Keep relationships declared in V1. Do not infer graph edges.

For `legal_case_analysis`:

1. Require `contract_version: day-intelligence/1.0` and the shared artifact identity/version.
2. Preserve stable item IDs, exact segment IDs, speaker/examination context, source roles, derivation, epistemic class, extraction confidence, evidentiary assessment, source-linkage state, review state, limitations, and generation provenance exactly.
3. Generate `card.json` as a concise UI projection.
4. Generate `agent-pack.json` as the complete machine-readable analytical projection.
5. Generate only accepted, declared, within-day relationships in `relationships.json`.
6. Validate that all four files identify the same artifact set and version.
7. Write corrections as a new versioned artifact directory. Do not create or prescribe database records.

## Preferred Path

If the repo already contains a catalog workflow, use it instead of rebuilding the logic by hand.

Example:

```bash
npm run compile:context-card -- context-catalog/examples/<slug>/context.md
```

If the compiler supports flags, pass metadata overrides there rather than hand-editing generated files first.

## Required Rules

- Preserve `context.md` as canonical.
- Add semantic `version` to every `agent-pack.json`.
- Require governance in every agent pack:
  - `human_review_required`
  - `auto_action_allowed`
  - `audit_log_required`
- Treat governance as an authority boundary, not a note.
- Generate declared `relationships.json` edges only.
- Mark uncertain fields as `unknown`, `draft`, or `needs_review`.
- Do not invent implementation details that are not present or clearly implied.

Additional `legal_case_analysis` rules:

- Do not repair missing provenance by inference.
- Do not convert repeated assertions into corroborated assertions.
- Do not convert analytical inference into source statement.
- Do not collapse competing assertions.
- Do not promote accepted analysis into canonical fact, Structure, Evidence, or agent memory.
- Do not ingest Scratchpad content.
- Do not create cross-day merges or trusted cross-day relationships.
- Require governance that disables automatic action, factual promotion, cross-day promotion, and Scratchpad input.

## Relationship Policy

Use only declared relationships for operationally trusted graph edges.

Allowed relationship types:

- `depends_on`
- `feeds`
- `consumes`
- `governs`
- `validates`
- `extends`
- `references`
- `supersedes`
- `duplicates`
- `related_to`

If the relationship is operationally trusted, set:

- `source_type: "declared"`
- `confidence: 1.0`

Do not add inferred edges unless the catalog explicitly supports them for discovery-only use.

## Validation

Validate generated JSON against the repo schemas when available.

If a repo provides a validator, run it after generation.

Example:

```bash
npm run validate:context-catalog
```

For `legal_case_analysis`, also validate against `contracts/day-intelligence-1.0.md`. The generated artifacts live under `generated/day-intelligence/day-NN/vN/` and remain a filesystem artifact set, not a database subsystem.

## Reference

Read [references/artifact-contract.md](references/artifact-contract.md) for the standard artifact shapes and contract details when you need the exact structure.

