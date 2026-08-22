import Link from "next/link";
import { courtRecordHref, structureReviewHref, type StructureReviewRouteState } from "@/lib/case-routes";
import type { StructureSource } from "@/lib/case-structure";

function timestamp(milliseconds: number | null) {
  if (milliseconds === null) return "NO COURTROOM TIMESTAMP";
  const seconds = Math.floor(milliseconds / 1_000);
  return [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map((value) => String(value).padStart(2, "0")).join(":");
}

export function ReviewSourceComparison({ caseId, objectId, sources, selectedSourceId, routeState }: { caseId: string; objectId: string; sources: StructureSource[]; selectedSourceId: string | null; routeState: StructureReviewRouteState }) {
  return <aside className="structure-review-sources"><header><span>COMPLETE SOURCE COMPARISON</span><strong>{sources.length}</strong><small>Recorded order · no hidden primary source</small></header>
    {sources.length === 0 ? <div className="structure-review-empty"><strong>NO SOURCE LINEAGE</strong><p>Review is blocked until authoritative source segments are recorded.</p></div> : sources.map((source, index) => <article className={source.id === selectedSourceId ? "selected" : ""} key={source.id}><header><Link href={structureReviewHref(caseId, { ...routeState, objectId, segmentId: source.id, notice: undefined })}>SOURCE {index + 1}</Link><span>{timestamp(source.timestampStartMs)}</span></header><blockquote>{source.exactText}</blockquote><dl><div><dt>Speaker</dt><dd>{source.speaker}</dd></div><div><dt>Proceeding</dt><dd>{source.proceedingTitle}</dd></div><div><dt>Locator</dt><dd>{JSON.stringify(source.locator)}</dd></div><div><dt>Artifact</dt><dd>{source.artifactTitle}</dd></div><div><dt>SHA-256</dt><dd>{source.artifactSha256}</dd></div></dl><footer><code>{source.id}</code><Link href={courtRecordHref(caseId, { segmentId: source.id, query: routeState.query })}>Jump to Segment →</Link></footer></article>)}
  </aside>;
}
