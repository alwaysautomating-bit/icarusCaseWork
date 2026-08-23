import Link from "next/link";
import { notFound } from "next/navigation";
import { MonoLabel } from "@/app/casework-ui";
import { ReconciliationEditor } from "@/app/cases/[caseId]/reconcile/_components/reconciliation-editor";
import { requireCaseActor } from "@/lib/authority";
import { reconcileHref, type ReconcileRouteState } from "@/lib/case-routes";
import { getReconciliationWorkspace } from "@/lib/reconciliation";
import { reconciliationNodeTypes, reconciliationRelations } from "@/lib/reconciliation-model";

export const dynamic = "force-dynamic";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ReconcilePage({ params, searchParams }: { params: Promise<{ caseId: string }>; searchParams: SearchParams }) {
  const actor = await requireCaseActor();
  const [{ caseId }, raw] = await Promise.all([params, searchParams]);
  const groupValue = first(raw.group);
  const rawType = first(raw.type);
  const routeState: ReconcileRouteState = {
    groupId: groupValue && groupValue !== "new" ? groupValue : undefined,
    newGroup: groupValue === "new",
    proceedingId: first(raw.proceeding),
    type: rawType && reconciliationNodeTypes.includes(rawType as (typeof reconciliationNodeTypes)[number]) ? rawType as (typeof reconciliationNodeTypes)[number] : "all",
    query: first(raw.q)?.slice(0, 500),
  };
  const workspace = await getReconciliationWorkspace(actor.id, caseId, routeState);
  if (!workspace) notFound();
  const notice = first(raw.notice);

  return <main className="reconcile-shell">
    <section className="reconcile-heading"><div><MonoLabel>RECONCILE · REVIEWED SOURCE GRAPH</MonoLabel><h1>Relate the record.<br />Preserve the disagreement.</h1><p>Cluster reviewed objects and classify support, conflict, qualification, sequence, or occurrence relationships without rewriting source evidence or creating canonical facts.</p></div><dl><div><dt>Reviewed nodes</dt><dd>{workspace.nodes.length}</dd></div><div><dt>Saved groups</dt><dd>{workspace.groups.length}</dd></div><div><dt>Graph relations</dt><dd>{workspace.derivedEdges.length}</dd></div><div><dt>Allowed classes</dt><dd>{reconciliationRelations.length}</dd></div></dl></section>
    <div className="reconcile-boundary"><strong>GOVERNED ANALYTICAL LAYER</strong><span>No save creates a canonical event, SAME identity resolution, entity merge, finding, or source mutation. Disagreement may remain unresolved.</span></div>
    {notice === "saved" ? <div className="record-notice" role="status"><strong>Reconciliation version saved.</strong><span>The immutable snapshot and case-ledger entry committed atomically.</span></div> : null}
    {notice === "unchanged" ? <div className="record-notice" role="status"><strong>No new version was needed.</strong><span>The submitted graph matched the current immutable snapshot, so no duplicate ledger entry was created.</span></div> : null}
    {workspace.selectedMissing ? <div className="record-notice" role="status"><strong>Requested group unavailable.</strong><span>It is invalid, outside this case, or hidden by RLS.</span></div> : null}
    <form className="reconcile-filters" method="get"><input type="hidden" name="group" value={routeState.newGroup ? "new" : routeState.groupId ?? ""} /><label><span>Reviewed object type</span><select name="type" defaultValue={routeState.type}><option value="all">All reviewed types</option>{reconciliationNodeTypes.map((type) => <option value={type} key={type}>{type}</option>)}</select></label><label><span>Proceeding</span><select name="proceeding" defaultValue={routeState.proceedingId ?? ""}><option value="">All proceedings</option>{workspace.proceedings.map((proceeding) => <option value={proceeding.id} key={proceeding.id}>{proceeding.title}</option>)}</select></label><label><span>Find reviewed material</span><input name="q" defaultValue={routeState.query ?? ""} placeholder="arrival, hypothermia, missing time…" /></label><button>Filter graph pool</button><Link href={reconcileHref(caseId, { groupId: routeState.groupId, newGroup: routeState.newGroup })}>Clear</Link></form>
    <div className="reconcile-workspace">
      <aside className="reconcile-groups"><header><MonoLabel>RECONCILIATION GROUPS</MonoLabel><Link href={reconcileHref(caseId, { newGroup: true })}>+ New group</Link></header>{workspace.groups.length === 0 ? <p>No governed groups saved yet.</p> : workspace.groups.map((group) => <Link className={workspace.selectedGroup?.id === group.id ? "selected" : ""} href={reconcileHref(caseId, { groupId: group.id })} key={group.id}><span>{group.status} · v{group.current_version}</span><strong>{group.name}</strong><small>{group.member_count} nodes · {group.edge_count} governed edges</small></Link>)}</aside>
      <ReconciliationEditor caseId={caseId} group={workspace.selectedGroup} candidates={workspace.visibleNodes} derivedEdges={workspace.derivedEdges} canManage={workspace.canManage} key={workspace.selectedGroup?.id ?? "new"} />
      <aside className="reconcile-history"><header><MonoLabel>IMMUTABLE HISTORY</MonoLabel><strong>{workspace.versions.length}</strong></header>{workspace.selectedGroup ? <><div className="reconcile-current-boundaries"><strong>Version {workspace.selectedGroup.current_version}</strong><span>{workspace.selectedGroup.snapshot.members.length} frozen members</span><span>{workspace.selectedGroup.snapshot.edges.length} reviewer-classified edges</span><span>0 canonical writes</span></div>{workspace.versions.map((version) => <article key={version.id}><span>VERSION {version.version} · LEDGER {version.ledger_logical_order}</span><strong>{version.snapshot.status}</strong><p>{version.change_note || "Initial group version."}</p><small>{new Date(version.changed_at).toLocaleString()} · {version.changed_by_user_id}</small></article>)}</> : <div className="reconcile-history-empty"><strong>DRAFT MODE</strong><p>Add at least two reviewed objects. Exact source IDs will be captured by the database, not trusted from the browser.</p></div>}</aside>
    </div>
  </main>;
}
