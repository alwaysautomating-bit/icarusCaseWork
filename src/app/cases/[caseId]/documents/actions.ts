"use server";

import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCaseActor } from "@/lib/authority";
import { canReviewStructure, getAccessibleCase } from "@/lib/case-access";
import { documentsHref } from "@/lib/case-routes";
import { ACCEPTED_EXTENSIONS, documentTypes, MAX_DOCUMENT_BYTES, saveAndSummarizeDocument, setDocumentConfirmation } from "@/lib/document-summaries";

const caseIdSchema = z.uuid();

export async function uploadDocumentAction(rawCaseId: string, formData: FormData) {
  const caseId = caseIdSchema.parse(rawCaseId);
  const actor = await requireCaseActor();
  const currentCase = await getAccessibleCase(actor.id, caseId);
  if (!currentCase || !canReviewStructure(currentCase.membershipRole)) redirect(documentsHref(caseId, { error: "Your current case membership cannot add documents." }));

  const file = formData.get("document");
  if (!(file instanceof File) || file.size === 0) redirect(documentsHref(caseId, { error: "Choose a file to upload." }));
  const extension = path.extname(file.name).toLowerCase();
  if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(extension)) redirect(documentsHref(caseId, { error: `Accepted file types: ${ACCEPTED_EXTENSIONS.join(", ")}.` }));
  if (file.size > MAX_DOCUMENT_BYTES) redirect(documentsHref(caseId, { error: "That file is over the 30 MB limit." }));
  const typeValue = formData.get("type");
  const type = documentTypes.find((item) => item === typeValue) ?? "search-warrant";

  let outcome: { id: string; failed: boolean; error?: string };
  try {
    const meta = await saveAndSummarizeDocument({ caseId, file, type });
    outcome = { id: meta.id, failed: meta.status === "failed", error: meta.error };
  } catch (error) {
    redirect(documentsHref(caseId, { error: error instanceof Error ? error.message : "The document could not be saved." }));
  }

  revalidatePath(documentsHref(caseId));
  redirect(documentsHref(caseId, outcome.failed
    ? { doc: outcome.id, error: `Saved, but the summary failed: ${outcome.error ?? "unknown error"}` }
    : { doc: outcome.id, stage: "review", message: "Document saved and summarized. Check the summary against the original." }));
}

export async function setDocumentConfirmationAction(rawCaseId: string, rawDocId: string, confirm: boolean) {
  const caseId = caseIdSchema.parse(rawCaseId);
  const docId = z.string().regex(/^[a-z0-9-]{8,80}$/).parse(rawDocId);
  const actor = await requireCaseActor();
  const currentCase = await getAccessibleCase(actor.id, caseId);
  if (!currentCase || !canReviewStructure(currentCase.membershipRole)) redirect(documentsHref(caseId, { doc: docId, stage: "review", error: "Your current case membership cannot confirm documents." }));
  try {
    await setDocumentConfirmation(caseId, docId, confirm ? actor.id : null);
  } catch (error) {
    redirect(documentsHref(caseId, { doc: docId, stage: "review", error: error instanceof Error ? error.message : "The document could not be updated." }));
  }
  revalidatePath(documentsHref(caseId));
  redirect(documentsHref(caseId, confirm
    ? { doc: docId, stage: "confirmed", message: "Summary confirmed as checked against the original." }
    : { doc: docId, stage: "review", message: "Returned to review." }));
}
