"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCaseActor } from "@/lib/authority";
import { canReviewStructure, getAccessibleCase } from "@/lib/case-access";
import { trialIndexHref } from "@/lib/case-routes";
import { createClient } from "@/lib/supabase/server";
import { parseReferenceLines, parseTopicLines, parseWitnessLines, trialIndexBases, trialIndexPhases, trialIndexStatuses } from "@/lib/trial-index-model";

export type TrialIndexActionState = { status: "idle" | "error"; message: string };

const formSchema = z.object({
  caseId: z.uuid(),
  dayNumber: z.coerce.number().int().positive().max(10_000),
  courtDate: z.union([z.iso.date(), z.literal("")]),
  proceedingId: z.union([z.uuid(), z.literal("")]),
  sessionStatus: z.enum(trialIndexStatuses),
  trialPhase: z.enum(trialIndexPhases),
  headline: z.string().trim().min(3).max(240),
  summary: z.string().trim().max(5_000),
  basis: z.enum(trialIndexBases),
  witnesses: z.string().max(50_000),
  topics: z.string().max(50_000),
  references: z.string().max(50_000),
  changeNote: z.string().trim().max(1_000),
});

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function saveTrialIndexDayAction(_previous: TrialIndexActionState, formData: FormData): Promise<TrialIndexActionState> {
  let destination = "";
  try {
    const actor = await requireCaseActor();
    const input = formSchema.parse({
      caseId: text(formData, "caseId"), dayNumber: text(formData, "dayNumber"), courtDate: text(formData, "courtDate"), proceedingId: text(formData, "proceedingId"),
      sessionStatus: text(formData, "sessionStatus"), trialPhase: text(formData, "trialPhase"), headline: text(formData, "headline"), summary: text(formData, "summary"),
      basis: text(formData, "basis"), witnesses: text(formData, "witnesses"), topics: text(formData, "topics"), references: text(formData, "references"), changeNote: text(formData, "changeNote"),
    });
    const currentCase = await getAccessibleCase(actor.id, input.caseId);
    if (!currentCase || !canReviewStructure(currentCase.membershipRole)) throw new Error("Only an owner or reviewer can update the Trial Index.");
    const supabase = await createClient();
    const result = await supabase.rpc("upsert_trial_index_day", {
      p_case_id: input.caseId,
      p_payload: {
        day_number: input.dayNumber,
        court_date: input.courtDate,
        proceeding_id: input.proceedingId,
        session_status: input.sessionStatus,
        trial_phase: input.trialPhase,
        headline: input.headline,
        summary: input.summary,
        basis: input.basis,
        witnesses: parseWitnessLines(input.witnesses),
        topics: parseTopicLines(input.topics),
        references: parseReferenceLines(input.references),
        change_note: input.changeNote,
      },
    });
    if (result.error) throw new Error(result.error.message);
    revalidatePath(trialIndexHref(input.caseId));
    revalidatePath(`/cases/${encodeURIComponent(input.caseId)}/setup`);
    destination = trialIndexHref(input.caseId, { dayNumber: input.dayNumber, notice: "saved" });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "The trial day could not be saved." };
  }
  redirect(destination);
}
