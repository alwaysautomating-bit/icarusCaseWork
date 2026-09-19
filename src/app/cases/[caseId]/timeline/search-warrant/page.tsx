import Link from "next/link";
import { notFound } from "next/navigation";
import { MonoLabel } from "@/app/casework-ui";
import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase } from "@/lib/case-access";
import { patrickAccountsHref, timelineHref } from "@/lib/case-routes";
import { formatWarrantTime, getWarrantAttribution, LANE_LABELS, statusLabel, weightInfo, type WarrantLane } from "@/lib/search-warrant-timeline";

export const dynamic = "force-dynamic";

const LANES: WarrantLane[] = ["occurrence", "patrick_account", "police_knowledge"];

export default async function SearchWarrantTimelinePage({ params }: { params: Promise<{ caseId: string }> }) {
  const [actor, { caseId }, { timeline, notes }] = await Promise.all([requireCaseActor(), params, getWarrantAttribution()]);
  const currentCase = await getAccessibleCase(actor.id, caseId);
  if (!currentCase) notFound();

  const titles = new Map(timeline.events.map((event) => [event.id, event.label]));

  return <main className="responder-shell warrant-shell">
    <nav className="responder-toolbar" aria-label="Timeline navigation"><Link href={timelineHref(caseId)}>← All timelines</Link><Link href={patrickAccountsHref(caseId)}>Patrick Clancy · accounts compared →</Link></nav>

    <header className="responder-head">
      <MonoLabel>SEARCH WARRANT · HOW LINDSAY WAS IDENTIFIED</MonoLabel>
      <h1>{timeline.title}</h1>
      <p>{notes.source_note}</p>
      <dl>
        <div><dt>Events</dt><dd>{timeline.events.length}</dd></div>
        <div><dt>Source</dt><dd>Affidavit pp. {timeline.source.packet_pages}</dd></div>
        <div><dt>Findings</dt><dd>{timeline.critical_findings.length}</dd></div>
        <div><dt>Open questions</dt><dd>{timeline.unresolved.length}</dd></div>
      </dl>
    </header>

    <section className="warrant-transition" aria-label="How attribution progressed">
      <MonoLabel>THE STATE TRANSITION</MonoLabel>
      <ol>{notes.state_transition.split(" → ").map((step) => <li key={step}>{step}</li>)}</ol>
      <p>{notes.reading_guide}</p>
    </section>

    <div className="warrant-lanes">
      {LANES.map((lane) => <section className={`warrant-lane ${lane}`} key={lane} aria-labelledby={`warrant-lane-${lane}`}>
        <header><h2 id={`warrant-lane-${lane}`}>{LANE_LABELS[lane].label}</h2><p>{LANE_LABELS[lane].blurb}</p></header>
        <ol>{timeline.events.filter((event) => event.lane === lane).map((event) => {
          const weight = weightInfo(event.actor_identification_weight);
          return <li className={`warrant-event ${weight?.tone ?? ""}`} key={event.id} id={event.id}>
            <p className="warrant-time">{formatWarrantTime(event, titles)}</p>
            <h3>{event.label}</h3>
            {event.assertion ? <p className="warrant-assertion">{event.assertion}</p> : null}
            {event.originating_source ? <p className="warrant-origin"><strong>Originates with</strong> {event.originating_source}{event.reported_by ? `, reported by ${event.reported_by}` : ""}</p> : null}
            <p className="warrant-tags">
              {weight ? <span className={`warrant-weight ${weight.tone}`}>{weight.label}</span> : null}
              <span>{statusLabel(event.status)}</span>
              <span>Affidavit p. {event.source_pages.join(", ")}</span>
            </p>
          </li>;
        })}</ol>
      </section>)}
    </div>

    <section className="warrant-findings" aria-labelledby="warrant-findings-title">
      <header><MonoLabel>WHAT THE AFFIDAVIT SHOWS</MonoLabel><h2 id="warrant-findings-title">Critical findings</h2></header>
      <ul>{timeline.critical_findings.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>

    <section className="warrant-chain" aria-labelledby="warrant-chain-title">
      <header><MonoLabel>ATTRIBUTION ANALYSIS</MonoLabel><h2 id="warrant-chain-title">The chain that identified Lindsay</h2></header>
      <ol>{notes.chain.map((item) => <li key={item}>{item}</li>)}</ol>
      <p>{notes.conclusion}</p>
    </section>

    <section className="responder-unresolved" aria-labelledby="warrant-gaps-title">
      <header><MonoLabel>MATERIAL GAPS</MonoLabel><h2 id="warrant-gaps-title">What the extract does not settle</h2></header>
      <div>{notes.gaps.map((gap) => <article key={gap}><p>{gap}</p></article>)}</div>
    </section>
  </main>;
}
