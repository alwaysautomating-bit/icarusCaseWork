"use client";

export default function ReconcileError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="reconcile-shell"><div className="record-error"><strong>Reconcile could not be loaded.</strong><span>No source object or reconciliation version was changed.</span><button onClick={reset}>Try again</button></div></main>;
}
