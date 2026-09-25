import "server-only";

import { notFound } from "next/navigation";
import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase } from "@/lib/case-access";

// Owner-only areas (Structure, Review, Accounts, Reconcile, Reconstruct, Access) answer as if they do not exist for everyone else.
export async function requireCaseOwner(params: Promise<{ caseId: string }>) {
  const [actor, { caseId }] = await Promise.all([requireCaseActor(), params]);
  const currentCase = await getAccessibleCase(actor.id, caseId);
  if (!currentCase || currentCase.membershipRole !== "owner") notFound();
  return { actor, currentCase };
}

export async function isCaseOwner(actorId: string, caseId: string) {
  const currentCase = await getAccessibleCase(actorId, caseId);
  return Boolean(currentCase && currentCase.membershipRole === "owner");
}
