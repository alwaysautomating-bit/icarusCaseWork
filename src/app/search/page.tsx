import Link from "next/link";
import type { ReactNode } from "react";
import { MonoLabel, Wordmark } from "@/app/casework-ui";
import { signOut } from "@/app/login/actions";
import { requireCaseActor } from "@/lib/authority";
import { courtRecordHref } from "@/lib/case-routes";
import { getSearchableCases, searchTestimony, type TestimonySearchContext, type TestimonySearchResult } from "@/lib/testimony-search";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ case?: string; q?: string }>;

function formatTimestamp(milliseconds: number | null) {
  if (milliseconds === null) return "TIME NOT RECORDED";
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function highlightedSnippet(snippet: string): ReactNode[] {
  return snippet.split(/(⟦|⟧)/).map((part, index) => {
    if (part === "⟦" || part === "⟧") return null;
    const highlighted = snippet.split(/(⟦|⟧)/).slice(0, index).filter((token) => token === "⟦" || token === "⟧").length % 2 === 1;
    return highlighted ? <mark key={index}>{part}</mark> : <span key={index}>{part}</span>;
  });
}

function ContextSegment({ segment }: { segment: TestimonySearchContext }) {
  return <div className="search-context-segment">
    <span>{formatTimestamp(segment.timestamp_start_ms)}</span>
    <p><b>{segment.speaker}</b> {segment.exact_text}</p>
  </div>;
}

function SearchHit({ result, index, query }: { result: TestimonySearchResult; index: number; query: string }) {
  const sourceHref = result.deep_link ?? result.canonical_url ?? result.source_url;
  return <article className="search-hit">
    <header>
      <div><MonoLabel>RESULT {String(index + 1).padStart(2, "0")} · {result.match_method.replace("+", " + ")}</MonoLabel><h2>{result.proceeding_title}</h2></div>
      <div className="search-score"><strong>{result.relevance.toFixed(3)}</strong><span>RELEVANCE</span></div>
    </header>
    <div className="search-provenance">
      <span>{result.proceeding_date ?? "DATE UNKNOWN"}</span>
      <span>{result.speaker}</span>
      <span>{formatTimestamp(result.timestamp_start_ms)}</span>
      <span>SEGMENT {result.ordinal}</span>
    </div>
    {result.context_before.length > 0 ? <div className="search-context before" aria-label="Testimony before the match">{result.context_before.map((segment) => <ContextSegment segment={segment} key={segment.source_segment_id} />)}</div> : null}
    <blockquote>{highlightedSnippet(result.snippet)}</blockquote>
    {result.context_after.length > 0 ? <div className="search-context after" aria-label="Testimony after the match">{result.context_after.map((segment) => <ContextSegment segment={segment} key={segment.source_segment_id} />)}</div> : null}
    <footer>
      <span>{result.artifact_title}</span>
      <span><Link href={courtRecordHref(result.case_id, { query, segmentId: result.source_segment_id })}>OPEN IN COURT RECORD →</Link>{sourceHref ? <> · <a href={sourceHref} target="_blank" rel="noreferrer">PROVIDER SOURCE ↗</a></> : null}</span>
    </footer>
  </article>;
}

export default async function TestimonySearchPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireCaseActor();
  const cases = await getSearchableCases(actor);
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const requestedCase = cases.find((item) => item.id === params.case);
  const selectedCase = requestedCase ?? null;
  const results = selectedCase && query.length >= 2 ? await searchTestimony(actor, selectedCase.id, query, { contextSize: 3 }) : [];

  return <main className="search-shell">
    <header className="masthead">
      <Wordmark />
      <nav aria-label="Workspace modes"><Link href="/">Case workspace</Link><Link href="/compiler">Testimony Compiler</Link></nav>
      <div className="account"><span>{actor.email}</span><form action={signOut}><button className="text-button">Sign out</button></form></div>
    </header>

    <section className="search-hero">
      <MonoLabel>CANONICAL SOURCE SEARCH · RLS ENFORCED</MonoLabel>
      <h1>Search testimony.</h1>
      <p>Find exact words, phrases, partial wording, and lexical matches without leaving the source record.</p>
      <form className="search-form" method="get">
        <label>Case
          <select name="case" defaultValue={selectedCase?.id ?? ""} disabled={cases.length === 0} required>
            <option value="" disabled>Select an explicit case</option>
            {cases.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}
          </select>
        </label>
        <label className="query-label">Search testimony
          <input name="q" defaultValue={query} minLength={2} maxLength={500} placeholder="what did Hall say about the backyard?" autoFocus />
        </label>
        <button type="submit" disabled={!selectedCase}>Search</button>
      </form>
      <p className="search-syntax"><b>SEARCH SYNTAX</b> quoted phrases · <code>CVS or pharmacy</code> · <code>children -objection</code> · fragments such as <code>couldnt wake</code></p>
    </section>

    <section className="search-results" aria-live="polite">
      <header>
        <div><MonoLabel>SEARCH RESULTS</MonoLabel><h2>{query.length >= 2 ? `“${query}”` : "Ready for a query"}</h2></div>
        <strong>{results.length} {results.length === 1 ? "HIT" : "HITS"}</strong>
      </header>
      {cases.length === 0 ? <div className="search-empty">No case is available to this signed-in user.</div> : !selectedCase ? <div className="search-empty">Select a case explicitly. Global search never assumes the first accessible case.</div> : query.length < 2 ? <div className="search-empty">Enter at least two characters. Results will include their source, locator, score, and surrounding testimony.</div> : results.length === 0 ? <div className="search-empty">No lexical or fragment match was found in this case.</div> : <div className="search-hit-list">{results.map((result, index) => <SearchHit result={result} index={index} query={query} key={result.source_segment_id} />)}</div>}
    </section>
  </main>;
}
