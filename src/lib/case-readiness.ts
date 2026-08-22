export type ReadinessStatus = "PASS" | "WARN" | "BLOCK";

export type ReadinessDimensionKey =
  | "sources"
  | "identity"
  | "provenance"
  | "temporal"
  | "access"
  | "proceedings";

export type ReadinessDimension = {
  key: ReadinessDimensionKey;
  label: string;
  status: ReadinessStatus;
  summary: string;
  issues: string[];
};

export type CaseReadinessMetrics = {
  hasTitle: boolean;
  hasPurpose: boolean;
  sourceCount: number;
  artifactCount: number;
  authorizedArtifactCount: number;
  segmentCount: number;
  failedIntakeCount: number;
  incompleteIntakeCount: number;
  brokenSourceLinkCount: number;
  proceedingCount: number;
  usableProceedingCount: number;
  incompleteProceedingCount: number;
  unresolvedSpeakerCount: number;
  entityCount: number;
  aliasCollisionCount: number;
  crossCaseIdentityLinkCount: number;
  eventCandidateCount: number;
  unreviewedEventCandidateCount: number;
  temporalAssertionCount: number;
  unresolvedTemporalCount: number;
  acquisitionGapCount: number;
  unresolvedFlagCount: number;
  provenanceActivityCount: number;
  canAccessCase: boolean;
  membershipRole: string | null;
};

export type CaseReadiness = {
  overall: "ANALYSIS READY" | "ANALYSIS READY — WARNINGS" | "NOT READY";
  canEnterCourtRecord: boolean;
  dimensions: ReadinessDimension[];
  blockers: number;
  warnings: number;
};

function dimension(
  key: ReadinessDimensionKey,
  label: string,
  blockers: string[],
  warnings: string[],
  passSummary: string,
): ReadinessDimension {
  if (blockers.length > 0) {
    return { key, label, status: "BLOCK", summary: blockers[0], issues: [...blockers, ...warnings] };
  }
  if (warnings.length > 0) {
    return { key, label, status: "WARN", summary: warnings[0], issues: warnings };
  }
  return { key, label, status: "PASS", summary: passSummary, issues: [] };
}

export function deriveCaseReadiness(metrics: CaseReadinessMetrics): CaseReadiness {
  const sourceBlocks: string[] = [];
  const sourceWarnings: string[] = [];
  if (!metrics.hasTitle || !metrics.hasPurpose) sourceBlocks.push("The case identity or working scope is incomplete.");
  if (metrics.segmentCount === 0) sourceBlocks.push("No committed source segments are available for analysis.");
  if (metrics.failedIntakeCount > 0 && metrics.segmentCount === 0) sourceBlocks.push("A failed intake prevents corpus use.");
  if (metrics.failedIntakeCount > 0 && metrics.segmentCount > 0) sourceWarnings.push(`${metrics.failedIntakeCount} intake${metrics.failedIntakeCount === 1 ? " has" : "s have"} failed while other source material remains usable.`);
  if (metrics.incompleteIntakeCount > 0) sourceWarnings.push(`${metrics.incompleteIntakeCount} intake${metrics.incompleteIntakeCount === 1 ? " remains" : "s remain"} incomplete or requires review.`);
  if (metrics.artifactCount > metrics.authorizedArtifactCount) sourceWarnings.push(`${metrics.artifactCount - metrics.authorizedArtifactCount} artifact${metrics.artifactCount - metrics.authorizedArtifactCount === 1 ? " is" : "s are"} not marked authorized.`);

  const identityBlocks: string[] = [];
  const identityWarnings: string[] = [];
  if (metrics.crossCaseIdentityLinkCount > 0) identityBlocks.push("A speaker identity link crosses the current case boundary.");
  if (metrics.unresolvedSpeakerCount > 0) identityWarnings.push(`${metrics.unresolvedSpeakerCount} proceeding speaker${metrics.unresolvedSpeakerCount === 1 ? " remains" : "s remain"} unresolved or review-required.`);
  if (metrics.aliasCollisionCount > 0) identityWarnings.push(`${metrics.aliasCollisionCount} normalized name or alias collision${metrics.aliasCollisionCount === 1 ? " needs" : "s need"} review.`);
  if (metrics.entityCount === 0 && metrics.segmentCount > 0) identityWarnings.push("No canonical entities have been established for this corpus yet.");

  const provenanceBlocks: string[] = [];
  const provenanceWarnings: string[] = [];
  if (metrics.brokenSourceLinkCount > 0) provenanceBlocks.push(`${metrics.brokenSourceLinkCount} canonical source linkage problem${metrics.brokenSourceLinkCount === 1 ? " was" : "s were"} detected.`);
  if (metrics.segmentCount > 0 && metrics.artifactCount === 0) provenanceBlocks.push("Committed segments are not backed by an accessible source artifact.");
  if (metrics.provenanceActivityCount === 0 && metrics.eventCandidateCount > 0) provenanceWarnings.push("Structured candidates exist without a recorded knowledge-mapping provenance activity.");

  const temporalWarnings: string[] = [];
  if (metrics.unresolvedTemporalCount > 0) temporalWarnings.push(`${metrics.unresolvedTemporalCount} temporal assertion${metrics.unresolvedTemporalCount === 1 ? " remains" : "s remain"} unknown, relative-only, or unreviewed.`);
  if (metrics.eventCandidateCount > 0 && metrics.temporalAssertionCount === 0) temporalWarnings.push("Event candidates exist without temporal assertions.");

  const accessBlocks: string[] = [];
  if (!metrics.canAccessCase || !metrics.membershipRole) accessBlocks.push("The signed-in user does not have an accessible case membership.");

  const proceedingBlocks: string[] = [];
  const proceedingWarnings: string[] = [];
  if (metrics.proceedingCount > 0 && metrics.usableProceedingCount === 0 && metrics.segmentCount === 0) proceedingBlocks.push("No proceeding has complete detected, parsed, and committed coverage.");
  if (metrics.incompleteProceedingCount > 0 && metrics.usableProceedingCount > 0) proceedingWarnings.push(`${metrics.incompleteProceedingCount} proceeding${metrics.incompleteProceedingCount === 1 ? " has" : "s have"} incomplete coverage while another proceeding remains usable.`);
  if (metrics.proceedingCount === 0 && metrics.segmentCount > 0) proceedingWarnings.push("Source segments exist without a compiled proceeding record.");
  if (metrics.acquisitionGapCount > 0) proceedingWarnings.push(`${metrics.acquisitionGapCount} identified evidence acquisition gap${metrics.acquisitionGapCount === 1 ? " remains" : "s remain"} open.`);
  if (metrics.unresolvedFlagCount > 0) proceedingWarnings.push(`${metrics.unresolvedFlagCount} unresolved knowledge flag${metrics.unresolvedFlagCount === 1 ? " remains" : "s remain"}.`);

  const dimensions = [
    dimension("sources", "Sources", sourceBlocks, sourceWarnings, `${metrics.segmentCount.toLocaleString()} committed source segments are available.`),
    dimension("identity", "Identity", identityBlocks, identityWarnings, `${metrics.entityCount.toLocaleString()} canonical entities have no detected setup collision.`),
    dimension("provenance", "Provenance", provenanceBlocks, provenanceWarnings, "Canonical source linkage is intact for the accessible corpus."),
    dimension("temporal", "Temporal", [], temporalWarnings, metrics.temporalAssertionCount > 0 ? "Temporal assertions are preserved with explicit precision." : "No temporal reconciliation is required to begin source review."),
    dimension("access", "Access", accessBlocks, [], metrics.membershipRole ? `RLS-visible membership: ${metrics.membershipRole}.` : "Case access is available."),
    dimension("proceedings", "Proceedings", proceedingBlocks, proceedingWarnings, metrics.proceedingCount > 0 ? `${metrics.usableProceedingCount} proceeding${metrics.usableProceedingCount === 1 ? " is" : "s are"} complete and usable.` : "Proceeding structure is not required for this source set."),
  ];

  const blockers = dimensions.filter((item) => item.status === "BLOCK").length;
  const warnings = dimensions.filter((item) => item.status === "WARN").length;
  return {
    overall: blockers > 0 ? "NOT READY" : warnings > 0 ? "ANALYSIS READY — WARNINGS" : "ANALYSIS READY",
    canEnterCourtRecord: blockers === 0,
    dimensions,
    blockers,
    warnings,
  };
}
