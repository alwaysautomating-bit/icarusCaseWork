import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

const PUBLIC_PATHS = new Set(["/"]);

export function isPublicResearchPath(pathname: string) {
  return PUBLIC_PATHS.has(pathname);
}

export async function proxy(request: NextRequest) {
  if (isPublicResearchPath(request.nextUrl.pathname) || request.nextUrl.pathname === "/lite" || request.nextUrl.pathname.startsWith("/lite/")) {
    return NextResponse.next({ request });
  }
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
