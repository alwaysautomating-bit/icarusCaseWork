export const lineageKinds = ["origin", "quotes", "paraphrases", "repeats", "derives_from"] as const;

export function isIndependentCorroboration(kind: (typeof lineageKinds)[number]) {
  return kind === "origin";
}

export function assertDistinctClaims(parentClaimId: string, childClaimId: string) {
  if (parentClaimId === childClaimId) throw new Error("A claim cannot derive from itself.");
}
