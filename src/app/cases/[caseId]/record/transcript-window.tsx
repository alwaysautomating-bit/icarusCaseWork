"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { CourtRecordSegment } from "@/lib/court-record";
import { courtRecordHref } from "@/lib/case-routes";

function formatTimestamp(milliseconds: number | null) {
  if (milliseconds === null) return "--:--:--";
  const seconds = Math.floor(milliseconds / 1_000);
  return [Math.floor(seconds / 3_600), Math.floor((seconds % 3_600) / 60), seconds % 60].map((part) => String(part).padStart(2, "0")).join(":");
}

export function TranscriptWindow({ caseId, query, selectedId, segments }: { caseId: string; query: string; selectedId: string; segments: CourtRecordSegment[] }) {
  const refs = useRef<Record<string, HTMLElement | null>>({});
  useEffect(() => {
    refs.current[selectedId]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [selectedId]);

  return <div className="court-transcript-window">{segments.map((segment) => {
    const selected = segment.id === selectedId;
    return <article ref={(node) => { refs.current[segment.id] = node; }} className={`court-segment${selected ? " selected" : ""}`} data-segment-id={segment.id} key={segment.id}>
      <div className="court-segment-rail"><time>{formatTimestamp(segment.timestamp_start_ms)}</time><span>#{segment.ordinal + 1}</span></div>
      <div className="court-segment-copy"><header><strong>{segment.speaker}</strong>{selected ? <span>SELECTED SOURCE</span> : null}</header><p>{segment.exact_text}</p><footer><code>{segment.id}</code><Link scroll={false} aria-current={selected ? "location" : undefined} href={courtRecordHref(caseId, { query, segmentId: segment.id })}>{selected ? "Canonical segment" : "Open segment"} →</Link></footer></div>
    </article>;
  })}</div>;
}
