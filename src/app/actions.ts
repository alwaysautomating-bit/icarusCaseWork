"use server";

import { revalidatePath } from "next/cache";
import { addProvenance, createContradiction, createEntity, disposeContradiction, ingestClaim, linkClaims, reviewAndPromote, saveResearchView } from "@/lib/casework-supabase";
import { requireCaseActor } from "@/lib/authority";

export async function ingestClaimAction(formData: FormData) {
  await ingestClaim(await requireCaseActor(), Object.fromEntries(formData.entries()));
  revalidatePath("/");
}

export async function reviewClaimAction(formData: FormData) {
  await reviewAndPromote(await requireCaseActor(), String(formData.get("claimId")), String(formData.get("rationale")), String(formData.get("eventTitle")), String(formData.get("precision")), String(formData.get("eventTimeEnd") || ""), String(formData.get("uncertaintyNote") || ""));
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
