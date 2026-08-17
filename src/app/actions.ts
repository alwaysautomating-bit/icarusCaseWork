"use server";

import { revalidatePath } from "next/cache";
import { addProvenance, createContradiction, createEntity, disposeContradiction, linkClaims, reviewAndPromote, reviewExtractionCandidate, saveResearchView } from "@/lib/casework-supabase";
import { requireCaseActor } from "@/lib/authority";
import { intakeTestimonyUrl } from "@/lib/testimony-intake";

export type TestimonyIntakeActionState = { status: "idle" | "success" | "error"; message: string };

export async function intakeTestimonyUrlAction(_previous: TestimonyIntakeActionState, formData: FormData): Promise<TestimonyIntakeActionState> {
  try {
    const result = await intakeTestimonyUrl(await requireCaseActor(), Object.fromEntries(formData.entries()));
    revalidatePath("/");
    return {
      status: "success",
      message: result.duplicate
        ? `Exact snapshot already preserved. Reused ${result.segments} segments and ${result.claims} testimony claims without duplication.`
        : `Captured ${result.segments} timestamped segments, ${result.claims} testimony claims, and ${result.acquisitionTargets} acquisition targets.`,
    };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "The testimony URL could not be processed." };
  }
}

export async function reviewClaimAction(formData: FormData) {
  await reviewAndPromote(await requireCaseActor(), String(formData.get("claimId")), String(formData.get("rationale")), String(formData.get("eventTitle")), String(formData.get("precision")), String(formData.get("eventTimeEnd") || ""), String(formData.get("uncertaintyNote") || ""));
  revalidatePath("/");
}

export async function reviewExtractionCandidateAction(formData: FormData) {
  await reviewExtractionCandidate(await requireCaseActor(), String(formData.get("candidateId")), String(formData.get("reviewAction")), String(formData.get("payload") ?? ""), String(formData.get("note") ?? ""));
  revalidatePath("/");
}

export async function createEntityAction(formData: FormData) {
  await createEntity(await requireCaseActor(), Object.fromEntries(formData.entries()));
  revalidatePath("/");
}

export async function addProvenanceAction(formData: FormData) {
  await addProvenance(await requireCaseActor(), String(formData.get("artifactId")), String(formData.get("entityId")), String(formData.get("role")), String(formData.get("note")));
  revalidatePath("/");
}

export async function linkClaimsAction(formData: FormData) {
  await linkClaims(await requireCaseActor(), String(formData.get("parentClaimId")), String(formData.get("childClaimId")), String(formData.get("kind")), String(formData.get("rationale")));
  revalidatePath("/");
}

export async function createContradictionAction(formData: FormData) {
  await createContradiction(await requireCaseActor(), String(formData.get("title")), String(formData.get("description")), String(formData.get("firstClaimId")), String(formData.get("secondClaimId")));
  revalidatePath("/");
}

export async function disposeContradictionAction(formData: FormData) {
  await disposeContradiction(await requireCaseActor(), String(formData.get("contradictionId")), String(formData.get("disposition")), String(formData.get("rationale")), String(formData.get("evidenceClaimId") || ""));
  revalidatePath("/");
}

export async function saveResearchViewAction(formData: FormData) {
  await saveResearchView(await requireCaseActor(), String(formData.get("name")), String(formData.get("researchWindow")), formData.get("includeUnresolved") === "on");
  revalidatePath("/");
}
