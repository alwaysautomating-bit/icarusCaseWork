import Link from "next/link";
import { CollapseDocument, inlineMarkup } from "@/app/cases/[caseId]/trial-index/_components/collapse-document";
import { CopyPromptButton } from "@/app/cases/[caseId]/trial-index/_components/copy-prompt-button";
import { researchPrompt, researchSupport } from "@/lib/research-support";

type Action = { task: string; reason: string };

function parseActions(content: string): Action[] {
  const actions: Action[] = [];
  let current: Action | null = null;
  let field: "task" | "reason" | null = null;
  for (const raw of content.replaceAll("\r\n", "\n").split("\n")) {
    const line = raw.trim();
    const match = /^(Priority|Owner|Task|Reason):\s*(.*)$/i.exec(line);
    if (match) {
      const key = match[1].toLowerCase();
      if (key === "task") { current = { task: match[2], reason: "" }; actions.push(current); field = "task"; }
      else if (key === "reason" && current) { current.reason = match[2]; field = "reason"; }
      else field = null;
    } else if (line && line !== "---" && current && field) current[field] += ` ${line}`;
  }
  return actions.filter((action) => action.task);
}

export function ResearchActions({ caseId, dayNumber, content }: { caseId: string; dayNumber: number; content: string }) {
  const actions = parseActions(content);
  if (actions.length === 0) return <CollapseDocument content={content} />;
  return <div className="research-list">
    {actions.map((action, index) => {
      const task = action.task.replaceAll("**", "");
      const support = researchSupport(caseId, dayNumber, task, action.reason);
      const prompt = researchPrompt(dayNumber, task, action.reason, support);
      return <article key={index}>
        <span className="research-ref">{String(index + 1).padStart(2, "0")}</span>
        <div>
          <h3>{inlineMarkup(action.task)}</h3>
          {action.reason ? <p><em>Reason</em> {inlineMarkup(action.reason)}</p> : null}
          <details>
            <summary>Prompt &amp; supporting items</summary>
            <div className="research-prompt">
              <div className="research-prompt-head"><span>Prompt</span><CopyPromptButton text={prompt} /></div>
              <pre>{prompt}</pre>
            </div>
            <div className="research-support">
              <div><h4>Inside Icarus</h4><ul>{support.icarus.map((item) => <li key={item.href}><Link href={item.href}>{item.label}</Link></li>)}</ul></div>
              <div><h4>To go find</h4><ul>{support.hunt.map((item) => <li key={item}>{item}</li>)}</ul></div>
            </div>
          </details>
        </div>
      </article>;
    })}
  </div>;
}
