import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

type Source = {
  source_segment_id?: string;
  speaker_name?: string;
  locator?: { type?: string; value?: string };
};

type IntelligenceItem = {
  section: string;
  title: string;
  content: string;
  importance?: string;
  review_status?: string;
  sources?: Source[];
};

type AgentPack = {
  artifact_set_id: string;
  day_number: number;
  summary: {
    title: string;
    subtitle: string;
    one_liner: string;
    purpose: string;
    what_changed: string;
    primary_topics: string[];
  };
  items: IntelligenceItem[];
  limitations: Array<{ code: string; severity: string; description: string }>;
  governance: Record<string, boolean>;
  source_record: { input_hashes?: Record<string, string> };
};

const intelligenceRoot = path.resolve("generated", "day-intelligence");
const outputRoot = path.resolve("transcripts", "trial-index");

function escapeCell(value: string) {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function itemsFor(pack: AgentPack, section: string) {
  return pack.items.filter((item) => item.section === section);
}

function bullets(items: IntelligenceItem[], empty = "None identified") {
  if (items.length === 0) return empty;
  return items.map((item) => `- **${item.title}:** ${item.content}`).join("\n");
}

function evidence(pack: AgentPack) {
  const sourced = pack.items.filter((item) => (item.sources?.length ?? 0) > 0);
  if (sourced.length === 0) return "None identified";
  return sourced.map((item) => {
    const anchors = item.sources!.map((source) => {
      const speaker = source.speaker_name ?? "Unknown speaker";
      const locator = source.locator?.value ?? "locator unavailable";
      const id = source.source_segment_id ?? "segment unavailable";
      return `${speaker} at ${locator} (segment \`${id}\`)`;
    }).join("; ");
    return `Claim: ${item.title}\nSupporting Evidence: ${item.content}\nSource: ${anchors}\nConfidence: review required`;
  }).join("\n\n");
}

function renderDay(pack: AgentPack) {
  const risks = itemsFor(pack, "risks_tensions");
  const questions = itemsFor(pack, "open_questions");
  const actions = itemsFor(pack, "actions");
  const memory = itemsFor(pack, "memory_candidates");
  const handoff = itemsFor(pack, "handoff");
  const limitations = pack.limitations.map((item) => `- **${item.code} (${item.severity}):** ${item.description}`).join("\n");
  return `# Day ${String(pack.day_number).padStart(2, "0")} Index — ${pack.summary.subtitle}

> Thread-collapse projection for navigation and routing. It is derived analytical memory, requires human review, and never replaces the preserved transcript or canonical source segments.

### Thread Purpose

${pack.summary.purpose}

${pack.summary.what_changed}

### Key Insights

${bullets(itemsFor(pack, "insights"))}

### Decisions

| Decision | Reasoning | Confidence |
| --- | --- | --- |
| Treat this day index as navigation-only derived work product | The preserved transcript and canonical source segments remain the evidentiary source of record | High |
| Route later analysis from the raw-source day index | Thread Collapse can orient later work without depending on deterministic testimony structure | High |

### Evidence

${evidence(pack)}

### Relationships

Preserved transcript + manifest
-> analyzed directly by Thread Collapse into
-> day intelligence

Day intelligence
-> collapsed into
-> this routing index

### Projects Discussed

Project: Testimony processing and trial navigation
Purpose: Make each proceeding and witness an addressable unit for selective legal and evidentiary analysis.
Current Status: Generated, candidate-only, and awaiting human review.
Key Decisions: Preserve exact source lineage; never promote this index into canonical fact.
Dependencies: Preserved transcript, intake manifest, and day-intelligence artifact. This branch does not depend on deterministic transcript processing.
Risks: Boundary errors, repeated-source inflation, and analytical text being mistaken for testimony.
Next Actions: Review witness boundaries and apply only relevant downstream skills.

### Context Required For Future Work

- Artifact set: \`${pack.artifact_set_id}\`
- Transcript identity: \`${Object.values(pack.source_record.input_hashes ?? {}).join(", ") || "not embedded"}\`
- Primary topics: ${pack.summary.primary_topics.join(", ")}

### Risks

${bullets(risks)}

${limitations}

### Open Questions

${bullets(questions)}

### Next Actions

${actions.length === 0 ? "None identified" : actions.map((item) => `Priority: ${item.importance ?? "medium"}\nOwner: Human reviewer\nTask: ${item.content}\nReason: ${item.title}`).join("\n\n")}

### Memory Candidates

${memory.length === 0 ? `Memory: ${pack.summary.one_liner}\nCategory: Trial-day navigation\nWhy it should persist: It orients later witness- and topic-specific review without replacing the record.` : memory.map((item) => `Memory: ${item.content}\nCategory: ${item.title}\nWhy it should persist: Reusable day-level operational context.`).join("\n\n")}

### Features / Skills / Scripts / Code / Screens

Type: Workflow
Name: Witness-routed testimony analysis
Status: Existing
Notes: Select a candidate witness block, review examination structure and procedure, then invoke only applicable substantive or specialized skills while retaining source locators.

### Handoff Brief

Current State: ${pack.summary.one_liner}
What Was Learned: ${pack.summary.what_changed}
What Was Decided: Keep this index navigation-only and preserve transcript authority.
What Remains: ${questions.map((item) => item.content).join(" ") || "Human review and targeted analysis remain."}
Recommended Next Step: ${handoff.map((item) => item.content).join(" ") || actions[0]?.content || "Review the raw-source day index."}
`;
}

const dayDirectories = (await readdir(intelligenceRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && /^day-\d{2}$/.test(entry.name))
  .map((entry) => ({ name: entry.name, day: Number(entry.name.slice(4)) }))
  .sort((left, right) => left.day - right.day);

await mkdir(outputRoot, { recursive: true });
const masterRows: string[] = [];
const manifestDays: Array<Record<string, unknown>> = [];

for (const entry of dayDirectories) {
  const packPath = path.join(intelligenceRoot, entry.name, "v1", "agent-pack.json");
  const pack = JSON.parse(await readFile(packPath, "utf8")) as AgentPack;
  const filename = `day-${String(entry.day).padStart(2, "0")}-index.md`;
  const content = renderDay(pack);
  await writeFile(path.join(outputRoot, filename), content, "utf8");
  masterRows.push(`| ${entry.day} | [${escapeCell(pack.summary.title)}](./${filename}) | ${escapeCell(pack.summary.one_liner)} |`);
  manifestDays.push({ day: entry.day, index: filename, artifact_set_id: pack.artifact_set_id, input_hashes: pack.source_record.input_hashes ?? {}, sha256: createHash("sha256").update(content).digest("hex") });
}

const generatedAt = new Date().toISOString();
const master = `# Trial Testimony Index

Generated: ${generatedAt}

This folder is the reusable routing layer over the testimony corpus. Each day index is a Thread Collapse projection derived from the preserved raw transcript. It is independent of deterministic witness and examination processing. The indexes are navigation and analytical memory only; they do not establish facts, credibility, evidentiary weight, or legal conclusions.

| Day | Index | Orientation |
| ---: | --- | --- |
${masterRows.join("\n")}

## Workflow

\`inbox -> preserved source + manifest -> { Thread Collapse -> day index | deterministic testimony structure -> explicit Supabase publication }\`

The two derived paths share source identity but neither consumes the other's output. Canonical database publication remains a separate, authenticated operation from the deterministic branch; it does not import analytical indexes as evidence.
`;
await Promise.all([
  writeFile(path.join(outputRoot, "trial-index.md"), master, "utf8"),
  writeFile(path.join(outputRoot, "trial-index-manifest.json"), `${JSON.stringify({ schema_version: "trial-testimony-index/1.0", generated_at: generatedAt, day_count: manifestDays.length, days: manifestDays }, null, 2)}\n`, "utf8"),
]);

process.stdout.write(`${JSON.stringify({ output: outputRoot, days: manifestDays.length })}\n`);
