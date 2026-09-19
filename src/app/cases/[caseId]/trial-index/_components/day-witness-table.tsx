import type { FoundationDay } from "@/lib/foundation-day-index";

export function DayWitnessTable({ day }: { day: FoundationDay }) {
  return <div className="foundation-witness-table" role="table" aria-label={`Day ${day.day} testimony index`}>
    <div className="foundation-witness-head" role="row">
      <span role="columnheader">Witness</span>
      <span role="columnheader">Spoke about</span>
      <span role="columnheader">Evidence or information contributed</span>
    </div>
    {day.entries.map((entry) => <article className="foundation-witness-row" role="row" key={entry.witness}>
      <div role="cell" data-label="Witness"><h3>{entry.witness}</h3><span>{entry.role}</span></div>
      <p role="cell" data-label="Spoke about">{entry.testimony}</p>
      <p role="cell" data-label="Evidence or information contributed">{entry.contribution}</p>
    </article>)}
  </div>;
}
