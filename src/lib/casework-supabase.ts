import "server-only";

import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { CaseActor } from "@/lib/authority";
import { exactCharacterLocator } from "@/lib/citation";
import { assertDistinctClaims, lineageKinds } from "@/lib/evidence-graph";
import { getObjectStorage } from "@/lib/object-storage";
import { buildSourceLocator, type SourceLocator } from "@/lib/source-locator";
import { createClient } from "@/lib/supabase/server";

const dataRoot = process.env.ICARUS_DATA_DIR ? path.resolve(process.env.ICARUS_DATA_DIR) : path.join(process.cwd(), ".data");

function rowsOrThrow<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("Supabase returned no data.");
  return result.data;
}

function nullableOrThrow<T>(result: { data: T | null; error: PostgrestError | null }): T | null {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function caseContext(actor: CaseActor) {
  const supabase = await createClient();
  const existing = rowsOrThrow(await supabase.from("cases").select("id").order("created_at").limit(1));
  if (existing[0]) return { supabase, caseId: existing[0].id as string };
  const caseId = randomUUID();
  const { error } = await supabase.from("cases").insert({ id: caseId, owner_user_id: actor.id, title: "Source-linked proof case", purpose: "Demonstrate claim and event separation with public or authorized text.", public_record_cutoff: "2026-08-13T23:59:59Z" });
  if (error) throw new Error(error.message);
  return { supabase, caseId };
}

async function audit(supabase: SupabaseClient, caseId: string, actor: CaseActor, action: string, subjectType: string, subjectId: string, details: Record<string, unknown> = {}) {
  rowsOrThrow(await supabase.from("audit_events").insert({ id: randomUUID(), case_id: caseId, actor_user_id: actor.id, action, subject_type: subjectType, subject_id: subjectId, details }).select("id").single());
}

const ingestInput = z.object({
  title: z.string().trim().min(3).max(160), acquiredFrom: z.string().trim().min(3).max(240), mediaType: z.enum(["text/plain", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/vtt", "image/jpeg", "image/png", "text/csv", "audio/mpeg", "video/mp4"]), locatorType: z.enum(["character_offset", "page", "timestamp", "spreadsheet_range", "image_region"]), page: z.string().optional(), timestampStart: z.string().optional(), timestampEnd: z.string().optional(), sheet: z.string().optional(), range: z.string().optional(), imageRegion: z.string().optional(), sourceText: z.string().trim().min(20).max(100_000), claimant: z.string().trim().min(2).max(120), assertion: z.string().trim().min(5).max(2_000), exactQuote: z.string().trim().min(5).max(4_000), claimedEventTime: z.string().optional(), authorized: z.literal("on"),
});

export async function ingestClaim(actor: CaseActor, raw: Record<string, FormDataEntryValue>) {
  const input = ingestInput.parse(raw);
  const locator = buildSourceLocator(input, exactCharacterLocator(input.sourceText, input.exactQuote));
  const bytes = Buffer.from(input.sourceText, "utf8");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const { supabase, caseId } = await caseContext(actor);
  const preserved = nullableOrThrow(await supabase.from("source_artifacts").select("id,object_key").eq("case_id", caseId).eq("sha256", sha256).maybeSingle()) as { id: string; object_key: string } | null;
  const storedObject = preserved ? { key: preserved.object_key as string, provider: "existing" } : await getObjectStorage(dataRoot).putImmutable({ key: `${sha256}.source`, bytes, contentType: input.mediaType });
  const artifactId = (preserved?.id as string | undefined) ?? randomUUID();
  if (!preserved) rowsOrThrow(await supabase.from("source_artifacts").insert({ id: artifactId, case_id: caseId, title: input.title, media_type: input.mediaType, sha256, byte_length: bytes.length, object_key: storedObject.key, acquired_from: input.acquiredFrom, is_authorized: true }).select("id").single());
  const segmentId = randomUUID();
  rowsOrThrow(await supabase.from("source_segments").insert({ id: segmentId, artifact_id: artifactId, locator_type: locator.type, locator, exact_text: input.exactQuote }).select("id").single());
  const claimId = randomUUID();
  rowsOrThrow(await supabase.from("claims").insert({ id: claimId, case_id: caseId, source_segment_id: segmentId, claimant: input.claimant, assertion: input.assertion, claimed_event_time: input.claimedEventTime || null }).select("id").single());
  await audit(supabase, caseId, actor, "claim.created", "claim", claimId, { artifactId, locator, storageProvider: storedObject.provider });
}

export async function reviewAndPromote(actor: CaseActor, claimId: string, rationale: string, eventTitle: string, precision: string, eventTimeEnd?: string, uncertaintyNote = "") {
  const input = z.object({ claimId: z.uuid(), rationale: z.string().trim().min(5), eventTitle: z.string().trim().min(5), precision: z.enum(["exact", "approximate", "interval", "relative", "unknown"]), eventTimeEnd: z.string().optional(), uncertaintyNote: z.string().trim().max(1000) }).parse({ claimId, rationale, eventTitle, precision, eventTimeEnd, uncertaintyNote });
  const { supabase, caseId } = await caseContext(actor);
  const claim = rowsOrThrow(await supabase.from("claims").select("claimed_event_time,status").eq("id", input.claimId).eq("case_id", caseId).single()) as { claimed_event_time: string | null; status: string };
  if (claim.status !== "candidate") throw new Error("Claim has already been reviewed.");
  rowsOrThrow(await supabase.from("claims").update({ status: "accepted" }).eq("id", input.claimId).eq("status", "candidate").select("id").single());
  rowsOrThrow(await supabase.from("review_decisions").insert({ id: randomUUID(), claim_id: input.claimId, reviewer_user_id: actor.id, disposition: "accepted", rationale: input.rationale }).select("id").single());
  const eventId = randomUUID();
  rowsOrThrow(await supabase.from("events").insert({ id: eventId, case_id: caseId, promoted_from_claim_id: input.claimId, title: input.eventTitle, event_time_start: claim.claimed_event_time, event_time_end: input.eventTimeEnd || null, time_precision: input.precision, epistemic_state: "reviewed_observable", uncertainty_note: input.uncertaintyNote }).select("id").single());
  await audit(supabase, caseId, actor, "claim.accepted_and_event.promoted", "event", eventId, { claimId: input.claimId, precision: input.precision });
}

export async function createEntity(actor: CaseActor, raw: Record<string, FormDataEntryValue>) {
  const input = z.object({ canonicalName: z.string().trim().min(2).max(160), kind: z.enum(["person", "organization", "location", "device", "proceeding", "system_node"]), aliases: z.string().max(500).default(""), description: z.string().max(1000).default("") }).parse(raw);
  const { supabase, caseId } = await caseContext(actor);
  const entityId = randomUUID();
  rowsOrThrow(await supabase.from("entities").insert({ id: entityId, case_id: caseId, canonical_name: input.canonicalName, kind: input.kind, description: input.description }).select("id").single());
  const aliases = input.aliases.split(",").map((alias) => alias.trim()).filter(Boolean).map((alias) => ({ id: randomUUID(), entity_id: entityId, alias }));
  if (aliases.length) rowsOrThrow(await supabase.from("entity_aliases").insert(aliases).select("id"));
  await audit(supabase, caseId, actor, "entity.created", "entity", entityId, { kind: input.kind, aliases: input.aliases });
}

export async function addProvenance(actor: CaseActor, artifactId: string, entityId: string, role: string, note: string) {
  const input = z.object({ artifactId: z.uuid(), entityId: z.uuid(), role: z.enum(["originator", "publisher", "custodian", "submitter"]), note: z.string().trim().max(500) }).parse({ artifactId, entityId, role, note });
  const { supabase, caseId } = await caseContext(actor);
  rowsOrThrow(await supabase.from("artifact_provenance").insert({ id: randomUUID(), artifact_id: input.artifactId, role: input.role, entity_id: input.entityId, note: input.note }).select("id").single());
  await audit(supabase, caseId, actor, "artifact.provenance_added", "artifact", input.artifactId, { entityId: input.entityId, role: input.role });
}

export async function linkClaims(actor: CaseActor, parentClaimId: string, childClaimId: string, kind: string, rationale: string) {
  assertDistinctClaims(parentClaimId, childClaimId);
  const input = z.object({ parentClaimId: z.uuid(), childClaimId: z.uuid(), kind: z.enum(lineageKinds), rationale: z.string().trim().min(5).max(1000) }).parse({ parentClaimId, childClaimId, kind, rationale });
  const { supabase, caseId } = await caseContext(actor);
  rowsOrThrow(await supabase.from("claim_lineage").insert({ parent_claim_id: input.parentClaimId, child_claim_id: input.childClaimId, kind: input.kind, rationale: input.rationale }).select("parent_claim_id").single());
  await audit(supabase, caseId, actor, "claim.lineage_added", "claim", input.childClaimId, { parentClaimId: input.parentClaimId, kind: input.kind });
}

export async function createContradiction(actor: CaseActor, title: string, description: string, firstClaimId: string, secondClaimId: string) {
  assertDistinctClaims(firstClaimId, secondClaimId);
  const input = z.object({ title: z.string().trim().min(4).max(180), description: z.string().trim().min(10).max(2000), firstClaimId: z.uuid(), secondClaimId: z.uuid() }).parse({ title, description, firstClaimId, secondClaimId });
  const { supabase, caseId } = await caseContext(actor);
  const contradictionId = randomUUID();
  rowsOrThrow(await supabase.from("contradictions").insert({ id: contradictionId, case_id: caseId, title: input.title, description: input.description }).select("id").single());
  rowsOrThrow(await supabase.from("contradiction_claims").insert([{ contradiction_id: contradictionId, claim_id: input.firstClaimId, position: "account_a" }, { contradiction_id: contradictionId, claim_id: input.secondClaimId, position: "account_b" }]).select("claim_id"));
  await audit(supabase, caseId, actor, "contradiction.created", "contradiction", contradictionId, { claimIds: [input.firstClaimId, input.secondClaimId] });
}

export async function disposeContradiction(actor: CaseActor, contradictionId: string, disposition: string, rationale: string, evidenceClaimId?: string) {
  const input = z.object({ contradictionId: z.uuid(), disposition: z.enum(["resolved_by_evidence", "clarified", "superseded", "cancelled"]), rationale: z.string().trim().min(10).max(2000), evidenceClaimId: z.uuid().optional() }).parse({ contradictionId, disposition, rationale, evidenceClaimId: evidenceClaimId || undefined });
  if (input.disposition !== "cancelled" && !input.evidenceClaimId) throw new Error("This disposition requires an evidence claim.");
  const { supabase, caseId } = await caseContext(actor);
  rowsOrThrow(await supabase.from("contradictions").select("id").eq("id", input.contradictionId).eq("case_id", caseId).eq("status", "unresolved").single());
  rowsOrThrow(await supabase.from("contradiction_dispositions").insert({ id: randomUUID(), contradiction_id: input.contradictionId, disposition: input.disposition, rationale: input.rationale, evidence_claim_id: input.evidenceClaimId || null, actor_user_id: actor.id }).select("id").single());
  rowsOrThrow(await supabase.from("contradictions").update({ status: input.disposition }).eq("id", input.contradictionId).eq("status", "unresolved").select("id").single());
  await audit(supabase, caseId, actor, "contradiction.disposed", "contradiction", input.contradictionId, { disposition: input.disposition, evidenceClaimId: input.evidenceClaimId });
}

export async function saveResearchView(actor: CaseActor, name: string, researchWindow: string, includeUnresolved: boolean) {
  const input = z.object({ name: z.string().trim().min(3).max(120), researchWindow: z.enum(["all", "ninety_days", "thirty_days", "incident_window"]), includeUnresolved: z.boolean() }).parse({ name, researchWindow, includeUnresolved });
  const { supabase, caseId } = await caseContext(actor);
  const id = randomUUID();
  rowsOrThrow(await supabase.from("saved_research_views").insert({ id, case_id: caseId, name: input.name, research_window: input.researchWindow, include_unresolved: input.includeUnresolved, created_by: actor.id }).select("id").single());
  await audit(supabase, caseId, actor, "research_view.saved", "saved_research_view", id, { window: input.researchWindow, includeUnresolved: input.includeUnresolved });
}

type ClaimRow = { id: string; assertion: string; claimant: string; status: string; exact_text: string; locator: SourceLocator; artifact_title: string; event_title: string | null; event_time_start: string | null; event_time_end: string | null; time_precision: string | null; uncertainty_note: string | null; rationale: string | null };
export type Workspace = { caseTitle: string; incidentAt: string | null; incidentWindowStart: string | null; incidentWindowEnd: string | null; artifacts: Array<{ id: string; title: string; sha256: string; acquired_from: string }>; claims: ClaimRow[]; entities: Array<{ id: string; canonical_name: string; kind: string; description: string; aliases: string[] }>; provenance: Array<{ artifact_title: string; canonical_name: string; role: string; note: string }>; lineage: Array<{ parent_assertion: string; child_assertion: string; kind: string; rationale: string }>; contradictions: Array<{ id: string; title: string; description: string; status: string; claim_count: number; disposition_rationale: string | null }>; savedViews: Array<{ id: string; name: string; research_window: string; include_unresolved: boolean }>; audit: Array<{ action: string; subject_type: string; occurred_at: string }> };

export async function getWorkspace(actor: CaseActor): Promise<Workspace> {
  const { supabase, caseId } = await caseContext(actor);
  const results = await Promise.all([
    supabase.from("cases").select("title,incident_at,incident_window_start,incident_window_end").eq("id", caseId).single(), supabase.from("source_artifacts").select("id,title,sha256,acquired_from").eq("case_id", caseId).order("created_at", { ascending: false }), supabase.from("claims").select("id,source_segment_id,assertion,claimant,status").eq("case_id", caseId).order("created_at", { ascending: false }), supabase.from("source_segments").select("id,artifact_id,exact_text,locator"), supabase.from("events").select("promoted_from_claim_id,title,event_time_start,event_time_end,time_precision,uncertainty_note").eq("case_id", caseId), supabase.from("review_decisions").select("claim_id,rationale").order("reviewed_at", { ascending: false }), supabase.from("entities").select("id,canonical_name,kind,description").eq("case_id", caseId).order("canonical_name"), supabase.from("entity_aliases").select("entity_id,alias"), supabase.from("artifact_provenance").select("artifact_id,entity_id,role,note"), supabase.from("claim_lineage").select("parent_claim_id,child_claim_id,kind,rationale"), supabase.from("contradictions").select("id,title,description,status").eq("case_id", caseId).order("created_at", { ascending: false }), supabase.from("contradiction_claims").select("contradiction_id"), supabase.from("contradiction_dispositions").select("contradiction_id,rationale"), supabase.from("saved_research_views").select("id,name,research_window,include_unresolved").eq("case_id", caseId).order("created_at", { ascending: false }), supabase.from("audit_events").select("action,subject_type,occurred_at").eq("case_id", caseId).order("occurred_at", { ascending: false }).limit(20),
  ]);
  const [caseResult, artifactsResult, claimsResult, segmentsResult, eventsResult, reviewsResult, entitiesResult, aliasesResult, provenanceResult, lineageResult, contradictionsResult, contradictionClaimsResult, dispositionsResult, viewsResult, auditResult] = results;
  const currentCase = rowsOrThrow(caseResult);
  const artifacts = rowsOrThrow(artifactsResult) as Workspace["artifacts"];
  const artifactById = new Map(artifacts.map((item) => [item.id, item]));
  const rawClaims = rowsOrThrow(claimsResult) as Array<{ id: string; source_segment_id: string; assertion: string; claimant: string; status: string }>;
  const claimById = new Map(rawClaims.map((item) => [item.id, item]));
  const segments = rowsOrThrow(segmentsResult) as Array<{ id: string; artifact_id: string; exact_text: string; locator: SourceLocator }>;
  const segmentById = new Map(segments.map((item) => [item.id, item]));
  const events = rowsOrThrow(eventsResult) as Array<{ promoted_from_claim_id: string; title: string; event_time_start: string | null; event_time_end: string | null; time_precision: string; uncertainty_note: string }>;
  const eventByClaim = new Map(events.map((item) => [item.promoted_from_claim_id, item]));
  const reviews = rowsOrThrow(reviewsResult) as Array<{ claim_id: string; rationale: string }>;
  const reviewByClaim = new Map(reviews.map((item) => [item.claim_id, item]));
  const claims: ClaimRow[] = rawClaims.map((claim) => { const segment = segmentById.get(claim.source_segment_id); const event = eventByClaim.get(claim.id); return { id: claim.id, assertion: claim.assertion, claimant: claim.claimant, status: claim.status, exact_text: segment?.exact_text ?? "", locator: segment?.locator ?? { type: "character_offset", start: 0, end: 0 }, artifact_title: artifactById.get(segment?.artifact_id ?? "")?.title ?? "Unknown artifact", event_title: event?.title ?? null, event_time_start: event?.event_time_start ?? null, event_time_end: event?.event_time_end ?? null, time_precision: event?.time_precision ?? null, uncertainty_note: event?.uncertainty_note ?? null, rationale: reviewByClaim.get(claim.id)?.rationale ?? null }; });
  const aliases = rowsOrThrow(aliasesResult) as Array<{ entity_id: string; alias: string }>;
  const entities = (rowsOrThrow(entitiesResult) as Array<{ id: string; canonical_name: string; kind: string; description: string }>).map((entity) => ({ ...entity, aliases: aliases.filter((item) => item.entity_id === entity.id).map((item) => item.alias) }));
  const entityById = new Map(entities.map((item) => [item.id, item]));
  const provenance = (rowsOrThrow(provenanceResult) as Array<{ artifact_id: string; entity_id: string; role: string; note: string }>).map((item) => ({ artifact_title: artifactById.get(item.artifact_id)?.title ?? "Unknown artifact", canonical_name: entityById.get(item.entity_id)?.canonical_name ?? "Unknown entity", role: item.role, note: item.note }));
  const lineage = (rowsOrThrow(lineageResult) as Array<{ parent_claim_id: string; child_claim_id: string; kind: string; rationale: string }>).map((item) => ({ parent_assertion: claimById.get(item.parent_claim_id)?.assertion ?? "Unknown claim", child_assertion: claimById.get(item.child_claim_id)?.assertion ?? "Unknown claim", kind: item.kind, rationale: item.rationale }));
  const contradictionClaims = rowsOrThrow(contradictionClaimsResult) as Array<{ contradiction_id: string }>;
  const dispositions = rowsOrThrow(dispositionsResult) as Array<{ contradiction_id: string; rationale: string }>;
  const contradictions = (rowsOrThrow(contradictionsResult) as Array<{ id: string; title: string; description: string; status: string }>).map((item) => ({ ...item, claim_count: contradictionClaims.filter((claim) => claim.contradiction_id === item.id).length, disposition_rationale: dispositions.find((disposition) => disposition.contradiction_id === item.id)?.rationale ?? null }));
  return { caseTitle: currentCase.title as string, incidentAt: currentCase.incident_at as string | null, incidentWindowStart: currentCase.incident_window_start as string | null, incidentWindowEnd: currentCase.incident_window_end as string | null, artifacts, claims, entities, provenance, lineage, contradictions, savedViews: rowsOrThrow(viewsResult) as Workspace["savedViews"], audit: rowsOrThrow(auditResult) as Workspace["audit"] };
}
