# Vertical Slice Backlog

## Now

- Define the persisted `SourceArtifact` model and exact citation-location structure.
- Define the persisted `Claim` model with claimant, subject, source artifact, source location, event time, report time, epistemic status, supporting evidence, contradicting evidence, and lineage.
- Define the reviewed observable event model distinct from claim statements.
- Define source provenance roles: `originating_entity_id`, `publisher_entity_id`, `custodian_entity_id`, `submitted_by_entity_id`.
- Build the first slice:
  Ingest one source artifact -> preserve the original -> extract one attributed claim with exact citation -> review it -> represent one supported event -> display both on a source-linked timeline.

## Soon

- Add core entity resolution for people, organizations, devices, and locations.
- Add claim lineage and repeated-report handling.
- Add contradiction representation and unresolved-state surfacing.
- Add timeline filtering by claims, events, and evidence types.
- Add reproducibility metadata for evidence snapshot and output regeneration.

## Later

- Add hypothesis/proposition objects as Projections.
- Add constrained feasibility testing for at least two competing accounts.
- Add evidence-backed case brief / cited story output.
- Add richer source-reader and evidence-map interfaces.

## Someday

- Rich Scenario Lab
- Monte Carlo reconstruction beyond constrained feasibility
- Bayesian proposition comparison
- responsibility allocation
- longitudinal pattern-of-life analysis
- regulated-domain extensions
