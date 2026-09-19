import { confidenceInfo, typeLabel, type ResponderEvent } from "@/lib/responder-timeline";

const ASSERTION_LABELS: Record<string, string> = { claim: "Says", effect: "Effect", travel_estimate: "Travel estimate", source: "Transcript" };

const TEXT_FIELDS: Array<[keyof ResponderEvent, string]> = [
  ["significance", "Why it matters"],
  ["description", "Description"],
  ["finding", "Finding"],
  ["observation", "Observed"],
  ["source_assertion", "Source assertion"],
  ["note", "Note"],
  ["caveat", "Caveat"],
  ["evidence_reference", "Evidence"],
];

const LIST_FIELDS: Array<[keyof ResponderEvent, string]> = [
  ["sequence", "In order"],
  ["observations", "Observed"],
  ["actions", "Actions"],
];

export function ResponderEventCard({ event, titles }: { event: ResponderEvent; titles: Map<string, string> }) {
  const confidence = confidenceInfo(event.confidence);
  const placement = [
    ...(event.constraints?.after ?? []).map((id) => ({ relation: "After", id })),
    ...(event.constraints?.before ?? []).map((id) => ({ relation: "Before", id })),
    ...(event.overlaps_with ?? []).map((id) => ({ relation: "Overlaps", id })),
  ];
  const people = [...(event.actors ?? []), ...(event.units ?? []), ...(event.unit ? [event.unit] : [])];

  return <article className={`responder-event ${confidence?.tone ?? "plain"}${event.type === "synchronization_event" ? " sync" : ""}`} id={event.id.toLowerCase()}>
    <div className="responder-event-order"><strong>{String(event.order).padStart(2, "0")}</strong><span>{event.id}</span></div>
    <div className="responder-event-body">
      <header>
        <h3>{event.title}</h3>
        {confidence ? <span className={`responder-badge ${confidence.tone}`}>{confidence.label}</span> : null}
      </header>
      <p className="responder-event-meta">
        <span>{typeLabel(event.type)}</span>
        {event.occurred_at ? <span>{event.occurred_at}{event.precision ? ` (${event.precision.replaceAll("_", " ")})` : ""}</span> : null}
        {event.duration_minutes ? <span>≈{event.duration_minutes} min{event.precision ? ` · ${event.precision.replaceAll("_", " ")}` : ""}{event.start_event && event.end_event ? ` · ${event.start_event} to ${event.end_event}` : ""}</span> : null}
        {event.destination ? <span>To {event.destination}</span> : null}
      </p>
      {event.raw_temporal_expression ? <blockquote>“{event.raw_temporal_expression}”</blockquote> : null}
      {people.length || event.patients?.length ? <p className="responder-chips">
        {people.map((name) => <span key={name}>{name}</span>)}
        {event.patients?.map((name) => <span className="patient" key={name}>{name}</span>)}
      </p> : null}
      {TEXT_FIELDS.map(([key, label]) => event[key] ? <p className="responder-field" key={key}><strong>{label}.</strong> {String(event[key])}</p> : null)}
      {LIST_FIELDS.map(([key, label]) => {
        const items = event[key] as string[] | undefined;
        return items?.length ? <p className="responder-field" key={key}><strong>{label}.</strong> {items.join(" → ")}</p> : null;
      })}
      {event.assertions?.length ? <ul className="responder-assertions" aria-label="Witness assertions">
        {event.assertions.map((assertion, index) => <li key={index}>
          <strong>{assertion.witness}</strong>
          {Object.entries(assertion).filter(([key]) => key !== "witness").map(([key, value]) => <span key={key}><em>{ASSERTION_LABELS[key] ?? key.replaceAll("_", " ")}:</em> {String(value)}</span>)}
        </li>)}
      </ul> : null}
      {event.sources?.length ? <p className="responder-sources"><strong>Transcript</strong> {event.sources.join(" · ")}</p> : null}
      {placement.length ? <details className="responder-placement"><summary>Placement · {placement.length} constraint{placement.length === 1 ? "" : "s"}</summary>
        <ul>{placement.map(({ relation, id }) => <li key={`${relation}-${id}`}>{relation} <a href={`#${id.toLowerCase()}`}>{id}</a> {titles.get(id) ? `· ${titles.get(id)}` : ""}</li>)}</ul>
      </details> : null}
    </div>
  </article>;
}
