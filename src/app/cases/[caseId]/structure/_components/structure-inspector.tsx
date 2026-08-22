import { MonoLabel } from "@/app/casework-ui";
import { ReviewState } from "@/app/cases/[caseId]/structure/_components/review-state";
import type { StructureWorkspace } from "@/lib/case-structure";

function Confidence({ value }: { value: number | null }) {
  if (value === null) return null;
  return <div className="structure-confidence"><span>Extraction confidence</span><strong>{value.toFixed(2)}</strong><small>Parser confidence only—not evidentiary weight.</small></div>;
}

export function StructureInspector({ workspace }: { workspace: StructureWorkspace }) {
  const item = workspace.selected;
  return <section className="structure-object-inspector" aria-label="Selected structural object">
    <header><div><MonoLabel>SELECTED STRUCTURAL OBJECT</MonoLabel><h2>{item ? item.type.replaceAll("_", " ") : "No selection"}</h2></div>{item ? <ReviewState status={item.reviewStatus} /> : null}</header>
    {!item ? <div className="structure-inspector-empty"><strong>NOT YET DERIVED</strong><p>Select a mapped source segment or remove filters to inspect available structure.</p></div> : <div className="structure-inspector-scroll">
      <section className="structure-object-lede"><span>{item.objectCode ?? item.type.toUpperCase()}</span><h1>{item.title}</h1><p>{item.summary}</p><code>{item.id}</code></section>
      <section><MonoLabel>OBJECT CONTRACT</MonoLabel><dl><div><dt>Authoritative UUID</dt><dd><code>{item.id}</code></dd></div><div><dt>Object type</dt><dd>{item.type}</dd></div><div><dt>Review status</dt><dd>{item.reviewStatus}</dd></div><div><dt>Proceeding</dt><dd>{item.proceedingTitle}</dd></div><div><dt>Asserted by</dt><dd>{item.assertedBy ?? "NOT RECORDED"}</dd></div><div><dt>Supporting sources</dt><dd>{item.sourceSegmentIds.length}</dd></div></dl><Confidence value={item.confidence} /></section>
      {item.details.length ? <section><MonoLabel>STRUCTURED FIELDS</MonoLabel><dl>{item.details.map((entry) => <div key={entry.label}><dt>{entry.label}</dt><dd>{entry.value}</dd></div>)}</dl></section> : null}
      <section><MonoLabel>EXTRACTION</MonoLabel>{workspace.extraction ? <dl><div><dt>Run UUID</dt><dd><code>{workspace.extraction.id}</code></dd></div><div><dt>Compiler</dt><dd>{workspace.extraction.compilerName} · {workspace.extraction.compilerVersion}</dd></div><div><dt>Method</dt><dd>{workspace.extraction.extractionMethod}</dd></div><div><dt>Model</dt><dd>{workspace.extraction.modelName ? `${workspace.extraction.modelName}${workspace.extraction.modelVersion ? ` · ${workspace.extraction.modelVersion}` : ""}` : "NO MODEL RECORDED"}</dd></div><div><dt>Contract</dt><dd>{workspace.extraction.contractVersion}</dd></div><div><dt>Status</dt><dd>{workspace.extraction.status}</dd></div><div><dt>Configuration hash</dt><dd><code>{workspace.extraction.configurationSha256}</code></dd></div></dl> : <p className="structure-muted">No extraction run is attached to this object. This is expected for case-level canonical entities and legacy objects.</p>}</section>
      <section><MonoLabel>PROVENANCE</MonoLabel>{workspace.provenanceActivities.length === 0 && workspace.provenanceRelations.length === 0 ? <p className="structure-muted">No additional PROV activity or relation is recorded for this object.</p> : <div className="structure-provenance-list">{workspace.provenanceActivities.map((activity) => <article key={activity.id}><span>ACTIVITY · {activity.activityType.replaceAll("_", " ")}</span><strong>{activity.compilerName ?? activity.systemAgent ?? "Recorded activity"}</strong><code>{activity.id}</code></article>)}{workspace.provenanceRelations.map((relation) => <article key={relation.id}><span>RELATION · {relation.relationType.replaceAll("_", " ")}</span><strong>{relation.from} → {relation.to}</strong><small>{relation.sourceSegmentIds.length} recorded source segment{relation.sourceSegmentIds.length === 1 ? "" : "s"}</small><code>{relation.id}</code></article>)}</div>}</section>
      <section><MonoLabel>AUDIT HISTORY</MonoLabel>{workspace.auditHistory.length ? <ol className="structure-audit-list">{workspace.auditHistory.map((entry) => <li key={`${entry.logicalOrder}-${entry.operation}`}><span>#{entry.logicalOrder} · {entry.operation}</span><strong>{entry.systemAgent ?? "Human actor"}</strong><time>{new Date(entry.createdAt).toLocaleString()}</time></li>)}</ol> : <p className="structure-muted">No case-ledger entry is visible for this object.</p>}</section>
    </div>}
  </section>;
}
