"use client";

import { useMemo, useState } from "react";
import type { PositionRecord, ProceedingPackage, ProceedingSegment } from "@/lib/proceeding-compiler";

type SegmentFilter = "all" | "court" | "commonwealth" | "defense" | "review";

function phaseLabel(phase: ProceedingSegment["phase"]) {
  return phase.replaceAll("_", " ");
}

function partyLabel(party: ProceedingSegment["party"]) {
  return party === "commonwealth" ? "Commonwealth" : party === "defense" ? "Defense" : party === "court" ? "Court" : "Other";
}

function shortHash(hash: string) {
  return `${hash.slice(0, 12)}…${hash.slice(-8)}`;
}

function positionForSegment(positions: PositionRecord[], segmentId: string) {
  return positions.find((position) => position.segmentId === segmentId);
}

export function CompilerWorkbench({ proceeding }: { proceeding: ProceedingPackage }) {
  const [filter, setFilter] = useState<SegmentFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(proceeding.positions[0]?.segmentId ?? proceeding.segments[0].id);

  const filteredSegments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return proceeding.segments.filter((segment) => {
      const matchesFilter = filter === "all" || (filter === "review" ? segment.speakerReviewRequired || /\[inaudible/i.test(segment.exactText) : segment.party === filter);
      const matchesQuery = !normalizedQuery || `${segment.speaker} ${segment.originalSpeaker} ${segment.normalizedText} ${segment.timestamp}`.toLowerCase().includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [filter, proceeding.segments, query]);

  const selected = proceeding.segments.find((segment) => segment.id === selectedId) ?? filteredSegments[0] ?? proceeding.segments[0];
  const selectedPosition = positionForSegment(proceeding.positions, selected.id);
  const commonwealthPositions = proceeding.positions.filter((position) => position.party === "commonwealth");
  const defensePositions = proceeding.positions.filter((position) => position.party === "defense");
  const coveragePercent = Math.round(proceeding.coverage.coverageRatio * 100);

  function selectSegment(segmentId: string) {
    setSelectedId(segmentId);
    document.getElementById("record")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return <>
    <section className="compiler-hero">
      <div className="compiler-kicker"><span>PROCEEDING PACKAGE / V1</span><span>{proceeding.proceeding.date}</span></div>
      <div className="compiler-hero-grid">
        <div className="compiler-title-block">
          <span className="compiler-section-label">{proceeding.proceeding.jurisdiction}</span>
          <h1>Opening<br />Statements</h1>
          <p>{proceeding.proceeding.matter}</p>
        </div>
        <div className="compiler-boundary-card">
          <span className="compiler-section-label">RECORD BOUNDARY</span>
          <strong>Positions are not evidence.</strong>
          <p>The compiler preserves what each party told the jury, where it was said, and what proof was promised. It does not decide whether any position is true.</p>
          <div className="compiler-flow"><span>RAW SOURCE</span><i>→</i><span>STRUCTURED RECORD</span><i>→</i><b>CASEWORK</b></div>
        </div>
      </div>
      <div className="compiler-metrics" aria-label="Compilation totals">
        <div><strong>{proceeding.coverage.openingScopeSegments}</strong><span>Opening-scope segments</span></div>
        <div><strong>{proceeding.positions.length}</strong><span>Party positions</span></div>
        <div><strong>{proceeding.proceduralActions.length}</strong><span>Court + procedure</span></div>
        <div className="metric-attention"><strong>{proceeding.resolutionItems.length}</strong><span>Resolution items</span></div>
      </div>
    </section>

    <section className="compiler-coverage" aria-label="Source coverage">
      <header><div><span className="compiler-section-label">SOURCE COVERAGE</span><h2>Complete within the declared opening scope.</h2></div><b>{coveragePercent}%</b></header>
      <div className="coverage-track"><i style={{ width: `${coveragePercent}%` }} /></div>
      <div className="coverage-cells">
        <div><span>DETECTED / SOURCE</span><b>{proceeding.coverage.sourceDetectedSegments}</b><small>entire supplied Rev export</small></div>
        <div><span>PARSED / SOURCE</span><b>{proceeding.coverage.parsedSegments}</b><small>no parser loss detected</small></div>
        <div><span>DETECTED / SCOPE</span><b>{proceeding.coverage.openingScopeSegments}</b><small>through morning recess</small></div>
        <div><span>COMPILED / SCOPE</span><b>{proceeding.coverage.compiledOpeningSegments}</b><small>{proceeding.coverage.firstTimestamp} → {proceeding.coverage.lastTimestamp}</small></div>
        <div><span>STATE</span><b className="status-complete">COMPLETE</b><small>{proceeding.coverage.endBoundary}</small></div>
      </div>
    </section>

    <section className="compiler-record" id="record">
      <header className="compiler-section-head"><div><span className="compiler-section-label">CANONICAL RECORD</span><h2>Read the passage. Inspect the classification.</h2></div><p>{filteredSegments.length} / {proceeding.segments.length} visible</p></header>
      <div className="record-toolbar">
        <div className="record-tabs" role="group" aria-label="Filter transcript segments">
          {(["all", "court", "commonwealth", "defense", "review"] as const).map((value) => <button className={filter === value ? "active" : ""} onClick={() => setFilter(value)} key={value}>{value === "all" ? "ALL RECORD" : value === "review" ? "NEEDS REVIEW" : value.toUpperCase()}</button>)}
        </div>
        <label><span>SEARCH RECORD</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="voice, medical records, 911…" /></label>
      </div>
      <div className="compiler-reader">
        <div className="compiler-transcript" aria-label="Opening statement transcript">
          {filteredSegments.length === 0 ? <p className="compiler-empty">No segments match this view.</p> : filteredSegments.map((segment) => <button className={`compiler-segment${segment.id === selected.id ? " selected" : ""}`} onClick={() => setSelectedId(segment.id)} key={segment.id}>
            <div className="segment-rail"><time>{segment.timestamp}</time><span>{String(segment.ordinal + 1).padStart(3, "0")}</span></div>
            <div className="segment-copy"><header><strong>{segment.speaker}</strong><span className={`party-chip ${segment.party}`}>{partyLabel(segment.party)}</span>{segment.speakerReviewRequired ? <span className="review-chip">REVIEW SPEAKER</span> : null}</header><p>{segment.normalizedText}</p><small>{phaseLabel(segment.phase)} · {segment.recordKind.replaceAll("_", " ")}</small></div>
          </button>)}
        </div>

        <aside className="compiler-inspector" aria-label="Provenance inspector">
          <header><div><span className="compiler-section-label">PROVENANCE INSPECTOR</span><h2>Segment {String(selected.ordinal + 1).padStart(3, "0")}</h2></div><span className={selectedPosition ? "not-evidence-chip" : "record-type-chip"}>{selectedPosition ? "NOT EVIDENCE" : selected.recordKind.replaceAll("_", " ")}</span></header>
          <div className="inspector-block inspector-quote"><span className="compiler-section-label">EXACT SOURCE PASSAGE</span><blockquote>{selected.exactText}</blockquote></div>
          <div className="inspector-specs">
            <div><span>TIMESTAMP</span><b>{selected.timestamp}</b></div>
            <div><span>PARTY / ROLE</span><b>{partyLabel(selected.party).toUpperCase()}</b></div>
            <div><span>NORMALIZED SPEAKER</span><b>{selected.speaker}</b></div>
            <div><span>PROVIDER LABEL</span><b>{selected.originalSpeaker}</b></div>
            <div><span>SPEAKER CONFIDENCE</span><b className={selected.speakerReviewRequired ? "attention-text" : ""}>{selected.speakerConfidence.toFixed(2)}</b></div>
            <div><span>CHARACTER RANGE</span><b>{selected.sourceStart}–{selected.sourceEnd}</b></div>
          </div>
          {selectedPosition ? <div className="inspector-block position-classification"><span className="compiler-section-label">EXTRACTION CLASS</span><strong>{selectedPosition.positionKind.replaceAll("_", " ")}</strong><p>Stored as <code>advocacy_position</code>. This passage may describe expected evidence or an alleged event, but the compiler does not promote it to evidence or fact.</p></div> : <div className="inspector-block"><span className="compiler-section-label">RECORD CLASS</span><strong>{selected.recordKind.replaceAll("_", " ")}</strong><p>Court instruction and proceeding mechanics remain outside both party position lanes.</p></div>}
          <div className="inspector-block source-chain"><span className="compiler-section-label">SOURCE CHAIN</span><div><span>USER-SUPPLIED EXPORT</span><i>→</i><span>EXACT SEGMENT</span><i>→</i><b>{selectedPosition ? "POSITION" : "PROCEDURE"}</b></div><small>{proceeding.source.artifactName} · SHA-256 {shortHash(proceeding.source.sha256)}</small></div>
        </aside>
      </div>
    </section>

    <section className="position-register">
      <header className="compiler-section-head"><div><span className="compiler-section-label">POSITION REGISTER</span><h2>Two arguments. One non-evidence record class.</h2></div><p>{commonwealthPositions.length} Commonwealth · {defensePositions.length} Defense</p></header>
      <div className="position-columns">
        <PositionLane title="Commonwealth" code="P-01" positions={commonwealthPositions} onSelect={selectSegment} />
        <PositionLane title="Defense" code="P-02" positions={defensePositions} onSelect={selectSegment} />
      </div>
    </section>

    <section className="compiler-console">
      <header className="compiler-section-head"><div><span className="compiler-section-label">PACKAGE READINESS</span><h2>Publish the record. Carry the unknowns.</h2></div><span className="console-package-state">{proceeding.schemaVersion}</span></header>
      <div className="console-grid">
        <div className="resolution-panel"><header><span className="compiler-section-label">UNRESOLVED</span><strong>{proceeding.resolutionItems.length}</strong></header>{proceeding.resolutionItems.map((item) => <article key={item.id}><span>{item.kind.replaceAll("_", " ")}</span><strong>{item.title}</strong><p>{item.detail}</p><small>{item.segmentIds.length} linked segment{item.segmentIds.length === 1 ? "" : "s"}</small></article>)}</div>
        <div className="package-panel"><header><span className="compiler-section-label">PROCEEDING PACKAGE</span><b>READY</b></header><dl><div><dt>Package ID</dt><dd>{proceeding.packageId}</dd></div><div><dt>Artifact hash</dt><dd>{shortHash(proceeding.source.sha256)}</dd></div><div><dt>Positions</dt><dd>{proceeding.positions.length}</dd></div><div><dt>Referenced sources</dt><dd>{proceeding.referencedSources.length}</dd></div><div><dt>Evidence items</dt><dd>0</dd></div><div><dt>Boundary</dt><dd>record only / no case analysis</dd></div></dl><div className="invariant-list">{proceeding.invariants.map((invariant, index) => <p key={invariant}><span>{String(index + 1).padStart(2, "0")}</span>{invariant}</p>)}</div></div>
      </div>
    </section>

    <footer className="compiler-footer"><span>TRANSCRIPT IN → PROVENANCE-PRESERVED PROCEEDING OUT</span><b>TESTIMONY COMPILER / ICARUS</b><span>POSITION ≠ EVIDENCE · EXTRACTION ≠ TRUTH</span></footer>
  </>;
}

function PositionLane({ title, code, positions, onSelect }: { title: string; code: string; positions: PositionRecord[]; onSelect: (segmentId: string) => void }) {
  return <div className={`position-lane ${title.toLowerCase()}`}><header><div><span>{code}</span><h3>{title}</h3></div><b>{positions.length}</b></header><div>{positions.map((position, index) => <button onClick={() => onSelect(position.segmentId)} key={position.id}><span>{String(index + 1).padStart(2, "0")}</span><div><small>{position.timestamp} · {position.positionKind.replaceAll("_", " ")}</small><p>{position.assertion}</p></div><b>VIEW →</b></button>)}</div></div>;
}
