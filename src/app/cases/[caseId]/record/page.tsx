import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { MonoLabel } from "@/app/casework-ui";
import { TranscriptText } from "@/app/cases/[caseId]/record/transcript-text";
import { TranscriptWindow } from "@/app/cases/[caseId]/record/transcript-window";
import { requireCaseActor } from "@/lib/authority";
import { caseFilesHref, courtRecordHref, structureHref } from "@/lib/case-routes";
import { getCourtRecordWorkspace } from "@/lib/court-record";
import { revTranscriptPage } from "@/lib/provider-source";
import { formatSourceLocator } from "@/lib/source-locator";
import { searchTestimony, type TestimonySearchContext, type TestimonySearchResult } from "@/lib/testimony-search";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; segment?: string; proceeding?: string; view?: string }>;

function formatTimestamp(milliseconds: number | null) {
  if (milliseconds === null) return "TIME NOT RECORDED";
  const totalSeconds = Math.floor(milliseconds / 1_000);
  return [Math.floor(totalSeconds / 3_600), Math.floor((totalSeconds % 3_600) / 60), totalSeconds % 60].map((part) => String(part).padStart(2, "0")).join(":");
}

function highlightedSnippet(snippet: string): ReactNode[] {
  let highlighted = false;
  return snippet.split(/(⟦|⟧)/).map((part, index) => {
    if (part === "⟦") { highlighted = true; return null; }
    if (part === "⟧") { highlighted = false; return null; }
    return highlighted ? <mark key={index}>{part}</mark> : <span key={index}>{part}</span>;
  });
}

function SearchResultCard({ caseId, query, result, selected, view }: { caseId: string; query: string; result: TestimonySearchResult; selected: boolean; view?: "text" }) {
  return <article className={`court-search-hit${selected ? " selected" : ""}`}>
    <Link scroll={false} href={courtRecordHref(caseId, { query, segmentId: result.source_segment_id, view })}>
      <h3>{result.speaker}</h3>
      <small>{formatTimestamp(result.timestamp_start_ms)} · #{result.ordinal + 1}</small>
      <blockquote>{highlightedSnippet(result.snippet)}</blockquote>
    </Link>
  </article>;
}

function LinkedStructure({ caseId, query, segmentId, workspace }: { caseId: string; query: string; segmentId: string; workspace: NonNullable<Awaited<ReturnType<typeof getCourtRecordWorkspace>>> }) {
  const linkedCount = workspace.linked.claims.length + workspace.linked.candidates.length + workspace.linked.eventCandidates.length + workspace.linked.temporalAssertions.length + workspace.linked.flags.length + workspace.linked.acquisitions.length + workspace.linked.provenanceRelations.length;
  if (linkedCount === 0) return <div className="inspector-empty"><strong>NOT YET DERIVED</strong><span>No claim, event, temporal assertion, flag, acquisition, or mapping relation is linked to this segment. The source remains canonical and usable.</span><Link href={structureHref(caseId, { segmentId, query })}>View Structure →</Link></div>;
  return <div className="linked-structure-list">
    {workspace.linked.claims.map((item) => <Link href={structureHref(caseId, { type: "claim", objectId: item.id, segmentId, query })} key={item.id}><article><span>CLAIM · {item.status}</span><strong>{item.assertion}</strong><small>{item.claimant}</small></article></Link>)}
    {workspace.linked.candidates.map((item) => <article key={item.id}><span>{item.candidate_type.replaceAll("_", " ")} · {item.review_status}</span><strong>Extraction candidate</strong><small>Parser confidence {Number(item.extraction_confidence).toFixed(2)} · not an evidentiary assessment</small></article>)}
    {workspace.linked.eventCandidates.map((item) => <Link href={structureHref(caseId, { type: "event", objectId: item.id, segmentId, query })} key={item.id}><article><span>EVENT CANDIDATE · {item.review_status}</span><strong>{item.neutral_description}</strong><small>{item.event_class?.replaceAll("_", " ") ?? "unclassified"} · parser confidence {Number(item.extraction_confidence).toFixed(2)}</small></article></Link>)}
    {workspace.linked.temporalAssertions.map((item) => <Link href={structureHref(caseId, { type: "temporal", objectId: item.id, segmentId, query })} key={item.id}><article><span>TEMPORAL ASSERTION · {item.review_status}</span><strong>{item.raw_temporal_language || "No raw temporal language"}</strong><small>{item.precision} · {item.asserted_start ? new Date(item.asserted_start).toLocaleString() : "no absolute time"}</small></article></Link>)}
    {workspace.linked.flags.map((item) => <Link href={structureHref(caseId, { type: "flag", objectId: item.id, segmentId, query })} key={item.id}><article><span>KNOWLEDGE FLAG · {item.status}</span><strong>{item.flag_type.replaceAll("_", " ")}</strong><small>{item.rationale}</small></article></Link>)}
    {workspace.linked.acquisitions.map((item) => <article key={item.id}><span>ACQUISITION · {item.priority}</span><strong>{item.title}</strong><small>{item.acquisition_status} · {item.possessed_by_us ? "possessed" : "not possessed"}</small></article>)}
    {workspace.linked.provenanceRelations.map((item) => <article key={item.id}><span>PROVENANCE RELATION</span><strong>{item.from_node_type} → {item.relation_type} → {item.to_node_type}</strong><small>{item.object_code ?? item.id}</small></article>)}
    <Link className="linked-structure-open" href={structureHref(caseId, { segmentId, query })}>View all structure linked to this segment →</Link>
  </div>;
}

export default async function CourtRecordPage({ params, searchParams }: { params: Promise<{ caseId: string }>; searchParams: SearchParams }) {
  const [actor, { caseId }, queryState] = await Promise.all([requireCaseActor(), params, searchParams]);
  const query = queryState.q?.trim().slice(0, 500) ?? "";
  const textView = queryState.view === "text";
  const [workspace, results] = await Promise.all([
    getCourtRecordWorkspace(actor.id, caseId, queryState.segment, queryState.proceeding, textView ? 60 : 12),
    query.length >= 2 ? searchTestimony(actor, caseId, query, { contextSize: 3, limit: 25 }) : Promise.resolve([]),
  ]);
  if (!workspace) notFound();
  const selected = workspace.selected;
  const publicTranscriptUrl = revTranscriptPage({ proceedingTitle: workspace.proceeding?.title, canonicalUrl: workspace.artifact?.canonical_url, sourceUrl: workspace.artifact?.source_url });

  return <main className="court-record-shell">
    {workspace.selectedMissing ? <div className="record-notice" role="status"><strong>Requested segment unavailable.</strong><span>The identifier was invalid, belongs to another case, or is not visible under RLS. The first accessible segment is shown instead.</span></div> : null}
    {workspace.totalSegments === 0 ? <section className="empty-court-record"><MonoLabel>NO COMMITTED CORPUS</MonoLabel><h2>The testimony database is not ready.</h2><p>No committed transcript is available for this case. Supporting pictures remain separate from the canonical record.</p><Link href={caseFilesHref(caseId)}>Open supporting Files →</Link></section> : <div className="court-record-grid">
      <aside className="court-search-results" aria-label="Testimony search results">
        <form className="court-search-panel-form" method="get">
          <MonoLabel>Search testimony</MonoLabel>
          <input name="q" defaultValue={query} minLength={2} maxLength={500} placeholder="what did Hall say about the backyard?" autoFocus />
          <button>Search record</button>
          <p className="court-search-help">Search exact words, natural-language phrasing, partial wording, speakers, or transcript fragments.</p>
          {queryState.segment ? <input type="hidden" name="segment" value={queryState.segment} /> : null}
          {queryState.proceeding ? <input type="hidden" name="proceeding" value={queryState.proceeding} /> : null}
          {textView ? <input type="hidden" name="view" value="text" /> : null}
        </form>
        {query.length < 2
          ? null
          : results.length === 0
            ? <div className="court-search-empty"><strong>No result</strong><p>No lexical or trigram match was found in this case. The current source selection is unchanged.</p></div>
            : <><p className="court-search-result-count">{results.length} result{results.length === 1 ? "" : "s"} for “{query}”</p><div className="court-search-hit-list">{results.map((result, index) => <SearchResultCard caseId={caseId} query={query} result={result} selected={selected?.id === result.source_segment_id} view={textView ? "text" : undefined} key={result.source_segment_id} />)}</div></>}
      </aside>
      <section className="court-transcript-panel" aria-label="Windowed testimony database"><header><div><MonoLabel>CANONICAL TRANSCRIPT WINDOW</MonoLabel><h2>{workspace.proceeding?.title ?? workspace.artifact?.title ?? "Source record"}</h2></div><div className="court-window-tools"><span className="court-window-count">{workspace.segments.length} segments loaded</span><div className="court-view-toggle" role="group" aria-label="Transcript view"><Link scroll={false} aria-current={!textView ? "page" : undefined} href={courtRecordHref(caseId, { query, segmentId: selected?.id, proceedingId: queryState.segment ? undefined : queryState.proceeding })}>Segments</Link><Link scroll={false} aria-current={textView ? "page" : undefined} href={courtRecordHref(caseId, { query, segmentId: selected?.id, proceedingId: queryState.segment ? undefined : queryState.proceeding, view: "text" })}>Plain text</Link></div></div></header>{selected ? (textView ? <TranscriptText title={workspace.proceeding?.title ?? workspace.artifact?.title ?? "Testimony"} segments={workspace.segments} selectedId={selected.id} /> : <TranscriptWindow caseId={caseId} query={query} selectedId={selected.id} segments={workspace.segments} />) : null}</section>
      <aside className="court-source-inspector" aria-label="Selected source provenance"><header><div><MonoLabel>SOURCE INSPECTOR</MonoLabel><h2>Selected segment</h2></div><span>EXACT SOURCE</span></header>{selected ? <div className="court-inspector-scroll">
        <section><MonoLabel>PASSAGE</MonoLabel><blockquote>{selected.exact_text}</blockquote><dl><div><dt>Segment UUID</dt><dd><code>{selected.id}</code></dd></div><div><dt>Speaker</dt><dd><span className="v-serif">{selected.speaker}</span></dd></div><div><dt>Timestamp</dt><dd>{formatTimestamp(selected.timestamp_start_ms)}</dd></div><div><dt>Ordinal</dt><dd>{selected.ordinal + 1}</dd></div><div><dt>Locator</dt><dd>{formatSourceLocator(selected.locator)}</dd></div></dl></section>
        <section><MonoLabel>PROCEEDING + SOURCE</MonoLabel><dl><div><dt>Proceeding</dt><dd><span className="v-serif">{workspace.proceeding?.title ?? "NOT RECORDED"}</span></dd></div><div><dt>Status</dt><dd><span className="v-serif">{workspace.proceeding?.status ?? "NOT RECORDED"}</span></dd></div><div><dt>Artifact</dt><dd><span className="v-serif">{workspace.artifact?.title ?? "NOT ACCESSIBLE"}</span></dd></div><div><dt>SHA-256</dt><dd><code>{workspace.artifact?.sha256 ?? "NOT RECORDED"}</code></dd></div><div><dt>Source family</dt><dd><span className="v-serif">{workspace.source?.source_family?.replaceAll("_", " ") ?? "NOT RECORDED"}</span></dd></div><div><dt>Possession</dt><dd><span className="v-serif">{workspace.source ? workspace.source.possessed_by_us ? "POSSESSED" : "NOT POSSESSED" : "UNKNOWN"}</span></dd></div></dl>{publicTranscriptUrl ? <a className="inspector-source-link" href={publicTranscriptUrl} target="_blank" rel="noreferrer">Transcript + video on Rev ↗</a> : workspace.artifact?.canonical_url ? <a className="inspector-source-link" href={workspace.artifact.canonical_url} target="_blank" rel="noreferrer">Open canonical artifact ↗</a> : null}{selected.deep_link ? <a className="inspector-source-link" href={selected.deep_link} target="_blank" rel="noreferrer">Open at provider timestamp ↗</a> : null}{!publicTranscriptUrl && !workspace.artifact?.canonical_url && !selected.deep_link ? <span className="inspector-empty">No external source URL was recorded.</span> : null}</section>
        <section><MonoLabel>LINKED STRUCTURE</MonoLabel><LinkedStructure caseId={caseId} query={query} segmentId={selected.id} workspace={workspace} /></section>
        <section><MonoLabel>BOOKMARK</MonoLabel><p className="bookmark-note">This URL contains the case UUID, query, and canonical segment UUID. Reloading or browser Back/Forward restores the same source selection.</p><Link className="source-anchor-link" href={courtRecordHref(caseId, { query, segmentId: selected.id })}>Canonical source URL →</Link></section>
      </div> : null}</aside>
    </div>}
  </main>;
}
