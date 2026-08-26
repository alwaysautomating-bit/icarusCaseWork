import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase } from "@/lib/case-access";
import { referenceReportById } from "@/lib/reference-reports";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ caseId: string; reportId: string }> }) {
  const actor = await requireCaseActor();
  const { caseId, reportId } = await params;
  const [currentCase, report] = await Promise.all([
    getAccessibleCase(actor.id, caseId),
    Promise.resolve(referenceReportById(reportId)),
  ]);
  if (!currentCase || !report) return new Response("Report not found.", { status: 404 });

  const bytes = await readFile(join(process.cwd(), "reference-reports", report.fileName));
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${report.fileName}"`,
      "Content-Length": String(bytes.byteLength),
      "Content-Type": report.contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
