"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { saveReconciliationGroupAction, type ReconciliationActionState } from "@/app/cases/[caseId]/reconcile/actions";
import { courtRecordHref } from "@/lib/case-routes";
import type { DerivedGraphEdge, ReconciliationGroup, ReconciliationNode } from "@/lib/reconciliation";
import { reconciliationNodeKey, reconciliationRelations, reconciliationRoles, reconciliationStatuses, type ReconciliationEdge, type ReconciliationMemberSnapshot, type ReconciliationNodeType, type ReconciliationRole } from "@/lib/reconciliation-model";

const initialActionState: ReconciliationActionState = { kind: "idle", message: "" };
type MemberDraft = Pick<ReconciliationMemberSnapshot, "node_type" | "node_id" | "role" | "object_code" | "title" | "review_status" | "proceeding_id" | "source_segment_ids"> & { summary?: string; proceedingTitle?: string };

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

function keyForEdge(edge: Pick<ReconciliationEdge, "from_type" | "from_id" | "relation_type" | "to_type" | "to_id">) {
  return `${edge.from_type}:${edge.from_id}:${edge.relation_type}:${edge.to_type}:${edge.to_id}`;
}

function memberFromNode(node: ReconciliationNode): MemberDraft {
  return { node_type: node.type, node_id: node.id, role: "context", object_code: node.objectCode, title: node.title, review_status: node.reviewStatus as "accepted" | "amended", proceeding_id: node.proceedingId, source_segment_ids: node.sourceSegmentIds, summary: node.summary, proceedingTitle: node.proceedingTitle };
}

export function ReconciliationEditor({ caseId, group, candidates, derivedEdges, canManage }: { caseId: string; group: ReconciliationGroup | null; candidates: ReconciliationNode[]; derivedEdges: DerivedGraphEdge[]; canManage: boolean }) {
  const [state, formAction, pending] = useActionState(saveReconciliationGroupAction, initialActionState);
  const [members, setMembers] = useState<MemberDraft[]>(() => group?.snapshot.members.map((member) => ({ ...member })) ?? []);
  const [edges, setEdges] = useState<ReconciliationEdge[]>(() => group?.snapshot.edges ?? []);
  const [fromKey, setFromKey] = useState("");
  const [toKey, setToKey] = useState("");
  const [relation, setRelation] = useState<(typeof reconciliationRelations)[number]>("supports");
  const [rationale, setRationale] = useState("");
  const [localMessage, setLocalMessage] = useState("");
  const memberKeys = useMemo(() => new Set(members.map((member) => reconciliationNodeKey(member.node_type, member.node_id))), [members]);
  const visibleDerived = useMemo(() => derivedEdges.filter((edge) => memberKeys.has(reconciliationNodeKey(edge.from_type, edge.from_id)) && memberKeys.has(reconciliationNodeKey(edge.to_type, edge.to_id))), [derivedEdges, memberKeys]);
  const positions = useMemo(() => new Map(members.map((member, index) => [reconciliationNodeKey(member.node_type, member.node_id), { x: (index % 3) * 290 + 20, y: Math.floor(index / 3) * 170 + 28 }])), [members]);
  const canvasHeight = Math.max(230, Math.ceil(members.length / 3) * 170 + 30);

  function addMember(node: ReconciliationNode) {
    if (memberKeys.has(node.key) || members.length >= 50) return;
    setMembers((current) => [...current, memberFromNode(node)]);
  }

  function removeMember(type: ReconciliationNodeType, id: string) {
    const key = reconciliationNodeKey(type, id);
    setMembers((current) => current.filter((member) => reconciliationNodeKey(member.node_type, member.node_id) !== key));
    setEdges((current) => current.filter((edge) => reconciliationNodeKey(edge.from_type, edge.from_id) !== key && reconciliationNodeKey(edge.to_type, edge.to_id) !== key));
  }

  function updateRole(type: ReconciliationNodeType, id: string, role: ReconciliationRole) {
    setMembers((current) => current.map((member) => member.node_type === type && member.node_id === id ? { ...member, role } : member));
  }

  function addEdge() {
    setLocalMessage("");
    if (!fromKey || !toKey || fromKey === toKey || rationale.trim().length < 3) {
      setLocalMessage("Choose two different members and add a relationship rationale.");
      return;
    }
    const [fromType, fromId] = fromKey.split(":") as [ReconciliationNodeType, string];
    const [toType, toId] = toKey.split(":") as [ReconciliationNodeType, string];
    const edge: ReconciliationEdge = { from_type: fromType, from_id: fromId, to_type: toType, to_id: toId, relation_type: relation, rationale: rationale.trim() };
    if (edges.some((item) => keyForEdge(item) === keyForEdge(edge))) {
      setLocalMessage("That relationship is already recorded in this draft.");
      return;
    }
    setEdges((current) => [...current, edge]);
    setRationale("");
  }

  const renderedEdges = [...visibleDerived, ...edges];
  return <form action={formAction} className="reconcile-editor">
    <input type="hidden" name="caseId" value={caseId} />
    <input type="hidden" name="groupId" value={group?.id ?? ""} />
    <input type="hidden" name="expectedVersion" value={group?.current_version ?? 0} />
    <input type="hidden" name="members" value={JSON.stringify(members.map(({ node_type, node_id, role }) => ({ node_type, node_id, role })))} />
    <input type="hidden" name="edges" value={JSON.stringify(edges)} />
    <header className="reconcile-editor-heading"><div><span>{group ? `GROUP VERSION ${group.current_version}` : "NEW RECONCILIATION GROUP"}</span><strong>Cluster reviewed objects; classify only what the sources support.</strong></div><em>ANALYTICAL ONLY</em></header>
    <div className="reconcile-fields">
      <label><span>Group name</span><input name="name" required minLength={3} maxLength={200} defaultValue={group?.name ?? ""} placeholder="First-responder arrival sequence" disabled={!canManage} /></label>
      <label><span>Governed status</span><select name="status" defaultValue={group?.status ?? "open"} disabled={!canManage}>{reconciliationStatuses.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      <label className="wide"><span>Description</span><textarea name="description" rows={3} maxLength={5000} defaultValue={group?.description ?? ""} placeholder="What question does this cluster help inspect?" disabled={!canManage} /></label>
    </div>

    <section className="reconcile-canvas-section"><header><div><strong>Interactive candidate graph</strong><span>{members.length} nodes · {edges.length} governed edges · {visibleDerived.length} source-graph edges</span></div><small>Dashed edges are derived context and are not silently saved as reviewer classifications.</small></header>
      <div className="reconcile-canvas" style={{ height: canvasHeight }}>
        {members.length === 0 ? <div className="reconcile-canvas-empty"><strong>ADD REVIEWED OBJECTS</strong><span>Use the source-backed candidate pool below to create a graph.</span></div> : null}
        <svg aria-hidden="true" width="890" height={canvasHeight} viewBox={`0 0 890 ${canvasHeight}`}><defs><marker id="reconcile-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" /></marker></defs>{renderedEdges.map((edge) => {
          const from = positions.get(reconciliationNodeKey(edge.from_type, edge.from_id));
          const to = positions.get(reconciliationNodeKey(edge.to_type, edge.to_id));
          if (!from || !to) return null;
          const derived = "origin" in edge;
          return <g className={derived ? "derived" : "governed"} key={`${derived ? "derived" : "saved"}-${keyForEdge(edge)}`}><line x1={from.x + 125} y1={from.y + 55} x2={to.x + 125} y2={to.y + 55} markerEnd="url(#reconcile-arrow)" /><text x={(from.x + to.x) / 2 + 125} y={(from.y + to.y) / 2 + 46}>{humanize(edge.relation_type)}</text></g>;
        })}</svg>
        {members.map((member) => {
          const position = positions.get(reconciliationNodeKey(member.node_type, member.node_id))!;
          return <article className={`reconcile-node role-${member.role}`} style={{ left: position.x, top: position.y }} key={reconciliationNodeKey(member.node_type, member.node_id)}><header><span>{member.node_type} · {member.object_code ?? "NO CODE"}</span>{canManage ? <button type="button" onClick={() => removeMember(member.node_type, member.node_id)} aria-label={`Remove ${member.title}`}>×</button> : null}</header><strong>{member.title}</strong><footer><select value={member.role} onChange={(event) => updateRole(member.node_type, member.node_id, event.target.value as ReconciliationRole)} disabled={!canManage}>{reconciliationRoles.map((role) => <option key={role} value={role}>{role}</option>)}</select><Link href={courtRecordHref(caseId, { segmentId: member.source_segment_ids[0] })}>{member.source_segment_ids.length} source{member.source_segment_ids.length === 1 ? "" : "s"} →</Link></footer></article>;
        })}
      </div>
    </section>

    <section className="reconcile-relation-builder"><header><strong>Classify a relationship</strong><span>This creates a reconciliation edge, not a canonical event or SAME identity resolution.</span></header><div><select value={fromKey} onChange={(event) => setFromKey(event.target.value)} disabled={!canManage}><option value="">From node…</option>{members.map((member) => <option value={reconciliationNodeKey(member.node_type, member.node_id)} key={`from-${member.node_type}-${member.node_id}`}>{member.object_code ?? member.title}</option>)}</select><select value={relation} onChange={(event) => setRelation(event.target.value as typeof relation)} disabled={!canManage}>{reconciliationRelations.map((item) => <option value={item} key={item}>{humanize(item)}</option>)}</select><select value={toKey} onChange={(event) => setToKey(event.target.value)} disabled={!canManage}><option value="">To node…</option>{members.map((member) => <option value={reconciliationNodeKey(member.node_type, member.node_id)} key={`to-${member.node_type}-${member.node_id}`}>{member.object_code ?? member.title}</option>)}</select></div><textarea value={rationale} onChange={(event) => setRationale(event.target.value)} rows={2} maxLength={2000} placeholder="Why do the displayed sources support this relationship classification?" disabled={!canManage} /><button type="button" onClick={addEdge} disabled={!canManage}>Add governed edge</button>{localMessage ? <p role="alert">{localMessage}</p> : null}
      {edges.map((edge, index) => <article key={keyForEdge(edge)}><strong>{humanize(edge.relation_type)}</strong><span>{edge.rationale}</span>{canManage ? <button type="button" onClick={() => setEdges((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button> : null}</article>)}
    </section>

    <section className="reconcile-pool"><header><strong>Reviewed candidate pool</strong><span>{candidates.length} visible · accepted or amended with exact source lineage</span></header><div>{candidates.map((node) => <article key={node.key}><div><span>{node.type} · {node.objectCode ?? "NO CODE"}</span><strong>{node.title}</strong><small>{node.proceedingTitle} · {node.sourceSegmentIds.length} source{node.sourceSegmentIds.length === 1 ? "" : "s"}</small></div><button type="button" onClick={() => addMember(node)} disabled={!canManage || memberKeys.has(node.key)}>{memberKeys.has(node.key) ? "Added" : "Add"}</button></article>)}</div></section>

    {canManage ? <section className="reconcile-save"><label><span>Change note</span><textarea name="changeNote" rows={3} maxLength={2000} required={Boolean(group)} placeholder={group ? "Required: what changed and why?" : "Initial group rationale (recommended)"} /></label>{state.message ? <p className={state.kind} role="alert">{state.message}</p> : null}<button disabled={pending || members.length < 2}>{pending ? "Saving immutable version…" : group ? "Save new immutable version" : "Create reconciliation group"}</button><small>Saving freezes the reviewed member state, exact source IDs, relationships, rationale, actor, and case-ledger order.</small></section> : <section className="reconcile-readonly"><strong>READ-ONLY MEMBERSHIP</strong><p>You can inspect groups, source graph edges, and exact Court Record links. Only owners and reviewers can record reconciliation classifications.</p></section>}
  </form>;
}
