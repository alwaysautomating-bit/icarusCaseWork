import { describe, expect, it } from "vitest";
import { caseSetupHref, courtRecordHref, parseStructureObjectType, structureHref, structureReviewHref, trialIndexHref } from "@/lib/case-routes";

describe("case-scoped routes", () => {
  it("builds an explicit Foundation route", () => {
    expect(caseSetupHref("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).toBe("/cases/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/setup");
  });

  it("preserves the query and canonical segment in a bookmarkable Court Record URL", () => {
    expect(courtRecordHref("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {
      query: "couldnt wake",
      segmentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    })).toBe("/cases/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/record?q=couldnt+wake&segment=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  });

  it("does not emit empty URL state", () => {
    expect(courtRecordHref("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", { query: "  " })).toBe("/cases/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/record");
  });

  it("builds a bookmarkable structural object and lineage URL", () => {
    expect(structureHref("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {
      type: "claim",
      objectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      segmentId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      proceedingId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      reviewStatus: "pending",
      assertedBy: " Hall ",
      unresolvedOnly: true,
      temporalOnly: true,
      query: "couldnt wake",
      timelineRunId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      compareViewIds: ["ffffffff-ffff-4fff-8fff-ffffffffffff", "11111111-1111-4111-8111-111111111111"],
    })).toBe("/cases/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/structure?type=claim&object=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb&segment=cccccccc-cccc-4ccc-8ccc-cccccccccccc&proceeding=dddddddd-dddd-4ddd-8ddd-dddddddddddd&status=pending&assertedBy=Hall&unresolved=1&temporal=1&q=couldnt+wake&run=eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee&compare=ffffffff-ffff-4fff-8fff-ffffffffffff&compare=11111111-1111-4111-8111-111111111111");
  });

  it("normalizes unknown structure types to the all-objects view", () => {
    expect(parseStructureObjectType("graph")).toBe("all");
    expect(parseStructureObjectType("event")).toBe("event");
  });

  it("builds proceeding-scoped Court Record and Trial Index navigation URLs", () => {
    expect(courtRecordHref("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", { proceedingId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" })).toBe("/cases/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/record?proceeding=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(trialIndexHref("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", { dayNumber: 14, query: "Apple Watch", notice: "saved" })).toBe("/cases/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/trial-index?day=14&q=Apple+Watch&notice=saved");
  });

  it("round-trips every Structure review queue filter", () => {
    expect(structureReviewHref("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {
      type: "event",
      objectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      segmentId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      proceedingId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      reviewStatus: "pending",
      assertedBy: " Hartnett ",
      unresolvedOnly: true,
      temporalOnly: true,
      query: "return context",
      notice: "reviewed",
    })).toBe("/cases/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/structure/review?type=event&object=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb&segment=cccccccc-cccc-4ccc-8ccc-cccccccccccc&proceeding=dddddddd-dddd-4ddd-8ddd-dddddddddddd&status=pending&assertedBy=Hartnett&unresolved=1&temporal=1&q=return+context&notice=reviewed");
  });
});
