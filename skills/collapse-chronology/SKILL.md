---
name: collapse-chronology
description: Convert Icarus source material into a provenance-preserving, partially ordered chronology of claims, event candidates, temporal assertions, information flow, state transitions, and supersession. Use when chronology or current case state is load-bearing; do not use for raw document parsing, broad operational handoffs, or automatic fact verification.
metadata:
  domain: legal-evidence-provenance
  risk-level: high-integrity
  project: Icarus Casework
  adapted-from: PORK collapse-chronology
  version: 1.0.0
---

# Collapse Chronology for Icarus Casework

Produce an inspectable chronology projection over the Icarus evidence substrate. Do not produce a conversational summary, a falsely complete timeline, or a parallel fact ontology.

Before generating an Icarus chronology bundle or proposing persistence, read [references/icarus-chronology-contract.md](references/icarus-chronology-contract.md). It defines the canonical object mapping, three clocks, lamppost, PROV relations, and candidate output contract.

## Routing boundary

- For an unparsed packet, scan, transcript, or other raw artifact, complete the appropriate intake and parsing workflow first. LlamaParse establishes page content and proposed document boundaries; it does not establish chronology or truth.
- For a broad operational handoff where event order is secondary, use `thread-collapse-handoff`.
- Use this skill when event order, temporal uncertainty, information flow, state change, correction, or supersession materially affects the result.
- If sources cannot support one total event order, preserve a partial order. Do not force incomparable events into a single sequence.

## Icarus authority boundary

Treat `ONTOLOGY.md`, current versioned migrations, and implemented data contracts as authoritative. This skill proposes Icarus objects; it does not rename them or create substitutes.

Use these distinctions exactly:

- A **Source Artifact** is the immutable captured representation.
- A **Source** is the evidentiary origin or origin system.
- A **Source Segment** is the stable citation target.
- A **Claim** is an attributed assertion, not a fact or event.
- A **Proposition** is the normalized state of affairs that Claims concern; it has no automatic truth status.
- An **Event Candidate** is an extracted possible occurrence awaiting review.
- A **Reviewed Event** is admitted to an operational reconstruction by an explicit human review decision and remains epistemically qualified.
- A **Verification Assessment** records a human evaluation of support for a Proposition. Extraction confidence, repetition, or review acceptance alone never supplies verification.
- A **Projection** is a reproducible view that cannot overwrite its evidence inputs.

“Known” may be used as a product label for convenient, reusable anchors. It is not a new ontology type. Represent an accepted known with existing reviewed objects, normally a Claim linked to a Proposition and Verification Assessment, a Reviewed Event, or both.

## Establish the chronology scope

Record:

- case and chronology subject;
- real-world time boundary;
- included Source Artifacts, Sources, and Source Segments;
- relevant Evidence Lanes;
- requested detail level;
- explicit inclusion assumptions supplied by the user; and
- known gaps or excluded material.

Honor explicit scope rules without silently promoting them into evidentiary conclusions. For example, a workspace may define that every warrant entered is executed. Use that as an inclusion/default rule, omit execution as a generic open question, and flag only source material that directly contradicts it. Still preserve the source and precision for execution time, place, scope, seizure, and return.

## Prepare source material

1. Preserve original artifact order and wording.
2. Require stable Source Segment IDs and typed Source Locators before material extraction. If linkage is incomplete, retain `source_linkage_incomplete`; never invent an ID or locator.
3. For court packets, operate on confirmed document boundaries when available. Boundary acceptance confirms page grouping only; it does not verify the document's assertions.
4. For long material, process bounded overlapping units. Maintain a continuation register containing active entities, unresolved references, last processed Source Segment, boundary events, current supported states, competing assertions, and incomplete linkages.
5. Treat repeated pages, affidavits, quotations, or downstream retellings as possible shared lineage. Repetition is not independent corroboration.

## Extract atomic candidates

Create separate candidates for materially distinct:

- occurrences and observations;
- communications and information acquisition;
- decisions, instructions, actions, and rulings;
- state changes;
- corrections, withdrawals, and supersession; and
- assertions about any of the above.

Do not merge an occurrence with a later assertion describing it. Do not split a continuous occurrence unless actor, action, object, status, or temporal basis materially changes.

For testimony and legal material:

- preserve asserted speaker, capacity, proceeding, examination phase, and exact locator when available;
- never treat an attorney's question as testimony unless the witness adopts it;
- keep testimony, expert opinion, party argument, investigator characterization, primary records, and analytical inference distinct;
- use the implemented `information_basis`, `provenance_type`, `assertion_status`, temporal precision, qualification, and review vocabularies;
- keep extraction confidence separate from evidentiary support and review status; and
- retain unknown values as unknown.

## Apply the three clocks

Never collapse the three clocks.

### Clock 1 — case / knowledge time

Clock 1 is the append-oriented `case_ledger.logical_order`: when an object or consequential change entered the Icarus record.

- Preserve existing logical order when supplied.
- Never infer logical order from source order or event time.
- Never assign a persisted logical order in generated output. The governed database write allocates it.
- Record source order separately as extraction context when useful.
- Later knowledge must not leak into an earlier evidence snapshot.

### Clock 2 — IRL / event time

Clock 2 is represented by one or more **Temporal Assertions** about when an underlying event occurred.

- Preserve exact timestamp, exact date, exact time, approximate time, interval, bounded interval, relative-only order, sequence-only order, or unknown.
- Preserve the raw temporal language and attribution.
- Never use transcript position, packet page order, document creation time, ingestion time, or parser time as event time.
- Keep competing Temporal Assertions independently addressable.
- Do not manufacture precision or silently collapse a range to a point.

### Clock 3 — provenance / information time

Clock 3 records how information moved: observation, communication, recording, quotation, testimony, parsing, extraction, review, and derivation.

- Represent evidentiary origin and retelling through Claim Attribution, Claim Lineage, Source Lineage, PROV activities, and PROV relations.
- Keep provenance activity timestamps separate from Clock 2.
- Preserve ordered roles such as speaker, reporter, recorder, quoter, summarizer, interpreter, authenticator, and testifier.
- Do not attribute a Claim to LlamaParse or the chronology generator merely because that system extracted it. The model activity generated the derived candidate; the Claim remains attributed to the source speaker or record origin.

## Use the lamppost

The lamppost is Icarus's durable addressability layer, not a fourth clock.

Every persisted node and consequential edge must be findable through:

- a stable UUID;
- a human-readable case-scoped `object_code` when supported;
- exact Source Segment IDs and Source Locators for source-backed material; and
- case-ledger history for creation, review, correction, and supersession.

Temporary extraction keys may connect objects inside a candidate bundle, but they must never masquerade as persistent identity. The deterministic compiler may allocate stable UUIDs and object codes before persistence; the governed database path validates them and allocates Clock 1 order. Relationships are first-class reviewable records because the dispute may concern the arrow rather than either endpoint.

## Reconstruct order and state

1. Keep source order, Clock 1, Clock 2, and Clock 3 distinct.
2. Propose source-backed relations such as `before`, `after`, `during`, `overlaps`, `corrects`, `supersedes`, `reports`, and `derived_from` only when the relation itself has a basis.
3. Preserve ties, incomparable event sets, cycles, conflicts, and gaps.
4. A topological sort may be used only as a presentation order. It must not erase alternative valid orders.
5. Express a state transition as a projection over an event and its source-backed before/after states. Do not invent a new canonical state-transition entity unless the implemented ontology adds one.
6. Treat an earlier state, plan, instruction, or assertion as superseded only when a source actually replaces, withdraws, corrects, or invalidates it. Preserve the prior object and the reviewable supersession relation.
7. Do not create causation, corroboration, support, contradiction resolution, credibility, authenticity, admissibility, or truth findings inside chronology extraction. Route cross-source assessments through the Reconciliation Layer and human review.

## PROV requirements

Record the chronology operation as a versioned provenance activity with compiler/skill version, model version when applicable, configuration hash, input IDs, and activity times.

Use Icarus PROV relation names where applicable:

- `used`
- `was_generated_by`
- `was_derived_from`
- `was_associated_with`
- `was_attributed_to`
- `had_primary_source`
- `specialization_of`

At minimum, the chronology activity `used` the included Source Segments; derived knowledge items and event candidates `were_generated_by` the chronology activity and `were_derived_from` exact Source Segments. Human review is a separate activity associated with an Authenticated Researcher.

## Review and publication boundary

All generated Claims, Event Candidates, Temporal Assertions, relationships, entity mentions, flags, and proposed “knowns” start as reviewable candidates unless the input already supplies an accepted governed object.

- Preserve every review decision with actor, time, rationale, before/after state, Source Segment IDs, and Clock 1 ledger position.
- A correction or supersession creates append-preserving history; it does not rewrite the original record.
- Do not publish a Reviewed Event, Verification Assessment, canonical identity, or reusable known without the authorized Icarus review path.
- A saved timeline is an Evidence Snapshot-backed Projection, not a new source and not proof of its ordering.

## Completion gate

Chronology collapse is complete only when:

- every material candidate has an exact source locator or explicit incomplete-linkage status;
- all three clocks remain distinguishable;
- stable identities or temporary candidate keys are unambiguous;
- partial order, ties, and incomparable sets remain visible;
- state transitions and supersession proposals have explicit bases;
- competing assertions and source ancestry remain separate;
- the last processed Source Segment and known coverage gaps are recorded;
- generated objects remain reviewable rather than silently canonical; and
- a short reader-facing narrative is derived from, and subordinate to, the structured chronology bundle.

Processing every chunk is necessary but is not itself proof that the chronology is complete.
