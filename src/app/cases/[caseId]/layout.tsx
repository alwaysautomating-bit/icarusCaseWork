import Link from "next/link";
import { notFound } from "next/navigation";
import { Wordmark } from "@/app/casework-ui";
import { signOut } from "@/app/login/actions";
import { CaseSwitcher } from "@/app/cases/_components/case-switcher";
import { CaseLifecycleNav } from "@/app/cases/[caseId]/_components/case-lifecycle-nav";
import { requireCaseActor } from "@/lib/authority";
import { canReviewStructure, getAccessibleCase, listAccessibleCases } from "@/lib/case-access";
import { getDeploymentSlice } from "@/lib/deployment-slice";

export const dynamic = "force-dynamic";

export default async function CaseLayout({ children, params }: { children: React.ReactNode; params: Promise<{ caseId: string }> }) {
  const actor = await requireCaseActor();
  const { caseId } = await params;
  const [currentCase, cases] = await Promise.all([getAccessibleCase(actor.id, caseId), listAccessibleCases(actor.id)]);
  if (!currentCase) notFound();
  return <div className="case-workspace-shell">
    <header className="case-workspace-masthead">
      <Link href="/" aria-label="Return to case selection"><Wordmark /></Link>
      <CaseSwitcher activeCaseId={currentCase.id} cases={cases.map((item) => ({ id: item.id, title: item.title }))} />
      <div className="account"><span>{actor.email}</span><form action={signOut}><button className="text-button">Sign out</button></form></div>
    </header>
    <div className="case-identity-strip"><div><span>ACTIVE CASE · {currentCase.membershipRole.toUpperCase()}</span><strong>{currentCase.title}</strong></div><code>{currentCase.id}</code></div>
    <CaseLifecycleNav caseId={currentCase.id} canReview={canReviewStructure(currentCase.membershipRole)} isOwner={currentCase.owner_user_id === actor.id} pilotMode={getDeploymentSlice() === "research_pilot"} />
    {children}
  </div>;
}
