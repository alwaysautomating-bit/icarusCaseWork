import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

const SECTION_NAMES = [
  "Thread Purpose",
  "Key Insights",
  "Decisions",
  "Evidence",
  "Relationships",
  "Projects Discussed",
  "Context Required For Future Work",
  "Risks",
  "Open Questions",
  "Next Actions",
  "Memory Candidates",
  "Features / Skills / Scripts / Code / Screens",
  "Handoff Brief",
] as const;

const sectionLookup = new Map(SECTION_NAMES.map((name) => [name.toLowerCase(), name]));

export type CollapseTrialIndexSection = {
  name: string;
  slug: string;
  content: string;
};

export type CollapseTrialIndexDay = {
  dayNumber: number;
  filename: string;
  purpose: string;
  sections: CollapseTrialIndexSection[];
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replaceAll("/", " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function recognizedHeading(line: string) {
  const normalized = line.replace(/^#{1,6}\s+/, "").replace(/:$/, "").trim();
  return sectionLookup.get(normalized.toLowerCase());
}

export function parseCollapseTrialIndexDay(filename: string, raw: string): CollapseTrialIndexDay {
  const dayMatch = filename.match(/day\s+(\d+)/i);
  if (!dayMatch) throw new Error(`Unable to determine a trial day from ${filename}.`);

  const dayNumber = Number(dayMatch[1]);
  const lines = raw.replace(/^\uFEFF/, "").replaceAll("\r\n", "\n").split("\n");
  const firstContentLine = lines.findIndex((line) => line.trim().length > 0);

  if (firstContentLine >= 0 && /^(?:day\s+\d+\s+collapse|collapse\s+day\s+\d+)\s*$/i.test(lines[firstContentLine].trim())) {
    lines.splice(firstContentLine, 1);
  }

  const preamble: string[] = [];
  const parsedSections: Array<{ name: string; lines: string[] }> = [];
  let current: { name: string; lines: string[] } | null = null;

  for (const line of lines) {
    const heading = recognizedHeading(line);
    if (heading) {
      current = { name: heading, lines: [] };
      parsedSections.push(current);
      continue;
    }

    if (current) current.lines.push(line);
    else preamble.push(line);
  }

  const purposeSection = parsedSections.find((section) => section.name === "Thread Purpose");
  const purpose = (purposeSection?.lines ?? preamble).join("\n").trim();
  const sections = parsedSections
    .filter((section) => section.name !== "Thread Purpose")
    .map((section) => ({
      name: section.name,
      slug: slugify(section.name),
      content: section.lines.join("\n").trim(),
    }))
    .filter((section) => section.content.length > 0);

  return { dayNumber, filename, purpose, sections };
}

export async function getCollapseTrialIndexDays() {
  const sourceDirectory = path.join(process.cwd(), "content", "trial-index", "collapse-days");
  const filenames = (await fs.readdir(sourceDirectory))
    .filter((filename) => /^collapse day \d+\.txt$/i.test(filename));

  const days = await Promise.all(
    filenames.map(async (filename) => {
      const raw = await fs.readFile(path.join(sourceDirectory, filename), "utf8");
      return parseCollapseTrialIndexDay(filename, raw);
    }),
  );

  return days.sort((left, right) => left.dayNumber - right.dayNumber);
}
