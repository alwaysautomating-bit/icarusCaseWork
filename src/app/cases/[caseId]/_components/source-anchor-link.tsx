import Link from "next/link";
import { courtRecordHref } from "@/lib/case-routes";

export function SourceAnchorLink({ caseId, segmentId, query, children = "Show source →" }: { caseId: string; segmentId: string; query?: string; children?: React.ReactNode }) {
  return <Link className="source-anchor-link" href={courtRecordHref(caseId, { query, segmentId })}>{children}</Link>;
}
