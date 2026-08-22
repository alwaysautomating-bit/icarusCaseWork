"use client";

export default function TrialIndexError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main className="trial-index-shell"><div className="record-notice"><strong>Trial Index unavailable.</strong><span>The navigation index could not be loaded.</span><button onClick={retry}>Try again</button></div></main>;
}
