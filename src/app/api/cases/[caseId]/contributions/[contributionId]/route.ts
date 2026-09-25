import { readCaseContribution } from "@/lib/case-contribution-storage";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ caseId: string; contributionId: string }> }) {
  const { caseId, contributionId } = await context.params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return new Response("Authentication required", { status: 401 });

  // RLS on case_contributions is owner-only, so a non-owner simply gets no row back here.
  const { data, error } = await supabase.from("case_contributions")
    .select("object_key,media_type,original_filename,byte_length")
    .eq("case_id", caseId)
    .eq("id", contributionId)
    .maybeSingle();
  if (error || !data) return new Response("Contribution not found", { status: 404 });

  try {
    const bytes = await readCaseContribution(caseId, data.object_key);
    const encodedName = encodeURIComponent(data.original_filename).replaceAll("'", "%27");
    return new Response(bytes, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
        "Content-Length": String(bytes.byteLength),
        "Content-Type": data.media_type,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Contribution file is unavailable", { status: 404 });
  }
}
