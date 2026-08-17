import { addProvenanceAction, createContradictionAction, createEntityAction, disposeContradictionAction, ingestClaimAction, linkClaimsAction, reviewClaimAction, saveResearchViewAction } from "./actions";
import { getWorkspace } from "@/lib/casework-supabase";
import { requireCaseActor } from "@/lib/authority";
import { signOut } from "./login/actions";
import { windowsForEvent } from "@/lib/timeline";
import { formatSourceLocator } from "@/lib/source-locator";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const actor = await requireCaseActor();
  const workspace = await getWorkspace(actor);
  const { view: selectedViewId } = await searchParams;
  const selectedView = workspace.savedViews.find((view) => view.id === selectedViewId);
  const pending = workspace.claims.filter((claim) => claim.status === "candidate");
  const timeline = workspace.claims.filter((claim) => claim.event_title);
  const windowed = {
    ninety_days: timeline.filter((item) => windowsForEvent(item.event_time_start, workspace.incidentAt, workspace.incidentWindowStart, workspace.incidentWindowEnd).includes("ninety_days")),
    thirty_days: timeline.filter((item) => windowsForEvent(item.event_time_start, workspace.incidentAt, workspace.incidentWindowStart, workspace.incidentWindowEnd).includes("thirty_days")),
    incident_window: timeline.filter((item) => windowsForEvent(item.event_time_start, workspace.incidentAt, workspace.incidentWindowStart, workspace.incidentWindowEnd).includes("incident_window")),
  };
  const visibleWindows = selectedView && selectedView.research_window !== "all"
    ? [selectedView.research_window as keyof typeof windowed]
    : (["ninety_days", "thirty_days", "incident_window"] as const);
  const visibleContradictions = selectedView?.include_unresolved === false
    ? workspace.contradictions.filter((item) => item.status !== "unresolved")
    : workspace.contradictions;

  return (
    <main>
      <header className="masthead">
        <div className="brand">ICARUS <span>CASEWORK</span></div>
        <nav><a href="#sources">Sources</a><a href="#timeline">Timeline</a><a href="#entities">Entities</a><a href="#analysis">Analysis</a></nav>
        <div className="account"><span>{actor.email}</span><form action={signOut}><button>Sign out</button></form></div>
      </header>

      <section className="hero">
        <p className="eyebrow">Source-linked proof case · private local workspace</p>
        <h1>Build the record.<br /><em>Preserve the uncertainty.</em></h1>
        <p className="lede">One evidence substrate, with attributed claims and reviewed events kept visibly distinct.</p>
        <div className="metrics"><div><strong>{workspace.artifacts.length}</strong><span>Artifacts preserved</span></div><div><strong>{pending.length}</strong><span>Claims awaiting review</span></div><div><strong>{timeline.length}</strong><span>Reviewed events</span></div><div><strong>{workspace.contradictions.length}</strong><span>Open tensions</span></div></div>
      </section>

      <section className="workflow" id="sources">
        <div className="section-title"><span>01</span><div><p>INGESTION</p><h2>Preserve a source and extract one claim</h2></div></div>
        <form action={ingestClaimAction} className="evidence-form">
          <label>Artifact title<input required name="title" placeholder="Public hearing transcript — excerpt" /></label>
          <label>Acquired from<input required name="acquiredFrom" placeholder="Public court archive, URL, or creator collection" /></label>
          <label>Source format<select name="mediaType" defaultValue="text/plain"><option value="text/plain">Plain text</option><option value="application/pdf">PDF</option><option value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">Word document</option><option value="text/vtt">Transcript / captions</option><option value="image/jpeg">JPEG image</option><option value="image/png">PNG image</option><option value="text/csv">Spreadsheet / CSV</option><option value="audio/mpeg">Audio</option><option value="video/mp4">Video</option></select></label>
          <label>Citation coordinate<select name="locatorType" defaultValue="character_offset"><option value="character_offset">Extracted-text characters</option><option value="page">Page</option><option value="timestamp">Timestamp</option><option value="spreadsheet_range">Spreadsheet range</option><option value="image_region">Image region</option></select></label>
          <fieldset className="locator-fields wide"><legend>Format-specific locator (complete the fields matching the coordinate above)</legend><label>Page<input type="number" min="1" name="page" /></label><label>Start timestamp<input name="timestampStart" placeholder="00:12:34" /></label><label>End timestamp<input name="timestampEnd" placeholder="00:12:51" /></label><label>Sheet<input name="sheet" placeholder="Calls" /></label><label>Cell range<input name="range" placeholder="A14:F19" /></label><label>Image region<input name="imageRegion" placeholder="upper-right evidence label" /></label></fieldset>
          <label className="wide">Original source text<textarea required name="sourceText" rows={6} placeholder="Paste public or authorized source text. The original is preserved by checksum." /></label>
          <label>Attributed speaker<input required name="claimant" placeholder="Witness name or source role" /></label>
          <label>Claimed event time<input type="datetime-local" name="claimedEventTime" /></label>
          <label className="wide">Normalized assertion<textarea required name="assertion" rows={3} placeholder="What does the source claim? This remains an attributed claim until reviewed." /></label>
          <label className="wide">Exact supporting quote<textarea required name="exactQuote" rows={3} placeholder="Must appear verbatim in the original source text." /></label>
          <label className="authorization"><input required type="checkbox" name="authorized" /> I confirm this source is public or authorized research material.</label>
          <button>Preserve artifact + create claim</button>
        </form>
      </section>

      <section className="review-section">
        <div className="section-title"><span>02</span><div><p>HUMAN REVIEW</p><h2>Claims do not become events by default</h2></div></div>
        {pending.length === 0 ? <div className="empty">No claims await review. Ingest a source above to begin the traceable chain.</div> : pending.map((claim) => (
          <article className="claim-card" key={claim.id}>
            <div className="status candidate">ATTRIBUTED CLAIM</div>
            <h3>{claim.assertion}</h3>
            <p className="speaker">Claimant: {claim.claimant}</p>
            <blockquote>“{claim.exact_text}”</blockquote>
            <p className="citation">{claim.artifact_title} · {formatSourceLocator(claim.locator)}</p>
            <form action={reviewClaimAction} className="review-form">
              <input type="hidden" name="claimId" value={claim.id} />
              <label>Reviewed event title<input required name="eventTitle" placeholder="Describe the supported occurrence without overclaiming" /></label>
              <label>Time precision<select name="precision" defaultValue="unknown"><option value="exact">Exact</option><option value="approximate">Approximate</option><option value="interval">Interval</option><option value="relative">Relative</option><option value="unknown">Unknown</option></select></label>
              <label>Interval end<input type="datetime-local" name="eventTimeEnd" /></label>
              <label>Uncertainty note<input name="uncertaintyNote" placeholder="What remains imprecise or contested?" /></label>
              <label className="wide">Review rationale<textarea required name="rationale" rows={2} placeholder="Why does the evidence support promotion to a reviewed observable event?" /></label>
              <button>Accept claim + promote distinct event</button>
            </form>
          </article>
        ))}
      </section>

      <section className="timeline-section" id="timeline">
        <div className="section-title"><span>03</span><div><p>SOURCE-LINKED TIMELINE</p><h2>Reviewed events retain their origin</h2></div></div>
        {selectedView && <div className="active-view">Active view: <strong>{selectedView.name}</strong> · {selectedView.include_unresolved ? "unresolved tensions shown" : "resolved tensions only"} <Link href="/">Clear view</Link></div>}
        {timeline.length === 0 ? <div className="empty">The timeline stays empty until a human review decision admits an event.</div> : <div className={`lane-grid lanes-${visibleWindows.length}`}>{visibleWindows.map((window) => <div className="lane" key={window}><header><span>{window.replaceAll("_", " ")}</span><strong>{windowed[window].length}</strong></header>{windowed[window].length === 0 ? <p className="muted">No reviewed events in this bounded window.</p> : windowed[window].map((item) => <article key={`${window}-${item.id}`}><time>{item.event_time_start ? new Date(item.event_time_start).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) : "Time unknown"}</time><span className="precision">{item.time_precision}</span><h3>{item.event_title}</h3>{item.event_time_end && <p>Through {new Date(item.event_time_end).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p>}{item.uncertainty_note && <p className="uncertainty">Uncertainty: {item.uncertainty_note}</p>}<small>{item.artifact_title} · exact source retained</small></article>)}</div>)}</div>}
        <div className="saved-views"><form action={saveResearchViewAction} className="inline-form view-form"><h3>Save a reconstruction view</h3><input name="name" required aria-label="View name" placeholder="Final 30 days — unresolved included" /><select name="researchWindow" aria-label="Research window"><option value="all">All events</option><option value="ninety_days">90 days</option><option value="thirty_days">30 days</option><option value="incident_window">Incident window</option></select><label className="authorization"><input type="checkbox" name="includeUnresolved" defaultChecked /> Include unresolved items</label><button>Save view</button></form>{workspace.savedViews.length > 0 && <div className="view-chips">{workspace.savedViews.map((view) => <Link className={view.id === selectedViewId ? "active" : ""} href={`/?view=${view.id}#timeline`} key={view.id}>{view.name}<small>{view.research_window.replaceAll("_", " ")} · {view.include_unresolved ? "unresolved shown" : "resolved only"}</small></Link>)}</div>}</div>
      </section>

      <section className="graph-section" id="entities">
        <div className="section-title"><span>04</span><div><p>IDENTITY + PROVENANCE</p><h2>Name the actors without erasing the record</h2></div></div>
        <div className="split-grid">
          <form action={createEntityAction} className="compact-form">
            <h3>Create a durable entity</h3>
            <label>Canonical name<input name="canonicalName" required placeholder="Person, institution, device, or place" /></label>
            <label>Kind<select name="kind"><option value="person">Person</option><option value="organization">Organization</option><option value="location">Location</option><option value="device">Device</option><option value="proceeding">Legal proceeding</option><option value="system_node">System node</option></select></label>
            <label>Source-specific aliases<input name="aliases" placeholder="Comma-separated; original wording is retained" /></label>
            <label>Description<textarea name="description" rows={3} placeholder="A neutral identity note, not a credibility judgment" /></label>
            <button>Create entity</button>
          </form>
          <div className="record-list">
            <h3>Resolved identities</h3>
            {workspace.entities.length === 0 ? <p className="muted">No durable entities yet.</p> : workspace.entities.map((entity) => <article key={entity.id}><span className="record-kind">{entity.kind.replace("_", " ")}</span><strong>{entity.canonical_name}</strong>{entity.aliases.length > 0 && <p>Also recorded as: {entity.aliases.join(", ")}</p>}<small>{entity.description}</small></article>)}
          </div>
        </div>
        {workspace.artifacts.length > 0 && workspace.entities.length > 0 && <form action={addProvenanceAction} className="inline-form">
          <h3>Attach a provenance role</h3>
          <select name="artifactId" aria-label="Provenance artifact">{workspace.artifacts.map((artifact) => <option key={artifact.id} value={artifact.id}>{artifact.title}</option>)}</select>
          <select name="entityId" aria-label="Provenance entity">{workspace.entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.canonical_name}</option>)}</select>
          <select name="role" aria-label="Provenance role"><option value="originator">Originator</option><option value="publisher">Publisher</option><option value="custodian">Custodian</option><option value="submitter">Submitter</option></select>
          <input name="note" aria-label="Provenance note" placeholder="Optional qualification" />
          <button>Add role</button>
        </form>}
        {workspace.provenance.length > 0 && <div className="provenance-grid">{workspace.provenance.map((item, index) => <div key={`${item.artifact_title}-${item.role}-${index}`}><span>{item.role}</span><strong>{item.canonical_name}</strong><p>{item.artifact_title}</p></div>)}</div>}
      </section>

      <section className="analysis-section" id="analysis">
        <div className="section-title"><span>05</span><div><p>NARRATIVE GENEALOGY</p><h2>Repetition is not corroboration</h2></div></div>
        {workspace.claims.length < 2 ? <div className="empty">Add a second claim to trace repetition, derivation, or contradiction.</div> : <div className="split-grid">
          <form action={linkClaimsAction} className="compact-form">
            <h3>Trace claim lineage</h3>
            <label>Origin / parent claim<select name="parentClaimId">{workspace.claims.map((claim) => <option key={claim.id} value={claim.id}>{claim.assertion}</option>)}</select></label>
            <label>Downstream claim<select name="childClaimId">{workspace.claims.map((claim) => <option key={claim.id} value={claim.id}>{claim.assertion}</option>)}</select></label>
            <label>Relationship<select name="kind"><option value="repeats">Repeats</option><option value="quotes">Quotes</option><option value="paraphrases">Paraphrases</option><option value="derives_from">Derives from</option><option value="origin">Independent origin</option></select></label>
            <label>Reasoning<textarea required name="rationale" rows={3} placeholder="What in the record establishes this lineage?" /></label>
            <button>Record lineage</button>
          </form>
          <form action={createContradictionAction} className="compact-form danger-form">
            <h3>Open an evidentiary tension</h3>
            <label>Title<input required name="title" placeholder="Accounts conflict on timing" /></label>
            <label>First claim<select name="firstClaimId">{workspace.claims.map((claim) => <option key={claim.id} value={claim.id}>{claim.assertion}</option>)}</select></label>
            <label>Second claim<select name="secondClaimId">{workspace.claims.map((claim) => <option key={claim.id} value={claim.id}>{claim.assertion}</option>)}</select></label>
            <label>Description<textarea required name="description" rows={3} placeholder="Describe the incompatibility without forcing resolution." /></label>
            <button>Keep contradiction unresolved</button>
          </form>
        </div>}
        <div className="analysis-results">
          <div><h3>Lineage map</h3>{workspace.lineage.length === 0 ? <p className="muted">No source dependency recorded.</p> : workspace.lineage.map((edge, index) => <article key={index}><span>{edge.kind.replace("_", " ")}</span><p>{edge.parent_assertion}</p><b>↓</b><p>{edge.child_assertion}</p><small>{edge.rationale}</small></article>)}</div>
          <div><h3>Contradiction register</h3>{visibleContradictions.length === 0 ? <p className="muted">No contradictions match the active view.</p> : visibleContradictions.map((item) => <article className="contradiction" key={item.id}><span>{item.status}</span><strong>{item.title}</strong><p>{item.description}</p><small>{item.claim_count} linked claims{item.status === "unresolved" ? " · closure prohibited without disposition evidence" : ` · ${item.disposition_rationale}`}</small>{item.status === "unresolved" && <form action={disposeContradictionAction} className="disposition-form"><input type="hidden" name="contradictionId" value={item.id} /><select name="disposition" aria-label={`Disposition for ${item.title}`}><option value="resolved_by_evidence">Resolved by evidence</option><option value="clarified">Clarified</option><option value="superseded">Superseded</option><option value="cancelled">Cancelled</option></select><select name="evidenceClaimId" aria-label={`Disposition evidence for ${item.title}`}><option value="">No evidence claim (cancellation only)</option>{workspace.claims.map((claim) => <option key={claim.id} value={claim.id}>{claim.assertion}</option>)}</select><textarea name="rationale" required rows={2} aria-label={`Disposition rationale for ${item.title}`} placeholder="State the terminal condition and observable evidence." /><button>Record terminal disposition</button></form>}</article>)}</div>
        </div>
      </section>

      <section className="audit-section">
        <div className="section-title"><span>06</span><div><p>AUTHORITY LOG</p><h2>Consequential changes leave a trail</h2></div></div>
        <div className="audit-list">{workspace.audit.map((event, index) => <div key={index}><time>{new Date(event.occurred_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</time><strong>{event.action.replaceAll(".", " · ")}</strong><span>{event.subject_type}</span></div>)}</div>
      </section>

      <footer><span>Icarus Casework V1</span><p>Research support, not a verdict, diagnosis, or credibility engine.</p></footer>
    </main>
  );
}
