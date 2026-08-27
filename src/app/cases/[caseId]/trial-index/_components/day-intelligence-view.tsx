import Link from "next/link";
import { MonoLabel } from "@/app/casework-ui";
import { courtRecordHref } from "@/lib/case-routes";
import type { DayIntelligenceBundle, DayIntelligenceItem } from "@/lib/day-intelligence";

const sections: Array<{ key: DayIntelligenceItem["section"]; label: string }> = [
  { key: "insights", label: "Insights" },
  { key: "positions_working_conclusions", label: "Positions & opinions" },
  { key: "evidence_chains", label: "Evidence chains" },
  { key: "relationships", label: "Relationships" },
  { key: "risks_tensions", label: "Risks & tensions" },
  { key: "open_questions", label: "Open questions" },
  { key: "actions", label: "Actions" },
  { key: "memory_candidates", label: "Memory candidates" },
  { key: "handoff", label: "Handoff" },
];

function label(value: string) {
  return value.replaceAll("_", " ");
}

function ItemCard({ caseId, item }: { caseId: string; item: DayIntelligenceItem }) {
  return <article className="day-intelligence-item" id={`item-${item.item_id}`}>
    <header>
      <div><MonoLabel>{label(item.epistemic_class)} · {item.importance}</MonoLabel><h4>{item.title}</h4></div>
      <span className={`state-chip ${item.source_linkage_status === "complete" ? "pass" : "warn"}`}>{item.source_linkage_status === "complete" ? "SOURCE LINKED" : "LINKAGE PENDING"}</span>
    </header>
    <p>{item.content}</p>
    <dl>
      <div><dt>Review</dt><dd>{label(item.review_status)}</dd></div>
      <div><dt>Assessment</dt><dd>{label(item.evidentiary_assessment)}</dd></div>
      <div><dt>Extraction</dt><dd>{Math.round(item.extraction_confidence * 100)}%</dd></div>
    </dl>
    {item.sources.length > 0 ? <div className="day-intelligence-sources">{item.sources.map((source, index) => <div key={`${item.item_id}-source-${index}`}>
      <span>{source.speaker_name || "Source not attributed"}{source.locator?.value ? ` · ${source.locator.value}` : ""}</span>
      <em>{label(source.role)}</em>
      {source.source_segment_id ? <Link href={courtRecordHref(caseId, { segmentId: source.source_segment_id })}>Exact testimony →</Link> : <small>Exact segment not linked</small>}
    </div>)}</div> : null}
  </article>;
}

export function DayIntelligenceView({ bundle, dayNumber, caseId }: { bundle: DayIntelligenceBundle | null; dayNumber: number; caseId: string }) {
  if (!bundle) return <div className="day-intelligence-empty">
    <MonoLabel>DAY {dayNumber} · NO GENERATED ARTIFACT</MonoLabel>
    <h3>Day Intelligence has not been generated yet.</h3>
    <p>After this day’s testimony is available, run the legal-evidentiary collapse and context-card compiler. Icarus will render the resulting four-file bundle here without adding anything to the database.</p>
    <code>generated/day-intelligence/day-{String(dayNumber).padStart(2, "0")}/v1/</code>
  </div>;

  const { card, agentPack } = bundle;
  return <div className="day-intelligence-view">
    <div className="day-intelligence-boundary"><strong>GENERATED ANALYSIS · REFERENCE ONLY</strong><span>This view organizes testimony; it is not canonical fact and does not replace the Court Record.</span></div>
    <section className="day-intelligence-overview">
      <header><div><MonoLabel>ARTIFACT {card.artifact_set_id} · VERSION {card.version}</MonoLabel><h3>{card.subtitle}</h3></div><div className="day-intelligence-status"><span className="state-chip warn">{label(card.review_status)}</span><span className={`state-chip ${card.source_linkage_status === "complete" ? "pass" : "warn"}`}>{label(card.source_linkage_status)}</span></div></header>
      <p className="lede">{card.one_liner}</p>
      <div className="day-intelligence-change"><div><strong>Day purpose</strong><p>{card.purpose}</p></div><div><strong>What changed</strong><p>{card.what_changed}</p></div></div>
      <div className="day-intelligence-topics">{card.primary_topics.map((topic) => <span key={topic}>{topic}</span>)}</div>
    </section>
    <nav className="day-intelligence-section-nav" aria-label="Day Intelligence sections">{sections.flatMap((section) => agentPack.items.some((item) => item.section === section.key) ? [<a href={`#intelligence-${section.key}`} key={section.key}>{section.label}</a>] : [])}</nav>
    {sections.map((section) => {
      const items = agentPack.items.filter((item) => item.section === section.key);
      return items.length > 0 ? <section className="day-intelligence-section" id={`intelligence-${section.key}`} key={section.key}>
        <header><h3>{section.label}</h3><span>{items.length}</span></header>
        <div>{items.map((item) => <ItemCard caseId={caseId} item={item} key={item.item_id} />)}</div>
      </section> : null;
    })}
    {agentPack.limitations.length > 0 ? <section className="day-intelligence-limitations"><header><h3>Visible limitations</h3><span>{agentPack.limitations.length}</span></header>{agentPack.limitations.map((item) => <article key={item.code}><strong>{label(item.code)}</strong><p>{item.description}</p></article>)}</section> : null}
  </div>;
}
