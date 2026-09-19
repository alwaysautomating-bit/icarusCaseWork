import Link from "next/link";
import { notFound } from "next/navigation";
import { MonoLabel } from "@/app/casework-ui";
import { PrintReportButton } from "@/app/cases/[caseId]/reports/children-found/print-report-button";
import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase } from "@/lib/case-access";
import { getCaseLindsayFoundReport } from "@/lib/case-lindsay-found-report";
import { courtRecordHref, referenceReportsHref } from "@/lib/case-routes";

export const dynamic = "force-dynamic";

function statusLabel(status: "corroborated" | "source-linked" | "qualified") {
  if (status === "source-linked") return "Attributed statement";
  if (status === "qualified") return "Qualified finding";
  return "Corroborated";
}

export default async function LindsayFoundReportPage({ params }: { params: Promise<{ caseId: string }> }) {
  const actor = await requireCaseActor();
  const { caseId } = await params;
  const [currentCase, report] = await Promise.all([
    getAccessibleCase(actor.id, caseId),
    getCaseLindsayFoundReport(caseId),
  ]);
  if (!currentCase || !report.available) notFound();

  const sourceByKey = new Map(report.sources.map((source) => [source.key, source]));

  return <main className="children-report-shell lindsay-report-shell">
    <nav className="children-report-toolbar" aria-label="Report navigation">
      <Link href={referenceReportsHref(caseId)}>← All reports</Link>
      <span>Source-linked analytical report · v1</span>
      <PrintReportButton />
    </nav>

    <header className="children-report-head lindsay-report-head">
      <div><MonoLabel>JANUARY 24 · DISCOVERY TO HOSPITAL DOCUMENTATION</MonoLabel><h1>How Lindsay<br />was found.</h1><p>A separate evidentiary lane for discovery, responder observations, emergency care, transport, and hospital documentation.</p></div>
      <dl><div><dt>Subject</dt><dd>1</dd></div><div><dt>Exact source links</dt><dd>{report.sources.length}</dd></div><div><dt>Held pending source</dt><dd>{report.heldDetails.length}</dd></div><div><dt>Report status</dt><dd>Source-complete</dd></div></dl>
    </header>

    <section className="children-report-boundary" aria-labelledby="lindsay-boundary-title">
      <MonoLabel>EVIDENCE BOUNDARY</MonoLabel>
      <div><h2 id="lindsay-boundary-title">Observation is not diagnosis—and location is not mechanism.</h2><p>The report records what each witness said they saw and what responders said they did. It does not infer how Lindsay came to be below the window, equate a witness’s wound description with a medical diagnosis, or identify a red-brown stain without testing.</p></div>
    </section>

    <section className="lindsay-report-register" aria-labelledby="lindsay-register-title">
      <header><div><MonoLabel>AT A GLANCE</MonoLabel><h2 id="lindsay-register-title">The documented course</h2></div><p>The uploaded Rose Stoffers excerpt aligns with the indexed Day 5 transcript; links below open the canonical Court Record segments.</p></header>
      <dl><div><dt>Found</dt><dd>Face-up in the backyard below the bedroom window</dd></div><div><dt>Initial state</dt><dd>Breathing; responsiveness varied across successive observations</dd></div><div><dt>Field care</dt><dd>Airway support, oxygen, bandaging, backboard, and cervical collar</dd></div><div><dt>Hospital trail</dt><dd>South Shore emergency department, then medflight to Brigham and Women’s</dd></div></dl>
    </section>

    <article className="children-report-subject lindsay">
      <header><h2>01 · Lindsay Clancy</h2><p>Found alive and breathing, with impaired responsiveness and wrist and neck injuries; stabilized, transported, and later documented at South Shore Hospital.</p></header>
      <div className="children-finding-list">
        {report.findings.map((finding, findingIndex) => {
          const findingSources = finding.sourceKeys.flatMap((key) => {
            const source = sourceByKey.get(key);
            return source ? [source] : [];
          });
          return <section className="children-finding-card" key={finding.key}>
            <div className="children-finding-index"><span>{finding.phase}</span><strong>{String(findingIndex + 1).padStart(2, "0")}</strong></div>
            <div className="children-finding-body"><header><h3>{finding.title}</h3><span className={`children-finding-status ${finding.status}`}>{statusLabel(finding.status)}</span></header><p>{finding.text}</p>
              <details><summary><span>Source trail</span><small>{findingSources.length} exact segment{findingSources.length === 1 ? "" : "s"}</small></summary><div>{findingSources.map((source) => <Link href={courtRecordHref(caseId, { segmentId: source.segmentId })} key={source.key}><span>{source.label}</span><small>{source.proceeding} · {source.witness} · {source.basis}</small></Link>)}</div></details>
            </div>
          </section>;
        })}
      </div>
      <footer><MonoLabel>CONTROLLING DISTINCTION</MonoLabel><p>Lindsay was found alive and breathing. Her changing responsiveness, visible wounds, suspected mechanism, and later diagnoses are different propositions supported by different witnesses and must remain separate.</p></footer>
    </article>

    <section className="children-report-held" aria-labelledby="lindsay-held-title">
      <header><div><MonoLabel>HELD PENDING EXACT SOURCE</MonoLabel><h2 id="lindsay-held-title">Not included as findings</h2></div><strong>{report.heldDetails.length}</strong></header>
      <div>{report.heldDetails.map((item) => <article key={item.key}><h3>{item.detail}</h3><p>{item.reason}</p></article>)}</div>
      <footer>Add the laboratory result, treating-clinician testimony, or medical record when recovered. Each proposition can then be promoted independently.</footer>
    </section>
  </main>;
}
