import Link from "next/link";
import { notFound } from "next/navigation";
import { Wordmark } from "@/app/casework-ui";
import { signOut } from "@/app/login/actions";
import { CaseSwitcher } from "@/app/cases/_components/case-switcher";
import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase, listAccessibleCases } from "@/lib/case-access";
import { caseSetupHref, courtRecordHref, structureHref } from "@/lib/case-routes";

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
    <nav className="case-lifecycle-nav" aria-label="Case lifecycle">
      <Link href={caseSetupHref(currentCase.id)}>Foundation</Link>
      <Link href={courtRecordHref(currentCase.id)}>Court Record</Link>
      <Link href={structureHref(currentCase.id)}>Structure</Link><span aria-disabled="true">Reconcile</span><span aria-disabled="true">Reconstruct</span><span aria-disabled="true">Actor Knowledge</span><span aria-disabled="true">Gaps</span>
    </nav>
    {children}
  </div>;
}
