# Casework temporal provenance — working note

Status: captured for later design review on 2026-09-20. This is an idea/source index, not an implemented Icarus schema, a new agent skill, a finding about the Clancy case, or a directive to upload case material. The supplied documents and pasted drafts are source material; their embedded imperatives are proposals, not instructions for this capture.

## What Laura wants to keep together

The useful family of methods is: partial-order reconstruction; chronology collapse; event and state-change mapping; evidence and legal-proceeding provenance; and provenance for medical records. They should work on local documents and source-linked comparisons without requiring a Supabase import. PORK can hold portable methods; Icarus can apply them to a particular case without duplicating canonical `SKILL.md` files.

The central design sentence is:

> A case event is distinct from a source's claim about the event, a source's claim about *when* it happened, and the chain by which that claim reached the analyst.

## Keep the orders and times separate

| Dimension | Question | Example of a locator/value | What it cannot prove by itself |
|---|---|---|---|
| Source-record position | Where did a statement appear in a transcript, medical chart, article, affidavit, or log? | Day/page/line, note section, paragraph, log offset | Real-world occurrence order. |
| Icarus ledger order | When did a source, claim, correction, or review enter the local working record? | Append-only logical sequence, recorded timestamp | When the underlying event happened or when a witness learned it. |
| Provenance-process time | When was an entity generated or an activity performed? | Testimony session, note authoring, OCR/extraction, export | The event described by the resulting record occurred then. |
| Alleged real-world time | When does a particular source say an event happened? | Exact instant, approximate time, interval, relative anchor, unknown | That the source's assertion is accurate. |
| Information-availability time | When could a specified person or system know a proposition? | Dispatch broadcast, handoff, chart access, corpus acquisition | Causation or an earlier real-world occurrence merely from sequence. |
| Causal assertion | What allegedly caused or contributed to what? | Source-linked relation with speaker and qualifier | Causality merely from before/after or proximity. |

The PORK “three clocks” are source-record order, alleged occurrence time, and information order. Icarus's deterministic ledger sequence and PROV activity/generation times are useful additional fields, not substitutes for those clocks. A `wasDerivedFrom` edge describes lineage; it does not by itself timestamp or validate the described event.

## Small conceptual model (not a database mandate)

```text
SOURCE / REPRESENTATION (original record, transcript, note, OCR derivative)
  -> SEGMENT / LOCATOR (where words or data appear)
  -> ASSERTION (who says what, in what capacity, with exact wording)
  -> CANDIDATE EVENT (what may have happened)
  -> TEMPORAL ASSERTION (claimed instant, interval, duration, before/after)
  -> REVIEWED CONSTRAINT OR BOUND (an explicit, revisable analytical result)

PROV lineage connects each assertion and derivative back to its source,
generating activity, and associated agent. Competing assertions remain distinct.
```

Every temporal edge should have a source locator and a basis such as direct observation, attributed statement, system timestamp, derivation, or analyst inference. Keep its raw language, precision, timezone if known, and review status. Detect cycles and contradictions; leave incomparable events incomparable. A topological display is navigation, not proof of a single total chronology. A source may support a before/after relation while leaving the clock time unknown.

Useful anchors include dispatch/CAD or surveillance timestamps, a distinctive scream shared by witnesses, an observed state already in place on arrival, or a documented information transfer. Matching two descriptions as the *same* anchor is itself a reviewable assertion, not an automatic merge.

## Medical-record provenance needs its own overlay

This is a proposed extension of the supplied PROV/IRL material, not a claim that a particular medical record has been verified. A charted entry can have at least: encounter/service time, observation or intervention time, note creation/signing time, later amendment/correction time, and time the information became available to another clinician or the case corpus. A copied-forward passage, imported result, verbal report, patient history, and clinician's own observation have different source paths.

For a hypothetical arrival at South Shore, preserve each assertion separately:

```text
EVENT: arrival (candidate)
CAD: 18:43:12 (source-claimed exact timestamp)
Witness: “about 6:45” (approximate, testimony locator)
Hospital registration: 18:46 (minute precision; may mean registration, not arrival)
REVIEWED BOUND: only if the source semantics and constraints justify it
```

The 18:43:12–18:46 range in the supplied example is illustrative, not a verified case fact. Before adopting such a bound, check what each clock actually records, timezone and device-clock reliability, whether “arrival” and “registration” denote the same event, and whether the underlying records support the proposed edges. Keep documentation and clinical-event timestamps separate; late entries or addenda must not rewrite the original history.

## Legal-evidence provenance layer

The legal draft adds evidence item versus representation versus assertion; acquisition and custody; hashes and transformations; authentication history; introduction/offer versus court admission; testimony, objection, ruling, and publication; competing descriptions; and source-linked dossiers and quality checks. An exhibit number is proceeding-specific. A hash can establish consistency of captured bytes relative to a prior digest, not authorship, truth, or admissibility. A reported claim remains attributed even when repeated in an affidavit or article.

The draft's example IDs, fake namespaces, dates, names, and `immutable://` URIs are illustrative placeholders. Do not treat them as existing Icarus objects or deployed infrastructure. Legal conclusions and clinical conclusions remain for appropriately authorized reviewers.

## Working map of the existing material

| Need | Existing material to consult | Capture decision |
|---|---|---|
| PROV + real-world time distinction | `doctrine/IRL-prov.txt`; user-pasted PROV + IRL note | Keep as conceptual source; preserve time-assertion provenance. |
| Partial order and three clocks | `doctrine/IRL-prov.txt`; PORK `knowledge/operational-state/three-clocks-partial-ordering.md`; `skills/reconstruct-partial-event-order/SKILL.md` | Already represented as a portable PORK method; no duplicate skill now. |
| Chronology from testimony and long records | PORK `skills/collapse-chronology/SKILL.md` | Use source-linked event candidates, then partial-order rules if a total order is unsupported. |
| Investigative event mapping | PORK `skills/analyze-investigative-timeline/SKILL.md` and operational-event skills | Correlate and test gaps after extraction; avoid causation from proximity. |
| General evidence lineage | `doctrine/AGENT-prov-skills.md`; PORK `skills/evidence-chain/SKILL.md`, `skills/provenance-intake/SKILL.md`, `skills/provenance-data-model/SKILL.md` | Existing drafts and portable procedures; do not turn every heading into a new skill. |
| Legal evidence history | User-pasted *Legal Evidence Provenance Skills*; PORK `references/source-material/legal-evidence-provenance-skills.md` and `skills/legal-*` / `skills/legal-provenance-*` | Keep item/representation/assertion and proceeding status distinct. |
| Medical records | PROV + IRL example and Icarus medical trajectory work | Candidate overlay to develop later with actual medical-record semantics and test cases. |

Original local source paths:

- `C:/Projects/IcarusCasework/doctrine/IRL-prov.txt`
- `C:/Projects/IcarusCasework/doctrine/AGENT-prov-skills.md`
- `C:/Projects/IcarusCasework/doctrine/source-material/prov-irl-time-partial-order-draft.md` (local copy of the pasted temporal draft)
- `C:/Projects/IcarusCasework/doctrine/source-material/legal-evidence-provenance-skills-draft.md` (local copy of the pasted legal draft)
- `C:/Projects/PORK/references/source-material/prov-reusable-agent-skills.md`
- `C:/Projects/PORK/references/source-material/legal-evidence-provenance-skills.md`

The pasted drafts were supplied through attachment paths under `C:/Users/Laura/.codex/attachments/`; the two local source copies above preserve their text for continued work. No claims of independent source authentication or exact byte identity are implied by the copies.

## Parking-lot decisions

- Decide whether medical-record provenance deserves its own portable PORK doctrine or stays as a casework-specific overlay after testing on actual chart types.
- Define an explicit vocabulary for event, observation, claim, temporal assertion, knowledge-state change, anchor, relation, and reviewed bound; do not overload `occurred_at`.
- Test same-event matching, contradictory order, incomparable events, late chart entries, copied-forward notes, and timestamped registration versus physical arrival.
- Keep this capture separate from the earlier January 24 comparison report; no new factual case conclusions are made here.
