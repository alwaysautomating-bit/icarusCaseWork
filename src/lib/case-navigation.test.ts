import { describe, expect, it } from "vitest";
import { getCaseNavigationItems, getCaseSettingsItems, isCaseNavigationItemActive } from "@/lib/case-navigation";

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

  it("keeps the settings pages out of the owner tab bar", () => {
    expect(getCaseNavigationItems(caseId, true).map((item) => item.label)).toEqual([
      "Foundation",
      "Trial Index",
      "Testimony Database",
      "Witness",
      "Timelines",
      "Care Trajectory",
      "Files",
      "Documents",
      "Evidence",
      "Questions",
      "Reports",
    ]);
  });

  it("lists the owner-only pages in the settings menu", () => {
    expect(getCaseSettingsItems(caseId).map((item) => item.label)).toEqual(["Structure", "Review", "Accounts", "Reconcile", "Reconstruct", "Access"]);
  });

  it("does not mark Structure active while Review is open", () => {
    const ownerItems = getCaseSettingsItems(caseId);
    const structure = ownerItems.find((item) => item.label === "Structure");
    const review = ownerItems.find((item) => item.label === "Review");
    const reviewPath = `/cases/${caseId}/structure/review`;

    expect(structure && isCaseNavigationItemActive(structure, reviewPath)).toBe(false);
    expect(review && isCaseNavigationItemActive(review, reviewPath)).toBe(true);
  });
});
