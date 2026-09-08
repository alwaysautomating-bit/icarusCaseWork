import type { Metadata } from "next";
import Link from "next/link";
import { readLiteSlice } from "@/lib/icarus-lite";
import "./lite.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Clancy Trial Index · Icarus Lite",
  description: "Searchable, source-linked Clancy testimony organized by trial day and witness.",
};

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value ?? "").trim().slice(0, 200);
}

function formatTimestamp(milliseconds: string | null) {
  if (milliseconds === null) return "No timestamp";
  const totalSeconds = Math.floor(Number(milliseconds) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function liteHref(proceedingId?: string, witnessId?: string) {
  const params = new URLSearchParams();
  if (proceedingId) params.set("day", proceedingId);
  if (witnessId) params.set("witness", witnessId);
  return `/lite${params.size ? `?${params}` : ""}`;
}

export default async function IcarusLitePage({ searchParams }: {
  searchParams: Promise<{ q?: string | string[]; day?: string | string[]; witness?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = first(params.q);
  const slice = await readLiteSlice({ query, proceedingId: first(params.day), witnessId: first(params.witness) });

  return (
    <main className="lite-shell">
      <header className="lite-masthead">
        <Link className="lite-wordmark" href="/lite" aria-label="Clancy trial index home">
          <span>ICARUS</span><strong>TRIAL INDEX</strong>
        </Link>
        <p>{slice.totalSegments.toLocaleString()} published testimony segments · read only</p>
      </header>

      <div className="lite-layout">
        <aside className="lite-navigation" aria-label="Clancy trial index">
          <p className="lite-eyebrow">Clancy case · trial days</p>
          <nav className="lite-day-list">
            {slice.proceedings.map((proceeding) => (
              <Link className={`lite-nav-card ${proceeding.id === slice.proceeding.id ? "active" : ""}`}
                href={liteHref(proceeding.id)} key={proceeding.id} aria-current={proceeding.id === slice.proceeding.id ? "page" : undefined}>
                <strong>{proceeding.title.replace("MA v. Lindsay Clancy — ", "").replace("MA v. Lindsay Clancy ", "")}</strong>
                <span>{Number(proceeding.witness_count)} witnesses · {Number(proceeding.segment_count).toLocaleString()} segments</span>
              </Link>
            ))}
          </nav>
          <div className="lite-boundary-note">
            <strong>Canonical source projection</strong>
            <p>Exact testimony, timestamps, review state, and REV links are preserved from Casework. Trial-index summaries remain derived navigation, not replacement evidence.</p>
          </div>
        </aside>

        <section className="lite-reader" aria-labelledby="lite-title">
          <div className="lite-hero">
            <div>
              <p className="lite-eyebrow">{slice.proceeding.case_title}</p>
              <h1 id="lite-title">{slice.proceeding.title}</h1>
              <p className="lite-subtitle">Select a witness, search the testimony, then return to the exact source on REV.</p>
            </div>
            <dl className="lite-status-grid">
              <div><dt>Witnesses</dt><dd>{slice.witnesses.length}</dd></div>
              <div><dt>Day segments</dt><dd>{Number(slice.proceeding.segment_count).toLocaleString()}</dd></div>
              <div><dt>Status</dt><dd>{slice.proceeding.status}</dd></div>
            </dl>
          </div>

          {slice.witnesses.length ? (
            <nav className="lite-witnesses" aria-label="Witness blocks">
              {slice.witnesses.map((witness) => (
                <Link href={liteHref(slice.proceeding.id, witness.id)} key={witness.id}
                  className={witness.id === slice.witness?.id ? "active" : ""}
                  aria-current={witness.id === slice.witness?.id ? "page" : undefined}>
                  <strong>{witness.witness_label_raw}</strong>
                  <span>{Number(witness.segment_count).toLocaleString()} segments</span>
                </Link>
              ))}
            </nav>
          ) : (
            <div className="lite-empty"><h2>Trial-day index preserved</h2><p>Processed testimony has not yet been published for this day.</p></div>
          )}

          {slice.witness ? <>
            <form className="lite-search" action="/lite" method="get" role="search">
              <input type="hidden" name="day" value={slice.proceeding.id} />
              <input type="hidden" name="witness" value={slice.witness.id} />
              <label htmlFor="lite-query">Search {slice.witness.witness_label_raw}&apos;s testimony</label>
              <div>
                <input id="lite-query" name="q" type="search" defaultValue={query} placeholder="Search exact testimony or speaker" />
                <button type="submit">Search</button>
                {query ? <Link href={liteHref(slice.proceeding.id, slice.witness.id)}>Clear</Link> : null}
              </div>
            </form>

            <div className="lite-results-heading" aria-live="polite">
              <p>{query ? `${slice.matchCount} matches for “${query}”` : `${Number(slice.witness.segment_count).toLocaleString()} ordered segments`}</p>
              <span>{slice.proceeding.source_artifact_filename ?? "Preserved source artifact"}</span>
            </div>

            {slice.segments.length === 0 ? (
              <div className="lite-empty"><h2>No matching testimony</h2><p>Try a person, phrase, or speaker label.</p></div>
            ) : (
              <ol className="lite-transcript">
                {slice.segments.map((segment) => (
                  <li key={segment.id} id={`segment-${segment.id}`}>
                    <div className="lite-segment-meta">
                      <strong>{segment.speaker_label}</strong>
                      <span>{formatTimestamp(segment.timestamp_start_ms)} · source #{segment.source_ordinal}</span>
                    </div>
                    <p>{segment.exact_text}</p>
                    <footer>
                      <code>segment {segment.witness_ordinal + 1}</code>
                      {segment.deep_link ? <a href={segment.deep_link} target="_blank" rel="noreferrer">Open at {formatTimestamp(segment.timestamp_start_ms)} on REV ↗</a> : <span>REV link unavailable</span>}
                    </footer>
                  </li>
                ))}
              </ol>
            )}

            <details className="lite-provenance">
              <summary>Source provenance</summary>
              <dl>
                <div><dt>Proceeding UUID</dt><dd><code>{slice.proceeding.id}</code></dd></div>
                <div><dt>Witness UUID</dt><dd><code>{slice.witness.id}</code></dd></div>
                <div><dt>Artifact UUID</dt><dd><code>{slice.proceeding.source_artifact_id}</code></dd></div>
                <div><dt>Artifact SHA-256</dt><dd><code>{slice.proceeding.source_artifact_sha256}</code></dd></div>
              </dl>
            </details>
          </> : null}
        </section>
      </div>
    </main>
  );
}
