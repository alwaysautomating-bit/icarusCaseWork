# Corroborating Sources

## Purpose

This folder contains sources used to **establish, constrain, corroborate, contextualize, or challenge the reconstructed timeline of events**.

Files in this folder should not automatically be treated as legal evidence. A source's **type**, **evidentiary status**, and **role in the timeline** are separate attributes.

The purpose of this collection is to preserve the underlying material that helps explain **why an event is placed where it is in the reconstructed chronology**.

## Timeline Source Categories

### Testimony

Sworn witness testimony describing events, observations, actions, communications, or knowledge states.

Examples:

- Trial testimony
- Hearing testimony
- Depositions
- Sworn statements

### Documentary Evidence

Documents, records, media, or other materials that have an established evidentiary status.

Examples:

- Admitted exhibits
- Receipts
- Medical records
- Phone records
- Device extractions
- Photographs
- Surveillance footage
- Dispatch/CAD records

Whether something belongs to this category depends on its actual evidentiary status. Possessing a document does not establish that it was admitted or authenticated in a proceeding.

### Corroborating Sources

Independent material that supports, confirms, or constrains a timeline assertion.

A corroborating source may strengthen an existing assertion without independently proving the entire event.

Examples:

- Receipt matching a reported stop
- Device activity consistent with testimony
- Surveillance timestamp
- Independent witness account
- Contemporaneous communication

### Contextual Sources

Material that establishes surrounding circumstances but does not directly establish the occurrence or precise timing of an event.

Examples:

- Background records
- Later interviews
- Biographical information
- Relevant historical records
- Reporting explaining surrounding circumstances

### Investigative / Secondary Sources

Material produced through reporting, investigation, analysis, or later reconstruction rather than direct participation in the underlying event.

Examples:

- Journalism
- Published interviews
- Investigative reporting
- Documentaries
- News reports
- Secondary summaries

These sources may contain valuable factual information or point toward primary sources, but their secondary nature should remain explicit.

### Temporal Anchors

Specific timestamp-bearing facts extracted from any source.

Examples:

- Receipt: **17:37**
- Phone call: **18:09**
- Device activity: **17:38**
- Surveillance appearance: **17:54**
- Dispatch timestamp
- Message sent/received time
- Medical-record timestamp

A temporal anchor is a **timeline role**, not necessarily a source type.

### Contradicting Sources

Material that conflicts with, challenges, or materially complicates another timeline assertion.

Contradiction should be preserved rather than resolved by silently choosing one account.

Examples:

- Witness recalls 18:05 while device record indicates 18:12
- Two witnesses describe a different sequence of actions
- Testimony conflicts with a timestamped record
- Later account differs from contemporaneous documentation

## Source Type and Timeline Role Are Separate

This distinction is important.

**Source type** describes **what the material is**.

**Timeline role** describes **what that material does in the reconstruction**.

For example:

| Material | Source Type | Timeline Role |
|---|---|---|
| CVS receipt | Receipt | Temporal anchor / corroborating source |
| Witness testimony | Testimony | Event assertion |
| Surveillance video | Video | Temporal anchor / corroborating or contradicting source |
| Phone extraction | Device record | Temporal anchor / constraint |
| New Yorker article | Journalism | Corroborating and/or contextual source |
| CAD log | Dispatch record | Temporal anchor / event record |

A single source may perform multiple timeline roles.

## Evidentiary Status

Where known, record evidentiary status separately.

Suggested values include:

- Admitted exhibit
- Referenced in testimony
- Filed with court
- Sworn testimony
- Produced record
- Public record
- Secondary reporting
- Independently obtained
- Evidentiary status unknown
- Not established as trial evidence

Do not infer evidentiary status merely because a source appears reliable or contains useful information.

## Recommended Source Metadata

When practical, preserve:

- `source_type`
- `title`
- `author_or_creator`
- `publisher_or_origin`
- `publication_or_creation_date`
- `source_url`
- `accessed_date`
- `evidentiary_status`
- `timeline_role`
- `supports`
- `contradicts`
- `persons_or_entities`
- `event_ids`
- `temporal_assertions`
- `notes`
- `provenance`

## Example — Secondary Reporting

**Source:** New Yorker article  
**Source type:** Secondary reporting / journalism  
**Timeline role:** Corroborating and/or contextual source  
**Evidentiary status:** Not established as trial evidence  
**Supports:** Specific event or assertion identified during analysis  
**Provenance:** Publisher → author → publication date → canonical URL

Information extracted from the article should retain this provenance rather than being converted into an unqualified fact.

## Example — Reconstructed Event

> **17:54 — ThreeV pickup**

The event could ultimately be represented as:

- **Asserted by:** testimony
- **Corroborated by:** receipt
- **Constrained by:** surveillance timestamp
- **Context added by:** later interview
- **Contradicted by:** another account, if applicable

The reconstructed event is therefore distinct from every individual source describing it.

## Core Principle

**Preserve the source. Preserve what it actually says. Preserve its provenance. Then record what role it plays in the reconstruction.**

Timeline placement should remain traceable back to the underlying material.

A source can support an event without proving it.  
A source can constrain an event without describing it.  
A source can provide context without establishing chronology.  
Multiple sources can support different parts of the same reconstructed event.

The goal is not simply to produce a chronology. The goal is to produce a chronology in which every placement can answer:

**Why do we believe this happened, why is it placed here, what constrains that placement, and what source supports each conclusion?**