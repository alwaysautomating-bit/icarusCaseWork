import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase } from "@/lib/case-access";
import { readDocumentFile } from "@/lib/document-summaries";

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function GET(_request: Request, { params }: { params: Promise<{ caseId: string; docId: string; file: string }> }) {
  const { caseId, docId, file } = await params;
  if (file !== "original" && file !== "parsed") return new Response("Not found", { status: 404 });
  const actor = await requireCaseActor();
  const currentCase = await getAccessibleCase(actor.id, caseId);
  if (!currentCase) return new Response("Not found", { status: 404 });
  const found = await readDocumentFile(caseId, docId, file);
  if (!found) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(found.bytes), {
    headers: {
      "Content-Type": CONTENT_TYPES[found.extension] ?? "application/octet-stream",
      "Content-Disposition": `${file === "original" && found.extension !== ".docx" ? "inline" : "attachment"}; filename="${encodeURIComponent(found.fileName)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
