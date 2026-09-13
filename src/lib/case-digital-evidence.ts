import "server-only";

import { createClient } from "@/lib/supabase/server";
import { buildDigitalEvidenceTimeline, digitalEvidenceSourceSegmentIds, type DigitalEvidenceSourceSegment } from "@/lib/digital-evidence-timeline";

export async function getCaseDigitalEvidenceTimeline(caseId: string) {
  const supabase = await createClient();
  const result = await supabase
    .from("source_segments")
    .select("id,ordinal,exact_text")
    .eq("case_id", caseId)
    .in("id", digitalEvidenceSourceSegmentIds())
    .order("ordinal");
  if (result.error) throw new Error(result.error.message);
  return buildDigitalEvidenceTimeline((result.data ?? []) as DigitalEvidenceSourceSegment[]);
}

