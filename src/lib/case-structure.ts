import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";
import { getAccessibleCase, type AccessibleCase } from "@/lib/case-access";
import type { StructureObjectType } from "@/lib/case-routes";
import type { SourceLocator } from "@/lib/source-locator";
import { createClient } from "@/lib/supabase/server";
import { timelineSnapshotSchema, type SavedTimelineView, type TimelineSnapshotItem, type TimelineSnapshotRun } from "@/lib/timeline-views";

const uuidSchema = z.uuid();
const objectLimit = 1_000;

function rowsOrThrow<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("Supabase returned no data.");
  return result.data;
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

type ProceedingRow = { id: string; title: string; proceeding_date: string | null };
type KnowledgeRow = {
  id: string; proceeding_id: string; extraction_run_id: string; testimony_unit_id: string; object_code: string; summary: string;
  witness_label_raw: string; witness_resolution_status: string; phase_candidate: string | null; unknowns: unknown;
  extraction_method: string; model_version: string | null; compiler_version: string; extraction_contract_version: string;
  review_status: string; logical_order: number; created_at: string;
};
type ClaimRow = {
  id: string; source_segment_id: string; claimant: string; assertion: string; status: string; object_code: string | null;
  knowledge_item_id: string | null; asserted_by_entity_id: string | null; asserted_by_raw: string | null; speaker_capacity: string | null;
  normalized_assertion: string | null; assertion_status: string; information_basis: string; extraction_confidence: number;
  source_quote: string; review_required: boolean; logical_order: number | null; created_at: string;
};
type MentionRow = {
  id: string; knowledge_item_id: string; object_code: string; raw_mention: string; normalized_candidate: string | null;
  mention_type: string | null; resolved_entity_id: string | null; resolution_status: string; resolution_confidence: number | null;
  resolution_basis: string | null; source_segment_ids: string[]; review_status: string; logical_order: number; created_at: string;
};
type EventRow = {
  id: string; proceeding_id: string; knowledge_item_id: string; object_code: string; neutral_description: string;
  participant_mentions: unknown; source_claim_ids: string[]; extraction_confidence: number; review_status: string;
  reconciled_event_id: string | null; reconciliation_basis: string | null; logical_order: number; created_at: string;
  event_class: string | null; source_wording: string | null; recurrence_pattern: unknown;
};
type TemporalRow = {
  id: string; knowledge_item_id: string; source_claim_id: string | null; event_id: string | null; event_candidate_id: string | null;
  object_code: string; raw_temporal_language: string; asserted_start: string | null; asserted_end: string | null; precision: string;
  asserted_by_entity_id: string | null; asserted_by_raw: string | null; source_segment_ids: string[]; extraction_confidence: number;
  review_status: string; logical_order: number; created_at: string; asserted_date: string | null; asserted_time_of_day_start: string | null;
  asserted_time_of_day_end: string | null; time_of_day_band: string | null; date_precision: string | null; time_of_day_precision: string | null;
  qualification: string; qualifier_text: string | null; confidence_basis: string; sequence_language: string | null; duration_iso8601: string | null;
  relative_offset_value: number | null; relative_offset_unit: string | null; recurrence_pattern: unknown;
};
type RelationshipRow = {
  id: string; object_code: string; from_node_type: string; from_node_id: string; relation_type: string; to_node_type: string;
  to_node_id: string; source_claim_id: string | null; knowledge_item_id: string; assertion_status: string;
  extraction_confidence: number; review_status: string; logical_order: number; created_at: string;
};
type FlagRow = {
  id: string; object_code: string; target_node_type: string; target_node_id: string; flag_type: string; rationale: string;
  origin: string; status: string; source_segment_ids: string[]; logical_order: number; created_at: string;
};
type EntityRow = { id: string; canonical_name: string; kind: string; description: string; created_at: string };
type LinkRow = { source_segment_id: string };
type KnowledgeLinkRow = LinkRow & { knowledge_item_id: string; ordinal: number };
type ClaimLinkRow = LinkRow & { claim_id: string; ordinal: number };
type ProvenanceRelationRow = {
  id: string; object_code: string; from_node_type: string; from_node_id: string; relation_type: string; to_node_type: string;
  to_node_id: string; source_segment_ids: string[]; extraction_run_id: string | null; logical_order: number; created_at: string;
};
type ExtractionRunRow = {
  id: string; proceeding_id: string; compiler_name: string; compiler_version: string; extraction_method: string; model_name: string | null;
  model_version: string | null; extraction_contract_version: string; configuration_sha256: string; status: string; created_at: string; completed_at: string | null;
};
type SavedTimelineViewRow = {
  id: string; name: string; version: number; description: string; extraction_run_ids: string[]; event_candidate_ids: string[];
  temporal_assertion_ids: string[]; view_state: Record<string, unknown>; snapshot: unknown; created_by: string; created_at: string;
};

export type StructureFilters = {
  type: StructureObjectType | "all";
  objectId?: string;
  segmentId?: string;
  proceedingId?: string;
  reviewStatus?: string;
  assertedBy?: string;
  unresolvedOnly?: boolean;
  temporalOnly?: boolean;
  query?: string;
  timelineRunId?: string;
  compareViewIds?: string[];
};

export type StructureListItem = {
  id: string;
  type: StructureObjectType;
  objectCode: string | null;
  title: string;
  summary: string;
  reviewStatus: string;
  proceedingId: string | null;
  proceedingTitle: string;
  assertedBy: string | null;
  sourceSegmentIds: string[];
  hasUnresolvedFlags: boolean;
  hasTemporalAssertion: boolean;
  confidence: number | null;
  extractionRunId: string | null;
  logicalOrder: number | null;
  details: Array<{ label: string; value: string }>;
};

export type StructureSource = {
  id: string;
  proceedingId: string | null;
  proceedingTitle: string;
  artifactId: string;
  artifactTitle: string;
  artifactSha256: string;
  artifactCanonicalUrl: string | null;
  speaker: string;
  ordinal: number;
  timestampStartMs: number | null;
  exactText: string;
  locator: SourceLocator;
  deepLink: string | null;
};

export type StructureWorkspace = {
  currentCase: AccessibleCase;
  proceedings: ProceedingRow[];
  objects: StructureListItem[];
  selected: StructureListItem | null;
  selectedMissing: boolean;
  selectedSourceId: string | null;
  selectedSourceMissing: boolean;
  sources: StructureSource[];
  counts: Record<StructureObjectType, number>;
  coverage: { totalSegments: number; linkedSegments: number };
  extraction: null | {
    id: string; compilerName: string; compilerVersion: string; extractionMethod: string; modelName: string | null;
    modelVersion: string | null; contractVersion: string; status: string; configurationSha256: string; createdAt: string; completedAt: string | null;
  };
  provenanceActivities: Array<{ id: string; activityType: string; compilerName: string | null; compilerVersion: string | null; modelName: string | null; modelVersion: string | null; startedAt: string | null; endedAt: string | null; systemAgent: string | null }>;
  provenanceRelations: Array<{ id: string; objectCode: string; relationType: string; from: string; to: string; sourceSegmentIds: string[] }>;
  auditHistory: Array<{ logicalOrder: number; operation: string; systemAgent: string | null; createdAt: string; details: unknown }>;
  timeline: {
    runs: TimelineSnapshotRun[];
    activeRunId: string | null;
    current: TimelineSnapshotItem[];
    savedViews: SavedTimelineView[];
  };
};

function addToMap(map: Map<string, string[]>, key: string, value: string) {
  map.set(key, unique([...(map.get(key) ?? []), value]));
}

function detail(label: string, value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const rendered = typeof value === "string" ? value : JSON.stringify(value);
  return { label, value: rendered };
}

function compactDetails(values: Array<{ label: string; value: string } | null>) {
  return values.filter((value): value is { label: string; value: string } => Boolean(value));
}

export async function getCaseStructureWorkspace(actorId: string, caseId: string, filters: StructureFilters): Promise<StructureWorkspace | null> {
  const currentCase = await getAccessibleCase(actorId, caseId);
  if (!currentCase) return null;

  const supabase = await createClient();
  const [proceedingsResult, knowledgeResult, claimsResult, mentionsResult, eventsResult, temporalResult, relationshipsResult, flagsResult, entitiesResult, provenanceResult, extractionRunsResult, savedTimelineViewsResult, segmentCountResult] = await Promise.all([
    supabase.from("proceedings").select("id,title,proceeding_date").eq("case_id", caseId).order("proceeding_date").order("title"),
    supabase.from("knowledge_items").select("id,proceeding_id,extraction_run_id,testimony_unit_id,object_code,summary,witness_label_raw,witness_resolution_status,phase_candidate,unknowns,extraction_method,model_version,compiler_version,extraction_contract_version,review_status,logical_order,created_at").eq("case_id", caseId).order("logical_order").limit(objectLimit),
    supabase.from("claims").select("id,source_segment_id,claimant,assertion,status,object_code,knowledge_item_id,asserted_by_entity_id,asserted_by_raw,speaker_capacity,normalized_assertion,assertion_status,information_basis,extraction_confidence,source_quote,review_required,logical_order,created_at").eq("case_id", caseId).order("created_at").limit(objectLimit),
    supabase.from("entity_mentions").select("id,knowledge_item_id,object_code,raw_mention,normalized_candidate,mention_type,resolved_entity_id,resolution_status,resolution_confidence,resolution_basis,source_segment_ids,review_status,logical_order,created_at").eq("case_id", caseId).order("logical_order").limit(objectLimit),
    supabase.from("event_candidates").select("id,proceeding_id,knowledge_item_id,object_code,neutral_description,participant_mentions,source_claim_ids,extraction_confidence,review_status,reconciled_event_id,reconciliation_basis,logical_order,created_at,event_class,source_wording,recurrence_pattern").eq("case_id", caseId).order("logical_order").limit(objectLimit),
    supabase.from("temporal_assertions").select("id,knowledge_item_id,source_claim_id,event_id,event_candidate_id,object_code,raw_temporal_language,asserted_start,asserted_end,precision,asserted_by_entity_id,asserted_by_raw,source_segment_ids,extraction_confidence,review_status,logical_order,created_at,asserted_date,asserted_time_of_day_start,asserted_time_of_day_end,time_of_day_band,date_precision,time_of_day_precision,qualification,qualifier_text,confidence_basis,sequence_language,duration_iso8601,relative_offset_value,relative_offset_unit,recurrence_pattern").eq("case_id", caseId).order("logical_order").limit(objectLimit),
    supabase.from("knowledge_relationships").select("id,object_code,from_node_type,from_node_id,relation_type,to_node_type,to_node_id,source_claim_id,knowledge_item_id,assertion_status,extraction_confidence,review_status,logical_order,created_at").eq("case_id", caseId).order("logical_order").limit(objectLimit),
    supabase.from("knowledge_flags").select("id,object_code,target_node_type,target_node_id,flag_type,rationale,origin,status,source_segment_ids,logical_order,created_at").eq("case_id", caseId).order("logical_order").limit(objectLimit),
    supabase.from("entities").select("id,canonical_name,kind,description,created_at").eq("case_id", caseId).order("canonical_name").limit(objectLimit),
    supabase.from("provenance_relations").select("id,object_code,from_node_type,from_node_id,relation_type,to_node_type,to_node_id,source_segment_ids,extraction_run_id,logical_order,created_at").eq("case_id", caseId).order("logical_order").limit(objectLimit),
    supabase.from("knowledge_extraction_runs").select("id,proceeding_id,compiler_name,compiler_version,extraction_method,model_name,model_version,extraction_contract_version,configuration_sha256,status,created_at,completed_at").eq("case_id", caseId).order("created_at"),
    supabase.from("saved_timeline_views").select("id,name,version,description,extraction_run_ids,event_candidate_ids,temporal_assertion_ids,view_state,snapshot,created_by,created_at").eq("case_id", caseId).order("created_at", { ascending: false }).limit(100),
    supabase.from("source_segments").select("id", { count: "exact", head: true }).eq("case_id", caseId),
  ]);

  const proceedings = rowsOrThrow(proceedingsResult) as ProceedingRow[];
  const knowledge = rowsOrThrow(knowledgeResult) as KnowledgeRow[];
  const claims = rowsOrThrow(claimsResult) as ClaimRow[];
  const mentions = rowsOrThrow(mentionsResult) as MentionRow[];
  const events = rowsOrThrow(eventsResult) as EventRow[];
  const temporal = rowsOrThrow(temporalResult) as TemporalRow[];
  const relationships = rowsOrThrow(relationshipsResult) as RelationshipRow[];
  const flags = rowsOrThrow(flagsResult) as FlagRow[];
  const entities = rowsOrThrow(entitiesResult) as EntityRow[];
  const provenanceRelations = rowsOrThrow(provenanceResult) as ProvenanceRelationRow[];
  const extractionRuns = rowsOrThrow(extractionRunsResult) as ExtractionRunRow[];
  const savedTimelineViewRows = rowsOrThrow(savedTimelineViewsResult) as SavedTimelineViewRow[];
  if (segmentCountResult.error) throw new Error(segmentCountResult.error.message);

  const knowledgeIds = knowledge.map((item) => item.id);
  const claimIds = claims.map((item) => item.id);
  const [knowledgeLinksResult, claimLinksResult] = await Promise.all([
    knowledgeIds.length ? supabase.from("knowledge_item_segments").select("knowledge_item_id,source_segment_id,ordinal").in("knowledge_item_id", knowledgeIds).order("ordinal").limit(10_000) : Promise.resolve({ data: [], error: null }),
    claimIds.length ? supabase.from("claim_source_segments").select("claim_id,source_segment_id,ordinal").in("claim_id", claimIds).order("ordinal").limit(10_000) : Promise.resolve({ data: [], error: null }),
  ]);
  const knowledgeLinks = rowsOrThrow(knowledgeLinksResult) as KnowledgeLinkRow[];
  const claimLinks = rowsOrThrow(claimLinksResult) as ClaimLinkRow[];

  const proceedingById = new Map(proceedings.map((item) => [item.id, item]));
  const knowledgeById = new Map(knowledge.map((item) => [item.id, item]));
  const knowledgeSources = new Map<string, string[]>();
  const claimSources = new Map<string, string[]>();
  for (const link of knowledgeLinks) addToMap(knowledgeSources, link.knowledge_item_id, link.source_segment_id);
  for (const claim of claims) addToMap(claimSources, claim.id, claim.source_segment_id);
  for (const link of claimLinks) addToMap(claimSources, link.claim_id, link.source_segment_id);

  const unresolvedTargetIds = new Set(flags.filter((flag) => !["resolved", "rejected"].includes(flag.status)).map((flag) => flag.target_node_id));
  const temporalTargetIds = new Set<string>();
  for (const item of temporal) {
    temporalTargetIds.add(item.knowledge_item_id);
    if (item.source_claim_id) temporalTargetIds.add(item.source_claim_id);
    if (item.event_candidate_id) temporalTargetIds.add(item.event_candidate_id);
    if (item.event_id) temporalTargetIds.add(item.event_id);
  }
  const provenanceSourcesFor = (id: string) => unique(provenanceRelations.filter((relation) => relation.from_node_id === id || relation.to_node_id === id).flatMap((relation) => relation.source_segment_ids));
  const sourcesForClaims = (ids: string[]) => unique(ids.flatMap((id) => claimSources.get(id) ?? []));
  const contextForKnowledge = (knowledgeItemId: string | null) => knowledgeItemId ? knowledgeById.get(knowledgeItemId) : undefined;
  const proceedingTitle = (id: string | null | undefined) => id ? proceedingById.get(id)?.title ?? "Unknown proceeding" : "Case-level object";

  const allObjects: StructureListItem[] = [];
  for (const item of knowledge) {
    allObjects.push({
      id: item.id, type: "knowledge", objectCode: item.object_code, title: item.summary, summary: `Knowledge item · ${item.witness_label_raw}`,
      reviewStatus: item.review_status, proceedingId: item.proceeding_id, proceedingTitle: proceedingTitle(item.proceeding_id), assertedBy: item.witness_label_raw,
      sourceSegmentIds: unique([...(knowledgeSources.get(item.id) ?? []), ...provenanceSourcesFor(item.id)]), hasUnresolvedFlags: unresolvedTargetIds.has(item.id),
      hasTemporalAssertion: temporalTargetIds.has(item.id), confidence: null, extractionRunId: item.extraction_run_id, logicalOrder: item.logical_order,
      details: compactDetails([detail("Witness", item.witness_label_raw), detail("Witness resolution", item.witness_resolution_status), detail("Phase candidate", item.phase_candidate), detail("Unknowns", item.unknowns), detail("Extraction method", item.extraction_method), detail("Created", item.created_at)]),
    });
  }
  for (const item of claims) {
    const context = contextForKnowledge(item.knowledge_item_id);
    allObjects.push({
      id: item.id, type: "claim", objectCode: item.object_code, title: item.normalized_assertion || item.assertion, summary: item.source_quote || item.assertion,
      reviewStatus: item.status, proceedingId: context?.proceeding_id ?? null, proceedingTitle: proceedingTitle(context?.proceeding_id), assertedBy: item.asserted_by_raw || item.claimant,
      sourceSegmentIds: unique([...(claimSources.get(item.id) ?? []), ...provenanceSourcesFor(item.id)]), hasUnresolvedFlags: unresolvedTargetIds.has(item.id),
      hasTemporalAssertion: temporalTargetIds.has(item.id), confidence: Number(item.extraction_confidence), extractionRunId: context?.extraction_run_id ?? null, logicalOrder: item.logical_order,
      details: compactDetails([detail("Claimant", item.claimant), detail("Asserted by", item.asserted_by_raw), detail("Capacity", item.speaker_capacity), detail("Assertion status", item.assertion_status), detail("Information basis", item.information_basis), detail("Review required", item.review_required ? "Yes" : "No"), detail("Created", item.created_at)]),
    });
  }
  for (const item of events) {
    const context = contextForKnowledge(item.knowledge_item_id);
    allObjects.push({
      id: item.id, type: "event", objectCode: item.object_code, title: item.neutral_description, summary: item.source_wording || "Event candidate derived from source claims.",
      reviewStatus: item.review_status, proceedingId: item.proceeding_id, proceedingTitle: proceedingTitle(item.proceeding_id), assertedBy: context?.witness_label_raw ?? null,
      sourceSegmentIds: unique([...sourcesForClaims(item.source_claim_ids), ...(knowledgeSources.get(item.knowledge_item_id) ?? []), ...provenanceSourcesFor(item.id)]),
      hasUnresolvedFlags: unresolvedTargetIds.has(item.id), hasTemporalAssertion: temporalTargetIds.has(item.id), confidence: Number(item.extraction_confidence),
      extractionRunId: context?.extraction_run_id ?? null, logicalOrder: item.logical_order,
      details: compactDetails([detail("Event class", item.event_class), detail("Source wording", item.source_wording), detail("Participants", item.participant_mentions), detail("Recurrence", item.recurrence_pattern), detail("Reconciled event", item.reconciled_event_id), detail("Reconciliation basis", item.reconciliation_basis), detail("Created", item.created_at)]),
    });
  }
  for (const item of temporal) {
    const context = contextForKnowledge(item.knowledge_item_id);
    allObjects.push({
      id: item.id, type: "temporal", objectCode: item.object_code, title: item.raw_temporal_language || "Temporal assertion", summary: `${humanize(item.precision)} · ${humanize(item.qualification)}`,
      reviewStatus: item.review_status, proceedingId: context?.proceeding_id ?? null, proceedingTitle: proceedingTitle(context?.proceeding_id), assertedBy: item.asserted_by_raw || context?.witness_label_raw || null,
      sourceSegmentIds: unique([...item.source_segment_ids, ...provenanceSourcesFor(item.id)]), hasUnresolvedFlags: unresolvedTargetIds.has(item.id), hasTemporalAssertion: true,
      confidence: Number(item.extraction_confidence), extractionRunId: context?.extraction_run_id ?? null, logicalOrder: item.logical_order,
      details: compactDetails([detail("Precision", item.precision), detail("Qualification", item.qualification), detail("Qualifier", item.qualifier_text), detail("Asserted start", item.asserted_start), detail("Asserted end", item.asserted_end), detail("Asserted date", item.asserted_date), detail("Time of day", [item.asserted_time_of_day_start, item.asserted_time_of_day_end].filter(Boolean).join(" – ")), detail("Time band", item.time_of_day_band), detail("Sequence language", item.sequence_language), detail("Duration", item.duration_iso8601), detail("Confidence basis", item.confidence_basis), detail("Created", item.created_at)]),
    });
  }
  for (const item of mentions) {
    const context = contextForKnowledge(item.knowledge_item_id);
    allObjects.push({
      id: item.id, type: "mention", objectCode: item.object_code, title: item.raw_mention, summary: item.normalized_candidate || "Unnormalized entity mention",
      reviewStatus: item.review_status, proceedingId: context?.proceeding_id ?? null, proceedingTitle: proceedingTitle(context?.proceeding_id), assertedBy: context?.witness_label_raw ?? null,
      sourceSegmentIds: unique([...item.source_segment_ids, ...provenanceSourcesFor(item.id)]), hasUnresolvedFlags: unresolvedTargetIds.has(item.id) || item.resolution_status === "unresolved",
      hasTemporalAssertion: temporalTargetIds.has(item.id), confidence: item.resolution_confidence === null ? null : Number(item.resolution_confidence), extractionRunId: context?.extraction_run_id ?? null, logicalOrder: item.logical_order,
      details: compactDetails([detail("Mention type", item.mention_type), detail("Resolution status", item.resolution_status), detail("Resolution basis", item.resolution_basis), detail("Resolved entity", item.resolved_entity_id), detail("Created", item.created_at)]),
    });
  }
  for (const item of relationships) {
    const context = contextForKnowledge(item.knowledge_item_id);
    allObjects.push({
      id: item.id, type: "relationship", objectCode: item.object_code, title: `${humanize(item.from_node_type)} → ${humanize(item.relation_type)} → ${humanize(item.to_node_type)}`,
      summary: `${item.from_node_id} → ${item.to_node_id}`, reviewStatus: item.review_status, proceedingId: context?.proceeding_id ?? null, proceedingTitle: proceedingTitle(context?.proceeding_id), assertedBy: context?.witness_label_raw ?? null,
      sourceSegmentIds: unique([...(item.source_claim_id ? claimSources.get(item.source_claim_id) ?? [] : []), ...(knowledgeSources.get(item.knowledge_item_id) ?? []), ...provenanceSourcesFor(item.id)]),
      hasUnresolvedFlags: unresolvedTargetIds.has(item.id), hasTemporalAssertion: temporalTargetIds.has(item.id), confidence: Number(item.extraction_confidence), extractionRunId: context?.extraction_run_id ?? null, logicalOrder: item.logical_order,
      details: compactDetails([detail("From", `${item.from_node_type} · ${item.from_node_id}`), detail("Relation", item.relation_type), detail("To", `${item.to_node_type} · ${item.to_node_id}`), detail("Assertion status", item.assertion_status), detail("Created", item.created_at)]),
    });
  }
  for (const item of flags) {
    const target = allObjects.find((object) => object.id === item.target_node_id);
    allObjects.push({
      id: item.id, type: "flag", objectCode: item.object_code, title: humanize(item.flag_type), summary: item.rationale, reviewStatus: item.status,
      proceedingId: target?.proceedingId ?? null, proceedingTitle: target?.proceedingTitle ?? "Case-level object", assertedBy: target?.assertedBy ?? null,
      sourceSegmentIds: unique([...item.source_segment_ids, ...provenanceSourcesFor(item.id)]), hasUnresolvedFlags: !["resolved", "rejected"].includes(item.status), hasTemporalAssertion: false,
      confidence: null, extractionRunId: target?.extractionRunId ?? null, logicalOrder: item.logical_order,
      details: compactDetails([detail("Target", `${item.target_node_type} · ${item.target_node_id}`), detail("Origin", item.origin), detail("Created", item.created_at)]),
    });
  }
  for (const item of entities) {
    const entityMentions = mentions.filter((mention) => mention.resolved_entity_id === item.id);
    const contexts = unique(entityMentions.map((mention) => contextForKnowledge(mention.knowledge_item_id)?.proceeding_id));
    const extractionRuns = unique(entityMentions.map((mention) => contextForKnowledge(mention.knowledge_item_id)?.extraction_run_id));
    allObjects.push({
      id: item.id, type: "entity", objectCode: null, title: item.canonical_name, summary: item.description || humanize(item.kind), reviewStatus: "canonical",
      proceedingId: contexts.length === 1 ? contexts[0] : null, proceedingTitle: contexts.length === 1 ? proceedingTitle(contexts[0]) : "Case-level canonical entity", assertedBy: null,
      sourceSegmentIds: unique([...entityMentions.flatMap((mention) => mention.source_segment_ids), ...provenanceSourcesFor(item.id)]), hasUnresolvedFlags: unresolvedTargetIds.has(item.id),
      hasTemporalAssertion: temporalTargetIds.has(item.id), confidence: null, extractionRunId: extractionRuns.length === 1 ? extractionRuns[0] : null, logicalOrder: null,
      details: compactDetails([detail("Entity kind", item.kind), detail("Resolved mentions", entityMentions.length), detail("Created", item.created_at)]),
    });
  }

  const timelineRunRows = extractionRuns.filter((run) => run.compiler_name === "icarus-testimony-timeline-candidate-compiler");
  const activeTimelineRunId = filters.timelineRunId ?? timelineRunRows.at(-1)?.id ?? null;
  const timelineRunById = new Map(timelineRunRows.map((run) => [run.id, run]));
  const timelineRuns: TimelineSnapshotRun[] = timelineRunRows.map((run) => ({
    id: run.id, compiler_name: run.compiler_name, compiler_version: run.compiler_version, contract_version: run.extraction_contract_version,
    configuration_sha256: run.configuration_sha256, status: run.status, created_at: run.created_at, completed_at: run.completed_at,
  }));
  const timelineCurrent: TimelineSnapshotItem[] = events.flatMap((event) => {
    const context = contextForKnowledge(event.knowledge_item_id);
    const run = context ? timelineRunById.get(context.extraction_run_id) : undefined;
    if (!context || !run || run.id !== activeTimelineRunId) return [];
    const proceeding = proceedingById.get(event.proceeding_id);
    const eventObject = allObjects.find((object) => object.id === event.id);
    return temporal.filter((assertion) => assertion.event_candidate_id === event.id).map<TimelineSnapshotItem>((assertion) => ({
      event_candidate_id: event.id,
      event_candidate_code: event.object_code,
      neutral_description: event.neutral_description,
      event_class: event.event_class,
      source_wording: event.source_wording,
      participant_mentions: event.participant_mentions,
      event_recurrence_pattern: event.recurrence_pattern,
      source_claim_ids: event.source_claim_ids,
      event_status: event.review_status,
      event_confidence: Number(event.extraction_confidence),
      temporal_assertion_id: assertion.id,
      temporal_assertion_code: assertion.object_code,
      raw_temporal_language: assertion.raw_temporal_language,
      precision: assertion.precision,
      asserted_start: assertion.asserted_start,
      asserted_end: assertion.asserted_end,
      asserted_date: assertion.asserted_date,
      asserted_time_of_day_start: assertion.asserted_time_of_day_start,
      asserted_time_of_day_end: assertion.asserted_time_of_day_end,
      time_of_day_band: assertion.time_of_day_band,
      qualification: assertion.qualification,
      qualifier_text: assertion.qualifier_text,
      confidence_basis: assertion.confidence_basis,
      sequence_language: assertion.sequence_language,
      duration_iso8601: assertion.duration_iso8601,
      relative_offset_value: assertion.relative_offset_value,
      relative_offset_unit: assertion.relative_offset_unit,
      temporal_recurrence_pattern: assertion.recurrence_pattern,
      temporal_status: assertion.review_status,
      temporal_confidence: Number(assertion.extraction_confidence),
      source_segment_ids: unique([...(eventObject?.sourceSegmentIds ?? []), ...assertion.source_segment_ids]),
      asserted_by_raw: assertion.asserted_by_raw || context.witness_label_raw,
      proceeding_id: event.proceeding_id,
      proceeding_title: proceeding?.title ?? "Unknown proceeding",
      proceeding_date: proceeding?.proceeding_date ?? null,
      extraction_run_id: run.id,
    }));
  });
  const savedTimelineViews: SavedTimelineView[] = savedTimelineViewRows.flatMap((row) => {
    const parsed = timelineSnapshotSchema.safeParse(row.snapshot);
    if (!parsed.success) return [];
    return [{
      id: row.id, name: row.name, version: row.version, description: row.description, extractionRunIds: row.extraction_run_ids,
      eventCandidateIds: row.event_candidate_ids, temporalAssertionIds: row.temporal_assertion_ids, viewState: row.view_state,
      snapshot: parsed.data, createdBy: row.created_by, createdAt: row.created_at,
    }];
  });

  const counts = Object.fromEntries((["knowledge", "claim", "event", "temporal", "mention", "entity", "relationship", "flag"] as StructureObjectType[]).map((type) => [type, allObjects.filter((item) => item.type === type).length])) as Record<StructureObjectType, number>;
  const assertedByFilter = filters.assertedBy?.trim().toLocaleLowerCase();
  const objects = allObjects.filter((item) => {
    if (filters.type !== "all" && item.type !== filters.type) return false;
    if (filters.proceedingId && item.proceedingId !== filters.proceedingId) return false;
    if (filters.reviewStatus && item.reviewStatus !== filters.reviewStatus) return false;
    if (assertedByFilter && !item.assertedBy?.toLocaleLowerCase().includes(assertedByFilter)) return false;
    if (filters.unresolvedOnly && !item.hasUnresolvedFlags) return false;
    if (filters.temporalOnly && !item.hasTemporalAssertion) return false;
    if (filters.segmentId && !item.sourceSegmentIds.includes(filters.segmentId)) return false;
    return true;
  }).sort((left, right) => (left.logicalOrder ?? Number.MAX_SAFE_INTEGER) - (right.logicalOrder ?? Number.MAX_SAFE_INTEGER) || left.title.localeCompare(right.title));

  const requestedObjectIsValid = !filters.objectId || uuidSchema.safeParse(filters.objectId).success;
  const requestedObject = filters.objectId && requestedObjectIsValid ? allObjects.find((item) => item.id === filters.objectId && (filters.type === "all" || item.type === filters.type)) : undefined;
  const selected = requestedObject ?? objects[0] ?? null;
  const selectedMissing = Boolean(filters.objectId) && (!requestedObjectIsValid || !requestedObject);
  const selectedSourceIsValid = !filters.segmentId || uuidSchema.safeParse(filters.segmentId).success;
  const selectedSourceId = selected ? (selectedSourceIsValid && filters.segmentId && selected.sourceSegmentIds.includes(filters.segmentId) ? filters.segmentId : selected.sourceSegmentIds[0] ?? null) : null;
  const requestedSegmentId = filters.segmentId;
  const selectedSourceMissing = Boolean(requestedSegmentId) && (!selectedSourceIsValid || !selected || !selected.sourceSegmentIds.includes(requestedSegmentId as string));

  let sources: StructureSource[] = [];
  if (selected?.sourceSegmentIds.length) {
    const segmentsResult = await supabase.from("source_segments").select("id,case_id,artifact_id,proceeding_id,proceeding_speaker_id,speaker_entity_id,ordinal,timestamp_start_ms,exact_text,locator,deep_link").eq("case_id", caseId).in("id", selected.sourceSegmentIds).limit(Math.max(selected.sourceSegmentIds.length, 1));
    const segments = rowsOrThrow(segmentsResult) as Array<{ id: string; artifact_id: string; proceeding_id: string | null; proceeding_speaker_id: string | null; speaker_entity_id: string | null; ordinal: number; timestamp_start_ms: number | null; exact_text: string; locator: SourceLocator; deep_link: string | null }>;
    const artifactIds = unique(segments.map((segment) => segment.artifact_id));
    const speakerIds = unique(segments.map((segment) => segment.proceeding_speaker_id));
    const entityIds = unique(segments.map((segment) => segment.speaker_entity_id));
    const [artifactsResult, speakersResult, sourceEntitiesResult] = await Promise.all([
      artifactIds.length ? supabase.from("source_artifacts").select("id,title,sha256,canonical_url").eq("case_id", caseId).in("id", artifactIds) : Promise.resolve({ data: [], error: null }),
      speakerIds.length ? supabase.from("proceeding_speakers").select("id,provider_label,canonical_name").eq("case_id", caseId).in("id", speakerIds) : Promise.resolve({ data: [], error: null }),
      entityIds.length ? supabase.from("entities").select("id,canonical_name").eq("case_id", caseId).in("id", entityIds) : Promise.resolve({ data: [], error: null }),
    ]);
    const artifacts = rowsOrThrow(artifactsResult) as Array<{ id: string; title: string; sha256: string; canonical_url: string | null }>;
    const speakers = rowsOrThrow(speakersResult) as Array<{ id: string; provider_label: string; canonical_name: string | null }>;
    const sourceEntities = rowsOrThrow(sourceEntitiesResult) as Array<{ id: string; canonical_name: string }>;
    const artifactById = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
    const speakerById = new Map(speakers.map((speaker) => [speaker.id, speaker.canonical_name || speaker.provider_label]));
    const entityById = new Map(sourceEntities.map((entity) => [entity.id, entity.canonical_name]));
    const sourceOrder = new Map(selected.sourceSegmentIds.map((id, index) => [id, index]));
    sources = segments.map((segment) => {
      const artifact = artifactById.get(segment.artifact_id);
      return {
        id: segment.id, proceedingId: segment.proceeding_id, proceedingTitle: proceedingTitle(segment.proceeding_id), artifactId: segment.artifact_id,
        artifactTitle: artifact?.title ?? "Restricted artifact", artifactSha256: artifact?.sha256 ?? "NOT RECORDED", artifactCanonicalUrl: artifact?.canonical_url ?? null,
        speaker: entityById.get(segment.speaker_entity_id ?? "") ?? speakerById.get(segment.proceeding_speaker_id ?? "") ?? "Unidentified speaker",
        ordinal: segment.ordinal, timestampStartMs: segment.timestamp_start_ms, exactText: segment.exact_text, locator: segment.locator, deepLink: segment.deep_link,
      };
    }).sort((left, right) => (sourceOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (sourceOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER));
  }

  let extraction: StructureWorkspace["extraction"] = null;
  let provenanceActivities: StructureWorkspace["provenanceActivities"] = [];
  if (selected?.extractionRunId) {
    const [runResult, activityResult] = await Promise.all([
      supabase.from("knowledge_extraction_runs").select("id,compiler_name,compiler_version,extraction_method,model_name,model_version,extraction_contract_version,status,configuration_sha256,created_at,completed_at").eq("case_id", caseId).eq("id", selected.extractionRunId).maybeSingle(),
      supabase.from("provenance_activities").select("id,activity_type,compiler_name,compiler_version,model_name,model_version,started_at,ended_at,system_agent").eq("case_id", caseId).eq("extraction_run_id", selected.extractionRunId).order("logical_order"),
    ]);
    if (runResult.error) throw new Error(runResult.error.message);
    const run = runResult.data as null | { id: string; compiler_name: string; compiler_version: string; extraction_method: string; model_name: string | null; model_version: string | null; extraction_contract_version: string; status: string; configuration_sha256: string; created_at: string; completed_at: string | null };
    if (run) extraction = { id: run.id, compilerName: run.compiler_name, compilerVersion: run.compiler_version, extractionMethod: run.extraction_method, modelName: run.model_name, modelVersion: run.model_version, contractVersion: run.extraction_contract_version, status: run.status, configurationSha256: run.configuration_sha256, createdAt: run.created_at, completedAt: run.completed_at };
    provenanceActivities = (rowsOrThrow(activityResult) as Array<{ id: string; activity_type: string; compiler_name: string | null; compiler_version: string | null; model_name: string | null; model_version: string | null; started_at: string | null; ended_at: string | null; system_agent: string | null }>).map((activity) => ({ id: activity.id, activityType: activity.activity_type, compilerName: activity.compiler_name, compilerVersion: activity.compiler_version, modelName: activity.model_name, modelVersion: activity.model_version, startedAt: activity.started_at, endedAt: activity.ended_at, systemAgent: activity.system_agent }));
  }

  let auditHistory: StructureWorkspace["auditHistory"] = [];
  if (selected) {
    const auditResult = await supabase.from("case_ledger").select("logical_order,operation,system_agent,created_at,details").eq("case_id", caseId).eq("object_id", selected.id).order("logical_order");
    auditHistory = (rowsOrThrow(auditResult) as Array<{ logical_order: number; operation: string; system_agent: string | null; created_at: string; details: unknown }>).map((entry) => ({ logicalOrder: entry.logical_order, operation: entry.operation, systemAgent: entry.system_agent, createdAt: entry.created_at, details: entry.details }));
  }

  const linkedSegmentIds = new Set(allObjects.flatMap((item) => item.sourceSegmentIds));
  const selectedProvenanceRelations = selected ? provenanceRelations.filter((relation) => relation.from_node_id === selected.id || relation.to_node_id === selected.id || Boolean(selected.extractionRunId && relation.extraction_run_id === selected.extractionRunId)).map((relation) => ({ id: relation.id, objectCode: relation.object_code, relationType: relation.relation_type, from: `${relation.from_node_type} · ${relation.from_node_id}`, to: `${relation.to_node_type} · ${relation.to_node_id}`, sourceSegmentIds: relation.source_segment_ids })) : [];

  return {
    currentCase, proceedings, objects, selected, selectedMissing, selectedSourceId, selectedSourceMissing, sources, counts,
    coverage: { totalSegments: segmentCountResult.count ?? 0, linkedSegments: linkedSegmentIds.size }, extraction, provenanceActivities,
    provenanceRelations: selectedProvenanceRelations, auditHistory,
    timeline: { runs: timelineRuns, activeRunId: activeTimelineRunId, current: timelineCurrent, savedViews: savedTimelineViews },
  };
}
