"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getCaseSettingsItems, isCaseNavigationItemActive } from "@/lib/case-navigation";

export function CaseSettingsMenu({ caseId }: { caseId: string }) {
  const pathname = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  const items = getCaseSettingsItems(caseId);
  const anyActive = items.some((item) => isCaseNavigationItemActive(item, pathname));

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
    <details className={`case-settings-menu${anyActive ? " is-active" : ""}`} ref={menu}>
      <summary aria-label="Settings" className="text-button">Settings</summary>
      <nav aria-label="Owner settings">
        {items.map((item) => (
          <Link href={item.href} key={item.label} aria-current={isCaseNavigationItemActive(item, pathname) ? "page" : undefined}>{item.label}</Link>
        ))}
        <small>Visible only to the case owner</small>
      </nav>
    </details>
  );
}
