import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { describe, expect, it } from "vitest";

import type { ParsedTranscriptSegment } from "@/lib/rev-testimony";
import { compileTestimonyKnowledgeMap } from "@/lib/testimony-knowledge-mapper";
import { compileTestimonyTimelineCandidates } from "@/lib/testimony-timeline-compiler";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const caseId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
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
  await db.exec(`set request.jwt.claim.sub='${userId}'; insert into auth.users(id) values('${userId}');`);
  await db.query("insert into public.cases(id,owner_user_id,title,purpose,public_record_cutoff) values($1,$2,'Test case','Persistence acceptance',now())", [caseId, userId]);
  return db;
}

function segment(id: string, ordinal: number, speaker: string, text: string): ParsedTranscriptSegment {
  const timestampStartMs = ordinal * 1_000;
  const timestampStart = `00:00:0${ordinal}`;
  return { id, ordinal, speaker, timestampStartMs, timestampEndMs: timestampStartMs + 1_000,
    deepLink: `https://example.test/transcript?ts=${ordinal}`, text,
    locator: { type: "timestamp", timestampStart, timestampEnd: `00:00:0${ordinal + 1}`, start: ordinal * 100, end: ordinal * 100 + text.length } };
}

describe("testimony knowledge persistence", () => {
  it("atomically persists mapped testimony with a case ledger and no analysis or SAME writes", async () => {
    const db = await migratedDatabase();
    const segments = [
      segment("10000000-0000-4000-8000-000000000001", 0, "Clerk", "The Commonwealth calls Dr. Jane Example as its next witness."),
      segment("10000000-0000-4000-8000-000000000002", 1, "Clerk", "Please raise your right hand and solemnly swear."),
      segment("10000000-0000-4000-8000-000000000003", 2, "Ms. Attorney", "Did the recorded temperature later reach 95.2 degrees?"),
      segment("10000000-0000-4000-8000-000000000004", 3, "Dr. Jane Example", "Yes."),
    ];
    const compilerPayload = {
      case_id: caseId,
      intake: { id: "20000000-0000-4000-8000-000000000001", submitted_url: "https://example.test/transcript", canonical_url: "https://example.test/transcript", page_title: "Test transcript", publisher: "Rev", published_date: "", capture_method: "import", content_type: "text/plain", captured_at: "2026-08-18T00:00:00Z", parser_name: "fixture", parser_version: "1" },
      source: { id: sourceId, title: "Test transcript", source_family: "trial_transcript", evidence_lane: "testimony", origin_date: "", notes: "Persistence fixture" },
      lineage: { id: "20000000-0000-4000-8000-000000000002", lineage_key: "fixture:testimony-knowledge", notes: "fixture" },
      artifact: { id: artifactId, title: "Test transcript", media_type: "text/plain", sha256: "a".repeat(64), byte_length: 100, object_key: "fixture.txt", document_type: "trial_transcript", original_filename: "fixture.txt", source_url: "https://example.test/transcript", canonical_url: "https://example.test/transcript", publisher: "Rev", retrieved_at: "2026-08-18T00:00:00Z" },
      proceeding: { id: proceedingId, title: "Test proceeding", proceeding_type: "trial_day", proceeding_date: "", compiler_name: "fixture", compiler_version: "1" },
      coverage: { detected_segments: 4, parsed_segments: 4, first_timestamp_ms: 0, last_timestamp_ms: 3_000, parser_warnings: [] },
      speakers: ["Clerk", "Ms. Attorney", "Dr. Jane Example"].map((provider_label, index) => ({ id: `30000000-0000-4000-8000-00000000000${index + 1}`, provider_label, canonical_name: null, role: null, review_required: false })),
      segments: segments.map((item) => ({ id: item.id, ordinal: item.ordinal, speaker: item.speaker, timestamp_start_ms: item.timestampStartMs, timestamp_end_ms: item.timestampEndMs, deep_link: item.deepLink, exact_text: item.text, locator: item.locator })),
      qa_exchanges: [], extraction_candidates: [], positions: [], procedural_actions: [], exhibits: [], stipulations: [], resolution_items: [],
      package_version: { id: "20000000-0000-4000-8000-000000000003", schema_version: "proceeding-package/1.0", package_sha256: "b".repeat(64), package: { segments } },
    };
    const committed = await db.query<{ result: { proceeding_id: string } }>("select public.commit_testimony_compiler_run($1::jsonb) result", [JSON.stringify(compilerPayload)]);
    expect(committed.rows[0].result.proceeding_id).toBe(proceedingId);

    const map = compileTestimonyKnowledgeMap({
      caseId, proceedingId, sourceArtifactId: artifactId, transcript: { sourceSha256: "a".repeat(64), segments },
      candidates: [{
        key: "temperature", witnessBlockImportedId: "witness_001", unitKind: "qa_thread",
        segments: [{ segmentId: segments[2].id, contextRole: "question" }, { segmentId: segments[3].id, contextRole: "answer" }],
        summary: "The witness answered yes when asked whether the recorded temperature later reached 95.2°F; no measurement time was stated.",
        unknowns: ["Measurement time is unknown."],
        claims: [{ key: "temperature", assertedByRaw: "Dr. Jane Example", assertedByEntityId: null, speakerCapacity: "witness", normalizedAssertion: "The witness affirmed that the recorded temperature later reached 95.2°F.", assertionStatus: "asserted", informationBasis: "UNKNOWN_BASIS", provenanceType: "trial_testimony", sourceSegmentIds: [segments[2].id, segments[3].id], extractionConfidence: 0.99, propositionId: null }],
        entityMentions: [{ key: "witness", rawMention: "Dr. Jane Example", normalizedCandidate: "Jane Example", mentionType: "person", sourceSegmentIds: [segments[3].id] }],
        eventCandidates: [{ key: "measurement", neutralDescription: "A recorded temperature was described as having later reached 95.2°F.", participantMentions: [], sourceClaimKeys: ["temperature"], extractionConfidence: 0.95 }],
        temporalAssertions: [{ key: "time", eventCandidateKey: "measurement", sourceClaimKey: "temperature", rawTemporalLanguage: "later", assertedStart: null, assertedEnd: null, precision: "relative_only", assertedByRaw: "Dr. Jane Example", sourceSegmentIds: [segments[2].id, segments[3].id], extractionConfidence: 0.99 }],
        relationships: [{ key: "describes", from: { type: "claim", ref: "temperature" }, relationType: "describes", to: { type: "event_candidate", ref: "measurement" }, sourceClaimKey: "temperature", assertionStatus: "asserted", extractionConfidence: 0.95 }],
        flags: [{ key: "missing-time", target: { type: "event_candidate", ref: "measurement" }, flagType: "open_question", rationale: "No measurement timestamp was stated.", origin: "deterministic_rule", status: "proposed", sourceSegmentIds: [segments[2].id, segments[3].id] }],
      }],
    });
    const first = await db.query<{ result: { duplicate: boolean; knowledge_items: number; claims: number; analytical_assessments_created: number; same_resolutions_created: number } }>("select public.commit_testimony_knowledge_map($1::jsonb) result", [JSON.stringify(map)]);
    expect(first.rows[0].result).toMatchObject({ duplicate: false, knowledge_items: 1, claims: 1, analytical_assessments_created: 0, same_resolutions_created: 0 });
    const duplicate = await db.query<{ result: { duplicate: boolean } }>("select public.commit_testimony_knowledge_map($1::jsonb) result", [JSON.stringify(map)]);
    expect(duplicate.rows[0].result.duplicate).toBe(true);

    const timeline = compileTestimonyTimelineCandidates({
      caseId, proceedingId, sourceArtifactId: artifactId, transcript: { sourceSha256: "a".repeat(64), segments },
      reviewedUnits: [{
        key: "temperature-timeline", witnessBlockImportedId: "witness_001", unitKind: "qa_thread",
        sourceSegmentIds: [segments[2].id, segments[3].id],
        summary: "The reviewed Q&A described a temperature being reached later, without an event timestamp.",
        unknowns: ["The measurement time remains relative-only."],
        claim: { key: "temperature-timeline", assertedByRaw: "Dr. Jane Example", speakerCapacity: "witness", normalizedAssertion: "The witness affirmed that the recorded temperature later reached 95.2 degrees.", informationBasis: "UNKNOWN_BASIS", sourceSegmentIds: [segments[2].id, segments[3].id], extractionConfidence: 1 },
        entityMentions: [{ key: "witness", rawMention: "Dr. Jane Example", mentionType: "person", sourceSegmentIds: [segments[3].id] }],
        events: [{ key: "temperature-event", neutralDescription: "A recorded temperature reached 95.2 degrees.", eventClass: "temperature_measurement", sourceClaimKey: "temperature-timeline", sourceWording: "Yes.", sourceSegmentIds: [segments[3].id], temporalWording: "later", temporalSourceSegmentIds: [segments[2].id], participantMentions: ["Dr. Jane Example"], extractionConfidence: 1 }],
      }],
    });
    const timelineFirst = await db.query<{ result: { duplicate: boolean; event_candidates: number; temporal_assertions: number; canonical_events_created: number; same_resolutions_created: number } }>("select public.commit_testimony_timeline_candidates($1::jsonb) result", [JSON.stringify(timeline)]);
    expect(timelineFirst.rows[0].result).toMatchObject({ duplicate: false, event_candidates: 1, temporal_assertions: 1, canonical_events_created: 0, same_resolutions_created: 0 });
    const timelineDuplicate = await db.query<{ result: { duplicate: boolean } }>("select public.commit_testimony_timeline_candidates($1::jsonb) result", [JSON.stringify(timeline)]);
    expect(timelineDuplicate.rows[0].result.duplicate).toBe(true);

    const counts = await db.query<{ knowledge_items: number; claims: number; event_candidates: number; temporal_assertions: number; ledger: number; entities: number; support: number; contradictions: number }>(`select
      (select count(*)::int from public.knowledge_items) knowledge_items,
      (select count(*)::int from public.claims) claims,
      (select count(*)::int from public.event_candidates) event_candidates,
      (select count(*)::int from public.temporal_assertions) temporal_assertions,
      (select count(*)::int from public.case_ledger) ledger,
      (select count(*)::int from public.entities) entities,
      (select count(*)::int from public.claim_support) support,
      (select count(*)::int from public.contradictions) contradictions`);
    expect(counts.rows[0]).toMatchObject({ knowledge_items: 2, claims: 2, event_candidates: 2, temporal_assertions: 2, entities: 0, support: 0, contradictions: 0 });
    expect(counts.rows[0].ledger).toBeGreaterThan(8);
    const time = await db.query<{ precision: string; asserted_start: string | null; asserted_end: string | null }>("select precision,asserted_start,asserted_end from public.temporal_assertions");
    expect(time.rows.map((row) => row.precision).sort()).toEqual(["relative_only", "sequence_only"]);
    expect(time.rows.every((row) => row.asserted_start === null && row.asserted_end === null)).toBe(true);
    const projection = await db.query<{ exact_source_text: string; source_speaker: string; temporal_precision: string; event_class: string; testimony_unit_review_status: string }>("select exact_source_text,source_speaker,temporal_precision,event_class,testimony_unit_review_status from public.timeline_candidate_projection");
    expect(projection.rows).toEqual([{ exact_source_text: segments[2].text, source_speaker: segments[2].speaker, temporal_precision: "sequence_only", event_class: "temperature_measurement", testimony_unit_review_status: "accepted" }]);
    await db.exec("set role authenticated");
    const saveTimelineVersion = () => db.query<{ version: number; snapshot: { schema_version: string; items: Array<{ event_candidate_id: string; temporal_assertion_id: string; source_segment_ids: string[] }> } }>(`
      select version,snapshot from public.save_timeline_view_version(
        $1::uuid,$2::text,$3::text,$4::uuid[],$5::uuid[],$6::uuid[],$7::jsonb
      )
    `, [caseId, "Temperature candidates", "Reviewed fixture", [timeline.run.id], timeline.event_candidates.map((item) => item.id), timeline.temporal_assertions.map((item) => item.id), JSON.stringify({ lane: "candidate" })]);
    const savedV1 = await saveTimelineVersion();
    const savedV2 = await saveTimelineVersion();
    expect(savedV1.rows[0].version).toBe(1);
    expect(savedV2.rows[0].version).toBe(2);
    expect(savedV1.rows[0].snapshot).toMatchObject({ schema_version: "timeline-candidate-view/1.0" });
    expect(savedV1.rows[0].snapshot.items).toHaveLength(1);
    expect(savedV1.rows[0].snapshot.items[0].source_segment_ids).toEqual([segments[2].id, segments[3].id]);
    await db.exec("reset role; insert into auth.users(id) values('ffffffff-ffff-4fff-8fff-ffffffffffff'); set request.jwt.claim.sub='ffffffff-ffff-4fff-8fff-ffffffffffff'; set role authenticated;");
    const outsiderViews = await db.query<{ count: number }>("select count(*)::int count from public.saved_timeline_views");
    expect(outsiderViews.rows[0].count).toBe(0);
    await db.exec(`reset role; set request.jwt.claim.sub='${userId}'`);
    const orders = await db.query<{ logical_order: number }>("select logical_order from public.case_ledger order by logical_order");
    expect(orders.rows.map((row) => row.logical_order)).toEqual(orders.rows.map((_, index) => index + 1));
    await db.close();
  }, 30_000);
});
