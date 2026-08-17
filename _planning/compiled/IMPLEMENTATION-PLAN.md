# End-to-End Implementation Plan

## Goal

Build the minimum vertical slice that proves the v1 obligation without prematurely absorbing advanced probabilistic or generalized platform scope.

## Delivery Principles

- Build vertical slices that end in researcher-visible outcomes.
- Treat immutable artifacts, reviewed claims/events, provenance, chronology, and uncertainty as the authority.
- Require auditable human decisions for consequential transitions.
- Use synthetic or legally public fixtures in automated tests; do not place sensitive case material in source control.
- Every phase closes only when its exit evidence exists. Completing activities alone does not close a phase.

## Phase 0: Foundation and Architecture (target: 1-2 weeks)

Outcomes:

- clean product scaffold with Icarus Casework identity, README, fresh Git history, formatting, linting, tests, CI, and environment templates;
- architecture decision for client, API, relational database, immutable object storage, job execution, authentication, model adapters, and deployment;
- threat model, privacy classification, retention/deletion rules, audit-event policy, observability baseline, and backup/restore plan;
- schema and citation-locator decision supported by representative fixtures.

Exit gate:

- a new contributor can run the app and tests from the README;
- CI proves format, lint, type, unit, and migration checks;
- architecture and schema decisions are recorded;
- representative citation fixtures cover PDF/DOCX, transcript, screenshot/image, spreadsheet, and audio/video locations;
- no secret or sensitive real-case artifact exists in Git.

Blocking conditions:

- citation locations are not stable across reprocessing;
- immutable originals and derived content cannot be separated;
- authorization or deletion semantics remain undefined.

## Implementation Principle

The evidence substrate comes first and remains authoritative:

`Immutable artifacts -> Attributed claims -> Reviewed observable events -> Entities + relationships + chronology -> Evidence graph -> Patterns, hypotheses, priors, simulations, and narrative projections`

## Phase 1: Source-Linked Substrate Slice (target: 2-3 weeks)

Build:

1. SourceArtifact intake and preservation
2. Exact source-location citation model
3. Attributed claim extraction
4. Human review surface for claims
5. Reviewed observable event representation
6. Source-linked timeline display

Acceptance:

- one source artifact preserved immutably;
- one claim extracted with exact citation;
- one reviewed event represented distinctly from the claim;
- both visible on a source-linked timeline.

Required evidence:

- automated integration test from upload through timeline;
- checksum and evidence-snapshot manifest;
- reviewer identity and disposition event;
- UI capture or end-to-end test proving source-to-claim-to-event navigation.

Allowed terminal disposition: accepted, rejected for redesign, or cancelled. A demo without the integration evidence does not close the phase.

## Phase 2: Core Evidence Graph (target: 3-4 weeks)

Build:

1. Entity resolution for core entities
2. Claim lineage tracking
3. Contradiction representation
4. Event time vs report time distinction
5. Source provenance roles

Acceptance:

- repeated downstream claims trace back to a single origin;
- conflicting claims can coexist;
- report time and event time remain distinct in the model and UI.

Add:

- reversible entity/alias resolution;
- explicit provenance roles;
- uncertain and conflicting time representation;
- contradiction lifecycle with unresolved items remaining surfaced;
- audit history for consequential edits.

Required evidence:

- tests proving one-origin repetition is not independent corroboration;
- tests proving contradictory claims coexist;
- tests for exact, approximate, interval, relative, conflicting, and unknown time;
- reversible merge and audit-history tests.

## Phase 3: Researcher Reconstruction Workflow (target: 3-4 weeks)

Build:

1. Case room
2. Source reader
3. Timeline filters
4. Contradiction / unresolved view
5. Cited narrative or brief export

Acceptance:

- a researcher can reconstruct who reported what, what the record supports, and what remains unresolved.

Add:

- 90-day, 30-day, and incident-window timeline lanes;
- filters for source type, entity, epistemic state, and time precision;
- saved research views and unresolved-work queue;
- evidence snapshot regeneration.

Required evidence:

- moderated usability run where a creator completes the canonical ingest-to-contradiction workflow;
- reproducibility test yielding the same projection from the same snapshot;
- accessibility audit of primary keyboard and screen-reader paths;
- performance evidence against the agreed pilot corpus size.

## Phase 4: Cited Narrative and Research Packet (target: 2-3 weeks)

Build:

1. narrative drafting from reviewed records only;
2. sentence-level citation coverage and visible interpretation labels;
3. claim-lineage and unsupported-assertion validation;
4. publication safety checklist and independent approval;
5. versioned export manifest with cutoff date and evidence snapshot.

Acceptance:

- every material sentence is cited or labeled interpretation;
- the export preserves attribution, uncertainty, lineage, cutoff date, and version;
- a failed validation cannot be published through the normal product path;
- superseded exports remain traceable without presenting them as current.

Required evidence:

- golden export fixtures;
- automated unsupported-sentence and metadata validation tests;
- recorded independent human approval on a demonstration export.

## Phase 5: Constrained Competing-Account Testing (target: 3-4 weeks)

Build:

1. Hypothesis / proposition representation as Projection
2. Required-condition representation
3. Constrained feasibility testing
4. Run metadata and reproducibility controls

Acceptance:

- at least two competing accounts can be tested against explicit conditions;
- output retains assumptions, version, and evidence IDs;
- no model output overwrites claims, events, or evidence.

Add:

- deterministic hard-constraint engine before probabilistic sampling;
- explicit intervals/distributions for uncertain inputs;
- sensitivity and discriminating-evidence output;
- scenario-run reproducibility and invalidation when inputs change.

Required evidence:

- at least two competing accounts evaluated against the same snapshot;
- repeat run with identical version/seed produces identical result;
- infeasible cases expose violated constraints;
- copy and UI review confirms that frequency is never described as probability of truth.

## Phase 6: Demonstration Case and Pilot Hardening (target: 3-5 weeks)

Build:

1. a legally public, bounded Lindsay Clancy case corpus with a documented cutoff date;
2. the interactive case room;
3. the eight-section research packet named in the V1 specification;
4. case-specific claim review for temperature, injuries, medication exposure, knot configuration, support decisions, and other high-impact working claims;
5. security, accessibility, recovery, performance, and publication-safety hardening.

Acceptance:

- all V1 specification acceptance criteria pass against the demonstration corpus;
- primary-source review gates high-impact claims before verified status;
- an independent reviewer can reproduce the packet from the snapshot;
- threat-model controls, least privilege, backup/restore, audit export, deletion, and incident procedures pass rehearsal;
- no prohibited private or unnecessary identifying information appears in the release candidate.

Required evidence:

- signed acceptance matrix linking every criterion to a test, review record, or output;
- reproducibility report;
- security/privacy review disposition;
- creator usability findings with all release-blocking findings resolved, rejected with rationale, or explicitly cancelled by the product owner.

## Phase 7: Private Pilot and V1 Launch (target: 2-4 weeks)

Pilot:

- invite a small set of true-crime researchers under clear terms and feedback consent;
- use public or authorized materials only;
- monitor ingestion failures, review burden, citation defects, lineage errors, unsafe wording, performance, and support requests;
- run weekly issue disposition and evidence-quality review.

Launch gate:

- no open critical security, privacy, data-loss, attribution, or publication-integrity defect;
- service objectives, alerting, incident ownership, backup/restore, and rollback are tested;
- pilot users can complete the core workflow without researcher intervention beyond documented onboarding;
- product claims match demonstrated capability and retain all explicit V1 non-goals.

Allowed terminal dispositions: launch, extend pilot with named blockers, reject the release candidate, or cancel V1. "Pilot completed" is not itself a launch condition.

## Cross-Cutting Workstreams

### Data and provenance

Schema migrations, immutable artifacts, checksums, exact source locators, lineage, snapshots, audit events, retention, export, and deletion.

### AI quality

Versioned prompts/models, extraction evaluation sets, abstention, confidence calibration as workflow guidance only, reviewer feedback, regression tests, and provider failure handling.

### Safety and integrity

Public/authorized data boundary, dignity/privacy minimization, high-impact review, crisis-resource policy, prohibited conclusions, publication approval, and incident response.

### Product and UX

Creator interviews, source-reader ergonomics, review efficiency, uncertainty visualization, accessible interactions, export quality, onboarding, and help content.

### Engineering and operations

CI/CD, environments, secrets, observability, job retries/idempotency, performance budgets, backup/restore, migrations, rollback, dependency updates, and cost controls.

## Acceptance Matrix

Maintain one traceability matrix during implementation:

`Spec criterion -> product requirement -> schema/API/UI element -> automated test or review -> evidence -> disposition`

No material criterion may disappear because a feature was implemented differently. It must be accepted, rejected with rationale, superseded, or cancelled in a recorded decision.

## Recommended Release Metrics

- 100% exact-citation coverage for material exported sentences;
- 0 silent claim-to-event promotions;
- 0 repeated-origin claims counted as independent corroboration in regression fixtures;
- 100% high-impact claims with recorded human disposition;
- reproducible projections for identical evidence snapshots and versions;
- 0 open critical security, privacy, data-loss, or publication-integrity defects;
- task completion and review-time baselines established during pilot, with thresholds set after the first moderated cohort rather than invented at kickoff.

## Deferred Until After V1 Validation

- rich Scenario Lab
- Monte Carlo reconstruction beyond constrained feasibility
- latent-state modeling
- responsibility allocation
- population-derived risk estimation
- broader domain generalization

## Critical Dependencies and Open Decisions

- stack, hosting, authentication, and storage architecture;
- exact persisted schema and citation-locator format;
- document/media parsing adapters and provider boundaries;
- lawful public demonstration corpus and primary-source access;
- product owner for publication approval and safety dispositions;
- pilot researcher cohort and explicit data-handling terms.

These do not invalidate kickoff. They block the phase whose exit gate requires them and must remain visible in the backlog until evidenced.

## Immediate Schema Consequences

Need explicit implementation decisions for:

- `SourceArtifact` table and exact citation-location structure
- provenance-role fields such as `originating_entity_id`, `publisher_entity_id`, `custodian_entity_id`, `submitted_by_entity_id`
- `Claim` as first-class persisted object
- reviewed observable event representation
- event time vs report time distinction
- lineage representation for repeated downstream claims
