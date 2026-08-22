import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { describe, expect, it } from "vitest";

describe("Supabase deployment migration", () => {
  it("applies from zero with the Supabase auth contract present", async () => {
    const db = new PGlite({ extensions: { pg_trgm } });
    await db.exec(`
      create role authenticated;
      create role anon;
      create role service_role;
      create schema auth;
      create schema extensions;
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
    expect(tables.rows.map((row) => row.table_name)).toEqual(expect.arrayContaining(["knowledge_extraction_runs", "case_ledger", "witness_blocks", "testimony_units", "knowledge_items", "knowledge_item_versions", "claim_source_segments", "entity_mentions", "event_candidates", "temporal_bands", "temporal_assertions", "knowledge_relationships", "knowledge_flags", "provenance_activities", "provenance_relations"]));
    expect(tables.rows.map((row) => row.table_name)).toEqual(expect.arrayContaining(["saved_timeline_views", "saved_reconstruction_versions", "structure_review_versions"]));
    const functions = await db.query<{ routine_name: string }>("select routine_name from information_schema.routines where routine_schema='public'");
    expect(functions.rows.map((row) => row.routine_name)).toContain("commit_testimony_url_intake");
    expect(functions.rows.map((row) => row.routine_name)).toEqual(expect.arrayContaining(["commit_testimony_compiler_run", "review_extraction_candidate", "publish_proceeding_package", "import_proceeding_package_to_casework"]));
    expect(functions.rows.map((row) => row.routine_name)).toContain("commit_testimony_knowledge_map");
    expect(functions.rows.map((row) => row.routine_name)).toContain("commit_testimony_timeline_candidates");
    expect(functions.rows.map((row) => row.routine_name)).toContain("save_reconstruction_version");
    expect(functions.rows.map((row) => row.routine_name)).toContain("review_structure_object");
    expect(functions.rows.map((row) => row.routine_name)).toContain("search_testimony");
    const indexes = await db.query<{ indexname: string }>("select indexname from pg_indexes where schemaname='public'");
    expect(indexes.rows.map((row) => row.indexname)).toEqual(expect.arrayContaining(["source_segments_search_vector_gin", "source_segments_exact_text_trgm_gin"]));
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

  it("keeps transcript mapping separate from analysis and SAME resolution", async () => {
    const migration = await readFile(new URL("../../supabase/migrations/20260818090150_testimony_knowledge_mapping_v1.sql", import.meta.url), "utf8");
    expect(migration).toContain("'entity_merges','entity_aliases','canonical_entities'");
    expect(migration).toContain("'claim_support','support','contradictions','verification_assessments'");
    expect(migration).toContain("check(precision <> 'unknown' or (asserted_start is null and asserted_end is null))");
    expect(migration).toContain("check(relation_type not in ('causes','caused_by'))");
    expect(migration).toContain("revoke all on function public.commit_testimony_knowledge_map(jsonb) from public,anon");
    expect(migration).toContain("grant execute on function public.commit_testimony_knowledge_map(jsonb) to authenticated");
    expect(migration).not.toMatch(/grant\s+[^;]*insert[^;]*public\.case_ledger/i);
    const securityMigration = await readFile(new URL("../../supabase/migrations/20260818092634_testimony_knowledge_mapping_security.sql", import.meta.url), "utf8");
    expect(securityMigration).toContain("revoke all on public.knowledge_extraction_runs,public.case_ledger_heads,public.case_ledger");
    expect(securityMigration).toContain("grant select on public.knowledge_extraction_runs,public.case_ledger");
    expect(securityMigration).not.toMatch(/grant\s+(?:insert|update|delete|truncate|all)[^;]*authenticated/i);
  });

  it("exposes timeline candidates through a security-invoker projection without canonical writes", async () => {
    const migration = await readFile(new URL("../../supabase/migrations/20260822092008_testimony_timeline_candidate_v1.sql", import.meta.url), "utf8");
    expect(migration).toContain("create or replace view public.timeline_candidate_projection");
    expect(migration).toContain("with (security_invoker=true)");
    expect(migration).toContain("grant select on public.timeline_candidate_projection to authenticated");
    expect(migration).toContain("revoke all on function public.commit_testimony_timeline_candidates(jsonb) from public,anon");
    expect(migration).toContain("grant execute on function public.commit_testimony_timeline_candidates(jsonb) to authenticated");
    expect(migration).toContain("'canonical_events_created',0");
    expect(migration).toContain("'same_resolutions_created',0");
    expect(migration).not.toMatch(/insert\s+into\s+public\.(events|entities|entity_aliases)/i);
  });

  it("saves candidate-only reconstruction snapshots through an authenticated atomic function", async () => {
    const migration = await readFile(new URL("../../supabase/migrations/20260822143000_testimony_reconstruction_versions_v1.sql", import.meta.url), "utf8");
    expect(migration).toContain("create table public.saved_reconstruction_versions");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("candidate-only boundaries");
    expect(migration).toContain("revoke all on function public.save_reconstruction_version(uuid,text,text,jsonb) from public,anon");
    expect(migration).not.toMatch(/insert\s+into\s+public\.(events|entities|entity_aliases)/i);
  });

  it("governs Structure review through one append-only authenticated RPC", async () => {
    const migration = await readFile(new URL("../../supabase/migrations/20260822161023_structure_review_queue_v1.sql", import.meta.url), "utf8");
    expect(migration).toContain("create table public.structure_review_versions");
    expect(migration).toContain("alter table public.structure_review_versions enable row level security");
    expect(migration).toContain("revoke all on public.structure_review_versions from public,anon,authenticated");
    expect(migration).toContain("grant select on public.structure_review_versions to authenticated");
    expect(migration).toContain("create function private.can_review_case(target_case_id uuid)");
    expect(migration).toContain("member.role in ('owner','reviewer')");
    expect(migration).toContain("for update");
    expect(migration).toContain("STRUCTURE_REVIEW_STALE_VERSION");
    expect(migration).toContain("v_child_ids uuid[] := '{}'::uuid[]");
    expect(migration).toContain("revoke all on function public.review_structure_object(uuid,text,uuid,text,jsonb,text,integer) from public,anon");
    expect(migration).toContain("grant execute on function public.review_structure_object(uuid,text,uuid,text,jsonb,text,integer) to authenticated");
    expect(migration).not.toMatch(/insert\s+into\s+public\.(events|entities|entity_aliases)/i);
  });

  it("keeps claims select-only while preserving legacy promotion behind an atomic RPC", async () => {
    const migration = await readFile(new URL("../../supabase/migrations/20260822204848_protect_legacy_claim_promotion.sql", import.meta.url), "utf8");
    expect(migration).toContain("drop policy if exists claims_all on public.claims");
    expect(migration).toContain("create policy claims_select on public.claims for select to authenticated");
    expect(migration).toContain("revoke all on public.claims from authenticated");
    expect(migration).toContain("grant select on public.claims to authenticated");
    expect(migration).toContain("create function public.review_and_promote_claim");
    expect(migration).toContain("for update");
    expect(migration).toContain("grant execute on function public.review_and_promote_claim(uuid,uuid,text,text,text,timestamptz,text) to authenticated");
  });
});
