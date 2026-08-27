import Link from "next/link";
import { notFound } from "next/navigation";
import { MonoLabel } from "@/app/casework-ui";
import { DayIntelligenceView } from "@/app/cases/[caseId]/trial-index/_components/day-intelligence-view";
import { TrialIndexForm } from "@/app/cases/[caseId]/trial-index/_components/trial-index-form";
import { requireCaseActor } from "@/lib/authority";
import { courtRecordHref, trialIndexHref } from "@/lib/case-routes";
import { getDayIntelligenceBundle } from "@/lib/day-intelligence";
import { getTrialIndexWorkspace } from "@/lib/trial-index";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ day?: string; q?: string; notice?: string; view?: string }>;

function displayDate(value: string | null) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)) : "DATE NOT RECORDED";
}

export default async function TrialIndexPage({ params, searchParams }: { params: Promise<{ caseId: string }>; searchParams: SearchParams }) {
  const actor = await requireCaseActor();
  const [{ caseId }, state] = await Promise.all([params, searchParams]);
  const dayNumber = /^\d+$/.test(state.day ?? "") ? Number(state.day) : undefined;
  const query = state.q?.trim().slice(0, 300) ?? "";
  const view = state.view === "intelligence" ? "intelligence" : "navigation";
  const workspace = await getTrialIndexWorkspace(actor.id, caseId, { query, dayNumber });
  if (!workspace) notFound();
  const selected = workspace.selected;
  const dayIntelligence = selected ? await getDayIntelligenceBundle(caseId, selected.day_number) : null;
  const selectedVersions = selected ? workspace.versions.filter((item) => item.trial_index_day_id === selected.id) : [];
  const hasDateConflict = Boolean(selected?.court_date && selected.proceeding_date && selected.court_date !== selected.proceeding_date);
  const nextDayNumber = Math.max(0, ...workspace.days.map((day) => day.day_number)) + 1;

  return <main className="trial-index-shell">
    <section className="trial-index-heading"><div><MonoLabel>FOUNDATION · TRIAL NAVIGATION INDEX</MonoLabel><h1>Know which day<br />to open.</h1><p>Trial day/date → witness → general topic. This index locates the canonical record; it is never evidence, reconstruction input, or a substitute for testimony.</p></div><dl><div><dt>Indexed days</dt><dd>{workspace.counts.days}</dd></div><div><dt>Canonical links</dt><dd>{workspace.counts.canonicalLinked}</dd></div><div><dt>Witness entries</dt><dd>{workspace.counts.witnesses}</dd></div><div><dt>Topic entries</dt><dd>{workspace.counts.topics}</dd></div></dl></section>
    <div className="trial-index-boundary"><strong>NAVIGATION-ONLY BOUNDARY</strong><span>Reporting summaries and planned entries tell you where to look. Only linked Court Record material supplies canonical testimony.</span></div>
    {state.notice === "saved" ? <div className="record-notice" role="status"><strong>Trial Index saved.</strong><span>The day and its immutable revision are now available to case members.</span></div> : null}
    <form className="trial-index-search" method="get">{view === "intelligence" ? <input type="hidden" name="view" value="intelligence" /> : null}<label><span>Find a witness, topic, or day summary</span><input name="q" defaultValue={query} maxLength={300} placeholder="Apple Watch, 911 call, Stratton, defense begins…" /></label><button>Search index</button></form>
    <div className={`trial-index-workspace ${view === "intelligence" ? "day-intelligence-mode" : ""}`}>
      <aside className="trial-index-days"><header><MonoLabel>TRIAL CALENDAR</MonoLabel><strong>{workspace.visibleDays.length}</strong></header>{workspace.visibleDays.length === 0 ? <p>No indexed day matches this lookup.</p> : workspace.visibleDays.map((day) => <Link className={selected?.id === day.id ? "selected" : ""} href={trialIndexHref(caseId, { dayNumber: day.day_number, query, view })} key={day.id}><span>DAY {day.day_number}</span><strong>{day.headline}</strong><small>{displayDate(day.court_date)} · {day.trial_phase.replaceAll("_", " ")}</small><em>{day.proceeding_id ? "CANONICAL PROCEEDING" : day.basis.replaceAll("_", " ")}</em></Link>)}</aside>
      <section className="trial-index-detail">{selected ? <>
        <header><div><MonoLabel>DAY {selected.day_number} · {selected.session_status.replaceAll("_", " ")} · VERSION {selected.current_version}</MonoLabel><h2>{selected.headline}</h2><p>{displayDate(selected.court_date)} · {selected.trial_phase.replaceAll("_", " ")}</p></div><span className={`state-chip ${selected.proceeding_id ? "pass" : "warn"}`}>{selected.proceeding_id ? "CANONICAL LINK" : "INDEX ONLY"}</span></header>
        <nav className="trial-day-view-tabs" aria-label={`Day ${selected.day_number} views`}><Link className={view === "navigation" ? "active" : ""} href={trialIndexHref(caseId, { dayNumber: selected.day_number, query })}>Navigation index</Link><Link className={view === "intelligence" ? "active" : ""} href={trialIndexHref(caseId, { dayNumber: selected.day_number, query, view: "intelligence" })}>Day Intelligence{dayIntelligence ? ` · v${dayIntelligence.card.version}` : ""}</Link></nav>
        {view === "intelligence" ? <DayIntelligenceView bundle={dayIntelligence} dayNumber={selected.day_number} caseId={caseId} /> : <>
        <p className="trial-index-summary">{selected.summary || "No day-level navigation summary has been recorded."}</p>
        {selected.proceeding_id ? <><div className="trial-index-canonical"><div><strong>{selected.proceeding_title}</strong><span>{selected.proceeding_status} · proceeding date {selected.proceeding_date ?? "not recorded"}</span></div><Link href={courtRecordHref(caseId, { proceedingId: selected.proceeding_id })}>Open canonical proceeding →</Link></div>{hasDateConflict ? <div className="trial-index-date-conflict"><strong>DATE CONFLICT PRESERVED</strong><span>The navigation index records {selected.court_date}; the linked canonical proceeding records {selected.proceeding_date}. Review both sources before reconciling them.</span></div> : null}</> : <div className="trial-index-unlinked"><strong>No canonical proceeding linked yet.</strong><span>The day remains useful for navigation planning, but its summary must not be cited as testimony.</span></div>}
        <div className="trial-index-detail-grid"><section><header><h3>Witnesses</h3><span>{selected.witnesses.length}</span></header>{selected.witnesses.length === 0 ? <p>None indexed.</p> : selected.witnesses.map((item, index) => <article key={`${item.name}-${index}`}><strong>{item.name}</strong><span>{item.descriptor || "No role description"}</span><small>{item.status}</small>{item.source_segment_id ? <Link href={courtRecordHref(caseId, { segmentId: item.source_segment_id })}>Exact source →</Link> : null}</article>)}</section><section><header><h3>Topics and events</h3><span>{selected.topics.length}</span></header>{selected.topics.length === 0 ? <p>None indexed.</p> : selected.topics.map((item, index) => <article key={`${item.label}-${index}`}><strong>{item.label}</strong><span>{item.summary || "No additional description"}</span>{item.source_segment_id ? <Link href={courtRecordHref(caseId, { segmentId: item.source_segment_id })}>Exact source →</Link> : null}</article>)}</section></div>
        <section className="trial-index-references"><header><h3>Navigation references</h3><span>NOT EVIDENCE</span></header>{selected.references.length === 0 ? <p>No external navigation references recorded.</p> : selected.references.map((item) => <a href={item.url} target="_blank" rel="noreferrer" key={item.url}><strong>{item.title}</strong><span>{item.publisher || "Publisher not recorded"} · {item.source_kind.replaceAll("_", " ")} ↗</span></a>)}</section>
        <details className="trial-index-history"><summary>Immutable change history ({selectedVersions.length})</summary>{selectedVersions.map((version) => <article key={version.id}><strong>Version {version.version}</strong><span>{new Date(version.changed_at).toLocaleString()} · {version.changed_by_user_id}</span><p>{version.change_note || "No change note supplied."}</p></article>)}</details></>}
      </> : <div className="trial-index-empty"><MonoLabel>NO TRIAL DAYS ESTABLISHED</MonoLabel><h2>Create the trial’s navigation spine.</h2><p>Add known historical days now, or create planned days and update them as proceedings unfold.</p></div>}</section>
      {view === "navigation" ? <aside className="trial-index-editor">{workspace.canManage ? <TrialIndexForm caseId={caseId} day={selected} nextDayNumber={nextDayNumber} proceedings={workspace.proceedings} key={selected?.id ?? "new"} /> : <div className="trial-index-readonly"><MonoLabel>READ-ONLY MEMBERSHIP</MonoLabel><p>Owners and reviewers manage the index. You can use every day, witness, topic, and canonical link for navigation.</p></div>}</aside> : null}
    </div>
  </main>;
}
