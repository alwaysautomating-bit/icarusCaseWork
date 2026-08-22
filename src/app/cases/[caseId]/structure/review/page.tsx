import Link from "next/link";
import { notFound } from "next/navigation";
import { MonoLabel } from "@/app/casework-ui";
import { ReviewState } from "@/app/cases/[caseId]/structure/_components/review-state";
import { ReviewForm } from "@/app/cases/[caseId]/structure/review/_components/review-form";
import { ReviewHistory } from "@/app/cases/[caseId]/structure/review/_components/review-history";
import { ReviewQueue } from "@/app/cases/[caseId]/structure/review/_components/review-queue";
import { ReviewSourceComparison } from "@/app/cases/[caseId]/structure/review/_components/review-source-comparison";
import { requireCaseActor } from "@/lib/authority";
import { parseStructureObjectType, structureHref, structureReviewHref, type StructureReviewRouteState } from "@/lib/case-routes";
import { getStructureReviewWorkspace, reviewTargetTypes } from "@/lib/structure-review";

export const dynamic = "force-dynamic";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function StructureReviewPage({ params, searchParams }: { params: Promise<{ caseId: string }>; searchParams: SearchParams }) {
  const actor = await requireCaseActor();
  const [{ caseId }, raw] = await Promise.all([params, searchParams]);
  const parsedType = parseStructureObjectType(first(raw.type));
  const routeState: StructureReviewRouteState = {
    type: parsedType === "entity" ? "all" : parsedType,
    objectId: first(raw.object), segmentId: first(raw.segment), proceedingId: first(raw.proceeding), reviewStatus: first(raw.status) || "pending",
    assertedBy: first(raw.assertedBy)?.slice(0, 120), unresolvedOnly: first(raw.unresolved) === "1", temporalOnly: first(raw.temporal) === "1", query: first(raw.q)?.slice(0, 500),
  };
  const workspace = await getStructureReviewWorkspace(actor.id, caseId, routeState);
  if (!workspace) notFound();
  const selected = workspace.selected;
  const notice = first(raw.notice) === "reviewed";

  return <main className="structure-review-shell">
    <section className="structure-review-heading"><div><MonoLabel>STRUCTURE · GOVERNED HUMAN REVIEW</MonoLabel><h1>Decide with<br />the sources visible.</h1><p>Accept, amend, reject, or defer extracted candidates through an atomic, immutable, case-scoped decision. Source evidence remains untouched.</p></div><div><strong>{workspace.objects.length}</strong><span>objects in active view</span><p>{workspace.reviewPermission === "review" ? "Owner/reviewer mutation permission confirmed from case membership." : "Read-only membership. Evidence and prior history remain inspectable."}</p><Link href={structureHref(caseId, { objectId: selected?.id })}>Return to read-only Structure →</Link></div></section>
    {notice ? <div className="structure-review-notice" role="status"><strong>REVIEW SAVED</strong><span>The target, immutable version, and case-ledger event were committed atomically.</span></div> : null}
    {workspace.selectedMissing ? <div className="record-notice" role="status"><strong>Requested review object unavailable.</strong><span>It is invalid, outside this case, hidden by RLS, or outside the active queue filters.</span></div> : null}
    <form className="structure-review-filters" method="get">
      <label><span>Object type</span><select name="type" defaultValue={routeState.type}><option value="all">All reviewable types</option>{reviewTargetTypes.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select></label>
      <label><span>Proceeding / day</span><select name="proceeding" defaultValue={routeState.proceedingId ?? ""}><option value="">All proceedings</option>{workspace.proceedings.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <label><span>Queue state</span><select name="status" defaultValue={routeState.reviewStatus}><option value="pending">Pending candidates</option><option value="deferred">Deferred</option><option value="rejected">Rejected history</option><option value="accepted">Accepted</option><option value="amended">Amended</option><option value="all">All states</option></select></label>
      <label><span>Speaker / asserted by</span><input name="assertedBy" defaultValue={routeState.assertedBy ?? ""} /></label>
      <label className="structure-check-filter"><input type="checkbox" name="unresolved" value="1" defaultChecked={routeState.unresolvedOnly} /><span>Has unresolved flags</span></label>
      <label className="structure-check-filter"><input type="checkbox" name="temporal" value="1" defaultChecked={routeState.temporalOnly} /><span>Has temporal assertion</span></label>
      {routeState.segmentId ? <input type="hidden" name="segment" value={routeState.segmentId} /> : null}{routeState.query ? <input type="hidden" name="q" value={routeState.query} /> : null}
      <button>Apply filters</button><Link href={structureReviewHref(caseId, { reviewStatus: "pending" })}>Clear</Link>
    </form>
    {selected ? <div className="structure-review-grid">
      <ReviewQueue caseId={caseId} items={workspace.objects} selectedId={selected.id} routeState={routeState} counts={workspace.queueCounts} position={workspace.queuePosition} />
      <section className="structure-review-candidate"><header><div><span>{selected.type} · {selected.objectCode ?? "NO CODE"}</span><h2>{selected.title}</h2></div><ReviewState status={selected.reviewStatus} /></header><p className="structure-review-summary">{selected.summary}</p><dl className="structure-review-metadata"><div><dt>Object UUID</dt><dd>{selected.id}</dd></div><div><dt>Proceeding</dt><dd>{selected.proceedingTitle}</dd></div><div><dt>Asserted by</dt><dd>{selected.assertedBy ?? "Not recorded"}</dd></div><div><dt>Extraction run</dt><dd>{selected.extractionRunId ?? "Not recorded"}</dd></div><div><dt>Confidence</dt><dd>{selected.confidence === null ? "Not scored" : selected.confidence.toFixed(3)} · extraction confidence only</dd></div></dl>
        <section className="structure-current-fields"><h3>Current structured fields</h3><dl>{Object.entries(selected.reviewFields).map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{value === null ? "—" : typeof value === "string" ? value : JSON.stringify(value)}</dd></div>)}</dl></section>
        <div className="structure-review-pager">{workspace.previousObjectId ? <Link href={structureReviewHref(caseId, { ...routeState, objectId: workspace.previousObjectId, segmentId: undefined })}>← Previous</Link> : <span />}{workspace.nextObjectId ? <Link href={structureReviewHref(caseId, { ...routeState, objectId: workspace.nextObjectId, segmentId: undefined })}>Next →</Link> : <span />}</div>
        <ReviewForm caseId={caseId} item={selected} routeState={routeState} permission={workspace.reviewPermission} sourceCount={workspace.sources.length} />
        <ReviewHistory versions={workspace.reviewHistory} />
      </section>
      <ReviewSourceComparison caseId={caseId} objectId={selected.id} sources={workspace.sources} selectedSourceId={workspace.selectedSourceId} routeState={routeState} />
    </div> : <section className="structure-review-empty"><strong>QUEUE COMPLETE FOR THIS VIEW</strong><h2>No matching candidates.</h2><p>The filters are honest: no fixture or cross-case object is substituted. Change the queue state to inspect deferred or historical decisions.</p></section>}
  </main>;
}
