import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  buildChildrenFoundReport,
  childrenFoundSourceSegmentIds,
  type ChildrenFoundSourceSegment,
} from "@/lib/children-found-report";

export async function getCaseChildrenFoundReport(caseId: string) {
  const supabase = await createClient();
  const result = await supabase
    .from("source_segments")
    .select("id,exact_text")
    .eq("case_id", caseId)
    .in("id", childrenFoundSourceSegmentIds());

  if (result.error) throw new Error(result.error.message);
  return buildChildrenFoundReport((result.data ?? []) as ChildrenFoundSourceSegment[]);
}
