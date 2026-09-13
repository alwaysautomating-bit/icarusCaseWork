import Link from "next/link";
import { Fraunces, IBM_Plex_Mono, Public_Sans } from "next/font/google";
import { notFound } from "next/navigation";
import { Wordmark } from "@/app/casework-ui";
import { signOut } from "@/app/login/actions";
import { CaseSwitcher } from "@/app/cases/_components/case-switcher";
import { CaseLifecycleNav } from "@/app/cases/[caseId]/_components/case-lifecycle-nav";
import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase, listAccessibleCases } from "@/lib/case-access";

export const dynamic = "force-dynamic";

const workbenchSans = Public_Sans({ variable: "--font-workbench-sans", subsets: ["latin"] });
const workbenchSerif = Fraunces({ variable: "--font-workbench-serif", subsets: ["latin"] });
const workbenchMono = IBM_Plex_Mono({ variable: "--font-workbench-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

export default async function CaseLayout({ children, params }: { children: React.ReactNode; params: Promise<{ caseId: string }> }) {
  const [actor, { caseId }] = await Promise.all([requireCaseActor(), params]);
  const [currentCase, cases] = await Promise.all([getAccessibleCase(actor.id, caseId), listAccessibleCases(actor.id)]);
  if (!currentCase) notFound();
  return <div className={`case-workspace-shell ${workbenchSans.variable} ${workbenchSerif.variable} ${workbenchMono.variable}`}>
    <header className="case-workspace-masthead">
      <Link href="/" aria-label="Return to case selection"><Wordmark /></Link>
      <CaseSwitcher activeCaseId={currentCase.id} cases={cases.map((item) => ({ id: item.id, title: item.title }))} />
      <div className="account"><span>{actor.email}</span><form action={signOut}><button className="text-button">Sign out</button></form></div>
    </header>
    <div className="case-identity-strip"><div><span>ACTIVE CASE · {currentCase.membershipRole.toUpperCase()}</span><strong>{currentCase.title}</strong></div><code>{currentCase.id}</code></div>
    <CaseLifecycleNav caseId={currentCase.id} isOwner={currentCase.membershipRole === "owner"} />
    {children}
  </div>;
}
