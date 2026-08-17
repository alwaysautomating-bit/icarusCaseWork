# Ontology

Status: FORMING

## Canonical Terms

### Case

Definition: A bounded research workspace with a durable identity, declared purpose, public-record cutoff date, and versioned evidence snapshots.

Status: Provisional

Depends on: all case-scoped records and exports

### Authenticated Researcher

Definition: A human user whose identity is validated by Supabase Auth and whose immutable `auth.users.id` is used for application authorization, case membership, review attribution, and audit events. User-editable metadata may supply a display name but never authorization authority.

Status: Provisional

Rejected synonyms: Local actor, Header actor, Reviewer name as identity

Depends on: authentication, Server Actions, case membership, review decisions, authority log

### Case Membership

Definition: The explicit relationship granting an Authenticated Researcher a named role in one Case. Membership is created automatically for a case owner and is the row-level authorization boundary for case-scoped records.

Status: Provisional

Depends on: case ownership, application authorization, RLS, collaboration

### Evidence Snapshot

Definition: An immutable manifest identifying the exact artifact versions and derived-record versions used to generate a projection or export.

Status: Provisional

Depends on: reproducibility, scenario runs, publication exports

### Source Artifact

Definition: A concrete immutable representation received or captured by Icarus, such as an HTML snapshot, transcript export, scan, or media file, preserved with checksum, provenance, acquisition context, and access status. It is not necessarily the underlying evidentiary origin.

Status: Provisional

Rejected synonyms: Source, Underlying evidence

Depends on: ingestion, citations, provenance, evidence snapshots

### Source

Definition: The evidentiary origin or origin system from which one or more Source Artifacts derive, including a testimony session, clinical encounter, witness interview, journal, surveillance system, or known underlying record.

Status: Provisional

Rejected synonyms: Source Artifact, Web page

Depends on: source documents, provenance, acquisition status, independence analysis

### Evidence Intake

Definition: The append-preserving capture and processing ledger for one submitted item or URL, including the exact submitted locator, canonical locator, capture result, checksum linkage, parser version, processing state, duplicate disposition, and review state.

Status: Provisional

Depends on: safe capture, idempotency, processing failures, source creation

### Evidence Lane

Definition: The product-level evidentiary modality assigned to a Source and its Claims independently of artifact representation. Allowed lanes are `testimony`, `documentary`, and `direct_evidence`. The lane is not a legal conclusion about admissibility, weight, or whether evidence is legally direct or circumstantial.

Status: Provisional

Rejected synonyms: File type, MIME type, Document type, Admissibility category

Depends on: intake contracts, claim persistence, reconciliation boundaries, evidence projections

### Reconciliation Layer

Definition: The authenticated post-intake boundary that may compare Claims across evidence lanes and create explicit support, conflict, qualification, independence-assessment, or Verification Assessment records without mutating the original lane-specific Claims.

Status: Provisional

Rejected synonyms: Intake, Extraction, Automatic verification

Depends on: propositions, claim support, source lineage, evidence lanes, human assessment

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

### Proposition

Definition: A normalized, case-scoped state of affairs that one or more Claims concern. A Proposition has no automatic truth, support, or verification status.

Status: Provisional

Rejected synonyms: Fact, Verified claim

Depends on: assertion linking, support/conflict views, verification assessment

### Claim Attribution

Definition: One ordered role in the provenance chain for a Claim, linking an entity as speaker, reporter, recorder, quoter, summarizer, interpreter, authenticator, or testifier without flattening the chain into one claimant string.

Status: Provisional

Depends on: claim provenance, testimony inspection, reported-account separation

### Verification Assessment

Definition: An explicit, append-preserving evaluation of the support for a Proposition, with actor, method, basis, supporting and conflicting Claims, and status. It is never inferred solely from extraction confidence.

Status: Provisional

Rejected synonyms: Claim verified flag, Extraction confidence

Depends on: propositions, independent support, human evaluation, audit history

### Evidence Acquisition Record

Definition: A case-scoped record for evidence known or believed to exist, including trial-use and exhibit metadata, possession, availability, completeness, acquisition state, provenance of discovery, and priority. Knowledge of existence never implies possession.

Status: Provisional

Depends on: testimony mentions, corpus gaps, acquisition workflow

### Source Lineage

Definition: The canonical/derivative grouping that preserves each physical Source Artifact while identifying copies, versions, or representations arising from one evidentiary source path. It is distinct from Claim Lineage, which connects assertions.

Status: Provisional

Depends on: duplicate handling, independent corroboration, canonicalization

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

Depends on: Reconciliation Layer, evidence views, narrative qualifications

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
