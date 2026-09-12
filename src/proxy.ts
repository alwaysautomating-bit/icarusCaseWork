import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getDeploymentSlice } from "@/lib/deployment-slice";
import { updateSession } from "@/lib/supabase/proxy";

const PUBLIC_PATHS = new Set(["/", "/join", "/success"]);

export function isPublicResearchPath(pathname: string) {
  return PUBLIC_PATHS.has(pathname);
}

const PILOT_CASE_ROUTES = new Set(["trial-index", "record", "files", "questions", "evidence", "access", "setup"]);

export function pilotCaseRedirectPath(pathname: string) {
  const match = /^\/cases\/([^/]+)\/([^/]+)/.exec(pathname);
  if (!match || match[1] === "new" || PILOT_CASE_ROUTES.has(match[2])) return null;
  return `/cases/${match[1]}/trial-index`;
}

export async function proxy(request: NextRequest) {
  if (getDeploymentSlice() === "research_pilot") {
    const redirectPath = pilotCaseRedirectPath(request.nextUrl.pathname);
    if (redirectPath) return NextResponse.redirect(new URL(redirectPath, request.url));
  }
  if (isPublicResearchPath(request.nextUrl.pathname) || request.nextUrl.pathname === "/lite" || request.nextUrl.pathname.startsWith("/lite/")) {
    return NextResponse.next({ request });
  }
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
