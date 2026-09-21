"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CourtRecordSegment } from "@/lib/court-record";
import { courtRecordHref } from "@/lib/case-routes";

function formatTimestamp(milliseconds: number | null) {
  if (milliseconds === null) return "--:--:--";
  const seconds = Math.floor(milliseconds / 1_000);
  return [Math.floor(seconds / 3_600), Math.floor((seconds % 3_600) / 60), seconds % 60].map((part) => String(part).padStart(2, "0")).join(":");
}

function CopySegmentButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    window.setTimeout(() => setState("idle"), 1_800);
  }
  const label = state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy segment";
  return <button type="button" className="segment-copy" onClick={copy} aria-label={label} title={label}>
    {state === "copied"
      ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      : <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>}
  </button>;
}

export function TranscriptWindow({ caseId, query, selectedId, segments }: { caseId: string; query: string; selectedId: string; segments: CourtRecordSegment[] }) {
  const router = useRouter();
  const windowRef = useRef<HTMLDivElement | null>(null);
  const refs = useRef<Record<string, HTMLElement | null>>({});
  useEffect(() => {
    const container = windowRef.current;
    const selected = refs.current[selectedId];
    if (!container || !selected) return;
    const containerBox = container.getBoundingClientRect();
    const selectedBox = selected.getBoundingClientRect();
    const top = container.scrollTop + selectedBox.top - containerBox.top - (container.clientHeight - selectedBox.height) / 2;
    container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, [selectedId]);

  function choose(segmentId: string, event: React.MouseEvent) {
    if ((event.target as HTMLElement).closest("a, button")) return;
    if (window.getSelection()?.toString()) return;
    if (segmentId === selectedId) return;
    router.push(courtRecordHref(caseId, { query, segmentId }), { scroll: false });
  }

  return <div className="court-transcript-window" ref={windowRef}>{segments.map((segment) => {
    const selected = segment.id === selectedId;
    const time = formatTimestamp(segment.timestamp_start_ms);
    return <article ref={(node) => { refs.current[segment.id] = node; }} className={`court-segment${selected ? " selected" : ""}`} data-segment-id={segment.id} key={segment.id} onClick={(event) => choose(segment.id, event)}>
      <CopySegmentButton text={`[${time}] ${segment.speaker}: ${segment.exact_text}`} />
      <div className="court-segment-copy"><header><strong>{segment.speaker}</strong><time>{time}</time><small>#{segment.ordinal + 1}</small></header><p>{segment.exact_text}</p><footer><Link scroll={false} aria-current={selected ? "location" : undefined} href={courtRecordHref(caseId, { query, segmentId: segment.id })}>Open segment →</Link></footer></div>
    </article>;
  })}</div>;
}
