"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

type FileTab = {
  href: string;
  label: string;
  active: boolean;
};

export function FileTabNav({ ariaLabel, className, tabs }: { ariaLabel: string; className: string; tabs: FileTab[] }) {
  const activeTab = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const tab = activeTab.current;
    const rail = tab?.parentElement;
    if (!tab || !rail) return;

    rail.scrollTo({
      behavior: "auto",
      left: tab.offsetLeft - (rail.clientWidth - tab.clientWidth) / 2,
    });
  }, [tabs]);

  return <nav className={className} aria-label={ariaLabel}>
    {tabs.map((tab) => <Link
      aria-current={tab.active ? "page" : undefined}
      className={tab.active ? "active" : ""}
      href={tab.href}
      key={tab.href}
      prefetch={false}
      ref={tab.active ? activeTab : undefined}
      scroll={false}
    >{tab.label}</Link>)}
  </nav>;
}
