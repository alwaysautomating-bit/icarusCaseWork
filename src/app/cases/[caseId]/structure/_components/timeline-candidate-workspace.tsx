import Link from "next/link";
import { MonoLabel } from "@/app/casework-ui";
import { saveTimelineViewAction } from "@/app/cases/[caseId]/structure/actions";
import { ReviewState } from "@/app/cases/[caseId]/structure/_components/review-state";
import { courtRecordHref, structureHref, type StructureRouteState } from "@/lib/case-routes";
import type { StructureWorkspace } from "@/lib/case-structure";
import type { SavedTimelineView, TimelineSnapshotItem } from "@/lib/timeline-views";

function temporalDisplay(item: TimelineSnapshotItem) {
  if (item.asserted_start) return new Date(item.asserted_start).toLocaleString();
  if (item.asserted_date) return [item.asserted_date, item.asserted_time_of_day_start, item.time_of_day_band?.replaceAll("_", " ")].filter(Boolean).join(" · ");
  if (item.duration_iso8601) return `${item.precision.replaceAll("_", " ")} · ${item.duration_iso8601}`;
  if (item.relative_offset_value && item.relative_offset_unit) return `${item.relative_offset_value} ${item.relative_offset_unit}${item.relative_offset_value === 1 ? "" : "s"} later`;
  if (item.sequence_language) return `${item.precision.replaceAll("_", " ")} · ${item.sequence_language}`;
  if (item.time_of_day_band) return item.time_of_day_band.replaceAll("_", " ");
  return "UNKNOWN EVENT TIME";
}

function TimelineLane({ caseId, title, label, items, routeState, capturedAt }: { caseId: string; title: string; label: string; items: TimelineSnapshotItem[]; routeState: StructureRouteState; capturedAt?: string }) {
  return <section className="timeline-version-lane">
    <header><div><span>{label}</span><h3>{title}</h3></div><strong>{items.length}</strong>{capturedAt ? <time>{new Date(capturedAt).toLocaleString()}</time> : <small>Current database state</small>}</header>
    <div className="timeline-version-items">{items.map((item, index) => <article className="timeline-candidate-card" key={`${item.event_candidate_id}-${item.temporal_assertion_id}`}>
      <header><span>#{String(index + 1).padStart(2, "0")} · {item.event_class?.replaceAll("_", " ") ?? "event"}</span><ReviewState status={item.event_status} /></header>
      <h4>{item.neutral_description}</h4>
      <blockquote>{item.source_wording ?? "NO SOURCE WORDING RECORDED"}</blockquote>
      <div className="timeline-time-contract"><strong>{temporalDisplay(item)}</strong><span>{item.precision.replaceAll("_", " ")} · {item.qualification.replaceAll("_", " ")}</span>{item.qualifier_text ? <small>Qualification: “{item.qualifier_text}”</small> : null}</div>
      <dl><div><dt>Event UUID</dt><dd><code>{item.event_candidate_id}</code></dd></div><div><dt>Temporal UUID</dt><dd><code>{item.temporal_assertion_id}</code></dd></div><div><dt>Sources</dt><dd>{item.source_segment_ids.length}</dd></div><div><dt>Asserted by</dt><dd>{item.asserted_by_raw ?? "NOT RECORDED"}</dd></div></dl>
      <footer><Link href={structureHref(caseId, { ...routeState, type: "event", objectId: item.event_candidate_id, segmentId: item.source_segment_ids[0] })}>Inspect object</Link>{item.source_segment_ids[0] ? <Link href={courtRecordHref(caseId, { query: routeState.query, segmentId: item.source_segment_ids[0] })}>Jump to source →</Link> : null}</footer>
    </article>)}</div>
  </section>;
}

export function TimelineCandidateWorkspace({ caseId, timeline, routeState, compareViewIds }: { caseId: string; timeline: StructureWorkspace["timeline"]; routeState: StructureRouteState; compareViewIds: string[] }) {
  const selectedViews = compareViewIds.map((id) => timeline.savedViews.find((view) => view.id === id)).filter((view): view is SavedTimelineView => Boolean(view)).slice(0, 4);
  const activeRun = timeline.runs.find((run) => run.id === timeline.activeRunId) ?? null;
  const saveAction = activeRun ? saveTimelineViewAction.bind(null, caseId, activeRun.id) : undefined;
  const timeCounts = new Map<string, number>();
  for (const item of timeline.current) timeCounts.set(item.precision, (timeCounts.get(item.precision) ?? 0) + 1);

  return <section className="timeline-candidate-workspace" aria-label="Timeline candidate versions">
    <header className="timeline-workspace-heading"><div><MonoLabel>TESTIMONY → TIMELINE CANDIDATES</MonoLabel><h2>Save the interpretation.<br />Keep the source fixed.</h2><p>These are reviewable candidate views. Saving creates an immutable snapshot of UUIDs, wording, temporal qualification, and source lineage; it never creates a canonical event or SAME resolution.</p></div><div className="timeline-workspace-stats"><strong>{timeline.current.length}</strong><span>candidate time assertions in the active run</span><dl>{[...timeCounts].map(([precision, count]) => <div key={precision}><dt>{precision.replaceAll("_", " ")}</dt><dd>{count}</dd></div>)}</dl></div></header>
    {timeline.runs.length === 0 ? <div className="timeline-empty"><strong>NO TIMELINE CANDIDATE RUN IN THIS CASE</strong><p>The Structure workspace remains usable. A run from a separate acceptance case is intentionally not substituted.</p></div> : <>
      <div className="timeline-run-bar"><span>EXTRACTION RUN</span>{timeline.runs.map((run, index) => <Link className={run.id === timeline.activeRunId ? "active" : ""} href={structureHref(caseId, { ...routeState, timelineRunId: run.id, compareViewIds })} key={run.id}>v{run.compiler_version} · run {index + 1}<small>{run.configuration_sha256.slice(0, 10)}</small></Link>)}</div>
      <div className="timeline-save-and-versions">
        <section className="timeline-save-panel"><MonoLabel>SAVE CURRENT VERSION</MonoLabel><h3>{activeRun ? `Run ${activeRun.configuration_sha256.slice(0, 10)}` : "No active run"}</h3>{saveAction ? <form action={saveAction}><label><span>Version name</span><input name="name" required maxLength={100} placeholder="Hartnett reviewed timeline" /></label><label><span>What changed?</span><textarea name="description" maxLength={1000} rows={3} placeholder="Candidate grouping, reviewed wording, or scope notes" /></label><button>Save immutable version</button><small>Saving the same name again creates the next version number.</small></form> : null}</section>
        <section className="timeline-saved-views"><header><div><MonoLabel>SAVED VERSIONS</MonoLabel><h3>Pin up to four</h3></div><strong>{timeline.savedViews.length}</strong></header>{timeline.savedViews.length === 0 ? <p>No saved timeline versions yet.</p> : <div>{timeline.savedViews.map((view) => {
          const selected = selectedViews.some((item) => item.id === view.id);
          const nextIds = selected ? compareViewIds.filter((id) => id !== view.id) : [...compareViewIds, view.id].slice(-4);
          return <article className={selected ? "selected" : ""} key={view.id}><div><strong>{view.name} · v{view.version}</strong><time>{new Date(view.createdAt).toLocaleString()}</time></div><p>{view.description || "No change note recorded."}</p><span>{view.snapshot.items.length} candidates · {view.snapshot.runs.map((run) => run.configuration_sha256.slice(0, 10)).join(", ")}</span><Link href={structureHref(caseId, { ...routeState, timelineRunId: timeline.activeRunId ?? undefined, compareViewIds: nextIds })}>{selected ? "Remove from comparison" : "Add to comparison"}</Link></article>;
        })}</div>}</section>
      </div>
      <div className={`timeline-compare-grid columns-${Math.min(selectedViews.length + 1, 5)}`}>
        <TimelineLane caseId={caseId} title="Live candidate set" label="LIVE" items={timeline.current} routeState={{ ...routeState, timelineRunId: timeline.activeRunId ?? undefined, compareViewIds }} />
        {selectedViews.map((view) => <TimelineLane caseId={caseId} title={`${view.name} · v${view.version}`} label="SAVED SNAPSHOT" items={view.snapshot.items} capturedAt={view.snapshot.captured_at} routeState={{ ...routeState, timelineRunId: timeline.activeRunId ?? undefined, compareViewIds }} key={view.id} />)}
      </div>
    </>}
  </section>;
}
