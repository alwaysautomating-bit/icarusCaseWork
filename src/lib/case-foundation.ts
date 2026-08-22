import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { deriveCaseReadiness, type CaseReadiness } from "@/lib/case-readiness";
import { getAccessibleCase, type AccessibleCase } from "@/lib/case-access";
import { createClient } from "@/lib/supabase/server";

function rowsOrThrow<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("Supabase returned no data.");
  return result.data;
}

export type FoundationSource = {
  id: string;
  title: string;
  source_family: string;
  evidence_lane: string;
  known_to_exist: boolean;
  possessed_by_us: boolean;
  completeness: string | null;
  primary_source: boolean | null;
  notes: string;
};

export type FoundationArtifact = {
  id: string;
  source_id: string;
  title: string;
  media_type: string;
  sha256: string;
  byte_length: number;
  original_filename: string | null;
  source_url: string;
  canonical_url: string;
  publisher: string | null;
  retrieved_at: string;
  is_original: boolean;
  is_derivative: boolean;
  completeness: string | null;
  parser_status: string;
  is_authorized: boolean;
};

export type FoundationProceeding = {
  id: string;
  source_id: string;
  source_artifact_id: string;
  title: string;
  proceeding_type: string;
  proceeding_date: string | null;
  status: string;
  detected_segments: number;
  parsed_segments: number;
  committed_segments: number;
  first_timestamp_ms: number | null;
  last_timestamp_ms: number | null;
};

export type FoundationSpeaker = {
  id: string;
  proceeding_id: string;
  provider_label: string;
  canonical_name: string | null;
  role: string | null;
  review_required: boolean;
};

export type FoundationEntity = {
  id: string;
  canonical_name: string;
  kind: string;
  description: string;
  aliases: Array<{ id: string; alias: string; source_artifact_id: string | null }>;
};

export type FoundationEvent = {
  id: string;
  kind: "reviewed" | "candidate";
  title: string;
  participants: unknown;
  reviewStatus: string;
  temporalAssertions: FoundationTemporalAssertion[];
  sourceSegmentIds: string[];
  eventTimeStart: string | null;
  eventTimeEnd: string | null;
  timePrecision: string | null;
};

export type FoundationTemporalAssertion = {
  id: string;
  event_id: string | null;
  event_candidate_id: string | null;
  raw_temporal_language: string;
  asserted_start: string | null;
  asserted_end: string | null;
  precision: string;
  review_status: string;
  source_segment_ids: string[];
};

export type FoundationWorkspace = {
  currentCase: AccessibleCase;
  members: Array<{ user_id: string; role: string; created_at: string }>;
  sources: FoundationSource[];
  artifacts: FoundationArtifact[];
  proceedings: FoundationProceeding[];
  speakers: FoundationSpeaker[];
  entities: FoundationEntity[];
  events: FoundationEvent[];
  temporalAssertions: FoundationTemporalAssertion[];
  acquisitions: Array<{ id: string; title: string; source_family: string; acquisition_status: string; priority: string; known_to_exist: boolean; possessed_by_us: boolean; completeness: string | null; discovered_from_segment_id: string | null }>;
  flags: Array<{ id: string; flag_type: string; rationale: string; origin: string; status: string; source_segment_ids: string[] }>;
  intakes: Array<{ id: string; source_id: string | null; page_title: string | null; processing_status: string; review_required: boolean; error_message: string | null; detected_segments: number; parsed_segments: number; committed_segments: number; parser_warnings: unknown }>;
  counts: { segments: number; claims: number; extractionCandidates: number; provenanceActivities: number };
  readiness: CaseReadiness;
  deferredFields: string[];
};

function normalizedIdentityValues(entities: FoundationEntity[]) {
  const owners = new Map<string, Set<string>>();
  for (const entity of entities) {
    for (const value of [entity.canonical_name, ...entity.aliases.map((item) => item.alias)]) {
      const normalized = value.trim().toLocaleLowerCase().replaceAll(/[^a-z0-9]+/g, " ").trim();
      if (!normalized) continue;
      const ids = owners.get(normalized) ?? new Set<string>();
      ids.add(entity.id);
      owners.set(normalized, ids);
    }
  }
  return [...owners.values()].filter((ids) => ids.size > 1).length;
}

function coverageIsUsable(item: FoundationProceeding) {
  return ["complete", "published"].includes(item.status)
    && item.detected_segments > 0
    && item.detected_segments === item.parsed_segments
    && item.parsed_segments === item.committed_segments;
}

export async function getFoundationWorkspace(actorId: string, caseId: string): Promise<FoundationWorkspace | null> {
  const currentCase = await getAccessibleCase(actorId, caseId);
  if (!currentCase) return null;
  const supabase = await createClient();
  const results = await Promise.all([
    supabase.from("case_members").select("user_id,role,created_at").eq("case_id", caseId).order("created_at"),
    supabase.from("sources").select("id,title,source_family,evidence_lane,known_to_exist,possessed_by_us,completeness,primary_source,notes").eq("case_id", caseId).order("created_at"),
    supabase.from("source_artifacts").select("id,source_id,title,media_type,sha256,byte_length,original_filename,source_url,canonical_url,publisher,retrieved_at,is_original,is_derivative,completeness,parser_status,is_authorized").eq("case_id", caseId).order("created_at"),
    supabase.from("evidence_intakes").select("id,source_id,page_title,processing_status,review_required,error_message,detected_segments,parsed_segments,committed_segments,parser_warnings").eq("case_id", caseId).order("created_at"),
    supabase.from("proceedings").select("id,source_id,source_artifact_id,title,proceeding_type,proceeding_date,status,detected_segments,parsed_segments,committed_segments,first_timestamp_ms,last_timestamp_ms").eq("case_id", caseId).order("proceeding_date", { ascending: true, nullsFirst: false }),
    supabase.from("proceeding_speakers").select("id,proceeding_id,provider_label,canonical_name,role,review_required").eq("case_id", caseId).order("provider_label"),
    supabase.from("entities").select("id,canonical_name,kind,description").eq("case_id", caseId).order("canonical_name"),
    supabase.from("entity_aliases").select("id,entity_id,alias,source_artifact_id").order("alias"),
    supabase.from("events").select("id,promoted_from_claim_id,title,event_time_start,event_time_end,time_precision,epistemic_state").eq("case_id", caseId).order("created_at"),
    supabase.from("event_candidates").select("id,neutral_description,participant_mentions,source_claim_ids,review_status,reconciled_event_id").eq("case_id", caseId).order("logical_order"),
    supabase.from("temporal_assertions").select("id,event_id,event_candidate_id,raw_temporal_language,asserted_start,asserted_end,precision,review_status,source_segment_ids").eq("case_id", caseId).order("logical_order"),
    supabase.from("evidence_acquisition_records").select("id,title,source_family,acquisition_status,priority,known_to_exist,possessed_by_us,completeness,discovered_from_segment_id").eq("case_id", caseId).order("created_at", { ascending: false }),
    supabase.from("knowledge_flags").select("id,flag_type,rationale,origin,status,source_segment_ids").eq("case_id", caseId).order("logical_order"),
    supabase.from("claims").select("id,source_segment_id,status").eq("case_id", caseId).order("created_at"),
    supabase.from("claim_source_segments").select("claim_id,source_segment_id,ordinal").order("ordinal"),
    supabase.from("source_segments").select("id", { count: "exact", head: true }).eq("case_id", caseId),
    supabase.from("extraction_candidates").select("id", { count: "exact", head: true }).eq("case_id", caseId),
    supabase.from("provenance_activities").select("id", { count: "exact", head: true }).eq("case_id", caseId),
  ]);

  const [membersResult, sourcesResult, artifactsResult, intakesResult, proceedingsResult, speakersResult, entitiesResult, aliasesResult, eventsResult, eventCandidatesResult, temporalResult, acquisitionsResult, flagsResult, claimsResult, claimSegmentsResult, segmentCountResult, candidateCountResult, provenanceCountResult] = results;
  const members = rowsOrThrow(membersResult) as FoundationWorkspace["members"];
  const sources = rowsOrThrow(sourcesResult) as FoundationSource[];
  const artifacts = rowsOrThrow(artifactsResult) as FoundationArtifact[];
  const intakes = rowsOrThrow(intakesResult) as FoundationWorkspace["intakes"];
  const proceedings = rowsOrThrow(proceedingsResult) as FoundationProceeding[];
  const speakers = rowsOrThrow(speakersResult) as FoundationSpeaker[];
  const rawEntities = rowsOrThrow(entitiesResult) as Array<Omit<FoundationEntity, "aliases">>;
  const aliases = rowsOrThrow(aliasesResult) as Array<{ id: string; entity_id: string; alias: string; source_artifact_id: string | null }>;
  const entityIds = new Set(rawEntities.map((item) => item.id));
  const entities = rawEntities.map((entity) => ({ ...entity, aliases: aliases.filter((item) => entityIds.has(item.entity_id) && item.entity_id === entity.id).map(({ id, alias, source_artifact_id }) => ({ id, alias, source_artifact_id })) }));
  const temporalAssertions = rowsOrThrow(temporalResult) as FoundationTemporalAssertion[];
  const rawClaims = rowsOrThrow(claimsResult) as Array<{ id: string; source_segment_id: string; status: string }>;
  const claimIds = new Set(rawClaims.map((item) => item.id));
  const claimSegments = (rowsOrThrow(claimSegmentsResult) as Array<{ claim_id: string; source_segment_id: string; ordinal: number }>).filter((item) => claimIds.has(item.claim_id));
  const segmentIdsForClaim = (claimId: string) => {
    const direct = rawClaims.find((item) => item.id === claimId)?.source_segment_id;
    return [...new Set([direct, ...claimSegments.filter((item) => item.claim_id === claimId).map((item) => item.source_segment_id)].filter((item): item is string => Boolean(item)))];
  };
  const reviewedEvents = (rowsOrThrow(eventsResult) as Array<{ id: string; promoted_from_claim_id: string; title: string; event_time_start: string | null; event_time_end: string | null; time_precision: string; epistemic_state: string }>).map<FoundationEvent>((event) => ({
    id: event.id,
    kind: "reviewed",
    title: event.title,
    participants: [],
    reviewStatus: event.epistemic_state,
    temporalAssertions: temporalAssertions.filter((item) => item.event_id === event.id),
    sourceSegmentIds: segmentIdsForClaim(event.promoted_from_claim_id),
    eventTimeStart: event.event_time_start,
    eventTimeEnd: event.event_time_end,
    timePrecision: event.time_precision,
  }));
  const candidateEvents = (rowsOrThrow(eventCandidatesResult) as Array<{ id: string; neutral_description: string; participant_mentions: unknown; source_claim_ids: string[]; review_status: string; reconciled_event_id: string | null }>).map<FoundationEvent>((event) => ({
    id: event.id,
    kind: "candidate",
    title: event.neutral_description,
    participants: event.participant_mentions,
    reviewStatus: event.review_status,
    temporalAssertions: temporalAssertions.filter((item) => item.event_candidate_id === event.id),
    sourceSegmentIds: [...new Set((event.source_claim_ids ?? []).flatMap(segmentIdsForClaim))],
    eventTimeStart: null,
    eventTimeEnd: null,
    timePrecision: null,
  }));
  const acquisitions = rowsOrThrow(acquisitionsResult) as FoundationWorkspace["acquisitions"];
  const flags = rowsOrThrow(flagsResult) as FoundationWorkspace["flags"];
  const segmentCount = segmentCountResult.error ? (() => { throw new Error(segmentCountResult.error.message); })() : segmentCountResult.count ?? 0;
  if (candidateCountResult.error) throw new Error(candidateCountResult.error.message);
  if (provenanceCountResult.error) throw new Error(provenanceCountResult.error.message);

  const readiness = deriveCaseReadiness({
    hasTitle: currentCase.title.trim().length > 0,
    hasPurpose: currentCase.purpose.trim().length > 0,
    sourceCount: sources.length,
    artifactCount: artifacts.length,
    authorizedArtifactCount: artifacts.filter((item) => item.is_authorized).length,
    segmentCount,
    failedIntakeCount: intakes.filter((item) => item.processing_status === "failed").length,
    incompleteIntakeCount: intakes.filter((item) => item.processing_status !== "complete" || item.review_required || item.detected_segments !== item.parsed_segments || item.parsed_segments !== item.committed_segments).length,
    brokenSourceLinkCount: artifacts.filter((item) => !sources.some((source) => source.id === item.source_id)).length,
    proceedingCount: proceedings.length,
    usableProceedingCount: proceedings.filter(coverageIsUsable).length,
    incompleteProceedingCount: proceedings.filter((item) => !coverageIsUsable(item)).length,
    unresolvedSpeakerCount: speakers.filter((item) => item.review_required || !item.canonical_name).length,
    entityCount: entities.length,
    aliasCollisionCount: normalizedIdentityValues(entities),
    crossCaseIdentityLinkCount: 0,
    eventCandidateCount: candidateEvents.length,
    unreviewedEventCandidateCount: candidateEvents.filter((item) => !["accepted", "reconciled"].includes(item.reviewStatus)).length,
    temporalAssertionCount: temporalAssertions.length,
    unresolvedTemporalCount: temporalAssertions.filter((item) => item.review_status !== "accepted" || ["unknown", "relative_only"].includes(item.precision)).length,
    acquisitionGapCount: acquisitions.filter((item) => !item.possessed_by_us || item.acquisition_status !== "complete").length,
    unresolvedFlagCount: flags.filter((item) => !["resolved", "closed", "rejected"].includes(item.status)).length,
    provenanceActivityCount: provenanceCountResult.count ?? 0,
    canAccessCase: true,
    membershipRole: currentCase.membershipRole,
  });

  return {
    currentCase,
    members,
    sources,
    artifacts,
    proceedings,
    speakers,
    entities,
    events: [...reviewedEvents, ...candidateEvents],
    temporalAssertions,
    acquisitions,
    flags,
    intakes,
    counts: { segments: segmentCount, claims: rawClaims.length, extractionCandidates: candidateCountResult.count ?? 0, provenanceActivities: provenanceCountResult.count ?? 0 },
    readiness,
    deferredFields: ["Jurisdiction", "Case timezone", "Controlled-vocabulary version", "Durable versioned T0 baseline"],
  };
}
