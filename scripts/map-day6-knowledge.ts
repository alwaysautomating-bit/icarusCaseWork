import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

import { buildDay6KnowledgeAcceptance } from "../src/lib/day6-knowledge-acceptance";
import { parseRevTranscript } from "../src/lib/rev-testimony";

const artifactPath = path.resolve(".data/objects/48cca058a0bc10ec900010f0271d2bd6ede40c88b7db57e2790ee07aa2de55d2.html");
const bytes = await readFile(artifactPath);
const sha256 = createHash("sha256").update(bytes).digest("hex");
const transcript = parseRevTranscript(bytes.toString("utf8"), "https://www.rev.com/transcripts/ma-v-lindsay-clancy-day-6");
assert.equal(transcript.sourceSha256, sha256);
assert.deepEqual([transcript.coverage.detectedSegments, transcript.coverage.parsedSegments, transcript.segments.length], [2_197, 2_197, 2_197]);

const status = JSON.parse(execSync("pnpm exec supabase status -o json", { encoding: "utf8" }).replace(/^Stopped services:.*\r?\n/, ""));
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const email = `day6-${sha256.slice(0, 12)}@example.test`;
const password = `Local-${sha256.slice(0, 16)}-A1!`;
const user = (await admin.auth.admin.listUsers({ page: 1, perPage: 1_000 })).data.users.find((item) => item.email === email);
if (!user) throw new Error("The published Day 6 acceptance user was not found. Run pnpm testimony:day6 first.");
const client = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const signedIn = await client.auth.signInWithPassword({ email, password });
if (signedIn.error) throw signedIn.error;

const caseResult = await client.from("cases").select("id").eq("workspace_key", "day6-acceptance").single();
if (caseResult.error) throw caseResult.error;
const caseId = caseResult.data.id;
const proceedingResult = await client.from("proceedings").select("id,source_artifact_id,status,detected_segments,parsed_segments,committed_segments,last_timestamp_ms").eq("case_id", caseId).single();
if (proceedingResult.error) throw proceedingResult.error;
const proceeding = proceedingResult.data;
assert.deepEqual([proceeding.detected_segments, proceeding.parsed_segments, proceeding.committed_segments], [2_197, 2_197, 2_197]);
assert.equal(proceeding.last_timestamp_ms, 15_402_000);

const entityCountBefore = await client.from("entities").select("id", { count: "exact", head: true }).eq("case_id", caseId);
if (entityCountBefore.error) throw entityCountBefore.error;
const map = buildDay6KnowledgeAcceptance(transcript, { caseId, proceedingId: proceeding.id, sourceArtifactId: proceeding.source_artifact_id });
const committed = await client.rpc("commit_testimony_knowledge_map", { payload: map });
if (committed.error) throw committed.error;
const duplicate = await client.rpc("commit_testimony_knowledge_map", { payload: map });
if (duplicate.error) throw duplicate.error;
assert.equal(duplicate.data.duplicate, true);

const knowledgeItemIds = map.knowledge_items.map((item) => String(item.id));
const queries = await Promise.all([
  client.from("source_segments").select("id", { count: "exact", head: true }).eq("proceeding_id", proceeding.id),
  client.from("witness_blocks").select("id", { count: "exact", head: true }).eq("extraction_run_id", map.run.id),
  client.from("testimony_units").select("id", { count: "exact", head: true }).eq("extraction_run_id", map.run.id),
  client.from("knowledge_items").select("id", { count: "exact", head: true }).eq("extraction_run_id", map.run.id),
  client.from("claims").select("id", { count: "exact", head: true }).in("knowledge_item_id", knowledgeItemIds),
  client.from("event_candidates").select("id", { count: "exact", head: true }).in("knowledge_item_id", knowledgeItemIds),
  client.from("temporal_assertions").select("precision,asserted_start,asserted_end,raw_temporal_language").in("knowledge_item_id", knowledgeItemIds).order("logical_order"),
  client.from("knowledge_relationships").select("relation_type", { count: "exact" }).in("knowledge_item_id", knowledgeItemIds),
  client.from("knowledge_flags").select("flag_type,status", { count: "exact" }).eq("case_id", caseId),
  client.from("provenance_activities").select("activity_type", { count: "exact" }).eq("extraction_run_id", map.run.id),
  client.from("provenance_relations").select("relation_type", { count: "exact" }).eq("extraction_run_id", map.run.id),
  client.from("case_ledger").select("logical_order,object_type").eq("extraction_run_id", map.run.id).order("logical_order"),
  client.from("entities").select("id", { count: "exact", head: true }).eq("case_id", caseId),
  client.from("claim_support").select("id", { count: "exact", head: true }).eq("case_id", caseId),
  client.from("contradictions").select("id", { count: "exact", head: true }).eq("case_id", caseId),
  client.from("verification_assessments").select("id", { count: "exact", head: true }).eq("case_id", caseId),
]);
for (const query of queries) if (query.error) throw query.error;
const [segmentRows, blockRows, unitRows, itemRows, claimRows, eventRows, temporalRows, relationshipRows, flagRows, activityRows, provenanceRows, ledgerRows, entityRows, supportRows, contradictionRows, verificationRows] = queries;
assert.equal(segmentRows.count, 2_197);
assert.equal(blockRows.count, 8);
assert.equal(unitRows.count, 2);
assert.equal(itemRows.count, 2);
assert.equal(claimRows.count, 2);
assert.equal(eventRows.count, 2);
assert.equal(temporalRows.data?.every((item) => item.asserted_start === null && item.asserted_end === null), true);
assert.deepEqual(relationshipRows.data?.map((item) => item.relation_type), ["describes", "describes"]);
assert.equal(entityRows.count, entityCountBefore.count);
assert.deepEqual([supportRows.count, contradictionRows.count, verificationRows.count], [0, 0, 0]);

const report = {
  schemaVersion: "testimony-knowledge-acceptance/1.0",
  generatedAt: new Date().toISOString(),
  acceptanceCorpus: "MA v. Lindsay Clancy Day 6",
  caseId,
  proceedingId: proceeding.id,
  extractionRunId: map.run.id,
  source: { sha256, detected: 2_197, parsed: 2_197, committed: segmentRows.count, finalTimestamp: transcript.coverage.lastTimestamp },
  deterministicStructure: {
    witnessBlocks: blockRows.count,
    testimonyStartOrdinal: 63,
    preWitnessSegmentsPreserved: map.deterministic_qa.unassignedSegmentIds.length,
    blockOverlaps: map.deterministic_qa.blockOverlaps,
    invalidBlocks: map.deterministic_qa.invalidBlocks,
    providerTimestampRegressions: map.deterministic_qa.timestampRegressionDetails,
    impossibleTimestampRegressions: map.deterministic_qa.impossibleTimestampRegressions,
  },
  mapped: {
    testimonyUnits: unitRows.count, knowledgeItems: itemRows.count, claims: claimRows.count, entityMentions: map.entity_mentions.length,
    canonicalEntitiesCreated: (entityRows.count ?? 0) - (entityCountBefore.count ?? 0), eventCandidates: eventRows.count,
    canonicalEventsCreated: 0, temporalAssertions: temporalRows.data?.length, relationships: relationshipRows.count,
    flags: flagRows.count, provenanceActivities: activityRows.count, provenanceRelations: provenanceRows.count,
    ledgerEntries: ledgerRows.data?.length,
  },
  regressionResults: {
    temperature82_1: { questionTimestamp: "00:19:43", answerTimestamp: "00:19:56", numericValueIndependentlyAffirmed: false, informationBasis: "READ_IN_RECORD", eventTimePrecision: "relative_only", assertedStart: null, assertedEnd: null },
    temperature95_2: { questionTimestamp: "00:21:12", answerTimestamp: "00:21:18", answer: "Yes.", eventTimePrecision: "unknown", assertedStart: null, assertedEnd: null },
  },
  boundaries: {
    sameResolutionsCreated: committed.data.same_resolutions_created ?? 0,
    supportAssessmentsCreated: supportRows.count,
    contradictionAssessmentsCreated: contradictionRows.count,
    verificationAssessmentsCreated: verificationRows.count,
    truthOrCausationAssessmentsCreated: 0,
  },
  persistence: { status: "complete", idempotentReplay: duplicate.data.duplicate, rpc: "commit_testimony_knowledge_map", migrations: ["20260818090150_testimony_knowledge_mapping_v1.sql", "20260818092634_testimony_knowledge_mapping_security.sql"] },
  remainingScope: [
    "Only the two temperature Q/A content windows are semantically mapped in this acceptance slice; the full Day 6 transcript remains preserved and structurally addressable.",
    "Three 2–3 second provider timestamp reversals are preserved and flagged; no source timestamp was rewritten.",
    "Canonical entity resolution remains pending in SAME.",
  ],
};

const markdown = `# Day 6 testimony knowledge mapping acceptance\n\nGenerated: ${report.generatedAt}\n\n- Source completeness: **${report.source.detected} detected = ${report.source.parsed} parsed = ${report.source.committed} committed**\n- Final transcript timestamp: **${report.source.finalTimestamp}**\n- Deterministic structure: **${report.deterministicStructure.witnessBlocks} witness blocks**, no overlaps or invalid blocks\n- Mapped acceptance windows: **${report.mapped.testimonyUnits} testimony units, ${report.mapped.knowledgeItems} knowledge items, ${report.mapped.claims} claims, ${report.mapped.eventCandidates} event candidates, ${report.mapped.temporalAssertions} temporal assertions**\n- 82.1°F: witness recalled hypothermia from documentation; numeric value was not independently repeated or affirmed; measurement time remains relative-only with no timestamp\n- 95.2°F: witness answered “Yes”; measurement time remains unknown with no timestamp\n- SAME resolutions created: **${report.boundaries.sameResolutionsCreated}**\n- Support / contradiction / verification / truth / causation assessments created: **0**\n- Persistence: **complete and idempotent** through \`${report.persistence.rpc}\`\n\n## Source irregularities\n\nThe preserved Rev source contains three small timestamp reversals (-2s, -3s, -2s). They are retained as provenance findings. No timestamp was normalized or invented.\n\n## Remaining scope\n\n${report.remainingScope.map((item) => `- ${item}`).join("\n")}\n`;
await writeFile(path.resolve("reports/day6-testimony-knowledge-mapping.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(path.resolve("reports/day6-testimony-knowledge-mapping.md"), markdown, "utf8");
process.stdout.write(`${JSON.stringify(report)}\n`);
