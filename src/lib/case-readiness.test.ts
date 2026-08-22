import { describe, expect, it } from "vitest";
import { deriveCaseReadiness, type CaseReadinessMetrics } from "@/lib/case-readiness";

function metrics(overrides: Partial<CaseReadinessMetrics> = {}): CaseReadinessMetrics {
  return {
    hasTitle: true,
    hasPurpose: true,
    sourceCount: 1,
    artifactCount: 1,
    authorizedArtifactCount: 1,
    segmentCount: 120,
    failedIntakeCount: 0,
    incompleteIntakeCount: 0,
    brokenSourceLinkCount: 0,
    proceedingCount: 1,
    usableProceedingCount: 1,
    incompleteProceedingCount: 0,
    unresolvedSpeakerCount: 0,
    entityCount: 3,
    aliasCollisionCount: 0,
    crossCaseIdentityLinkCount: 0,
    eventCandidateCount: 0,
    unreviewedEventCandidateCount: 0,
    temporalAssertionCount: 0,
    unresolvedTemporalCount: 0,
    acquisitionGapCount: 0,
    unresolvedFlagCount: 0,
    provenanceActivityCount: 0,
    canAccessCase: true,
    membershipRole: "owner",
    ...overrides,
  };
}

describe("case readiness", () => {
  it("allows analysis when the canonical source corpus is safe to work", () => {
    const readiness = deriveCaseReadiness(metrics());
    expect(readiness.overall).toBe("ANALYSIS READY");
    expect(readiness.canEnterCourtRecord).toBe(true);
    expect(readiness.blockers).toBe(0);
  });

  it("keeps normal uncertainty visible without blocking source work", () => {
    const readiness = deriveCaseReadiness(metrics({
      unresolvedSpeakerCount: 2,
      eventCandidateCount: 1,
      unreviewedEventCandidateCount: 1,
      temporalAssertionCount: 1,
      unresolvedTemporalCount: 1,
      acquisitionGapCount: 3,
    }));
    expect(readiness.overall).toBe("ANALYSIS READY — WARNINGS");
    expect(readiness.canEnterCourtRecord).toBe(true);
    expect(readiness.dimensions.find((item) => item.key === "identity")?.status).toBe("WARN");
    expect(readiness.dimensions.find((item) => item.key === "temporal")?.status).toBe("WARN");
  });

  it("blocks analysis when no committed source segment exists", () => {
    const readiness = deriveCaseReadiness(metrics({ segmentCount: 0, usableProceedingCount: 0, incompleteProceedingCount: 1 }));
    expect(readiness.overall).toBe("NOT READY");
    expect(readiness.canEnterCourtRecord).toBe(false);
    expect(readiness.dimensions.find((item) => item.key === "sources")?.status).toBe("BLOCK");
  });

  it("blocks cross-case identity and inaccessible membership conditions", () => {
    const readiness = deriveCaseReadiness(metrics({ crossCaseIdentityLinkCount: 1, canAccessCase: false, membershipRole: null }));
    expect(readiness.canEnterCourtRecord).toBe(false);
    expect(readiness.dimensions.find((item) => item.key === "identity")?.status).toBe("BLOCK");
    expect(readiness.dimensions.find((item) => item.key === "access")?.status).toBe("BLOCK");
  });
});
