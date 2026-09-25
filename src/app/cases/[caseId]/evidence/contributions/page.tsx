import { notFound } from "next/navigation";
import { MonoLabel, PageHeader } from "@/app/casework-ui";
import { SubmitButton } from "@/app/cases/[caseId]/_components/submit-button";
import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase } from "@/lib/case-access";
import { publicContributeHref } from "@/lib/case-routes";
import { createClient } from "@/lib/supabase/server";
import { approveContributionAction, rejectContributionAction, setContributionEnabledAction, setContributionPasswordAction } from "./actions";

export const dynamic = "force-dynamic";

type Contribution = {
  id: string;
  contributor_name: string;
  contributor_note: string;
  original_filename: string;
  media_type: string;
  byte_length: number;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ContributionRow({ caseId, item }: { caseId: string; item: Contribution }) {
  return <article className="ds-card" style={{ marginBottom: 12 }}>
    <div className="ds-card__body">
      <div className="ds-source">
        <div>
          <strong>{item.original_filename}</strong>
          <div className="ds-mono">{item.media_type} · {formatBytes(item.byte_length)} · {new Date(item.created_at).toLocaleString()}</div>
        </div>
        <a className="ds-link" href={`/api/cases/${encodeURIComponent(caseId)}/contributions/${encodeURIComponent(item.id)}`}>Download →</a>
      </div>
      {item.contributor_name && <p className="ds-lede" style={{ marginTop: 8 }}>From: {item.contributor_name}</p>}
      {item.contributor_note && <p className="ds-lede" style={{ marginTop: 4 }}>{item.contributor_note}</p>}
      {item.status === "pending" && <div className="ds-actions" style={{ marginTop: 12 }}>
        <form action={approveContributionAction.bind(null, caseId, item.id)}><SubmitButton pendingLabel="Approving…">Approve</SubmitButton></form>
        <form action={rejectContributionAction.bind(null, caseId, item.id)}><SubmitButton pendingLabel="Rejecting…">Reject</SubmitButton></form>
      </div>}
      {item.status !== "pending" && <span className={`ds-chip ${item.status === "approved" ? "ok" : "risk"}`} style={{ marginTop: 12 }}>{item.status}</span>}
    </div>
  </article>;
}

export default async function CaseContributionsPage({ params, searchParams }: { params: Promise<{ caseId: string }>; searchParams: Promise<{ message?: string; error?: string }> }) {
  const [actor, { caseId }, { message, error }] = await Promise.all([requireCaseActor(), params, searchParams]);
  const currentCase = await getAccessibleCase(actor.id, caseId);
  if (!currentCase || currentCase.membershipRole !== "owner") notFound();

  const supabase = await createClient();
  const [settingsResult, contributionsResult] = await Promise.all([
    supabase.from("case_contribution_settings").select("enabled").eq("case_id", caseId).maybeSingle(),
    supabase.from("case_contributions").select("id,contributor_name,contributor_note,original_filename,media_type,byte_length,status,created_at").eq("case_id", caseId).order("created_at", { ascending: false }),
  ]);
  const enabled = settingsResult.data?.enabled ?? false;
  const hasPassword = Boolean(settingsResult.data);
  const items = (contributionsResult.data ?? []) as Contribution[];
  const pending = items.filter((item) => item.status === "pending");
  const decided = items.filter((item) => item.status !== "pending");

  return <main className="research-queue-shell">
    <PageHeader eyebrow="EVIDENCE · CONTRIBUTIONS" title="Crowdsourced contributions" lede="Let people without an Icarus account submit files with a shared password. Nothing they send touches the case until you approve it here." />

    <div style={{ padding: "0 var(--ds-gutter)" }}>
      {(message || error) && <p className={`ds-notice ${error ? "error" : "success"}`} role={error ? "alert" : "status"}>{error ?? message}</p>}

      <section className="ds-card" style={{ marginBottom: 24 }}>
        <div className="ds-card__body">
          <MonoLabel>CONTRIBUTION LINK</MonoLabel>
          {hasPassword ? <>
            <p className="ds-lede" style={{ margin: "8px 0" }}>Share this link and the password with anyone you want submitting evidence: <code>{publicContributeHref(caseId)}</code></p>
            <form action={setContributionEnabledAction.bind(null, caseId)}>
              <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
              <SubmitButton pendingLabel="Updating…">{enabled ? "Pause contributions" : "Re-enable contributions"}</SubmitButton>
            </form>
          </> : <p className="ds-lede" style={{ margin: "8px 0" }}>Set a password below to turn this link on.</p>}
          <form action={setContributionPasswordAction.bind(null, caseId)} style={{ marginTop: 16, display: "grid", gap: 8, maxWidth: 360 }}>
            <label>{hasPassword ? "Rotate password" : "Set a password"}<input name="password" type="text" minLength={6} maxLength={200} required placeholder="At least 6 characters" /></label>
            <SubmitButton pendingLabel="Saving…">{hasPassword ? "Rotate password" : "Turn on contributions"}</SubmitButton>
          </form>
        </div>
      </section>

      <section>
        <h2 className="ds-h2" style={{ marginBottom: 12 }}>Pending review ({pending.length})</h2>
        {pending.length === 0 ? <p className="ds-empty">Nothing waiting on review.</p> : pending.map((item) => <ContributionRow caseId={caseId} item={item} key={item.id} />)}
      </section>

      {decided.length > 0 && <section style={{ marginTop: 32 }}>
        <h2 className="ds-h2" style={{ marginBottom: 12 }}>Decided ({decided.length})</h2>
        {decided.map((item) => <ContributionRow caseId={caseId} item={item} key={item.id} />)}
      </section>}
    </div>
  </main>;
}
