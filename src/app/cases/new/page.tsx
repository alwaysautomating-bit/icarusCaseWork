import Link from "next/link";
import { MonoLabel, Wordmark } from "@/app/casework-ui";
import { requireCaseActor } from "@/lib/authority";
import { createCaseAction } from "@/app/cases/actions";

export const dynamic = "force-dynamic";

function localInputDate(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default async function NewCasePage() {
  await requireCaseActor();
  return <main className="new-case-shell">
    <header className="masthead"><Wordmark /><nav><Link href="/">Case selection</Link></nav><div /></header>
    <section className="new-case-grid">
      <div className="new-case-copy"><MonoLabel>ESTABLISH CASE · PHASE 0</MonoLabel><h1>Create the shared case boundary.</h1><p>This creates only the case identity, scope, incident boundary, and owner membership. Sources, people, events, and times remain separate canonical records.</p><div className="foundation-principle"><strong>UUIDs remain authoritative.</strong><span>Human-readable names and workspace identifiers are navigation aids, not replacement identities.</span></div></div>
      <form action={createCaseAction} className="case-definition-form">
        <header><MonoLabel>CASE DEFINITION</MonoLabel><h2>Minimum working context</h2></header>
        <label>Case title<input name="title" required minLength={3} maxLength={200} placeholder="Commonwealth v. Example — working corpus" /></label>
        <label>Internal identifier<input name="workspaceKey" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="example-working-corpus" /><small>Lowercase letters, numbers, and hyphens.</small></label>
        <label className="wide">Purpose and scope<textarea name="purpose" required minLength={10} maxLength={2000} rows={5} placeholder="Define what this workspace includes, excludes, and is intended to establish." /></label>
        <label>Evidentiary cutoff<input name="publicRecordCutoff" type="datetime-local" required defaultValue={localInputDate(new Date())} /></label>
        <label>Provisional T0 / incident time<input name="incidentAt" type="datetime-local" /></label>
        <label>Incident-window start<input name="incidentWindowStart" type="datetime-local" /></label>
        <label>Incident-window end<input name="incidentWindowEnd" type="datetime-local" /></label>
        <div className="unsupported-fields wide"><MonoLabel>DEFERRED SCHEMA</MonoLabel><p>Jurisdiction, case timezone, controlled-vocabulary version, and durable T0 versions are not currently modeled. This form does not invent them.</p></div>
        <button className="system-button primary">Create case and open Foundation <span aria-hidden="true">→</span></button>
      </form>
    </section>
  </main>;
}
