import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  buildLindsayFoundReport,
  lindsayFoundSourceSegmentIds,
  type LindsayFoundSourceSegment,
} from "@/lib/lindsay-found-report";

export async function getCaseLindsayFoundReport(caseId: string) {
  const supabase = await createClient();
  const result = await supabase
    .from("source_segments")
    .select("id,exact_text")
    .eq("case_id", caseId)
    .in("id", lindsayFoundSourceSegmentIds());

  if (result.error) throw new Error(result.error.message);
  return buildLindsayFoundReport((result.data ?? []) as LindsayFoundSourceSegment[]);
}
