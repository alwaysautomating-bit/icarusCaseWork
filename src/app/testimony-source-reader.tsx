"use client";

import { useMemo, useState } from "react";
import { reviewExtractionCandidateAction } from "./actions";
import { ActionLink, EvidenceCard, MonoLabel, SpecRow } from "./casework-ui";

type Segment = { id: string; artifact_id: string; ordinal: number; timestamp_start_ms: number | null; timestamp_end_ms: number | null; deep_link: string | null; exact_text: string; locator: Record<string, unknown>; speaker: string; artifact_title: string; artifact_sha256: string; canonical_url: string | null };
type QaExchange = { id: string; question_segment_id: string; answer_segment_ids: string[]; context_segment_ids: string[]; question_text: string; answer_text: string };
type Candidate = { id: string; candidate_type: string; source_segment_ids: string[]; payload: Record<string, unknown>; extraction_confidence: number; review_status: string; current_review_version: number };
type ReviewVersion = { candidate_id: string; version: number; action: string; payload: Record<string, unknown> | null; note: string; reviewed_at: string };
type Acquisition = { id: string; title: string; acquisition_status: string; priority: string; known_to_exist: boolean; possessed_by_us: boolean; admitted_as_exhibit: boolean | null; deep_link: string | null };

function formatTimestamp(milliseconds: number | null) {
  if (milliseconds === null) return "--:--:--";
  const seconds = Math.floor(milliseconds / 1_000);
  return [Math.floor(seconds / 3_600), Math.floor((seconds % 3_600) / 60), seconds % 60].map((part) => String(part).padStart(2, "0")).join(":");
}

export function TestimonySourceReader({ segments, qaExchanges, candidates, reviewVersions, acquisitions }: { segments: Segment[]; qaExchanges: QaExchange[]; candidates: Candidate[]; reviewVersions: ReviewVersion[]; acquisitions: Acquisition[] }) {
  const [query, setQuery] = useState("");
  const [speaker, setSpeaker] = useState("all");
  const [selectedId, setSelectedId] = useState(segments[0]?.id ?? "");
  const speakers = useMemo(() => [...new Set(segments.map((item) => item.speaker))].sort(), [segments]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return segments.filter((item) => (speaker === "all" || item.speaker === speaker) && (!needle || item.exact_text.toLowerCase().includes(needle) || item.speaker.toLowerCase().includes(needle) || formatTimestamp(item.timestamp_start_ms).includes(needle)));
  }, [query, segments, speaker]);
  const selected = segments.find((item) => item.id === selectedId) ?? visible[0] ?? segments[0];

  if (!selected) return <div className="reader-empty"><MonoLabel>SOURCE READER</MonoLabel><p>Compile a proceeding to inspect every committed segment.</p></div>;

  const qa = qaExchanges.find((item) => item.question_segment_id === selected.id || item.answer_segment_ids.includes(selected.id) || item.context_segment_ids.includes(selected.id));
  const qaContext = qa ? qa.context_segment_ids.map((id) => segments.find((item) => item.id === id)).filter((item): item is Segment => Boolean(item)) : [];
  const linkedCandidates = candidates.filter((item) => item.source_segment_ids.includes(selected.id));
  const linkedGaps = acquisitions.filter((item) => item.deep_link === selected.deep_link);

  return <div className="source-reader-shell">
    <section className="transcript-panel" aria-label="Committed transcript source reader">
      <header className="panel-heading"><div><MonoLabel>SOURCE READER</MonoLabel><h2>{selected.artifact_title}</h2></div><span>{segments.length} committed segments · {visible.length} shown</span></header>
      <div className="reader-toolbar">
        <label><span>Search transcript</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Text, speaker, or timestamp" /></label>
        <label><span>Speaker</span><select value={speaker} onChange={(event) => setSpeaker(event.target.value)}><option value="all">All speakers</option>{speakers.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      </div>
      <div className="transcript-column">
        {visible.map((item) => <button className={`transcript-segment${item.id === selected.id ? " selected" : ""}`} type="button" aria-pressed={item.id === selected.id} onClick={() => setSelectedId(item.id)} key={item.id}>
          <time>{formatTimestamp(item.timestamp_start_ms)}</time>
          <div><strong>{item.speaker}</strong><p>{item.exact_text}</p><small>SEGMENT {String(item.ordinal + 1).padStart(4, "0")} · COMMITTED</small></div>
        </button>)}
      </div>
    </section>

    <aside className="provenance-inspector" aria-label="Selected segment provenance and review inspector">
      <header><div><MonoLabel>PROVENANCE INSPECTOR</MonoLabel><h2>Selected segment</h2></div><span className="attention-marker">EXACT SOURCE</span></header>
      <div className="inspector-scroll">
        <section className="inspector-section"><MonoLabel>EXACT TRANSCRIPT PASSAGE</MonoLabel><blockquote>{selected.exact_text}</blockquote><div className="spec-table"><SpecRow label="SEGMENT" value={selected.id} /><SpecRow label="ORDINAL" value={String(selected.ordinal)} /><SpecRow label="TIMESTAMP" value={formatTimestamp(selected.timestamp_start_ms)} /><SpecRow label="SPEAKER" value={selected.speaker} last /></div></section>
        {qa ? <section className="inspector-section"><MonoLabel>Q/A CONTEXT</MonoLabel><div className="qa-context">{qaContext.map((item) => <article className={item.id === qa.question_segment_id ? "question" : qa.answer_segment_ids.includes(item.id) ? "answer" : "context"} key={item.id}><time>{formatTimestamp(item.timestamp_start_ms)}</time><strong>{item.speaker}</strong><p>{item.exact_text}</p></article>)}</div></section> : null}
        <section className="inspector-section"><MonoLabel>PROVENANCE</MonoLabel><div className="spec-table"><SpecRow label="ARTIFACT" value={selected.artifact_title} /><SpecRow label="SHA-256" value={selected.artifact_sha256} /><SpecRow label="LOCATOR" value={JSON.stringify(selected.locator)} /><SpecRow label="PROVIDER LINK" value={selected.deep_link ? "PRESENT" : "UNAVAILABLE"} last /></div></section>
        <section className="inspector-section"><MonoLabel>EXTRACTION CANDIDATES</MonoLabel>{linkedCandidates.length === 0 ? <p className="console-muted">No candidate is linked to this segment. The committed source remains available.</p> : linkedCandidates.map((candidate) => {
          const history = reviewVersions.filter((item) => item.candidate_id === candidate.id).sort((a, b) => b.version - a.version);
          return <article className="candidate-review" key={candidate.id}><header><strong>{candidate.candidate_type.replaceAll("_", " ")}</strong><span>{candidate.review_status} · v{candidate.current_review_version}</span></header><pre>{JSON.stringify(candidate.payload, null, 2)}</pre>
            <form action={reviewExtractionCandidateAction} className="review-button-row"><input type="hidden" name="candidateId" value={candidate.id} /><input type="hidden" name="note" value="Reviewed in the transcript provenance inspector." /><button name="reviewAction" value="accept">Accept</button><button name="reviewAction" value="reject">Reject</button><button name="reviewAction" value="defer">Defer</button></form>
            <form action={reviewExtractionCandidateAction} className="review-payload-form"><input type="hidden" name="candidateId" value={candidate.id} /><input type="hidden" name="reviewAction" value="amend" /><textarea name="payload" defaultValue={JSON.stringify(candidate.payload, null, 2)} aria-label="Amended candidate JSON" /><input name="note" placeholder="Reason for amendment" /><button>Amend</button></form>
            <form action={reviewExtractionCandidateAction} className="review-payload-form"><input type="hidden" name="candidateId" value={candidate.id} /><input type="hidden" name="reviewAction" value="split" /><textarea name="payload" defaultValue={JSON.stringify([candidate.payload, candidate.payload], null, 2)} aria-label="Split candidate JSON array" /><input name="note" placeholder="Reason for split" /><button>Split</button></form>
            {history.length ? <details><summary>{history.length} immutable review version{history.length === 1 ? "" : "s"}</summary>{history.map((version) => <p key={version.version}>v{version.version} · {version.action} · {new Date(version.reviewed_at).toLocaleString()}<br />{version.note}</p>)}</details> : null}
          </article>;
        })}</section>
        <section className="inspector-section"><MonoLabel>ACQUISITION GAPS</MonoLabel>{linkedGaps.length === 0 ? <p className="console-muted">No acquisition target is linked to this exact segment.</p> : linkedGaps.map((gap) => <EvidenceCard tag={gap.priority.toUpperCase()} title={gap.title} relation={`${gap.acquisition_status} · ${gap.possessed_by_us ? "possessed" : "not possessed"}`} meta={gap.admitted_as_exhibit === null ? "ADMISSION UNKNOWN" : gap.admitted_as_exhibit ? "ADMITTED" : "NOT ADMITTED"} key={gap.id} />)}</section>
        <div className="inspector-actions">{selected.canonical_url ? <ActionLink href={selected.canonical_url} variant="console">Open source</ActionLink> : <span>Source URL not recorded</span>}{selected.deep_link ? <ActionLink href={selected.deep_link} variant="console">Open at timestamp</ActionLink> : null}</div>
      </div>
    </aside>
  </div>;
}
