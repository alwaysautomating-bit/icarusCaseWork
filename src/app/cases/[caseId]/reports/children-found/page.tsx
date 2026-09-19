import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MonoLabel } from "@/app/casework-ui";
import { PrintReportButton } from "@/app/cases/[caseId]/reports/children-found/print-report-button";
import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase } from "@/lib/case-access";
import { getCaseChildrenFoundReport } from "@/lib/case-children-found-report";
import { courtRecordHref, referenceReportsHref } from "@/lib/case-routes";

export const dynamic = "force-dynamic";

function statusLabel(status: "corroborated" | "source-linked" | "qualified") {
  if (status === "source-linked") return "Directly source-linked";
  if (status === "qualified") return "Qualified distinction";
  return "Corroborated";
}

export default async function ChildrenFoundReportPage({ params }: { params: Promise<{ caseId: string }> }) {
  const actor = await requireCaseActor();
  const { caseId } = await params;
  const [currentCase, report] = await Promise.all([
    getAccessibleCase(actor.id, caseId),
    getCaseChildrenFoundReport(caseId),
  ]);
  if (!currentCase || !report.available) notFound();

  const sourceByKey = new Map(report.sources.map((source) => [source.key, source]));

  return <main className="children-report-shell">
    <nav className="children-report-toolbar" aria-label="Report navigation">
      <Link href={referenceReportsHref(caseId)}>← All reports</Link>
      <span>Source-linked analytical report · v1</span>
      <PrintReportButton />
    </nav>

    <header className="children-report-head">
      <div><MonoLabel>JANUARY 24 · SCENE TO MEDICAL OUTCOME</MonoLabel><h1>How the children<br />were found.</h1><p>This report keeps each child’s scene condition, emergency response, transport, hospital course, and death determination in a separate evidentiary lane.</p></div>
      <dl><div><dt>Children</dt><dd>{report.subjects.length}</dd></div><div><dt>Exact source links</dt><dd>{report.sources.length}</dd></div><div><dt>Held pending source</dt><dd>{report.heldDetails.length}</dd></div><div><dt>Report status</dt><dd>Source-complete</dd></div></dl>
    </header>

    <section className="children-report-boundary" aria-labelledby="children-report-boundary-title">
      <MonoLabel>EVIDENCE BOUNDARY</MonoLabel>
      <div><h2 id="children-report-boundary-title">The common condition does not erase the different courses.</h2><p>All three children were described as unresponsive and without detectable pulse or spontaneous breathing at initial assessment. The report does not turn that shared starting condition into a single event: response order, treatment, physical findings, return of cardiac activity, and death determination remain child-specific.</p></div>
    </section>

    <section className="children-report-comparison" aria-labelledby="children-report-comparison-title">
      <header><div><MonoLabel>COMPARISON VIEW</MonoLabel><h2 id="children-report-comparison-title">The distinction at a glance</h2></div><p>Absence of a documented feature means only “not established in this reviewed source set.”</p></header>
      <div className="children-comparison-grid">
        <div className="children-comparison-labels" aria-hidden="true"><span>Scene state</span><span>Cardiac course</span><span>Distinctive evidence</span><span>Endpoint</span></div>
        <article><h3>Dawson</h3><p><strong>Scene state</strong><span>First child responders encountered; no pulse or breathing documented.</span></p><p><strong>Cardiac course</strong><span>No return of cardiac activity.</span></p><p><strong>Distinctive evidence</strong><span>Facial-vessel and bruise testimony; bruise age descriptions remain source-specific.</span></p><p><strong>Endpoint</strong><span>Pronounced approximately 19:28 on January 24.</span></p></article>
        <article className="cora"><h3>Cora</h3><p><strong>Scene state</strong><span>No pulse or breathing documented.</span></p><p><strong>Cardiac course</strong><span>No return of cardiac activity.</span></p><p><strong>Distinctive evidence</strong><span>Only child in the reviewed record associated with an obvious wet scene blood deposit; DNA linked stain A to Cora.</span></p><p><strong>Endpoint</strong><span>Pronounced approximately 19:28 on January 24.</span></p></article>
        <article><h3>Callan</h3><p><strong>Scene state</strong><span>No pulse documented by Stratton and Cahill.</span></p><p><strong>Cardiac course</strong><span>Cardiac activity restored after hospital arrival.</span></p><p><strong>Distinctive evidence</strong><span>Remained ventilator-dependent; rare ventilator-triggering breaths were observed.</span></p><p><strong>Endpoint</strong><span>Met death by neurologic criteria; support ended January 27.</span></p></article>
      </div>
    </section>

    <section className="children-report-images" aria-labelledby="children-report-images-title">
      <header><div><MonoLabel>CORROBORATING IMAGES</MonoLabel><h2 id="children-report-images-title">Scene and laboratory-note copies</h2></div><p>Displayed as supplied. Their provenance status is not silently upgraded by inclusion in this report.</p></header>
      <div>{report.supportingImages.map((item) => <figure key={item.key}>
        <div><Image src={item.src} width={item.width} height={item.height} sizes="(max-width: 760px) 100vw, 50vw" alt={item.description} /></div>
        <figcaption><h3>{item.title}</h3><p>{item.description}</p><small>{item.boundary}</small></figcaption>
      </figure>)}</div>
    </section>

    <section className="children-report-subjects" aria-label="Child-specific findings">
      {report.subjects.map((subject, subjectIndex) => <article className={`children-report-subject ${subject.key}`} key={subject.key}>
        <header><h2>{String(subjectIndex + 1).padStart(2, "0")} · {subject.name}</h2><p>{subject.summary}</p></header>
        <div className="children-finding-list">
          {subject.findings.map((finding, findingIndex) => {
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
        <footer><MonoLabel>CONTROLLING DISTINCTION</MonoLabel><p>{subject.distinction}</p></footer>
      </article>)}
    </section>

    <section className="children-report-held" aria-labelledby="children-report-held-title">
      <header><div><MonoLabel>HELD PENDING EXACT SOURCE</MonoLabel><h2 id="children-report-held-title">Not included as findings</h2></div><strong>{report.heldDetails.length}</strong></header>
      <div>{report.heldDetails.map((item) => <article key={item.key}><h3>{item.detail}</h3><p>{item.reason}</p></article>)}</div>
      <footer>Upload the exhibit, report, or testimony segment when recovered. These details can then be reviewed and promoted individually without rewriting the supported findings above.</footer>
    </section>
  </main>;
}
