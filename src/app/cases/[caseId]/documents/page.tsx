import Link from "next/link";
import { notFound } from "next/navigation";
import { MonoLabel } from "@/app/casework-ui";
import { SubmitButton } from "@/app/cases/[caseId]/_components/submit-button";
import { requireCaseActor } from "@/lib/authority";
import { canReviewStructure, getAccessibleCase } from "@/lib/case-access";
import { documentsHref } from "@/lib/case-routes";
import { ACCEPTED_EXTENSIONS, DOCUMENT_TYPE_LABELS, documentTypes, getDocument, listDocuments, SUMMARY_FIELDS } from "@/lib/document-summaries";
import { uploadDocumentAction } from "./actions";

export const dynamic = "force-dynamic";

type SearchState = { doc?: string; message?: string; error?: string };

function formatBytes(value: number) {
  return value < 1_048_576 ? `${(value / 1_024).toFixed(0)} KB` : `${(value / 1_048_576).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function DocumentsPage({ params, searchParams }: { params: Promise<{ caseId: string }>; searchParams: Promise<SearchState> }) {
  const [actor, { caseId }, query] = await Promise.all([requireCaseActor(), params, searchParams]);
  const currentCase = await getAccessibleCase(actor.id, caseId);
  if (!currentCase) notFound();
  const canUpload = canReviewStructure(currentCase.membershipRole);

  const documents = await listDocuments(caseId);
  const selected = query.doc ? await getDocument(caseId, query.doc) : null;
  const fields = selected ? SUMMARY_FIELDS[selected.meta.type] : [];
  const result = selected?.summary?.result ?? {};

  return <main className="documents-shell">
    <header className="documents-head">
      <MonoLabel>DOCUMENTS · UPLOAD AND SUMMARIZE</MonoLabel>
      <h1>Add a document, get a summary.</h1>
      <p>Upload a search warrant or another document. Icarus keeps the original file, reads it, and writes a plain-language summary you can check against the source. Nothing here is added to the case record.</p>
    </header>

    {(query.message || query.error) ? <p className={`core-timeline-notice ${query.error ? "error" : "success"}`} role={query.error ? "alert" : "status"}>{query.error ?? query.message}</p> : null}

    {canUpload ? <section className="documents-upload" aria-labelledby="documents-upload-title">
      <h2 id="documents-upload-title">Add a document</h2>
      <form action={uploadDocumentAction.bind(null, caseId)}>
        <label className="documents-file"><span>File</span><input name="document" type="file" required accept={ACCEPTED_EXTENSIONS.join(",")} /></label>
        <label><span>Type</span><select name="type" defaultValue="search-warrant">{documentTypes.map((type) => <option value={type} key={type}>{DOCUMENT_TYPE_LABELS[type]}</option>)}</select></label>
        <SubmitButton pendingLabel="Reading and summarizing… this can take a minute">Upload and summarize</SubmitButton>
      </form>
      <small>Accepted: {ACCEPTED_EXTENSIONS.join(", ")} · up to 30 MB. The file is read by LlamaParse to produce the summary.</small>
    </section> : null}

    <div className="documents-body">
      <aside className="documents-list" aria-label="Uploaded documents">
        <MonoLabel>UPLOADED · {documents.length}</MonoLabel>
        {documents.length ? <ul>{documents.map((doc) => <li key={doc.id}>
          <Link href={documentsHref(caseId, { doc: doc.id })} aria-current={selected?.meta.id === doc.id ? "page" : undefined}>
            <strong>{doc.name}</strong>
            <span>{DOCUMENT_TYPE_LABELS[doc.type]} · {formatDate(doc.uploadedAt)}</span>
            <em className={doc.status}>{doc.status === "summarized" ? "Summarized" : "Summary failed"}</em>
          </Link>
        </li>)}</ul> : <p className="foundation-empty">No documents yet.</p>}
      </aside>

      <section className="documents-summary" aria-live="polite">
        {selected ? <>
          <header>
            <MonoLabel>{DOCUMENT_TYPE_LABELS[selected.meta.type].toUpperCase()} · SUMMARY</MonoLabel>
            <h2>{selected.meta.name}</h2>
            <p>{formatBytes(selected.meta.byteLength)}{selected.meta.pageCount ? ` · ${selected.meta.pageCount} page${selected.meta.pageCount === 1 ? "" : "s"}` : ""} · uploaded {formatDate(selected.meta.uploadedAt)}</p>
            <div className="documents-links">
              <a href={`/cases/${encodeURIComponent(caseId)}/documents/${selected.meta.id}/original`} target="_blank" rel="noreferrer">Open original ↗</a>
              {selected.summary ? <a href={`/cases/${encodeURIComponent(caseId)}/documents/${selected.meta.id}/parsed`}>Download extracted text</a> : null}
            </div>
          </header>
          {selected.meta.status === "failed" ? <div className="documents-failed" role="alert"><strong>The summary could not be created.</strong><p>{selected.meta.error}</p><p>The original file was kept. Upload it again to retry.</p></div> : <>
            <p className="documents-boundary"><strong>Machine-generated summary.</strong> It is built from text read out of the file and can miss or misread details, especially in scans. Check anything you rely on against the original.</p>
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
          </>}
        </> : <div className="documents-empty"><strong>Select a document to read its summary.</strong><p>{documents.length ? "Choose one from the list." : canUpload ? "Upload a search warrant to get started." : "Documents added by the case owner will appear here."}</p></div>}
      </section>
    </div>
  </main>;
}
