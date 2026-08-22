import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { getAccessibleCase, canReviewStructure, type AccessibleCase } from "@/lib/case-access";
import { createClient } from "@/lib/supabase/server";
import { trialIndexReferenceSchema, trialIndexSearchText, trialIndexTopicSchema, trialIndexWitnessSchema, type TrialIndexReference, type TrialIndexTopic, type TrialIndexWitness } from "@/lib/trial-index-model";

function rowsOrThrow<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("Supabase returned no data.");
  return result.data;
}

function arrayOf<T>(value: unknown, parser: { safeParse: (value: unknown) => { success: boolean; data?: T } }): T[] {
  return Array.isArray(value) ? value.flatMap((item) => { const parsed = parser.safeParse(item); return parsed.success && parsed.data ? [parsed.data] : []; }) : [];
}

type ProjectionRow = {
  id: string; case_id: string; day_number: number; court_date: string | null; proceeding_id: string | null; proceeding_title: string | null;
  proceeding_date: string | null; proceeding_status: string | null; session_status: string; trial_phase: string; headline: string; summary: string;
  basis: string; witnesses: unknown; topics: unknown; navigation_references: unknown; navigation_only: boolean; current_version: number; updated_at: string;
};

export type TrialIndexDay = Omit<ProjectionRow, "witnesses" | "topics" | "navigation_references"> & {
  witnesses: TrialIndexWitness[];
  topics: TrialIndexTopic[];
  references: TrialIndexReference[];
};

export type TrialIndexWorkspace = {
  currentCase: AccessibleCase;
  days: TrialIndexDay[];
  visibleDays: TrialIndexDay[];
  selected: TrialIndexDay | null;
  versions: Array<{ id: string; trial_index_day_id: string; version: number; snapshot: Record<string, unknown>; change_note: string; changed_by_user_id: string; changed_at: string }>;
  proceedings: Array<{ id: string; title: string; proceeding_date: string | null; status: string }>;
  canManage: boolean;
  counts: { days: number; canonicalLinked: number; provisional: number; witnesses: number; topics: number };
};

export async function getTrialIndexWorkspace(actorId: string, caseId: string, options: { query?: string; dayNumber?: number } = {}): Promise<TrialIndexWorkspace | null> {
  const currentCase = await getAccessibleCase(actorId, caseId);
  if (!currentCase) return null;
  const supabase = await createClient();
  const [daysResult, versionsResult, proceedingsResult] = await Promise.all([
    supabase.from("trial_index_projection").select("id,case_id,day_number,court_date,proceeding_id,proceeding_title,proceeding_date,proceeding_status,session_status,trial_phase,headline,summary,basis,witnesses,topics,navigation_references,navigation_only,current_version,updated_at").eq("case_id", caseId).order("day_number"),
    supabase.from("trial_index_day_versions").select("id,trial_index_day_id,version,snapshot,change_note,changed_by_user_id,changed_at").eq("case_id", caseId).order("version", { ascending: false }),
    supabase.from("proceedings").select("id,title,proceeding_date,status").eq("case_id", caseId).order("title"),
  ]);
  const days = (rowsOrThrow(daysResult) as ProjectionRow[]).map<TrialIndexDay>((day) => ({
    ...day,
    witnesses: arrayOf(day.witnesses, trialIndexWitnessSchema),
    topics: arrayOf(day.topics, trialIndexTopicSchema),
    references: arrayOf(day.navigation_references, trialIndexReferenceSchema),
  }));
  const query = options.query?.trim().toLocaleLowerCase() ?? "";
  const visibleDays = query ? days.filter((day) => trialIndexSearchText(day).includes(query)) : days;
  const selected = visibleDays.find((day) => day.day_number === options.dayNumber) ?? visibleDays[0] ?? null;
  return {
    currentCase,
    days,
    visibleDays,
    selected,
    versions: rowsOrThrow(versionsResult) as TrialIndexWorkspace["versions"],
    proceedings: rowsOrThrow(proceedingsResult) as TrialIndexWorkspace["proceedings"],
    canManage: canReviewStructure(currentCase.membershipRole),
    counts: {
      days: days.length,
      canonicalLinked: days.filter((day) => day.proceeding_id).length,
      provisional: days.filter((day) => day.basis === "editorial_reference" || day.basis === "planned").length,
      witnesses: days.reduce((total, day) => total + day.witnesses.length, 0),
      topics: days.reduce((total, day) => total + day.topics.length, 0),
    },
  };
}
