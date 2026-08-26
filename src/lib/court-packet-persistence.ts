import "server-only";

import { z } from "zod";
import type { CaseActor } from "@/lib/authority";
import { getCaseContext } from "@/lib/casework-supabase";
import { courtPacketBundleSchema, type CourtPacketBundle } from "@/lib/court-packet";

export type CourtPacketCommitResult = {
  runId: string;
  artifactId: string;
  duplicate: boolean;
  pages: number;
  candidates: number;
  reviewStatus: "review_required";
  analyticalAssessmentsCreated: 0;
};

const resultSchema = z.object({
  run_id: z.uuid(), artifact_id: z.uuid(), duplicate: z.boolean(), pages: z.number().int().positive(), candidates: z.number().int().nonnegative(),
  review_status: z.literal("review_required"), analytical_assessments_created: z.literal(0),
});

export async function commitCourtPacketBundle(actor: CaseActor, rawBundle: CourtPacketBundle): Promise<CourtPacketCommitResult> {
  const bundle = courtPacketBundleSchema.parse(rawBundle);
  const { supabase, caseId } = await getCaseContext(actor);
  if (bundle.case_id !== caseId) throw new Error("Court packet case does not match the active case.");
  const { data, error } = await supabase.rpc("commit_court_packet_parse", { payload: bundle });
  if (error) throw new Error(error.message);
  const result = resultSchema.parse(data);
  return {
    runId: result.run_id,
    artifactId: result.artifact_id,
    duplicate: result.duplicate,
    pages: result.pages,
    candidates: result.candidates,
    reviewStatus: result.review_status,
    analyticalAssessmentsCreated: result.analytical_assessments_created,
  };
}
