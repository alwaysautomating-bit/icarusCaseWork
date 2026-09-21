import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/app/casework-ui";
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
  const advancedFiltersActive = Boolean(routeState.assertedBy || routeState.unresolvedOnly || routeState.temporalOnly);

  return <main className="structure-review-shell">
    <PageHeader eyebrow="CASE STRUCTURE / REVIEW" title="Review extracted candidates" lede="Check what the system extracted against the supporting record, then decide what should happen to each candidate." aside={<div className="structure-review-overview"><strong>{workspace.objects.length}</strong><span>candidates in this view</span><p>{workspace.reviewPermission === "review" ? "You can record review decisions for this case." : "You can inspect candidates and sources. A case owner or reviewer must record decisions."}</p></div>} actions={<Link className="ds-btn" href={structureHref(caseId, { objectId: selected?.id })}>Back to Structure →</Link>} />
    <section className="structure-review-guide" aria-label="How to review a candidate"><div><b>1</b><span><strong>Choose a candidate</strong><small>Start with a pending item in the queue.</small></span></div><div><b>2</b><span><strong>Compare every source</strong><small>Check the extracted fields against each excerpt.</small></span></div><div><b>3</b><span><strong>Record a decision</strong><small>Accept, correct, set aside, or reject it.</small></span></div></section>
    {notice ? <div className="structure-review-notice" role="status"><strong>Decision saved.</strong><span>The next candidate is ready if one remains in this view.</span></div> : null}
    {workspace.selectedMissing ? <div className="record-notice" role="status"><strong>Requested candidate unavailable.</strong><span>It may be outside this case or the current filters. Choose an item from the queue or clear the filters.</span></div> : null}
    <form className="structure-review-filters" method="get">
      <div className="structure-review-filter-heading"><strong>Find candidates</strong><span>Showing {routeState.reviewStatus?.replaceAll("_", " ")} items</span></div>
      <div className="structure-review-filter-main">
        <label><span>Queue state</span><select name="status" defaultValue={routeState.reviewStatus}><option value="pending">Pending · needs review</option><option value="deferred">Deferred · revisit later</option><option value="rejected">Rejected history</option><option value="accepted">Accepted history</option><option value="amended">Amended history</option><option value="all">All states</option></select></label>
        <label><span>Candidate type</span><select name="type" defaultValue={routeState.type}><option value="all">All types</option>{reviewTargetTypes.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select></label>
        <label><span>Proceeding / day</span><select name="proceeding" defaultValue={routeState.proceedingId ?? ""}><option value="">All proceedings</option>{workspace.proceedings.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <button type="submit">Apply filters</button><Link href={structureReviewHref(caseId, { reviewStatus: "pending" })}>Reset</Link>
      </div>
      <details className="structure-review-advanced-filters" open={advancedFiltersActive}><summary>More filters</summary><div>
        <label><span>Speaker / asserted by</span><input name="assertedBy" defaultValue={routeState.assertedBy ?? ""} /></label>
        <label className="structure-check-filter"><input type="checkbox" name="unresolved" value="1" defaultChecked={routeState.unresolvedOnly} /><span>Has unresolved flags</span></label>
        <label className="structure-check-filter"><input type="checkbox" name="temporal" value="1" defaultChecked={routeState.temporalOnly} /><span>Has temporal assertion</span></label>
      </div></details>
      {routeState.segmentId ? <input type="hidden" name="segment" value={routeState.segmentId} /> : null}{routeState.query ? <input type="hidden" name="q" value={routeState.query} /> : null}
    </form>
    {selected ? <div className="structure-review-grid">
      <ReviewQueue caseId={caseId} items={workspace.objects} selectedId={selected.id} routeState={routeState} counts={workspace.queueCounts} position={workspace.queuePosition} />
      <div className="structure-review-workspace">
        <section className="structure-review-candidate" aria-labelledby="review-candidate-heading"><header><div><span>1 / SELECTED CANDIDATE · {selected.type.replaceAll("_", " ")}</span><h2 id="review-candidate-heading">{selected.title}</h2></div><ReviewState status={selected.reviewStatus} /></header><p className="structure-review-summary">{selected.summary}</p>
          <section className="structure-current-fields"><h3>What was extracted</h3><p>Compare these fields with the source excerpts beside them.</p><dl>{Object.entries(selected.reviewFields).map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{value === null ? "—" : typeof value === "string" ? value : JSON.stringify(value)}</dd></div>)}</dl></section>
          <details className="structure-review-technical"><summary>Technical details</summary><dl className="structure-review-metadata"><div><dt>Object code</dt><dd>{selected.objectCode ?? "Not assigned"}</dd></div><div><dt>Object UUID</dt><dd>{selected.id}</dd></div><div><dt>Proceeding</dt><dd>{selected.proceedingTitle}</dd></div><div><dt>Asserted by</dt><dd>{selected.assertedBy ?? "Not recorded"}</dd></div><div><dt>Extraction run</dt><dd>{selected.extractionRunId ?? "Not recorded"}</dd></div><div><dt>Confidence</dt><dd>{selected.confidence === null ? "Not scored" : `${selected.confidence.toFixed(3)} · extraction confidence only`}</dd></div></dl></details>
          <nav className="structure-review-pager" aria-label="Candidate navigation">{workspace.previousObjectId ? <Link href={structureReviewHref(caseId, { ...routeState, objectId: workspace.previousObjectId, segmentId: undefined })}>← Previous candidate</Link> : <span />}{workspace.nextObjectId ? <Link href={structureReviewHref(caseId, { ...routeState, objectId: workspace.nextObjectId, segmentId: undefined })}>Next candidate →</Link> : <span />}</nav>
        </section>
        <ReviewSourceComparison caseId={caseId} sources={workspace.sources} selectedSourceId={workspace.selectedSourceId} routeState={routeState} />
        <ReviewForm key={selected.id} caseId={caseId} item={selected} routeState={routeState} permission={workspace.reviewPermission} sourceCount={workspace.sources.length} />
        <ReviewHistory versions={workspace.reviewHistory} />
      </div>
    </div> : <section className="structure-review-empty"><strong>NO CANDIDATES IN THIS VIEW</strong><h2>Nothing matches these filters.</h2><p>Try another queue state or reset the filters to return to pending candidates.</p><Link href={structureReviewHref(caseId, { reviewStatus: "pending" })}>Show pending candidates →</Link></section>}
  </main>;
}
