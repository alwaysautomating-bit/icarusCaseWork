"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type PlainTextLine = { id: string; time: string; speaker: string; text: string; selected?: boolean };

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function PlainTextViewer({ title, filename, lines, plainText, note, initialFind, iconActions = false, findPlaceholder = "Type a word or phrase" }: { title: string; filename: string; lines: PlainTextLine[]; plainText: string; note?: string; initialFind?: string; iconActions?: boolean; findPlaceholder?: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [term, setTerm] = useState(initialFind ?? "");
  const [current, setCurrent] = useState(0);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const needle = term.trim();
  const pattern = useMemo(() => (needle.length >= 2 ? new RegExp(`(${escapeRegExp(needle)})`, "gi") : null), [needle]);
  const total = useMemo(() => (pattern ? lines.reduce((sum, line) => sum + (line.text.match(pattern)?.length ?? 0), 0) : 0), [lines, pattern]);
  const active = total === 0 ? 0 : Math.min(current, total - 1);

  useEffect(() => {
    if (!pattern || total === 0) return;
    bodyRef.current?.querySelector("mark.current")?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [pattern, total, active]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(plainText);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    window.setTimeout(() => setCopyState("idle"), 2_500);
  }

  function download() {
    const url = URL.createObjectURL(new Blob([plainText], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function step(direction: 1 | -1) {
    if (total === 0) return;
    setCurrent((active + direction + total) % total);
  }

  let seen = 0;
  function highlighted(text: string): ReactNode {
    if (!pattern) return text;
    return text.split(pattern).map((part, index) => {
      if (index % 2 === 0) return part;
      const matchIndex = seen++;
      return <mark className={matchIndex === active ? "current" : undefined} key={index}>{part}</mark>;
    });
  }

  return <div className="court-plain-text">
    <div className="court-plain-text-bar">
      {note === "" ? <span /> : <span>{note ?? `${lines.length} segments · timestamps as recorded`}</span>}
      <div>
        {iconActions ? <>
          <button type="button" className="icon-action" onClick={copy} aria-label={copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy text"} title={copyState === "copied" ? "Copied" : "Copy text"}>
            {copyState === "copied" ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>}
          </button>
          <button type="button" className="icon-action" onClick={download} aria-label="Download .txt" title="Download .txt">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14" /></svg>
          </button>
        </> : <>
          <button type="button" onClick={copy}>{copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy text"}</button>
          <button type="button" onClick={download}>Download .txt</button>
        </>}
      </div>
    </div>
    <div className="court-plain-text-find" role="search">
      <label><span>Find in this testimony</span>
        <input
          type="search"
          value={term}
          placeholder={findPlaceholder}
          onChange={(event) => { setTerm(event.target.value); setCurrent(0); }}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); step(event.shiftKey ? -1 : 1); } }}
        />
      </label>
      <output aria-live="polite">{needle.length < 2 ? "" : total === 0 ? "No matches" : `${active + 1} of ${total}`}</output>
      <button type="button" onClick={() => step(-1)} disabled={total === 0} aria-label="Previous match">↑</button>
      <button type="button" onClick={() => step(1)} disabled={total === 0} aria-label="Next match">↓</button>
    </div>
    <div className="court-plain-text-body" tabIndex={0} aria-label={title} ref={bodyRef}>
      {lines.map((line) => <p className={line.selected ? "selected" : undefined} key={line.id}><time>[{line.time}]</time> <strong>{line.speaker}:</strong> {highlighted(line.text)}</p>)}
    </div>
  </div>;
}
