import { describe, expect, it } from "vitest";
import { exactCharacterLocator, sha256Manifest } from "./citation";

describe("exactCharacterLocator", () => {
  it("returns a stable half-open character range", () => {
    expect(exactCharacterLocator("Before. Exact source words. After.", "Exact source words.")).toEqual({ start: 8, end: 27 });
  });

  it("rejects an assertion that is not an exact source quote", () => {
    expect(() => exactCharacterLocator("Original wording", "Normalized wording")).toThrow(/verbatim/);
  });
});

describe("sha256Manifest", () => {
  it("is order independent for the same evidence set", () => {
    expect(sha256Manifest(["bbb", "aaa"])).toBe(sha256Manifest(["aaa", "bbb"]));
  });
});
