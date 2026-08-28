#!/usr/bin/env node

import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  DEFAULT_TRANSCRIPTS_ROOT,
  SUPPORTED_EXTENSIONS,
  TranscriptIntakeError,
  ensureTranscriptDirectories,
  processTranscriptFile,
} from "./transcript-intake-lib.mjs";

function printHelp() {
  console.log(`Transcript Intake Compiler

Usage:
  pnpm transcript:intake
  pnpm transcript:intake <file-or-directory> [...more paths]
  pnpm transcript:intake --root <transcripts-directory> <file>

With no input paths, all supported files directly inside transcripts/inbox are processed.
Supported source files: .md, .txt`);
}

function parseArguments(argv) {
  const inputs = [];
  let rootPath = path.resolve(process.cwd(), DEFAULT_TRANSCRIPTS_ROOT);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") return { help: true, inputs, rootPath };
    if (argument === "--root") {
      const value = argv[index + 1];
      if (!value) throw new TranscriptIntakeError("INVALID_ARGUMENT", "--root requires a path.");
      rootPath = path.resolve(value);
      index += 1;
      continue;
    }
    if (argument.startsWith("-")) {
      throw new TranscriptIntakeError("INVALID_ARGUMENT", `Unknown option: ${argument}`);
    }
    inputs.push(path.resolve(argument));
  }

  return { help: false, inputs, rootPath };
}

async function supportedFilesInDirectory(directoryPath) {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  return entries
    .filter(
      (entry) =>
        entry.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase()),
    )
    .map((entry) => path.join(directoryPath, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

async function collectInputs(inputPaths, inboxPath) {
  if (inputPaths.length === 0) return supportedFilesInDirectory(inboxPath);

  const files = [];
  for (const inputPath of inputPaths) {
    const inputStat = await stat(inputPath).catch(() => null);
    if (!inputStat) {
      files.push(inputPath);
    } else if (inputStat.isDirectory()) {
      files.push(...(await supportedFilesInDirectory(inputPath)));
    } else {
      files.push(inputPath);
    }
  }
  return files;
}

function reportSuccess(result) {
  const day = String(result.metadata.trialDay).padStart(2, "0");
  console.log(`\nDAY ${day}`);
  console.log(`PASS source identified (${result.metadata.publisher})`);
  console.log(
    result.disposition === "duplicate"
      ? "PASS duplicate checksum matched; preserved source reused"
      : "PASS source preserved byte-for-byte",
  );
  console.log(`PASS SHA-256 ${result.manifest.integrity.sha256}`);
  console.log(
    result.manifestDisposition === "reused"
      ? "PASS existing manifest validated and reused"
      : "PASS manifest generated and schema validated",
  );
  console.log(
    result.firstPassDisposition === "reused"
      ? "PASS deterministic testimony first pass validated and reused"
      : `PASS deterministic testimony first pass generated (${result.firstPass.counts.witness_blocks} witness blocks; ${result.firstPass.counts.procedural_markers} procedural markers)`,
  );
  for (const warning of result.warnings) console.log(`WARN ${warning}`);
  console.log("Output:");
  console.log(result.preservedPath);
  console.log(result.manifestPath);
  console.log(result.firstPassPath);
  if (result.archivedInputPath) console.log(`Archived processed inbox source: ${result.archivedInputPath}`);
}

function reportFailure(inputPath, error) {
  const code = error instanceof TranscriptIntakeError ? error.code : "UNEXPECTED_ERROR";
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nFAIL ${code} ${inputPath}`);
  console.error(message);
  if (error instanceof TranscriptIntakeError && Object.keys(error.details).length > 0) {
    console.error(JSON.stringify(error.details, null, 2));
  }
}

export async function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArguments(argv);
  } catch (error) {
    reportFailure("command line", error);
    return 1;
  }

  if (options.help) {
    printHelp();
    return 0;
  }

  const directories = await ensureTranscriptDirectories(options.rootPath);
  const inputs = await collectInputs(options.inputs, directories.inbox);
  if (inputs.length === 0) {
    console.log(`No supported transcript files found in ${directories.inbox}`);
    return 0;
  }

  let failures = 0;
  for (const inputPath of inputs) {
    try {
      const result = await processTranscriptFile({ inputPath, rootPath: directories.root });
      reportSuccess(result);
    } catch (error) {
      failures += 1;
      reportFailure(inputPath, error);
    }
  }

  return failures === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
