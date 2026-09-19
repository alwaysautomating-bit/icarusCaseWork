"use client";

import { PlainTextViewer } from "@/app/cases/[caseId]/record/plain-text-viewer";
import type { CourtRecordSegment } from "@/lib/court-record";

function formatTimestamp(milliseconds: number | null) {
  if (milliseconds === null) return "--:--:--";
  const seconds = Math.floor(milliseconds / 1_000);
  return [Math.floor(seconds / 3_600), Math.floor((seconds % 3_600) / 60), seconds % 60].map((part) => String(part).padStart(2, "0")).join(":");
}

export function TranscriptText({ title, segments, selectedId }: { title: string; segments: CourtRecordSegment[]; selectedId: string }) {
  const lines = segments.map((segment) => ({ id: segment.id, time: formatTimestamp(segment.timestamp_start_ms), speaker: segment.speaker, text: segment.exact_text.replace(/\s+/g, " ").trim(), selected: segment.id === selectedId }));
  const plainText = `${title}\n${"=".repeat(Math.min(title.length, 72))}\n\n${lines.map((line) => `[${line.time}] ${line.speaker}: ${line.text}`).join("\n\n")}\n`;
  const filename = `${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "testimony"}.txt`;
  return <PlainTextViewer title="Plain-text testimony" filename={filename} lines={lines} plainText={plainText} />;
}
