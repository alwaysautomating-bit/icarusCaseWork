import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";
import type { CaseActor } from "@/lib/authority";
import { createClient } from "@/lib/supabase/server";

function rowsOrThrow<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("Supabase returned no data.");
  return result.data;
}

const searchInput = z.object({
  caseId: z.uuid(),
  query: z.string().trim().min(2).max(500),
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
  contextSize: z.number().int().min(0).max(10).default(3),
});

export type SearchableCase = {
  id: string;
  title: string;
  workspace_key: string;
};

export type TestimonySearchContext = {
  source_segment_id: string;
  ordinal: number;
  speaker: string;
  timestamp_start_ms: number | null;
  exact_text: string;
  locator: Record<string, unknown>;
  deep_link: string | null;
};

export type TestimonySearchResult = {
  source_segment_id: string;
  case_id: string;
  proceeding_id: string | null;
  proceeding_title: string;
  proceeding_date: string | null;
  speaker: string;
  timestamp_start_ms: number | null;
  timestamp_end_ms: number | null;
  exact_text: string;
  snippet: string;
  match_method: "fts" | "trigram" | "fts+trigram";
  relevance: number;
  fts_relevance: number;
  trigram_relevance: number;
  ordinal: number;
  locator: Record<string, unknown>;
  artifact_id: string;
  artifact_title: string;
  source_url: string | null;
  canonical_url: string | null;
  deep_link: string | null;
  context_before: TestimonySearchContext[];
  context_after: TestimonySearchContext[];
};

export async function getSearchableCases(actor: CaseActor): Promise<SearchableCase[]> {
  void actor;
  const supabase = await createClient();
  return rowsOrThrow(
    await supabase.from("cases").select("id,title,workspace_key").order("created_at"),
  ) as SearchableCase[];
}

export async function searchTestimony(
  actor: CaseActor,
  caseId: string,
  query: string,
  options: { limit?: number; offset?: number; contextSize?: number } = {},
): Promise<TestimonySearchResult[]> {
  void actor;
  const input = searchInput.parse({
    caseId,
    query,
    limit: options.limit ?? 25,
    offset: options.offset ?? 0,
    contextSize: options.contextSize ?? 3,
  });
  const supabase = await createClient();

  // This lookup and the RPC both run with the signed-in user's session. RLS is
  // the authorization boundary; no service-role client is used for search.
  rowsOrThrow(await supabase.from("cases").select("id").eq("id", input.caseId).single());

  return rowsOrThrow(
    await supabase.rpc("search_testimony", {
      p_case_id: input.caseId,
      p_search_text: input.query,
      p_result_limit: input.limit,
      p_result_offset: input.offset,
      p_context_size: input.contextSize,
    }),
  ) as TestimonySearchResult[];
}
