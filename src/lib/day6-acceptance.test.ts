import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseRevTranscript } from "@/lib/rev-testimony";

const artifact = path.resolve(".data/objects/48cca058a0bc10ec900010f0271d2bd6ede40c88b7db57e2790ee07aa2de55d2.html");

describe.runIf(existsSync(artifact))("Day 6 acceptance corpus", () => {
  const parsed = parseRevTranscript(readFileSync(artifact, "utf8"), "https://www.rev.com/transcripts/ma-v-lindsay-clancy-day-6");

  it("detects and parses every provider turn through the final timestamp", () => {
    expect(parsed.coverage).toMatchObject({ completionState: "complete", detectedSegments: 2_197, parsedSegments: 2_197, lastTimestamp: "04:16:42" });
    expect(parsed.segments).toHaveLength(2_197);
  });

  it("preserves the 82.1°F and 95.2°F Q/A exchanges", () => {
    expect(parsed.qaExchanges.find((item) => /82\.1 degrees/i.test(item.question))).toMatchObject({ questionTimestamp: "00:19:43", answerTimestamp: "00:19:56", answerSpeaker: "Christina Carpio" });
    expect(parsed.qaExchanges.find((item) => /95\.2 degrees/i.test(item.question))).toMatchObject({ questionTimestamp: "00:21:12", answerTimestamp: "00:21:18", answer: "Yes." });
  });

  it("structures exhibits and stipulations without losing continuation text", () => {
    expect(parsed.exhibits.map((item) => item.label)).toEqual(expect.arrayContaining(["J", "184", "185", "186"]));
    expect(parsed.stipulations.find((item) => item.exhibitLabel === "184")?.exactText).toContain("all policies and procedures were followed");
  });

  it("surfaces unknown measurement time without inventing one", () => {
    expect(parsed.resolutionItems.find((item) => item.kind === "measurement_time")).toMatchObject({ status: "unresolved", eventTime: null });
  });
});
