"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  careTrajectoryHref,
  caseAccessHref,
  caseFilesHref,
  courtRecordHref,
  evidenceHref,
  reconcileHref,
  reconstructionHref,
  referenceReportsHref,
  questionsHref,
  structureHref,
  structureReviewHref,
  trialIndexHref,
} from "@/lib/case-routes";

type LifecycleItem = {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
};

export function CaseLifecycleNav({ caseId, canReview, isOwner, pilotMode }: { caseId: string; canReview: boolean; isOwner: boolean; pilotMode: boolean }) {
  const pathname = usePathname();
  const structurePath = structureHref(caseId);
  const items: LifecycleItem[] = [
    { href: trialIndexHref(caseId), label: "Trial Index", match: (path) => path.startsWith(trialIndexHref(caseId)) },
    { href: courtRecordHref(caseId), label: "Court Record", match: (path) => path.startsWith(courtRecordHref(caseId)) },
    { href: caseFilesHref(caseId), label: "Files", match: (path) => path.startsWith(caseFilesHref(caseId)) },
    { href: questionsHref(caseId), label: "Questions", match: (path) => path.startsWith(questionsHref(caseId)) },
    { href: evidenceHref(caseId), label: "Evidence", match: (path) => path.startsWith(evidenceHref(caseId)) },
    ...(!pilotMode ? [
      { href: structurePath, label: "Structure", match: (path: string) => path === structurePath },
      ...(canReview
        ? [{ href: structureReviewHref(caseId, { reviewStatus: "pending" }), label: "Review", match: (path: string) => path.startsWith(`${structurePath}/review`) }]
        : []),
      { href: reconcileHref(caseId), label: "Reconcile", match: (path: string) => path.startsWith(reconcileHref(caseId)) },
      { href: reconstructionHref(caseId), label: "Reconstruct", match: (path: string) => path.startsWith(reconstructionHref(caseId)) },
      { href: careTrajectoryHref(caseId), label: "Care Trajectory", match: (path: string) => path.startsWith(careTrajectoryHref(caseId)) },
      { href: referenceReportsHref(caseId), label: "Reports", match: (path: string) => path.startsWith(referenceReportsHref(caseId)) },
    ] : []),
    ...(isOwner ? [{ href: caseAccessHref(caseId), label: "Access", match: (path: string) => path.startsWith(caseAccessHref(caseId)) }] : []),
  ];

  return (
    <nav className="case-lifecycle-nav" aria-label="Case lifecycle">
      {items.map((item) => {
        const active = item.match(pathname);
        return <Link href={item.href} aria-current={active ? "page" : undefined} key={item.label}>{item.label}</Link>;
      })}
      {!pilotMode && <span aria-disabled="true">Actor Knowledge</span>}
      {!pilotMode && <span aria-disabled="true">Gaps</span>}
    </nav>
  );
}
