# User Workflows

## Primary User

An independent true-crime researcher or long-form content creator who needs to turn a bounded public-record corpus into a reproducible, cited case reconstruction.

## Workflow 1: Open a Case Room

1. Create the case and record its title, purpose, research owner, jurisdiction, incident date, and public-record cutoff date.
2. Record publication-safety notes and case-specific terminology.
3. Create an immutable evidence-snapshot identifier.

Terminal criteria: the case has a stable identity, a cutoff date, and a versioned evidence snapshot.

Evidence: persisted case record and snapshot manifest.

Closure blocker: the corpus boundary or public-record cutoff date is absent.

## Workflow 2: Ingest and Preserve Sources

1. Upload or link an authorized source artifact.
2. Preserve the original bytes, checksum, acquisition context, provenance roles, and access status.
3. Extract text, media metadata, pages, timestamps, and source-addressable segments without replacing the original.
4. Flag unsupported, unreadable, duplicate, or restricted material for disposition.

Terminal dispositions: accepted, duplicate, unsupported, restricted, rejected, or cancelled.

Evidence: immutable artifact, checksum, provenance record, extraction record, and disposition event.

Closure blocker: an accepted artifact lacks checksum, provenance, or a source-addressable representation.

## Workflow 3: Extract and Review Claims

1. Generate attributed claim candidates with exact source locations.
2. Preserve claimant, subject, statement time, claimed event time, qualifiers, and extraction confidence separately.
3. Require human review for every high-impact claim.
4. Accept, amend, reject, or defer each candidate without turning it into an event by default.

Terminal dispositions: accepted as attributed claim, amended and accepted, rejected, deferred, or cancelled.

Evidence: review event recording reviewer, timestamp, disposition, and before/after values.

Closure blocker: a high-impact claim enters downstream projections without human review.

## Workflow 4: Resolve Identities and Lineage

1. Link aliases to durable entities while retaining source-specific names.
2. Record origin, repetition, quotation, paraphrase, and derivation relationships between claims and artifacts.
3. Distinguish independent corroboration from repeated reporting.

Terminal criteria: each displayed repetition has an origin or is explicitly marked origin-unknown; alias merges remain reversible and auditable.

Evidence: entity-resolution decisions and claim-lineage edges.

Closure blocker: a merge erases source wording or repeated claims are counted as independent support.

## Workflow 5: Construct the Longitudinal Timeline

1. Promote reviewed, supportable observations into events through an explicit review action.
2. Store event time separately from report, publication, and ingestion time.
3. Represent exact, approximate, interval, relative, conflicting, and unknown time.
4. View 90-day, 30-day, and incident-window lanes together or independently.

Terminal criteria: all timeline items expose epistemic state, time semantics, and source links.

Evidence: reviewed event records and timeline projection generated from an evidence snapshot.

Closure blocker: a claim is silently rendered as a verified event or an uncertain time is displayed as exact.

## Workflow 6: Investigate Contradictions and Gaps

1. Surface conflicting claims, changed accounts, source dependencies, and missing intervals.
2. Let the researcher classify the conflict without forcing resolution.
3. Record what evidence could distinguish surviving interpretations.

Terminal dispositions: unresolved, resolved by evidence, non-conflicting after clarification, superseded, or cancelled.

Evidence: contradiction record, linked claims/evidence, reviewer disposition, and rationale.

Closure blocker: unresolved contradictory evidence disappears from active views or exports.

## Workflow 7: Compare Competing Accounts

1. Define at least two hypotheses as projections over the same evidence snapshot.
2. Declare required conditions, assumptions, uncertain inputs, and hard constraints.
3. Run deterministic feasibility checks first; use repeated simulation only for declared uncertain inputs.
4. Report feasible/infeasible sequences, failures, sensitivity, and discriminating evidence without truth probabilities.

Terminal criteria: every output identifies snapshot, model version, inputs, constraints, run metadata, and limitations.

Evidence: immutable scenario-run manifest and reproducible result.

Closure blocker: the output implies guilt, diagnosis, credibility, or probability of truth.

## Workflow 8: Draft and Publish a Research Packet

1. Draft from reviewed claims, events, contradictions, and scenario outputs.
2. Attach sentence-level citations and visible uncertainty language.
3. Run publication-safety, source-lineage, unsupported-claim, and sensitive-content checks.
4. Require independent human approval before export.
5. Export a versioned packet carrying the cutoff date and evidence-snapshot identifier.

Terminal dispositions: approved and exported, rejected for revision, cancelled, or superseded by a later version.

Evidence: approval event, validation report, and export manifest.

Closure blocker: any material sentence lacks an exact citation or visible interpretation label.

