import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import nextEnv from "@next/env";
import postgres from "postgres";

const { loadEnvConfig } = nextEnv;

const SOURCE_CONTAINER = process.env.ICARUS_CASEWORK_DB_CONTAINER ?? "supabase_db_IcarusCasework";
const PROCEEDING_TITLE = "MA v. Lindsay Clancy Day 3";
const WITNESS_LABEL = "Jennifer Stratton";
const EXPECTED_SEGMENTS = 122;
const READ_ROLE = "icarus_lite_app";

type SourceEnvelope = { kind: "proceeding" | "witness" | "speaker" | "segment"; row: Record<string, unknown> };

type SourceSnapshot = {
  proceeding: Record<string, unknown>;
  witness: Record<string, unknown>;
  speakers: Record<string, unknown>[];
  segments: Record<string, unknown>[];
};

function quoteLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function projectRow(row: Record<string, unknown>, columns: readonly string[]) {
  return Object.fromEntries(columns.map((column) => [column, row[column] ?? null]));
}

function loadLocalEnvironment() {
  loadEnvConfig(process.cwd());
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required in .env.local.`);
  return value;
}

function sourceSql() {
  const proceedingTitle = quoteLiteral(PROCEEDING_TITLE);
  const witnessLabel = quoteLiteral(WITNESS_LABEL);
  const sliceWhere = `p.title = ${proceedingTitle} and wb.witness_label_raw = ${witnessLabel}`;

  return String.raw`
begin transaction isolation level repeatable read read only;

copy (
  select json_build_object('kind', 'proceeding', 'row', row_to_json(q))
  from (
    select p.id, p.case_id, c.title as case_title, p.source_id, s.title as source_title,
           sl.id as source_lineage_id, sl.lineage_key as source_lineage_key,
           p.source_artifact_id, sa.title as source_artifact_title,
           sa.sha256 as source_artifact_sha256, sa.original_filename as source_artifact_filename,
           sa.source_url, sa.canonical_url, p.title, p.proceeding_date, p.status
    from public.proceedings p
    join public.cases c on c.id = p.case_id
    join public.sources s on s.id = p.source_id
    join public.source_artifacts sa on sa.id = p.source_artifact_id
    join public.source_lineages sl on sl.id = sa.source_lineage_id
    where p.title = ${proceedingTitle}
  ) q
) to stdout;

copy (
  select json_build_object('kind', 'witness', 'row', row_to_json(q))
  from (
    select wb.id, wb.proceeding_id, wb.object_code, wb.witness_label_raw,
           wb.resolved_entity_id, wb.resolution_status, wb.resolution_basis,
           wb.review_status, wb.boundary_confidence, wb.start_segment_id,
           wb.end_segment_id, wb.start_timestamp_ms, wb.end_timestamp_ms,
           wb.logical_order
    from public.witness_blocks wb
    join public.proceedings p on p.id = wb.proceeding_id
    where ${sliceWhere}
  ) q
) to stdout;

copy (
  select json_build_object('kind', 'speaker', 'row', row_to_json(q))
  from (
    select ps.id, ps.proceeding_id, ps.provider_label, ps.canonical_name,
           ps.role, ps.review_required
    from public.proceeding_speakers ps
    where ps.id in (
      select distinct ss.proceeding_speaker_id
      from public.witness_block_segments wbs
      join public.witness_blocks wb on wb.id = wbs.witness_block_id
      join public.proceedings p on p.id = wb.proceeding_id
      join public.source_segments ss on ss.id = wbs.source_segment_id
      where ${sliceWhere}
    )
    order by ps.provider_label, ps.id
  ) q
) to stdout;

copy (
  select json_build_object('kind', 'segment', 'row', row_to_json(q))
  from (
    select ss.id, p.id as proceeding_id, wb.id as witness_id,
           ss.proceeding_speaker_id as speaker_id,
           coalesce(ps.provider_label, 'Unknown speaker') as speaker_label,
           wbs.ordinal as witness_ordinal, ss.ordinal as source_ordinal,
           ss.exact_text, ss.timestamp_start_ms, ss.timestamp_end_ms,
           ss.deep_link, ss.locator, ss.transcript_provider,
           ss.artifact_id as source_artifact_id, sa.sha256 as source_artifact_sha256
    from public.witness_block_segments wbs
    join public.witness_blocks wb on wb.id = wbs.witness_block_id
    join public.proceedings p on p.id = wb.proceeding_id
    join public.source_segments ss on ss.id = wbs.source_segment_id
    join public.source_artifacts sa on sa.id = ss.artifact_id
    left join public.proceeding_speakers ps on ps.id = ss.proceeding_speaker_id
    where ${sliceWhere}
    order by wbs.ordinal
  ) q
) to stdout;

commit;
`;
}

function readCaseworkSlice(): SourceSnapshot {
  const output = execFileSync(
    "docker",
    ["exec", "-i", SOURCE_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1"],
    { input: sourceSql(), encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );

  const envelopes = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("{"))
    .map((line) => JSON.parse(line) as SourceEnvelope);

  const proceedings = envelopes.filter((item) => item.kind === "proceeding").map((item) => item.row);
  const witnesses = envelopes.filter((item) => item.kind === "witness").map((item) => item.row);
  const speakers = envelopes.filter((item) => item.kind === "speaker").map((item) => item.row);
  const segments = envelopes.filter((item) => item.kind === "segment").map((item) => item.row);

  if (proceedings.length !== 1 || witnesses.length !== 1) {
    throw new Error(`Expected one proceeding and one witness; received ${proceedings.length} and ${witnesses.length}.`);
  }
  if (segments.length !== EXPECTED_SEGMENTS) {
    throw new Error(`Expected ${EXPECTED_SEGMENTS} source segments; received ${segments.length}.`);
  }

  const segmentIds = new Set(segments.map((row) => String(row.id)));
  const witnessOrdinals = segments.map((row) => Number(row.witness_ordinal));
  if (segmentIds.size !== EXPECTED_SEGMENTS || new Set(witnessOrdinals).size !== EXPECTED_SEGMENTS) {
    throw new Error("The selected Casework slice contains duplicate segment IDs or witness ordinals.");
  }
  if (witnessOrdinals.some((ordinal, index) => ordinal !== index)) {
    throw new Error("The selected Casework slice is not continuously ordered from 0 through 121.");
  }

  return { proceeding: proceedings[0], witness: witnesses[0], speakers, segments };
}

function upsertLocalEnv(name: string, value: string) {
  const envPath = resolve(process.cwd(), ".env.local");
  let contents = readFileSync(envPath, "utf8");
  const replacement = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, "m");
  contents = pattern.test(contents)
    ? contents.replace(pattern, replacement)
    : `${contents.trimEnd()}\n${replacement}\n`;
  writeFileSync(envPath, contents, "utf8");
  process.env[name] = value;
}

function getOrCreateReadUrl(adminUrl: string) {
  const existing = process.env.ICARUS_LITE_READ_DATABASE_URL;
  if (existing) {
    const parsed = new URL(existing);
    if (decodeURIComponent(parsed.username) !== READ_ROLE || !parsed.password) {
      throw new Error(`ICARUS_LITE_READ_DATABASE_URL must use the ${READ_ROLE} role and include its password.`);
    }
    return existing;
  }

  const parsed = new URL(adminUrl);
  parsed.username = READ_ROLE;
  parsed.password = randomBytes(24).toString("base64url");
  const readUrl = parsed.toString();
  upsertLocalEnv("ICARUS_LITE_READ_DATABASE_URL", readUrl);
  return readUrl;
}

async function createReadRole(admin: postgres.Sql, adminUrl: string, readUrl: string) {
  const parsed = new URL(readUrl);
  const password = decodeURIComponent(parsed.password);
  const [{ current_database: databaseName }] = await admin<{ current_database: string }[]>`select current_database()`;

  await admin.unsafe(`create role if not exists ${quoteIdentifier(READ_ROLE)}`);
  await admin.unsafe(`alter role ${quoteIdentifier(READ_ROLE)} with login password ${quoteLiteral(password)}`);
  await admin.unsafe(`grant connect on database ${quoteIdentifier(databaseName)} to ${quoteIdentifier(READ_ROLE)}`);
  await admin.unsafe(`grant usage on schema lite to ${quoteIdentifier(READ_ROLE)}`);
  await admin.unsafe(
    `grant select on table lite.proceedings, lite.witnesses, lite.speakers, lite.segments to ${quoteIdentifier(READ_ROLE)}`,
  );

  if (new URL(adminUrl).username === parsed.username) {
    throw new Error("The application read role must differ from the Cockroach publication user.");
  }
}

async function publish() {
  loadLocalEnvironment();
  const adminUrl = requiredEnv("ICARUS_LITE_DATABASE_URL");
  const source = readCaseworkSlice();
  const admin = postgres(adminUrl, { max: 1, prepare: false, connect_timeout: 15, idle_timeout: 5 });

  try {
    const schema = readFileSync(resolve(process.cwd(), "cockroach", "icarus-lite-schema.sql"), "utf8");
    await admin.unsafe(schema);

    await admin.begin(async (transaction) => {
      const proceedingColumns = [
        "id", "case_id", "case_title", "source_id", "source_title",
        "source_lineage_id", "source_lineage_key", "source_artifact_id",
        "source_artifact_title", "source_artifact_sha256", "source_artifact_filename",
        "source_url", "canonical_url", "title", "proceeding_date", "status",
      ] as const;
      const proceeding = projectRow(source.proceeding, proceedingColumns);
      await transaction`
        insert into lite.proceedings ${transaction([proceeding], ...proceedingColumns)}
        on conflict (id) do update set
          case_title = excluded.case_title,
          source_title = excluded.source_title,
          source_lineage_key = excluded.source_lineage_key,
          source_artifact_title = excluded.source_artifact_title,
          source_artifact_sha256 = excluded.source_artifact_sha256,
          source_artifact_filename = excluded.source_artifact_filename,
          source_url = excluded.source_url,
          canonical_url = excluded.canonical_url,
          title = excluded.title,
          proceeding_date = excluded.proceeding_date,
          status = excluded.status
      `;

      const witnessColumns = [
        "id", "proceeding_id", "object_code", "witness_label_raw", "resolved_entity_id",
        "resolution_status", "resolution_basis", "review_status", "boundary_confidence",
        "start_segment_id", "end_segment_id", "start_timestamp_ms", "end_timestamp_ms", "logical_order",
      ] as const;
      await transaction`
        insert into lite.witnesses ${transaction([projectRow(source.witness, witnessColumns)], ...witnessColumns)}
        on conflict (id) do update set
          object_code = excluded.object_code,
          witness_label_raw = excluded.witness_label_raw,
          resolved_entity_id = excluded.resolved_entity_id,
          resolution_status = excluded.resolution_status,
          resolution_basis = excluded.resolution_basis,
          review_status = excluded.review_status,
          boundary_confidence = excluded.boundary_confidence,
          start_segment_id = excluded.start_segment_id,
          end_segment_id = excluded.end_segment_id,
          start_timestamp_ms = excluded.start_timestamp_ms,
          end_timestamp_ms = excluded.end_timestamp_ms,
          logical_order = excluded.logical_order
      `;

      const speakerColumns = ["id", "proceeding_id", "provider_label", "canonical_name", "role", "review_required"] as const;
      const speakers = source.speakers.map((speaker) => projectRow(speaker, speakerColumns));
      await transaction`
        insert into lite.speakers ${transaction(speakers, ...speakerColumns)}
        on conflict (id) do update set
          provider_label = excluded.provider_label,
          canonical_name = excluded.canonical_name,
          role = excluded.role,
          review_required = excluded.review_required
      `;

      const segmentColumns = [
        "id", "proceeding_id", "witness_id", "speaker_id", "speaker_label",
        "witness_ordinal", "source_ordinal", "exact_text", "text_sha256",
        "timestamp_start_ms", "timestamp_end_ms", "deep_link", "locator",
        "transcript_provider", "source_artifact_id", "source_artifact_sha256",
      ] as const;
      const segments: Record<string, unknown>[] = source.segments.map((segment) => projectRow({
        ...segment,
        locator: JSON.stringify(segment.locator),
        text_sha256: sha256(String(segment.exact_text)),
      }, segmentColumns));
      await transaction`
        insert into lite.segments ${transaction(segments, ...segmentColumns)}
        on conflict (id) do update set
          speaker_id = excluded.speaker_id,
          speaker_label = excluded.speaker_label,
          witness_ordinal = excluded.witness_ordinal,
          source_ordinal = excluded.source_ordinal,
          exact_text = excluded.exact_text,
          text_sha256 = excluded.text_sha256,
          timestamp_start_ms = excluded.timestamp_start_ms,
          timestamp_end_ms = excluded.timestamp_end_ms,
          deep_link = excluded.deep_link,
          locator = excluded.locator,
          transcript_provider = excluded.transcript_provider,
          source_artifact_id = excluded.source_artifact_id,
          source_artifact_sha256 = excluded.source_artifact_sha256
      `;
    });

    const readUrl = getOrCreateReadUrl(adminUrl);
    await createReadRole(admin, adminUrl, readUrl);
    console.log(`Published ${source.segments.length} ordered segments for ${WITNESS_LABEL}.`);
    console.log(`Created/verified SELECT-only role ${READ_ROLE}; its URL is stored only in .env.local.`);
  } finally {
    await admin.end();
  }
}

async function validate() {
  loadLocalEnvironment();
  const source = readCaseworkSlice();
  const readUrl = requiredEnv("ICARUS_LITE_READ_DATABASE_URL");
  const read = postgres(readUrl, { max: 1, prepare: false, connect_timeout: 15, idle_timeout: 5 });

  try {
    const [rawCounts] = await read<{
      proceedings: string; witnesses: string; speakers: string; segments: string;
    }[]>`
      select
        (select count(*)::int from lite.proceedings) as proceedings,
        (select count(*)::int from lite.witnesses) as witnesses,
        (select count(*)::int from lite.speakers) as speakers,
        (select count(*)::int from lite.segments) as segments
    `;
    const targetSegments = await read<{ id: string; witness_ordinal: number; exact_text: string; text_sha256: string }[]>`
      select id::string, witness_ordinal, exact_text, text_sha256
      from lite.segments
      order by witness_ordinal
    `;
    const [rawIntegrity] = await read<{ duplicate_ordinals: string; orphan_links: string; broken_boundaries: string }[]>`
      select
        (select count(*)::int from (
          select witness_id, witness_ordinal from lite.segments
          group by witness_id, witness_ordinal having count(*) > 1
        )) as duplicate_ordinals,
        (select count(*)::int from lite.segments s
          left join lite.proceedings p on p.id = s.proceeding_id
          left join lite.witnesses w on w.id = s.witness_id
          left join lite.speakers sp on sp.id = s.speaker_id
          where p.id is null or w.id is null or (s.speaker_id is not null and sp.id is null)
        ) as orphan_links,
        (select count(*)::int from lite.witnesses w
          left join lite.segments first_segment on first_segment.id = w.start_segment_id
          left join lite.segments last_segment on last_segment.id = w.end_segment_id
          where first_segment.id is null or last_segment.id is null
        ) as broken_boundaries
    `;
    const [witness] = await read<{
      resolution_status: string; resolved_entity_id: string | null; review_status: string; boundary_confidence: string;
    }[]>`
      select resolution_status, resolved_entity_id::string, review_status, boundary_confidence::string
      from lite.witnesses
    `;

    let writeDenied = false;
    try {
      await read`update lite.segments set exact_text = exact_text where false`;
    } catch {
      writeDenied = true;
    }

    const sourceIds = source.segments.map((row) => String(row.id));
    const counts = {
      proceedings: Number(rawCounts.proceedings),
      witnesses: Number(rawCounts.witnesses),
      speakers: Number(rawCounts.speakers),
      segments: Number(rawCounts.segments),
    };
    const integrity = {
      duplicate_ordinals: Number(rawIntegrity.duplicate_ordinals),
      orphan_links: Number(rawIntegrity.orphan_links),
      broken_boundaries: Number(rawIntegrity.broken_boundaries),
    };
    const targetIds = targetSegments.map((row) => row.id);
    const orderedIdsMatch = sourceIds.length === targetIds.length && sourceIds.every((id, index) => id === targetIds[index]);
    const sourceById = new Map(source.segments.map((row) => [String(row.id), String(row.exact_text)]));
    const textHashesMatch = targetSegments.every((row) => {
      const sourceText = sourceById.get(row.id);
      return sourceText === row.exact_text && sha256(row.exact_text) === row.text_sha256;
    });
    const unresolvedPreserved =
      witness.resolution_status === source.witness.resolution_status &&
      witness.resolved_entity_id === source.witness.resolved_entity_id &&
      witness.review_status === source.witness.review_status &&
      Number(witness.boundary_confidence) === Number(source.witness.boundary_confidence);

    const result = {
      counts,
      expected: { proceedings: 1, witnesses: 1, speakers: source.speakers.length, segments: EXPECTED_SEGMENTS },
      ordered_segment_ids_match: orderedIdsMatch,
      text_hashes_match: textHashesMatch,
      duplicate_ordinals: integrity.duplicate_ordinals,
      orphan_links: integrity.orphan_links,
      broken_witness_boundaries: integrity.broken_boundaries,
      unresolved_witness_preserved: unresolvedPreserved,
      select_only_role_write_denied: writeDenied,
    };

    const passed =
      counts.proceedings === 1 && counts.witnesses === 1 &&
      counts.speakers === source.speakers.length && counts.segments === EXPECTED_SEGMENTS &&
      orderedIdsMatch && textHashesMatch && integrity.duplicate_ordinals === 0 &&
      integrity.orphan_links === 0 && integrity.broken_boundaries === 0 &&
      unresolvedPreserved && writeDenied;

    console.log(JSON.stringify({ passed, ...result }, null, 2));
    if (!passed) process.exitCode = 1;
  } finally {
    await read.end();
  }
}

const command = process.argv[2];
if (command === "publish") await publish();
else if (command === "validate") await validate();
else throw new Error("Usage: tsx scripts/icarus-lite.ts <publish|validate>");
