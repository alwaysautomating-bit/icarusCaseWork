# Ontology

Status: FORMING

## Canonical Terms

### Case

Definition: A bounded research workspace with a durable identity, declared purpose, public-record cutoff date, and versioned evidence snapshots.

Status: Provisional

Depends on: all case-scoped records and exports

### Evidence Snapshot

Definition: An immutable manifest identifying the exact artifact versions and derived-record versions used to generate a projection or export.

Status: Provisional

Depends on: reproducibility, scenario runs, publication exports

### Source Artifact

Definition: The immutable evidence object received by Icarus, preserved with checksum, provenance, acquisition context, and access status.

Status: Provisional

Rejected synonyms: Source, Document

Depends on: ingestion, citations, provenance, evidence snapshots

### Source Segment

Definition: A stable addressable region of a Source Artifact, such as a page span, paragraph, timestamp interval, spreadsheet range, or image region.

Status: Provisional

Aliases: Citation target

Depends on: exact citations, extraction, narrative validation

### Claim

Definition: An attributed assertion recorded from a source, retaining claimant, subject, qualifiers, source segment, claimed event time, statement time, and review status.

Status: Provisional

Rejected synonyms: Fact, Event

Depends on: review, lineage, contradiction, narrative drafting

### Reviewed Event

Definition: A time-indexed occurrence admitted to the operational reconstruction through an explicit human review decision and linked evidence; it remains qualified by its epistemic state.

Status: Provisional

Aliases: Event

Depends on: timelines, reconstruction, scenario constraints

### Review Decision

Definition: An auditable human disposition that authorizes or rejects a consequential state transition and records actor, time, rationale, and before/after state.

Status: Provisional

Depends on: claim acceptance, event promotion, identity merge, contradiction resolution, publication

### Claim Lineage

Definition: The origin, repetition, quotation, paraphrase, or derivation path connecting claims and source artifacts.

Status: Provisional

Depends on: narrative genealogy, corroboration independence

### Independent Corroboration

Definition: Support arising from evidence whose relevant information path is independent of the claim origin being evaluated.

Status: Provisional

Depends on: evidence views, narrative qualifications

### Contradiction

Definition: A recorded incompatibility or material tension between claims, events, evidence, or time constraints that may remain unresolved.

Status: Provisional

Depends on: research workflow, scenario comparison, exports

### Hypothesis

Definition: A versioned projection expressing an explanatory account, its required conditions, assumptions, compatible/conflicting evidence, and unresolved variables.

Status: Provisional

Rejected synonyms: Truth, Verdict

Depends on: Scenario Lab

### Scenario Run

Definition: A reproducible evaluation of declared constraints and uncertain inputs for one or more hypotheses against a specific evidence snapshot.

Status: Provisional

Rejected synonyms: Probability of truth

Depends on: feasibility and sensitivity results

### Projection

Definition: A useful, reproducible view or analysis derived from the evidence substrate that cannot overwrite its inputs.

Status: Provisional

Depends on: timelines, evidence maps, hypotheses, scenario results, narratives, exports

### Material Narrative Sentence

Definition: A publishable assertion whose truth, attribution, or qualification could materially affect a person, interpretation, or case account and therefore requires an exact citation or explicit interpretation label.

Status: Provisional

Depends on: export validation and publication approval

### Research Window

Definition: A reproducible projection boundary over the full case, the final 90 days, the final 30 days, or the declared incident interval. An event may appear in multiple nested windows without duplication in the evidence substrate.

Status: Provisional

Depends on: synchronized timeline lanes and saved research views

### Contradiction Disposition

Definition: The recorded terminal state of an unresolved contradiction, including rationale, actor, time, and observable supporting evidence. Allowed states are resolved by evidence, clarified, superseded, or cancelled.

Status: Provisional

Rejected synonyms: Reviewed, Checked, Closed without evidence

Depends on: contradiction lifecycle, publication integrity, authority log

### Source Locator

Definition: A typed, source-format-specific coordinate for an exact excerpt: extracted-text offsets, page, timestamp interval, spreadsheet sheet/range, or described image region. Extracted-text offsets remain attached as a verification fallback.

Status: Provisional

Depends on: source artifact, source segment, exact quote

### Stored Object

Definition: An immutable checksum-addressed evidence payload held by the local filesystem adapter or a private deployed object store. The database retains its stable object key; provider URLs are not treated as evidence identity.

Status: Provisional

Depends on: source artifact checksum and storage adapter
