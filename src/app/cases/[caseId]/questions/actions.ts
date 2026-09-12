"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase } from "@/lib/case-access";
import { questionsHref } from "@/lib/case-routes";
import { createClient } from "@/lib/supabase/server";

const caseIdSchema = z.uuid();
const questionIdSchema = z.uuid();
const optionalIdSchema = z.union([z.uuid(), z.literal("")]);
const sourceTypeSchema = z.enum(["testimony", "evidence", "document", "image", "research_material"]);
const entryKindSchema = z.enum(["known", "finding", "unknown", "target"]);

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

function resultHref(caseId: string, questionId: string | undefined, kind: "message" | "error", message: string) {
  const query = new URLSearchParams({ [kind]: message.slice(0, 240) });
  if (questionId) query.set("question", questionId);
  return `${questionsHref(caseId)}?${query.toString()}`;
}

async function requireContributor(caseId: string) {
  const actor = await requireCaseActor();
  const currentCase = await getAccessibleCase(actor.id, caseId);
  if (!currentCase || currentCase.membershipRole === "viewer") redirect(resultHref(caseId, undefined, "error", "This case is read-only for your account."));
  return actor;
}

export async function createQuestionAction(rawCaseId: string, formData: FormData) {
  const parsed = z.object({
    caseId: caseIdSchema,
    question: z.string().trim().min(5).max(500),
    context: z.string().trim().max(2000),
    promptType: z.string().trim().max(80),
    promptId: z.string().trim().max(300),
    promptLabel: z.string().trim().max(300),
    promptHref: z.string().trim().max(1000),
  }).safeParse({ caseId: rawCaseId, question: value(formData, "question"), context: value(formData, "context"), promptType: value(formData, "promptType"), promptId: value(formData, "promptId"), promptLabel: value(formData, "promptLabel"), promptHref: value(formData, "promptHref") });
  if (!parsed.success) {
    const safeCase = caseIdSchema.safeParse(rawCaseId);
    redirect(safeCase.success ? resultHref(safeCase.data, undefined, "error", "Write a question between 5 and 500 characters.") : "/casework");
  }
  const actor = await requireContributor(parsed.data.caseId);
  const promptHref = validHref(parsed.data.promptHref);
  const supabase = await createClient();
  const { data, error } = await supabase.from("research_questions").insert({
    case_id: parsed.data.caseId,
    question: parsed.data.question,
    context: parsed.data.context,
    prompted_by_type: parsed.data.promptType || null,
    prompted_by_id: parsed.data.promptId || null,
    prompted_by_label: parsed.data.promptLabel || null,
    prompted_by_href: promptHref,
    created_by_user_id: actor.id,
  }).select("id").single();
  if (error) redirect(resultHref(parsed.data.caseId, undefined, "error", error.message));
  revalidatePath(questionsHref(parsed.data.caseId));
  redirect(resultHref(parsed.data.caseId, data.id, "message", "Question added to the research queue."));
}

export async function addQuestionSourceAction(rawCaseId: string, rawQuestionId: string, formData: FormData) {
  const parsed = z.object({ caseId: caseIdSchema, questionId: questionIdSchema, sourceType: sourceTypeSchema, sourceLabel: z.string().trim().min(2).max(500), sourceHref: z.string().trim().max(1000), note: z.string().trim().max(2000) }).safeParse({ caseId: rawCaseId, questionId: rawQuestionId, sourceType: value(formData, "sourceType"), sourceLabel: value(formData, "sourceLabel"), sourceHref: value(formData, "sourceHref"), note: value(formData, "note") });
  if (!parsed.success) redirect(resultHref(rawCaseId, rawQuestionId, "error", "Add a source type and recognizable source label."));
  const href = validHref(parsed.data.sourceHref);
  if (parsed.data.sourceHref && !href) redirect(resultHref(parsed.data.caseId, parsed.data.questionId, "error", "Source links must be an Icarus path or an HTTP(S) URL."));
  const actor = await requireContributor(parsed.data.caseId);
  const supabase = await createClient();
  const { error } = await supabase.from("research_question_sources").insert({ question_id: parsed.data.questionId, case_id: parsed.data.caseId, source_type: parsed.data.sourceType, source_label: parsed.data.sourceLabel, source_href: href, researcher_note: parsed.data.note, created_by_user_id: actor.id });
  if (error) redirect(resultHref(parsed.data.caseId, parsed.data.questionId, "error", error.message));
  revalidatePath(questionsHref(parsed.data.caseId));
  redirect(resultHref(parsed.data.caseId, parsed.data.questionId, "message", "Source added."));
}

export async function addQuestionEntryAction(rawCaseId: string, rawQuestionId: string, formData: FormData) {
  const parsed = z.object({ caseId: caseIdSchema, questionId: questionIdSchema, entryKind: entryKindSchema, statement: z.string().trim().min(2).max(2000), sourceId: optionalIdSchema }).safeParse({ caseId: rawCaseId, questionId: rawQuestionId, entryKind: value(formData, "entryKind"), statement: value(formData, "statement"), sourceId: value(formData, "sourceId") });
  if (!parsed.success) redirect(resultHref(rawCaseId, rawQuestionId, "error", "Choose a research-state type and enter a short statement."));
  if (["known", "finding"].includes(parsed.data.entryKind) && !parsed.data.sourceId) redirect(resultHref(parsed.data.caseId, parsed.data.questionId, "error", "Known points and findings must cite one of this question’s sources."));
  const actor = await requireContributor(parsed.data.caseId);
  const supabase = await createClient();
  const { error } = await supabase.from("research_question_entries").insert({ question_id: parsed.data.questionId, case_id: parsed.data.caseId, entry_kind: parsed.data.entryKind, statement: parsed.data.statement, source_link_id: parsed.data.sourceId || null, created_by_user_id: actor.id });
  if (error) redirect(resultHref(parsed.data.caseId, parsed.data.questionId, "error", error.message));
  revalidatePath(questionsHref(parsed.data.caseId));
  redirect(resultHref(parsed.data.caseId, parsed.data.questionId, "message", "Research state updated."));
}

export async function linkQuestionEvidenceAction(rawCaseId: string, rawQuestionId: string, formData: FormData) {
  const parsed = z.object({ caseId: caseIdSchema, questionId: questionIdSchema, evidenceId: z.uuid() }).safeParse({ caseId: rawCaseId, questionId: rawQuestionId, evidenceId: value(formData, "evidenceId") });
  if (!parsed.success) redirect(resultHref(rawCaseId, rawQuestionId, "error", "Choose an evidence item to link."));
  const actor = await requireContributor(parsed.data.caseId);
  const supabase = await createClient();
  const { error } = await supabase.from("research_question_evidence_links").insert({ question_id: parsed.data.questionId, evidence_id: parsed.data.evidenceId, case_id: parsed.data.caseId, created_by_user_id: actor.id });
  if (error) redirect(resultHref(parsed.data.caseId, parsed.data.questionId, "error", error.code === "23505" ? "That evidence item is already linked." : error.message));
  revalidatePath(questionsHref(parsed.data.caseId));
  redirect(resultHref(parsed.data.caseId, parsed.data.questionId, "message", "Evidence linked."));
}

export async function resolveQuestionAction(rawCaseId: string, rawQuestionId: string, formData: FormData) {
  const parsed = z.object({ caseId: caseIdSchema, questionId: questionIdSchema, resolution: z.string().trim().min(2).max(4000), limitations: z.string().trim().max(2000) }).safeParse({ caseId: rawCaseId, questionId: rawQuestionId, resolution: value(formData, "resolution"), limitations: value(formData, "limitations") });
  if (!parsed.success) redirect(resultHref(rawCaseId, rawQuestionId, "error", "A narrow, evidence-supported resolution is required."));
  await requireContributor(parsed.data.caseId);
  const supabase = await createClient();
  const { data, error } = await supabase.from("research_questions").update({ status: "resolved", resolution: parsed.data.resolution, limitations: parsed.data.limitations, resolved_at: new Date().toISOString() }).eq("case_id", parsed.data.caseId).eq("id", parsed.data.questionId).select("id").maybeSingle();
  if (error) redirect(resultHref(parsed.data.caseId, parsed.data.questionId, "error", error.message));
  if (!data) redirect(resultHref(parsed.data.caseId, parsed.data.questionId, "error", "That question is no longer available."));
  revalidatePath(questionsHref(parsed.data.caseId));
  redirect(resultHref(parsed.data.caseId, parsed.data.questionId, "message", "Question marked resolved. Its research history remains preserved."));
}
