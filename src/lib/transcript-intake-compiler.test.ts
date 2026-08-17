import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildManifest,
  canonicalNames,
  parseRevTranscript,
  processTranscriptFile,
  sha256,
  transcriptManifestSchema,
} from "../../scripts/transcript-intake-lib.mjs";

const temporaryDirectories: string[] = [];

function revCapture({
  day = 5,
  displayDate = "August 4, 2026",
  firstTimestamp = "00:00",
  lastTimestamp = "06:26:27",
  body = "Testimony preserved here.",
} = {}) {
  return [
    "Product",
    "",
    "[Transcripts Home](https://www.rev.com/transcripts)",
    "",
    `MA v. Lindsay Clancy Day ${day}`,
    "",
    `# MA v. Lindsay Clancy Day ${day}`,
    "",
    `Day ${day} of the MA v. Lindsay Clancy trial. Read the transcript here.`,
    "",
    displayDate,
    "",
    `Judge ([${firstTimestamp}](https://www.rev.com/app/transcript/source/o/item?ts=0)):` ,
    "",
    body,
    "",
    `Clerk ([${lastTimestamp}](https://www.rev.com/app/transcript/source/o/item?ts=23187)):` ,
    "",
    "Court is adjourned.",
    "",
  ].join("\r\n");
}

async function makeTemporaryDirectory() {
  const directory = await mkdtemp(path.join(tmpdir(), "icarus-transcript-intake-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("Rev metadata detection", () => {
  it("extracts title, trial day, display date, publisher, URL, and transcript bounds", () => {
    const source = `${revCapture()}[Source](https://www.rev.com/transcripts/ma-v-lindsay-clancy-day-5)\r\n`;
    const metadata = parseRevTranscript(Buffer.from(source), "capture.md");

    expect(metadata).toMatchObject({
      caseName: "Commonwealth v. Lindsay Clancy",
      trialDay: 5,
      proceedingLabel: "Day 5",
      pageTitle: "MA v. Lindsay Clancy Day 5",
      publisher: "Rev",
      sourceDisplayDate: "2026-08-04",
      canonicalUrl: "https://www.rev.com/transcripts/ma-v-lindsay-clancy-day-5",
      firstTimestamp: "00:00",
      lastTimestamp: "06:26:27",
    });
  });

  it("rejects a malformed or unknown transcript", () => {
    expect(() => parseRevTranscript(Buffer.from("Day unknown\nNo provenance"), "unknown.txt")).toThrow(
      /Could not determine/,
    );
  });

  it("generates canonical filenames from trial day without a calendar date", () => {
    expect(canonicalNames(5, ".md")).toEqual({
      preservedFilename: "Lindsay-Clancy_Trial-Day-05_Rev-Transcript.md",
      manifestFilename: "Lindsay-Clancy_Trial-Day-05_Intake-Manifest.json",
    });
  });
});

describe("manifest construction", () => {
  it("keeps the publisher date separate from an unverified proceeding date", () => {
    const buffer = Buffer.from(revCapture());
    const metadata = parseRevTranscript(buffer, "capture.md");
    const manifest = buildManifest({
      metadata,
      originalFilename: "capture.md",
      preservedFilename: "Lindsay-Clancy_Trial-Day-05_Rev-Transcript.md",
      buffer,
    });

    expect(manifest.source.source_display_date).toBe("2026-08-04");
    expect(manifest.proceeding_date).toBeNull();
    expect(manifest.proceeding_date_status).toBe("not independently verified");
    expect(manifest.integrity.sha256).toBe(sha256(buffer));
    expect(manifest.integrity.bytes).toBe(buffer.length);
    expect(manifest.integrity.line_count).toBe(19);
    expect(transcriptManifestSchema.safeParse(manifest).success).toBe(true);
  });
});

describe("source preservation", () => {
  it("preserves bytes exactly and emits a schema-valid manifest", async () => {
    const root = await makeTemporaryDirectory();
    const sourcePath = path.join(root, "incoming-capture.md");
    const source = Buffer.from(revCapture({ body: "Exact bytes: \u00a7 and CRLF." }));
    await writeFile(sourcePath, source);

    const result = await processTranscriptFile({ inputPath: sourcePath, rootPath: path.join(root, "transcripts") });
    const preserved = await readFile(result.preservedPath);
    const manifest = JSON.parse(await readFile(result.manifestPath, "utf8"));

    expect(preserved.equals(source)).toBe(true);
    expect(result.disposition).toBe("processed");
    expect(transcriptManifestSchema.safeParse(manifest).success).toBe(true);
    expect(manifest.integrity.sha256).toBe(sha256(source));
  });

  it("reuses an identical source for the same trial day", async () => {
    const root = await makeTemporaryDirectory();
    const firstPath = path.join(root, "first.md");
    const duplicatePath = path.join(root, "duplicate.md");
    const source = Buffer.from(revCapture());
    await Promise.all([writeFile(firstPath, source), writeFile(duplicatePath, source)]);

    await processTranscriptFile({ inputPath: firstPath, rootPath: path.join(root, "transcripts") });
    const duplicate = await processTranscriptFile({
      inputPath: duplicatePath,
      rootPath: path.join(root, "transcripts"),
    });

    expect(duplicate.disposition).toBe("duplicate");
    expect(duplicate.manifestDisposition).toBe("reused");
  });

  it("stops on a different-checksum source conflict", async () => {
    const root = await makeTemporaryDirectory();
    const firstPath = path.join(root, "first.md");
    const conflictPath = path.join(root, "conflict.md");
    await writeFile(firstPath, revCapture({ body: "Version one" }));
    await writeFile(conflictPath, revCapture({ body: "Version two" }));

    await processTranscriptFile({ inputPath: firstPath, rootPath: path.join(root, "transcripts") });

    await expect(
      processTranscriptFile({ inputPath: conflictPath, rootPath: path.join(root, "transcripts") }),
    ).rejects.toMatchObject({ code: "SOURCE_CONFLICT" });
  });
});
