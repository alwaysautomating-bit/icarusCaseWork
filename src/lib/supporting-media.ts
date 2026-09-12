import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type SupportingMediaFolder = {
  id: string;
  case_id: string;
  name: string;
  created_at: string;
};

export type SupportingMediaItem = {
  id: string;
  case_id: string;
  folder_id: string | null;
  original_filename: string;
  media_type: string;
  byte_length: number;
  sha256: string;
  caption: string;
  context_note: string;
  record_role: "supporting_reference";
  is_canonical: false;
  uploaded_by_user_id: string;
  created_at: string;
};

function rowsOrThrow<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("Supabase returned no data.");
  return result.data;
}

export async function getSupportingMediaLibrary(caseId: string) {
  const supabase = await createClient();
  const [foldersResult, itemsResult] = await Promise.all([
    supabase.from("supporting_media_folders").select("id,case_id,name,created_at").eq("case_id", caseId).order("name"),
    supabase.from("supporting_media_items").select("id,case_id,folder_id,original_filename,media_type,byte_length,sha256,caption,context_note,record_role,is_canonical,uploaded_by_user_id,created_at").eq("case_id", caseId).order("created_at", { ascending: false }),
  ]);
  return {
    folders: rowsOrThrow(foldersResult) as SupportingMediaFolder[],
    items: rowsOrThrow(itemsResult) as SupportingMediaItem[],
  };
}
