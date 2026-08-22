---
name: evidence-integrity
description: Doctrine for designing, handling, and evaluating evidence in operational systems — particularly where records may need to withstand audit, legal scrutiny, or dispute resolution. Use when designing audit trails, defining what counts as proof, building document storage systems, or evaluating whether existing evidence would hold up. Covers immutable evidence handling, chain of truth, timestamp logic, GPS expectations, proof standards, and source-of-truth hierarchy. Trigger on audit trail design, compliance architecture, document vault, evidence review, or any "will this hold up" question.
---

# Evidence Integrity Skill

Evidence that can be altered is not evidence. Evidence that cannot be traced to its origin is not evidence. Evidence that exists only in someone's memory is not evidence.

**If it isn't logged, timestamped, and linked to its parent entity, it didn't happen — operationally.**

---

## Chain of Truth

Every piece of evidence has a chain: where it came from, when it entered the system, who submitted it, and what it was attached to. A broken chain reduces the evidence value of everything downstream from the break.

### Chain of Truth Components
1. **Origin**: Where did this evidence come from? (vendor, field operator, system-generated, third party)
2. **Ingestion timestamp**: When did it enter the system? (server-side, not client-reported)
3. **Actor**: Who submitted or created it?
4. **Parent entity**: What is this evidence about? (invoice, vendor, payment, transaction, inspection)
5. **State at ingestion**: What was the state of the parent entity when this evidence was recorded?
6. **Subsequent events**: Has this evidence been viewed, acted on, or referenced? By whom, when?

---

## Immutable Evidence Standards

Evidence records must be:

- **Append-only**: New information can be added, but existing records cannot be modified
- **Server-timestamped**: Timestamps are assigned by the server at the moment of creation, not reported by the client
- **Actor-attributed**: Every record knows who created it (authenticated user or named system process)
- **Non-deletable**: Even if content is suppressed or redacted, the record of the record's existence must persist
- **Version-preserving**: If a document is replaced or updated, both versions are retained

### What "Immutable" Does Not Mean
Immutable does not mean unreadable or unprocessable. It means the original state is always retrievable. You can add context, annotations, or status changes — but you cannot change what was recorded at creation.

---

## Timestamp Logic

Timestamps are the backbone of evidentiary timelines. Weak timestamp practices collapse entire cases.

### Timestamp Standards
- **Always server-side**: Client devices can have wrong clocks, manipulated clocks, or timezone misconfiguration. The server timestamp is authoritative.
- **UTC storage**: Store in UTC, display in local timezone. Never store local time without timezone offset.
- **Creation + modification separate**: A record should have a `created_at` (immutable) and `updated_at` (changes on every modification), never just one.
- **Ingestion vs. event time**: Distinguish between when something happened and when it was recorded. Both matter. A photo taken at 2pm submitted at 4pm has two relevant timestamps.

### Timestamp Failure Modes
- Client-reported timestamps used as authoritative (vulnerable to manipulation)
- Only `updated_at` stored — creation time lost
- Timezone ambiguity in stored records
- Batch processing timestamps all records with the batch time rather than individual submission times

---

## GPS and Location Evidence

For field operations, location data strengthens evidence considerably.

### When Location Matters
- Construction progress photos
- Field inspection records
- Mobile capture from site
- Delivery confirmation
- Any photo evidence tied to a physical location claim

### Location Evidence Standards
- GPS coordinates captured at the time the evidence is created (not the time the record is submitted)
- Accuracy radius documented when available (GPS coordinates without accuracy context are weaker)
- Location claimed in the record must be consistent with coordinates (if a photo claims to show Site A but GPS says Site B, that is a flag)

### Location Evidence Limitations
- GPS can be spoofed — location data alone is not conclusive
- Indoor locations may have low GPS accuracy
- Location is supporting evidence, not primary proof

**"If it isn't geo-locked, it isn't proof of location."** This doesn't mean location-less evidence is invalid — it means you cannot use it to prove a location claim.

---

## Proof Standards by Evidence Type

Different evidence types have different inherent strength. Know the hierarchy.

| Evidence Type | Strength | Conditions |
|---|---|---|
| **Third-party inspection report** | High | Inspector is licensed, independent, timestamped |
| **System-generated log** | High | Audit trail is immutable, server-timestamped |
| **Timestamped, geo-located photo** | Medium-High | Metadata intact, location consistent with claim |
| **Signed document from counterparty** | Medium-High | Signature verified, document unmodified |
| **Email from verified domain** | Medium | Not spoofed, domain matches vendor record |
| **Photo without metadata** | Low-Medium | Can establish what, not when or where |
| **Self-reported completion** | Low | No third-party confirmation |
| **Verbal statement (unlogged)** | Minimal | Cannot be verified or reconstructed |
| **Memory** | Not evidence | Cannot be introduced as record |

---

## Source-of-Truth Hierarchy

When multiple sources contain information about the same fact, which one is authoritative?

### Default Hierarchy (can be overridden by system design)
1. **System-generated records** (logs, automated events) — highest authority for operational facts
2. **Third-party verified documents** (inspections, notarized documents, government-issued IDs)
3. **Vendor record** (your own database of record, maintained under controlled conditions)
4. **Counterparty-submitted documents** (invoices, lien waivers, certificates)
5. **Email and correspondence** (useful for context, lower for authoritative facts)
6. **Verbal representations** (documented contemporaneously — see #1)

**The invoice is never the source of truth for vendor information.** The vendor record is. This is a foundational principle that cannot be overridden.

---

## Audit Reconstruction Standards

A system has adequate evidence integrity if it can reconstruct:

- **What happened**: The sequence of events with timestamps
- **Who acted**: Authenticated actors at each step
- **What they knew**: The state of the system at the time each decision was made
- **What they did with it**: Actions taken in response
- **What changed**: Before/after state for any modification
- **What was not done**: Gaps in expected process (a required step that was skipped is itself evidence)

### Audit Reconstruction Test
Can you answer these questions using system records alone, without calling anyone?
- Who approved this payment and when?
- Was any flag raised before approval? How was it resolved?
- When was this document submitted? By whom?
- Has this document been modified since submission? If so, when and by whom?
- What was the vendor's risk status at the time of payment?

If any answer requires a phone call, the evidence architecture is insufficient.

---

## Document Vault Design Principles

For systems that store operational documents:

- **Immutable storage**: Documents submitted cannot be overwritten (new version creates new record, old version preserved)
- **Access logging**: Every access to a sensitive document is logged (who, when, what action)
- **Expiration tracking**: Documents with expiration dates (insurance certificates, licenses) trigger alerts before expiration
- **Linkage**: Every document is linked to its parent entity (cannot exist as an orphan)
- **Retrieval audit**: The ability to retrieve a document is itself evidence — preserve retrieval logs
- **Redundancy**: Evidence that exists in only one location is vulnerable; backup strategy required

---

## Red Flags in Evidence Quality

These patterns indicate evidence that may not withstand scrutiny:

- Documents submitted after the fact to explain an already-completed transaction
- Photos that lack EXIF metadata (may have been downloaded, not captured live)
- Timestamps that are suspiciously round (12:00:00, 9:00:00) — may indicate manual entry
- Documents that refer to events that happened before the document's creation date
- Multiple documents with identical metadata (same GPS, same timestamp) that shouldn't be identical
- Evidence submitted in bulk at end of period rather than contemporaneously
- Any evidence that was "reconstructed" rather than captured at the time
