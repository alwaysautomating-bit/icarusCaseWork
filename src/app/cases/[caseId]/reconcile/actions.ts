"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCaseActor } from "@/lib/authority";
import { canReviewStructure, getAccessibleCase } from "@/lib/case-access";
import { reconcileHref } from "@/lib/case-routes";
import { reconciliationEdgeSchema, reconciliationMemberInputSchema, reconciliationStatuses } from "@/lib/reconciliation-model";
import { createClient } from "@/lib/supabase/server";

const inputSchema = z.object({
  caseId: z.uuid(),
  groupId: z.union([z.uuid(), z.literal("")]),
  expectedVersion: z.coerce.number().int().min(0),
  name: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5_000),
  status: z.enum(reconciliationStatuses),
  changeNote: z.string().trim().max(2_000),
  members: z.array(reconciliationMemberInputSchema).min(2).max(50),
  edges: z.array(reconciliationEdgeSchema).max(200),
});

export type ReconciliationActionState = { kind: "idle" | "validation" | "permission" | "stale" | "error"; message: string };

function value(formData: FormData, key: string) {
  const field = formData.get(key);
  return typeof field === "string" ? field : "";
}

function parseJson(valueToParse: string) {
  try { return JSON.parse(valueToParse); } catch { return null; }
}

function friendlyError(message: string): ReconciliationActionState {
  if (message.includes("RECONCILIATION_STALE_VERSION")) return { kind: "stale", message: "This group changed after the page loaded. Refresh and compare the current immutable version." };
  if (message.includes("RECONCILIATION_NOT_AUTHORIZED")) return { kind: "permission", message: "Your current case membership is read-only for reconciliation." };
  if (message.includes("MEMBER_NOT_REVIEWED")) return { kind: "validation", message: "Every member must have an accepted or amended Structure review state." };
  if (message.includes("SOURCE_LINEAGE_REQUIRED")) return { kind: "validation", message: "Every member must retain at least one exact source segment." };
  if (message.includes("CHANGE_NOTE_REQUIRED")) return { kind: "validation", message: "Updating a saved group requires a change note." };
  if (message.includes("REVIEW_REQUIRES_EDGE")) return { kind: "validation", message: "A reviewed group must contain at least one explicit relationship classification." };
  if (message.includes("MEMBER") || message.includes("EDGE") || message.includes("PAYLOAD") || message.includes("FIELD") || message.includes("TEXT") || message.includes("STATUS")) return { kind: "validation", message: "The group contains an invalid member, relationship, or field value." };
  return { kind: "error", message: "The reconciliation group was not saved. No source object or prior version changed." };
}

export async function saveReconciliationGroupAction(_previous: ReconciliationActionState, formData: FormData): Promise<ReconciliationActionState> {
  const actor = await requireCaseActor();
  const parsed = inputSchema.safeParse({
    caseId: value(formData, "caseId"), groupId: value(formData, "groupId"), expectedVersion: value(formData, "expectedVersion"),
    name: value(formData, "name"), description: value(formData, "description"), status: value(formData, "status"),
    changeNote: value(formData, "changeNote"), members: parseJson(value(formData, "members")), edges: parseJson(value(formData, "edges")),
  });
  if (!parsed.success) return { kind: "validation", message: "Add at least two reviewed nodes and complete every relationship rationale." };
  if (parsed.data.groupId && !parsed.data.changeNote) return { kind: "validation", message: "Updating a saved group requires a change note." };

  const memberKeys = new Set(parsed.data.members.map((member) => `${member.node_type}:${member.node_id}`));
  if (memberKeys.size !== parsed.data.members.length) return { kind: "validation", message: "A reviewed object can appear only once in a group." };
  if (parsed.data.edges.some((edge) => !memberKeys.has(`${edge.from_type}:${edge.from_id}`) || !memberKeys.has(`${edge.to_type}:${edge.to_id}`))) return { kind: "validation", message: "Every relationship endpoint must be a member of this group." };

  const currentCase = await getAccessibleCase(actor.id, parsed.data.caseId);
  if (!currentCase || !canReviewStructure(currentCase.membershipRole)) return { kind: "permission", message: "Your current case membership is read-only for reconciliation." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_reconciliation_group", {
    p_case_id: parsed.data.caseId,
    p_group_id: parsed.data.groupId || null,
    p_expected_version: parsed.data.expectedVersion,
    p_payload: { name: parsed.data.name, description: parsed.data.description, status: parsed.data.status, members: parsed.data.members, edges: parsed.data.edges, change_note: parsed.data.changeNote },
  });
  if (error) return friendlyError(error.message);
  const result = data as null | { group_id?: string; duplicate?: boolean };
  if (!result?.group_id) return { kind: "error", message: "Supabase returned no confirmed reconciliation group." };
  revalidatePath(reconcileHref(parsed.data.caseId));
  redirect(reconcileHref(parsed.data.caseId, { groupId: result.group_id, notice: result.duplicate ? "unchanged" : "saved" }));
}
