"use client";

export default function StructureError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="case-route-state"><strong>Structure could not be loaded.</strong><p>The source record was not changed. Retry the read-only query or return to Court Record.</p><button onClick={reset}>Retry</button></main>;
}
