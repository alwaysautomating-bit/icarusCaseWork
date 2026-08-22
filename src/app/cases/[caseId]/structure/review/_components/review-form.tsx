"use client";

import { useActionState } from "react";
import { reviewStructureObjectAction, type ReviewActionState } from "@/app/cases/[caseId]/structure/review/actions";
import type { StructureReviewRouteState } from "@/lib/case-routes";
import type { ReviewQueueItem } from "@/lib/structure-review";

const initialReviewState: ReviewActionState = { kind: "idle", message: "" };

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
  if (permission === "read_only") return <section className="structure-review-decision read-only"><strong>READ-ONLY MEMBERSHIP</strong><p>You may inspect this queue and its complete source lineage. Only case owners and reviewers can record a decision.</p></section>;
  if (!item.reviewable) return <section className="structure-review-decision read-only"><strong>HISTORICAL STATE</strong><p>This object is inspectable but no longer eligible for candidate review.</p></section>;
  if (sourceCount === 0) return <section className="structure-review-decision blocked"><strong>SOURCE LINEAGE REQUIRED</strong><p>This object cannot be reviewed until at least one authoritative supporting segment is attached.</p></section>;

  return <form action={formAction} className="structure-review-decision">
    <input type="hidden" name="caseId" value={caseId} />
    <input type="hidden" name="targetType" value={item.type} />
    <input type="hidden" name="targetId" value={item.id} />
    <input type="hidden" name="expectedVersion" value={item.reviewVersion} />
    <input type="hidden" name="routeState" value={JSON.stringify(routeState)} />
    <header><span>HUMAN DECISION · EXPECTED VERSION {item.reviewVersion}</span><strong>{sourceCount} source{sourceCount === 1 ? "" : "s"}</strong></header>
    <details className="structure-amendment-fields"><summary>Amend allowlisted candidate fields</summary><div><AmendmentFields item={item} /></div></details>
    <label><span>Decision rationale</span><textarea name="note" maxLength={4000} rows={4} placeholder="Required for amend, reject, or defer; optional for accept." /></label>
    <label className="structure-source-confirm"><input type="checkbox" name="sourcesReviewed" value="yes" /><span>I compared every supporting source segment shown in the source pane.</span></label>
    {state.message ? <p className={`review-action-message ${state.kind}`} role="alert">{state.message}</p> : null}
    <div className="structure-review-actions">
      <button name="action" value="accept" disabled={pending}>Accept</button>
      <button name="action" value="amend" disabled={pending}>Amend</button>
      <button name="action" value="defer" disabled={pending}>Defer</button>
      <button name="action" value="reject" disabled={pending}>Reject</button>
    </div>
    <small>Acceptance records reviewed candidate state. It does not make an event canonical, resolve an identity, or establish evidentiary weight.</small>
  </form>;
}
