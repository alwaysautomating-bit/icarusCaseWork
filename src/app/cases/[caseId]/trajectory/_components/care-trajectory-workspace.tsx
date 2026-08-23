"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MonoLabel } from "@/app/casework-ui";
import { courtRecordHref } from "@/lib/case-routes";
import {
  clipToWindow,
  differenceInDays,
  inclusiveDayCount,
  type LongitudinalCareSnapshot,
  type LongitudinalViewKey,
  type MedicationPeriod,
  overlapsWindow,
  positionInWindow,
  type TrajectorySignal,
} from "@/lib/longitudinal-care";

const fullTicks = ["2022-09-15", "2022-10-01", "2022-11-01", "2022-12-01", "2023-01-01", "2023-01-23"];
const focusTicks = Array.from({ length: 15 }, (_, index) => `2023-01-${String(index + 9).padStart(2, "0")}`);
const signalLabels: Record<TrajectorySignal["lane"], string> = {
  sleep: "Sleep burden",
  clinical: "Clinical state",
  care: "Care ownership",
  diagnostic: "Diagnostic model",
  escalation: "Escalation",
};

type Selection = { type: "medication"; item: MedicationPeriod } | { type: "signal"; item: TrajectorySignal };

function displayDate(value: string, compact = false) {
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-US", compact ? { month: "short", day: "numeric", timeZone: "UTC" } : { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

function periodStyle(start: string, end: string, windowStart: string, windowEnd: string) {
  const clipped = clipToWindow(start, end, windowStart, windowEnd);
  const total = inclusiveDayCount(windowStart, windowEnd);
  return {
    left: `${(differenceInDays(windowStart, clipped.start) / total) * 100}%`,
    width: `${(inclusiveDayCount(clipped.start, clipped.end) / total) * 100}%`,
  };
}

function selectionId(selection: Selection) {
  return `${selection.type}:${selection.item.id}`;
}

function MedicationTrack({
  caseId,
  items,
  selected,
  onSelect,
  windowStart,
  windowEnd,
}: {
  caseId: string;
  items: MedicationPeriod[];
  selected: Selection;
  onSelect: (selection: Selection) => void;
  windowStart: string;
  windowEnd: string;
}) {
  const first = items[0];
  if (!first) return null;
  return <div className="care-medication-row">
    <div className="care-lane-label"><strong>{first.medication}</strong><span>{first.classLabel}</span></div>
    <div className="care-time-track">
      {items.map((item) => {
        const itemSelection: Selection = { type: "medication", item };
        return <button
          type="button"
          key={item.id}
          className={`care-dose-period action-${item.action}${selectionId(selected) === selectionId(itemSelection) ? " selected" : ""}`}
          style={periodStyle(item.start, item.end, windowStart, windowEnd)}
          onClick={() => onSelect(itemSelection)}
          aria-label={`${item.medication}, ${item.doseLabel}, ${displayDate(item.start)} to ${displayDate(item.end)}`}
        >
          <span>{item.doseLabel}</span>
          <small>{item.action.replaceAll("_", " ")}</small>
        </button>;
      })}
      <span className="sr-only">Exact sources are available in the selection inspector. {items.map((item) => courtRecordHref(caseId, { segmentId: item.source.segmentId })).join(", ")}</span>
    </div>
  </div>;
}

function SignalTrack({
  lane,
  items,
  selected,
  onSelect,
  windowStart,
  windowEnd,
}: {
  lane: TrajectorySignal["lane"];
  items: TrajectorySignal[];
  selected: Selection;
  onSelect: (selection: Selection) => void;
  windowStart: string;
  windowEnd: string;
}) {
  return <div className={`care-signal-row lane-${lane}`}>
    <div className="care-lane-label"><strong>{signalLabels[lane]}</strong><span>{items.length} visible observations</span></div>
    <div className="care-time-track">
      {items.map((item) => {
        const itemSelection: Selection = { type: "signal", item };
        const ranged = Boolean(item.end && item.end !== item.date);
        return <button
          type="button"
          key={item.id}
          className={`care-signal ${ranged ? "range" : "point"} status-${item.status}${selectionId(selected) === selectionId(itemSelection) ? " selected" : ""}`}
          style={ranged ? periodStyle(item.date, item.end!, windowStart, windowEnd) : { left: `${positionInWindow(item.date, windowStart, windowEnd)}%` }}
          onClick={() => onSelect(itemSelection)}
          aria-label={`${item.title}, ${displayDate(item.date)}`}
        >
          <i aria-hidden="true" />
          <span>{item.title}</span>
        </button>;
      })}
    </div>
  </div>;
}

export function CareTrajectoryWorkspace({ caseId, snapshot }: { caseId: string; snapshot: LongitudinalCareSnapshot }) {
  const [viewKey, setViewKey] = useState<LongitudinalViewKey>("jan-focus");
  const defaultSignal = snapshot.signals.find((item) => item.id === "jan23-clinical") ?? snapshot.signals[0];
  const [selected, setSelected] = useState<Selection>(() => {
    if (defaultSignal) return { type: "signal", item: defaultSignal };
    const firstMedication = snapshot.medications[0];
    if (!firstMedication) throw new Error("Longitudinal snapshots require at least one selectable evidence item.");
    return { type: "medication", item: firstMedication };
  });
  const window = snapshot.windows[viewKey];

  const visibleMedications = useMemo(() => snapshot.medications.filter((item) => overlapsWindow(item.start, item.end, window.start, window.end)), [snapshot.medications, window.end, window.start]);
  const medicationGroups = useMemo(() => {
    const groups = new Map<string, MedicationPeriod[]>();
    for (const item of visibleMedications) groups.set(item.medication, [...(groups.get(item.medication) ?? []), item]);
    return [...groups.values()];
  }, [visibleMedications]);
  const visibleSignals = useMemo(() => snapshot.signals.filter((item) => overlapsWindow(item.date, item.end ?? item.date, window.start, window.end)), [snapshot.signals, window.end, window.start]);
  const segmentCount = new Set([...visibleMedications.map((item) => item.source.segmentId), ...visibleSignals.map((item) => item.source.segmentId)]).size;
  const episodeDayStart = differenceInDays(snapshot.episode.start, window.start) + 1;
  const episodeDayEnd = differenceInDays(snapshot.episode.start, window.end) + 1;
  const selectedItem = selected.item;
  const selectedTitle = selected.type === "medication" ? `${selected.item.medication} · ${selected.item.doseLabel}` : selected.item.title;
  const selectedDetail = selected.type === "medication" ? selected.item.note : selected.item.detail;
  const ticks = viewKey === "full" ? fullTicks : focusTicks;

  return <main className="care-trajectory-shell">
    <section className="care-trajectory-heading">
      <div>
        <MonoLabel>LONGITUDINAL CARE · REVIEWED DEMO V{snapshot.version}</MonoLabel>
        <h1>The episode persists.<br />The interventions change.</h1>
        <p>Medication amount, sleep burden, clinical state, care ownership, and escalation are aligned on one clock. Atomic testimony remains citable while the continuing pattern remains visible.</p>
      </div>
      <dl>
        <div><dt>Episode span</dt><dd>{inclusiveDayCount(snapshot.episode.start, snapshot.episode.end)}<small>days</small></dd></div>
        <div><dt>Visible med changes</dt><dd>{visibleMedications.length}</dd></div>
        <div><dt>Exact sources</dt><dd>{segmentCount}</dd></div>
      </dl>
    </section>

    <section className="care-trajectory-boundary"><strong>PROJECTION BOUNDARY</strong><span>{snapshot.boundaryNote}</span></section>

    <section className="care-view-controls" aria-label="Timeline scale">
      <div><MonoLabel>TIME SCALE</MonoLabel><strong>{window.label}</strong><span>{displayDate(window.start)} — {displayDate(window.end)}</span></div>
      <div role="group" aria-label="Select timeline scale">
        {(Object.keys(snapshot.windows) as LongitudinalViewKey[]).map((key) => <button type="button" key={key} aria-pressed={viewKey === key} onClick={() => setViewKey(key)}>{snapshot.windows[key].label}</button>)}
      </div>
      <p>{window.description}</p>
    </section>

    <section className={`care-timeline-workspace view-${viewKey}`}>
      <header className="care-axis-row">
        <div><strong>CALENDAR</strong><span>clinical/event time</span></div>
        <div className="care-axis-track">{ticks.map((tick) => <time key={tick} style={{ left: `${positionInWindow(tick, window.start, window.end)}%` }}>{displayDate(tick, true)}</time>)}</div>
      </header>

      <div className="care-episode-row">
        <div className="care-lane-label"><strong>Continuing episode</strong><span>analytical candidate</span></div>
        <div className="care-time-track">
          <div className="care-episode-period" style={periodStyle(snapshot.episode.start, snapshot.episode.end, window.start, window.end)}>
            <strong>{snapshot.episode.title}</strong>
            <span>{viewKey === "full" ? `${inclusiveDayCount(snapshot.episode.start, snapshot.episode.end)} days under review` : `Days ${episodeDayStart}–${episodeDayEnd} of the same episode`}</span>
          </div>
        </div>
      </div>

      <section className="care-lane-section">
        <header><strong>MEDICATION EXPOSURE + AMOUNT</strong><span>solid = prescribed/reported · hatch = taper · outline = recommended, apparently not taken</span></header>
        {medicationGroups.map((items) => <MedicationTrack key={items[0]!.medication} caseId={caseId} items={items} selected={selected} onSelect={setSelected} windowStart={window.start} windowEnd={window.end} />)}
      </section>

      <section className="care-lane-section care-pattern-section">
        <header><strong>CONNECTED TRAJECTORY</strong><span>events retain separate provenance; the episode does not reset</span></header>
        {(["sleep", "clinical", "diagnostic", "care", "escalation"] as const).map((lane) => <SignalTrack key={lane} lane={lane} items={visibleSignals.filter((item) => item.lane === lane)} selected={selected} onSelect={setSelected} windowStart={window.start} windowEnd={window.end} />)}
      </section>
    </section>

    <section className="care-selection-inspector" aria-live="polite">
      <div>
        <MonoLabel>{selected.type === "medication" ? selected.item.action.replaceAll("_", " ") : signalLabels[selected.item.lane]}</MonoLabel>
        <h2>{selectedTitle}</h2>
        <p>{selectedDetail}</p>
      </div>
      <dl>
        <div><dt>Clinical/event time</dt><dd>{displayDate(selected.type === "medication" ? selected.item.start : selected.item.date)}{selected.type === "medication" && selected.item.end !== selected.item.start ? ` — ${displayDate(selected.item.end)}` : ""}</dd></div>
        <div><dt>Evidence status</dt><dd>{selectedItem.status.replaceAll("_", " ")}</dd></div>
        <div><dt>Testimony source</dt><dd>{selectedItem.source.proceeding} · {selectedItem.source.label}</dd></div>
      </dl>
      <Link href={courtRecordHref(caseId, { segmentId: selectedItem.source.segmentId })}>Open exact testimony →</Link>
    </section>

    <section className="care-accountability-frame">
      <div><MonoLabel>ACCOUNTABILITY QUESTION</MonoLabel><h2>Was treatment escalation evaluated independently of emergency commitment?</h2></div>
      <p>The January view separates a no-hospitalization rationale based on immediate SI/HI, psychosis, or observed mania from the different question raised by persistent non-stabilization: whether diagnostic consultation, coordinated handoff, collateral information, records acquisition, or a higher level of ongoing support should have escalated.</p>
    </section>
  </main>;
}
