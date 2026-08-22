import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { MonoLabel } from "@/app/casework-ui";
import { TranscriptWindow } from "@/app/cases/[caseId]/record/transcript-window";
import { requireCaseActor } from "@/lib/authority";
import { caseSetupHref, courtRecordHref, structureHref } from "@/lib/case-routes";
import { getCourtRecordWorkspace } from "@/lib/court-record";
import { revTranscriptPage } from "@/lib/provider-source";
import { formatSourceLocator } from "@/lib/source-locator";
import { searchTestimony, type TestimonySearchContext, type TestimonySearchResult } from "@/lib/testimony-search";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; segment?: string; proceeding?: string }>;

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

function CompactContext({ segment }: { segment: TestimonySearchContext }) {
  return <p><span>{formatTimestamp(segment.timestamp_start_ms)}</span><b>{segment.speaker}</b>{segment.exact_text}</p>;
}

function SearchResultCard({ caseId, query, result, index, selected }: { caseId: string; query: string; result: TestimonySearchResult; index: number; selected: boolean }) {
  return <article className={`court-search-hit${selected ? " selected" : ""}`}>
    <header><MonoLabel>HIT {String(index + 1).padStart(2, "0")} · {result.match_method.replace("+", " + ")}</MonoLabel><strong>{result.relevance.toFixed(3)}</strong></header>
    <h3>{result.speaker}</h3><div className="court-search-meta"><span>{result.proceeding_title}</span><span>{formatTimestamp(result.timestamp_start_ms)}</span><span>SEGMENT {result.ordinal + 1}</span></div>
    <blockquote>{highlightedSnippet(result.snippet)}</blockquote>
    {(result.context_before.length > 0 || result.context_after.length > 0) ? <details><summary>Surrounding testimony</summary><div className="compact-search-context">{result.context_before.slice(-2).map((item) => <CompactContext segment={item} key={item.source_segment_id} />)}<p className="matched-context"><span>{formatTimestamp(result.timestamp_start_ms)}</span><b>{result.speaker}</b>{result.exact_text}</p>{result.context_after.slice(0, 2).map((item) => <CompactContext segment={item} key={item.source_segment_id} />)}</div></details> : null}
    <footer><span>{result.artifact_title}</span><Link scroll={false} href={courtRecordHref(caseId, { query, segmentId: result.source_segment_id })}>{selected ? "Open in record" : "Show source"} →</Link></footer>
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
  const actor = await requireCaseActor();
  const [{ caseId }, queryState] = await Promise.all([params, searchParams]);
  const query = queryState.q?.trim().slice(0, 500) ?? "";
  const [workspace, results] = await Promise.all([
    getCourtRecordWorkspace(actor.id, caseId, queryState.segment, queryState.proceeding),
    query.length >= 2 ? searchTestimony(actor, caseId, query, { contextSize: 3, limit: 25 }) : Promise.resolve([]),
  ]);
  if (!workspace) notFound();
  const selected = workspace.selected;
  const publicTranscriptUrl = revTranscriptPage({ proceedingTitle: workspace.proceeding?.title, canonicalUrl: workspace.artifact?.canonical_url, sourceUrl: workspace.artifact?.source_url });

  return <main className="court-record-shell">
    <section className="court-record-heading"><div><MonoLabel>COURT RECORD · CANONICAL SOURCE RETRIEVAL</MonoLabel><h1>Read the words.<br />Inspect the chain.</h1></div><div className="court-record-summary"><strong>{workspace.totalSegments.toLocaleString()}</strong><span>RLS-visible source segments</span><p>The browser receives only this selected transcript window—not the full corpus.</p></div></section>
    <form className="court-search-form" method="get"><label><span>Search testimony</span><input name="q" defaultValue={query} minLength={2} maxLength={500} placeholder="what did Hall say about the backyard?" autoFocus /></label><button>Search record</button>{queryState.segment ? <input type="hidden" name="segment" value={queryState.segment} /> : null}{queryState.proceeding ? <input type="hidden" name="proceeding" value={queryState.proceeding} /> : null}</form>
    <div className="court-search-syntax"><span>Lexical FTS</span><span>Phrase-aware</span><span>Trigram fragments</span><code>couldnt wake</code><span>No generated answer</span></div>
    {workspace.selectedMissing ? <div className="record-notice" role="status"><strong>Requested segment unavailable.</strong><span>The identifier was invalid, belongs to another case, or is not visible under RLS. The first accessible segment is shown instead.</span></div> : null}
    {workspace.totalSegments === 0 ? <section className="empty-court-record"><MonoLabel>NO COMMITTED CORPUS</MonoLabel><h2>Court Record is not ready.</h2><p>Return to Foundation and complete a usable source intake. No fixture transcript has been substituted.</p><Link href={caseSetupHref(caseId)}>Return to Foundation →</Link></section> : <div className="court-record-grid">
      <aside className="court-search-results" aria-label="Testimony search results"><header><div><MonoLabel>RETRIEVAL</MonoLabel><h2>{query.length >= 2 ? `“${query}”` : "Search the corpus"}</h2></div><strong>{results.length}</strong></header>{query.length < 2 ? <div className="court-search-empty"><p>Search exact words, natural-language phrasing, partial wording, speakers, or transcript fragments.</p><code>what did Hall say about the backyard?</code><code>couldnt wake</code></div> : results.length === 0 ? <div className="court-search-empty"><strong>No result</strong><p>No lexical or trigram match was found in this case. The current source selection is unchanged.</p></div> : <div className="court-search-hit-list">{results.map((result, index) => <SearchResultCard caseId={caseId} query={query} result={result} index={index} selected={selected?.id === result.source_segment_id} key={result.source_segment_id} />)}</div>}</aside>
      <section className="court-transcript-panel" aria-label="Windowed Court Record"><header><div><MonoLabel>CANONICAL TRANSCRIPT WINDOW</MonoLabel><h2>{workspace.proceeding?.title ?? workspace.artifact?.title ?? "Source record"}</h2></div><span>{workspace.segments.length} segments loaded</span></header>{selected ? <TranscriptWindow caseId={caseId} query={query} selectedId={selected.id} segments={workspace.segments} /> : null}</section>
      <aside className="court-source-inspector" aria-label="Selected source provenance"><header><div><MonoLabel>SOURCE INSPECTOR</MonoLabel><h2>Selected segment</h2></div><span>EXACT SOURCE</span></header>{selected ? <div className="court-inspector-scroll">
        <section><MonoLabel>PASSAGE</MonoLabel><blockquote>{selected.exact_text}</blockquote><dl><div><dt>Segment UUID</dt><dd><code>{selected.id}</code></dd></div><div><dt>Speaker</dt><dd>{selected.speaker}</dd></div><div><dt>Timestamp</dt><dd>{formatTimestamp(selected.timestamp_start_ms)}</dd></div><div><dt>Ordinal</dt><dd>{selected.ordinal + 1}</dd></div><div><dt>Locator</dt><dd>{formatSourceLocator(selected.locator)}</dd></div></dl></section>
        <section><MonoLabel>PROCEEDING + SOURCE</MonoLabel><dl><div><dt>Proceeding</dt><dd>{workspace.proceeding?.title ?? "NOT RECORDED"}</dd></div><div><dt>Status</dt><dd>{workspace.proceeding?.status ?? "NOT RECORDED"}</dd></div><div><dt>Artifact</dt><dd>{workspace.artifact?.title ?? "NOT ACCESSIBLE"}</dd></div><div><dt>SHA-256</dt><dd><code>{workspace.artifact?.sha256 ?? "NOT RECORDED"}</code></dd></div><div><dt>Source family</dt><dd>{workspace.source?.source_family?.replaceAll("_", " ") ?? "NOT RECORDED"}</dd></div><div><dt>Possession</dt><dd>{workspace.source ? workspace.source.possessed_by_us ? "POSSESSED" : "NOT POSSESSED" : "UNKNOWN"}</dd></div></dl>{publicTranscriptUrl ? <a className="inspector-source-link" href={publicTranscriptUrl} target="_blank" rel="noreferrer">Transcript + video on Rev ↗</a> : workspace.artifact?.canonical_url ? <a className="inspector-source-link" href={workspace.artifact.canonical_url} target="_blank" rel="noreferrer">Open canonical artifact ↗</a> : null}{selected.deep_link ? <a className="inspector-source-link" href={selected.deep_link} target="_blank" rel="noreferrer">Open at provider timestamp ↗</a> : null}{!publicTranscriptUrl && !workspace.artifact?.canonical_url && !selected.deep_link ? <span className="inspector-empty">No external source URL was recorded.</span> : null}</section>
        <section><MonoLabel>LINKED STRUCTURE</MonoLabel><LinkedStructure caseId={caseId} query={query} segmentId={selected.id} workspace={workspace} /></section>
        <section><MonoLabel>BOOKMARK</MonoLabel><p className="bookmark-note">This URL contains the case UUID, query, and canonical segment UUID. Reloading or browser Back/Forward restores the same source selection.</p><Link className="source-anchor-link" href={courtRecordHref(caseId, { query, segmentId: selected.id })}>Canonical source URL →</Link></section>
      </div> : null}</aside>
    </div>}
  </main>;
}
