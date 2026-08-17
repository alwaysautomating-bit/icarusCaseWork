import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { SourceLocator } from "@/lib/source-locator";

export const reviewDisposition = pgEnum("review_disposition", [
  "accepted",
  "amended_accepted",
  "rejected",
  "deferred",
  "cancelled",
]);
export const claimStatus = pgEnum("claim_status", ["candidate", "accepted", "rejected", "deferred"]);
export const timePrecision = pgEnum("time_precision", ["exact", "approximate", "interval", "relative", "unknown"]);
export const entityKind = pgEnum("entity_kind", ["person", "organization", "location", "device", "proceeding", "system_node"]);
export const lineageKind = pgEnum("lineage_kind", ["origin", "quotes", "paraphrases", "repeats", "derives_from"]);
export const contradictionStatus = pgEnum("contradiction_status", ["unresolved", "resolved_by_evidence", "clarified", "superseded", "cancelled"]);
export const researchWindow = pgEnum("research_window", ["all", "ninety_days", "thirty_days", "incident_window"]);

export const cases = pgTable("cases", {
  id: uuid("id").primaryKey(),
  title: text("title").notNull(),
  purpose: text("purpose").notNull(),
  publicRecordCutoff: timestamp("public_record_cutoff", { withTimezone: true }).notNull(),
  incidentAt: timestamp("incident_at", { withTimezone: true }),
  incidentWindowStart: timestamp("incident_window_start", { withTimezone: true }),
  incidentWindowEnd: timestamp("incident_window_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const evidenceSnapshots = pgTable("evidence_snapshots", {
  id: uuid("id").primaryKey(),
  caseId: uuid("case_id").notNull().references(() => cases.id),
  manifestSha256: text("manifest_sha256").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sourceArtifacts = pgTable("source_artifacts", {
  id: uuid("id").primaryKey(),
  caseId: uuid("case_id").notNull().references(() => cases.id),
  title: text("title").notNull(),
  mediaType: text("media_type").notNull(),
  sha256: text("sha256").notNull(),
  byteLength: integer("byte_length").notNull(),
  objectKey: text("object_key").notNull(),
  acquiredFrom: text("acquired_from").notNull(),
  isAuthorized: boolean("is_authorized").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("artifact_case_sha_idx").on(table.caseId, table.sha256)]);

export const sourceSegments = pgTable("source_segments", {
  id: uuid("id").primaryKey(),
  artifactId: uuid("artifact_id").notNull().references(() => sourceArtifacts.id),
  locatorType: text("locator_type").notNull(),
  locator: jsonb("locator").$type<SourceLocator>().notNull(),
  exactText: text("exact_text").notNull(),
});

export const claims = pgTable("claims", {
  id: uuid("id").primaryKey(),
  caseId: uuid("case_id").notNull().references(() => cases.id),
  sourceSegmentId: uuid("source_segment_id").notNull().references(() => sourceSegments.id),
  claimant: text("claimant").notNull(),
  assertion: text("assertion").notNull(),
  claimedEventTime: timestamp("claimed_event_time", { withTimezone: true }),
  statementTime: timestamp("statement_time", { withTimezone: true }),
  status: claimStatus("status").notNull().default("candidate"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("claim_case_idx").on(table.caseId)]);

export const reviewDecisions = pgTable("review_decisions", {
  id: uuid("id").primaryKey(),
  claimId: uuid("claim_id").notNull().references(() => claims.id),
  reviewerName: text("reviewer_name").notNull(),
  disposition: reviewDisposition("disposition").notNull(),
  rationale: text("rationale").notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const events = pgTable("events", {
  id: uuid("id").primaryKey(),
  caseId: uuid("case_id").notNull().references(() => cases.id),
  promotedFromClaimId: uuid("promoted_from_claim_id").notNull().references(() => claims.id),
  title: text("title").notNull(),
  eventTimeStart: timestamp("event_time_start", { withTimezone: true }),
  eventTimeEnd: timestamp("event_time_end", { withTimezone: true }),
  timePrecision: timePrecision("time_precision").notNull(),
  epistemicState: text("epistemic_state").notNull(),
  uncertaintyNote: text("uncertainty_note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("event_claim_idx").on(table.promotedFromClaimId)]);

export const snapshotArtifacts = pgTable("snapshot_artifacts", {
  snapshotId: uuid("snapshot_id").notNull().references(() => evidenceSnapshots.id),
  artifactId: uuid("artifact_id").notNull().references(() => sourceArtifacts.id),
}, (table) => [primaryKey({ columns: [table.snapshotId, table.artifactId] })]);

export const entities = pgTable("entities", {
  id: uuid("id").primaryKey(),
  caseId: uuid("case_id").notNull().references(() => cases.id),
  canonicalName: text("canonical_name").notNull(),
  kind: entityKind("kind").notNull(),
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("entity_case_name_idx").on(table.caseId, table.canonicalName)]);

export const entityAliases = pgTable("entity_aliases", {
  id: uuid("id").primaryKey(),
  entityId: uuid("entity_id").notNull().references(() => entities.id),
  alias: text("alias").notNull(),
  sourceArtifactId: uuid("source_artifact_id").references(() => sourceArtifacts.id),
});

export const artifactProvenance = pgTable("artifact_provenance", {
  id: uuid("id").primaryKey(),
  artifactId: uuid("artifact_id").notNull().references(() => sourceArtifacts.id),
  role: text("role").notNull(),
  entityId: uuid("entity_id").notNull().references(() => entities.id),
  note: text("note").notNull().default(""),
});

export const claimLineage = pgTable("claim_lineage", {
  parentClaimId: uuid("parent_claim_id").notNull().references(() => claims.id),
  childClaimId: uuid("child_claim_id").notNull().references(() => claims.id),
  kind: lineageKind("kind").notNull(),
  rationale: text("rationale").notNull(),
}, (table) => [primaryKey({ columns: [table.parentClaimId, table.childClaimId] })]);

export const contradictions = pgTable("contradictions", {
  id: uuid("id").primaryKey(),
  caseId: uuid("case_id").notNull().references(() => cases.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: contradictionStatus("status").notNull().default("unresolved"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contradictionClaims = pgTable("contradiction_claims", {
  contradictionId: uuid("contradiction_id").notNull().references(() => contradictions.id),
  claimId: uuid("claim_id").notNull().references(() => claims.id),
  position: text("position").notNull(),
}, (table) => [primaryKey({ columns: [table.contradictionId, table.claimId] })]);

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey(),
  caseId: uuid("case_id").notNull().references(() => cases.id),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>().notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contradictionDispositions = pgTable("contradiction_dispositions", {
  id: uuid("id").primaryKey(),
  contradictionId: uuid("contradiction_id").notNull().unique().references(() => contradictions.id),
  disposition: contradictionStatus("disposition").notNull(),
  rationale: text("rationale").notNull(),
  evidenceClaimId: uuid("evidence_claim_id").references(() => claims.id),
  actorId: text("actor_id").notNull(),
  disposedAt: timestamp("disposed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const savedResearchViews = pgTable("saved_research_views", {
  id: uuid("id").primaryKey(),
  caseId: uuid("case_id").notNull().references(() => cases.id),
  name: text("name").notNull(),
  researchWindow: researchWindow("research_window").notNull(),
  includeUnresolved: boolean("include_unresolved").notNull().default(true),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("saved_view_case_name_idx").on(table.caseId, table.name)]);
