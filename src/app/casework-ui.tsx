import Link from "next/link";
import { Fragment, type ReactNode } from "react";

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

/* ── Design-system primitives ───────────────────────────────────────────────────
   Shared building blocks from the Icarus Casework design system. Styles live in design-system.css. */

export function PageHeader({ eyebrow, title, lede, actions, aside, compact = false, children }: { eyebrow: ReactNode; title: ReactNode; lede?: ReactNode; actions?: ReactNode; aside?: ReactNode; compact?: boolean; children?: ReactNode }) {
  return <header className={`ds-page-head${compact ? " ds-page-head--compact" : ""}`}>
    <div className="ds-page-head__main">
      <span className="ds-eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      {lede ? <p>{lede}</p> : null}
      {children}
    </div>
    {actions || aside ? <div className="ds-page-head__side">{aside}{actions ? <div className="ds-page-head__actions">{actions}</div> : null}</div> : null}
  </header>;
}

export function SectionHead({ title, eyebrow, as: Heading = "h2" }: { title: ReactNode; eyebrow?: ReactNode; as?: "h2" | "h3" }) {
  return <div className="ds-section-head"><Heading>{title}</Heading>{eyebrow ? <span>{eyebrow}</span> : null}</div>;
}

export type ChipTone = "verified" | "candidate" | "review" | "discrepancy" | "device" | "ok" | "neutral";

export function Chip({ tone = "neutral", children }: { tone?: ChipTone; children: ReactNode }) {
  return <span className={`ds-chip${tone === "neutral" ? "" : ` ${tone}`}`}>{children}</span>;
}

export function StatStrip({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return <dl className="ds-stats">{items.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>;
}

export function Callout({ label, tone = "default", children }: { label?: ReactNode; tone?: "default" | "risk" | "chain" | "device"; children: ReactNode }) {
  return <div className={`ds-callout${tone === "default" ? "" : ` ${tone}`}`}>{label ? <strong>{label}</strong> : null}<p>{children}</p></div>;
}

export function EmptyState({ title, children }: { title?: ReactNode; children?: ReactNode }) {
  return <div className="ds-empty">{title ? <strong>{title}</strong> : null}{children}</div>;
}

export type StepState = "upcoming" | "active" | "done";

/** Upload → Parsing → Review → Confirmed. Steps with an href are links; the rest are inert markers. */
export function Stepper({ label, steps }: { label: string; steps: Array<{ num: string; label: ReactNode; state: StepState; href?: string }> }) {
  return <nav className="ds-stepper" aria-label={label}>
    {steps.map((step, index) => {
      const className = `ds-step${step.state === "active" ? " active" : ""}${step.state === "done" ? " done" : ""}${step.href ? "" : " disabled"}`;
      const inner = <><span className="n">{step.num}</span>{step.label}</>;
      return <Fragment key={step.num}>
        {step.href ? <Link className={className} href={step.href} aria-current={step.state === "active" ? "step" : undefined}>{inner}</Link> : <span className={className} aria-current={step.state === "active" ? "step" : undefined}>{inner}</span>}
        {index < steps.length - 1 ? <span className={`ds-step-line${steps[index + 1].state !== "upcoming" ? " done" : ""}`} aria-hidden="true" /> : null}
      </Fragment>;
    })}
  </nav>;
}
