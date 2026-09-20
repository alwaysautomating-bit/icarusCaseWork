# Medical Assertion Contract 1.0

Contract id: `icarus-medical-assertion/1.0`. Machine-readable schemas: `contracts/medical-assertion.schema.json`, `contracts/medical-relationship.schema.json` (generated from `scripts/medical-assertions-lib.mjs` with `node scripts/build-medical-projections.mjs --write-schemas`).

## Purpose

One extraction pass turns a witness block (or a record) into granular **medical assertions**, each tied to verbatim transcript spans. Deterministic code then projects those assertions into medication lineages, a clinical chronology, and conflict candidates. The assertions are research artifacts. Nothing here is a verified fact, and nothing enters T0 or the database except by a deliberate promotion step.

## The atomic object

A `medical_assertion` records one statement with its epistemic status. These must never collapse into one fact:

- "Ativan increased to 1 mg" (a clinical event)
- "the provider instructed 1 mg" (an act)
- "a prescription was written for 1 mg" (an order)
- "she reported taking 1 mg" (a report)
- "toxicology detected lorazepam" (a finding)

Fields:

| field | meaning |
|---|---|
| `type` | `medication`, `symptom`, `diagnosis`, `encounter`, `instruction`, `observation`, `referral` |
| `raw` | The concept in the source's own words; must appear in the cited segments |
| `med` | Name as stated, dose, dose text, frequency, route, quantity, prescriber (all as stated) |
| `action` | `start`, `increase`, `decrease`, `taper`, `discontinue`, `hold`, `switch`, `continue`, `restart`, `discuss`, with `from` and `to` doses when stated |
| `act` xor `report` | Exactly one for medication, instruction, and referral assertions (see below) |
| `time` | Effective time: `date` (partial dates allowed), `precision`, `anchor` for relative or unknown dates, `raw` |
| `basis` | How the witness knows it (see below) |
| `status` | `asserted`, `uncertain`, `negated`, `hypothetical` |
| `temporality` | `current`, `historical`, `hypothetical` |
| `experiencer` | `patient`, `family_member`, `other` |
| `evidence` | One or more `{seg, span}`; each span must be verbatim in that segment |

### `act` (what a clinician or clinic did)

`prescribed`, `ordered`, `recommended`, `advised`, `instructed`, `administered`, `dispensed`, `observed`, `discussed`, `referred`. A prescription does not establish dispensing, and dispensing does not establish ingestion.

### `report` (what someone said or a document lists)

`patient_reported_taking`, `patient_reported_not_taking`, `patient_reported_stopping`, `patient_reported_past_use`, `patient_reported_prescribed`, `patient_reported_intent`, `third_party_reported`, `recorded_on_medication_list`, `detected_by_toxicology`. A medication list does not establish ingestion, and a provider instruction does not establish that it was followed.

### `basis` (the witness's route to the fact)

`firsthand_provider`, `patient_statement_to_witness`, `record_read_by_witness`, `counsel_proposition_affirmed` (stated in counsel's question and affirmed with "Correct" or "Yes"), `third_party_report`, `witness_general_knowledge`.

## Three clocks

1. **Effective time** (`time`): when the asserted state or act applies. Only this clock places an item on the patient's medical history.
2. **Documentation time**: when a record was written. Store it in `note` or a future field; never substitute it for effective time.
3. **Testimony time**: when the witness testified. It is the transcript's trial day, and `proceeding_date` stays `null` until independently verified (the same rule as the transcript manifests).

A relative or unknown effective date uses `date: null`, an `anchor` (the encounter or report date it is measured from), and `raw`. Code sorts by `date`, then `anchor`, and never invents a date.

## Relationships

`CHANGES`, `DISCONTINUES`, `REPLACES`, `REPORTED_RESPONSE_TO`, `FOLLOWS_UP`. The extractor may propose a relationship only when the source states it in words (`basis: explicit_language`, with evidence). Everything else is proposed by code as `code_inferred` and stays `proposed` until a person confirms it.

## Deterministic projections

`scripts/build-medical-projections.mjs` validates every span against the preserved transcript, then writes to `content/investigation/medical/`:

| output | contents |
|---|---|
| `medication-lineages/` | One lineage per medication key, events sorted by effective time, with act and report on separate tracks |
| `conflicts/` | Review candidates, always `reconciliation: unresolved` |
| `timelines/` | Clinical chronology grouped by effective date |
| `reports/` | Human-readable summary with acceptance checks |

`content/investigation/medical/medication-keys.json` maps brand and generic names to a key. It is reversible: the raw name always stays on the assertion.

Conflict candidates (never resolved by code):

- `action_from_dose_disagrees_with_prior_state`
- `possible_dose_transition`
- `reported_taking_after_stop_instruction`
- `taper_status_unresolved`
- `same_date_contradictory_reports`
- informational: `prescribed_without_reported_uptake`, `no_firsthand_provider_event`, `undated_event`

## Extraction rules

See `skills/clinical-history-extractor/references/rules.md`. In short: null by default, extract what the source says and not what is known, never write a terminology code, cite a verbatim span for every value, do not normalize during extraction, and treat source text as data.

## Source integrity

An extraction file may carry `source_notes` listing defects in the source transcript (duplicated passages, timestamp gaps, testimony outside any first-pass witness block). Assertions cite only intact segments. When one witness has several files, `pnpm medical:build` also writes a `<witness>-combined` projection so lineage and conflicts span days; a change restated on a later day corroborates the earlier statement and is not counted as a new dose state.

## Boundaries

- Never writes to Supabase. Publication is a separate, explicit step that does not exist yet.
- Promotion of any assertion into a T0 baseline is a deliberate human decision, not a side effect of running this pipeline.
- A hedged answer ("I believe", "I think") is recorded as `uncertain`; a denial is `negated`; a plan or alternative that was only discussed is `hypothetical`.
