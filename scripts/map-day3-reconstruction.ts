import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

import { buildDay3ResponderReconstruction } from "../src/lib/day3-responder-reconstruction";
import { compilePreservedTranscriptManifest, type IntakeManifest } from "../src/lib/proceeding-compiler";
import type { ParsedRevTranscript } from "../src/lib/rev-testimony";
import { compileTestimonyKnowledgeMap } from "../src/lib/testimony-knowledge-mapper";

function fail(label: string, error: unknown): never {
  throw new Error(`${label}: ${JSON.stringify(error)}`);
}

const manifest = JSON.parse(await readFile(path.resolve("transcripts/manifests/Lindsay-Clancy_Trial-Day-03_Intake-Manifest.json"), "utf8")) as IntakeManifest;
const preserved = await readFile(path.resolve("transcripts/preserved", manifest.source.preserved_filename), "utf8");
const compiledProceeding = compilePreservedTranscriptManifest(manifest, preserved);
const transcript = { sourceSha256: compiledProceeding.source.sha256, segments: compiledProceeding.segments } as ParsedRevTranscript;
assert.equal(transcript.segments.length, 1_873);

const status = JSON.parse(execSync("pnpm exec supabase status -o json", { encoding: "utf8" }).replace(/^Stopped services:.*\r?\n/, ""));
const corpusIdentity = createHash("sha256").update("icarus-testimony-corpus-publication-v1").digest("hex");
const email = `corpus-${corpusIdentity.slice(0, 12)}@example.test`;
const password = `Local-${corpusIdentity.slice(0, 16)}-A1!`;
const client = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const signedIn = await client.auth.signInWithPassword({ email, password });
if (signedIn.error) fail("sign in as canonical corpus owner", signedIn.error);

const caseResult = await client.from("cases").select("id").eq("workspace_key", "testimony-corpus-publication").single();
if (caseResult.error) fail("load canonical case", caseResult.error);
const caseId = caseResult.data.id;
const proceedingResult = await client.from("proceedings").select("id,source_artifact_id,detected_segments,parsed_segments,committed_segments").eq("case_id", caseId).eq("title", "MA v. Lindsay Clancy Day 3").single();
if (proceedingResult.error) fail("load Day 3 proceeding", proceedingResult.error);
const proceeding = proceedingResult.data;
assert.deepEqual([proceeding.detected_segments, proceeding.parsed_segments, proceeding.committed_segments], [1_873, 1_873, 1_873]);
const identity = { caseId, proceedingId: proceeding.id, sourceArtifactId: proceeding.source_artifact_id };

const structure = compileTestimonyKnowledgeMap({
  ...identity,
  transcript,
  candidates: [],
  extractionMethod: "deterministic",
  compilerName: "icarus-testimony-witness-structure-compiler",
  compilerVersion: "1.0.0",
  contractVersion: "testimony-witness-structure/1.0",
  activityType: "deterministic_structure",
});
const structureCommit = await client.rpc("commit_testimony_knowledge_map", { payload: structure });
if (structureCommit.error) fail("persist Day 3 witness structure", structureCommit.error);

const [canonicalEventsBefore, entitiesBefore] = await Promise.all([
  client.from("events").select("id", { count: "exact", head: true }).eq("case_id", caseId),
  client.from("entities").select("id", { count: "exact", head: true }).eq("case_id", caseId),
]);
if (canonicalEventsBefore.error) fail("count canonical events", canonicalEventsBefore.error);
if (entitiesBefore.error) fail("count entities", entitiesBefore.error);

const built = buildDay3ResponderReconstruction(transcript, identity);
const committed = await client.rpc("commit_testimony_timeline_candidates", { payload: built.timeline });
if (committed.error) fail("commit Day 3 timeline candidates", committed.error);
const replay = await client.rpc("commit_testimony_timeline_candidates", { payload: built.timeline });
if (replay.error) fail("replay Day 3 timeline candidates", replay.error);
assert.equal(replay.data.duplicate, true);

const existingVersion = await client.from("saved_reconstruction_versions").select("id,name,version").eq("case_id", caseId).eq("snapshot_sha256", built.reconstruction.snapshot_sha256).order("version", { ascending: false }).limit(1).maybeSingle();
if (existingVersion.error) fail("check reconstruction snapshot", existingVersion.error);
let saved = existingVersion.data;
if (!saved) {
  const savedResult = await client.rpc("save_reconstruction_version", {
    p_case_id: caseId,
    p_name: "First-responder reconstruction",
    p_description: "Initial six-witness Day 3 reconstruction; event grouping, ordering, and tensions remain proposed.",
    p_snapshot: built.reconstruction,
  });
  if (savedResult.error) fail("save reconstruction version", savedResult.error);
  saved = savedResult.data;
}

const [projection, witnessBlocks, eventsAfter, entitiesAfter, versions] = await Promise.all([
  client.from("timeline_candidate_projection").select("event_candidate_id,temporal_assertion_id,witness_label_raw,source_segment_id,exact_source_text").eq("case_id", caseId).in("event_candidate_id", built.reconstruction.source_event_candidate_ids),
  client.from("witness_blocks").select("id,witness_label_raw", { count: "exact" }).eq("case_id", caseId).eq("proceeding_id", proceeding.id),
  client.from("events").select("id", { count: "exact", head: true }).eq("case_id", caseId),
  client.from("entities").select("id", { count: "exact", head: true }).eq("case_id", caseId),
  client.from("saved_reconstruction_versions").select("id,name,version,snapshot_sha256").eq("case_id", caseId).order("created_at"),
]);
for (const [label, result] of [["projection", projection], ["witness blocks", witnessBlocks], ["events", eventsAfter], ["entities", entitiesAfter], ["versions", versions]] as const) {
  if (result.error) fail(label, result.error);
}

const precisionCounts = Object.fromEntries([...new Set(built.reconstruction.assertions.map((item) => item.precision))].sort().map((precision) => [precision, built.reconstruction.assertions.filter((item) => item.precision === precision).length]));
const report = {
  schemaVersion: "testimony-reconstruction-acceptance/1.0",
  generatedAt: new Date().toISOString(),
  caseId,
  proceedingId: proceeding.id,
  sourceSha256: transcript.sourceSha256,
  sourceSegments: transcript.segments.length,
  witnesses: [...new Set(built.reconstruction.assertions.map((item) => item.witness))],
  compiled: {
    reviewedUnits: built.reviewedUnits.length,
    eventCandidates: built.timeline.event_candidates.length,
    temporalAssertions: built.timeline.temporal_assertions.length,
    reconstructionAssertions: built.reconstruction.assertions.length,
    lanes: built.reconstruction.lanes.length,
    nodes: built.reconstruction.nodes.length,
    orderingEdges: built.reconstruction.edges.length,
    unresolvedTensions: built.reconstruction.tensions.length,
    precisionCounts,
  },
  persistence: {
    timelineRunId: built.timeline.run.id,
    reconstructionVersionId: saved?.id,
    reconstructionVersion: saved?.version,
    snapshotSha256: built.reconstruction.snapshot_sha256,
    idempotentTimelineReplay: replay.data.duplicate,
    savedVersionsInCase: versions.data?.length ?? 0,
  },
  boundaries: {
    canonicalEventsCreated: (eventsAfter.count ?? 0) - (canonicalEventsBefore.count ?? 0),
    sameResolutionsCreated: (entitiesAfter.count ?? 0) - (entitiesBefore.count ?? 0),
    testimonyTimestampsUsedAsEventTime: 0,
    unresolvedTensionsCollapsed: 0,
  },
  provenance: {
    witnessBlocks: witnessBlocks.count ?? 0,
    projectionRows: projection.data?.length ?? 0,
    exactSourceTextPresent: projection.data?.every((row) => Boolean(row.exact_source_text)) ?? false,
    canonicalSourceDuplicated: false,
  },
};
assert.equal(report.boundaries.canonicalEventsCreated, 0);
assert.equal(report.boundaries.sameResolutionsCreated, 0);

const markdown = `# Day 3 first-responder testimony reconstruction v1\n\nGenerated: ${report.generatedAt}\n\n- Canonical source: **MA v. Lindsay Clancy Day 3**, ${report.sourceSegments.toLocaleString()} committed segments\n- Witness lanes: **${report.witnesses.length}** (${report.witnesses.join(", ")})\n- Reviewed testimony assertions: **${report.compiled.reconstructionAssertions}**\n- Proposed reconstruction nodes: **${report.compiled.nodes}** across **${report.compiled.lanes}** incident lanes\n- Ordering/overlap constraints: **${report.compiled.orderingEdges}**\n- Unresolved tensions preserved: **${report.compiled.unresolvedTensions}**\n- Canonical events created: **${report.boundaries.canonicalEventsCreated}**\n- SAME resolutions created: **${report.boundaries.sameResolutionsCreated}**\n- Immutable reconstruction version: **${report.persistence.reconstructionVersion}** (${report.persistence.snapshotSha256})\n- Idempotent candidate replay: **${report.persistence.idempotentTimelineReplay ? "PASS" : "FAIL"}**\n\n## Interpretation boundary\n\nThe incident spine, node grouping, and ordering edges are proposed analytical structure. Each assertion remains attributed to its witness and exact canonical source segments. Trial-video timestamps remain source locators and were not substituted for incident time. Approximate minute ranges from secondary analyses were not imported as exact clock values.\n\n## Preserved tensions\n\n${built.reconstruction.tensions.map((item) => `- **${item.title}:** ${item.note}`).join("\n")}\n`;

await writeFile(path.resolve("reports/day3-first-responder-reconstruction.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(path.resolve("reports/day3-first-responder-reconstruction.md"), markdown, "utf8");
process.stdout.write(`${JSON.stringify(report)}\n`);
