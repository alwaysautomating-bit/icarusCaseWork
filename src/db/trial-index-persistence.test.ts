import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { describe, expect, it } from "vitest";

const ownerId = "71000000-0000-4000-8000-000000000001";
const reviewerId = "71000000-0000-4000-8000-000000000002";
const researcherId = "71000000-0000-4000-8000-000000000003";
const outsiderId = "71000000-0000-4000-8000-000000000004";
const caseId = "72000000-0000-4000-8000-000000000001";
const otherCaseId = "72000000-0000-4000-8000-000000000002";

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
  `);
  await db.query("insert into public.cases(id,owner_user_id,title,purpose,public_record_cutoff) values($1,$2,'Trial index case','Navigation index acceptance',now()),($3,$4,'Other case','Isolation acceptance',now())", [caseId, ownerId, otherCaseId, outsiderId]);
  await db.query("insert into public.case_members(case_id,user_id,role) values($1,$2,'reviewer'),($1,$3,'researcher')", [caseId, reviewerId, researcherId]);
  return db;
}

async function asActor(db: PGlite, actorId: string) {
  await db.exec(`reset role; set request.jwt.claim.sub='${actorId}'; set role authenticated;`);
}

function payload(headline = "Opening statements and first witness") {
  return JSON.stringify({
    day_number: 1,
    court_date: "2026-07-27",
    session_status: "completed",
    trial_phase: "prosecution",
    headline,
    summary: "A navigation summary that is not evidence.",
    basis: "editorial_reference",
    witnesses: [{ name: "Example Witness", descriptor: "First witness", status: "reported" }],
    topics: [{ label: "Opening statements", summary: "Party positions are not evidence." }],
    references: [{ title: "Day 1 reporting", url: "https://example.test/day-1", publisher: "Example", source_kind: "reporting" }],
    change_note: "Initial index entry",
  });
}

describe("trial navigation index persistence", () => {
  it("is case-scoped, role-governed, versioned, idempotent, and non-evidentiary", async () => {
    const db = await database();
    await asActor(db, researcherId);
    await expect(db.query("select public.upsert_trial_index_day($1,$2::jsonb)", [caseId, payload()])).rejects.toThrow(/TRIAL_INDEX_NOT_AUTHORIZED/);

    await asActor(db, ownerId);
    const created = await db.query<{ result: { version: number; duplicate: boolean } }>("select public.upsert_trial_index_day($1,$2::jsonb) result", [caseId, payload()]);
    expect(created.rows[0].result).toMatchObject({ version: 1, duplicate: false });
    const replay = await db.query<{ result: { version: number; duplicate: boolean } }>("select public.upsert_trial_index_day($1,$2::jsonb) result", [caseId, payload()]);
    expect(replay.rows[0].result).toMatchObject({ version: 1, duplicate: true });

    await asActor(db, reviewerId);
    const amended = await db.query<{ result: { version: number; duplicate: boolean } }>("select public.upsert_trial_index_day($1,$2::jsonb) result", [caseId, payload("Opening statements; witness testimony begins")]);
    expect(amended.rows[0].result).toMatchObject({ version: 2, duplicate: false });
    expect((await db.query<{ version: number }>("select version from public.trial_index_day_versions where case_id=$1 order by version", [caseId])).rows.map((row) => row.version)).toEqual([1, 2]);
    expect((await db.query<{ navigation_only: boolean }>("select navigation_only from public.trial_index_projection where case_id=$1", [caseId])).rows[0].navigation_only).toBe(true);

    await asActor(db, outsiderId);
    expect((await db.query<{ count: number }>("select count(*)::int count from public.trial_index_days")).rows[0].count).toBe(0);
    await asActor(db, ownerId);
    await expect(db.query("update public.trial_index_days set headline='Direct client write' where case_id=$1", [caseId])).rejects.toThrow(/permission denied|row-level security/);
    await expect(db.query("insert into public.trial_index_day_versions(case_id,trial_index_day_id,version,snapshot,changed_by_user_id) select case_id,id,99,'{}', $2 from public.trial_index_days where case_id=$1", [caseId, ownerId])).rejects.toThrow(/permission denied/);

    await db.exec("reset role");
    const boundaries = await db.query<{ claims: number; events: number; reconstructions: number }>("select (select count(*)::int from public.claims) claims,(select count(*)::int from public.events) events,(select count(*)::int from public.saved_reconstruction_versions) reconstructions");
    expect(boundaries.rows[0]).toEqual({ claims: 0, events: 0, reconstructions: 0 });
    expect((await db.query<{ count: number }>("select count(*)::int count from public.audit_events where action like 'trial_index.%'")).rows[0].count).toBe(2);
    await db.close();
  }, 30_000);
});
