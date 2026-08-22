import { createHash } from "node:crypto";
import { z } from "zod";

const relationSchema = z.enum(["before", "overlaps", "during", "same_episode_candidate"]);

export const reconstructionDefinitionSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  lanes: z.array(z.object({ key: z.string().min(1), label: z.string().min(1) })).min(1),
  nodes: z.array(z.object({
    key: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().min(1),
    laneKey: z.string().min(1),
    temporalLabel: z.string().min(1),
    assertionRefs: z.array(z.string().min(1)).min(1),
  })).min(1),
  edges: z.array(z.object({
    from: z.string().min(1),
    to: z.string().min(1),
    relation: relationSchema,
    basisAssertionRefs: z.array(z.string().min(1)).min(1),
    rationale: z.string().min(1),
    confidenceBasis: z.string().min(1),
  })),
  tensions: z.array(z.object({
    key: z.string().min(1),
    title: z.string().min(1),
    field: z.string().min(1),
    assertionRefs: z.array(z.string().min(1)).min(2),
    note: z.string().min(1),
  })),
});

export type ReconstructionDefinition = z.input<typeof reconstructionDefinitionSchema>;

type TimelinePayload = {
  case_id: string;
  proceeding_id: string;
  run: { id: string; source_artifact_id: string; configuration_sha256: string };
  knowledge_items: Array<Record<string, unknown>>;
  event_candidates: Array<Record<string, unknown>>;
  temporal_assertions: Array<Record<string, unknown>>;
  boundary: { canonical_events_created: number; same_resolutions_created: number };
};

function unique(values: string[]) {
  return [...new Set(values)];
}

function assertAcyclicBeforeEdges(nodes: string[], edges: Array<{ from: string; to: string; relation: string }>) {
  const outgoing = new Map(nodes.map((node) => [node, [] as string[]]));
  const indegree = new Map(nodes.map((node) => [node, 0]));
  for (const edge of edges.filter((item) => item.relation === "before")) {
    outgoing.get(edge.from)!.push(edge.to);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  }
  const queue = nodes.filter((node) => indegree.get(node) === 0);
  let visited = 0;
  while (queue.length) {
    const node = queue.shift()!;
    visited += 1;
    for (const target of outgoing.get(node) ?? []) {
      indegree.set(target, (indegree.get(target) ?? 0) - 1);
      if (indegree.get(target) === 0) queue.push(target);
    }
  }
  if (visited !== nodes.length) throw new Error("Reconstruction before-edges contain a cycle.");
}

export function compileTestimonyReconstruction(input: {
  timeline: TimelinePayload;
  eventCandidateIdByRef: ReadonlyMap<string, string>;
  definition: ReconstructionDefinition;
  generatedAt?: string;
}) {
  const definition = reconstructionDefinitionSchema.parse(input.definition);
  const knowledgeItems = z.array(z.object({ id: z.string().uuid(), witness_label_raw: z.string().min(1) })).parse(input.timeline.knowledge_items);
  const eventCandidates = z.array(z.object({
    id: z.string().uuid(), knowledge_item_id: z.string().uuid(), neutral_description: z.string().min(1),
    event_class: z.string().min(1), source_wording: z.string().min(1), source_claim_ids: z.array(z.string().uuid()).min(1),
  })).parse(input.timeline.event_candidates);
  const temporalAssertions = z.array(z.object({
    id: z.string().uuid(), event_candidate_id: z.string().uuid(), raw_temporal_language: z.string().min(1),
    precision: z.string().min(1), qualification: z.string().min(1), source_segment_ids: z.array(z.string().uuid()).min(1),
  })).parse(input.timeline.temporal_assertions);
  if (input.timeline.boundary.canonical_events_created !== 0 || input.timeline.boundary.same_resolutions_created !== 0) {
    throw new Error("Reconstruction requires a candidate-only timeline run.");
  }
  const laneKeys = new Set(definition.lanes.map((lane) => lane.key));
  const nodeKeys = definition.nodes.map((node) => node.key);
  if (new Set(nodeKeys).size !== nodeKeys.length) throw new Error("Reconstruction node keys must be unique.");
  if (definition.nodes.some((node) => !laneKeys.has(node.laneKey))) throw new Error("Reconstruction node references an unknown lane.");
  const nodeKeySet = new Set(nodeKeys);
  if (definition.edges.some((edge) => !nodeKeySet.has(edge.from) || !nodeKeySet.has(edge.to) || edge.from === edge.to)) {
    throw new Error("Reconstruction edge references an invalid node.");
  }
  assertAcyclicBeforeEdges(nodeKeys, definition.edges);

  const candidateById = new Map(eventCandidates.map((candidate) => [candidate.id, candidate]));
  const temporalByCandidateId = new Map(temporalAssertions.map((assertion) => [assertion.event_candidate_id, assertion]));
  const witnessByKnowledgeId = new Map(knowledgeItems.map((item) => [item.id, item.witness_label_raw]));
  const allRefs = unique([
    ...definition.nodes.flatMap((node) => node.assertionRefs),
    ...definition.edges.flatMap((edge) => edge.basisAssertionRefs),
    ...definition.tensions.flatMap((tension) => tension.assertionRefs),
  ]);
  const assertionByRef = new Map(allRefs.map((ref) => {
    const candidateId = input.eventCandidateIdByRef.get(ref);
    const candidate = candidateId ? candidateById.get(candidateId) : undefined;
    const temporal = candidateId ? temporalByCandidateId.get(candidateId) : undefined;
    if (!candidate || !temporal) throw new Error(`Unknown reconstruction assertion reference: ${ref}`);
    return [ref, {
      ref,
      event_candidate_id: candidate.id,
      temporal_assertion_id: temporal.id,
      witness: witnessByKnowledgeId.get(candidate.knowledge_item_id) ?? "Unidentified witness",
      neutral_description: candidate.neutral_description,
      event_class: candidate.event_class,
      source_wording: candidate.source_wording,
      raw_temporal_language: temporal.raw_temporal_language,
      precision: temporal.precision,
      qualification: temporal.qualification,
      source_segment_ids: temporal.source_segment_ids,
    }] as const;
  }));

  const assertions = allRefs.map((ref) => assertionByRef.get(ref)!);
  const snapshotCore = {
    schema_version: "testimony-reconstruction/1.0" as const,
    case_id: input.timeline.case_id,
    title: definition.title,
    description: definition.description,
    source_run_ids: [input.timeline.run.id],
    source_proceeding_ids: [input.timeline.proceeding_id],
    source_artifact_ids: [input.timeline.run.source_artifact_id],
    source_event_candidate_ids: unique(assertions.map((item) => item.event_candidate_id)),
    source_temporal_assertion_ids: unique(assertions.map((item) => item.temporal_assertion_id)),
    lanes: definition.lanes,
    assertions,
    nodes: definition.nodes.map((node, index) => ({ ...node, ordinal: index + 1, status: "proposed" as const })),
    edges: definition.edges,
    tensions: definition.tensions.map((tension) => ({ ...tension, status: "unresolved" as const })),
    boundaries: {
      canonical_events_created: 0,
      same_resolutions_created: 0,
      testimony_timestamps_used_as_event_time: 0,
      unresolved_tensions_collapsed: 0,
    },
  };
  const snapshotSha256 = createHash("sha256").update(JSON.stringify(snapshotCore)).digest("hex");
  return { ...snapshotCore, generated_at: input.generatedAt ?? new Date().toISOString(), snapshot_sha256: snapshotSha256 };
}

export type TestimonyReconstructionSnapshot = ReturnType<typeof compileTestimonyReconstruction>;
