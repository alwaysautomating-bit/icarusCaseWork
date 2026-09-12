import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { describe, expect, it } from "vitest";

const ownerId = "71000000-0000-4000-8000-000000000001";
const researcherId = "71000000-0000-4000-8000-000000000002";
const viewerId = "71000000-0000-4000-8000-000000000003";
const outsiderId = "71000000-0000-4000-8000-000000000004";
const caseId = "72000000-0000-4000-8000-000000000001";
const otherCaseId = "72000000-0000-4000-8000-000000000002";
const folderId = "73000000-0000-4000-8000-000000000001";
const itemId = "74000000-0000-4000-8000-000000000001";

async function migratedDatabase() {
  const db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(`
    create role authenticated;
    create role anon;
    create role service_role;
    create schema auth;
    create schema extensions;
    create table auth.users(id uuid primary key, email text unique);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
  `);
  const migrationsUrl = new URL("../../supabase/migrations/", import.meta.url);
  for (const name of (await readdir(migrationsUrl)).filter((item) => item.endsWith(".sql")).sort()) {
    await db.exec(await readFile(new URL(name, migrationsUrl), "utf8"));
  }
  await db.exec(`
    insert into auth.users(id,email) values
      ('${ownerId}','owner@example.test'),
      ('${researcherId}','researcher@example.test'),
      ('${viewerId}','viewer@example.test'),
      ('${outsiderId}','outsider@example.test');
    insert into public.cases(id,owner_user_id,title,purpose,public_record_cutoff,workspace_key) values
      ('${caseId}','${ownerId}','Media case','Supporting pictures test case',now(),'media-case'),
      ('${otherCaseId}','${ownerId}','Other case','Second supporting pictures case',now(),'other-media-case');
    insert into public.case_members(case_id,user_id,role) values
      ('${caseId}','${researcherId}','researcher'),
      ('${caseId}','${viewerId}','viewer');
  `);
  return db;
}

async function asActor(db: PGlite, actorId: string) {
  await db.exec(`reset role; set request.jwt.claim.sub='${actorId}'; set role authenticated;`);
}

describe("supporting media persistence", () => {
  it("keeps folders and images case-scoped, non-canonical, and viewer read-only", async () => {
    const db = await migratedDatabase();
    await asActor(db, ownerId);
    await db.query(
      "insert into public.supporting_media_folders(id,case_id,name,created_by_user_id) values($1,$2,'Screenshots',$3)",
      [folderId, caseId, ownerId],
    );
    await db.query(
      `insert into public.supporting_media_items(
        id,case_id,folder_id,original_filename,media_type,byte_length,sha256,object_key,caption,uploaded_by_user_id
      ) values($1,$2,$3,'screen.png','image/png',128,$4,$5,'Reference screenshot',$6)`,
      [itemId, caseId, folderId, "a".repeat(64), `${caseId}/${itemId}.png`, ownerId],
    );

    await asActor(db, viewerId);
    const visible = await db.query<{ is_canonical: boolean; record_role: string }>(
      "select is_canonical,record_role from public.supporting_media_items where case_id=$1",
      [caseId],
    );
    expect(visible.rows).toEqual([{ is_canonical: false, record_role: "supporting_reference" }]);
    const viewerMove = await db.query<{ id: string }>(
      "update public.supporting_media_items set folder_id=null where id=$1 returning id",
      [itemId],
    );
    expect(viewerMove.rows).toEqual([]);
    await expect(db.query(
      "insert into public.supporting_media_folders(case_id,name,created_by_user_id) values($1,'Viewer folder',$2)",
      [caseId, viewerId],
    )).rejects.toThrow(/row-level security/i);

    await asActor(db, researcherId);
    const researcherFolder = await db.query<{ id: string }>(
      "insert into public.supporting_media_folders(case_id,name,created_by_user_id) values($1,'Research',$2) returning id",
      [caseId, researcherId],
    );
    expect(researcherFolder.rows).toHaveLength(1);
    await expect(db.query(
      `insert into public.supporting_media_items(
        case_id,folder_id,original_filename,media_type,byte_length,sha256,object_key,is_canonical,uploaded_by_user_id
      ) values($1,$2,'bad.png','image/png',10,$3,$4,true,$5)`,
      [caseId, folderId, "b".repeat(64), `${caseId}/75000000-0000-4000-8000-000000000001.png`, researcherId],
    )).rejects.toThrow(/check constraint/i);
    await expect(db.query(
      `insert into public.supporting_media_items(
        case_id,folder_id,original_filename,media_type,byte_length,sha256,object_key,uploaded_by_user_id
      ) values($1,$2,'cross-case.png','image/png',10,$3,$4,$5)`,
      [otherCaseId, folderId, "c".repeat(64), `${otherCaseId}/75000000-0000-4000-8000-000000000002.png`, researcherId],
    )).rejects.toThrow();

    await asActor(db, outsiderId);
    const hidden = await db.query("select id from public.supporting_media_items where case_id=$1", [caseId]);
    expect(hidden.rows).toEqual([]);
    await db.close();
  }, 60_000);
});
