import { readSupportingImage } from "@/lib/supporting-media-storage";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ caseId: string; mediaId: string }> }) {
  const { caseId, mediaId } = await context.params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return new Response("Authentication required", { status: 401 });

  const { data, error } = await supabase.from("supporting_media_items")
    .select("object_key,media_type,original_filename,byte_length")
    .eq("case_id", caseId)
    .eq("id", mediaId)
    .maybeSingle();
  if (error || !data) return new Response("Image not found", { status: 404 });

  try {
    const bytes = await readSupportingImage(caseId, data.object_key);
    const encodedName = encodeURIComponent(data.original_filename).replaceAll("'", "%27");
    return new Response(bytes, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename*=UTF-8''${encodedName}`,
        "Content-Length": String(bytes.byteLength),
        "Content-Type": data.media_type,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Image file is unavailable", { status: 404 });
  }
}
