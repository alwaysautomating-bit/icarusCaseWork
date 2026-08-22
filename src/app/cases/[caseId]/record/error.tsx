"use client";

import { useEffect } from "react";

export default function CourtRecordError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <main className="case-route-state error-state"><strong>Court Record retrieval failed.</strong><p>The search or source window could not be loaded. No source data was modified.</p><button onClick={() => retry()}>Retry retrieval</button></main>;
}
