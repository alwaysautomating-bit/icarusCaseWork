import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { canReviewStructure } from "@/lib/case-access";
import type { StructureObjectType, StructureReviewRouteState } from "@/lib/case-routes";
import { getCaseStructureWorkspace, type StructureListItem, type StructureWorkspace } from "@/lib/case-structure";
import { createClient } from "@/lib/supabase/server";

export const reviewTargetTypes = ["knowledge", "claim", "mention", "event", "temporal", "relationship", "flag"] as const;
export type ReviewTargetType = (typeof reviewTargetTypes)[number];
export type ReviewPermission = "review" | "read_only";

export type StructureReviewVersion = {
  id: string;
  targetType: ReviewTargetType;
  targetId: string;
  version: number;
  action: "accept" | "amend" | "reject" | "defer";
  previousStatus: string;
  resultingStatus: string;
  beforeState: Record<string, unknown>;
  patch: Record<string, unknown>;
  afterState: Record<string, unknown>;
  note: string;
  sourceSegmentIds: string[];
  reviewedByUserId: string;
  ledgerLogicalOrder: number;
  reviewedAt: string;
};

export type ReviewQueueItem = StructureListItem & { reviewVersion: number };
export type QueueCounts = Record<ReviewTargetType, { pending: number; deferred: number }>;

export type StructureReviewWorkspace = Omit<StructureWorkspace, "objects" | "selected" | "selectedMissing"> & {
  objects: ReviewQueueItem[];
  selected: ReviewQueueItem | null;
  selectedMissing: boolean;
  reviewPermission: ReviewPermission;
  reviewHistory: StructureReviewVersion[];
  queueCounts: QueueCounts;
  queuePosition: number;
  previousObjectId: string | null;
  nextObjectId: string | null;
};

type ReviewVersionRow = {
  id: string; target_type: ReviewTargetType; target_id: string; version: number; action: StructureReviewVersion["action"];
  previous_status: string; resulting_status: string; before_state: Record<string, unknown>; patch: Record<string, unknown>;
  after_state: Record<string, unknown>; note: string; source_segment_ids: string[]; reviewed_by_user_id: string;
  ledger_logical_order: number; reviewed_at: string;
};

function rowsOrThrow<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("Supabase returned no data.");
  return result.data;
}

export function isReviewTargetType(type: StructureObjectType): type is ReviewTargetType {
  return reviewTargetTypes.includes(type as ReviewTargetType);
}

export function matchesQueueStatus(item: StructureListItem, requestedStatus?: string) {
  const status = requestedStatus || "pending";
  if (status === "all") return true;
  if (status === "pending") return ["pending", "candidate", "proposed"].includes(item.reviewStatus);
  return item.reviewStatus === status;
}

export function stableReviewOrder(items: StructureListItem[], proceedingDates: Map<string, string | null>) {
  return [...items].sort((left, right) => {
    const leftDate = left.proceedingId ? proceedingDates.get(left.proceedingId) ?? "9999-12-31" : "9999-12-31";
    const rightDate = right.proceedingId ? proceedingDates.get(right.proceedingId) ?? "9999-12-31" : "9999-12-31";
    return leftDate.localeCompare(rightDate)
      || (left.logicalOrder ?? Number.MAX_SAFE_INTEGER) - (right.logicalOrder ?? Number.MAX_SAFE_INTEGER)
      || left.id.localeCompare(right.id);
  });
}

function mapVersion(row: ReviewVersionRow): StructureReviewVersion {
  return {
    id: row.id, targetType: row.target_type, targetId: row.target_id, version: row.version, action: row.action,
    previousStatus: row.previous_status, resultingStatus: row.resulting_status, beforeState: row.before_state, patch: row.patch,
    afterState: row.after_state, note: row.note, sourceSegmentIds: row.source_segment_ids,
    reviewedByUserId: row.reviewed_by_user_id, ledgerLogicalOrder: row.ledger_logical_order, reviewedAt: row.reviewed_at,
  };
}

function emptyCounts(): QueueCounts {
  return Object.fromEntries(reviewTargetTypes.map((type) => [type, { pending: 0, deferred: 0 }])) as QueueCounts;
}

export async function getStructureReviewWorkspace(actorId: string, caseId: string, filters: StructureReviewRouteState): Promise<StructureReviewWorkspace | null> {
  const baseFilters = {
    type: "all" as const,
    objectId: filters.objectId,
    segmentId: filters.segmentId,
    proceedingId: filters.proceedingId,
    assertedBy: filters.assertedBy,
    unresolvedOnly: filters.unresolvedOnly,
    temporalOnly: filters.temporalOnly,
    query: filters.query,
  };
  let base = await getCaseStructureWorkspace(actorId, caseId, baseFilters);
  if (!base) return null;

  const eligibleTypes = filters.type && filters.type !== "all" && filters.type !== "entity" ? new Set([filters.type]) : new Set<StructureObjectType>(reviewTargetTypes);
  const governed = base.objects.filter((item) => isReviewTargetType(item.type) && eligibleTypes.has(item.type));
  const proceedingDates = new Map(base.proceedings.map((item) => [item.id, item.proceeding_date]));
  const filtered = stableReviewOrder(governed.filter((item) => matchesQueueStatus(item, filters.reviewStatus)), proceedingDates);
  const requested = filters.objectId ? filtered.find((item) => item.id === filters.objectId) : undefined;
  const selectedId = filters.objectId ? requested?.id ?? null : filtered[0]?.id ?? null;
  const selectedMissing = Boolean(filters.objectId && !requested);

  if (!filters.objectId && selectedId && base.selected?.id !== selectedId) {
    const selectedBase = await getCaseStructureWorkspace(actorId, caseId, { ...baseFilters, objectId: selectedId });
    if (selectedBase) base = selectedBase;
  }

  const supabase = await createClient();
  const versionsResult = await supabase.from("structure_review_versions").select("id,target_type,target_id,version,action,previous_status,resulting_status,before_state,patch,after_state,note,source_segment_ids,reviewed_by_user_id,ledger_logical_order,reviewed_at").eq("case_id", caseId).order("version", { ascending: false }).limit(10_000);
  const versions = (rowsOrThrow(versionsResult) as ReviewVersionRow[]).map(mapVersion);
  const latestByTarget = new Map<string, number>();
  for (const version of versions) {
    const key = `${version.targetType}:${version.targetId}`;
    if (!latestByTarget.has(key)) latestByTarget.set(key, version.version);
  }
  const objects: ReviewQueueItem[] = filtered.map((item) => ({ ...item, reviewVersion: latestByTarget.get(`${item.type}:${item.id}`) ?? 0 }));
  const selected = selectedId ? objects.find((item) => item.id === selectedId) ?? null : null;
  const selectedIndex = selected ? objects.findIndex((item) => item.id === selected.id) : -1;

  const queueCounts = emptyCounts();
  for (const item of governed) {
    if (["pending", "candidate", "proposed"].includes(item.reviewStatus)) queueCounts[item.type as ReviewTargetType].pending += 1;
    if (item.reviewStatus === "deferred") queueCounts[item.type as ReviewTargetType].deferred += 1;
  }

  return {
    ...base,
    objects,
    selected,
    selectedMissing,
    selectedSourceId: selected ? base.selectedSourceId : null,
    selectedSourceMissing: selected ? base.selectedSourceMissing : false,
    sources: selected ? base.sources : [],
    reviewPermission: canReviewStructure(base.currentCase.membershipRole) ? "review" : "read_only",
    reviewHistory: selected ? versions.filter((version) => version.targetType === selected.type && version.targetId === selected.id).sort((left, right) => right.version - left.version) : [],
    queueCounts,
    queuePosition: selectedIndex + 1,
    previousObjectId: selectedIndex > 0 ? objects[selectedIndex - 1].id : null,
    nextObjectId: selectedIndex >= 0 && selectedIndex < objects.length - 1 ? objects[selectedIndex + 1].id : null,
  };
}
