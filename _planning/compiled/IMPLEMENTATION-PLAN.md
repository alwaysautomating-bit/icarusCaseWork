# End-to-End Implementation Plan

## Implemented Build Slice: Testimony URL Intake

Status: Complete locally on 08-16-2026. Migration `20260817035154_testimony_url_intake.sql`, the authenticated Rev URL flow, real-page browser evidence, and the maintained local integration check satisfy the slice boundary. Remaining test expansion and schema-reference debt are tracked in `BACKLOG_08-16-2026.md`.

### Outcome

The first intake build accepts one authenticated, case-scoped testimony URL and turns it into inspectable, provenance-preserving records. The proving fixture is a timestamped Rev trial-transcript page with an embedded media reference. The slice is complete only when a researcher can move from an assertion to its exact transcript segment and source-specific deep link without the assertion becoming a verified fact.

The first slice is intentionally narrower than the complete evidence-intake prompt. PDF, DOCX, image, medical-record, forensic-report, and Lindsay Clancy Part 2 PDF ingestion remain later adapters over the same intake contract.

### Invariants

- Preserve the submitted URL exactly; store a normalized canonical URL separately.
- Treat the captured transcript page, embedded media, underlying testimony, and mentioned exhibits or records as distinct objects.
- Treat `source_artifacts` as concrete source-document representations, not as the evidentiary origin itself.
- Evolve `claims` as the persisted assertion object; do not introduce a competing assertions table.
- Persist an explicit evidence lane on the evidentiary `source` and each `claim`: `testimony`, `documentary`, or `direct_evidence`. The first slice may create only `testimony` records.
- Artifact representation and evidence lane are orthogonal. An HTML transcript is a documentary representation of testimony; its file format cannot silently reclassify the contained claims as documentary evidence.
- A proposition normalizes what assertions concern but never asserts truth.
- Extraction confidence describes extraction quality only and cannot create or change a verification assessment.
- Every assertion must resolve to one exact `source_segment`, including speaker, timestamp, and deep-link target when available.
- Ordered attribution must preserve speaker, reporter, recorder, quoter, summarizer, interpreter, and testifier roles.
- Repeated documents or derivative reports from one lineage cannot increase independent corroboration.
- `known_to_exist` and `possessed_by_us` remain independent fields.
- Null or unknown metadata stays null; parsers do not invent certainty.
- All writes remain case-scoped, authenticated, RLS-protected, auditable, and atomic.

### Intake/Reconciliation Boundary

Cross-lane reconciliation is forbidden during intake.

Testimony intake may create sources, artifacts, segments, claims, proposition candidates, ordered attribution chains, source lineages, and acquisition targets. It may not:

- merge testimony claims with documentary or direct-evidence claims;
- create support, contradiction, corroboration, independence-assessment, or verification records;
- use absence in another evidence lane as contradiction or negative evidence;
- mutate an earlier claim when a later lane links to the same proposition; or
- permit a future parser adapter to write around the reconciliation boundary.

Cross-lane support, conflict, qualification, independence assessment, and verification belong to a later authenticated Reconciliation layer. Intake may identify exact duplicate/source lineage, but lineage is not support.

### Existing-Schema Mapping

| Requested concept | Plan |
| --- | --- |
| EvidenceIntake | Add `evidence_intakes` as the capture/job ledger. |
| Source | Add `sources` for the evidentiary origin or known underlying source. |
| EvidenceLane | Add a constrained lane to `sources` and `claims`; do not place it on `source_artifacts`, whose media/document type describes representation. |
| SourceDocument | Reuse and extend `source_artifacts`; it already stores immutable checksum-addressed representations. |
| DocumentSegment | Reuse and extend `source_segments` with sequence, speaker, timestamp, and deep-link metadata. |
| CanonicalDocument | Add `source_lineages` where canonical/duplicate grouping is required; retain each physical artifact and keep this distinct from `claim_lineage`. |
| Proposition | Add `propositions`; a proposition has no truth or verification flag. |
| Assertion | Evolve `claims`; add proposition, provenance, epistemic, extraction-confidence, and review fields without overloading `status`. |
| AssertionAttribution | Add ordered `claim_attributions` linked to entities and source artifacts. |
| AssertionSupport | Add `claim_support` for the later Reconciliation layer with `supporting_claim_id`, `target_proposition_id`, `evidence_lane`, `source_lineage_id`, `independence_group`, `relation_type`, and `assessment_origin`. Testimony intake receives no write contract for this table. |
| Event | Reuse `events`; add `event_claims` so multiple assertions may describe one event. Do not auto-promote extracted testimony. |
| VerificationAssessment | Add append-only `verification_assessments` plus linked supporting/conflicting claims. |
| EvidenceAcquisitionRecord | Add `evidence_acquisition_records` for mentioned but unpossessed exhibits and records. |
| Review/correction history | Reuse `review_decisions` and `audit_events`; extend audit details to preserve before/after values and optional reason. |

### Runtime Shape

```text
Authenticated researcher
  -> URL intake Server Action
  -> URL safety and capture service
  -> immutable HTML snapshot + checksum
  -> evidence_intakes / sources / source_artifacts
  -> transcript parser adapter (Rev first)
  -> source_segments + extraction candidates
  -> one atomic commit function
  -> testimony-lane claims + proposition candidates + ordered attributions
  -> acquisition targets; no support or verification write
  -> assertion inspection drawer
```

The capture service must allow only HTTP(S), reject credentials in URLs, revalidate every redirect, block loopback/private/link-local destinations after DNS resolution, cap redirects, bytes, and duration, and accept only expected document content types. A parser failure preserves the original and ends in `review_required` or `failed`; it never discards the capture.

### Migration Sequence

Create the migration through `supabase migration new testimony_url_intake`; do not invent the migration filename.

1. Add enums/check constraints needed for evidence lane (`testimony`, `documentary`, `direct_evidence`), intake status, source family, capture method, provenance type, attribution role, support relation, support status, and acquisition status.
2. Add `evidence_intakes` and `sources` with `case_id`, exact submitted URL, canonical URL, capture metadata, status, checksum linkage, and null-safe parser metadata.
3. Extend `source_artifacts` with `source_id`, `evidence_intake_id`, document/capture metadata, derivative linkage, and URL/publisher fields while retaining the existing `(case_id, sha256)` exact-duplicate guard.
4. Extend `source_segments` with ordinal, speaker entity, timestamp interval, and source-specific deep-link target.
5. Add `propositions`; extend `claims` to reference propositions and the originating source, store assertion/provenance semantics, and persist its evidence lane. Use a composite foreign-key or equivalently strict database constraint so a claim cannot disagree with its source lane. Keep existing claim IDs and downstream references stable.
6. Add ordered `claim_attributions` and the reconciliation-owned `claim_support` shape. Do not expose a support-write payload or grant an intake write path.
7. Add `source_lineages`, `verification_assessments`, assessment-claim joins, and `evidence_acquisition_records`.
8. Add `event_claims`; preserve the current `events.promoted_from_claim_id` compatibility path until callers migrate, then plan its removal separately.
9. Add indexes for every case/foreign-key traversal, `(case_id, canonical_url)`, processing status, proposition, attribution sequence, lineage/independence group, support status, and acquisition status.
10. Enable RLS on every added public table; add ownership predicates through case membership for `SELECT`, `INSERT`, `UPDATE`, and `DELETE`, with both `USING` and `WITH CHECK` on updates.
11. Revoke default function/table privileges, grant only the required authenticated Data API access, and add one narrowly scoped `SECURITY INVOKER` commit function for the atomic parsed-result write. Its input contract accepts testimony only and contains no support, contradiction, reconciliation, or verification fields.
12. Update or disable every legacy write path so no adapter can omit or override the evidence lane; the current slice permits `testimony` only.
13. Reconcile `src/db/schema.ts` with the authoritative migration in the same slice or retire it explicitly; schema drift cannot accompany this migration.

### Build Sequence

#### 1. Contract and storage

- Define Zod contracts for URL submission, captured document, transcript segment, testimony-lane assertion candidate, ordered attribution, proposition candidate, and acquisition target. Do not include reconciliation outputs in the intake contract.
- Extend the immutable storage adapter so an HTML snapshot is stored before parsing.
- Make idempotency deterministic from case, canonical URL, snapshot checksum, parser name, and parser version.

Exit evidence: duplicate submission reuses the exact snapshot/artifact identity while preserving the new intake attempt and its submitted URL provenance.

#### 2. Safe URL capture

- Add an authenticated, case-scoped Server Action accepting a URL only.
- Preserve submitted and canonical forms separately.
- Capture title, publisher, retrieval time, content type, response URL, immutable HTML, checksum, and embedded media identifier/URL when discoverable.
- Persist failure state and diagnostics without exposing arbitrary internal-network fetches.

Exit evidence: a safe synthetic transcript fixture captures successfully; blocked private-network, oversized, redirected-to-private, and unsupported-content fixtures fail safely.

#### 3. Testimony parser adapter

- Implement a provider-neutral transcript-parser interface and one Rev adapter.
- Extract ordered timestamped segments, speaker labels, exact text, and deep links.
- Record trial-day/session metadata as parser output; create a reviewed Event only after human confirmation.
- Create acquisition targets for mentioned exhibits/underlying records while leaving possession false.

Exit evidence: parsing the frozen fixture yields stable ordered segments and preserves the media reference separately from the transcript document.

#### 4. Atomic domain commit

- Commit testimony sources, documents, segments, claims, proposition candidates, attributions, lineages, and acquisition records in one database transaction.
- Make retries idempotent and reject cross-case foreign-key references.
- Leave verification unassessed unless a human or later evaluation workflow explicitly creates an assessment.
- Reject any non-testimony evidence lane and any payload that attempts support, contradiction, corroboration, independence assessment, or verification writes.

Exit evidence: induced failure after each write stage rolls back the whole domain commit; retry produces no duplicate assertions; the completed intake creates zero `claim_support` and zero `verification_assessments` rows.

#### 5. Inspection UI

- Add one URL field and processing-state display to the casework inbox.
- Add an assertion detail drawer showing exact excerpt, proposition, source, document, attribution chain, provenance type, support status, related support/duplicate lineage, and acquisition gaps.
- Provide `Open source` and `Watch at timestamp` actions when safe deep links exist.

Exit evidence: browser verification proves assertion -> segment -> canonical source/deep link navigation with no console or framework errors.

### Test Contract

Automate at least:

1. direct subject testimony;
2. witness testimony;
3. ordered reported-by chain;
4. clinician-recorded subject statement fixture;
5. investigator characterization;
6. expert opinion;
7. duplicate transcript/artifact lineage;
8. source/claim lineage distinguishes repeated origin from independent-origin metadata without creating support;
9. semantically conflicting testimony claims coexist without an intake-created contradiction record;
10. proposition remains unverified without an assessment;
11. `known_to_exist` differs from `possessed_by_us`;
12. exact duplicate capture does not duplicate assertions;
13. attribution sequence is preserved;
14. cross-user/cross-case RLS denial for every new table and commit function;
15. correction appends before/after audit history;
16. unknown metadata remains null;
17. high extraction confidence cannot set corroborated status;
18. submitted tracking URL and canonical URL are both preserved;
19. transcript page and embedded media are separate linked records;
20. SSRF and capture-budget controls fail closed;
21. induced domain-commit failure rolls back every record;
22. testimony claims remain `testimony` after persistence and retrieval;
23. an HTML transcript artifact does not reclassify its claims as `documentary`;
24. intake creates no support, contradiction, reconciliation, or verification record;
25. a later documentary or direct-evidence claim can link to the same proposition without mutating the original testimony claim.

### Slice Acceptance Gate

The slice may close only when one authorized Rev testimony URL can be submitted and later inspected with:

- exact submitted URL and canonical URL;
- immutable snapshot checksum and object key;
- transcript document separate from embedded media;
- stable ordered speaker/timestamp segments and deep links;
- at least one assertion, proposition, and ordered attribution chain;
- `testimony` evidence lane retained independently from the transcript artifact's HTML representation;
- unassessed verification state;
- zero intake-created support, contradiction, reconciliation, independence-assessment, or verification rows;
- one mentioned exhibit or underlying record represented as an unpossessed acquisition target;
- authenticated audit identity;
- passing atomicity, idempotency, RLS, evidence-lane, reconciliation-boundary, provenance, null-semantics, unit, migration, build, and browser tests.

Allowed terminal dispositions are accepted, rejected for redesign, superseded by a recorded plan, or cancelled. A successful scrape or attractive demo alone is not completion.

### Explicitly Deferred

- General-purpose web crawling and arbitrary-site parser coverage
- Full PDF/DOCX/image/audio/video ingestion
- Lindsay Clancy Part 2 PDF canonical-affidavit evaluation
- Automated corroboration or verification decisions
- Full evidence graph visualization
- Hosted Supabase, production Blob, Google/Apple credentials, and deployment cutover unless separately authorized
- Generalization to employment, malpractice, insurance, corporate investigations, or other domains; those are validated future projections over the same substrate

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
