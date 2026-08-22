"use client";

export default function StructureReviewError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="structure-review-shell"><section className="structure-review-empty"><strong>REVIEW WORKSPACE UNAVAILABLE</strong><h1>The queue could not be loaded.</h1><p>No review mutation was attempted. Retry after confirming the local Supabase stack and authenticated case session are available.</p><button onClick={reset}>Retry</button></section></main>;
}
