import type { Metadata } from "next";
import { readLiteSlice } from "@/lib/icarus-lite";
import "./lite.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Icarus Lite · Day 3 Testimony",
  description: "A source-linked, read-only testimony view from Icarus Casework.",
};

function asQuery(value: string | string[] | undefined) {
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

export default async function IcarusLitePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const query = asQuery((await searchParams).q);
  const slice = await readLiteSlice(query);

  return (
    <main className="lite-shell">
      <header className="lite-masthead">
        <a className="lite-wordmark" href="/lite" aria-label="Icarus Lite home">
          <span>ICARUS</span>
          <strong>LITE</strong>
        </a>
        <p>Published testimony · read only</p>
      </header>

      <div className="lite-layout">
        <aside className="lite-navigation" aria-label="Published testimony">
          <p className="lite-eyebrow">Proceeding</p>
          <a className="lite-nav-card active" href="/lite">
            <strong>{slice.proceeding.title}</strong>
            <span>{slice.proceeding.status} · {slice.totalSegments} segments</span>
          </a>
          <p className="lite-eyebrow lite-witness-label">Witness block</p>
          <a className="lite-nav-card active" href="/lite">
            <strong>{slice.witness.witness_label_raw}</strong>
            <span>{slice.witness.resolution_status} · review {slice.witness.review_status}</span>
          </a>
          <div className="lite-boundary-note">
            <strong>Reference projection</strong>
            <p>Casework remains authoritative. Unresolved labels and pending review states are preserved—not promoted to canonical fact.</p>
          </div>
        </aside>

        <section className="lite-reader" aria-labelledby="lite-title">
          <div className="lite-hero">
            <div>
              <p className="lite-eyebrow">{slice.proceeding.case_title}</p>
              <h1 id="lite-title">{slice.witness.witness_label_raw}</h1>
              <p className="lite-subtitle">Ordered testimony from {slice.proceeding.title}</p>
            </div>
            <dl className="lite-status-grid">
              <div><dt>Resolution</dt><dd>{slice.witness.resolution_status}</dd></div>
              <div><dt>Review</dt><dd>{slice.witness.review_status}</dd></div>
              <div><dt>Boundary confidence</dt><dd>{Number(slice.witness.boundary_confidence).toFixed(2)}</dd></div>
            </dl>
          </div>

          <form className="lite-search" action="/lite" method="get" role="search">
            <label htmlFor="lite-query">Search this witness block</label>
            <div>
              <input id="lite-query" name="q" type="search" defaultValue={query} placeholder="Search testimony or speaker labels" />
              <button type="submit">Search</button>
              {query ? <a href="/lite">Clear</a> : null}
            </div>
          </form>

          <div className="lite-results-heading" aria-live="polite">
            <p>{query ? `${slice.segments.length} matches for “${query}”` : `${slice.totalSegments} ordered segments`}</p>
            <span>Source artifact {slice.proceeding.source_artifact_filename ?? slice.proceeding.source_artifact_id}</span>
          </div>

          {slice.segments.length === 0 ? (
            <div className="lite-empty"><h2>No matching testimony</h2><p>Try a person, phrase, or speaker label.</p></div>
          ) : (
            <ol className="lite-transcript" start={slice.segments[0].witness_ordinal + 1}>
              {slice.segments.map((segment) => (
                <li key={segment.id} id={`segment-${segment.id}`}>
                  <div className="lite-segment-meta">
                    <strong>{segment.speaker_label}</strong>
                    <span>{formatTimestamp(segment.timestamp_start_ms)} · source #{segment.source_ordinal}</span>
                  </div>
                  <p>{segment.exact_text}</p>
                  <footer>
                    <code>{segment.id}</code>
                    {segment.deep_link ? <a href={segment.deep_link} target="_blank" rel="noreferrer">Open exact source ↗</a> : null}
                  </footer>
                </li>
              ))}
            </ol>
          )}

          <details className="lite-provenance">
            <summary>Projection provenance</summary>
            <dl>
              <div><dt>Proceeding UUID</dt><dd><code>{slice.proceeding.id}</code></dd></div>
              <div><dt>Witness UUID</dt><dd><code>{slice.witness.id}</code></dd></div>
              <div><dt>Artifact UUID</dt><dd><code>{slice.proceeding.source_artifact_id}</code></dd></div>
              <div><dt>Artifact SHA-256</dt><dd><code>{slice.proceeding.source_artifact_sha256}</code></dd></div>
            </dl>
          </details>
        </section>
      </div>
    </main>
  );
}
