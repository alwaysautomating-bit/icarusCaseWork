import "server-only";

import { createClient } from "@/lib/supabase/server";

export type CourtPacketReviewStatus = "review_required" | "accepted" | "amended" | "rejected" | "deferred";

export type CourtPacketCandidate = {
  id: string;
  candidateCode: string;
  documentType: string;
  startPage: number;
  endPage: number;
  sourceSegmentIds: string[];
  boundaryEvidence: string[];
  possibleDuplicateOf: string[];
  reviewStatus: CourtPacketReviewStatus;
  currentReviewVersion: number;
};

export type CourtPacketDocument = {
  id: string;
  documentType: string;
  startPage: number;
  endPage: number;
  sourceSegmentIds: string[];
  acceptedAt: string;
};

export type CourtPacketParseRun = {
  id: string;
  pageCount: number;
  createdAt: string;
  reviewStatus: string;
  sourceArtifactId: string;
};

export type CourtPacketWorkspace = {
  run: CourtPacketParseRun | null;
  artifactTitle: string | null;
  artifactByteLength: number | null;
  candidates: CourtPacketCandidate[];
  documents: CourtPacketDocument[];
};

export async function getCourtPacketWorkspace(caseId: string): Promise<CourtPacketWorkspace> {
  const supabase = await createClient();
  const runResult = await supabase
    .from("court_packet_parse_runs")
    .select("id,page_count,created_at,review_status,source_artifact_id")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (runResult.error) throw new Error(runResult.error.message);
  const run = runResult.data;
  if (!run) return { run: null, artifactTitle: null, artifactByteLength: null, candidates: [], documents: [] };

  const [artifactResult, candidatesResult, documentsResult] = await Promise.all([
    supabase.from("source_artifacts").select("title,original_filename,byte_length").eq("id", run.source_artifact_id).maybeSingle(),
    supabase
      .from("court_packet_boundary_candidates")
      .select("id,candidate_code,detected_document_type,detected_start_page,detected_end_page,source_segment_ids,boundary_evidence,possible_duplicate_of,review_status,current_review_version")
      .eq("parse_run_id", run.id)
      .order("detected_start_page"),
    supabase
      .from("court_packet_documents")
      .select("id,document_type,start_page,end_page,source_segment_ids,accepted_at")
      .eq("source_artifact_id", run.source_artifact_id)
      .order("start_page"),
  ]);
  if (candidatesResult.error) throw new Error(candidatesResult.error.message);
  if (documentsResult.error) throw new Error(documentsResult.error.message);

  return {
    run: { id: run.id, pageCount: run.page_count, createdAt: run.created_at, reviewStatus: run.review_status, sourceArtifactId: run.source_artifact_id },
    artifactTitle: artifactResult.data?.original_filename ?? artifactResult.data?.title ?? null,
    artifactByteLength: artifactResult.data?.byte_length ?? null,
    candidates: (candidatesResult.data ?? []).map((row) => ({
      id: row.id,
      candidateCode: row.candidate_code,
      documentType: row.detected_document_type,
      startPage: row.detected_start_page,
      endPage: row.detected_end_page,
      sourceSegmentIds: row.source_segment_ids ?? [],
      boundaryEvidence: row.boundary_evidence ?? [],
      possibleDuplicateOf: row.possible_duplicate_of ?? [],
      reviewStatus: row.review_status,
      currentReviewVersion: row.current_review_version,
    })),
    documents: (documentsResult.data ?? []).map((row) => ({
      id: row.id,
      documentType: row.document_type,
      startPage: row.start_page,
      endPage: row.end_page,
      sourceSegmentIds: row.source_segment_ids ?? [],
      acceptedAt: row.accepted_at,
    })),
  };
}
