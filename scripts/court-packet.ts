#!/usr/bin/env node

import nextEnv from "@next/env";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  buildCourtPacketBundle,
  DEFAULT_LLAMAPARSE_TIER,
  DEFAULT_LLAMAPARSE_VERSION,
  sha256,
  type CourtPacketBundle,
} from "../src/lib/court-packet";
import { parseWithLlamaParse, type LlamaParseTier } from "../src/lib/llamaparse";
import { getObjectStorage } from "../src/lib/object-storage";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

type Arguments = {
  command: "parse" | "inspect";
  packetPath: string;
  resultPath?: string;
  caseId: string;
  outPath: string;
  tier: LlamaParseTier;
  version: string;
};

function usage(): never {
  throw new Error([
    "Usage:",
    "  pnpm court-packet:parse <packet.pdf> --case-id <uuid> --out <bundle.json> [--tier agentic] [--version 2026-07-24]",
    "  pnpm court-packet:inspect <saved-result.json> --source <packet.pdf> --case-id <uuid> --out <bundle.json>",
  ].join("\n"));
}

function option(argv: string[], name: string) {
  const index = argv.indexOf(name);
  if (index < 0 || !argv[index + 1]) return undefined;
  return argv[index + 1];
}

function argumentsFrom(argv: string[]): Arguments {
  const command = argv[0];
  if (command !== "parse" && command !== "inspect") usage();
  const primary = argv[1];
  const caseId = option(argv, "--case-id");
  const outPath = option(argv, "--out");
  if (!primary || !caseId || !outPath) usage();
  const tier = option(argv, "--tier") ?? DEFAULT_LLAMAPARSE_TIER;
  if (!(["fast", "cost_effective", "agentic", "agentic_plus"] as string[]).includes(tier)) usage();
  if (command === "inspect") {
    const packetPath = option(argv, "--source");
    if (!packetPath) usage();
    return { command, resultPath: primary, packetPath, caseId, outPath, tier: tier as LlamaParseTier, version: option(argv, "--version") ?? "saved-result" };
  }
  return { command, packetPath: primary, caseId, outPath, tier: tier as LlamaParseTier, version: option(argv, "--version") ?? process.env.LLAMAPARSE_VERSION ?? DEFAULT_LLAMAPARSE_VERSION };
}

async function preserveSource(packetPath: string, bytes: Uint8Array) {
  const dataRoot = process.env.ICARUS_DATA_DIR ? path.resolve(process.env.ICARUS_DATA_DIR) : path.join(process.cwd(), ".data");
  const key = `court-packet-${sha256(bytes)}${path.extname(packetPath).toLowerCase() || ".bin"}`;
  return getObjectStorage(dataRoot).putImmutable({ key, bytes, contentType: "application/pdf" });
}

async function writeBundle(outPath: string, bundle: CourtPacketBundle) {
  const resolved = path.resolve(outPath);
  await mkdir(path.dirname(resolved), { recursive: true });
  await writeFile(resolved, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  return resolved;
}

const args = argumentsFrom(process.argv.slice(2));
const packetPath = path.resolve(args.packetPath);
const bytes = await readFile(packetPath);
const stored = await preserveSource(packetPath, bytes);
let parseResult: unknown;
let fileId: string | null = null;
let jobId: string | null = null;
let sdkVersion = "saved-result";
let parseVersion = args.version;
if (args.command === "parse") {
  const live = await parseWithLlamaParse({ bytes, fileName: path.basename(packetPath), tier: args.tier, version: args.version });
  parseResult = live.result;
  fileId = live.fileId;
  jobId = live.jobId;
  parseVersion = live.version;
  sdkVersion = "2.14.1";
} else {
  parseResult = JSON.parse(await readFile(path.resolve(args.resultPath!), "utf8")) as unknown;
  const resultIdentity = parseResult as { job?: { id?: string }; id?: string };
  jobId = resultIdentity.job?.id ?? resultIdentity.id ?? "saved-result";
}
const bundle = buildCourtPacketBundle({
  caseId: args.caseId,
  sourceName: path.basename(packetPath),
  sourceBytes: bytes,
  objectKey: stored.key,
  capturedAt: new Date().toISOString(),
  parseResult,
  tier: args.tier,
  parseVersion,
  sdkVersion,
  fileId,
  jobId,
});
const written = await writeBundle(args.outPath, bundle);
process.stdout.write(`${written}\n${bundle.pages.length} pages preserved\n${bundle.segments.length} review candidates\n`);
