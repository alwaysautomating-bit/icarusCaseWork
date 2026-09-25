import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import type { AnchorSlot, ContextAnchor, ContextAssertion, ContextCandidate, ContextConflict, ContextConstraint, ContextLink, TemporalContextResult } from "@/lib/temporal-context";

export type TemporalContextArtifact = {
  schemaVersion: string;
  contract: string;
  compilerVersion: string;
  title: string;
  generatedAt: string;
  source: { title: string; sha256: string; segments: number };
  boundary: string;
  accounts: Array<{ accountKey: string; witness: string }>;
  report: TemporalContextResult["report"];
  proof: Record<string, unknown>;
  candidates: ContextCandidate[];
  assertions: ContextAssertion[];
  constraints: ContextConstraint[];
  anchors: ContextAnchor[];
  links: ContextLink[];
  conflicts: ContextConflict[];
  slots: AnchorSlot[];
  sources: Record<string, { ordinal: number; speaker: string; timestamp: string; deepLink: string; text: string }>;
};

export async function getTemporalContext(): Promise<TemporalContextArtifact> {
  const file = path.join(process.cwd(), "content", "timelines", "temporal", "day3-first-responders.json");
  const parsed = JSON.parse(await fs.readFile(file, "utf8")) as TemporalContextArtifact;
  if (parsed.schemaVersion !== "temporal-context-view/1.0") throw new Error("Unexpected temporal context artifact version.");
  return parsed;
}

/** Navigation order only: a stable topological order of one account's constraints. It is not a claim of total chronology. */
export function assertedOrder(candidates: ContextCandidate[], constraints: ContextConstraint[], ordinalOf: (candidate: ContextCandidate) => number) {
  const ids = new Set(candidates.map((candidate) => candidate.id));
  const earlier = new Map<string, Set<string>>();
  for (const constraint of constraints) {
    if (!ids.has(constraint.from.id) || !ids.has(constraint.to.id)) continue;
    const [before, after] = constraint.relation === "AFTER" || constraint.relation === "AFTER_OR_AT" ? [constraint.to.id, constraint.from.id] : [constraint.from.id, constraint.to.id];
    if (constraint.relation === "AT" || constraint.relation === "OVERLAPS" || constraint.relation === "DURING") continue;
    earlier.set(after, (earlier.get(after) ?? new Set()).add(before));
  }
  const placed = candidates.filter((candidate) => constraints.some((item) => item.from.id === candidate.id || item.to.id === candidate.id));
  const unplaced = candidates.filter((candidate) => !placed.includes(candidate));
  const remaining = [...placed].sort((a, b) => ordinalOf(a) - ordinalOf(b));
  const ordered: ContextCandidate[] = [];
  while (remaining.length) {
    const index = remaining.findIndex((candidate) => [...(earlier.get(candidate.id) ?? [])].every((id) => ordered.some((item) => item.id === id) || !ids.has(id)));
    ordered.push(...remaining.splice(index === -1 ? 0 : index, 1));
  }
  return { ordered, unplaced };
}
