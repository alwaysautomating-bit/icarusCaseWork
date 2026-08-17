import type { ReactNode } from "react";

export function Wordmark() {
  return <div className="wordmark" aria-label="Icarus Casework"><span className="wordmark-mark" aria-hidden="true"><i /></span><span>ICARUS</span><b>CASEWORK</b></div>;
}

export function MonoLabel({ children }: { children: ReactNode }) {
  return <span className="mono-label">{children}</span>;
}

export function SpecRow({ label, value, accent = false, last = false }: { label: string; value: ReactNode; accent?: boolean; last?: boolean }) {
  return <div className={`spec-row${last ? " last" : ""}`}><span>{label}</span><b className={accent ? "accent" : ""}>{value}</b></div>;
}

export function ActionLink({ href, children, variant = "outline" }: { href: string; children: ReactNode; variant?: "primary" | "outline" | "console" }) {
  return <a className={`system-button ${variant}`} href={href} target="_blank" rel="noreferrer">{children}<span aria-hidden="true">→</span></a>;
}

export function ConfidenceBar({ value }: { value: number }) {
  const percent = Math.max(0, Math.min(100, Math.round(value * 100)));
  return <div className="confidence-block"><div className="confidence-heading"><span>EXTRACTION CONFIDENCE</span><b>{value.toFixed(2)}</b></div><div className="confidence-track" aria-label={`Extraction confidence ${value.toFixed(2)}`}><i style={{ width: `${percent}%` }} /></div><small>Parser certainty only. This is not an evidentiary assessment.</small></div>;
}

export function RecordDimensions({ lane, recordState, assessment }: { lane: string; recordState: "extracted" | "reviewed" | "ledgered"; assessment: string }) {
  const recordSteps = ["CAPTURED", "EXTRACTED", "REVIEWED", "LEDGERED"];
  const activeIndex = recordState === "ledgered" ? 3 : recordState === "reviewed" ? 2 : 1;
  return <div className="record-dimensions">
    <div><MonoLabel>EVIDENCE LANE</MonoLabel><strong className="dimension-value">{lane.replaceAll("_", " ")}</strong><small>Classification, not weight</small></div>
    <div><MonoLabel>RECORD STATE</MonoLabel><ol className="record-steps">{recordSteps.map((step, index) => <li className={index <= activeIndex ? "complete" : ""} key={step}>{step}</li>)}</ol><small>Integrity state, not truth</small></div>
    <div><MonoLabel>EVIDENTIARY ASSESSMENT</MonoLabel><strong className={`dimension-value assessment ${assessment === "unassessed" ? "attention" : ""}`}>{assessment.replaceAll("_", " ")}</strong><small>Independent of review state</small></div>
  </div>;
}

export function RelationshipCard({ source, relation, target, candidate = false }: { source: string; relation: string; target: string; candidate?: boolean }) {
  return <div className={`relationship-card${candidate ? " candidate" : ""}`}><div><MonoLabel>SOURCE</MonoLabel><strong>{source}</strong></div><div className="relationship-relation"><span aria-hidden="true">→</span><b>{relation.replaceAll("_", " ")}</b></div><div><MonoLabel>TARGET</MonoLabel><strong>{target}</strong></div></div>;
}

export function EvidenceCard({ tag, title, relation, meta }: { tag: string; title: string; relation: string; meta: string }) {
  return <article className="evidence-card"><div><MonoLabel>{tag}</MonoLabel><span className="reference-state">REFERENCE</span></div><strong>{title}</strong><p>{relation}</p><small>{meta}</small></article>;
}

export function EventRow({ reference, date, title, meta, selected = false }: { reference: string; date: string; title: string; meta: string; selected?: boolean }) {
  return <article className={`event-row${selected ? " selected" : ""}`}><b>{reference}</b><time>{date}</time><div><strong>{title}</strong><small>{meta}</small></div><span className="record-chip">REVIEWED</span></article>;
}
