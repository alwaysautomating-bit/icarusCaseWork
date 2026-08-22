# Legal Evidence Provenance Skills

A set of implementation-oriented skills for capturing, querying, and presenting evidence provenance in legal matters using the W3C PROV data model. These skills are designed for evidence systems that must preserve chain of custody, authentication history, source introduction, discussion history, admission status, and conflicting descriptions without overwriting the record.

---

## 1. Purpose and design principles

### Objective
Create a durable, machine-readable evidence record that can answer:

- What is this item, and which immutable version is being discussed?
- Who created, acquired, handled, transformed, reviewed, or presented it?
- When and where did every material custody or handling event occur?
- How was the item authenticated, challenged, or admitted?
- Who introduced it, discussed it, objected to it, or relied on it?
- What competing descriptions or interpretations exist, and who made each one?
- What source material and processing steps support every claim?

### Core principles

1. **Append-only provenance.** Do not edit history in place. Corrections, disputes, and reclassifications are new assertions or activities that point to prior records.
2. **Separate item, representation, and assertion.** A physical phone, a forensic extraction, an exported PDF, and a lawyer's description are not the same thing.
3. **Preserve raw artifacts.** Retain original files, acquisition logs, media, hashes, and tool output alongside derived versions.
4. **Model claims as claims.** “This is the defendant’s phone” is an attributed assertion, not necessarily an established fact.
5. **Record authority and scope.** A ruling admitting a document for a limited purpose differs from a party’s offer, a witness’s testimony, or a stipulation.
6. **Make every provenance edge auditable.** Each important relation should have an actor, timestamp, source, system context, and integrity reference where available.
7. **Support jurisdiction-specific overlays.** Court, evidentiary rule, confidentiality, privilege, discovery, and retention rules vary; do not hard-code one jurisdiction’s rules as universal.

---

## 2. PROV modeling profile

### PROV primitives

| Legal concept | PROV representation | Notes |
|---|---|---|
| Evidence item / original artifact | `prov:Entity` | Include stable evidence ID and immutable content hash where applicable |
| File, image, extract, transcript, exhibit copy | `prov:Entity` | Link to its source item using derivation relations |
| Person, organization, court, tool, system | `prov:Agent` | Agents may be people, firms, agencies, software, or devices |
| Collection, transfer, review, extraction, filing, hearing | `prov:Activity` | Activities explain how entities moved or changed |
| Person performing a transfer or authentication step | `prov:Association` / `prov:wasAssociatedWith` | Capture role, authority, and identity details |
| Custody handoff | `prov:Activity` + `prov:used` + `prov:wasGeneratedBy` | Treat handoffs as explicit, timestamped activities |
| File derivation / conversion | `prov:wasDerivedFrom` | Add method, tool, version, and verification result |
| Claim, description, objection, testimony, ruling | `prov:Entity` | Model as an attributed assertion, not a property that replaces other assertions |
| Claim author or speaker | `prov:wasAttributedTo` | Preserve speaker, capacity, and source record |
| Admission or exclusion event | `prov:Activity` + decision assertion entity | Link to offered evidence, exhibit, court, authority, and scope |

### Recommended namespaces

```turtle
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix schema: <https://schema.org/> .
@prefix leg: <https://example.org/legal-prov#> .
@prefix case: <https://example.org/case/2026-001/> .
```

### Legal extension vocabulary

Use a small, explicit extension vocabulary rather than forcing legal semantics into generic labels.

```turtle
leg:EvidenceItem a rdfs:Class ; rdfs:subClassOf prov:Entity .
leg:EvidenceRepresentation a rdfs:Class ; rdfs:subClassOf prov:Entity .
leg:Assertion a rdfs:Class ; rdfs:subClassOf prov:Entity .
leg:CustodyTransfer a rdfs:Class ; rdfs:subClassOf prov:Activity .
leg:Acquisition a rdfs:Class ; rdfs:subClassOf prov:Activity .
leg:ForensicProcess a rdfs:Class ; rdfs:subClassOf prov:Activity .
leg:AuthenticationReview a rdfs:Class ; rdfs:subClassOf prov:Activity .
leg:EvidenceOffer a rdfs:Class ; rdfs:subClassOf prov:Activity .
leg:AdmissionDecision a rdfs:Class ; rdfs:subClassOf prov:Activity .
leg:DiscussionEvent a rdfs:Class ; rdfs:subClassOf prov:Activity .

leg:hasEvidenceId a rdf:Property .
leg:hasContentHash a rdf:Property .
leg:hashAlgorithm a rdf:Property .
leg:hasStorageLocation a rdf:Property .
leg:hasLegalStatus a rdf:Property .
leg:hasCustodyStatus a rdf:Property .
leg:hasPrivilegeStatus a rdf:Property .
leg:hasConfidentialityStatus a rdf:Property .
leg:hasSourceSystem a rdf:Property .
leg:hasRole a rdf:Property .
leg:hasAuthority a rdf:Property .
leg:hasExhibitNumber a rdf:Property .
leg:hasDocketReference a rdf:Property .
leg:hasTranscriptReference a rdf:Property .
leg:assertsAbout a rdf:Property .
leg:assertsPredicate a rdf:Property .
leg:assertsObject a rdf:Property .
leg:assertionStatus a rdf:Property .
leg:assertionType a rdf:Property .
leg:supportsAssertion a rdf:Property .
leg:contradictsAssertion a rdf:Property .
leg:qualifiedBy a rdf:Property .
leg:offeredBy a rdf:Property .
leg:offeredForPurpose a rdf:Property .
leg:decidedBy a rdf:Property .
leg:decisionOutcome a rdf:Property .
leg:decisionScope a rdf:Property .
leg:discussedBy a rdf:Property .
leg:discussionRole a rdf:Property .
leg:discussionTopic a rdf:Property .
leg:wasIntroducedBy a rdf:Property .
leg:integrityVerifiedAt a rdf:Property .
leg:verificationResult a rdf:Property .
leg:retentionHold a rdf:Property .
```

---

## 3. Shared data rules

### Identity and immutability

- Assign a stable internal `evidence_id` at intake. Never reuse it.
- Assign a distinct `representation_id` for each copy, export, scan, redaction, excerpt, transcript, or demonstrative.
- Calculate and retain a cryptographic hash for every digital representation at intake and after each controlled transformation.
- Record algorithm, digest, byte size, MIME type, original filename, acquisition timestamp, and acquisition operator.
- Use immutable object storage or a write-once log for raw artifacts and signed event records where feasible.
- Keep database record IDs separate from legal exhibit numbers and court-assigned identifiers.

### Time rules

- Store timestamps in UTC, retaining reported local time and timezone offset where known.
- Distinguish `occurred_at`, `recorded_at`, `uploaded_at`, and `verified_at`.
- Preserve uncertainty: use a time range, precision field, or “reported” qualifier rather than inventing a precise time.

### Assertion rules

- Store competing statements as separate `leg:Assertion` entities.
- Every assertion must identify its source, author or speaker, date, capacity, and supporting record.
- Do not mark an assertion “true” merely because it is entered. Use status values such as `asserted`, `stipulated`, `admitted_for_limited_purpose`, `found`, `disputed`, `withdrawn`, or `superseded_by_correction`.
- Link assertions with `leg:contradictsAssertion` when they materially conflict; do not collapse conflicts into a single normalized narrative.

### Security rules

- Apply matter-level and item-level access controls.
- Preserve access and export logs as provenance activities.
- Do not expose privileged, sealed, protected, or personal information merely because it is technically reachable.
- Treat redaction as a derivation: retain the unredacted source, redaction activity, authority, rationale, and resulting redacted representation.

---

## 4. Skill: Register evidence at intake

### Name
`legal-evidence-intake`

### Goal
Create the initial provenance record for an item received from a person, repository, production, device, agency, or court filing.

### Inputs

```yaml
evidence_id: EV-2026-000184
matter_id: MAT-2026-001
item_type: digital_file | physical_object | testimony_record | court_record | mixed
received_from:
  agent_id: AG-0042
  name: "Example Producing Party"
  capacity: producing_party
received_at: "2026-08-17T20:20:00Z"
received_method: secure_portal
source_description: "Native email export produced in response to request 12"
original_filename: "invoice-thread.msg"
mime_type: application/vnd.ms-outlook
byte_size: 182736
hash:
  algorithm: SHA-256
  value: "<digest>"
storage_uri: "immutable://matter/MAT-2026-001/EV-2026-000184/raw"
operator:
  agent_id: AG-0007
  name: "Records Custodian"
notes: "Timestamp embedded in file has not yet been independently verified."
```

### Required behavior

1. Create a `leg:EvidenceItem` for the conceptual item.
2. Create a `leg:EvidenceRepresentation` for the received artifact.
3. Create an `leg:Acquisition` activity.
4. Associate the intake operator and source/producing agent with their roles.
5. Preserve the source description verbatim as a source-attributed assertion.
6. Record hashes and storage details without treating the hash as proof of authorship or authenticity.
7. Mark unverified facts as unverified.

### Output

- Stable item and representation identifiers.
- An intake activity ID.
- A PROV graph fragment.
- A machine-readable integrity receipt.
- A human-readable chain-of-custody entry.

### Example PROV

```turtle
case:EV-2026-000184 a leg:EvidenceItem ;
  leg:hasEvidenceId "EV-2026-000184" ;
  dct:description "Native email export produced in response to request 12" ;
  leg:hasCustodyStatus "received" .

case:REP-2026-000184-01 a leg:EvidenceRepresentation ;
  prov:specializationOf case:EV-2026-000184 ;
  dct:format "application/vnd.ms-outlook" ;
  leg:hasContentHash "<digest>" ;
  leg:hashAlgorithm "SHA-256" ;
  leg:hasStorageLocation "immutable://matter/MAT-2026-001/EV-2026-000184/raw" ;
  prov:wasGeneratedBy case:ACT-intake-000184 .

case:ACT-intake-000184 a leg:Acquisition ;
  prov:endedAtTime "2026-08-17T20:20:00Z"^^xsd:dateTime ;
  prov:wasAssociatedWith case:AG-0007 ;
  prov:used case:AG-0042 ;
  leg:hasRole "intake_operator" .

case:ASRT-source-description-000184 a leg:Assertion ;
  leg:assertsAbout case:EV-2026-000184 ;
  leg:assertsPredicate "source_description" ;
  leg:assertsObject "Native email export produced in response to request 12" ;
  leg:assertionType "production_description" ;
  leg:assertionStatus "asserted" ;
  prov:wasAttributedTo case:AG-0042 .
```

---

## 5. Skill: Record chain of custody

### Name
`legal-custody-transfer`

### Goal
Record every transfer, temporary possession, storage move, checkout, return, or controlled access event affecting an evidence item or representation.

### Inputs

```yaml
transfer_id: CUST-2026-000091
representation_id: REP-2026-000184-01
from_agent:
  agent_id: AG-0007
  role: evidence_custodian
to_agent:
  agent_id: AG-0033
  role: forensic_examiner
handoff_at: "2026-08-17T22:30:00Z"
received_at: "2026-08-17T22:34:00Z"
transfer_method: encrypted_media | secure_download | physical_handoff | courier
location_from: "Evidence vault A"
location_to: "Forensics lab"
condition_out: "sealed; hash verified"
condition_in: "sealed; hash verified"
verification:
  algorithm: SHA-256
  expected_digest: "<digest>"
  observed_digest: "<digest>"
  result: match
authority: "Matter preservation protocol v2.1"
```

### Required behavior

- Create a custody transfer activity, not merely a mutable status update.
- Capture both sender and recipient acknowledgement when available.
- Record any hash mismatch, broken seal, delay, missing receipt, or unknown custodian as an exception.
- Do not silently infer continuous custody across gaps.
- Generate a continuity assessment: `continuous`, `documented_gap`, `integrity_exception`, or `unknown`.

### Output fields

```yaml
continuity_assessment: continuous
exceptions: []
next_custodian: AG-0033
representation_hash_verified: true
```

### Example PROV

```turtle
case:CUST-2026-000091 a leg:CustodyTransfer ;
  prov:used case:REP-2026-000184-01 ;
  prov:wasAssociatedWith case:AG-0007, case:AG-0033 ;
  prov:startedAtTime "2026-08-17T22:30:00Z"^^xsd:dateTime ;
  prov:endedAtTime "2026-08-17T22:34:00Z"^^xsd:dateTime ;
  leg:hasAuthority "Matter preservation protocol v2.1" ;
  leg:verificationResult "match" .
```

---

## 6. Skill: Record authentication history

### Name
`legal-authentication-history`

### Goal
Capture each authentication-related test, foundation witness statement, metadata review, system validation, hash comparison, stipulation, challenge, and court decision.

### Inputs

```yaml
authentication_event_id: AUTH-2026-000044
representation_id: REP-2026-000184-01
review_type: hash_verification | metadata_review | witness_foundation | system_record_review | forensic_validation | stipulation | challenge
performed_by:
  agent_id: AG-0033
  name: "Forensic Examiner"
  capacity: retained_expert
performed_at: "2026-08-18T14:05:00Z"
method: "SHA-256 comparison against intake digest"
inputs_used:
  - REP-2026-000184-01
result: match
result_summary: "Received artifact matches the intake hash."
limitations:
  - "Hash match establishes file identity relative to intake, not original authorship."
supporting_records:
  - REP-2026-000184-01
  - REP-2026-000184-01-intake-receipt
```

### Required behavior

- Preserve the exact method, tool name, version, settings, examiner, input artifacts, and output artifacts.
- Distinguish identity/integrity verification from authorship, accuracy, completeness, reliability, and admissibility.
- Capture limitations and challenges as first-class records.
- Link opinions to their underlying record set; do not allow a conclusion without traceable support.

### Authentication status model

| Status | Meaning |
|---|---|
| `not_reviewed` | No authentication activity recorded |
| `integrity_checked` | Identity/integrity check completed |
| `foundation_offered` | A party has offered foundation evidence |
| `authentication_contested` | One or more parties challenged authentication |
| `stipulated` | Parties agreed to an identified scope |
| `court_accepted` | Court accepted authentication for a stated purpose or scope |
| `court_rejected` | Court rejected authentication for a stated purpose or scope |

---

## 7. Skill: Track who introduced evidence

### Name
`legal-evidence-introduction`

### Goal
Track the person or party who introduced, produced, disclosed, offered, marked, filed, or presented an evidence item, and distinguish these actions.

### Introduction taxonomy

| Action | Meaning |
|---|---|
| `created` | Originated the item or underlying record |
| `collected` | Obtained it during investigation or discovery |
| `produced` | Delivered it in discovery or disclosure |
| `identified` | Identified it during deposition, hearing, or trial |
| `marked` | Assigned an exhibit or demonstrative designation |
| `offered` | Asked the court to receive it |
| `admitted` | Court accepted it, possibly with limits |
| `published` | Displayed or read it to a factfinder or audience |
| `filed` | Submitted it in a docketed filing |

### Inputs

```yaml
introduction_event_id: INTRO-2026-000019
representation_id: REP-2026-000184-02
action: offered
introduced_by:
  agent_id: AG-0010
  name: "Plaintiff's Counsel"
  capacity: counsel
forum:
  court_name: "Example District Court"
  proceeding_id: HEARING-2026-08-21
  transcript_reference: "Tr. 145:8-146:3"
exhibit_number: "PX-17"
occurred_at: "2026-08-21T16:12:00Z"
offered_for_purpose: "To show notice"
foundation_reference: AUTH-2026-000044
```

### Required behavior

- Never equate an offer with admission.
- Preserve party designation and exhibit number as event-specific metadata; an item may have multiple designations across proceedings.
- Capture the exact stated purpose where available.
- Link a filing, transcript excerpt, minute entry, exhibit list, or hearing recording that supports the introduction event.

---

## 8. Skill: Track discussion, testimony, and objections

### Name
`legal-evidence-discussion-log`

### Goal
Create a structured record of who discussed an item, what they said, in what capacity, and where the statement can be verified.

### Inputs

```yaml
discussion_id: DISC-2026-000126
representation_id: REP-2026-000184-02
speaker:
  agent_id: AG-0021
  name: "Witness A"
  capacity: fact_witness
context:
  event_type: deposition | hearing | trial | meeting | correspondence | expert_report
  proceeding_id: DEPO-2026-0009
  transcript_reference: "54:11-55:7"
  source_representation_id: REP-transcript-0009-01
occurred_at: "2026-08-20T19:47:00Z"
role: authenticated | described | denied_authorship | explained_context | objected | argued | interpreted
verbatim_text: "I recognize this as the invoice email I received."
normalized_summary: "Witness stated that they recognized the email as an invoice email they received."
assertions_created:
  - ASRT-2026-000211
```

### Required behavior

- Preserve verbatim language and source locators whenever possible.
- Separate a transcript quote from a system-generated summary.
- Tag the speaker’s role and capacity at the time of the statement.
- Track objections separately from rulings.
- Store an unavailable/uncertain transcription as uncertain; do not convert it into a definitive statement.

### Objection model

```yaml
objection:
  asserted_by: AG-0014
  ground: hearsay
  occurred_at: "2026-08-21T16:13:00Z"
  transcript_reference: "Tr. 146:4"
  ruling: sustained | overruled | reserved | not_recorded
  ruling_reference: "Tr. 146:5"
```

---

## 9. Skill: Record admission, exclusion, and limits

### Name
`legal-admission-status`

### Goal
Record the procedural status of an offered item while preserving every offer, objection, ruling, condition, and scope limitation.

### Inputs

```yaml
decision_id: ADMIT-2026-000031
representation_id: REP-2026-000184-02
proceeding_id: HEARING-2026-08-21
court_agent_id: AG-COURT-001
offer_id: INTRO-2026-000019
decision: admitted | admitted_limited | excluded | reserved | withdrawn | not_reached
occurred_at: "2026-08-21T16:14:00Z"
scope: "Admitted solely to show notice; not for truth of the matter asserted."
conditions:
  - "Limiting instruction to be given."
authority_reference: "Tr. 146:5-147:2"
exhibit_number: "PX-17"
```

### Required behavior

- Maintain separate status dimensions: authentication, offer, ruling, publication, appellate treatment, and exhibit handling.
- Never reduce `admitted_limited` to simply `admitted`.
- Store exact scope and conditions as quoted text plus a normalized classification.
- Treat later reconsideration, reversal, or sealing as new decisions linked to the earlier decision.

### Status dimensions

| Dimension | Example values |
|---|---|
| Authentication | not reviewed, offered, contested, stipulated, accepted, rejected |
| Offer | not offered, offered, withdrawn, reserved |
| Court disposition | not decided, admitted, admitted limited, excluded, deferred |
| Use at proceeding | marked, used in examination, published, received but not published |
| Review status | unchallenged, reconsidered, appealed, affirmed, reversed |

---

## 10. Skill: Preserve competing descriptions

### Name
`legal-competing-evidence-descriptions`

### Goal
Represent different descriptions, interpretations, provenance narratives, and factual claims about the same evidence without overwriting or prematurely resolving them.

### Assertion envelope

Every substantive description should use this structure:

```yaml
assertion_id: ASRT-2026-000211
about_entity: EV-2026-000184
subject: EV-2026-000184
predicate: "is_email_received_by"
object: AG-0021
verbatim_claim: "This is the invoice email I received."
normalized_claim: "Witness recognized the item as an invoice email received by the witness."
assertion_type: witness_testimony
asserted_by: AG-0021
speaker_capacity: fact_witness
asserted_at: "2026-08-20T19:47:00Z"
source_representation: REP-transcript-0009-01
source_locator: "54:11-55:7"
status: asserted
confidence_or_qualification: "Speaker identification; no independent authentication finding encoded."
```

### Conflict handling

- Link materially incompatible assertions with `leg:contradictsAssertion`.
- Use `leg:supportsAssertion` only for cited support, not as a truth adjudication.
- Allow multiple claims to be simultaneously active.
- Record a judicial finding, stipulation, or withdrawal as a separate assertion or decision that identifies its scope.
- Do not remove an assertion merely because it was challenged, excluded, or later corrected; change its status and add the subsequent record.

### Example PROV

```turtle
case:ASRT-witness-recognizes-email a leg:Assertion ;
  leg:assertsAbout case:EV-2026-000184 ;
  leg:assertsPredicate "recognized_as_received_email" ;
  leg:assertsObject case:AG-0021 ;
  leg:assertionType "witness_testimony" ;
  leg:assertionStatus "asserted" ;
  prov:wasAttributedTo case:AG-0021 ;
  prov:hadPrimarySource case:REP-transcript-0009-01 .

case:ASRT-opposing-party-denies-authorship a leg:Assertion ;
  leg:assertsAbout case:EV-2026-000184 ;
  leg:assertsPredicate "authored_by" ;
  leg:assertsObject case:AG-0099 ;
  leg:assertionType "party_position" ;
  leg:assertionStatus "disputed" ;
  prov:wasAttributedTo case:AG-0014 ;
  leg:contradictsAssertion case:ASRT-witness-recognizes-email .
```

---

## 11. Skill: Trace transformations and derivatives

### Name
`legal-evidence-derivation`

### Goal
Show exactly how a representation was created from another representation, including exports, OCR, transcription, redaction, parsing, forensic extraction, format conversion, annotation, and demonstrative preparation.

### Inputs

```yaml
derivation_activity_id: DERIVE-2026-000055
source_representation_id: REP-2026-000184-01
output_representation_id: REP-2026-000184-02
transformation_type: OCR | transcription | redaction | export | forensic_extraction | format_conversion | excerpt | annotation
performed_by: AG-0033
performed_at: "2026-08-18T15:30:00Z"
tool:
  name: "Example OCR Tool"
  version: "5.4.1"
  configuration_hash: "<digest>"
method_summary: "OCR applied to image-only PDF; original preserved."
quality_checks:
  - "Spot check completed against pages 1-10."
limitations:
  - "OCR output may contain transcription errors."
```

### Required behavior

- Use `prov:wasDerivedFrom` and a derivation activity for every material transformation.
- Keep the source artifact immutable and independently accessible to authorized users.
- Preserve tool version and configuration for repeatability.
- Mark whether the derivative is a faithful copy, a lossy conversion, a redaction, an analytical output, or a demonstrative.
- Never present an AI-generated summary, OCR text, or extracted metadata as the original record.

---

## 12. Skill: Generate an evidence provenance dossier

### Name
`legal-evidence-provenance-dossier`

### Goal
Produce a human-readable and machine-verifiable narrative for a selected evidence item, representation, exhibit, or issue.

### Inputs

```yaml
subject_id: EV-2026-000184
scope: full_history | custody_only | authentication_only | court_history | assertions_only
as_of: "2026-08-22T00:00:00Z"
include:
  raw_identifiers: true
  hashes: true
  unresolved_gaps: true
  competing_assertions: true
  privileged_records: false
output_format: markdown | pdf | jsonld | turtle
```

### Required sections

1. **Item identity.** Evidence ID, representation IDs, media type, version relationships, hashes, and known source.
2. **Custody timeline.** Every acquisition, handoff, location, integrity check, and unaccounted-for interval.
3. **Authentication history.** Methods, witnesses, examiner results, limitations, challenges, and stipulations.
4. **Introduction and court history.** Production, exhibit marking, offer, objections, rulings, admission scope, and publication.
5. **Discussion record.** Who discussed the item, their capacity, exact citations or locators, and the nature of discussion.
6. **Competing descriptions.** A neutral table listing assertions, source, status, support, and contradiction links.
7. **Open issues.** Missing custody receipt, incomplete hash verification, unresolved foundation objection, or ambiguous exhibit mapping.
8. **Integrity receipt.** Dataset snapshot ID, generation time, query parameters, and graph/hash manifest.

### Dossier language rules

- Use neutral wording: “Party A asserts,” “Witness B testified,” “The court ruled,” “The record does not show.”
- Never use “proves,” “authentic,” “admissible,” or “established” without identifying the authority and limited scope of that conclusion.
- Distinguish source evidence from analysis and legal argument.

---

## 13. Skill: Answer provenance questions

### Name
`legal-provenance-query`

### Goal
Answer targeted legal evidence questions from the graph with source-linked, qualified results.

### Supported question types

```yaml
question_types:
  - "Who introduced this item?"
  - "Who first produced or collected this item?"
  - "Who handled this item between two dates?"
  - "What is the chain of custody?"
  - "Was the item offered, admitted, excluded, or admitted for a limited purpose?"
  - "Who authenticated or challenged it?"
  - "What did each witness say about it?"
  - "What competing descriptions exist?"
  - "Which derivative was used at trial?"
  - "What gaps or integrity exceptions exist?"
```

### Response contract

Every answer must return:

```yaml
answer: "Short, qualified answer"
confidence: high | medium | low
basis:
  - event_or_assertion_id: "..."
    source_locator: "..."
    provenance_path: ["..."]
qualifications:
  - "Offer of evidence is not an admission ruling."
unresolved_issues:
  - "No recipient receipt is recorded for the transfer on 2026-08-18."
```

### Example query results

**Question:** Who introduced PX-17?

**Answer:** Plaintiff’s counsel offered representation `REP-2026-000184-02` as PX-17 during the August 21 hearing. The record reflects an offer for the purpose of showing notice; that offer is distinct from the later admission decision. The source is transcript reference 145:8–146:3.

**Question:** Was PX-17 admitted?

**Answer:** The court admitted PX-17 for the limited purpose of showing notice, not for the truth of the matter asserted, subject to a limiting instruction. The ruling should be read with its stated scope and any later modification.

---

## 14. Skill: Detect provenance gaps and contradictions

### Name
`legal-provenance-quality-check`

### Goal
Find missing links, integrity anomalies, ambiguous identity mappings, and material contradictions before producing a legal-facing report.

### Checks

- Evidence representation has no hash, or hash algorithm is absent.
- A custody transfer lacks sender, recipient, time, acknowledgement, or authority.
- A time gap exists between custody events without a recorded storage or possession event.
- A derivative has no identified source representation or processing activity.
- A court disposition exists with no linked offer or authority source.
- An assertion lacks speaker, source locator, date, or capacity.
- A summary exists without a source artifact.
- Exhibit number maps to multiple representations without a proceeding-specific mapping.
- A redacted derivative is used without documenting redaction authority and source.
- A claim of admission conflicts with a recorded exclusion or limited-admission ruling.
- A hash changes during a claimed bit-for-bit transfer.

### Severity model

| Severity | Meaning | Example |
|---|---|---|
| `critical` | Integrity or identity issue that can undermine reliance | Hash mismatch after transfer |
| `high` | Material missing provenance or unresolved court status | Claimed admission without order or transcript citation |
| `medium` | Incomplete documentation requiring qualification | Recipient acknowledgement missing |
| `low` | Metadata or usability issue | Missing normalized summary |

### Output

```yaml
finding_id: QC-2026-00017
severity: high
subject_id: REP-2026-000184-02
rule: court_disposition_missing_authority
finding: "Admission status is recorded without a transcript, order, or minute entry locator."
recommended_action: "Attach a source representation and precise proceeding locator; do not state admission as verified until then."
```

---

## 15. Skill: Maintain an immutable event ledger

### Name
`legal-provenance-event-ledger`

### Goal
Store provenance events in a tamper-evident, append-only ledger suitable for audit, investigation, and defensible reconstruction.

### Event schema

```yaml
event_id: EVT-2026-0000001
matter_id: MAT-2026-001
event_type: evidence_intake | custody_transfer | authentication_review | evidence_offer | objection | ruling | discussion | derivation | access | export | correction
occurred_at: "2026-08-17T20:20:00Z"
recorded_at: "2026-08-17T20:20:08Z"
actor_id: AG-0007
subject_ids:
  - EV-2026-000184
  - REP-2026-000184-01
payload_hash: "<digest>"
previous_event_hash: "<digest-or-null>"
event_hash: "<digest>"
signature: "<optional detached signature>"
source_record_ids:
  - REP-2026-000184-01-intake-receipt
classification: confidential
```

### Required behavior

- Hash canonicalized event payloads.
- Chain events within a matter or evidence stream using `previous_event_hash`.
- Retain correction events rather than changing prior payloads.
- Store an export manifest and graph snapshot hash whenever a dossier or production is generated.
- Log access, export, and redaction actions as provenance activities.

---

## 16. Example: one email, multiple legal narratives

### Facts recorded, without deciding the merits

- `EV-2026-000184` is the conceptual evidence item: a purported invoice email thread.
- `REP-2026-000184-01` is the native `.msg` file received through a production portal.
- `REP-2026-000184-02` is a PDF rendering used as PX-17.
- `REP-2026-000184-03` is an OCR text extraction used for search and analytics.

### Competing assertions

| Assertion | Attributed source | Status | Relationship |
|---|---|---|---|
| “Witness A received this invoice email.” | Witness A deposition | asserted | Supports recognition/receipt claim |
| “The email was not sent by the alleged vendor.” | Defense expert report | asserted | Challenges authorship/origin claim |
| “PX-17 is offered to show notice.” | Plaintiff’s counsel | offered | States evidentiary purpose |
| “PX-17 is admitted only to show notice.” | Court ruling | court-accepted | Limits scope; does not decide truth of contents |

### What the system should say

> The graph records that the native email file was produced by the producing party, received by the evidence custodian, hash-verified at intake, and later rendered to PDF. A witness testified that they recognized it as an invoice email they received. A defense expert disputed the alleged vendor authorship. The court admitted the PDF exhibit solely to show notice. These records support different propositions and should not be merged into a single conclusion about authorship or truth.

---

## 17. JSON-LD interchange template

```json
{
  "@context": {
    "prov": "http://www.w3.org/ns/prov#",
    "leg": "https://example.org/legal-prov#",
    "dct": "http://purl.org/dc/terms/"
  },
  "@graph": [
    {
      "@id": "case:EV-2026-000184",
      "@type": ["prov:Entity", "leg:EvidenceItem"],
      "leg:hasEvidenceId": "EV-2026-000184",
      "leg:hasCustodyStatus": "received"
    },
    {
      "@id": "case:REP-2026-000184-01",
      "@type": ["prov:Entity", "leg:EvidenceRepresentation"],
      "prov:specializationOf": {"@id": "case:EV-2026-000184"},
      "dct:format": "application/vnd.ms-outlook",
      "leg:hashAlgorithm": "SHA-256",
      "leg:hasContentHash": "<digest>",
      "prov:wasGeneratedBy": {"@id": "case:ACT-intake-000184"}
    },
    {
      "@id": "case:ACT-intake-000184",
      "@type": ["prov:Activity", "leg:Acquisition"],
      "prov:endedAtTime": {
        "@value": "2026-08-17T20:20:00Z",
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime"
      },
      "prov:wasAssociatedWith": {"@id": "case:AG-0007"}
    }
  ]
}
```

---

## 18. Implementation guidance

### Suggested architecture

- **Artifact store:** Immutable storage for originals and derivatives, with object versioning and retention controls.
- **Provenance graph:** RDF/JSON-LD store or graph-capable relational schema implementing PROV relations and legal extensions.
- **Event ledger:** Append-only event table with canonical payload hashing and optional signatures.
- **Search index:** Separate search layer for OCR and extracted text; results must link back to source representations and offsets.
- **Policy engine:** Matter, role, privilege, protective-order, and disclosure controls.
- **Dossier generator:** Reproducible report builder that emits a graph snapshot ID and integrity manifest.

### Minimum relational tables

```text
matters
agents
entities
representations
activities
provenance_relations
assertions
assertion_links
custody_transfers
authentication_events
introduction_events
discussion_events
court_decisions
source_locators
integrity_checks
event_ledger
access_log
```

### Minimum APIs

```text
POST /evidence/intake
POST /evidence/{id}/custody-transfers
POST /representations/{id}/derivations
POST /representations/{id}/authentication-events
POST /representations/{id}/introductions
POST /representations/{id}/discussions
POST /representations/{id}/court-decisions
POST /assertions
POST /assertions/{id}/contradictions
GET  /evidence/{id}/provenance
GET  /evidence/{id}/dossier
GET  /quality-checks?subject_id={id}
```

---

## 19. Guardrails for legal use

- This model preserves records and provenance; it does not itself determine admissibility, authenticity, credibility, relevance, privilege, or legal sufficiency.
- Require review by authorized legal professionals for jurisdiction-specific evidentiary determinations.
- Keep legal analysis, party argument, witness testimony, technical validation, and court rulings as distinct record types.
- Avoid automated truth labels for disputed evidence. Prefer traceable assertions and scoped decisions.
- Preserve uncertainty and gaps visibly in every legal-facing output.
- Retain original language, artifacts, and source locations so a reviewer can independently inspect the basis for every generated statement.

---

## 20. Acceptance criteria

A legal evidence provenance system implementing these skills should be able to:

1. Reconstruct the complete known custody path for an item and identify undocumented intervals.
2. Show each representation and its derivation from the original or prior representation.
3. Identify who produced, collected, introduced, discussed, challenged, authenticated, or ruled on an item.
4. Distinguish offer, admission, limited admission, exclusion, and publication.
5. Preserve competing factual descriptions and link them to speakers, source material, and status.
6. Produce reproducible, source-linked dossiers with a graph snapshot and integrity manifest.
7. Prevent silent alteration of raw artifacts, provenance events, and prior assertions.
8. Enforce access controls and preserve a defensible audit trail for viewing, exporting, redacting, and sharing evidence.
