import { notFound } from "next/navigation";
import { MonoLabel, PageHeader, Callout } from "@/app/casework-ui";
import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase } from "@/lib/case-access";
import { listCaseMembers } from "@/lib/case-members";
import { removeCaseMemberAction, upsertCaseMemberAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function CaseAccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const actor = await requireCaseActor();
  const [{ caseId }, query] = await Promise.all([params, searchParams]);
  const currentCase = await getAccessibleCase(actor.id, caseId);
  if (!currentCase) notFound();
  const isOwner = currentCase.owner_user_id === actor.id;
  const members = isOwner ? await listCaseMembers(caseId) : [];

  return <main className="case-access-shell">
    <PageHeader eyebrow="CASE ACCESS" title="People with access" lede="Add explorers after they have signed in once. Their role applies only to this case." aside={<Callout label="OWNER CONTROL">Viewer is read-only. Researcher can contribute. Reviewer can contribute and perform governed review actions.</Callout>} />
    <section className="case-access-panel standalone">
      {query.error && <p className="action-message error" role="alert">{query.error}</p>}
      {query.message && <p className="action-message success" role="status">{query.message}</p>}
      {isOwner ? <>
        <div className="case-access-intro">
          <div><MonoLabel>ADD AN EXPLORER</MonoLabel><h2>Grant case access</h2><p>Ask the person to sign in once, then enter the same email address below. Every membership change is recorded in the case audit log.</p></div>
          <form action={upsertCaseMemberAction.bind(null, caseId)} className="case-access-form">
            <label>Email address<input name="email" type="email" autoComplete="email" required placeholder="researcher@example.com" /></label>
            <label>Access role<select name="role" defaultValue="viewer"><option value="viewer">Viewer · explore only</option><option value="researcher">Researcher · contribute</option><option value="reviewer">Reviewer · contribute and review</option></select></label>
            <button>Add case access</button>
          </form>
        </div>
        <div className="case-member-list">
          <header><span>Member</span><span>Role</span><span>Added</span><span>Action</span></header>
          {members.map((member) => <article key={member.user_id}>
            <div><strong>{member.email ?? "Email unavailable"}</strong><small>{member.user_id}</small></div>
            {member.role === "owner" ? <strong className="state-chip pass">OWNER</strong> : <form action={upsertCaseMemberAction.bind(null, caseId)} className="member-role-form"><input type="hidden" name="email" value={member.email ?? ""} /><select name="role" defaultValue={member.role} aria-label={`Role for ${member.email ?? member.user_id}`}><option value="viewer">Viewer</option><option value="researcher">Researcher</option><option value="reviewer">Reviewer</option></select><button>Save</button></form>}
            <time>{new Date(member.created_at).toLocaleDateString()}</time>
            {member.role === "owner" ? <span>Permanent owner</span> : <form action={removeCaseMemberAction.bind(null, caseId)}><input type="hidden" name="userId" value={member.user_id} /><button className="text-button">Remove</button></form>}
          </article>)}
        </div>
      </> : <div className="supporting-empty"><h2>Owner-only directory</h2><p>You can use the case according to your assigned role, but only the owner can view or change its member directory.</p></div>}
    </section>
  </main>;
}
