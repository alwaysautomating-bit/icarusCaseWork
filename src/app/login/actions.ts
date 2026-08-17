"use server";

import type { Provider } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSiteUrl } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const emailSchema = z.email().trim();
const providerSchema = z.enum(["google", "apple"]);

export async function sendMagicLink(formData: FormData) {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) redirect("/login?error=Enter+a+valid+email+address.");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: `${getSiteUrl()}/auth/confirm`, shouldCreateUser: true },
  });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/login?message=Check+your+email+for+the+secure+sign-in+link.");
}

export async function signInWithProvider(formData: FormData) {
  const provider = providerSchema.parse(formData.get("provider")) as Provider;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${getSiteUrl()}/auth/callback` } });
  if (error || !data.url) redirect(`/login?error=${encodeURIComponent(error?.message ?? "Unable to start sign-in.")}`);
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
