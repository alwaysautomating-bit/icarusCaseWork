# Domain Model

## Current Modeling Principle

The domain model is constrained by Five Core Primitives:

- Entities
- Events
- Evidence
- Relationships
- Projections

All domain objects should either fit one of those primitives directly or be justified as a derived domain-layer construct. If something important does not fit, raise a primitive-model exception instead of silently inventing architecture.

## Candidate Core Entities

These currently appear load-bearing:

- Case
- Person
- Organization
- SourceArtifact
- Device
- Location
- Legal Proceeding
- SystemNode

These are likely domain-layer or derived objects:

- Claim
- Information Flow
- Contradiction
- Reconstruction
- Narrative Output

`Hypothesis` is a Projection. It is not a root substrate object and it must never overwrite claims, events, or evidence.

## Canonical Evidence Ontology

Use three distinct concepts:

- `SourceArtifact`: the immutable evidence object received by Icarus
- `Document`: a format or type classification of `SourceArtifact`, not a canonical primitive
- `Source`: provenance context, not a catch-all object

In implementation, prefer explicit provenance roles such as:

- `originating_entity_id`
- `publisher_entity_id`
- `custodian_entity_id`
- `submitted_by_entity_id`

Primitive mapping:

- `SourceArtifact` -> Evidence
- `Document` -> Evidence subtype or classification
- person / institution / device / publisher / custodian -> Entity
- entity supplied / published / recorded / custodial relationship to artifact -> Relationship
- receipt / publication / creation / amendment / extraction -> Event

## Events

The current event vocabulary includes:

- statement made
- observation recorded
- source published
- call occurred
- text sent
- document filed
- clinical visit occurred
- hospital admission / discharge
- medication changed
- evidence collected
- location or device activity recorded
- claim entered the public or legal record

Events must retain chronology and provenance. Approximate time, range time, and missingness must be represented explicitly.

## Evidence

Evidence currently includes:

- original documents
- reports
- trial transcripts
- testimony
- communications
- recordings
- device or location records
- medical records when legally/publicly available
- derived calculations or structured extraction outputs with provenance

Evidence is not the same thing as a claim. Evidence supports, contradicts, or fails to distinguish among claims and reconstructions.

## Claim

`Claim` is a first-class evidentiary assertion.

A claim records:

- exact or normalized assertion
- claimant
- subject
- source artifact and exact location
- claimed event time
- statement or report time
- epistemic status
- supporting evidence
- contradicting evidence
- lineage to downstream repeated claims

Primitive mapping:

`Claim` is an evidence-backed assertion connecting Entities, Events, and Evidence. It does not become an Event merely because somebody stated it.

## Relationships

Current meaningful relationships include:

- person made claim
- claim derived from source artifact
- event concerns entity
- evidence supports claim
- evidence contradicts claim
- source derives from another source
- information flowed from one system node to another
- actor had or lacked knowledge at time t

## Projections

Current useful projections include:

- verified or layered timeline
- evidence map
- source reader
- contradiction view
- case brief
- narrative builder
- scenario comparison outputs
- hypotheses

## Hypothesis

`Hypothesis` is a Projection containing:

- proposed explanatory account
- required conditions
- compatible evidence
- conflicting evidence
- assumptions
- unresolved variables
- feasibility results
- model version

## Current Semantic Distinctions

These distinctions look load-bearing already:

- source vs. claim
- claim vs. evidence
- observation vs. interpretation
- activity vs. outcome
- repeated report vs. independent corroboration
- narrative use vs. established record
- unresolved vs. resolved

## Current Open Modeling Questions

- Are `SystemNode` and `Organization` distinct canonical entities or is `SystemNode` a role/projection over entities?
- How should `InformationFlow` be represented: event, relationship, or derived edge?
- What exact persisted schema should represent claim lineage and exact citation location?

## Current Compiler Conclusion

The domain model is coherent enough for kickoff. The remaining questions are schema and representation questions rather than product-definition blockers.
