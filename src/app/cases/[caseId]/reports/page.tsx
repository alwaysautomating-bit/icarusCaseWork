import { notFound } from "next/navigation";
import { MonoLabel } from "@/app/casework-ui";
import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase } from "@/lib/case-access";
import { referenceReports } from "@/lib/reference-reports";

export const dynamic = "force-dynamic";

function formatBytes(value: number) {
  if (value < 1_048_576) return `${(value / 1_024).toFixed(1)} KB`;
  return `${(value / 1_048_576).toFixed(1)} MB`;
}

export default async function ReferenceReportsPage({ params }: { params: Promise<{ caseId: string }> }) {
  const actor = await requireCaseActor();
  const { caseId } = await params;
  const currentCase = await getAccessibleCase(actor.id, caseId);
  if (!currentCase) notFound();

  return <main className="reference-reports-shell">
    <section className="reference-reports-heading">
      <div><MonoLabel>CASE LIBRARY · DOWNLOADABLE MATERIALS</MonoLabel><h1>Reference reports,<br />kept outside the facts.</h1><p>These supplied materials are available for research and source checking. Downloading or listing them here does not accept their contents into the canonical case record.</p></div>
      <aside><MonoLabel>GOVERNANCE BOUNDARY</MonoLabel><strong>REFERENCE ONLY</strong><p>Verify every claim against source-level evidence before citation. Icarus does not treat either download as an adjudicated fact, a reviewed event, or canonical testimony.</p></aside>
    </section>

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
