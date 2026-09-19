import Link from "next/link";
import { notFound } from "next/navigation";
import { MonoLabel } from "@/app/casework-ui";
import { CiteList } from "@/app/cases/[caseId]/timeline/_components/cite-links";
import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase } from "@/lib/case-access";
import { firstRespondersTimelineHref, patrickAccountsHref, patrickDiscoveryHref, timelineHref } from "@/lib/case-routes";
import { getPatrickAccounts, STATUS_LABELS, type PatrickSourceKey } from "@/lib/patrick-accounts";

export const dynamic = "force-dynamic";

type SearchState = { view?: string };

const COLUMNS: PatrickSourceKey[] = ["trial", "newyorker", "opening", "affidavit", "responders"];

export default async function PatrickAccountsPage({ params, searchParams }: { params: Promise<{ caseId: string }>; searchParams: Promise<SearchState> }) {
  const [actor, { caseId }, query, data] = await Promise.all([requireCaseActor(), params, searchParams, getPatrickAccounts()]);
  const currentCase = await getAccessibleCase(actor.id, caseId);
  if (!currentCase) notFound();

  const differencesOnly = query.view === "differences";
  const sourceByKey = new Map(data.sources.map((source) => [source.key, source]));
  const steps = data.steps.filter((step) => !differencesOnly || step.assessment.status !== "consistent");
  const flagged = data.steps.filter((step) => step.assessment.status !== "consistent").length;

  return <main className="responder-shell patrick-shell">
    <nav className="responder-toolbar" aria-label="Timeline navigation"><Link href={timelineHref(caseId)}>← All timelines</Link><Link href={patrickDiscoveryHref(caseId)}>Discovery, step by step →</Link><Link href={firstRespondersTimelineHref(caseId)}>First responders (T₀) →</Link></nav>

    <header className="responder-head">
      <MonoLabel>PATRICK CLANCY · ACCOUNTS COMPARED</MonoLabel>
      <h1>{data.title}</h1>
      <p>{data.intro}</p>
      <dl>
        <div><dt>Moments compared</dt><dd>{data.steps.length}</dd></div>
        <div><dt>Flagged</dt><dd>{flagged}</dd></div>
        <div><dt>Discrepancies</dt><dd>{data.discrepancies.length}</dd></div>
        <div><dt>Unaccounted windows</dt><dd>{data.unaccounted.length}</dd></div>
      </dl>
    </header>

    <section className="patrick-sources" aria-label="Sources compared">
      {data.sources.map((source) => <article key={source.key}><MonoLabel>{source.kind.toUpperCase()}</MonoLabel><h2>{source.label}</h2><p>{source.note}</p></article>)}
    </section>

    <section className="patrick-errand" aria-labelledby="patrick-errand-title">
      <header><MonoLabel>THE ERRAND · PLANNED AGAINST ACTUAL</MonoLabel><h2 id="patrick-errand-title">How long it should have taken, and how long it did</h2><p>{data.errand.intro}</p></header>
      <div className="patrick-errand-table" role="table" aria-label="Errand legs: estimate against timed video">
        <div className="head" role="row"><span role="columnheader">Leg</span><span role="columnheader">Route estimate</span><span role="columnheader">Documented</span><span role="columnheader">Difference</span><span role="columnheader">Basis</span></div>
        {data.errand.rows.map((row) => <div role="row" key={row.leg}>
          <strong role="cell" data-label="Leg">{row.leg}</strong>
          <span role="cell" data-label="Route estimate">{row.estimate}</span>
          <span role="cell" data-label="Documented">{row.actual}</span>
          <span role="cell" data-label="Difference" className={row.difference.includes("more") ? "more" : undefined}>{row.difference}</span>
          <span role="cell" data-label="Basis">{row.basis}<small>{row.caveat}</small></span>
        </div>)}
      </div>
      <p className="patrick-errand-summary"><strong>Total.</strong> {data.errand.summary}</p>
      <ul className="patrick-errand-cautions">{data.errand.cautions.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>

    <nav className="responder-filters" aria-label="Filter moments">
      <span>Show</span>
      <Link href={patrickAccountsHref(caseId)} aria-current={!differencesOnly ? "page" : undefined} prefetch={false}>All moments</Link>
      <Link href={patrickAccountsHref(caseId, { differences: true })} aria-current={differencesOnly ? "page" : undefined} prefetch={false}>Only flagged</Link>
    </nav>

    <div className="patrick-steps">
      {steps.map((step) => <article className={`patrick-step ${step.assessment.status}`} key={step.id} id={step.id.toLowerCase()}>
        <header>
          <span className="patrick-step-number">{String(data.steps.indexOf(step) + 1).padStart(2, "0")}</span>
          <h2>{step.title}</h2>
          <span className={`patrick-status ${step.assessment.status}`}>{STATUS_LABELS[step.assessment.status]}</span>
        </header>
        <div className="patrick-columns" role="table" aria-label={`${step.title}: accounts side by side`}>
          {COLUMNS.map((key) => {
            const cell = step.cells[key] ?? null;
            const source = sourceByKey.get(key);
            return <div role="cell" className={`patrick-cell ${key}${cell ? "" : " empty"}`} data-label={source?.label} key={key}>
              <h3>{source?.label}</h3>
              {cell ? <><p>{cell.text}</p>{cell.cites.length ? <small className="responder-cites"><CiteList caseId={caseId} items={cell.cites} /></small> : null}</> : <p className="none">Not addressed.</p>}
            </div>;
          })}
        </div>
        <p className="patrick-assessment"><strong>What to test.</strong> {step.assessment.note}</p>
        {step.researcher_note ? <p className="patrick-researcher"><strong>Researcher observation, not verified here.</strong> {step.researcher_note.replace(/^Researcher (observation from the footage|observation|question): ?/, "")}</p> : null}
      </article>)}
    </div>

    <section className="patrick-windows" aria-labelledby="patrick-windows-title">
      <header><MonoLabel>UNACCOUNTED TIME</MonoLabel><h2 id="patrick-windows-title">Windows where his account runs ahead of the witnesses</h2></header>
      <div>{data.unaccounted.map((window) => <article key={window.id}>
        <header><h3>{window.title}</h3><span>{window.id}</span></header>
        <p className="window">{window.window}</p>
        <div className="patrick-window-grid">
          <div><MonoLabel>HE SAYS HE DID</MonoLabel><ul>{window.claimed.map((item) => <li key={item}>{item}</li>)}</ul></div>
          <div><MonoLabel>WITNESSES ATTEST</MonoLabel><p>{window.attested}</p></div>
        </div>
        <p className="gap"><strong>The gap.</strong> {window.gap}</p>
      </article>)}</div>
    </section>

    <section className="patrick-discrepancies" aria-labelledby="patrick-discrepancies-title">
      <header><MonoLabel>DISCREPANCIES</MonoLabel><h2 id="patrick-discrepancies-title">Points to test against the record</h2></header>
      <ol>{data.discrepancies.map((item) => <li key={item.id} id={item.id.toLowerCase()}>
        <header><h3>{item.issue}</h3><span>{item.id}</span></header>
        <ul>{item.accounts.map((account) => <li key={account}>{account}</li>)}</ul>
        <p><strong>Why it matters.</strong> {item.why}</p>
        <p><strong>What would resolve it.</strong> {item.resolve}</p>
      </li>)}</ol>
    </section>

    <section className="responder-not-attested patrick-missing" role="note">
      <MonoLabel>NOT IN THE FOLDER YET</MonoLabel>
      <ul>{data.not_in_folder.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  </main>;
}
