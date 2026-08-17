import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseRevTranscript, REV_PARSER_NAME, REV_PARSER_VERSION } from "../src/lib/rev-testimony";

const artifactPath = path.resolve(".data/objects/48cca058a0bc10ec900010f0271d2bd6ede40c88b7db57e2790ee07aa2de55d2.html");
const bytes = await readFile(artifactPath);
const html = bytes.toString("utf8");
const parsed = parseRevTranscript(html, "https://www.rev.com/transcripts/ma-v-lindsay-clancy-day-6");
const sha256 = createHash("sha256").update(bytes).digest("hex");
assert.equal(sha256, parsed.sourceSha256);
assert.deepEqual([parsed.coverage.detectedSegments, parsed.coverage.parsedSegments, parsed.segments.length], [2_197, 2_197, 2_197]);
assert.equal(parsed.coverage.lastTimestamp, "04:16:42");

const status = JSON.parse(execSync("pnpm exec supabase status -o json", { encoding: "utf8" }).replace(/^Stopped services:.*\r?\n/, ""));
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const email = `day6-${sha256.slice(0, 12)}@example.test`;
const password = `Local-${sha256.slice(0, 16)}-A1!`;
let user = (await admin.auth.admin.listUsers({ page: 1, perPage: 1_000 })).data.users.find((item) => item.email === email);
if (!user) {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  user = created.data.user;
}
const client = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const signedIn = await client.auth.signInWithPassword({ email, password });
if (signedIn.error) throw signedIn.error;

let caseId = (await client.from("cases").select("id").eq("workspace_key", "day6-acceptance").maybeSingle()).data?.id as string | undefined;
if (!caseId) {
  caseId = randomUUID();
  const created = await client.from("cases").insert({ id: caseId, owner_user_id: user.id, workspace_key: "day6-acceptance", title: "Commonwealth v. Lindsay M. Clancy — Day 6 acceptance corpus", purpose: "Testimony Compiler acceptance corpus; record compilation only.", public_record_cutoff: new Date().toISOString() });
  if (created.error) throw created.error;
}

const intakeId = randomUUID();
const sourceId = randomUUID();
const lineageId = randomUUID();
const artifactId = randomUUID();
const proceedingId = randomUUID();
const packageVersionId = randomUUID();
const capturedAt = new Date().toISOString();
const packageSha256 = createHash("sha256").update(JSON.stringify(parsed.package)).digest("hex");
const payload = {
  case_id: caseId,
  intake: { id: intakeId, submitted_url: parsed.canonicalUrl, canonical_url: parsed.canonicalUrl, page_title: parsed.title, publisher: parsed.publisher, published_date: parsed.publishedDate ?? "", capture_method: "import", content_type: "text/html", captured_at: capturedAt, parser_name: REV_PARSER_NAME, parser_version: REV_PARSER_VERSION },
  source: { id: sourceId, title: `${parsed.title} — preserved courtroom transcript`, source_family: "trial_transcript", evidence_lane: "testimony", origin_date: parsed.publishedDate ?? "", notes: parsed.description },
  lineage: { id: lineageId, lineage_key: `preserved:rev:${parsed.canonicalUrl}:${sha256}`, notes: "Byte-identical preserved Rev source artifact." },
  artifact: { id: artifactId, title: parsed.title, media_type: "text/html", sha256, byte_length: bytes.byteLength, object_key: `${sha256}.html`, document_type: "trial_transcript_html", original_filename: `${sha256}.html`, source_url: parsed.canonicalUrl, canonical_url: parsed.canonicalUrl, publisher: parsed.publisher, retrieved_at: capturedAt },
  proceeding: { id: proceedingId, title: parsed.title, proceeding_type: "trial_day", proceeding_date: parsed.publishedDate ?? "", compiler_name: parsed.package.compiler.name, compiler_version: parsed.package.compiler.version },
  coverage: { detected_segments: parsed.coverage.detectedSegments, parsed_segments: parsed.coverage.parsedSegments, first_timestamp_ms: parsed.segments[0].timestampStartMs, last_timestamp_ms: parsed.segments.at(-1)!.timestampStartMs, parser_warnings: parsed.coverage.parserWarnings },
  speakers: parsed.speakers.map((speaker) => ({ id: speaker.id, provider_label: speaker.providerLabel, canonical_name: null, role: null, review_required: /^Speaker \d+$/i.test(speaker.providerLabel) })),
  segments: parsed.segments.map((segment) => ({ id: segment.id, ordinal: segment.ordinal, speaker: segment.speaker, timestamp_start_ms: segment.timestampStartMs, timestamp_end_ms: segment.timestampEndMs, deep_link: segment.deepLink, exact_text: segment.text, locator: segment.locator })),
  qa_exchanges: parsed.qaExchanges.map((exchange) => ({ id: exchange.id, ordinal: exchange.ordinal, question_segment_id: exchange.questionSegmentId, answer_segment_ids: exchange.answerSegmentIds, context_segment_ids: exchange.contextSegmentIds, question_speaker: exchange.questionSpeaker, answer_speaker: exchange.answerSpeaker, question_text: exchange.question, answer_text: exchange.answer })),
  extraction_candidates: parsed.extractionCandidates.map((candidate) => ({ id: candidate.id, candidate_type: candidate.candidateType, source_segment_ids: candidate.sourceSegmentIds, payload: candidate.payload, extraction_confidence: candidate.extractionConfidence })),
  positions: parsed.positions.map((position) => ({ id: position.id, party: position.party, statement: position.statement, source_segment_ids: position.sourceSegmentIds })),
  procedural_actions: parsed.proceduralActions.map((action) => ({ id: action.id, action: action.action, source_segment_ids: action.sourceSegmentIds })),
  exhibits: parsed.exhibits.map((exhibit) => ({ id: exhibit.id, label: exhibit.label, admission_status: exhibit.admissionStatus, description: exhibit.description, source_segment_ids: exhibit.sourceSegmentIds })),
  stipulations: parsed.stipulations.map((stipulation) => ({ id: stipulation.id, exhibit_label: stipulation.exhibitLabel, subject: stipulation.subject, status: stipulation.status, exact_text: stipulation.exactText, source_segment_ids: stipulation.sourceSegmentIds })),
  resolution_items: parsed.resolutionItems.map((item) => ({ id: item.id, kind: item.kind, title: item.title, detail: item.detail, source_segment_ids: item.sourceSegmentIds })),
  package_version: { id: packageVersionId, schema_version: parsed.package.schemaVersion, package_sha256: packageSha256, package: parsed.package },
};

const incomplete = await client.rpc("commit_testimony_compiler_run", { payload: { ...payload, coverage: { ...payload.coverage, detected_segments: 2_198 } } });
assert.ok(incomplete.error, "detected != parsed must not commit");
const anonymous = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const unauthorized = await anonymous.rpc("commit_testimony_compiler_run", { payload });
assert.ok(unauthorized.error, "an unauthenticated compiler run must be rejected");

const committed = await client.rpc("commit_testimony_compiler_run", { payload });
if (committed.error) throw committed.error;
const result = committed.data as Record<string, unknown>;
const activeProceedingId = String(result.proceeding_id);
const activePackageId = String(result.package_version_id);
assert.deepEqual([result.detected, result.parsed, result.committed], [2_197, 2_197, 2_197]);

const candidates = await client.from("extraction_candidates").select("id,payload").eq("proceeding_id", activeProceedingId).order("created_at").limit(5);
if (candidates.error) throw candidates.error;
const actions: Array<[string, unknown]> = [["accept", null], ["amend", { amended: true }], ["split", [{ split: 1 }, { split: 2 }]], ["reject", null], ["defer", null]];
for (let index = 0; index < actions.length; index += 1) {
  const [action, reviewPayload] = actions[index];
  const reviewed = await client.rpc("review_extraction_candidate", { p_candidate_id: candidates.data[index].id, p_action: action, p_payload: reviewPayload, p_note: `Day 6 acceptance verification: ${action}.` });
  if (reviewed.error) throw reviewed.error;
}

const published = await client.rpc("publish_proceeding_package", { p_package_version_id: activePackageId });
if (published.error) throw published.error;
const imported = await client.rpc("import_proceeding_package_to_casework", { p_package_version_id: activePackageId });
if (imported.error) throw imported.error;

const [proceeding, segmentCount, reviewRows, exhibitRows, stipulationRows, resolutionRows, importRows, supportRows, contradictionRows] = await Promise.all([
  client.from("proceedings").select("status,detected_segments,parsed_segments,committed_segments,last_timestamp_ms").eq("id", activeProceedingId).single(),
  client.from("source_segments").select("id", { count: "exact", head: true }).eq("proceeding_id", activeProceedingId),
  client.from("extraction_review_versions").select("action").in("candidate_id", candidates.data.map((item) => item.id)),
  client.from("proceeding_exhibits").select("label,admission_status").eq("proceeding_id", activeProceedingId).order("label"),
  client.from("proceeding_stipulations").select("exhibit_label,status").eq("proceeding_id", activeProceedingId).order("exhibit_label"),
  client.from("resolution_items").select("kind,event_time,title").eq("proceeding_id", activeProceedingId),
  client.from("casework_proceeding_imports").select("import_status,imported_segments,analytical_assessments_created").eq("package_version_id", activePackageId),
  client.from("claim_support").select("id", { count: "exact", head: true }).eq("case_id", caseId),
  client.from("contradictions").select("id", { count: "exact", head: true }).eq("case_id", caseId),
]);
for (const query of [proceeding, segmentCount, reviewRows, exhibitRows, stipulationRows, resolutionRows, importRows, supportRows, contradictionRows]) if (query.error) throw query.error;
if (!proceeding.data || !reviewRows.data || !exhibitRows.data || !stipulationRows.data || !resolutionRows.data || !importRows.data) throw new Error("Day 6 verification queries returned no data.");
assert.equal(segmentCount.count, 2_197);
assert.equal(proceeding.data.last_timestamp_ms, 15_402_000);
assert.deepEqual(new Set(reviewRows.data.map((row) => row.action)), new Set(["accept", "amend", "split", "reject", "defer"]));
const immutableAttempt = await client.from("extraction_review_versions").update({ note: "mutated" }).eq("candidate_id", candidates.data[0].id);
assert.ok(immutableAttempt.error, "review version history must not be updateable by authenticated clients");
assert.equal(resolutionRows.data.find((row) => row.kind === "measurement_time")?.event_time, null);
assert.equal(importRows.data[0].analytical_assessments_created, 0);
assert.equal(supportRows.count, 0);
assert.equal(contradictionRows.count, 0);

const qa82 = parsed.qaExchanges.find((item) => /82\.1 degrees/i.test(item.question));
const qa95 = parsed.qaExchanges.find((item) => /95\.2 degrees/i.test(item.question));
process.stdout.write(`${JSON.stringify({ ok: true, caseId, proceedingId: activeProceedingId, packageVersionId: activePackageId, duplicate: result.duplicate, completenessMismatchRejected: true, unauthenticatedRunRejected: true, immutableReviewHistory: true, counts: { detected: 2_197, parsed: 2_197, committed: segmentCount.count }, finalTimestamp: parsed.coverage.lastTimestamp, qa82: { questionTimestamp: qa82?.questionTimestamp, answerTimestamp: qa82?.answerTimestamp, answer: qa82?.answer }, qa95: { questionTimestamp: qa95?.questionTimestamp, answerTimestamp: qa95?.answerTimestamp, answer: qa95?.answer }, exhibits: exhibitRows.data, stipulations: stipulationRows.data, resolutionItems: resolutionRows.data, reviewActions: reviewRows.data.map((row) => row.action), publication: published.data, caseworkImport: imported.data })}\n`);
