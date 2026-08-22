"use client";

import { useRouter } from "next/navigation";

export function CaseSwitcher({ activeCaseId, cases }: { activeCaseId: string; cases: Array<{ id: string; title: string }> }) {
  const router = useRouter();
  return <label className="case-switcher"><span>Active case</span><select value={activeCaseId} onChange={(event) => router.push(`/cases/${encodeURIComponent(event.target.value)}/setup`)}>{cases.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>;
}
