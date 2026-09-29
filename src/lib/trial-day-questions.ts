import "server-only";

import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

/** Case questions saved from a trial day's Open Questions tab carry this provenance type. */
export const TRIAL_DAY_QUESTION_TYPE = "trial_day_question";

/** Plain text of a day's question as it should be stored: markdown emphasis removed, whitespace collapsed. */
export function plainQuestionText(value: string) {
  return value.replace(/\*\*|`/g, "").replace(/(^|\s)\*([^*\s][^*]*)\*/g, "$1$2").replace(/\s+/g, " ").trim();
}

/** Stable per-question key that survives reordering of the day file. */
export function trialDayQuestionKey(dayNumber: number, question: string) {
  const digest = createHash("sha256").update(plainQuestionText(question).toLowerCase()).digest("hex").slice(0, 16);
  return `trial-day-${dayNumber}:${digest}`;
}

/** Question keys from this day already saved to Case Questions, mapped to the saved question id. */
export async function getSavedTrialDayQuestions(caseId: string, dayNumber: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("research_questions")
    .select("id,prompted_by_id")
    .eq("case_id", caseId)
    .eq("prompted_by_type", TRIAL_DAY_QUESTION_TYPE)
    .like("prompted_by_id", `trial-day-${dayNumber}:%`);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).flatMap((row) => row.prompted_by_id ? [[row.prompted_by_id as string, row.id as string]] : []));
}
