import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MonoLabel, PageHeader, Callout } from "@/app/casework-ui";
import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase } from "@/lib/case-access";
import { caseFilesHref, questionsHref } from "@/lib/case-routes";
import { getSupportingMediaLibrary } from "@/lib/supporting-media";
import { createSupportingFolderAction, deleteSupportingImageAction, moveSupportingImageAction, uploadSupportingImageAction } from "./actions";
import { SubmitButton } from "@/app/cases/[caseId]/_components/submit-button";

export const dynamic = "force-dynamic";

type SearchState = { folder?: string; message?: string; error?: string };

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function askAboutImageHref(caseId: string, item: { id: string; caption: string; original_filename: string; folder_id: string | null }) {
  const folderHref = `${caseFilesHref(caseId)}?folder=${encodeURIComponent(item.folder_id ?? "unfiled")}`;
  const params = new URLSearchParams({
    ask: "1",
    promptType: "supporting_image",
    promptId: item.id,
    promptLabel: item.caption || item.original_filename,
    promptHref: folderHref,
  });
  return `${questionsHref(caseId)}?${params.toString()}`;
}

export default async function SupportingFilesPage({ params, searchParams }: { params: Promise<{ caseId: string }>; searchParams: Promise<SearchState> }) {
  const actor = await requireCaseActor();
  const [{ caseId }, query] = await Promise.all([params, searchParams]);
  const [currentCase, library] = await Promise.all([getAccessibleCase(actor.id, caseId), getSupportingMediaLibrary(caseId)]);
  if (!currentCase) notFound();

  const selectedFolder = query.folder === "unfiled" || library.folders.some((folder) => folder.id === query.folder) ? query.folder : "all";
  const visibleItems = selectedFolder === "all"
    ? library.items
    : selectedFolder === "unfiled"
      ? library.items.filter((item) => item.folder_id === null)
      : library.items.filter((item) => item.folder_id === selectedFolder);
  const canContribute = currentCase.membershipRole !== "viewer";

  return <main className="supporting-files-shell">
    <PageHeader eyebrow="SUPPORTING REFERENCE LIBRARY" title="Pictures and screenshots" lede="Organize visual context for the case without treating it as established fact." aside={<Callout label="NOT CANONICAL" tone="risk">Nothing uploaded here becomes testimony, a historical event, or a factual finding. There is no OCR, extraction, or automatic promotion.</Callout>} />

    {(query.message || query.error) && <p className={`supporting-files-notice ${query.error ? "error" : "success"}`} role={query.error ? "alert" : "status"}>{query.error ?? query.message}</p>}

    <div className="supporting-files-workspace">
      <aside className="supporting-folder-rail">
        <header><MonoLabel>FOLDERS</MonoLabel><strong>{library.folders.length}</strong></header>
        <nav aria-label="Supporting image folders">
          <Link aria-current={selectedFolder === "all" ? "page" : undefined} href={caseFilesHref(caseId)}>All pictures <span>{library.items.length}</span></Link>
          <Link aria-current={selectedFolder === "unfiled" ? "page" : undefined} href={`${caseFilesHref(caseId)}?folder=unfiled`}>Unfiled <span>{library.items.filter((item) => item.folder_id === null).length}</span></Link>
          {library.folders.map((folder) => <Link aria-current={selectedFolder === folder.id ? "page" : undefined} href={`${caseFilesHref(caseId)}?folder=${folder.id}`} key={folder.id}>{folder.name}<span>{library.items.filter((item) => item.folder_id === folder.id).length}</span></Link>)}
        </nav>
        {canContribute && <form action={createSupportingFolderAction.bind(null, caseId)} className="supporting-folder-form">
          <label htmlFor="new-folder-name">New folder</label>
          <input id="new-folder-name" name="name" maxLength={80} required placeholder="e.g. Scene screenshots" />
          <SubmitButton pendingLabel="Creating…">Create folder</SubmitButton>
        </form>}
      </aside>

      <section className="supporting-file-library">
        {canContribute && <form action={uploadSupportingImageAction.bind(null, caseId)} className="supporting-upload-form">
          <header><div><MonoLabel>ADD PICTURE</MonoLabel><h2>Upload supporting context</h2></div><span>JPEG · PNG · WEBP · GIF · AVIF · 4 MB MAX</span></header>
          <label className="supporting-file-picker" htmlFor="supporting-image"><span>Image file *</span><input id="supporting-image" name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" required /><small>The original file is preserved locally. No image analysis runs.</small></label>
          <label>Folder<select name="folderId" defaultValue={selectedFolder !== "all" && selectedFolder !== "unfiled" ? selectedFolder : ""}><option value="">Unfiled</option>{library.folders.map((folder) => <option value={folder.id} key={folder.id}>{folder.name}</option>)}</select></label>
          <label>Caption<input name="caption" maxLength={240} placeholder="What should you recognize at a glance?" /></label>
          <label className="wide">Context note<textarea name="contextNote" rows={3} maxLength={2000} placeholder="Why this picture may be useful; source or limitations if known." /></label>
          <div className="supporting-boundary-note"><strong>Supporting reference only.</strong><span>This upload will not modify the court record or create facts, claims, events, or timeline entries.</span></div>
          <SubmitButton pendingLabel="Uploading…">Upload picture</SubmitButton>
        </form>}

        <header className="supporting-library-heading"><div><MonoLabel>VISIBLE IN THIS FOLDER</MonoLabel><h2>{selectedFolder === "all" ? "All pictures" : selectedFolder === "unfiled" ? "Unfiled" : library.folders.find((folder) => folder.id === selectedFolder)?.name}</h2></div><strong>{visibleItems.length}</strong></header>
        {visibleItems.length === 0 ? <div className="supporting-empty"><h3>No pictures here yet.</h3><p>{canContribute ? "Upload a screenshot or photo above, or choose another folder." : "This folder does not contain any supporting pictures."}</p></div> : <div className="supporting-media-grid">
          {visibleItems.map((item) => <article className="supporting-media-card" key={item.id}>
            <div className="supporting-media-preview"><Image src={`/api/cases/${encodeURIComponent(caseId)}/media/${encodeURIComponent(item.id)}`} alt={item.caption || item.original_filename} fill sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw" unoptimized /></div>
            <div className="supporting-media-copy"><span>SUPPORTING REFERENCE · NOT CANONICAL</span><h3>{item.caption || item.original_filename}</h3>{item.context_note && <p>{item.context_note}</p>}<dl><div><dt>File</dt><dd>{item.original_filename}</dd></div><div><dt>Added</dt><dd>{new Date(item.created_at).toLocaleDateString()}</dd></div><div><dt>Size</dt><dd>{formatBytes(item.byte_length)}</dd></div></dl><Link className="supporting-ask-link" href={askAboutImageHref(caseId, item)}>Ask about this →</Link></div>
            {canContribute && <div className="supporting-media-actions"><form action={moveSupportingImageAction.bind(null, caseId, item.id)} className="supporting-move-form"><label htmlFor={`folder-${item.id}`}>Move to</label><select id={`folder-${item.id}`} name="folderId" defaultValue={item.folder_id ?? ""}><option value="">Unfiled</option>{library.folders.map((folder) => <option value={folder.id} key={folder.id}>{folder.name}</option>)}</select><SubmitButton pendingLabel="Moving…">Move</SubmitButton></form><form action={deleteSupportingImageAction.bind(null, caseId, item.id)} className="supporting-delete-form"><span>Permanent removal</span><SubmitButton pendingLabel="Removing…">Remove picture</SubmitButton></form></div>}
          </article>)}
        </div>}
      </section>
    </div>
  </main>;
}
