Build the **Icarus Casework evidence intake pipeline** so captured material is ingested into Supabase without collapsing source provenance, reported accounts, primary records, or verification status into one “fact.”

Use the existing Icarus Casework repo, its current Supabase-backed data/auth architecture, and the Court Document Corpus Agent design.

The governing rule is:

**A source, an assertion, an underlying proposition, and a verification assessment are different objects. Preserve them separately in storage and in the intake pipeline.**

## Goal

Create an intake system that can receive:

```text
PDF
HTML / SingleFile capture
TXT / Markdown
DOCX
JPG / PNG / WEBP
trial transcript
court document
medical record
journal/notebook page
news report
digital-forensics report
```

and route each item through:

```text
CAPTURE
   ↓
ORIGINAL SOURCE PRESERVATION
   ↓
DOCUMENT CLASSIFICATION
   ↓
DOCUMENT SEGMENTATION / CANONICALIZATION
   ↓
ASSERTION EXTRACTION
   ↓
ATTRIBUTION CHAIN
   ↓
PROPOSITION LINKING
   ↓
SOURCE SUPPORT / CONFLICT RELATIONSHIPS
   ↓
VERIFICATION ASSESSMENT
```

The system must preserve distinctions such as:

```text
Lindsay said X.

Patrick says Lindsay said X.

A clinician documented that Lindsay said X.

An investigator wrote that Patrick said Lindsay said X.

An expert testified that a medical record contains X.
```

These may concern the same underlying proposition, but they are separate assertions with separate provenance.

## First principle: do not build a flat facts table

Do not model intake like this:

```text
fact:
  text
  verified
  source
```

That structure destroys evidentiary lineage.

Instead model at least these independently:

```text
Source
SourceDocument
DocumentSegment
CanonicalDocument
Proposition
Assertion
AssertionAttribution
AssertionSupport
Event
VerificationAssessment
EvidenceAcquisitionRecord
```

Reuse existing Icarus tables where they already represent these concepts cleanly. Do not create duplicate concepts just because this prompt names them differently.

Before migrations, inspect the current schema and produce a short mapping:

```text
requested concept
→ existing table / needs extension / new table
```

Then implement the minimum schema changes necessary.

## Required conceptual separation

### 1. Source

A `source` represents the evidentiary origin.

Examples:

```text
Lindsay handwritten journal
McLean clinical encounter
Patrick police interview
CVS surveillance system
medical examiner autopsy examination
phone forensic extraction
```

Suggested fields:

```yaml
Source:
  id:
  case_id:
  source_family:
  origin_type:
  origin_entity_id:
  origin_date:
  known_to_exist:
  possessed_by_us:
  completeness:
  primary_source:
  notes:
```

Suggested `source_family` values:

```text
journal_or_notebook
medical_record
witness_interview
court_record
trial_transcript
digital_forensics
surveillance
forensic_or_autopsy
search_warrant
news_report
video_or_audio
discovery_aid
other
unknown
```

Do not infer `primary_source=true` merely because a source looks authoritative.

## 2. Source document

A `source_document` is a concrete representation of a source.

Example:

```text
SOURCE
Lindsay handwritten journal

SOURCE DOCUMENT A
scan of journal pages

SOURCE DOCUMENT B
trial exhibit containing selected journal pages

SOURCE DOCUMENT C
trial transcript where passages are read

SOURCE DOCUMENT D
WCVB article quoting courtroom reading
```

Suggested fields:

```yaml
SourceDocument:
  id:
  source_id:
  case_id:
  document_type:
  original_filename:
  storage_path:
  sha256:
  mime_type:
  source_url:
  publisher:
  capture_method:
  retrieved_at:
  is_original:
  is_derivative:
  derived_from_document_id:
  completeness:
  parser_status:
```

Exact duplicate documents should be detected by SHA-256.

Near-duplicate documents should not be automatically merged solely by similarity.

## 3. Proposition

A `proposition` is the normalized underlying claim or state of affairs that multiple assertions may concern.

Example:

```text
Subject: Lindsay
Predicate: reported
Object: suicidal thoughts
Time: Jan 2023
```

or:

```text
Subject: Patrick
Predicate: entered
Object: CVS
Time: 17:32:32
```

Suggested schema:

```yaml
Proposition:
  id:
  case_id:
  subject_entity_id:
  predicate:
  object_json:
  time_start:
  time_end:
  location_entity_id:
  normalized_text:
  review_required:
```

A proposition is not automatically true.

It is a normalized object that assertions can support, contradict, qualify, or report.

## 4. Assertion

An `assertion` is a specific statement made by a specific source or speaker.

Suggested fields:

```yaml
Assertion:
  id:
  case_id:
  proposition_id:
  assertion_text:
  normalized_assertion:
  assertion_type:
  provenance_type:
  epistemic_status:
  confidence:
  source_document_id:
  source_segment_id:
  source_page:
  source_quote:
  asserted_at:
  event_time_start:
  event_time_end:
  review_required:
  review_reasons:
```

Suggested `provenance_type` values:

```text
direct_observation
subject_statement
witness_statement
reported_statement
hearsay_report
primary_record
derived_record
investigator_characterization
investigator_inference
expert_opinion
procedural_record
media_report
warrant_boilerplate
unknown
```

Suggested `epistemic_status` values:

```text
directly_supported
reported
ambiguous
conflicted
missing
unassessed
```

Do not use `verified` here as a catch-all.

## 5. Assertion attribution chain

This is essential.

Model who said what, who reported it, and who recorded it.

Suggested schema:

```yaml
AssertionAttribution:
  id:
  assertion_id:
  entity_id:
  attribution_role:
  sequence:
  source_document_id:
  notes:
```

Suggested `attribution_role` values:

```text
speaker
reported_by
recorded_by
quoted_by
summarized_by
interpreted_by
authenticated_by
testified_by
```

The `sequence` field should allow chains like:

```text
Lindsay
  ↓ speaker

Patrick
  ↓ reported_by

Investigator
  ↓ recorded_by

Affidavit
```

or:

```text
Lindsay
  ↓ speaker

Clinician
  ↓ recorded_by

medical record
```

Do not flatten these chains into one `reported_by` string.

## 6. Assertion support relationships

Create a relationship table between assertions, propositions, and sources.

Suggested schema:

```yaml
AssertionSupport:
  id:
  case_id:
  assertion_id:
  proposition_id:
  relation_type:
  source_lineage_id:
  independence_group:
  weight_override:
  notes:
```

Suggested `relation_type` values:

```text
supports
corroborates
contradicts
conflicts_with
qualifies
supersedes
duplicates
derives_from
describes
```

The critical rule:

**Duplicate documents from the same evidentiary lineage must not increase corroboration count.**

Example:

```text
Affidavit v1 copied into 3 warrant packets
```

should remain one independent assertion lineage.

Use either:

```text
source_lineage_id
```

or:

```text
independence_group
```

to make that deterministic.

## 7. Verification assessment

Verification is its own object.

Do not mutate an assertion into “verified.”

Suggested schema:

```yaml
VerificationAssessment:
  id:
  case_id:
  proposition_id:
  assessment_type:
  support_status:
  basis:
  assessed_by:
  assessed_at:
  method:
  supporting_assertion_ids:
  conflicting_assertion_ids:
  review_required:
```

Suggested `support_status` values:

```text
unassessed
supported
corroborated
conflicted
contradicted
superseded
insufficient
```

Example:

```text
PROPOSITION
Lindsay reported suicidal thoughts

ASSERTION A
Patrick said she did

ASSERTION B
clinical note says she reported it

ASSERTION C
investigator repeated Patrick's statement

ASSESSMENT
corroborated

basis:
independent primary record + witness account

Important:
Assertion C should not count as independent support if it derives from Assertion A.
```

## 8. Event separation

Keep events separate from assertions.

An event may be described by multiple assertions.

Suggested schema:

```yaml
Event:
  id:
  case_id:
  event_type:
  date:
  time_start:
  time_end:
  time_precision:
  description:
  location_entity_id:
  review_required:
```

Link assertions via:

```yaml
EventAssertion:
  event_id:
  assertion_id:
  relation_type:
```

Example:

```text
EVENT
Patrick enters CVS

ASSERTION A
CVS surveillance described in affidavit

ASSERTION B
Patrick testimony

ASSERTION C
actual surveillance video

These are three source paths to one event.
```

## 9. Intake record

Every captured item should first become an intake object before extraction.

Suggested schema:

```yaml
EvidenceIntake:
  id:
  case_id:
  original_filename:
  stored_original_path:
  sha256:
  mime_type:
  extension:
  file_size_bytes:
  source_url:
  page_title:
  publisher:
  retrieved_at:
  captured_at:
  capture_method:
  proposed_source_family:
  processing_status:
  corpus_run_id:
  exact_duplicate_of:
  review_required:
  notes:
```

Suggested statuses:

```text
received
preserved
classified
processing
complete
failed
review_required
```

## 10. Evidence acquisition register

Also persist sources we know exist but do not possess.

Suggested schema:

```yaml
EvidenceAcquisitionRecord:
  id:
  case_id:
  title:
  source_family:
  known_to_exist:
  used_at_trial:
  admitted_as_exhibit:
  exhibit_number:
  publicly_released:
  possessed_by_us:
  completeness:
  acquisition_status:
  acquisition_method:
  source_url:
  court_source:
  witness:
  trial_day:
  underlying_source:
  best_current_source:
  priority:
  notes:
```

Critical logic:

```text
known_to_exist != possessed_by_us

used_at_trial != admitted_as_exhibit

mentioned_in_testimony != source_reviewed

news_report_available != underlying_evidence_available
```

Suggested acquisition statuses:

```text
identified
located
captured
requested
restricted
unavailable
partial
complete
```

## Intake workflow

Implement:

```text
NEW FILE
   ↓
validate
   ↓
hash
   ↓
preserve immutable original
   ↓
create EvidenceIntake
   ↓
exact duplicate check
   ↓
classify source/document
   ↓
create or link Source
   ↓
create SourceDocument
   ↓
Court Document Corpus Agent
   ↓
DocumentSegments
   ↓
CanonicalDocuments
   ↓
Assertions
   ↓
Attribution chains
   ↓
Propositions
   ↓
Events
   ↓
Support relationships
   ↓
Verification assessments remain unassessed unless explicitly evaluated
```

Do not let the extraction agent create a verification assessment merely because it has high confidence in extraction.

## Example that must work

Input:

```text
Police affidavit says:
Patrick told investigators that Lindsay had suicidal thoughts.
```

Expected storage:

```text
SOURCE
Patrick police interview
or affidavit source if the underlying interview is unavailable

SOURCE DOCUMENT
warrant affidavit

ASSERTION
"Patrick told investigators that Lindsay had suicidal thoughts."

PROPOSITION
"Lindsay experienced/reported suicidal thoughts."

ATTRIBUTION
speaker = Patrick
recorded_by = investigator

PROVENANCE
witness_statement / reported_statement

SUPPORT STATUS
unassessed
```

Do not store:

```text
fact = Lindsay had suicidal thoughts
verified = true
```

## Second example

Input:

```text
Clinical note:
"Patient reports suicidal thoughts."
```

Expected:

```text
SOURCE
clinical encounter

SOURCE DOCUMENT
medical record

ASSERTION
"Patient reports suicidal thoughts."

PROPOSITION
"Lindsay reported suicidal thoughts."

ATTRIBUTION
speaker = Lindsay
recorded_by = clinician

PROVENANCE
primary_record

SUPPORT STATUS
unassessed
```

If both this and Patrick's independent account exist:

```text
VerificationAssessment
status = corroborated
```

only after the evaluation layer explicitly determines the sources are independent enough to support that assessment.

## Third example: duplicate affidavit

Input:

```text
Affidavit copied into:
tablet warrant
iPhone warrant
laptop warrant
```

Expected:

```text
3 physical SourceDocuments
1 canonical affidavit lineage
1 set of originating assertions
```

The system must not create three corroborating assertions merely because the affidavit appears three times.

## Supabase requirements

Inspect the current Supabase schema first.

Preserve:

- existing user ownership;
- RLS;
- authenticated audit attribution;
- case ownership;
- existing source/claim/audit-event behavior where compatible.

All new casework tables must be scoped by `case_id`.

Apply RLS consistently.

A user must not be able to read or write evidence belonging to another user's case.

Every review, correction, canonicalization decision, merge, or verification assessment should capture authenticated actor identity.

Do not weaken existing RLS to make ingestion easier.

## Migration strategy

Do not rewrite the database wholesale.

Produce migrations in this order:

```text
1. extend existing source/evidence tables if appropriate
2. add propositions
3. add assertions or extend current claims only if semantics remain correct
4. add assertion_attributions
5. add assertion_support
6. add verification_assessments
7. add acquisition records
8. add any event/assertion join tables required
9. indexes
10. RLS policies
```

If the existing `claims` table is already used elsewhere, do not rename or overload it without checking downstream dependencies.

If `claims` semantically means assertion already, Codex may evolve it instead of introducing `assertions`, but document the decision.

## Constraints

Do not use free-text JSON blobs for everything.

Use normalized relational tables for:

```text
propositions
assertions
attributions
source lineage
support/conflict relationships
verification assessments
```

JSONB is appropriate for:

```text
normalized proposition object
parser metadata
review reason arrays
source-specific metadata
```

but provenance relationships must remain queryable.

## Indexes

Add indexes appropriate for:

```text
case_id
source_id
source_document_id
proposition_id
assertion_id
entity_id
sha256
source_lineage_id
independence_group
support_status
processing_status
```

Use unique constraints where appropriate for exact-document hashes within a case.

## API / Server Action behavior

Extend the intake API so a processing result can write the separated objects transactionally.

Prefer:

```text
POST intake
→ EvidenceIntake created

PROCESS
→ Source
→ SourceDocument
→ Assertion batch
→ Attribution batch
→ Proposition links
→ Event links
→ Support relationships
```

Do not expose direct arbitrary table writes from the client.

Use Server Actions or authenticated server routes following the existing project pattern.

## Human correction

Corrections must create an audit trail.

If a reviewer changes:

```text
speaker
proposition link
source family
attribution role
duplicate/canonical relationship
support relation
```

preserve:

```text
previous value
new value
actor
timestamp
reason if provided
```

Do not destructively overwrite provenance without audit history.

## UI

Add the smallest inspection UI needed to prove the separation works.

For one assertion, I should be able to see:

```text
ASSERTION
Patrick said Lindsay had suicidal thoughts.

UNDERLYING PROPOSITION
Lindsay experienced/reported suicidal thoughts.

SOURCE
Patrick police interview

DOCUMENT
Warrant affidavit

ATTRIBUTION CHAIN
Patrick
→ investigator
→ affidavit

PROVENANCE
witness statement

SUPPORT STATUS
unassessed

RELATED SUPPORT
clinical note — independent
affidavit copy — duplicate lineage
```

Do not build the full graph UI yet.

A detail drawer or simple relational view is enough.

## Tests

Add tests for at least:

1. direct subject statement;
2. witness statement;
3. reported-by chain;
4. clinician-recorded subject statement;
5. investigator characterization;
6. expert opinion;
7. duplicate affidavit lineage;
8. independent corroboration;
9. conflicting assertions;
10. proposition remains unverified without assessment;
11. `known_to_exist` stays separate from `possessed_by_us`;
12. exact duplicate document does not duplicate assertions;
13. attribution order is preserved;
14. RLS prevents cross-user case access;
15. correction creates audit history;
16. null/unknown metadata remains null;
17. high extraction confidence does not set support status to corroborated.

## Initial real fixture

Use the Lindsay Clancy Part 2 PDF.

Expected behavior includes:

```text
multiple physical warrant packets
↓
repeated affidavit lineage detected
↓
canonical affidavit versions
↓
assertions extracted once per evidentiary lineage
↓
Patrick-reported statements remain attributed to Patrick
↓
investigator summaries remain investigator characterizations
↓
medical findings remain separate from witness descriptions
↓
duplicate affidavit copies do not increase corroboration
```

Use the existing manually identified March and April affidavit versions as evaluation expectations, not hard-coded production rules.

## Definition of done

The intake is complete when I can drop a source into the casework inbox and later inspect:

```text
what source we captured
what physical document it came from
what assertion was actually made
who made it
who reported it
who recorded it
what normalized proposition it concerns
which event it relates to
whether another source independently supports it
whether another source conflicts with it
whether verification has been assessed
whether we possess the underlying primary source
```

without any of those distinctions being flattened into one “fact.”

Before implementation, inspect the existing repo and Supabase migrations, produce the schema mapping and migration plan, then implement end-to-end.

After implementation, report:

- existing tables reused;
- tables added or extended;
- migrations created;
- RLS policies added;
- indexes and constraints added;
- intake pipeline changes;
- UI added;
- tests added;
- Part 2 fixture results;
- any places where the existing schema forced a compromise;
- recommended next migration before connecting the full Court Document Corpus Agent.