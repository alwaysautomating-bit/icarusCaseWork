import { describe, expect, it } from "vitest";
import { accountsHref, caseAccessHref, caseFilesHref, caseFoundationHref, childrenFoundReportHref, courtRecordHref, evidenceHref, lindsayFoundReportHref, parseStructureObjectType, questionsHref, reconcileHref, structureHref, structureReviewHref, timelineHref, trialIndexHref } from "@/lib/case-routes";

describe("case-scoped routes", () => {
  it("builds explicit supporting-files and access routes", () => {
    expect(caseFoundationHref("case 1")).toBe("/cases/case%201/setup");
    expect(caseFilesHref("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).toBe("/cases/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/files");
    expect(caseAccessHref("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).toBe("/cases/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/access");
    expect(questionsHref("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "question-1")).toBe("/cases/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/questions?question=question-1");
    expect(evidenceHref("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "evidence-1")).toBe("/cases/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/evidence?item=evidence-1");
    expect(childrenFoundReportHref("case 1")).toBe("/cases/case%201/reports/children-found");
    expect(lindsayFoundReportHref("case 1")).toBe("/cases/case%201/reports/lindsay-found");
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

  it("builds bookmarkable witness and digital timeline views", () => {
    expect(accountsHref("case 1", { account: "officer-stephen-hall", versionId: "version-3", view: "compare" }))
      .toBe("/cases/case%201/accounts?account=officer-stephen-hall&version=version-3&view=compare");
    expect(accountsHref("case 1", { view: "account" })).toBe("/cases/case%201/accounts");
  });

  it("builds bookmarkable Core Timeline state", () => {
    expect(timelineHref("case 1", { timeline: "lindsay-health", query: "diazepam", filter: "needs-placement", overlays: ["medical", "clinician"], add: true }))
      .toBe("/cases/case%201/timeline?timeline=lindsay-health&q=diazepam&filter=needs-placement&overlay=medical&overlay=clinician&add=1");
    expect(timelineHref("case 1", { filter: "all" })).toBe("/cases/case%201/timeline");
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
    expect(trialIndexHref("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", { dayNumber: 20, view: "intelligence" })).toBe("/cases/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/trial-index?day=20&view=intelligence");
    expect(trialIndexHref("case 1", { dayNumber: 3, section: "evidence" })).toBe("/cases/case%201/trial-index?day=3&section=evidence");
  });

  it("builds Reconcile graph and saved-group URLs", () => {
    expect(reconcileHref("case 1", { groupId: "group-1", proceedingId: "day-3", type: "event", query: "arrival", notice: "saved" }))
      .toBe("/cases/case%201/reconcile?group=group-1&proceeding=day-3&type=event&q=arrival&notice=saved");
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
