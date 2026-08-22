type CourtRecordRouteState = {
  query?: string;
  segmentId?: string;
  proceedingId?: string;
};

type TrialIndexRouteState = { dayNumber?: number; query?: string; notice?: "saved" };

export const structureObjectTypes = ["knowledge", "claim", "event", "temporal", "mention", "entity", "relationship", "flag"] as const;

export type StructureObjectType = (typeof structureObjectTypes)[number];

export type StructureRouteState = {
  type?: StructureObjectType | "all";
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

export type StructureReviewRouteState = Pick<StructureRouteState,
  "type" | "objectId" | "segmentId" | "proceedingId" | "reviewStatus" | "assertedBy" | "unresolvedOnly" | "temporalOnly" | "query"
> & { notice?: "reviewed" };

export function caseSetupHref(caseId: string) {
  return `/cases/${encodeURIComponent(caseId)}/setup`;
}

export function courtRecordHref(caseId: string, state: CourtRecordRouteState = {}) {
  const params = new URLSearchParams();
  const query = state.query?.trim();
  if (query) params.set("q", query);
  if (state.segmentId) params.set("segment", state.segmentId);
  if (state.proceedingId) params.set("proceeding", state.proceedingId);
  const suffix = params.toString();
  return `/cases/${encodeURIComponent(caseId)}/record${suffix ? `?${suffix}` : ""}`;
}

export function structureHref(caseId: string, state: StructureRouteState = {}) {
  const params = new URLSearchParams();
  if (state.type && state.type !== "all") params.set("type", state.type);
  if (state.objectId) params.set("object", state.objectId);
  if (state.segmentId) params.set("segment", state.segmentId);
  if (state.proceedingId) params.set("proceeding", state.proceedingId);
  if (state.reviewStatus) params.set("status", state.reviewStatus);
  if (state.assertedBy?.trim()) params.set("assertedBy", state.assertedBy.trim());
  if (state.unresolvedOnly) params.set("unresolved", "1");
  if (state.temporalOnly) params.set("temporal", "1");
  if (state.query?.trim()) params.set("q", state.query.trim());
  if (state.timelineRunId) params.set("run", state.timelineRunId);
  for (const viewId of state.compareViewIds?.slice(0, 4) ?? []) params.append("compare", viewId);
  const suffix = params.toString();
  return `/cases/${encodeURIComponent(caseId)}/structure${suffix ? `?${suffix}` : ""}`;
}

export function structureReviewHref(caseId: string, state: StructureReviewRouteState = {}) {
  const params = new URLSearchParams();
  if (state.type && state.type !== "all" && state.type !== "entity") params.set("type", state.type);
  if (state.objectId) params.set("object", state.objectId);
  if (state.segmentId) params.set("segment", state.segmentId);
  if (state.proceedingId) params.set("proceeding", state.proceedingId);
  if (state.reviewStatus) params.set("status", state.reviewStatus);
  if (state.assertedBy?.trim()) params.set("assertedBy", state.assertedBy.trim());
  if (state.unresolvedOnly) params.set("unresolved", "1");
  if (state.temporalOnly) params.set("temporal", "1");
  if (state.query?.trim()) params.set("q", state.query.trim());
  if (state.notice) params.set("notice", state.notice);
  const suffix = params.toString();
  return `/cases/${encodeURIComponent(caseId)}/structure/review${suffix ? `?${suffix}` : ""}`;
}

export function trialIndexHref(caseId: string, state: TrialIndexRouteState = {}) {
  const params = new URLSearchParams();
  if (state.dayNumber && state.dayNumber > 0) params.set("day", String(state.dayNumber));
  if (state.query?.trim()) params.set("q", state.query.trim());
  if (state.notice) params.set("notice", state.notice);
  const suffix = params.toString();
  return `/cases/${encodeURIComponent(caseId)}/trial-index${suffix ? `?${suffix}` : ""}`;
}

export function reconstructionHref(caseId: string, compareVersionIds: string[] = []) {
  const params = new URLSearchParams();
  for (const id of compareVersionIds.slice(0, 4)) params.append("compare", id);
  const suffix = params.toString();
  return `/cases/${encodeURIComponent(caseId)}/reconstruction${suffix ? `?${suffix}` : ""}`;
}

export function parseStructureObjectType(value: string | undefined): StructureObjectType | "all" {
  return structureObjectTypes.includes(value as StructureObjectType) ? value as StructureObjectType : "all";
}
