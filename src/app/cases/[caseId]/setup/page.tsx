import Link from "next/link";
import { notFound } from "next/navigation";
import { MonoLabel } from "@/app/casework-ui";
import { updateCaseDefinitionAction } from "@/app/cases/actions";
import { SourceAnchorLink } from "@/app/cases/[caseId]/_components/source-anchor-link";
import { requireCaseActor } from "@/lib/authority";
import { getFoundationWorkspace } from "@/lib/case-foundation";
import { courtRecordHref } from "@/lib/case-routes";
import { revTranscriptPage } from "@/lib/provider-source";

export const dynamic = "force-dynamic";

function localInputDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function displayDate(value: string | null) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "NOT RECORDED";
}

function formatBytes(value: number) {
  if (value < 1_024) return `${value} B`;
  if (value < 1_048_576) return `${(value / 1_024).toFixed(1)} KB`;
  return `${(value / 1_048_576).toFixed(1)} MB`;
}

export default async function FoundationPage({ params }: { params: Promise<{ caseId: string }> }) {
  const actor = await requireCaseActor();
  const { caseId } = await params;
  const workspace = await getFoundationWorkspace(actor.id, caseId);
  if (!workspace) notFound();
  const { currentCase, readiness } = workspace;
  const updateAction = updateCaseDefinitionAction.bind(null, currentCase.id);

  return <main className="foundation-shell">
    <section className="foundation-hero">
      <div><MonoLabel>FOUNDATION · PHASE 0 · ESTABLISH CASE</MonoLabel><h1>Know what is safe to work.</h1><p>Foundation standardizes the shared case boundary without pretending the unresolved record has already been analyzed.</p></div>
      <aside className={`readiness-verdict status-${readiness.blockers > 0 ? "block" : readiness.warnings > 0 ? "warn" : "pass"}`}><MonoLabel>DETERMINISTIC READINESS</MonoLabel><strong>{readiness.overall}</strong><span>{readiness.blockers} blocking dimension{readiness.blockers === 1 ? "" : "s"} · {readiness.warnings} warning dimension{readiness.warnings === 1 ? "" : "s"}</span>{readiness.canEnterCourtRecord ? <Link href={courtRecordHref(currentCase.id)}>Enter Court Record →</Link> : <span className="disabled-entry">Resolve blocking setup conditions to enter the record.</span>}</aside>
    </section>

    <section className="readiness-grid" aria-label="Case readiness by dimension">{readiness.dimensions.map((item) => <article className={`readiness-card status-${item.status.toLowerCase()}`} key={item.key}><header><MonoLabel>{item.label}</MonoLabel><strong>{item.status}</strong></header><p>{item.summary}</p>{item.issues.length > 1 ? <details><summary>{item.issues.length} findings</summary><ul>{item.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></details> : null}</article>)}</section>

    <section className="foundation-section" id="case-definition">
      <header className="foundation-section-heading"><div><MonoLabel>01 · CASE DEFINITION</MonoLabel><h2>Scope and operating boundary</h2></div><span>UUID {currentCase.id}</span></header>
      <div className="foundation-two-column">
        {currentCase.membershipRole === "owner" ? <form action={updateAction} className="case-definition-form compact">
          <label>Case title<input name="title" required defaultValue={currentCase.title} /></label>
          <label>Internal identifier<input name="workspaceKey" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" defaultValue={currentCase.workspace_key} /></label>
          <label className="wide">Purpose and scope<textarea name="purpose" rows={4} required defaultValue={currentCase.purpose} /></label>
          <label>Evidentiary cutoff<input name="publicRecordCutoff" type="datetime-local" required defaultValue={localInputDate(currentCase.public_record_cutoff)} /></label>
          <label>Provisional T0 / incident time<input name="incidentAt" type="datetime-local" defaultValue={localInputDate(currentCase.incident_at)} /></label>
          <label>Incident-window start<input name="incidentWindowStart" type="datetime-local" defaultValue={localInputDate(currentCase.incident_window_start)} /></label>
          <label>Incident-window end<input name="incidentWindowEnd" type="datetime-local" defaultValue={localInputDate(currentCase.incident_window_end)} /></label>
          <button>Save supported case fields</button>
        </form> : <div className="definition-summary"><p><span>Purpose</span>{currentCase.purpose}</p><p><span>Evidentiary cutoff</span>{displayDate(currentCase.public_record_cutoff)}</p><p><span>Provisional T0</span>{displayDate(currentCase.incident_at)}</p></div>}
        <aside className="case-definition-aside"><div><MonoLabel>MEMBERSHIP</MonoLabel>{workspace.members.map((member) => <p key={member.user_id}><strong>{member.role}</strong><code>{member.user_id}</code></p>)}</div><div><MonoLabel>NOT YET MODELED</MonoLabel><ul>{workspace.deferredFields.map((field) => <li key={field}>{field}</li>)}</ul></div></aside>
      </div>
    </section>

    <section className="foundation-section" id="sources">
      <header className="foundation-section-heading"><div><MonoLabel>02 · SOURCE INVENTORY</MonoLabel><h2>Canonical sources and artifacts</h2></div><span>{workspace.sources.length} sources · {workspace.artifacts.length} artifacts · {workspace.counts.segments.toLocaleString()} segments</span></header>
      {workspace.sources.length === 0 ? <div className="foundation-empty">No source inventory exists. The case remains resumable in Foundation while material is acquired and compiled.</div> : <div className="source-inventory-list">{workspace.sources.map((source) => {
        const artifacts = workspace.artifacts.filter((artifact) => artifact.source_id === source.id);
        return <article key={source.id}><header><div><MonoLabel>{source.source_family.replaceAll("_", " ")} · {source.evidence_lane}</MonoLabel><h3>{source.title}</h3></div><span className={source.possessed_by_us ? "state-chip pass" : "state-chip warn"}>{source.possessed_by_us ? "POSSESSED" : "NOT POSSESSED"}</span></header><div className="source-inventory-meta"><span>{source.completeness ?? "COMPLETENESS UNKNOWN"}</span><span>{source.primary_source === null ? "PRIMARY STATUS UNKNOWN" : source.primary_source ? "PRIMARY SOURCE" : "DERIVED/SECONDARY"}</span><code>{source.id}</code></div>{artifacts.length === 0 ? <p className="foundation-empty compact-empty">No accessible artifact is linked to this source.</p> : <div className="artifact-list">{artifacts.map((artifact) => <div key={artifact.id}><div><strong>{artifact.title}</strong><span>{artifact.media_type} · {formatBytes(artifact.byte_length)} · {artifact.parser_status}</span></div><div><code>SHA-256 {artifact.sha256.slice(0, 20)}…</code>{artifact.canonical_url ? <a href={artifact.canonical_url} target="_blank" rel="noreferrer">Open artifact ↗</a> : null}</div></div>)}</div>}</article>;
      })}</div>}
      {workspace.intakes.length > 0 ? <div className="intake-register"><MonoLabel>INGESTION REGISTER</MonoLabel>{workspace.intakes.map((item) => <div key={item.id}><strong>{item.page_title ?? "Untitled intake"}</strong><span>{item.processing_status} · detected {item.detected_segments} · parsed {item.parsed_segments} · committed {item.committed_segments}</span>{item.error_message ? <small>{item.error_message}</small> : null}</div>)}</div> : null}
    </section>

    <section className="foundation-section" id="proceedings">
      <header className="foundation-section-heading"><div><MonoLabel>03 · PROCEEDINGS + SPEAKERS</MonoLabel><h2>Record order without forced identity</h2></div><span>{workspace.proceedings.length} proceedings · {workspace.speakers.length} speaker labels</span></header>
      {workspace.proceedings.length === 0 ? <div className="foundation-empty">No compiled proceeding structure exists. Existing source segments remain canonical and searchable.</div> : <div className="proceeding-grid">{workspace.proceedings.map((proceeding) => {
        const speakers = workspace.speakers.filter((speaker) => speaker.proceeding_id === proceeding.id);
        const artifact = workspace.artifacts.find((item) => item.id === proceeding.source_artifact_id);
        const publicTranscriptUrl = revTranscriptPage({ proceedingTitle: proceeding.title, canonicalUrl: artifact?.canonical_url, sourceUrl: artifact?.source_url });
        const complete = proceeding.detected_segments === proceeding.parsed_segments && proceeding.parsed_segments === proceeding.committed_segments;
        return <article key={proceeding.id}><header><div><MonoLabel>{proceeding.proceeding_type.replaceAll("_", " ")} · {proceeding.proceeding_date ?? "DATE UNKNOWN"}</MonoLabel><h3>{proceeding.title}</h3>{publicTranscriptUrl ? <a className="proceeding-source-link" href={publicTranscriptUrl} target="_blank" rel="noreferrer">Transcript + video on Rev ↗</a> : artifact?.canonical_url ? <a className="proceeding-source-link" href={artifact.canonical_url} target="_blank" rel="noreferrer">Open source artifact ↗</a> : null}</div><span className={`state-chip ${complete ? "pass" : "block"}`}>{complete ? "COVERAGE ALIGNED" : "COVERAGE MISMATCH"}</span></header><div className="coverage-spec"><span>Detected <b>{proceeding.detected_segments}</b></span><span>Parsed <b>{proceeding.parsed_segments}</b></span><span>Committed <b>{proceeding.committed_segments}</b></span></div><div className="speaker-register">{speakers.slice(0, 8).map((speaker) => <div key={speaker.id}><strong>{speaker.provider_label}</strong><span>{speaker.canonical_name ?? "UNRESOLVED"}{speaker.role ? ` · ${speaker.role}` : ""}</span>{speaker.review_required ? <em>REVIEW REQUIRED</em> : null}</div>)}{speakers.length > 8 ? <p className="speaker-overflow">+ {speakers.length - 8} additional provider labels retained in the case record</p> : null}</div></article>;
      })}</div>}
    </section>

    <section className="foundation-section" id="entities">
      <header className="foundation-section-heading"><div><MonoLabel>04 · ENTITIES + ALIASES</MonoLabel><h2>One identity, original wording retained</h2></div><span>{workspace.entities.length} canonical entities</span></header>
      {workspace.entities.length === 0 ? <div className="foundation-empty">No canonical entities have been established. This is a normalization warning, not a reason to hide the source corpus.</div> : <div className="entity-registry">{workspace.entities.map((entity) => <article key={entity.id}><header><MonoLabel>{entity.kind}</MonoLabel><code>{entity.id}</code></header><h3>{entity.canonical_name}</h3><p>{entity.description || "No neutral identity note recorded."}</p><div>{entity.aliases.length === 0 ? <span>NO ALIASES RECORDED</span> : entity.aliases.map((alias) => <span key={alias.id}>{alias.alias}</span>)}</div></article>)}</div>}
    </section>

    <section className="foundation-section" id="event-skeleton">
      <header className="foundation-section-heading"><div><MonoLabel>05 · PROVISIONAL T0 + EVENT/TEMPORAL SKELETON</MonoLabel><h2>A case spine, not an established timeline</h2></div><span>{workspace.events.length} event records · {workspace.temporalAssertions.length} time assertions</span></header>
      <div className="t0-orientation"><div><MonoLabel>PROVISIONAL INCIDENT ANCHOR</MonoLabel><strong>{displayDate(currentCase.incident_at)}</strong></div><p>T0 is an orientation product of Foundation. It is not yet a durable versioned baseline, and competing temporal assertions remain separate.</p></div>
      {workspace.events.length === 0 ? <div className="foundation-empty">No reviewed events or event candidates exist for this case. The source corpus remains ready for retrieval and later structure mapping.</div> : <div className="event-skeleton-list">{workspace.events.map((event) => <article key={`${event.kind}-${event.id}`}><header><span className={`state-chip ${event.kind === "reviewed" ? "pass" : "warn"}`}>{event.kind.toUpperCase()}</span><MonoLabel>{event.reviewStatus}</MonoLabel></header><h3>{event.title}</h3>{event.eventTimeStart ? <p>{displayDate(event.eventTimeStart)} · {(event.timePrecision ?? "unknown").toUpperCase()}</p> : null}{event.temporalAssertions.map((time) => <div className="temporal-assertion" key={time.id}><strong>{time.raw_temporal_language || "No raw time language"}</strong><span>{time.asserted_start ? displayDate(time.asserted_start) : "NO ABSOLUTE START"} · {time.precision} · {time.review_status}</span>{time.source_segment_ids[0] ? <SourceAnchorLink caseId={currentCase.id} segmentId={time.source_segment_ids[0]} /> : null}</div>)}{event.sourceSegmentIds[0] ? <SourceAnchorLink caseId={currentCase.id} segmentId={event.sourceSegmentIds[0]}>Open supporting testimony →</SourceAnchorLink> : <span className="unlinked-state">No source segment exposed by the current lineage.</span>}</article>)}</div>}
    </section>

    <section className="foundation-section unresolved-section" id="unresolved">
      <header className="foundation-section-heading"><div><MonoLabel>06 · READINESS + UNRESOLVED</MonoLabel><h2>Warnings remain visible after entry</h2></div><span>{workspace.acquisitions.length} acquisition records · {workspace.flags.length} knowledge flags</span></header>
      <div className="unresolved-grid"><div><h3>Acquisition gaps</h3>{workspace.acquisitions.length === 0 ? <p>No acquisition record is open.</p> : workspace.acquisitions.map((item) => <article key={item.id}><span>{item.priority} · {item.acquisition_status}</span><strong>{item.title}</strong><small>{item.possessed_by_us ? "POSSESSED" : "NOT POSSESSED"}</small>{item.discovered_from_segment_id ? <SourceAnchorLink caseId={currentCase.id} segmentId={item.discovered_from_segment_id} /> : null}</article>)}</div><div><h3>Knowledge flags</h3>{workspace.flags.length === 0 ? <p>No knowledge-mapping flag is recorded.</p> : workspace.flags.map((item) => <article key={item.id}><span>{item.flag_type} · {item.status}</span><strong>{item.rationale}</strong>{item.source_segment_ids[0] ? <SourceAnchorLink caseId={currentCase.id} segmentId={item.source_segment_ids[0]} /> : null}</article>)}</div></div>
    </section>
  </main>;
}
