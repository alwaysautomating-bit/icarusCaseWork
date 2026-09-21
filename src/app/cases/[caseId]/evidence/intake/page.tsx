import Link from "next/link";
import { notFound } from "next/navigation";
import { Callout, PageHeader, Stepper, type StepState } from "@/app/casework-ui";
import { CandidateReviewForm } from "@/app/cases/[caseId]/evidence/intake/_components/candidate-review-form";
import { UploadForm } from "@/app/cases/[caseId]/evidence/intake/_components/upload-form";
import { requireCaseActor } from "@/lib/authority";
import { canReviewStructure, getAccessibleCase } from "@/lib/case-access";
import { caseFilesHref, courtPacketIntakeHref, courtRecordHref, evidenceHref } from "@/lib/case-routes";
import { documentTypeLabel } from "@/lib/court-packet-labels";
import { getCourtPacketWorkspace, type CourtPacketCandidate, type CourtPacketDocument } from "@/lib/court-packet-workspace";
import { getSupportingMediaLibrary } from "@/lib/supporting-media";

export const dynamic = "force-dynamic";

type SearchState = { stage?: string; candidate?: string; message?: string; error?: string };

function formatBytes(value: number | null) {
  if (!value) return null;
  if (value < 1_048_576) return `${(value / 1_024).toFixed(0)} KB`;
  return `${(value / 1_048_576).toFixed(1)} MB`;
}

function reviewStateTag(candidate: CourtPacketCandidate) {
  if (candidate.reviewStatus === "review_required") return <span className="state-tag candidate"><span className="dot" />Review candidate</span>;
  if (candidate.reviewStatus === "accepted" || candidate.reviewStatus === "amended") return <span className="state-tag confirmed"><span className="dot" />Confirmed</span>;
  if (candidate.reviewStatus === "rejected") return <span className="state-tag rejected"><span className="dot" />Rejected</span>;
  return <span className="state-tag deferred"><span className="dot" />Deferred</span>;
}

export default async function CourtPacketIntakePage({ params, searchParams }: { params: Promise<{ caseId: string }>; searchParams: Promise<SearchState> }) {
  const [actor, { caseId }, query] = await Promise.all([requireCaseActor(), params, searchParams]);
  const [currentCase, workspace, mediaLibrary] = await Promise.all([
    getAccessibleCase(actor.id, caseId),
    getCourtPacketWorkspace(caseId),
    getSupportingMediaLibrary(caseId),
  ]);
  if (!currentCase) notFound();
  const canReview = canReviewStructure(currentCase.membershipRole);

  const openCandidates = workspace.candidates.filter((candidate) => candidate.reviewStatus === "review_required");
  const decidedCandidates = workspace.candidates.filter((candidate) => candidate.reviewStatus !== "review_required");
  const defaultStage = !workspace.run ? "upload" : openCandidates.length > 0 ? "review" : "confirmed";
  const stage = query.stage === "upload" || query.stage === "review" || query.stage === "confirmed" ? query.stage : defaultStage;

  const pageCount = workspace.run?.pageCount ?? 0;
  const ruler = workspace.candidates.map((candidate) => ({ candidate, span: candidate.endPage - candidate.startPage + 1 }));

  function firstSegmentHref(sourceSegmentIds: string[]) {
    return sourceSegmentIds[0] ? courtRecordHref(caseId, { segmentId: sourceSegmentIds[0] }) : null;
  }

  const recentFiles = mediaLibrary.items.slice(0, 3);
  const topFolders = mediaLibrary.folders.slice(0, 3);

  const uploadState: StepState = stage === "upload" ? "active" : workspace.run ? "done" : "upcoming";
  const reviewState: StepState = stage === "review" ? "active" : workspace.run && openCandidates.length === 0 ? "done" : "upcoming";
  const confirmedState: StepState = stage === "confirmed" ? "active" : "upcoming";
  const packetMeta = workspace.run ? [`${pageCount} pages`, `Parsed ${new Date(workspace.run.createdAt).toLocaleDateString()}`, formatBytes(workspace.artifactByteLength)].filter(Boolean).join(" · ") : "No packet has been uploaded for this case yet.";

  return <main className="intake-page">
    <PageHeader
      eyebrow="CASE FILES · COURT PACKET INTAKE"
      title={workspace.run ? workspace.artifactTitle ?? "Court packet" : "Add a court packet to the case."}
      lede={packetMeta}
    />
    <div className="intake-shell">
    <div className="intake-main-col">
      {workspace.run ? <Callout label="ORIGINAL PRESERVED">The original file is preserved unchanged. Page divisions below are proposed groupings, not edits to the source document.</Callout> : null}

      <Stepper label="Court packet intake stage" steps={[
        { num: "01", label: "Upload", state: uploadState, href: courtPacketIntakeHref(caseId, { stage: "upload" }) },
        { num: "02", label: "Parsing", state: workspace.run ? "done" : "upcoming" },
        { num: "03", label: `Review${workspace.run ? ` (${openCandidates.length})` : ""}`, state: reviewState, href: workspace.run ? courtPacketIntakeHref(caseId, { stage: "review" }) : undefined },
        { num: "04", label: `Confirmed${workspace.documents.length ? ` (${workspace.documents.length})` : ""}`, state: confirmedState, href: workspace.run ? courtPacketIntakeHref(caseId, { stage: "confirmed" }) : undefined },
      ]} />

      {(query.message || query.error) && <p className={`ds-notice ${query.error ? "error" : "success"}`} role={query.error ? "alert" : "status"}>{query.error ?? query.message}</p>}

      {stage === "upload" && <div className="stage active">
        {!canReview ? <p className="intake-readonly">Your current case membership is read-only for court packet intake.</p> : <UploadForm caseId={caseId} caseTitle={currentCase.title} />}
        <p className="intake-config-note">Live parsing requires <code>LLAMA_CLOUD_API_KEY</code> to be configured for this environment.</p>
      </div>}

      {stage === "review" && <div className="stage active">
        {!workspace.run ? <p className="intake-empty">No packet has been uploaded yet.</p> : <>
          <div className="ruler-wrap">
            <div className="ruler-label">Packet map — {pageCount} pages</div>
            <div className="ruler">{ruler.map(({ candidate, span }) => <div className="seg" style={{ flex: span }} key={candidate.id} title={`${documentTypeLabel(candidate.documentType)} · pages ${candidate.startPage}–${candidate.endPage}`}>{candidate.startPage === candidate.endPage ? candidate.startPage : `${candidate.startPage}–${candidate.endPage}`}</div>)}</div>
          </div>
          {openCandidates.length === 0 ? <p className="intake-empty">Every proposed document boundary has been reviewed. See Confirmed.</p> : <div className="doc-list">
            {openCandidates.map((candidate) => <article className="doc-card" key={candidate.id}>
              <div className="doc-top">
                <div><div className="doc-title">{documentTypeLabel(candidate.documentType)}</div><div className="doc-range">Pages {candidate.startPage}–{candidate.endPage}</div></div>
                {reviewStateTag(candidate)}
              </div>
              <div className="doc-proposed">Proposed by LlamaParse packet agent{candidate.possibleDuplicateOf.length > 0 ? ` · possible duplicate of ${candidate.possibleDuplicateOf.length} other candidate${candidate.possibleDuplicateOf.length === 1 ? "" : "s"}` : ""}</div>
              <CandidateReviewForm caseId={caseId} candidate={candidate} canReview={canReview} />
              {firstSegmentHref(candidate.sourceSegmentIds) && <Link href={firstSegmentHref(candidate.sourceSegmentIds)!} className="doc-view-pages">View pages →</Link>}
            </article>)}
          </div>}
          {decidedCandidates.length > 0 && <details className="intake-decided"><summary>{decidedCandidates.length} previously decided candidate{decidedCandidates.length === 1 ? "" : "s"}</summary><div className="doc-list">
            {decidedCandidates.map((candidate) => <article className="doc-card decided" key={candidate.id}>
              <div className="doc-top"><div><div className="doc-title">{documentTypeLabel(candidate.documentType)}</div><div className="doc-range">Pages {candidate.startPage}–{candidate.endPage}</div></div>{reviewStateTag(candidate)}</div>
            </article>)}
          </div></details>}
        </>}
      </div>}

      {stage === "confirmed" && <div className="stage active">
        {workspace.documents.length === 0 ? <p className="intake-empty">No document boundaries have been confirmed yet.</p> : <>
          <div className="ruler-wrap">
            <div className="ruler-label">Packet map — {pageCount} pages · confirmed</div>
            <div className="ruler">{ruler.map(({ candidate, span }) => <div className="seg" style={{ flex: span }} key={candidate.id}>{candidate.startPage === candidate.endPage ? candidate.startPage : `${candidate.startPage}–${candidate.endPage}`}</div>)}</div>
          </div>
          <div className="doc-list">{workspace.documents.map((document: CourtPacketDocument) => <article className="doc-card" key={document.id}>
            <div className="doc-top"><div><div className="doc-title">{documentTypeLabel(document.documentType)}</div><div className="doc-range">Pages {document.startPage}–{document.endPage}</div></div><span className="state-tag confirmed"><span className="dot" />Confirmed</span></div>
            {firstSegmentHref(document.sourceSegmentIds) && <div className="doc-actions"><Link href={firstSegmentHref(document.sourceSegmentIds)!} className="doc-view-pages">View pages →</Link></div>}
          </article>)}</div>
        </>}
      </div>}
    </div>

    <aside className="right-panel">
      <div className="side-card">
        <div className="head">Quick access <span className="count">{workspace.run ? 1 : 0}</span></div>
        <div className="body">
          {workspace.run ? <div className="file-row"><span>{workspace.artifactTitle ?? "Court packet"}</span><span className="meta">{formatBytes(workspace.artifactByteLength) ?? `${pageCount}p`}</span></div> : <div className="file-row"><span>No packet uploaded yet</span></div>}
        </div>
      </div>
      <div className="side-card">
        <div className="head">Case files <span className="count">{mediaLibrary.folders.length} folders</span></div>
        <div className="body">
          {topFolders.map((folder) => <div className="file-row" key={folder.id}><span>{folder.name}/</span><span className="meta">—</span></div>)}
          {recentFiles.map((item) => <div className="file-row" key={item.id}><span>{item.original_filename}</span><span className="meta">{formatBytes(item.byte_length)}</span></div>)}
          <div className="file-row"><Link href={caseFilesHref(caseId)}>Open case files →</Link></div>
        </div>
      </div>
      <div className="side-card">
        <div className="head">Evidence</div>
        <div className="body"><div className="file-row"><Link href={evidenceHref(caseId)}>Open Evidence →</Link></div></div>
      </div>
    </aside>
    </div>
  </main>;
}
