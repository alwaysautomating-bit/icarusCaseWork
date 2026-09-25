import { notFound } from "next/navigation";
import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase } from "@/lib/case-access";
import { getCaseChildrenFoundReport } from "@/lib/case-children-found-report";
import { getCaseLindsayFoundReport } from "@/lib/case-lindsay-found-report";
import { childrenFoundReportHref, lindsayFoundReportHref } from "@/lib/case-routes";
import { referenceReports } from "@/lib/reference-reports";
import { ReportLibrary, type ReportLibraryEntry } from "./report-library";
import styles from "./reports.module.css";

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

  const entries: ReportLibraryEntry[] = [];

  if (childrenFoundReport.available) {
    entries.push({
      id: "children-found",
      category: "analysis",
      kind: "REPORT",
      title: "How the children were found",
      summary: "A child-by-child report that keeps scene condition, responder care, hospital course, physical findings, and death determination separate.",
      source: "Generated · source-linked analysis",
      meta: `${childrenFoundReport.subjects.length} subjects · ${childrenFoundReport.sources.length} exact sources`,
      status: "SOURCE-COMPLETE",
      statusTone: "reviewed",
      href: childrenFoundReportHref(caseId),
      actionLabel: "Open report",
      detail: `${childrenFoundReport.heldDetails.length} unverified details withheld`,
    });
  }

  if (lindsayFoundReport.available) {
    entries.push({
      id: "lindsay-found",
      category: "analysis",
      kind: "REPORT",
      title: "How Lindsay was found",
      summary: "A separate adult-subject report that keeps location, responsiveness, wound descriptions, emergency care, and hospital documentation source-specific.",
      source: "Generated · source-linked analysis",
      meta: `1 subject · ${lindsayFoundReport.sources.length} exact sources`,
      status: "SOURCE-COMPLETE",
      statusTone: "reviewed",
      href: lindsayFoundReportHref(caseId),
      actionLabel: "Open report",
      detail: `${lindsayFoundReport.heldDetails.length} unverified details withheld`,
    });
  }

  entries.push(...referenceReports.map((report): ReportLibraryEntry => ({
    id: report.id,
    category: "reference",
    kind: report.format === "Markdown" ? "MD" : report.format.toUpperCase(),
    title: report.title,
    summary: report.description,
    source: report.classification,
    meta: `${report.format} · ${formatBytes(report.byteLength)}`,
    status: "NOT CANONICAL",
    statusTone: "neutral",
    href: `/cases/${encodeURIComponent(currentCase.id)}/reports/${encodeURIComponent(report.id)}`,
    actionLabel: `Download ${report.format}`,
    download: report.fileName,
    detail: report.boundary,
    checksum: report.sha256,
  })));

  return (
    <main className={styles.shell}>
      <div className={styles.inner}>
        <header className={styles.pageHeader}>
          <p className={styles.eyebrow}>CASE FILES · REPORTS</p>
          <h1>Documents organized by kind.</h1>
          <p className={styles.lede}>Source material and generated analysis for the case, grouped by document type. Each entry shows what it is, where it came from, and its review status.</p>
        </header>

        <aside className={styles.boundary} aria-label="Report governance boundary">
          <strong>REFERENCE BOUNDARY</strong>
          <span>Listing a document here does not make its contents canonical. Verify claims against source-level evidence before citation.</span>
        </aside>

        <ReportLibrary entries={entries} />
      </div>
    </main>
  );
}
