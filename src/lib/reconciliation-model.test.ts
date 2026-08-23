import { describe, expect, it } from "vitest";

import { reconciliationEdgeSchema, reconciliationNodeKey, reconciliationSnapshotSchema } from "@/lib/reconciliation-model";

const firstId = "10000000-0000-4000-8000-000000000001";
const secondId = "10000000-0000-4000-8000-000000000002";

describe("reconciliation model", () => {
  it("accepts an analytical-only source-backed snapshot", () => {
    const parsed = reconciliationSnapshotSchema.parse({
      schema_version: "reconciliation-group/1.0",
      name: "Response timing",
      description: "Reviewed comparison.",
      status: "reviewed",
      members: [
        { node_type: "knowledge", node_id: firstId, role: "anchor", object_code: "KI-ONE", title: "Estimate", review_status: "accepted", proceeding_id: secondId, source_segment_ids: [firstId] },
        { node_type: "flag", node_id: secondId, role: "unresolved", object_code: "FLG-ONE", title: "Unknown time", review_status: "amended", proceeding_id: null, source_segment_ids: [secondId] },
      ],
      edges: [{ from_type: "flag", from_id: secondId, relation_type: "leaves_unresolved", to_type: "knowledge", to_id: firstId, rationale: "No clock anchor appears in the cited testimony." }],
      analytical_only: true,
      boundaries: { canonical_events_created: 0, same_resolutions_created: 0, entity_resolutions_created: 0, source_objects_mutated: 0 },
    });
    expect(parsed.analytical_only).toBe(true);
    expect(reconciliationNodeKey("knowledge", firstId)).toBe(`knowledge:${firstId}`);
  });

  it("rejects canonical-looking relations and missing rationale", () => {
    expect(() => reconciliationEdgeSchema.parse({ from_type: "knowledge", from_id: firstId, relation_type: "causes", to_type: "event", to_id: secondId, rationale: "Unsupported." })).toThrow();
    expect(() => reconciliationEdgeSchema.parse({ from_type: "knowledge", from_id: firstId, relation_type: "supports", to_type: "event", to_id: secondId, rationale: "" })).toThrow();
  });
});
