import { z } from "zod";

export const reconciliationNodeTypes = ["knowledge", "claim", "event", "temporal", "mention", "relationship", "flag"] as const;
export const reconciliationRoles = ["anchor", "supporting", "conflicting", "context", "unresolved"] as const;
export const reconciliationRelations = ["supports", "conflicts_with", "qualifies", "duplicates", "derives_from", "same_occurrence_candidate", "distinct_occurrence", "sequence_consistent", "leaves_unresolved"] as const;
export const reconciliationStatuses = ["open", "reviewed", "deferred"] as const;

export type ReconciliationNodeType = (typeof reconciliationNodeTypes)[number];
export type ReconciliationRole = (typeof reconciliationRoles)[number];
export type ReconciliationRelation = (typeof reconciliationRelations)[number];
export type ReconciliationStatus = (typeof reconciliationStatuses)[number];

export const reconciliationMemberInputSchema = z.object({
  node_type: z.enum(reconciliationNodeTypes),
  node_id: z.uuid(),
  role: z.enum(reconciliationRoles),
});

export const reconciliationEdgeSchema = z.object({
  from_type: z.enum(reconciliationNodeTypes),
  from_id: z.uuid(),
  to_type: z.enum(reconciliationNodeTypes),
  to_id: z.uuid(),
  relation_type: z.enum(reconciliationRelations),
  rationale: z.string().trim().min(3).max(2_000),
});

export const reconciliationMemberSnapshotSchema = reconciliationMemberInputSchema.extend({
  object_code: z.string().nullable(),
  title: z.string(),
  review_status: z.enum(["accepted", "amended"]),
  proceeding_id: z.uuid().nullable(),
  source_segment_ids: z.array(z.uuid()).min(1),
});

export const reconciliationSnapshotSchema = z.object({
  schema_version: z.literal("reconciliation-group/1.0"),
  name: z.string(),
  description: z.string(),
  status: z.enum(reconciliationStatuses),
  members: z.array(reconciliationMemberSnapshotSchema),
  edges: z.array(reconciliationEdgeSchema),
  analytical_only: z.literal(true),
  boundaries: z.object({
    canonical_events_created: z.literal(0),
    same_resolutions_created: z.literal(0),
    entity_resolutions_created: z.literal(0),
    source_objects_mutated: z.literal(0),
  }),
});

export type ReconciliationMemberInput = z.infer<typeof reconciliationMemberInputSchema>;
export type ReconciliationMemberSnapshot = z.infer<typeof reconciliationMemberSnapshotSchema>;
export type ReconciliationEdge = z.infer<typeof reconciliationEdgeSchema>;
export type ReconciliationSnapshot = z.infer<typeof reconciliationSnapshotSchema>;

export function reconciliationNodeKey(type: ReconciliationNodeType, id: string) {
  return `${type}:${id}`;
}
