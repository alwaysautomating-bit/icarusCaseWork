import { createHash } from "node:crypto";
import path from "node:path";
import { z } from "zod";

export const COURT_PACKET_SCHEMA_VERSION = "icarus.court_packet.parse.v1" as const;
export const LLAMAPARSE_SDK_NAME = "@llamaindex/llama-cloud" as const;
export const LLAMAPARSE_SDK_VERSION = "2.14.1" as const;
export const DEFAULT_LLAMAPARSE_TIER = "agentic" as const;
export const DEFAULT_LLAMAPARSE_VERSION = "2026-07-24" as const;

export const documentTypes = [
  "search_warrant",
  "warrant_application",
  "affidavit",
  "warrant_return",
  "attachment",
  "property_inventory",
  "unclassified",
] as const;

export type CourtPacketDocumentType = (typeof documentTypes)[number];
export type CourtPacketParseTier = "fast" | "cost_effective" | "agentic" | "agentic_plus";
export type CourtPacketPage = {
  id: string;
  segment_id: string;
  page_number: number;
  text: string;
  markdown: string;
  items: Record<string, unknown>[];
  locator: { type: "page"; page: number; value: string };
  parser_page_id: string | null;
};
export type CourtPacketCandidate = {
  id: string;
  candidate_id: string;
  document_type: CourtPacketDocumentType;
  start_page: number;
  end_page: number;
  page_numbers: number[];
  source_segment_ids: string[];
  boundary_evidence: string[];
  fingerprint: string;
  review_status: "review_required";
  possible_duplicate_of: string[];
};
export type CourtPacketBundle = {
  schema_version: typeof COURT_PACKET_SCHEMA_VERSION;
  case_id: string;
  source: {
    source_id: string;
    intake_id: string;
    lineage_id: string;
    artifact_id: string;
    name: string;
    sha256: string;
    byte_length: number;
    media_type: string;
    object_key: string;
    captured_at: string;
    page_count: number;
    source_family: "search_warrant";
    evidence_lane: "documentary";
  };
  parser: {
    run_id: string;
    provider: "llamaparse";
    sdk_name: typeof LLAMAPARSE_SDK_NAME;
    sdk_version: string;
    tier: string;
    parse_version: string;
    file_id: string | null;
    job_id: string | null;
    configuration_sha256: string;
    review_status: "review_required";
  };
  pages: CourtPacketPage[];
  segments: CourtPacketCandidate[];
  warnings: string[];
};

type ResultPage = Record<string, unknown> & { page_number?: number; page?: number };
type ParseResult = {
  job?: { id?: string };
  id?: string;
  text?: { pages?: ResultPage[] } | null;
  markdown?: { pages?: ResultPage[] } | null;
  items?: { pages?: ResultPage[] } | null;
};

const boundaryRules: Array<[CourtPacketDocumentType, RegExp]> = [
  ["warrant_return", /\b(?:return\s+of|warrant\s+return|return\s+on)\b[\s\S]{0,40}\bsearch\s+warrant\b/i],
  ["warrant_application", /\bapplication\s+for\s+(?:a\s+)?search\s+warrant\b/i],
  ["search_warrant", /\bsearch\s+warrant\b/i],
  ["affidavit", /\baffidavit\b(?:\s+in\s+support\s+of\s+(?:an?\s+)?application)?/i],
  ["property_inventory", /\b(?:property|evidence)\s+(?:receipt|inventory)\b/i],
  ["attachment", /\b(?:attachment|exhibit)\s+[a-z0-9]+\b/i],
];

export const courtPacketBundleSchema = z.object({
  schema_version: z.literal(COURT_PACKET_SCHEMA_VERSION),
  case_id: z.uuid(),
  source: z.object({
    source_id: z.uuid(), intake_id: z.uuid(), lineage_id: z.uuid(), artifact_id: z.uuid(),
    name: z.string().min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/), byte_length: z.number().int().nonnegative(),
    media_type: z.string().min(1), object_key: z.string().min(1), captured_at: z.iso.datetime(), page_count: z.number().int().positive(),
    source_family: z.literal("search_warrant"), evidence_lane: z.literal("documentary"),
  }),
  parser: z.object({
    run_id: z.uuid(), provider: z.literal("llamaparse"), sdk_name: z.literal(LLAMAPARSE_SDK_NAME), sdk_version: z.string().min(1),
    tier: z.enum(["fast", "cost_effective", "agentic", "agentic_plus"]), parse_version: z.string().min(1),
    file_id: z.string().nullable(), job_id: z.string().nullable(), configuration_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    review_status: z.literal("review_required"),
  }),
  pages: z.array(z.object({
    id: z.uuid(), segment_id: z.uuid(), page_number: z.number().int().positive(), text: z.string(), markdown: z.string(),
    items: z.array(z.record(z.string(), z.unknown())), locator: z.object({ type: z.literal("page"), page: z.number().int().positive(), value: z.string().min(1) }),
    parser_page_id: z.string().nullable(),
  })).min(1),
  segments: z.array(z.object({
    id: z.uuid(), candidate_id: z.string().regex(/^DOC-CAND-[A-F0-9]{12}$/), document_type: z.enum(documentTypes),
    start_page: z.number().int().positive(), end_page: z.number().int().positive(), page_numbers: z.array(z.number().int().positive()).min(1),
    source_segment_ids: z.array(z.uuid()).min(1), boundary_evidence: z.array(z.string()), fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    review_status: z.literal("review_required"), possible_duplicate_of: z.array(z.uuid()),
  })),
  warnings: z.array(z.string()),
}).superRefine((bundle, context) => {
  if (bundle.source.page_count !== bundle.pages.length) context.addIssue({ code: "custom", message: "Page count does not match preserved pages." });
  const numbers = bundle.pages.map((page) => page.page_number);
  if (numbers.some((number, index) => number !== index + 1)) context.addIssue({ code: "custom", message: "Pages must be contiguous and ordered from one." });
  const segmentIds = new Set(bundle.pages.map((page) => page.segment_id));
  for (const candidate of bundle.segments) {
    if (candidate.end_page < candidate.start_page || candidate.page_numbers.length !== candidate.end_page - candidate.start_page + 1) {
      context.addIssue({ code: "custom", message: `Candidate ${candidate.candidate_id} has an invalid range.` });
    }
    if (candidate.source_segment_ids.some((id) => !segmentIds.has(id))) context.addIssue({ code: "custom", message: `Candidate ${candidate.candidate_id} cites a foreign page.` });
  }
});

export function sha256(value: Uint8Array | string) {
  return createHash("sha256").update(value).digest("hex");
}

export function stableUuid(namespace: string, value: string) {
  const hash = createHash("sha256").update(`${namespace}\0${value}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function pageNumber(page: ResultPage, index: number) {
  const value = page.page_number ?? page.page ?? index + 1;
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : index + 1;
}

function pageMap(pages: ResultPage[] | undefined) {
  return new Map((pages ?? []).map((page, index) => [pageNumber(page, index), page]));
}

export function pagesFromLlamaParseResult(result: unknown, sourceName: string, sourceIdentity: string): CourtPacketPage[] {
  if (!result || typeof result !== "object") throw new Error("LlamaParse returned an unsupported result.");
  const payload = result as ParseResult;
  const textPages = pageMap(payload.text?.pages);
  const markdownPages = pageMap(payload.markdown?.pages);
  const itemPages = pageMap(payload.items?.pages);
  const numbers = [...new Set([...textPages.keys(), ...markdownPages.keys(), ...itemPages.keys()])].sort((a, b) => a - b);
  return numbers.map((number) => {
    const textPage = textPages.get(number);
    const markdownPage = markdownPages.get(number);
    const itemPage = itemPages.get(number);
    const markdown = typeof markdownPage?.markdown === "string" ? markdownPage.markdown : "";
    const text = typeof textPage?.text === "string" ? textPage.text : typeof markdownPage?.text === "string" ? markdownPage.text : markdown;
    const rawItems = Array.isArray(itemPage?.items) ? itemPage.items : Array.isArray(itemPage?.value) ? itemPage.value : [];
    const items = rawItems.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item));
    const locatorValue = `${path.basename(sourceName)}#page=${number}`;
    return {
      id: stableUuid("court-packet-page", `${sourceIdentity}:${number}`),
      segment_id: stableUuid("court-packet-source-segment", `${sourceIdentity}:${number}`),
      page_number: number,
      text,
      markdown,
      items,
      locator: { type: "page", page: number, value: locatorValue },
      parser_page_id: typeof markdownPage?.id === "string" ? markdownPage.id : typeof textPage?.id === "string" ? textPage.id : typeof itemPage?.id === "string" ? itemPage.id : null,
    };
  });
}

function normalizeContent(value: string) {
  return value.replace(/\bpage\s+\d+\s+(?:of\s+\d+)?\b/gi, " ").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function classifyPage(page: CourtPacketPage): [CourtPacketDocumentType | null, string[]] {
  const sample = `${page.text}\n${page.markdown}`.slice(0, 8_000);
  const matches = boundaryRules.flatMap(([type, pattern]) => {
    const match = pattern.exec(sample);
    return match ? [{ type, evidence: match[0].replace(/\s+/g, " ").slice(0, 160) }] : [];
  });
  return matches.length ? [matches[0].type, [...new Set(matches.map((match) => match.evidence))]] : [null, []];
}

export function segmentCourtPacketPages(pages: CourtPacketPage[], sourceSha256: string, sourceIdentity = sourceSha256): CourtPacketCandidate[] {
  if (!pages.length) return [];
  const runs: Array<{ type: CourtPacketDocumentType; pages: CourtPacketPage[]; evidence: string[] }> = [];
  let currentType: CourtPacketDocumentType = "unclassified";
  let currentPages: CourtPacketPage[] = [];
  let currentEvidence: string[] = [];
  for (const page of [...pages].sort((a, b) => a.page_number - b.page_number)) {
    const [detectedType, evidence] = classifyPage(page);
    if (detectedType && currentPages.length && detectedType !== currentType) {
      runs.push({ type: currentType, pages: currentPages, evidence: currentEvidence });
      currentPages = [];
      currentEvidence = [];
    }
    if (detectedType && (!currentPages.length || detectedType !== currentType)) currentType = detectedType;
    currentPages.push(page);
    currentEvidence.push(...evidence);
  }
  runs.push({ type: currentType, pages: currentPages, evidence: currentEvidence });
  const candidates = runs.map((run) => {
    const start = run.pages[0].page_number;
    const end = run.pages.at(-1)!.page_number;
    const candidateCode = `DOC-CAND-${sha256(`${sourceSha256}:${start}:${end}`).slice(0, 12).toUpperCase()}`;
    return {
      id: stableUuid("court-packet-boundary", `${sourceIdentity}:${candidateCode}`),
      candidate_id: candidateCode,
      document_type: run.type,
      start_page: start,
      end_page: end,
      page_numbers: run.pages.map((page) => page.page_number),
      source_segment_ids: run.pages.map((page) => page.segment_id),
      boundary_evidence: [...new Set(run.evidence)],
      fingerprint: sha256(normalizeContent(run.pages.map((page) => page.text || page.markdown).join("\n"))),
      review_status: "review_required" as const,
      possible_duplicate_of: [] as string[],
    };
  });
  const byFingerprint = new Map<string, string[]>();
  for (const candidate of candidates) byFingerprint.set(candidate.fingerprint, [...(byFingerprint.get(candidate.fingerprint) ?? []), candidate.id]);
  return candidates.map((candidate) => ({ ...candidate, possible_duplicate_of: (byFingerprint.get(candidate.fingerprint) ?? []).filter((id) => id !== candidate.id) }));
}

export type BuildCourtPacketBundleInput = {
  caseId: string;
  sourceName: string;
  sourceBytes: Uint8Array;
  mediaType?: string;
  objectKey: string;
  capturedAt: string;
  parseResult: unknown;
  tier?: "fast" | "cost_effective" | "agentic" | "agentic_plus";
  parseVersion?: string;
  sdkVersion?: string;
  fileId?: string | null;
  jobId?: string | null;
};

export function llamaParseConfiguration(tier: CourtPacketParseTier = DEFAULT_LLAMAPARSE_TIER, version: string = DEFAULT_LLAMAPARSE_VERSION) {
  return {
    tier,
    version,
    output_options: { markdown: { tables: { output_tables_as_markdown: true } } },
    processing_options: { ocr_parameters: { languages: ["en" as const] } },
    expand: ["text", "markdown", "items"],
  };
}

export function buildCourtPacketBundle(input: BuildCourtPacketBundleInput): CourtPacketBundle {
  const caseId = z.uuid().parse(input.caseId);
  const sourceSha256 = sha256(input.sourceBytes);
  const tier = input.tier ?? DEFAULT_LLAMAPARSE_TIER;
  const parseVersion = input.parseVersion ?? DEFAULT_LLAMAPARSE_VERSION;
  const configurationSha256 = sha256(JSON.stringify(llamaParseConfiguration(tier, parseVersion)));
  const identity = `${caseId}:${sourceSha256}`;
  const pages = pagesFromLlamaParseResult(input.parseResult, input.sourceName, identity);
  const warnings: string[] = [];
  if (!pages.length) warnings.push("parse_returned_no_pages");
  const empty = pages.filter((page) => !(page.text.trim() || page.markdown.trim())).map((page) => page.page_number);
  if (empty.length) warnings.push(`empty_page_output:${empty.join(",")}`);
  if (pages.some((page, index) => page.page_number !== index + 1)) warnings.push("non_contiguous_page_numbers");
  const bundle: CourtPacketBundle = {
    schema_version: COURT_PACKET_SCHEMA_VERSION,
    case_id: caseId,
    source: {
      source_id: stableUuid("court-packet-source", identity),
      intake_id: stableUuid("court-packet-intake", identity),
      lineage_id: stableUuid("court-packet-lineage", identity),
      artifact_id: stableUuid("court-packet-artifact", identity),
      name: path.basename(input.sourceName),
      sha256: sourceSha256,
      byte_length: input.sourceBytes.byteLength,
      media_type: input.mediaType ?? "application/pdf",
      object_key: input.objectKey,
      captured_at: input.capturedAt,
      page_count: pages.length,
      source_family: "search_warrant",
      evidence_lane: "documentary",
    },
    parser: {
      run_id: stableUuid("court-packet-parse-run", `${identity}:${configurationSha256}`),
      provider: "llamaparse",
      sdk_name: LLAMAPARSE_SDK_NAME,
      sdk_version: input.sdkVersion ?? LLAMAPARSE_SDK_VERSION,
      tier,
      parse_version: parseVersion,
      file_id: input.fileId ?? null,
      job_id: input.jobId ?? null,
      configuration_sha256: configurationSha256,
      review_status: "review_required",
    },
    pages,
    segments: segmentCourtPacketPages(pages, sourceSha256, identity),
    warnings,
  };
  return courtPacketBundleSchema.parse(bundle) as CourtPacketBundle;
}
