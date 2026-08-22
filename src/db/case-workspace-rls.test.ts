import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { describe, expect, it } from "vitest";

const memberUserId = "11111111-1111-4111-8111-111111111111";
const outsiderUserId = "22222222-2222-4222-8222-222222222222";
const caseId = "33333333-3333-4333-8333-333333333333";
const artifactId = "44444444-4444-4444-8444-444444444444";
const segmentId = "55555555-5555-4555-8555-555555555555";
const sourceId = "66666666-6666-4666-8666-666666666666";
const intakeId = "77777777-7777-4777-8777-777777777777";
const lineageId = "88888888-8888-4888-8888-888888888888";
const structureFlagId = "99999999-9999-4999-8999-999999999999";

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
  `);

  const migrationsUrl = new URL("../../supabase/migrations/", import.meta.url);
  for (const name of (await readdir(migrationsUrl)).filter((item) => item.endsWith(".sql")).sort()) {
    await db.exec(await readFile(new URL(name, migrationsUrl), "utf8"));
  }

  await db.exec(`
    insert into auth.users(id) values ('${memberUserId}'), ('${outsiderUserId}');
    insert into public.cases(id, owner_user_id, title, purpose, public_record_cutoff)
      values ('${caseId}', '${memberUserId}', 'Isolated case', 'RLS acceptance', now());
    insert into public.sources(id, case_id, title, source_family, evidence_lane, possessed_by_us)
      values ('${sourceId}', '${caseId}', 'Private transcript', 'trial_transcript', 'testimony', true);
    insert into public.evidence_intakes(id, case_id, source_id, submitted_url, canonical_url, capture_method, captured_at, sha256, original_object_key, processing_status, created_by_user_id, detected_segments, parsed_segments, committed_segments)
      values ('${intakeId}', '${caseId}', '${sourceId}', 'https://example.test/private', 'https://example.test/private', 'import', now(), '${"a".repeat(64)}', 'private.txt', 'complete', '${memberUserId}', 1, 1, 1);
    insert into public.source_lineages(id, case_id, source_id, lineage_key)
      values ('${lineageId}', '${caseId}', '${sourceId}', 'rls-fixture');
    insert into public.source_artifacts(id, case_id, title, media_type, sha256, byte_length, object_key, acquired_from, is_authorized, source_id, evidence_intake_id, source_lineage_id, document_type, source_url, canonical_url, capture_method, retrieved_at, parser_status)
      values ('${artifactId}', '${caseId}', 'Private transcript', 'text/plain', '${"a".repeat(64)}', 24, 'private.txt', 'fixture', true, '${sourceId}', '${intakeId}', '${lineageId}', 'trial_transcript', 'https://example.test/private', 'https://example.test/private', 'import', now(), 'complete');
    update public.source_lineages set canonical_artifact_id = '${artifactId}' where id = '${lineageId}';
    insert into public.source_segments(id, artifact_id, locator_type, locator, exact_text, case_id, ordinal)
      values ('${segmentId}', '${artifactId}', 'line', '{"line":1}'::jsonb, 'Case-member-only testimony', '${caseId}', 1);
    insert into public.knowledge_flags(id,case_id,object_code,target_node_type,target_node_id,flag_type,rationale,origin,status,source_segment_ids,logical_order)
      values ('${structureFlagId}','${caseId}','FLAG-RLS-1','source_segment','${segmentId}','unresolved_reference','Member-only structural lineage','deterministic_rule','proposed',array['${segmentId}'::uuid],1);
  `);

  return db;
}

async function visibleCounts(db: PGlite, userId: string) {
  await db.exec(`reset role; set request.jwt.claim.sub='${userId}'; set role authenticated;`);
  const result = await db.query<{ cases: number; segments: number; structureObjects: number }>(`
    select
      (select count(*)::int from public.cases where id = '${caseId}') as cases,
      (select count(*)::int from public.source_segments where id = '${segmentId}') as segments,
      (select count(*)::int from public.knowledge_flags where id = '${structureFlagId}') as "structureObjects"
  `);
  return result.rows[0];
}

describe("case workspace RLS", () => {
  it("exposes the case and canonical source only to a case member", async () => {
    const db = await migratedDatabase();

    expect(await visibleCounts(db, memberUserId)).toEqual({ cases: 1, segments: 1, structureObjects: 1 });
    expect(await visibleCounts(db, outsiderUserId)).toEqual({ cases: 0, segments: 0, structureObjects: 0 });

    await db.exec("reset role");
    await db.close();
  }, 30_000);
});
