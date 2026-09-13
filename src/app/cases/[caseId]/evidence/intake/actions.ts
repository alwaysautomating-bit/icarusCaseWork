"use server";

import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCaseActor } from "@/lib/authority";
import { canReviewStructure, getAccessibleCase } from "@/lib/case-access";
import { courtPacketIntakeHref, evidenceHref } from "@/lib/case-routes";
import { buildCourtPacketBundle, documentTypes } from "@/lib/court-packet";
import { commitCourtPacketBundle } from "@/lib/court-packet-persistence";
import { parseWithLlamaParse } from "@/lib/llamaparse";
import { getObjectStorage } from "@/lib/object-storage";
import { createClient } from "@/lib/supabase/server";

const caseIdSchema = z.uuid();

function resultHref(caseId: string, kind: "message" | "error", message: string, stage?: "upload" | "review" | "confirmed") {
  return courtPacketIntakeHref(caseId, { stage, [kind]: message.slice(0, 240) });
}

async function requireReviewer(caseId: string) {
  const actor = await requireCaseActor();
  const currentCase = await getAccessibleCase(actor.id, caseId);
  if (!currentCase || !canReviewStructure(currentCase.membershipRole)) redirect(resultHref(caseId, "error", "Your current case membership is read-only for court packet intake."));
  return actor;
}

function dataRoot() {
  return process.env.ICARUS_DATA_DIR ? path.resolve(process.env.ICARUS_DATA_DIR) : path.join(process.cwd(), ".data");
}

export async function uploadCourtPacketAction(rawCaseId: string, formData: FormData) {
  const caseId = caseIdSchema.parse(rawCaseId);
  const actor = await requireReviewer(caseId);

  const file = formData.get("packet");
  if (!(file instanceof File) || file.size === 0) redirect(resultHref(caseId, "error", "Choose a PDF court packet to upload.", "upload"));
  if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) redirect(resultHref(caseId, "error", "Only PDF packets are accepted.", "upload"));

  const bytes = new Uint8Array(await file.arrayBuffer());
  let bundle;
  try {
    const stored = await getObjectStorage(dataRoot()).putImmutable({
      key: `court-packet-${caseId}-${Date.now()}${path.extname(file.name).toLowerCase() || ".pdf"}`,
      bytes,
      contentType: "application/pdf",
    });
    const live = await parseWithLlamaParse({ bytes, fileName: file.name });
    bundle = buildCourtPacketBundle({
      caseId,
      sourceName: file.name,
      sourceBytes: bytes,
      objectKey: stored.key,
      capturedAt: new Date().toISOString(),
      parseResult: live.result,
      tier: live.tier,
      parseVersion: live.version,
      sdkVersion: "2.14.1",
      fileId: live.fileId,
      jobId: live.jobId,
    });
  } catch (error) {
    redirect(resultHref(caseId, "error", error instanceof Error ? error.message : "The packet could not be parsed.", "upload"));
  }

  try {
    await commitCourtPacketBundle(actor, bundle);
  } catch (error) {
    redirect(resultHref(caseId, "error", error instanceof Error ? error.message : "The parsed packet could not be preserved.", "upload"));
  }

  revalidatePath(courtPacketIntakeHref(caseId));
  revalidatePath(evidenceHref(caseId));
  redirect(resultHref(caseId, "message", "Packet preserved and parsed. Review the proposed document boundaries below.", "review"));
}

export type CourtPacketReviewState = { kind: "idle" | "validation" | "permission" | "stale" | "error"; message: string };

const reviewInputSchema = z.object({
  caseId: z.uuid(),
  candidateId: z.uuid(),
  action: z.enum(["accept", "amend", "reject", "defer"]),
  expectedVersion: z.coerce.number().int().min(0),
  note: z.string().trim().max(4_000),
  documentType: z.enum(documentTypes).optional(),
  startPage: z.coerce.number().int().positive().optional(),
  endPage: z.coerce.number().int().positive().optional(),
});

function friendlyRpcError(message: string): CourtPacketReviewState {
  if (message.includes("COURT_PACKET_REVIEW_STALE_VERSION")) return { kind: "stale", message: "This candidate changed after the page loaded. Refresh and compare the newer review before deciding again." };
  if (message.includes("COURT_PACKET_REVIEW_NOT_AUTHORIZED")) return { kind: "permission", message: "Your current case membership is read-only for court packet review." };
  if (message.includes("COURT_PACKET_REVIEW_NOTE_REQUIRED")) return { kind: "validation", message: "Amend, reject, and defer decisions require a note." };
  if (message.includes("COURT_PACKET_REVIEW_RANGE_INVALID")) return { kind: "validation", message: "That page range is invalid for this packet." };
  if (message.includes("COURT_PACKET_ACCEPTED_DOCUMENT_REQUIRES_VERSIONED_AMENDMENT")) return { kind: "validation", message: "An accepted document can only be changed through an amendment, not a reject or defer." };
  return { kind: "error", message: "The review was not saved. No candidate or history row was changed." };
}

export async function reviewCourtPacketCandidateAction(_previous: CourtPacketReviewState, formData: FormData): Promise<CourtPacketReviewState> {
  const value = (key: string) => {
    const item = formData.get(key);
    return typeof item === "string" ? item : "";
  };
  const parsed = reviewInputSchema.safeParse({
    caseId: value("caseId"),
    candidateId: value("candidateId"),
    action: value("action"),
    expectedVersion: value("expectedVersion"),
    note: value("note"),
    documentType: value("documentType") || undefined,
    startPage: value("startPage") || undefined,
    endPage: value("endPage") || undefined,
  });
  if (!parsed.success) return { kind: "validation", message: "The review submission was incomplete." };
  if (["amend", "reject", "defer"].includes(parsed.data.action) && parsed.data.note.trim().length < 5) return { kind: "validation", message: "Amend, reject, and defer decisions require a note of at least 5 characters." };

  const actor = await requireCaseActor();
  const currentCase = await getAccessibleCase(actor.id, parsed.data.caseId);
  if (!currentCase || !canReviewStructure(currentCase.membershipRole)) return { kind: "permission", message: "Your current case membership is read-only for court packet review." };

  const patch: Record<string, unknown> = {};
  if (parsed.data.action === "amend") {
    if (parsed.data.documentType) patch.document_type = parsed.data.documentType;
    if (parsed.data.startPage) patch.start_page = parsed.data.startPage;
    if (parsed.data.endPage) patch.end_page = parsed.data.endPage;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("review_court_packet_boundary", {
    p_candidate_id: parsed.data.candidateId,
    p_action: parsed.data.action,
    p_patch: patch,
    p_note: parsed.data.note,
    p_expected_version: parsed.data.expectedVersion,
  });
  if (error) return friendlyRpcError(error.message);
  if (!data) return { kind: "error", message: "Supabase returned no confirmed review result." };

  revalidatePath(courtPacketIntakeHref(parsed.data.caseId));
  redirect(courtPacketIntakeHref(parsed.data.caseId, { stage: "review", message: "Review decision saved." }));
}
