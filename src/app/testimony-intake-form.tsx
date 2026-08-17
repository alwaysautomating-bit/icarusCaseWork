"use client";

import { useActionState } from "react";
import { intakeTestimonyUrlAction, type TestimonyIntakeActionState } from "./actions";

const initialState: TestimonyIntakeActionState = { status: "idle", message: "" };

export function TestimonyIntakeForm() {
  const [state, action, pending] = useActionState(intakeTestimonyUrlAction, initialState);
  return (
    <form action={action} className="testimony-intake-form">
      <div className="intake-lane-badge"><span>ACTIVE LANE</span><strong>TESTIMONY</strong><small>Artifact format cannot change this lane.</small></div>
      <label className="wide">Timestamped testimony URL
        <input name="url" type="url" required maxLength={2000} placeholder="https://www.rev.com/transcripts/..." autoComplete="url" />
      </label>
      <label className="authorization wide"><input required type="checkbox" name="authorized" /> I confirm this page is public or authorized research material.</label>
      <div className="intake-boundary wide"><strong>Intake stops before reconciliation.</strong><span>No support, contradiction, corroboration, independence assessment, or verification is created here.</span></div>
      <button disabled={pending}>{pending ? "Capturing + structuring testimony…" : "Capture testimony URL"}</button>
      {state.message && <p className={`action-message ${state.status}`} role="status">{state.message}</p>}
    </form>
  );
}
