import { describe, expect, it } from "vitest";
import {
  buildCourtPacketBundle,
  pagesFromLlamaParseResult,
  segmentCourtPacketPages,
  sha256,
  stableUuid,
} from "@/lib/court-packet";

const caseId = "413d071f-6299-46ae-aa85-46390aca38a6";
const fixture = {
  job: { id: "fixture-job-001", status: "COMPLETED" },
  markdown: { pages: [
    { page_number: 1, markdown: "# SEARCH WARRANT\nCommonwealth of Massachusetts\nDevice: Apple iPhone" },
    { page_number: 2, markdown: "The issuing court finds probable cause." },
    { page_number: 3, markdown: "# AFFIDAVIT IN SUPPORT OF APPLICATION\nI, the affiant, state the following." },
    { page_number: 4, markdown: "The investigation included review of digital records." },
    { page_number: 5, markdown: "# RETURN OF SEARCH WARRANT\nThe warrant was executed on the stated date." },
  ] },
  text: { pages: [
    { page_number: 1, text: "SEARCH WARRANT Commonwealth of Massachusetts Device Apple iPhone" },
    { page_number: 2, text: "The issuing court finds probable cause." },
    { page_number: 3, text: "AFFIDAVIT IN SUPPORT OF APPLICATION I the affiant state the following." },
    { page_number: 4, text: "The investigation included review of digital records." },
    { page_number: 5, text: "RETURN OF SEARCH WARRANT The warrant was executed on the stated date." },
  ] },
  items: { pages: [
    { page_number: 1, items: [{ type: "heading", value: "SEARCH WARRANT" }] },
    { page_number: 2, items: [] },
    { page_number: 3, items: [{ type: "heading", value: "AFFIDAVIT" }] },
    { page_number: 4, items: [] },
    { page_number: 5, items: [{ type: "heading", value: "RETURN OF SEARCH WARRANT" }] },
  ] },
};

describe("court packet document intelligence", () => {
  it("preserves every page, output representation, and page locator", () => {
    const sourceSha256 = "a".repeat(64);
    const pages = pagesFromLlamaParseResult(fixture, "packet.pdf", sourceSha256);
    expect(pages.map((page) => page.page_number)).toEqual([1, 2, 3, 4, 5]);
    expect(pages[2].locator).toEqual({ type: "page", page: 3, value: "packet.pdf#page=3" });
    expect(pages[0].items).toEqual([{ type: "heading", value: "SEARCH WARRANT" }]);
    expect(pages[2].text).toContain("AFFIDAVIT");
  });

  it("creates stable warrant, affidavit, and return review candidates", () => {
    const pages = pagesFromLlamaParseResult(fixture, "packet.pdf", "a".repeat(64));
    const segments = segmentCourtPacketPages(pages, "a".repeat(64));
    expect(segments.map((segment) => [segment.document_type, segment.start_page, segment.end_page])).toEqual([
      ["search_warrant", 1, 2],
      ["affidavit", 3, 4],
      ["warrant_return", 5, 5],
    ]);
    expect(segments.every((segment) => segment.review_status === "review_required")).toBe(true);
    expect(segmentCourtPacketPages(pages, "a".repeat(64))).toEqual(segments);
  });

  it("flags exact repetition without claiming independent corroboration", () => {
    const hash = "b".repeat(64);
    const rawPages = [
      [1, "AFFIDAVIT same allegation"],
      [2, "RETURN OF SEARCH WARRANT"],
      [3, "AFFIDAVIT same allegation"],
    ];
    const pages = rawPages.map(([number, text]) => ({
      id: stableUuid("page", `${hash}:${number}`),
      segment_id: stableUuid("segment", `${hash}:${number}`),
      page_number: number as number,
      text: text as string,
      markdown: "",
      items: [],
      locator: { type: "page" as const, page: number as number, value: `packet.pdf#page=${number}` },
      parser_page_id: null,
    }));
    const [first, , third] = segmentCourtPacketPages(pages, hash);
    expect(first.fingerprint).toBe(third.fingerprint);
    expect(first.possible_duplicate_of).toEqual([third.id]);
    expect(third.possible_duplicate_of).toEqual([first.id]);
  });

  it("builds the governed Icarus contract with immutable source identity", () => {
    const bytes = new TextEncoder().encode("fixture PDF bytes");
    const bundle = buildCourtPacketBundle({
      caseId,
      sourceName: "packet.pdf",
      sourceBytes: bytes,
      objectKey: `court-packets/${sha256(bytes)}.pdf`,
      capturedAt: "2026-08-24T12:00:00.000Z",
      parseResult: fixture,
      fileId: "file-1",
      jobId: "job-1",
    });
    expect(bundle.source.sha256).toBe(sha256(bytes));
    expect(bundle.source.page_count).toBe(5);
    expect(bundle.parser).toMatchObject({ provider: "llamaparse", sdk_version: "2.14.1", parse_version: "2026-07-24", review_status: "review_required" });
    expect(bundle.segments).toHaveLength(3);
    expect(bundle).not.toHaveProperty("claims");
    expect(bundle).not.toHaveProperty("events");
  });

  it("scopes stable database identifiers to the case", () => {
    const bytes = new TextEncoder().encode("same packet in two cases");
    const base = { sourceName: "packet.pdf", sourceBytes: bytes, objectKey: "packet.pdf", capturedAt: "2026-08-24T12:00:00.000Z", parseResult: fixture };
    const first = buildCourtPacketBundle({ ...base, caseId });
    const second = buildCourtPacketBundle({ ...base, caseId: "513d071f-6299-46ae-aa85-46390aca38a6" });
    expect(first.source.sha256).toBe(second.source.sha256);
    expect(first.pages[0].segment_id).not.toBe(second.pages[0].segment_id);
    expect(first.segments[0].id).not.toBe(second.segments[0].id);
  });
});
