import "server-only";

import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import type { CaseActor } from "@/lib/authority";
import { getCaseContext } from "@/lib/casework-supabase";
import { getObjectStorage } from "@/lib/object-storage";
import { parseRevTranscript, REV_PARSER_NAME, REV_PARSER_VERSION } from "@/lib/rev-testimony";
import { canonicalizeSubmittedUrl, captureRemoteHtml } from "@/lib/url-capture";

const testimonyUrlInput = z.object({
  url: z.url().max(2_000),
  authorized: z.literal("on"),
});

export type TestimonyIntakeResult = {
  intakeId: string;
  sourceId: string;
  artifactId: string;
  duplicate: boolean;
  segments: number;
  claims: number;
  acquisitionTargets: number;
  proceedingId: string;
  packageVersionId: string;
  detected: number;
  parsed: number;
  committed: number;
};

function databaseResult(value: unknown): TestimonyIntakeResult {
  const parsed = z.object({
    intake_id: z.uuid(),
    source_id: z.uuid(),
    artifact_id: z.uuid(),
    duplicate: z.boolean(),
    segments: z.number().int().nonnegative(),
    claims: z.number().int().nonnegative(),
    acquisition_targets: z.number().int().nonnegative(),
    proceeding_id: z.uuid(),
    package_version_id: z.uuid(),
    detected: z.number().int().positive(),
    parsed: z.number().int().positive(),
    committed: z.number().int().positive(),
  }).parse(value);
  return {
    intakeId: parsed.intake_id,
    sourceId: parsed.source_id,
    artifactId: parsed.artifact_id,
    duplicate: parsed.duplicate,
    segments: parsed.segments,
    claims: parsed.claims,
    acquisitionTargets: parsed.acquisition_targets,
    proceedingId: parsed.proceeding_id,
    packageVersionId: parsed.package_version_id,
    detected: parsed.detected,
    parsed: parsed.parsed,
    committed: parsed.committed,
  };
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 1_000) : "Unknown testimony parser failure.";
}

export async function intakeTestimonyUrl(actor: CaseActor, raw: Record<string, FormDataEntryValue>) {
  const input = testimonyUrlInput.parse(raw);
  const { supabase, caseId } = await getCaseContext(actor);
  const capture = await captureRemoteHtml(input.url);
  const sha256 = createHash("sha256").update(capture.bytes).digest("hex");
  const dataRoot = process.env.ICARUS_DATA_DIR ? path.resolve(process.env.ICARUS_DATA_DIR) : path.join(process.cwd(), ".data");
  const storedObject = await getObjectStorage(dataRoot).putImmutable({ key: `${sha256}.html`, bytes: Buffer.from(capture.bytes), contentType: capture.contentType });

  let parsed;
  try {
    parsed = parseRevTranscript(capture.html, input.url);
  } catch (error) {
    const failedId = randomUUID();
    const { error: failureWriteError } = await supabase.from("evidence_intakes").insert({
      id: failedId,
      case_id: caseId,
      submitted_url: input.url,
      canonical_url: canonicalizeSubmittedUrl(capture.finalUrl),
      capture_method: "url_capture",
      content_type: capture.contentType,
      captured_at: capture.capturedAt,
      sha256,
      original_object_key: storedObject.key,
      processing_status: "failed",
      parser_name: REV_PARSER_NAME,
      parser_version: REV_PARSER_VERSION,
      review_required: true,
      error_message: safeErrorMessage(error),
      created_by_user_id: actor.id,
    });
    if (failureWriteError) throw new Error(`${safeErrorMessage(error)} Capture preservation also failed: ${failureWriteError.message}`);
    throw error;
  }

  const intakeId = randomUUID();
  const sourceId = randomUUID();
  const artifactId = randomUUID();
  const lineageId = randomUUID();
  const proceedingId = randomUUID();
  const packageVersionId = randomUUID();
  const packageSha256 = createHash("sha256").update(JSON.stringify(parsed.package)).digest("hex");
  const payload = {
    case_id: caseId,
    intake: {
      id: intakeId,
      submitted_url: input.url,
      canonical_url: parsed.canonicalUrl,
      page_title: parsed.title,
      publisher: parsed.publisher,
      published_date: parsed.publishedDate ?? "",
      content_type: capture.contentType,
      captured_at: capture.capturedAt,
      parser_name: REV_PARSER_NAME,
      parser_version: REV_PARSER_VERSION,
      capture_method: "url_capture",
    },
    source: {
      id: sourceId,
      title: `${parsed.title} — courtroom testimony`,
      source_family: "trial_transcript",
      evidence_lane: "testimony",
      origin_date: parsed.publishedDate ?? "",
      completeness: "Rev transcript representation captured; underlying courtroom media not possessed.",
      notes: parsed.description,
    },
    lineage: { id: lineageId, lineage_key: `rev:${parsed.canonicalUrl}:${sha256}`, notes: "Canonical Rev transcript snapshot lineage." },
    artifact: {
      id: artifactId,
      title: parsed.title,
      media_type: capture.contentType.split(";")[0],
      sha256,
      byte_length: capture.bytes.byteLength,
      object_key: storedObject.key,
      document_type: "trial_transcript_html",
      source_url: input.url,
      canonical_url: parsed.canonicalUrl,
      publisher: parsed.publisher,
      retrieved_at: capture.capturedAt,
      original_filename: null,
    },
    proceeding: {
      id: proceedingId,
      title: parsed.title,
      proceeding_type: "trial_day",
      proceeding_date: parsed.publishedDate ?? "",
      compiler_name: parsed.package.compiler.name,
      compiler_version: parsed.package.compiler.version,
    },
    coverage: {
      detected_segments: parsed.coverage.detectedSegments,
      parsed_segments: parsed.coverage.parsedSegments,
      first_timestamp_ms: parsed.segments[0].timestampStartMs,
      last_timestamp_ms: parsed.segments.at(-1)?.timestampStartMs ?? parsed.segments[0].timestampStartMs,
      parser_warnings: parsed.coverage.parserWarnings,
    },
    speakers: parsed.speakers.map((speaker) => ({
      id: speaker.id,
      provider_label: speaker.providerLabel,
      canonical_name: null,
      role: null,
      review_required: /^Speaker \d+$/i.test(speaker.providerLabel),
    })),
    segments: parsed.segments.map((segment) => ({
      id: segment.id,
      ordinal: segment.ordinal,
      speaker: segment.speaker,
      timestamp_start_ms: segment.timestampStartMs,
      timestamp_end_ms: segment.timestampEndMs,
      deep_link: segment.deepLink,
      exact_text: segment.text,
      locator: segment.locator,
    })),
    claims: parsed.claims.map((claim) => ({
      id: claim.id,
      proposition_id: claim.propositionId,
      segment_id: claim.segmentId,
      speaker: claim.speaker,
      assertion: claim.assertion,
      normalized_text: claim.normalizedText,
      extraction_confidence: claim.extractionConfidence,
      source_quote: claim.sourceQuote,
      review_reasons: claim.reviewReasons,
    })),
    attributions: parsed.attributions.map((attribution) => ({
      id: attribution.id,
      claim_id: attribution.claimId,
      entity_label: attribution.entityLabel,
      attribution_role: attribution.attributionRole,
      sequence: attribution.sequence,
      notes: attribution.notes,
    })),
    media: parsed.media.map((media) => ({
      id: media.id,
      provider: media.provider,
      external_id: media.externalId,
      media_url: media.mediaUrl,
      embed_url: media.embedUrl,
    })),
    acquisitions: parsed.acquisitions.map((acquisition) => ({
      id: acquisition.id,
      title: acquisition.title,
      source_family: acquisition.sourceFamily,
      used_at_trial: acquisition.usedAtTrial,
      admitted_as_exhibit: acquisition.admittedAsExhibit,
      exhibit_number: acquisition.exhibitNumber,
      source_url: acquisition.sourceUrl,
      discovered_from_segment_id: acquisition.discoveredFromSegmentId,
      priority: acquisition.priority,
      notes: acquisition.notes,
    })),
    qa_exchanges: parsed.qaExchanges.map((exchange) => ({
      id: exchange.id,
      ordinal: exchange.ordinal,
      question_segment_id: exchange.questionSegmentId,
      answer_segment_ids: exchange.answerSegmentIds,
      context_segment_ids: exchange.contextSegmentIds,
      question_speaker: exchange.questionSpeaker,
      answer_speaker: exchange.answerSpeaker,
      question_text: exchange.question,
      answer_text: exchange.answer,
    })),
    extraction_candidates: parsed.extractionCandidates.map((candidate) => ({
      id: candidate.id,
      candidate_type: candidate.candidateType,
      source_segment_ids: candidate.sourceSegmentIds,
      payload: candidate.payload,
      extraction_confidence: candidate.extractionConfidence,
    })),
    positions: parsed.positions.map((position) => ({ id: position.id, party: position.party, statement: position.statement, source_segment_ids: position.sourceSegmentIds })),
    procedural_actions: parsed.proceduralActions.map((action) => ({ id: action.id, action: action.action, source_segment_ids: action.sourceSegmentIds })),
    exhibits: parsed.exhibits.map((exhibit) => ({ id: exhibit.id, label: exhibit.label, admission_status: exhibit.admissionStatus, description: exhibit.description, source_segment_ids: exhibit.sourceSegmentIds })),
    stipulations: parsed.stipulations.map((stipulation) => ({ id: stipulation.id, exhibit_label: stipulation.exhibitLabel, subject: stipulation.subject, status: stipulation.status, exact_text: stipulation.exactText, source_segment_ids: stipulation.sourceSegmentIds })),
    resolution_items: parsed.resolutionItems.map((item) => ({ id: item.id, kind: item.kind, title: item.title, detail: item.detail, source_segment_ids: item.sourceSegmentIds })),
    package_version: { id: packageVersionId, schema_version: parsed.package.schemaVersion, package_sha256: packageSha256, package: parsed.package },
  };

  const { data, error } = await supabase.rpc("commit_testimony_compiler_run", { payload });
  if (error) throw new Error(error.message);
  return databaseResult(data);
}
