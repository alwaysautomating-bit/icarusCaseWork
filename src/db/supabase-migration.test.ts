import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

describe("Supabase deployment migration", () => {
  it("applies from zero with the Supabase auth contract present", async () => {
    const db = new PGlite();
    await db.exec(`
      create role authenticated;
      create role anon;
      create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    `);
    const migrationsUrl = new URL("../../supabase/migrations/", import.meta.url);
    const migrationNames = (await readdir(migrationsUrl)).filter((name) => name.endsWith(".sql")).sort();
    for (const name of migrationNames) {
      const migration = await readFile(new URL(name, migrationsUrl), "utf8");
      await expect(db.exec(migration)).resolves.toBeDefined();
    }
    const tables = await db.query<{ table_name: string }>("select table_name from information_schema.tables where table_schema='public'");
    expect(tables.rows.map((row) => row.table_name)).toContain("saved_research_views");
    expect(tables.rows.map((row) => row.table_name)).toEqual(expect.arrayContaining(["evidence_intakes", "sources", "proceedings", "proceeding_speakers", "qa_exchanges", "extraction_candidates", "extraction_review_versions", "proceeding_positions", "procedural_actions", "proceeding_exhibits", "proceeding_stipulations", "resolution_items", "proceeding_package_versions", "casework_proceeding_imports"]));
    const functions = await db.query<{ routine_name: string }>("select routine_name from information_schema.routines where routine_schema='public'");
    expect(functions.rows.map((row) => row.routine_name)).toContain("commit_testimony_url_intake");
    expect(functions.rows.map((row) => row.routine_name)).toEqual(expect.arrayContaining(["commit_testimony_compiler_run", "review_extraction_candidate", "publish_proceeding_package", "import_proceeding_package_to_casework"]));
    await db.close();
  }, 30_000);

  it("keeps reconciliation tables read-only to intake and grants the atomic function only to authenticated users", async () => {
    const migration = await readFile(new URL("../../supabase/migrations/20260817035154_testimony_url_intake.sql", import.meta.url), "utf8");
    expect(migration).toContain("payload ?| array['claim_support','support','contradictions','verification_assessments','verification','reconciliation']");
    expect(migration).toContain("grant select on public.claim_support,public.verification_assessments,public.verification_assessment_claims to authenticated");
    expect(migration).not.toMatch(/grant\s+[^;]*insert[^;]*public\.claim_support/i);
    expect(migration).toContain("revoke all on function public.commit_testimony_url_intake(jsonb) from public,anon");
    expect(migration).toContain("grant execute on function public.commit_testimony_url_intake(jsonb) to authenticated");
  });

  it("requires detected = parsed = committed and keeps the legacy complete path disabled", async () => {
    const migration = await readFile(new URL("../../supabase/migrations/20260817070009_testimony_compiler_v1.sql", import.meta.url), "utf8");
    expect(migration).toContain("detected_segments=parsed_segments and parsed_segments=committed_segments");
    expect(migration).toContain("v_committed<>v_detected or v_committed<>v_parsed");
    expect(migration).toContain("revoke execute on function public.commit_testimony_url_intake(jsonb) from authenticated");
    expect(migration).toContain("analytical_assessments_created integer not null default 0 check(analytical_assessments_created=0)");
  });
});
