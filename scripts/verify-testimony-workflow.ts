import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { compilePreservedTranscriptManifest, type IntakeManifest } from "../src/lib/proceeding-compiler";

type FirstPass = {
  classification: string;
  source: { preserved_filename: string; sha256: string };
  counts: { segments: number; witness_blocks: number; phase_sets: number; procedural_markers: number };
};

const manifests = (await readdir(path.resolve("transcripts", "manifests")))
  .filter((filename) => /^Lindsay-Clancy_Trial-Day-\d{2,3}_Intake-Manifest\.json$/.test(filename))
  .sort();

assert.ok(manifests.length > 0, "No transcript manifests were found.");
const results = [];

for (const filename of manifests) {
  const manifest = JSON.parse(await readFile(path.resolve("transcripts", "manifests", filename), "utf8")) as IntakeManifest;
  const source = await readFile(path.resolve("transcripts", "preserved", manifest.source.preserved_filename), "utf8");
  const proceeding = compilePreservedTranscriptManifest(manifest, source);
  const firstPassFilename = `Lindsay-Clancy_Trial-Day-${String(manifest.trial_day).padStart(2, "0")}_Testimony-First-Pass.json`;
  const firstPass = JSON.parse(await readFile(path.resolve("transcripts", "first-pass", firstPassFilename), "utf8")) as FirstPass;
  assert.equal(firstPass.classification, "candidate_structure_only", `${filename}: first pass must remain candidate-only`);
  assert.equal(firstPass.source.preserved_filename, manifest.source.preserved_filename, `${filename}: first-pass source filename mismatch`);
  assert.equal(firstPass.source.sha256, manifest.integrity.sha256, `${filename}: first-pass checksum mismatch`);
  assert.equal(firstPass.counts.segments, proceeding.segments.length, `${filename}: parser segment counts diverge`);
  assert.ok(proceeding.segments.length > 0, `${filename}: canonical compiler produced no segments`);
  results.push({
    day: manifest.trial_day,
    sha256: manifest.integrity.sha256,
    segments: proceeding.segments.length,
    witnessBlocks: firstPass.counts.witness_blocks,
    proceduralMarkers: firstPass.counts.procedural_markers,
  });
}

const trialIndex = JSON.parse(await readFile(path.resolve("transcripts", "trial-index", "trial-index-manifest.json"), "utf8")) as { day_count: number; days: Array<{ day: number }> };
assert.equal(trialIndex.day_count, 20, "Trial index must contain Day 1 through Day 20.");
assert.deepEqual(trialIndex.days.map((entry) => entry.day), Array.from({ length: 20 }, (_, index) => index + 1));

process.stdout.write(`${JSON.stringify({ status: "ok", transcripts: results.length, trialIndexDays: trialIndex.day_count, results })}\n`);
