import { readFile,readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { describe,expect,it } from "vitest";

const ownerId = "91000000-0000-4000-8000-000000000001";
const researcherId = "91000000-0000-4000-8000-000000000002";
const viewerId = "91000000-0000-4000-8000-000000000003";
const outsiderId = "91000000-0000-4000-8000-000000000004";
const caseId = "92000000-0000-4000-8000-000000000001";

async function migratedDatabase() {
  const db = new PGlite({extensions:{pg_trgm}});
  await db.exec(`
    create role authenticated;
    create role anon;
    create role service_role;
    create schema auth;
    create schema extensions;
    create table auth.users(id uuid primary key,email text unique);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
  `);
  const migrationsUrl = new URL("../../supabase/migrations/",import.meta.url);
  for (const name of (await readdir(migrationsUrl)).filter((item) => item.endsWith(".sql")).sort()) {
    await db.exec(await readFile(new URL(name,migrationsUrl),"utf8"));
  }
  await db.exec(`
    insert into auth.users(id,email) values
      ('${ownerId}','owner@example.test'),('${researcherId}','researcher@example.test'),
      ('${viewerId}','viewer@example.test'),('${outsiderId}','outsider@example.test');
    insert into public.cases(id,owner_user_id,title,purpose,public_record_cutoff,workspace_key)
      values('${caseId}','${ownerId}','Independent research case','Core timeline test',now(),'timeline-test');
    insert into public.case_members(case_id,user_id,role) values
      ('${caseId}','${researcherId}','researcher'),('${caseId}','${viewerId}','viewer');
  `);
  return db;
}

async function asActor(db: PGlite,actorId: string) {
  await db.exec(`reset role; set request.jwt.claim.sub='${actorId}'; set role authenticated;`);
}

describe("Core Timeline persistence",() => {
  it("keeps projections case-scoped and placement notes recoverable",async () => {
    const db = await migratedDatabase();
    await asActor(db,ownerId);
    const timeline = await db.query<{id:string}>(`insert into public.core_timelines(case_id,slug,title,created_by_user_id) values($1,'incident','Incident',$2) returning id`,[caseId,ownerId]);
    const timelineId = timeline.rows[0]!.id;
    const note = await db.query<{id:string}>(`insert into public.timeline_placement_notes(case_id,timeline_id,description,source_hint,created_by_user_id) values($1,$2,'Locate dispatch time','911 log',$3) returning id`,[caseId,timelineId,ownerId]);

    await asActor(db,viewerId);
    expect((await db.query("select id from public.core_timelines")).rows).toHaveLength(1);
    expect((await db.query("update public.timeline_placement_notes set status='dismissed' returning id")).rows).toEqual([]);

    await asActor(db,researcherId);
    expect((await db.query("update public.timeline_placement_notes set status='dismissed' where id=$1 returning id",[note.rows[0]!.id])).rows).toHaveLength(1);
    expect((await db.query("select status from public.timeline_placement_notes where id=$1",[note.rows[0]!.id])).rows).toEqual([{status:"dismissed"}]);

    await asActor(db,outsiderId);
    expect((await db.query("select id from public.core_timelines")).rows).toEqual([]);
    expect((await db.query("select id from public.timeline_placement_notes")).rows).toEqual([]);
    await db.close();
  },60_000);
});
