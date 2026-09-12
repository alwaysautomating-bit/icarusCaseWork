import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/app/cases/[caseId]/_components/submit-button";
import { MonoLabel } from "@/app/casework-ui";
import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase } from "@/lib/case-access";
import { evidenceHref, questionsHref } from "@/lib/case-routes";
import { getEvidenceWorkspace, type EvidenceSource } from "@/lib/research-workspace";
import { addEvidenceFactAction, addEvidenceSourceAction, createEvidenceAction, linkEvidenceQuestionAction } from "./actions";

export const dynamic = "force-dynamic";

type SearchState = { q?: string; item?: string; add?: string; message?: string; error?: string };

function evidenceCode(id: string) {
  return `E-${id.slice(0, 6).toUpperCase()}`;
}

function sourceLink(source: EvidenceSource | undefined) {
  if (!source) return null;
  return source.source_href ? <Link href={source.source_href}>{source.source_label} →</Link> : <span>{source.source_label}</span>;
}

export default async function EvidencePage({ params, searchParams }: { params: Promise<{ caseId: string }>; searchParams: Promise<SearchState> }) {
  const [actor, { caseId }, query] = await Promise.all([requireCaseActor(), params, searchParams]);
  const [currentCase, workspace] = await Promise.all([getAccessibleCase(actor.id, caseId), getEvidenceWorkspace(caseId)]);
  if (!currentCase) notFound();

  const canContribute = currentCase.membershipRole !== "viewer";
  const search = query.q?.trim().toLowerCase() ?? "";
  const filtered = workspace.evidence.filter((item) => !search || `${item.name} ${item.description} ${item.research_note}`.toLowerCase().includes(search));
  const selected = workspace.evidence.find((item) => item.id === query.item) ?? filtered[0] ?? null;
  const selectedSources = selected ? workspace.sources.filter((source) => source.evidence_id === selected.id) : [];
  const selectedFacts = selected ? workspace.facts.filter((fact) => fact.evidence_id === selected.id) : [];
  const linkedQuestionIds = new Set(selected ? workspace.links.filter((link) => link.evidence_id === selected.id).map((link) => link.question_id) : []);
  const linkedQuestions = workspace.questions.filter((question) => linkedQuestionIds.has(question.id));
  const availableQuestions = workspace.questions.filter((question) => !linkedQuestionIds.has(question.id));
  const showAdd = canContribute && (query.add === "1" || workspace.evidence.length === 0);
  const askHref = selected ? (() => {
    const ask = new URLSearchParams({ ask: "1", promptType: "evidence", promptId: selected.id, promptLabel: selected.name, promptHref: evidenceHref(caseId, selected.id) });
    return `${questionsHref(caseId)}?${ask.toString()}`;
  })() : questionsHref(caseId);

  return <main className="research-queue-shell evidence-workspace-shell">
    <header className="research-workbench-heading"><div><h1>Evidence</h1><span>{workspace.evidence.length} items</span></div>{canContribute ? <Link href={`${evidenceHref(caseId)}?add=1`}>+ Add evidence</Link> : null}</header>
    <details className="research-boundary-note"><summary>Evidence boundary</summary><p>Add an item only when reviewed material establishes that it exists. Facts require an underlying source; significance remains a research question.</p></details>
    {(query.message || query.error) && <p className={`supporting-files-notice ${query.error ? "error" : "success"}`} role={query.error ? "alert" : "status"}>{query.error ?? query.message}</p>}

    {showAdd && <form action={createEvidenceAction.bind(null, caseId)} className="research-create-form"><header><div><MonoLabel>ADD EVIDENCE</MonoLabel><h2>Name an established item</h2></div><span>Source it next</span></header><label>Evidence name *<input name="name" required minLength={2} maxLength={300} placeholder="External hand swabs" /></label><label className="wide">What is it? <small>Describe, do not interpret.</small><textarea name="description" rows={3} maxLength={3000} placeholder="A concise identifying description." /></label><label className="wide">Research note <small>Optional</small><textarea name="researchNote" rows={3} maxLength={3000} placeholder="Provenance concerns, limitations, or handling notes." /></label><label className="research-confirm"><input type="checkbox" name="established" value="yes" required /><span>I reviewed material that establishes this item exists.</span></label><SubmitButton pendingLabel="Adding…">Add evidence item</SubmitButton></form>}

    <div className="research-split-workspace">
      <aside className="research-index-list" aria-label="Evidence list"><form method="get" className="research-search-bar research-index-search"><label><span>Search evidence</span><input name="q" defaultValue={query.q ?? ""} placeholder="hand swabs, phone, photograph…" /></label><button>Search</button></form><header><span>EVIDENCE INDEX</span><strong>{filtered.length}</strong></header>{filtered.length === 0 ? <div className="research-index-empty">No matching evidence items.</div> : filtered.map((item) => { const active = selected?.id === item.id; const sourceCount = workspace.sources.filter((source) => source.evidence_id === item.id).length; const questionCount = workspace.links.filter((link) => link.evidence_id === item.id).length; return <Link href={`${evidenceHref(caseId, item.id)}${query.q ? `&q=${encodeURIComponent(query.q)}` : ""}`} aria-current={active ? "page" : undefined} key={item.id}><span>{evidenceCode(item.id)}</span><strong>{item.name}</strong><small>{sourceCount} sources · {questionCount} questions</small></Link>; })}</aside>

      <section className="research-record-panel">{selected ? <>
        <header className="research-record-title"><div><MonoLabel>{evidenceCode(selected.id)}</MonoLabel><h2>{selected.name}</h2><span className="state-chip pass">established</span></div><time>{new Date(selected.created_at).toLocaleDateString()}</time></header>
        <section className="research-context"><MonoLabel>WHAT IS IT?</MonoLabel><p>{selected.description || "No description has been recorded yet."}</p>{selected.research_note && <div><strong>RESEARCH NOTE</strong><span>{selected.research_note}</span></div>}<Link className="research-ask-link" href={askHref}>Ask about this →</Link></section>

        <section className="research-linked-section"><header><div><MonoLabel>WHAT WE KNOW</MonoLabel><h3>Sourced facts</h3></div><strong>{selectedFacts.length}</strong></header>{selectedFacts.length === 0 ? <p>No sourced facts recorded yet.</p> : <div className="evidence-fact-list">{selectedFacts.map((fact) => <article key={fact.id}><span aria-hidden="true">✓</span><div><p>{fact.statement}</p>{sourceLink(selectedSources.find((source) => source.id === fact.source_link_id))}</div></article>)}</div>}</section>

        <section className="research-linked-section"><header><div><MonoLabel>WHAT WE DO NOT KNOW</MonoLabel><h3>Linked questions</h3></div><strong>{linkedQuestions.length}</strong></header>{linkedQuestions.length === 0 ? <p>No questions linked yet. Use “Ask about this” to capture one.</p> : <div className="research-question-links">{linkedQuestions.map((question) => <Link href={questionsHref(caseId, question.id)} key={question.id}><span className={`state-chip ${question.status === "resolved" ? "pass" : "warn"}`}>{question.status}</span><strong>{question.question}</strong><span>→</span></Link>)}</div>}{canContribute && availableQuestions.length > 0 && <form action={linkEvidenceQuestionAction.bind(null, caseId, selected.id)} className="research-inline-form"><label>Link existing question<select name="questionId" required defaultValue=""><option value="" disabled>Choose a question</option>{availableQuestions.map((question) => <option value={question.id} key={question.id}>{question.question}</option>)}</select></label><SubmitButton pendingLabel="Linking…">Link</SubmitButton></form>}</section>

        <section className="research-linked-section"><header><div><MonoLabel>SOURCES</MonoLabel><h3>Material that establishes or describes this item</h3></div><strong>{selectedSources.length}</strong></header>{selectedSources.length === 0 ? <p>No sources attached. Add the establishing source before recording a fact.</p> : <div className="research-source-list">{selectedSources.map((source) => <article key={source.id}><span>{source.relationship} · {source.source_type.replaceAll("_", " ")}</span><strong>{source.source_href ? <Link href={source.source_href}>{source.source_label} →</Link> : source.source_label}</strong>{source.researcher_note && <p>{source.researcher_note}</p>}</article>)}</div>}</section>

        {canContribute && <div className="research-editor-grid"><details open={selectedSources.length === 0}><summary>+ Add source</summary><form action={addEvidenceSourceAction.bind(null, caseId, selected.id)}><label>Source type<select name="sourceType" defaultValue="document"><option value="testimony">Testimony</option><option value="document">Document</option><option value="image">Image</option><option value="research_material">Research material</option></select></label><label>Relationship<select name="relationship" defaultValue="documents"><option value="documents">Documents</option><option value="mentions">Mentions</option><option value="depicts">Depicts</option></select></label><label>Source label<input name="sourceLabel" required maxLength={500} placeholder="Search warrant return · p. 14" /></label><label>Link <small>Optional</small><input name="sourceHref" maxLength={1000} placeholder="/cases/… or https://…" /></label><label>Research note <small>Optional</small><textarea name="note" rows={3} maxLength={2000} /></label><SubmitButton pendingLabel="Adding…">Add source</SubmitButton></form></details><details><summary>+ Add sourced fact</summary>{selectedSources.length === 0 ? <p>Add an underlying source first.</p> : <form action={addEvidenceFactAction.bind(null, caseId, selected.id)}><label>Factual statement<textarea name="statement" rows={3} required maxLength={2000} placeholder="State only what the selected source establishes." /></label><label>Underlying source<select name="sourceId" required defaultValue=""><option value="" disabled>Choose a source</option>{selectedSources.map((source) => <option value={source.id} key={source.id}>{source.source_label}</option>)}</select></label><SubmitButton pendingLabel="Adding…">Add fact</SubmitButton></form>}</details></div>}
      </> : <div className="research-record-empty"><h2>No evidence item selected.</h2><p>Add an established item or change the current search.</p></div>}</section>
    </div>
  </main>;
}
