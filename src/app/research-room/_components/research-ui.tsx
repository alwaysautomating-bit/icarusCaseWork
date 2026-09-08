"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function Icon({ name, size = 20 }: { name: "activity" | "active" | "rooms" | "profile" | "flag" | "bookmark" | "comment" | "arrow" | "search" | "source" | "question" | "close"; size?: number }) {
  const paths: Record<typeof name, ReactNode> = {
    activity: <><path d="M4 5h16M4 12h10M4 19h13"/><circle cx="18" cy="12" r="2"/></>,
    active: <path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z"/>,
    rooms: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 20c0-4 2.5-6 6-6s6 2 6 6M15 15c3.6 0 5 1.8 5 5"/></>,
    profile: <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-5 3.2-8 8-8s8 3 8 8"/></>,
    flag: <><path d="M5 3v18M6 4h11l-2 4 2 4H6"/></>,
    bookmark: <path d="M6 3h12v18l-6-4-6 4V3Z"/>,
    comment: <path d="M4 4h16v12H9l-5 4V4Z"/>,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    source: <><path d="M6 2h9l4 4v16H6z"/><path d="M14 2v5h5M9 12h7M9 16h7"/></>,
    question: <><circle cx="12" cy="12" r="10"/><path d="M9.5 9a2.7 2.7 0 1 1 4.1 2.3c-1 .6-1.6 1.1-1.6 2.2M12 17h.01"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
  };
  return <svg className="rr-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">{paths[name]}</svg>;
}

export function Wordmark({ light = false }: { light?: boolean }) {
  return <Link href="/" className={`rr-wordmark${light ? " light" : ""}`} aria-label="Icarus Research Room home"><span className="rr-wordmark-mark"><i/></span><span>ICARUS</span><b>RESEARCH ROOM</b></Link>;
}

export function Avatar({ name, color, size = 44 }: { name: string; color: string; size?: number }) {
  const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return <span className="rr-avatar" style={{ "--rr-avatar-size": `${size}px`, "--rr-avatar-color": color } as React.CSSProperties}>{initials}</span>;
}

export function TopBar({ overline, title, back, light = false, action }: { overline: string; title: string; back?: string; light?: boolean; action?: ReactNode }) {
  return <header className={`rr-topbar${light ? " light" : ""}`}>
    <div className="rr-topbar-title">
      {back ? <Link href={back} className="rr-back" aria-label="Go back">←</Link> : null}
      <div><span className="rr-meta">{overline}</span><h1>{title}</h1></div>
    </div>
    {action}
  </header>;
}

const navItems = [
  { href: "/research-room/activity", label: "Activity", icon: "activity" as const },
  { href: "/research-room/active", label: "Active", icon: "active" as const },
  { href: "/research-room/rooms", label: "Rooms", icon: "rooms" as const },
  { href: "/research-room/profile", label: "Profile", icon: "profile" as const },
];

export function BottomNav() {
  const pathname = usePathname();
  return <nav className="rr-bottom-nav" aria-label="Research Room">
    {navItems.map((item) => {
      const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
      return <Link key={item.href} href={item.href} className={active ? "active" : ""}><Icon name={item.icon}/><span>{item.label}</span></Link>;
    })}
  </nav>;
}

export function ResearchShell({ children, surface = "night", showNav = true }: { children: ReactNode; surface?: "night" | "paper"; showNav?: boolean }) {
  return <div className={`rr-shell rr-${surface}${showNav ? " rr-with-nav" : ""}`}><div className="rr-app-frame">{children}</div>{showNav ? <BottomNav/> : null}</div>;
}

export function Stat({ value, label }: { value: string | number; label: string }) {
  return <div className="rr-stat"><strong>{value}</strong><span>{label}</span></div>;
}

export function Status({ children, live = false }: { children: ReactNode; live?: boolean }) {
  return <span className={`rr-status${live ? " live" : ""}`}>{live ? <i/> : null}{children}</span>;
}
