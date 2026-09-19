import Link from "next/link";
import { notFound } from "next/navigation";
import { MonoLabel } from "@/app/casework-ui";
import { SubmitButton } from "@/app/cases/[caseId]/_components/submit-button";
import { buildWitnessAccountTimelines } from "@/lib/account-timeline";
import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase } from "@/lib/case-access";
import { getCaseReconstructionWorkspace } from "@/lib/case-reconstruction";
import { accountsHref, timelineHref } from "@/lib/case-routes";
import {
  getCoreTimelineWorkspace,
  matchesTimelineFilter,
  precisionLabel,
  timelineStateLabel,
  type CoreTimeline,
  type CoreTimelineItem,
  type TimelineFilter,
} from "@/lib/core-timeline";
import {
  addTimelineEventAction,
  addTimelineNoteAction,
  dismissTimelineNoteAction,
  removeTimelineEventAction,
  updateCoreTimelineAction,
  updateTimelineNoteAction,
} from "./actions";

export const dynamic = "force-dynamic";

type SearchState = {
  timeline?: string;
  q?: string;
  filter?: string;
  overlay?: string | string[];
  add?: string;
  edit?: string;
  message?: string;
  error?: string;
};

type OverlaySpec = { key: string; label: string; terms: string[] };
type TimelineContext = {
  heading: string;
  framing: string;
  overlays: OverlaySpec[];
  sections: string[];
  showSections: boolean;
  boundary: string;
};

const timelineContext: Record<string, TimelineContext> = {
  "january-24": {
    heading: "January 24 — Core Event Timeline",
    framing: "The most precise timeline in Casework. Core stays sparse; overlays add source-specific detail without becoming the canonical account.",
    overlays: [
      { key: "patrick", label: "Patrick testimony", terms: ["patrick clancy", "patrick testimony"] },
      { key: "911", label: "911", terms: ["911", "dispatch"] },
      { key: "hall", label: "Hall", terms: ["stephen hall", "hall heard", "hall observed"] },
      { key: "josephine", label: "Josephine", terms: ["brian josephine", "josephine heard", "josephine carried"] },
      { key: "warrant", label: "Warrant account", terms: ["search warrant", "warrant affidavit", "affidavit"] },
    ],
    sections: ["Lead-up", "Emergency response", "Discovery", "EMS activity", "After discovery", "Initial investigation"],
    showSections: false,
    boundary: "Affidavit allegations are not promoted merely because the affidavit repeats them. Event time and source-record time remain separate.",
  },
  "lindsay-health": {
    heading: "Lindsay Clancy — Health & Care Trajectory",
    framing: "What was happening to Lindsay medically and physically over time, without reconstructing it from hundreds of records each time it matters elsewhere.",
    overlays: [
      { key: "medical", label: "Medical records", terms: ["medical record", "hospital record", "mclean hospital", "tufts", "icu record"] },
      { key: "lindsay", label: "Lindsay statements", terms: ["lindsay clancy", "lindsay statement"] },
      { key: "patrick", label: "Patrick account", terms: ["patrick clancy", "patrick account"] },
      { key: "clinician", label: "Clinician testimony", terms: ["clinician", "psychiatrist", "physician", "doctor", "nurse"] },
    ],
    sections: ["Pre-event", "Event day", "Post-event"],
    showSections: true,
    boundary: "Medical condition, reported symptoms, diagnosis, medication exposure and later testimony remain distinct source-specific assertions.",
  },
  "patrick-activity": {
    heading: "Patrick Clancy — Activity Timeline",
    framing: "What Patrick was doing, saying, and searching before, during, and after January 24—without letting any one source become the canonical account.",
    overlays: [
      { key: "digital", label: "Device / digital", terms: ["digital", "device", "phone extraction", "computer forensic"] },
      { key: "testimony", label: "Trial testimony", terms: ["trial day", "trial testimony", "testimony transcript"] },
      { key: "911", label: "911", terms: ["911", "dispatch"] },
      { key: "warrant", label: "Search warrant", terms: ["search warrant", "warrant affidavit", "affidavit"] },
      { key: "new-yorker", label: "New Yorker", terms: ["new yorker"] },
      { key: "public", label: "Public statements", terms: ["gofundme", "public statement"] },
    ],
    sections: ["Lead-up", "January 24", "After"],
    showSections: true,
    boundary: "Core records activity and account changes without treating one later account as the canonical Patrick narrative.",
  },
};

const fallbackContext: TimelineContext = {
  heading: "Core Timeline",
  framing: "A curated projection over shared, source-governed events.",
  overlays: [], sections: [], showSections: true,
  boundary: "Timeline membership is a research projection. Underlying source objects remain governed separately.",
};

function filterValue(value: string | undefined): TimelineFilter {
  return value === "knowns" || value === "needs-placement" ? value : "all";
}

function overlayValues(value: SearchState["overlay"], context: TimelineContext) {
  const requested = Array.isArray(value) ? value : value ? [value] : [];
  const allowed = new Set(context.overlays.map((overlay) => overlay.key));
  return [...new Set(requested.filter((key) => allowed.has(key)))];
}

function itemOverlayKeys(item: CoreTimelineItem, context: TimelineContext) {
  if (item.state !== "working") return [];
  const sourceText = [item.headline, item.category, item.attribution, item.sourceLabel, item.informationBasis]
    .filter(Boolean).join(" ").toLowerCase();
  return context.overlays
    .filter((overlay) => overlay.terms.some((term) => sourceText.includes(term)))
    .map((overlay) => overlay.key);
}

function hintValue(item: CoreTimelineItem | undefined, key: string) {
  const value = item?.temporalHint?.[key];
  return typeof value === "string" ? value : "";
}

function TimelineNoteForm({ caseId, timelineId, slug, item }: { caseId: string; timelineId: string; slug: string; item?: CoreTimelineItem }) {
  const action = item?.noteId
    ? updateTimelineNoteAction.bind(null, caseId, timelineId, slug, item.noteId)
    : addTimelineNoteAction.bind(null, caseId, timelineId, slug);
  const precision = item?.precision ?? "unknown";
  return <form action={action} className="core-timeline-form">
    <label className="wide">What happened?<textarea name="description" rows={2} minLength={2} maxLength={500} required defaultValue={item?.headline ?? ""} placeholder="Neutral, source-ready headline" /></label>
    <label>Precision<select name="precision" defaultValue={precision}><option value="exact">Exact date + time</option><option value="exact_date">Exact date</option><option value="approximate">Approximate</option><option value="interval">Date range</option><option value="relative_only">Before / after / near</option><option value="sequence_only">Sequence only</option><option value="unknown">Unknown</option></select></label>
    <label>Display label<input name="timeLabel" maxLength={120} defaultValue={hintValue(item, "label") || item?.timeLabel || ""} placeholder="~6:11 PM, Jan 1–5, later" /></label>
    <label>Date<input name="date" type="date" defaultValue={hintValue(item, "date") || hintValue(item, "startDate")} /></label>
    <label>Time<input name="time" type="time" step="1" defaultValue={hintValue(item, "time")} /></label>
    <label>End date<input name="endDate" type="date" defaultValue={hintValue(item, "endDate")} /></label>
    <label>Section<input name="section" maxLength={100} defaultValue={item?.section ?? ""} placeholder="Lead-up, Post-event…" /></label>
    <label>Category<input name="category" maxLength={100} defaultValue={item?.category ?? ""} placeholder="Medication, Digital…" /></label>
    <label className="wide">Where might the source be?<input name="sourceHint" maxLength={500} defaultValue={item?.sourceHint ?? ""} placeholder="Warrant packet, medical record, testimony…" /></label>
    <label className="wide">Working note<textarea name="note" rows={3} maxLength={2000} defaultValue={item?.limitation ?? ""} placeholder="Wording, limitation, or source reminder" /></label>
    <SubmitButton pendingLabel={item ? "Saving…" : "Adding…"}>{item ? "Save placement note" : "Add Needs Source note"}</SubmitButton>
  </form>;
}

function TimelineEvent({ item, caseId, timelineId, slug, canContribute, editing, overlayLabels, sharedTimelines }: {
  item: CoreTimelineItem; caseId: string; timelineId: string; slug: string; canContribute: boolean;
  editing: boolean; overlayLabels: string[]; sharedTimelines: CoreTimeline[];
}) {
  const stateLabel = timelineStateLabel(item.state);
  if (editing && item.noteId) return <article className="core-timeline-edit-card" id={`note-${item.noteId}`}>
    <header><MonoLabel>EDIT · NEEDS SOURCE</MonoLabel><Link href={timelineHref(caseId, { timeline: slug })}>Cancel</Link></header>
    <TimelineNoteForm caseId={caseId} timelineId={timelineId} slug={slug} item={item} />
  </article>;

  const isOverlay = overlayLabels.length > 0;
  return <article className={`timeline-event state-${item.state}${isOverlay ? " is-overlay" : ""}`}>
    <time className="timeline-event-time">{item.timeLabel}</time>
    <div className="timeline-event-spine" aria-hidden="true"><i /></div>
    <div className="timeline-event-body">
      <div className="timeline-event-tags">
        {overlayLabels.map((label) => <span className="timeline-overlay-tag" key={label}>{label}</span>)}
        {item.category ? <span className="timeline-lane-tag">{item.category}</span> : null}
        <span className="timeline-state-label">{stateLabel}</span>
      </div>
      <h3>{item.headline}</h3>
      {sharedTimelines.length ? <p className="timeline-shared-note">Also on: {sharedTimelines.map((timeline, index) => <span key={timeline.id}>{index ? ", " : ""}<Link href={timelineHref(caseId, { timeline: timeline.slug })}>{timeline.title}</Link></span>)}</p> : null}
      <div className="timeline-event-controls">
        {item.sourceHref ? <Link href={item.sourceHref}>Open source</Link> : <span>Source needed</span>}
        <details className="timeline-evidence-details"><summary>Evidence details</summary><div>
          {item.sourceWording ? <blockquote>{item.sourceWording}</blockquote> : <div className="core-timeline-source-needed"><strong>Source not yet linked</strong><p>{item.sourceHint || "No source hint recorded."}</p></div>}
          <dl>
            <div><dt>State</dt><dd>{stateLabel}</dd></div><div><dt>Time precision</dt><dd>{precisionLabel(item.precision)}</dd></div><div><dt>Section</dt><dd>{item.section || "Unassigned"}</dd></div>
            {item.attribution ? <div><dt>Attribution</dt><dd>{item.attribution}</dd></div> : null}
            {item.informationBasis ? <div><dt>Information basis</dt><dd>{item.informationBasis.replaceAll("_", " ")}</dd></div> : null}
            {item.objectCode ? <div><dt>Object</dt><dd><code>{item.objectCode}</code></dd></div> : null}
          </dl>
          {item.limitation ? <p className="core-timeline-limitation"><strong>Limitation / note</strong>{item.limitation}</p> : null}
          <footer>{item.sourceLabel ? <span>{item.sourceLabel}</span> : null}{item.structureHref ? <Link href={item.structureHref}>Review event →</Link> : null}</footer>
        </div></details>
        {canContribute && item.noteId ? <Link href={timelineHref(caseId, { timeline: slug, editNoteId: item.noteId })}>Edit</Link> : null}
        {canContribute && (item.noteId || item.membershipId) ? <details className="timeline-delete-control"><summary>Delete</summary><div>
          <p>{item.noteId ? "Dismiss this placement note? It remains recoverable in the database." : "Remove this item from the Core projection? The shared event and its source are not deleted."}</p>
          {item.noteId ? <form action={dismissTimelineNoteAction.bind(null, caseId, timelineId, slug, item.noteId)}><button>Confirm dismiss</button></form> : null}
          {item.membershipId ? <form action={removeTimelineEventAction.bind(null, caseId, timelineId, slug, item.membershipId)}><button>Confirm removal</button></form> : null}
        </div></details> : null}
      </div>
    </div>
  </article>;
}

function TimelineStream({ items, selected, context, activeOverlays, sharedByItem, caseId, canContribute, editingId }: {
  items: CoreTimelineItem[]; selected: CoreTimeline; context: TimelineContext; activeOverlays: Set<string>;
  sharedByItem: Map<string, CoreTimeline[]>; caseId: string; canContribute: boolean; editingId?: string;
}) {
  const renderEvent = (item: CoreTimelineItem) => {
    const labels = itemOverlayKeys(item, context).filter((key) => activeOverlays.has(key))
      .flatMap((key) => context.overlays.find((overlay) => overlay.key === key)?.label ?? []);
    return <TimelineEvent key={item.id} item={item} caseId={caseId} timelineId={selected.id} slug={selected.slug} canContribute={canContribute} editing={editingId === item.noteId} overlayLabels={labels} sharedTimelines={sharedByItem.get(item.id) ?? []} />;
  };

  if (!context.showSections) return <div className="timeline-spine-list">{items.map(renderEvent)}</div>;
  const sectionOrder = [...context.sections, ...items.map((item) => item.section || "Unassigned")];
  const sections = [...new Set(sectionOrder)].filter((section) => items.some((item) => (item.section || "Unassigned").toLowerCase() === section.toLowerCase()));
  return <>{sections.map((section) => {
    const sectionItems = items.filter((item) => (item.section || "Unassigned").toLowerCase() === section.toLowerCase());
    const sectionId = `section-${section.replaceAll(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
    return <section className="timeline-section" key={section} aria-labelledby={sectionId}><h2 id={sectionId}>{section}</h2><div className="timeline-spine-list">{sectionItems.map(renderEvent)}</div></section>;
  })}</>;
}

export default async function CoreTimelinePage({ params, searchParams }: { params: Promise<{ caseId: string }>; searchParams: Promise<SearchState> }) {
  const [actor, { caseId }, query] = await Promise.all([requireCaseActor(), params, searchParams]);
  const [currentCase, workspace, reconstruction] = await Promise.all([
    getAccessibleCase(actor.id, caseId), getCoreTimelineWorkspace(caseId), getCaseReconstructionWorkspace(actor.id, caseId),
  ]);
  if (!currentCase) notFound();

  const canContribute = currentCase.membershipRole !== "viewer";
  const selected = workspace.timelines.find((timeline) => timeline.slug === query.timeline) ?? workspace.timelines[0] ?? null;
  if (!selected) return <main className="case-route-state"><strong>No Core Timelines exist for this case.</strong><p>The timeline projection tables are ready, but this case has not been given a timeline definition.</p></main>;

  const context = timelineContext[selected.slug] ?? fallbackContext;
  const selectedOverlayKeys = overlayValues(query.overlay, context);
  const activeOverlays = new Set(selectedOverlayKeys);
  const allItems = workspace.itemsByTimeline.get(selected.id) ?? [];
  const overlayKeysByItem = new Map(allItems.map((item) => [item.id, itemOverlayKeys(item, context)]));
  const displayItems = allItems.filter((item) => {
    const keys = overlayKeysByItem.get(item.id) ?? [];
    return keys.length === 0 || keys.some((key) => activeOverlays.has(key));
  });
  const filter = filterValue(query.filter);
  const visibleItems = displayItems.filter((item) => matchesTimelineFilter(item, filter, query.q ?? ""));
  const placedItems = visibleItems.filter((item) => item.precision !== "unknown");
  const unplacedItems = visibleItems.filter((item) => item.precision === "unknown");
  const selectedRefs = new Set(allItems.map((item) => item.id));
  const availableEvents = workspace.availableEvents.filter((event) => !selectedRefs.has(event.ref));
  const showAdd = canContribute && query.add === "1";

  const sharedByItem = new Map<string, CoreTimeline[]>();
  for (const timeline of workspace.timelines) {
    if (timeline.id === selected.id) continue;
    for (const item of workspace.itemsByTimeline.get(timeline.id) ?? []) {
      if (item.noteId) continue;
      sharedByItem.set(item.id, [...(sharedByItem.get(item.id) ?? []), timeline]);
    }
  }

  const latestVersion = reconstruction?.versions[0] ?? null;
  const accounts = latestVersion ? buildWitnessAccountTimelines(latestVersion.snapshot) : [];
  const overlayCounts = new Map(context.overlays.map((overlay) => [overlay.key, allItems.filter((item) => (overlayKeysByItem.get(item.id) ?? []).includes(overlay.key)).length]));
  const coreCount = allItems.filter((item) => (overlayKeysByItem.get(item.id) ?? []).length === 0).length;
  const activeOverlayLabels = context.overlays.filter((overlay) => activeOverlays.has(overlay.key)).map((overlay) => overlay.label);

  return <main className="core-timeline-shell"><div className="core-timeline-panels">
    <aside className="core-timeline-nav" aria-label="Timeline navigation">
      <MonoLabel>CORE</MonoLabel>
      <nav>{workspace.timelines.map((timeline) => <Link key={timeline.id} href={timelineHref(caseId, { timeline: timeline.slug })} aria-current={timeline.id === selected.id ? "page" : undefined} scroll={false}><strong>{timeline.title}</strong><small>{timeline.subtitle}</small></Link>)}</nav>
      <MonoLabel>ACCOUNT TIMELINES</MonoLabel>
      <nav className="core-account-nav">{accounts.length ? accounts.map((account) => <Link href={accountsHref(caseId, { account: account.key, versionId: latestVersion?.id })} key={account.key}><strong>{account.witness}</strong><small>{account.items.length} sourced step{account.items.length === 1 ? "" : "s"}</small></Link>) : <Link href={accountsHref(caseId)}><strong>Open Accounts</strong><small>No published account timeline yet</small></Link>}</nav>
    </aside>

    <section className="core-timeline-main-column">
      <header className="core-timeline-title-row"><div><h1>{context === fallbackContext ? selected.title : context.heading}</h1><p>{context.framing}</p></div><div className="core-timeline-title-actions">
        {canContribute ? <Link href={timelineHref(caseId, { timeline: selected.slug, overlays: selectedOverlayKeys, add: true })}>+ Add event</Link> : null}
        <a href="#timeline-overlays">+ Overlay</a>
        {canContribute ? <details className="core-timeline-edit-menu"><summary>••• Edit timeline</summary><form action={updateCoreTimelineAction.bind(null, caseId, selected.id, selected.slug)} className="core-timeline-form"><label>Title<input name="title" required maxLength={120} defaultValue={selected.title} /></label><label>Subtitle<input name="subtitle" maxLength={240} defaultValue={selected.subtitle} /></label><label>Description<textarea name="description" rows={4} maxLength={1200} defaultValue={selected.description} /></label><SubmitButton pendingLabel="Saving…">Save timeline</SubmitButton></form></details> : null}
      </div></header>

      {(query.message || query.error) ? <p className={`core-timeline-notice ${query.error ? "error" : "success"}`} role={query.error ? "alert" : "status"}>{query.error ?? query.message}</p> : null}

      <div className="core-timeline-overlay-row" id="timeline-overlays" aria-label="Timeline overlays">
        <span className="core-overlay-core">Core <small>{coreCount}</small></span>
        {context.overlays.map((overlay) => {
          const active = activeOverlays.has(overlay.key);
          const remaining = selectedOverlayKeys.filter((key) => key !== overlay.key);
          return <form method="get" key={overlay.key}><input type="hidden" name="timeline" value={selected.slug} />{query.q ? <input type="hidden" name="q" value={query.q} /> : null}{filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}{remaining.map((key) => <input type="hidden" name="overlay" value={key} key={key} />)}<button name={active ? undefined : "overlay"} value={active ? undefined : overlay.key} aria-pressed={active} title={`${active ? "Hide" : "Show"} ${overlay.label} overlay`}><span aria-hidden="true">{active ? "×" : "+"}</span> {overlay.label}<small>{overlayCounts.get(overlay.key) ?? 0}</small></button></form>;
        })}
      </div>

      <div className="core-timeline-status-line" aria-live="polite"><span>{visibleItems.length} visible item{visibleItems.length === 1 ? "" : "s"}</span><span>{activeOverlayLabels.length ? `Showing ${activeOverlayLabels.join(" + ")}` : "Core only"}</span></div>

      <details className="core-timeline-utilities" open={Boolean(query.q || filter !== "all") || undefined}><summary>Search &amp; filters</summary><form method="get"><input type="hidden" name="timeline" value={selected.slug} />{selectedOverlayKeys.map((key) => <input type="hidden" name="overlay" value={key} key={key} />)}<label><span>Search this timeline</span><input name="q" defaultValue={query.q ?? ""} placeholder="medication, CVS, dispatch…" /></label><fieldset><legend>Filter</legend>{(["all", "knowns", "needs-placement"] as const).map((value) => <label key={value}><input type="radio" name="filter" value={value} defaultChecked={filter === value} />{value === "needs-placement" ? "Needs placement" : value[0]!.toUpperCase() + value.slice(1)}</label>)}</fieldset><button>Apply</button></form></details>

      {showAdd ? <section className="core-timeline-add-panel"><header><div><MonoLabel>ADD TO {selected.title.toUpperCase()}</MonoLabel><h2>Link what exists—or mark what you need.</h2></div><Link href={timelineHref(caseId, { timeline: selected.slug, overlays: selectedOverlayKeys })}>Close</Link></header><div>
        <section><h3>Existing source-linked event</h3><p>A reviewed event becomes a Known Anchor. An event candidate remains a Working Event.</p>{availableEvents.length ? <form action={addTimelineEventAction.bind(null, caseId, selected.id, selected.slug)} className="core-timeline-form"><label className="wide">Event<select name="eventRef" required defaultValue=""><option value="" disabled>Choose an existing event</option>{availableEvents.map((event) => <option key={event.ref} value={event.ref}>{event.state === "known" ? "KNOWN" : "WORKING"} · {event.timeLabel} · {event.title}</option>)}</select></label><label>Section<input name="section" list="timeline-sections" placeholder="Lead-up" /></label><label>Category<input name="category" placeholder="Digital, Medication…" /></label><datalist id="timeline-sections">{context.sections.map((section) => <option value={section} key={section} />)}</datalist><SubmitButton pendingLabel="Adding…">Add source-linked event</SubmitButton></form> : <p className="core-timeline-empty-copy">Every available source-linked event is already in this projection.</p>}</section>
        <section><h3>I need to locate the source</h3><p>This remains a private placement note. It is not evidence and cannot become a Known Anchor without a Source Segment.</p><TimelineNoteForm caseId={caseId} timelineId={selected.id} slug={selected.slug} /></section>
      </div></section> : null}

      {placedItems.length ? <TimelineStream items={placedItems} selected={selected} context={context} activeOverlays={activeOverlays} sharedByItem={sharedByItem} caseId={caseId} canContribute={canContribute} editingId={query.edit} /> : <div className="core-timeline-empty"><strong>No placed events match this view.</strong><p>Change the filter, switch on an overlay, or add a source-linked event.</p></div>}
      {unplacedItems.length ? <section className="timeline-section timeline-unplaced-section" aria-labelledby="unplaced-heading"><h2 id="unplaced-heading">Unplaced / unknown time</h2><TimelineStream items={unplacedItems} selected={selected} context={{ ...context, showSections: false }} activeOverlays={activeOverlays} sharedByItem={sharedByItem} caseId={caseId} canContribute={canContribute} editingId={query.edit} /></section> : null}

      <details className="core-timeline-boundary"><summary>Projection boundary</summary><p>{context.boundary}</p><p>Overlay entries remain attributed working material. Activating an overlay changes this view only; it does not promote an assertion or duplicate an event.</p></details>
    </section>
  </div></main>;
}
