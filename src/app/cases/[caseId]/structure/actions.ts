"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCaseActor } from "@/lib/authority";
import { structureHref } from "@/lib/case-routes";
import { getCaseStructureWorkspace } from "@/lib/case-structure";
import { createClient } from "@/lib/supabase/server";

const saveInputSchema = z.object({
  caseId: z.uuid(),
  runId: z.uuid(),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1_000),
});

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function saveTimelineViewAction(caseId: string, runId: string, formData: FormData) {
  const actor = await requireCaseActor();
  const input = saveInputSchema.parse({ caseId, runId, name: formValue(formData, "name"), description: formValue(formData, "description") });
  const workspace = await getCaseStructureWorkspace(actor.id, input.caseId, { type: "all", timelineRunId: input.runId });
  if (!workspace) throw new Error("The case is not accessible.");
  if (!workspace.timeline.runs.some((run) => run.id === input.runId)) throw new Error("The timeline extraction run is not accessible in this case.");
  if (workspace.timeline.current.length === 0) throw new Error("The selected extraction run has no timeline candidates to save.");

  const eventCandidateIds = [...new Set(workspace.timeline.current.map((item) => item.event_candidate_id))];
  const temporalAssertionIds = [...new Set(workspace.timeline.current.map((item) => item.temporal_assertion_id))];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_timeline_view_version", {
    p_case_id: input.caseId,
    p_name: input.name,
    p_description: input.description,
    p_extraction_run_ids: [input.runId],
    p_event_candidate_ids: eventCandidateIds,
    p_temporal_assertion_ids: temporalAssertionIds,
    p_view_state: { timeline_run_id: input.runId, object_count: workspace.timeline.current.length },
  });
  if (error) throw new Error(error.message);
  const saved = data as null | { id: string };
  if (!saved?.id) throw new Error("Supabase did not return the saved timeline view.");

  revalidatePath(structureHref(input.caseId));
  redirect(structureHref(input.caseId, { timelineRunId: input.runId, compareViewIds: [saved.id] }));
}
