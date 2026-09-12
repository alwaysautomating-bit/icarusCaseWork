import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type ResearchQuestion = {
  id: string;
  case_id: string;
  question: string;
  context: string;
  status: "open" | "resolved";
  resolution: string;
  limitations: string;
  prompted_by_type: string | null;
  prompted_by_id: string | null;
  prompted_by_label: string | null;
  prompted_by_href: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type ResearchSource = {
  id: string;
  source_type: string;
  source_label: string;
  source_href: string | null;
  researcher_note: string;
  created_at: string;
};

export type QuestionSource = ResearchSource & { question_id: string; case_id: string };
export type QuestionEntry = { id: string; question_id: string; case_id: string; entry_kind: "known" | "finding" | "unknown" | "target"; statement: string; source_link_id: string | null; created_at: string };
export type ResearchEvidenceItem = { id: string; case_id: string; name: string; description: string; research_note: string; created_at: string };
export type EvidenceSource = ResearchSource & { evidence_id: string; case_id: string; relationship: "documents" | "mentions" | "depicts" };
export type EvidenceFact = { id: string; evidence_id: string; case_id: string; statement: string; source_link_id: string; created_at: string };
export type QuestionEvidenceLink = { question_id: string; evidence_id: string; case_id: string };

function rowsOrThrow<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("Supabase returned no data.");
  return result.data;
}

export async function getQuestionsWorkspace(caseId: string) {
  const supabase = await createClient();
  const [questions, sources, entries, evidence, links] = await Promise.all([
    supabase.from("research_questions").select("id,case_id,question,context,status,resolution,limitations,prompted_by_type,prompted_by_id,prompted_by_label,prompted_by_href,created_at,resolved_at").eq("case_id", caseId).order("created_at", { ascending: false }),
    supabase.from("research_question_sources").select("id,question_id,case_id,source_type,source_label,source_href,researcher_note,created_at").eq("case_id", caseId).order("created_at"),
    supabase.from("research_question_entries").select("id,question_id,case_id,entry_kind,statement,source_link_id,created_at").eq("case_id", caseId).order("created_at"),
    supabase.from("research_evidence_items").select("id,case_id,name,description,research_note,created_at").eq("case_id", caseId).order("name"),
    supabase.from("research_question_evidence_links").select("question_id,evidence_id,case_id").eq("case_id", caseId),
  ]);
  return {
    questions: rowsOrThrow(questions) as ResearchQuestion[],
    sources: rowsOrThrow(sources) as QuestionSource[],
    entries: rowsOrThrow(entries) as QuestionEntry[],
    evidence: rowsOrThrow(evidence) as ResearchEvidenceItem[],
    links: rowsOrThrow(links) as QuestionEvidenceLink[],
  };
}

export async function getEvidenceWorkspace(caseId: string) {
  const supabase = await createClient();
  const [evidence, sources, facts, questions, links] = await Promise.all([
    supabase.from("research_evidence_items").select("id,case_id,name,description,research_note,created_at").eq("case_id", caseId).order("name"),
    supabase.from("research_evidence_sources").select("id,evidence_id,case_id,source_type,source_label,source_href,researcher_note,relationship,created_at").eq("case_id", caseId).order("created_at"),
    supabase.from("research_evidence_facts").select("id,evidence_id,case_id,statement,source_link_id,created_at").eq("case_id", caseId).order("created_at"),
    supabase.from("research_questions").select("id,case_id,question,context,status,resolution,limitations,prompted_by_type,prompted_by_id,prompted_by_label,prompted_by_href,created_at,resolved_at").eq("case_id", caseId).order("created_at", { ascending: false }),
    supabase.from("research_question_evidence_links").select("question_id,evidence_id,case_id").eq("case_id", caseId),
  ]);
  return {
    evidence: rowsOrThrow(evidence) as ResearchEvidenceItem[],
    sources: rowsOrThrow(sources) as EvidenceSource[],
    facts: rowsOrThrow(facts) as EvidenceFact[],
    questions: rowsOrThrow(questions) as ResearchQuestion[],
    links: rowsOrThrow(links) as QuestionEvidenceLink[],
  };
}
