import Link from "next/link";
import { MonoLabel, Wordmark } from "@/app/casework-ui";
import { signOut } from "@/app/login/actions";
import { requireCaseActor } from "@/lib/authority";
import { listAccessibleCases } from "@/lib/case-access";
import { trialIndexHref } from "@/lib/case-routes";

export const dynamic = "force-dynamic";

export default async function CaseSelectionPage() {
  const actor = await requireCaseActor();
  const cases = await listAccessibleCases(actor.id);

  return <main className="case-index-shell">
    <header className="masthead">
      <Wordmark />
      <nav aria-label="Application"><Link href="/cases/new">Establish case</Link><Link href="/search">Global testimony search</Link></nav>
      <div className="account"><span>{actor.email}</span><form action={signOut}><button className="text-button">Sign out</button></form></div>
    </header>
    <section className="case-index-list" aria-labelledby="case-list-title">
      <header><div><MonoLabel>ACCESSIBLE CASES</MonoLabel><h2 id="case-list-title">Your casework</h2></div><strong>{cases.length}</strong></header>
      {cases.length === 0 ? <div className="case-index-empty"><h3>No cases are available.</h3><p>Create a case to establish its scope and begin source intake.</p></div> : <div className="case-card-grid">{cases.map((item) => <Link className="case-card case-card-link" href={trialIndexHref(item.id)} key={item.id}>
        <h2>{item.title}</h2>
        <span className="case-card-arrow" aria-hidden="true">→</span>
      </Link>)}</div>}
    </section>
  </main>;
}
