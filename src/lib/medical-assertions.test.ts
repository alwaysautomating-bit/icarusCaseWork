import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  assertionSchema,
  buildMedicationLineages,
  detectMedicalConflicts,
  medicationKey,
  validateExtraction,
} from "../../scripts/medical-assertions-lib.mjs";
import { parseTranscriptTurns } from "../../scripts/transcript-first-pass-lib.mjs";

const keys = { lorazepam: ["ativan", "lorazepam"], sertraline: ["zoloft", "sertraline"] };

const base = {
  type: "medication",
  raw: "Ativan",
  med: { name: "Ativan" },
  time: { date: "2022-10-21", precision: "exact" },
  basis: "firsthand_provider",
  evidence: [{ seg: 1, span: "Ativan" }],
};
const make = (id: string, extra: Record<string, unknown>) => ({ id: `meda_t_${id}`, ...base, ...extra });

describe("medical assertion schema", () => {
  it("requires exactly one of act or report for medications", () => {
    expect(assertionSchema.safeParse(make("001", {})).success).toBe(false);
    expect(assertionSchema.safeParse(make("001", { act: "prescribed", report: "patient_reported_taking" })).success).toBe(false);
    expect(assertionSchema.safeParse(make("001", { act: "prescribed" })).success).toBe(true);
  });
  it("rejects relative or undated times without an anchor", () => {
    expect(assertionSchema.safeParse(make("001", { act: "prescribed", time: { date: null, precision: "relative" } })).success).toBe(false);
    expect(assertionSchema.safeParse(make("001", { act: "prescribed", time: { date: null, precision: "unknown", anchor: "2022-12-01" } })).success).toBe(true);
  });
  it("rejects unknown fields", () => {
    expect(assertionSchema.safeParse(make("001", { act: "prescribed", rxnorm: "6470" })).success).toBe(false);
  });
});

describe("provenance validation", () => {
  const segments = [{ segment_index: 5, text: "She said she was taking 200 milligrams." }];
  const file = (span: string) => ({
    contract: "icarus-medical-assertion/1.0", subject: "S", transcript_id: "T", source_file: "f", witness_block_id: "w", witness: "W",
    trial_day: 1, proceeding_date: null, segment_range: [1, 10],
    extractor: { method: "m", rules: "r", reviewed: false },
    assertions: [make("001", { raw: "200 milligrams", report: "patient_reported_taking", evidence: [{ seg: 5, span }] })],
    relationships: [],
  });
  it("accepts a verbatim span and rejects a paraphrase", () => {
    expect(validateExtraction(file("taking 200 milligrams"), segments).errors).toEqual([]);
    expect(validateExtraction(file("taking two hundred milligrams"), segments).errors.join()).toContain("span not found verbatim");
  });
  it("rejects segments outside the witness block", () => {
    const outside = file("taking 200 milligrams");
    outside.assertions[0].evidence = [{ seg: 99, span: "x" }];
    expect(validateExtraction(outside, segments).errors.join()).toContain("outside witness block");
  });
});

describe("medication keys and lineage", () => {
  it("maps brand and generic names and keeps unknowns visible", () => {
    expect(medicationKey("Ativan", keys)).toBe("lorazepam");
    expect(medicationKey("Zoloft (sertraline)", keys)).toBe("sertraline");
    expect(medicationKey("Mystery", keys)).toBe("unmapped:mystery");
  });
  it("flags a taper that starts from a dose the record never reached, and never resolves it", () => {
    const rx = { ...make("001", { act: "prescribed", med: { name: "Ativan", dose: { value: 0.5, unit: "mg" } } }), status: "asserted", temporality: "current" };
    const taper = { ...make("002", { act: "advised", time: { date: "2022-11-02", precision: "exact" }, action: { type: "taper", from: { value: 1, unit: "mg" }, to: { value: 0.75, unit: "mg" } } }), status: "asserted", temporality: "current" };
    const conflicts = detectMedicalConflicts(buildMedicationLineages([rx, taper], keys));
    const hit = conflicts.find((c: { relationship: string }) => c.relationship === "action_from_dose_disagrees_with_prior_state");
    expect(hit?.reconciliation).toBe("unresolved");
  });
  it("does not treat a hypothetical scheduled increase as a dose state", () => {
    const rx = { ...make("001", { act: "prescribed", med: { name: "Zoloft", dose: { value: 25, unit: "mg" } } }), status: "asserted", temporality: "current" };
    const planned = { ...make("002", { act: "prescribed", med: { name: "Zoloft" }, time: { date: null, precision: "relative", anchor: "2022-09-15" }, action: { type: "increase", from: { value: 25, unit: "mg" }, to: { value: 50, unit: "mg" } } }), status: "asserted", temporality: "hypothetical" };
    const taking = { ...make("003", { report: "patient_reported_taking", med: { name: "Zoloft", dose: { value: 25, unit: "mg" } }, time: { date: "2022-10-20", precision: "exact" } }), status: "asserted", temporality: "current" };
    expect(detectMedicalConflicts(buildMedicationLineages([rx, planned, taking], keys)).filter((c: { severity: string }) => c.severity === "review")).toEqual([]);
  });
});

describe("a change restated on another day", () => {
  it("corroborates instead of creating a new dose state", () => {
    const first = { ...make("001", { act: "prescribed", med: { name: "Ativan", dose: { value: 10, unit: "mg" } }, time: { date: "2023-01-16", precision: "exact" } }), status: "asserted", temporality: "current" };
    const raise = { ...make("002", { act: "advised", med: { name: "Ativan", dose: { value: 20, unit: "mg" } }, time: { date: "2023-01-23", precision: "exact" }, action: { type: "increase", from: { value: 10, unit: "mg" }, to: { value: 20, unit: "mg" } } }), status: "asserted", temporality: "current" };
    const again = { ...make("003", { act: "advised", med: { name: "Ativan", dose: { value: 20, unit: "mg" } }, time: { date: "2023-01-23", precision: "exact" }, action: { type: "increase", from: { value: 10, unit: "mg" }, to: { value: 20, unit: "mg" } } }), status: "asserted", temporality: "current" };
    const review = detectMedicalConflicts(buildMedicationLineages([first, raise, again], keys)).filter((c: { severity: string }) => c.severity === "review");
    expect(review).toEqual([]);
  });
  it("flags a report of taking against a report of stopping on the same date", () => {
    const taking = { ...make("001", { report: "patient_reported_taking", time: { date: "2022-12-16", precision: "exact" } }), status: "asserted", temporality: "current" };
    const stopping = { ...make("002", { report: "patient_reported_stopping", time: { date: "2022-12-16", precision: "exact" } }), status: "asserted", temporality: "current" };
    const found = detectMedicalConflicts(buildMedicationLineages([taking, stopping], keys)).map((c: { relationship: string }) => c.relationship);
    expect(found).toContain("same_date_contradictory_reports");
  });
});

describe.each(["tufts-day09", "tufts-day10"])("%s extraction (checked into the repo)", (name) => {
  const root = path.resolve(__dirname, "../..");
  const extraction = JSON.parse(readFileSync(path.join(root, `content/investigation/medical/assertions/${name}.assertions.json`), "utf8"));
  const transcript = readFileSync(path.join(root, "transcripts/preserved", extraction.source_file), "utf8");
  it("has every assertion span verbatim in the preserved transcript", () => {
    const { errors } = validateExtraction(extraction, parseTranscriptTurns(transcript));
    expect(errors).toEqual([]);
  });
});
