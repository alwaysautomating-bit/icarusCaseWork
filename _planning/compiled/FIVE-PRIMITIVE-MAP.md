# Five Primitive Map

## Entities

Current candidate entities requiring durable identity:

- Case
- Person
- Organization
- SourceArtifact
- Device
- Location
- Legal Proceeding
- SystemNode

Possible later or derived entities:

- Claim
- Narrative Output

Projection-layer objects:

- Hypothesis

Open question:
- Whether `Claim` belongs as a first-class domain object or should be modeled as a derived object attached to events, sources, and evidence.

## Events

Current events requiring chronology:

- statement made
- source published
- call occurred
- communication sent
- filing entered
- evidence collected
- claim recorded
- observation made
- clinical contact occurred
- medication changed
- hospitalization occurred
- household care activity occurred
- incident-window action occurred
- information moved or failed to move between actors

## Evidence

Current evidence establishing or supporting assertions:

- original documents
- personal writings
- medical records
- testimony
- communications
- trial records
- photos / audio / video
- device / time / location records
- derived calculations with provenance
- structured extraction outputs tied back to sources

## Relationships

Current operational relationships:

- person made claim
- claim came from source artifact
- event concerns person or system node
- evidence supports claim
- evidence contradicts claim
- source depends on prior source
- account is repeated by downstream source
- information flowed between nodes
- support obligation remained assigned or unassigned

## Projections

Current useful projections:

- layered timeline
- source reader
- evidence map
- contradiction view
- case brief
- cited narrative builder
- narrative genealogy
- scenario comparison

## Primitive Pressure Test

What currently fits well:

- The substrate strongly fits entities, events, evidence, relationships, and projections.
- Provenance and claim lineage are especially well-supported by this primitive model.

What may require exception handling or explicit modeling choice:

- Scenario propositions
- Responsibility allocation outputs
- Bounded latent-state outputs

Current judgment:
- These look more like higher-layer derived or analytical objects than new primitives.
- They should not quietly force primitive expansion during kickoff.
- `Hypothesis` is explicitly approved as a Projection rather than a primitive or substrate object.

## Current Compiler Conclusion

Five Core Primitives appear sufficient for the current Casework definition. No primitive-model exception is required in the second compiler pass.
