import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/app/cases/[caseId]/_components/submit-button";
import { MonoLabel, PageHeader } from "@/app/casework-ui";
import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase } from "@/lib/case-access";
import { evidenceHref, questionsHref } from "@/lib/case-routes";
import { getQuestionsWorkspace, type QuestionEntry, type QuestionSource } from "@/lib/research-workspace";
import { addQuestionEntryAction, addQuestionSourceAction, createQuestionAction, linkQuestionEvidenceAction, resolveQuestionAction } from "./actions";

export const dynamic = "force-dynamic";

type SearchState = { q?: string; status?: string; question?: string; message?: string; error?: string; ask?: string; promptType?: string; promptId?: string; promptLabel?: string; promptHref?: string };

function questionCode(id: string) {
  return `Q-${id.slice(0, 6).toUpperCase()}`;
}

function sourceLink(source: QuestionSource | undefined) {
  if (!source) return null;
  return source.source_href ? <Link href={source.source_href}>{source.source_label} →</Link> : <span>{source.source_label}</span>;
}

function safeDisplayHref(raw: string | undefined) {
  if (!raw) return null;
  if (raw.startsWith("/")) return raw;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function EntryList({ title, entries, sources, empty }: { title: string; entries: QuestionEntry[]; sources: QuestionSource[]; empty: string }) {
  return <section className="research-state-block"><header><h3>{title}</h3><strong>{entries.length}</strong></header>{entries.length === 0 ? <p className="research-state-empty">{empty}</p> : <div>{entries.map((entry) => <article key={entry.id}><span aria-hidden="true" className={entry.entry_kind === "unknown" ? "research-glyph-unknown" : entry.entry_kind === "known" ? "research-glyph-known" : undefined}>{entry.entry_kind === "unknown" ? "?" : entry.entry_kind === "target" ? "□" : "✓"}</span><div><p>{entry.statement}</p>{sourceLink(sources.find((source) => source.id === entry.source_link_id))}</div></article>)}</div>}</section>;
}

export default async function QuestionsPage({ params, searchParams }: { params: Promise<{ caseId: string }>; searchParams: Promise<SearchState> }) {
  const [actor, { caseId }, query] = await Promise.all([requireCaseActor(), params, searchParams]);
  const [currentCase, workspace] = await Promise.all([getAccessibleCase(actor.id, caseId), getQuestionsWorkspace(caseId)]);
  if (!currentCase) notFound();
  const canContribute = currentCase.membershipRole !== "viewer";
  const search = query.q?.trim().toLowerCase() ?? "";
  const status = query.status === "resolved" ? "resolved" : query.status === "all" ? "all" : "open";
  const filtered = workspace.questions.filter((question) => (status === "all" || question.status === status) && (!search || `${question.question} ${question.context}`.toLowerCase().includes(search)));
  const selected = workspace.questions.find((question) => question.id === query.question) ?? filtered[0] ?? null;
  const selectedSources = selected ? workspace.sources.filter((source) => source.question_id === selected.id) : [];
  const selectedEntries = selected ? workspace.entries.filter((entry) => entry.question_id === selected.id) : [];
  const selectedEvidenceIds = new Set(selected ? workspace.links.filter((link) => link.question_id === selected.id).map((link) => link.evidence_id) : []);
  const availableEvidence = workspace.evidence.filter((item) => !selectedEvidenceIds.has(item.id));
  const showAsk = canContribute && (query.ask === "1" || workspace.questions.length === 0);
  const promptHref = safeDisplayHref(query.promptHref);
  const openQuestionCount = workspace.questions.filter((item) => item.status === "open").length;

  return <main className="research-queue-shell">
    <PageHeader
      eyebrow={`QUESTIONS · ${openQuestionCount} OPEN`}
      title="Questions"
      lede="What the record does not yet answer, what is known so far, and what each answer rests on."
      actions={canContribute ? <Link href={`${questionsHref(caseId)}?ask=1`} className="ds-btn primary">+ Ask question</Link> : undefined}
    />
    {(query.message || query.error) && <p className={`supporting-files-notice ${query.error ? "error" : "success"}`} role={query.error ? "alert" : "status"}>{query.error ?? query.message}</p>}
    {showAsk && <form action={createQuestionAction.bind(null, caseId)} className="research-create-form"><header><div><MonoLabel>ASK A QUESTION</MonoLabel><h2>What are you trying to find out?</h2></div><span>Fast capture · refine later</span></header><label className="wide">Question *<textarea name="question" rows={2} minLength={5} maxLength={500} required placeholder="Were the samples submitted for testing?" /></label><label className="wide">Why are you asking? <small>Optional</small><textarea name="context" rows={3} maxLength={2000} defaultValue={query.promptLabel ? `Prompted by ${query.promptLabel}.` : ""} placeholder="What made this question matter?" /></label><input type="hidden" name="promptType" value={query.promptType ?? ""} /><input type="hidden" name="promptId" value={query.promptId ?? ""} /><input type="hidden" name="promptLabel" value={query.promptLabel ?? ""} /><input type="hidden" name="promptHref" value={promptHref ?? ""} />{query.promptLabel && <p className="research-prompt-banner"><strong>Prompted by</strong>{promptHref ? <Link href={promptHref}>{query.promptLabel} →</Link> : <span>{query.promptLabel}</span>}</p>}<SubmitButton pendingLabel="Creating…">Create question</SubmitButton></form>}
    <div className="research-split-workspace">
      <aside className="research-index-list" aria-label="Question list"><form method="get" className="research-search-bar research-index-search"><label><span>Search questions</span><input name="q" defaultValue={query.q ?? ""} placeholder="hand swabs, doorway, testing…" /></label><label><span>Status</span><select name="status" defaultValue={status}><option value="open">Open</option><option value="resolved">Resolved</option><option value="all">All</option></select></label><button>Search</button></form><header><span>{status.toUpperCase()}</span><strong>{filtered.length}</strong></header>{filtered.length === 0 ? <div className="research-index-empty">No matching questions.</div> : filtered.map((question) => { const active = selected?.id === question.id; const count = workspace.sources.filter((source) => source.question_id === question.id).length; const evidenceCount = workspace.links.filter((link) => link.question_id === question.id).length; return <Link href={`${questionsHref(caseId, question.id)}&status=${status}${query.q ? `&q=${encodeURIComponent(query.q)}` : ""}`} aria-current={active ? "page" : undefined} key={question.id}><span>{questionCode(question.id)} · {question.status}</span><strong>{question.question}</strong><small>{count} sources · {evidenceCount} evidence links</small></Link>; })}</aside>
      <section className="research-record-panel">{selected ? <>
        <header className="research-record-title"><div><MonoLabel>{questionCode(selected.id)}</MonoLabel><h2>{selected.question}</h2><span className={`state-chip ${selected.status === "resolved" ? "pass" : "warn"}`}>{selected.status}</span></div><time>{new Date(selected.created_at).toLocaleDateString()}</time></header>
        <section className="research-context"><MonoLabel>WHY THIS QUESTION EXISTS</MonoLabel><p>{selected.context || "No context has been recorded yet."}</p>{selected.prompted_by_label && <div><strong>PROMPTED BY</strong>{selected.prompted_by_href ? <Link href={selected.prompted_by_href}>{selected.prompted_by_label} →</Link> : <span>{selected.prompted_by_label}</span>}</div>}</section>
        {selected.status === "resolved" && <section className="research-resolution"><MonoLabel>RESOLUTION</MonoLabel><p>{selected.resolution}</p>{selected.limitations && <><strong>LIMITATIONS</strong><p>{selected.limitations}</p></>}</section>}
        <div className="research-state-grid"><EntryList title="What we know" entries={selectedEntries.filter((item) => item.entry_kind === "known")} sources={selectedSources} empty="No sourced known points yet." /><EntryList title="Findings" entries={selectedEntries.filter((item) => item.entry_kind === "finding")} sources={selectedSources} empty="No sourced findings yet." /><EntryList title="What remains unknown" entries={selectedEntries.filter((item) => item.entry_kind === "unknown")} sources={selectedSources} empty="No unknowns recorded." /><EntryList title="What would help" entries={selectedEntries.filter((item) => item.entry_kind === "target")} sources={selectedSources} empty="No research targets recorded." /></div>
        <section className="research-linked-section"><header><div><MonoLabel>EVIDENCE</MonoLabel><h3>Linked established items</h3></div><strong>{selectedEvidenceIds.size}</strong></header>{selectedEvidenceIds.size === 0 ? <p>No evidence items linked.</p> : <div className="research-link-list">{workspace.evidence.filter((item) => selectedEvidenceIds.has(item.id)).map((item) => <Link href={evidenceHref(caseId, item.id)} key={item.id}>{item.name} →</Link>)}</div>}{canContribute && availableEvidence.length > 0 && <form action={linkQuestionEvidenceAction.bind(null, caseId, selected.id)} className="research-inline-form"><label>Link evidence<select name="evidenceId" required defaultValue=""><option value="" disabled>Choose established evidence</option>{availableEvidence.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><SubmitButton pendingLabel="Linking…">Link</SubmitButton></form>}</section>
        <section className="research-linked-section"><header><div><MonoLabel>SOURCES</MonoLabel><h3>Material reviewed for this question</h3></div><strong>{selectedSources.length}</strong></header>{selectedSources.length === 0 ? <p>No sources attached yet.</p> : <div className="research-source-list">{selectedSources.map((source) => <article key={source.id}><span>{source.source_type.replaceAll("_", " ")}</span><strong>{source.source_href ? <Link href={source.source_href}>{source.source_label} →</Link> : source.source_label}</strong>{source.researcher_note && <p>{source.researcher_note}</p>}</article>)}</div>}</section>
        {canContribute && <div className="research-editor-grid"><details><summary>+ Add source</summary><form action={addQuestionSourceAction.bind(null, caseId, selected.id)}><label>Source type<select name="sourceType" defaultValue="testimony"><option value="testimony">Testimony</option><option value="evidence">Evidence</option><option value="document">Document</option><option value="image">Image</option><option value="research_material">Research material</option></select></label><label>Source label<input name="sourceLabel" required maxLength={500} placeholder="Day 3 · Brian Josephine · 01:42:18" /></label><label>Link <small>Optional</small><input name="sourceHref" maxLength={1000} placeholder="/cases/… or https://…" /></label><label>Why is this relevant? <small>Optional</small><textarea name="note" rows={3} maxLength={2000} /></label><SubmitButton pendingLabel="Adding…">Add source</SubmitButton></form></details><details><summary>+ Update research state</summary><form action={addQuestionEntryAction.bind(null, caseId, selected.id)}><label>Type<select name="entryKind" defaultValue="unknown"><option value="known">Known · source required</option><option value="finding">Finding · source required</option><option value="unknown">Unknown</option><option value="target">What would help</option></select></label><label>Statement<textarea name="statement" rows={3} required maxLength={2000} /></label><label>Underlying source<select name="sourceId" defaultValue=""><option value="">No source</option>{selectedSources.map((source) => <option value={source.id} key={source.id}>{source.source_label}</option>)}</select></label><SubmitButton pendingLabel="Adding…">Add to question</SubmitButton></form></details></div>}
        {canContribute && selected.status === "open" && <details className="research-resolve-form"><summary>Propose resolution</summary><form action={resolveQuestionAction.bind(null, caseId, selected.id)}><label>Proposed resolution<textarea name="resolution" rows={4} minLength={2} maxLength={4000} required /></label><label>Limitations <small>Preserve what this does not establish.</small><textarea name="limitations" rows={3} maxLength={2000} /></label><SubmitButton pendingLabel="Resolving…">Mark resolved</SubmitButton></form></details>}
      </> : <div className="research-record-empty"><h2>No question selected.</h2><p>Create a question or change the current search.</p></div>}</section>
    </div>
  </main>;
}
