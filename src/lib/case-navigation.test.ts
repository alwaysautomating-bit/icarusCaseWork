import { describe, expect, it } from "vitest";
import { getCaseNavigationItems, isCaseNavigationItemActive } from "@/lib/case-navigation";

const caseId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("case navigation policy", () => {
  it("shows members the shared research tabs", () => {
    expect(getCaseNavigationItems(caseId, false).map((item) => item.label)).toEqual([
      "Foundation",
      "Testimony Database",
      "Witness",
      "Timelines",
      "Trial Index",
      "Evidence",
      "Questions",
      "Reports",
    ]);
  });

  it("preserves the complete Casework workspace for the owner", () => {
    expect(getCaseNavigationItems(caseId, true).map((item) => item.label)).toEqual([
      "Foundation",
      "Trial Index",
      "Testimony Database",
      "Witness",
      "Timelines",
      "Structure",
      "Review",
      "Accounts",
      "Reconcile",
      "Reconstruct",
      "Care Trajectory",
      "Files",
      "Documents",
      "Evidence",
      "Questions",
      "Reports",
      "Access",
    ]);
  });

  it("does not mark Structure active while Review is open", () => {
    const ownerItems = getCaseNavigationItems(caseId, true);
    const structure = ownerItems.find((item) => item.label === "Structure");
    const review = ownerItems.find((item) => item.label === "Review");
    const reviewPath = `/cases/${caseId}/structure/review`;

    expect(structure && isCaseNavigationItemActive(structure, reviewPath)).toBe(false);
    expect(review && isCaseNavigationItemActive(review, reviewPath)).toBe(true);
  });
});
