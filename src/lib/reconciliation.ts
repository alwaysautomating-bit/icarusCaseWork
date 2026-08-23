import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { canReviewStructure } from "@/lib/case-access";
import { getCaseStructureWorkspace, type StructureListItem } from "@/lib/case-structure";
import type { ReconcileRouteState } from "@/lib/case-routes";
import { reconciliationNodeKey, reconciliationNodeTypes, reconciliationSnapshotSchema, type ReconciliationEdge, type ReconciliationNodeType, type ReconciliationSnapshot } from "@/lib/reconciliation-model";
import { createClient } from "@/lib/supabase/server";

type ProjectionRow = {
  id: string; case_id: string; name: string; description: string; status: "open" | "reviewed" | "deferred"; analytical_only: true;
  current_version: number; created_by_user_id: string; updated_by_user_id: string; created_at: string; updated_at: string;
  member_count: number; edge_count: number; members: unknown; edges: unknown; version_changed_at: string;
};
type VersionRow = {
  id: string; reconciliation_group_id: string; version: number; snapshot: unknown; change_note: string;
  changed_by_user_id: string; ledger_logical_order: number; changed_at: string;
};
type ProvenanceRow = { from_node_type: string; from_node_id: string; relation_type: string; to_node_type: string; to_node_id: string; object_code: string };
type FlagRow = { id: string; target_node_type: string; target_node_id: string; rationale: string };

export type ReconciliationNode = Pick<StructureListItem, "id" | "type" | "objectCode" | "title" | "summary" | "reviewStatus" | "proceedingId" | "proceedingTitle" | "assertedBy" | "sourceSegmentIds" | "hasUnresolvedFlags" | "hasTemporalAssertion"> & { type: ReconciliationNodeType; key: string };
export type ReconciliationGroup = Omit<ProjectionRow, "case_id" | "members" | "edges"> & { snapshot: ReconciliationSnapshot };
export type ReconciliationVersion = Omit<VersionRow, "reconciliation_group_id" | "snapshot"> & { snapshot: ReconciliationSnapshot };
export type DerivedGraphEdge = ReconciliationEdge & { origin: "source_graph" };

export type ReconciliationWorkspace = {
  currentCase: NonNullable<Awaited<ReturnType<typeof getCaseStructureWorkspace>>>["currentCase"];
  proceedings: NonNullable<Awaited<ReturnType<typeof getCaseStructureWorkspace>>>["proceedings"];
  nodes: ReconciliationNode[];
  visibleNodes: ReconciliationNode[];
  groups: ReconciliationGroup[];
  selectedGroup: ReconciliationGroup | null;
  selectedMissing: boolean;
  versions: ReconciliationVersion[];
  derivedEdges: DerivedGraphEdge[];
  canManage: boolean;
  counts: Record<ReconciliationNodeType, number>;
};

function rowsOrThrow<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("Supabase returned no data.");
  return result.data;
}

function applicationType(value: string): ReconciliationNodeType | null {
  const mapped: Record<string, ReconciliationNodeType> = {
    knowledge_item: "knowledge", claim: "claim", event_candidate: "event", temporal_assertion: "temporal",
    entity_mention: "mention", knowledge_relationship: "relationship", knowledge_flag: "flag",
  };
  return reconciliationNodeTypes.includes(value as ReconciliationNodeType) ? value as ReconciliationNodeType : mapped[value] ?? null;
}

function parseSnapshot(snapshot: unknown) {
  const parsed = reconciliationSnapshotSchema.safeParse(snapshot);
  if (!parsed.success) throw new Error("A reconciliation snapshot does not match the governed v1 contract.");
  return parsed.data;
}

export async function getReconciliationWorkspace(actorId: string, caseId: string, state: ReconcileRouteState): Promise<ReconciliationWorkspace | null> {
  const supabase = await createClient();
  const [base, groupsResult, versionsResult, provenanceResult, flagsResult] = await Promise.all([
    getCaseStructureWorkspace(actorId, caseId, { type: "all", proceedingId: state.proceedingId }),
    supabase.from("reconciliation_group_projection").select("id,case_id,name,description,status,analytical_only,current_version,created_by_user_id,updated_by_user_id,created_at,updated_at,member_count,edge_count,members,edges,version_changed_at").eq("case_id", caseId).order("updated_at", { ascending: false }),
    supabase.from("reconciliation_group_versions").select("id,reconciliation_group_id,version,snapshot,change_note,changed_by_user_id,ledger_logical_order,changed_at").eq("case_id", caseId).order("changed_at", { ascending: false }).limit(1_000),
    supabase.from("provenance_relations").select("from_node_type,from_node_id,relation_type,to_node_type,to_node_id,object_code").eq("case_id", caseId).limit(10_000),
    supabase.from("knowledge_flags").select("id,target_node_type,target_node_id,rationale").eq("case_id", caseId).in("status", ["accepted", "amended"]).limit(1_000),
  ]);
  if (!base) return null;

  const nodes = base.objects.flatMap<ReconciliationNode>((item) => {
    if (!reconciliationNodeTypes.includes(item.type as ReconciliationNodeType) || !["accepted", "amended"].includes(item.reviewStatus) || item.sourceSegmentIds.length === 0) return [];
    const type = item.type as ReconciliationNodeType;
    return [{ ...item, type, key: reconciliationNodeKey(type, item.id) }];
  });
  const nodeKeys = new Set(nodes.map((node) => node.key));
  const groups = (rowsOrThrow(groupsResult) as ProjectionRow[]).map<ReconciliationGroup>((row) => ({
    ...row,
    snapshot: parseSnapshot({ schema_version: "reconciliation-group/1.0", name: row.name, description: row.description, status: row.status, members: row.members, edges: row.edges, analytical_only: row.analytical_only, boundaries: { canonical_events_created: 0, same_resolutions_created: 0, entity_resolutions_created: 0, source_objects_mutated: 0 } }),
  }));
  const selectedGroup = state.newGroup ? null : state.groupId ? groups.find((group) => group.id === state.groupId) ?? null : groups[0] ?? null;
  const selectedMissing = Boolean(state.groupId && !state.newGroup && !selectedGroup);
  const versions = (rowsOrThrow(versionsResult) as VersionRow[])
    .filter((row) => selectedGroup && row.reconciliation_group_id === selectedGroup.id)
    .map<ReconciliationVersion>((row) => ({ id: row.id, version: row.version, snapshot: parseSnapshot(row.snapshot), change_note: row.change_note, changed_by_user_id: row.changed_by_user_id, ledger_logical_order: row.ledger_logical_order, changed_at: row.changed_at }));

  const derivedEdges: DerivedGraphEdge[] = [];
  for (const row of rowsOrThrow(provenanceResult) as ProvenanceRow[]) {
    const fromType = applicationType(row.from_node_type);
    const toType = applicationType(row.to_node_type);
    if (!fromType || !toType || !nodeKeys.has(reconciliationNodeKey(fromType, row.from_node_id)) || !nodeKeys.has(reconciliationNodeKey(toType, row.to_node_id))) continue;
    derivedEdges.push({ from_type: fromType, from_id: row.from_node_id, to_type: toType, to_id: row.to_node_id, relation_type: "derives_from", rationale: `Stored provenance relation ${row.object_code}: ${row.relation_type}.`, origin: "source_graph" });
  }
  for (const row of rowsOrThrow(flagsResult) as FlagRow[]) {
    const targetType = applicationType(row.target_node_type);
    if (!targetType || !nodeKeys.has(reconciliationNodeKey("flag", row.id)) || !nodeKeys.has(reconciliationNodeKey(targetType, row.target_node_id))) continue;
    derivedEdges.push({ from_type: "flag", from_id: row.id, to_type: targetType, to_id: row.target_node_id, relation_type: "leaves_unresolved", rationale: row.rationale, origin: "source_graph" });
  }

  const query = state.query?.trim().toLocaleLowerCase();
  const visibleNodes = nodes.filter((node) => {
    if (state.type && state.type !== "all" && node.type !== state.type) return false;
    if (!query) return true;
    return [node.objectCode, node.title, node.summary, node.assertedBy, node.proceedingTitle].some((value) => value?.toLocaleLowerCase().includes(query));
  });
  const counts = Object.fromEntries(reconciliationNodeTypes.map((type) => [type, nodes.filter((node) => node.type === type).length])) as Record<ReconciliationNodeType, number>;

  return { currentCase: base.currentCase, proceedings: base.proceedings, nodes, visibleNodes, groups, selectedGroup, selectedMissing, versions, derivedEdges, canManage: canReviewStructure(base.currentCase.membershipRole), counts };
}
