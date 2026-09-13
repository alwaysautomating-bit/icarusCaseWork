import Link from "next/link";
import { notFound } from "next/navigation";
import { MonoLabel } from "@/app/casework-ui";
import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase } from "@/lib/case-access";
import { getCaseChildrenFoundReport } from "@/lib/case-children-found-report";
import { getCaseLindsayFoundReport } from "@/lib/case-lindsay-found-report";
import { childrenFoundReportHref, lindsayFoundReportHref } from "@/lib/case-routes";
import { referenceReports } from "@/lib/reference-reports";

export const dynamic = "force-dynamic";

function formatBytes(value: number) {
  if (value < 1_048_576) return `${(value / 1_024).toFixed(1)} KB`;
  return `${(value / 1_048_576).toFixed(1)} MB`;
}

export default async function ReferenceReportsPage({ params }: { params: Promise<{ caseId: string }> }) {
  const actor = await requireCaseActor();
  const { caseId } = await params;
  const [currentCase, childrenFoundReport, lindsayFoundReport] = await Promise.all([
    getAccessibleCase(actor.id, caseId),
    getCaseChildrenFoundReport(caseId),
    getCaseLindsayFoundReport(caseId),
  ]);
  if (!currentCase) notFound();

  return <main className="reference-reports-shell">
    <section className="reference-reports-heading">
      <div><MonoLabel>CASE LIBRARY · DOWNLOADABLE MATERIALS</MonoLabel><h1>Reference reports,<br />kept outside the facts.</h1><p>These supplied materials are available for research and source checking. Downloading or listing them here does not accept their contents into the canonical case record.</p></div>
      <aside><MonoLabel>GOVERNANCE BOUNDARY</MonoLabel><strong>REFERENCE ONLY</strong><p>Verify every claim against source-level evidence before citation. Icarus does not treat either download as an adjudicated fact, a reviewed event, or canonical testimony.</p></aside>
    </section>

    {(childrenFoundReport.available || lindsayFoundReport.available) && <section className="case-analysis-register" aria-labelledby="case-analysis-title">
      <header><div><MonoLabel>SOURCE-LINKED ANALYSIS</MonoLabel><h2 id="case-analysis-title">Case reports</h2></div><strong>{Number(childrenFoundReport.available) + Number(lindsayFoundReport.available)}</strong></header>
      <div className="case-analysis-grid">
      {childrenFoundReport.available &&
      <article className="case-analysis-card">
        <header><span>REPORT 01</span><b>SOURCE-COMPLETE</b></header>
        <div><MonoLabel>JANUARY 24 · SCENE TO MEDICAL OUTCOME</MonoLabel><h3>How the children were found</h3><p>A child-by-child report that keeps scene condition, responder care, hospital course, physical findings, and death determination separate.</p></div>
        <dl><div><dt>Subjects</dt><dd>{childrenFoundReport.subjects.length}</dd></div><div><dt>Exact sources</dt><dd>{childrenFoundReport.sources.length}</dd></div><div><dt>Held details</dt><dd>{childrenFoundReport.heldDetails.length}</dd></div></dl>
        <footer><Link href={childrenFoundReportHref(caseId)}>Open source-linked report →</Link><span>Two unverified details withheld</span></footer>
      </article>}
      {lindsayFoundReport.available && <article className="case-analysis-card lindsay">
        <header><span>REPORT 02</span><b>SOURCE-COMPLETE</b></header>
        <div><MonoLabel>JANUARY 24 · DISCOVERY TO HOSPITAL</MonoLabel><h3>How Lindsay was found</h3><p>A separate adult-subject report that keeps location, responsiveness, wound descriptions, emergency care, and hospital documentation source-specific.</p></div>
        <dl><div><dt>Subject</dt><dd>1</dd></div><div><dt>Exact sources</dt><dd>{lindsayFoundReport.sources.length}</dd></div><div><dt>Held details</dt><dd>{lindsayFoundReport.heldDetails.length}</dd></div></dl>
        <footer><Link href={lindsayFoundReportHref(caseId)}>Open source-linked report →</Link><span>Two unverified details withheld</span></footer>
      </article>}
      </div>
    </section>}

    <section className="reference-reports-register" aria-labelledby="reference-reports-title">
      <header><div><MonoLabel>AVAILABLE DOWNLOADS</MonoLabel><h2 id="reference-reports-title">Supplied case materials</h2></div><strong>{referenceReports.length}</strong></header>
      <div className="reference-report-grid">{referenceReports.map((report, index) => <article className="reference-report-card" key={report.id}>
        <header><span>{String(index + 1).padStart(2, "0")}</span><div><MonoLabel>{report.classification}</MonoLabel><h3>{report.title}</h3></div><b>NOT CANONICAL</b></header>
        <p>{report.description}</p>
        <div className="reference-report-boundary"><strong>USE BOUNDARY</strong><span>{report.boundary}</span></div>
        <dl><div><dt>Format</dt><dd>{report.format}</dd></div><div><dt>File size</dt><dd>{formatBytes(report.byteLength)}</dd></div><div><dt>SHA-256</dt><dd><code>{report.sha256}</code></dd></div></dl>
        <footer><a href={`/cases/${encodeURIComponent(currentCase.id)}/reports/${encodeURIComponent(report.id)}`} download={report.fileName}>Download {report.format} <span aria-hidden="true">↓</span></a><span>Case access required</span></footer>
      </article>)}</div>
    </section>
  </main>;
}
