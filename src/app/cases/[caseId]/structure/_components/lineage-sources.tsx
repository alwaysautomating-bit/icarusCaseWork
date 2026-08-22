import Link from "next/link";
import { MonoLabel } from "@/app/casework-ui";
import { courtRecordHref, structureHref } from "@/lib/case-routes";
import type { StructureFilters, StructureSource } from "@/lib/case-structure";
import { formatSourceLocator } from "@/lib/source-locator";

function formatTimestamp(milliseconds: number | null) {
  if (milliseconds === null) return "TIME NOT RECORDED";
  const seconds = Math.floor(milliseconds / 1_000);
  return [Math.floor(seconds / 3_600), Math.floor((seconds % 3_600) / 60), seconds % 60].map((part) => String(part).padStart(2, "0")).join(":");
}

export function LineageSources({ caseId, filters, objectId, sources, selectedSourceId }: { caseId: string; filters: StructureFilters; objectId: string | null; sources: StructureSource[]; selectedSourceId: string | null }) {
  return <aside className="structure-lineage-inspector" aria-label="Sources and lineage">
    <header><div><MonoLabel>SOURCES + LINEAGE</MonoLabel><h2>Every recorded source</h2></div><strong>{sources.length}</strong></header>
    {sources.length === 0 ? <div className="structure-lineage-empty"><strong>NO SUPPORTING SEGMENT RECORDED</strong><p>The object remains visible, but the database does not currently connect it to a source segment.</p></div> : <div className="structure-source-scroll">{sources.map((source, index) => {
      const selected = source.id === selectedSourceId;
      return <article className={`structure-source-card${selected ? " selected" : ""}`} key={source.id}>
        <header><span>SOURCE {String(index + 1).padStart(2, "0")}</span><span>{selected ? "SELECTED" : source.proceedingTitle}</span></header>
        <h3>{source.speaker}</h3><blockquote>{source.exactText}</blockquote>
        <dl><div><dt>Segment</dt><dd><code>{source.id}</code></dd></div><div><dt>Timestamp</dt><dd>{formatTimestamp(source.timestampStartMs)}</dd></div><div><dt>Locator</dt><dd>{formatSourceLocator(source.locator)}</dd></div><div><dt>Artifact</dt><dd>{source.artifactTitle}</dd></div><div><dt>SHA-256</dt><dd><code>{source.artifactSha256}</code></dd></div></dl>
        <footer><Link scroll={false} href={structureHref(caseId, { ...filters, objectId: objectId ?? undefined, segmentId: source.id })}>Inspect lineage</Link><Link href={courtRecordHref(caseId, { query: filters.query, segmentId: source.id })}>Jump to Segment →</Link></footer>
      </article>;
    })}</div>}
  </aside>;
}
