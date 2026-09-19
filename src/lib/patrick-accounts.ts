import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";

const cellSchema = z.object({ text: z.string(), cites: z.array(z.string()) }).nullable();

const sourceKeys = ["trial", "newyorker", "opening", "affidavit", "responders"] as const;
export type PatrickSourceKey = (typeof sourceKeys)[number];

const statusSchema = z.enum(["consistent", "differs", "single_source", "not_attested", "needs_records"]);
export type PatrickStatus = z.infer<typeof statusSchema>;

const stepSchema = z.object({
  id: z.string(),
  title: z.string(),
  cells: z.object({ trial: cellSchema, newyorker: cellSchema, opening: cellSchema, affidavit: cellSchema.optional(), responders: cellSchema }),
  assessment: z.object({ status: statusSchema, note: z.string() }),
  researcher_note: z.string().optional(),
});

const errandSchema = z.object({
  intro: z.string(),
  rows: z.array(z.object({ leg: z.string(), estimate: z.string(), actual: z.string(), difference: z.string(), basis: z.string(), caveat: z.string() })),
  summary: z.string(),
  cautions: z.array(z.string()),
});

const accountsSchema = z.object({
  schema_version: z.string(),
  title: z.string(),
  status: z.string(),
  intro: z.string(),
  sources: z.array(z.object({ key: z.enum(sourceKeys), label: z.string(), kind: z.string(), note: z.string() })),
  errand: errandSchema,
  steps: z.array(stepSchema),
  unaccounted: z.array(z.object({
    id: z.string(),
    title: z.string(),
    window: z.string(),
    claimed: z.array(z.string()),
    attested: z.string(),
    gap: z.string(),
  })),
  discrepancies: z.array(z.object({
    id: z.string(),
    issue: z.string(),
    accounts: z.array(z.string()),
    why: z.string(),
    resolve: z.string(),
  })),
  not_in_folder: z.array(z.string()),
});

export type PatrickAccounts = z.infer<typeof accountsSchema>;
export type PatrickStep = z.infer<typeof stepSchema>;

export async function getPatrickAccounts(): Promise<PatrickAccounts> {
  const file = path.join(process.cwd(), "content", "timelines", "patrick", "accounts-v1.json");
  return accountsSchema.parse(JSON.parse(await fs.readFile(file, "utf8")));
}

export const STATUS_LABELS: Record<PatrickStatus, string> = {
  consistent: "Consistent",
  differs: "Differs",
  single_source: "Single source",
  not_attested: "Not attested by responders",
  needs_records: "Needs records",
};
