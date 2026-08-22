import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

import { DAY6_TIMELINE_WITNESS, buildDay6TimelineAcceptance } from "../src/lib/day6-timeline-acceptance";
import { parseRevTranscript } from "../src/lib/rev-testimony";

function fail(label: string, error: unknown): never {
  throw new Error(`${label}: ${JSON.stringify(error)}`);
}

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
if (signedIn.error) fail("sign in", signedIn.error);

const caseResult = await client.from("cases").select("id").eq("workspace_key", "day6-acceptance").single();
if (caseResult.error) fail("load case", caseResult.error);
const caseId = caseResult.data.id;
const proceedingResult = await client.from("proceedings").select("id,source_artifact_id,status,detected_segments,parsed_segments,committed_segments,last_timestamp_ms").eq("case_id", caseId).single();
if (proceedingResult.error) fail("load proceeding", proceedingResult.error);
const proceeding = proceedingResult.data;
assert.deepEqual([proceeding.detected_segments, proceeding.parsed_segments, proceeding.committed_segments], [2_197, 2_197, 2_197]);
assert.equal(proceeding.last_timestamp_ms, 15_402_000);

const persistedBlock = await client.from("witness_blocks").select("id,imported_id,witness_label_raw,start_segment_id,end_segment_id").eq("case_id", caseId).eq("proceeding_id", proceeding.id).eq("imported_id", DAY6_TIMELINE_WITNESS.importedId).limit(1).single();
if (persistedBlock.error) throw new Error(`The persisted Day 6 knowledge-mapping witness block is required: ${persistedBlock.error.message}`);
assert.match(persistedBlock.data.witness_label_raw, /Hartnett/i);

const [eventsBefore, entitiesBefore] = await Promise.all([
  client.from("events").select("id", { count: "exact", head: true }).eq("case_id", caseId),
  client.from("entities").select("id", { count: "exact", head: true }).eq("case_id", caseId),
]);
if (eventsBefore.error) fail("count canonical events before", eventsBefore.error);
if (entitiesBefore.error) fail("count entities before", entitiesBefore.error);

const compiled = buildDay6TimelineAcceptance(transcript, { caseId, proceedingId: proceeding.id, sourceArtifactId: proceeding.source_artifact_id });
const committed = await client.rpc("commit_testimony_timeline_candidates", { payload: compiled });
if (committed.error) fail("commit timeline candidates", committed.error);
const duplicate = await client.rpc("commit_testimony_timeline_candidates", { payload: compiled });
if (duplicate.error) fail("replay timeline candidates", duplicate.error);
assert.equal(duplicate.data.duplicate, true);

const knowledgeItemIds = compiled.knowledge_items.map((item) => String(item.id));
const [projection, units, items, claims, eventCandidates, temporalAssertions, mentions, ledger, provenance, eventsAfter, entitiesAfter] = await Promise.all([
  client.from("timeline_candidate_projection").select("*").in("knowledge_item_id", knowledgeItemIds).order("event_candidate_code").order("source_ordinal"),
  client.from("testimony_units").select("id,review_status", { count: "exact" }).eq("extraction_run_id", compiled.run.id),
  client.from("knowledge_items").select("id,review_status", { count: "exact" }).eq("extraction_run_id", compiled.run.id),
  client.from("claims").select("id", { count: "exact" }).in("knowledge_item_id", knowledgeItemIds),
  client.from("event_candidates").select("id,source_claim_ids,reconciled_event_id", { count: "exact" }).in("knowledge_item_id", knowledgeItemIds),
  client.from("temporal_assertions").select("id,precision,qualification,asserted_start,asserted_end,asserted_date,asserted_time_of_day_start,raw_temporal_language", { count: "exact" }).in("knowledge_item_id", knowledgeItemIds),
  client.from("entity_mentions").select("id,resolved_entity_id,resolution_status", { count: "exact" }).in("knowledge_item_id", knowledgeItemIds),
  client.from("case_ledger").select("logical_order", { count: "exact", head: true }).eq("extraction_run_id", compiled.run.id),
  client.from("provenance_relations").select("id", { count: "exact", head: true }).eq("extraction_run_id", compiled.run.id),
  client.from("events").select("id", { count: "exact", head: true }).eq("case_id", caseId),
  client.from("entities").select("id", { count: "exact", head: true }).eq("case_id", caseId),
]);
for (const [index, result] of [projection, units, items, claims, eventCandidates, temporalAssertions, mentions, ledger, provenance, eventsAfter, entitiesAfter].entries()) {
  if (result.error) fail(`verification query ${index}`, result.error);
}

assert.equal(units.data?.every((row) => row.review_status === "accepted"), true);
assert.equal(items.data?.every((row) => row.review_status === "accepted"), true);
assert.equal(eventCandidates.data?.every((row) => row.source_claim_ids.length > 0 && row.reconciled_event_id === null), true);
assert.equal(temporalAssertions.data?.every((row) => row.asserted_start === null && row.asserted_end === null), true);
assert.equal(mentions.data?.every((row) => row.resolved_entity_id === null), true);
assert.equal((eventsAfter.count ?? 0) - (eventsBefore.count ?? 0), 0);
assert.equal((entitiesAfter.count ?? 0) - (entitiesBefore.count ?? 0), 0);

const temporalRows = temporalAssertions.data ?? [];
const precisionCount = (precision: string) => temporalRows.filter((row) => row.precision === precision).length;
const qualifiedCount = temporalRows.filter((row) => row.qualification !== "asserted").length;
const wholeProceedingIrregularities = compiled.deterministic_qa.timestampRegressionDetails;
const blockIrregularities = wholeProceedingIrregularities.filter((item) => {
  const segment = transcript.segments.find((candidate) => candidate.id === item.segmentId);
  return segment && segment.ordinal >= DAY6_TIMELINE_WITNESS.startOrdinal && segment.ordinal <= DAY6_TIMELINE_WITNESS.endOrdinal;
});

const report = {
  schemaVersion: "testimony-timeline-candidate-acceptance/1.0",
  generatedAt: new Date().toISOString(),
  acceptanceCorpus: "MA v. Lindsay Clancy Day 6 — complete Maureen Hartnett witness block",
  caseId,
  proceedingId: proceeding.id,
  extractionRunId: compiled.run.id,
  source: {
    sha256,
    detected: proceeding.detected_segments,
    parsed: proceeding.parsed_segments,
    committed: proceeding.committed_segments,
    finalTimestamp: transcript.coverage.lastTimestamp,
  },
  acceptanceWitnessBlock: {
    ...DAY6_TIMELINE_WITNESS,
    persistedWitnessBlockId: persistedBlock.data.id,
    completeBlockSourceSegmentsReviewed: DAY6_TIMELINE_WITNESS.segmentCount,
  },
  created: {
    testimonyUnitsReviewed: units.count ?? 0,
    knowledgeItems: items.count ?? 0,
    claims: claims.count ?? 0,
    eventCandidates: eventCandidates.count ?? 0,
    temporalAssertions: temporalAssertions.count ?? 0,
    exactTimes: precisionCount("exact_timestamp") + precisionCount("exact_time"),
    exactDates: precisionCount("exact_date"),
    approximateTimes: precisionCount("approximate"),
    intervals: precisionCount("interval") + precisionCount("bounded_interval"),
    relativeOnlyAssertions: precisionCount("relative_only"),
    sequenceOnlyAssertions: precisionCount("sequence_only"),
    unknownTimeAssertions: precisionCount("unknown"),
    qualifiedAssertions: qualifiedCount,
    unresolvedEntityMentions: mentions.count ?? 0,
    canonicalEvents: (eventsAfter.count ?? 0) - (eventsBefore.count ?? 0),
    sameResolutions: (entitiesAfter.count ?? 0) - (entitiesBefore.count ?? 0),
    ledgerEntries: ledger.count ?? 0,
    provenanceRelations: provenance.count ?? 0,
  },
  sourceIrregularities: {
    selectedWitnessBlock: blockIrregularities.length,
    completeProceedingPreserved: wholeProceedingIrregularities.length,
    details: wholeProceedingIrregularities,
  },
  projection: {
    view: "public.timeline_candidate_projection",
    rows: projection.data?.length ?? 0,
    sourceDataDuplicated: false,
    exactSourceTextPresent: projection.data?.every((row) => Boolean(row.exact_source_text)) ?? false,
    testimonyTimestampPresent: projection.data?.every((row) => row.testimony_timestamp_start_ms !== null) ?? false,
  },
  boundaries: {
    canonicalEventsCreated: 0,
    sameResolutionsCreated: 0,
    unsupportedDateTimeNormalizations: 0,
    relativeTimesAnchoredAutomatically: 0,
    unknownTimesAssignedAutomatically: 0,
  },
  persistence: {
    rpc: "public.commit_testimony_timeline_candidates",
    status: "complete",
    idempotentReplay: duplicate.data.duplicate,
    migration: "20260822092008_testimony_timeline_candidate_v1.sql",
  },
  remainingGaps: [
    "This acceptance run compiles reviewed event-bearing units from one complete witness block; it does not auto-extract the entire block without human review.",
    "Unresolved person, organization, and location mentions remain for SAME review.",
    "Timeline candidates remain pending for event-level review and are not canonical events.",
  ],
};

assert.equal(report.created.canonicalEvents, 0);
assert.equal(report.created.sameResolutions, 0);
assert.equal(report.created.eventCandidates, report.created.temporalAssertions);
assert.equal(report.created.exactDates, 3);
assert.equal(report.created.approximateTimes, 1);
assert.equal(report.created.intervals, 2);
assert.equal(report.created.relativeOnlyAssertions, 1);
assert.equal(report.created.sequenceOnlyAssertions, 1);
assert.equal(report.created.unknownTimeAssertions, 4);

const markdown = `# Day 6 Testimony → Timeline Candidate Compiler v1 acceptance

Generated: ${report.generatedAt}

- Acceptance witness: **${report.acceptanceWitnessBlock.witnessLabel}**, complete **${report.acceptanceWitnessBlock.completeBlockSourceSegmentsReviewed}-segment** block
- Proceeding completeness: **${report.source.detected} detected = ${report.source.parsed} parsed = ${report.source.committed} committed**
- Final transcript timestamp: **${report.source.finalTimestamp}**
- Reviewed output: **${report.created.testimonyUnitsReviewed} testimony units, ${report.created.knowledgeItems} knowledge items, ${report.created.claims} claims**
- Timeline output: **${report.created.eventCandidates} event candidates, ${report.created.temporalAssertions} temporal assertions**
- Time forms: **${report.created.exactTimes} exact clock times, ${report.created.exactDates} exact dates, ${report.created.approximateTimes} approximate, ${report.created.intervals} intervals, ${report.created.relativeOnlyAssertions} relative-only, ${report.created.sequenceOnlyAssertions} sequence-only, ${report.created.unknownTimeAssertions} unknown**
- Wording-qualified assertions: **${report.created.qualifiedAssertions}**
- Unresolved entity mentions: **${report.created.unresolvedEntityMentions}**
- Canonical events created: **${report.created.canonicalEvents}**
- SAME resolutions created: **${report.created.sameResolutions}**
- Persistence: **complete and idempotent** through \`${report.persistence.rpc}\`

## Provenance and projection

The security-invoker \`${report.projection.view}\` joins Event Candidate → Temporal Assertion → Claim → Knowledge Item → Testimony Unit → Source Segment → Witness/Proceeding metadata. It contains ${report.projection.rows} source-linked rows and does not duplicate source text in a new table.

## Source irregularities

- Selected Hartnett block: **${report.sourceIrregularities.selectedWitnessBlock}** timestamp reversals
- Complete Day 6 proceeding: **${report.sourceIrregularities.completeProceedingPreserved}** preserved provider timestamp reversals

No source timestamp was repaired, and no testimony timestamp was used as event time.

## Remaining gaps

${report.remainingGaps.map((item) => `- ${item}`).join("\n")}
`;

await writeFile(path.resolve("reports/day6-testimony-timeline-candidates.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(path.resolve("reports/day6-testimony-timeline-candidates.md"), markdown, "utf8");
process.stdout.write(`${JSON.stringify(report)}\n`);
