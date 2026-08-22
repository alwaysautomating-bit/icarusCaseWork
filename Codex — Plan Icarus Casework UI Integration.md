You are working on **Icarus Casework**.

This is a PLANNING PASS ONLY.

Do not modify code, migrations, schema, or application behavior yet.

You have two codebases to inspect:

1. The real Icarus Casework repository.
2. The supplied `transcript-multi-pass-intelligence` mockup codebase.

Treat them differently:

- **Production Icarus Casework is the architectural/data source of truth.**
- **The mockup is the UX and interaction reference.**

Do not copy mock data architecture into production simply because it exists in the mockup.

Your job is to determine how to turn the existing production application into the usable Casework workspace represented conceptually by the mockup, now backed by real searchable testimony.

# PRODUCT PURPOSE

Icarus reconstructs reality from incomplete, distributed, conflicting evidence while preserving the distinction between:

- source evidence
- claims/assertions
- event candidates
- actor knowledge
- disclosure
- direct observation
- inference
- corroboration
- structural conflicts
- theories/projections
- findings

The system must preserve uncertainty rather than flatten it.

Every analytical object must remain navigable back toward its evidentiary source.

The fundamental UI rule is:

**SHOW ME WHY → SHOW ME THE SOURCE**

# EXISTING PRODUCTION CAPABILITY

Phase 1 testimony search is complete locally.

The production system has:

- canonical `source_segments.exact_text`
- stored `tsvector`
- FTS GIN index
- `pg_trgm` GIN retrieval
- natural-question normalization
- RLS-aware search RPC
- speaker metadata
- proceeding metadata
- timestamps
- locators
- source links
- surrounding segments
- authenticated `/search`
- approximately 27,150 searchable transcript segments available to the local account
- verified RLS isolation
- verified index usage

Search remains lexical.

Do NOT add embeddings or vector search during this UI phase.

# MOCKUP INTERACTION MODEL

Inspect the supplied mockup carefully.

Important existing concepts include:

- Court Record panel
- Pass 1 — Provenance & Structure
- Pass 2 — Node Clustering & Lineage
- Pass 3 — Structural Reasoning & Derivation Lineage
- graph/node interaction
- detail drawers
- `Jump to Segment`
- highlighted transcript segment
- claims
- actors/witnesses
- evidence/exhibits
- event candidates
- three clocks
- relational ties
- evidence bundles
- lineage
- candidate conflicts
- temporal discrepancies
- statement shifts
- theory projections
- missing sources/acquisition targets
- certainty drift

The mockup already demonstrates an important navigation model:

**source → structure → graph → node → source**

A structural object contains or resolves to a transcript segment identifier.

Clicking `Jump to Segment` returns the analyst to the underlying testimony and highlights it.

Preserve this interaction principle.

Production must use the canonical real source-segment identifier rather than synthetic demo IDs.

# TOP-LEVEL CASEWORK EXPERIENCE

Do not treat Pass 1 / Pass 2 / Pass 3 as the entire application.

They are a structural-analysis subsystem inside the broader Casework workspace.

The conceptual product lifecycle is:

**ESTABLISH → INGEST → FIND → STRUCTURE → RECONCILE → REASON → RECONSTRUCT → IDENTIFY GAPS → ACQUIRE → REVISE**

However, do NOT design this as a rigid wizard.

Investigations are iterative.

Users must be able to return to earlier material when new evidence changes the case.

For this UI phase, focus on making the following real and usable:

1. Case Foundation / T₀ orientation
2. Court Record
3. Testimony Search
4. Provenance & Structure
5. Node Clustering & Lineage
6. Structural Reasoning
7. Timeline / Reconstruction
8. Actor Knowledge State
9. Missing Evidence / Acquisition Targets

Do not attempt to fully implement every analytical engine behind these screens if production support does not yet exist.

Clearly distinguish:
- real working functionality;
- UI scaffolding;
- future analytical capability.

# CRITICAL NEW VIEW: TEMPORAL KNOWLEDGE STATE

The timeline must represent more than chronological events.

A central Icarus capability is:

**Click any point/event in the timeline and answer: WHO KNEW WHAT AT THIS MOMENT?**

The user should be able to inspect an event or timepoint and see actor-specific knowledge states.

The system must distinguish:

## Event reality

What event is proposed to have happened?

## Actor knowledge

What propositions did each actor know or reportedly know at this moment?

## Knowledge origin

How did the actor obtain that information?

Examples:

- direct observation
- statement from another actor
- dispatch
- 911
- document/record
- inference
- expert interpretation

## Disclosure

What did the actor communicate, when, and to whom?

Knowledge and disclosure are separate.

A person may possess information before communicating it.

## Independent corroboration

When did another actor independently observe or verify the proposition?

## Opportunity

Where supported, distinguish:

`opportunity_to_disclose`

from actual:

`disclosure`

Do not infer motive from non-disclosure.

# KNOWLEDGE-STATE EXAMPLE

The UI should eventually be capable of representing a sequence like:

Patrick reportedly learns:

`children_location = basement`

from Lindsay.

Later Patrick encounters a responder.

At that moment:

Patrick may have:

`children_location = basement`

while Josephine may have:

`children_location = unknown`

The interface should make that asymmetry visible.

Later Patrick states:

`She killed the fucking kids.`

That communication may create several propositions for the responder:

- children harmed/killed — reported by Patrick
- Lindsay actor — reported by Patrick

Those are NOT yet equivalent to direct responder observation.

When the responder subsequently sees Dawson, the responder's state changes for some propositions:

`UNKNOWN → REPORTED → DIRECTLY OBSERVED`

This is the interaction we need the timeline to support.

# KNOWLEDGE-STATE VISUALIZATION

Evaluate an interface where clicking a timeline event/timepoint opens a detail panel showing actor-specific states.

Potential state vocabulary:

- UNKNOWN
- REPORTED
- DIRECTLY OBSERVED
- INFERRED
- CORROBORATED
- DISPUTED

Disclosure may have its own states:

- NOT DISCLOSED
- DISCLOSED TO 911
- DISCLOSED TO RESPONDER
- DISPATCHED/BROADCAST
- RECORDED ELSEWHERE

Do not hard-code these enums without first checking the existing production schema.

Determine what is already modeled and what would require future schema work.

The UI should answer:

**What happened?**

**Who knew what?**

**How did they know?**

**What changed at this moment?**

**What had been communicated?**

**What remained unknown?**

# THREE CLOCKS

Preserve the mockup's three-clock concept.

Distinguish where production data permits:

1. Proceeding/source order
2. Real-world/event time
3. Information/knowledge order

Do not collapse testimony timestamp into real-world event time.

Do not invent precise event timestamps from narrative testimony.

Support uncertainty:

- exact
- approximate
- bounded range
- relative ordering
- unknown

# SEARCH INTEGRATION

The new search backend should become an entry point into the same evidence-navigation system.

Desired flow:

**SEARCH → FIND → HIGHLIGHT → STRUCTURE → CONNECT → COMPARE → RETURN TO SOURCE**

Example:

User searches:

`what did Hall say about the backyard?`

Icarus returns real ranked testimony.

User selects the result.

The canonical source segment opens in Court Record and is highlighted.

From there the user can inspect:

- surrounding testimony
- claims
- actors
- event candidates
- evidence references
- structural relationships

The user can enter graph/lineage views.

Clicking a node can eventually return through:

`Jump to Segment`

to the same canonical testimony.

Search should not be a disconnected generic search page.

Determine whether `/search` should remain a route, become part of Court Record, or both.

Recommend the smallest coherent solution.

# SEARCH IS RETRIEVAL

Maintain the boundary:

**Search retrieves actual testimony.**

Do not silently convert search into an LLM-generated answer.

Examples such as:

`Hall backyard`

`what did Hall say about the backyard?`

`couldnt wake`

`blood sprayed`

should retrieve source testimony.

Reasoning occurs in later structural layers.

# SOURCE INGESTION

The mockup contains an AI Testimony & Deposition Transcript Ingestion interaction.

Do not copy its behavior directly.

Production already has a more rigorous testimony compiler.

The production conceptual flow is:

**SOURCE → PRESERVE → PARSE → CANONICAL SEGMENTS → EXTRACT CANDIDATES → REVIEW → CASE STRUCTURE**

AI extraction should propose structure.

It should not silently promote extracted material into established case reality.

Prefer:

`Review Candidates`

over:

`Commit Events`

when appropriate.

Potential candidate classes include:

- identity
- alias
- claim/assertion
- event
- temporal constraint
- relationship
- evidence reference
- knowledge acquisition
- acquisition target

Determine which production structures currently support these.

# T₀ / CASE FOUNDATION

Icarus should orient the analyst around an initial case baseline.

T₀ should help establish:

- case identity
- known actors/entities
- aliases
- roles
- known sources
- provisional events
- temporal anchors
- relationships
- explicit unknowns
- referenced/missing evidence

T₀ is provisional orientation.

It is not established reality.

New evidence can revise the model.

Inspect the existing production implementation and determine how much of this already exists.

# MISSING EVIDENCE

Pass 3 already contains a Missing Sources concept.

This should eventually become operational.

A missing evidence item may answer:

- what is missing?
- why do we think it may exist?
- which proposition/event could it resolve?
- where did the need originate?
- what testimony references it?
- what source class is expected?
- possible custodian
- acquisition status

Do not invent custodians or acquisition mechanisms.

Only expose information supported by actual data.

# UI PRINCIPLES

Reuse the existing Icarus visual language.

Do not redesign the product from scratch.

Prioritize:

**find → inspect → understand → connect → compare → reconstruct → return to source**

Use progressive disclosure.

The user should be able to begin with a comprehensible event or testimony passage and progressively inspect deeper provenance/lineage.

Graphs must be navigational, not decorative.

Timeline events must be inspectable.

Analytical objects must expose source lineage.

Avoid presenting raw database complexity unless useful.

# PLANNING TASK

Inspect BOTH codebases.

Then produce the following.

## 1. Current production architecture

Map:

- app routes
- case workspace
- current Court Record implementation
- current `/search`
- search RPC integration
- transcript segment rendering
- selected/highlighted segment state
- case state
- existing timeline
- existing entity/person structures
- existing claim/event structures
- current schema relevant to UI

## 2. Mockup architecture

Identify:

- reusable UX concepts
- reusable components
- reusable interaction patterns
- mock/demo-only assumptions
- synthetic IDs
- in-memory state
- fake APIs
- structures that should NOT be copied into production

## 3. Mockup → production mapping

Create a table containing:

- mockup component/concept
- production equivalent
- production data source
- reuse/adapt/rebuild
- blockers
- future work

Pay special attention to:

- Court Record
- TranscriptViewer
- highlightedSegmentId
- Pass 1
- Pass 2
- Pass 3
- BundleLineageVisualizer
- NodeNeighborhoodGraph
- TemporalWitnessTimeline
- Jump to Segment
- Missing Sources

## 4. Canonical navigation identity

Determine exactly which production identifier should connect:

search result
→ Court Record
→ claim
→ event
→ graph node
→ conflict
→ knowledge state
→ timeline
→ source

We want one canonical source-segment identity wherever possible.

Do not create duplicate transcript identities.

## 5. Proposed information architecture

Recommend the top-level Casework navigation.

Explain where these belong:

- Case Foundation / T₀
- Sources
- Court Record
- Search
- Structure
- Reconstruction
- Knowledge State
- Evidence Gaps
- Outputs

Do not overbuild navigation.

## 6. Search UX

Design the production interaction for:

`what did Hall say about the backyard?`

and:

`couldnt wake`

Show:

- query
- result list
- metadata
- context
- selection
- highlight
- structure navigation
- graph navigation
- return-to-source behavior

## 7. Timeline + Knowledge State UX

Design the interaction for:

**click timeline event → inspect who knew what**

Specify:

- timeline layout
- event selection
- actor lanes or actor panel
- proposition state display
- knowledge origin
- disclosure
- corroboration
- uncertainty
- source links
- Jump to Segment

Separate what can be built with existing data from what needs new backend/schema support.

## 8. State/navigation design

Determine how the application should represent:

- active case
- active workspace/view
- search query
- filters
- selected search result
- selected source segment
- highlighted source segment
- selected graph node
- selected timeline event
- selected actor
- return location
- expanded context

Prefer URL-addressable state where appropriate so useful views can be linked/bookmarked.

## 9. Component plan

Identify components to:

- reuse directly
- port/adapt from mockup
- create
- retire

Avoid giant components.

## 10. File-level implementation plan

For every production file expected to change:

- path
- responsibility
- planned modification

For every new file:

- path
- purpose

## 11. Schema/data gap analysis

Do NOT migrate anything.

Report what the desired UI needs that production does not currently model.

Especially inspect support for:

- actor knowledge
- knowledge acquisition
- disclosure
- corroboration
- temporal ranges
- temporal precision
- event-to-source lineage
- missing evidence
- acquisition targets

Classify each as:

- already supported
- derivable from existing data
- UI-only for now
- requires future schema work

## 12. Implementation phases

Propose small build phases.

Prefer something approximately like:

### UI Phase A
Production shell + Court Record + real search integration.

### UI Phase B
Search → canonical segment → highlight/context.

### UI Phase C
Port/adapt Pass 1/2/3 navigation using production data that already exists.

### UI Phase D
Graph → Jump to Segment bidirectional navigation.

### UI Phase E
Timeline reconstruction shell + event selection.

### UI Phase F
Knowledge-state inspector using supported data, with unsupported analytical fields clearly deferred.

### UI Phase G
Missing-source/acquisition-target view.

Change this ordering if repository inspection shows a better dependency order.

## 13. Verification plan

Include:

- component tests
- integration tests
- search tests
- navigation tests
- canonical segment identity
- source highlighting
- graph → segment
- search → segment
- browser history/state
- RLS isolation
- no-result/error/loading states
- TypeScript
- ESLint
- production build

## 14. Explicit non-goals

Do not build yet:

- embeddings
- vector search
- AI-generated case answers
- credibility scoring
- guilt/innocence assessment
- automatic theory winner
- unsupported temporal precision
- automatic promotion of extracted candidates to facts
- speculative missing evidence
- a new duplicate testimony store

# OUTPUT

Return a concrete implementation plan grounded in the actual repositories.

Call out anywhere the mockup and production architecture disagree.

Favor integration over rewrite.

End with:

1. recommended build order;
2. first shippable UI milestone;
3. schema/backend blockers;
4. decisions that genuinely require approval.

DO NOT BUILD ANYTHING IN THIS PASS.