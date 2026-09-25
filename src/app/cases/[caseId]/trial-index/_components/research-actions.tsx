import { CollapseDocument } from "@/app/cases/[caseId]/trial-index/_components/collapse-document";
import { ResearchWorkspace } from "@/app/cases/[caseId]/trial-index/_components/research-workspace";
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
  const items = actions.map((action) => {
    const task = action.task.replaceAll("**", "");
    const support = researchSupport(caseId, dayNumber, task, action.reason);
    return { task: action.task, reason: action.reason, prompt: researchPrompt(dayNumber, task, action.reason, support), icarus: support.icarus, hunt: support.hunt };
  });
  return <ResearchWorkspace items={items} />;
}
