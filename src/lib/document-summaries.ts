import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import LlamaCloud from "@llamaindex/llama-cloud";
import { z } from "zod";
import { DEFAULT_LLAMAPARSE_TIER, DEFAULT_LLAMAPARSE_VERSION, llamaParseConfiguration } from "@/lib/court-packet";

export const documentTypes = ["search-warrant", "other"] as const;
export type DocumentType = (typeof documentTypes)[number];

export const ACCEPTED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".txt", ".docx"] as const;
export const MAX_DOCUMENT_BYTES = 30 * 1024 * 1024;

type SummaryField = { key: string; label: string; kind: "text" | "list" };

const WARRANT_FIELDS: SummaryField[] = [
  { key: "summary", label: "Summary", kind: "text" },
  { key: "court_or_agency", label: "Court or agency", kind: "text" },
  { key: "issued_date", label: "Issued", kind: "text" },
  { key: "issuing_authority", label: "Issuing judge or clerk", kind: "text" },
  { key: "applicant_affiant", label: "Applicant / affiant", kind: "text" },
  { key: "offenses_under_investigation", label: "Offenses under investigation", kind: "list" },
  { key: "places_persons_or_things_to_search", label: "Places, persons, devices or accounts to be searched", kind: "list" },
  { key: "items_to_be_seized", label: "Items to be seized", kind: "list" },
  { key: "probable_cause_summary", label: "Basis stated for probable cause", kind: "text" },
  { key: "time_limits_or_conditions", label: "Time limits or conditions", kind: "text" },
  { key: "execution_or_return", label: "Execution or return, as stated", kind: "text" },
  { key: "attachments_or_exhibits", label: "Attachments or exhibits referenced", kind: "list" },
  { key: "unclear_or_missing", label: "Unclear, unreadable or missing", kind: "list" },
];

const OTHER_FIELDS: SummaryField[] = [
  { key: "summary", label: "Summary", kind: "text" },
  { key: "document_type", label: "Type of document", kind: "text" },
  { key: "document_date", label: "Date on the document", kind: "text" },
  { key: "people_and_organizations", label: "People and organizations named", kind: "list" },
  { key: "key_points", label: "Key points", kind: "list" },
  { key: "unclear_or_missing", label: "Unclear, unreadable or missing", kind: "list" },
];

export const SUMMARY_FIELDS: Record<DocumentType, SummaryField[]> = { "search-warrant": WARRANT_FIELDS, other: OTHER_FIELDS };

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = { "search-warrant": "Search warrant", other: "Other document" };

const SYSTEM_PROMPT = [
  "Summarize this document for a researcher who will check the summary against the original.",
  "Use only what the document states. Do not infer, speculate, or fill gaps from general knowledge.",
  "Use plain language. Keep names, dates, times, addresses and item lists exactly as written.",
  "When a field is absent or unreadable, leave it empty and list it under unclear_or_missing.",
].join(" ");

function dataSchema(type: DocumentType) {
  const fields = SUMMARY_FIELDS[type];
  const properties: Record<string, { type: "string" | "array"; description: string; items?: { type: "string" } }> = {};
  for (const field of fields) {
    properties[field.key] = field.kind === "list"
      ? { type: "array", items: { type: "string" }, description: field.label }
      : { type: "string", description: field.key === "summary" ? "A plain-language summary in 3 to 6 sentences." : field.label };
  }
  return { type: "object", properties, required: ["summary"] };
}

const metaSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(documentTypes),
  extension: z.string(),
  byteLength: z.number(),
  sha256: z.string(),
  uploadedAt: z.string(),
  status: z.enum(["summarized", "failed"]),
  error: z.string().optional(),
  pageCount: z.number().optional(),
});
export type DocumentMeta = z.infer<typeof metaSchema>;

const summarySchema = z.object({ generatedAt: z.string(), extractJobId: z.string(), result: z.record(z.string(), z.unknown()) });
export type DocumentSummary = z.infer<typeof summarySchema>;

function dataRoot() {
  return process.env.ICARUS_DATA_DIR ? path.resolve(process.env.ICARUS_DATA_DIR) : path.join(process.cwd(), ".data");
}

function caseDirectory(caseId: string) {
  return path.join(dataRoot(), "documents", z.uuid().parse(caseId));
}

function documentDirectory(caseId: string, docId: string) {
  if (!/^[a-z0-9-]{8,80}$/.test(docId)) throw new Error("Invalid document id.");
  return path.join(caseDirectory(caseId), docId);
}

function slug(name: string) {
  return path.basename(name, path.extname(name)).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "document";
}

async function writeJson(file: string, value: unknown) {
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

type ParsedPage = { page_number?: number; markdown?: string; text?: string };

async function parseAndSummarize(bytes: Uint8Array, fileName: string, type: DocumentType) {
  const apiKey = process.env.LLAMA_CLOUD_API_KEY ?? process.env.LLAMAPARSE_API_KEY;
  if (!apiKey) throw new Error("A LlamaCloud API key is required (LLAMA_CLOUD_API_KEY or LLAMAPARSE_API_KEY in .env.local).");
  const client = new LlamaCloud({ apiKey });
  const configuration = llamaParseConfiguration(DEFAULT_LLAMAPARSE_TIER, process.env.LLAMAPARSE_VERSION ?? DEFAULT_LLAMAPARSE_VERSION);
  const uploaded = await client.files.create({ file: new File([new Uint8Array(bytes)], fileName), purpose: "parse" });
  const parsed = await client.parsing.parse({
    file_id: uploaded.id,
    tier: configuration.tier,
    version: configuration.version,
    output_options: configuration.output_options,
    processing_options: configuration.processing_options,
    expand: [...configuration.expand],
  });
  const pages = ((parsed as unknown as { markdown?: { pages?: ParsedPage[] } }).markdown?.pages ?? []);
  const markdown = pages.map((page, index) => `## Page ${page.page_number ?? index + 1}\n\n${page.markdown ?? page.text ?? ""}`).join("\n\n---\n\n");
  const job = await client.extract.run({
    file_input: parsed.job.id,
    configuration: { data_schema: dataSchema(type), tier: "agentic", system_prompt: SYSTEM_PROMPT },
  });
  const result = Array.isArray(job.extract_result) ? job.extract_result[0] : job.extract_result;
  if (!result) throw new Error("The extraction finished without a summary.");
  return { markdown, pageCount: pages.length, extractJobId: job.id, result: result as Record<string, unknown> };
}

export async function saveAndSummarizeDocument(input: { caseId: string; file: File; type: DocumentType }): Promise<DocumentMeta> {
  const extension = path.extname(input.file.name).toLowerCase();
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const now = new Date();
  const id = `${now.toISOString().slice(0, 19).replace(/[-:T]/g, "")}-${slug(input.file.name)}-${randomBytes(2).toString("hex")}`;
  const directory = documentDirectory(input.caseId, id);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, `original${extension}`), bytes);

  const base = {
    id,
    name: path.basename(input.file.name),
    type: input.type,
    extension,
    byteLength: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    uploadedAt: now.toISOString(),
  };
  try {
    const output = await parseAndSummarize(bytes, base.name, input.type);
    await fs.writeFile(path.join(directory, "parsed.md"), output.markdown, "utf8");
    await writeJson(path.join(directory, "summary.json"), { generatedAt: new Date().toISOString(), extractJobId: output.extractJobId, result: output.result } satisfies DocumentSummary);
    const meta: DocumentMeta = { ...base, status: "summarized", pageCount: output.pageCount };
    await writeJson(path.join(directory, "meta.json"), meta);
    return meta;
  } catch (error) {
    const meta: DocumentMeta = { ...base, status: "failed", error: error instanceof Error ? error.message.slice(0, 400) : "The document could not be summarized." };
    await writeJson(path.join(directory, "meta.json"), meta);
    return meta;
  }
}

export async function listDocuments(caseId: string): Promise<DocumentMeta[]> {
  const directory = caseDirectory(caseId);
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
  const metas = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
    try {
      return metaSchema.parse(JSON.parse(await fs.readFile(path.join(directory, entry.name, "meta.json"), "utf8")));
    } catch {
      return null;
    }
  }));
  return metas.filter((meta): meta is DocumentMeta => meta !== null).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function getDocument(caseId: string, docId: string) {
  try {
    const directory = documentDirectory(caseId, docId);
    const meta = metaSchema.parse(JSON.parse(await fs.readFile(path.join(directory, "meta.json"), "utf8")));
    const summary = await fs.readFile(path.join(directory, "summary.json"), "utf8").then((raw) => summarySchema.parse(JSON.parse(raw))).catch(() => null);
    return { meta, summary };
  } catch {
    return null;
  }
}

export async function readDocumentFile(caseId: string, docId: string, which: "original" | "parsed") {
  const found = await getDocument(caseId, docId);
  if (!found) return null;
  const directory = documentDirectory(caseId, docId);
  const fileName = which === "parsed" ? "parsed.md" : `original${found.meta.extension}`;
  const bytes = await fs.readFile(path.join(directory, fileName)).catch(() => null);
  return bytes ? { bytes, fileName: which === "parsed" ? `${path.basename(found.meta.name, found.meta.extension)}.parsed.md` : found.meta.name, extension: which === "parsed" ? ".md" : found.meta.extension } : null;
}
