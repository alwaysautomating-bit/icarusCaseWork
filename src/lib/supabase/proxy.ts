import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";
import { getLocalAuthBypassCredentials } from "@/lib/supabase/local-auth";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = getPublicSupabaseEnv();
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    const localCredentials = getLocalAuthBypassCredentials();
    if (localCredentials) {
      const { error } = await supabase.auth.signInWithPassword(localCredentials);
      if (error) throw new Error(`Local auth bypass failed: ${error.message}`);

      const authenticatedResponse = NextResponse.redirect(request.nextUrl, 303);
      response.cookies.getAll().forEach((cookie) => authenticatedResponse.cookies.set(cookie));
      return authenticatedResponse;
    }
  }
  return response;
}
