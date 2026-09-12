"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase } from "@/lib/case-access";
import { caseFilesHref } from "@/lib/case-routes";
import { removeSupportingImage, writeSupportingImage } from "@/lib/supporting-media-storage";
import { createClient } from "@/lib/supabase/server";

const caseIdSchema = z.uuid();
const folderIdSchema = z.union([z.uuid(), z.literal("")]);
const folderNameSchema = z.string().trim().min(1).max(80);
const captionSchema = z.string().trim().max(240);
const contextNoteSchema = z.string().trim().max(2_000);

function stringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function resultHref(caseId: string, kind: "message" | "error", message: string, folderId?: string) {
  const query = new URLSearchParams({ [kind]: message.slice(0, 240) });
  if (folderId) query.set("folder", folderId);
  return `${caseFilesHref(caseId)}?${query.toString()}`;
}

async function requireContributor(caseId: string) {
  const actor = await requireCaseActor();
  const currentCase = await getAccessibleCase(actor.id, caseId);
  if (!currentCase || currentCase.membershipRole === "viewer") {
    redirect(resultHref(caseId, "error", "This case is read-only for your account."));
  }
  return actor;
}

async function validFolder(caseId: string, folderId: string) {
  if (!folderId) return null;
  const supabase = await createClient();
  const result = await supabase.from("supporting_media_folders").select("id").eq("case_id", caseId).eq("id", folderId).maybeSingle();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("The selected folder is not available in this case.");
  return result.data.id;
}

export async function createSupportingFolderAction(rawCaseId: string, formData: FormData) {
  const parsed = z.object({ caseId: caseIdSchema, name: folderNameSchema }).safeParse({
    caseId: rawCaseId,
    name: stringValue(formData, "name"),
  });
  if (!parsed.success) {
    const safeCase = caseIdSchema.safeParse(rawCaseId);
    redirect(safeCase.success ? resultHref(safeCase.data, "error", "Enter a folder name up to 80 characters.") : "/casework");
  }

  const actor = await requireContributor(parsed.data.caseId);
  const supabase = await createClient();
  const { error } = await supabase.from("supporting_media_folders").insert({
    case_id: parsed.data.caseId,
    name: parsed.data.name,
    created_by_user_id: actor.id,
  });
  if (error) {
    const message = error.code === "23505" ? "That folder already exists." : error.message;
    redirect(resultHref(parsed.data.caseId, "error", message));
  }
  revalidatePath(caseFilesHref(parsed.data.caseId));
  redirect(resultHref(parsed.data.caseId, "message", `Folder “${parsed.data.name}” created.`));
}

export async function uploadSupportingImageAction(rawCaseId: string, formData: FormData) {
  const parsed = z.object({
    caseId: caseIdSchema,
    folderId: folderIdSchema,
    caption: captionSchema,
    contextNote: contextNoteSchema,
  }).safeParse({
    caseId: rawCaseId,
    folderId: stringValue(formData, "folderId"),
    caption: stringValue(formData, "caption"),
    contextNote: stringValue(formData, "contextNote"),
  });
  if (!parsed.success) {
    const safeCase = caseIdSchema.safeParse(rawCaseId);
    redirect(safeCase.success ? resultHref(safeCase.data, "error", "Check the folder, caption, and context note.") : "/casework");
  }

  const file = formData.get("image");
  if (!(file instanceof File)) redirect(resultHref(parsed.data.caseId, "error", "Choose an image to upload."));
  const actor = await requireContributor(parsed.data.caseId);

  let folderId: string | null;
  try {
    folderId = await validFolder(parsed.data.caseId, parsed.data.folderId);
  } catch (error) {
    redirect(resultHref(parsed.data.caseId, "error", error instanceof Error ? error.message : "The selected folder is unavailable."));
  }

  const itemId = randomUUID();
  let stored: Awaited<ReturnType<typeof writeSupportingImage>>;
  try {
    stored = await writeSupportingImage(parsed.data.caseId, itemId, file);
  } catch (error) {
    redirect(resultHref(parsed.data.caseId, "error", error instanceof Error ? error.message : "The image could not be saved."));
  }

  const supabase = await createClient();
  const { error } = await supabase.from("supporting_media_items").insert({
    id: itemId,
    case_id: parsed.data.caseId,
    folder_id: folderId,
    original_filename: stored.originalFilename,
    media_type: stored.mediaType,
    byte_length: stored.byteLength,
    sha256: stored.sha256,
    object_key: stored.objectKey,
    caption: parsed.data.caption,
    context_note: parsed.data.contextNote,
    uploaded_by_user_id: actor.id,
  });
  if (error) {
    await removeSupportingImage(parsed.data.caseId, stored.objectKey);
    redirect(resultHref(parsed.data.caseId, "error", error.message, folderId ?? undefined));
  }

  revalidatePath(caseFilesHref(parsed.data.caseId));
  redirect(resultHref(parsed.data.caseId, "message", `${stored.originalFilename} added as supporting reference.`, folderId ?? undefined));
}

export async function moveSupportingImageAction(rawCaseId: string, rawItemId: string, formData: FormData) {
  const parsed = z.object({ caseId: caseIdSchema, itemId: z.uuid(), folderId: folderIdSchema }).safeParse({
    caseId: rawCaseId,
    itemId: rawItemId,
    folderId: stringValue(formData, "folderId"),
  });
  if (!parsed.success) {
    const safeCase = caseIdSchema.safeParse(rawCaseId);
    redirect(safeCase.success ? resultHref(safeCase.data, "error", "The file or folder selection is invalid.") : "/casework");
  }

  await requireContributor(parsed.data.caseId);
  let folderId: string | null;
  try {
    folderId = await validFolder(parsed.data.caseId, parsed.data.folderId);
  } catch (error) {
    redirect(resultHref(parsed.data.caseId, "error", error instanceof Error ? error.message : "The selected folder is unavailable."));
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("supporting_media_items")
    .update({ folder_id: folderId })
    .eq("case_id", parsed.data.caseId)
    .eq("id", parsed.data.itemId)
    .select("id")
    .maybeSingle();
  if (error) redirect(resultHref(parsed.data.caseId, "error", error.message));
  if (!data) redirect(resultHref(parsed.data.caseId, "error", "That supporting file is no longer available."));
  revalidatePath(caseFilesHref(parsed.data.caseId));
  redirect(resultHref(parsed.data.caseId, "message", "File moved.", folderId ?? "unfiled"));
}
