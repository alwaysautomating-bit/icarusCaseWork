import Link from "next/link";
import { ReviewState } from "@/app/cases/[caseId]/structure/_components/review-state";
import { structureReviewHref, type StructureReviewRouteState } from "@/lib/case-routes";
import type { QueueCounts, ReviewQueueItem } from "@/lib/structure-review";

export function ReviewQueue({ caseId, items, selectedId, routeState, counts, position }: { caseId: string; items: ReviewQueueItem[]; selectedId: string | null; routeState: StructureReviewRouteState; counts: QueueCounts; position: number }) {
  const pendingTotal = Object.values(counts).reduce((sum, count) => sum + count.pending, 0);
  const deferredTotal = Object.values(counts).reduce((sum, count) => sum + count.deferred, 0);
  return <aside className="structure-review-queue"><header><h2>Choose a candidate</h2><p>{position || 0} of {items.length} in this view</p><div><span>{pendingTotal} pending</span><span>{deferredTotal} deferred</span></div></header>
    <nav aria-label="Review candidates">{items.map((item, index) => <Link key={item.id} aria-current={item.id === selectedId ? "page" : undefined} className={item.id === selectedId ? "selected" : ""} href={structureReviewHref(caseId, { ...routeState, objectId: item.id, segmentId: undefined, notice: undefined })}><small>{String(index + 1).padStart(2, "0")} · {item.type.replaceAll("_", " ")}</small><strong>{item.title}</strong><span>{item.proceedingTitle}</span><ReviewState status={item.reviewStatus} /></Link>)}</nav>
  </aside>;
}
