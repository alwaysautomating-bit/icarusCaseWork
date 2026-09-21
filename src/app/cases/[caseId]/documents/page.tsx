import Link from "next/link";
import { notFound } from "next/navigation";
import { Chip, EmptyState, MonoLabel, PageHeader } from "@/app/casework-ui";
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
    <PageHeader
      eyebrow="CASE FILES · DOCUMENT INTAKE"
      title="Add a document, get a summary."
      lede="Upload a search warrant or another document. Icarus keeps the original file, reads it, and writes a plain-language summary you can check against the source. Nothing here is added to the case record."
    />

    {(query.message || query.error) ? <p className={`ds-notice ${query.error ? "error" : "success"}`} role={query.error ? "alert" : "status"}>{query.error ?? query.message}</p> : null}

    {canUpload ? <section className="documents-upload ds-dropzone" aria-labelledby="documents-upload-title">
      <span className="ds-eyebrow">ADD A DOCUMENT</span>
      <h3 id="documents-upload-title">Choose a file to summarize</h3>
      <p>Accepted: {ACCEPTED_EXTENSIONS.join(", ")} · up to 30 MB. The file is read by LlamaParse to produce the summary, and the original is kept unchanged.</p>
      <form action={uploadDocumentAction.bind(null, caseId)}>
        <label className="documents-file"><span>File</span><input name="document" type="file" required accept={ACCEPTED_EXTENSIONS.join(",")} /></label>
        <label><span>Type</span><select name="type" defaultValue="search-warrant">{documentTypes.map((type) => <option value={type} key={type}>{DOCUMENT_TYPE_LABELS[type]}</option>)}</select></label>
        <SubmitButton pendingLabel="Reading and summarizing… this can take a minute">Upload and summarize</SubmitButton>
      </form>
    </section> : null}

    <div className="documents-body">
      <aside className="documents-list" aria-label="Uploaded documents">
        <MonoLabel>UPLOADED · {documents.length}</MonoLabel>
        {documents.length ? <ul>{documents.map((doc) => <li key={doc.id}>
          <Link href={documentsHref(caseId, { doc: doc.id })} aria-current={selected?.meta.id === doc.id ? "page" : undefined}>
            <strong>{doc.name}</strong>
            <span>{DOCUMENT_TYPE_LABELS[doc.type]} · {formatDate(doc.uploadedAt)}</span>
            <Chip tone={doc.status === "summarized" ? "verified" : "discrepancy"}>{doc.status === "summarized" ? "Summarized" : "Summary failed"}</Chip>
          </Link>
        </li>)}</ul> : <EmptyState>No documents yet.</EmptyState>}
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
          {selected.meta.status === "failed" ? <div className="ds-error" role="alert"><strong>Summary unavailable</strong><p>The summary could not be created. {selected.meta.error}</p><p>The original file was kept. Upload it again to retry.</p></div> : <>
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
          </>}
        </> : <div className="ds-empty"><strong>Select a document to read its summary.</strong><p>{documents.length ? "Choose one from the list." : canUpload ? "Upload a search warrant to get started." : "Documents added by the case owner will appear here."}</p></div>}
      </section>
    </div>
  </main>;
}
