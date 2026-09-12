import "server-only";

import { createClient } from "@/lib/supabase/server";

export type CaseMemberDirectoryItem = {
  user_id: string;
  email: string | null;
  role: "owner" | "reviewer" | "researcher" | "viewer";
  created_at: string;
};

export async function listCaseMembers(caseId: string): Promise<CaseMemberDirectoryItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_case_members", { p_case_id: caseId });
  if (error) throw new Error(error.message);
  return (data ?? []).map((member: { user_id: string; email: string | null; membership_role: CaseMemberDirectoryItem["role"]; created_at: string }) => ({
    user_id: member.user_id,
    email: member.email,
    role: member.membership_role,
    created_at: member.created_at,
  }));
}
