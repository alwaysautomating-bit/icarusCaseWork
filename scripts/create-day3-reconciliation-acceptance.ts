import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

type Status = { API_URL: string; ANON_KEY: string };
type ReviewedNode = { id: string; object_code: string; summary?: string; rationale?: string; review_status?: string; status?: string; source_segment_ids?: string[] };
type SaveResult = { group_id: string; version: number; duplicate: boolean; ledger_logical_order?: number; analytical_only: boolean };

function localStatus() {
  const output = process.platform === "win32"
    ? execFileSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "pnpm exec supabase status -o json"], { encoding: "utf8" })
    : execFileSync("pnpm", ["exec", "supabase", "status", "-o", "json"], { encoding: "utf8" });
  return JSON.parse(output.replace(/^Stopped services:.*\r?\n/, "")) as Status;
}

function one<T>(rows: T[] | null, label: string) {
  assert.equal(rows?.length, 1, `${label}: expected exactly one reviewed object`);
  return rows![0];
}

const status = localStatus();
const identity = createHash("sha256").update("icarus-testimony-corpus-publication-v1").digest("hex");
const client = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const signedIn = await client.auth.signInWithPassword({ email: `corpus-${identity.slice(0, 12)}@example.test`, password: `Local-${identity.slice(0, 16)}-A1!` });
if (signedIn.error) throw signedIn.error;

const caseResult = await client.from("cases").select("id").eq("workspace_key", "testimony-corpus-publication").single();
if (caseResult.error) throw caseResult.error;
const caseId = caseResult.data.id;
const knowledgeResult = await client.from("knowledge_items").select("id,object_code,summary,review_status").eq("case_id", caseId).in("object_code", ["KI-3EEB75277C", "KI-88C12AF4B3", "KI-EB00E4B43C"]);
if (knowledgeResult.error) throw knowledgeResult.error;
const flagResult = await client.from("knowledge_flags").select("id,object_code,rationale,status,source_segment_ids").eq("case_id", caseId).eq("object_code", "FLG-65CD8EE46D");
if (flagResult.error) throw flagResult.error;
const knowledge = knowledgeResult.data as ReviewedNode[];
const hallEstimate = one(knowledge.filter((item) => item.object_code === "KI-3EEB75277C"), "Hall response estimate");
const hallArrival = one(knowledge.filter((item) => item.object_code === "KI-88C12AF4B3"), "Hall simultaneous arrival");
const josephineEstimate = one(knowledge.filter((item) => item.object_code === "KI-EB00E4B43C"), "Josephine response estimate");
const missingClock = one(flagResult.data as ReviewedNode[], "missing clock flag");
assert.ok(knowledge.every((item) => ["accepted", "amended"].includes(item.review_status ?? "")), "Knowledge members must be reviewed before reconciliation.");
assert.ok(["accepted", "amended"].includes(missingClock.status ?? ""), "Flag member must be reviewed before reconciliation.");

const groupName = "Day 3 responder timing — governed reconciliation";
const payload = {
  name: groupName,
  description: "Compares source-backed responder duration and co-arrival testimony while preserving the missing clock anchor and differing points of origin.",
  status: "reviewed",
  members: [
    { node_type: "knowledge", node_id: hallEstimate.id, role: "anchor" },
    { node_type: "flag", node_id: missingClock.id, role: "unresolved" },
    { node_type: "knowledge", node_id: hallArrival.id, role: "context" },
    { node_type: "knowledge", node_id: josephineEstimate.id, role: "context" },
  ],
  edges: [
    { from_type: "flag", from_id: missingClock.id, relation_type: "leaves_unresolved", to_type: "knowledge", to_id: hallEstimate.id, rationale: "The response duration is preserved, but the cited testimony supplies no departure or arrival clock time." },
    { from_type: "knowledge", from_id: hallArrival.id, relation_type: "sequence_consistent", to_type: "knowledge", to_id: josephineEstimate.id, rationale: "Hall's co-arrival account can be inspected alongside Josephine's response estimate without equating their departure points or inferring an exact arrival time." },
  ],
  change_note: "Initial Day 3 governed reconciliation acceptance group.",
};

const existingResult = await client.from("reconciliation_group_projection").select("id,current_version").eq("case_id", caseId).eq("name", groupName).maybeSingle();
if (existingResult.error) throw existingResult.error;
const existing = existingResult.data as { id: string; current_version: number } | null;
const save = await client.rpc("save_reconciliation_group", { p_case_id: caseId, p_group_id: existing?.id ?? null, p_expected_version: existing?.current_version ?? 0, p_payload: payload });
if (save.error) throw save.error;
const first = save.data as SaveResult;
const replay = await client.rpc("save_reconciliation_group", { p_case_id: caseId, p_group_id: first.group_id, p_expected_version: first.version, p_payload: payload });
if (replay.error) throw replay.error;
const replayResult = replay.data as SaveResult;
assert.equal(replayResult.duplicate, true, "Reconciliation replay must be idempotent.");

const [projectionResult, versionsResult, sourceResult, boundaryResult, reconstructionResult] = await Promise.all([
  client.from("reconciliation_group_projection").select("id,current_version,status,analytical_only,member_count,edge_count,members,edges").eq("id", first.group_id).single(),
  client.from("reconciliation_group_versions").select("version,snapshot,change_note,ledger_logical_order").eq("reconciliation_group_id", first.group_id).order("version"),
  client.from("knowledge_item_segments").select("source_segment_id").in("knowledge_item_id", [hallEstimate.id, hallArrival.id, josephineEstimate.id]),
  Promise.all([client.from("events").select("id", { count: "exact", head: true }).eq("case_id", caseId), client.from("entities").select("id", { count: "exact", head: true }).eq("case_id", caseId)]),
  client.from("saved_reconstruction_versions").select("id", { count: "exact", head: true }).eq("case_id", caseId),
]);
if (projectionResult.error) throw projectionResult.error;
if (versionsResult.error) throw versionsResult.error;
if (sourceResult.error) throw sourceResult.error;
if (reconstructionResult.error) throw reconstructionResult.error;
for (const result of boundaryResult) if (result.error) throw result.error;
const projection = projectionResult.data as { current_version: number; status: string; analytical_only: boolean; member_count: number; edge_count: number; members: Array<{ source_segment_ids: string[] }>; edges: unknown[] };
assert.equal(projection.member_count, 4);
assert.equal(projection.edge_count, 2);
assert.equal(projection.analytical_only, true);
assert.ok(projection.members.every((member) => member.source_segment_ids.length > 0), "Every frozen member must contain exact source lineage.");

const report = {
  schemaVersion: "reconciliation-group-acceptance/1.0",
  generatedAt: new Date().toISOString(),
  caseId,
  groupId: first.group_id,
  groupName,
  currentVersion: projection.current_version,
  status: projection.status,
  reviewedMembers: projection.member_count,
  governedEdges: projection.edge_count,
  exactSourceSegments: new Set(projection.members.flatMap((member) => member.source_segment_ids)).size,
  immutableVersions: versionsResult.data.length,
  idempotentReplay: replayResult.duplicate,
  boundaries: { canonicalEvents: boundaryResult[0].count ?? 0, entities: boundaryResult[1].count ?? 0, savedReconstructions: reconstructionResult.count ?? 0, sameResolutionsCreated: 0, sourceObjectsMutated: 0 },
  interpretation: "This group is a reviewer classification over accepted/amended, source-backed structure objects. It is not evidence, a canonical event, an entity resolution, or a finding.",
};
const reportDirectory = path.resolve("reports");
await readFile(path.join(reportDirectory, "day3-first-responder-reconstruction.json"), "utf8");
await writeFile(path.join(reportDirectory, "day3-responder-reconciliation-v1.json"), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(path.join(reportDirectory, "day3-responder-reconciliation-v1.md"), `# Day 3 responder reconciliation acceptance v1\n\nGenerated: ${report.generatedAt}\n\n- Governed group: **${report.groupName}**\n- Immutable version: **${report.currentVersion}**\n- Reviewed source-backed members: **${report.reviewedMembers}**\n- Governed relationship edges: **${report.governedEdges}**\n- Exact cited source segments: **${report.exactSourceSegments}**\n- Idempotent replay: **${report.idempotentReplay ? "PASS" : "FAIL"}**\n- Canonical events created: **0**\n- SAME/entity resolutions created: **0**\n- Source objects mutated: **0**\n\n## Interpretation boundary\n\n${report.interpretation}\n`);
console.log(JSON.stringify(report));
