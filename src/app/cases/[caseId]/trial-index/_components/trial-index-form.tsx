"use client";

import { useActionState } from "react";
import { saveTrialIndexDayAction, type TrialIndexActionState } from "@/app/cases/[caseId]/trial-index/actions";
import type { TrialIndexDay } from "@/lib/trial-index";
import { trialIndexBases, trialIndexPhases, trialIndexStatuses } from "@/lib/trial-index-model";

const initialState: TrialIndexActionState = { status: "idle", message: "" };

function label(value: string) { return value.replaceAll("_", " "); }

export function TrialIndexForm({ caseId, day, nextDayNumber, proceedings }: { caseId: string; day: TrialIndexDay | null; nextDayNumber: number; proceedings: Array<{ id: string; title: string; proceeding_date: string | null; status: string }> }) {
  const [state, action, pending] = useActionState(saveTrialIndexDayAction, initialState);
  const witnesses = day?.witnesses.map((item) => [item.name, item.descriptor, item.status].join(" | ")).join("\n") ?? "";
  const topics = day?.topics.map((item) => [item.label, item.summary].join(" | ")).join("\n") ?? "";
  const references = day?.references.map((item) => [item.title, item.url, item.publisher, item.source_kind].join(" | ")).join("\n") ?? "";
  return <form action={action} className="trial-index-form">
    <input type="hidden" name="caseId" value={caseId} />
    <header><div><strong>{day ? `Edit Day ${day.day_number}` : "Add trial day"}</strong><span>Every save creates an immutable navigation-index version.</span></div><span className="state-chip warn">NOT EVIDENCE</span></header>
    <div className="trial-index-form-grid">
      <label>Trial day<input name="dayNumber" type="number" min={1} required defaultValue={day?.day_number ?? nextDayNumber} /></label>
      <label>Court date<input name="courtDate" type="date" defaultValue={day?.court_date ?? ""} /></label>
      <label>Session status<select name="sessionStatus" defaultValue={day?.session_status ?? "planned"}>{trialIndexStatuses.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label>
      <label>Trial phase<select name="trialPhase" defaultValue={day?.trial_phase ?? "unknown"}>{trialIndexPhases.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label>
      <label>Index basis<select name="basis" defaultValue={day?.basis ?? "planned"}>{trialIndexBases.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label>
      <label>Canonical proceeding<select name="proceedingId" defaultValue={day?.proceeding_id ?? ""}><option value="">Not linked yet</option>{proceedings.map((item) => <option value={item.id} key={item.id}>{item.title} · {item.status}</option>)}</select></label>
      <label className="wide">Day headline<input name="headline" required minLength={3} maxLength={240} defaultValue={day?.headline ?? ""} placeholder="Opening statements; prosecution begins" /></label>
      <label className="wide">Navigation summary<textarea name="summary" rows={4} maxLength={5_000} defaultValue={day?.summary ?? ""} placeholder="Broad description of what the day covered. Do not state this as evidence or a factual finding." /></label>
      <label className="wide">Witnesses<textarea name="witnesses" rows={6} maxLength={50_000} defaultValue={witnesses} placeholder="Patrick Clancy | defendant's then-husband | appeared" /><small>One per line: Name | role or context | appeared / continued / expected / reported</small></label>
      <label className="wide">Topics<textarea name="topics" rows={6} maxLength={50_000} defaultValue={topics} placeholder="911 call | Played during Patrick Clancy testimony" /><small>One per line: Topic | short lookup description</small></label>
      <label className="wide">Navigation references<textarea name="references" rows={5} maxLength={50_000} defaultValue={references} placeholder="Day 1 live coverage | https://… | CNN | reporting" /><small>One per line: Title | URL | publisher | reporting / court_notice / docket / canonical_transcript / other</small></label>
      <label className="wide">Change note<input name="changeNote" maxLength={1_000} placeholder="Added witnesses after the session concluded" /></label>
    </div>
    {state.status === "error" ? <p className="trial-index-form-error" role="alert">{state.message}</p> : null}
    <button disabled={pending}>{pending ? "Saving…" : day ? "Save new version" : "Create trial day"}</button>
  </form>;
}
