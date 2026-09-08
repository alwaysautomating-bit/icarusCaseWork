import postgres from "postgres";

type LiteClient = ReturnType<typeof postgres>;

declare global {
  var __icarusLiteClient: LiteClient | undefined;
}

export type LiteProceeding = {
  id: string; title: string; status: string; case_title: string;
  source_artifact_id: string; source_artifact_sha256: string;
  source_artifact_filename: string | null; canonical_url: string | null;
  witness_count: number; segment_count: number;
};

export type LiteWitness = {
  id: string; proceeding_id: string; witness_label_raw: string;
  resolution_status: string; review_status: string; boundary_confidence: string;
  logical_order: string; segment_count: number;
};

export type LiteSegment = {
  id: string; proceeding_id: string; witness_id: string; speaker_label: string;
  witness_ordinal: number; source_ordinal: number; exact_text: string;
  timestamp_start_ms: string | null; timestamp_end_ms: string | null; deep_link: string | null;
};

export type LiteSlice = {
  proceedings: LiteProceeding[]; witnesses: LiteWitness[];
  proceeding: LiteProceeding; witness: LiteWitness | null; segments: LiteSegment[];
  matchCount: number; totalSegments: number;
};

function getLiteClient() {
  const databaseUrl = process.env.ICARUS_LITE_READ_DATABASE_URL;
  if (!databaseUrl) throw new Error("ICARUS_LITE_READ_DATABASE_URL is not configured.");
  if (!globalThis.__icarusLiteClient) {
    globalThis.__icarusLiteClient = postgres(databaseUrl, {
      max: 2, prepare: false, connect_timeout: 10, idle_timeout: 20,
    });
  }
  return globalThis.__icarusLiteClient;
}

function literalSearchPattern(query: string) {
  return `%${query.replace(/[\\%_]/g, "\\$&")}%`;
}

export async function readLiteSlice(input: {
  query?: string; proceedingId?: string; witnessId?: string;
}): Promise<LiteSlice> {
  const sql = getLiteClient();
  const search = input.query?.trim().slice(0, 200) ?? "";
  const proceedings = await sql<LiteProceeding[]>`
    select p.id::string, p.title, p.status, p.case_title,
           p.source_artifact_id::string, p.source_artifact_sha256,
           p.source_artifact_filename, p.canonical_url,
           count(distinct w.id)::int as witness_count,
           count(distinct s.id)::int as segment_count
    from lite.proceedings p
    left join lite.witnesses w on w.proceeding_id = p.id
    left join lite.segments s on s.proceeding_id = p.id
    group by p.id, p.title, p.status, p.case_title, p.source_artifact_id,
             p.source_artifact_sha256, p.source_artifact_filename, p.canonical_url, p.proceeding_date
    order by coalesce(p.proceeding_date, '9999-12-31'::date), p.title
  `;
  if (proceedings.length === 0) throw new Error("The Icarus Lite projection has not been published.");
  const proceeding = proceedings.find((item) => item.id === input.proceedingId)
    ?? proceedings.find((item) => Number(item.witness_count) > 0)
    ?? proceedings[0];
  const witnesses = await sql<LiteWitness[]>`
    select w.id::string, w.proceeding_id::string, w.witness_label_raw,
           w.resolution_status, w.review_status, w.boundary_confidence::string,
           w.logical_order::string, count(s.id)::int as segment_count
    from lite.witnesses w
    left join lite.segments s on s.witness_id = w.id
    where w.proceeding_id = ${proceeding.id}::uuid
    group by w.id, w.proceeding_id, w.witness_label_raw, w.resolution_status,
             w.review_status, w.boundary_confidence, w.logical_order
    order by w.logical_order
  `;
  const witness = witnesses.find((item) => item.id === input.witnessId) ?? witnesses[0] ?? null;
  const pattern = literalSearchPattern(search);
  const segments = !witness ? [] : search
    ? await sql<LiteSegment[]>`
        select id::string, proceeding_id::string, witness_id::string, speaker_label,
               witness_ordinal, source_ordinal, exact_text,
               timestamp_start_ms::string, timestamp_end_ms::string, deep_link
        from lite.segments
        where witness_id = ${witness.id}::uuid
          and (exact_text ilike ${pattern} escape '\\' or speaker_label ilike ${pattern} escape '\\')
        order by witness_ordinal limit 250
      `
    : await sql<LiteSegment[]>`
        select id::string, proceeding_id::string, witness_id::string, speaker_label,
               witness_ordinal, source_ordinal, exact_text,
               timestamp_start_ms::string, timestamp_end_ms::string, deep_link
        from lite.segments where witness_id = ${witness.id}::uuid order by witness_ordinal
      `;
  return {
    proceedings, witnesses, proceeding, witness, segments,
    matchCount: segments.length,
    totalSegments: proceedings.reduce((sum, item) => sum + Number(item.segment_count), 0),
  };
}
