import { describe, expect, it } from "vitest";
import { windowsForEvent } from "./timeline";

describe("timeline windows", () => {
  const incident = "2023-01-24T05:00:00Z";
  it("places a recent event in both longitudinal windows", () => {
    expect(windowsForEvent("2023-01-10T05:00:00Z", incident, null, null)).toEqual(["all", "ninety_days", "thirty_days"]);
  });
  it("places bounded events in the incident window", () => {
    expect(windowsForEvent("2023-01-25T03:00:00Z", incident, "2023-01-24T23:00:00Z", "2023-01-25T11:00:00Z")).toContain("incident_window");
  });
  it("does not manufacture time for unknown events", () => {
    expect(windowsForEvent(null, incident, null, null)).toEqual(["all"]);
  });
});
