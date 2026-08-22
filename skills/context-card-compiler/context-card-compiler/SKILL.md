---
name: context-card-compiler
description: Compile a canonical markdown context object into synchronized catalog artifacts for humans, UI, and agents. Use when creating or refreshing `context.md`, `card.json`, `agent-pack.json`, and `relationships.json` in a context catalog, especially for project briefs, infrastructure objects, operating systems, or agent-readable catalogs.
---

# Context Card Compiler

Turn a full markdown context file into a reusable catalog object with four artifacts:

1. `context.md`
2. `card.json`
3. `agent-pack.json`
4. `relationships.json`

The markdown file remains the source of truth.

## Workflow

1. Start from a canonical `context.md`.
2. Generate or refresh `card.json`, `agent-pack.json`, and `relationships.json`.
3. Keep the UI card short and readable.
4. Keep the agent pack explicit and versioned.
5. Keep relationships declared in V1. Do not infer graph edges.

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

## Reference

Read [references/artifact-contract.md](references/artifact-contract.md) for the standard artifact shapes and contract details when you need the exact structure.

