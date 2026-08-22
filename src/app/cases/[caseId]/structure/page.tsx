import Link from "next/link";
import { notFound } from "next/navigation";
import { MonoLabel } from "@/app/casework-ui";
import { LineageSources } from "@/app/cases/[caseId]/structure/_components/lineage-sources";
import { StructureInspector } from "@/app/cases/[caseId]/structure/_components/structure-inspector";
import { StructureList } from "@/app/cases/[caseId]/structure/_components/structure-list";
import { TimelineCandidateWorkspace } from "@/app/cases/[caseId]/structure/_components/timeline-candidate-workspace";
import { requireCaseActor } from "@/lib/authority";
import { courtRecordHref, parseStructureObjectType, structureHref, structureObjectTypes } from "@/lib/case-routes";
import { getCaseStructureWorkspace, type StructureFilters } from "@/lib/case-structure";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function StructurePage({ params, searchParams }: { params: Promise<{ caseId: string }>; searchParams: SearchParams }) {
  const actor = await requireCaseActor();
  const [{ caseId }, raw] = await Promise.all([params, searchParams]);
  const compareViewIds = (Array.isArray(raw.compare) ? raw.compare : raw.compare ? [raw.compare] : []).slice(0, 4);
  const filters: StructureFilters = {
    type: parseStructureObjectType(first(raw.type)), objectId: first(raw.object), segmentId: first(raw.segment), proceedingId: first(raw.proceeding),
    reviewStatus: first(raw.status), assertedBy: first(raw.assertedBy)?.slice(0, 120), unresolvedOnly: first(raw.unresolved) === "1", temporalOnly: first(raw.temporal) === "1", query: first(raw.q)?.slice(0, 500),
    timelineRunId: first(raw.run), compareViewIds,
  };
  const workspace = await getCaseStructureWorkspace(actor.id, caseId, filters);
  if (!workspace) notFound();
  const linkedPercent = workspace.coverage.totalSegments ? (workspace.coverage.linkedSegments / workspace.coverage.totalSegments) * 100 : 0;

  return <main className="structure-shell">
    <section className="structure-heading"><div><MonoLabel>STRUCTURE · READ-ONLY LINEAGE WORKSPACE</MonoLabel><h1>Objects with<br />their receipts.</h1><p>Browse candidate, reviewed, and canonical objects without promoting, merging, or mutating evidence.</p></div><div className="structure-coverage"><strong>{workspace.coverage.linkedSegments.toLocaleString()} <span>/ {workspace.coverage.totalSegments.toLocaleString()}</span></strong><p>RLS-visible source segments linked to at least one structural object.</p><div><i style={{ width: `${Math.min(linkedPercent, 100)}%` }} /></div><small>{linkedPercent.toFixed(1)}% case-scoped lineage coverage</small></div></section>
    {workspace.coverage.totalSegments > 0 && workspace.coverage.linkedSegments === 0 ? <section className="structure-checkpoint warning"><strong>NOT YET DERIVED</strong><p>This case contains canonical source text but no source-backed structural objects. Objects that may exist in a separate acceptance case are intentionally not substituted.</p><Link href={courtRecordHref(caseId, { query: filters.query, segmentId: filters.segmentId })}>Return to canonical record →</Link></section> : <section className="structure-checkpoint"><strong>CANONICAL CORPUS CHECKPOINT</strong><p>All counts, objects, and source links below are constrained to <code>{workspace.currentCase.id}</code>. Multi-source objects retain the complete recorded source list.</p></section>}
    {workspace.selectedMissing ? <div className="record-notice" role="status"><strong>Requested object unavailable.</strong><span>The UUID is invalid, belongs to another case, is not visible under RLS, or is outside the supported structural contract.</span></div> : null}
    {workspace.selectedSourceMissing ? <div className="record-notice" role="status"><strong>Requested source is not part of this object.</strong><span>The first recorded supporting source is selected instead; cross-case or unrelated segments are never attached.</span></div> : null}
    <TimelineCandidateWorkspace caseId={caseId} timeline={workspace.timeline} routeState={filters} compareViewIds={compareViewIds} />
    <form className="structure-filter-bar" method="get">
      <label><span>Object type</span><select name="type" defaultValue={filters.type}><option value="all">All objects</option>{structureObjectTypes.map((type) => <option value={type} key={type}>{type.replaceAll("_", " ")} ({workspace.counts[type]})</option>)}</select></label>
      <label><span>Proceeding / day</span><select name="proceeding" defaultValue={filters.proceedingId ?? ""}><option value="">All proceedings</option>{workspace.proceedings.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>
      <label><span>Review state</span><select name="status" defaultValue={filters.reviewStatus ?? ""}><option value="">Any state</option>{["pending", "candidate", "accepted", "amended", "reviewed", "reconciled", "deferred", "rejected", "proposed", "resolved", "canonical"].map((status) => <option value={status} key={status}>{status}</option>)}</select></label>
      <label><span>Speaker / asserted by</span><input name="assertedBy" defaultValue={filters.assertedBy ?? ""} placeholder="Witness or asserting actor" /></label>
      <label className="structure-check-filter"><input type="checkbox" name="unresolved" value="1" defaultChecked={filters.unresolvedOnly} /><span>Has unresolved flags</span></label>
      <label className="structure-check-filter"><input type="checkbox" name="temporal" value="1" defaultChecked={filters.temporalOnly} /><span>Has temporal assertion</span></label>
      {filters.segmentId ? <input type="hidden" name="segment" value={filters.segmentId} /> : null}{filters.query ? <input type="hidden" name="q" value={filters.query} /> : null}{workspace.timeline.activeRunId ? <input type="hidden" name="run" value={workspace.timeline.activeRunId} /> : null}{compareViewIds.map((id) => <input type="hidden" name="compare" value={id} key={id} />)}
      <button>Apply filters</button><Link href={structureHref(caseId, { timelineRunId: workspace.timeline.activeRunId ?? undefined, compareViewIds })}>Clear</Link>
    </form>
    <div className="structure-workspace-grid">
      <StructureList caseId={caseId} filters={filters} objects={workspace.objects} selectedId={workspace.selected?.id ?? null} />
      <StructureInspector workspace={workspace} />
      <LineageSources caseId={caseId} filters={filters} objectId={workspace.selected?.id ?? null} sources={workspace.sources} selectedSourceId={workspace.selectedSourceId} />
    </div>
  </main>;
}
