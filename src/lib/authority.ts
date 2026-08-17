import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CaseActor = { id: string; name: string; email: string; role: "owner" };

export async function requireCaseActor(): Promise<CaseActor> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");

  const email = data.user.email ?? "Authenticated researcher";
  return {
    id: data.user.id,
    name: data.user.user_metadata.full_name ?? data.user.user_metadata.name ?? email,
    email,
    role: "owner",
  };
}
