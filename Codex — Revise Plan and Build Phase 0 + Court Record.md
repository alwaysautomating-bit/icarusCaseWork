Update the approved Icarus Casework UI plan with this product decision, then proceed with implementation.

Do not restart architecture discovery from scratch. Use the prior repository inspection and plan as the baseline.

The key revision is:

**Case Setup is now Phase 0, and Foundation is its persistent operating UI.**

Phase 0 is not a one-time wizard. It is a resumable case-setup and normalization workspace that remains available throughout the life of the case.

The product lifecycle is now:

**ESTABLISH CASE → COURT RECORD → STRUCTURE → RECONCILE → REASON → RECONSTRUCT → ACTOR KNOWLEDGE → GAPS/ACQUISITION → REVISE**

The immediate goal is to build the first usable vertical slice:

**Open case → inspect setup/readiness → enter Court Record → search real testimony → open canonical source segment → inspect provenance/context**

Do not attempt to finish the entire lifecycle in this implementation pass.

# PHASE 0 — ESTABLISH CASE

Add:

`/cases/new`

`/cases/[caseId]/setup`

The setup workspace becomes the production **Foundation** area.

It should be resumable and case-scoped.

Use existing production tables wherever possible.

Do not create parallel setup-only copies of canonical records.

The setup contract should work with existing production concepts including:

- cases
- case membership
- sources
- source artifacts
- source segments
- proceedings
- proceeding speakers
- entities
- aliases
- claims/propositions
- events/event candidates
- temporal assertions/bands
- relationships
- acquisition records
- knowledge flags
- provenance
- review state

Audit actual schema names before making assumptions.

# FOUNDATION UI

Build the Foundation workspace around these sections.

## 1. Case Definition

Show/edit supported fields for:

- case title
- internal identifier
- purpose/scope
- jurisdiction
- timezone
- T0/incident boundary where supported
- evidentiary cutoff where supported
- case membership/roles where current permissions allow
- controlled vocabulary/version if already modeled

Do not invent unsupported fields merely to fill the design.

Clearly identify fields that require later schema work.

## 2. Source Inventory

Show real case source information:

- source family
- artifact
- file/source metadata
- hash where available
- proceeding assignment
- coverage
- ingestion status
- segmentation status
- duplicate/superseded state where supported
- source accessibility

Every source should remain navigable toward canonical artifacts/segments where possible.

## 3. Proceedings and Speakers

Show:

- proceeding/day
- source order
- canonical speakers
- unresolved speakers
- entity mapping
- locator conventions where available

Do not auto-resolve ambiguous speakers.

## 4. Entities and Aliases

Show the canonical entity registry and alias relationships.

Preserve the rule:

**Database UUID = authoritative identity**

Human-readable IDs/codes are presentation affordances only.

Audit existing display-code support before creating schema.

Do not silently merge:

`Patrick Clancy`

`Pat Clancy`

`Patrick`

`husband`

Instead expose potential resolution/alias relationships and existing review state.

## 5. Event and Temporal Skeleton

Use production-supported events/event candidates and temporal assertions.

This is a provisional case spine, not an established factual timeline.

Preserve competing temporal assertions separately.

Do not collapse:

`6:09`

`18:09`

`around 6:10`

`shortly after six`

into one timestamp unless a reviewed reconciliation already exists.

Display:

- event/event candidate
- supporting source segment(s)
- participants where supported
- temporal assertion
- precision/range
- review state
- conflicts/alternatives where supported

## 6. Readiness and Unresolved Issues

Create a deterministic readiness summary.

Do not use AI for readiness.

The readiness system must distinguish:

### BLOCK

Examples, only when detectable from current production data:

- no usable case scope/identity
- inaccessible case/source under RLS
- broken canonical source linkage
- source segments not linked to a case/source
- failed/incomplete ingestion that prevents corpus use
- identity collision that would attach evidence to the wrong canonical entity
- missing timezone where an exact local-time operation explicitly requires one

### WARN

Examples:

- unresolved speakers
- unresolved mentions
- conflicting temporal assertions
- unreviewed event candidates
- missing evidence
- unresolved relationships
- incomplete normalization
- coverage gaps

Warnings do not prevent entry into analysis.

Do not create a simplistic percentage-complete meter.

Prefer a readiness summary by dimension, conceptually:

- Sources: PASS/WARN/BLOCK
- Identity: PASS/WARN/BLOCK
- Provenance: PASS/WARN/BLOCK
- Temporal: PASS/WARN/BLOCK
- Access: PASS/WARN/BLOCK
- Proceedings: PASS/WARN/BLOCK

Then derive an overall result such as:

`ANALYSIS READY`

or

`ANALYSIS READY — WARNINGS`

Do not add database enums until existing status conventions are audited.

# READY FOR ANALYSIS

“Ready” means the case can be worked safely.

It does NOT mean:

- every entity is resolved
- every event is known
- every timeline conflict is solved
- every source has been acquired
- every claim has been reviewed

Normal uncertainty must remain visible.

# T0

Treat T0 as a product of Foundation, not as the entire Foundation workspace.

For this pass, use existing data to expose a provisional baseline/orientation view if possible.

Do not invent a versioned T0 schema unless the prior schema audit shows it is necessary for the first vertical slice.

If durable T0 versioning requires new schema, document it as deferred work.

# CASE ROUTING

Implement explicit case-scoped routes.

At minimum:

`/cases/[caseId]/setup`

`/cases/[caseId]/record`

The active case must be part of the URL.

Remove the current ambiguity where the app silently chooses the first accessible case.

The application landing page may route to case selection/recent cases as appropriate.

# COURT RECORD

After minimum readiness is satisfied, Foundation should expose:

**Enter Court Record**

Build the real Court Record using production data.

Use the existing Phase 1 testimony search backend.

Do not rebuild search infrastructure.

Search should be integrated into the Court Record.

Retain `/search` only if useful as a secondary/global landing page, but use shared search components/data loading.

# SEARCH UX

Support real queries such as:

`what did Hall say about the backyard?`

`couldnt wake`

Results must use the existing RLS-aware search RPC.

Show useful production metadata:

- speaker
- proceeding
- timestamp where valid
- locator
- matching text
- surrounding context
- retrieval/match information where useful
- source/provenance link

Search remains retrieval.

Do not add AI-generated answers.

# CANONICAL SOURCE NAVIGATION

Use production:

`source_segments.id`

as the canonical source-text address.

The selected segment should be represented in the URL, for example:

`/cases/[caseId]/record?q=...&segment=<uuid>`

Selecting a search result must:

1. resolve to the canonical `source_segments.id`;
2. open the Court Record;
3. load the needed transcript window;
4. scroll the selected segment into view;
5. visibly highlight it;
6. show surrounding context;
7. preserve the query/filter state;
8. support browser Back/Forward.

Do not load the entire 25k+ segment corpus into the client.

Use windowed/paginated reads.

# SOURCE INSPECTOR

Build a right-side inspector or equivalent using the approved interaction model.

For the selected segment, show supported information such as:

- source metadata
- proceeding
- speaker
- locator
- provenance
- surrounding context
- linked structured objects where production data already exists

Use honest empty states when no claims/events/knowledge are mapped yet.

Do not populate advanced structural analysis with fixtures unless visibly labeled as development-only.

# MOCKUP REFERENCE

Continue treating `transcript-multi-pass-intelligence` as the UX reference only.

Adapt:

- split-pane Court Record
- selected/highlighted segment interaction
- inspector pattern
- source-return navigation
- progressive disclosure

Do not port:

- synthetic IDs
- hard-coded Clancy evidence
- Gemini analysis
- browser transcript parsing
- fabricated reviewed state
- inferred clock values
- demo Copilot answers

# KNOWLEDGE-STATE FUTURE SEAM

Do NOT implement actor-knowledge schema in this pass.

However, when designing the later Reconstruction route/components, preserve the approved interaction requirement:

**click event/timepoint → inspect who knew what at that moment**

The future UI must be able to distinguish:

- event reality
- actor knowledge
- knowledge origin
- disclosure
- independent corroboration
- opportunity to know/disclose

Do not infer these from prose during this phase.

Document the data contract/schema gap needed to support them later.

# CSV / STRUCTURED IMPORT

Do not build the full importer unless it already exists and is trivial to expose.

But preserve this future contract:

**IMPORT → MAP → VALIDATE → PREVIEW → COLLISION CHECK → CANDIDATE/REVIEW STATE → AUDIT**

Do not silently merge entities or conflicting temporal assertions.

Document which existing compiler/import structures can support this later.

# AGENT INTEROPERABILITY

Do not build the full agent layer in this pass.

But audit what is required for a future database-generated Case Context Pack containing:

- case scope
- canonical entities/aliases
- source inventory
- proceedings/speakers
- stable UUIDs
- vocabulary
- event candidates
- temporal assertions
- review states
- provenance rules
- unresolved setup warnings

Agents must eventually consume canonical case context rather than maintain private schemas.

Document blockers only.

# SCHEMA DISCIPLINE

Before creating any migration:

1. inspect the existing schema;
2. determine whether current tables/columns already support the requirement;
3. reuse existing structures when possible.

For this implementation, prefer **no new schema** unless a small addition is genuinely required for the Phase 0 readiness/setup contract.

If migrations are required:

- use versioned Supabase migrations;
- preserve RLS through case membership;
- follow existing security patterns;
- document exactly why each addition was necessary.

Do not add speculative future-analysis tables.

# BUILD ORDER

Implement in this order:

## A. Explicit Case Shell
- case-scoped routing
- case selection
- remove first-accessible-case ambiguity

## B. Foundation / Phase 0
- Case Definition
- Source Inventory
- Proceedings/Speakers
- Entities/Aliases
- Event/Temporal Skeleton
- Readiness summary

## C. Court Record Shell
- real case-scoped transcript reader
- windowed source-segment loading
- canonical segment URL state

## D. Integrated Search
- use existing RPC
- search/results inside Court Record
- query/filter URL state

## E. Search → Source Navigation
- select result
- load exact segment
- highlight
- context
- provenance inspector
- Back/Forward restoration

Stop after this vertical slice unless the approved plan identifies a small independent extension that is safe to complete.

Do not start graph, full Structure, Reconstruction, actor knowledge, or acquisition UI merely because time remains.

# REQUIRED DEMO

The completed implementation must support:

## Demo 1

1. Open an existing case.
2. Open Foundation.
3. See current readiness and unresolved setup items.
4. Enter Court Record.
5. Search:

`what did Hall say about the backyard?`

6. Select a real result.
7. Open the canonical transcript segment.
8. Highlight it.
9. Inspect surrounding testimony.
10. Inspect source/provenance information.
11. Copy/bookmark the URL.
12. Reload/directly open it and return to the same segment.

## Demo 2

Search:

`couldnt wake`

Verify the existing trigram/fuzzy path returns a useful result and that it navigates to the canonical source segment.

## Demo 3

Verify RLS:

- permitted user can open the case/search/source segment;
- another user without case access cannot retrieve that case or its source content.

# VERIFICATION

Run and report:

- existing automated test suite
- new Foundation tests
- readiness tests
- case-route authorization tests
- Court Record tests
- search integration tests
- canonical segment navigation tests
- browser history/state tests
- direct bookmarked URL tests
- no-result state
- loading state
- database error state
- forbidden case state
- TypeScript
- ESLint
- production build
- Supabase security/performance checks where applicable

Confirm the Court Record does not fetch the full corpus client-side.

# COMPLETION REPORT

Return:

## Built
What a user can now do.

## Phase 0
What Foundation/setup functionality is production-backed.

## Readiness
Checks implemented and how BLOCK/WARN/PASS are derived.

## Court Record
How canonical segment navigation works.

## Search
How existing lexical/trigram search was integrated.

## Demo
Exact click-through for the required demos.

## Files Changed
Path + purpose.

## Schema Changes
List every migration, or explicitly state none.

## Real vs Deferred
Separate:
- working production functionality
- UI scaffolding
- future schema/backend needs

## Future Contract
Summarize deferred requirements for:
- versioned T0
- structured import
- Case Context Pack
- actor knowledge/disclosure
- graph/lineage
- reconstruction
- gaps/acquisition

## Verification
Exact results.

## Remaining Issues
Do not hide incomplete wiring or unsupported data.

The first release is successful when:

**A user can establish enough shared case context to know the case is safe to work, enter the real Court Record, search real testimony, and reliably navigate every result back to canonical evidence.**