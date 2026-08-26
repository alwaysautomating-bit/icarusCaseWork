import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { referenceReports } from "@/lib/reference-reports";

describe("reference report downloads", () => {
  it.each(referenceReports)("preserves $title with its recorded digest", (report) => {
    const bytes = readFileSync(join(process.cwd(), "reference-reports", report.fileName));
    const digest = createHash("sha256").update(bytes).digest("hex");

    expect(bytes.byteLength).toBe(report.byteLength);
    expect(digest).toBe(report.sha256);
    expect(report.boundary.toLowerCase()).toMatch(/not (?:a finding of fact|canonical fact)/);
  });
});
