import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { describe, expect, it } from "vitest";

const ownerId = "81000000-0000-4000-8000-000000000001";
const researcherId = "81000000-0000-4000-8000-000000000002";
const viewerId = "81000000-0000-4000-8000-000000000003";
const outsiderId = "81000000-0000-4000-8000-000000000004";
const caseId = "82000000-0000-4000-8000-000000000001";
const questionId = "83000000-0000-4000-8000-000000000001";
const questionSourceId = "84000000-0000-4000-8000-000000000001";
const evidenceId = "85000000-0000-4000-8000-000000000001";
const evidenceSourceId = "86000000-0000-4000-8000-000000000001";

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
      ('${ownerId}','owner@example.test'),('${researcherId}','researcher@example.test'),
      ('${viewerId}','viewer@example.test'),('${outsiderId}','outsider@example.test');
    insert into public.cases(id,owner_user_id,title,purpose,public_record_cutoff,workspace_key)
      values('${caseId}','${ownerId}','Research case','Questions and evidence acceptance',now(),'research-case');
    insert into public.case_members(case_id,user_id,role) values
      ('${caseId}','${researcherId}','researcher'),('${caseId}','${viewerId}','viewer');
  `);
  return db;
}

async function asActor(db: PGlite, actorId: string) {
  await db.exec(`reset role; set request.jwt.claim.sub='${actorId}'; set role authenticated;`);
}

describe("research questions and evidence persistence", () => {
  it("keeps sourced research objects case-scoped and viewers read-only", async () => {
    const db = await migratedDatabase();
    await asActor(db, ownerId);
    await db.query(
      "insert into public.research_questions(id,case_id,question,context,created_by_user_id) values($1,$2,$3,$4,$5)",
      [questionId, caseId, "What testing was performed on the hand swabs?", "Testing remains unknown.", ownerId],
    );
    await db.query(
      `insert into public.research_question_sources(id,question_id,case_id,source_type,source_label,created_by_user_id)
       values($1,$2,$3,'document','Search warrant p. 14',$4)`,
      [questionSourceId, questionId, caseId, ownerId],
    );
    await db.query(
      `insert into public.research_question_entries(question_id,case_id,entry_kind,statement,source_link_id,created_by_user_id)
       values($1,$2,'known','External hand swabs were collected.',$3,$4)`,
      [questionId, caseId, questionSourceId, ownerId],
    );
    await expect(db.query(
      `insert into public.research_question_entries(question_id,case_id,entry_kind,statement,created_by_user_id)
       values($1,$2,'finding','Unsourced finding',$3)`,
      [questionId, caseId, ownerId],
    )).rejects.toThrow(/check constraint/i);

    await db.query(
      "insert into public.research_evidence_items(id,case_id,name,description,created_by_user_id) values($1,$2,'Hand swabs','Collected at hospital',$3)",
      [evidenceId, caseId, ownerId],
    );
    await db.query(
      `insert into public.research_evidence_sources(id,evidence_id,case_id,source_type,source_label,relationship,created_by_user_id)
       values($1,$2,$3,'document','Search warrant p. 14','documents',$4)`,
      [evidenceSourceId, evidenceId, caseId, ownerId],
    );
    await db.query(
      `insert into public.research_evidence_facts(evidence_id,case_id,statement,source_link_id,created_by_user_id)
       values($1,$2,'Both hands were externally swabbed.',$3,$4)`,
      [evidenceId, caseId, evidenceSourceId, ownerId],
    );
    await db.query(
      `insert into public.research_question_evidence_links(question_id,evidence_id,case_id,created_by_user_id)
       values($1,$2,$3,$4)`,
      [questionId, evidenceId, caseId, ownerId],
    );

    await asActor(db, viewerId);
    expect((await db.query("select id from public.research_questions")).rows).toHaveLength(1);
    expect((await db.query("select id from public.research_evidence_items")).rows).toHaveLength(1);
    expect((await db.query("update public.research_questions set status='resolved',resolution='Yes',resolved_at=now() returning id")).rows).toEqual([]);
    await expect(db.query(
      "insert into public.research_questions(case_id,question,created_by_user_id) values($1,'Viewer write attempt',$2)",
      [caseId, viewerId],
    )).rejects.toThrow(/row-level security/i);

    await asActor(db, researcherId);
    const contribution = await db.query(
      "insert into public.research_questions(case_id,question,created_by_user_id) values($1,'Which report records the result?',$2) returning id",
      [caseId, researcherId],
    );
    expect(contribution.rows).toHaveLength(1);

    await asActor(db, outsiderId);
    expect((await db.query("select id from public.research_questions")).rows).toEqual([]);
    expect((await db.query("select id from public.research_evidence_items")).rows).toEqual([]);
    await db.close();
  }, 60_000);
});
