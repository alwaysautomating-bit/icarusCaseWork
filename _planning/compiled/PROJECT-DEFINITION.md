# Project Definition

## Project

Name: Icarus Casework

Status: Kickoff Ready

Compiler Pass Date: 08-13-2026
Compiler Pass: 2

## Purpose

Icarus Casework is a case-reconstruction workspace that turns heterogeneous source material into an attributable, source-linked operational record. Its purpose is to help a researcher move from scattered documents, testimony, reporting, communications, and records to a defensible reconstruction of what was claimed, what evidence supports or contradicts those claims, how the timeline evolved, and what remains unknown.

## Problem

Current case research workflows collapse different epistemic layers together. Reported claims, verified observations, repeated allegations, creator interpretation, and later narrative hardening gradually become indistinguishable. This makes it difficult to reconstruct what actually entered the record, who originated it, which evidence is independent, what changed over time, and where the record is still unresolved.

## Product Definition

The current first-wedge product is a case-reconstruction environment for public-record research, beginning with true-crime and adjacent public-interest case analysis. It is not yet a clinical tool, legal-evidence platform, law-enforcement system, or diagnosis engine.

The current product promise is:

> What was claimed, by whom, based on what, when did it enter the record, what independently supports it, what contradicts it, and which reconstructions remain consistent with the available evidence?

## V1 Proof Obligation

Given a bounded corpus of public or authorized case materials, Icarus Casework can produce a reproducible, source-linked longitudinal reconstruction that separates reported claims from supported events, preserves contradictions and source lineage, shows cumulative change over time, and tests the conditions required by competing accounts.

## Current V1 Shape

The current compiled definition supports a V1 centered on:

- case ingestion of heterogeneous public-record material;
- source reading with page- and timestamp-level provenance;
- attributed claim extraction that does not silently promote claims to facts;
- entity resolution across people, aliases, organizations, devices, locations, and records;
- layered timeline construction with explicit uncertainty;
- evidence-backed narrative and case-brief outputs;
- constrained feasibility testing for competing accounts.

## Current V1 Deliverables

- A source-linked case room
- A source reader
- Claim extraction and lineage
- Entity and relationship resolution
- A layered timeline
- An evidence / contradiction view
- A cited story builder or case brief output

## Current V1 Boundaries

In scope for V1:

- Public-record case reconstruction
- Attributed claims
- Time-indexed events
- Explicit provenance and uncertainty
- Contradictions, gaps, and unresolved intervals
- Supportable narrative outputs

Explicitly out of scope for V1:

- Guilt or innocence scoring
- Automated credibility verdicts
- Psychiatric diagnosis engines
- Court-admissibility claims
- Private medical-record collection
- Direct law-enforcement integrations
- Clinical recommendations
- Fully generalized probabilistic verdict engines
- Latent-state modeling as authoritative substrate
- Responsibility allocation as a required v1 subsystem
- Population-derived risk estimation as a required v1 subsystem

## Current Architectural Layers

- Core substrate:
  Immutable source artifacts, attributed claims, reviewed observable events, entities, relationships, chronology, provenance, and uncertainty.
- Casework domain:
  Claims, witnesses, testimony, filings, proceedings, competing accounts, case chronology.
- Reasoning capabilities:
  Claim lineage, corroboration independence, contradiction analysis, constrained temporal feasibility testing, and evidence-aware competing-account evaluation.
- Product projections:
  Timeline, evidence map, source reader, case brief, cited narrative builder.
- Advanced modules:
  Rich Scenario Lab, Monte Carlo reconstruction beyond constrained feasibility, Bayesian comparison, responsibility allocation, longitudinal pattern-of-life analysis, latent-state modeling, and population-derived risk estimation.

## Approved First Wedge

True-crime and public-record research first; casework architecture underneath.

The product positioning, interface, demonstration corpus, and acceptance tests should serve true-crime researchers and long-form content creators in V1. The underlying data model and reconstruction engine remain case-agnostic for later domains.

Approved demonstration case: Lindsay Clancy.

## V1 Success Conditions

V1 succeeds when:

- every material statement traces to an exact source location;
- repeated claims with one origin are not presented as independent corroboration;
- event time and report time remain distinct;
- conflicting accounts coexist;
- a researcher can reconstruct who reported what, what the record supports, and what remains unresolved;
- at least two competing accounts can be tested against explicit conditions; and
- another researcher can reproduce the output from the same evidence snapshot.

## Current Compiler Conclusion

The approved ontology, proof obligation, probabilistic boundary, and first-wedge framing remove the main semantic blockers from the first pass. No new contradiction appeared during the second compiler pass. The project now appears sufficiently defined to invoke Project Kickoff.

Current kickoff readiness: `READY`
