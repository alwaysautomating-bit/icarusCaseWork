import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { z } from "zod";
import { exactCharacterLocator } from "@/lib/citation";
import { assertDistinctClaims, lineageKinds } from "@/lib/evidence-graph";
import type { CaseActor } from "@/lib/authority";
import { getObjectStorage } from "@/lib/object-storage";
import { buildSourceLocator, type SourceLocator } from "@/lib/source-locator";

const dataRoot = process.env.ICARUS_DATA_DIR
  ? path.resolve(/* turbopackIgnore: true */ process.env.ICARUS_DATA_DIR)
  : path.join(process.cwd(), ".data");
const databasePath = path.join(dataRoot, "icarus-casework");
const caseId = "11111111-1111-4111-8111-111111111111";

let dbPromise: Promise<PGlite> | undefined;

async function database() {
  if (!dbPromise) {
    dbPromise = (async () => {
      await mkdir(dataRoot, { recursive: true });
      const db = new PGlite(databasePath);
      await db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
      const migrations = [
        ["0001_source_linked_slice", "src/db/migration.sql"],
        ["0002_evidence_graph", "src/db/migration-0002-evidence-graph.sql"],
        ["0003_reconstruction_views", "src/db/migration-0003-reconstruction-views.sql"],
        ["0004_incident_anchor", "src/db/migration-0004-incident-anchor.sql"],
      ] as const;
      for (const [name, file] of migrations) {
        const applied = await db.query<{ name: string }>("SELECT name FROM schema_migrations WHERE name = $1", [name]);
        if (applied.rows.length === 0) {
          await db.exec(await readFile(path.join(/* turbopackIgnore: true */ process.cwd(), file), "utf8"));
          await db.query("INSERT INTO schema_migrations(name) VALUES ($1)", [name]);
        }
      }
      await db.query(
        "INSERT INTO cases(id,title,purpose,public_record_cutoff) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING",
        [caseId, "Source-linked proof case", "Demonstrate claim and event separation with public or authorized text.", "2026-08-13T23:59:59Z"],
      );
      return db;
    })();
  }
  return dbPromise;
}

const ingestInput = z.object({
  title: z.string().trim().min(3).max(160),
  acquiredFrom: z.string().trim().min(3).max(240),
  mediaType: z.enum(["text/plain", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/vtt", "image/jpeg", "image/png", "text/csv", "audio/mpeg", "video/mp4"]),
  locatorType: z.enum(["character_offset", "page", "timestamp", "spreadsheet_range", "image_region"]),
  page: z.string().optional(), timestampStart: z.string().optional(), timestampEnd: z.string().optional(),
  sheet: z.string().optional(), range: z.string().optional(), imageRegion: z.string().optional(),
  sourceText: z.string().trim().min(20).max(100_000),
  claimant: z.string().trim().min(2).max(120),
  assertion: z.string().trim().min(5).max(2_000),
  exactQuote: z.string().trim().min(5).max(4_000),
  claimedEventTime: z.string().optional(),
  authorized: z.literal("on"),
});

async function audit(tx: Transaction, actor: CaseActor, action: string, subjectType: string, subjectId: string, details: Record<string, unknown> = {}) {
  await tx.query("INSERT INTO audit_events(id,case_id,actor_id,action,subject_type,subject_id,details) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)", [randomUUID(), caseId, actor.id, action, subjectType, subjectId, JSON.stringify(details)]);
}

export async function ingestClaim(actor: CaseActor, raw: Record<string, FormDataEntryValue>) {
  const input = ingestInput.parse(raw);
  const locator = buildSourceLocator(input, exactCharacterLocator(input.sourceText, input.exactQuote));
  const bytes = Buffer.from(input.sourceText, "utf8");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const artifactId = randomUUID();
  const segmentId = randomUUID();
  const claimId = randomUUID();
  const objectKey = `${sha256}.source`;
  const db = await database();
  const preserved = await db.query<{ id: string; object_key: string }>("SELECT id,object_key FROM source_artifacts WHERE case_id=$1 AND sha256=$2", [caseId, sha256]);
  const storedObject = preserved.rows[0]
    ? { key: preserved.rows[0].object_key, provider: "existing" }
    : await getObjectStorage(dataRoot).putImmutable({ key: objectKey, bytes, contentType: input.mediaType });
  await db.transaction(async (tx) => {
    const existing = await tx.query<{ id: string }>("SELECT id FROM source_artifacts WHERE case_id=$1 AND sha256=$2", [caseId, sha256]);
    const finalArtifactId = existing.rows[0]?.id ?? artifactId;
    if (!existing.rows[0]) await tx.query("INSERT INTO source_artifacts(id,case_id,title,media_type,sha256,byte_length,object_key,acquired_from,is_authorized) VALUES($1,$2,$3,$4,$5,$6,$7,$8,true)", [artifactId, caseId, input.title, input.mediaType, sha256, bytes.length, storedObject.key, input.acquiredFrom]);
    await tx.query("INSERT INTO source_segments(id,artifact_id,locator_type,locator,exact_text) VALUES($1,$2,$3,$4::jsonb,$5)", [segmentId, finalArtifactId, locator.type, JSON.stringify(locator), input.exactQuote]);
    await tx.query("INSERT INTO claims(id,case_id,source_segment_id,claimant,assertion,claimed_event_time) VALUES($1,$2,$3,$4,$5,$6)", [claimId, caseId, segmentId, input.claimant, input.assertion, input.claimedEventTime || null]);
    await audit(tx, actor, "claim.created", "claim", claimId, { artifactId: finalArtifactId, locator, storageProvider: storedObject.provider });
  });
}

export async function reviewAndPromote(actor: CaseActor, claimId: string, rationale: string, eventTitle: string, precision: string, eventTimeEnd?: string, uncertaintyNote = "") {
  const input = z.object({ claimId: z.string().uuid(), rationale: z.string().trim().min(5), eventTitle: z.string().trim().min(5), precision: z.enum(["exact", "approximate", "interval", "relative", "unknown"]), eventTimeEnd: z.string().optional(), uncertaintyNote: z.string().trim().max(1000) }).parse({ claimId, rationale, eventTitle, precision, eventTimeEnd, uncertaintyNote });
  const db = await database();
  await db.transaction(async (tx) => {
    const claim = await tx.query<{ claimed_event_time: string | null; status: string }>("SELECT claimed_event_time,status FROM claims WHERE id=$1 FOR UPDATE", [input.claimId]);
    if (!claim.rows[0]) throw new Error("Claim not found.");
    if (claim.rows[0].status !== "candidate") throw new Error("Claim has already been reviewed.");
    await tx.query("UPDATE claims SET status='accepted' WHERE id=$1", [input.claimId]);
    const eventId = randomUUID();
    await tx.query("INSERT INTO review_decisions(id,claim_id,reviewer_name,disposition,rationale) VALUES($1,$2,$3,'accepted',$4)", [randomUUID(), input.claimId, actor.name, input.rationale]);
    await tx.query("INSERT INTO events(id,case_id,promoted_from_claim_id,title,event_time_start,event_time_end,time_precision,epistemic_state,uncertainty_note) VALUES($1,$2,$3,$4,$5,$6,$7,'reviewed_observable',$8)", [eventId, caseId, input.claimId, input.eventTitle, claim.rows[0].claimed_event_time, input.eventTimeEnd || null, input.precision, input.uncertaintyNote]);
    await audit(tx, actor, "claim.accepted_and_event.promoted", "event", eventId, { claimId: input.claimId, precision: input.precision });
  });
}

export async function createEntity(actor: CaseActor, raw: Record<string, FormDataEntryValue>) {
  const input = z.object({ canonicalName: z.string().trim().min(2).max(160), kind: z.enum(["person", "organization", "location", "device", "proceeding", "system_node"]), aliases: z.string().max(500).default(""), description: z.string().max(1000).default("") }).parse(raw);
  const db = await database();
  const entityId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.query("INSERT INTO entities(id,case_id,canonical_name,kind,description) VALUES($1,$2,$3,$4,$5)", [entityId, caseId, input.canonicalName, input.kind, input.description]);
    for (const alias of input.aliases.split(",").map((value) => value.trim()).filter(Boolean)) await tx.query("INSERT INTO entity_aliases(id,entity_id,alias) VALUES($1,$2,$3)", [randomUUID(), entityId, alias]);
    await audit(tx, actor, "entity.created", "entity", entityId, { kind: input.kind, aliases: input.aliases });
  });
}

export async function addProvenance(actor: CaseActor, artifactId: string, entityId: string, role: string, note: string) {
  const input = z.object({ artifactId: z.string().uuid(), entityId: z.string().uuid(), role: z.enum(["originator", "publisher", "custodian", "submitter"]), note: z.string().trim().max(500) }).parse({ artifactId, entityId, role, note });
  const db = await database();
  const id = randomUUID();
  await db.transaction(async (tx) => {
    await tx.query("INSERT INTO artifact_provenance(id,artifact_id,role,entity_id,note) VALUES($1,$2,$3,$4,$5)", [id, input.artifactId, input.role, input.entityId, input.note]);
    await audit(tx, actor, "artifact.provenance_added", "artifact", input.artifactId, { entityId: input.entityId, role: input.role });
  });
}

export async function linkClaims(actor: CaseActor, parentClaimId: string, childClaimId: string, kind: string, rationale: string) {
  assertDistinctClaims(parentClaimId, childClaimId);
  const input = z.object({ parentClaimId: z.string().uuid(), childClaimId: z.string().uuid(), kind: z.enum(lineageKinds), rationale: z.string().trim().min(5).max(1000) }).parse({ parentClaimId, childClaimId, kind, rationale });
  const db = await database();
  await db.transaction(async (tx) => {
    await tx.query("INSERT INTO claim_lineage(parent_claim_id,child_claim_id,kind,rationale) VALUES($1,$2,$3,$4)", [input.parentClaimId, input.childClaimId, input.kind, input.rationale]);
    await audit(tx, actor, "claim.lineage_added", "claim", input.childClaimId, { parentClaimId: input.parentClaimId, kind: input.kind });
  });
}

export async function createContradiction(actor: CaseActor, title: string, description: string, firstClaimId: string, secondClaimId: string) {
  assertDistinctClaims(firstClaimId, secondClaimId);
  const input = z.object({ title: z.string().trim().min(4).max(180), description: z.string().trim().min(10).max(2000), firstClaimId: z.string().uuid(), secondClaimId: z.string().uuid() }).parse({ title, description, firstClaimId, secondClaimId });
  const db = await database();
  const contradictionId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.query("INSERT INTO contradictions(id,case_id,title,description) VALUES($1,$2,$3,$4)", [contradictionId, caseId, input.title, input.description]);
    await tx.query("INSERT INTO contradiction_claims(contradiction_id,claim_id,position) VALUES($1,$2,'account_a'),($1,$3,'account_b')", [contradictionId, input.firstClaimId, input.secondClaimId]);
    await audit(tx, actor, "contradiction.created", "contradiction", contradictionId, { claimIds: [input.firstClaimId, input.secondClaimId] });
  });
}

export async function disposeContradiction(actor: CaseActor, contradictionId: string, disposition: string, rationale: string, evidenceClaimId?: string) {
  const input = z.object({ contradictionId: z.string().uuid(), disposition: z.enum(["resolved_by_evidence", "clarified", "superseded", "cancelled"]), rationale: z.string().trim().min(10).max(2000), evidenceClaimId: z.string().uuid().optional() }).parse({ contradictionId, disposition, rationale, evidenceClaimId: evidenceClaimId || undefined });
  if (input.disposition !== "cancelled" && !input.evidenceClaimId) throw new Error("This disposition requires an evidence claim.");
  const db = await database();
  await db.transaction(async (tx) => {
    const current = await tx.query<{ status: string }>("SELECT status FROM contradictions WHERE id=$1 FOR UPDATE", [input.contradictionId]);
    if (!current.rows[0] || current.rows[0].status !== "unresolved") throw new Error("Only unresolved contradictions can receive a terminal disposition.");
    await tx.query("INSERT INTO contradiction_dispositions(id,contradiction_id,disposition,rationale,evidence_claim_id,actor_id) VALUES($1,$2,$3,$4,$5,$6)", [randomUUID(), input.contradictionId, input.disposition, input.rationale, input.evidenceClaimId || null, actor.id]);
    await tx.query("UPDATE contradictions SET status=$2 WHERE id=$1", [input.contradictionId, input.disposition]);
    await audit(tx, actor, "contradiction.disposed", "contradiction", input.contradictionId, { disposition: input.disposition, evidenceClaimId: input.evidenceClaimId });
  });
}

export async function saveResearchView(actor: CaseActor, name: string, researchWindow: string, includeUnresolved: boolean) {
  const input = z.object({ name: z.string().trim().min(3).max(120), researchWindow: z.enum(["all", "ninety_days", "thirty_days", "incident_window"]), includeUnresolved: z.boolean() }).parse({ name, researchWindow, includeUnresolved });
  const db = await database();
  const id = randomUUID();
  await db.transaction(async (tx) => {
    await tx.query("INSERT INTO saved_research_views(id,case_id,name,research_window,include_unresolved,created_by) VALUES($1,$2,$3,$4,$5,$6)", [id, caseId, input.name, input.researchWindow, input.includeUnresolved, actor.id]);
    await audit(tx, actor, "research_view.saved", "saved_research_view", id, { window: input.researchWindow, includeUnresolved: input.includeUnresolved });
  });
}

type ClaimRow = { id: string; assertion: string; claimant: string; status: string; exact_text: string; locator: SourceLocator; artifact_title: string; event_title: string | null; event_time_start: string | null; event_time_end: string | null; time_precision: string | null; uncertainty_note: string | null; rationale: string | null };
export type Workspace = { caseTitle: string; incidentAt: string | null; incidentWindowStart: string | null; incidentWindowEnd: string | null; artifacts: Array<{ id: string; title: string; sha256: string; acquired_from: string }>; claims: ClaimRow[]; entities: Array<{ id: string; canonical_name: string; kind: string; description: string; aliases: string[] }>; provenance: Array<{ artifact_title: string; canonical_name: string; role: string; note: string }>; lineage: Array<{ parent_assertion: string; child_assertion: string; kind: string; rationale: string }>; contradictions: Array<{ id: string; title: string; description: string; status: string; claim_count: number; disposition_rationale: string | null }>; savedViews: Array<{ id: string; name: string; research_window: string; include_unresolved: boolean }>; audit: Array<{ action: string; subject_type: string; occurred_at: string }> };

export async function getWorkspace(): Promise<Workspace> {
  const db = await database();
  const [caseResult, artifacts, claims, entities, provenance, lineage, contradictions, savedViews, auditRows] = await Promise.all([
    db.query<{ title: string; incident_at: string | null; incident_window_start: string | null; incident_window_end: string | null }>("SELECT title,incident_at,incident_window_start,incident_window_end FROM cases WHERE id=$1", [caseId]),
    db.query<{ id: string; title: string; sha256: string; acquired_from: string }>("SELECT id,title,sha256,acquired_from FROM source_artifacts WHERE case_id=$1 ORDER BY created_at DESC", [caseId]),
    db.query<Workspace["claims"][number]>(`SELECT c.id,c.assertion,c.claimant,c.status,s.exact_text,s.locator,a.title artifact_title,e.title event_title,e.event_time_start,e.event_time_end,e.time_precision,e.uncertainty_note,r.rationale FROM claims c JOIN source_segments s ON s.id=c.source_segment_id JOIN source_artifacts a ON a.id=s.artifact_id LEFT JOIN events e ON e.promoted_from_claim_id=c.id LEFT JOIN LATERAL (SELECT rationale FROM review_decisions WHERE claim_id=c.id ORDER BY reviewed_at DESC LIMIT 1) r ON true WHERE c.case_id=$1 ORDER BY c.created_at DESC`, [caseId]),
    db.query<Workspace["entities"][number]>(`SELECT e.id,e.canonical_name,e.kind,e.description,COALESCE(array_agg(a.alias) FILTER (WHERE a.alias IS NOT NULL),'{}') aliases FROM entities e LEFT JOIN entity_aliases a ON a.entity_id=e.id WHERE e.case_id=$1 GROUP BY e.id ORDER BY e.canonical_name`, [caseId]),
    db.query<Workspace["provenance"][number]>(`SELECT a.title artifact_title,e.canonical_name,p.role,p.note FROM artifact_provenance p JOIN source_artifacts a ON a.id=p.artifact_id JOIN entities e ON e.id=p.entity_id WHERE a.case_id=$1 ORDER BY a.title,p.role`, [caseId]),
    db.query<Workspace["lineage"][number]>(`SELECT p.assertion parent_assertion,c.assertion child_assertion,l.kind,l.rationale FROM claim_lineage l JOIN claims p ON p.id=l.parent_claim_id JOIN claims c ON c.id=l.child_claim_id WHERE p.case_id=$1 ORDER BY c.created_at DESC`, [caseId]),
    db.query<Workspace["contradictions"][number]>(`SELECT x.id,x.title,x.description,x.status,count(cx.claim_id)::int claim_count,d.rationale disposition_rationale FROM contradictions x LEFT JOIN contradiction_claims cx ON cx.contradiction_id=x.id LEFT JOIN contradiction_dispositions d ON d.contradiction_id=x.id WHERE x.case_id=$1 GROUP BY x.id,d.rationale ORDER BY x.created_at DESC`, [caseId]),
    db.query<Workspace["savedViews"][number]>("SELECT id,name,research_window,include_unresolved FROM saved_research_views WHERE case_id=$1 ORDER BY created_at DESC", [caseId]),
    db.query<Workspace["audit"][number]>(`SELECT action,subject_type,occurred_at FROM audit_events WHERE case_id=$1 ORDER BY occurred_at DESC LIMIT 20`, [caseId]),
  ]);
  const currentCase = caseResult.rows[0];
  return { caseTitle: currentCase.title, incidentAt: currentCase.incident_at, incidentWindowStart: currentCase.incident_window_start, incidentWindowEnd: currentCase.incident_window_end, artifacts: artifacts.rows, claims: claims.rows, entities: entities.rows, provenance: provenance.rows, lineage: lineage.rows, contradictions: contradictions.rows, savedViews: savedViews.rows, audit: auditRows.rows };
}
