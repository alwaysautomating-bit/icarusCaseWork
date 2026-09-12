import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { describe, expect, it } from "vitest";

const ownerId = "10000000-0000-4000-8000-000000000001";
const explorerId = "10000000-0000-4000-8000-000000000002";
const outsiderId = "10000000-0000-4000-8000-000000000003";
const caseId = "20000000-0000-4000-8000-000000000001";

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
      ('${explorerId}','explorer@example.test'),
      ('${outsiderId}','outsider@example.test');
    insert into public.cases(id,owner_user_id,title,purpose,public_record_cutoff)
      values('${caseId}','${ownerId}','Membership case','Test owner-managed access',now());
  `);
  return db;
}

async function asActor(db: PGlite, actorId: string) {
  await db.exec(`reset role; set request.jwt.claim.sub='${actorId}'; set role authenticated;`);
}

describe("case member management", () => {
  it("lets only the owner add, change, list, and remove a member by email", async () => {
    const db = await migratedDatabase();
    await asActor(db, ownerId);

    const added = await db.query<{ email: string; membership_role: string }>(
      "select email,membership_role from public.upsert_case_member_by_email($1,$2,$3)",
      [caseId, " EXPLORER@example.test ", "viewer"],
    );
    expect(added.rows).toEqual([{ email: "explorer@example.test", membership_role: "viewer" }]);

    const listed = await db.query<{ email: string; membership_role: string }>(
      "select email,membership_role from public.list_case_members($1)",
      [caseId],
    );
    expect(listed.rows).toEqual([
      { email: "owner@example.test", membership_role: "owner" },
      { email: "explorer@example.test", membership_role: "viewer" },
    ]);

    await asActor(db, explorerId);
    const visibleCase = await db.query<{ id: string }>("select id from public.cases where id=$1", [caseId]);
    expect(visibleCase.rows).toEqual([{ id: caseId }]);
    const viewerUpdate = await db.query<{ id: string }>("update public.cases set title='Changed' where id=$1 returning id", [caseId]);
    expect(viewerUpdate.rows).toEqual([]);
    await expect(db.query(
      "insert into public.sources(case_id,title,source_family,evidence_lane) values($1,'Viewer write','other','testimony')",
      [caseId],
    )).rejects.toThrow(/row-level security/i);
    await expect(db.query(
      "select * from public.upsert_case_member_by_email($1,$2,$3)",
      [caseId, "outsider@example.test", "reviewer"],
    )).rejects.toThrow(/Only the case owner/);

    await asActor(db, ownerId);
    const updated = await db.query<{ membership_role: string }>(
      "select membership_role from public.upsert_case_member_by_email($1,$2,$3)",
      [caseId, "explorer@example.test", "reviewer"],
    );
    expect(updated.rows[0]).toEqual({ membership_role: "reviewer" });

    const removed = await db.query<{ removed: boolean }>(
      "select public.remove_case_member($1,$2) as removed",
      [caseId, explorerId],
    );
    expect(removed.rows[0]).toEqual({ removed: true });

    await db.exec("reset role");
    const audit = await db.query<{ action: string }>(
      "select action from public.audit_events where case_id=$1 order by occurred_at,action",
      [caseId],
    );
    expect(audit.rows.map((row) => row.action).sort()).toEqual([
      "case.member_added",
      "case.member_removed",
      "case.member_role_changed",
    ]);

    await db.close();
  }, 60_000);

  it("rejects unknown accounts and owner removal", async () => {
    const db = await migratedDatabase();
    await asActor(db, ownerId);

    await expect(db.query(
      "select * from public.upsert_case_member_by_email($1,$2,$3)",
      [caseId, "missing@example.test", "viewer"],
    )).rejects.toThrow(/No Icarus account exists/);
    await expect(db.query(
      "select public.remove_case_member($1,$2)",
      [caseId, ownerId],
    )).rejects.toThrow(/owner cannot be removed/i);

    await db.exec("reset role");
    await db.close();
  }, 60_000);
});
