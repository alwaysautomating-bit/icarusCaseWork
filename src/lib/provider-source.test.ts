import { describe, expect, it } from "vitest";
import { revTranscriptPage } from "@/lib/provider-source";

describe("Rev transcript source links", () => {
  it("uses a recorded public transcript URL", () => {
    expect(revTranscriptPage({
      proceedingTitle: "Day 6",
      canonicalUrl: "https://www.rev.com/transcripts/ma-v-lindsay-clancy-day-6",
    })).toBe("https://www.rev.com/transcripts/ma-v-lindsay-clancy-day-6");
  });

  it("derives the official public page for a known Clancy trial day", () => {
    expect(revTranscriptPage({ proceedingTitle: "MA v. Lindsay Clancy Day 14" }))
      .toBe("https://www.rev.com/transcripts/ma-v-lindsay-clancy-day-14");
  });

  it("does not accept an unsafe recorded URL", () => {
    expect(revTranscriptPage({ proceedingTitle: "Day 6", canonicalUrl: "javascript:alert(1)" }))
      .toBe("https://www.rev.com/transcripts/ma-v-lindsay-clancy-day-6");
  });

  it("does not invent a URL for an unrelated proceeding", () => {
    expect(revTranscriptPage({ proceedingTitle: "Opening Statements" })).toBeNull();
  });
});
