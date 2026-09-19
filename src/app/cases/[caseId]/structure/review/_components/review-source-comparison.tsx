import Link from "next/link";
import { courtRecordHref, type StructureReviewRouteState } from "@/lib/case-routes";
import type { StructureSource } from "@/lib/case-structure";

function timestamp(milliseconds: number | null) {
  if (milliseconds === null) return "NO COURTROOM TIMESTAMP";
  const seconds = Math.floor(milliseconds / 1_000);
  return [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map((value) => String(value).padStart(2, "0")).join(":");
}

export function ReviewSourceComparison({ caseId, sources, selectedSourceId, routeState }: { caseId: string; sources: StructureSource[]; selectedSourceId: string | null; routeState: StructureReviewRouteState }) {
  return <section className="structure-review-sources" aria-labelledby="review-sources-heading"><header><div><span>2 / CHECK THE RECORD</span><h2 id="review-sources-heading">Compare supporting sources</h2><p>Read every excerpt below. Check whether each supports the extracted fields before you decide.</p></div><strong>{sources.length} source{sources.length === 1 ? "" : "s"}</strong></header>
    {sources.length === 0 ? <div className="structure-review-empty"><strong>NO SUPPORTING SOURCES</strong><p>A decision is blocked until a supporting source segment is attached.</p></div> : sources.map((source, index) => <article className={source.id === selectedSourceId ? "selected" : ""} key={source.id}><header><h3>Source {index + 1} of {sources.length}</h3><span>{source.speaker} · {source.proceedingTitle}</span></header><blockquote>{source.exactText}</blockquote><footer><span>{timestamp(source.timestampStartMs)}</span><Link href={courtRecordHref(caseId, { segmentId: source.id, query: routeState.query })}>Open in court record →</Link></footer><details><summary>Source details</summary><dl><div><dt>Locator</dt><dd>{JSON.stringify(source.locator)}</dd></div><div><dt>Artifact</dt><dd>{source.artifactTitle}</dd></div><div><dt>SHA-256</dt><dd>{source.artifactSha256}</dd></div><div><dt>Segment ID</dt><dd>{source.id}</dd></div></dl></details></article>)}
  </section>;
}
