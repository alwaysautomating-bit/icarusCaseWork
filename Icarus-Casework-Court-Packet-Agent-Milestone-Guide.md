# Icarus Casework Court-Packet Agent

## Step-by-step guide to the first working milestone

**Milestone:** From inside an authenticated Icarus case, upload a large image-only court packet, preserve the original, run LlamaParse OCR, detect the documents inside it, and create a page-grounded review bundle. No extracted assertion becomes an accepted case fact until a human approves it.

The supplied Lindsay Clancy Part 2 packet is the final acceptance fixture. It is a 177-page, image-only scan with no embedded text. It contains structured court forms, handwriting, warrant returns, affidavits, and attachments.

---

## 1. Freeze the release boundary

Build only this path in the first release:

1. User opens a case.
2. User chooses **Sources → Add source → Court packet**.
3. Icarus validates and preserves the original PDF.
4. A background ingestion job runs OCR and parsing.
5. Icarus creates packet pages and proposed document boundaries.
6. The agent extracts candidate metadata and assertions with page evidence.
7. Icarus detects exact duplicates and probable versions.
8. A human reviews the result.
9. Only approved records are published to the case graph.

Defer conversational question answering, whole-corpus search, guilt assessment, medical diagnosis, credibility scoring, and automated final publication.

### Definition of done

The milestone passes when the 177-page packet can be uploaded once and Icarus produces:

- one immutable source record and original-file hash;
- 177 page records in the original order;
- OCR output for every readable page;
- proposed document segments with inclusive page ranges;
- extracted document identifiers, dates, actors, devices, and candidate assertions;
- exact-page citations for every candidate assertion;
- duplicate/version groups that do not inflate corroboration;
- review tasks for handwriting, uncertain OCR, conflicts, and incomplete material;
- no accepted case facts before explicit human approval;
- a successful retry after a simulated parser or network interruption;
- no duplicate evidence when the same packet is uploaded again.

---

## 2. Start from the existing Icarus substrate

Before changing code, inspect:

- `README.md`, `AGENTS.md`, and repository policy files;
- package manifests and lockfiles;
- the existing Rev testimony intake route, services, database writes, and tests;
- existing `sources`, `assertions`, `propositions`, attribution, audit, case membership, and acquisition tables;
- Supabase migrations, Storage policies, and generated types;
- the existing case/source UI and provenance components.

Reuse the testimony pipeline's established rules:

- authenticated case-scoped intake;
- immutable source snapshots;
- atomic publication;
- RLS and per-case isolation;
- authenticated audit attribution;
- duplicate-source reuse;
- extraction separated from verification and reconciliation.

Do not create a second evidence ontology when an existing table can be extended safely.

### Suggested repository location

```text
IcarusCasework/
  app/ or src/
    cases/[caseId]/sources/new/court-packet/
  services/
    court-packet-agent/
      agent.py
      main.py
      models.py
      tools/
      docs/prompt.md
      pyproject.toml
      README.md
      evals/
  supabase/
    migrations/
  tests/
    court-packet/
```

Use a normal OpenAI Agents SDK `Agent` with narrow function tools. A `SandboxAgent` is unnecessary for this milestone because file handling, parsing, validation, and persistence can be implemented as controlled server tools.

---

## 3. Create a feature branch and capture the contract

Create a branch using the repository's naming convention, for example:

```bash
git switch -c feature/court-packet-ingestion
```

Add a short contract to the service README:

| Contract item | Decision |
|---|---|
| Agent goal | Turn one preserved packet into a grounded review bundle |
| Input | `case_id`, `source_id`, authenticated actor, stored PDF locator |
| Output | Packet summary, pages, document segments, candidate assertions, version groups, review tasks |
| Tools | Register, parse, retrieve pages, segment, extract, deduplicate, validate, stage review bundle |
| State | Durable ingestion job with explicit stage and retry metadata |
| Approval | Required before publishing accepted assertions or propositions |
| Side effects | Storage and database writes scoped to one case and source |
| Sandbox | No |

---

## 4. Add the server-side dependencies and credential gate

Prefer a small Python service for the Agents SDK and LlamaParse integration:

```bash
cd services/court-packet-agent
uv init
uv add openai-agents llama-cloud pydantic fastapi uvicorn httpx
```

Pin versions in `uv.lock`.

Required server-only environment variables:

```text
OPENAI_API_KEY
LLAMA_CLOUD_API_KEY
SUPABASE_URL
SUPABASE_SECRET_KEY
```

Use the currently configured server secret naming convention. Never expose the Supabase secret or either provider API key through `NEXT_PUBLIC_*`, browser JavaScript, logs, traces, or committed files.

Before the first live OpenAI run, complete the OpenAI API-key confirmation gate. Before sending case material to LlamaParse, add an administrative setting or intake notice confirming that the selected packet is authorized for third-party processing and that the configured retention policy is acceptable.

---

## 5. Add the minimum database model

Generate a migration through the repository's existing Supabase CLI workflow:

```bash
supabase migration new court_packet_ingestion
```

Adapt names to the existing schema. Add only the missing concepts.

### `packet_ingestion_jobs`

| Field | Purpose |
|---|---|
| `id` | Durable job ID |
| `case_id` | Case boundary |
| `source_id` | Immutable source being processed |
| `created_by` | Authenticated actor |
| `stage` | Explicit current stage |
| `attempt_count` | Retry accounting |
| `parser_job_id` | LlamaParse job reference |
| `parser_version` | Reproducibility |
| `started_at`, `finished_at` | Timing |
| `last_error_code` | Machine-readable failure |
| `last_error_detail` | Sanitized diagnostic detail |

Recommended stages:

```text
received
secured
parse_queued
parsing
parse_complete
segmenting
extracting
validating
review_ready
failed
cancelled
```

### `packet_pages`

Store `source_id`, original `page_number`, OCR markdown/text, parser item metadata, image locator when retained, parse confidence, and content hash. Page numbers are one-based and immutable.

### `packet_documents`

Store `source_id`, `document_type`, `page_start`, `page_end`, title, dates, identifiers, canonical document ID, version label, extraction status, and review status.

Initial document types:

```text
search_warrant
warrant_return
affidavit
attachment
motion
order
inventory
cover_sheet
unknown
```

### `document_version_links`

Store the canonical group, member document, relationship (`exact_duplicate`, `probable_duplicate`, `revised_version`, `attachment_copy`), comparison method, and review status.

### `extraction_review_tasks`

Store the target record, issue type, severity, explanation, source page, status, assignee, and resolution audit fields.

Use existing assertion, proposition, attribution, entity, event, and audit tables rather than creating parallel versions.

### Database safety requirements

- Enable RLS on every new table exposed through the Data API.
- Scope policies through case membership/ownership, not `TO authenticated` alone.
- Give update policies both `USING` and `WITH CHECK` clauses.
- Prefer security-invoker views.
- Keep privileged functions out of exposed schemas when possible.
- Do not use user-editable metadata for authorization.
- Run local RLS tests and Supabase advisors before finalizing the migration.

---

## 6. Create a private, immutable packet store

Create or reuse a private Supabase Storage bucket for original evidence, for example:

```text
case-source-originals
```

Use a stable object path:

```text
cases/{case_id}/sources/{source_id}/original/{sha256}.pdf
```

Rules:

- Accept PDF only for this first release.
- Validate both MIME type and file signature.
- Reject encrypted, malformed, or policy-exceeding files with an explicit error.
- Calculate SHA-256 before registering the source as secured.
- Never overwrite an existing original.
- Treat a matching hash in the same case as an idempotent replay.
- Restrict reads to authorized case members and the ingestion service.
- Use resumable uploads for large packets.

After upload, write the source record and immutable audit event in one controlled server path. If either write fails, do not start parsing.

---

## 7. Build the Court Packet upload UI

Add the entry point:

```text
Case → Sources → Add source → Court packet
```

The form needs:

- file selector/drop zone;
- case name and source type shown clearly;
- processing/retention notice;
- optional source description;
- authorization checkbox;
- upload progress;
- cancel/retry controls;
- a clear message that extracted information requires review.

After submission, navigate to the packet workspace and display stages:

```text
Securing original
Parsing pages
Detecting documents
Extracting candidates
Checking citations and versions
Ready for review
```

Do not hold the browser request open while the 177-page parse runs. Return the ingestion job ID and let the UI poll or subscribe to durable state changes.

---

## 8. Implement LlamaParse as a deterministic tool

Create a `start_parse_job` function tool. Its input should contain only validated internal identifiers and a server-resolved file locator.

Recommended LlamaParse configuration:

- agentic tier for the court-packet acceptance run;
- pin a tested parser version for reproducibility;
- OCR language `en`;
- return page-level markdown/text;
- request items/spatial metadata needed for evidence grounding;
- retain page screenshots or bounding information only when the review UI uses them;
- preserve original page order and page numbers.

The LlamaParse SDK supports file upload, job polling, OCR parameters, page-level outputs, and expanded result types. In production, persist the provider job ID immediately so the worker can resume after a restart.

Implement:

1. Upload the preserved source to LlamaParse.
2. Start the parse job.
3. Store the parser job ID and pinned version.
4. Poll asynchronously with bounded backoff.
5. Treat completed, failed, and cancelled as terminal provider states.
6. Retrieve and validate every returned page.
7. Store parser artifacts before segmentation.
8. Mark `parse_complete` only when page-count validation passes.

Never silently replace an unreadable page with an empty successful page. Create a review task for missing or unreadable output.

---

## 9. Implement the Agents SDK orchestrator

Start with one agent and typed structured outputs.

Recommended tools:

```text
get_ingestion_context
start_parse_job
retrieve_parsed_pages
store_parsed_pages
propose_document_segments
extract_document_candidates
resolve_document_versions
validate_grounding
stage_review_bundle
```

The agent instructions should require:

- operate only on the supplied case/source/job;
- preserve source wording and attribution;
- separate direct observations, primary records, witness statements, hearsay reports, investigator inferences, and boilerplate;
- keep missing values `null`;
- never back-compute or invent dates, amounts, identities, quotes, or page references;
- label uncertain OCR for review;
- treat repeated documents as repeated representations of one source lineage;
- avoid guilt, diagnosis, credibility, and legal-conclusion judgments;
- stop before authoritative publication.

The agent coordinates tools and creates the review bundle. Deterministic code owns file access, hashing, provider calls, page validation, database writes, authorization, and approval enforcement.

---

## 10. Segment the packet into document objects

Do not send all 177 pages to one unconstrained extraction prompt.

Use two passes:

### Pass A: boundary proposal

Process page summaries in bounded batches with overlap. Detect likely starts and ends using:

- court-form titles;
- docket/warrant numbers;
- repeated headers;
- signatures and certification blocks;
- affidavit paragraph numbering;
- attachment labels;
- blank or separator pages;
- major shifts in layout and vocabulary.

### Pass B: boundary reconciliation

Reconcile overlapping batch proposals and require:

- every packet page is accounted for;
- document page ranges stay within the packet;
- unexplained gaps are rejected;
- overlaps require an explicit attachment/copy relationship;
- low-confidence boundaries create review tasks;
- `unknown` is allowed when the evidence does not support a type.

The output is a list of proposed document objects, not accepted classifications.

---

## 11. Extract grounded casework candidates

Run extraction per proposed document, using page-scoped content and the document type.

Each candidate assertion must include:

```yaml
assertion_text:
normalized_fact:
asserted_by:
source_type:
source_document_id:
source_page:
source_quote:
source_region:
event_time:
people: []
entities: []
provenance_type:
extraction_status: confirmed | ambiguous | missing
evidentiary_status: unreviewed
confidence:
```

Keep `extraction_status` separate from `evidentiary_status`. A correctly transcribed allegation can be extraction-confirmed while remaining evidentially unreviewed.

For every field:

- confirmed means the page directly supports the extracted value;
- ambiguous means the page is conflicting, unclear, handwritten, or OCR-degraded;
- missing means no supporting evidence was found and the value remains `null`;
- a blank string or zero must never substitute for a missing date, amount, duration, or identifier.

---

## 12. Resolve duplicates and versions without manufacturing corroboration

Use layered comparison:

1. Exact original-page/image hashes.
2. Normalized OCR-text hashes.
3. Shared court identifiers and page structure.
4. Text similarity with page alignment.
5. Agent-proposed version differences, always reviewable.

For each group, retain:

- every physical occurrence in the packet;
- one canonical logical document;
- the lineage between copies and versions;
- additions, deletions, and changed assertions;
- the independent origin, when known.

Corroboration counts independent source origins. Five copies of substantially the same affidavit count as one originating assertion unless another independent source supports it.

---

## 13. Add a grounding validator before review

`validate_grounding` should run deterministic checks:

- cited page exists;
- cited page belongs to the proposed document range;
- source quote appears in the stored OCR text, allowing only documented normalization;
- bounding/spatial reference resolves when supplied;
- asserted speaker/source is present or explicitly unknown;
- missing fields remain null;
- dates retain their original precision;
- repeated allegations retain shared lineage;
- boilerplate is marked as boilerplate and excluded from case-fact publication;
- no assertion cites a packet summary instead of a source page.

Failures create review tasks. They do not disappear from the audit trail.

---

## 14. Stage an atomic review bundle

When validation finishes, write a review bundle containing:

- packet summary;
- page inventory;
- proposed document list;
- candidate entities and events;
- candidate assertions and attribution chains;
- duplicate/version groups;
- conflicts and missing material;
- validation results;
- review tasks.

The transaction must either create the complete review bundle or create none of it. Provider artifacts may already exist, but the case-facing review state cannot be partially published.

At this stage, write candidate/unreviewed records only. The approval action should be a separate authenticated command that records the reviewer, timestamp, accepted/rejected fields, edits, and source lineage.

---

## 15. Build the packet review workspace

Use the existing Icarus visual grammar and provenance components.

Recommended layout:

- **Left:** page thumbnails and detected-document groups;
- **Center:** original page image with OCR/text toggle;
- **Right:** extracted fields, assertions, lineage, and review controls;
- **Bottom or secondary tab:** timeline, entities, conflicts, and version comparison.

Every assertion card needs an **Open source page** action. Clicking it should open the exact packet page and highlight the supporting region when available.

Review actions:

```text
Accept
Edit and accept
Mark ambiguous
Reject extraction
Merge duplicate
Separate sources
Correct document boundary
Escalate
```

The UI must distinguish extraction confidence from evidentiary review status.

---

## 16. Test in increasing levels of difficulty

### Level 1: deterministic unit tests

Test file signature validation, SHA-256 idempotency, state transitions, page-range validation, null preservation, exact-quote validation, and duplicate counting.

### Level 2: small integration fixture

Create a 5-10 page fixture containing:

- one search warrant;
- one return;
- several affidavit pages;
- one repeated page;
- one handwritten value;
- one absent field.

Run through the real LlamaParse and Agents SDK path.

### Level 3: failure and security tests

Require tests for:

- unauthenticated upload;
- cross-case access attempt;
- unauthorized Storage read;
- parser timeout and restart;
- provider failure after upload;
- job retry without duplicate pages;
- same packet uploaded twice;
- malformed or encrypted PDF;
- incomplete parser page count;
- atomic rollback;
- approval required for publication;
- service secrets absent from client bundles and logs.

### Level 4: agent evals

Add `evals/cases.jsonl`, `graders.py`, and `run_local.py`. Grade the real workflow for:

- document-boundary coverage;
- correct document type or justified `unknown`;
- null preservation;
- page/quote grounding;
- required review escalation;
- forbidden legal/medical conclusions;
- duplicate lineage;
- repeated allegations not counted as independent corroboration;
- approval boundary enforcement.

Write results to `evals/results/latest.json` and exit non-zero on failure.

### Level 5: the 177-page acceptance packet

Finally run the supplied image-only packet. Record:

- upload and parse duration;
- parser version and configuration;
- total pages received and stored;
- detected document count and types;
- unreadable/ambiguous pages;
- number of candidate assertions;
- grounding pass/fail counts;
- duplicate/version groups;
- review-task count;
- retry and idempotency result;
- human corrections to boundaries, OCR, and extracted fields.

Do not define the gold standard from the agent's own first output. Review the packet manually and save a human-approved manifest for subsequent regressions.

---

## 17. Make the service runnable and observable

Required local service behavior:

- `uv run python main.py` starts HTTP service when `PORT` is set;
- `/health` reports process readiness;
- a separate dependency check reports OpenAI, LlamaParse, and database/storage availability without exposing secrets;
- structured logs use job, case, and source IDs but never raw document content or credentials;
- traces record tool names, durations, statuses, and sanitized errors;
- ingestion jobs can resume after process restart.

Suggested local commands:

```bash
pnpm dev
supabase start
cd services/court-packet-agent
PORT=8421 uv run python main.py
curl -fsS http://127.0.0.1:8421/health
```

Adapt commands to the repository's established local environment.

---

## 18. Final verification checklist

- [ ] Original PDF stored privately and immutably.
- [ ] SHA-256 recorded and duplicate upload is idempotent.
- [ ] 177 packet pages preserved in order.
- [ ] OCR output is page-addressable.
- [ ] Parser version/configuration recorded.
- [ ] Durable job survives restart and retry.
- [ ] Every page belongs to a proposed document or explicit unknown segment.
- [ ] Every assertion has a valid source page and supporting quote/region.
- [ ] Missing values remain null.
- [ ] Handwriting and weak OCR create review tasks.
- [ ] Boilerplate does not become a case fact.
- [ ] Duplicate affidavits share lineage.
- [ ] Repeated allegations do not inflate corroboration.
- [ ] RLS blocks cross-case access.
- [ ] Review bundle commits atomically.
- [ ] Publication requires human approval.
- [ ] Supabase security/performance advisors are reviewed.
- [ ] Unit, integration, security, and agent eval suites pass.

---

## Codex implementation prompt

Paste this into Codex while the Icarus Casework repository is open:

> Implement the first Court Packet Agent milestone in this repository. Begin by inspecting the repository instructions, current Rev testimony intake, Supabase schema/RLS/Storage policies, source/assertion/proposition/attribution models, and existing tests. Reuse the established immutable-source and atomic-publication patterns. Add authenticated court-packet PDF intake, a private immutable source object, durable ingestion jobs, page-level LlamaParse OCR, proposed document segmentation, grounded candidate extraction, duplicate/version lineage, deterministic grounding validation, and a human review bundle. Use one Python OpenAI Agents SDK agent with narrow function tools. Keep all provider calls and secrets server-side. Do not publish accepted case facts automatically. Preserve nulls, require page-level evidence, distinguish extraction status from evidentiary status, classify boilerplate separately, and prevent repeated affidavit copies from counting as independent corroboration. Build and pass a small real-path fixture before testing the supplied 177-page image-only packet. Add RLS, idempotency, retry, rollback, grounding, approval-boundary, and cross-case isolation tests. Stop and report any schema conflict or policy decision that would alter the existing Casework doctrine.

---

## Current references

- OpenAI Agents SDK guide: https://developers.openai.com/api/docs/guides/agents
- OpenAI agent evaluations: https://developers.openai.com/api/docs/guides/agent-evals
- LlamaParse getting started: https://developers.llamaindex.ai/llamaparse/parse/getting_started/
- Supabase Storage: https://supabase.com/docs/guides/storage
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
