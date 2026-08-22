"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCaseActor } from "@/lib/authority";
import { caseSetupHref } from "@/lib/case-routes";
import { createClient } from "@/lib/supabase/server";

const caseDefinitionSchema = z.object({
  title: z.string().trim().min(3).max(200),
  workspaceKey: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens."),
  purpose: z.string().trim().min(10).max(2_000),
  publicRecordCutoff: z.iso.datetime({ local: true }),
  incidentAt: z.union([z.iso.datetime({ local: true }), z.literal("")]).default(""),
  incidentWindowStart: z.union([z.iso.datetime({ local: true }), z.literal("")]).default(""),
  incidentWindowEnd: z.union([z.iso.datetime({ local: true }), z.literal("")]).default(""),
});

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function nullableDate(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export async function createCaseAction(formData: FormData) {
  const actor = await requireCaseActor();
  const input = caseDefinitionSchema.parse({
    title: formValue(formData, "title"),
    workspaceKey: formValue(formData, "workspaceKey"),
    purpose: formValue(formData, "purpose"),
    publicRecordCutoff: formValue(formData, "publicRecordCutoff"),
    incidentAt: formValue(formData, "incidentAt"),
    incidentWindowStart: formValue(formData, "incidentWindowStart"),
    incidentWindowEnd: formValue(formData, "incidentWindowEnd"),
  });
  const caseId = randomUUID();
  const supabase = await createClient();
  const { error } = await supabase.from("cases").insert({
    id: caseId,
    owner_user_id: actor.id,
    title: input.title,
    workspace_key: input.workspaceKey,
    purpose: input.purpose,
    public_record_cutoff: new Date(input.publicRecordCutoff).toISOString(),
    incident_at: nullableDate(input.incidentAt),
    incident_window_start: nullableDate(input.incidentWindowStart),
    incident_window_end: nullableDate(input.incidentWindowEnd),
  });
  if (error) throw new Error(error.message);
  redirect(caseSetupHref(caseId));
}

export async function updateCaseDefinitionAction(caseId: string, formData: FormData) {
  const actor = await requireCaseActor();
  const input = caseDefinitionSchema.parse({
    title: formValue(formData, "title"),
    workspaceKey: formValue(formData, "workspaceKey"),
    purpose: formValue(formData, "purpose"),
    publicRecordCutoff: formValue(formData, "publicRecordCutoff"),
    incidentAt: formValue(formData, "incidentAt"),
    incidentWindowStart: formValue(formData, "incidentWindowStart"),
    incidentWindowEnd: formValue(formData, "incidentWindowEnd"),
  });
  const supabase = await createClient();
  const membership = await supabase.from("case_members").select("role").eq("case_id", caseId).eq("user_id", actor.id).maybeSingle();
  if (membership.error) throw new Error(membership.error.message);
  if (membership.data?.role !== "owner") throw new Error("Only the case owner can change the case definition.");
  const { data, error } = await supabase.from("cases").update({
    title: input.title,
    workspace_key: input.workspaceKey,
    purpose: input.purpose,
    public_record_cutoff: new Date(input.publicRecordCutoff).toISOString(),
    incident_at: nullableDate(input.incidentAt),
    incident_window_start: nullableDate(input.incidentWindowStart),
    incident_window_end: nullableDate(input.incidentWindowEnd),
  }).eq("id", caseId).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("The case was not found or is not accessible.");
  revalidatePath(caseSetupHref(caseId));
}
