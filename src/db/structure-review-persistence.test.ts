import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { describe, expect, it } from "vitest";

import type { ParsedTranscriptSegment } from "@/lib/rev-testimony";
import { compileTestimonyKnowledgeMap } from "@/lib/testimony-knowledge-mapper";

const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const reviewerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab";
const researcherId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaac";
const viewerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaad";
const outsiderId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaae";
const caseId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const otherCaseId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbc";
const proceedingId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const sourceId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const artifactId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

async function migratedDatabase() {
  const db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(`
    create role authenticated;
    create role anon;
    create role service_role;
    create schema auth;
    create schema extensions;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
  `);
  const migrationsUrl = new URL("../../supabase/migrations/", import.meta.url);
  for (const name of (await readdir(migrationsUrl)).filter((item) => item.endsWith(".sql")).sort()) {
    await db.exec(await readFile(new URL(name, migrationsUrl), "utf8"));
  }
  await db.exec(`
    set request.jwt.claim.sub='${ownerId}';
    insert into auth.users(id) values
      ('${ownerId}'),('${reviewerId}'),('${researcherId}'),('${viewerId}'),('${outsiderId}');
  `);
  await db.query("insert into public.cases(id,owner_user_id,title,purpose,public_record_cutoff) values($1,$2,'Review case','Review acceptance',now()),($3,$4,'Other case','Isolation acceptance',now())", [caseId, ownerId, otherCaseId, outsiderId]);
  await db.query("insert into public.case_members(case_id,user_id,role) values($1,$2,'reviewer'),($1,$3,'researcher'),($1,$4,'viewer')", [caseId, reviewerId, researcherId, viewerId]);
  return db;
}

function segment(id: string, ordinal: number, speaker: string, text: string): ParsedTranscriptSegment {
  return {
    id,
    ordinal,
    speaker,
    timestampStartMs: ordinal * 1_000,
    timestampEndMs: (ordinal + 1) * 1_000,
    deepLink: `https://example.test/transcript?ts=${ordinal}`,
    text,
    locator: { type: "timestamp", timestampStart: `00:00:0${ordinal}`, timestampEnd: `00:00:0${ordinal + 1}`, start: ordinal * 100, end: ordinal * 100 + text.length },
  };
}

async function seedReviewObjects(db: PGlite) {
  const segments = [
    segment("10000000-0000-4000-8000-000000000001", 0, "Clerk", "The Commonwealth calls Dr. Jane Example as its next witness."),
    segment("10000000-0000-4000-8000-000000000002", 1, "Clerk", "Please raise your right hand and solemnly swear."),
    segment("10000000-0000-4000-8000-000000000003", 2, "Ms. Attorney", "Did the temperature later reach 95.2 degrees?"),
    segment("10000000-0000-4000-8000-000000000004", 3, "Dr. Jane Example", "Yes."),
  ];
  const compilerPayload = {
    case_id: caseId,
    intake: { id: "20000000-0000-4000-8000-000000000001", submitted_url: "https://example.test/transcript", canonical_url: "https://example.test/transcript", page_title: "Test transcript", publisher: "Rev", published_date: "", capture_method: "import", content_type: "text/plain", captured_at: "2026-08-22T00:00:00Z", parser_name: "fixture", parser_version: "1" },
    source: { id: sourceId, title: "Test transcript", source_family: "trial_transcript", evidence_lane: "testimony", origin_date: "", notes: "Review fixture" },
    lineage: { id: "20000000-0000-4000-8000-000000000002", lineage_key: "fixture:structure-review", notes: "fixture" },
    artifact: { id: artifactId, title: "Test transcript", media_type: "text/plain", sha256: "a".repeat(64), byte_length: 100, object_key: "fixture.txt", document_type: "trial_transcript", original_filename: "fixture.txt", source_url: "https://example.test/transcript", canonical_url: "https://example.test/transcript", publisher: "Rev", retrieved_at: "2026-08-22T00:00:00Z" },
    proceeding: { id: proceedingId, title: "Day 6", proceeding_type: "trial_day", proceeding_date: "2026-08-22", compiler_name: "fixture", compiler_version: "1" },
    coverage: { detected_segments: 4, parsed_segments: 4, first_timestamp_ms: 0, last_timestamp_ms: 3_000, parser_warnings: [] },
    speakers: ["Clerk", "Ms. Attorney", "Dr. Jane Example"].map((provider_label, index) => ({ id: `30000000-0000-4000-8000-00000000000${index + 1}`, provider_label, canonical_name: null, role: null, review_required: false })),
    segments: segments.map((item) => ({ id: item.id, ordinal: item.ordinal, speaker: item.speaker, timestamp_start_ms: item.timestampStartMs, timestamp_end_ms: item.timestampEndMs, deep_link: item.deepLink, exact_text: item.text, locator: item.locator })),
    qa_exchanges: [], extraction_candidates: [], positions: [], procedural_actions: [], exhibits: [], stipulations: [], resolution_items: [],
    package_version: { id: "20000000-0000-4000-8000-000000000003", schema_version: "proceeding-package/1.0", package_sha256: "b".repeat(64), package: { segments } },
  };
  await db.query("select public.commit_testimony_compiler_run($1::jsonb)", [JSON.stringify(compilerPayload)]);
  const map = compileTestimonyKnowledgeMap({
    caseId,
    proceedingId,
    sourceArtifactId: artifactId,
    transcript: { sourceSha256: "a".repeat(64), segments },
    candidates: [{
      key: "temperature",
      witnessBlockImportedId: "witness_001",
      unitKind: "qa_thread",
      segments: [{ segmentId: segments[2].id, contextRole: "question" }, { segmentId: segments[3].id, contextRole: "answer" }],
      summary: "The witness answered yes when asked whether a recorded temperature later reached 95.2 degrees.",
      unknowns: ["The measurement time is unknown."],
      claims: [{ key: "temperature", assertedByRaw: "Dr. Jane Example", assertedByEntityId: null, speakerCapacity: "witness", normalizedAssertion: "The recorded temperature later reached 95.2 degrees.", assertionStatus: "asserted", informationBasis: "UNKNOWN_BASIS", provenanceType: "trial_testimony", sourceSegmentIds: [segments[2].id, segments[3].id], extractionConfidence: 0.99, propositionId: null }],
      entityMentions: [{ key: "witness", rawMention: "Dr. Jane Example", normalizedCandidate: "Jane Example", mentionType: "person", sourceSegmentIds: [segments[3].id] }],
      eventCandidates: [{ key: "measurement", neutralDescription: "A recorded temperature later reached 95.2 degrees.", participantMentions: ["Dr. Jane Example"], sourceClaimKeys: ["temperature"], extractionConfidence: 0.95 }],
      temporalAssertions: [{ key: "time", eventCandidateKey: "measurement", sourceClaimKey: "temperature", rawTemporalLanguage: "later", assertedStart: null, assertedEnd: null, precision: "relative_only", assertedByRaw: "Dr. Jane Example", sourceSegmentIds: [segments[2].id, segments[3].id], extractionConfidence: 0.99 }],
      relationships: [{ key: "describes", from: { type: "claim", ref: "temperature" }, relationType: "describes", to: { type: "event_candidate", ref: "measurement" }, sourceClaimKey: "temperature", assertionStatus: "asserted", extractionConfidence: 0.95 }],
      flags: [{ key: "missing-time", target: { type: "event_candidate", ref: "measurement" }, flagType: "open_question", rationale: "No measurement timestamp was stated.", origin: "deterministic_rule", status: "proposed", sourceSegmentIds: [segments[2].id, segments[3].id] }],
    }],
  });
  await db.query("select public.commit_testimony_knowledge_map($1::jsonb)", [JSON.stringify(map)]);
  return { map, segments };
}

async function asActor(db: PGlite, actorId: string, role = "authenticated") {
  await db.exec(`reset role; set request.jwt.claim.sub='${actorId}'; set role ${role};`);
}

async function review(db: PGlite, type: string, id: string, action: string, patch: object, note: string, version = 0) {
  return db.query<{ result: { version: number; resulting_status: string; source_segment_ids: string[] } }>(
    "select public.review_structure_object($1::uuid,$2::text,$3::uuid,$4::text,$5::jsonb,$6::text,$7::integer) result",
    [caseId, type, id, action, JSON.stringify(patch), note, version],
  );
}

describe("governed structure review persistence", () => {
  it("enforces roles, immutable versions, allowlists, source capture, concurrency, and analytical boundaries", async () => {
    const db = await migratedDatabase();
    const { map, segments } = await seedReviewObjects(db);
    const targets = {
      knowledge: String(map.knowledge_items[0].id),
      claim: String(map.claims[0].id),
      mention: String(map.entity_mentions[0].id),
      event: String(map.event_candidates[0].id),
      temporal: String(map.temporal_assertions[0].id),
      relationship: String(map.relationships[0].id),
      flag: String(map.flags[0].id),
    };
    const snapshot = { schema_version: "testimony-reconstruction/1.0", case_id: caseId, snapshot_sha256: "c".repeat(64), source_run_ids: [map.run.id], source_event_candidate_ids: [targets.event], source_temporal_assertion_ids: [targets.temporal], nodes: [{ key: "before-review" }], tensions: [], boundaries: { canonical_events_created: 0, same_resolutions_created: 0, testimony_timestamps_used_as_event_time: 0, unresolved_tensions_collapsed: 0 } };
    await db.exec("set role authenticated");
    await db.query("select public.save_reconstruction_version($1::uuid,'Before review','Immutable fixture',$2::jsonb)", [caseId, JSON.stringify(snapshot)]);

    await asActor(db, researcherId);
    await expect(review(db, "knowledge", targets.knowledge, "accept", {}, "")).rejects.toThrow(/STRUCTURE_REVIEW_NOT_AUTHORIZED/);
    await asActor(db, viewerId);
    await expect(review(db, "knowledge", targets.knowledge, "accept", {}, "")).rejects.toThrow(/STRUCTURE_REVIEW_NOT_AUTHORIZED/);
    await asActor(db, outsiderId);
    await expect(review(db, "event", targets.event, "accept", {}, "")).rejects.toThrow(/STRUCTURE_REVIEW_NOT_AUTHORIZED/);
    expect((await db.query<{ count: number }>("select count(*)::int count from public.structure_review_versions")).rows[0].count).toBe(0);

    await asActor(db, ownerId);
    await expect(review(db, "event", targets.event, "amend", { source_claim_ids: [] }, "Not allowed")).rejects.toThrow(/PATCH_FIELD_NOT_ALLOWED/);
    await expect(review(db, "event", targets.event, "reject", {}, "")).rejects.toThrow(/NOTE_REQUIRED/);
    const eventReview = await review(db, "event", targets.event, "amend", { neutral_description: "A temperature was reported as later reaching 95.2 degrees." }, "Clarified neutral wording.");
    expect(eventReview.rows[0].result).toMatchObject({ version: 1, resulting_status: "amended", source_segment_ids: [segments[2].id, segments[3].id] });
    await expect(review(db, "event", targets.event, "accept", {}, "", 0)).rejects.toThrow(/STALE_VERSION/);

    await asActor(db, reviewerId);
    await review(db, "knowledge", targets.knowledge, "accept", {}, "Reviewed against both segments.");
    await review(db, "claim", targets.claim, "amend", { normalized_assertion: "The witness affirmed that a recorded temperature later reached 95.2 degrees." }, "Preserved the affirmative form.");
    await review(db, "mention", targets.mention, "defer", {}, "Identity resolution remains outside this review.");
    await review(db, "temporal", targets.temporal, "accept", {}, "Relative timing remains unanchored.");
    await review(db, "relationship", targets.relationship, "reject", {}, "The relation requires additional review.");
    await review(db, "flag", targets.flag, "defer", {}, "The missing time remains unresolved.");

    await db.exec("reset role");
    const versions = await db.query<{ target_type: string; action: string; previous_status: string; resulting_status: string; patch: Record<string, unknown>; source_segment_ids: string[]; reviewed_by_user_id: string }>("select target_type,action,previous_status,resulting_status,patch,source_segment_ids,reviewed_by_user_id from public.structure_review_versions order by ledger_logical_order");
    expect(versions.rows).toHaveLength(7);
    expect(versions.rows.find((item) => item.target_type === "claim")).toMatchObject({ action: "amend", previous_status: "candidate", resulting_status: "accepted", reviewed_by_user_id: reviewerId });
    expect(versions.rows.find((item) => item.target_type === "flag")).toMatchObject({ action: "defer", previous_status: "proposed", resulting_status: "deferred" });
    expect(versions.rows.every((item) => item.source_segment_ids.length > 0)).toBe(true);

    const boundaries = await db.query<{ events: number; entities: number; resolved_mentions: number }>("select (select count(*)::int from public.events) events,(select count(*)::int from public.entities) entities,(select count(*)::int from public.entity_mentions where resolved_entity_id is not null) resolved_mentions");
    expect(boundaries.rows[0]).toEqual({ events: 0, entities: 0, resolved_mentions: 0 });
    const saved = await db.query<{ snapshot: unknown }>("select snapshot from public.saved_reconstruction_versions where case_id=$1", [caseId]);
    expect(saved.rows[0].snapshot).toEqual(snapshot);
    const ledger = await db.query<{ logical_order: number }>("select logical_order from public.case_ledger where case_id=$1 order by logical_order", [caseId]);
    expect(ledger.rows.map((row) => row.logical_order)).toEqual(ledger.rows.map((_, index) => index + 1));

    await asActor(db, outsiderId);
    expect((await db.query<{ count: number }>("select count(*)::int count from public.structure_review_versions")).rows[0].count).toBe(0);
    await asActor(db, ownerId);
    await expect(db.query("insert into public.structure_review_versions(case_id,target_type,target_id,version,action,previous_status,resulting_status,before_state,after_state,source_segment_ids,reviewed_by_user_id,ledger_logical_order) values($1,'event',$2,99,'accept','pending','accepted','{}','{}','{}',$3,999)", [caseId, targets.event, ownerId])).rejects.toThrow(/permission denied/);
    await expect(db.query("update public.event_candidates set neutral_description='Direct write' where id=$1", [targets.event])).rejects.toThrow(/permission denied|row-level security/);
    await expect(db.query("update public.claims set normalized_assertion='Direct write' where id=$1", [targets.claim])).rejects.toThrow(/permission denied|row-level security/);

    const legacyClaimId = "f0000000-0000-4000-8000-000000000001";
    await db.exec("reset role");
    await db.query(`
      insert into public.claims(
        id,case_id,source_segment_id,claimant,assertion,claimed_event_time,
        source_id,evidence_lane,provenance_type,extraction_confidence,source_quote
      )
      select $1,case_id,source_segment_id,'Fixture witness','A legacy candidate claim.','2026-08-22T12:00:00Z',
        source_id,evidence_lane,provenance_type,1,'A legacy candidate claim.'
      from public.claims where id=$2
    `, [legacyClaimId, targets.claim]);
    await asActor(db, ownerId);
    const promoted = await db.query<{ event_id: string }>("select public.review_and_promote_claim($1,$2,'Reviewed source-linked legacy claim.','Legacy promoted event','exact',null,'') event_id", [caseId, legacyClaimId]);
    expect(promoted.rows[0].event_id).toMatch(/^[0-9a-f-]{36}$/);
    expect((await db.query<{ status: string }>("select status::text status from public.claims where id=$1", [legacyClaimId])).rows[0].status).toBe("accepted");
    expect((await db.query<{ count: number }>("select count(*)::int count from public.events where promoted_from_claim_id=$1", [legacyClaimId])).rows[0].count).toBe(1);
    await expect(db.query("select public.review_and_promote_claim($1,$2,'Reviewed source-linked legacy claim.','Duplicate promoted event','exact',null,'')", [caseId, legacyClaimId])).rejects.toThrow(/CLAIM_ALREADY_REVIEWED/);
    await db.close();
  }, 30_000);
});
