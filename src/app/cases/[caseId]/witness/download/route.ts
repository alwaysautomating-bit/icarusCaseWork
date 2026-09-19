import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase } from "@/lib/case-access";
import { getWitnessTestimony, readDayFile, witnessPlainText, witnessSlug } from "@/lib/witness-testimony";

export const dynamic = "force-dynamic";

const FORMATS = new Set(["txt", "json", "source", "first-pass"]);

export async function GET(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const url = new URL(request.url);
  const day = Number(url.searchParams.get("day"));
  const blockId = url.searchParams.get("block") ?? "";
  const format = url.searchParams.get("format") ?? "";
  if (!FORMATS.has(format)) return new Response("Not found", { status: 404 });
  const actor = await requireCaseActor();
  const currentCase = await getAccessibleCase(actor.id, caseId);
  if (!currentCase) return new Response("Not found", { status: 404 });
  const testimony = await getWitnessTestimony(day, blockId);
  if (!testimony) return new Response("Not found", { status: 404 });
  const { block, turns } = testimony;
  const headers = (type: string, filename: string) => ({ "Content-Type": type, "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store" });

  if (format === "txt") return new Response(witnessPlainText(block, turns), { headers: headers("text/plain; charset=utf-8", `${witnessSlug(block)}.txt`) });
  if (format === "json") {
    const body = { witness: block.witness, trial_day: block.day, block_id: block.blockId, classification: "candidate_structure_only", boundary_confidence: block.confidence, source: block.preservedFilename, start: block.startDisplay, end: block.endDisplay, segments: turns };
    return new Response(`${JSON.stringify(body, null, 2)}\n`, { headers: headers("application/json; charset=utf-8", `${witnessSlug(block)}.json`) });
  }
  const file = await readDayFile(format as "source" | "first-pass", block);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.bytes), { headers: headers(format === "first-pass" ? "application/json; charset=utf-8" : "text/plain; charset=utf-8", file.filename) });
}
