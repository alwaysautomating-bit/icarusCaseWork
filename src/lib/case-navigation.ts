import {
  accountsHref,
  careTrajectoryHref,
  caseAccessHref,
  caseFoundationHref,
  caseFilesHref,
  courtRecordHref,
  documentsHref,
  evidenceHref,
  questionsHref,
  reconcileHref,
  reconstructionHref,
  referenceReportsHref,
  structureHref,
  structureReviewHref,
  timelineHref,
  trialIndexHref,
  witnessHref,
} from "@/lib/case-routes";

export type CaseNavigationItem = {
  href: string;
  label: string;
  match: "exact" | "prefix";
  activePath?: string;
};

export function getCaseNavigationItems(caseId: string, isOwner: boolean): CaseNavigationItem[] {
  const sharedResearchItems: CaseNavigationItem[] = [
    { href: caseFoundationHref(caseId), label: "Foundation", match: "exact" },
    { href: courtRecordHref(caseId), label: "Testimony Database", match: "prefix" },
    { href: witnessHref(caseId), label: "Witness", match: "prefix" },
    { href: timelineHref(caseId), label: "Timelines", match: "prefix" },
    { href: trialIndexHref(caseId), label: "Trial Index", match: "prefix" },
    { href: evidenceHref(caseId), label: "Evidence", match: "prefix" },
    { href: questionsHref(caseId), label: "Questions", match: "prefix" },
    { href: referenceReportsHref(caseId), label: "Reports", match: "prefix" },
  ];

  if (!isOwner) return sharedResearchItems;

  const structurePath = structureHref(caseId);
  return [
    { href: caseFoundationHref(caseId), label: "Foundation", match: "exact" },
    { href: trialIndexHref(caseId), label: "Trial Index", match: "prefix" },
    { href: courtRecordHref(caseId), label: "Testimony Database", match: "prefix" },
    { href: witnessHref(caseId), label: "Witness", match: "prefix" },
    { href: timelineHref(caseId), label: "Timelines", match: "prefix" },
    { href: structurePath, label: "Structure", match: "exact" },
    { href: structureReviewHref(caseId, { reviewStatus: "pending" }), label: "Review", match: "prefix", activePath: `${structurePath}/review` },
    { href: accountsHref(caseId), label: "Accounts", match: "prefix" },
    { href: reconcileHref(caseId), label: "Reconcile", match: "prefix" },
    { href: reconstructionHref(caseId), label: "Reconstruct", match: "prefix" },
    { href: careTrajectoryHref(caseId), label: "Care Trajectory", match: "prefix" },
    { href: caseFilesHref(caseId), label: "Files", match: "prefix" },
    { href: documentsHref(caseId), label: "Documents", match: "prefix" },
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
