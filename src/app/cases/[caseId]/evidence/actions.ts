"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase } from "@/lib/case-access";
import { evidenceHref } from "@/lib/case-routes";
import { createClient } from "@/lib/supabase/server";

const caseIdSchema = z.uuid();
const evidenceIdSchema = z.uuid();
const sourceTypeSchema = z.enum(["testimony", "document", "image", "research_material"]);
const relationshipSchema = z.enum(["documents", "mentions", "depicts"]);

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item.trim() : "";
}

function validHref(raw: string) {
  if (!raw) return null;
  if (raw.startsWith("/")) return raw.slice(0, 1000);
  try {
    const parsed = new URL(raw);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString().slice(0, 1000) : null;
  } catch {
    return null;
  }
}

function resultHref(caseId: string, evidenceId: string | undefined, kind: "message" | "error", message: string) {
  const query = new URLSearchParams({ [kind]: message.slice(0, 240) });
  if (evidenceId) query.set("item", evidenceId);
  return `${evidenceHref(caseId)}?${query.toString()}`;
}

async function requireContributor(caseId: string) {
  const actor = await requireCaseActor();
  const currentCase = await getAccessibleCase(actor.id, caseId);
  if (!currentCase || currentCase.membershipRole === "viewer") redirect(resultHref(caseId, undefined, "error", "This case is read-only for your account."));
  return actor;
}

export async function createEvidenceAction(rawCaseId: string, formData: FormData) {
  const parsed = z.object({ caseId: caseIdSchema, name: z.string().trim().min(2).max(300), description: z.string().trim().max(3000), researchNote: z.string().trim().max(3000), established: z.literal("yes") }).safeParse({ caseId: rawCaseId, name: value(formData, "name"), description: value(formData, "description"), researchNote: value(formData, "researchNote"), established: value(formData, "established") });
  if (!parsed.success) {
    const safeCase = caseIdSchema.safeParse(rawCaseId);
    redirect(safeCase.success ? resultHref(safeCase.data, undefined, "error", "Name the item and confirm that a reviewed source establishes it exists.") : "/casework");
  }
  const actor = await requireContributor(parsed.data.caseId);
  const supabase = await createClient();
  const { data, error } = await supabase.from("research_evidence_items").insert({ case_id: parsed.data.caseId, name: parsed.data.name, description: parsed.data.description, research_note: parsed.data.researchNote, created_by_user_id: actor.id }).select("id").single();
  if (error) redirect(resultHref(parsed.data.caseId, undefined, "error", error.code === "23505" ? "An evidence item with that name already exists." : error.message));
  revalidatePath(evidenceHref(parsed.data.caseId));
  redirect(resultHref(parsed.data.caseId, data.id, "message", "Evidence item added. Add its underlying source next."));
}

export async function addEvidenceSourceAction(rawCaseId: string, rawEvidenceId: string, formData: FormData) {
  const parsed = z.object({ caseId: caseIdSchema, evidenceId: evidenceIdSchema, sourceType: sourceTypeSchema, relationship: relationshipSchema, sourceLabel: z.string().trim().min(2).max(500), sourceHref: z.string().trim().max(1000), note: z.string().trim().max(2000) }).safeParse({ caseId: rawCaseId, evidenceId: rawEvidenceId, sourceType: value(formData, "sourceType"), relationship: value(formData, "relationship"), sourceLabel: value(formData, "sourceLabel"), sourceHref: value(formData, "sourceHref"), note: value(formData, "note") });
  if (!parsed.success) redirect(resultHref(rawCaseId, rawEvidenceId, "error", "Add a source type, relationship, and recognizable source label."));
  const href = validHref(parsed.data.sourceHref);
  if (parsed.data.sourceHref && !href) redirect(resultHref(parsed.data.caseId, parsed.data.evidenceId, "error", "Source links must be an Icarus path or an HTTP(S) URL."));
  const actor = await requireContributor(parsed.data.caseId);
  const supabase = await createClient();
  const { error } = await supabase.from("research_evidence_sources").insert({ evidence_id: parsed.data.evidenceId, case_id: parsed.data.caseId, source_type: parsed.data.sourceType, relationship: parsed.data.relationship, source_label: parsed.data.sourceLabel, source_href: href, researcher_note: parsed.data.note, created_by_user_id: actor.id });
  if (error) redirect(resultHref(parsed.data.caseId, parsed.data.evidenceId, "error", error.message));
  revalidatePath(evidenceHref(parsed.data.caseId));
  redirect(resultHref(parsed.data.caseId, parsed.data.evidenceId, "message", "Source added."));
}

export async function addEvidenceFactAction(rawCaseId: string, rawEvidenceId: string, formData: FormData) {
  const parsed = z.object({ caseId: caseIdSchema, evidenceId: evidenceIdSchema, statement: z.string().trim().min(2).max(2000), sourceId: z.uuid() }).safeParse({ caseId: rawCaseId, evidenceId: rawEvidenceId, statement: value(formData, "statement"), sourceId: value(formData, "sourceId") });
  if (!parsed.success) redirect(resultHref(rawCaseId, rawEvidenceId, "error", "A factual statement and one underlying source are required."));
  const actor = await requireContributor(parsed.data.caseId);
  const supabase = await createClient();
  const { error } = await supabase.from("research_evidence_facts").insert({ evidence_id: parsed.data.evidenceId, case_id: parsed.data.caseId, statement: parsed.data.statement, source_link_id: parsed.data.sourceId, created_by_user_id: actor.id });
  if (error) redirect(resultHref(parsed.data.caseId, parsed.data.evidenceId, "error", error.message));
  revalidatePath(evidenceHref(parsed.data.caseId));
  redirect(resultHref(parsed.data.caseId, parsed.data.evidenceId, "message", "Sourced fact added."));
}

export async function linkEvidenceQuestionAction(rawCaseId: string, rawEvidenceId: string, formData: FormData) {
  const parsed = z.object({ caseId: caseIdSchema, evidenceId: evidenceIdSchema, questionId: z.uuid() }).safeParse({ caseId: rawCaseId, evidenceId: rawEvidenceId, questionId: value(formData, "questionId") });
  if (!parsed.success) redirect(resultHref(rawCaseId, rawEvidenceId, "error", "Choose a question to link."));
  const actor = await requireContributor(parsed.data.caseId);
  const supabase = await createClient();
  const { error } = await supabase.from("research_question_evidence_links").insert({ question_id: parsed.data.questionId, evidence_id: parsed.data.evidenceId, case_id: parsed.data.caseId, created_by_user_id: actor.id });
  if (error) redirect(resultHref(parsed.data.caseId, parsed.data.evidenceId, "error", error.code === "23505" ? "That question is already linked." : error.message));
  revalidatePath(evidenceHref(parsed.data.caseId));
  redirect(resultHref(parsed.data.caseId, parsed.data.evidenceId, "message", "Question linked."));
}
