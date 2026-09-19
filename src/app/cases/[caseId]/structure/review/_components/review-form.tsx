"use client";

import { useActionState, useState } from "react";
import { reviewStructureObjectAction, type ReviewActionState } from "@/app/cases/[caseId]/structure/review/actions";
import type { StructureReviewRouteState } from "@/lib/case-routes";
import type { ReviewQueueItem } from "@/lib/structure-review";

const initialReviewState: ReviewActionState = { kind: "idle", message: "" };
type Decision = "accept" | "amend" | "defer" | "reject";
const choices: { value: Decision; title: string; description: string }[] = [
  { value: "accept", title: "Accept", description: "The extracted fields are supported as written." },
  { value: "amend", title: "Amend", description: "Correct one or more extracted fields." },
  { value: "defer", title: "Defer", description: "Set this aside for another review pass." },
  { value: "reject", title: "Reject", description: "The candidate should not be kept." },
];

function rendered(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function TextField({ name, label, value, multiline = false }: { name: string; label: string; value: unknown; multiline?: boolean }) {
  return <label><span>{label}</span>{multiline ? <textarea name={name} defaultValue={rendered(value)} rows={4} /> : <input name={name} defaultValue={rendered(value)} />}</label>;
}

function AmendmentFields({ item }: { item: ReviewQueueItem }) {
  const fields = item.reviewFields;
  if (item.type === "knowledge") return <><TextField name="summary" label="Summary" value={fields.summary} multiline /><TextField name="unknowns" label="Unknowns · JSON array" value={fields.unknowns} multiline /></>;
  if (item.type === "claim") return <><TextField name="normalized_assertion" label="Normalized assertion" value={fields.normalized_assertion} multiline /><TextField name="assertion_status" label="Assertion status" value={fields.assertion_status} /><TextField name="information_basis" label="Information basis" value={fields.information_basis} /></>;
  if (item.type === "mention") return <><TextField name="normalized_candidate" label="Normalized candidate" value={fields.normalized_candidate} /><TextField name="mention_type" label="Mention type" value={fields.mention_type} /></>;
  if (item.type === "event") return <><TextField name="neutral_description" label="Neutral description" value={fields.neutral_description} multiline /><TextField name="participant_mentions" label="Participant mentions · JSON array" value={fields.participant_mentions} multiline /></>;
  if (item.type === "relationship") return <><TextField name="relation_type" label="Relation type" value={fields.relation_type} /><TextField name="assertion_status" label="Assertion status" value={fields.assertion_status} /></>;
  if (item.type === "flag") return <><TextField name="rationale" label="Flag rationale" value={fields.rationale} multiline /><TextField name="supporting_context" label="Supporting context · JSON object" value={fields.supporting_context} multiline /></>;
  const temporalFields = [
    ["asserted_start", "Asserted start"], ["asserted_end", "Asserted end"], ["precision", "Precision"], ["asserted_date", "Asserted date"],
    ["asserted_time_of_day_start", "Time of day start"], ["asserted_time_of_day_end", "Time of day end"], ["time_of_day_band", "Time band"],
    ["date_precision", "Date precision"], ["time_of_day_precision", "Time precision"], ["qualification", "Qualification"], ["qualifier_text", "Qualifier text"],
    ["sequence_language", "Sequence language"], ["duration_iso8601", "Duration ISO 8601"], ["relative_offset_value", "Relative offset"],
    ["relative_offset_unit", "Relative offset unit"], ["lower_bound_event_candidate_id", "Lower-bound candidate UUID"], ["upper_bound_event_candidate_id", "Upper-bound candidate UUID"],
  ] as const;
  return <>{temporalFields.map(([name, label]) => <TextField name={name} label={label} value={fields[name]} key={name} />)}<TextField name="recurrence_pattern" label="Recurrence · JSON object" value={fields.recurrence_pattern} multiline /></>;
}

export function ReviewForm({ caseId, item, routeState, permission, sourceCount }: { caseId: string; item: ReviewQueueItem; routeState: StructureReviewRouteState; permission: "review" | "read_only"; sourceCount: number }) {
  const [state, formAction, pending] = useActionState(reviewStructureObjectAction, initialReviewState);
  const [decision, setDecision] = useState<Decision | null>(null);
  if (permission === "read_only") return <section className="structure-review-decision read-only"><h2>3 / Record a decision</h2><p>You can inspect this candidate, but only a case owner or reviewer can record a decision.</p></section>;
  if (!item.reviewable) return <section className="structure-review-decision read-only"><h2>3 / Previous decision</h2><p>This candidate is in a historical state. Use the queue state filter to return to pending or deferred work.</p></section>;
  if (sourceCount === 0) return <section className="structure-review-decision blocked"><h2>3 / Decision unavailable</h2><p>This candidate needs at least one supporting source segment before it can be reviewed.</p></section>;

  return <form action={formAction} className="structure-review-decision">
    <input type="hidden" name="caseId" value={caseId} />
    <input type="hidden" name="targetType" value={item.type} />
    <input type="hidden" name="targetId" value={item.id} />
    <input type="hidden" name="expectedVersion" value={item.reviewVersion} />
    <input type="hidden" name="routeState" value={JSON.stringify(routeState)} />
    <header><div><span>3 / MAKE THE CALL</span><h2>Record a decision</h2><p>Choose one outcome after comparing all {sourceCount} supporting source{sourceCount === 1 ? "" : "s"}.</p></div></header>
    <fieldset className="structure-review-choice-list"><legend>What should happen to this candidate?</legend>{choices.map((choice) => <label className={decision === choice.value ? "selected" : ""} key={choice.value}><input type="radio" name="action" value={choice.value} checked={decision === choice.value} onChange={() => setDecision(choice.value)} required /><span><strong>{choice.title}</strong><small>{choice.description}</small></span></label>)}</fieldset>
    {decision === "amend" ? <div className="structure-amendment-fields"><h3>Correct the extracted fields</h3><p>Change only what needs correcting. Fields marked JSON must contain a valid array or object.</p><div><AmendmentFields item={item} /></div></div> : null}
    <label className="structure-review-note"><span>Reason for this decision {decision === "accept" ? "(optional)" : "(required for amend, defer, or reject)"}</span><textarea name="note" maxLength={4000} rows={4} required={decision !== null && decision !== "accept"} placeholder={decision === "accept" ? "Add context if useful." : "Explain what you found in the sources and why you chose this outcome."} /></label>
    <label className="structure-source-confirm"><input type="checkbox" name="sourcesReviewed" value="yes" required /><span>I compared every supporting source for this candidate.</span></label>
    {state.message ? <p className={`review-action-message ${state.kind}`} role="alert">{state.message}</p> : null}
    <div className="structure-review-submit"><button type="submit" disabled={!decision || pending}>{pending ? "Saving decision…" : decision ? `Record ${decision} decision` : "Choose an outcome to continue"}</button><small>After saving, the next candidate in this view opens automatically.</small></div>
    <p className="structure-review-scope">Accepting a candidate records a review decision. It does not establish evidentiary weight or make an event canonical.</p>
  </form>;
}
