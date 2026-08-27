# Icarus integration contract

## Ownership boundary

LlamaParse owns OCR and layout recovery. This service owns page normalization
and candidate segmentation. Icarus owns the original artifact, case access,
review decisions, accepted document objects, citations, and audit history.

## Invariants

1. The original packet is immutable and identified by SHA-256.
2. A page is never discarded because it lacks text or classification.
3. Packet page number and parser page number remain explicit.
4. A detected boundary is a candidate, never an accepted document fact.
5. Repeated affidavit text is flagged as a shared-information candidate; it is
   never counted as independent corroboration automatically.
6. Exact quotations must be copied from page output and retain a page locator.
7. Parser retries must not create duplicate accepted sources.

## Suggested mapping into the existing Casework model

| Parser field | Casework destination |
| --- | --- |
| `source.sha256` | canonical artifact hash / idempotency key |
| `pages[].locator` | canonical source locator |
| `pages[].text` | source segment exact text |
| `segments[]` | Structure Review candidate |
| `segments[].fingerprint` | duplicate/version review signal |
| `parse_job_id` | provenance event metadata |
| `parser.sdk_version` and `parser.parse_version` | provenance activity/software versions |

Schema names must be resolved against the real Icarus repository before a
migration is written. The parser does not guess table or column names.

## Proposed review action

```text
candidate segment
  -> accept: create governed document object and page relationships
  -> amend: correct type/range while preserving candidate history
  -> reject: retain rejected candidate and reason
  -> defer: leave unresolved without manufacturing a document boundary
```

## Later slices

After page and boundary acceptance passes on the real packet:

1. document-version grouping;
2. warrant-device and warrant-return structured extraction;
3. assertion/event candidates with page quotes;
4. cross-packet lineage and conflict analysis;
5. retrieval, SQL, and graph query tools for the Case Question Agent.
