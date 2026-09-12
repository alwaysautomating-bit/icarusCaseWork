"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getCaseNavigationItems, isCaseNavigationItemActive } from "@/lib/case-navigation";

export function CaseLifecycleNav({ caseId, isOwner }: { caseId: string; isOwner: boolean }) {
  const pathname = usePathname();
  const items = getCaseNavigationItems(caseId, isOwner);

  return (
    <nav className="case-lifecycle-nav" aria-label="Case lifecycle">
      {items.map((item) => {
        const active = isCaseNavigationItemActive(item, pathname);
        return <Link href={item.href} aria-current={active ? "page" : undefined} key={item.label}>{item.label}</Link>;
      })}
      {isOwner ? <>
        <span aria-disabled="true">Actor Knowledge</span>
        <span aria-disabled="true">Gaps</span>
      </> : null}
    </nav>
  );
}
