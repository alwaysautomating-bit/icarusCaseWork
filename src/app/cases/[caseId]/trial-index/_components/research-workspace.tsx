"use client";

import { useState } from "react";
import Link from "next/link";
import { MonoLabel } from "@/app/casework-ui";
import { inlineMarkup } from "@/app/cases/[caseId]/trial-index/_components/collapse-document";
import { CopyPromptButton } from "@/app/cases/[caseId]/trial-index/_components/copy-prompt-button";

export type ResearchItem = { task: string; reason: string; prompt: string; icarus: { label: string; href: string }[]; hunt: string[] };

export function ResearchWorkspace({ items }: { items: ResearchItem[] }) {
  const [selected, setSelected] = useState(0);
  const item = items[selected] ?? items[0]!;

  return <div className="ti-split ti-research">
    <ol className="ti-claim-list" aria-label="Research queue">
      {items.map((entry, index) => <li key={index}>
        <button type="button" aria-pressed={index === selected} onClick={() => setSelected(index)}>
          <span className="ti-ref">{String(index + 1).padStart(2, "0")}</span>
          <strong>{inlineMarkup(entry.task)}</strong>
          {entry.reason ? <span className="ti-claim-support"><em>Reason</em> {inlineMarkup(entry.reason)}</span> : null}
        </button>
      </li>)}
    </ol>
    <aside className="ti-inspector" aria-live="polite">
      <MonoLabel>SELECTED PROMPT · {String(selected + 1).padStart(2, "0")} OF {String(items.length).padStart(2, "0")}</MonoLabel>
      <h3>{inlineMarkup(item.task)}</h3>
      <div className="research-prompt">
        <div className="research-prompt-head"><span>Prompt</span><CopyPromptButton text={item.prompt} /></div>
        <pre>{item.prompt}</pre>
      </div>
      <div className="research-support">
        <div><h4>Inside Icarus</h4><ul>{item.icarus.map((link) => <li key={link.href}><Link href={link.href}>{link.label}</Link></li>)}</ul></div>
        <div><h4>To go find</h4><ul>{item.hunt.map((text) => <li key={text}>{text}</li>)}</ul></div>
      </div>
    </aside>
  </div>;
}
