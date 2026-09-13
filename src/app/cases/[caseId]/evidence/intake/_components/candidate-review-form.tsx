"use client";

import { useActionState } from "react";
import { reviewCourtPacketCandidateAction, type CourtPacketReviewState } from "@/app/cases/[caseId]/evidence/intake/actions";
import { documentTypeLabel, documentTypeValues } from "@/lib/court-packet-labels";
import type { CourtPacketCandidate } from "@/lib/court-packet-workspace";

const initialState: CourtPacketReviewState = { kind: "idle", message: "" };

function HiddenFields({ caseId, candidate }: { caseId: string; candidate: CourtPacketCandidate }) {
  return <>
    <input type="hidden" name="caseId" value={caseId} />
    <input type="hidden" name="candidateId" value={candidate.id} />
    <input type="hidden" name="expectedVersion" value={candidate.currentReviewVersion} />
  </>;
}

export function CandidateReviewForm({ caseId, candidate, canReview }: { caseId: string; candidate: CourtPacketCandidate; canReview: boolean }) {
  const [acceptState, acceptAction, acceptPending] = useActionState(reviewCourtPacketCandidateAction, initialState);
  const [amendState, amendAction, amendPending] = useActionState(reviewCourtPacketCandidateAction, initialState);
  const [rejectState, rejectAction, rejectPending] = useActionState(reviewCourtPacketCandidateAction, initialState);
  if (!canReview) return null;
  const message = acceptState.message || amendState.message || rejectState.message;
  const messageKind = acceptState.message ? acceptState.kind : amendState.message ? amendState.kind : rejectState.kind;

  return <div className="doc-actions">
    <form action={acceptAction}><HiddenFields caseId={caseId} candidate={candidate} /><button name="action" value="accept" disabled={acceptPending} className="confirm-btn">Confirm</button></form>
    <details className="doc-edit-range">
      <summary>Edit range</summary>
      <form action={amendAction}>
        <HiddenFields caseId={caseId} candidate={candidate} />
        <label>Document type<select name="documentType" defaultValue={candidate.documentType}>{documentTypeValues.map((type) => <option value={type} key={type}>{documentTypeLabel(type)}</option>)}</select></label>
        <label>Start page<input name="startPage" type="number" min={1} defaultValue={candidate.startPage} /></label>
        <label>End page<input name="endPage" type="number" min={1} defaultValue={candidate.endPage} /></label>
        <label>Note <small>required</small><textarea name="note" rows={2} maxLength={4000} placeholder="Why this range or type is being amended." /></label>
        <button name="action" value="amend" disabled={amendPending}>Save amendment</button>
      </form>
    </details>
    <details className="doc-reject">
      <summary className="muted">Reject</summary>
      <form action={rejectAction}>
        <HiddenFields caseId={caseId} candidate={candidate} />
        <label>Note <small>required</small><textarea name="note" rows={2} maxLength={4000} placeholder="Why this proposed boundary should be rejected." /></label>
        <button name="action" value="reject" disabled={rejectPending}>Confirm reject</button>
      </form>
    </details>
    {message ? <p className={`doc-review-message ${messageKind}`} role="alert">{message}</p> : null}
  </div>;
}
