import { describe, expect, it } from "vitest";
import {
  clipToWindow,
  inclusiveDayCount,
  lindsayLongitudinalDemo,
  overlapsWindow,
  positionInWindow,
} from "@/lib/longitudinal-care";

describe("longitudinal care model", () => {
  it("keeps the episode older than each intervention", () => {
    expect(inclusiveDayCount(lindsayLongitudinalDemo.episode.start, lindsayLongitudinalDemo.episode.end)).toBe(131);
    const amitriptyline = lindsayLongitudinalDemo.medications.find((item) => item.id === "amitriptyline-10");
    expect(amitriptyline).toBeDefined();
    expect(inclusiveDayCount(amitriptyline!.start, amitriptyline!.end)).toBe(8);
  });

  it("does not merge a recommended dose with reported administration", () => {
    const recommendation = lindsayLongitudinalDemo.medications.find((item) => item.id === "amitriptyline-20-not-taken");
    expect(recommendation).toMatchObject({ action: "recommended_not_taken", status: "recommended_not_taken", doseLabel: expect.stringContaining("not taken") });
  });

  it("clips continuing periods into the January focus window", () => {
    const window = lindsayLongitudinalDemo.windows["jan-focus"];
    expect(overlapsWindow("2023-01-05", "2023-01-16", window.start, window.end)).toBe(true);
    expect(clipToWindow("2023-01-05", "2023-01-16", window.start, window.end)).toEqual({ start: "2023-01-09", end: "2023-01-16" });
    expect(positionInWindow(window.start, window.start, window.end)).toBe(0);
    expect(positionInWindow(window.end, window.start, window.end)).toBe(100);
  });
});
