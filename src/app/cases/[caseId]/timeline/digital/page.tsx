import Link from "next/link";
import { notFound } from "next/navigation";
import { MonoLabel } from "@/app/casework-ui";
import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase } from "@/lib/case-access";
import { digitalTimelineHref, timelineHref } from "@/lib/case-routes";
import { categoryKey, DEVICE_CATEGORIES, formatEventTime, getDeviceReportTimeline, isNoisyCategory } from "@/lib/device-report-timeline";

export const dynamic = "force-dynamic";

type SearchState = { category?: string };

export default async function DigitalTimelinePage({ params, searchParams }: { params: Promise<{ caseId: string }>; searchParams: Promise<SearchState> }) {
  const [actor, { caseId }, query, data] = await Promise.all([requireCaseActor(), params, searchParams, getDeviceReportTimeline()]);
  const currentCase = await getAccessibleCase(actor.id, caseId);
  if (!currentCase) notFound();

  const { report } = data;
  const notes = report.report_source_notes;
  const counts = new Map<string, number>();
  for (const event of data.events) counts.set(categoryKey(event.category), (counts.get(categoryKey(event.category)) ?? 0) + 1);

  const selected = DEVICE_CATEGORIES.find((item) => item.key === query.category)?.key;
  const showAll = query.category === "all";
  const visible = data.events.filter((event) => {
    const key = categoryKey(event.category);
    if (selected) return key === selected;
    return showAll || !isNoisyCategory(key);
  });
  const hidden = data.events.length - visible.length;

  const byHour = new Map<string, typeof visible>();
  for (const event of visible) {
    const hour = `${String(Math.floor(event.seconds / 3600)).padStart(2, "0")}:00`;
    byHour.set(hour, [...(byHour.get(hour) ?? []), event]);
  }

  const lastEvent = data.events.at(-1);
  const keyView = !selected && !showAll;

  return <main className="responder-shell device-shell">
    <nav className="responder-toolbar" aria-label="Timeline navigation"><Link href={timelineHref(caseId)}>← All timelines</Link><span>Digital report · {report.date}</span></nav>

    <header className="responder-head">
      <MonoLabel>DIGITAL · DEVICE REPORT TIMELINE</MonoLabel>
      <h1>{report.title}</h1>
      <p>{report.scope_note}</p>
      <dl>
        <div><dt>Entries</dt><dd>{data.events.length}</dd></div>
        <div><dt>Primary device</dt><dd>{report.reported_primary_device}</dd></div>
        <div><dt>Secondary</dt><dd>{report.reported_secondary_device.split(" (")[0]}</dd></div>
        <div><dt>Clock</dt><dd>{report.timezone_as_stated.split(" (")[0]}</dd></div>
      </dl>
    </header>

    <section className="device-notes" aria-label="Report source notes">
      <MonoLabel>REPORT SOURCE NOTES · AS STATED</MonoLabel>
      <dl>
        <div><dt>First heart-rate record</dt><dd>{notes.heart_rate_first}</dd></div>
        <div><dt>Last heart-rate record</dt><dd>{notes.heart_rate_last}</dd></div>
        <div><dt>Heart-rate records</dt><dd>{notes.heart_rate_total_records_stated} · avg {notes.heart_rate_average_stated}</dd></div>
        <div><dt>Device locked after</dt><dd>{notes.device_locked_after_stated}</dd></div>
      </dl>
      <p>{notes.second_phone_statement}</p>
    </section>

    <nav className="responder-filters" aria-label="Filter entries">
      <span>Show</span>
      <Link href={digitalTimelineHref(caseId)} aria-current={keyView ? "page" : undefined} prefetch={false}>Key activity</Link>
      <Link href={digitalTimelineHref(caseId, "all")} aria-current={showAll ? "page" : undefined} prefetch={false}>Everything</Link>
      {DEVICE_CATEGORIES.map((item) => <Link href={digitalTimelineHref(caseId, item.key)} aria-current={selected === item.key ? "page" : undefined} prefetch={false} key={item.key}>{item.label} <small>{counts.get(item.key) ?? 0}</small></Link>)}
    </nav>
    {keyView && hidden ? <p className="responder-filter-note">{hidden} heart-rate and flights-climbed readings are hidden in this view. Choose “Everything” or one of those categories to see them.</p> : null}

    <div className="device-hours">
      {[...byHour.entries()].map(([hour, events]) => <section className="device-hour" key={hour} aria-label={`${hour} hour`}>
        <h2>{hour}</h2>
        <ol>{events.map((event) => {
          const key = categoryKey(event.category);
          return <li className={`device-entry ${key}`} key={event.index}>
            <time>{event.approximate ? "~" : ""}{formatEventTime(event).replace("~", "")}</time>
            <div>
              <p className="device-entry-meta"><span className="responder-badge">{DEVICE_CATEGORIES.find((item) => item.key === key)?.label ?? key}</span><span>{event.source}</span>{event.direction ? <span>{event.direction}</span> : null}{event.counterparty ? <span>{event.direction === "incoming" ? "from" : event.direction === "outgoing" ? "to" : "with"} {event.counterparty}</span> : null}</p>
              <p className="device-entry-detail">{event.detail}{event.value !== null && event.value !== undefined && typeof event.value === "string" ? <strong> {event.value}</strong> : null}</p>
            </div>
          </li>;
        })}</ol>
      </section>)}
      {visible.length === 0 ? <p className="foundation-empty">No entries in this category.</p> : null}
    </div>

    <section className="device-end" aria-label="End of visible timeline">
      <MonoLabel>WHERE THE VISIBLE TIMELINE ENDS</MonoLabel>
      <p>The transcribed entries end at {lastEvent ? formatEventTime(lastEvent) : "—"}. The report’s source notes say the last heart-rate record was {notes.heart_rate_last} and the device stayed locked after {notes.device_locked_after_stated}. Nothing in the supplied pages covers the time between.</p>
    </section>

    <details className="device-hourly">
      <summary>Hourly activity summary (report-level)</summary>
      <div className="device-hourly-table" role="table" aria-label="Hourly activity summary">
        <div role="row" className="head"><span role="columnheader">Period</span><span role="columnheader">Distance (ft)</span><span role="columnheader">Max speed</span><span role="columnheader">Max heart rate</span><span role="columnheader">Flights</span></div>
        {data.hourly_summary.map((row) => <div role="row" key={row.period}><span role="cell">{row.period}</span><span role="cell">{row.distance_feet ?? "—"}</span><span role="cell">{row.max_speed ?? "—"}</span><span role="cell">{row.max_heart_rate_bpm ? `${row.max_heart_rate_bpm} bpm` : "—"}</span><span role="cell">{row.flights_climbed ?? "—"}</span></div>)}
      </div>
    </details>

    <section className="device-transcription" aria-labelledby="device-transcription-title">
      <header><MonoLabel>TRANSCRIPTION NOTES</MonoLabel><h2 id="device-transcription-title">Limits of this timeline</h2></header>
      <ul>{data.transcription_notes.map((note) => <li key={note}>{note}</li>)}</ul>
    </section>
  </main>;
}
