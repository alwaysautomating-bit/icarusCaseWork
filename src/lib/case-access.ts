import "server-only";

import { cache } from "react";
import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const caseIdSchema = z.uuid();

function rowsOrThrow<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("Supabase returned no data.");
  return result.data;
}

export type AccessibleCase = {
  id: string;
  title: string;
  workspace_key: string;
  purpose: string;
  public_record_cutoff: string;
  incident_at: string | null;
  incident_window_start: string | null;
  incident_window_end: string | null;
  created_at: string;
  membershipRole: string;
};

export async function listAccessibleCases(actorId: string): Promise<AccessibleCase[]> {
  const supabase = await createClient();
  const [casesResult, membershipsResult] = await Promise.all([
    supabase.from("cases").select("id,title,workspace_key,purpose,public_record_cutoff,incident_at,incident_window_start,incident_window_end,created_at").order("created_at", { ascending: false }),
    supabase.from("case_members").select("case_id,role").eq("user_id", actorId),
  ]);
  const memberships = rowsOrThrow(membershipsResult) as Array<{ case_id: string; role: string }>;
  const roleByCase = new Map(memberships.map((item) => [item.case_id, item.role]));
  return (rowsOrThrow(casesResult) as Array<Omit<AccessibleCase, "membershipRole">>)
    .map((item) => ({ ...item, membershipRole: roleByCase.get(item.id) ?? "member" }));
}

export const getAccessibleCase = cache(async (actorId: string, rawCaseId: string): Promise<AccessibleCase | null> => {
  const parsed = caseIdSchema.safeParse(rawCaseId);
  if (!parsed.success) return null;
  const supabase = await createClient();
  const [caseResult, membershipResult] = await Promise.all([
    supabase.from("cases").select("id,title,workspace_key,purpose,public_record_cutoff,incident_at,incident_window_start,incident_window_end,created_at").eq("id", parsed.data).maybeSingle(),
    supabase.from("case_members").select("role").eq("case_id", parsed.data).eq("user_id", actorId).maybeSingle(),
  ]);
  if (caseResult.error) throw new Error(caseResult.error.message);
  if (membershipResult.error) throw new Error(membershipResult.error.message);
  if (!caseResult.data || !membershipResult.data) return null;
  return { ...(caseResult.data as Omit<AccessibleCase, "membershipRole">), membershipRole: membershipResult.data.role as string };
});

export function parseCaseId(value: string) {
  return caseIdSchema.safeParse(value);
}
