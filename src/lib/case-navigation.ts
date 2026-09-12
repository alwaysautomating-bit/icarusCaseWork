import {
  careTrajectoryHref,
  caseAccessHref,
  caseFilesHref,
  courtRecordHref,
  evidenceHref,
  questionsHref,
  reconcileHref,
  reconstructionHref,
  referenceReportsHref,
  structureHref,
  structureReviewHref,
  trialIndexHref,
} from "@/lib/case-routes";

export type CaseNavigationItem = {
  href: string;
  label: string;
  match: "exact" | "prefix";
  activePath?: string;
};

export function getCaseNavigationItems(caseId: string, isOwner: boolean): CaseNavigationItem[] {
  const sharedResearchItems: CaseNavigationItem[] = [
    { href: courtRecordHref(caseId), label: "Court Record", match: "prefix" },
    { href: trialIndexHref(caseId), label: "Trial Index", match: "prefix" },
    { href: evidenceHref(caseId), label: "Evidence", match: "prefix" },
    { href: questionsHref(caseId), label: "Questions", match: "prefix" },
    { href: referenceReportsHref(caseId), label: "Reports", match: "prefix" },
  ];

  if (!isOwner) return sharedResearchItems;

  const structurePath = structureHref(caseId);
  return [
    { href: trialIndexHref(caseId), label: "Trial Index", match: "prefix" },
    { href: courtRecordHref(caseId), label: "Court Record", match: "prefix" },
    { href: structurePath, label: "Structure", match: "exact" },
    { href: structureReviewHref(caseId, { reviewStatus: "pending" }), label: "Review", match: "prefix", activePath: `${structurePath}/review` },
    { href: reconcileHref(caseId), label: "Reconcile", match: "prefix" },
    { href: reconstructionHref(caseId), label: "Reconstruct", match: "prefix" },
    { href: careTrajectoryHref(caseId), label: "Care Trajectory", match: "prefix" },
    { href: caseFilesHref(caseId), label: "Files", match: "prefix" },
    { href: evidenceHref(caseId), label: "Evidence", match: "prefix" },
    { href: questionsHref(caseId), label: "Questions", match: "prefix" },
    { href: referenceReportsHref(caseId), label: "Reports", match: "prefix" },
    { href: caseAccessHref(caseId), label: "Access", match: "prefix" },
  ];
}

export function isCaseNavigationItemActive(item: CaseNavigationItem, pathname: string) {
  const activePath = item.activePath ?? item.href;
  return item.match === "exact" ? pathname === activePath : pathname.startsWith(activePath);
}
