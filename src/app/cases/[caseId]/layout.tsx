import { notFound } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { CaseMenu } from "@/app/cases/[caseId]/_components/case-menu";
import { CaseSettingsMenu } from "@/app/cases/[caseId]/_components/case-settings-menu";
import { CaseLifecycleNav } from "@/app/cases/[caseId]/_components/case-lifecycle-nav";
import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase, listAccessibleCases } from "@/lib/case-access";

export const dynamic = "force-dynamic";

export default async function CaseLayout({ children, params }: { children: React.ReactNode; params: Promise<{ caseId: string }> }) {
  const [actor, { caseId }] = await Promise.all([requireCaseActor(), params]);
  const [currentCase, cases] = await Promise.all([getAccessibleCase(actor.id, caseId), listAccessibleCases(actor.id)]);
  if (!currentCase) notFound();
  const isOwner = currentCase.membershipRole === "owner";
  return <div className="case-workspace-shell">
    <header className="case-workspace-masthead">
      <CaseMenu caseId={currentCase.id} title={currentCase.title} role={currentCase.membershipRole} email={actor.email} cases={cases.map((item) => ({ id: item.id, title: item.title }))} />
      <div className="account"><form action={signOut}><button className="text-button">Sign out</button></form>{isOwner ? <CaseSettingsMenu caseId={currentCase.id} /> : null}</div>
    </header>
    <CaseLifecycleNav caseId={currentCase.id} isOwner={isOwner} />
    {children}
  </div>;
}
