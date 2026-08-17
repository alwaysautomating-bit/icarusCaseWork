import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compilePreservedTranscriptManifest, type IntakeManifest } from "@/lib/proceeding-compiler";

const manifestPath = path.resolve("transcripts/manifests/Lindsay-Clancy_Trial-Day-02_Intake-Manifest.json");
const sourcePath = path.resolve("transcripts/preserved/Lindsay-Clancy_Trial-Day-02_Rev-Transcript.md");

describe.runIf(existsSync(manifestPath) && existsSync(sourcePath))("standardized preserved manifest compiler", () => {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as IntakeManifest;
  const source = readFileSync(sourcePath, "utf8");

  it("routes a standardized Rev manifest through the unified compiler", () => {
    const compiled = compilePreservedTranscriptManifest(manifest, source);
    expect(compiled.source).toMatchObject({ sha256: manifest.integrity.sha256, representation: "rev_markdown_transcript" });
    expect(compiled.coverage).toMatchObject({ completionState: "complete" });
    expect(compiled.coverage.detectedSegments).toBe(compiled.coverage.parsedSegments);
    expect(compiled.segments.length).toBeGreaterThan(1_000);
  });

  it("rejects a checksum conflict before parsing", () => {
    expect(() => compilePreservedTranscriptManifest({ ...manifest, integrity: { sha256: "0".repeat(64) } }, source)).toThrow(/checksum/i);
  });
});

const day7ManifestPath = path.resolve("transcripts/manifests/Lindsay-Clancy_Trial-Day-07_Intake-Manifest.json");
const day7SourcePath = path.resolve("transcripts/preserved/Lindsay-Clancy_Trial-Day-07_Rev-Transcript.txt");

describe.runIf(existsSync(day7ManifestPath) && existsSync(day7SourcePath))("plain-text preserved manifest compiler", () => {
  it("compiles a branded Rev export with no URL without inventing one", () => {
    const manifest = JSON.parse(readFileSync(day7ManifestPath, "utf8")) as IntakeManifest;
    const compiled = compilePreservedTranscriptManifest(manifest, readFileSync(day7SourcePath, "utf8"));
    expect(compiled.source).toMatchObject({ canonicalUrl: null, sha256: manifest.integrity.sha256, representation: "rev_plain_text_transcript" });
    expect(compiled.coverage.detectedSegments).toBe(compiled.coverage.parsedSegments);
    expect(compiled.segments).toHaveLength(1_315);
  });
});
