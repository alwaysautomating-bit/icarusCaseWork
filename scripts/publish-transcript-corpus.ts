import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { compilePreservedTranscriptManifest, compileUnifiedProceeding, type IntakeManifest } from "../src/lib/proceeding-compiler";
import { REV_PARSER_NAME, type ProceedingPackageV1 } from "../src/lib/rev-testimony";

type CorpusInput = {
  key: string;
  artifactPath: string;
  artifactName: string;
  manifest?: IntakeManifest & { source: IntakeManifest["source"] & { source_display_date?: string | null } };
  package: ProceedingPackageV1;
  bytes: Buffer;
};

type PublicationResult = {
  key: string;
  proceedingId: string;
  packageVersionId: string;
  duplicate: boolean;
  sourceSha256: string;
  sourceUrl: string | null;
  proceedingType: string;
  detected: number;
  parsed: number;
  committed: number;
  firstTimestamp: string;
  finalTimestamp: string;
  speakers: number;
  qaExchanges: number;
  extractionCandidates: number;
  testimonyClaimCandidates: number;
  positions: number;
  proceduralActions: number;
  exhibits: number;
  stipulations: number;
  resolutionItems: number;
  publicationStatus: "published";
};

function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function timestamp(milliseconds: number) {
  const total = Math.floor(milliseconds / 1_000);
  return [Math.floor(total / 3_600), Math.floor((total % 3_600) / 60), total % 60].map((part) => String(part).padStart(2, "0")).join(":");
}

function rowsOrThrow<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("Supabase returned no data.");
  return result.data;
}

function validatePackage(input: CorpusInput) {
  const proceeding = input.package;
  const segmentIds = new Set(proceeding.segments.map((segment) => segment.id));
  assert.equal(segmentIds.size, proceeding.segments.length, `${input.key}: segment IDs must be unique`);
  assert.deepEqual(
    [proceeding.coverage.detectedSegments, proceeding.coverage.parsedSegments, proceeding.segments.length],
    [proceeding.segments.length, proceeding.segments.length, proceeding.segments.length],
    `${input.key}: detected = parsed = package segments`,
  );
  assert.equal(proceeding.source.sha256, sha256(input.bytes), `${input.key}: package SHA must match preserved bytes`);
  const sourced = [
    ...proceeding.extractionCandidates,
    ...proceeding.positions,
    ...proceeding.proceduralActions,
    ...proceeding.exhibits,
    ...proceeding.stipulations,
    ...proceeding.resolutionItems,
  ];
  for (const item of sourced) {
    assert.ok(item.sourceSegmentIds.length > 0, `${input.key}: every compiled item needs exact source segments`);
    assert.ok(item.sourceSegmentIds.every((id) => segmentIds.has(id)), `${input.key}: compiled item cites a foreign segment`);
  }
  for (const exchange of proceeding.qaExchanges) {
    assert.ok(segmentIds.has(exchange.questionSegmentId));
    assert.ok(exchange.answerSegmentIds.length > 0 && exchange.answerSegmentIds.every((id) => segmentIds.has(id)));
  }
  if (proceeding.proceeding.type === "opening_statements") {
    assert.ok(proceeding.positions.length > 0, "Opening statements must preserve party positions.");
    assert.ok(proceeding.positions.every((position) => position.evidenceStatus === "not_evidence"));
    const positionSegments = new Set(proceeding.positions.flatMap((position) => position.sourceSegmentIds));
    assert.ok(!proceeding.extractionCandidates.some((candidate) => candidate.candidateType === "testimony_claim" && candidate.sourceSegmentIds.some((id) => positionSegments.has(id))), "Opening advocacy cannot become testimony claims.");
  }
}

function requestedTrialDays() {
  const values = process.argv.slice(2);
  if (values.length === 0) return null;

  const days = values.map((value) => Number(value));
  assert.ok(days.every((day) => Number.isInteger(day) && day > 0), "Transcript day arguments must be positive integers.");
  return new Set(days);
}

async function loadInputs(selectedDays: Set<number> | null): Promise<CorpusInput[]> {
  const inputs: CorpusInput[] = [];
  const manifestDirectory = path.resolve("transcripts/manifests");
  const manifestFiles = (await readdir(manifestDirectory))
    .map((filename) => ({ filename, match: /^Lindsay-Clancy_Trial-Day-(\d{2,3})_Intake-Manifest\.json$/.exec(filename) }))
    .filter((entry): entry is { filename: string; match: RegExpExecArray } => entry.match !== null)
    .map((entry) => ({ filename: entry.filename, day: Number(entry.match[1]) }))
    .filter((entry) => selectedDays === null || selectedDays.has(entry.day))
    .sort((a, b) => a.day - b.day);

  if (selectedDays !== null) {
    const discoveredDays = new Set(manifestFiles.map((entry) => entry.day));
    const missingDays = [...selectedDays].filter((day) => !discoveredDays.has(day));
    assert.deepEqual(missingDays, [], `No intake manifest exists for requested day(s): ${missingDays.join(", ")}`);
  }

  for (const { day, filename } of manifestFiles) {
    const key = `day-${day}`;
    const manifestPath = path.join(manifestDirectory, filename);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as CorpusInput["manifest"];
    assert.ok(manifest);
    assert.equal(manifest.trial_day, day, `${filename}: filename day must match manifest trial_day`);
    const artifactPath = path.resolve("transcripts/preserved", manifest.source.preserved_filename);
    const bytes = await readFile(artifactPath);
    const compiled = compilePreservedTranscriptManifest(manifest, bytes.toString("utf8"));
    inputs.push({ key, artifactPath, artifactName: manifest.source.preserved_filename, manifest, package: compiled, bytes });
  }
  if (selectedDays === null) {
    const artifactPath = path.resolve("fixtures/ma-v-lindsay-clancy-opening-statements.rev.txt");
    const bytes = await readFile(artifactPath);
    const artifactName = path.basename(artifactPath);
    const compiled = compileUnifiedProceeding({ provider: "rev", representation: "rev_plain_text", artifactName, sourceUrl: null, proceedingType: "opening_statements" }, bytes.toString("utf8"));
    inputs.push({ key: "opening-statements", artifactPath, artifactName, package: compiled, bytes });
  }
  assert.ok(inputs.length > 0, "No transcript inputs matched the publication request.");
  return inputs;
}

function compilerPayload(input: CorpusInput, caseId: string) {
  const proceeding = input.package;
  const sourceUrl = proceeding.source.canonicalUrl;
  const capturedAt = new Date().toISOString();
  const artifactRelativePath = path.relative(process.cwd(), input.artifactPath).replaceAll("\\", "/");
  const mediaType = input.artifactName.toLowerCase().endsWith(".md") ? "text/markdown" : "text/plain";
  return {
    case_id: caseId,
    intake: {
      id: randomUUID(),
      submitted_url: sourceUrl,
      canonical_url: sourceUrl,
      page_title: proceeding.proceeding.title,
      publisher: proceeding.proceeding.publisher,
      published_date: input.manifest?.source.source_display_date ?? proceeding.proceeding.proceedingDate ?? "",
      capture_method: "import",
      content_type: mediaType,
      captured_at: capturedAt,
      parser_name: REV_PARSER_NAME,
      parser_version: proceeding.compiler.version,
    },
    source: {
      id: randomUUID(),
      title: `${proceeding.proceeding.title} — preserved transcript`,
      source_family: "trial_transcript",
      evidence_lane: "testimony",
      origin_date: proceeding.proceeding.proceedingDate ?? "",
      notes: "User-preserved Rev transcript artifact compiled through the provider-neutral Testimony Compiler.",
    },
    lineage: { id: randomUUID(), lineage_key: `preserved:sha256:${proceeding.source.sha256}`, notes: "Byte-identical preserved source artifact; unknown URLs remain null." },
    artifact: {
      id: randomUUID(),
      title: proceeding.proceeding.title,
      media_type: mediaType,
      sha256: proceeding.source.sha256,
      byte_length: input.bytes.byteLength,
      object_key: artifactRelativePath,
      document_type: proceeding.proceeding.type === "opening_statements" ? "opening_statements_transcript" : "trial_day_transcript",
      original_filename: input.artifactName,
      source_url: sourceUrl,
      canonical_url: sourceUrl,
      publisher: proceeding.proceeding.publisher,
      retrieved_at: capturedAt,
    },
    proceeding: {
      id: randomUUID(),
      title: proceeding.proceeding.title,
      proceeding_type: proceeding.proceeding.type,
      proceeding_date: proceeding.proceeding.proceedingDate ?? "",
      compiler_name: proceeding.compiler.name,
      compiler_version: proceeding.compiler.version,
    },
    coverage: {
      detected_segments: proceeding.coverage.detectedSegments,
      parsed_segments: proceeding.coverage.parsedSegments,
      first_timestamp_ms: proceeding.segments[0].timestampStartMs,
      last_timestamp_ms: proceeding.segments.at(-1)!.timestampStartMs,
      parser_warnings: proceeding.coverage.parserWarnings,
    },
    speakers: proceeding.speakers.map((speaker) => ({ id: speaker.id, provider_label: speaker.providerLabel, canonical_name: null, role: null, review_required: /^(Speaker \d+|Unidentified speaker)$/i.test(speaker.providerLabel) })),
    segments: proceeding.segments.map((segment) => ({ id: segment.id, ordinal: segment.ordinal, speaker: segment.speaker, timestamp_start_ms: segment.timestampStartMs, timestamp_end_ms: segment.timestampEndMs, deep_link: segment.deepLink || null, exact_text: segment.text, locator: segment.locator })),
    qa_exchanges: proceeding.qaExchanges.map((exchange) => ({ id: exchange.id, ordinal: exchange.ordinal, question_segment_id: exchange.questionSegmentId, answer_segment_ids: exchange.answerSegmentIds, context_segment_ids: exchange.contextSegmentIds, question_speaker: exchange.questionSpeaker, answer_speaker: exchange.answerSpeaker, question_text: exchange.question, answer_text: exchange.answer })),
    extraction_candidates: proceeding.extractionCandidates.map((candidate) => ({ id: candidate.id, candidate_type: candidate.candidateType, source_segment_ids: candidate.sourceSegmentIds, payload: candidate.payload, extraction_confidence: candidate.extractionConfidence })),
    positions: proceeding.positions.map((position) => ({ id: position.id, party: position.party, statement: position.statement, source_segment_ids: position.sourceSegmentIds })),
    procedural_actions: proceeding.proceduralActions.map((action) => ({ id: action.id, action: action.action, source_segment_ids: action.sourceSegmentIds })),
    exhibits: proceeding.exhibits.map((exhibit) => ({ id: exhibit.id, label: exhibit.label, admission_status: exhibit.admissionStatus, description: exhibit.description, source_segment_ids: exhibit.sourceSegmentIds })),
    stipulations: proceeding.stipulations.map((stipulation) => ({ id: stipulation.id, exhibit_label: stipulation.exhibitLabel, subject: stipulation.subject, status: stipulation.status, exact_text: stipulation.exactText, source_segment_ids: stipulation.sourceSegmentIds })),
    resolution_items: proceeding.resolutionItems.map((item) => ({ id: item.id, kind: item.kind, title: item.title, detail: item.detail, source_segment_ids: item.sourceSegmentIds })),
    package_version: { id: randomUUID(), schema_version: proceeding.schemaVersion, package_sha256: sha256(JSON.stringify(proceeding)), package: proceeding },
  };
}

async function countRows(client: SupabaseClient, table: string, caseId: string) {
  const result = await client.from(table).select("id", { count: "exact", head: true }).eq("case_id", caseId);
  if (result.error) throw result.error;
  return result.count ?? 0;
}

function markdownReport(report: Record<string, unknown> & { scope: string[]; batch: PublicationResult[]; batchTotals: Record<string, number>; corpusTotalsIncludingDay6: Record<string, number> | null; integrity: Record<string, unknown> }) {
  const rows = report.batch.map((item) => `| ${item.key} | ${item.detected} | ${item.parsed} | ${item.committed} | ${item.finalTimestamp} | ${item.qaExchanges} | ${item.positions} | ${item.exhibits} | ${item.stipulations} | ${item.resolutionItems} | ${item.publicationStatus} |`).join("\n");
  return `# Testimony Compiler corpus integrity report\n\nGenerated: ${String(report.generatedAt)}\n\nScope: ${report.scope.join(", ")}. Day 6 is included only as the previously published acceptance reference. No Casework analytical assessment or import was created by this batch.\n\n| Input | Detected | Parsed | Committed | Final timestamp | Q/A | Positions | Exhibits | Stipulations | Resolution items | Package |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|\n${rows}\n\n## Batch totals\n\n- Segments: ${report.batchTotals.segments}\n- Q/A exchanges: ${report.batchTotals.qaExchanges}\n- Extraction candidates: ${report.batchTotals.extractionCandidates}\n- Positions: ${report.batchTotals.positions}\n- Procedural actions: ${report.batchTotals.proceduralActions}\n- Exhibits: ${report.batchTotals.exhibits}\n- Stipulations: ${report.batchTotals.stipulations}\n- Resolution items: ${report.batchTotals.resolutionItems}\n\n## Integrity checks\n\n- detected = parsed = committed for every proceeding: ${report.integrity.completeness ? "PASS" : "FAIL"}\n- Preserved-byte SHA-256 equals package source SHA-256: ${report.integrity.checksums ? "PASS" : "FAIL"}\n- Every compiled item cites committed source segments: ${report.integrity.provenance ? "PASS" : "FAIL"}\n- Opening advocacy remains position / not evidence when included: ${report.integrity.openingPositionsNotEvidence ? "PASS" : "FAIL"}\n- Published package for every batch input: ${report.integrity.allPublished ? "PASS" : "FAIL"}\n- Idempotent rerun reused every batch package: ${report.integrity.idempotentReuse ? "PASS" : "NOT CHECKED"}\n- Casework imports created: ${report.integrity.caseworkImports}\n- Claims/events/support/verification/contradiction assessments created: ${report.integrity.analyticalRows}\n- Missing original source URLs retained as null: ${report.integrity.missingSourceUrls}\n\n## Day 6 acceptance reference\n\n${report.day6Acceptance ? `Existing published Day 6: ${JSON.stringify(report.day6Acceptance)}\n\nPublished corpus including Day 6: ${report.corpusTotalsIncludingDay6?.proceedings} proceedings and ${report.corpusTotalsIncludingDay6?.segments} committed segments.` : "No prior Day 6 publication was found."}\n`;
}

const inputs = await loadInputs(requestedTrialDays());
for (const input of inputs) validatePackage(input);
const allSegmentIds = inputs.flatMap((input) => input.package.segments.map((segment) => segment.id));
assert.equal(new Set(allSegmentIds).size, allSegmentIds.length, "Segment IDs must be unique across the corpus.");

const statusText = (process.platform === "win32"
  ? execFileSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "pnpm exec supabase status -o json"], { encoding: "utf8" })
  : execFileSync("pnpm", ["exec", "supabase", "status", "-o", "json"], { encoding: "utf8" }))
  .replace(/^Stopped services:.*\r?\n/, "");
const status = JSON.parse(statusText) as { API_URL: string; SERVICE_ROLE_KEY: string; ANON_KEY: string };
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const corpusIdentity = sha256("icarus-testimony-corpus-publication-v1");
const email = `corpus-${corpusIdentity.slice(0, 12)}@example.test`;
const password = `Local-${corpusIdentity.slice(0, 16)}-A1!`;
let user = (await admin.auth.admin.listUsers({ page: 1, perPage: 1_000 })).data.users.find((item) => item.email === email);
if (!user) {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  user = created.data.user;
}
const client = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const signedIn = await client.auth.signInWithPassword({ email, password });
if (signedIn.error) throw signedIn.error;
let caseId = (await client.from("cases").select("id").eq("workspace_key", "testimony-corpus-publication").maybeSingle()).data?.id as string | undefined;
if (!caseId) {
  caseId = randomUUID();
  const created = await client.from("cases").insert({ id: caseId, owner_user_id: user.id, workspace_key: "testimony-corpus-publication", title: "Commonwealth v. Lindsay M. Clancy — compiled proceeding corpus", purpose: "Batch-published testimony record; no Casework analysis.", public_record_cutoff: new Date().toISOString() });
  if (created.error) throw created.error;
}

const batch: PublicationResult[] = [];
for (const input of inputs) {
  const payload = compilerPayload(input, caseId);
  const committed = await client.rpc("commit_testimony_compiler_run", { payload });
  if (committed.error) throw new Error(`${input.key}: ${committed.error.message}`);
  const result = committed.data as Record<string, unknown>;
  const proceedingId = String(result.proceeding_id);
  const packageVersionId = String(result.package_version_id);
  const published = await client.rpc("publish_proceeding_package", { p_package_version_id: packageVersionId });
  if (published.error) throw new Error(`${input.key}: ${published.error.message}`);
  const [proceedingRow, packageRow, committedSegments] = await Promise.all([
    client.from("proceedings").select("status,detected_segments,parsed_segments,committed_segments,first_timestamp_ms,last_timestamp_ms").eq("id", proceedingId).single(),
    client.from("proceeding_package_versions").select("publication_status,package_sha256").eq("id", packageVersionId).single(),
    client.from("source_segments").select("id", { count: "exact", head: true }).eq("proceeding_id", proceedingId),
  ]);
  if (proceedingRow.error) throw proceedingRow.error;
  if (packageRow.error) throw packageRow.error;
  if (committedSegments.error) throw committedSegments.error;
  assert.deepEqual([proceedingRow.data.detected_segments, proceedingRow.data.parsed_segments, proceedingRow.data.committed_segments, committedSegments.count], [input.package.segments.length, input.package.segments.length, input.package.segments.length, input.package.segments.length]);
  assert.equal(packageRow.data.publication_status, "published");
  batch.push({
    key: input.key,
    proceedingId,
    packageVersionId,
    duplicate: Boolean(result.duplicate),
    sourceSha256: input.package.source.sha256,
    sourceUrl: input.package.source.canonicalUrl,
    proceedingType: input.package.proceeding.type,
    detected: Number(result.detected),
    parsed: Number(result.parsed),
    committed: Number(result.committed),
    firstTimestamp: input.package.coverage.firstTimestamp,
    finalTimestamp: input.package.coverage.lastTimestamp,
    speakers: input.package.speakers.length,
    qaExchanges: input.package.qaExchanges.length,
    extractionCandidates: input.package.extractionCandidates.length,
    testimonyClaimCandidates: input.package.extractionCandidates.filter((candidate) => candidate.candidateType === "testimony_claim").length,
    positions: input.package.positions.length,
    proceduralActions: input.package.proceduralActions.length,
    exhibits: input.package.exhibits.length,
    stipulations: input.package.stipulations.length,
    resolutionItems: input.package.resolutionItems.length,
    publicationStatus: "published",
  });
}

const analyticalCounts = Object.fromEntries(await Promise.all(["claims", "events", "claim_support", "verification_assessments", "contradictions"].map(async (table) => [table, await countRows(client, table, caseId)]))) as Record<string, number>;
const importCount = await countRows(client, "casework_proceeding_imports", caseId);
assert.ok(Object.values(analyticalCounts).every((count) => count === 0), "Compiler publication must not create Casework analytical rows.");
assert.equal(importCount, 0, "Batch publication must not cross the Casework import boundary.");

const day6CaseQuery = await admin.from("cases").select("id").eq("workspace_key", "day6-acceptance").maybeSingle();
if (day6CaseQuery.error) throw day6CaseQuery.error;
const day6Case = day6CaseQuery.data as { id: string } | null;
let day6Acceptance: Record<string, unknown> | null = null;
if (day6Case) {
  const day6Rows = rowsOrThrow(await admin.from("proceedings").select("id,title,status,detected_segments,parsed_segments,committed_segments,last_timestamp_ms").eq("case_id", day6Case.id).limit(1)) as Array<Record<string, unknown>>;
  if (day6Rows[0]) day6Acceptance = { ...day6Rows[0], finalTimestamp: timestamp(Number(day6Rows[0].last_timestamp_ms)) };
}

const sum = (field: keyof PublicationResult) => batch.reduce((total, item) => total + Number(item[field]), 0);
const batchTotals = {
  proceedings: batch.length,
  segments: sum("committed"),
  qaExchanges: sum("qaExchanges"),
  extractionCandidates: sum("extractionCandidates"),
  testimonyClaimCandidates: sum("testimonyClaimCandidates"),
  positions: sum("positions"),
  proceduralActions: sum("proceduralActions"),
  exhibits: sum("exhibits"),
  stipulations: sum("stipulations"),
  resolutionItems: sum("resolutionItems"),
};
const report = {
  schemaVersion: "testimony-corpus-integrity/1.0",
  generatedAt: new Date().toISOString(),
  caseId,
  scope: inputs.map((input) => input.key === "opening-statements" ? "Opening Statements" : `Day ${input.manifest!.trial_day}`),
  batch,
  batchTotals,
  day6Acceptance,
  corpusTotalsIncludingDay6: day6Acceptance ? { proceedings: batchTotals.proceedings + 1, segments: batchTotals.segments + Number(day6Acceptance.committed_segments) } : null,
  integrity: {
    completeness: batch.every((item) => item.detected === item.parsed && item.parsed === item.committed),
    checksums: inputs.every((input) => input.package.source.sha256 === sha256(input.bytes)),
    provenance: true,
    openingPositionsNotEvidence: inputs.find((input) => input.key === "opening-statements")?.package.positions.every((position) => position.evidenceStatus === "not_evidence") ?? true,
    allPublished: batch.every((item) => item.publicationStatus === "published"),
    idempotentReuse: batch.every((item) => item.duplicate),
    crossCorpusSegmentIdsUnique: new Set(allSegmentIds).size === allSegmentIds.length,
    caseworkImports: importCount,
    analyticalRows: Object.values(analyticalCounts).reduce((total, count) => total + count, 0),
    analyticalCounts,
    missingSourceUrls: batch.filter((item) => item.sourceUrl === null).map((item) => item.key),
  },
};
await mkdir(path.resolve("reports"), { recursive: true });
await writeFile(path.resolve("reports/testimony-corpus-integrity.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(path.resolve("reports/testimony-corpus-integrity.md"), markdownReport(report), "utf8");
process.stdout.write(`${JSON.stringify(report)}\n`);
