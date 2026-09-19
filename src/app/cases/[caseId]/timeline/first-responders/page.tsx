import Link from "next/link";
import { notFound } from "next/navigation";
import { MonoLabel } from "@/app/casework-ui";
import { CiteList, WitnessLink } from "@/app/cases/[caseId]/timeline/_components/cite-links";
import { ResponderEventCard } from "@/app/cases/[caseId]/timeline/first-responders/_components/responder-event-card";
import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase } from "@/lib/case-access";
import { firstRespondersTimelineHref, timelineHref } from "@/lib/case-routes";
import { BAND_LABELS, confidenceInfo, getResponderTimeline, phaseLabel, type AnchorRelation, type ResponderEvent } from "@/lib/responder-timeline";

export const dynamic = "force-dynamic";

type SearchState = { patient?: string; conflicts?: string };

const PATIENT_ORDER = ["Dawson", "Cora", "Callan", "Lindsay"];

function Cites({ caseId, items }: { caseId: string; items: string[] }) {
  return items.length ? <small className="responder-cites"><CiteList caseId={caseId} items={items} /></small> : null;
}

export default async function FirstRespondersTimelinePage({ params, searchParams }: { params: Promise<{ caseId: string }>; searchParams: Promise<SearchState> }) {
  const [actor, { caseId }, query, timeline] = await Promise.all([requireCaseActor(), params, searchParams, getResponderTimeline()]);
  const currentCase = await getAccessibleCase(actor.id, caseId);
  if (!currentCase) notFound();

  const titles = new Map(timeline.events.map((event) => [event.id, event.title]));
  const relations = new Map(timeline.events.map((event) => [event.id, event.anchor_relation]));
  const knownPatients = new Set(timeline.events.flatMap((event) => event.patients ?? []));
  const patients = [...PATIENT_ORDER.filter((name) => knownPatients.has(name)), ...[...knownPatients].filter((name) => !PATIENT_ORDER.includes(name))];
  const patient = patients.includes(query.patient ?? "") ? query.patient : undefined;
  const conflictsOnly = query.conflicts === "1";

  const isLandmark = (event: ResponderEvent) => event.anchor_relation === "at" || event.confidence === "clock_anchor";
  const visible = timeline.events.filter((event) => {
    if (isLandmark(event)) return true;
    if (patient && !event.patients?.includes(patient)) return false;
    if (conflictsOnly && confidenceInfo(event.confidence)?.tone !== "conflict") return false;
    return true;
  });

  const groups: Array<{ band: AnchorRelation; phase: string; events: ResponderEvent[] }> = [];
  for (const event of visible) {
    const last = groups.at(-1);
    if (last && last.band === event.anchor_relation && last.phase === event.phase) last.events.push(event);
    else groups.push({ band: event.anchor_relation, phase: event.phase, events: [event] });
  }

  const counts = { before: 0, at: 0, after: 0 };
  for (const event of timeline.events) counts[event.anchor_relation] += 1;
  const conflictCount = timeline.events.filter((event) => confidenceInfo(event.confidence)?.tone === "conflict").length;
  const filtered = Boolean(patient || conflictsOnly);
  const anchor = timeline.anchor;

  return <main className="responder-shell">
    <nav className="responder-toolbar" aria-label="Timeline navigation"><Link href={timelineHref(caseId)}>← All timelines</Link><span>Working reconstruction · v{timeline.schema_version}</span></nav>

    <header className="responder-head">
      <MonoLabel>FIRST RESPONDERS · ANCHORED ON THE SCREAM (T₀)</MonoLabel>
      <h1>{timeline.title}</h1>
      <p>{anchor.rationale} There is one clock reference, {timeline.methodology.clock_anchor.event.toLowerCase()} at {timeline.methodology.clock_anchor.time}; everything else is placed relative to T₀, and conflicting accounts are kept side by side.</p>
      <dl>
        <div><dt>Events</dt><dd>{timeline.events.length}</dd></div>
        <div><dt>Before · at · after T₀</dt><dd>{counts.before} · {counts.at} · {counts.after}</dd></div>
        <div><dt>Conflicts</dt><dd>{conflictCount}</dd></div>
        <div><dt>Unresolved</dt><dd>{timeline.unresolved.length + timeline.discrepancies.length}</dd></div>
      </dl>
    </header>

    <details className="responder-method">
      <summary>Method and rules</summary>
      <ul>{timeline.methodology.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
    </details>

    <section className="responder-alignment" aria-labelledby="responder-alignment-title">
      <header><MonoLabel>T₀ · {anchor.label.toUpperCase()}</MonoLabel><h2 id="responder-alignment-title">Where each witness was, before and after</h2><p>{anchor.definition}</p></header>
      <div className="responder-alignment-table" role="table" aria-label="Witness alignment around T₀">
        <div className="head" role="row"><span role="columnheader">Witness</span><span role="columnheader">Before T₀</span><span role="columnheader" className="at">T₀</span><span role="columnheader">After T₀</span></div>
        {anchor.witness_alignment.map((row) => <div role="row" key={row.witness}>
          <div role="cell" className="who"><strong><WitnessLink caseId={caseId} name={row.witness} /></strong><span>{row.role}</span></div>
          <div role="cell" data-label="Before T₀"><p>{row.before.text}</p><Cites caseId={caseId} items={row.before.sources} /></div>
          <div role="cell" data-label="T₀" className="at"><p>{row.at.text}</p><Cites caseId={caseId} items={row.at.sources} /></div>
          <div role="cell" data-label="After T₀"><p>{row.after.text}</p><Cites caseId={caseId} items={row.after.sources} /></div>
        </div>)}
      </div>
    </section>

    <nav className="responder-filters" aria-label="Filter events">
      <span>Show</span>
      <Link href={firstRespondersTimelineHref(caseId)} aria-current={!filtered ? "page" : undefined} prefetch={false}>All</Link>
      {patients.map((name) => <Link href={firstRespondersTimelineHref(caseId, { patient: name, conflicts: conflictsOnly })} aria-current={patient === name ? "page" : undefined} prefetch={false} key={name}>{name}</Link>)}
      <Link href={firstRespondersTimelineHref(caseId, { patient, conflicts: !conflictsOnly })} aria-pressed={conflictsOnly} className="conflict-toggle" prefetch={false}>{conflictsOnly ? "× Conflicts only" : "Conflicts only"}</Link>
    </nav>
    {filtered ? <p className="responder-filter-note">Filtered view: the clock anchor and T₀ always stay in place as reference points. Events for other patients are hidden, not removed.</p> : null}

    <div className="responder-sequence">
      {groups.map((group, index) => <section className={`responder-phase band-${group.band}`} key={`${group.band}-${group.phase}-${index}`} aria-label={`${BAND_LABELS[group.band]}: ${phaseLabel(group.phase)}`}>
        {index === 0 || groups[index - 1]!.band !== group.band ? <h2 className="responder-band">{BAND_LABELS[group.band]}</h2> : null}
        <h3 className="responder-phase-title">{phaseLabel(group.phase)}</h3>
        {group.events.map((event) => <ResponderEventCard caseId={caseId} event={event} titles={titles} key={event.id} />)}
      </section>)}
    </div>

    <section className="responder-lanes" aria-labelledby="responder-lanes-title">
      <header><MonoLabel>CROSS-WITNESS LANES</MonoLabel><h2 id="responder-lanes-title">Each chain, joined at T₀</h2></header>
      <div>{timeline.lanes.map((lane) => <article key={lane.key}>
        <h3>{lane.label}</h3>
        <p>{lane.summary}</p>
        <ol>{lane.steps.map((id) => <li className={relations.get(id) === "at" ? "anchor" : relations.get(id)} key={id}>
          <a href={`#${id.toLowerCase()}`}><em>{id}</em>{titles.get(id)}</a>
        </li>)}</ol>
      </article>)}</div>
    </section>

    <section className="responder-patrick" aria-labelledby="responder-patrick-title">
      <header><MonoLabel>PATRICK CLANCY · AROUND T₀</MonoLabel><h2 id="responder-patrick-title">Where the responders place him</h2><p>{timeline.patrick_positions.intro}</p></header>
      <ol>{timeline.patrick_positions.entries.map((entry, index) => <li key={index} className={entry.relation}>
        <span className="responder-badge">{entry.relation === "before" ? "Before T₀" : entry.relation === "at" ? "At T₀" : "After T₀"}</span>
        <div><strong>{entry.witness}</strong><p>{entry.text}</p><Cites caseId={caseId} items={entry.sources} /></div>
      </li>)}</ol>
      <div className="responder-not-attested" role="note"><MonoLabel>NOT ATTESTED IN THESE TRANSCRIPTS</MonoLabel><ul>{timeline.patrick_positions.not_attested.map((item) => <li key={item}>{item}</li>)}</ul></div>
    </section>

    <section className="responder-unresolved" aria-labelledby="responder-discrepancies-title">
      <header><MonoLabel>WHERE THE ACCOUNTS DISAGREE</MonoLabel><h2 id="responder-discrepancies-title">Discrepancies between witnesses</h2></header>
      <div>{timeline.discrepancies.map((item) => <article key={item.id}>
        <header><h3>{item.issue}</h3><span>{item.id}</span></header>
        <ul>{item.assertions.map((assertion) => <li key={assertion}>{assertion}</li>)}</ul>
        <p><strong>Handling.</strong> {item.handling}</p>
      </article>)}</div>
    </section>

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
