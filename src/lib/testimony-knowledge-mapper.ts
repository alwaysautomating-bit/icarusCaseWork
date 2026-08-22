import { createHash } from "node:crypto";
import { z } from "zod";

import type { ParsedRevTranscript, ParsedTranscriptSegment } from "@/lib/rev-testimony";
import {
  classifyPhases,
  detectWitnessBlocks,
  extractProceduralMarkers,
} from "../../scripts/transcript-first-pass-lib.mjs";

export const KNOWLEDGE_MAPPER_NAME = "icarus-testimony-knowledge-mapper";
export const KNOWLEDGE_MAPPER_VERSION = "1.0.0";
export const KNOWLEDGE_CONTRACT_VERSION = "testimony-knowledge/1.0";

const informationBasisSchema = z.enum([
  "PERSONALLY_OBSERVED",
  "HEARD_FROM_PERSON",
  "READ_IN_RECORD",
  "REVIEWED_DEVICE_DATA",
  "RECALLED",
  "EXPERT_INFERENCE",
  "PARTY_ARGUMENT",
  "UNKNOWN_BASIS",
]);
const temporalPrecisionSchema = z.enum([
  "exact_timestamp",
  "exact_date",
  "exact_time",
  "approximate",
  "interval",
  "bounded_interval",
  "relative_only",
  "sequence_only",
  "unknown",
]);
const contextRoleSchema = z.enum(["substantive", "question", "answer", "procedural", "context"]);

export const semanticKnowledgeCandidateSchema = z.object({
  key: z.string().min(1),
  witnessBlockImportedId: z.string().regex(/^witness_\d{3}$/),
  unitKind: z.enum(["qa_thread", "substantive_thread", "procedural_context", "mixed"]),
  reviewStatus: z.enum(["pending", "accepted", "amended", "split", "rejected", "deferred"]).default("pending"),
  segments: z.array(z.object({ segmentId: z.string().uuid(), contextRole: contextRoleSchema })).min(1),
  summary: z.string().min(1),
  unknowns: z.array(z.string().min(1)).default([]),
  claims: z.array(z.object({
    key: z.string().min(1),
    assertedByRaw: z.string().min(1),
    assertedByEntityId: z.string().uuid().nullable().default(null),
    speakerCapacity: z.string().nullable().default(null),
    normalizedAssertion: z.string().min(1),
    assertionStatus: z.enum(["asserted", "disputed", "qualified", "corrected", "withdrawn", "stipulated", "court_found", "unknown"]).default("asserted"),
    informationBasis: informationBasisSchema,
    provenanceType: z.enum(["trial_testimony", "direct_observation", "reported_statement", "hearsay_report", "primary_record", "derived_record", "expert_opinion", "procedural_record", "unknown"]),
    sourceSegmentIds: z.array(z.string().uuid()).min(1),
    extractionConfidence: z.number().min(0).max(1),
    propositionId: z.string().uuid().nullable().default(null),
  })).default([]),
  entityMentions: z.array(z.object({
    key: z.string().min(1), rawMention: z.string().min(1), normalizedCandidate: z.string().nullable().default(null),
    mentionType: z.string().nullable().default(null), sourceSegmentIds: z.array(z.string().uuid()).min(1),
  })).default([]),
  eventCandidates: z.array(z.object({
    key: z.string().min(1), neutralDescription: z.string().min(1), participantMentions: z.array(z.string()).default([]),
    eventClass: z.string().min(1).default("event"), sourceWording: z.string().min(1).nullable().default(null),
    recurrencePattern: z.record(z.string(), z.unknown()).nullable().default(null),
    sourceClaimKeys: z.array(z.string()).min(1), extractionConfidence: z.number().min(0).max(1),
  })).default([]),
  temporalAssertions: z.array(z.object({
    key: z.string().min(1), eventCandidateKey: z.string().min(1), sourceClaimKey: z.string().nullable().default(null),
    rawTemporalLanguage: z.string().min(1), assertedStart: z.string().datetime({ offset: true }).nullable().default(null),
    assertedEnd: z.string().datetime({ offset: true }).nullable().default(null), precision: temporalPrecisionSchema,
    assertedDate: z.string().date().nullable().default(null),
    assertedTimeOfDayStart: z.string().nullable().default(null), assertedTimeOfDayEnd: z.string().nullable().default(null),
    timeOfDayBand: z.string().nullable().default(null), datePrecision: z.string().nullable().default(null),
    timeOfDayPrecision: z.string().nullable().default(null), qualification: z.string().min(1).default("asserted"),
    qualifierText: z.string().nullable().default(null), confidenceBasis: z.string().min(1).default("wording:unqualified"),
    sequenceLanguage: z.string().nullable().default(null), durationIso8601: z.string().nullable().default(null),
    relativeOffsetValue: z.number().int().nullable().default(null), relativeOffsetUnit: z.string().nullable().default(null),
    recurrencePattern: z.record(z.string(), z.unknown()).nullable().default(null),
    lowerBoundEventCandidateKey: z.string().nullable().default(null), upperBoundEventCandidateKey: z.string().nullable().default(null),
    assertedByRaw: z.string().min(1), sourceSegmentIds: z.array(z.string().uuid()).min(1), extractionConfidence: z.number().min(0).max(1),
  })).default([]),
  relationships: z.array(z.object({
    key: z.string().min(1),
    from: z.object({ type: z.enum(["knowledge_item", "claim", "event_candidate", "entity_mention", "source_segment"]), ref: z.string().min(1) }),
    relationType: z.string().min(1),
    to: z.object({ type: z.enum(["knowledge_item", "claim", "event_candidate", "entity_mention", "source_segment"]), ref: z.string().min(1) }),
    sourceClaimKey: z.string().nullable().default(null), assertionStatus: z.enum(["asserted", "candidate", "qualified", "corrected", "withdrawn", "unknown"]),
    extractionConfidence: z.number().min(0).max(1),
  })).default([]),
  flags: z.array(z.object({
    key: z.string().min(1), target: z.object({ type: z.enum(["knowledge_item", "claim", "event_candidate", "entity_mention", "source_segment"]), ref: z.string().min(1) }),
    flagType: z.string().min(1), rationale: z.string().min(1), origin: z.enum(["human", "agent", "deterministic_rule"]),
    status: z.enum(["proposed", "accepted", "rejected", "resolved", "deferred"]), sourceSegmentIds: z.array(z.string().uuid()).default([]),
  })).default([]),
});

export type SemanticKnowledgeCandidate = z.input<typeof semanticKnowledgeCandidateSchema>;

type DeterministicTurn = {
  segment_index: number;
  source_line: number;
  speaker: string;
  timestamp_display: string;
  timestamp_seconds: number;
  url: string | null;
  text: string;
};

export type DeterministicStructure = {
  turns: DeterministicTurn[];
  witnessBlocks: ReturnType<typeof detectWitnessBlocks>;
  phaseSets: ReturnType<typeof classifyPhases>;
  proceduralMarkers: ReturnType<typeof extractProceduralMarkers>;
  qa: {
    segmentCount: number;
    timestampRegressions: number;
    impossibleTimestampRegressions: number;
    timestampRegressionDetails: Array<{ previousSegmentId: string; segmentId: string; deltaMs: number }>;
    blockOverlaps: number;
    invalidBlocks: number;
    unassignedSegmentIds: string[];
    lowConfidenceBlockIds: string[];
  };
};

export type CompileKnowledgeMapInput = {
  caseId: string;
  proceedingId: string;
  sourceArtifactId: string;
  transcript: Pick<ParsedRevTranscript, "sourceSha256" | "segments">;
  candidates: SemanticKnowledgeCandidate[];
  extractionMethod?: "deterministic" | "model" | "hybrid" | "reviewed_import";
  modelName?: string | null;
  modelVersion?: string | null;
  compilerName?: string;
  compilerVersion?: string;
  contractVersion?: string;
  activityType?: string;
};

function stableUuid(namespace: string, value: string) {
  const hash = createHash("sha256").update(`${namespace}\0${value}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function objectCode(prefix: string, identity: string) {
  return `${prefix}-${createHash("sha256").update(identity).digest("hex").slice(0, 10).toUpperCase()}`;
}

function segmentTurns(segments: ParsedTranscriptSegment[]): DeterministicTurn[] {
  return segments.map((segment) => ({
    segment_index: segment.ordinal,
    source_line: segment.ordinal + 1,
    speaker: segment.speaker,
    timestamp_display: segment.locator.timestampStart,
    timestamp_seconds: segment.timestampStartMs / 1_000,
    url: segment.deepLink || null,
    text: segment.text,
  }));
}

export function buildDeterministicStructure(segments: ParsedTranscriptSegment[]): DeterministicStructure {
  if (segments.length === 0) throw new Error("Knowledge mapping requires committed transcript segments.");
  const turns = segmentTurns(segments);
  const witnessBlocks = detectWitnessBlocks(turns);
  const phaseSets = classifyPhases(turns, witnessBlocks);
  const proceduralMarkers = extractProceduralMarkers(turns);
  const timestampRegressionDetails: Array<{ previousSegmentId: string; segmentId: string; deltaMs: number }> = [];
  for (let index = 1; index < segments.length; index += 1) {
    const deltaMs = segments[index].timestampStartMs - segments[index - 1].timestampStartMs;
    if (deltaMs < 0) timestampRegressionDetails.push({ previousSegmentId: segments[index - 1].id, segmentId: segments[index].id, deltaMs });
  }
  let blockOverlaps = 0;
  let invalidBlocks = 0;
  const assigned = new Set<number>();
  witnessBlocks.forEach((block: { start: { segment_index: number }; end: { segment_index: number }; block_id: string; boundary_confidence: number }, index: number) => {
    if (block.start.segment_index > block.end.segment_index) invalidBlocks += 1;
    if (index > 0 && block.start.segment_index <= witnessBlocks[index - 1].end.segment_index) blockOverlaps += 1;
    for (let segmentIndex = block.start.segment_index; segmentIndex <= block.end.segment_index; segmentIndex += 1) assigned.add(segmentIndex);
  });
  return {
    turns, witnessBlocks, phaseSets, proceduralMarkers,
    qa: {
      segmentCount: segments.length,
      timestampRegressions: timestampRegressionDetails.length,
      impossibleTimestampRegressions: timestampRegressionDetails.filter((item) => item.deltaMs < -5_000).length,
      timestampRegressionDetails,
      blockOverlaps,
      invalidBlocks,
      unassignedSegmentIds: segments.filter((_, index) => !assigned.has(index)).map((segment) => segment.id),
      lowConfidenceBlockIds: witnessBlocks.filter((block: { boundary_confidence: number }) => block.boundary_confidence < 0.8).map((block: { block_id: string }) => block.block_id),
    },
  };
}

function phaseForSegment(structure: DeterministicStructure, blockId: string, segmentIndex: number) {
  const set = structure.phaseSets.find((item: { block_id: string }) => item.block_id === blockId);
  const phase = set?.phases.find((item: { start: { segment_index: number }; end: { segment_index: number } }) => segmentIndex >= item.start.segment_index && segmentIndex <= item.end.segment_index);
  return phase ? { phase: phase.phase as string, confidence: 0.65, juryState: phase.jury_present ? "present" : "not_present" } : { phase: null, confidence: null, juryState: null };
}

function assertSubset(label: string, child: string[], parent: Set<string>) {
  if (new Set(child).size !== child.length || child.some((id) => !parent.has(id))) throw new Error(`${label} contains duplicate or out-of-scope source segments.`);
}

function resolveRef(ref: { type: string; ref: string }, currentKnowledgeItemId: string, ids: Map<string, string>, segmentIds: Set<string>) {
  if (ref.type === "knowledge_item") return currentKnowledgeItemId;
  if (ref.type === "source_segment") {
    if (!segmentIds.has(ref.ref)) throw new Error(`Unknown source segment reference: ${ref.ref}`);
    return ref.ref;
  }
  const id = ids.get(`${ref.type}:${ref.ref}`);
  if (!id) throw new Error(`Unknown ${ref.type} reference: ${ref.ref}`);
  return id;
}

export function compileTestimonyKnowledgeMap(input: CompileKnowledgeMapInput) {
  z.string().uuid().parse(input.caseId);
  z.string().uuid().parse(input.proceedingId);
  z.string().uuid().parse(input.sourceArtifactId);
  const candidates = z.array(semanticKnowledgeCandidateSchema).parse(input.candidates);
  const structure = buildDeterministicStructure(input.transcript.segments);
  if (structure.qa.impossibleTimestampRegressions || structure.qa.blockOverlaps || structure.qa.invalidBlocks) throw new Error("Deterministic transcript QA failed.");

  const segmentById = new Map(input.transcript.segments.map((segment) => [segment.id, segment]));
  const segmentIds = new Set(segmentById.keys());
  const compilerName = input.compilerName ?? KNOWLEDGE_MAPPER_NAME;
  const compilerVersion = input.compilerVersion ?? KNOWLEDGE_MAPPER_VERSION;
  const contractVersion = input.contractVersion ?? KNOWLEDGE_CONTRACT_VERSION;
  const configuration = JSON.stringify({ contract: contractVersion, candidates });
  const configurationSha256 = createHash("sha256").update(configuration).digest("hex");
  const runId = stableUuid("knowledge-run", `${input.proceedingId}:${configurationSha256}`);
  const extractionMethod = input.extractionMethod ?? "hybrid";

  const witnessBlocks = structure.witnessBlocks.map((block: {
    block_id: string; witness_name_candidate: string; start: { segment_index: number }; end: { segment_index: number };
    boundary_confidence: number;
  }) => {
    const id = stableUuid("witness-block", `${input.transcript.sourceSha256}:${block.block_id}:${block.start.segment_index}:${block.end.segment_index}`);
    const phaseSet = structure.phaseSets.find((item: { block_id: string }) => item.block_id === block.block_id);
    const markers = structure.proceduralMarkers.filter((marker: { locator: { segment_index: number } }) => marker.locator.segment_index >= block.start.segment_index && marker.locator.segment_index <= block.end.segment_index);
    const blockSegments = input.transcript.segments.slice(block.start.segment_index, block.end.segment_index + 1);
    return {
      id, object_code: objectCode("WIT", id), imported_id: block.block_id, witness_label_raw: block.witness_name_candidate,
      resolved_entity_id: null, resolution_status: "unresolved", resolution_basis: null,
      start_segment_id: blockSegments[0].id, end_segment_id: blockSegments.at(-1)!.id,
      start_timestamp_ms: blockSegments[0].timestampStartMs, end_timestamp_ms: blockSegments.at(-1)!.timestampStartMs,
      boundary_confidence: block.boundary_confidence,
      exam_phase_candidates: phaseSet?.phases.map((phase: { phase: string; start: unknown; end: unknown }) => ({ phase: phase.phase, start: phase.start, end: phase.end, confidence: 0.65 })) ?? [],
      jury_state_candidates: phaseSet?.phases.map((phase: { jury_present: boolean; start: unknown; end: unknown }) => ({ state: phase.jury_present ? "present" : "not_present", start: phase.start, end: phase.end, confidence: 0.65 })) ?? [],
      procedural_markers: markers, review_status: "pending", source_segment_ids: blockSegments.map((segment) => segment.id),
    };
  });
  const blockByImportedId = new Map(witnessBlocks.map((block) => [block.imported_id, block]));

  const testimonyUnits: Array<Record<string, unknown>> = [];
  const knowledgeItems: Array<Record<string, unknown>> = [];
  const claims: Array<Record<string, unknown>> = [];
  const entityMentions: Array<Record<string, unknown>> = [];
  const eventCandidates: Array<Record<string, unknown>> = [];
  const temporalAssertions: Array<Record<string, unknown>> = [];
  const relationships: Array<Record<string, unknown>> = [];
  const flags: Array<Record<string, unknown>> = [];
  const provenanceRelations: Array<Record<string, unknown>> = [];

  candidates.forEach((candidate) => {
    const block = blockByImportedId.get(candidate.witnessBlockImportedId);
    if (!block) throw new Error(`Unknown witness block: ${candidate.witnessBlockImportedId}`);
    const sourceSegmentIds = candidate.segments.map((item) => item.segmentId);
    assertSubset("Testimony unit", sourceSegmentIds, new Set(block.source_segment_ids));
    const sorted = sourceSegmentIds.map((id) => segmentById.get(id)!).sort((left, right) => left.ordinal - right.ordinal);
    const phase = phaseForSegment(structure, candidate.witnessBlockImportedId, sorted[0].ordinal);
    const unitId = stableUuid("testimony-unit", `${input.transcript.sourceSha256}:${candidate.key}:${sourceSegmentIds.join(":")}`);
    const knowledgeItemId = stableUuid("knowledge-item", unitId);
    testimonyUnits.push({
      id: unitId, object_code: objectCode("TST", unitId), witness_block_id: block.id, unit_kind: candidate.unitKind,
      witness_label_raw: block.witness_label_raw, phase_candidate: phase.phase, phase_confidence: phase.confidence,
      jury_state_candidate: phase.juryState, procedural_context: block.procedural_markers.filter((marker: { locator: { segment_index: number } }) => marker.locator.segment_index >= sorted[0].ordinal && marker.locator.segment_index <= sorted.at(-1)!.ordinal),
      start_segment_id: sorted[0].id, end_segment_id: sorted.at(-1)!.id, review_status: candidate.reviewStatus,
      segments: candidate.segments.map((item) => ({ source_segment_id: item.segmentId, context_role: item.contextRole })),
    });
    knowledgeItems.push({
      id: knowledgeItemId, object_code: objectCode("KI", knowledgeItemId), testimony_unit_id: unitId, summary: candidate.summary,
      witness_label_raw: block.witness_label_raw, witness_entity_id: null, witness_resolution_status: "unresolved",
      phase_candidate: phase.phase, phase_confidence: phase.confidence, jury_state_candidate: phase.juryState,
      unknowns: candidate.unknowns, review_status: candidate.reviewStatus, source_segment_ids: sourceSegmentIds,
    });

    const localIds = new Map<string, string>();
    candidate.claims.forEach((claim) => localIds.set(`claim:${claim.key}`, stableUuid("knowledge-claim", `${knowledgeItemId}:${claim.key}`)));
    candidate.entityMentions.forEach((mention) => localIds.set(`entity_mention:${mention.key}`, stableUuid("entity-mention", `${knowledgeItemId}:${mention.key}`)));
    candidate.eventCandidates.forEach((event) => localIds.set(`event_candidate:${event.key}`, stableUuid("event-candidate", `${knowledgeItemId}:${event.key}`)));

    candidate.claims.forEach((claim) => {
      assertSubset("Claim", claim.sourceSegmentIds, new Set(sourceSegmentIds));
      const id = localIds.get(`claim:${claim.key}`)!;
      claims.push({
        id, object_code: objectCode("CLM", id), knowledge_item_id: knowledgeItemId, asserted_by_raw: claim.assertedByRaw,
        asserted_by_entity_id: claim.assertedByEntityId, speaker_capacity: claim.speakerCapacity,
        normalized_assertion: claim.normalizedAssertion, assertion_status: claim.assertionStatus,
        information_basis: claim.informationBasis, provenance_type: claim.provenanceType,
        source_segment_ids: claim.sourceSegmentIds, source_quote: claim.sourceSegmentIds.map((segmentId) => segmentById.get(segmentId)!.text).join("\n\n"),
        extraction_confidence: claim.extractionConfidence, proposition_id: claim.propositionId,
        review_reasons: ["machine_extracted", "testimony_knowledge_mapping", "truth_unassessed"],
      });
    });
    candidate.entityMentions.forEach((mention) => {
      assertSubset("Entity mention", mention.sourceSegmentIds, new Set(sourceSegmentIds));
      const id = localIds.get(`entity_mention:${mention.key}`)!;
      entityMentions.push({ id, object_code: objectCode("ENTREF", id), knowledge_item_id: knowledgeItemId, raw_mention: mention.rawMention,
        normalized_candidate: mention.normalizedCandidate, mention_type: mention.mentionType, resolved_entity_id: null,
        resolution_status: mention.normalizedCandidate ? "candidate" : "unresolved", resolution_confidence: null,
        resolution_basis: null, source_segment_ids: mention.sourceSegmentIds, review_status: "pending" });
    });
    candidate.eventCandidates.forEach((event) => {
      const id = localIds.get(`event_candidate:${event.key}`)!;
      eventCandidates.push({ id, object_code: objectCode("EVT", id), knowledge_item_id: knowledgeItemId,
        neutral_description: event.neutralDescription, participant_mentions: event.participantMentions,
        source_claim_ids: event.sourceClaimKeys.map((key) => {
          const claimId = localIds.get(`claim:${key}`); if (!claimId) throw new Error(`Unknown source claim key: ${key}`); return claimId;
        }), event_class: event.eventClass, source_wording: event.sourceWording, recurrence_pattern: event.recurrencePattern,
        extraction_confidence: event.extractionConfidence, review_status: "pending" });
    });
    candidate.temporalAssertions.forEach((temporal) => {
      if (["unknown", "relative_only"].includes(temporal.precision) && (temporal.assertedStart || temporal.assertedEnd)) throw new Error(`${temporal.precision} time cannot include an asserted timestamp.`);
      assertSubset("Temporal assertion", temporal.sourceSegmentIds, new Set(sourceSegmentIds));
      const eventCandidateId = localIds.get(`event_candidate:${temporal.eventCandidateKey}`);
      if (!eventCandidateId) throw new Error(`Unknown event candidate key: ${temporal.eventCandidateKey}`);
      const sourceClaimId = temporal.sourceClaimKey ? localIds.get(`claim:${temporal.sourceClaimKey}`) : null;
      if (temporal.sourceClaimKey && !sourceClaimId) throw new Error(`Unknown temporal source claim key: ${temporal.sourceClaimKey}`);
      const id = stableUuid("temporal-assertion", `${knowledgeItemId}:${temporal.key}`);
      temporalAssertions.push({ id, object_code: objectCode("TMP", id), knowledge_item_id: knowledgeItemId,
        source_claim_id: sourceClaimId, event_id: null, event_candidate_id: eventCandidateId,
        raw_temporal_language: temporal.rawTemporalLanguage, asserted_start: temporal.assertedStart, asserted_end: temporal.assertedEnd,
        precision: temporal.precision, temporal_band_id: null, lower_bound_event_id: null, upper_bound_event_id: null,
        asserted_date: temporal.assertedDate, asserted_time_of_day_start: temporal.assertedTimeOfDayStart,
        asserted_time_of_day_end: temporal.assertedTimeOfDayEnd, time_of_day_band: temporal.timeOfDayBand,
        date_precision: temporal.datePrecision, time_of_day_precision: temporal.timeOfDayPrecision,
        qualification: temporal.qualification, qualifier_text: temporal.qualifierText, confidence_basis: temporal.confidenceBasis,
        sequence_language: temporal.sequenceLanguage, duration_iso8601: temporal.durationIso8601,
        relative_offset_value: temporal.relativeOffsetValue, relative_offset_unit: temporal.relativeOffsetUnit,
        recurrence_pattern: temporal.recurrencePattern,
        lower_bound_event_candidate_id: temporal.lowerBoundEventCandidateKey ? localIds.get(`event_candidate:${temporal.lowerBoundEventCandidateKey}`) ?? null : null,
        upper_bound_event_candidate_id: temporal.upperBoundEventCandidateKey ? localIds.get(`event_candidate:${temporal.upperBoundEventCandidateKey}`) ?? null : null,
        asserted_by_entity_id: null, asserted_by_raw: temporal.assertedByRaw, source_segment_ids: temporal.sourceSegmentIds,
        extraction_confidence: temporal.extractionConfidence, review_status: "pending" });
    });
    candidate.relationships.forEach((relationship) => {
      if (["supports", "corroborates", "contradicts", "conflicts_with", "causes", "caused_by"].includes(relationship.relationType)) throw new Error(`Relationship ${relationship.relationType} crosses the transcript compiler boundary.`);
      const id = stableUuid("knowledge-relationship", `${knowledgeItemId}:${relationship.key}`);
      relationships.push({ id, object_code: objectCode("REL", id), from_node_type: relationship.from.type,
        from_node_id: resolveRef(relationship.from, knowledgeItemId, localIds, segmentIds), relation_type: relationship.relationType,
        to_node_type: relationship.to.type, to_node_id: resolveRef(relationship.to, knowledgeItemId, localIds, segmentIds),
        source_claim_id: relationship.sourceClaimKey ? localIds.get(`claim:${relationship.sourceClaimKey}`) : null,
        knowledge_item_id: knowledgeItemId, assertion_status: relationship.assertionStatus,
        extraction_confidence: relationship.extractionConfidence, review_status: "pending" });
    });
    candidate.flags.forEach((flag) => {
      const id = stableUuid("knowledge-flag", `${knowledgeItemId}:${flag.key}`);
      flags.push({ id, object_code: objectCode("FLG", id), target_node_type: flag.target.type,
        target_node_id: resolveRef(flag.target, knowledgeItemId, localIds, segmentIds), flag_type: flag.flagType,
        rationale: flag.rationale, origin: flag.origin, status: flag.origin === "agent" ? "proposed" : flag.status,
        supporting_context: { knowledge_item_id: knowledgeItemId }, source_segment_ids: flag.sourceSegmentIds });
    });

    const itemProvId = stableUuid("prov-relation", `${knowledgeItemId}:generated`);
    provenanceRelations.push({ id: itemProvId, object_code: objectCode("REL", itemProvId), from_node_type: "knowledge_item",
      from_node_id: knowledgeItemId, relation_type: "was_generated_by", to_node_type: "provenance_activity",
      to_node_id: stableUuid("prov-activity", `${runId}:knowledge`), source_segment_ids: sourceSegmentIds });
    sourceSegmentIds.forEach((segmentId) => {
      const id = stableUuid("prov-relation", `${knowledgeItemId}:derived:${segmentId}`);
      provenanceRelations.push({ id, object_code: objectCode("REL", id), from_node_type: "knowledge_item", from_node_id: knowledgeItemId,
        relation_type: "was_derived_from", to_node_type: "source_segment", to_node_id: segmentId, source_segment_ids: [segmentId] });
    });
  });

  const parseActivityId = stableUuid("prov-activity", `${runId}:parse`);
  const structureActivityId = stableUuid("prov-activity", `${runId}:structure`);
  const knowledgeActivityId = stableUuid("prov-activity", `${runId}:knowledge`);
  const provenanceActivities = [
    { id: parseActivityId, object_code: objectCode("ACT", parseActivityId), activity_type: "transcript_parse", compiler_name: "Icarus Testimony Compiler", compiler_version: "2.0.0", model_name: null, model_version: null, extraction_contract_version: null, configuration_sha256: null, started_at: null, ended_at: null, system_agent: "deterministic" },
    { id: structureActivityId, object_code: objectCode("ACT", structureActivityId), activity_type: "deterministic_structure", compiler_name: "icarus-testimony-first-pass", compiler_version: "0.2.0", model_name: null, model_version: null, extraction_contract_version: null, configuration_sha256: null, started_at: null, ended_at: null, system_agent: "deterministic" },
    { id: knowledgeActivityId, object_code: objectCode("ACT", knowledgeActivityId), activity_type: input.activityType ?? "knowledge_extraction", compiler_name: compilerName, compiler_version: compilerVersion, model_name: input.modelName ?? null, model_version: input.modelVersion ?? null, extraction_contract_version: contractVersion, configuration_sha256: configurationSha256, started_at: null, ended_at: null, system_agent: extractionMethod },
  ];
  const baseRelations = [
    { key: "parse-used-artifact", fromType: "provenance_activity", fromId: parseActivityId, relation: "used", toType: "source_artifact", toId: input.sourceArtifactId },
    { key: "structure-used-parse", fromType: "provenance_activity", fromId: structureActivityId, relation: "used", toType: "provenance_activity", toId: parseActivityId },
    { key: "knowledge-used-structure", fromType: "provenance_activity", fromId: knowledgeActivityId, relation: "used", toType: "provenance_activity", toId: structureActivityId },
  ].map((relation) => {
    const id = stableUuid("prov-relation", `${runId}:${relation.key}`);
    return { id, object_code: objectCode("REL", id), from_node_type: relation.fromType, from_node_id: relation.fromId,
      relation_type: relation.relation, to_node_type: relation.toType, to_node_id: relation.toId, source_segment_ids: [] };
  });

  return {
    schema_version: contractVersion,
    case_id: input.caseId,
    proceeding_id: input.proceedingId,
    run: { id: runId, source_artifact_id: input.sourceArtifactId, compiler_name: compilerName,
      compiler_version: compilerVersion, extraction_method: extractionMethod, model_name: input.modelName ?? null,
      model_version: input.modelVersion ?? null, extraction_contract_version: contractVersion,
      configuration_sha256: configurationSha256 },
    witness_blocks: witnessBlocks,
    testimony_units: testimonyUnits,
    knowledge_items: knowledgeItems,
    claims,
    entity_mentions: entityMentions,
    event_candidates: eventCandidates,
    temporal_assertions: temporalAssertions,
    relationships,
    flags,
    provenance_activities: provenanceActivities,
    provenance_relations: [...baseRelations, ...provenanceRelations],
    deterministic_qa: structure.qa,
    invariants: [
      "record time, event time, and information provenance remain independent",
      "unknown event time never receives a transcript timestamp",
      "derived objects cite exact committed source segments",
      "canonical entity resolution is delegated to SAME",
      "no support, contradiction, truth, verification, or causation assessment is created",
    ],
  };
}
