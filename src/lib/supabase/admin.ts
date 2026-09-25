import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const adminEnvSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
});

/**
 * Service-role client for the small set of server-only flows that must act before a user
 * session exists (e.g. verifying an anonymous case-contribution password). Never expose this
 * client, or the key it wraps, to a Client Component or route handler response.
 */
export function createAdminClient() {
  const env = adminEnvSchema.parse({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });
  return createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
