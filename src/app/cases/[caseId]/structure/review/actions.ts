"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCaseActor } from "@/lib/authority";
import { canReviewStructure, getAccessibleCase } from "@/lib/case-access";
import { structureHref, structureReviewHref, structureObjectTypes, type StructureReviewRouteState } from "@/lib/case-routes";
import { getStructureReviewWorkspace, reviewTargetTypes } from "@/lib/structure-review";
import { createClient } from "@/lib/supabase/server";

const routeStateSchema = z.object({
  type: z.enum([...structureObjectTypes, "all"]).optional(),
  segmentId: z.uuid().optional(),
  proceedingId: z.uuid().optional(),
  reviewStatus: z.string().max(40).optional(),
  assertedBy: z.string().max(120).optional(),
  unresolvedOnly: z.boolean().optional(),
  temporalOnly: z.boolean().optional(),
  query: z.string().max(500).optional(),
});

const inputSchema = z.object({
  caseId: z.uuid(),
  targetType: z.enum(reviewTargetTypes),
  targetId: z.uuid(),
  action: z.enum(["accept", "amend", "reject", "defer"]),
  expectedVersion: z.coerce.number().int().min(0),
  note: z.string().trim().max(4_000),
  sourcesReviewed: z.literal("yes"),
  routeState: routeStateSchema,
});

export type ReviewActionState = { kind: "idle" | "validation" | "permission" | "stale" | "error"; message: string };

function value(formData: FormData, key: string) {
  const field = formData.get(key);
  return typeof field === "string" ? field : "";
}

function nullable(valueToParse: string) {
  const trimmed = valueToParse.trim();
  return trimmed ? trimmed : null;
}

function jsonValue(valueToParse: string, expected: "array" | "object") {
  const parsed: unknown = JSON.parse(valueToParse || (expected === "array" ? "[]" : "{}"));
  if (expected === "array" && !Array.isArray(parsed)) throw new Error("Expected a JSON array.");
  if (expected === "object" && (Array.isArray(parsed) || parsed === null || typeof parsed !== "object")) throw new Error("Expected a JSON object.");
  return parsed;
}

function amendmentPatch(targetType: (typeof reviewTargetTypes)[number], formData: FormData) {
  if (targetType === "knowledge") return { summary: value(formData, "summary").trim(), unknowns: jsonValue(value(formData, "unknowns"), "array") };
  if (targetType === "claim") return { normalized_assertion: nullable(value(formData, "normalized_assertion")), assertion_status: value(formData, "assertion_status"), information_basis: value(formData, "information_basis") };
  if (targetType === "mention") return { normalized_candidate: nullable(value(formData, "normalized_candidate")), mention_type: nullable(value(formData, "mention_type")) };
  if (targetType === "event") return { neutral_description: value(formData, "neutral_description").trim(), participant_mentions: jsonValue(value(formData, "participant_mentions"), "array") };
  if (targetType === "relationship") return { relation_type: value(formData, "relation_type").trim(), assertion_status: value(formData, "assertion_status") };
  if (targetType === "flag") return { rationale: value(formData, "rationale").trim(), supporting_context: jsonValue(value(formData, "supporting_context"), "object") };
  return {
    asserted_start: nullable(value(formData, "asserted_start")), asserted_end: nullable(value(formData, "asserted_end")), precision: value(formData, "precision"),
    asserted_date: nullable(value(formData, "asserted_date")), asserted_time_of_day_start: nullable(value(formData, "asserted_time_of_day_start")), asserted_time_of_day_end: nullable(value(formData, "asserted_time_of_day_end")),
    time_of_day_band: nullable(value(formData, "time_of_day_band")), date_precision: nullable(value(formData, "date_precision")), time_of_day_precision: nullable(value(formData, "time_of_day_precision")),
    qualification: value(formData, "qualification"), qualifier_text: nullable(value(formData, "qualifier_text")), sequence_language: nullable(value(formData, "sequence_language")),
    duration_iso8601: nullable(value(formData, "duration_iso8601")), relative_offset_value: nullable(value(formData, "relative_offset_value")), relative_offset_unit: nullable(value(formData, "relative_offset_unit")),
    recurrence_pattern: jsonValue(value(formData, "recurrence_pattern"), "object"), lower_bound_event_candidate_id: nullable(value(formData, "lower_bound_event_candidate_id")), upper_bound_event_candidate_id: nullable(value(formData, "upper_bound_event_candidate_id")),
  };
}

function friendlyRpcError(message: string): ReviewActionState {
  if (message.includes("STRUCTURE_REVIEW_STALE_VERSION")) return { kind: "stale", message: "This candidate changed after the page loaded. Refresh and compare the newer review before deciding again." };
  if (message.includes("STRUCTURE_REVIEW_NOT_AUTHORIZED")) return { kind: "permission", message: "Your current case membership is read-only for structural review." };
  if (message.includes("STRUCTURE_REVIEW_NOTE_REQUIRED")) return { kind: "validation", message: "Amend, reject, and defer decisions require a rationale." };
  if (message.includes("STRUCTURE_REVIEW_TARGET_INELIGIBLE")) return { kind: "validation", message: "This object is no longer eligible for candidate review." };
  if (message.includes("STRUCTURE_REVIEW_PATCH")) return { kind: "validation", message: "The proposed amendment contains a field outside this object type’s review contract." };
  return { kind: "error", message: "The review was not saved. No target or history row was changed." };
}

export async function reviewStructureObjectAction(_previous: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  const actor = await requireCaseActor();
  let rawRouteState: unknown;
  try {
    rawRouteState = JSON.parse(value(formData, "routeState") || "{}");
  } catch {
    return { kind: "validation", message: "The preserved review URL state is invalid." };
  }
  const parsed = inputSchema.safeParse({
    caseId: value(formData, "caseId"), targetType: value(formData, "targetType"), targetId: value(formData, "targetId"),
    action: value(formData, "action"), expectedVersion: value(formData, "expectedVersion"), note: value(formData, "note"),
    sourcesReviewed: value(formData, "sourcesReviewed"), routeState: rawRouteState,
  });
  if (!parsed.success) return { kind: "validation", message: "Confirm every supporting source was compared and complete all required decision fields." };
  if (["amend", "reject", "defer"].includes(parsed.data.action) && !parsed.data.note) return { kind: "validation", message: "Amend, reject, and defer decisions require a rationale." };

  const currentCase = await getAccessibleCase(actor.id, parsed.data.caseId);
  if (!currentCase || !canReviewStructure(currentCase.membershipRole)) return { kind: "permission", message: "Your current case membership is read-only for structural review." };
  const routeState = parsed.data.routeState as StructureReviewRouteState;
  const workspace = await getStructureReviewWorkspace(actor.id, parsed.data.caseId, { ...routeState, objectId: parsed.data.targetId });
  if (!workspace?.selected || workspace.selected.type !== parsed.data.targetType) return { kind: "validation", message: "The selected candidate is unavailable under the active case and queue filters." };
  if (workspace.selected.sourceSegmentIds.length === 0) return { kind: "validation", message: "A candidate without source lineage cannot be reviewed in this workflow." };

  let patch: Record<string, unknown> = {};
  if (parsed.data.action === "amend") {
    try {
      patch = amendmentPatch(parsed.data.targetType, formData);
    } catch (error) {
      return { kind: "validation", message: error instanceof Error ? error.message : "The amendment fields are invalid." };
    }
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("review_structure_object", {
    p_case_id: parsed.data.caseId, p_target_type: parsed.data.targetType, p_target_id: parsed.data.targetId,
    p_action: parsed.data.action, p_patch: patch, p_note: parsed.data.note, p_expected_version: parsed.data.expectedVersion,
  });
  if (error) return friendlyRpcError(error.message);
  if (!data) return { kind: "error", message: "Supabase returned no confirmed review result." };

  revalidatePath(structureHref(parsed.data.caseId));
  revalidatePath(structureReviewHref(parsed.data.caseId));
  redirect(structureReviewHref(parsed.data.caseId, { ...routeState, objectId: workspace.nextObjectId ?? undefined, notice: "reviewed" }));
}
