import Link from "next/link";
import { MonoLabel } from "@/app/casework-ui";
import { ReviewState } from "@/app/cases/[caseId]/structure/_components/review-state";
import { structureHref } from "@/lib/case-routes";
import type { StructureFilters, StructureListItem } from "@/lib/case-structure";

export function StructureList({ caseId, filters, objects, selectedId }: { caseId: string; filters: StructureFilters; objects: StructureListItem[]; selectedId: string | null }) {
  return <aside className="structure-object-list" aria-label="Structural objects">
    <header><div><MonoLabel>OBJECTS</MonoLabel><h2>Evidence-backed structure</h2></div><strong>{objects.length}</strong></header>
    {objects.length === 0 ? <div className="structure-list-empty"><strong>NOT YET DERIVED</strong><p>No structural object matches this case-scoped filter. No object from another case has been substituted.</p></div> : <div className="structure-object-scroll">{objects.map((item) => {
      const selected = item.id === selectedId;
      return <Link className={`structure-object-card${selected ? " selected" : ""}`} aria-current={selected ? "location" : undefined} href={structureHref(caseId, { ...filters, type: item.type, objectId: item.id, segmentId: filters.segmentId && item.sourceSegmentIds.includes(filters.segmentId) ? filters.segmentId : item.sourceSegmentIds[0] })} key={item.id}>
        <div><span>{item.type}</span><ReviewState status={item.reviewStatus} /></div>
        <strong>{item.title}</strong>
        <p>{item.summary}</p>
        <footer><span>{item.proceedingTitle}</span><span>{item.sourceSegmentIds.length} source{item.sourceSegmentIds.length === 1 ? "" : "s"}</span></footer>
      </Link>;
    })}</div>}
  </aside>;
}
