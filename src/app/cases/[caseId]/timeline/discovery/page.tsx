import Link from "next/link";
import { notFound } from "next/navigation";
import { MonoLabel } from "@/app/casework-ui";
import { CiteList } from "@/app/cases/[caseId]/timeline/_components/cite-links";
import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase } from "@/lib/case-access";
import { firstRespondersTimelineHref, patrickAccountsHref, timelineHref } from "@/lib/case-routes";
import { COVERAGE_LABELS, getPatrickDiscovery } from "@/lib/patrick-discovery";

export const dynamic = "force-dynamic";

const RELATION_LABELS = { before: "Before T₀", at: "At T₀", after: "After T₀" } as const;
const KIND_LABELS = { responder: "Responder", testimony: "Patrick's testimony", recording: "Recording (not in folder)" } as const;

export default async function PatrickDiscoveryPage({ params }: { params: Promise<{ caseId: string }> }) {
  const [actor, { caseId }, data] = await Promise.all([requireCaseActor(), params, getPatrickDiscovery()]);
  const currentCase = await getAccessibleCase(actor.id, caseId);
  if (!currentCase) notFound();

  return <main className="responder-shell discovery-shell">
    <nav className="responder-toolbar" aria-label="Timeline navigation"><Link href={timelineHref(caseId)}>← All timelines</Link><Link href={patrickAccountsHref(caseId)}>Accounts compared →</Link><Link href={firstRespondersTimelineHref(caseId)}>First responders (T₀) →</Link></nav>

    <header className="responder-head">
      <MonoLabel>PATRICK CLANCY · DISCOVERY OF THE CHILDREN</MonoLabel>
      <h1>{data.title}</h1>
      <p>{data.intro}</p>
      <dl>
        <div><dt>Steps</dt><dd>{data.steps.filter((step) => !step.anchor).length}</dd></div>
        <div><dt>Not observed by anyone else</dt><dd>{data.steps.filter((step) => step.coverage === "none").length}</dd></div>
        <div><dt>Partly observed</dt><dd>{data.steps.filter((step) => step.coverage === "partial").length}</dd></div>
        <div><dt>Open questions</dt><dd>{data.open_questions.length}</dd></div>
      </dl>
    </header>

    <p className="discovery-reading"><strong>Reading note.</strong> {data.reading_note}</p>

    <ol className="discovery-steps">
      {data.steps.map((step) => <li className={`discovery-step ${step.relation}${step.anchor ? " anchor" : ""} coverage-${step.coverage}`} key={step.id} id={step.id.toLowerCase()}>
        <div className="discovery-rail"><strong>{step.id}</strong><span>{RELATION_LABELS[step.relation]}</span></div>
        <div className="discovery-body">
          <header>
            <h2>{step.title}</h2>
            <span className={`discovery-coverage ${step.coverage}`}>{COVERAGE_LABELS[step.coverage]}</span>
          </header>
          {step.quote ? <blockquote>“{step.quote.text}”<cite><CiteList caseId={caseId} items={step.quote.cites} /></cite></blockquote> : null}
          <p className="discovery-summary">{step.summary}</p>
          {step.observed_by.length ? <ul className="discovery-observed" aria-label="Independent observations">
            {step.observed_by.map((item) => <li key={`${item.witness}-${item.text}`}><strong>{item.witness}</strong><p>{item.text}</p><small className="responder-cites"><CiteList caseId={caseId} items={item.cites} /></small></li>)}
          </ul> : (step.anchor ? null : <p className="discovery-unobserved">No other witness describes this step.</p>)}
          {step.scene_effect ? <p className="discovery-effect"><strong>What this did to the scene.</strong> {step.scene_effect}</p> : null}
        </div>
      </li>)}
    </ol>

    <section className="discovery-scream" aria-labelledby="discovery-scream-title">
      <header><MonoLabel>THE SCREAM</MonoLabel><h2 id="discovery-scream-title">{data.scream.question}</h2></header>
      <ul>{data.scream.points.map((point) => <li className={point.kind} key={`${point.source}-${point.text}`}>
        <span className="discovery-kind">{KIND_LABELS[point.kind]}</span>
        <div><strong>{point.source}</strong><p>{point.text}</p><small className="responder-cites"><CiteList caseId={caseId} items={point.cites} /></small></div>
      </li>)}</ul>
      <p className="discovery-reading-box"><strong>What the sources support.</strong> {data.scream.reading}</p>
      <p className="discovery-caution">{data.scream.caution}</p>
    </section>

    <section className="discovery-unobserved-window" aria-labelledby="discovery-window-title">
      <header><MonoLabel>THE SCENE BEFORE ANYONE ELSE SAW IT</MonoLabel><h2 id="discovery-window-title">{data.unobserved.title}</h2><p>From: {data.unobserved.start}. Until: {data.unobserved.end}.</p></header>
      <div className="discovery-window-grid">
        <div><MonoLabel>FIRST INDEPENDENT SIGHTING</MonoLabel><ul>{data.unobserved.first_seen.map((item) => <li key={item.child}><strong>{item.child} · {item.by}</strong><p>{item.text}</p><small className="responder-cites"><CiteList caseId={caseId} items={item.cites} /></small></li>)}</ul></div>
        <div><MonoLabel>WHAT CHANGED IN BETWEEN</MonoLabel><ul>{data.unobserved.changed.map((item) => <li key={item}><p>{item}</p></li>)}</ul></div>
        <div className="cannot"><MonoLabel>WHAT NO ONE CAN ACCOUNT FOR</MonoLabel><ul>{data.unobserved.cannot_account_for.map((item) => <li key={item}><p>{item}</p></li>)}</ul></div>
      </div>
    </section>

    <section className="discovery-state" aria-labelledby="discovery-state-title">
      <header><MonoLabel>SCENE STATE</MonoLabel><h2 id="discovery-state-title">His description against what responders found</h2></header>
      <div className="discovery-state-table" role="table" aria-label="Scene state: Patrick's description against responders">
        <div className="head" role="row"><span role="columnheader">Subject</span><span role="columnheader">Patrick says</span><span role="columnheader">Responders found</span><span role="columnheader">Not mentioned by Patrick</span></div>
        {data.scene_state.map((row) => <div role="row" key={row.subject}>
          <strong role="cell" data-label="Subject">{row.subject}</strong>
          <p role="cell" data-label="Patrick says">{row.patrick}</p>
          <div role="cell" data-label="Responders found"><p>{row.responders}</p><small className="responder-cites"><CiteList caseId={caseId} items={row.cites} /></small></div>
          <p role="cell" data-label="Not mentioned by Patrick" className="missing">{row.not_mentioned}</p>
        </div>)}
      </div>
    </section>

    <section className="responder-not-attested discovery-questions" role="note">
      <MonoLabel>OPEN QUESTIONS</MonoLabel>
      <ul>{data.open_questions.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  </main>;
}
