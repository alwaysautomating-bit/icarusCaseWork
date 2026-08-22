import Link from "next/link";
import { ReviewState } from "@/app/cases/[caseId]/structure/_components/review-state";
import { structureReviewHref, type StructureReviewRouteState } from "@/lib/case-routes";
import type { QueueCounts, ReviewQueueItem } from "@/lib/structure-review";

export function ReviewQueue({ caseId, items, selectedId, routeState, counts, position }: { caseId: string; items: ReviewQueueItem[]; selectedId: string | null; routeState: StructureReviewRouteState; counts: QueueCounts; position: number }) {
  const pendingTotal = Object.values(counts).reduce((sum, count) => sum + count.pending, 0);
  return <aside className="structure-review-queue"><header><span>REVIEW QUEUE</span><strong>{pendingTotal}</strong><small>{position || 0} of {items.length} in this view</small></header>
    <div className="structure-review-counts">{Object.entries(counts).map(([type, count]) => <span key={type}>{type}<b>{count.pending}</b><i>{count.deferred} held</i></span>)}</div>
    <nav>{items.map((item, index) => <Link key={item.id} className={item.id === selectedId ? "selected" : ""} href={structureReviewHref(caseId, { ...routeState, objectId: item.id, segmentId: undefined, notice: undefined })}><small>{String(index + 1).padStart(2, "0")} · {item.type}</small><strong>{item.title}</strong><span>{item.proceedingTitle}</span><ReviewState status={item.reviewStatus} /></Link>)}</nav>
  </aside>;
}
