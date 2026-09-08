import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import "./research-room.css";

export const metadata: Metadata = { title: "Research Room", description: "Private, invite-only collaborative case research." };

export default async function ResearchRoomLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login?next=/research-room");
  return children;
}
