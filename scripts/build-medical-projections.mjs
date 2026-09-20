#!/usr/bin/env node
// Validates medical-assertion extractions against the preserved transcript, then writes the deterministic
// projections (medication lineages, conflicts, clinical chronology, report). No model calls. No database writes.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { parseTranscriptTurns } from "./transcript-first-pass-lib.mjs";
import {
  assertionSchema, relationshipSchema, validateExtraction, buildMedicationLineages, detectMedicalConflicts,
  buildClinicalTimeline, checkExpectations, parseCsv, medicationKey, renderReport,
} from "./medical-assertions-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const medicalDir = path.join(root, "content", "investigation", "medical");
const args = process.argv.slice(2);

if (args.includes("--write-schemas")) {
  for (const [name, schema] of [["medical-assertion", assertionSchema], ["medical-relationship", relationshipSchema]]) {
    fs.writeFileSync(path.join(root, "contracts", `${name}.schema.json`), `${JSON.stringify(z.toJSONSchema(schema), null, 2)}\n`);
    console.log(`wrote contracts/${name}.schema.json`);
  }
  process.exit(0);
}

const writeJson = (dir, name, value) => {
  fs.mkdirSync(path.join(medicalDir, dir), { recursive: true });
  fs.writeFileSync(path.join(medicalDir, dir, name), `${JSON.stringify(value, null, 2)}\n`);
};

const combineIndex = args.indexOf("--combine");
const combineName = combineIndex >= 0 ? args[combineIndex + 1] : null;
const inputs = args.filter((a, index) => !a.startsWith("--") && index !== combineIndex + 1);
const files = inputs.length ? inputs : fs.readdirSync(path.join(medicalDir, "assertions")).filter((f) => f.endsWith(".assertions.json")).map((f) => path.join(medicalDir, "assertions", f));
const keys = JSON.parse(fs.readFileSync(path.join(medicalDir, "medication-keys.json"), "utf8"));
let failed = false;

function validated(file) {
  const base = path.basename(file).replace(/.assertions.json$/, "");
  const extraction = JSON.parse(fs.readFileSync(file, "utf8"));
  const segments = parseTranscriptTurns(fs.readFileSync(path.join(root, "transcripts", "preserved", extraction.source_file), "utf8"));
  const { errors, data } = validateExtraction(extraction, segments);
  if (errors.length) {
    failed = true;
    console.error(`${base}: ${errors.length} validation error(s)`);
    for (const error of errors) console.error(`  ${error}`);
    return null;
  }
  return data;
}

function project(base, data, sources) {
  const lineages = buildMedicationLineages(data.assertions, keys);
  const conflicts = detectMedicalConflicts(lineages);
  const timeline = buildClinicalTimeline(data.assertions, data.relationships);
  let expectations = null, csvCoverage = null;
  const expectPath = path.join(medicalDir, "acceptance", `${base}.expect.json`);
  if (fs.existsSync(expectPath)) {
    const expectFile = JSON.parse(fs.readFileSync(expectPath, "utf8"));
    expectations = checkExpectations(data.assertions, expectFile.expectations, keys);
    if (expectFile.csv) {
      const rows = parseCsv(fs.readFileSync(path.join(root, expectFile.csv), "utf8")).slice(1);
      const present = new Set(lineages.map((l) => l.medication_key));
      csvCoverage = rows.map((row) => ({ name: row[0], key: medicationKey(row[0], keys), covered: present.has(medicationKey(row[0], keys)) }));
    }
  }
  writeJson("medication-lineages", `${base}.lineages.json`, { source: base, sources, lineages });
  writeJson("conflicts", `${base}.conflicts.json`, { source: base, sources, conflicts });
  writeJson("timelines", `${base}.timeline.json`, { source: base, sources, ...timeline });
  fs.mkdirSync(path.join(medicalDir, "reports"), { recursive: true });
  fs.writeFileSync(path.join(medicalDir, "reports", `${base}.report.md`), `${renderReport({ data, lineages, conflicts, timeline, expectations, csvCoverage })}
`);
  const met = expectations ? `${expectations.filter((x) => x.met).length}/${expectations.length} expectations met` : "no expectations file";
  console.log(`${base}: ${data.assertions.length} assertions, ${data.relationships.length} relationships, ${lineages.length} medications, ${conflicts.length} review candidates, ${met}`);
  if (expectations?.some((x) => !x.met)) failed = true;
}

const loaded = files.map((file) => ({ file, base: path.basename(file).replace(/.assertions.json$/, ""), data: validated(file) }));
function combine(all) {
  const first = all[0];
  return {
    ...first,
    witness_block_id: all.map((d) => d.witness_block_id).join(" + "),
    source_file: all.map((d) => d.source_file).join(" + "),
    extractor: { ...first.extractor, reviewed: all.every((d) => d.extractor.reviewed) },
    assertions: all.flatMap((d) => d.assertions),
    relationships: all.flatMap((d) => d.relationships),
  };
}

if (!failed) {
  if (combineName) {
    project(combineName, combine(loaded.map((l) => l.data)), loaded.map((l) => l.base));
  } else {
    for (const l of loaded) project(l.base, l.data, [l.base]);
    if (!inputs.length) {
      const byWitness = new Map();
      for (const l of loaded) byWitness.set(l.data.witness, [...(byWitness.get(l.data.witness) ?? []), l]);
      for (const group of byWitness.values()) {
        if (group.length > 1) project(`${group[0].base.split("-day")[0]}-combined`, combine(group.map((g) => g.data)), group.map((g) => g.base));
      }
    }
  }
}
process.exit(failed ? 1 : 0);
