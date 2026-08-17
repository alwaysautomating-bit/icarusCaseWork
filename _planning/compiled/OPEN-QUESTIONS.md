# Open Questions

## Kickoff Readiness

Current status: `READY`

The second compiler pass incorporated the approved ontology, proof obligation, probabilistic boundary, and first-wedge framing. No new contradiction appeared that would block kickoff.

## Resolved In This Pass

### 1. Canonical evidence ontology

Resolved:

- `SourceArtifact` is the immutable evidence object.
- `Document` is a format/type classification of `SourceArtifact`.
- `Source` is provenance context, not a catch-all object.

### 2. Claim and Hypothesis roles

Resolved:

- `Claim` is a first-class evidentiary assertion.
- `Hypothesis` is a Projection.

### 3. V1 proof obligation

Resolved with explicit approved language.

### 4. Probabilistic boundary

Resolved:

- The evidence substrate remains authoritative.
- Probabilistic output is always a Projection.
- V1 may include constrained feasibility testing only.

### 5. First wedge framing

Resolved:

- true-crime and public-record research first;
- casework architecture underneath;
- approved demonstration case: Lindsay Clancy.

## Remaining Questions After Readiness

These remain important, but they no longer block kickoff:

### 1. Exact persisted schema for source, claim, event, and lineage structures

Need implementation choices for:

- exact citation-location structure;
- event-time vs report-time storage;
- claim-lineage representation;
- whether `SystemNode` is modeled as a canonical entity or role wrapper.

## Important Non-Blockers

These are important but do not currently block kickoff by themselves:

- Exact database schema
- Full Supabase design
- Exact frontend stack
- Full app directory structure
- Final probabilistic library shape
- Full transcript ingestion strategy

Those belong after the project contract is explicit.

## Current Compiler Decision

`READY FOR KICKOFF`

Why:

- the load-bearing ontology decisions are now explicit;
- the v1 proof obligation is approved;
- the probabilistic layer is bounded behind the evidence substrate;
- the first wedge framing is explicit;
- no contradiction appeared in the second compiler pass that forces another planning loop before kickoff.
