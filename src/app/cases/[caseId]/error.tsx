"use client";

import { useEffect } from "react";

export default function CaseWorkspaceError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <main className="case-route-state error-state"><strong>The case workspace could not be loaded.</strong><p>The source record has not been changed. Retry the RLS-scoped request.</p><button onClick={() => retry()}>Retry</button></main>;
}
