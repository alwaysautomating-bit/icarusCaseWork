import "server-only";

import { z } from "zod";
import { getAccessibleCase } from "@/lib/case-access";
import { createClient } from "@/lib/supabase/server";

const assertionSchema = z.object({
  ref: z.string(), event_candidate_id: z.uuid(), temporal_assertion_id: z.uuid(), witness: z.string(),
  neutral_description: z.string(), event_class: z.string(), source_wording: z.string(), raw_temporal_language: z.string(),
  precision: z.string(), qualification: z.string(), source_segment_ids: z.array(z.uuid()).min(1),
});

const snapshotSchema = z.object({
  schema_version: z.literal("testimony-reconstruction/1.0"), case_id: z.uuid(), title: z.string(), description: z.string(),
  generated_at: z.string(), snapshot_sha256: z.string(),
  lanes: z.array(z.object({ key: z.string(), label: z.string() })),
  assertions: z.array(assertionSchema),
  nodes: z.array(z.object({ key: z.string(), title: z.string(), summary: z.string(), laneKey: z.string(), temporalLabel: z.string(), assertionRefs: z.array(z.string()), ordinal: z.number(), status: z.string() })),
  edges: z.array(z.object({ from: z.string(), to: z.string(), relation: z.string(), basisAssertionRefs: z.array(z.string()), rationale: z.string(), confidenceBasis: z.string() })),
  tensions: z.array(z.object({ key: z.string(), title: z.string(), field: z.string(), assertionRefs: z.array(z.string()), note: z.string(), status: z.string() })),
  boundaries: z.object({ canonical_events_created: z.number(), same_resolutions_created: z.number(), testimony_timestamps_used_as_event_time: z.number(), unresolved_tensions_collapsed: z.number() }),
});

export type ReconstructionSnapshot = z.infer<typeof snapshotSchema>;
export type SavedReconstructionVersion = {
  id: string; name: string; version: number; description: string; snapshotSha256: string; createdAt: string; snapshot: ReconstructionSnapshot;
};

export async function getCaseReconstructionWorkspace(actorId: string, caseId: string) {
  const currentCase = await getAccessibleCase(actorId, caseId);
  if (!currentCase) return null;
  const supabase = await createClient();
  const result = await supabase.from("saved_reconstruction_versions").select("id,name,version,description,snapshot_sha256,snapshot,created_at").eq("case_id", caseId).order("created_at", { ascending: false }).limit(100);
  if (result.error) throw new Error(result.error.message);
  const versions: SavedReconstructionVersion[] = (result.data ?? []).flatMap((row) => {
    const parsed = snapshotSchema.safeParse(row.snapshot);
    return parsed.success ? [{ id: row.id, name: row.name, version: row.version, description: row.description, snapshotSha256: row.snapshot_sha256, createdAt: row.created_at, snapshot: parsed.data }] : [];
  });
  return { currentCase, versions };
}
