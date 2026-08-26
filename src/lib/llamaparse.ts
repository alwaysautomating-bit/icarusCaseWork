import LlamaCloud from "@llamaindex/llama-cloud";
import {
  DEFAULT_LLAMAPARSE_TIER,
  DEFAULT_LLAMAPARSE_VERSION,
  llamaParseConfiguration,
  type CourtPacketParseTier,
} from "@/lib/court-packet";

export type LlamaParseTier = CourtPacketParseTier;

export async function parseWithLlamaParse(input: {
  bytes: Uint8Array;
  fileName: string;
  tier?: LlamaParseTier;
  version?: string;
}) {
  const apiKey = process.env.LLAMA_CLOUD_API_KEY;
  if (!apiKey) throw new Error("LLAMA_CLOUD_API_KEY is required for a live LlamaParse run.");
  const tier = input.tier ?? DEFAULT_LLAMAPARSE_TIER;
  const version = input.version ?? process.env.LLAMAPARSE_VERSION ?? DEFAULT_LLAMAPARSE_VERSION;
  const configuration = llamaParseConfiguration(tier, version);
  const client = new LlamaCloud({ apiKey });
  const file = new File([new Uint8Array(input.bytes)], input.fileName);
  const uploaded = await client.files.create({ file, purpose: "parse" });
  const result = await client.parsing.parse({
    file_id: uploaded.id,
    tier: configuration.tier,
    version: configuration.version,
    output_options: configuration.output_options,
    processing_options: configuration.processing_options,
    expand: [...configuration.expand],
  });
  return { result, fileId: uploaded.id, jobId: result.job.id, tier, version };
}
