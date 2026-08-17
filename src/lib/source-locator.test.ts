import { describe, expect, it } from "vitest";
import { buildSourceLocator, formatSourceLocator } from "./source-locator";

describe("source locators", () => {
  it("builds and formats a page locator while retaining extracted-text offsets", () => {
    const locator = buildSourceLocator({ locatorType: "page", page: "14" }, { start: 20, end: 41 });
    expect(locator).toEqual({ type: "page", page: 14, start: 20, end: 41 });
    expect(formatSourceLocator(locator)).toBe("page 14");
  });

  it("requires the format-specific coordinates", () => {
    expect(() => buildSourceLocator({ locatorType: "spreadsheet_range", sheet: "Sheet 1" }, { start: 0, end: 4 })).toThrow(/cell range/);
  });
});
