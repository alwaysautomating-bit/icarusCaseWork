import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

describe("Supabase deployment migration", () => {
  it("applies from zero with the Supabase auth contract present", async () => {
    const db = new PGlite();
    await db.exec(`
      create role authenticated;
      create role anon;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    `);
    const migration = await readFile(new URL("../../supabase/migrations/20260813090819_bootstrap_icarus_casework.sql", import.meta.url), "utf8");
    await expect(db.exec(migration)).resolves.toBeDefined();
    const tables = await db.query<{ table_name: string }>("select table_name from information_schema.tables where table_schema='public'");
    expect(tables.rows.map((row) => row.table_name)).toContain("saved_research_views");
    await db.close();
  }, 20_000);
});
