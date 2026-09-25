"use client";

import { useRouter } from "next/navigation";
import { courtRecordHref } from "@/lib/case-routes";

export function TranscriptViewSelect({ caseId, query, segmentId, proceedingId, view }: { caseId: string; query: string; segmentId?: string; proceedingId?: string; view: "segments" | "text" }) {
  const router = useRouter();
  return <select
    className="court-view-select"
    aria-label="Transcript view"
    value={view}
    onChange={(event) => {
      const next = event.target.value === "text" ? "text" : undefined;
      router.push(courtRecordHref(caseId, { query, segmentId, proceedingId, view: next }));
    }}
  >
    <option value="segments">Segments</option>
    <option value="text">Plain text</option>
  </select>;
}
