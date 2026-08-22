import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";
import { getAccessibleCase, type AccessibleCase } from "@/lib/case-access";
import type { SourceLocator } from "@/lib/source-locator";
import { createClient } from "@/lib/supabase/server";

const segmentIdSchema = z.uuid();

function rowsOrThrow<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("Supabase returned no data.");
  return result.data;
}

type RawSegment = {
  id: string;
  case_id: string;
  artifact_id: string;
  proceeding_id: string | null;
  proceeding_speaker_id: string | null;
  speaker_entity_id: string | null;
  ordinal: number;
  timestamp_start_ms: number | null;
  timestamp_end_ms: number | null;
  deep_link: string | null;
  transcript_provider: string | null;
  exact_text: string;
  locator_type: string;
  locator: SourceLocator;
};

export type CourtRecordSegment = RawSegment & {
  speaker: string;
};

export type CourtRecordWorkspace = {
  currentCase: AccessibleCase;
  selected: CourtRecordSegment | null;
  segments: CourtRecordSegment[];
  selectedMissing: boolean;
  totalSegments: number;
  artifact: null | {
    id: string;
    source_id: string;
    title: string;
    sha256: string;
    media_type: string;
    byte_length: number;
    source_url: string;
    canonical_url: string;
    publisher: string | null;
    retrieved_at: string;
    original_filename: string | null;
    parser_status: string;
    completeness: string | null;
    is_authorized: boolean;
  };
  source: null | { id: string; title: string; source_family: string; evidence_lane: string; possessed_by_us: boolean; completeness: string | null; primary_source: boolean | null };
  proceeding: null | { id: string; title: string; proceeding_type: string; proceeding_date: string | null; status: string; detected_segments: number; parsed_segments: number; committed_segments: number };
  linked: {
    claims: Array<{ id: string; assertion: string; claimant: string; status: string; object_code: string | null }>;
    candidates: Array<{ id: string; candidate_type: string; review_status: string; extraction_confidence: number; payload: Record<string, unknown> }>;
    eventCandidates: Array<{ id: string; object_code: string; neutral_description: string; event_class: string | null; review_status: string; extraction_confidence: number }>;
    temporalAssertions: Array<{ id: string; raw_temporal_language: string; asserted_start: string | null; asserted_end: string | null; precision: string; review_status: string }>;
    flags: Array<{ id: string; flag_type: string; rationale: string; status: string }>;
    acquisitions: Array<{ id: string; title: string; acquisition_status: string; priority: string; possessed_by_us: boolean }>;
    provenanceRelations: Array<{ id: string; relation_type: string; from_node_type: string; to_node_type: string; object_code: string | null }>;
  };
};

const segmentColumns = "id,case_id,artifact_id,proceeding_id,proceeding_speaker_id,speaker_entity_id,ordinal,timestamp_start_ms,timestamp_end_ms,deep_link,transcript_provider,exact_text,locator_type,locator";

export async function getCourtRecordWorkspace(actorId: string, caseId: string, requestedSegmentId?: string, requestedProceedingId?: string): Promise<CourtRecordWorkspace | null> {
  const currentCase = await getAccessibleCase(actorId, caseId);
  if (!currentCase) return null;
  const supabase = await createClient();
  const parsedSegmentId = requestedSegmentId ? segmentIdSchema.safeParse(requestedSegmentId) : null;
  const parsedProceedingId = requestedProceedingId ? segmentIdSchema.safeParse(requestedProceedingId) : null;
  const requestedIsValid = !requestedSegmentId || Boolean(parsedSegmentId?.success);
  const requestedProceedingIsValid = !requestedProceedingId || Boolean(parsedProceedingId?.success);

  let selectedResult;
  if (parsedSegmentId?.success) {
    selectedResult = await supabase.from("source_segments").select(segmentColumns).eq("case_id", caseId).eq("id", parsedSegmentId.data).maybeSingle();
  } else if (parsedProceedingId?.success) {
    selectedResult = await supabase.from("source_segments").select(segmentColumns).eq("case_id", caseId).eq("proceeding_id", parsedProceedingId.data).order("ordinal").limit(1).maybeSingle();
  } else {
    selectedResult = await supabase.from("source_segments").select(segmentColumns).eq("case_id", caseId).order("ordinal").order("id").limit(1).maybeSingle();
  }
  if (selectedResult.error) throw new Error(selectedResult.error.message);

  let rawSelected = selectedResult.data as RawSegment | null;
  const selectedMissing = (Boolean(requestedSegmentId) && (!requestedIsValid || !rawSelected)) || (Boolean(requestedProceedingId) && (!requestedProceedingIsValid || !rawSelected));
  if (!rawSelected && (requestedSegmentId || requestedProceedingId)) {
    const fallback = await supabase.from("source_segments").select(segmentColumns).eq("case_id", caseId).order("ordinal").order("id").limit(1).maybeSingle();
    if (fallback.error) throw new Error(fallback.error.message);
    rawSelected = fallback.data as RawSegment | null;
  }

  const totalResult = await supabase.from("source_segments").select("id", { count: "exact", head: true }).eq("case_id", caseId);
  if (totalResult.error) throw new Error(totalResult.error.message);
  if (!rawSelected) {
    return {
      currentCase,
      selected: null,
      segments: [],
      selectedMissing,
      totalSegments: totalResult.count ?? 0,
      artifact: null,
      source: null,
      proceeding: null,
      linked: { claims: [], candidates: [], eventCandidates: [], temporalAssertions: [], flags: [], acquisitions: [], provenanceRelations: [] },
    };
  }

  let windowQuery = supabase.from("source_segments").select(segmentColumns).eq("case_id", caseId).eq("artifact_id", rawSelected.artifact_id).gte("ordinal", Math.max(0, rawSelected.ordinal - 12)).lte("ordinal", rawSelected.ordinal + 12).order("ordinal").limit(25);
  if (rawSelected.proceeding_id) windowQuery = windowQuery.eq("proceeding_id", rawSelected.proceeding_id);
  const windowResult = await windowQuery;
  const rawSegments = rowsOrThrow(windowResult) as RawSegment[];
  const speakerIds = [...new Set(rawSegments.map((item) => item.proceeding_speaker_id).filter((item): item is string => Boolean(item)))];
  const entityIds = [...new Set(rawSegments.map((item) => item.speaker_entity_id).filter((item): item is string => Boolean(item)))];

  const [artifactResult, proceedingResult, speakersResult, entitiesResult, directClaimsResult, claimLinksResult, candidatesResult, temporalResult, flagsResult, acquisitionsResult, provenanceResult] = await Promise.all([
    supabase.from("source_artifacts").select("id,source_id,title,sha256,media_type,byte_length,source_url,canonical_url,publisher,retrieved_at,original_filename,parser_status,completeness,is_authorized").eq("case_id", caseId).eq("id", rawSelected.artifact_id).maybeSingle(),
    rawSelected.proceeding_id ? supabase.from("proceedings").select("id,title,proceeding_type,proceeding_date,status,detected_segments,parsed_segments,committed_segments").eq("case_id", caseId).eq("id", rawSelected.proceeding_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    speakerIds.length > 0 ? supabase.from("proceeding_speakers").select("id,provider_label,canonical_name").eq("case_id", caseId).in("id", speakerIds) : Promise.resolve({ data: [], error: null }),
    entityIds.length > 0 ? supabase.from("entities").select("id,canonical_name").eq("case_id", caseId).in("id", entityIds) : Promise.resolve({ data: [], error: null }),
    supabase.from("claims").select("id,assertion,claimant,status,object_code").eq("case_id", caseId).eq("source_segment_id", rawSelected.id),
    supabase.from("claim_source_segments").select("claim_id").eq("source_segment_id", rawSelected.id),
    supabase.from("extraction_candidates").select("id,candidate_type,review_status,extraction_confidence,payload").eq("case_id", caseId).contains("source_segment_ids", [rawSelected.id]).limit(25),
    supabase.from("temporal_assertions").select("id,raw_temporal_language,asserted_start,asserted_end,precision,review_status").eq("case_id", caseId).contains("source_segment_ids", [rawSelected.id]).limit(25),
    supabase.from("knowledge_flags").select("id,flag_type,rationale,status").eq("case_id", caseId).contains("source_segment_ids", [rawSelected.id]).limit(25),
    supabase.from("evidence_acquisition_records").select("id,title,acquisition_status,priority,possessed_by_us").eq("case_id", caseId).eq("discovered_from_segment_id", rawSelected.id).limit(25),
    supabase.from("provenance_relations").select("id,relation_type,from_node_type,to_node_type,object_code").eq("case_id", caseId).contains("source_segment_ids", [rawSelected.id]).limit(25),
  ]);
  if (artifactResult.error) throw new Error(artifactResult.error.message);
  if (proceedingResult.error) throw new Error(proceedingResult.error.message);
  const speakerRows = rowsOrThrow(speakersResult) as Array<{ id: string; provider_label: string; canonical_name: string | null }>;
  const entityRows = rowsOrThrow(entitiesResult) as Array<{ id: string; canonical_name: string }>;
  const speakerById = new Map(speakerRows.map((item) => [item.id, item.canonical_name ?? item.provider_label]));
  const entityById = new Map(entityRows.map((item) => [item.id, item.canonical_name]));
  const segments = rawSegments.map<CourtRecordSegment>((segment) => ({
    ...segment,
    speaker: entityById.get(segment.speaker_entity_id ?? "") ?? speakerById.get(segment.proceeding_speaker_id ?? "") ?? "Unidentified speaker",
  }));
  const selected = segments.find((item) => item.id === rawSelected.id) ?? { ...rawSelected, speaker: entityById.get(rawSelected.speaker_entity_id ?? "") ?? speakerById.get(rawSelected.proceeding_speaker_id ?? "") ?? "Unidentified speaker" };
  const artifact = artifactResult.data as CourtRecordWorkspace["artifact"];
  let source: CourtRecordWorkspace["source"] = null;
  if (artifact?.source_id) {
    const sourceResult = await supabase.from("sources").select("id,title,source_family,evidence_lane,possessed_by_us,completeness,primary_source").eq("case_id", caseId).eq("id", artifact.source_id).maybeSingle();
    if (sourceResult.error) throw new Error(sourceResult.error.message);
    source = sourceResult.data as CourtRecordWorkspace["source"];
  }
  const claimLinkRows = rowsOrThrow(claimLinksResult) as Array<{ claim_id: string }>;
  const linkedClaimIds = [...new Set(claimLinkRows.map((item) => item.claim_id))];
  let joinedClaims: CourtRecordWorkspace["linked"]["claims"] = [];
  if (linkedClaimIds.length > 0) {
    const joinedResult = await supabase.from("claims").select("id,assertion,claimant,status,object_code").eq("case_id", caseId).in("id", linkedClaimIds);
    joinedClaims = rowsOrThrow(joinedResult) as CourtRecordWorkspace["linked"]["claims"];
  }
  const directClaims = rowsOrThrow(directClaimsResult) as CourtRecordWorkspace["linked"]["claims"];
  const claims = [...new Map([...directClaims, ...joinedClaims].map((item) => [item.id, item])).values()];
  const eventCandidatesResult = claims.length > 0
    ? await supabase.from("event_candidates").select("id,object_code,neutral_description,event_class,review_status,extraction_confidence").eq("case_id", caseId).overlaps("source_claim_ids", claims.map((claim) => claim.id)).limit(25)
    : { data: [], error: null };

  return {
    currentCase,
    selected,
    segments,
    selectedMissing,
    totalSegments: totalResult.count ?? 0,
    artifact,
    source,
    proceeding: proceedingResult.data as CourtRecordWorkspace["proceeding"],
    linked: {
      claims,
      candidates: rowsOrThrow(candidatesResult) as CourtRecordWorkspace["linked"]["candidates"],
      eventCandidates: rowsOrThrow(eventCandidatesResult) as CourtRecordWorkspace["linked"]["eventCandidates"],
      temporalAssertions: rowsOrThrow(temporalResult) as CourtRecordWorkspace["linked"]["temporalAssertions"],
      flags: rowsOrThrow(flagsResult) as CourtRecordWorkspace["linked"]["flags"],
      acquisitions: rowsOrThrow(acquisitionsResult) as CourtRecordWorkspace["linked"]["acquisitions"],
      provenanceRelations: rowsOrThrow(provenanceResult) as CourtRecordWorkspace["linked"]["provenanceRelations"],
    },
  };
}
