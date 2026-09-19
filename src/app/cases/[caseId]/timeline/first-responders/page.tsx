import Link from "next/link";
import { notFound } from "next/navigation";
import { MonoLabel } from "@/app/casework-ui";
import { ResponderEventCard } from "@/app/cases/[caseId]/timeline/first-responders/_components/responder-event-card";
import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase } from "@/lib/case-access";
import { firstRespondersTimelineHref, timelineHref } from "@/lib/case-routes";
import { confidenceInfo, getResponderTimeline, phaseLabel, type ResponderEvent } from "@/lib/responder-timeline";

export const dynamic = "force-dynamic";

type SearchState = { patient?: string; conflicts?: string };

const PATIENT_ORDER = ["Dawson", "Cora", "Callan", "Lindsay"];

export default async function FirstRespondersTimelinePage({ params, searchParams }: { params: Promise<{ caseId: string }>; searchParams: Promise<SearchState> }) {
  const [actor, { caseId }, query, timeline] = await Promise.all([requireCaseActor(), params, searchParams, getResponderTimeline()]);
  const currentCase = await getAccessibleCase(actor.id, caseId);
  if (!currentCase) notFound();

  const titles = new Map(timeline.events.map((event) => [event.id, event.title]));
  const knownPatients = new Set(timeline.events.flatMap((event) => event.patients ?? []));
  const patients = [...PATIENT_ORDER.filter((name) => knownPatients.has(name)), ...[...knownPatients].filter((name) => !PATIENT_ORDER.includes(name))];
  const patient = patients.includes(query.patient ?? "") ? query.patient : undefined;
  const conflictsOnly = query.conflicts === "1";

  const isLandmark = (event: ResponderEvent) => event.type === "synchronization_event" || event.confidence === "clock_anchor";
  const visible = timeline.events.filter((event) => {
    if (isLandmark(event)) return true;
    if (patient && !event.patients?.includes(patient)) return false;
    if (conflictsOnly && confidenceInfo(event.confidence)?.tone !== "conflict") return false;
    return true;
  });

  const groups: Array<{ phase: string; events: ResponderEvent[] }> = [];
  for (const event of visible) {
    const last = groups.at(-1);
    if (last && last.phase === event.phase) last.events.push(event);
    else groups.push({ phase: event.phase, events: [event] });
  }

  const conflictCount = timeline.events.filter((event) => confidenceInfo(event.confidence)?.tone === "conflict").length;
  const filtered = Boolean(patient || conflictsOnly);

  return <main className="responder-shell">
    <nav className="responder-toolbar" aria-label="Timeline navigation"><Link href={timelineHref(caseId)}>← All timelines</Link><span>Working reconstruction · v{timeline.schema_version}</span></nav>

    <header className="responder-head">
      <MonoLabel>FIRST RESPONDERS · PARTIAL-ORDER RECONSTRUCTION</MonoLabel>
      <h1>{timeline.title}</h1>
      <p>Built from what the responders said, ordered by cross-witness anchors rather than exact clock times. There is one clock anchor: {timeline.methodology.clock_anchor.event.toLowerCase()} at {timeline.methodology.clock_anchor.time}. Everything else is placed relative to it, and conflicting accounts are kept side by side.</p>
      <dl>
        <div><dt>Events</dt><dd>{timeline.events.length}</dd></div>
        <div><dt>Conflicts</dt><dd>{conflictCount}</dd></div>
        <div><dt>Unresolved</dt><dd>{timeline.unresolved.length}</dd></div>
        <div><dt>Status</dt><dd>{timeline.status.replaceAll("_", " ")}</dd></div>
      </dl>
    </header>

    <details className="responder-method">
      <summary>Method and rules</summary>
      <ul>{timeline.methodology.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
    </details>

    <nav className="responder-filters" aria-label="Filter events">
      <span>Show</span>
      <Link href={firstRespondersTimelineHref(caseId)} aria-current={!filtered ? "page" : undefined} prefetch={false}>All</Link>
      {patients.map((name) => <Link href={firstRespondersTimelineHref(caseId, { patient: name, conflicts: conflictsOnly })} aria-current={patient === name ? "page" : undefined} prefetch={false} key={name}>{name}</Link>)}
      <Link href={firstRespondersTimelineHref(caseId, { patient, conflicts: !conflictsOnly })} aria-pressed={conflictsOnly} className="conflict-toggle" prefetch={false}>{conflictsOnly ? "× Conflicts only" : "Conflicts only"}</Link>
    </nav>
    {filtered ? <p className="responder-filter-note">Filtered view: the clock anchor and the scream/child alert always stay in place as reference points. Events for other patients are hidden, not removed.</p> : null}

    <div className="responder-sequence">
      {groups.map((group, index) => <section className="responder-phase" key={`${group.phase}-${index}`} aria-label={phaseLabel(group.phase)}>
        <h2>{phaseLabel(group.phase)}</h2>
        {group.events.map((event) => <ResponderEventCard event={event} titles={titles} key={event.id} />)}
      </section>)}
    </div>

    <section className="responder-constraints" aria-labelledby="responder-constraints-title">
      <header><MonoLabel>ORDERING CONSTRAINTS</MonoLabel><h2 id="responder-constraints-title">What fixes the order</h2></header>
      <ol>{timeline.critical_constraints.map((constraint, index) => <li key={index}>
        <strong>{constraint.duration
          ? <>{constraint.duration.start} to {constraint.duration.end} ≈ {constraint.duration.minutes} min ({constraint.duration.precision})</>
          : constraint.overlap
            ? <>{constraint.overlap.join(" overlaps ")}</>
            : <>{constraint.before} before {constraint.after}</>}</strong>
        <span>{constraint.basis}</span>
      </li>)}</ol>
    </section>

    <section className="responder-unresolved" aria-labelledby="responder-unresolved-title">
      <header><MonoLabel>UNRESOLVED</MonoLabel><h2 id="responder-unresolved-title">What the testimony does not settle</h2></header>
      <div>{timeline.unresolved.map((item) => <article key={item.id}>
        <header><h3>{item.issue}</h3><span>{item.status.replaceAll("_", " ")}</span></header>
        {item.assertions?.length ? <ul>{item.assertions.map((assertion) => <li key={assertion}>{assertion}</li>)}</ul> : null}
        {item.handling ? <p><strong>Handling.</strong> {item.handling}</p> : null}
      </article>)}</div>
    </section>
  </main>;
}
