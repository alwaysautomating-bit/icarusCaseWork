import { readFile } from "node:fs/promises";
import path from "node:path";

import { compilePreservedTranscriptManifest, type IntakeManifest } from "@/lib/proceeding-compiler";
import type { ParsedRevTranscript } from "@/lib/rev-testimony";

/** Loads the preserved Day 3 Rev transcript through the same manifest compiler used for publication. */
export async function loadDay3Transcript(root = process.cwd()) {
  const manifest = JSON.parse(await readFile(path.resolve(root, "transcripts/manifests/Lindsay-Clancy_Trial-Day-03_Intake-Manifest.json"), "utf8")) as IntakeManifest;
  const preserved = await readFile(path.resolve(root, "transcripts/preserved", manifest.source.preserved_filename), "utf8");
  const compiled = compilePreservedTranscriptManifest(manifest, preserved);
  return {
    transcript: { sourceSha256: compiled.source.sha256, segments: compiled.segments } as ParsedRevTranscript,
    sourceSha256: compiled.source.sha256,
  };
}
