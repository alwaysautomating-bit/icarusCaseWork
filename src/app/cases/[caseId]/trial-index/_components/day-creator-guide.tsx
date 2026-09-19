import type { FoundationDay } from "@/lib/foundation-day-index";

export function DayCreatorGuide({ day }: { day: FoundationDay }) {
  return <div className="creator-guide">
    <section className="creator-checklist" aria-label="Before you post">
      <h2>Before you post</h2>
      <ul>
        <li>Attribute every statement to the witness who made it. Say “testified that,” not “the fact is.”</li>
        <li>Openings, closings and questions from lawyers are arguments, not evidence.</li>
        <li>Note cross-examination when it qualifies a claim, and link or cite the day so readers can check.</li>
      </ul>
    </section>
    {day.note ? <p className="creator-day-note"><strong>Source note for this day:</strong> {day.note}</p> : null}
    <p className="creator-day-context">{day.summary}</p>
    <div className="creator-topics">
      {day.entries.map((entry) => <article className="creator-topic" key={entry.witness}>
        <header><h3>{entry.witness}</h3><span>{entry.role}</span></header>
        <p className="creator-topic-about"><strong>Topic:</strong> {entry.testimony}</p>
        <ol>
          <li><strong>Lead with the finding.</strong> {entry.contribution}</li>
          <li><strong>Attribute it.</strong> Name {entry.witness} and their role, then say what they testified about.</li>
          <li><strong>Add context.</strong> Where the day fits: {day.summary}</li>
          <li><strong>Add the caveat.</strong> {day.note ?? "Testimony is one side’s evidence; note any cross-examination that qualifies it."}</li>
        </ol>
      </article>)}
    </div>
  </div>;
}
