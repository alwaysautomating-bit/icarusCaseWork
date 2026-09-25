"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/app/casework-ui";
import { CaseSwitcher } from "@/app/cases/_components/case-switcher";

// The Icarus mark opens the case: which case, who is signed in, and how to switch. Nothing here needs permanent screen space.
export function CaseMenu({ caseId, title, role, email, cases }: { caseId: string; title: string; role: string; email: string; cases: Array<{ id: string; title: string }> }) {
  const pathname = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  const close = () => menu.current?.removeAttribute("open");

  useEffect(close, [pathname]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (menu.current?.open && !menu.current.contains(event.target as Node)) close();
    };
    const escape = (event: KeyboardEvent) => event.key === "Escape" && close();
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  return (
    <details className="case-menu" ref={menu}>
      <summary aria-label="Case menu"><Wordmark /></summary>
      <div className="case-menu-panel">
        <div className="case-menu-case">
          <span>ACTIVE CASE · {role.toUpperCase()}</span>
          <strong>{title}</strong>
          <code>{caseId}</code>
        </div>
        <CaseSwitcher activeCaseId={caseId} cases={cases} />
        <Link href="/">All cases →</Link>
        <div className="case-menu-account"><span>SIGNED IN AS</span><b>{email}</b></div>
      </div>
    </details>
  );
}
