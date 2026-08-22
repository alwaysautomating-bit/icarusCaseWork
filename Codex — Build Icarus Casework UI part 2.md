Proceed with the approved Icarus Casework UI implementation plan.

The production repository remains the source of truth.

The supplied `transcript-multi-pass-intelligence` mockup remains the UX/reference implementation.

Do not copy mock/demo architecture into production when production already has canonical data structures.

# PRIMARY OBJECTIVE

Turn the working Casework backend and searchable testimony corpus into a usable evidence-navigation workspace.

The primary interaction model is:

**SEARCH → SOURCE → STRUCTURE → LINEAGE → REASONING → RECONSTRUCTION → SOURCE**

Navigation must work in both directions.

The user must always be able to return toward underlying evidence.

# BUILD PRIORITY 1 — CASEWORK WORKSPACE

Implement the approved Casework information architecture and workspace shell.

Use the existing Icarus design language.

Do not perform an unrelated visual redesign.

Make the relationship between these concepts understandable:

- Case Foundation / T₀
- Court Record
- Search
- Structure
- Reconstruction
- Evidence Gaps

Pass 1/2/3 belong inside structural analysis rather than representing the entire application lifecycle.

# BUILD PRIORITY 2 — REAL TESTIMONY SEARCH

Integrate the existing production Phase 1 testimony search.

Do not rebuild search.

Use the existing RLS-aware RPC.

Use canonical:

`source_segments.exact_text`

and the production canonical source-segment identifier.

Support real queries including:

`what did Hall say about the backyard?`

`couldnt wake`

The UI should expose useful provenance such as:

- speaker
- proceeding
- timestamp where valid
- locator
- matching passage
- surrounding context
- source link

Do not present generated answers.

Search retrieves source testimony.

# BUILD PRIORITY 3 — SEARCH → COURT RECORD

Selecting a search result must resolve to the canonical Court Record segment.

The selected segment must:

- scroll into view;
- be visibly highlighted;
- expose surrounding transcript context;
- preserve source metadata;
- preserve enough search state to return to results.

Do not create a duplicate transcript representation specifically for search.

# BUILD PRIORITY 4 — BIDIRECTIONAL SOURCE NAVIGATION

Adapt the strongest interaction from the mockup:

`Jump to Segment`

Structural objects that have source lineage should be able to resolve back to canonical production testimony.

Implement the approved path for:

graph/node
→ source segment
→ Court Record
→ highlighted testimony

And preserve:

search
→ source segment
→ structure/graph

Use one canonical source identity.

Remove or isolate synthetic demo segment IDs where the approved plan identified them.

# BUILD PRIORITY 5 — STRUCTURAL VIEWS

Port/adapt the approved portions of:

- Provenance & Structure
- Node Clustering & Lineage
- Structural Reasoning

Use production data.

Do not fabricate production analysis merely to make the mockup look populated.

Where backend support does not yet exist:

- render an intentional empty/not-yet-derived state;
- or retain clearly labeled demo-only development fixtures if the approved plan explicitly permits it.

Never present fixture analysis as real case analysis.

Graphs must be interactive/navigation tools.

# BUILD PRIORITY 6 — RECONSTRUCTION TIMELINE

Implement the approved reconstruction/timeline shell.

Timeline events must be selectable.

Do not force exact timestamps when evidence only supports:

- approximate time
- time range
- relative order
- unknown time

Preserve the distinction between:

1. proceeding/source order;
2. real-world/event time;
3. information/knowledge order.

Do not treat transcript timestamp as event time.

# BUILD PRIORITY 7 — WHO KNEW WHAT?

Implement the approved first version of the **Knowledge State Inspector**.

The key interaction is:

**click event/timepoint → inspect actor-specific information state**

The panel should be designed to answer:

### What happened?
Selected event/event candidate.

### Who knew what?
Actor-specific propositions at that point.

### How did they know?
Knowledge origin where supported.

### What changed here?
Knowledge-state transitions associated with the event.

### What was communicated?
Disclosure events where supported.

### What remained unknown?
Explicitly represented where the data supports it.

Potential visual concepts include actor lanes or actor cards.

Do NOT manufacture knowledge states from prose simply to populate the UI.

If production currently lacks the required structured records, implement the UI/data contract boundary established in the approved plan and clearly expose the unsupported state.

The UI must be ready for later states conceptually equivalent to:

`UNKNOWN → REPORTED → DIRECTLY OBSERVED → CORROBORATED`

without prematurely hard-coding unsupported doctrine into the database.

Knowledge and disclosure must remain separate concepts.

Do not infer intent from non-disclosure.

# BUILD PRIORITY 8 — SOURCE LINEAGE FROM KNOWLEDGE STATE

Where data exists, a knowledge proposition or transition must be navigable toward its source.

Desired path:

knowledge state
→ proposition/claim
→ source segment
→ Court Record
→ highlighted testimony

The analyst must be able to answer:

**Why does Icarus say this person knew this?**

and inspect the evidence.

# BUILD PRIORITY 9 — MISSING EVIDENCE

Implement the approved Missing Sources / Evidence Gaps view using production-supported data.

Where available, expose:

- missing/referenced source
- originating testimony/claim
- related event/question
- acquisition status
- source lineage

Do not invent:

- custodians
- retention periods
- acquisition mechanisms
- source existence

Distinguish:

`potentially obtainable`

from:

`known to exist`

when the data model supports that distinction.

# PRODUCT SAFETY / EPISTEMIC RULES

Do not add:

- credibility scores
- witness truthfulness ratings
- guilt probability
- theory winner
- unsupported causal inference
- invented timestamps
- automatic fact promotion

AI/automation may propose candidates.

Candidate status must remain visible until review establishes something stronger.

# NAVIGATION REQUIREMENT

The application must never trap the analyst at a conclusion.

Where lineage exists, support movement toward:

**analysis → derivation → claim → source segment → original source**

Preserve useful return state so the analyst can move back outward again.

# IMPLEMENTATION DISCIPLINE

Build incrementally according to the approved plan.

After each meaningful phase:

1. run relevant tests;
2. run TypeScript;
3. run ESLint;
4. verify affected browser behavior;
5. verify production build at appropriate checkpoints.

Do not continue through unexplained failures.

Do not introduce migrations unless the approved plan explicitly identified and justified them.

If a required UI capability lacks backend/schema support, do not improvise a hidden schema change.

Implement the safe boundary, document the blocker, and continue with independent work.

# REQUIRED END-TO-END DEMO 1

Verify:

1. Open Casework.
2. Search:

   `what did Hall say about the backyard?`

3. Real testimony results appear.
4. Select relevant Hall passage.
5. Canonical Court Record opens.
6. Correct segment is highlighted.
7. Surrounding testimony can be inspected.
8. Enter available structure/lineage.
9. Select a source-linked object.
10. Use `Jump to Segment`.
11. Return to the correct testimony.
12. Search state remains recoverable.

# REQUIRED END-TO-END DEMO 2

Verify:

`couldnt wake`

uses the existing trigram/fuzzy retrieval path and reaches the appropriate source segment.

# REQUIRED TIMELINE DEMO

Using only supported data/fixtures approved for development:

1. Open Reconstruction.
2. Select a timeline event.
3. Knowledge State Inspector opens.
4. Actor-specific information is displayed.
5. Knowledge origin is shown where available.
6. Disclosure is separately represented where available.
7. Source-backed propositions expose source navigation.
8. `Jump to Segment` returns to testimony.

Do not claim unsupported knowledge states are real case findings.

# TESTING

At minimum verify:

- lexical search
- natural-question search
- fuzzy/trigram search
- speaker/proceeding filters if implemented
- search → source
- correct canonical segment ID
- transcript highlighting
- context expansion
- structure → source
- graph → source
- browser/back navigation
- selected timeline event
- Knowledge State Inspector states
- source-backed knowledge → source
- empty structural state
- empty knowledge state
- no search results
- RPC error
- loading states
- RLS/cross-case isolation
- existing production tests
- TypeScript
- ESLint
- production build

# COMPLETION REPORT

When finished, report:

## Built
What now works from the user's perspective.

## Demo
Give exact click-through instructions for the three required demos.

## Mockup → Production
Explain which mockup concepts were successfully adapted.

## Files Changed
List paths and purpose.

## Data Contracts
Describe the canonical IDs and UI contracts used.

## Schema Changes
Explicitly state whether any migrations occurred.

## Verification
Report exact test/build/security results.

## Real vs Scaffolded
Clearly identify:
- production-backed UI;
- scaffolded UI awaiting structured data;
- development fixtures, if any.

## Deferred
List work intentionally deferred, including:
- embeddings/hybrid retrieval;
- generated case answers;
- automated knowledge extraction if unsupported;
- deeper reconstruction reasoning;
- acquisition automation.

## Remaining Blockers
Report any missing schema/backend capability required for the next phase.

Do not hide incomplete wiring or substitute mock data for missing production functionality.