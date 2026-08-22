import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { access, copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { firstPassSchema, writeFirstPass } from "./transcript-first-pass-lib.mjs";

export const COMPILER_NAME = "icarus-transcript-intake";
export const COMPILER_VERSION = "0.1.0";
export const DEFAULT_TRANSCRIPTS_ROOT = "transcripts";
export const SUPPORTED_EXTENSIONS = new Set([".md", ".txt"]);

export const INTAKE_RULES = Object.freeze([
  "Preserve source artifact unchanged.",
  "A surrogate never becomes the source.",
  "Separate courtroom proceedings from embedded publisher/media commentary.",
  "Attorney questions are not automatically case facts.",
  "Advocacy and argument are not evidence.",
  "Q/A exchanges must preserve explicit question-answer lineage.",
  'A short answer such as "Yes" or "Correct" cannot be interpreted without its question.',
  "Transcript timestamps are source-media timestamps, not automatically event timestamps.",
  "Source display/publication date is not automatically proceeding date.",
  "Each trial day remains a distinct proceeding.",
]);

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const timestampSchema = z.string().regex(/^\d{1,2}:\d{2}(?::\d{2})?$/);

export const transcriptManifestSchema = z
  .object({
    schema_version: z.literal("1.0"),
    case: z.string().min(1),
    trial_day: z.number().int().positive(),
    proceeding_label: z.string().min(1),
    proceeding_date: isoDateSchema.nullable(),
    proceeding_date_status: z.literal("not independently verified"),
    source: z
      .object({
        publisher: z.literal("Rev"),
        source_type: z.literal("published transcript page capture"),
        page_title: z.string().min(1),
        source_display_date: isoDateSchema.nullable(),
        original_filename: z.string().min(1),
        preserved_filename: z.string().min(1),
        canonical_url: z.string().url().nullable(),
      })
      .strict(),
    integrity: z
      .object({
        sha256: sha256Schema,
        bytes: z.number().int().nonnegative(),
        line_count: z.number().int().nonnegative(),
      })
      .strict(),
    transcript: z
      .object({
        first_timestamp: timestampSchema.nullable(),
        last_timestamp: timestampSchema.nullable(),
      })
      .strict(),
    intake_rules: z.array(z.string().min(1)).length(INTAKE_RULES.length),
    compiler: z
      .object({
        name: z.literal(COMPILER_NAME),
        version: z.literal(COMPILER_VERSION),
      })
      .strict(),
  })
  .strict();

const MONTHS = new Map([
  ["january", 1],
  ["february", 2],
  ["march", 3],
  ["april", 4],
  ["may", 5],
  ["june", 6],
  ["july", 7],
  ["august", 8],
  ["september", 9],
  ["october", 10],
  ["november", 11],
  ["december", 12],
]);

export class TranscriptIntakeError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "TranscriptIntakeError";
    this.code = code;
    this.details = details;
  }
}

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function countLines(buffer) {
  if (buffer.length === 0) return 0;

  let newlines = 0;
  for (const byte of buffer) {
    if (byte === 0x0a) newlines += 1;
  }

  return newlines + (buffer.at(-1) === 0x0a ? 0 : 1);
}

function toIsoDate(monthName, dayText, yearText) {
  const month = MONTHS.get(monthName.toLowerCase());
  const day = Number(dayText);
  const year = Number(yearText);
  if (!month || !Number.isInteger(day) || !Number.isInteger(year)) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${yearText.padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function canonicalNames(trialDay, extension = ".md") {
  if (!Number.isInteger(trialDay) || trialDay <= 0) {
    throw new TranscriptIntakeError("INVALID_TRIAL_DAY", `Invalid trial day: ${trialDay}`);
  }

  const normalizedExtension = extension.toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(normalizedExtension)) {
    throw new TranscriptIntakeError(
      "UNSUPPORTED_FILE_TYPE",
      `Unsupported transcript extension: ${extension || "(none)"}`,
    );
  }

  const day = String(trialDay).padStart(2, "0");
  return {
    preservedFilename: `Lindsay-Clancy_Trial-Day-${day}_Rev-Transcript${normalizedExtension}`,
    manifestFilename: `Lindsay-Clancy_Trial-Day-${day}_Intake-Manifest.json`,
    firstPassFilename: `Lindsay-Clancy_Trial-Day-${day}_Testimony-First-Pass.json`,
  };
}

export function parseRevTranscript(buffer, originalFilename = "transcript.md") {
  const extension = path.extname(originalFilename).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new TranscriptIntakeError(
      "UNSUPPORTED_FILE_TYPE",
      `Unsupported transcript extension: ${extension || "(none)"}`,
      { originalFilename },
    );
  }

  if (buffer.includes(0)) {
    throw new TranscriptIntakeError("UNKNOWN_TRANSCRIPT", "The source is not a UTF-8 text transcript.", {
      originalFilename,
    });
  }

  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const titlePattern = /^(?:#\s*)?(MA\s+v\.?\s+Lindsay\s+Clancy\s+Day\s+(\d{1,3}))\s*$/gim;
  const titleMatch = titlePattern.exec(text);
  const descriptionMatch = /^Day\s+(\d{1,3})\s+of the MA v\. Lindsay Clancy trial\. Read the transcript here\.\s*$/im.exec(text);

  if (!titleMatch && !descriptionMatch) {
    throw new TranscriptIntakeError(
      "UNKNOWN_TRANSCRIPT",
      "Could not determine a supported case title and trial day from the source artifact.",
      { originalFilename },
    );
  }

  const trialDay = Number(titleMatch?.[2] ?? descriptionMatch?.[1]);
  const descriptionPattern = new RegExp(`^Day\\s+${trialDay}\\s+of the MA v\\. Lindsay Clancy trial\\. Read the transcript here\\.\\s*$`, "im");
  const hasRevUrl = /https?:\/\/(?:www\.)?rev\.com\/(?:app\/transcript|transcripts|category)\//i.test(text);
  const hasRevNavigation = /^About[\u00a0 ]Rev\s*$/im.test(text) && /^Transcripts Home\s*$/im.test(text);
  const hasRevBlogCapture = /^Hungry For More\?\s*$/im.test(text)
    && /Subscribe to our blog today\./i.test(text)
    && /^Share this post\s*$/im.test(text);
  const hasRevPlainTextProvenance = /^Copyright Disclaimer\s*$/im.test(text)
    && descriptionPattern.test(text)
    && (hasRevNavigation || hasRevBlogCapture);
  if (!hasRevUrl && !hasRevPlainTextProvenance) {
    throw new TranscriptIntakeError(
      "UNKNOWN_PUBLISHER",
      "The source title was recognized, but Rev provenance could not be detected.",
      { originalFilename },
    );
  }

  const pageTitle = `MA v. Lindsay Clancy Day ${trialDay}`;
  const titleIndex = titleMatch?.index ?? descriptionMatch?.index ?? 0;
  const titleWindow = text.slice(titleIndex, titleIndex + 2_000);
  const dateMatch = titleWindow.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})\b/i,
  );
  const sourceDisplayDate = dateMatch
    ? toIsoDate(dateMatch[1], dateMatch[2], dateMatch[3])
    : null;

  const timestampPattern =
    /\[([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)\]\(https?:\/\/(?:www\.)?rev\.com\/app\/transcript\/[^)\s]+\)/gi;
  let timestamps = Array.from(text.matchAll(timestampPattern), (match) => match[1]);
  if (timestamps.length === 0) {
    const plainTimestampPattern = /^.+?\s+\(([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)\):\s*$/gm;
    timestamps = Array.from(text.matchAll(plainTimestampPattern), (match) => match[1]);
  }
  if (timestamps.length === 0) {
    throw new TranscriptIntakeError(
      "UNKNOWN_TRANSCRIPT",
      "The source wrapper was recognized, but no timestamped transcript turns were found.",
      { originalFilename },
    );
  }

  const canonicalUrlPattern =
    /https?:\/\/(?:www\.)?rev\.com\/transcripts\/ma-v-lindsay-clancy-day-(\d{1,3})(?=[)\s]|$)/gi;
  let canonicalUrl = null;
  for (const match of text.matchAll(canonicalUrlPattern)) {
    if (Number(match[1]) === trialDay) {
      canonicalUrl = match[0];
      break;
    }
  }

  return {
    caseName: "Commonwealth v. Lindsay Clancy",
    trialDay,
    proceedingLabel: `Day ${trialDay}`,
    pageTitle,
    publisher: "Rev",
    sourceType: "published transcript page capture",
    sourceDisplayDate,
    canonicalUrl,
    firstTimestamp: timestamps.at(0) ?? null,
    lastTimestamp: timestamps.at(-1) ?? null,
  };
}

export function buildManifest({ metadata, originalFilename, preservedFilename, buffer }) {
  const manifest = {
    schema_version: "1.0",
    case: metadata.caseName,
    trial_day: metadata.trialDay,
    proceeding_label: metadata.proceedingLabel,
    proceeding_date: null,
    proceeding_date_status: "not independently verified",
    source: {
      publisher: metadata.publisher,
      source_type: metadata.sourceType,
      page_title: metadata.pageTitle,
      source_display_date: metadata.sourceDisplayDate,
      original_filename: originalFilename,
      preserved_filename: preservedFilename,
      canonical_url: metadata.canonicalUrl,
    },
    integrity: {
      sha256: sha256(buffer),
      bytes: buffer.length,
      line_count: countLines(buffer),
    },
    transcript: {
      first_timestamp: metadata.firstTimestamp,
      last_timestamp: metadata.lastTimestamp,
    },
    intake_rules: [...INTAKE_RULES],
    compiler: {
      name: COMPILER_NAME,
      version: COMPILER_VERSION,
    },
  };

  return transcriptManifestSchema.parse(manifest);
}

async function fileExists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function ensureTranscriptDirectories(rootPath) {
  const resolvedRoot = path.resolve(rootPath);
  const directories = {
    root: resolvedRoot,
    inbox: path.join(resolvedRoot, "inbox"),
    preserved: path.join(resolvedRoot, "preserved"),
    manifests: path.join(resolvedRoot, "manifests"),
    firstPass: path.join(resolvedRoot, "first-pass"),
  };

  await Promise.all([
    mkdir(directories.inbox, { recursive: true }),
    mkdir(directories.preserved, { recursive: true }),
    mkdir(directories.manifests, { recursive: true }),
    mkdir(directories.firstPass, { recursive: true }),
  ]);

  return directories;
}

export async function processTranscriptFile({ inputPath, rootPath }) {
  const resolvedInput = path.resolve(inputPath);
  const inputStat = await stat(resolvedInput).catch(() => null);
  if (!inputStat?.isFile()) {
    throw new TranscriptIntakeError("INPUT_NOT_FOUND", `Transcript file not found: ${resolvedInput}`, {
      inputPath: resolvedInput,
    });
  }

  const directories = await ensureTranscriptDirectories(rootPath);
  const buffer = await readFile(resolvedInput);
  const originalFilename = path.basename(resolvedInput);
  const metadata = parseRevTranscript(buffer, originalFilename);
  const names = canonicalNames(metadata.trialDay, path.extname(originalFilename));
  const preservedPath = path.join(directories.preserved, names.preservedFilename);
  const manifestPath = path.join(directories.manifests, names.manifestFilename);
  const firstPassPath = path.join(directories.firstPass, names.firstPassFilename);
  const incomingSha256 = sha256(buffer);
  let disposition = "processed";

  if (await fileExists(preservedPath)) {
    const existingBuffer = await readFile(preservedPath);
    const existingSha256 = sha256(existingBuffer);
    if (existingSha256 !== incomingSha256) {
      throw new TranscriptIntakeError(
        "SOURCE_CONFLICT",
        `Trial day ${metadata.trialDay} already has a preserved source with a different checksum.`,
        {
          incomingPath: resolvedInput,
          incomingSha256,
          preservedPath,
          preservedSha256: existingSha256,
        },
      );
    }
    disposition = "duplicate";
  } else {
    try {
      await copyFile(resolvedInput, preservedPath, fsConstants.COPYFILE_EXCL);
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const racedBuffer = await readFile(preservedPath);
      const racedSha256 = sha256(racedBuffer);
      if (racedSha256 !== incomingSha256) {
        throw new TranscriptIntakeError(
          "SOURCE_CONFLICT",
          `Trial day ${metadata.trialDay} was preserved concurrently with a different checksum.`,
          {
            incomingPath: resolvedInput,
            incomingSha256,
            preservedPath,
            preservedSha256: racedSha256,
          },
        );
      }
      disposition = "duplicate";
    }
  }

  const preservedBuffer = await readFile(preservedPath);
  if (!preservedBuffer.equals(buffer)) {
    throw new TranscriptIntakeError(
      "PRESERVATION_FAILED",
      "The preserved artifact is not byte-for-byte identical to the input.",
      { inputPath: resolvedInput, preservedPath },
    );
  }

  let manifest;
  let manifestDisposition = "generated";
  if (await fileExists(manifestPath)) {
    const existingManifestText = await readFile(manifestPath, "utf8");
    let existingManifest;
    try {
      existingManifest = transcriptManifestSchema.parse(JSON.parse(existingManifestText));
    } catch (error) {
      throw new TranscriptIntakeError(
        "MANIFEST_CONFLICT",
        `The existing intake manifest is invalid: ${manifestPath}`,
        { manifestPath, cause: error instanceof Error ? error.message : String(error) },
      );
    }

    if (existingManifest.integrity.sha256 !== incomingSha256) {
      throw new TranscriptIntakeError(
        "MANIFEST_CONFLICT",
        "The existing intake manifest does not describe the preserved source checksum.",
        {
          manifestPath,
          manifestSha256: existingManifest.integrity.sha256,
          preservedSha256: incomingSha256,
        },
      );
    }
    manifest = existingManifest;
    manifestDisposition = "reused";
  } else {
    manifest = buildManifest({
      metadata,
      originalFilename,
      preservedFilename: names.preservedFilename,
      buffer,
    });
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
  }

  let firstPass;
  let firstPassDisposition = "generated";
  if (await fileExists(firstPassPath)) {
    try {
      firstPass = firstPassSchema.parse(JSON.parse(await readFile(firstPassPath, "utf8")));
    } catch (error) {
      throw new TranscriptIntakeError(
        "FIRST_PASS_CONFLICT",
        `The existing first-pass output is invalid: ${firstPassPath}`,
        { firstPassPath, cause: error instanceof Error ? error.message : String(error) },
      );
    }
    if (firstPass.source.sha256 !== incomingSha256) {
      throw new TranscriptIntakeError(
        "FIRST_PASS_CONFLICT",
        "The existing first-pass output does not describe the preserved source checksum.",
        { firstPassPath, firstPassSha256: firstPass.source.sha256, preservedSha256: incomingSha256 },
      );
    }
    firstPassDisposition = "reused";
  } else {
    firstPass = await writeFirstPass({ preservedPath, outputPath: firstPassPath, sourceSha256: incomingSha256 });
  }

  return {
    disposition,
    manifestDisposition,
    metadata,
    manifest,
    firstPass,
    firstPassDisposition,
    inputPath: resolvedInput,
    preservedPath,
    manifestPath,
    firstPassPath,
    warnings: [
      metadata.sourceDisplayDate
        ? `Publisher display date ${metadata.sourceDisplayDate} was not promoted to proceeding_date.`
        : "Proceeding date remains unverified; no publisher display date was detected.",
    ],
  };
}
