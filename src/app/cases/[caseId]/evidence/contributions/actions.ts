"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase } from "@/lib/case-access";
import { hashContributionPassword } from "@/lib/case-contribution-password";
import { createClient } from "@/lib/supabase/server";

const caseIdSchema = z.uuid();
const contributionIdSchema = z.uuid();
const passwordSchema = z.string().min(6).max(200);

function stringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function contributionsHref(caseId: string, kind: "message" | "error", message: string) {
  const query = new URLSearchParams({ [kind]: message.slice(0, 240) });
  return `/cases/${encodeURIComponent(caseId)}/evidence/contributions?${query.toString()}`;
}

async function requireOwner(caseId: string) {
  const actor = await requireCaseActor();
  const currentCase = await getAccessibleCase(actor.id, caseId);
  if (!currentCase || currentCase.membershipRole !== "owner") redirect(contributionsHref(caseId, "error", "Only the case owner can manage contributions."));
  return actor;
}

export async function setContributionPasswordAction(rawCaseId: string, formData: FormData) {
  const parsed = z.object({ caseId: caseIdSchema, password: passwordSchema }).safeParse({
    caseId: rawCaseId,
    password: stringValue(formData, "password"),
  });
  if (!parsed.success) {
    const safeCase = caseIdSchema.safeParse(rawCaseId);
    redirect(safeCase.success ? contributionsHref(safeCase.data, "error", "Choose a password at least 6 characters long.") : "/casework");
  }
  const actor = await requireOwner(parsed.data.caseId);

  const supabase = await createClient();
  const { error } = await supabase.from("case_contribution_settings").upsert({
    case_id: parsed.data.caseId,
    password_hash: hashContributionPassword(parsed.data.password),
    enabled: true,
    updated_by_user_id: actor.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: "case_id" });
  if (error) redirect(contributionsHref(parsed.data.caseId, "error", error.message));

  revalidatePath(contributionsHref(parsed.data.caseId, "message", "").split("?")[0]);
  redirect(contributionsHref(parsed.data.caseId, "message", "Contribution password saved. Share it only with people you want submitting evidence."));
}

export async function setContributionEnabledAction(rawCaseId: string, formData: FormData) {
  const parsed = z.object({ caseId: caseIdSchema, enabled: z.enum(["true", "false"]) }).safeParse({
    caseId: rawCaseId,
    enabled: stringValue(formData, "enabled"),
  });
  if (!parsed.success) redirect("/casework");
  await requireOwner(parsed.data.caseId);

  const supabase = await createClient();
  const { error } = await supabase.from("case_contribution_settings").update({ enabled: parsed.data.enabled === "true" }).eq("case_id", parsed.data.caseId);
  if (error) redirect(contributionsHref(parsed.data.caseId, "error", error.message));

  revalidatePath(contributionsHref(parsed.data.caseId, "message", "").split("?")[0]);
  redirect(contributionsHref(parsed.data.caseId, "message", parsed.data.enabled === "true" ? "Contributions re-enabled." : "Contributions paused. The link will reject submissions until you turn it back on."));
}

async function decideContribution(rawCaseId: string, rawContributionId: string, status: "approved" | "rejected") {
  const caseId = caseIdSchema.parse(rawCaseId);
  const contributionId = contributionIdSchema.parse(rawContributionId);
  const actor = await requireOwner(caseId);

  const supabase = await createClient();
  const { error } = await supabase.from("case_contributions")
    .update({ status, reviewed_by_user_id: actor.id, reviewed_at: new Date().toISOString() })
    .eq("id", contributionId)
    .eq("case_id", caseId)
    .eq("status", "pending");
  if (error) redirect(contributionsHref(caseId, "error", error.message));

  revalidatePath(contributionsHref(caseId, "message", "").split("?")[0]);
  redirect(contributionsHref(caseId, "message", status === "approved" ? "Contribution approved. Download it and add it through Evidence or Case Files." : "Contribution rejected."));
}

export async function approveContributionAction(caseId: string, contributionId: string) {
  await decideContribution(caseId, contributionId, "approved");
}

export async function rejectContributionAction(caseId: string, contributionId: string) {
  await decideContribution(caseId, contributionId, "rejected");
}
