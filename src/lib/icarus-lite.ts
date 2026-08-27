import postgres from "postgres";

type LiteClient = ReturnType<typeof postgres>;

declare global {
  var __icarusLiteClient: LiteClient | undefined;
}

export type LiteSegment = {
  id: string;
  speaker_label: string;
  witness_ordinal: number;
  source_ordinal: number;
  exact_text: string;
  timestamp_start_ms: string | null;
  timestamp_end_ms: string | null;
  deep_link: string | null;
};

export type LiteSlice = {
  proceeding: {
    id: string;
    title: string;
    status: string;
    case_title: string;
    source_artifact_id: string;
    source_artifact_sha256: string;
    source_artifact_filename: string | null;
  };
  witness: {
    id: string;
    witness_label_raw: string;
    resolution_status: string;
    review_status: string;
    boundary_confidence: string;
  };
  segments: LiteSegment[];
  totalSegments: number;
};

function getLiteClient() {
  const databaseUrl = process.env.ICARUS_LITE_READ_DATABASE_URL;
  if (!databaseUrl) throw new Error("ICARUS_LITE_READ_DATABASE_URL is not configured.");

  if (!globalThis.__icarusLiteClient) {
    globalThis.__icarusLiteClient = postgres(databaseUrl, {
      max: 2,
      prepare: false,
      connect_timeout: 10,
      idle_timeout: 20,
    });
  }
  return globalThis.__icarusLiteClient;
}

function literalSearchPattern(query: string) {
  return `%${query.replace(/[\\%_]/g, "\\$&")}%`;
}

export async function readLiteSlice(query: string): Promise<LiteSlice> {
  const sql = getLiteClient();
  const search = query.trim().slice(0, 200);
  const [proceedings, witnesses, totalRows, segments] = await Promise.all([
    sql<LiteSlice["proceeding"][]>`
      select id::string, title, status, case_title,
             source_artifact_id::string, source_artifact_sha256, source_artifact_filename
      from lite.proceedings
      order by title
      limit 1
    `,
    sql<LiteSlice["witness"][]>`
      select id::string, witness_label_raw, resolution_status, review_status,
             boundary_confidence::string
      from lite.witnesses
      order by logical_order
      limit 1
    `,
    sql<{ count: number }[]>`select count(*)::int as count from lite.segments`,
    search
      ? sql<LiteSegment[]>`
          select id::string, speaker_label, witness_ordinal, source_ordinal,
                 exact_text, timestamp_start_ms::string, timestamp_end_ms::string, deep_link
          from lite.segments
          where exact_text ilike ${literalSearchPattern(search)} escape '\\'
             or speaker_label ilike ${literalSearchPattern(search)} escape '\\'
          order by witness_ordinal
        `
      : sql<LiteSegment[]>`
          select id::string, speaker_label, witness_ordinal, source_ordinal,
                 exact_text, timestamp_start_ms::string, timestamp_end_ms::string, deep_link
          from lite.segments
          order by witness_ordinal
        `,
  ]);

  if (!proceedings[0] || !witnesses[0]) {
    throw new Error("The Icarus Lite projection has not been published.");
  }

  return {
    proceeding: proceedings[0],
    witness: witnesses[0],
    segments,
    totalSegments: Number(totalRows[0]?.count ?? 0),
  };
}
