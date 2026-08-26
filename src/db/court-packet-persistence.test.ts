import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { describe, expect, it } from "vitest";
import { buildCourtPacketBundle, sha256 } from "@/lib/court-packet";

const ownerId = "a1000000-0000-4000-8000-000000000001";
const reviewerId = "a1000000-0000-4000-8000-000000000002";
const researcherId = "a1000000-0000-4000-8000-000000000003";
const outsiderId = "a1000000-0000-4000-8000-000000000004";
const caseId = "b1000000-0000-4000-8000-000000000001";

const fixture = {
  job: { id: "fixture-job" },
  text: { pages: [
    { page_number: 1, text: "SEARCH WARRANT Device Apple iPhone" },
    { page_number: 2, text: "The issuing court finds probable cause." },
    { page_number: 3, text: "RETURN OF SEARCH WARRANT The warrant was executed." },
  ] },
  markdown: { pages: [
    { page_number: 1, markdown: "# SEARCH WARRANT\nDevice Apple iPhone" },
    { page_number: 2, markdown: "The issuing court finds probable cause." },
    { page_number: 3, markdown: "# RETURN OF SEARCH WARRANT\nThe warrant was executed." },
  ] },
  items: { pages: [
    { page_number: 1, items: [{ type: "heading", value: "SEARCH WARRANT" }] },
    { page_number: 2, items: [] },
    { page_number: 3, items: [{ type: "heading", value: "RETURN OF SEARCH WARRANT" }] },
  ] },
};

async function database() {
  const db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(`
    create role authenticated;
    create role anon;
    create role service_role;
    create schema auth;
    create schema extensions;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
  `);
  const directory = new URL("../../supabase/migrations/", import.meta.url);
  for (const name of (await readdir(directory)).filter((item) => item.endsWith(".sql")).sort()) await db.exec(await readFile(new URL(name, directory), "utf8"));
  await db.exec(`
    set request.jwt.claim.sub='${ownerId}';
    insert into auth.users(id) values('${ownerId}'),('${reviewerId}'),('${researcherId}'),('${outsiderId}');
    insert into public.cases(id,owner_user_id,title,purpose,public_record_cutoff) values('${caseId}','${ownerId}','Packet case','Court packet acceptance',now());
    insert into public.case_members(case_id,user_id,role) values('${caseId}','${reviewerId}','reviewer'),('${caseId}','${researcherId}','researcher');
  `);
  return db;
}

async function asActor(db: PGlite, actorId: string) {
  await db.exec(`reset role; set request.jwt.claim.sub='${actorId}'; set role authenticated;`);
}

describe("court packet governed persistence", () => {
  it("commits atomically, replays idempotently, isolates cases, and governs acceptance", async () => {
    const db = await database();
    const bytes = new TextEncoder().encode("immutable packet bytes");
    const bundle = buildCourtPacketBundle({
      caseId,
      sourceName: "packet.pdf",
      sourceBytes: bytes,
      objectKey: `court-packets/${sha256(bytes)}.pdf`,
      capturedAt: "2026-08-24T12:00:00.000Z",
      parseResult: fixture,
      fileId: "file-fixture",
      jobId: "job-fixture",
    });

    await asActor(db, outsiderId);
    await expect(db.query("select public.commit_court_packet_parse($1::jsonb)", [JSON.stringify(bundle)])).rejects.toThrow(/COURT_PACKET_NOT_AUTHORIZED/);
    await asActor(db, ownerId);
    await expect(db.query("select public.commit_court_packet_parse($1::jsonb)", [JSON.stringify({ ...bundle, claims: [] })])).rejects.toThrow(/COURT_PACKET_ANALYTICAL_WRITES_FORBIDDEN/);
    const committed = await db.query<{ result: { duplicate: boolean; pages: number; candidates: number; analytical_assessments_created: number } }>("select public.commit_court_packet_parse($1::jsonb) result", [JSON.stringify(bundle)]);
    expect(committed.rows[0].result).toEqual(expect.objectContaining({ duplicate: false, pages: 3, candidates: 2, analytical_assessments_created: 0 }));
    const replay = await db.query<{ result: { duplicate: boolean } }>("select public.commit_court_packet_parse($1::jsonb) result", [JSON.stringify(bundle)]);
    expect(replay.rows[0].result.duplicate).toBe(true);

    await db.exec("reset role");
    const counts = await db.query<{ pages: number; candidates: number; claims: number; events: number }>("select (select count(*)::int from public.court_packet_pages) pages,(select count(*)::int from public.court_packet_boundary_candidates) candidates,(select count(*)::int from public.claims) claims,(select count(*)::int from public.events) events");
    expect(counts.rows[0]).toEqual({ pages: 3, candidates: 2, claims: 0, events: 0 });

    const candidateId = bundle.segments[0].id;
    await asActor(db, researcherId);
    await expect(db.query("select public.review_court_packet_boundary($1,'accept','{}','',0)", [candidateId])).rejects.toThrow(/COURT_PACKET_REVIEW_NOT_AUTHORIZED/);
    await asActor(db, reviewerId);
    const accepted = await db.query<{ result: { document_id: string; version: number; resulting_status: string; source_segment_ids: string[] } }>("select public.review_court_packet_boundary($1,'accept','{}','',0) result", [candidateId]);
    expect(accepted.rows[0].result).toEqual(expect.objectContaining({ document_id: candidateId, version: 1, resulting_status: "accepted", source_segment_ids: bundle.segments[0].source_segment_ids }));
    await expect(db.query("select public.review_court_packet_boundary($1,'amend',$2::jsonb,'Expanded after page review.',0)", [candidateId, JSON.stringify({ end_page: 3 })])).rejects.toThrow(/COURT_PACKET_REVIEW_STALE_VERSION/);
    const amended = await db.query<{ result: { version: number; resulting_status: string; source_segment_ids: string[] } }>("select public.review_court_packet_boundary($1,'amend',$2::jsonb,'Expanded after page review.',1) result", [candidateId, JSON.stringify({ end_page: 3 })]);
    expect(amended.rows[0].result).toEqual(expect.objectContaining({ version: 2, resulting_status: "amended", source_segment_ids: bundle.pages.map((page) => page.segment_id) }));
    await expect(db.query("insert into public.court_packet_documents(id,case_id,source_artifact_id,candidate_id,document_type,start_page,end_page,source_segment_ids,current_version,accepted_by_user_id) values(gen_random_uuid(),$1,$2,$3,'search_warrant',1,1,$4,1,$5)", [caseId, bundle.source.artifact_id, bundle.segments[1].id, [bundle.pages[0].segment_id], reviewerId])).rejects.toThrow(/permission denied/);

    await asActor(db, outsiderId);
    const hidden = await db.query<{ count: number }>("select count(*)::int count from public.court_packet_boundary_candidates");
    expect(hidden.rows[0].count).toBe(0);
    await db.close();
  }, 30_000);
});
