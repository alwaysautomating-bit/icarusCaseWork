const reviewedStates = new Set(["accepted", "amended", "reviewed", "reconciled"]);
const canonicalStates = new Set(["canonical", "court_found", "stipulated"]);
const rejectedStates = new Set(["rejected", "withdrawn"]);

export function ReviewState({ status }: { status: string }) {
  const category = canonicalStates.has(status) ? "canonical" : reviewedStates.has(status) ? "reviewed" : rejectedStates.has(status) ? "excluded" : "candidate";
  return <span className={`review-state review-state-${category}`}><b>{category}</b>{status.replaceAll("_", " ")}</span>;
}
