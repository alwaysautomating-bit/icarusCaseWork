"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCaseActor } from "@/lib/authority";
import { caseMembershipRoles, getAccessibleCase } from "@/lib/case-access";
import { caseAccessHref } from "@/lib/case-routes";
import { createClient } from "@/lib/supabase/server";

const caseIdSchema = z.uuid();
const emailSchema = z.email().trim().max(320);
const memberRoleSchema = z.enum(caseMembershipRoles).exclude(["owner"]);
const userIdSchema = z.uuid();

function resultHref(caseId: string, kind: "message" | "error", message: string) {
  const query = new URLSearchParams({ [kind]: message.slice(0, 240) });
  return `${caseAccessHref(caseId)}?${query.toString()}`;
}

async function requireOwner(caseId: string) {
  const actor = await requireCaseActor();
  const currentCase = await getAccessibleCase(actor.id, caseId);
  if (!currentCase || currentCase.owner_user_id !== actor.id) redirect(resultHref(caseId, "error", "Only the case owner can manage access."));
}

export async function upsertCaseMemberAction(rawCaseId: string, formData: FormData) {
  const parsed = z.object({ caseId: caseIdSchema, email: emailSchema, role: memberRoleSchema }).safeParse({ caseId: rawCaseId, email: formData.get("email"), role: formData.get("role") });
  if (!parsed.success) {
    const safeCase = caseIdSchema.safeParse(rawCaseId);
    redirect(safeCase.success ? resultHref(safeCase.data, "error", "Enter a valid email address and access role.") : "/casework");
  }
  await requireOwner(parsed.data.caseId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_case_member_by_email", { p_case_id: parsed.data.caseId, p_email: parsed.data.email, p_role: parsed.data.role });
  if (error) redirect(resultHref(parsed.data.caseId, "error", error.message));
  revalidatePath(caseAccessHref(parsed.data.caseId));
  redirect(resultHref(parsed.data.caseId, "message", `${parsed.data.email} now has ${parsed.data.role} access.`));
}

export async function removeCaseMemberAction(rawCaseId: string, formData: FormData) {
  const parsed = z.object({ caseId: caseIdSchema, userId: userIdSchema }).safeParse({ caseId: rawCaseId, userId: formData.get("userId") });
  if (!parsed.success) {
    const safeCase = caseIdSchema.safeParse(rawCaseId);
    redirect(safeCase.success ? resultHref(safeCase.data, "error", "The selected member is invalid.") : "/casework");
  }
  await requireOwner(parsed.data.caseId);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remove_case_member", { p_case_id: parsed.data.caseId, p_user_id: parsed.data.userId });
  if (error) redirect(resultHref(parsed.data.caseId, "error", error.message));
  if (!data) redirect(resultHref(parsed.data.caseId, "error", "That person is no longer a member."));
  revalidatePath(caseAccessHref(parsed.data.caseId));
  redirect(resultHref(parsed.data.caseId, "message", "Case access was removed."));
}
