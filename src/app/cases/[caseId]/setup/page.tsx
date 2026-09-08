import Link from "next/link";
import { notFound } from "next/navigation";
import { MonoLabel } from "@/app/casework-ui";
import { updateCaseDefinitionAction } from "@/app/cases/actions";
import { requireCaseActor } from "@/lib/authority";
import { getFoundationWorkspace } from "@/lib/case-foundation";
import { courtRecordHref, structureHref, trialIndexHref } from "@/lib/case-routes";
import { getProvisionalT0Baseline } from "@/lib/provisional-t0";

export const dynamic = "force-dynamic";

function localInputDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function displayDate(value: string | null) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Not established";
}

function statusClass(status: "PASS" | "WARN" | "BLOCK") {
  return status === "PASS" ? "pass" : status === "WARN" ? "warn" : "block";
}

export default async function FoundationPage({ params }: { params: Promise<{ caseId: string }> }) {
  const actor = await requireCaseActor();
  const { caseId } = await params;
  const workspace = await getFoundationWorkspace(actor.id, caseId);
  if (!workspace) notFound();

  const { currentCase } = workspace;
  const baseline = getProvisionalT0Baseline();
  const updateAction = updateCaseDefinitionAction.bind(null, currentCase.id);
  const readinessIssues = workspace.readiness.dimensions.filter((item) => item.status !== "PASS");
  const baselineEvents = baseline.events.filter((event) => ["EV2", "EV4", "EV10", "EV11"].includes(event.event_id));

  return <main className="foundation-shell foundation-overview">
    <section className="foundation-summary">
      <div>
        <MonoLabel>CASE FOUNDATION</MonoLabel>
        <h1>Foundation is established.</h1>
        <p>{currentCase.purpose}</p>
        <div className="foundation-actions">
          <Link className="system-button primary" href={trialIndexHref(currentCase.id)}>Open Trial Index</Link>
          <Link className="system-button" href={courtRecordHref(currentCase.id)}>Search Court Record</Link>
          <Link className="system-button" href={structureHref(currentCase.id)}>Open Structure</Link>
        </div>
      </div>
      <aside>
        <span className={`foundation-readiness ${workspace.readiness.blockers > 0 ? "block" : workspace.readiness.warnings > 0 ? "warn" : "pass"}`}>{workspace.readiness.overall}</span>
        <p>The source corpus is usable. Warnings identify review work; they do not require recreating the case.</p>
      </aside>
    </section>

    <section className="foundation-metrics" aria-label="Foundation status">
      <article><span>Committed testimony</span><strong>{workspace.counts.segments.toLocaleString()}</strong><small>canonical source segments</small></article>
      <article><span>Proceedings</span><strong>{workspace.proceedings.length}</strong><small>{workspace.proceedings.filter((item) => item.status === "published").length} published</small></article>
      <article><span>Trial index</span><strong>{workspace.counts.trialIndexDays}</strong><small>indexed trial days</small></article>
      <article><span>Preserved sources</span><strong>{workspace.sources.length}</strong><small>{workspace.artifacts.length} source artifacts</small></article>
    </section>

    <section className="foundation-primary-grid">
      <article className="foundation-card foundation-t0-card">
        <header><div><MonoLabel>PROVISIONAL T₀ · {baseline.version}</MonoLabel><h2>Incident orientation</h2></div><span className="state-chip warn">SECONDARY-REPORTED</span></header>
        <p className="foundation-card-lede">{baseline.notes}</p>
        <div className="foundation-anchor"><span>Working incident anchor</span><strong>{displayDate(currentCase.incident_at)}</strong><small>This is orientation—not a reconciled or adjudicated timeline finding.</small></div>
        <div className="foundation-baseline-counts"><span>{baseline.entities.length} baseline entities</span><span>{baseline.events.length} candidate events</span><span>{baseline.temporal_anchors.length} temporal anchors</span><span>{baseline.propositions.length} unresolved propositions</span></div>
        <div className="foundation-event-spine">
          {baselineEvents.map((event) => <article key={event.event_id}><time>{event.event_time}</time><div><strong>{event.neutral_description}</strong><small>{event.temporal_precision} · {event.status.replaceAll("_", " ")}</small></div></article>)}
        </div>
      </article>

      <aside className="foundation-card foundation-attention-card">
        <header><MonoLabel>WHAT STILL NEEDS ATTENTION</MonoLabel><h2>Review, not re-establishment</h2></header>
        {baseline.unknowns.map((item) => <article key={item.unknown_id}><strong>{item.unknown_id}</strong><p>{item.description}</p></article>)}
        {readinessIssues.length > 0 ? <div className="foundation-system-warnings"><strong>System warnings</strong>{readinessIssues.map((item) => <p key={item.key}><span className={`state-chip ${statusClass(item.status)}`}>{item.status}</span>{item.summary}</p>)}</div> : <p className="foundation-clear-state">No system blocker is open.</p>}
      </aside>
    </section>

    <details className="foundation-audit">
      <summary><span><strong>Case settings</strong><small>Edit scope, cutoff, or the provisional incident window.</small></span><span>Open</span></summary>
      <div className="foundation-audit-body">
        {currentCase.membershipRole === "owner" ? <form action={updateAction} className="case-definition-form compact">
          <label>Case title<input name="title" required defaultValue={currentCase.title} /></label>
          <label>Internal identifier<input name="workspaceKey" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" defaultValue={currentCase.workspace_key} /></label>
          <label className="wide">Purpose and scope<textarea name="purpose" rows={4} required defaultValue={currentCase.purpose} /></label>
          <label>Evidentiary cutoff<input name="publicRecordCutoff" type="datetime-local" required defaultValue={localInputDate(currentCase.public_record_cutoff)} /></label>
          <label>Provisional T₀ / incident time<input name="incidentAt" type="datetime-local" defaultValue={localInputDate(currentCase.incident_at)} /></label>
          <label>Incident-window start<input name="incidentWindowStart" type="datetime-local" defaultValue={localInputDate(currentCase.incident_window_start)} /></label>
          <label>Incident-window end<input name="incidentWindowEnd" type="datetime-local" defaultValue={localInputDate(currentCase.incident_window_end)} /></label>
          <button>Save supported case fields</button>
        </form> : <p>Only the case owner can edit foundation settings.</p>}
      </div>
    </details>

    <details className="foundation-audit">
      <summary><span><strong>Source and publication audit</strong><small>Ingestion coverage and proceeding-level diagnostics.</small></span><span>Open</span></summary>
      <div className="foundation-audit-body foundation-audit-register">
        <div><span>Sources</span><strong>{workspace.sources.length}</strong></div><div><span>Artifacts</span><strong>{workspace.artifacts.length}</strong></div><div><span>Intakes</span><strong>{workspace.intakes.length}</strong></div><div><span>Speaker labels</span><strong>{workspace.speakers.length}</strong></div>
        <div className="foundation-table-wrap"><table><thead><tr><th>Proceeding</th><th>Status</th><th>Detected</th><th>Parsed</th><th>Committed</th></tr></thead><tbody>{workspace.proceedings.map((item) => <tr key={item.id}><td>{item.title}</td><td>{item.status}</td><td>{item.detected_segments}</td><td>{item.parsed_segments}</td><td>{item.committed_segments}</td></tr>)}</tbody></table></div>
      </div>
    </details>

    <details className="foundation-audit">
      <summary><span><strong>Baseline provenance and limitations</strong><small>Why the supplied T₀ remains provisional.</small></span><span>Open</span></summary>
      <div className="foundation-audit-body foundation-provenance-grid">
        {baseline.provenance_chains.map((chain) => <article key={chain.chain_id}><MonoLabel>{chain.chain_id} · {chain.lineage_classification.replaceAll("_", " ")}</MonoLabel><h3>{chain.description}</h3><p>{chain.lineage.join(" → ")}</p></article>)}
      </div>
    </details>
  </main>;
}
