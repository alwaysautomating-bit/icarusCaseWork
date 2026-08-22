# Artifact Contract

Every context object should produce:

1. `context.md`
2. `card.json`
3. `agent-pack.json`
4. `relationships.json`

## card.json

- short UI-facing summary
- stable `id`
- concise `one_liner`
- human-readable `title` and `subtitle`

## agent-pack.json

- machine-readable contract
- semantic `version`
- explicit `purpose`
- explicit `inputs`, `outputs`, `capabilities`, `dependencies`, `consumers`
- required governance:
  - `human_review_required`
  - `auto_action_allowed`
  - `audit_log_required`

## relationships.json

- declared graph edges in V1
- no inferred edges by default
- use `source_type: "declared"` and `confidence: 1.0` for trusted edges

## Core Principle

Humans expand into `context.md`.

Agents load `agent-pack.json`.

Graph readers traverse `relationships.json`.

The markdown file stays canonical.
