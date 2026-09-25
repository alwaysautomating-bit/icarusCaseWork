# PROV — Reusable Agent Skills

These are portable `SKILL.md` drafts for PROV-style document provenance, controls, and auditability workflows. Each skill follows the Agent Skills convention: a directory containing a required `SKILL.md` with YAML frontmatter and task instructions.

Suggested layout:

```text
skills/
├── provenance-intake/SKILL.md
├── evidence-chain/SKILL.md
├── control-mapping/SKILL.md
├── audit-ready-report/SKILL.md
├── document-diff/SKILL.md
├── entity-resolution/SKILL.md
├── exception-triage/SKILL.md
└── provenance-data-model/SKILL.md
```

---

## `provenance-intake/SKILL.md`

```md
---
name: provenance-intake
description: >
  Intake a document, record, or event into PROV with a verifiable provenance
  record. Use when a user uploads, submits, imports, receives, or references
  source material that must be traceable through later extraction, review, and
  decision workflows. Do not use for ordinary brainstorming or content that
  does not require an evidentiary record.
compatibility: Requires access to the PROV data store or an approved local staging area. Never silently discard source files or metadata.
metadata:
  domain: provenance
  risk-level: high-integrity
---

# Purpose

Create an immutable intake record before interpreting or transforming source material. Treat the original source as evidence, not merely input text.

## Required inputs

Collect, infer, or explicitly mark as unknown:

- Source file, URL, message, API payload, or physical-document scan
- Source type and claimed origin
- Acquisition method and timestamp
- Submitting actor or system identity, when available
- Matter, project, vendor, contract, asset, or case association
- Confidentiality classification and retention requirement

## Workflow

1. Preserve the original artifact byte-for-byte where the platform permits it.
2. Calculate and store a cryptographic content hash. Do not overwrite a prior hash.
3. Assign a stable `evidence_id` and a separate `artifact_version_id`.
4. Capture observable source metadata exactly as received. Keep claimed metadata separate from system-observed metadata.
5. Create an intake event containing actor, action, timestamp, source channel, hash, and correlation ID.
6. Classify the artifact only to the confidence justified by the evidence. Use `unknown` rather than inventing a source, document type, or owner.
7. Attach the artifact to its business context, but preserve a many-to-many relationship when context is uncertain or contested.
8. Return a concise intake receipt with identifiers, status, and unresolved questions.

## Integrity rules

- Never replace the original with OCR, extracted text, a normalized copy, or a redacted copy.
- Store derived artifacts as new objects linked to the source artifact.
- Record time as ISO 8601 with timezone. Distinguish `claimed_at`, `observed_at`, and `recorded_at`.
- Do not state that a document is authentic solely because it was uploaded or hashed. A hash proves consistency of a captured artifact, not real-world truth.
- Flag unreadable, incomplete, password-protected, or corrupted artifacts as exceptions.

## Output format

Return:

```yaml
intake_receipt:
  evidence_id: "EV-..."
  artifact_version_id: "AV-..."
  source_hash: "sha256:..."
  intake_status: "accepted | quarantined | needs-review"
  observed_at: "YYYY-MM-DDTHH:MM:SS±HH:MM"
  associated_context: []
  unresolved_items: []
```

## Example

A vendor invoice arrives through email. Preserve the raw email and attachment separately, hash both, record the sender address as an observed attribute, record the claimed vendor name from the invoice as a claim, and link later OCR/extraction output as derived artifacts.
```

---

## `evidence-chain/SKILL.md`

```md
---
name: evidence-chain
description: >
  Build, inspect, and explain a chain of custody and transformation lineage for
  PROV evidence. Use when users need to know where a record came from, who
  handled it, what transformations occurred, or whether an output can be
  traced to source material. Do not use to claim legal admissibility or
  authenticity without jurisdiction-specific review.
compatibility: Requires immutable or append-only event records and artifact identifiers.
metadata:
  domain: provenance
  risk-level: high-integrity
---

# Purpose

Represent evidence as a directed lineage graph: source artifacts, derived artifacts, activities, agents, decisions, and attestations.

## Core entities

- `entity`: a file, record, extracted value, report, or decision output
- `activity`: ingest, OCR, parse, classify, approve, export, or correction
- `agent`: person, service account, application, model, or external system
- `assertion`: a claim about an entity, distinct from the entity itself
- `attestation`: a signed or attributable statement of review or approval

## Workflow

1. Start with the exact entity or decision the user asks about.
2. Traverse backward to every immediate input, then recursively to original sources.
3. For every edge, identify the activity that produced the downstream entity.
4. For every activity, identify the acting agent, time window, tool or model version, configuration, and correlation ID when known.
5. Separate deterministic transformations from AI-assisted transformations.
6. Surface broken links, missing timestamps, altered hashes, unidentified agents, and unexplained version changes.
7. Produce both a human-readable timeline and a machine-readable graph payload.

## Required distinctions

- “Derived from” is not the same as “verified against.”
- “Reviewed” is not the same as “approved.”
- “User supplied” is not the same as “source independently verified.”
- A model-generated extraction is a claim until validated or otherwise designated by policy.

## Output format

```yaml
lineage_summary:
  subject_entity_id: "..."
  lineage_status: "complete | partial | broken"
  root_sources: []
  transformations: []
  human_reviews: []
  integrity_findings: []
  limitations: []
```

## Quality bar

Use exact IDs and timestamps where available. If a link is inferred rather than recorded, label it `inferred` and explain the basis. Never silently bridge a missing event.
```

---

## `control-mapping/SKILL.md`

```md
---
name: control-mapping
description: >
  Map observed PROV events, artifacts, and evidence to operational, financial,
  security, or compliance controls. Use for control testing, gap assessment,
  audit preparation, and evidence collection. Do not present a mapping as a
  certification, legal conclusion, or proof that a control operates effectively
  without sufficient test evidence.
compatibility: Works with internal control libraries and frameworks such as CMMC, NIST, SOC 2, HIPAA, AP policies, and customer-specific requirements.
metadata:
  domain: compliance
  risk-level: controlled
---

# Purpose

Turn provenance records into defensible control evidence while preserving the difference between a control requirement, its design, evidence of execution, and a conclusion about effectiveness.

## Required inputs

- Applicable framework or internal control library version
- Scope: entity, process, system, time period, population, and exclusions
- Control objective and control owner
- Available evidence IDs and source artifacts
- Test procedure, if one exists

## Workflow

1. State the framework and exact control identifier before mapping.
2. Restate the control objective in plain language.
3. Identify the expected evidence: preventive, detective, corrective, or monitoring.
4. Link evidence by immutable ID; do not cite a dashboard screenshot when a source event exists.
5. Evaluate evidence quality: completeness, timeliness, attribution, integrity, and relevance.
6. Record exceptions separately from observations and recommendations.
7. Give a bounded conclusion: `not assessed`, `design evidence only`, `execution evidenced`, `exception observed`, or `insufficient evidence`.
8. Identify what additional evidence would change the conclusion.

## Control-evidence matrix

Use this structure:

| Field | Requirement |
|---|---|
| Control ID | Exact framework or internal identifier |
| Objective | Risk being mitigated |
| Evidence | Immutable IDs and source descriptions |
| Period | Date range tested |
| Procedure | How evidence was evaluated |
| Result | Bounded result, not a certification |
| Exceptions | Specific deviations and severity |
| Follow-up | Owner and next evidence needed |

## Guardrails

- Do not conflate a policy document with proof of operation.
- Do not infer approval from a timestamp without an attributable approval event.
- Do not claim compliance for systems, teams, or periods outside the stated scope.
- Escalate suspected fraud, data tampering, access-control bypass, or evidence deletion immediately.
```

---

## `audit-ready-report/SKILL.md`

```md
---
name: audit-ready-report
description: >
  Produce an audit-ready evidence narrative from PROV records, including scope,
  traceability, exceptions, and limitations. Use for internal audit packets,
  customer diligence, incident review, compliance evidence packages, and
  management reporting. Do not use to fabricate missing evidence or issue a
  formal audit opinion.
compatibility: Requires evidence IDs, source links, and defined reporting scope.
metadata:
  domain: reporting
  risk-level: high-integrity
---

# Purpose

Create a report that an independent reviewer can follow from conclusion back to source evidence without relying on undocumented assumptions.

## Workflow

1. Define the question, period, systems, population, and exclusions.
2. List the source evidence and provenance coverage before drawing conclusions.
3. State the method: sampling, automated rule, reconciliation, review, or interview.
4. Present findings in order of risk and materiality.
5. For every finding, include evidence IDs, observed facts, interpretation, impact, and recommended owner action.
6. Include a dedicated limitations section for missing records, inaccessible systems, untested populations, and assumptions.
7. Check that every material claim has a traceable source or is explicitly labeled as analysis.

## Required structure

1. Executive purpose
2. Scope and period
3. Evidence inventory
4. Method and criteria
5. Findings and exceptions
6. Provenance and traceability notes
7. Limitations
8. Recommended actions
9. Appendix: evidence index

## Writing rules

- Use observed, attributable language: “The log records…”, “The invoice claims…”, “The reviewer approved…”.
- Avoid conclusory language such as “proven,” “fully compliant,” or “fraudulent” unless the stated evidence and authority support it.
- Preserve exact IDs in the appendix; use readable labels in the narrative.

## Finding template

```md
### Finding: [short title]
**Risk:** low | moderate | high | critical
**Observed fact:** [precise, attributable observation]
**Evidence:** [EV-..., activity IDs, hashes, timestamps]
**Impact:** [bounded operational/compliance impact]
**Recommendation:** [specific remediation]
**Owner / due date:** [if known]
```
```

---

## `document-diff/SKILL.md`

```md
---
name: document-diff
description: >
  Compare document versions and generate a provenance-aware change record. Use
  for contracts, invoices, policies, specifications, drawings, and regulated
  documents where users need to know exactly what changed, when, and through
  which source. Do not compare documents as equivalent if their source or
  extraction quality prevents a reliable match.
compatibility: Supports native digital files and OCR outputs; OCR-derived comparisons must disclose extraction uncertainty.
metadata:
  domain: document-intelligence
  risk-level: controlled
---

# Purpose

Produce a defensible difference analysis while preserving both source artifacts, their hashes, and the chain of transformations used to compare them.

## Workflow

1. Confirm the two or more artifact version IDs and designate the baseline.
2. Verify file integrity and capture each version’s hash, source, and observed timestamp.
3. Determine comparison mode: byte-level, structural, textual, table-aware, or semantic.
4. If OCR is involved, compare image regions or source pages for material changes and label uncertain text.
5. Categorize changes as addition, deletion, modification, move, formatting-only, metadata-only, or unresolved.
6. Identify material changes using the user’s defined rules; otherwise label materiality as unassessed.
7. Produce a reversible change log that links every reported change to page, section, field, or record coordinates.
8. Never overwrite the baseline, normalized text, or prior diff results.

## Output format

```yaml
document_diff:
  baseline_artifact_id: "AV-..."
  comparison_artifact_id: "AV-..."
  comparison_method: "textual | structural | semantic | hybrid"
  source_integrity: "verified | mismatch | unavailable"
  changes:
    - change_id: "CH-..."
      category: "addition | deletion | modification | move | formatting | metadata | unresolved"
      location: "page/section/field"
      before: "..."
      after: "..."
      confidence: 0.0
      materiality: "material | nonmaterial | unassessed"
  limitations: []
```

## Guardrails

- Formatting changes can affect meaning in tables, drawings, payment instructions, and signature blocks; do not always dismiss them.
- A semantic summary supplements, but never replaces, an itemized diff for high-risk documents.
- Flag changed banking details, payment terms, approvals, signatures, scope, pricing, addresses, and security requirements for manual review.
```

---

## `entity-resolution/SKILL.md`

```md
---
name: entity-resolution
description: >
  Resolve whether records likely refer to the same person, vendor, company,
  account, project, asset, or document while preserving uncertainty and source
  provenance. Use for duplicate detection, vendor master review, AP controls,
  document linking, and cross-system reconciliation. Do not merge identities
  automatically when conflict, fraud indicators, or insufficient evidence is
  present.
compatibility: Requires source-specific identifiers and provenance for each candidate attribute.
metadata:
  domain: data-quality
  risk-level: high-integrity
---

# Purpose

Create explainable entity links, not opaque identity assertions.

## Workflow

1. Retain each source record as an independent entity with its own source ID.
2. Normalize comparison features without destroying originals: names, addresses, tax IDs, emails, bank details, phone numbers, domains, and account identifiers.
3. Score exact and fuzzy matches separately. Do not let a name similarity override a conflicting high-assurance identifier.
4. Record the evidence supporting and contradicting a proposed link.
5. Apply decision thresholds:
   - `confirmed`: reliable, non-conflicting identifiers and policy-permitted evidence
   - `probable`: strong match requiring review or downstream caution
   - `possible`: weak or partial match
   - `not-linked`: insufficient or conflicting evidence
6. Route high-risk attributes—bank accounts, tax IDs, payment instructions, sanctions data, and privileged access identities—to human review.
7. Keep merges reversible. Preserve aliases and source-specific attributes.

## Output format

```yaml
resolution_result:
  candidate_a: "entity-id"
  candidate_b: "entity-id"
  relationship: "same-as | related-to | not-linked | unresolved"
  confidence: 0.0
  supporting_evidence: []
  conflicting_evidence: []
  decision_basis: "rules | reviewer | model-assisted"
  reviewer_required: true
  provenance_links: []
```

## Fraud-sensitive signals

Flag, rather than auto-resolve:

- Same bank account across otherwise unrelated vendors
- New or recently changed banking details
- Free-email domains paired with a purported corporate vendor
- Near-match vendor names and remittance addresses
- Conflicts between tax identity, legal name, and payment recipient
```

---

## `exception-triage/SKILL.md`

```md
---
name: exception-triage
description: >
  Triage anomalies, control failures, missing evidence, and suspicious changes
  in PROV workflows. Use when a process, document, transaction, or lineage
  record violates a rule, threshold, expected sequence, or integrity check.
  Do not close an exception without recording the investigation basis and
  responsible decision-maker.
compatibility: Requires an exception register and linkable event/evidence IDs.
metadata:
  domain: controls
  risk-level: high-integrity
---

# Purpose

Convert anomalies into traceable, prioritized cases while avoiding premature conclusions about error, misconduct, or fraud.

## Workflow

1. Create an immutable exception record with a unique case ID.
2. Capture the triggering rule, detection time, detector version, severity, and affected entity IDs.
3. Preserve relevant evidence before remediation or correction changes it.
4. Assess impact across money, security, compliance, operations, data integrity, and external reporting.
5. Classify disposition as `open`, `under-review`, `resolved`, `accepted-risk`, or `false-positive`.
6. Require attributable rationale, evidence references, and reviewer identity for every disposition.
7. Escalate immediately under predefined triggers, including suspected payment diversion, credential compromise, tampering, unauthorized access, legal hold relevance, or material reporting impact.
8. Create corrective actions separately from the exception; link completion evidence back to the case.

## Severity guide

| Severity | Use when | Expected response |
|---|---|---|
| Critical | Active compromise, payment fraud risk, evidence tampering, or material compliance exposure | Preserve, contain, and escalate immediately |
| High | Significant control bypass or potentially material incorrect record | Prioritized investigation and owner assignment |
| Moderate | Isolated process deviation with bounded impact | Review within standard SLA |
| Low | Data-quality or documentation issue without material impact | Queue for correction and trend analysis |

## Output format

```yaml
exception:
  case_id: "EX-..."
  status: "open"
  severity: "low | moderate | high | critical"
  trigger: "rule or observed condition"
  affected_entities: []
  evidence_ids: []
  immediate_actions: []
  owner: "..."
  disposition_rationale: null
```
```

---

## `provenance-data-model/SKILL.md`

```md
---
name: provenance-data-model
description: >
  Design or review a PROV-compatible data model for artifacts, events,
  transformations, identities, decisions, attestations, and audit trails. Use
  when building a provenance layer in Supabase, PostgreSQL, APIs, document
  pipelines, or event-sourced systems. Do not use a mutable current-state table
  as the only record for decisions that require traceability.
compatibility: PostgreSQL/Supabase-friendly; adaptable to event stores and object storage.
metadata:
  domain: architecture
  risk-level: high-integrity
---

# Purpose

Build a durable provenance substrate in which current state is queryable but historical evidence remains attributable, ordered, and tamper-evident.

## Design principles

- Use immutable IDs for artifacts, events, activities, agents, and assertions.
- Keep source artifacts immutable; create new versions and derived objects rather than updates-in-place.
- Model provenance relationships explicitly: `used`, `generated`, `wasDerivedFrom`, `wasAssociatedWith`, `wasAttributedTo`, and `wasInformedBy`.
- Separate business facts, claimed facts, extracted facts, inferred facts, and reviewer-validated facts.
- Store hashes, timestamps, actor identity, tool/model version, configuration version, and correlation IDs at activity boundaries.
- Support soft deletion for application views while retaining compliant evidentiary history under retention policy.

## Minimum relational tables

```text
artifacts
artifact_versions
artifact_hashes
activities
agents
activity_agents
derivations
assertions
assertion_evidence
attestations
events
exceptions
retention_holds
access_events
```

## Event record requirements

```yaml
event:
  event_id: "uuid"
  event_type: "artifact.ingested"
  occurred_at: "ISO-8601"
  recorded_at: "ISO-8601"
  actor_id: "agent/person/system ID"
  subject_type: "artifact"
  subject_id: "uuid"
  correlation_id: "uuid"
  idempotency_key: "string"
  prior_event_hash: "sha256:..."
  event_hash: "sha256:..."
  payload_version: 1
  payload: {}
```

## Implementation workflow

1. Identify the business objects and critical decisions that need lineage.
2. Define immutable source-of-truth tables before building derived views.
3. Specify event types and permitted state transitions.
4. Add database constraints for identity, foreign keys, hash format, and append-only behavior.
5. Implement idempotency and correlation IDs for every intake and workflow action.
6. Create queryable current-state projections from the event stream; never make the projection the sole evidence record.
7. Test for replay, duplicate delivery, partial failures, correction events, and actor attribution.
8. Document retention, redaction, access control, export, and legal-hold behavior.

## Review checklist

- Can a reviewer trace a decision to exact source artifacts?
- Can the system distinguish original, normalized, extracted, and inferred content?
- Can a correction be made without erasing the prior record?
- Can an event be tied to a responsible human or system agent?
- Can the system explain what model/configuration created an AI-derived output?
- Can high-risk records be retained and exported with integrity metadata?
```
