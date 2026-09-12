import Link from "next/link";
import { MonoLabel, Wordmark } from "@/app/casework-ui";
import { signOut } from "@/app/login/actions";
import { requireCaseActor } from "@/lib/authority";
import { listAccessibleCases } from "@/lib/case-access";
import { caseFilesHref, courtRecordHref, referenceReportsHref, trialIndexHref } from "@/lib/case-routes";

export const dynamic = "force-dynamic";

export default async function CaseSelectionPage() {
  const actor = await requireCaseActor();
  const cases = await listAccessibleCases(actor.id);

  return <main className="case-index-shell">
    <header className="masthead">
      <Wordmark />
      <nav aria-label="Application"><Link href="/cases/new">Establish case</Link><Link href="/search">Global testimony search</Link><Link href="/compiler">Compiler sandbox</Link></nav>
      <div className="account"><span>{actor.email}</span><form action={signOut}><button className="text-button">Sign out</button></form></div>
    </header>
    <section className="case-index-hero">
      <div><MonoLabel>PRIVATE CASEWORK · RLS ENFORCED</MonoLabel><h1>Choose the case.<br />Then enter the record.</h1></div>
      <div className="case-index-intro"><p>The active case is always explicit in the URL. Open the trial index, search the court record, or collect supporting pictures without mixing them into the canonical record.</p><Link className="system-button primary" href="/cases/new">Establish a new case <span aria-hidden="true">→</span></Link></div>
    </section>
    <section className="case-index-list" aria-labelledby="case-list-title">
      <header><div><MonoLabel>ACCESSIBLE CASES</MonoLabel><h2 id="case-list-title">Your casework</h2></div><strong>{cases.length}</strong></header>
      {cases.length === 0 ? <div className="case-index-empty"><h3>No cases are available.</h3><p>Create a case to establish its scope and begin source intake.</p></div> : <div className="case-card-grid">{cases.map((item) => <article className="case-card" key={item.id}>
        <header><MonoLabel>{item.membershipRole} · {item.workspace_key}</MonoLabel><span>{new Date(item.created_at).toLocaleDateString()}</span></header>
        <h2>{item.title}</h2><p>{item.purpose}</p>
        <footer>
          <Link href={trialIndexHref(item.id)}>Trial Index →</Link>
          <Link href={courtRecordHref(item.id)}>Court Record →</Link>
          {item.owner_user_id === actor.id
            ? <Link href={caseFilesHref(item.id)}>Files →</Link>
            : <Link href={referenceReportsHref(item.id)}>Reports →</Link>}
        </footer>
      </article>)}</div>}
    </section>
  </main>;
}
