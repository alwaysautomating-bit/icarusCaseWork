"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  careTrajectoryHref,
  caseSetupHref,
  courtRecordHref,
  reconcileHref,
  reconstructionHref,
  referenceReportsHref,
  structureHref,
  structureReviewHref,
  trialIndexHref,
} from "@/lib/case-routes";

type LifecycleItem = {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
};

export function CaseLifecycleNav({ caseId, canReview }: { caseId: string; canReview: boolean }) {
  const pathname = usePathname();
  const structurePath = structureHref(caseId);
  const items: LifecycleItem[] = [
    { href: caseSetupHref(caseId), label: "Foundation", match: (path) => path === caseSetupHref(caseId) },
    { href: trialIndexHref(caseId), label: "Trial Index", match: (path) => path.startsWith(trialIndexHref(caseId)) },
    { href: courtRecordHref(caseId), label: "Court Record", match: (path) => path.startsWith(courtRecordHref(caseId)) },
    { href: structurePath, label: "Structure", match: (path) => path === structurePath },
    ...(canReview
      ? [{ href: structureReviewHref(caseId, { reviewStatus: "pending" }), label: "Review", match: (path: string) => path.startsWith(`${structurePath}/review`) }]
      : []),
    { href: reconcileHref(caseId), label: "Reconcile", match: (path) => path.startsWith(reconcileHref(caseId)) },
    { href: reconstructionHref(caseId), label: "Reconstruct", match: (path) => path.startsWith(reconstructionHref(caseId)) },
    { href: careTrajectoryHref(caseId), label: "Care Trajectory", match: (path) => path.startsWith(careTrajectoryHref(caseId)) },
    { href: referenceReportsHref(caseId), label: "Reports", match: (path) => path.startsWith(referenceReportsHref(caseId)) },
  ];

  return (
    <nav className="case-lifecycle-nav" aria-label="Case lifecycle">
      {items.map((item) => {
        const active = item.match(pathname);
        return <Link href={item.href} aria-current={active ? "page" : undefined} key={item.label}>{item.label}</Link>;
      })}
      <span aria-disabled="true">Actor Knowledge</span>
      <span aria-disabled="true">Gaps</span>
    </nav>
  );
}
