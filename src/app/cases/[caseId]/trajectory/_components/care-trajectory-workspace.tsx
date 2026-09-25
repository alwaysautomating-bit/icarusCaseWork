"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import "@/app/care-trajectory.css";
import { MonoLabel } from "@/app/casework-ui";
import {
  clusterLane,
  daysBetween,
  fullWindow,
  inWindow,
  leadUpWindow,
  medicationLanes,
  positionPercent,
  trajectoryFacts,
  type CareSetting,
  type Cluster,
  type Evidence,
  type Lane,
  type SupportCard,
  type TrajectoryEvent,
  type Window,
} from "@/lib/medical-trajectory-model";

export type WorkspaceData = {
  events: TrajectoryEvent[];
  support: SupportCard[];
  questions: { id: string; text: string; origin: string }[];
  ownershipSignals: SupportCard[];
  sequence: SupportCard[];
  sequenceFrame: { start: string; end: string; label: string };
  settings: CareSetting[];
  sources: { day: number; witness: string; reviewed: boolean }[];
  sourceNotes: string[];
};

type Selection = { kind: "event"; event: TrajectoryEvent } | { kind: "support"; card: SupportCard };
type Mode = "full" | "leadup";

const LANE_LABEL: Record<Lane, string> = { medication: "Medication", state: "Clinical state", safety: "Safety and risk", diagnostic: "Diagnostic model", care: "Care contacts" };
const PROVENANCE_LABEL = { clinician: "Clinician act", reported: "Patient report", record: "Read from record", relayed: "Relayed about another provider" } as const;
const BASIS_LABEL: Record<string, string> = {
  firsthand_provider: "witness did or observed it", patient_statement_to_witness: "patient told the witness", record_read_by_witness: "read from a record",
  counsel_proposition_affirmed: "counsel's question, witness affirmed", third_party_report: "relayed about another provider", witness_general_knowledge: "general knowledge",
};
const KIND_LABEL: Record<SupportCard["kind"], string> = {
  testimony: "Testimony", record: "Read from record", question_raised: "Raised in a question · not confirmed", source_needed: "Source needed", researcher_observation: "Researcher observation",
};

const fmt = (iso: string, compact = false) => new Intl.DateTimeFormat("en-US", compact ? { month: "short", day: "numeric", timeZone: "UTC" } : { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const titleCase = (key: string) => key.replace(/(^|-)([a-z])/g, (_, a: string, b: string) => `${a === "-" ? " " : ""}${b.toUpperCase()}`);

function ticksFor(window: Window, mode: Mode) {
  if (mode === "leadup") return Array.from({ length: daysBetween(window.start, window.end) + 1 }, (_, i) => new Date(Date.parse(`${window.start}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10)).filter((_, i) => i % 2 === 0);
  const ticks = new Set<string>([window.start]);
  for (const month of ["2022-10-01", "2022-11-01", "2022-12-01", "2023-01-01"]) if (inWindow(month, window)) ticks.add(month);
  ticks.add(window.end);
  return [...ticks];
}

function Quote({ evidence }: { evidence: Evidence }) {
  return <figure className="ct-quote">
    <figcaption>Day {evidence.day} · segment {evidence.seg}</figcaption>
    {evidence.exchange.length ? evidence.exchange.map((turn) => <p key={turn.seg} className={turn.seg === evidence.seg ? "cited" : undefined}><b>{turn.speaker} · {turn.time}</b>{turn.text}</p>) : <p className="cited">{evidence.span}</p>}
    <blockquote>“{evidence.span}”</blockquote>
    {evidence.href ? <Link href={evidence.href}>Open exact testimony →</Link> : <small>Not in a first-pass witness block, so it cannot open in the Witness view yet. The exchange is shown here.</small>}
  </figure>;
}

function References({ items }: { items?: SupportCard["references"] }) {
  if (!items?.length) return null;
  return <ul className="ct-refs">{items.map((r) => <li key={r.url}><a href={r.url} target="_blank" rel="noopener noreferrer">{r.label} ↗</a><span>{r.note}</span></li>)}</ul>;
}

function Marker({ cluster, window, selectedId, onSelect, tone }: { cluster: Cluster; window: Window; selectedId: string | null; onSelect: (event: TrajectoryEvent) => void; tone?: (event: TrajectoryEvent) => string }) {
  const first = cluster.events[0]!;
  const active = cluster.events.some((event) => event.id === selectedId);
  return <button
    type="button"
    className={`ct-marker prov-${first.provenance}${first.approximate ? " approx" : ""}${first.conflicts.length ? " flagged" : ""}${active ? " selected" : ""} ${tone?.(first) ?? ""}`}
    style={{ left: `${positionPercent(cluster.date, window)}%` }}
    onClick={() => onSelect(cluster.events.find((event) => event.id === selectedId) ?? first)}
    aria-label={`${first.title}${cluster.events.length > 1 ? ` and ${cluster.events.length - 1} more` : ""}, ${fmt(cluster.date)}`}
    title={`${fmt(cluster.date)} · ${first.title}`}
  >{cluster.events.length > 1 ? <span>{cluster.events.length}</span> : null}</button>;
}

function Lane({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return <div className="ct-lane"><div className="ct-lane-label"><strong>{label}</strong>{sub ? <span>{sub}</span> : null}</div><div className="ct-track">{children}</div></div>;
}

export function CareTrajectoryWorkspace({ data }: { data: WorkspaceData }) {
  const { events, support } = data;
  // No selection means the header shows the overview; clicking anything replaces it with that record.
  const [selection, setSelection] = useState<Selection | null>(null);
  const [mode, setMode] = useState<Mode>("full");
  const shell = useRef<HTMLElement>(null);

  // The case masthead and lifecycle nav are sticky; keep the inspector just below them.
  useEffect(() => {
    const place = () => {
      const nav = document.querySelector(".case-lifecycle-nav");
      shell.current?.style.setProperty("--ct-top", `${Math.round(nav ? nav.getBoundingClientRect().bottom : 0)}px`);
    };
    place();
    globalThis.addEventListener("resize", place);
    return () => globalThis.removeEventListener("resize", place);
  }, []);

  const full = useMemo(() => fullWindow(events, support), [events, support]);
  const selectedDate = !selection ? full.end : selection.kind === "event" ? selection.event.date : selection.card.date ?? full.end;
  const window = mode === "full" ? full : leadUpWindow(selectedDate);
  const facts = trajectoryFacts(events, full);
  const episodeStart = events.find((e) => e.lane === "care")?.date ?? full.start;
  const selectedId = selection?.kind === "event" ? selection.event.id : null;
  const onEvent = (event: TrajectoryEvent) => setSelection({ kind: "event", event });
  const ticks = ticksFor(window, mode);

  const settingLanes = data.settings.map((setting) => ({ setting, clusters: clusterLane(events.filter((e) => e.setting === setting.key && (e.lane === "care" || e.lane === "medication")).map((e) => ({ ...e, lane: "care" as Lane })), "care", window) })).filter((l) => l.clusters.length > 0);
  const medLanes = medicationLanes(events, window);
  const supportDated = support.filter((card) => card.date && inWindow(card.date, window));
  const leadUp = mode === "leadup" ? events.filter((e) => inWindow(e.date, window)) : [];
  const siblings = selection?.kind === "event" ? events.filter((e) => e.lane === selection.event.lane && e.date === selection.event.date && e.id !== selection.event.id) : [];
  const settingLabel = (key: string | null) => data.settings.find((s) => s.key === key)?.label ?? null;

  return <main className="ct-shell" ref={shell}>
    <section className={`ct-inspector${selection ? "" : " is-overview"}`} aria-live="polite">
      {!selection ? <>
        <div className="ct-inspector-main">
          <MonoLabel>CARE TRAJECTORY · SOURCE-BACKED</MonoLabel>
          <h2>Severity ≠ imminent dangerousness ≠ treatment response</h2>
          <p>Three questions the questioning keeps compressing: how ill she was, whether she met the emergency threshold, and whether treatment was working. Click any event, card or line to see what was said, by whom, and how they knew. A projection of testimony extractions, not a clinical record and not a finding of fault.</p>
        </div>
        <dl className="ct-stats">
          <div><dt>Days of one episode</dt><dd>{daysBetween(episodeStart, full.end) + 1}</dd></div>
          <div><dt>Medications</dt><dd>{facts.medications}</dd></div>
          <div><dt>Care settings</dt><dd>{data.settings.length}</dd></div>
          <div><dt>Prescribing settings</dt><dd>{facts.prescribers}</dd></div>
        </dl>
      </> : selection.kind === "event" ? <>
        <div className="ct-inspector-main">
          <MonoLabel>{LANE_LABEL[selection.event.lane].toUpperCase()} · {PROVENANCE_LABEL[selection.event.provenance].toUpperCase()}</MonoLabel>
          <h2>{selection.event.title}</h2>
          <p>{selection.event.note ?? selection.event.summary}</p>
          {selection.event.conflicts.length ? <p className="ct-flag"><b>Flagged for review.</b> {selection.event.conflicts[0]}</p> : null}
        </div>
        <dl>
          <div><dt>Clinical/event time</dt><dd>{selection.event.approximate ? "≈ " : ""}{fmt(selection.event.date)}</dd></div>
          <div><dt>Evidence status</dt><dd>{selection.event.status === "uncertain" ? "hedged · " : ""}{BASIS_LABEL[selection.event.basis] ?? selection.event.basis}</dd></div>
          <div><dt>Testimony source</dt><dd>{selection.event.days.map((d) => `Day ${d}`).join(" + ")}{selection.event.days.length > 1 ? " · corroborated" : ""}{settingLabel(selection.event.setting) ? ` · ${settingLabel(selection.event.setting)}` : ""}</dd></div>
        </dl>
        <div className="ct-inspector-actions">
          <button type="button" className="ghost" onClick={() => { setSelection(null); setMode("full"); }}>← Overview</button>
          <button type="button" aria-pressed={mode === "leadup"} onClick={() => setMode(mode === "leadup" ? "full" : "leadup")}>{mode === "leadup" ? "Show full trajectory" : "Show the 14 days before"}</button>
          <details><summary>Exact testimony ({selection.event.evidence.length})</summary>{selection.event.evidence.slice(0, 6).map((e) => <Quote key={`${e.day}-${e.seg}-${e.span}`} evidence={e} />)}</details>
        </div>
        {siblings.length ? <p className="ct-siblings">Also this day: {siblings.map((s) => <button type="button" key={s.id} onClick={() => onEvent(s)}>{s.title}</button>)}</p> : null}
      </> : <>
        <div className="ct-inspector-main">
          <MonoLabel>SUPPORT AND STRESSORS · {KIND_LABEL[selection.card.kind].toUpperCase()}</MonoLabel>
          <h2>{selection.card.title}</h2>
          <p>{selection.card.detail}</p>
          <References items={selection.card.references} />
        </div>
        <dl>
          <div><dt>Clinical/event time</dt><dd>{selection.card.date ? fmt(selection.card.date) : "not dated"}</dd></div>
          <div><dt>Evidence status</dt><dd>{KIND_LABEL[selection.card.kind]}</dd></div>
          <div><dt>Testimony source</dt><dd>{selection.card.sources.length ? [...new Set(selection.card.sources.map((s) => `Day ${s.day}`))].join(" + ") : "none loaded"}</dd></div>
        </dl>
        <div className="ct-inspector-actions">
          <button type="button" className="ghost" onClick={() => { setSelection(null); setMode("full"); }}>← Overview</button>
          {selection.card.date ? <button type="button" aria-pressed={mode === "leadup"} onClick={() => setMode(mode === "leadup" ? "full" : "leadup")}>{mode === "leadup" ? "Show full trajectory" : "Show the 14 days before"}</button> : null}
          {selection.card.sources.length ? <details><summary>Exact testimony ({selection.card.sources.length})</summary>{selection.card.sources.slice(0, 6).map((s) => <Quote key={`${s.day}-${s.seg}`} evidence={{ day: s.day, seg: s.seg, span: s.span, exchange: s.exchange ?? [], href: s.href ?? null }} />)}</details> : null}
        </div>
      </>}
    </section>

    <section className="ct-controls" aria-label="Timeline scale">
      <div><MonoLabel>TIME SCALE</MonoLabel><strong>{mode === "full" ? "Full trajectory" : `14 days before ${fmt(selectedDate)}`}</strong><span>{fmt(window.start)} — {fmt(window.end)}</span></div>
      <div role="group" aria-label="Select timeline scale">
        <button type="button" aria-pressed={mode === "full"} onClick={() => setMode("full")}>Full trajectory</button>
        <button type="button" aria-pressed={mode === "leadup"} disabled={!selection} title={selection ? undefined : "Select an event first"} onClick={() => setMode("leadup")}>14 days before selection</button>
      </div>
      <p className="ct-legend"><i className="lg prov-clinician" />clinician act <i className="lg prov-reported" />patient report <i className="lg prov-record" />read from record <i className="lg approx" />approximate date <i className="lg flagged" />flagged for review</p>
    </section>

    <section className="ct-board">
      <div className="ct-scroll">
        <header className="ct-axis"><div className="ct-lane-label"><strong>CALENDAR</strong><span>clinical/event time</span></div><div className="ct-track">{ticks.map((tick) => <time key={tick} style={{ left: `${positionPercent(tick, window)}%` }}>{fmt(tick, true)}</time>)}</div></header>
        <Lane label="Continuing episode" sub="analytical frame"><div className="ct-episode" style={{ left: `${positionPercent(episodeStart > window.start ? episodeStart : window.start, window)}%`, right: 0 }}><strong>{mode === "full" ? "Persistent episode without demonstrated stabilization" : `Days ${Math.max(1, daysBetween(episodeStart, window.start) + 1)}–${daysBetween(episodeStart, window.end) + 1} of the same episode`}</strong></div></Lane>

        <div className="ct-group"><header><strong>WHO HELD THE PLAN</strong><span>care contacts by setting · colour = setting</span></header>
          {settingLanes.map(({ setting, clusters }) => <Lane key={setting.key} label={setting.label} sub={setting.person}>{clusters.map((c) => <Marker key={c.key} cluster={c} window={window} selectedId={selectedId} onSelect={onEvent} tone={() => `set-${setting.key}`} />)}</Lane>)}
        </div>

        <div className="ct-group"><header><strong>MEDICATION</strong><span>line = first to last documented event, not continuous use · marker colour = who was attributed</span></header>
          {medLanes.map((lane) => <Lane key={lane.medication} label={titleCase(lane.medication)} sub={lane.settings.map((s) => settingLabel(s)).filter(Boolean).join(" · ") || "prescriber not stated"}>
            <span className="ct-span" style={{ left: `${positionPercent(lane.first > window.start ? lane.first : window.start, window)}%`, right: `${100 - positionPercent(lane.last < window.end ? lane.last : window.end, window)}%` }} />
            {lane.clusters.map((c) => <Marker key={c.key} cluster={c} window={window} selectedId={selectedId} onSelect={onEvent} tone={(e) => (e.setting ? `set-${e.setting}` : "set-unknown")} />)}
          </Lane>)}
        </div>

        <div className="ct-group"><header><strong>STATE, RISK AND DIAGNOSIS</strong><span>what was reported and observed</span></header>
          {(["state", "safety", "diagnostic"] as const).map((lane) => <Lane key={lane} label={LANE_LABEL[lane]}>{clusterLane(events, lane, window).map((c) => <Marker key={c.key} cluster={c} window={window} selectedId={selectedId} onSelect={onEvent} />)}</Lane>)}
        </div>

        <div className="ct-group"><header><strong>SUPPORT AND STRESSORS</strong><span>only where a source is loaded</span></header>
          <Lane label="Household and work" sub={`${support.filter((c) => c.kind === "source_needed").length} sources still needed`}>
            {supportDated.map((card) => <button type="button" key={card.id} className={`ct-marker sup-${card.kind}${selection?.kind === "support" && selection.card.id === card.id ? " selected" : ""}`} style={{ left: `${positionPercent(card.date!, window)}%` }} onClick={() => setSelection({ kind: "support", card })} aria-label={`${card.title}, ${fmt(card.date!)}`} title={`${fmt(card.date!)} · ${card.title}`} />)}
          </Lane>
        </div>
      </div>
    </section>

    {mode === "leadup" ? <section className="ct-leadup">
      <header><MonoLabel>THE 14 DAYS BEFORE {fmt(selectedDate).toUpperCase()}</MonoLabel><h2>{leadUp.length} documented events in {daysBetween(window.start, window.end)} days</h2><p>The same episode, not a fresh one. Pick any line to move the header to it.</p></header>
      <ol>{leadUp.map((e) => <li key={e.id} className={e.id === selectedId ? "on" : undefined}><button type="button" onClick={() => onEvent(e)}><time>{fmt(e.date, true)}</time><span className={`lane-${e.lane}`}>{LANE_LABEL[e.lane]}</span><strong>{e.title}</strong></button></li>)}</ol>
    </section> : null}

    <section className="ct-sequence">
      <header><MonoLabel>THE DOCUMENTED SEQUENCE · DEC 16 TO JAN 23</MonoLabel><h2>Ill, charted as deteriorating, and not an imminent danger, all at once</h2><p>Each line is the witness&apos;s own testimony or a record she confirmed. Pick one to load it into the header with its exact question and answer.</p></header>
      <div className="ct-sequence-callout"><b>{daysBetween(data.sequenceFrame.start, data.sequenceFrame.end)} days</b><span>{data.sequenceFrame.label}. The last antidepressant trial and its increase fall inside this window.</span><button type="button" onClick={() => { const card = data.sequence.at(-1); if (card) { setSelection({ kind: "support", card }); globalThis.scrollTo?.({ top: 0, behavior: "smooth" }); } }}>See the source</button></div>
      <ol>{data.sequence.map((card) => <li key={card.id}><button type="button" onClick={() => { setSelection({ kind: "support", card }); globalThis.scrollTo?.({ top: 0, behavior: "smooth" }); }}><time>{card.date ? fmt(card.date, true) : ""}</time><strong>{card.title}</strong><span>{card.detail}</span></button></li>)}</ol>
    </section>

    <section className="ct-ownership">
      <header><MonoLabel>OWNERSHIP OF CARE</MonoLabel><h2>What the record shows about who held the plan</h2><p>Each line is testimony. Whether it amounts to a gap in ownership is the analytical question, and it is left open.</p></header>
      <div className="ct-owner-grid">
        <ul>{data.ownershipSignals.map((card) => <li key={card.id}><button type="button" onClick={() => { setSelection({ kind: "support", card }); globalThis.scrollTo?.({ top: 0, behavior: "smooth" }); }}><time>{card.date ? fmt(card.date) : ""}</time><strong>{card.title}</strong><span>{card.detail}</span></button></li>)}</ul>
        <aside><MonoLabel>QUESTIONS THE RECORD INVITES</MonoLabel><ul>{data.questions.map((q) => <li key={q.id}>{q.text}<small>{q.origin}</small></li>)}</ul></aside>
      </div>
    </section>

    <section className="ct-support">
      <header><MonoLabel>SUPPORT AND STRESSORS</MonoLabel><h2>The household and work context, with its sources</h2><p>Cards from testimony show their quotes. Cards raised in a question say so. Cards that need a source assert nothing until one is added.</p></header>
      <div className="ct-support-grid">{support.map((card) => <article key={card.id} className={`kind-${card.kind}`}>
        <MonoLabel>{KIND_LABEL[card.kind].toUpperCase()}{card.date ? ` · ${fmt(card.date).toUpperCase()}` : ""}</MonoLabel>
        <h3>{card.title}</h3><p>{card.detail}</p><References items={card.references} />
        {card.date ? <button type="button" onClick={() => { setSelection({ kind: "support", card }); globalThis.scrollTo?.({ top: 0, behavior: "smooth" }); }}>Show on timeline</button> : null}
      </article>)}</div>
    </section>

    <footer className="ct-footnote">
      <strong>Frame and sources</strong>
      <span>The question is systemic: who owned the plan while the episode continued. Family and household context appears only where a source is loaded; the rest is marked as needing one.</span>
      <span>{data.sources.map((s) => `${s.witness}, Day ${s.day}${s.reviewed ? "" : " (extraction not yet reviewed)"}`).join(" · ")}</span>
      {data.sourceNotes.map((note) => <small key={note}>{note}</small>)}
    </footer>
  </main>;
}
