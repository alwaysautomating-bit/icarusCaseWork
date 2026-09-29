import Link from "next/link";
import { notFound } from "next/navigation";
import { Chip, EmptyState, MonoLabel, PageHeader, Stepper, type StepState } from "@/app/casework-ui";
import { SubmitButton } from "@/app/cases/[caseId]/_components/submit-button";
import { requireCaseActor } from "@/lib/authority";
import { canReviewStructure, getAccessibleCase } from "@/lib/case-access";
import { documentsHref, type DocumentsStage } from "@/lib/case-routes";
import { ACCEPTED_EXTENSIONS, DOCUMENT_TYPE_LABELS, documentTypes, getDocument, listDocuments, SUMMARY_FIELDS, type DocumentMeta } from "@/lib/document-summaries";
import { setDocumentConfirmationAction, uploadDocumentAction } from "./actions";

export const dynamic = "force-dynamic";

type SearchState = { doc?: string; stage?: string; message?: string; error?: string };

// The Document Intake flow from the design system: Upload → Parsing → Review → Confirmed.
const STAGES: DocumentsStage[] = ["upload", "parsing", "review", "confirmed"];

function formatBytes(value: number) {
  return value < 1_048_576 ? `${(value / 1_024).toFixed(0)} KB` : `${(value / 1_048_576).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function stageFor(doc: DocumentMeta): DocumentsStage {
  if (doc.confirmedAt) return "confirmed";
  return doc.status === "summarized" ? "review" : "parsing";
}

function StatusChip({ doc }: { doc: DocumentMeta }) {
  if (doc.confirmedAt) return <Chip tone="verified">Confirmed</Chip>;
  return doc.status === "summarized" ? <Chip tone="candidate">Summarized · to check</Chip> : <Chip tone="discrepancy">Summary failed</Chip>;
}

export default async function DocumentsPage({ params, searchParams }: { params: Promise<{ caseId: string }>; searchParams: Promise<SearchState> }) {
  const [actor, { caseId }, query] = await Promise.all([requireCaseActor(), params, searchParams]);
  const currentCase = await getAccessibleCase(actor.id, caseId);
  if (!currentCase) notFound();
  const canUpload = canReviewStructure(currentCase.membershipRole);

  const documents = await listDocuments(caseId);
  const summarized = documents.filter((doc) => doc.status === "summarized");
  const inReview = summarized.filter((doc) => !doc.confirmedAt);
  const confirmed = summarized.filter((doc) => doc.confirmedAt);
  const selected = query.doc ? await getDocument(caseId, query.doc) : null;
  const stage: DocumentsStage = STAGES.find((item) => item === query.stage)
    ?? (selected ? stageFor(selected.meta) : documents.length ? "review" : "upload");
  const fields = selected ? SUMMARY_FIELDS[selected.meta.type] : [];
  const result = selected?.summary?.result ?? {};
  const listed = stage === "confirmed" ? confirmed : inReview;
  const showSummary = Boolean(selected && selected.meta.status === "summarized" && (stage === "confirmed") === Boolean(selected.meta.confirmedAt));

  const stepState = (step: DocumentsStage, done: boolean): StepState => stage === step ? "active" : done ? "done" : "upcoming";

  return <main className="documents-shell">
    <PageHeader
      eyebrow="CASE FILES · DOCUMENT INTAKE"
      title="Add a document, get a summary."
      lede="Upload a search warrant or another document. Icarus keeps the original file, reads it, and writes a plain-language summary you can check against the source. Nothing here is added to the case record."
    />

    <Stepper label="Document intake stage" steps={[
      { num: "01", label: "Upload", state: stepState("upload", documents.length > 0), href: documentsHref(caseId, { stage: "upload" }) },
      { num: "02", label: `Parsing${documents.length ? ` (${documents.length})` : ""}`, state: stepState("parsing", documents.length > 0), href: documentsHref(caseId, { stage: "parsing" }) },
      { num: "03", label: `Review${inReview.length ? ` (${inReview.length})` : ""}`, state: stepState("review", summarized.length > 0 && inReview.length === 0), href: documentsHref(caseId, { stage: "review" }) },
      { num: "04", label: `Confirmed${confirmed.length ? ` (${confirmed.length})` : ""}`, state: stepState("confirmed", false), href: documentsHref(caseId, { stage: "confirmed" }) },
    ]} />

    {(query.message || query.error) ? <p className={`ds-notice ${query.error ? "error" : "success"}`} role={query.error ? "alert" : "status"}>{query.error ?? query.message}</p> : null}

    {stage === "upload" ? (canUpload ? <section className="documents-upload ds-dropzone" aria-labelledby="documents-upload-title">
      <span className="ds-eyebrow">ADD A DOCUMENT</span>
      <h3 id="documents-upload-title">Choose a file to summarize</h3>
      <p>Accepted: {ACCEPTED_EXTENSIONS.join(", ")} · up to 30 MB. The file is read by LlamaParse to produce the summary, and the original is kept unchanged.</p>
      <form action={uploadDocumentAction.bind(null, caseId)}>
        <label className="documents-file"><span>File</span><input name="document" type="file" required accept={ACCEPTED_EXTENSIONS.join(",")} /></label>
        <label><span>Type</span><select name="type" defaultValue="search-warrant">{documentTypes.map((type) => <option value={type} key={type}>{DOCUMENT_TYPE_LABELS[type]}</option>)}</select></label>
        <SubmitButton pendingLabel="Reading and summarizing… this can take a minute">Upload and summarize</SubmitButton>
      </form>
    </section> : <div className="ds-empty"><strong>Only the case owner and reviewers can add documents.</strong><p>Documents they add appear under Parsing, Review and Confirmed.</p></div>) : null}

    {stage === "parsing" ? <section className="documents-parsing" aria-label="Parsing results">
      <MonoLabel>PARSED FILES · {documents.length}</MonoLabel>
      <p className="documents-stage-note">Each upload is read by LlamaParse and then summarized. The original file is kept unchanged either way.</p>
      {documents.length ? <ul className="documents-parse-list">{documents.map((doc) => <li key={doc.id}>
        <div className="documents-parse-name"><strong>{doc.name}</strong><span>{DOCUMENT_TYPE_LABELS[doc.type]} · {formatBytes(doc.byteLength)} · uploaded {formatDate(doc.uploadedAt)}</span></div>
        {doc.status === "summarized"
          ? <p>Text read from {doc.pageCount ?? "an unknown number of"} page{doc.pageCount === 1 ? "" : "s"}. <a href={`/cases/${encodeURIComponent(caseId)}/documents/${doc.id}/parsed`}>Download extracted text</a></p>
          : <p className="documents-parse-error">{doc.error ?? "The summary could not be created."} The original was kept; upload it again to retry.</p>}
        <div className="documents-parse-actions">
          <StatusChip doc={doc} />
          {doc.status === "summarized" ? <Link href={documentsHref(caseId, { doc: doc.id, stage: stageFor(doc) })}>Open summary →</Link> : null}
        </div>
      </li>)}</ul> : <EmptyState>No documents yet. Upload one to see its parse result here.</EmptyState>}
    </section> : null}

    {stage === "review" || stage === "confirmed" ? <div className="documents-body">
      <aside className="documents-list" aria-label={stage === "confirmed" ? "Confirmed documents" : "Documents to review"}>
        <MonoLabel>{stage === "confirmed" ? "CONFIRMED" : "TO REVIEW"} · {listed.length}</MonoLabel>
        {listed.length ? <ul>{listed.map((doc) => <li key={doc.id}>
          <Link href={documentsHref(caseId, { doc: doc.id, stage })} aria-current={selected?.meta.id === doc.id ? "page" : undefined}>
            <strong>{doc.name}</strong>
            <span>{DOCUMENT_TYPE_LABELS[doc.type]} · {formatDate(doc.uploadedAt)}</span>
            <StatusChip doc={doc} />
          </Link>
        </li>)}</ul> : <EmptyState>{stage === "confirmed" ? "No summaries have been confirmed yet." : "No summaries are waiting for review."}</EmptyState>}
      </aside>

      <section className="documents-summary" aria-live="polite">
        {selected && showSummary ? <>
          <header>
            <MonoLabel>{DOCUMENT_TYPE_LABELS[selected.meta.type].toUpperCase()} · SUMMARY</MonoLabel>
            <h2>{selected.meta.name}</h2>
            <p>{formatBytes(selected.meta.byteLength)}{selected.meta.pageCount ? ` · ${selected.meta.pageCount} page${selected.meta.pageCount === 1 ? "" : "s"}` : ""} · uploaded {formatDate(selected.meta.uploadedAt)}{selected.meta.confirmedAt ? ` · confirmed ${formatDate(selected.meta.confirmedAt)}` : ""}</p>
            <div className="documents-links">
              <a href={`/cases/${encodeURIComponent(caseId)}/documents/${selected.meta.id}/original`} target="_blank" rel="noreferrer">Open original ↗</a>
              {selected.summary ? <a href={`/cases/${encodeURIComponent(caseId)}/documents/${selected.meta.id}/parsed`}>Download extracted text</a> : null}
            </div>
          </header>
          <div className="ds-callout"><strong>Machine-generated summary</strong><p>It is built from text read out of the file and can miss or misread details, especially in scans. Check anything you rely on against the original.</p></div>
          <dl className="documents-fields">
            {fields.map((field) => {
              const value = result[field.key];
              const items = Array.isArray(value) ? value.map(String).filter(Boolean) : typeof value === "string" && value.trim() ? [value.trim()] : [];
              if (!items.length) return null;
              return <div className={field.key === "summary" ? "lead" : field.key === "unclear_or_missing" ? "unclear" : undefined} key={field.key}>
                <dt>{field.label}</dt>
                <dd>{field.kind === "list" ? <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p>{items[0]}</p>}</dd>
              </div>;
            })}
          </dl>
          {canUpload ? <form className="documents-confirm" action={setDocumentConfirmationAction.bind(null, caseId, selected.meta.id, !selected.meta.confirmedAt)}>
            <p>{selected.meta.confirmedAt ? "Confirmed as checked against the original. This does not add the document to the case record." : "Checked this summary against the original? Confirming records that check. It does not add the document to the case record."}</p>
            <SubmitButton pendingLabel="Saving…">{selected.meta.confirmedAt ? "Return to review" : "Confirm summary"}</SubmitButton>
          </form> : null}
        </> : <div className="ds-empty"><strong>Select a document to read its summary.</strong><p>{listed.length ? "Choose one from the list." : stage === "confirmed" ? "Summaries appear here once they have been checked and confirmed." : canUpload ? "Upload a search warrant to get started." : "Documents added by the case owner will appear here."}</p></div>}
      </section>
    </div> : null}
  </main>;
}
