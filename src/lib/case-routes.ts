type CourtRecordRouteState = {
  query?: string;
  segmentId?: string;
  proceedingId?: string;
};

type TrialIndexRouteState = { dayNumber?: number; query?: string; notice?: "saved"; view?: "navigation" | "intelligence"; section?: string };

type AccountsRouteState = { account?: string; versionId?: string; view?: "account" | "compare" | "digital" };

export type TimelineRouteState = {
  timeline?: string;
  query?: string;
  filter?: "all" | "knowns" | "needs-placement";
  overlays?: string[];
  add?: boolean;
  editNoteId?: string;
};

export type ReconcileRouteState = {
  groupId?: string;
  newGroup?: boolean;
  proceedingId?: string;
  type?: "all" | "knowledge" | "claim" | "event" | "temporal" | "mention" | "relationship" | "flag";
  query?: string;
  notice?: "saved" | "unchanged";
};

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

export function caseFoundationHref(caseId: string) {
  return `/cases/${encodeURIComponent(caseId)}/setup`;
}

export function caseFilesHref(caseId: string) {
  return `/cases/${encodeURIComponent(caseId)}/files`;
}

export function caseAccessHref(caseId: string) {
  return `/cases/${encodeURIComponent(caseId)}/access`;
}

export function questionsHref(caseId: string, questionId?: string) {
  const params = new URLSearchParams();
  if (questionId) params.set("question", questionId);
  const suffix = params.toString();
  return `/cases/${encodeURIComponent(caseId)}/questions${suffix ? `?${suffix}` : ""}`;
}

export function evidenceHref(caseId: string, evidenceId?: string) {
  const params = new URLSearchParams();
  if (evidenceId) params.set("item", evidenceId);
  const suffix = params.toString();
  return `/cases/${encodeURIComponent(caseId)}/evidence${suffix ? `?${suffix}` : ""}`;
}

export type CourtPacketIntakeRouteState = { stage?: "upload" | "review" | "confirmed"; candidate?: string; message?: string; error?: string };

export function courtPacketIntakeHref(caseId: string, state: CourtPacketIntakeRouteState = {}) {
  const params = new URLSearchParams();
  if (state.stage) params.set("stage", state.stage);
  if (state.candidate) params.set("candidate", state.candidate);
  if (state.message) params.set("message", state.message);
  if (state.error) params.set("error", state.error);
  const suffix = params.toString();
  return `/cases/${encodeURIComponent(caseId)}/evidence/intake${suffix ? `?${suffix}` : ""}`;
}

export function accountsHref(caseId: string, state: AccountsRouteState = {}) {
  const params = new URLSearchParams();
  if (state.account?.trim()) params.set("account", state.account.trim());
  if (state.versionId) params.set("version", state.versionId);
  if (state.view && state.view !== "account") params.set("view", state.view);
  const suffix = params.toString();
  return `/cases/${encodeURIComponent(caseId)}/accounts${suffix ? `?${suffix}` : ""}`;
}

export function timelineHref(caseId: string, state: TimelineRouteState = {}) {
  const params = new URLSearchParams();
  if (state.timeline?.trim()) params.set("timeline", state.timeline.trim());
  if (state.query?.trim()) params.set("q", state.query.trim());
  if (state.filter && state.filter !== "all") params.set("filter", state.filter);
  for (const overlay of state.overlays ?? []) {
    if (overlay.trim()) params.append("overlay", overlay.trim());
  }
  if (state.add) params.set("add", "1");
  if (state.editNoteId) params.set("edit", state.editNoteId);
  const suffix = params.toString();
  return `/cases/${encodeURIComponent(caseId)}/timeline${suffix ? `?${suffix}` : ""}`;
}

export function firstRespondersTimelineHref(caseId: string, state: { patient?: string; conflicts?: boolean } = {}) {
  const params = new URLSearchParams();
  if (state.patient?.trim()) params.set("patient", state.patient.trim());
  if (state.conflicts) params.set("conflicts", "1");
  const suffix = params.toString();
  return `/cases/${encodeURIComponent(caseId)}/timeline/first-responders${suffix ? `?${suffix}` : ""}`;
}

export function digitalTimelineHref(caseId: string, category?: string) {
  const suffix = category ? `?category=${encodeURIComponent(category)}` : "";
  return `/cases/${encodeURIComponent(caseId)}/timeline/digital${suffix}`;
}

export function patrickAccountsHref(caseId: string, state: { differences?: boolean } = {}) {
  return `/cases/${encodeURIComponent(caseId)}/timeline/patrick${state.differences ? "?view=differences" : ""}`;
}

export function patrickDiscoveryHref(caseId: string) {
  return `/cases/${encodeURIComponent(caseId)}/timeline/discovery`;
}

export function searchWarrantTimelineHref(caseId: string) {
  return `/cases/${encodeURIComponent(caseId)}/timeline/search-warrant`;
}

export function documentsHref(caseId: string, state: { doc?: string; message?: string; error?: string } = {}) {
  const params = new URLSearchParams();
  if (state.doc?.trim()) params.set("doc", state.doc.trim());
  if (state.message) params.set("message", state.message.slice(0, 240));
  if (state.error) params.set("error", state.error.slice(0, 240));
  const suffix = params.toString();
  return `/cases/${encodeURIComponent(caseId)}/documents${suffix ? `?${suffix}` : ""}`;
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
  if (state.section?.trim()) params.set("section", state.section.trim());
  if (state.query?.trim()) params.set("q", state.query.trim());
  if (state.notice) params.set("notice", state.notice);
  if (state.view === "intelligence") params.set("view", state.view);
  const suffix = params.toString();
  return `/cases/${encodeURIComponent(caseId)}/trial-index${suffix ? `?${suffix}` : ""}`;
}

export function reconcileHref(caseId: string, state: ReconcileRouteState = {}) {
  const params = new URLSearchParams();
  if (state.newGroup) params.set("group", "new");
  else if (state.groupId) params.set("group", state.groupId);
  if (state.proceedingId) params.set("proceeding", state.proceedingId);
  if (state.type && state.type !== "all") params.set("type", state.type);
  if (state.query?.trim()) params.set("q", state.query.trim());
  if (state.notice) params.set("notice", state.notice);
  const suffix = params.toString();
  return `/cases/${encodeURIComponent(caseId)}/reconcile${suffix ? `?${suffix}` : ""}`;
}

export function reconstructionHref(caseId: string, compareVersionIds: string[] = []) {
  const params = new URLSearchParams();
  for (const id of compareVersionIds.slice(0, 4)) params.append("compare", id);
  const suffix = params.toString();
  return `/cases/${encodeURIComponent(caseId)}/reconstruction${suffix ? `?${suffix}` : ""}`;
}

export function careTrajectoryHref(caseId: string) {
  return `/cases/${encodeURIComponent(caseId)}/trajectory`;
}

export function referenceReportsHref(caseId: string) {
  return `/cases/${encodeURIComponent(caseId)}/reports`;
}

export function childrenFoundReportHref(caseId: string) {
  return `${referenceReportsHref(caseId)}/children-found`;
}

export function lindsayFoundReportHref(caseId: string) {
  return `${referenceReportsHref(caseId)}/lindsay-found`;
}

export function parseStructureObjectType(value: string | undefined): StructureObjectType | "all" {
  return structureObjectTypes.includes(value as StructureObjectType) ? value as StructureObjectType : "all";
}
