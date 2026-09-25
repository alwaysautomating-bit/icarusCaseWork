import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

import { buildDay3TemporalContext } from "../src/lib/day3-temporal-context-acceptance";
import { loadDay3Transcript } from "../src/lib/day3-transcript-loader";
import { buildTemporalContextPayload } from "../src/lib/temporal-context";
import { compileTestimonyKnowledgeMap } from "../src/lib/testimony-knowledge-mapper";

function fail(label: string, error: unknown): never {
  throw new Error(`${label}: ${JSON.stringify(error)}`);
}

const { transcript } = await loadDay3Transcript();
assert.equal(transcript.segments.length, 1_873);

const status = JSON.parse(execSync("pnpm exec supabase status -o json", { encoding: "utf8" }).replace(/^Stopped services:.*\r?\n/, ""));
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const corpusIdentity = createHash("sha256").update("icarus-testimony-corpus-publication-v1").digest("hex");
const client = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const signedIn = await client.auth.signInWithPassword({ email: `corpus-${corpusIdentity.slice(0, 12)}@example.test`, password: `Local-${corpusIdentity.slice(0, 16)}-A1!` });
if (signedIn.error) fail("sign in as canonical corpus owner", signedIn.error);

const caseResult = await client.from("cases").select("id").eq("workspace_key", "testimony-corpus-publication").single();
if (caseResult.error) fail("load canonical case", caseResult.error);
const caseId = caseResult.data.id as string;
const proceedingResult = await client.from("proceedings").select("id,source_artifact_id,detected_segments,parsed_segments,committed_segments").eq("case_id", caseId).eq("title", "MA v. Lindsay Clancy Day 3").single();
if (proceedingResult.error) fail("load Day 3 proceeding", proceedingResult.error);
const proceeding = proceedingResult.data;
assert.deepEqual([proceeding.detected_segments, proceeding.parsed_segments, proceeding.committed_segments], [1_873, 1_873, 1_873]);
const identity = { caseId, proceedingId: proceeding.id as string, sourceArtifactId: proceeding.source_artifact_id as string };

// Witness blocks are reused, never duplicated: this is the same deterministic structure commit the Day 3 reconstruction uses.
const structure = compileTestimonyKnowledgeMap({
  ...identity, transcript, candidates: [], extractionMethod: "deterministic",
  compilerName: "icarus-testimony-witness-structure-compiler", compilerVersion: "1.0.0",
  contractVersion: "testimony-witness-structure/1.0", activityType: "deterministic_structure",
});
const structureCommit = await client.rpc("commit_testimony_knowledge_map", { payload: structure });
if (structureCommit.error) fail("persist Day 3 witness structure", structureCommit.error);

const count = async (table: string) => {
  const result = await client.from(table).select("id", { count: "exact", head: true }).eq("case_id", caseId);
  if (result.error) fail(`count ${table}`, result.error);
  return (result.count ?? 0) as number;
};
const [eventsBefore, entitiesBefore] = await Promise.all([count("events"), count("entities")]);

const pass1 = buildDay3TemporalContext(transcript, identity, { accounts: ["hall"] });
const pass2 = buildDay3TemporalContext(transcript, identity);
const payload1 = buildTemporalContextPayload(pass1, identity);
const payload2 = buildTemporalContextPayload(pass2, identity);

const commit = async (label: string, payload: unknown) => {
  const result = await client.rpc("commit_temporal_context", { payload });
  if (result.error) fail(label, result.error);
  return result.data as Record<string, unknown>;
};
const hallOnly = await commit("commit Hall alone", payload1);
const withJosephine = await commit("commit Hall then Josephine", payload2);
const replay = await commit("replay", payload2);
const replayHallOnly = await commit("replay Hall alone", payload1);
assert.equal(replay.duplicate, true);
assert.equal(replayHallOnly.duplicate, true);

const hallEventIds = pass2.candidates.filter((item) => item.accountKey === "day3-hall").map((item) => item.id);
const allEventIds = pass2.candidates.map((item) => item.id);
const runIds = [payload1.context.run.id, payload2.context.run.id];

const [anchors, constraints, links, flags, projection, ledgerContext, provenance, eventsAfter, entitiesAfter, hallRows, mentions, assertions] = await Promise.all([
  client.from("temporal_anchor_candidates").select("id,family,review_status").eq("case_id", caseId).in("id", pass2.anchors.map((item) => item.id)),
  client.from("temporal_constraints").select("id,relation,derivation,review_status,source_segment_ids").eq("case_id", caseId).in("id", pass2.constraints.map((item) => item.id)),
  client.from("knowledge_relationships").select("id,relation_type,assertion_status,review_status").eq("case_id", caseId).in("id", pass2.links.map((item) => item.id)),
  client.from("knowledge_flags").select("id,flag_type,origin,status").eq("case_id", caseId).in("id", pass2.conflicts.map((item) => item.id)),
  client.from("temporal_context_projection").select("event_candidate_id,candidate_kind,assertion_form,anchor_code,constraint_count").eq("case_id", caseId).in("event_candidate_id", allEventIds),
  client.from("case_ledger").select("logical_order,object_type", { count: "exact" }).eq("case_id", caseId).in("extraction_run_id", runIds),
  client.from("provenance_relations").select("id", { count: "exact", head: true }).eq("case_id", caseId).in("extraction_run_id", runIds),
  count("events"), count("entities"),
  client.from("event_candidates").select("id,review_status,reconciled_event_id,candidate_kind").in("id", hallEventIds),
  client.from("entity_mentions").select("id,resolved_entity_id").in("knowledge_item_id", pass2.candidates.map((item) => item.knowledgeItemId)),
  client.from("temporal_assertions").select("id,asserted_start,asserted_end,assertion_form,adopted_from_question,qualification").in("id", pass2.assertions.map((item) => item.id)),
]);
for (const [index, result] of [anchors, constraints, links, flags, projection, ledgerContext, provenance, hallRows, mentions, assertions].entries()) {
  if (result.error) fail(`verification query ${index}`, result.error);
}

assert.equal(anchors.data?.length, pass2.anchors.length);
assert.equal(constraints.data?.length, pass2.constraints.length);
assert.equal(links.data?.length, pass2.links.length);
assert.equal(flags.data?.length, pass2.conflicts.length);
assert.equal(assertions.data?.length, pass2.assertions.length);
assert.equal(eventsAfter - eventsBefore, 0);
assert.equal(entitiesAfter - entitiesBefore, 0);
assert.ok(constraints.data?.every((row) => row.review_status === "pending" && row.source_segment_ids.length > 0));
assert.ok(links.data?.every((row) => row.assertion_status === "candidate" && row.review_status === "pending" && row.relation_type.startsWith("possible_")));
assert.ok(flags.data?.every((row) => row.origin === "deterministic_rule" && row.status === "proposed"));
assert.ok(hallRows.data?.every((row) => row.reconciled_event_id === null && row.review_status === "pending"));
assert.ok(mentions.data?.every((row) => row.resolved_entity_id === null));
assert.ok(assertions.data?.every((row) => row.asserted_start === null && row.asserted_end === null));
assert.equal(assertions.data?.filter((row) => row.adopted_from_question).length, 2);
assert.ok((ledgerContext.count ?? 0) > 0 && (provenance.count ?? 0) > 0);
assert.equal(projection.data?.length, pass2.assertions.length);

// RLS: a signed-in user with no case membership sees none of it, and nobody can write the tables directly.
const outsiderEmail = "temporal-outsider@example.test";
const outsiderPassword = `Local-${corpusIdentity.slice(16, 32)}-B2!`;
const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1_000 });
if (!listed.data.users.find((user) => user.email === outsiderEmail)) {
  const created = await admin.auth.admin.createUser({ email: outsiderEmail, password: outsiderPassword, email_confirm: true });
  if (created.error) fail("create outsider", created.error);
}
const outsider = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const outsiderIn = await outsider.auth.signInWithPassword({ email: outsiderEmail, password: outsiderPassword });
if (outsiderIn.error) fail("sign in outsider", outsiderIn.error);
const outsiderSees = await Promise.all(["temporal_anchor_candidates", "temporal_constraints", "temporal_context_projection"].map(async (table) => {
  const result = await outsider.from(table).select("*", { count: "exact", head: true });
  return { table, visible: result.error ? -1 : result.count ?? 0 };
}));
assert.ok(outsiderSees.every((item) => item.visible === 0));
const outsiderCommit = await outsider.rpc("commit_temporal_context", { payload: payload2 });
assert.ok(outsiderCommit.error, "an outsider must not commit temporal context");
const directWrite = await client.from("temporal_constraints").insert({ id: "00000000-0000-4000-8000-000000000999", case_id: caseId });
assert.ok(directWrite.error, "direct writes to temporal_constraints must be denied");

const report = {
  schemaVersion: "testimony-temporal-context-persistence/1.0",
  generatedAt: new Date().toISOString(),
  caseId, proceedingId: proceeding.id, migration: "20260920120000_temporal_context_v1.sql",
  rpc: "public.commit_temporal_context",
  commits: { hallAlone: hallOnly, hallThenJosephine: withJosephine, replayDuplicate: replay.duplicate === true, replayHallAloneDuplicate: replayHallOnly.duplicate === true },
  persisted: {
    anchors: anchors.data?.length, constraints: constraints.data?.length, possibleLinks: links.data?.length, conflictFlags: flags.data?.length,
    temporalAssertions: assertions.data?.length, projectionRows: projection.data?.length,
    ledgerEntriesForContextRuns: ledgerContext.count, provenanceRelationsForContextRuns: provenance.count,
    linkTypes: Object.fromEntries([...new Set(links.data?.map((row) => row.relation_type))].map((type) => [type, links.data?.filter((row) => row.relation_type === type).length])),
  },
  boundaries: { canonicalEventsCreated: eventsAfter - eventsBefore, entitiesCreated: entitiesAfter - entitiesBefore, unresolvedEntityMentionsResolved: 0 },
  rls: { outsiderVisibleRows: outsiderSees, outsiderCommitDenied: true, directWriteDenied: true },
  local: "Applied to the local Supabase stack only; no hosted project was linked or changed.",
};
await writeFile(path.resolve("reports/day3-temporal-context-persistence.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(path.resolve("reports/day3-temporal-context-persistence.md"), `# Day 3 temporal context — persistence acceptance

Generated: ${report.generatedAt}
Migration: \`${report.migration}\` (local Supabase only)
RPC: \`${report.rpc}\`

| Check | Result |
|---|---|
| Hall committed alone, then Hall + Josephine | committed |
| Replay of either pass | duplicate (idempotent) |
| Anchors / constraints persisted | ${report.persisted.anchors} / ${report.persisted.constraints} |
| Possible cross-account links (pending review) | ${report.persisted.possibleLinks} — ${JSON.stringify(report.persisted.linkTypes)} |
| Conflict flags (proposed, deterministic rule) | ${report.persisted.conflictFlags} |
| Temporal assertions with form and adopted-premise flag | ${report.persisted.temporalAssertions} |
| Projection rows (\`temporal_context_projection\`) | ${report.persisted.projectionRows} |
| Ledger entries for the context runs | ${report.persisted.ledgerEntriesForContextRuns} |
| Provenance relations for the context runs | ${report.persisted.provenanceRelationsForContextRuns} |
| Canonical events created | ${report.boundaries.canonicalEventsCreated} |
| Entities / SAME resolutions created | ${report.boundaries.entitiesCreated} |
| Outsider can read any context row | no |
| Outsider can commit | no |
| Direct writes to \`temporal_constraints\` | denied |

Applied to the local stack only. No hosted project was linked, and nothing was changed in Studio.
`, "utf8");
process.stdout.write(`${JSON.stringify(report)}\n`);
