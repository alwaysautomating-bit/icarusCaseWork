import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { requireCaseActor } from "@/lib/authority";
import { listAccessibleCases } from "@/lib/case-access";
import { trialIndexHref } from "@/lib/case-routes";
import { foundationDays } from "@/lib/foundation-day-index";
import "./casework-index.css";

export const dynamic = "force-dynamic";

const witnessCount = new Set(foundationDays.flatMap((day) => day.entries.flatMap((entry) => entry.witness.split(";").map((name) => name.trim().toLowerCase()).filter(Boolean)))).size;

function CaseTitle({ title }: { title: string }) {
  const caption = title.split(" — ")[0] || title;
  const at = caption.indexOf(" v. ");
  if (at === -1) return <>{caption}</>;
  return <>{caption.slice(0, at + 3)}<br />{caption.slice(at + 4)}</>;
}

function shortId(id: string) {
  return `${id.slice(0, 13)}…${id.slice(-6)}`;
}

export default async function CaseSelectionPage() {
  const actor = await requireCaseActor();
  const cases = await listAccessibleCases(actor.id);

  return <main className="cx-shell">
    <div className="cx-wordmark">Icarus Casework</div>
    <div className="cx-top-right">
      <Link href="/cases/new">+ New case</Link>
      <form action={signOut}><button>Sign out</button></form>
    </div>

    <div className="cx-stage">
      {cases.length === 0 ? <div className="cx-empty"><h1>No cases are available.</h1><p>Create a case to establish its scope and begin source intake.</p></div> : <div className="cx-grid">
        {cases.map((item, index) => <Link className="cx-card" href={trialIndexHref(item.id)} key={item.id}>
          <div className="cx-num">{String(index + 1).padStart(2, "0")}.</div>
          <div className="cx-row"><span className="cx-eyebrow">Case file</span><h1><CaseTitle title={item.title} /></h1></div>
          {item.purpose ? <div className="cx-row"><span className="cx-eyebrow">Scope</span><p className="cx-desc">{item.purpose}</p></div> : null}
          <div className="cx-stats">{foundationDays.length} DAYS &nbsp;·&nbsp; {witnessCount} WITNESSES</div>
          <div className="cx-footer"><span className="cx-fid">{shortId(item.id)}</span><span className="cx-enter">Enter case →</span></div>
        </Link>)}
      </div>}
    </div>
  </main>;
}
