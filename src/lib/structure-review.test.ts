import { describe, expect, it, vi } from "vitest";
import type { StructureListItem } from "@/lib/case-structure";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/case-structure", () => ({ getCaseStructureWorkspace: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { matchesQueueStatus, stableReviewOrder } from "@/lib/structure-review";

function item(id: string, status: string, logicalOrder: number, proceedingId = "p1"): StructureListItem {
  return { id, type: "event", objectCode: id, title: id, summary: id, reviewStatus: status, proceedingId, proceedingTitle: proceedingId, assertedBy: null, sourceSegmentIds: [], hasUnresolvedFlags: false, hasTemporalAssertion: false, confidence: null, extractionRunId: null, logicalOrder, reviewable: true, reviewFields: {}, details: [] };
}

describe("Structure review queue contract", () => {
  it("treats each legacy candidate vocabulary as pending", () => {
    expect(["pending", "candidate", "proposed"].map((status) => matchesQueueStatus(item(status, status, 1), "pending"))).toEqual([true, true, true]);
    expect(matchesQueueStatus(item("deferred", "deferred", 1), "pending")).toBe(false);
    expect(matchesQueueStatus(item("deferred", "deferred", 1), "deferred")).toBe(true);
  });

  it("orders by proceeding date, logical order, then UUID", () => {
    const items = [item("c", "pending", 1, "later"), item("b", "pending", 2), item("a", "pending", 2), item("z", "pending", 1)];
    const dates = new Map([["p1", "2026-08-21"], ["later", "2026-08-22"]]);
    expect(stableReviewOrder(items, dates).map((value) => value.id)).toEqual(["z", "a", "b", "c"]);
  });
});
