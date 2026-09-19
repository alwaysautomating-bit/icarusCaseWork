# Super-Simple Core Timeline Plan

Date: 2026-09-14  
Status: Approved direction; implementation not started  
Working name: **Knowns First Timeline**

## Outcome

Build one dependable case timeline that helps the researcher stop repeatedly hunting for information already encountered and start positioning less-certain events around dependable anchors.

This is a working research instrument, not a peer-reviewed study, judicial finding, or automated truth engine.

The first useful version must let the researcher:

1. See confirmed, source-linked anchors in chronological order.
2. Add an anchor quickly from an existing packet page or other Source Segment.
3. Add a visibly separate placement note when the source is not yet at hand.
4. Position an uncertain event before, after, between, or near known anchors without inventing a timestamp.
5. Open the supporting source directly from the timeline card.
6. Search the timeline instead of reopening the entire packet or transcript.

## Product rule

> A known is something the researcher has deliberately confirmed for use as a working anchor, with a source link and its limitations preserved.

“Known” is a UI label. It is not a new Icarus ontology object and does not mean proven, uncontested, admissible, or independently corroborated.

Under the current warrant-workspace rule, every warrant entered into this timeline is treated as executed. The timeline does not repeatedly ask whether execution occurred. It records the available execution time, place, scope, items seized, return, and source. Directly conflicting material is flagged as an exception.

## Hard MVP boundary

### Build now

- One top-level **Timeline** page for a case.
- One default timeline named **Core timeline**.
- Three visible item states: **Known anchor**, **Working event**, and **Needs source**.
- Exact, approximate, interval, relative-only, sequence-only, and unknown time.
- Collapsed cards by default.
- Quick entry and source linking.
- Direct links to packet pages, testimony segments, and existing digital artifacts.
- Search and three simple filters: **All**, **Knowns**, and **Needs placement**.
- An unplaced section for events that cannot yet be ordered.
- A far-right source/context panel using the existing Icarus card style.
- Self-confirmation by an authorized case owner or reviewer; no second reviewer is required.

### Do not build yet

- Credibility scores or evidence-weight scores.
- Automated guilt, diagnosis, admissibility, authenticity, or legal-sufficiency conclusions.
- Causal graphs.
- Drag-and-drop timeline editing.
- Complex zoomable charts.
- A second timeline ontology.
- Automatic reconciliation of conflicting sources.
- Automatic promotion of LlamaParse or chronology output into knowns.
- Publication-quality reports.
- Collaboration queues or peer-review assignment.

## The three item states

### 1. Known anchor

A source-linked, researcher-confirmed Reviewed Event used as a stable working reference.

Minimum display:

- time or time range;
- neutral headline;
- precision label;
- one source label;
- anchor status; and
- expand control.

Expanded content:

- exact source wording or quotation;
- Source Artifact and Source Segment locator;
- attribution and information basis;
- uncertainty or scope note;
- other temporal assertions, if any; and
- “Open source page” action.

### 2. Working event

A source-linked event that belongs in the working chronology but has uncertain placement, competing times, or unresolved wording. It can appear relative to anchors without being promoted to a known anchor.

Examples:

- “Shortly after Patrick entered the house.”
- “Before the radio relay.”
- “Between the CVS departure and the ThreeV arrival.”

### 3. Needs source

A private placement note recording something the researcher remembers or wants to locate. It must be visually distinct and must not masquerade as evidence.

It may contain:

- a short description;
- a rough time or relative position;
- a source hint such as “warrant packet” or “Cahill testimony”; and
- an optional relationship to an existing anchor.

It does not become a Claim, Proposition, Reviewed Event, report statement, or reusable known until an actual Source Segment is linked and the researcher confirms the conversion.

## Page structure

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Timeline · January 24 / Warrants and evidence acquisition           │
│ Search…                   [All] [Knowns] [Needs placement] [+ Add]   │
├───────────────────────────────────────────────┬──────────────────────┤
│                                               │ Timeline basis       │
│  03:00   ● Known anchor                       │ Current source set   │
│          Warrant issued                       │ Evidence packet.pdf  │
│          [collapsed details]                  │ Testimony sources    │
│                                               │ Digital artifacts    │
│  04:00   ● Known anchor                       ├──────────────────────┤
│          Residence warrant executed           │ Needs source · 3     │
│                                               │ Unplaced · 2         │
│  AFTER   ◌ Working event                      │ Conflicts · 0        │
│          Tablet located on kitchen counter    │                      │
│                                               │ Open Evidence →      │
├───────────────────────────────────────────────┴──────────────────────┤
│ Unplaced / unknown time                                              │
└──────────────────────────────────────────────────────────────────────┘
```

### Interaction rules

- Cards are collapsed by default and expand in place.
- The whole summary row is keyboard- and pointer-activatable.
- Do not rely on color alone: every state has a text label and distinct marker.
- Keep body text at least 16px where practical and controls at least 44px on touch layouts.
- On narrow screens, move the right panel below the timeline; do not create horizontal scrolling.
- Keep the page a Server Component by default. Use client components only for interactions that require them.
- Use `loading.tsx` for route-level loading feedback.
- Preserve the existing Icarus paper/card visual language, burgundy anchor color, green confirmed state, and monospaced time/identifier labels.

## Quick-add workflow

The **Add timeline item** sheet asks only:

1. **What happened?** — neutral headline.
2. **When?** — exact, approximate, range, before/after/between, or unknown.
3. **Where did this come from?** — choose a packet page/document, testimony segment, digital artifact, or **I need to locate the source**.
4. **Optional note** — wording, limitation, or source reminder.

Behavior:

- With a Source Segment: save as a source-linked Working Event, then offer **Confirm as known anchor** to an owner or reviewer.
- Without a Source Segment: save only as Needs Source.
- Never turn page order, transcript timestamp, document creation time, or parser time into event time.
- Never require the user to enter a confidence percentage.
- A relative event can be placed before/after/between anchors without receiving an invented clock time.

## Ontology and storage plan

### Reuse existing canonical objects

- **Source Artifact** and **Source Segment** for exact source access.
- **Claim** for the attributed source assertion.
- **Proposition** for normalized wording when required.
- **Reviewed Event** for a confirmed timeline anchor.
- **Temporal Assertion** for exact, approximate, ranged, relative, or competing time.
- **Review Decision** for researcher confirmation and amendments.
- **case_ledger.logical_order** for Clock 1.
- **provenance_activities** and **provenance_relations** for generation and review history.
- Existing Event Candidates for less-settled testimony-derived events when available.

Do not create a `knowns` table.

### Add one explicitly non-evidentiary working table

Add a small `timeline_placement_notes` table only for unsourced reminders:

```text
id
case_id
description
temporal_hint_json
source_hint
relative_to_event_id nullable
relative_relation nullable
status: needs_source | converted | dismissed
linked_event_id nullable
created_by_user_id
created_at
updated_at
```

Rules:

- RLS is case-membership scoped.
- Placement notes never appear in evidence exports or reports.
- They never count as Claims, corroboration, or known anchors.
- Conversion links the note to newly created governed objects; it does not rewrite the note as evidence.
- Dismissal is recoverable/auditable rather than a destructive delete.

### Minimal governed write path

Create one atomic server-side command for a source-linked event:

```text
source segment
  -> Claim
  -> Proposition when needed
  -> Temporal Assertion
  -> researcher confirmation
  -> Reviewed Event
  -> case-ledger entries + PROV review activity
```

The database allocates Clock 1. The browser never supplies `logical_order`, reviewer identity, or server timestamps.

## Three clocks and lamppost

The UI primarily displays Clock 2 while preserving access to all three:

- **Clock 1 — case/knowledge time:** when the item entered or changed in Icarus. Visible in expanded history, not used to order the real-world timeline.
- **Clock 2 — IRL/event time:** the asserted real-world time or relative placement. This orders the main timeline.
- **Clock 3 — provenance/information time:** who observed, reported, recorded, parsed, or reviewed the information. Visible in expanded source details.
- **Lamppost:** stable UUID/object code plus exact Source Locator and ledger history. Every known anchor and relationship can be reopened and traced.

## Ordering behavior

Use the smallest useful ordering model:

1. Exact timestamps sort normally.
2. Approximate times display their qualifier and sort by their stored point/range without losing the qualifier.
3. Intervals display as spans.
4. Relative-only events attach before, after, or between known anchors.
5. Incomparable events may share a band or remain unplaced.
6. Unknown-time events remain in **Unplaced**.
7. A topological ordering is presentation only; it does not convert partial order into proven total order.

No manual drag ordering in the MVP. Placement changes through explicit time or relationship fields.

## Packet-to-timeline connection

### First usable pass: manual

From a confirmed packet document or page, add:

- **Add to timeline**
- prefill the packet/document/page Source Segment;
- let the researcher enter or confirm the event wording and time; and
- return to the timeline with the new Working Event highlighted.

This should work before any automatic chronology generation.

### Second pass: assisted

After the manual workflow is proven, add **Propose timeline events** to the confirmed packet view.

That action:

1. Runs the Icarus `collapse-chronology` contract only over selected confirmed document ranges.
2. Creates a versioned chronology candidate bundle.
3. Produces Claims, Event Candidates, Temporal Assertions, ordering relationships, and proposed flags with exact page lineage.
4. Shows candidates in the same timeline UI as Working Events.
5. Requires individual or bounded batch confirmation before any event becomes a Known Anchor.

LlamaParse remains responsible for OCR/layout and document-boundary proposals. Chronology extraction remains a separate PROV activity.

## Build sequence

### Slice 1 — Read-only core timeline

- Add `timelineHref(caseId)` and a **Timeline** item to case navigation.
- Add `/cases/[caseId]/timeline/page.tsx` and `loading.tsx`.
- Project existing Reviewed Events, Event Candidates, and Temporal Assertions into one ordered view.
- Add collapsed cards, source links, filters, right panel, and Unplaced section.

**Done when:** a case with existing events renders a readable timeline; uncertain and unknown events remain visibly qualified; every displayed source link resolves.

### Slice 2 — Quick add and self-confirmation

- Add the four-field quick-add sheet.
- Add source picker for court-packet pages/documents and testimony segments.
- Implement the atomic source-linked event command.
- Add **Confirm as known anchor**, amend, and defer actions.
- Add `timeline_placement_notes` for source-not-yet-found reminders.

**Done when:** the researcher can add one sourced anchor and one Needs Source note in under a minute, reload the page, and see both in the correct visual states.

### Slice 3 — Packet entry point

- Add **Add to timeline** beside confirmed packet documents/pages.
- Carry exact Source Artifact, Source Segment, and page locator into quick add.
- Show the original evidence packet in the timeline right panel.

**Done when:** a warrant-packet page can create a Working Event and reopen at the exact supporting page from the resulting card.

### Slice 4 — Chronology-assisted proposals

- Add a versioned chronology-run adapter for confirmed packet ranges.
- Apply the project `collapse-chronology` skill contract.
- Validate candidate references and PROV before persistence.
- Present generated candidates without automatic promotion.

**Done when:** selected packet pages produce reviewable events with all three clocks separable, exact page provenance, partial order preserved, and zero automatic knowns.

### Slice 5 — Use it on the real packet

Start with the warrant/evidence-acquisition chronology:

- warrant issued at approximately 03:00 on January 25;
- residence warrant executed at approximately 04:00;
- items located and secured, each as separate events where supported;
- later device, trace-evidence, arrest-warrant, and return activity as independently sourced events; and
- any relative-only sequence retained without back-calculated timestamps.

Do not treat affidavit allegations about the January 24 incident as known incident events merely because the affidavit repeats them. They remain attributed Claims until separately confirmed for the incident timeline.

**Done when:** the researcher can use the page for a real session, find an anchor without reopening the packet, and place at least one less-certain event relative to it.

## Likely implementation files

```text
src/app/cases/[caseId]/timeline/page.tsx
src/app/cases/[caseId]/timeline/loading.tsx
src/app/cases/[caseId]/timeline/actions.ts
src/app/cases/[caseId]/timeline/_components/core-timeline.tsx
src/app/cases/[caseId]/timeline/_components/timeline-card.tsx
src/app/cases/[caseId]/timeline/_components/quick-add-form.tsx
src/lib/core-timeline.ts
src/lib/core-timeline.test.ts
src/lib/case-routes.ts
src/lib/case-navigation.ts
supabase/migrations/<timestamp>_core_timeline_mvp.sql
src/db/core-timeline-persistence.test.ts
```

Reuse existing case-workspace CSS tokens and card grammar. Do not introduce a new design system.

## Verification

### Data and authority

- RLS prevents cross-case reads and writes.
- Viewer cannot add, confirm, amend, or dismiss.
- Researcher identity and timestamps come from authenticated/server state.
- Clock 1 values are database allocated and contiguous under concurrent writes.
- Induced failure rolls back the entire source-linked event command.
- Replaying the same source/event submission does not create duplicate anchors.

### Epistemic behavior

- A packet page number never becomes event time.
- A transcript timestamp never becomes event time.
- Approximate and relative language remains visible.
- Competing Temporal Assertions can coexist.
- A Needs Source note cannot appear as a Known Anchor or in reports.
- Researcher confirmation does not create a Verification Assessment unless the user explicitly performs that separate action.
- The executed-warrant scope assumption suppresses the generic execution question but does not invent execution details.

### UI behavior

- Cards start collapsed and expand with keyboard or pointer.
- Focus remains visible.
- State is communicated by text and marker, not color alone.
- Search and filters preserve deep-linkable query state.
- Mobile layout reflows without horizontal scrolling.
- Loading and mutation feedback are visible.
- Exact source links open the expected packet page or testimony segment.

### Final smoke test

1. Open the case Timeline.
2. Add a packet-sourced warrant event.
3. Confirm it as a Known Anchor.
4. Add an approximate or relative Working Event.
5. Add a Needs Source note.
6. Reload and filter each state.
7. Open the packet page from the anchor.
8. Amend the time qualification and confirm history remains visible.

## Stop condition

The MVP is complete when the researcher can stop reopening the same packet merely to remember established anchor information and can place uncertain events around those anchors without losing source attribution or inventing precision.

Do not continue into advanced reconciliation, causal analysis, scoring, or publication until the real warrant packet has been used successfully in this workflow and the researcher identifies the next concrete friction point.
