"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { verifyContributionPassword } from "@/lib/case-contribution-password";
import { writeCaseContribution } from "@/lib/case-contribution-storage";
import { createAdminClient } from "@/lib/supabase/admin";

const caseIdSchema = z.uuid();
const passwordSchema = z.string().min(1);
const nameSchema = z.string().trim().max(120);
const noteSchema = z.string().trim().max(2_000);

function stringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function contributeHref(caseId: string, kind: "message" | "error", message: string) {
  const query = new URLSearchParams({ [kind]: message.slice(0, 240) });
  return `/contribute/${encodeURIComponent(caseId)}?${query.toString()}`;
}

export async function submitCaseContribution(rawCaseId: string, formData: FormData) {
  const parsed = z.object({
    caseId: caseIdSchema,
    password: passwordSchema,
    contributorName: nameSchema,
    contributorNote: noteSchema,
  }).safeParse({
    caseId: rawCaseId,
    password: stringValue(formData, "password"),
    contributorName: stringValue(formData, "contributorName"),
    contributorNote: stringValue(formData, "contributorNote"),
  });
  if (!parsed.success) redirect(contributeHref(rawCaseId, "error", "Enter the case password and choose a file."));
  const { caseId, password, contributorName, contributorNote } = parsed.data;

  const file = formData.get("file");
  if (!(file instanceof File)) redirect(contributeHref(caseId, "error", "Choose a file to contribute."));

  const admin = createAdminClient();
  const settings = await admin.from("case_contribution_settings").select("password_hash,enabled").eq("case_id", caseId).maybeSingle();
  if (settings.error || !settings.data || !settings.data.enabled) {
    redirect(contributeHref(caseId, "error", "This case is not accepting contributions right now."));
  }
  if (!verifyContributionPassword(password, settings.data.password_hash)) {
    redirect(contributeHref(caseId, "error", "That password is incorrect."));
  }

  const contributionId = randomUUID();
  let stored: Awaited<ReturnType<typeof writeCaseContribution>>;
  try {
    stored = await writeCaseContribution(caseId, contributionId, file);
  } catch (error) {
    redirect(contributeHref(caseId, "error", error instanceof Error ? error.message : "The file could not be saved."));
  }

  const { error } = await admin.from("case_contributions").insert({
    id: contributionId,
    case_id: caseId,
    contributor_name: contributorName,
    contributor_note: contributorNote,
    object_key: stored.objectKey,
    original_filename: stored.originalFilename,
    media_type: stored.mediaType,
    byte_length: stored.byteLength,
    sha256: stored.sha256,
  });
  if (error) redirect(contributeHref(caseId, "error", "The contribution could not be recorded. Try again."));

  redirect(contributeHref(caseId, "message", "Thank you — your file was submitted and is waiting on the case owner's review."));
}
